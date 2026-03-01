import { BaseApi } from './api';

export class Chat_threadsApi extends BaseApi<any> {
  constructor() {
    super('chat_threads' as any);
  }
}

export const chat_threadsTable = new Chat_threadsApi();
