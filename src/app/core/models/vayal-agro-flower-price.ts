export interface VayalAgroFlowerPriceRow {
  category: string;
  categoryTn: string;
  district: string;
  districtTn: string;
  city: string;
  cityTn: string;
  price: string;
  units: string;
  unitsTn: string;
}

export interface VayalAgroFlowerPriceData {
  rows: VayalAgroFlowerPriceRow[];
  fetchedDate: string;
}

export interface VayalAgroDistrict {
  marketId: string;
  marketName: string;
  marketNameTn: string;
}

export interface VayalAgroCity {
  marketPlaceId: string;
  place: string;
  placeTn: string;
}

export interface VayalAgroPriceHistoryPoint {
  date: string;
  price: string;
  units: string;
  unitsTn: string;
}

export interface VayalAgroPriceHistory {
  flowerName: string;
  flowerNameTn: string;
  marketName: string;
  marketNameTn: string;
  history: VayalAgroPriceHistoryPoint[];
}

export interface VayalAgroHistoryRequest {
  flowerName: string;
  marketPlaceId: string;
}