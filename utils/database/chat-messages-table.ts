import { BaseApi } from './api';

export class Chat_messagesApi extends BaseApi<any> {
  constructor() {
    super('chat_messages' as any);
  }
}

export const chat_messagesTable = new Chat_messagesApi();
