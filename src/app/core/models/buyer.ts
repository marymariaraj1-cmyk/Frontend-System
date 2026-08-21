export interface Buyer {
  buyerId: string;
  clientId: number | null;
  clientUsername: string;
  buyerName: string;
  buyerContactNo?: string;
  buyerAddress?: string;
}

export function emptyBuyer(): Buyer {
  return {
    buyerId: '',
    clientId: null,
    clientUsername: '',
    buyerName: '',
    buyerContactNo: '',
    buyerAddress: '',
  };
}
