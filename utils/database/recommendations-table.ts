import { BaseApi } from './api';

export class RecommendationsApi extends BaseApi<any> {
  constructor() {
    super('user_recommendations' as any);
  }
}

export const recommendationsTable = new RecommendationsApi();
