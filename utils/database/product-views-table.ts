import { BaseApi } from './api';

export class Product_viewsApi extends BaseApi<any> {
  constructor() {
    super('product_views' as any);
  }
}

export const product_viewsTable = new Product_viewsApi();
