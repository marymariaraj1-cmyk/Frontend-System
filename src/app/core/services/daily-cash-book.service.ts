import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiResponse } from '../models/api-response';
import { CashBookRecord, CashBookBlocks } from '../models/daily-cash-book';
import { ApiService } from './api.service';

export interface DailyCashBookSavePayload {
  bookDate: string;
  rentAmt: number;
  expenseAmt: number;
  chitAmt: number;
  financeAmt: number;
  noteAmt: number;
  salaryAmt: number;
  coinAmt: number;
  cashInHandAmt: number;
  openingBalance: number;
  remarks: string;
}

@Injectable({ providedIn: 'root' })
export class DailyCashBookService {
  private readonly api = inject(ApiService);

  compute(bookDate: string): Observable<ApiResponse<CashBookBlocks>> {
    const params = `bookDate=${encodeURIComponent(bookDate)}`;
    return this.api.get<CashBookBlocks>(`/daily-cash-book/compute?${params}`);
  }

  load(bookDate: string): Observable<ApiResponse<CashBookRecord | null>> {
    const params = `bookDate=${encodeURIComponent(bookDate)}`;
    return this.api.get<CashBookRecord | null>(`/daily-cash-book/load?${params}`);
  }

  save(payload: DailyCashBookSavePayload): Observable<ApiResponse<CashBookRecord>> {
    return this.api.post<CashBookRecord>('/daily-cash-book/save', payload);
  }
}
