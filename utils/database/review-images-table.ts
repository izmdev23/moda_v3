import { BaseApi } from './api';

export class Review_imagesApi extends BaseApi<any> {
  constructor() {
    super('review_images' as any);
  }
}

export const review_imagesTable = new Review_imagesApi();
