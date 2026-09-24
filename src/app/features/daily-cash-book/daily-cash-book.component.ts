import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';

import { CashBookFarmerRow, CashBookRecord } from '../../core/models/daily-cash-book';
import { I18nPipe } from '../../core/pipes/i18n.pipe';
import { DailyCashBookService } from '../../core/services/daily-cash-book.service';
import { I18nService } from '../../core/services/i18n.service';
import { ToastService } from '../../core/services/toast.service';
import { formatCurrency } from '../../core/utils/currency-format.util';
import { extractErrorMessage } from '../../core/utils/http-error.util';
import { formatApiDate } from '../../core/utils/sales.util';

@Component({
  selector: 'app-daily-cash-book',
  standalone: true,
  imports: [FormsModule, I18nPipe],
  templateUrl: './daily-cash-book.html',
  styleUrl: './daily-cash-book.css',
})
export class DailyCashBookComponent implements OnInit {
  private readonly service = inject(DailyCashBookService);
  private readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);

  protected readonly formatCurrency = formatCurrency;

  protected readonly todayStr = formatApiDate(new Date());
  protected readonly bookDate = signal(this.todayStr);

  // Manual entry fields (left: 7 expenses, right: cash in hand + opening balance)
  protected readonly rent = signal('');
  protected readonly expense = signal('');
  protected readonly chit = signal('');
  protected readonly finance = signal('');
  protected readonly note = signal('');
  protected readonly salary = signal('');
  protected readonly coin = signal('');
  protected readonly cashInHand = signal('');
  protected readonly opening = signal('');
  protected readonly remarks = signal('');

  // System-calculated blocks
  protected readonly buyerPurchaseTotal = signal(0);
  protected readonly excessCashList = signal<CashBookFarmerRow[]>([]);
  protected readonly buyerReceivedTotal = signal(0);
  protected readonly commissionTotal = signal(0);
  protected readonly installmentTotal = signal(0);
  protected readonly nonCashList = signal<CashBookFarmerRow[]>([]);
  protected readonly shopName = signal('');

  protected readonly saved = signal<CashBookRecord | null>(null);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly loaded = signal(false);

  ngOnInit(): void {
    this.load();
  }

  protected isToday(): boolean {
    return this.bookDate() === this.todayStr;
  }

  protected dateLabel(): string {
    const parts = this.bookDate().split('-');
    if (parts.length !== 3) {
      return this.bookDate();
    }
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    const dd = `${parts[2]}-${parts[1]}-${parts[0]}`;
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

  protected excessCashTotal(): number {
    return this.excessCashList().reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
  }

  protected leftTotal(): number {
    return (
      this.num(this.rent()) +
      this.num(this.expense()) +
      this.num(this.chit()) +
      this.num(this.finance()) +
      this.num(this.note()) +
      this.num(this.salary()) +
      this.num(this.coin()) +
      (Number(this.buyerPurchaseTotal()) || 0) +
      this.excessCashTotal()
    );
  }

  protected rightTotal(): number {
    return (
      this.num(this.cashInHand()) +
      this.num(this.opening()) +
      (Number(this.buyerReceivedTotal()) || 0) +
      (Number(this.commissionTotal()) || 0) +
      (Number(this.installmentTotal()) || 0)
    );
  }

  protected remaining(): number {
    return this.leftTotal() - this.rightTotal();
  }

  protected sanitize(field: 'rent' | 'expense' | 'chit' | 'finance' | 'note' | 'salary' | 'coin' | 'cashInHand' | 'opening'): void {
    const current: Record<string, ReturnType<typeof signal<string>>> = {
      rent: this.rent,
      expense: this.expense,
      chit: this.chit,
      finance: this.finance,
      note: this.note,
      salary: this.salary,
      coin: this.coin,
      cashInHand: this.cashInHand,
      opening: this.opening,
    };
    const target = current[field];
    target.set(
      target()
        .replace(/[^0-9.]/g, '')
        .replace(/(\..*)\./g, '$1')
        .replace(/(\.\d{2})\d+/g, '$1'),
    );
  }

  protected save(): void {
    if (this.saving() || !this.isToday()) {
      return;
    }
    this.saving.set(true);
    this.service
      .save({
        bookDate: this.bookDate(),
        rentAmt: this.num(this.rent()),
        expenseAmt: this.num(this.expense()),
        chitAmt: this.num(this.chit()),
        financeAmt: this.num(this.finance()),
        noteAmt: this.num(this.note()),
        salaryAmt: this.num(this.salary()),
        coinAmt: this.num(this.coin()),
        cashInHandAmt: this.num(this.cashInHand()),
        openingBalance: this.num(this.opening()),
        remarks: this.remarks().trim(),
      })
      .subscribe({
        next: (response) => {
          this.saving.set(false);
          if (response.success && response.data) {
            this.applySaved(response.data);
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

  private load(): void {
    const date = this.bookDate();
    this.loading.set(true);
    this.loaded.set(false);
    if (this.isToday()) {
      forkJoin({ blocks: this.service.compute(date), saved: this.service.load(date) }).subscribe({
        next: ({ blocks, saved }) => {
          this.loading.set(false);
          this.loaded.set(true);
          if (blocks.success && blocks.data) {
            this.applyBlocks(
              blocks.data.buyerPurchaseTotal,
              blocks.data.farmerExcessDebitCashList ?? [],
              blocks.data.buyerReceivedTotal,
              blocks.data.commissionTotal,
              blocks.data.installmentTotal,
              blocks.data.farmerExcessDebitNonCashList ?? [],
              blocks.data.shopName ?? '',
            );
          }
          if (saved.success && saved.data) {
            this.applySaved(saved.data);
          } else {
            this.saved.set(null);
            this.clearManual();
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
      this.service.load(date).subscribe({
        next: (response) => {
          this.loading.set(false);
          this.loaded.set(true);
          if (response.success && response.data) {
            this.applySaved(response.data);
          } else {
            this.saved.set(null);
            this.clearManual();
            this.applyBlocks(0, [], 0, 0, 0, [], '');
            if (!response.success) {
              this.toast.error(response.message);
            }
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
    shopName: string | null,
  ): void {
    this.buyerPurchaseTotal.set(Number(buyerPurchaseTotal) || 0);
    this.excessCashList.set(cashList);
    this.buyerReceivedTotal.set(Number(buyerReceivedTotal) || 0);
    this.commissionTotal.set(Number(commissionTotal) || 0);
    this.installmentTotal.set(Number(installmentTotal) || 0);
    this.nonCashList.set(nonCashList);
    if (shopName) {
      this.shopName.set(shopName);
    }
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
      record.shopName ?? '',
    );
    this.rent.set(this.str(record.rentAmt));
    this.expense.set(this.str(record.expenseAmt));
    this.chit.set(this.str(record.chitAmt));
    this.finance.set(this.str(record.financeAmt));
    this.note.set(this.str(record.noteAmt));
    this.salary.set(this.str(record.salaryAmt));
    this.coin.set(this.str(record.coinAmt));
    this.cashInHand.set(this.str(record.cashInHandAmt));
    this.opening.set(this.str(record.openingBalance));
    this.remarks.set(record.remarks ?? '');
  }

  private clearManual(): void {
    this.rent.set('');
    this.expense.set('');
    this.chit.set('');
    this.finance.set('');
    this.note.set('');
    this.salary.set('');
    this.coin.set('');
    this.cashInHand.set('');
    this.opening.set('');
    this.remarks.set('');
  }

  private num(value: string): number {
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }

  private str(value: number | null | undefined): string {
    const n = Number(value) || 0;
    return n === 0 ? '' : String(n);
  }
}
