export interface Farmer {
  farmerId: string;
  clientId: number | null;
  clientUsername: string;
  farmerName: string;
  farmerContactNo?: string;
  farmerAddress?: string;
}

export function emptyFarmer(): Farmer {
  return {
    farmerId: '',
    clientId: null,
    clientUsername: '',
    farmerName: '',
    farmerContactNo: '',
    farmerAddress: '',
  };
}
