import { BaseApi } from './api';

export class Transaction_historyApi extends BaseApi<any> {
  constructor() {
    super('transaction_history' as any);
  }
}

export const transaction_historyTable = new Transaction_historyApi();
