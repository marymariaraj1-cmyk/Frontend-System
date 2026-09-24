export interface FlowerPriceConfigFlower {
  flowerId: string;
  flowerName: string;
}

export interface FlowerPriceConfigRow {
  priceConfigId: number;
  flowerId: string;
  flowerName: string;
  priceDate: string | null;
  price: number;
}

export interface FlowerPriceConfigSaveItem {
  flowerId: string;
  flowerName: string;
  price: string;
}

export interface FlowerPriceConfigSaveResult {
  added: number;
  updated: number;
}

export interface FlowerPriceTickerEntry {
  flowerId: string;
  flowerName: string;
  price: number;
  priceDate: string | null;
  previousPrice: number | null;
  previousPriceDate: string | null;
  trend: 'up' | 'down' | 'flat';
}