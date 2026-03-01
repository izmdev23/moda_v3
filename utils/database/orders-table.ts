import { BaseApi } from './api';

export class OrdersApi extends BaseApi<any> {
  constructor() {
    super('orders' as any);
  }
}

export const ordersTable = new OrdersApi();
