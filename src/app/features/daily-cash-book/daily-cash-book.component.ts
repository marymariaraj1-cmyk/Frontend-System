import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';

import { CashBookFarmerRow, CashBookRecord } from '../../core/models/daily-cash-book';
import { CashBookFieldConfig } from '../../core/models/cash-book-field-config';
import { I18nPipe } from '../../core/pipes/i18n.pipe';
import { CashBookFieldConfigService } from '../../core/services/cash-book-field-config.service';
import { DailyCashBookService } from '../../core/services/daily-cash-book.service';
import { I18nService } from '../../core/services/i18n.service';
import { ToastService } from '../../core/services/toast.service';
import { formatCurrency } from '../../core/utils/currency-format.util';
import { formatDate } from '../../core/utils/date.util';
import { extractErrorMessage } from '../../core/utils/http-error.util';
import { formatApiDate } from '../../core/utils/sales.util';

interface ManualEntryPayload {
  label: string;
  amount: number;
}

interface ManualRow {
  key: string;
  label: string;
  labelTa: string | null;
  amount: string;
  removed: boolean;
}

@Component({
  selector: 'app-daily-cash-book',
  standalone: true,
  imports: [FormsModule, I18nPipe],
  templateUrl: './daily-cash-book.html',
  styleUrl: './daily-cash-book.css',
})
export class DailyCashBookComponent implements OnInit {
  private readonly service = inject(DailyCashBookService);
  private readonly fieldConfigService = inject(CashBookFieldConfigService);
  private readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);

  protected readonly formatCurrency = formatCurrency;

  protected readonly todayStr = formatApiDate(new Date());
  protected readonly bookDate = signal(this.todayStr);

  // Dynamic manual rows (built from the client's field configuration)
  protected readonly manualDebit = signal<ManualRow[]>([]);
  protected readonly manualCredit = signal<ManualRow[]>([]);
  protected readonly remarks = signal('');

  // System-calculated blocks
  protected readonly buyerPurchaseTotal = signal(0);
  protected readonly excessCashList = signal<CashBookFarmerRow[]>([]);
  protected readonly buyerReceivedTotal = signal(0);
  protected readonly commissionTotal = signal(0);
  protected readonly installmentTotal = signal(0);
  protected readonly nonCashList = signal<CashBookFarmerRow[]>([]);

  protected readonly saved = signal<CashBookRecord | null>(null);
  protected readonly recalculated = signal(false);
  protected readonly recalculating = signal(false);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly loaded = signal(false);

  private readonly configFields = signal<CashBookFieldConfig[]>([]);

  ngOnInit(): void {
    this.load();
  }

  protected isToday(): boolean {
    return this.bookDate() === this.todayStr;
  }

  /** Manual inputs are editable today, or after a live recalculation on a past date. */
  protected canEditManual(): boolean {
    return this.isToday() || this.recalculated();
  }

  /** Today can always be saved; past dates only after a live recalculation. */
  protected canSave(): boolean {
    return this.isToday() || this.recalculated();
  }

  protected dateLabel(): string {
    const parts = this.bookDate().split('-');
    if (parts.length !== 3) {
      return this.bookDate();
    }
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    const dd = formatDate(this.bookDate());
    const weekday = d.toLocaleDateString('en-US', { weekday: 'long' });
    return `${dd} ${weekday}`;
  }

  protected onDateChange(value: string): void {
    if (!value) {
      return;
    }
    this.bookDate.set(value);
    this.load();
  }

  protected fieldLabel(row: ManualRow): string {
    if (this.i18n.lang() === 'ta' && row.labelTa) {
      return row.labelTa;
    }
    return row.label;
  }

  protected onAmountInput(row: ManualRow, event: Event): void {
    row.amount = sanitizeAmount((event.target as HTMLInputElement).value);
  }

  protected excessCashTotal(): number {
    return this.excessCashList().reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
  }

  protected leftTotal(): number {
    return (
      this.sumManual(this.manualDebit()) +
      (Number(this.buyerPurchaseTotal()) || 0) +
      this.excessCashTotal()
    );
  }

  protected rightTotal(): number {
    return (
      this.sumManual(this.manualCredit()) +
      (Number(this.buyerReceivedTotal()) || 0) +
      (Number(this.commissionTotal()) || 0) +
      (Number(this.installmentTotal()) || 0)
    );
  }

  protected remaining(): number {
    return this.leftTotal() - this.rightTotal();
  }

  protected save(): void {
    if (this.saving() || !this.canSave()) {
      return;
    }
    this.saving.set(true);
    this.service
      .save({
        bookDate: this.bookDate(),
        manualDebitEntries: this.toPayload(this.manualDebit()),
        manualCreditEntries: this.toPayload(this.manualCredit()),
        remarks: this.remarks().trim(),
      })
      .subscribe({
        next: (response) => {
          this.saving.set(false);
          if (response.success && response.data) {
            this.applySaved(response.data);
            if (!this.isToday()) {
              // A past-dated book becomes read-only again until the next recalculation.
              this.recalculated.set(false);
            }
            this.toast.success(this.i18n.translate('dcb.saved'));
          } else {
            this.toast.error(response.message);
          }
        },
        error: (error) => {
          this.saving.set(false);
          this.toast.error(extractErrorMessage(error, this.i18n.translate('common.load.failed')));
        },
      });
  }

  /**
   * Re-fetches the live system values for the selected date, reloads the manual
   * amounts from the saved table row, and unlocks the manual fields + Save button.
   */
  protected recalculate(): void {
    if (this.recalculating() || this.saving()) {
      return;
    }
    const date = this.bookDate();
    this.recalculating.set(true);
    forkJoin({
      config: this.fieldConfigService.list(),
      blocks: this.service.compute(date),
      saved: this.service.load(date),
    }).subscribe({
      next: ({ config, blocks, saved }) => {
        this.recalculating.set(false);
        this.loaded.set(true);
        if (config.success) {
          this.configFields.set(config.data ?? []);
        } else {
          this.toast.error(config.message);
        }

        // Manual amounts always come from the saved table row (blank when none).
        if (saved.success && saved.data) {
          this.applySaved(saved.data);
        } else {
          this.saved.set(null);
          this.remarks.set('');
          this.buildManualRows(this.configFields(), null);
          if (!saved.success) {
            this.toast.error(saved.message);
          }
        }

        // Live system values win over the previously saved snapshot.
        if (blocks.success && blocks.data) {
          this.applyBlocks(
            blocks.data.buyerPurchaseTotal,
            blocks.data.farmerExcessDebitCashList ?? [],
            blocks.data.buyerReceivedTotal,
            blocks.data.commissionTotal,
            blocks.data.installmentTotal,
            blocks.data.farmerExcessDebitNonCashList ?? [],
          );
          this.recalculated.set(true);
          this.toast.success(this.i18n.translate('dcb.recalculated'));
        } else {
          this.toast.error(blocks.message);
        }
      },
      error: (error) => {
        this.recalculating.set(false);
        this.toast.error(extractErrorMessage(error, this.i18n.translate('common.load.failed')));
      },
    });
  }

  private load(): void {
    const date = this.bookDate();
    this.loading.set(true);
    this.loaded.set(false);
    this.recalculated.set(false);
    if (this.isToday()) {
      forkJoin({
        config: this.fieldConfigService.list(),
        blocks: this.service.compute(date),
        saved: this.service.load(date),
      }).subscribe({
        next: ({ config, blocks, saved }) => {
          this.loading.set(false);
          this.loaded.set(true);
          this.configFields.set(config.success ? config.data : []);
          if (blocks.success && blocks.data) {
            this.applyBlocks(
              blocks.data.buyerPurchaseTotal,
              blocks.data.farmerExcessDebitCashList ?? [],
              blocks.data.buyerReceivedTotal,
              blocks.data.commissionTotal,
              blocks.data.installmentTotal,
              blocks.data.farmerExcessDebitNonCashList ?? [],
            );
          }
          if (saved.success && saved.data) {
            this.applySaved(saved.data);
          } else {
            this.saved.set(null);
            this.remarks.set('');
            this.buildManualRows(this.configFields(), null);
          }
          if (!config.success) {
            this.toast.error(config.message);
          }
          if (!blocks.success) {
            this.toast.error(blocks.message);
          }
        },
        error: (error) => {
          this.loading.set(false);
          this.loaded.set(true);
          this.toast.error(extractErrorMessage(error, this.i18n.translate('common.load.failed')));
        },
      });
    } else {
      forkJoin({
        config: this.fieldConfigService.list(),
        saved: this.service.load(date),
      }).subscribe({
        next: ({ config, saved }) => {
          this.loading.set(false);
          this.loaded.set(true);
          this.configFields.set(config.success ? config.data : []);
          if (saved.success && saved.data) {
            this.applySaved(saved.data);
          } else {
            this.saved.set(null);
            this.buildManualRows(this.configFields(), null);
            this.remarks.set('');
            this.applyBlocks(0, [], 0, 0, 0, []);
            if (!saved.success) {
              this.toast.error(saved.message);
            }
          }
          if (!config.success) {
            this.toast.error(config.message);
          }
        },
        error: (error) => {
          this.loading.set(false);
          this.loaded.set(true);
          this.toast.error(extractErrorMessage(error, this.i18n.translate('common.load.failed')));
        },
      });
    }
  }

  private applyBlocks(
    buyerPurchaseTotal: number,
    cashList: CashBookFarmerRow[],
    buyerReceivedTotal: number,
    commissionTotal: number,
    installmentTotal: number,
    nonCashList: CashBookFarmerRow[],
  ): void {
    this.buyerPurchaseTotal.set(Number(buyerPurchaseTotal) || 0);
    this.excessCashList.set(cashList);
    this.buyerReceivedTotal.set(Number(buyerReceivedTotal) || 0);
    this.commissionTotal.set(Number(commissionTotal) || 0);
    this.installmentTotal.set(Number(installmentTotal) || 0);
    this.nonCashList.set(nonCashList);
  }

  private applySaved(record: CashBookRecord): void {
    this.saved.set(record);
    this.applyBlocks(
      record.buyerPurchaseTotal,
      record.farmerExcessDebitCashList ?? [],
      record.buyerReceivedTotal,
      record.commissionTotal,
      record.installmentTotal,
      record.farmerExcessDebitNonCashList ?? [],
    );
    this.remarks.set(record.remarks ?? '');
    this.buildManualRows(this.configFields(), record);
  }

  /**
   * Rebuilds every configured manual field from the field configuration and
   * overlays the saved amounts. Fields with no saved amount stay in the list
   * as blank rows, so an unfilled field is never skipped after a save.
   */
  private buildManualRows(configs: CashBookFieldConfig[], record: CashBookRecord | null): void {
    this.manualDebit.set(
      mergeRows(
        configs.filter((f) => f.fieldType === 'DEBIT'),
        record?.manualDebitEntries ?? [],
        'DEBIT',
      ),
    );
    this.manualCredit.set(
      mergeRows(
        configs.filter((f) => f.fieldType === 'CREDIT'),
        record?.manualCreditEntries ?? [],
        'CREDIT',
      ),
    );
  }

  private sumManual(rows: ManualRow[]): number {
    return rows.reduce((sum, row) => sum + num(row.amount), 0);
  }

  private toPayload(rows: ManualRow[]): ManualEntryPayload[] {
    return rows.map((row) => ({ label: row.label, amount: num(row.amount) }));
  }
}

function mergeRows(
  configs: CashBookFieldConfig[],
  savedEntries: ManualEntryPayload[],
  side: string,
): ManualRow[] {
  const rows: ManualRow[] = configs.map((f, idx) => ({
    key: `${side}-cfg-${f.fieldConfigId}-${idx}`,
    label: f.label,
    labelTa: f.labelTa,
    amount: '',
    removed: false,
  }));
  for (const entry of savedEntries) {
    const normalized = entry.label.trim().toLowerCase();
    if (normalized === '') {
      continue;
    }
    const match = rows.find((r) => !r.removed && r.label.trim().toLowerCase() === normalized);
    if (match) {
      match.amount = strAmount(entry.amount);
    } else if (!rows.some((r) => r.removed && r.label.trim().toLowerCase() === normalized)) {
      rows.push({
        key: `${side}-saved-${rows.length}-${normalized}`,
        label: entry.label.trim(),
        labelTa: null,
        amount: strAmount(entry.amount),
        removed: true,
      });
    }
  }
  return rows;
}

function sanitizeAmount(value: string): string {
  return value
    .replace(/[^0-9.]/g, '')
    .replace(/(\..*)\./g, '$1')
    .replace(/(\.\d{2})\d+/g, '$1');
}

function num(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function strAmount(value: number | null | undefined): string {
  const n = Number(value) || 0;
  return n === 0 ? '' : String(n);
}