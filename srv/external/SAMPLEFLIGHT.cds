/* checksum : 65b4ffb05ebd69144446516dfc75603c */
@cds.external : true
@m.IsDefaultEntityContainer : 'true'
@sap.supported.formats : 'atom json'
service SAMPLEFLIGHT {
  @cds.external : true
  @cds.persistence.skip : true
  @sap.content.version : '1'
  entity FlightCollection {
    key connid : String(4) not null;
    key fldate : Date not null; // hand edit: was DateTime with @odata.Type 'Edm.DateTime'. Redo after every cds import (docs/troubleshooting.md, trap 8)
    key carrid : String(3) not null;
    price : Decimal(20, 2);
    currency : String(5);
    planetype : String(10);
    seatsmax : Integer;
    seatsocc : Integer;
    paymentsum : Decimal(22, 2);
    seatsmax_b : Integer;
    seatsocc_b : Integer;
    seatsmax_f : Integer;
    seatsocc_f : Integer;
  };

  @cds.external : true
  @cds.persistence.skip : true
  @sap.content.version : '1'
  entity CarrierCollection {
    key carrid : String(3) not null;
    carrname : String(20);
    currcode : String(5);
    url : String(255);
  };

  @cds.external : true
  @cds.persistence.skip : true
  @sap.content.version : '1'
  entity BookingCollection {
    key customid : String(8) not null;
    @odata.Type : 'Edm.DateTime'
    key fldate : DateTime not null;
    key connid : String(4) not null;
    key carrid : String(3) not null;
    key bookid : String(8) not null;
    mandt : String(3);
    custtype : String(1);
    smoker : String(1);
    luggweight : Decimal(10, 4);
    wunit : String(3);
    invoice : String(1);
    class : String(1);
    forcuram : Decimal(20, 2);
    forcurkey : String(5);
    loccuram : Decimal(20, 2);
    loccurkey : String(5);
    @odata.Type : 'Edm.DateTime'
    order_date : DateTime;
    counter : String(8);
    agencynum : String(8);
    cancelled : String(1);
    reserved : String(1);
    passname : String(25);
    passform : String(15);
    @odata.Type : 'Edm.DateTime'
    passbirth : DateTime;
  };

  @cds.external : true
  @cds.persistence.skip : true
  @sap.content.version : '1'
  entity TravelagencyCollection {
    key agencynum : String(8) not null;
    mandt : String(3);
    name : String(25);
    street : String(30);
    postbox : String(10);
    postcode : String(10);
    city : String(25);
    country : String(3);
    region : String(3);
    telephone : String(30);
    url : String(255);
    langu : String(2);
    currency : String(5);
  };
};

