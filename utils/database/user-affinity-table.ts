import { BaseApi } from './api';

export class User_affinityApi extends BaseApi<any> {
  constructor() {
    super('user_tag_affinity' as any);
  }
}

export const user_affinityTable = new User_affinityApi();
