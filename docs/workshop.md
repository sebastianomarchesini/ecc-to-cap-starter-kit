# Build it yourself

This rebuilds the kit from an empty dev space in SAP Business Application Studio, one step at a time. Each step ends with a checkpoint. If a checkpoint fails, [troubleshooting.md](troubleshooting.md) has the usual causes.

Steps 1 to 4 need no ECC and no destination. Step 5 needs both ([ecc-setup.md](ecc-setup.md)).

## 1. Create the project: tick only what the read path needs

In SAP Business Application Studio: **New Project from Template → CAP Project**.

| Field | Choice | Why |
|---|---|---|
| Runtime | Node.js | The simplest remote-service consumption |
| Database | None | Every read passes through to ECC |
| Deployment | Cloud Foundry: MTA Deployment | Kyma, multitenancy and CI/CD are left out |
| XSUAA | yes | Log-in at the approuter |
| Application Router | yes | The Fiori app needs a home |
| Connectivity service | yes | The road to ECC through the Cloud Connector |
| Destination service | yes | Holds the ECC address |
| HTML5 Application Repository | yes | Hosts the Fiori app |
| Portal, logging, notifications, messaging | no | Not needed for a read path |
| Sample content | none or minimal | The extended sample adds a bookshop you would delete |

Everything you tick ends up in `mta.yaml`, and then it is yours to run.

Outside SAP Business Application Studio: `npm i -g @sap/cds-dk`, then `cds init`, and add the facets you need with `cds add`.

**Checkpoint.** `cds watch` starts and reports no service yet.

## 2. Import the contract and fix one line

Copy `srv/external/SAMPLEFLIGHT.edmx` from this repository, or save your own system's `$metadata` ([ecc-setup.md](ecc-setup.md#importing-the-contract)) and strip its host links with `node scripts/strip-metadata-links.mjs <file>`. Then:

```sh
cds import srv/external/SAMPLEFLIGHT.edmx --as cds
```

In the generated `srv/external/SAMPLEFLIGHT.cds`, find `fldate` in `FlightCollection`, delete the `@odata.Type : 'Edm.DateTime'` line above it, and change its type:

```cds
key fldate : Date not null; // was: DateTime, with @odata.Type 'Edm.DateTime'
```

**Checkpoint.** `package.json` now has a `SAMPLEFLIGHT` entry of kind `odata-v2` under `cds.requires`.

## 3. Five lines of CDS, one line of JavaScript

`srv/flight-service.cds`:

```cds
using SAMPLEFLIGHT as ecc from './external/SAMPLEFLIGHT';

service FlightService {
  @readonly entity Flights  as projection on ecc.FlightCollection;
  @readonly entity Carriers as projection on ecc.CarrierCollection;
}
```

`srv/flight-service.js`, with the same base name as the `.cds` file:

```js
import cds from '@sap/cds';

export default class FlightService extends cds.ApplicationService {
  async init() {
    const ecc = await cds.connect.to('SAMPLEFLIGHT');
    this.on('READ', ['Flights', 'Carriers'], req => ecc.run(req.query));
    return super.init();
  }
}
```

**Checkpoint.** The `cds watch` log shows `serving FlightService` with an `impl:` line pointing at `srv/flight-service.js`, and `mocking SAMPLEFLIGHT`.

## 4. Run it with no backend

Copy `srv/external/data/` from this repository, or write your own CSV files named `SAMPLEFLIGHT-FlightCollection.csv` and `SAMPLEFLIGHT-CarrierCollection.csv`. CAP loads them into an in-memory database for the mocked service.

**Checkpoint.** <http://localhost:4004/odata/v4/flight/Flights?$top=3> returns three flights, and `fldate` looks like `2026-11-25`.

## 5. Point it at ECC

Add credentials for the `bas` and `production` profiles to the `SAMPLEFLIGHT` entry in `package.json`:

```json
"[bas]":        { "credentials": { "destination": "ecc-gateway", "path": "/sap/opu/odata/IWFND/SAMPLEFLIGHT" } },
"[production]": { "credentials": { "destination": "ecc-gateway", "path": "/sap/opu/odata/IWFND/SAMPLEFLIGHT" } }
```

Create `default-env.json` from [`default-env.json.example`](../default-env.json.example), then run `cds watch --profile bas`.

**Checkpoint.** The log shows `connect to SAMPLEFLIGHT > odata-v2 { destination: 'ecc-gateway', … }`, and both calls in [`test/flight.http`](../test/flight.http) return the same flights.

## 6. The whole UI is annotations

Run **Fiori: Open Application Generator**:

| Step | Choice |
|---|---|
| Template | List Report Page |
| Data source | Use a Local CAP Project → this project → `FlightService` → `Flights` |
| Navigation entity | None |
| Module name | `flightproject` |
| Deployment configuration | Yes: Cloud Foundry, existing standalone approuter |
| Fiori Launchpad configuration | No |

Then write `app/flightproject/annotations.cds` (copy it from this repository). Three details carry most of the value:

- `@title` on each property labels the filter bar and the Object Page, not just the table columns. ECC's metadata carries no labels, and yours sit above the seam, where they belong.
- `Capabilities.SearchRestrictions.Searchable: false` hides the free-text search, because the ECC service offers none.
- `@Measures.ISOCurrency: currency` renders each price with its currency.

**Checkpoint.** Open the app from the `cds watch` start page and press **Go**. Filter *Airline* = `LH`, sort by date, and open a flight. The date on the Object Page matches the list.

## 7. Deploy

```sh
cf login
mbt build
cf deploy mta_archives/<name>.mtar
```

**Checkpoint.** Through the approuter route, `/flightproject/index.html` shows the same data you saw in step 6. A direct call to the CAP service URL returns 401, which is expected.

## Check your understanding

You want a CAP service on the platform to read data from an on-premise ECC system. Which of these is **not** required?

- A) Cloud Connector
- B) A destination
- C) An OData service exposed by SAP Gateway
- D) SAP HANA

<details><summary>Answer</summary>

D. The CAP service in this kit has no database at all. Every read goes live to ECC through the destination and the Cloud Connector.

</details>
