import cds from '@sap/cds';

export default class FlightService extends cds.ApplicationService {
  async init() {
    const ecc = await cds.connect.to('SAMPLEFLIGHT');
    this.on('READ', ['Flights', 'Carriers'], req => ecc.run(req.query));
    return super.init();
  }
}