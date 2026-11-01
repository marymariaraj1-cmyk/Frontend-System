import { Injectable, inject, signal } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiService } from './api.service';
import { ApiResponse } from '../models/api-response';

export interface FarmerCommissionConfig {
  commissionConfigId?: number;
  commissionPercent: number;
  description?: string;
  updatedDate?: string;
}

@Injectable({ providedIn: 'root' })
export class FarmerCommissionConfigService {
  private static readonly DEFAULT_PERCENT = 10;

  private readonly api = inject(ApiService);
  private readonly percentSignal = signal<number>(FarmerCommissionConfigService.DEFAULT_PERCENT);
  private loaded = false;

  readonly percent = this.percentSignal.asReadonly();

  getCurrent(): Observable<ApiResponse<FarmerCommissionConfig>> {
    return this.api.get<FarmerCommissionConfig>('/commission-config/current');
  }

  list(): Observable<ApiResponse<FarmerCommissionConfig[]>> {
    return this.api.get<FarmerCommissionConfig[]>('/commission-config/list');
  }

  load(force = false): void {
    if (this.loaded && !force) {
      return;
    }
    this.loaded = true;
    this.getCurrent().subscribe({
      next: (res) => {
        const value = Number(res?.data?.commissionPercent);
        if (res?.success && Number.isFinite(value) && value > 0) {
          this.percentSignal.set(value);
        }
      },
      error: () => {
        this.loaded = false;
      },
    });
  }

  rate(): number {
    const value = this.percentSignal();
    const percent = Number.isFinite(value) && value > 0 ? value : FarmerCommissionConfigService.DEFAULT_PERCENT;
    return percent / 100;
  }

  percentLabel(): string {
    const value = this.percentSignal();
    const percent = Number.isFinite(value) && value > 0 ? value : FarmerCommissionConfigService.DEFAULT_PERCENT;
    return String(Number(Number(percent).toFixed(2)));
  }
}
