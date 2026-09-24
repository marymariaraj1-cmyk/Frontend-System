import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiResponse } from '../models/api-response';
import {
  VayalAgroCity,
  VayalAgroDistrict,
  VayalAgroFlowerPriceData,
  VayalAgroHistoryRequest,
  VayalAgroPriceHistory,
} from '../models/vayal-agro-flower-price';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class VayalAgroPriceService {
  private readonly api = inject(ApiService);

  getSalemPrices(): Observable<ApiResponse<VayalAgroFlowerPriceData>> {
    return this.api.get<VayalAgroFlowerPriceData>('/poc/flower-price/salem');
  }

  getDistricts(): Observable<ApiResponse<VayalAgroDistrict[]>> {
    return this.api.get<VayalAgroDistrict[]>('/flower-price/districts');
  }

  getCities(marketId: string): Observable<ApiResponse<VayalAgroCity[]>> {
    const params = `marketId=${encodeURIComponent(marketId)}`;
    return this.api.get<VayalAgroCity[]>(`/flower-price/cities?${params}`);
  }

  getPrices(
    marketId: string,
    marketPlaceId: string,
    date: string,
  ): Observable<ApiResponse<VayalAgroFlowerPriceData>> {
    const params =
      `marketId=${encodeURIComponent(marketId)}` +
      `&marketPlaceId=${encodeURIComponent(marketPlaceId)}` +
      `&date=${encodeURIComponent(date)}`;
    return this.api.get<VayalAgroFlowerPriceData>(`/flower-price?${params}`);
  }

  getHistory(request: VayalAgroHistoryRequest): Observable<ApiResponse<VayalAgroPriceHistory>> {
    return this.api.post<VayalAgroPriceHistory>('/flower-price/history', request);
  }
}