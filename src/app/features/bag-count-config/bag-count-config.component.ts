import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { AutocompleteComponent } from '../../core/components/autocomplete/autocomplete.component';
import { DraggableDirective } from '../../core/directives/draggable.directive';
import {
  BagCountConfigFarmer,
  BagCountConfigFlower,
  BagCountConfigRow,
} from '../../core/models/bag-count-config';
import { I18nPipe } from '../../core/pipes/i18n.pipe';
import { BagCountConfigService } from '../../core/services/bag-count-config.service';
import { I18nService } from '../../core/services/i18n.service';
import { ToastService } from '../../core/services/toast.service';
import { formatApiDate } from '../../core/utils/sales.util';
import { extractErrorMessage } from '../../core/utils/http-error.util';

type BagCountSection = 'setup' | 'view';
type ReportPeriod = 'daily' | 'monthly' | 'yearly' | 'custom';

@Component({
  selector: 'app-bag-count-config',
  standalone: true,
  imports: [FormsModule, I18nPipe, AutocompleteComponent, DraggableDirective],
  templateUrl: './bag-count-config.html',
  styleUrl: './bag-count-config.css',
})
export class BagCountConfigComponent implements OnInit {
  private readonly bagCountConfigService = inject(BagCountConfigService);
  private readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);

  protected readonly section = signal<BagCountSection>('setup');

  protected readonly farmers = signal<BagCountConfigFarmer[]>([]);
  protected readonly flowers = signal<BagCountConfigFlower[]>([]);
  protected readonly configs = signal<BagCountConfigRow[]>([]);

  protected readonly viewFarmerFilter = signal('');
  protected readonly viewSelectedFarmer = signal<{ farmerId: string; farmerName: string } | null>(null);

  protected readonly configuredFarmers = computed(() => {
    const map = new Map<string, { farmerId: string; farmerName: string }>();
    for (const c of this.configs()) {
      if (!c.farmerId || !c.farmerName) continue;
      if (!map.has(c.farmerId)) map.set(c.farmerId, { farmerId: c.farmerId, farmerName: c.farmerName });
    }
    return Array.from(map.values()).sort((a, b) => a.farmerName.localeCompare(b.farmerName));
  });

  protected readonly filteredConfiguredFarmers = computed(() => {
    const term = this.viewFarmerFilter().trim().toLowerCase();
    const list = this.configuredFarmers();
    if (!term) return list;
    return list.filter((f) => f.farmerName.toLowerCase().includes(term));
  });

  protected readonly detailRows = computed(() => {
    const sel = this.viewSelectedFarmer();
    if (!sel) return [];
    return this.configs().filter((c) => c.farmerId === sel.farmerId);
  });

  protected readonly filteredDetailRows = computed(() => {
    const rows = this.detailRows();
    const from = this.fromDate();
    const to = this.toDate();
    if (!from || !to) return rows;
    if (from > to) return rows;
    return rows.filter((r) => {
      const d = (r.salesDate ?? '').trim();
      return d >= from && d <= to;
    });
  });

  protected readonly detailTotal = computed(() =>
    this.filteredDetailRows().reduce((sum, row) => sum + (Number(row.bagCount) || 0), 0),
  );

  protected readonly deleteTarget = signal<BagCountConfigRow | null>(null);
  protected readonly deleting = signal(false);

  protected readonly farmer = signal('');
  protected readonly farmerId = signal('');
  protected readonly farmerInvalid = signal(false);
  protected readonly farmerNames = computed(() =>
    this.farmers().map((f) => f.farmerName).filter((name) => name && name.trim() !== ''),
  );

  protected readonly search = signal('');
  protected readonly filteredFlowers = computed(() => {
    const term = this.search().trim().toLowerCase();
    if (!term) {
      return this.flowers();
    }
    return this.flowers().filter((f) =>
      f.flowerName.toLowerCase().includes(term),
    );
  });

  protected bagCountEdits: Record<string, string> = {};
  protected dateEdits: Record<string, string> = {};
  protected farmerEdits: Record<string, string> = {};
  protected farmerIdEdits: Record<string, string> = {};
  protected farmerInvalidByFlower: Record<string, boolean> = {};
  protected savingFlowerId = '';

  protected readonly fromDate = signal(formatApiDate(this.daysAgo(7)));
  protected readonly toDate = signal(formatApiDate(new Date()));
  protected readonly period = signal<ReportPeriod>('custom');
  protected readonly reportRows = signal<BagCountConfigRow[]>([]);
  protected readonly loading = signal(false);
  protected readonly searched = signal(false);

  private applyingPeriod = false;

  ngOnInit(): void {
    this.load();
  }

  protected switchSection(target: BagCountSection): void {
    if (target === 'view') {
      this.farmer.set('');
      this.farmerId.set('');
      this.farmerInvalid.set(false);
      this.viewSelectedFarmer.set(null);
    } else if (target === 'setup') {
      this.resetSetupState();
    }
    this.section.set(target);
  }

  private resetSetupState(): void {
    const today = formatApiDate(new Date());
    const bags: Record<string, string> = {};
    const dates: Record<string, string> = {};
    const farmerTexts: Record<string, string> = {};
    const farmerIds: Record<string, string> = {};
    const farmerInvalids: Record<string, boolean> = {};
    for (const f of this.flowers()) {
      bags[f.flowerId] = '0';
      dates[f.flowerId] = today;
      farmerTexts[f.flowerId] = '';
      farmerIds[f.flowerId] = '';
      farmerInvalids[f.flowerId] = false;
    }
    this.bagCountEdits = bags;
    this.dateEdits = dates;
    this.farmerEdits = farmerTexts;
    this.farmerIdEdits = farmerIds;
    this.farmerInvalidByFlower = farmerInvalids;
    this.search.set('');
    this.savingFlowerId = '';
  }

  protected openFarmerDetail(farmer: { farmerId: string; farmerName: string }): void {
    this.viewSelectedFarmer.set(farmer);
    this.fromDate.set('');
    this.toDate.set('');
    this.period.set('custom');
  }

  protected backToFarmerList(): void {
    this.viewSelectedFarmer.set(null);
  }

  protected openDeleteConfirm(row: BagCountConfigRow): void {
    this.deleteTarget.set(row);
  }

  protected closeDelete(): void {
    this.deleteTarget.set(null);
  }

  protected onDeleteOverlayClick(event: Event): void {
    if (event.target === event.currentTarget) {
      this.closeDelete();
    }
  }

  protected deleteConfirmText(): string {
    const row = this.deleteTarget();
    if (!row) return '';
    const date = (row.salesDate ?? '').trim();
    return this.i18n.translate('bag.count.config.delete.confirm', row.farmerName, row.flowerName, date);
  }

  protected confirmDelete(): void {
    const row = this.deleteTarget();
    if (!row || this.deleting()) return;
    const salesDate = (row.salesDate ?? '').trim();
    if (!salesDate || !this.isValidDate(salesDate)) {
      this.toast.error(this.i18n.translate('bag.count.config.invalid.date'));
      return;
    }
    this.deleting.set(true);
    this.bagCountConfigService.deleteConfig(row.farmerId, row.flowerId, salesDate).subscribe({
      next: (response) => {
        this.deleting.set(false);
        if (response.success) {
          this.closeDelete();
          this.toast.success(response.message);
          this.reloadConfigs();
        } else {
          this.toast.error(response.message);
        }
      },
      error: (error) => {
        this.deleting.set(false);
        this.toast.error(extractErrorMessage(error, this.i18n.translate('bag.count.config.delete.failed')));
      },
    });
  }

  private load(): void {
    this.bagCountConfigService.getFarmers().subscribe({
      next: (response) => {
        if (response.success) {
          this.farmers.set(response.data);
        }
      },
      error: () => this.toast.error(this.i18n.translate('common.load.failed')),
    });
    this.bagCountConfigService.getFlowers().subscribe({
      next: (response) => {
        if (response.success) {
          this.flowers.set(response.data);
          this.initEdits(response.data);
        }
      },
      error: () => this.toast.error(this.i18n.translate('common.load.failed')),
    });
    this.bagCountConfigService.getConfigs().subscribe({
      next: (response) => {
        if (response.success) {
          this.configs.set(response.data);
        }
      },
      error: () => this.toast.error(this.i18n.translate('common.load.failed')),
    });
  }

  private initEdits(rows: BagCountConfigFlower[]): void {
    const bags: Record<string, string> = {};
    const dates: Record<string, string> = {};
    const farmerTexts: Record<string, string> = {};
    const farmerIds: Record<string, string> = {};
    const farmerInvalids: Record<string, boolean> = {};
    const today = formatApiDate(new Date());
    for (const row of rows) {
      bags[row.flowerId] = '0';
      dates[row.flowerId] = today;
      farmerTexts[row.flowerId] = '';
      farmerIds[row.flowerId] = '';
      farmerInvalids[row.flowerId] = false;
    }
    this.bagCountEdits = bags;
    this.dateEdits = dates;
    this.farmerEdits = farmerTexts;
    this.farmerIdEdits = farmerIds;
    this.farmerInvalidByFlower = farmerInvalids;
  }

  protected onFarmerValueChange(flowerId: string, value: string): void {
    this.farmerEdits[flowerId] = value;
    this.farmerInvalidByFlower[flowerId] = false;
    const trimmed = (value ?? '').trim();
    if (trimmed === '') {
      this.farmerIdEdits[flowerId] = '';
      return;
    }
    const match = this.farmers().find((f) => f.farmerName.toLowerCase() === trimmed.toLowerCase());
    this.farmerIdEdits[flowerId] = match ? match.farmerId : '';
  }

  protected validateFarmerForFlower(flowerId: string): void {
    const value = (this.farmerEdits[flowerId] ?? '').trim();
    if (value === '') {
      this.farmerInvalidByFlower[flowerId] = false;
      this.farmerIdEdits[flowerId] = '';
      return;
    }
    const match = this.farmers().find((f) => f.farmerName.toLowerCase() === value.toLowerCase());
    this.farmerInvalidByFlower[flowerId] = !match;
    this.farmerIdEdits[flowerId] = match ? match.farmerId : '';
  }

  protected onFarmerSelectedForFlower(flowerId: string, name: string): void {
    this.farmerEdits[flowerId] = name;
    const match = this.farmers().find((f) => f.farmerName.toLowerCase() === name.toLowerCase());
    this.farmerInvalidByFlower[flowerId] = !match;
    this.farmerIdEdits[flowerId] = match ? match.farmerId : '';
  }

  protected onBagInput(event: Event, flowerId: string): void {
    const input = event.target as HTMLInputElement;
    let value = input.value.replace(/[^0-9]/g, '');
    input.value = value;
    this.bagCountEdits[flowerId] = value;
  }

  protected applyDefault(flowerId: string): void {
    const today = formatApiDate(new Date());
    // reset this row to initial defaults (empty farmer, 0 bags, today)
    this.farmerEdits[flowerId] = '';
    this.farmerIdEdits[flowerId] = '';
    this.farmerInvalidByFlower[flowerId] = false;
    this.bagCountEdits[flowerId] = '0';
    this.dateEdits[flowerId] = today;
    // reassign to trigger change detection for [value] bindings
    this.farmerEdits = { ...this.farmerEdits };
    this.farmerIdEdits = { ...this.farmerIdEdits };
    this.farmerInvalidByFlower = { ...this.farmerInvalidByFlower };
    this.bagCountEdits = { ...this.bagCountEdits };
    this.dateEdits = { ...this.dateEdits };
  }

  protected saveConfig(flower: BagCountConfigFlower): void {
    if (this.savingFlowerId) {
      return;
    }
    this.validateFarmerForFlower(flower.flowerId);
    const farmerId = (this.farmerIdEdits[flower.flowerId] ?? '').trim();
    const farmerName = (this.farmerEdits[flower.flowerId] ?? '').trim();
    if (!farmerId) {
      this.toast.error(this.i18n.translate('bag.count.config.error.farmer.required'));
      this.farmerInvalidByFlower[flower.flowerId] = true;
      return;
    }
    const bagCount = (this.bagCountEdits[flower.flowerId] ?? '').trim();
    const date = (this.dateEdits[flower.flowerId] ?? '').trim();
    if (bagCount === '' || Number.isNaN(Number(bagCount)) || Number(bagCount) < 0) {
      this.toast.error(this.i18n.translate('bag.count.config.invalid.count'));
      return;
    }
    if (!date || !this.isValidDate(date)) {
      this.toast.error(this.i18n.translate('bag.count.config.invalid.date'));
      return;
    }
    this.savingFlowerId = flower.flowerId;
    this.bagCountConfigService
      .saveConfig(farmerId, farmerName, flower.flowerId, flower.flowerName, date, bagCount)
      .subscribe({
        next: (response) => {
          this.savingFlowerId = '';
          if (response.success) {
            this.toast.success(response.message);
            this.reloadConfigs();
          } else {
            this.toast.error(response.message);
          }
        },
        error: (error) => {
          this.savingFlowerId = '';
          this.toast.error(extractErrorMessage(error, this.i18n.translate('bag.count.config.save.failed')));
        },
      });
  }

  protected deleteConfig(flower: BagCountConfigFlower): void {
    this.validateFarmerForFlower(flower.flowerId);
    const farmerId = (this.farmerIdEdits[flower.flowerId] ?? '').trim();
    const farmerName = (this.farmerEdits[flower.flowerId] ?? '').trim();
    if (!farmerId) {
      this.toast.error(this.i18n.translate('bag.count.config.error.farmer.required'));
      this.farmerInvalidByFlower[flower.flowerId] = true;
      return;
    }
    const date = (this.dateEdits[flower.flowerId] ?? '').trim();
    if (!date || !this.isValidDate(date)) {
      this.toast.error(this.i18n.translate('bag.count.config.invalid.date'));
      return;
    }
    const row: BagCountConfigRow = {
      configId: 0,
      farmerId,
      farmerName,
      flowerId: flower.flowerId,
      flowerName: flower.flowerName,
      salesDate: date,
      bagCount: 0,
    };
    this.openDeleteConfirm(row);
  }

  protected deleteReportRow(row: BagCountConfigRow): void {
    this.openDeleteConfirm(row);
  }

  protected deleteDetailRow(row: BagCountConfigRow): void {
    this.openDeleteConfirm(row);
  }

  private reloadConfigs(): void {
    this.bagCountConfigService.getConfigs().subscribe({
      next: (response) => {
        if (response.success) {
          this.configs.set(response.data);
        }
      },
      error: () => this.toast.error(this.i18n.translate('common.load.failed')),
    });
  }

  protected validateFarmer(): void {
    const value = this.farmer().trim();
    if (value === '') {
      this.farmerInvalid.set(false);
      this.farmerId.set('');
      return;
    }
    const match = this.farmers().find(
      (f) => f.farmerName.toLowerCase() === value.toLowerCase(),
    );
    this.farmerInvalid.set(!match);
    this.farmerId.set(match ? match.farmerId : '');
  }

  protected onFarmerSelected(name: string): void {
    this.farmer.set(name);
    const match = this.farmers().find((f) => f.farmerName.toLowerCase() === name.toLowerCase());
    this.farmerInvalid.set(!match);
    this.farmerId.set(match ? match.farmerId : '');
  }

  protected setPeriod(period: ReportPeriod): void {
    this.applyingPeriod = true;
    this.period.set(period);
    const today = new Date();
    if (period === 'daily') {
      this.fromDate.set(formatApiDate(today));
      this.toDate.set(formatApiDate(today));
    } else if (period === 'monthly') {
      this.fromDate.set(formatApiDate(new Date(today.getFullYear(), today.getMonth(), 1)));
      this.toDate.set(formatApiDate(new Date(today.getFullYear(), today.getMonth() + 1, 0)));
    } else if (period === 'yearly') {
      this.fromDate.set(formatApiDate(new Date(today.getFullYear(), 0, 1)));
      this.toDate.set(formatApiDate(new Date(today.getFullYear(), 11, 31)));
    }
    this.applyingPeriod = false;
    if (this.viewSelectedFarmer()) {
      return;
    }
    this.searchReport();
  }

  protected onFromDateChange(value: string): void {
    this.fromDate.set(value);
    if (!this.applyingPeriod) {
      this.period.set('custom');
    }
  }

  protected onToDateChange(value: string): void {
    this.toDate.set(value);
    if (!this.applyingPeriod) {
      this.period.set('custom');
    }
  }

  protected searchReport(): void {
    if (this.loading()) {
      return;
    }
    if (!this.farmer().trim()) {
      this.toast.error(this.i18n.translate('bag.count.config.error.farmer.required'));
      this.farmerInvalid.set(true);
      return;
    }
    this.validateFarmer();
    if (this.farmerInvalid()) {
      this.toast.error(this.i18n.translate('txn.error.farmer.notfound'));
      return;
    }
    const farmerId = this.farmerId();
    if (!farmerId) {
      this.toast.error(this.i18n.translate('txn.error.farmer.notfound'));
      return;
    }
    const fromDate = this.fromDate();
    const toDate = this.toDate();
    if (!fromDate) {
      this.toast.error(this.i18n.translate('bag.count.config.error.from.date.required'));
      return;
    }
    if (!toDate) {
      this.toast.error(this.i18n.translate('bag.count.config.error.to.date.required'));
      return;
    }
    if (fromDate > toDate) {
      this.toast.error(this.i18n.translate('bag.count.config.error.dates.invalid'));
      return;
    }

    this.loading.set(true);
    this.bagCountConfigService.getReport(farmerId, fromDate, toDate).subscribe({
      next: (response) => {
        this.loading.set(false);
        this.searched.set(true);
        if (response.success) {
          this.reportRows.set(response.data);
        } else {
          this.reportRows.set([]);
          this.toast.error(response.message);
        }
      },
      error: (error) => {
        this.loading.set(false);
        this.searched.set(true);
        this.reportRows.set([]);
        this.toast.error(extractErrorMessage(error, this.i18n.translate('common.load.failed')));
      },
    });
  }

  protected totalBagCount(): number {
    return this.reportRows().reduce((sum, row) => sum + (Number(row.bagCount) || 0), 0);
  }

  private isValidDate(date: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return false;
    }
    const parsed = new Date(`${date}T00:00:00`);
    return !Number.isNaN(parsed.getTime());
  }

  private daysAgo(days: number): Date {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date;
  }
}