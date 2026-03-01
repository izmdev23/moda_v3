import { BaseApi } from './api';

export class Payment_methodsApi extends BaseApi<any> {
  constructor() {
    super('payment_methods' as any);
  }
}

export const payment_methodsTable = new Payment_methodsApi();
