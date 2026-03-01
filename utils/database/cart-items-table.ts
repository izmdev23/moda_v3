import { BaseApi } from './api';

export class Cart_itemsApi extends BaseApi<any> {
  constructor() {
    super('cart_items' as any);
  }
}

export const cart_itemsTable = new Cart_itemsApi();
