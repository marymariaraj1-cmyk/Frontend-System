export interface BagCountConfigRow {
  configId: number;
  farmerId: string;
  farmerName: string;
  flowerId: string;
  flowerName: string;
  salesDate: string | null;
  bagCount: number;
}

export interface BagCountConfigFlower {
  flowerId: string;
  flowerName: string;
}

export interface BagCountConfigFarmer {
  farmerId: string;
  farmerName: string;
}