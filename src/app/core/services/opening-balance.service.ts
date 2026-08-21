import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiService } from './api.service';
import { ApiResponse } from '../models/api-response';
import { OpeningBalanceBuyerRow, OpeningBalanceFarmerRow } from '../models/opening-balance';

@Injectable({ providedIn: 'root' })
export class OpeningBalanceService {
  private readonly api = inject(ApiService);

  getFarmers(): Observable<ApiResponse<OpeningBalanceFarmerRow[]>> {
    return this.api.get<OpeningBalanceFarmerRow[]>('/opening-balance/farmers');
  }

  getBuyers(): Observable<ApiResponse<OpeningBalanceBuyerRow[]>> {
    return this.api.get<OpeningBalanceBuyerRow[]>('/opening-balance/buyers');
  }

  saveFarmer(farmerId: string, openingBalance: string, openingBalanceDate?: string): Observable<ApiResponse<void>> {
    return this.api.post<void>('/opening-balance/farmer/save', {
      farmerId,
      openingBalance,
      openingBalanceDate: openingBalanceDate ?? '',
    });
  }

  saveBuyer(buyerId: string, openingBalance: string, openingBalanceDate?: string): Observable<ApiResponse<void>> {
    return this.api.post<void>('/opening-balance/buyer/save', {
      buyerId,
      openingBalance,
      openingBalanceDate: openingBalanceDate ?? '',
    });
  }
}
