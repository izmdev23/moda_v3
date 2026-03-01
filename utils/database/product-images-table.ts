import { BaseApi } from './api';

export class Product_imagesApi extends BaseApi<any> {
  constructor() {
    super('product_images' as any);
  }
}

export const product_imagesTable = new Product_imagesApi();
