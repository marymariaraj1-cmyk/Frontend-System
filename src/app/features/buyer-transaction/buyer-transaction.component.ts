import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { AutocompleteComponent } from '../../core/components/autocomplete/autocomplete.component';
import { DataTableComponent, DataTableColumn } from '../../core/components/data-table/data-table.component';
import { DraggableDirective } from '../../core/directives/draggable.directive';
import { BuyerMasterData, BuyerTransaction } from '../../core/models/transaction';
import { I18nPipe } from '../../core/pipes/i18n.pipe';
import { DateFormatPipe } from '../../core/pipes/date-format.pipe';
import { BuyerTransactionService } from '../../core/services/buyer-transaction.service';
import { I18nService } from '../../core/services/i18n.service';
import { ToastService } from '../../core/services/toast.service';
import { formatCurrency } from '../../core/utils/currency-format.util';
import { extractErrorMessage } from '../../core/utils/http-error.util';
import { roundOff } from '../../core/utils/round-off.util';
import { formatApiDate } from '../../core/utils/sales.util';

const AMOUNT_RE = /^\d+(\.\d{1,2})?$/;
const PAYMENT_EXCLUDE = ['cash', 'upi', 'google pay', 'gpay', 'phonepe', 'paytm', 'online', 'card', 'neft', 'rtgs', 'imps'];

type TabType = 'transaction' | 'history';
type PeriodType = 'daily' | 'monthly' | 'yearly';

@Component({
  selector: 'app-buyer-transaction',
  standalone: true,
  imports: [FormsModule, I18nPipe, DateFormatPipe, AutocompleteComponent, DraggableDirective, DataTableComponent],
  templateUrl: './buyer-transaction.html',
  styleUrl: './buyer-transaction.css',
})
export class BuyerTransactionComponent implements OnInit {
  private readonly service = inject(BuyerTransactionService);
  private readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);

  protected readonly formatCurrency = formatCurrency;

  // --- Transaction tab ---
  protected readonly master = signal<BuyerMasterData>({ buyers: [] });
  protected readonly buyer = signal('');
  protected readonly buyerInvalid = signal(false);
  protected readonly txnDate = signal(formatApiDate(new Date()));
  protected readonly amountReceived = signal('');
  protected readonly discountAmt = signal('');
  protected readonly paymentMode = signal('C');
  protected readonly openingBalance = signal(0);
  protected readonly closingBalance = signal(0);
  protected readonly saving = signal(false);

  // --- History tab ---
  protected readonly activeTab = signal<TabType>('transaction');
  protected readonly histBuyer = signal('');
  protected readonly histBuyerInvalid = signal(false);
  protected readonly period = signal<PeriodType>('daily');
  protected readonly fromDate = signal(formatApiDate(this.daysAgo(7)));
  protected readonly toDate = signal(formatApiDate(new Date()));
  protected readonly histMonth = signal(this.currentMonthStr());
  protected readonly histYear = signal(String(new Date().getFullYear()));
  protected readonly transactions = signal<BuyerTransaction[]>([]);
  protected readonly loading = signal(false);
  protected readonly searched = signal(false);

  // --- History tab: edit / delete ---
  protected readonly editTarget = signal<BuyerTransaction | null>(null);
  protected readonly editAmount = signal('');
  protected readonly editDiscount = signal('');
  protected readonly editMode = signal<'C' | 'U'>('C');
  protected readonly updating = signal(false);
  protected readonly deleteTarget = signal<BuyerTransaction | null>(null);
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
      key: 'cashPaidAmt',
      header: 'buyer.txn.amount.received',
      type: 'currency',
      className: 'ob-amount-col',
      width: '150px',
    },
    {
      key: 'disAmt',
      header: 'buyer.txn.discount',
      type: 'currency',
      className: 'ob-amount-col',
      width: '120px',
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

  protected onBuyerSelected(value: string): void {
    this.buyer.set(value);
    this.buyerInvalid.set(false);
    this.onBuyerChange();
  }

  protected onBuyerChange(): void {
    const buyer = this.buyer().trim();
    if (buyer && this.matchesMaster(buyer, this.master().buyers)) {
      this.loadOpeningBalance(buyer);
    } else {
      this.openingBalance.set(0);
      this.recalcClosing();
    }
  }

  protected validateBuyer(): void {
    const value = this.buyer().trim();
    if (value === '') {
      this.buyerInvalid.set(false);
      return;
    }
    this.buyerInvalid.set(!this.matchesMaster(value, this.master().buyers));
  }

  private loadOpeningBalance(buyer: string): void {
    this.service.getOpeningBalance(buyer).subscribe({
      next: (response) => {
        if (response.success) {
          this.openingBalance.set(response.data.openingBalance ?? 0);
          this.recalcClosing();
        }
      },
      error: () => {
        this.openingBalance.set(0);
        this.recalcClosing();
      },
    });
  }

  protected sanitizeAmountReceived(value: string): void {
    this.amountReceived.set(this.sanitizeAmount(value));
    this.recalcClosing();
  }

  protected sanitizeDiscount(value: string): void {
    this.discountAmt.set(this.sanitizeAmount(value));
    this.recalcClosing();
  }

  protected recalcClosing(): void {
    const received = parseFloat(this.amountReceived()) || 0;
    const discount = parseFloat(this.discountAmt()) || 0;
    this.closingBalance.set(roundOff(this.openingBalance() - (received + discount)));
  }

  protected clearForm(): void {
    this.buyer.set('');
    this.buyerInvalid.set(false);
    this.amountReceived.set('');
    this.discountAmt.set('');
    this.paymentMode.set('C');
    this.openingBalance.set(0);
    this.closingBalance.set(0);
    this.txnDate.set(formatApiDate(new Date()));
  }

  protected save(): void {
    if (this.saving()) {
      return;
    }
    const buyer = this.buyer().trim();
    const amountReceived = this.amountReceived().trim();
    const discount = this.discountAmt().trim();

    if (!buyer) {
      this.toast.error(this.i18n.translate('txn.error.buyer.required'));
      this.buyerInvalid.set(true);
      return;
    }
    if (!this.matchesMaster(buyer, this.master().buyers)) {
      this.toast.error(this.i18n.translate('txn.error.buyer.notfound'));
      this.buyerInvalid.set(true);
      return;
    }
    if (!this.txnDate()) {
      this.toast.error(this.i18n.translate('txn.error.date.required'));
      return;
    }
    if (!amountReceived && !discount) {
      this.toast.error(this.i18n.translate('txn.error.amount.or.discount.required'));
      return;
    }
    if (amountReceived !== '' && !AMOUNT_RE.test(amountReceived)) {
      this.toast.error(this.i18n.translate('txn.error.amount.invalid'));
      return;
    }
    if (amountReceived !== '' && parseFloat(amountReceived) <= 0) {
      this.toast.error(this.i18n.translate('txn.error.amount.positive'));
      return;
    }
    if (discount !== '' && !AMOUNT_RE.test(discount)) {
      this.toast.error(this.i18n.translate('txn.error.amount.invalid'));
      return;
    }
    if (discount !== '' && parseFloat(discount) <= 0) {
      this.toast.error(this.i18n.translate('txn.error.amount.positive'));
      return;
    }

    this.saving.set(true);
    this.service
      .save({
        buyerName: buyer,
        transactionDate: this.txnDate(),
        amountReceived,
        discountAmt: discount,
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

  protected validateHistBuyer(): void {
    const value = this.histBuyer().trim();
    if (value === '') {
      this.histBuyerInvalid.set(false);
      return;
    }
    this.histBuyerInvalid.set(!this.matchesMaster(value, this.master().buyers));
  }

  protected searchHistory(): void {
    if (this.loading()) {
      return;
    }
    const buyer = this.histBuyer().trim();
    if (!buyer) {
      this.toast.error(this.i18n.translate('txn.error.buyer.required'));
      this.histBuyerInvalid.set(true);
      return;
    }
    if (!this.matchesMaster(buyer, this.master().buyers)) {
      this.toast.error(this.i18n.translate('txn.error.buyer.notfound'));
      this.histBuyerInvalid.set(true);
      return;
    }

    const { fromDate, toDate } = this.computeDateRange();
    if (!fromDate || !toDate) {
      this.toast.error(this.i18n.translate('txn.error.dates.required'));
      return;
    }

    this.loading.set(true);
    this.service.getHistory(buyer, fromDate, toDate).subscribe({
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
    if (PAYMENT_EXCLUDE.some((ex) => lower.indexOf(ex) !== -1)) {
      return false;
    }
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

  protected historyTotalReceived(rows: BuyerTransaction[]): number {
    return rows.reduce((sum, t) => sum + (Number(t.cashPaidAmt) || 0), 0);
  }

  protected historyTotalDiscount(rows: BuyerTransaction[]): number {
    return rows.reduce((sum, t) => sum + (Number(t.disAmt) || 0), 0);
  }

  // ---- History tab: edit / delete ----

  protected openEdit(txn: BuyerTransaction): void {
    this.editTarget.set(txn);
    this.editAmount.set(txn.cashPaidAmt ? String(txn.cashPaidAmt) : '');
    this.editDiscount.set(txn.disAmt ? String(txn.disAmt) : '');
    this.editMode.set(txn.paymentMode === 'U' ? 'U' : 'C');
  }

  protected sanitizeEditAmount(value: string): void {
    this.editAmount.set(this.sanitizeAmount(value));
  }

  protected sanitizeEditDiscount(value: string): void {
    this.editDiscount.set(this.sanitizeAmount(value));
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
    const amountReceived = this.editAmount();
    const discount = this.editDiscount();
    if (amountReceived && !AMOUNT_RE.test(amountReceived)) {
      this.toast.error(this.i18n.translate('txn.error.amount.invalid'));
      return;
    }
    if (discount && !AMOUNT_RE.test(discount)) {
      this.toast.error(this.i18n.translate('txn.error.amount.invalid'));
      return;
    }
    if (!amountReceived && !discount) {
      this.toast.error(this.i18n.translate('txn.error.amount.or.discount.required'));
      return;
    }

    this.updating.set(true);
    this.service
      .update({
        buyerTransactionId: target.buyerTransactionId,
        amountReceived,
        discountAmt: discount,
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

  protected openDelete(txn: BuyerTransaction): void {
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
    this.service.remove(target.buyerTransactionId).subscribe({
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

  protected initials(name: string | undefined): string {
    if (!name) {
      return '?';
    }
    const parts = name.trim().split(/\s+/);
    const first = parts[0]?.[0] ?? '';
    const last = parts.length > 1 ? parts[parts.length - 1][0] ?? '' : '';
    return (first + last).toUpperCase();
  }
}
