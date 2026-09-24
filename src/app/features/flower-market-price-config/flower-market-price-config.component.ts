import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { DraggableDirective } from '../../core/directives/draggable.directive';
import {
  FlowerPriceConfigFlower,
  FlowerPriceConfigRow,
  FlowerPriceTickerEntry,
} from '../../core/models/flower-price-config';
import { I18nPipe } from '../../core/pipes/i18n.pipe';
import { FlowerPriceConfigService } from '../../core/services/flower-price-config.service';
import { I18nService } from '../../core/services/i18n.service';
import { ToastService } from '../../core/services/toast.service';
import { formatApiDate } from '../../core/utils/sales.util';
import { extractErrorMessage } from '../../core/utils/http-error.util';

type FlowerPriceSection = 'add' | 'view' | 'trends';

interface ViewRow {
  priceConfigId: number;
  flowerName: string;
  price: string;
  origPrice: string;
  enabled: boolean;
}

@Component({
  selector: 'app-flower-market-price-config',
  standalone: true,
  imports: [FormsModule, I18nPipe, DraggableDirective],
  templateUrl: './flower-market-price-config.html',
  styleUrl: './flower-market-price-config.css',
})
export class FlowerMarketPriceConfigComponent implements OnInit {
  private readonly flowerPriceConfigService = inject(FlowerPriceConfigService);
  private readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);

  protected readonly section = signal<FlowerPriceSection>('add');

  protected readonly flowers = signal<FlowerPriceConfigFlower[]>([]);
  protected priceTextByFlower: Record<string, string> = {};
  protected priceInvalidByFlower: Record<string, boolean> = {};
  protected readonly addDate = signal(formatApiDate(new Date()));
  protected readonly saving = signal(false);

  protected readonly viewDate = signal(formatApiDate(new Date()));
  protected readonly viewRows = signal<ViewRow[]>([]);
  protected readonly searched = signal(false);
  protected readonly loading = signal(false);
  protected readonly updating = signal(false);
  protected readonly deleteTarget = signal<ViewRow | null>(null);
  protected readonly deleting = signal(false);

  protected readonly ticker = signal<FlowerPriceTickerEntry[]>([]);
  protected readonly tickerPaused = signal(false);

  protected readonly tickerDuplicated = signal<FlowerPriceTickerEntry[]>([]);

  protected readonly trendFlowerId = signal<string>('');
  protected readonly trendRange = signal<'7' | '30' | '90' | 'custom'>('30');
  protected readonly trendFrom = signal<string>('');
  protected readonly trendTo = signal<string>('');
  protected readonly trendData = signal<FlowerPriceConfigRow[]>([]);
  protected readonly trendLoading = signal(false);

  ngOnInit(): void {
    this.loadFlowers();
    this.loadTicker();
  }

  protected loadTicker(): void {
    this.flowerPriceConfigService.getTicker().subscribe({
      next: (res) => {
        if (res.success) {
          const data = res.data ?? [];
          this.ticker.set(data);
          this.tickerDuplicated.set([...data, ...data]);
        }
      },
      error: () => {},
    });
  }

  protected switchSection(target: FlowerPriceSection): void {
    const today = formatApiDate(new Date());
    if (target === 'add') {
      this.addDate.set(today);
    } else if (target === 'view') {
      this.viewDate.set(today);
      this.searched.set(false);
      this.viewRows.set([]);
    } else if (target === 'trends') {
      this.initTrends();
    }
    this.section.set(target);
  }

  private initTrends(): void {
    if (!this.trendFlowerId() && this.flowers().length > 0) {
      this.trendFlowerId.set(this.flowers()[0].flowerId);
    }
    if (this.trendRange() !== 'custom') {
      const today = new Date();
      const to = formatApiDate(today);
      let from = '';
      if (this.trendRange() === '7') from = formatApiDate(new Date(today.getTime() - 6 * 86400000));
      else if (this.trendRange() === '30') from = formatApiDate(new Date(today.getTime() - 29 * 86400000));
      else if (this.trendRange() === '90') from = formatApiDate(new Date(today.getTime() - 89 * 86400000));
      else from = to;
      this.trendFrom.set(from);
      this.trendTo.set(to);
    }
    if (this.trendFlowerId()) {
      this.fetchTrendData();
    }
  }

  protected setTrendRange(range: '7' | '30' | '90' | 'custom'): void {
    this.trendRange.set(range);
    if (range !== 'custom') {
      const today = new Date();
      const to = formatApiDate(today);
      let from = '';
      if (range === '7') from = formatApiDate(new Date(today.getTime() - 6 * 86400000));
      else if (range === '30') from = formatApiDate(new Date(today.getTime() - 29 * 86400000));
      else from = formatApiDate(new Date(today.getTime() - 89 * 86400000));
      this.trendFrom.set(from);
      this.trendTo.set(to);
      this.fetchTrendData();
    }
  }

  protected fetchTrendData(): void {
    const flowerId = this.trendFlowerId().trim();
    const from = this.trendFrom().trim();
    const to = this.trendTo().trim();
    if (!flowerId || !from || !to || !this.isValidApiDate(from) || !this.isValidApiDate(to)) {
      if (this.trendRange() !== 'custom') this.toast.error(this.i18n.translate('fmpc.date.required'));
      return;
    }
    if (from > to) {
      this.toast.error(this.i18n.translate('bag.count.config.error.dates.invalid'));
      return;
    }
    this.trendLoading.set(true);
    this.flowerPriceConfigService.getHistory(flowerId, from, to).subscribe({
      next: (res) => {
        this.trendLoading.set(false);
        if (res.success) this.trendData.set(res.data ?? []);
        else {
          this.trendData.set([]);
          this.toast.error(res.message);
        }
      },
      error: (err) => {
        this.trendLoading.set(false);
        this.trendData.set([]);
        this.toast.error(extractErrorMessage(err, this.i18n.translate('common.load.failed')));
      },
    });
  }

  protected trendMax(): number {
    let max = 0;
    for (const r of this.trendData()) {
      const v = Number(r.price);
      if (!Number.isNaN(v) && v > max) max = v;
    }
    return max;
  }

  protected trendMin(): number {
    let min = Number.POSITIVE_INFINITY;
    for (const r of this.trendData()) {
      const v = Number(r.price);
      if (!Number.isNaN(v) && v < min) min = v;
    }
    return min === Number.POSITIVE_INFINITY ? 0 : min;
  }

  protected trendPoints(): { x: number; y: number; label: string; price: number }[] {
    const rows = this.trendData();
    const n = rows.length;
    if (n === 0) return [];
    const prices = rows.map((r) => Number(r.price));
    const max = Math.max(...prices);
    const min = Math.min(...prices);
    const range = max - min || 1;
    return rows.map((r, i) => {
      const x = n === 1 ? 50 : (i / (n - 1)) * 100;
      const y = 42 - ((Number(r.price) - min) / range) * 34 - 4;
      return { x, y, label: r.priceDate ?? '', price: Number(r.price) };
    });
  }

  protected trendAreaPath(): string {
    const pts = this.trendPoints();
    if (pts.length < 2) return '';
    const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
    return `${line} L${pts[pts.length - 1].x.toFixed(2)},46 L${pts[0].x.toFixed(2)},46 Z`;
  }

  protected trendLinePath(): string {
    const pts = this.trendPoints();
    if (pts.length < 2) return '';
    return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
  }

  protected donutTotal(): number {
    return this.ticker().reduce((s, e) => s + Number(e.price || 0), 0);
  }

  protected donutSegments(): { name: string; price: number; percent: number; color: string }[] {
    const total = this.donutTotal();
    const palette = ['#7267ef', '#10b981', '#f59e0b', '#0ea5e9', '#ec4899', '#8b5cf6', '#14b8a6', '#f97316', '#6366f1', '#84cc16'];
    return this.ticker().map((e, i) => ({
      name: e.flowerName,
      price: Number(e.price),
      percent: total > 0 ? Math.round((Number(e.price) / total) * 100) : 0,
      color: palette[i % palette.length],
    }));
  }

  protected donutArcs(): { name: string; price: number; percent: number; color: string; dash: string; offset: number }[] {
    const total = this.donutTotal();
    const segs = this.donutSegments();
    let acc = 0;
    return segs.map((s) => {
      const precise = total > 0 ? (s.price / total) * 100 : 0;
      const dash = `${precise} ${100 - precise}`;
      const offset = 25 - acc;
      acc += precise;
      return { ...s, dash, offset };
    });
  }

  private loadFlowers(): void {
    this.flowerPriceConfigService.getFlowers().subscribe({
      next: (response) => {
        if (response.success) {
          this.flowers.set(response.data);
          const text: Record<string, string> = {};
          const invalid: Record<string, boolean> = {};
          for (const flower of response.data) {
            text[flower.flowerId] = '';
            invalid[flower.flowerId] = false;
          }
          this.priceTextByFlower = text;
          this.priceInvalidByFlower = invalid;
        }
      },
      error: () => this.toast.error(this.i18n.translate('common.load.failed')),
    });
  }

  protected onPriceInput(event: Event, flowerId: string): void {
    const input = event.target as HTMLInputElement;
    let value = input.value.replace(/[^0-9.]/g, '');
    value = value.replace(/(\..*)\./g, '$1');
    input.value = value;
    this.priceTextByFlower[flowerId] = value;
    this.priceInvalidByFlower[flowerId] = false;
  }

  private isValidPositivePrice(value: string): boolean {
    if (!/^\d+(\.\d{1,2})?$/.test(value)) {
      return false;
    }
    return Number(value) > 0;
  }

  protected savePrices(): void {
    if (this.saving()) {
      return;
    }
    const addDate = this.addDate().trim();
    if (!addDate || !this.isValidApiDate(addDate)) {
      this.toast.error(this.i18n.translate('fmpc.date.required'));
      return;
    }
    const items = this.flowers()
      .map((flower) => ({
        flower,
        price: (this.priceTextByFlower[flower.flowerId] ?? '').trim(),
      }))
      .filter((row) => row.price !== '');

    if (items.length === 0) {
      this.toast.error(this.i18n.translate('fmpc.no.price.entered'));
      return;
    }

    let invalidCount = 0;
    const invalidFlags: Record<string, boolean> = {};
    for (const row of this.flowers()) {
      invalidFlags[row.flowerId] = false;
    }
    for (const row of items) {
      if (!this.isValidPositivePrice(row.price)) {
        invalidFlags[row.flower.flowerId] = true;
        invalidCount++;
      }
    }
    this.priceInvalidByFlower = invalidFlags;
    if (invalidCount > 0) {
      this.toast.error(this.i18n.translate('fmpc.price.invalid'));
      return;
    }

    this.saving.set(true);
    this.flowerPriceConfigService
      .savePrices(
        addDate,
        items.map((row) => ({ flowerId: row.flower.flowerId, flowerName: row.flower.flowerName, price: row.price })),
      )
      .subscribe({
        next: (response) => {
          this.saving.set(false);
          if (response.success) {
            this.toast.success(response.message);
            const text: Record<string, string> = {};
            for (const flower of this.flowers()) {
              text[flower.flowerId] = '';
            }
            this.priceTextByFlower = text;
            this.priceInvalidByFlower = {};
            this.loadTicker();
            this.flowerPriceConfigService.notifyTickerRefresh();
          } else {
            this.toast.error(response.message);
          }
        },
        error: (error) => {
          this.saving.set(false);
          this.toast.error(extractErrorMessage(error, this.i18n.translate('fmpc.save.failed')));
        },
      });
  }

  protected fetchPrices(): void {
    if (this.loading()) {
      return;
    }
    const viewDate = this.viewDate().trim();
    if (!viewDate || !this.isValidApiDate(viewDate)) {
      this.toast.error(this.i18n.translate('fmpc.date.required'));
      return;
    }
    this.loading.set(true);
    this.flowerPriceConfigService.getPrices(viewDate).subscribe({
      next: (response) => {
        this.loading.set(false);
        this.searched.set(true);
        if (response.success) {
          this.viewRows.set(this.toViewRows(response.data));
        } else {
          this.viewRows.set([]);
          this.toast.error(response.message);
        }
      },
      error: (error) => {
        this.loading.set(false);
        this.searched.set(true);
        this.viewRows.set([]);
        this.toast.error(extractErrorMessage(error, this.i18n.translate('common.load.failed')));
      },
    });
  }

  private toViewRows(rows: FlowerPriceConfigRow[]): ViewRow[] {
    return rows.map((row) => {
      const price = row.price == null ? '' : String(row.price);
      return {
        priceConfigId: row.priceConfigId,
        flowerName: row.flowerName,
        price,
        origPrice: price,
        enabled: false,
      };
    });
  }

  protected toggleRowEdit(index: number): void {
    const row = this.viewRows()[index];
    if (!row) {
      return;
    }
    const rows = [...this.viewRows()];
    rows[index] = { ...row, enabled: !row.enabled };
    this.viewRows.set(rows);
  }

  protected cancelRowEdit(index: number): void {
    const row = this.viewRows()[index];
    if (!row) {
      return;
    }
    const rows = [...this.viewRows()];
    rows[index] = { ...row, price: row.origPrice, enabled: false };
    this.viewRows.set(rows);
  }

  protected onViewPriceInput(event: Event, index: number): void {
    const input = event.target as HTMLInputElement;
    let value = input.value.replace(/[^0-9.]/g, '');
    value = value.replace(/(\..*)\./g, '$1');
    input.value = value;
    const rows = [...this.viewRows()];
    rows[index] = { ...rows[index], price: value };
    this.viewRows.set(rows);
  }

  protected saveRowEdit(index: number): void {
    if (this.updating()) {
      return;
    }
    const row = this.viewRows()[index];
    if (!row) {
      return;
    }
    const price = row.price.trim();
    if (!this.isValidPositivePrice(price)) {
      this.toast.error(this.i18n.translate('fmpc.price.invalid'));
      return;
    }
    this.updating.set(true);
    this.flowerPriceConfigService.updatePrice(row.priceConfigId, price).subscribe({
      next: (response) => {
        this.updating.set(false);
        if (response.success) {
          const rows = [...this.viewRows()];
          rows[index] = { ...rows[index], price, origPrice: price, enabled: false };
          this.viewRows.set(rows);
          this.toast.success(response.message);
          this.loadTicker();
          this.flowerPriceConfigService.notifyTickerRefresh();
        } else {
          this.toast.error(response.message);
        }
      },
      error: (error) => {
        this.updating.set(false);
        this.toast.error(extractErrorMessage(error, this.i18n.translate('fmpc.update.failed')));
      },
    });
  }

  protected openDeleteConfirm(index: number): void {
    const row = this.viewRows()[index];
    if (row) {
      this.deleteTarget.set(row);
    }
  }

  protected closeDelete(): void {
    this.deleteTarget.set(null);
  }

  protected onDeleteOverlayClick(event: Event): void {
    if (event.target === event.currentTarget) {
      this.closeDelete();
    }
  }

  protected confirmDelete(): void {
    const row = this.deleteTarget();
    if (!row || this.deleting()) {
      return;
    }
    this.deleting.set(true);
    this.flowerPriceConfigService.deletePrice(row.priceConfigId).subscribe({
      next: (response) => {
        this.deleting.set(false);
        if (response.success) {
          this.closeDelete();
          this.toast.success(response.message);
          this.fetchPrices();
          this.loadTicker();
          this.flowerPriceConfigService.notifyTickerRefresh();
        } else {
          this.toast.error(response.message);
        }
      },
      error: (error) => {
        this.deleting.set(false);
        this.toast.error(extractErrorMessage(error, this.i18n.translate('fmpc.delete.failed')));
      },
    });
  }

  protected deleteConfirmText(): string {
    const row = this.deleteTarget();
    if (!row) {
      return '';
    }
    return this.i18n.translate('fmpc.delete.confirm', row.flowerName, this.viewDate().trim());
  }

  private isValidApiDate(date: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return false;
    }
    const parsed = new Date(`${date}T00:00:00`);
    return !Number.isNaN(parsed.getTime());
  }
}