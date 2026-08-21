import { Component, OnInit, inject, signal } from '@angular/core';

import { DashboardData } from '../../core/models/dashboard-data';
import { I18nPipe } from '../../core/pipes/i18n.pipe';
import { AuthService } from '../../core/services/auth.service';
import { DashboardService } from '../../core/services/dashboard.service';
import { ToastService } from '../../core/services/toast.service';
import { formatCurrency } from '../../core/utils/currency-format.util';
import { formatDecimal } from '../../core/utils/round-off.util';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [I18nPipe],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class DashboardComponent implements OnInit {
  protected readonly auth = inject(AuthService);

  private readonly dashboardService = inject(DashboardService);
  private readonly toast = inject(ToastService);

  protected readonly data = signal<DashboardData | null>(null);

  protected readonly trendRange = signal<'week' | 'month'>('week');

  protected readonly formatCurrency = formatCurrency;
  protected readonly formatDecimal = formatDecimal;

  ngOnInit(): void {
    this.load();
  }

  protected setTrendRange(range: 'week' | 'month'): void {
    this.trendRange.set(range);
  }

  private load(): void {
    this.dashboardService.getDashboardData().subscribe({
      next: (dashboardData) => this.data.set(dashboardData),
      error: () => this.toast.error('Failed to fetch dashboard data'),
    });
  }

  protected activeTrend(): DashboardData['trend'] {
    const d = this.data();
    if (!d) {
      return [];
    }
    return this.trendRange() === 'month' ? d.monthTrend : d.trend;
  }

  protected trendMax(): number {
    let max = 0;
    for (const row of this.activeTrend()) {
      const value = this.parseNum(row.amount);
      if (value > max) {
        max = value;
      }
    }
    return max;
  }

  protected trendPct(amount: number | undefined, max: number): number {
    const value = this.parseNum(amount);
    return max > 0 ? Math.max(Math.round((value / max) * 100), 2) : 0;
  }

  protected flowersMax(): number {
    let max = 0;
    for (const row of this.data()?.topFlowers ?? []) {
      const value = this.parseNum(row.totalKg);
      if (value > max) {
        max = value;
      }
    }
    return max;
  }

  protected flowerPct(kg: number | undefined, max: number): number {
    const value = this.parseNum(kg);
    return max > 0 ? Math.round((value / max) * 100) : 0;
  }

  protected compactAmount(value: number | undefined): string {
    const num = this.parseNum(value);
    if (num >= 100000) {
      return Math.round(num / 1000) + 'K';
    }
    return Math.round(num).toString();
  }

  protected shortDay(isoDate: string | undefined): string {
    if (!isoDate) {
      return '';
    }
    const date = new Date(isoDate + 'T00:00:00');
    if (Number.isNaN(date.getTime())) {
      return isoDate;
    }
    return String(date.getDate()).padStart(2, '0');
  }

  private parseNum(value: number | undefined): number {
    const num = Number(value);
    return Number.isNaN(num) ? 0 : num;
  }
}
