export interface Client {
  clientId?: number;
  clientUsername: string;
  clientPassword?: string;
  clientShopName: string;
  clientShopAddress?: string;
  clientContactNo?: string;
  clientMailId?: string;
}

export function emptyClient(): Client {
  return {
    clientUsername: '',
    clientPassword: '',
    clientShopName: '',
    clientShopAddress: '',
    clientContactNo: '',
    clientMailId: '',
  };
}
