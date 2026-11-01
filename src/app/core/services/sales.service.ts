import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiResponse } from '../models/api-response';
import {
  BuyerDirectSaleRequest,
  FlowerIntakeSaleRequest,
  FlowerLootSaveRequest,
  SalesMasterData,
  SalesRecord,
  SalesRequest,
} from '../models/sales';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class SalesService {
  private readonly api = inject(ApiService);

  getMasterData(): Observable<ApiResponse<SalesMasterData>> {
    return this.api.get<SalesMasterData>('/sales/master-data');
  }

  getAutocompleteSuggestions(field: string, query: string): Observable<ApiResponse<string[]>> {
    const params = `field=${encodeURIComponent(field)}&query=${encodeURIComponent(query)}`;
    return this.api.get<string[]>(`/sales/autocomplete?${params}`);
  }

  save(request: SalesRequest): Observable<ApiResponse<SalesRecord[]>> {
    return this.api.post<SalesRecord[]>('/sales/save', request);
  }

  saveFlowerLoot(request: FlowerLootSaveRequest): Observable<ApiResponse<SalesRecord[]>> {
    return this.api.post<SalesRecord[]>('/flower-loot-sale/save', request);
  }

  saveFlowerIntake(request: FlowerIntakeSaleRequest): Observable<ApiResponse<SalesRecord[]>> {
    const payload = {
      farmerName: request.farmerName,
      salesDate: request.salesDate,
      debitAmount: request.debitAmount,
      totalSalesAmt: request.totalSalesAmt,
      commissionAmt: request.commissionAmt,
      netAmount: request.netAmount,
      finalTotal: request.finalTotal,
      rows: request.rows.map((row) => ({
        flowerType: row.flowerType,
        bagCount: row.bagCount,
        totalWeight: row.totalWeight,
        price: row.rate,
        amount: row.amount,
      })),
    };
    return this.api.post<SalesRecord[]>('/flower-intake-sale/save', payload);
  }

  saveBuyerDirect(request: BuyerDirectSaleRequest): Observable<ApiResponse<SalesRecord[]>> {
    const payload = {
      buyerName: request.buyerName,
      salesDate: request.salesDate,
      rows: request.rows.map((row) => ({
        flowerType: row.flowerType,
        bagCount: row.bagCount,
        totalWeight: row.totalWeight,
        rate: row.rate,
        amount: row.amount,
      })),
    };
    return this.api.post<SalesRecord[]>('/buyer-direct-sale/save', payload);
  }
}
