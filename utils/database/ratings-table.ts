import { BaseApi } from './api';

export class RatingsApi extends BaseApi<any> {
  constructor() {
    super('ratings' as any);
  }
}

export const ratingsTable = new RatingsApi();
