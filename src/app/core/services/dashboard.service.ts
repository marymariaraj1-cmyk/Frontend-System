import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiService } from './api.service';
import { DashboardData } from '../models/dashboard-data';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly api = inject(ApiService);

  getDashboardData(): Observable<DashboardData> {
    return this.api.getRaw<DashboardData>('/dashboard/data');
  }
}
