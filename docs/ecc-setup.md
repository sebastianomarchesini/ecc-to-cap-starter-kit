# Preparing ECC and the connection

Three stops, in the order a request travels them: the service in ECC, the Cloud Connector, and the destination. None of them requires ABAP development.

## What your ECC needs

- SAP NetWeaver AS ABAP 7.40 or higher.
- An embedded SAP Gateway through the `SAP_GWFND` component. A separate Gateway hub is not required.
- The `SAMPLEFLIGHT` service (or `RMTSAMPLEFLIGHT`, depending on the system) registered and active, with its ICF node active.
- Data in the flight tables.

The prerequisites are described in SAP Note 3782867. Its `SAP_UI` 7.53 line applies only if you deploy UI5 applications into the ABAP repository, which this kit does not do. For the front-end server's own maintenance strategy, see SAP Note 2217489. Both notes need an SAP support login.

## Stop 1: the service in ECC

| Need | Transaction | What to look for |
|---|---|---|
| Registered services, including inactive ones | `/IWFND/MAINT_SERVICE` | `SAMPLEFLIGHT` in the catalog, system alias `LOCAL` (the embedded Gateway) |
| Gateway itself switched on | `/IWFND/IWF_ACTIVATE` | The pop-up shows the status. Cancel is safe. |
| Backend registration | `/IWBEP/REG_SERVICE`, `SEGW` | Only needed if the service is missing entirely |
| ICF node | `SICF` | The node of the service path is active |
| Sample data | `SE38` → report `SAPBC_DATA_GENERATOR` (transaction `BC_DATA_GEN`) | Many systems have empty SFLIGHT tables |
| Catalog table | `SE16` → `/IWFND/I_MED_SRH` | For the curious |

Activating Gateway does not activate ICF nodes and does not register services. Check both afterwards.

Read the service name and path from your own system. Many blog posts use `RMTSAMPLEFLIGHT`; the system this kit was built against serves `SAMPLEFLIGHT` under `/sap/opu/odata/IWFND/`. Only the import and the path change.

To test the service inside ECC, use the SAP Gateway Client from `/IWFND/MAINT_SERVICE`. **Call Browser** opens the service under its internal URL, which you probably do not want on a shared screen.

## Stop 2: the Cloud Connector

The Cloud Connector tunnels requests from the platform into your network. Setting it up is out of scope here. Start with [SAP Help: Cloud Connector](https://help.sap.com/docs/connectivity/sap-btp-connectivity-cf/cloud-connector) and the Discovery Center mission *Set up connectivity between SAP ERP and SAP BTP*.

For this kit, the system mapping needs:

| Setting | Value |
|---|---|
| Back-end type | ABAP System |
| Protocol | HTTP (or HTTPS) |
| Virtual host and port | Any name you choose, for example `ecc-virtual:8001`. It exists only inside the tunnel. |
| Internal host and port | Your ECC's ICM HTTP port |
| Host In Request Header | **Use Virtual Host** |
| Resource | `/sap/opu/odata`, access policy *Path and all sub-paths* |

Why **Use Virtual Host**: Gateway builds the absolute URLs in its responses from the host it receives. That includes `__metadata.uri` in every V2 record and the `atom:link` elements in `$metadata`. With the internal host forwarded, those URLs carry your internal host name to anyone who sees the response. See [trap 10](troubleshooting.md#10-your-internal-host-name-in-a-file-you-are-about-to-commit).

Exposing only `/sap/opu/odata` also means the Gateway catalog service is not reachable. That is why the BAS Service Center stays empty ([trap 1](troubleshooting.md#1-the-bas-service-center-shows-an-empty-list)).

## Stop 3: the destination

Create it in your subaccount (Connectivity → Destinations). The name is the only thing about ECC your code knows.

| Property | Value |
|---|---|
| Name | `ecc-gateway` (the name must match `package.json` exactly on Cloud Foundry) |
| Type | `HTTP` |
| URL | `http://<virtual host>:<port>`, for example `http://ecc-virtual:8001` |
| Proxy Type | `OnPremise` |
| Authentication | `BasicAuthentication`, with a technical user that may read the service |
| Additional property `sap-client` | Your client |
| Additional property `WebIDEEnabled` | `true` |
| Additional property `WebIDEUsage` | `odata_gen` |
| Additional property `HTML5.DynamicDestination` | `true`. Without it, the BAS proxy answers every call with a plain 500 ([trap 7](troubleshooting.md#7-a-plain-500-from-the-bas-proxy)). |

**Check Connection** in the cockpit should report the destination as reachable. Then, from a terminal in SAP Business Application Studio:

```sh
curl -s "http://ecc-gateway.dest/sap/opu/odata/IWFND/SAMPLEFLIGHT/FlightCollection?\$top=1&\$format=json"
```

If `__metadata.uri` in the answer shows your virtual host, the Cloud Connector mapping is right. If it shows the internal host name, revisit **Host In Request Header**.

Principal propagation and OAuth destinations work at runtime but not through the BAS proxy. For testing from a dev space, use basic authentication.

## Importing the contract

1. Save the service's `$metadata` as `srv/external/SAMPLEFLIGHT.edmx`, from the Gateway Client or through the destination:

   ```sh
   curl -s "http://ecc-gateway.dest/sap/opu/odata/IWFND/SAMPLEFLIGHT/\$metadata" -o srv/external/SAMPLEFLIGHT.edmx
   ```

2. Remove the host links Gateway wrote into it, before anything else:

   ```sh
   npm run strip-metadata
   ```

3. Import it:

   ```sh
   cds import srv/external/SAMPLEFLIGHT.edmx --as cds
   ```

   This writes `srv/external/SAMPLEFLIGHT.cds` and a `SAMPLEFLIGHT` entry under `cds.requires` in `package.json`. If the `.cds` file already exists, `cds import` refuses to overwrite it unless you add `--force`.

4. Make the one hand edit in the generated file ([trap 8](troubleshooting.md#8-flights-one-day-early-then-an-object-page-that-cannot-load)): in `FlightCollection`, delete the `@odata.Type : 'Edm.DateTime'` line above `fldate` and change the type to `Date`:

   ```cds
   key fldate : Date not null; // was: DateTime, with @odata.Type 'Edm.DateTime'
   ```

   A re-import with `--force` regenerates the file and the edit is gone. `npm test` fails if you forget to redo it.

An EDMX file is an XML document in the CSDL vocabulary that describes an OData model. The `$metadata` document of every OData V2 service is one.
