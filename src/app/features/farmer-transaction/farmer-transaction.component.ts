import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { AutocompleteComponent } from '../../core/components/autocomplete/autocomplete.component';
import { DataTableComponent, DataTableColumn } from '../../core/components/data-table/data-table.component';
import { DraggableDirective } from '../../core/directives/draggable.directive';
import { FarmerMasterData, FarmerTransaction } from '../../core/models/transaction';
import { I18nPipe } from '../../core/pipes/i18n.pipe';
import { DateFormatPipe } from '../../core/pipes/date-format.pipe';
import { FarmerTransactionService } from '../../core/services/farmer-transaction.service';
import { I18nService } from '../../core/services/i18n.service';
import { ToastService } from '../../core/services/toast.service';
import { formatCurrency } from '../../core/utils/currency-format.util';
import { extractErrorMessage } from '../../core/utils/http-error.util';
import { formatApiDate } from '../../core/utils/sales.util';

const AMOUNT_RE = /^\d+(\.\d{1,2})?$/;

type TabType = 'transaction' | 'history';
type PeriodType = 'daily' | 'monthly' | 'yearly';

@Component({
  selector: 'app-farmer-transaction',
  standalone: true,
  imports: [FormsModule, I18nPipe, DateFormatPipe, AutocompleteComponent, DraggableDirective, DataTableComponent],
  templateUrl: './farmer-transaction.html',
  styleUrl: './farmer-transaction.css',
})
export class FarmerTransactionComponent implements OnInit {
  private readonly service = inject(FarmerTransactionService);
  private readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);

  protected readonly formatCurrency = formatCurrency;

  // --- Transaction tab ---
  protected readonly master = signal<FarmerMasterData>({ farmers: [] });
  protected readonly farmer = signal('');
  protected readonly farmerInvalid = signal(false);
  protected readonly txnDate = signal(formatApiDate(new Date()));
  protected readonly excessDebit = signal('');
  protected readonly debit = signal('');
  protected readonly paymentMode = signal('C');
  protected readonly saving = signal(false);

  // --- History tab ---
  protected readonly activeTab = signal<TabType>('transaction');
  protected readonly histFarmer = signal('');
  protected readonly histFarmerInvalid = signal(false);
  protected readonly period = signal<PeriodType>('daily');
  protected readonly fromDate = signal(formatApiDate(this.daysAgo(7)));
  protected readonly toDate = signal(formatApiDate(new Date()));
  protected readonly histMonth = signal(this.currentMonthStr());
  protected readonly histYear = signal(String(new Date().getFullYear()));
  protected readonly transactions = signal<FarmerTransaction[]>([]);
  protected readonly loading = signal(false);
  protected readonly searched = signal(false);

  // --- History tab: edit / delete ---
  protected readonly editTarget = signal<FarmerTransaction | null>(null);
  protected readonly editExcess = signal('');
  protected readonly editDebit = signal('');
  protected readonly editMode = signal<'C' | 'U'>('C');
  protected readonly updating = signal(false);
  protected readonly deleteTarget = signal<FarmerTransaction | null>(null);
  protected readonly deleting = signal(false);

  protected readonly historyColumns: DataTableColumn[] = [
    {
      key: 'sno',
      header: 'txn.sno',
      type: 'text',
      align: 'center',
      width: '50px',
      sortable: false,
      filterable: false,
    },
    {
      key: 'transactionDate',
      header: 'txn.date',
      type: 'date',
      width: '130px',
    },
    {
      key: 'excessDebitAmt',
      header: 'farmer.txn.excess.debit',
      type: 'currency',
      className: 'ob-amount-col',
      width: '190px',
    },
    {
      key: 'debAmt',
      header: 'farmer.txn.debit',
      type: 'currency',
      className: 'ob-amount-col',
      width: '142px',
    },
    {
      key: 'paymentMode',
      header: 'txn.payment.mode.col',
      type: 'text',
      width: '110px',
      sortable: false,
      filterType: 'select',
      options: [
        { value: 'C', label: 'txn.payment.cash' },
        { value: 'U', label: 'txn.payment.upi' },
      ],
    },
    {
      key: 'actions',
      header: 'flower.actions',
      icon: 'more_horiz',
      type: 'text',
      align: 'center',
      width: '100px',
      sortable: false,
      filterable: false,
    },
  ];

  ngOnInit(): void {
    this.loadMasterData();
  }

  private loadMasterData(): void {
    this.service.getMasterData().subscribe({
      next: (response) => {
        if (response.success) {
          this.master.set(response.data);
        } else {
          this.toast.error(response.message);
        }
      },
      error: (error) =>
        this.toast.error(extractErrorMessage(error, this.i18n.translate('common.load.failed'))),
    });
  }

  // ---- Transaction tab ----

  protected validateFarmer(): void {
    const value = this.farmer().trim();
    if (value === '') {
      this.farmerInvalid.set(false);
      return;
    }
    this.farmerInvalid.set(!this.matchesMaster(value, this.master().farmers));
  }

  protected sanitizeExcessDebit(value: string): void {
    this.excessDebit.set(this.sanitizeAmount(value));
  }

  protected sanitizeDebit(value: string): void {
    this.debit.set(this.sanitizeAmount(value));
  }

  protected clearForm(): void {
    this.farmer.set('');
    this.farmerInvalid.set(false);
    this.txnDate.set(formatApiDate(new Date()));
    this.excessDebit.set('');
    this.debit.set('');
    this.paymentMode.set('C');
  }

  protected save(): void {
    if (this.saving()) {
      return;
    }
    const farmer = this.farmer().trim();
    const excessDebit = this.excessDebit();
    const debit = this.debit();

    if (!farmer) {
      this.toast.error(this.i18n.translate('txn.error.farmer.required'));
      this.farmerInvalid.set(true);
      return;
    }
    if (!this.matchesMaster(farmer, this.master().farmers)) {
      this.toast.error(this.i18n.translate('txn.error.farmer.notfound'));
      this.farmerInvalid.set(true);
      return;
    }
    if (!this.txnDate()) {
      this.toast.error(this.i18n.translate('txn.error.date.required'));
      return;
    }
    if (excessDebit && !AMOUNT_RE.test(excessDebit)) {
      this.toast.error(this.i18n.translate('txn.error.amount.invalid'));
      return;
    }
    if (debit && !AMOUNT_RE.test(debit)) {
      this.toast.error(this.i18n.translate('txn.error.amount.invalid'));
      return;
    }
    if (!excessDebit && !debit) {
      this.toast.error(this.i18n.translate('txn.error.excess.debit.or.debit.required'));
      return;
    }

    this.saving.set(true);
    this.service
      .save({
        farmerName: farmer,
        transactionDate: this.txnDate(),
        excessDebitAmt: excessDebit,
        debitAmt: debit,
        paymentMode: this.paymentMode(),
      })
      .subscribe({
        next: (response) => {
          this.saving.set(false);
          if (response.success) {
            this.toast.success(response.message);
            this.clearForm();
          } else {
            this.toast.error(response.message);
          }
        },
        error: (error) => {
          this.saving.set(false);
          this.toast.error(extractErrorMessage(error, this.i18n.translate('common.save.failed')));
        },
      });
  }

  // ---- History tab ----

  protected switchTab(tab: TabType): void {
    this.activeTab.set(tab);
  }

  protected onPeriodChange(period: PeriodType): void {
    this.period.set(period);
    this.transactions.set([]);
    this.searched.set(false);
    const now = new Date();
    if (period === 'daily') {
      this.fromDate.set(formatApiDate(this.daysAgo(7)));
      this.toDate.set(formatApiDate(now));
    } else if (period === 'monthly') {
      this.histMonth.set(this.currentMonthStr());
    } else {
      this.histYear.set(String(now.getFullYear()));
    }
  }

  protected validateHistFarmer(): void {
    const value = this.histFarmer().trim();
    if (value === '') {
      this.histFarmerInvalid.set(false);
      return;
    }
    this.histFarmerInvalid.set(!this.matchesMaster(value, this.master().farmers));
  }

  protected searchHistory(): void {
    if (this.loading()) {
      return;
    }
    const farmer = this.histFarmer().trim();
    if (!farmer) {
      this.toast.error(this.i18n.translate('txn.error.farmer.required'));
      this.histFarmerInvalid.set(true);
      return;
    }
    if (!this.matchesMaster(farmer, this.master().farmers)) {
      this.toast.error(this.i18n.translate('txn.error.farmer.notfound'));
      this.histFarmerInvalid.set(true);
      return;
    }

    const { fromDate, toDate } = this.computeDateRange();
    if (!fromDate || !toDate) {
      this.toast.error(this.i18n.translate('txn.error.dates.required'));
      return;
    }

    this.loading.set(true);
    this.service.getHistory(farmer, fromDate, toDate).subscribe({
      next: (response) => {
        this.loading.set(false);
        this.searched.set(true);
        if (response.success) {
          this.transactions.set(response.data);
        } else {
          this.transactions.set([]);
          this.toast.error(response.message);
        }
      },
      error: (error) => {
        this.loading.set(false);
        this.searched.set(true);
        this.transactions.set([]);
        this.toast.error(extractErrorMessage(error, this.i18n.translate('common.load.failed')));
      },
    });
  }

  private computeDateRange(): { fromDate: string; toDate: string } {
    const p = this.period();
    if (p === 'daily') {
      return { fromDate: this.fromDate(), toDate: this.toDate() };
    }
    if (p === 'monthly') {
      const [year, month] = this.histMonth().split('-').map(Number);
      const first = new Date(year, month - 1, 1);
      const last = new Date(year, month, 0);
      return { fromDate: formatApiDate(first), toDate: formatApiDate(last) };
    }
    const year = Number(this.histYear());
    return { fromDate: formatApiDate(new Date(year, 0, 1)), toDate: formatApiDate(new Date(year, 11, 31)) };
  }

  // ---- Shared ----

  private matchesMaster(value: string, list: string[]): boolean {
    const lower = value.trim().toLowerCase();
    return list.some((item) => item.toLowerCase() === lower);
  }

  private sanitizeAmount(value: string): string {
    return value
      .replace(/[^0-9.]/g, '')
      .replace(/(\..*)\./g, '$1')
      .replace(/(\.\d{2})\d+/g, '$1');
  }

  private daysAgo(days: number): Date {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date;
  }

  private currentMonthStr(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  protected yearOptions(): number[] {
    const currentYear = new Date().getFullYear();
    const years: number[] = [];
    for (let y = currentYear; y >= currentYear - 5; y--) {
      years.push(y);
    }
    return years;
  }

  protected historyTotalExcess(rows: FarmerTransaction[]): number {
    return rows.reduce((sum, t) => sum + (Number(t.excessDebitAmt) || 0), 0);
  }

  protected historyTotalDebit(rows: FarmerTransaction[]): number {
    return rows.reduce((sum, t) => sum + (Number(t.debAmt) || 0), 0);
  }

  // ---- History tab: edit / delete ----

  protected openEdit(txn: FarmerTransaction): void {
    this.editTarget.set(txn);
    this.editExcess.set(txn.excessDebitAmt ? String(txn.excessDebitAmt) : '');
    this.editDebit.set(txn.debAmt ? String(txn.debAmt) : '');
    this.editMode.set(txn.paymentMode === 'U' ? 'U' : 'C');
  }

  protected sanitizeEditExcess(value: string): void {
    this.editExcess.set(this.sanitizeAmount(value));
  }

  protected sanitizeEditDebit(value: string): void {
    this.editDebit.set(this.sanitizeAmount(value));
  }

  protected closeEdit(): void {
    this.editTarget.set(null);
  }

  protected onEditOverlayClick(event: Event): void {
    if (event.target === event.currentTarget) {
      this.closeEdit();
    }
  }

  protected confirmUpdate(): void {
    const target = this.editTarget();
    if (!target || this.updating()) {
      return;
    }
    const excessDebit = this.editExcess();
    const debit = this.editDebit();
    if (excessDebit && !AMOUNT_RE.test(excessDebit)) {
      this.toast.error(this.i18n.translate('txn.error.amount.invalid'));
      return;
    }
    if (debit && !AMOUNT_RE.test(debit)) {
      this.toast.error(this.i18n.translate('txn.error.amount.invalid'));
      return;
    }
    if (!excessDebit && !debit) {
      this.toast.error(this.i18n.translate('txn.error.excess.debit.or.debit.required'));
      return;
    }

    this.updating.set(true);
    this.service
      .update({
        farmerTransactionId: target.farmerTransactionId,
        excessDebitAmt: excessDebit,
        debitAmt: debit,
        paymentMode: this.editMode(),
      })
      .subscribe({
        next: (response) => {
          this.updating.set(false);
          if (response.success) {
            this.closeEdit();
            this.toast.success(response.message);
            this.searchHistory();
          } else {
            this.toast.error(response.message);
          }
        },
        error: (error) => {
          this.updating.set(false);
          this.closeEdit();
          this.toast.error(extractErrorMessage(error, this.i18n.translate('common.save.failed')));
        },
      });
  }

  protected openDelete(txn: FarmerTransaction): void {
    this.deleteTarget.set(txn);
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
    const target = this.deleteTarget();
    if (!target || this.deleting()) {
      return;
    }
    this.deleting.set(true);
    this.service.remove(target.farmerTransactionId).subscribe({
      next: (response) => {
        this.deleting.set(false);
        if (response.success) {
          this.closeDelete();
          this.toast.success(response.message);
          this.searchHistory();
        } else {
          this.toast.error(response.message);
        }
      },
error: (error) => {
          this.deleting.set(false);
          this.closeDelete();
          this.toast.error(extractErrorMessage(error, this.i18n.translate('common.delete.failed')));
        },
    });
  }
}
