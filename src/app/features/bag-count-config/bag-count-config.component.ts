import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { BagCountConfigFlower, BagCountConfigRow } from '../../core/models/bag-count-config';
import { I18nPipe } from '../../core/pipes/i18n.pipe';
import { BagCountConfigService } from '../../core/services/bag-count-config.service';
import { I18nService } from '../../core/services/i18n.service';
import { ToastService } from '../../core/services/toast.service';
import { formatApiDate } from '../../core/utils/sales.util';
import { extractErrorMessage } from '../../core/utils/http-error.util';

@Component({
  selector: 'app-bag-count-config',
  standalone: true,
  imports: [FormsModule, I18nPipe],
  templateUrl: './bag-count-config.html',
  styleUrl: './bag-count-config.css',
})
export class BagCountConfigComponent implements OnInit {
  private readonly bagCountConfigService = inject(BagCountConfigService);
  private readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);

  protected readonly flowers = signal<BagCountConfigFlower[]>([]);
  protected readonly configs = signal<BagCountConfigRow[]>([]);
  protected readonly search = signal('');
  protected readonly filteredFlowers = computed(() => {
    const term = this.search().trim().toLowerCase();
    if (!term) {
      return this.flowers();
    }
    return this.flowers().filter((row) =>
      (row.flowerName ?? '').toLowerCase().includes(term),
    );
  });

  protected bagCountEdits: Record<string, string> = {};
  protected dateEdits: Record<string, string> = {};
  protected bagCheckEdits: Record<string, string> = {};
  protected savingFlowerId = '';

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
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
    const checks: Record<string, string> = {};
    for (const row of rows) {
      bags[row.flowerId] = '0';
      dates[row.flowerId] = formatApiDate(new Date());
      checks[row.flowerId] = 'D';
    }
    this.bagCountEdits = bags;
    this.dateEdits = dates;
    this.bagCheckEdits = checks;
  }

  protected onBagInput(event: Event, flowerId: string): void {
    const input = event.target as HTMLInputElement;
    let value = input.value.replace(/[^0-9]/g, '');
    input.value = value;
    this.bagCountEdits[flowerId] = value;
  }

  protected setCheck(flowerId: string, value: string): void {
    this.bagCheckEdits[flowerId] = value;
  }

  protected applyDefault(flowerId: string): void {
    const existing = this.configs().find((c) => c.flowerId === flowerId);
    if (existing) {
      this.bagCountEdits[flowerId] = String(existing.bagCount ?? 0);
      this.dateEdits[flowerId] = existing.salesDate ?? formatApiDate(new Date());
      this.bagCheckEdits[flowerId] = existing.bagCheck ?? 'E';
    } else {
      this.bagCountEdits[flowerId] = '0';
      this.dateEdits[flowerId] = formatApiDate(new Date());
      this.bagCheckEdits[flowerId] = 'D';
    }
  }

  protected saveConfig(flower: BagCountConfigFlower): void {
    if (this.savingFlowerId) {
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
    const bagCheck = this.bagCheckEdits[flower.flowerId] ?? 'E';
    this.savingFlowerId = flower.flowerId;
    this.bagCountConfigService.saveConfig(flower.flowerId, flower.flowerName, date, bagCount, bagCheck).subscribe({
      next: (response) => {
        this.savingFlowerId = '';
        if (response.success) {
          this.toast.success(response.message);
          this.load();
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

  protected deleteConfig(row: BagCountConfigRow): void {
    if (!row.salesDate) {
      return;
    }
    this.bagCountConfigService.deleteConfig(row.flowerId, row.salesDate).subscribe({
      next: (response) => {
        if (response.success) {
          this.toast.success(response.message);
          this.load();
        } else {
          this.toast.error(response.message);
        }
      },
      error: (error) => {
        this.toast.error(extractErrorMessage(error, this.i18n.translate('bag.count.config.delete.failed')));
      },
    });
  }

  protected isEnable(row: BagCountConfigRow): boolean {
    return (row.bagCheck ?? 'E').toUpperCase() === 'E';
  }

  private isValidDate(date: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return false;
    }
    const parsed = new Date(`${date}T00:00:00`);
    return !Number.isNaN(parsed.getTime());
  }
}
