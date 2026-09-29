using SAMPLEFLIGHT as ecc from './external/SAMPLEFLIGHT';

service FlightService {
  @readonly entity Flights  as projection on ecc.FlightCollection;
  @readonly entity Carriers as projection on ecc.CarrierCollection;
}