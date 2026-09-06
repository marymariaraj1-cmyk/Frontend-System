import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiService } from './api.service';
import { ApiResponse } from '../models/api-response';
import { BagCountConfigFlower, BagCountConfigRow } from '../models/bag-count-config';

@Injectable({ providedIn: 'root' })
export class BagCountConfigService {
  private readonly api = inject(ApiService);

  getFlowers(): Observable<ApiResponse<BagCountConfigFlower[]>> {
    return this.api.get<BagCountConfigFlower[]>('/bag-count-config/flowers');
  }

  getConfigs(): Observable<ApiResponse<BagCountConfigRow[]>> {
    return this.api.get<BagCountConfigRow[]>('/bag-count-config/list');
  }

  saveConfig(flowerId: string, flowerName: string, salesDate: string, bagCount: string, bagCheck: string): Observable<ApiResponse<void>> {
    return this.api.post<void>('/bag-count-config/save', {
      flowerId,
      flowerName,
      salesDate,
      bagCount,
      bagCheck,
    });
  }

  deleteConfig(flowerId: string, salesDate: string): Observable<ApiResponse<void>> {
    return this.api.delete<void>(`/bag-count-config?flowerId=${encodeURIComponent(flowerId)}&salesDate=${encodeURIComponent(salesDate)}`);
  }
}
