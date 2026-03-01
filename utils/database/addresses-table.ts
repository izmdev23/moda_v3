import { BaseApi } from './api';

export class AddressesApi extends BaseApi<any> {
  constructor() {
    super('addresses' as any);
  }
}

export const addressesTable = new AddressesApi();
