import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiResponse } from '../models/api-response';
import { FarmerMasterData, FarmerTransaction, FarmerTransactionRequest } from '../models/transaction';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class FarmerTransactionService {
  private readonly api = inject(ApiService);

  getMasterData(): Observable<ApiResponse<FarmerMasterData>> {
    return this.api.get<FarmerMasterData>('/farmer-transaction/master-data');
  }

  save(request: FarmerTransactionRequest): Observable<ApiResponse<FarmerTransaction>> {
    return this.api.post<FarmerTransaction>('/farmer-transaction/save', request);
  }

  getHistory(farmerName: string, fromDate: string, toDate: string): Observable<ApiResponse<FarmerTransaction[]>> {
    const params = `farmerName=${encodeURIComponent(farmerName)}&fromDate=${fromDate}&toDate=${toDate}`;
    return this.api.get<FarmerTransaction[]>(`/farmer-transaction/history?${params}`);
  }
}
