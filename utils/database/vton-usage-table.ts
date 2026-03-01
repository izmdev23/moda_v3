import { BaseApi } from './api';

export class Vton_usageApi extends BaseApi<any> {
  constructor() {
    super('vton_usage' as any);
  }
}

export const vton_usageTable = new Vton_usageApi();
