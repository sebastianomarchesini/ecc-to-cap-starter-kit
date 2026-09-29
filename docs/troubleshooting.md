# Troubleshooting: ten traps, and none of them is in ECC

Every one of these cost time while the kit was built. Most of them sit between your dev space and ECC, not in ECC.

## Split the problem first

Three ways to run the app, each proving something different:

| Level | Command | What it proves |
|---|---|---|
| Mocked | `npm run watch` | The model, the service and the UI, with no ECC at all |
| Live ECC from BAS | `npm run bas` | The whole chain, through the BAS proxy |
| Raw calls | [`test/flight.http`](../test/flight.http) | Separates CAP from connectivity: the first call goes straight to ECC through the destination, the second through CAP |

If the first raw call works and the second does not, it is a CAP problem. If both fail, look at the destination, the Cloud Connector or ECC.

With `npm run bas`, the log must show

```text
[cds] - connect to SAMPLEFLIGHT > odata-v2 { destination: 'ecc-gateway', path: '/sap/opu/odata/IWFND/SAMPLEFLIGHT' }
```

If it says `mocking SAMPLEFLIGHT` instead, the `bas` profile is not applied.

## 1. The BAS Service Center shows an empty list

**Cause.** The Service Center browses the Gateway catalog service, and the Cloud Connector exposes only `/sap/opu/odata`, so the catalog path is not reachable.
**Fix.** Skip the Service Center. Save `$metadata` and run `cds import` on it ([ecc-setup.md](ecc-setup.md#importing-the-contract)).

## 2. 404 on the service every blog post uses

**Cause.** The documented `RMTSAMPLEFLIGHT` is not active on every system. The system this kit was built against serves `SAMPLEFLIGHT` under `/sap/opu/odata/IWFND/`, with different field names.
**Fix.** Read the name and path from your system (`/IWFND/MAINT_SERVICE`) and from its `$metadata`. The metadata is the truth.

## 3. The handler never loads

**Symptom.** No `impl:` line in the serving log, and a 501 saying the entity "cannot be served generically".
**Cause.** CAP pairs `flight-service.cds` with `flight-service.js` by base name. A typo such as `fligh-service.cds` and the handler is never picked up.
**Fix.** Give both files the same base name.

## 4. `require is not defined`

**Cause.** Projects created by the current CAP wizard are ES modules (`"type": "module"` in `package.json`).
**Fix.** Write handlers with `import` and `export default class … extends cds.ApplicationService`, not `require` and `module.exports`.

## 5. `ENOTFOUND …dest`

**Cause.** In a dev space, `http://<destination>.dest` works only through the BAS proxy, and Node's built-in `fetch` ignores the `http_proxy` variable.
**Fix, short term.** `NODE_USE_ENV_PROXY=1` makes Node honour the proxy variables.

## 6. Still `ENOTFOUND` after running the Fiori generator

**Cause.** The generator adds `@sap-cloud-sdk/http-client`, and from then on CAP calls ECC through the SAP Cloud SDK, which does not read `NODE_USE_ENV_PROXY`.
**Fix.** Describe the destination and the proxy in `default-env.json` (copy [`default-env.json.example`](../default-env.json.example)) and run with `--profile bas`.

| Scenario | Needs `default-env.json`? |
|---|---|
| Deployed on Cloud Foundry | No: the bound destination and connectivity services do the work |
| `cds watch` (mocked) | No |
| `cds watch --profile bas` (live ECC from BAS) | Yes |

## 7. A plain 500 from the BAS proxy

**Symptom.** Every call through `http://<destination>.dest/...` answers `Internal Server Error`, with no detail.
**Cause.** The destination lacks `HTML5.DynamicDestination = true`.
**Fix.** Add the property ([ecc-setup.md](ecc-setup.md#stop-3-the-destination)).

## 8. Flights one day early, then an Object Page that cannot load

**Symptom, part one.** A flight on the 29th shows as the 28th at 8 PM in a browser on US Eastern time.
**Cause.** OData V2 `Edm.DateTime` carries no time zone. Gateway sends midnight UTC, `cds import` maps the field to `DateTime`, and the UI shows it in the browser's time zone.

**Symptom, part two.** You change the type to `Date` but keep the `@odata.Type : 'Edm.DateTime'` annotation that `cds import` generated. The list now looks right, but the flight date in the OData V4 payload is still `2026-11-25T00:00:00Z`, a timestamp under a property declared `Edm.Date`. UI5 builds the Object Page URL from that value, and CAP turns it into the key `fldate=datetime'2026-11-25T00:00:00ZT00:00:00'`, which Gateway cannot parse.
**Cause.** CAP decides how to decode a V2 value from `@odata.Type` when it is present, so the annotation makes it decode the date as a timestamp. It is not needed on the way out: CAP already writes a `Date` as `datetime'…T00:00:00'` in V2 filters and keys.

**Fix.** In `srv/external/SAMPLEFLIGHT.cds`, delete the annotation and type the field as `Date`:

```cds
key fldate : Date not null; // was: DateTime, with @odata.Type 'Edm.DateTime'
```

Filters and keys still reach Gateway as `datetime'2026-11-25T00:00:00'`, and the payload carries `2026-11-25`. [`test/gateway-contract.test.js`](../test/gateway-contract.test.js) checks all three, including the round trip from a list row to the Object Page. The edit lives in a generated file, so redo it after every `cds import --force`. The tests fail if you forget.

The lesson generalizes: test the values, not just that the call succeeds.

## 9. "Failed to resolve destination" on Cloud Foundry

**Cause.** On Cloud Foundry, destination names are matched case-sensitively. The BAS proxy is more forgiving, so a name that works in the dev space can fail after deployment.
**Fix.** Use one exact name everywhere: in the cockpit, in `package.json` under `[production]`, and in `default-env.json`. An all-lowercase name such as `ecc-gateway` avoids the question. To fix a deployed app without redeploying:

```sh
cf set-env FLIGHTCAP-srv cds_requires_SAMPLEFLIGHT_credentials_destination ecc-gateway
cf restage FLIGHTCAP-srv
```

Check the bindings with `cf env FLIGHTCAP-srv`: `VCAP_SERVICES` must contain `destination`, `connectivity` and `xsuaa`.

## 10. Your internal host name in a file you are about to commit

**Symptom.** A repository that was meant to show a pattern also shows your landscape.
**Causes.** Three, and all three are easy to miss:

- **Saved metadata.** Gateway writes the system's own URL into `$metadata` as `<atom:link rel="self" href="http://<host>:<port>/…"/>`. With the Cloud Connector forwarding the internal host, that is your internal host name.
- **`default-env.json`.** It names your destination and your proxy settings.
- **Your Git identity.** A dev space may already have `git config user.name` and `user.email` set from the account you logged in with, which is a company account in a customer landscape.

**Fix.**

```sh
npm run strip-metadata          # removes the atom:link elements from srv/external/SAMPLEFLIGHT.edmx
git config user.email           # check before the first commit to a public repository
```

`default-env.json` is in `.gitignore`; keep it there. CI fails if saved metadata still contains a link or if `default-env.json` has been committed. In the Cloud Connector, set **Host In Request Header** to **Use Virtual Host**, so that responses show the virtual host rather than the real one.

## Bad Gateway after deployment

1. Open the browser developer tools, Network tab. A 502 on `index.html` points at the approuter or the HTML5 Application Repository. A 502 on the data call means CAP cannot reach ECC, which is the more likely case.
2. `cf logs FLIGHTCAP-srv --recent`: the `[remote]` error names the cause.
3. The usual suspects are the destination name and its case under `[production]` (trap 9) and a missing `HTML5.DynamicDestination` (trap 7).

Other useful commands: `cf apps` (the approuter is the app named `FLIGHTCAP`), `cf html5-list -di` (deployed HTML5 apps, with the HTML5 CLI plugin).
