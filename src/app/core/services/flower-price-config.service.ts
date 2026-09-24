import { Injectable, inject } from '@angular/core';
import { Observable, Subject } from 'rxjs';

import { ApiService } from './api.service';
import { ApiResponse } from '../models/api-response';
import {
  FlowerPriceConfigFlower,
  FlowerPriceConfigRow,
  FlowerPriceConfigSaveItem,
  FlowerPriceConfigSaveResult,
  FlowerPriceTickerEntry,
} from '../models/flower-price-config';

@Injectable({ providedIn: 'root' })
export class FlowerPriceConfigService {
  private readonly api = inject(ApiService);
  private readonly tickerRefresh$ = new Subject<void>();
  readonly tickerRefresh$obs = this.tickerRefresh$.asObservable();

  notifyTickerRefresh(): void {
    this.tickerRefresh$.next();
  }

  getFlowers(): Observable<ApiResponse<FlowerPriceConfigFlower[]>> {
    return this.api.get<FlowerPriceConfigFlower[]>('/flower-price-config/flowers');
  }

  getPrices(priceDate: string): Observable<ApiResponse<FlowerPriceConfigRow[]>> {
    const params = `priceDate=${encodeURIComponent(priceDate)}`;
    return this.api.get<FlowerPriceConfigRow[]>(`/flower-price-config/list?${params}`);
  }

  savePrices(
    priceDate: string,
    items: FlowerPriceConfigSaveItem[],
  ): Observable<ApiResponse<FlowerPriceConfigSaveResult>> {
    return this.api.post<FlowerPriceConfigSaveResult>('/flower-price-config/save', { priceDate, items });
  }

  updatePrice(priceConfigId: number, price: string): Observable<ApiResponse<void>> {
    return this.api.put<void>('/flower-price-config/update', { priceConfigId, price });
  }

  deletePrice(priceConfigId: number): Observable<ApiResponse<void>> {
    return this.api.delete<void>(`/flower-price-config?priceConfigId=${priceConfigId}`);
  }

  getTicker(): Observable<ApiResponse<FlowerPriceTickerEntry[]>> {
    return this.api.get<FlowerPriceTickerEntry[]>('/flower-price-config/ticker');
  }

  getHistory(flowerId: string, fromDate: string, toDate: string): Observable<ApiResponse<FlowerPriceConfigRow[]>> {
    const params = `flowerId=${encodeURIComponent(flowerId)}&fromDate=${encodeURIComponent(fromDate)}&toDate=${encodeURIComponent(toDate)}`;
    return this.api.get<FlowerPriceConfigRow[]>(`/flower-price-config/history?${params}`);
  }
}