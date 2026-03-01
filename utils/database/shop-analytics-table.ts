import { BaseApi } from './api';

export class Shop_analyticsApi extends BaseApi<any> {
  constructor() {
    super('shop_analytics_cache' as any);
  }
}

export const shop_analyticsTable = new Shop_analyticsApi();
