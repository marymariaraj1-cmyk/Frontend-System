import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiService } from './api.service';
import { ApiResponse } from '../models/api-response';
import {
  BagCountConfigFarmer,
  BagCountConfigFlower,
  BagCountConfigRow,
} from '../models/bag-count-config';

@Injectable({ providedIn: 'root' })
export class BagCountConfigService {
  private readonly api = inject(ApiService);

  getFlowers(): Observable<ApiResponse<BagCountConfigFlower[]>> {
    return this.api.get<BagCountConfigFlower[]>('/bag-count-config/flowers');
  }

  getFarmers(): Observable<ApiResponse<BagCountConfigFarmer[]>> {
    return this.api.get<BagCountConfigFarmer[]>('/bag-count-config/farmers');
  }

  getConfigs(): Observable<ApiResponse<BagCountConfigRow[]>> {
    return this.api.get<BagCountConfigRow[]>('/bag-count-config/list');
  }

  saveConfig(
    farmerId: string,
    farmerName: string,
    flowerId: string,
    flowerName: string,
    salesDate: string,
    bagCount: string,
  ): Observable<ApiResponse<void>> {
    return this.api.post<void>('/bag-count-config/save', {
      farmerId,
      farmerName,
      flowerId,
      flowerName,
      salesDate,
      bagCount,
    });
  }

  deleteConfig(farmerId: string, flowerId: string, salesDate: string): Observable<ApiResponse<void>> {
    const params =
      `farmerId=${encodeURIComponent(farmerId)}` +
      `&flowerId=${encodeURIComponent(flowerId)}` +
      `&salesDate=${encodeURIComponent(salesDate)}`;
    return this.api.delete<void>(`/bag-count-config?${params}`);
  }

  getReport(
    farmerId: string,
    fromDate: string,
    toDate: string,
  ): Observable<ApiResponse<BagCountConfigRow[]>> {
    const params =
      `farmerId=${encodeURIComponent(farmerId)}` +
      `&fromDate=${encodeURIComponent(fromDate)}` +
      `&toDate=${encodeURIComponent(toDate)}`;
    return this.api.get<BagCountConfigRow[]>(`/bag-count-config/report?${params}`);
  }
}