// Level 1: no ECC, no platform account.
// With no credentials in the default profile, CAP mocks SAMPLEFLIGHT in-process
// and loads the sample rows from srv/external/data/*.csv.

import cds from '@sap/cds'
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

process.env.CDS_PLUGIN_UI5_ACTIVE ??= 'false' // no UI5 dev server (and its telemetry) inside tests
cds.test.in(import.meta.dirname, '..')
const { GET, POST, PATCH, DELETE } = cds.test('serve', 'all', '--with-mocks', '--in-memory') // what cds watch runs

const DATE = /^\d{4}-\d{2}-\d{2}$/

describe('mock mode (bare cds watch)', () => {
  it('serves flights from the sample data', async () => {
    const { status, data } = await GET `/odata/v4/flight/Flights?$top=5`
    assert.equal(status, 200)
    assert.equal(data.value.length, 5)
  })

  it('filters and counts like the List Report does', async () => {
    const { data } = await GET `/odata/v4/flight/Flights?$filter=carrid eq 'LH'&$orderby=fldate&$count=true`
    assert.ok(data['@odata.count'] > 0)
    assert.equal(data.value.length, data['@odata.count'])
    assert.ok(data.value.every((f) => f.carrid === 'LH'))
    const dates = data.value.map((f) => f.fldate)
    assert.deepEqual(dates, [...dates].sort())
  })

  it('returns fldate as a calendar date', async () => {
    const { data } = await GET `/odata/v4/flight/Flights?$select=fldate&$top=10`
    for (const f of data.value) assert.match(f.fldate, DATE)
  })

  it('reads one flight by its key, as the Object Page does', async () => {
    const { data: list } = await GET `/odata/v4/flight/Flights?$top=1`
    const { connid, fldate, carrid } = list.value[0]
    const { status, data } = await GET(`/odata/v4/flight/Flights(connid='${connid}',fldate=${fldate},carrid='${carrid}')`)
    assert.equal(status, 200)
    assert.equal(data.connid, connid)
    assert.equal(data.fldate, fldate)
  })

  it('serves carriers', async () => {
    const { data } = await GET `/odata/v4/flight/Carriers`
    assert.ok(data.value.some((c) => c.carrid === 'LH' && c.carrname === 'Lufthansa'))
  })

  it('is read-only', async () => {
    const key = `Flights(connid='0017',fldate=2026-11-25,carrid='AA')`
    await assert.rejects(POST(`/odata/v4/flight/Flights`, { carrid: 'XX', connid: '0001', fldate: '2026-10-10' }), { status: 405 })
    await assert.rejects(PATCH(`/odata/v4/flight/${key}`, { price: 1 }), { status: 405 })
    await assert.rejects(DELETE(`/odata/v4/flight/${key}`), { status: 405 })
  })

  it('exposes the UI annotations and switches search off', async () => {
    const { data } = await GET `/odata/v4/flight/$metadata`
    assert.match(data, /Term="UI\.LineItem"/)
    assert.match(data, /Term="UI\.SelectionFields"/)
    assert.match(data, /Term="Capabilities\.SearchRestrictions"/)
    assert.match(data, /<Property Name="fldate" Type="Edm\.Date"/)
  })
})
