// The live path, without an ECC: a stand-in for SAP Gateway that answers in
// OData V2 JSON and records every request CAP sends it.
//
// This pins down the contract between CAP and Gateway:
//   - OData V4 in, OData V2 out: $filter, $orderby and $top reach Gateway;
//   - dates travel as V2 datetime'...' literals, in filters and in keys;
//   - fldate comes back as a calendar date, so the key the UI sends back is
//     one Gateway can parse (see docs/troubleshooting.md, trap 8).

import http from 'node:http'
import cds from '@sap/cds'
import { after, describe, it } from 'node:test'
import assert from 'node:assert/strict'

const SERVICE = '/sap/opu/odata/IWFND/SAMPLEFLIGHT'
const v2date = (d) => `/Date(${Date.parse(d + 'T00:00:00Z')})/` // how Gateway serializes Edm.DateTime

const flights = [
  { connid: '0017', fldate: v2date('2026-11-25'), carrid: 'AA', price: '408.38', currency: 'USD', planetype: '747-400',
    seatsmax: 385, seatsocc: 329, paymentsum: '163025.30', seatsmax_b: 31, seatsocc_b: 16, seatsmax_f: 21, seatsocc_f: 10 },
  { connid: '0400', fldate: v2date('2027-01-05'), carrid: 'LH', price: '707.32', currency: 'EUR', planetype: 'A380-800',
    seatsmax: 475, seatsocc: 401, paymentsum: '342770.40', seatsmax_b: 30, seatsocc_b: 24, seatsmax_f: 20, seatsocc_f: 7 },
]
const carriers = [
  { carrid: 'AA', carrname: 'American Airlines', currcode: 'USD', url: 'http://www.aa.com' },
  { carrid: 'LH', carrname: 'Lufthansa', currcode: 'EUR', url: 'http://www.lufthansa.com' },
]

const seen = [] // every request the stand-in received, decoded
const gateway = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url)
  seen.push({ method: req.method, url })
  res.setHeader('content-type', 'application/json')
  const [, set, key] = url.match(/\/(FlightCollection|CarrierCollection)(\([^)]*\))?/) ?? []
  const rows = set === 'FlightCollection' ? flights : set === 'CarrierCollection' ? carriers : null
  if (req.method !== 'GET' || !rows) {
    res.statusCode = 400
    return res.end(JSON.stringify({ error: { message: { value: 'unexpected request' } } }))
  }
  if (key) return res.end(JSON.stringify({ d: rows[0] }))
  const body = { results: rows }
  if (url.includes('$inlinecount=allpages')) body.__count = String(rows.length)
  res.end(JSON.stringify({ d: body }))
})
await new Promise((resolve) => gateway.listen(0, '127.0.0.1', resolve))
process.env.cds_requires_SAMPLEFLIGHT_credentials_url = `http://127.0.0.1:${gateway.address().port}${SERVICE}`

process.env.CDS_PLUGIN_UI5_ACTIVE ??= 'false' // no UI5 dev server (and its telemetry) inside tests
const { GET, POST } = cds.test(import.meta.dirname + '/..')
after(() => gateway.close())

const last = () => seen.at(-1)?.url ?? ''
const DATETIME_KEY = /fldate=datetime'\d{4}-\d{2}-\d{2}T00:00:00'/

describe('live path against a Gateway stand-in', () => {
  it('connects to the remote service instead of mocking it', async () => {
    const before = seen.length
    await GET `/odata/v4/flight/Carriers`
    assert.equal(seen.length, before + 1)
    assert.match(last(), /\/CarrierCollection\?/)
  })

  it('sends filter and sort to Gateway, with dates as datetime literals', async () => {
    await GET `/odata/v4/flight/Flights?$filter=carrid eq 'AA' and fldate ge 2026-11-01&$orderby=fldate desc&$top=5`
    const url = last()
    assert.match(url, /\/FlightCollection\?/)
    assert.ok(url.includes(`$filter=carrid eq 'AA' and fldate ge datetime'2026-11-01T00:00:00'`), url)
    assert.ok(url.includes('$orderby=fldate desc'), url)
    assert.ok(url.includes('$top=5'), url)
  })

  it('maps $count=true to $inlinecount=allpages', async () => {
    const { data } = await GET `/odata/v4/flight/Flights?$count=true`
    assert.ok(last().includes('$inlinecount=allpages'), last())
    assert.equal(Number(data['@odata.count']), flights.length)
  })

  it('returns fldate as a calendar date, not a UTC timestamp', async () => {
    const { data } = await GET `/odata/v4/flight/Flights`
    assert.deepEqual(data.value.map((f) => f.fldate), ['2026-11-25', '2027-01-05'])
  })

  it('reads one flight by key with a datetime key predicate', async () => {
    const { status, data } = await GET(`/odata/v4/flight/Flights(connid='0017',fldate=2026-11-25,carrid='AA')`)
    assert.equal(status, 200)
    assert.ok(last().includes(`FlightCollection(connid='0017',fldate=datetime'2026-11-25T00:00:00',carrid='AA')`), last())
    assert.equal(data.fldate, '2026-11-25')
  })

  it('accepts the key it hands out: list row -> Object Page -> Gateway', async () => {
    const { data: list } = await GET `/odata/v4/flight/Flights`
    const { connid, fldate, carrid } = list.value[0] // exactly what UI5 puts in the Object Page URL
    const { status } = await GET(`/odata/v4/flight/Flights(connid='${connid}',fldate=${fldate},carrid='${carrid}')`)
    assert.equal(status, 200)
    assert.match(last(), DATETIME_KEY)
  })

  it('is read-only and never forwards a write to ECC', async () => {
    const before = seen.length
    await assert.rejects(POST(`/odata/v4/flight/Flights`, { carrid: 'XX', connid: '0001', fldate: '2026-10-10' }), { status: 405 })
    assert.equal(seen.length, before)
  })
})
