using FlightService as s from '../../srv/flight-service';

annotate s.Flights with {
  carrid    @title: 'Airline';
  connid    @title: 'Flight';
  fldate    @title: 'Date';
  planetype @title: 'Plane';
  price     @title: 'Price'      @Measures.ISOCurrency: currency;
  currency  @title: 'Currency';
  seatsocc  @title: 'Occupied';
  seatsmax  @title: 'Capacity';
};

annotate s.Flights with @(
  Capabilities.SearchRestrictions.Searchable: false,
  UI: {
    HeaderInfo: { TypeName: 'Flight', TypeNamePlural: 'Flights', Title: { Value: connid } },
    SelectionFields: [ carrid, connid, fldate ],
    LineItem: [
      { Value: carrid }, { Value: connid }, { Value: fldate }, { Value: planetype },
      { Value: price }, { Value: currency }, { Value: seatsocc }, { Value: seatsmax }
    ],
    Facets: [{ $Type: 'UI.ReferenceFacet', Label: 'Details', Target: '@UI.FieldGroup#Main' }],
    FieldGroup#Main: { Data: [
      { Value: carrid }, { Value: connid }, { Value: fldate }, { Value: planetype },
      { Value: price }, { Value: currency }, { Value: seatsocc }, { Value: seatsmax }
    ]}
  }
);
