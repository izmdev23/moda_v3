import { BaseApi } from './api';

export class Product_draftsApi extends BaseApi<any> {
  constructor() {
    super('product_drafts' as any);
  }
}

export const product_draftsTable = new Product_draftsApi();
