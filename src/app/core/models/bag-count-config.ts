export interface BagCountConfigRow {
  configId: number;
  flowerId: string;
  flowerName: string;
  salesDate: string | null;
  bagCount: number;
  bagCheck: string;
}

export interface BagCountConfigFlower {
  flowerId: string;
  flowerName: string;
}
