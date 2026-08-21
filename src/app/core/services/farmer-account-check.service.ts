import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiResponse } from '../models/api-response';
import { ActiveLedgerRow, PreviewResponse } from '../models/ledger';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class FarmerAccountCheckService {
  private readonly api = inject(ApiService);

  getActiveLedgerRows(farmerId: string): Observable<ApiResponse<ActiveLedgerRow[]>> {
    return this.api.get<ActiveLedgerRow[]>(`/farmer-account-check/active-ledger?farmerId=${encodeURIComponent(farmerId)}`);
  }

  preview(farmerId: string, farmerName: string, finalAmount: number): Observable<ApiResponse<PreviewResponse>> {
    return this.api.post<PreviewResponse>('/farmer-account-check/preview', {
      farmerId,
      farmerName,
      finalAmount,
    });
  }

  commit(farmerId: string, farmerName: string, finalAmount: number): Observable<ApiResponse<string>> {
    return this.api.post<string>('/farmer-account-check/commit', {
      farmerId,
      farmerName,
      finalAmount,
    });
  }
}
