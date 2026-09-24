import { Component, HostListener, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  VayalAgroCity,
  VayalAgroDistrict,
  VayalAgroFlowerPriceRow,
  VayalAgroPriceHistory,
} from '../../core/models/vayal-agro-flower-price';
import { I18nPipe } from '../../core/pipes/i18n.pipe';
import { I18nService } from '../../core/services/i18n.service';
import { ToastService } from '../../core/services/toast.service';
import { VayalAgroPriceService } from '../../core/services/vayal-agro-price.service';
import { extractErrorMessage } from '../../core/utils/http-error.util';
import { formatApiDate } from '../../core/utils/sales.util';

interface GraphPoint {
  x: number;
  y: number;
  label: string;
  price: number;
}

@Component({
  selector: 'app-vayal-agro-flower-price',
  standalone: true,
  imports: [FormsModule, I18nPipe],
  templateUrl: './vayal-agro-flower-price.html',
  styleUrl: './vayal-agro-flower-price.css',
})
export class VayalAgroFlowerPriceComponent implements OnInit {
  private readonly service = inject(VayalAgroPriceService);
  private readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);

  protected readonly todayStr = formatApiDate(new Date());
  protected readonly district = signal('');
  protected readonly city = signal('');
  protected readonly salesDate = signal(this.todayStr);

  protected readonly districts = signal<VayalAgroDistrict[]>([]);
  protected readonly cities = signal<VayalAgroCity[]>([]);
  protected readonly citiesLoading = signal(false);

  protected readonly rows = signal<VayalAgroFlowerPriceRow[]>([]);
  protected readonly fetchedDate = signal('');
  protected readonly loading = signal(false);
  protected readonly loaded = signal(false);
  protected readonly searched = signal(false);
  protected readonly error = signal('');

  protected readonly historyOpen = signal(false);
  protected readonly historyLoading = signal(false);
  protected readonly historyError = signal('');
  protected readonly history = signal<VayalAgroPriceHistory | null>(null);
  protected readonly historyTab = signal<'table' | 'graph'>('table');
  protected readonly historyRange = signal<'weekly' | 'monthly'>('weekly');

  ngOnInit(): void {
    this.loadDistricts();
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.historyOpen()) {
      this.closeHistory();
    }
  }

  protected canSearch(): boolean {
    return this.district() !== '' && this.city() !== '' && this.salesDate() !== '';
  }

  protected onDistrictChange(value: string): void {
    this.district.set(value);
    this.city.set('');
    this.cities.set([]);
    this.rows.set([]);
    this.searched.set(false);
    this.error.set('');
    if (!value) {
      return;
    }
    this.citiesLoading.set(true);
    this.service.getCities(value).subscribe({
      next: (response) => {
        this.citiesLoading.set(false);
        if (response.success) {
          this.cities.set(response.data ?? []);
        } else {
          this.cities.set([]);
          this.toast.error(response.message);
        }
      },
      error: (error) => {
        this.citiesLoading.set(false);
        this.cities.set([]);
        this.toast.error(extractErrorMessage(error, this.i18n.translate('vayal.agro.error.fetch')));
      },
    });
  }

  protected search(): void {
    if (!this.canSearch() || this.loading()) {
      return;
    }
    this.loading.set(true);
    this.error.set('');
    this.service.getPrices(this.district(), this.city(), this.salesDate()).subscribe({
      next: (response) => {
        this.loading.set(false);
        this.loaded.set(true);
        this.searched.set(true);
        if (response.success) {
          const data = response.data;
          this.rows.set(Array.isArray(data?.rows) ? data.rows : []);
          this.fetchedDate.set(data?.fetchedDate ?? '');
        } else {
          this.rows.set([]);
          this.error.set(response.message);
        }
      },
      error: (error) => {
        this.loading.set(false);
        this.loaded.set(true);
        this.searched.set(true);
        this.rows.set([]);
        this.error.set(extractErrorMessage(error, this.i18n.translate('vayal.agro.error.fetch')));
      },
    });
  }

  protected openHistory(row: VayalAgroFlowerPriceRow): void {
    this.historyOpen.set(true);
    this.historyLoading.set(true);
    this.historyError.set('');
    this.history.set(null);
    this.historyTab.set('table');
    this.service.getHistory({ flowerName: row.category, marketPlaceId: this.city() }).subscribe({
      next: (response) => {
        this.historyLoading.set(false);
        if (response.success && response.data) {
          this.history.set(response.data);
        } else {
          this.historyError.set(response.message);
        }
      },
      error: (error) => {
        this.historyLoading.set(false);
        this.historyError.set(
          extractErrorMessage(error, this.i18n.translate('vayal.agro.error.fetch')),
        );
      },
    });
  }

  protected closeHistory(): void {
    this.historyOpen.set(false);
    this.history.set(null);
    this.historyError.set('');
  }

  protected onOverlayClick(event: Event): void {
    if (event.target === event.currentTarget) {
      this.closeHistory();
    }
  }

  protected historyTitle(): string {
    const h = this.history();
    if (!h) {
      return '';
    }
    return this.displayName(h.flowerName, h.flowerNameTn);
  }

  protected historySubtitle(): string {
    const h = this.history();
    if (!h) {
      return '';
    }
    return this.displayName(h.marketName, h.marketNameTn);
  }

  protected historyTableRows(): VayalAgroPriceHistory['history'] {
    const h = this.history();
    if (!h || !Array.isArray(h.history)) {
      return [];
    }
    return [...h.history].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  }

  protected graphData(): { date: string; price: number }[] {
    const h = this.history();
    if (!h || !Array.isArray(h.history) || h.history.length === 0) {
      return [];
    }
    const points = h.history
      .map((item) => ({ date: String(item.date ?? '').slice(0, 10), price: Number(item.price) }))
      .filter((item) => item.date !== '' && Number.isFinite(item.price))
      .sort((a, b) => a.date.localeCompare(b.date));
    if (points.length === 0) {
      return [];
    }
    const latest = this.parseDate(points[points.length - 1].date);
    const windowDays = this.historyRange() === 'weekly' ? 7 : 30;
    const cutoff = latest.getTime() - (windowDays - 1) * 24 * 60 * 60 * 1000;
    return points.filter((item) => this.parseDate(item.date).getTime() >= cutoff);
  }

  protected graphPoints(): GraphPoint[] {
    const data = this.graphData();
    const n = data.length;
    if (n === 0) {
      return [];
    }
    const prices = data.map((d) => d.price);
    const max = Math.max(...prices);
    const min = Math.min(...prices);
    const range = max - min || 1;
    return data.map((d, i) => ({
      x: n === 1 ? 50 : (i / (n - 1)) * 100,
      y: 42 - ((d.price - min) / range) * 34 - 4,
      label: d.date,
      price: d.price,
    }));
  }

  protected graphAreaPath(): string {
    const pts = this.graphPoints();
    if (pts.length < 2) {
      return '';
    }
    const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
    return `${line} L${pts[pts.length - 1].x.toFixed(2)},46 L${pts[0].x.toFixed(2)},46 Z`;
  }

  protected graphLinePath(): string {
    const pts = this.graphPoints();
    if (pts.length < 2) {
      return '';
    }
    return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
  }

  protected graphXLabels(): string[] {
    const data = this.graphData();
    if (data.length === 0) {
      return [];
    }
    const maxLabels = 6;
    if (data.length <= maxLabels) {
      return data.map((d) => d.date);
    }
    const step = (data.length - 1) / (maxLabels - 1);
    const labels: string[] = [];
    for (let i = 0; i < maxLabels; i++) {
      labels.push(data[Math.round(i * step)].date);
    }
    return labels;
  }

  protected displayName(value: string | null | undefined, tn: string | null | undefined): string {
    const en = (value ?? '').trim();
    const tamil = (tn ?? '').trim();
    if (tamil && tamil !== en) {
      return `${en} (${tamil})`;
    }
    return en;
  }

  private loadDistricts(): void {
    this.service.getDistricts().subscribe({
      next: (response) => {
        if (response.success) {
          this.districts.set(response.data ?? []);
        } else {
          this.districts.set([]);
          this.toast.error(response.message);
        }
      },
      error: (error) => {
        this.districts.set([]);
        this.toast.error(extractErrorMessage(error, this.i18n.translate('vayal.agro.error.fetch')));
      },
    });
  }

  private parseDate(value: string): Date {
    const parsed = new Date(value + 'T00:00:00');
    return Number.isNaN(parsed.getTime()) ? new Date(0) : parsed;
  }
}
