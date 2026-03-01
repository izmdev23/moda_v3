import { BaseApi } from './api';

export class ReviewsApi extends BaseApi<any> {
  constructor() {
    super('reviews' as any);
  }
}

export const reviewsTable = new ReviewsApi();
