import { BaseApi } from './api';

export class Order_itemsApi extends BaseApi<any> {
  constructor() {
    super('order_items' as any);
  }
}

export const order_itemsTable = new Order_itemsApi();
