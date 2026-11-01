import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiResponse } from '../models/api-response';
import {
  FlowerIntakeSaleEditFetchData,
  FlowerIntakeSaleEditRequest,
  IntakeDirectRowInput,
  SalesMasterData,
} from '../models/sales';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class FlowerIntakeSaleEditService {
  private readonly api = inject(ApiService);

  getMasterData(): Observable<ApiResponse<SalesMasterData>> {
    return this.api.get<SalesMasterData>('/sales/master-data');
  }

  fetch(
    farmerName: string,
    salesDate: string,
  ): Observable<ApiResponse<FlowerIntakeSaleEditFetchData>> {
    const params = `farmerName=${encodeURIComponent(farmerName)}&salesDate=${encodeURIComponent(salesDate)}`;
    return this.api.get<FlowerIntakeSaleEditFetchData>(
      `/flower-intake-sale-edit/fetch?${params}`,
    );
  }

  save(request: FlowerIntakeSaleEditRequest): Observable<ApiResponse<{ editedRows: number }>> {
    return this.api.post<{ editedRows: number }>('/flower-intake-sale-edit/save', request);
  }

  delete(salesId: number): Observable<ApiResponse<{ deletedSalesId: number }>> {
    return this.api.post<{ deletedSalesId: number }>('/flower-intake-sale-edit/delete', { salesId });
  }
}

export type { IntakeDirectRowInput };
