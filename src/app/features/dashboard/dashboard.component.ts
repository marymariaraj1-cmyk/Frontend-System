import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { DashboardData } from '../../core/models/dashboard-data';
import { FlowerPriceTickerEntry } from '../../core/models/flower-price-config';
import { I18nPipe } from '../../core/pipes/i18n.pipe';
import { AuthService } from '../../core/services/auth.service';
import { DashboardService } from '../../core/services/dashboard.service';
import { FlowerPriceConfigService } from '../../core/services/flower-price-config.service';
import { ToastService } from '../../core/services/toast.service';
import { formatCurrency } from '../../core/utils/currency-format.util';
import { formatDecimal } from '../../core/utils/round-off.util';
import { formatApiDate } from '../../core/utils/sales.util';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, I18nPipe],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class DashboardComponent implements OnInit {
  protected readonly auth = inject(AuthService);

  private readonly dashboardService = inject(DashboardService);
  private readonly flowerPriceService = inject(FlowerPriceConfigService);
  private readonly toast = inject(ToastService);

  protected readonly data = signal<DashboardData | null>(null);
  protected readonly flowerRates = signal<FlowerPriceTickerEntry[]>([]);

  protected readonly trendRange = signal<'week' | 'month'>('week');

  protected readonly formatCurrency = formatCurrency;
  protected readonly formatDecimal = formatDecimal;

  ngOnInit(): void {
    this.load();
    this.loadFlowerRates();
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

  private loadFlowerRates(): void {
    this.flowerPriceService.getTicker().subscribe({
      next: (res) => {
        if (res.success) this.flowerRates.set(res.data ?? []);
      },
      error: () => {},
    });
  }

  protected todayRates(): FlowerPriceTickerEntry[] {
    const today = formatApiDate(new Date());
    return this.flowerRates().filter((rate) => this.rateDateKey(rate.priceDate) === today);
  }

  private rateDateKey(value: string | number[] | null | undefined): string {
    if (!value) {
      return '';
    }
    if (Array.isArray(value)) {
      const [year, month, day] = value;
      if (!year || !month || !day) {
        return '';
      }
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
    return String(value).slice(0, 10);
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

  protected trendTotal(): number {
    let total = 0;
    for (const row of this.activeTrend()) {
      total += this.parseNum(row.amount);
    }
    return total;
  }

  protected trendPoints(): { x: number; y: number }[] {
    const rows = this.activeTrend();
    const max = this.trendMax();
    const n = rows.length;
    if (n < 2 || max <= 0) {
      return [];
    }
    return rows.map((row, i) => {
      const value = this.parseNum(row.amount);
      const x = i / (n - 1) * 100;
      const y = 40 - 2 - (value / max) * 36;
      return { x, y };
    });
  }

  protected trendAreaPath(): string {
    const pts = this.trendPoints();
    if (pts.length < 2) {
      return '';
    }
    const line = pts
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`)
      .join(' ');
    return `${line} L${pts[pts.length - 1].x.toFixed(2)},40 L${pts[0].x.toFixed(2)},40 Z`;
  }

  protected trendLinePoints(): string {
    const pts = this.trendPoints();
    if (pts.length < 2) {
      return '';
    }
    return pts.map((p, i) => `${i === 0 ? '' : ' '}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join('');
  }

  protected salesDelta(): { pct: number; up: boolean } | null {
    const d = this.data();
    if (!d || d.kpis.yesterdaySales <= 0) {
      return null;
    }
    const diff = d.kpis.todaySales - d.kpis.yesterdaySales;
    const pct = Math.round((diff / d.kpis.yesterdaySales) * 100);
    return { pct: Math.abs(pct), up: diff >= 0 };
  }

  protected todayLabel(): string {
    const now = new Date();
    if (Number.isNaN(now.getTime())) {
      return '';
    }
    return now.toLocaleDateString(undefined, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  protected initials(name: string | undefined): string {
    if (!name) {
      return '?';
    }
    const parts = name.trim().split(/\s+/).filter(Boolean);
    const picked = parts.slice(0, 2).map((p) => p[0]);
    return picked.join('').toUpperCase();
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
