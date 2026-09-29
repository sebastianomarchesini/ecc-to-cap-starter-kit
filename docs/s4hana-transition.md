# Moving to SAP S/4HANA: what changes, and what does not

Moving to S/4HANA changes the backend APIs, not your app. CAP does not hide the backend. It gives you one file to change instead of twenty. That is worth doing, but it is not magic, and this page is the honest version.

## The target

There is no flight API on the SAP Business Accelerator Hub. On the S/4HANA side, the counterpart of `SAMPLEFLIGHT` is SAP's own RAP rebuild of the flight model, the [ABAP Flight Reference Scenario](https://github.com/SAP-samples/abap-platform-refscen-flight) (`/DMO/` objects, OData V4).

## Usually stays put

- Your CAP service and the contract your UI consumes (`FlightService`, its entity and field names)
- The Fiori app and its annotations, which are built on that service
- Business logic in your CAP handlers
- Tests written against your own service
- `mta.yaml`, the deployment, and the destination pattern

## Usually changes: one seam, three swaps

The seam is the imported model plus the projections in `srv/flight-service.cds`. At the swap you change three things:

| Swap | Today (ECC) | After (S/4HANA, RAP) |
|---|---|---|
| External model | `SAMPLEFLIGHT.edmx` → `cds import` | The RAP service's `$metadata` → `cds import` |
| Protocol (`kind`) | `odata-v2` | `odata` (V4) |
| Destination and path | `ecc-gateway`, `/sap/opu/odata/IWFND/SAMPLEFLIGHT` | Your S/4HANA destination and the service binding's path |

Today the projections pass ECC's names straight through. At the swap they start mapping, so the service contract and the UI keep the names they already use. A sketch, with field names from the reference scenario's flight entity (check them against your own service's `$metadata`; this is not part of the tested kit):

```cds
service FlightService {
  @readonly entity Flights as projection on s4.Flight {
    key AirlineID     as carrid,
    key ConnectionID  as connid,
    key FlightDate    as fldate,
        Price         as price,
        CurrencyCode  as currency,
        PlaneType     as planetype,
        MaximumSeats  as seatsmax,   // same label, different meaning, see below
        OccupiedSeats as seatsocc
  };
}
```

The trade-off is that ECC's names live on in your API. You can rename now or later; either way it is one file.

The date fix goes away: in the RAP model, `FlightDate` is a real `Edm.Date` ([trap 8](troubleshooting.md#8-flights-one-day-early-then-an-object-page-that-cannot-load) does not exist there).

## What catches most projects out

**The protocol changes sometimes, not always.** Newer RAP services are OData V4, but S/4HANA's own Business Partner API is still OData V2. Read the service before you plan the swap.

**Same name, new meaning.** The UI label says *Capacity*. On ECC, `seatsmax` counts economy class only; business and first are separate fields (`seatsmax_b`, `seatsmax_f`). In the RAP model, `MaximumSeats` is the whole aircraft. The mapping compiles, and the number means something different. No test suite catches that; a functional consultant does. Test the values, not just that the call succeeds.

**Fields with no counterpart.** `paymentsum` and the per-class seat fields have no equivalent in the RAP flight entity. They leave the API, and removing them is a product decision, not a mapping.

**After a system conversion, old services often still run.** On S/4HANA on-premise or private cloud, `RMTSAMPLEFLIGHT` ships with `SAP_GWFND` and can be activated with system alias `LOCAL`, so the swap could be zero lines. But it is not clean core, and it does not exist on S/4HANA Cloud Public Edition or in the ABAP environment of the platform. The clean-core answer is a RAP service.

**Authentication and connectivity.** An S/4HANA Cloud system is reached over the internet (`ProxyType: Internet`, OAuth or client certificates), not through the Cloud Connector. The destination changes; your code does not.
