import { BaseApi } from './api';

export class User_activityApi extends BaseApi<any> {
  constructor() {
    super('user_activity_log' as any);
  }
}

export const user_activityTable = new User_activityApi();
