# flightproject

The Fiori elements app of the ECC-to-CAP Starter Kit: a List Report and an Object Page on `FlightService.Flights`, with no UI5 code of its own.

- Everything the user sees comes from [`annotations.cds`](annotations.cds): labels, filter fields, columns and the Object Page field group.
- The OData V4 service is `/odata/v4/flight/`, served by the CAP project one level up.
- Generated with the SAP Fiori application generator 1.32.0 (template *List Report Page V4*, UI5 1.152.0, theme `sap_horizon`).

## Run it

From the project root, `npm run watch`, then open <http://localhost:4004/flightproject/index.html>. The page loads UI5 from the SAPUI5 CDN, so the browser needs internet access.

## Build it

`npm run build:cf` in this folder produces `dist/flightproject.zip` for the HTML5 Application Repository. `mbt build` at the project root runs it for you.

The generated OPA test journeys were left out because they need a Fiori launchpad sandbox page. The Fiori tools test generator recreates them.
