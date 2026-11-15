import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiResponse } from '../models/api-response';
import { CashBookRecord, CashBookBlocks, CashBookDetails, ManualAmountEntry } from '../models/daily-cash-book';
import { ApiService } from './api.service';

export interface DailyCashBookSavePayload {
  bookDate: string;
  manualDebitEntries: ManualAmountEntry[];
  manualCreditEntries: ManualAmountEntry[];
  remarks: string;
}

@Injectable({ providedIn: 'root' })
export class DailyCashBookService {
  private readonly api = inject(ApiService);

  compute(bookDate: string): Observable<ApiResponse<CashBookBlocks>> {
    const params = `bookDate=${encodeURIComponent(bookDate)}`;
    return this.api.get<CashBookBlocks>(`/daily-cash-book/compute?${params}`);
  }

  /**
   * Per-party breakdowns for the auto-calculated fields (Balance / Commission /
   * Installment) so the UI can open a popup and show how each value was calculated.
   */
  getDetails(bookDate: string): Observable<ApiResponse<CashBookDetails>> {
    const params = `bookDate=${encodeURIComponent(bookDate)}`;
    return this.api.get<CashBookDetails>(`/daily-cash-book/details?${params}`);
  }

  load(bookDate: string): Observable<ApiResponse<CashBookRecord | null>> {
    const params = `bookDate=${encodeURIComponent(bookDate)}`;
    return this.api.get<CashBookRecord | null>(`/daily-cash-book/load?${params}`);
  }

  save(payload: DailyCashBookSavePayload): Observable<ApiResponse<CashBookRecord>> {
    return this.api.post<CashBookRecord>('/daily-cash-book/save', payload);
  }
}