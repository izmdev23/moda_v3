import { BaseApi } from './api';

export class Product_variantsApi extends BaseApi<any> {
  constructor() {
    super('product_variants' as any);
  }
}

export const product_variantsTable = new Product_variantsApi();
