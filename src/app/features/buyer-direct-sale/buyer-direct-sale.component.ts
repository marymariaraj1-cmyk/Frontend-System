import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { AutocompleteComponent } from '../../core/components/autocomplete/autocomplete.component';
import { ReceiptPrintButtonsComponent } from '../../core/components/receipt-print-buttons/receipt-print-buttons.component';
import { DataTableComponent, DataTableColumn } from '../../core/components/data-table/data-table.component';
import { SalesMasterData } from '../../core/models/sales';
import { I18nPipe } from '../../core/pipes/i18n.pipe';
import { I18nService } from '../../core/services/i18n.service';
import { ReceiptFormat, ReceiptService } from '../../core/services/receipt.service';
import { SalesService } from '../../core/services/sales.service';
import { ToastService } from '../../core/services/toast.service';
import { formatCurrency, formatTotalWithPrecision, maxDecimalPlaces } from '../../core/utils/currency-format.util';
import { formatDate } from '../../core/utils/date.util';
import { extractErrorMessage } from '../../core/utils/http-error.util';
import { roundOff } from '../../core/utils/round-off.util';
import { formatApiDate, isDecimal } from '../../core/utils/sales.util';

interface DirectRow {
  bag: string;
  flowerType: string;
  qty: string;
  rate: string;
  amount: string;
  flowerInvalid: boolean;
}

@Component({
  selector: 'app-buyer-direct-sale',
  standalone: true,
  imports: [FormsModule, I18nPipe, AutocompleteComponent, ReceiptPrintButtonsComponent, DataTableComponent],
  templateUrl: './buyer-direct-sale.html',
  styleUrl: './buyer-direct-sale.css',
})
export class BuyerDirectSaleComponent implements OnInit {
  private readonly salesService = inject(SalesService);
  private readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);
  private readonly receipt = inject(ReceiptService);

  protected readonly formatCurrency = formatCurrency;

  protected readonly master = signal<SalesMasterData>({ farmers: [], flowers: [], buyers: [] });
  protected readonly buyerName = signal('');
  protected readonly buyerInvalid = signal(false);
  protected readonly salesDate = signal(formatApiDate(new Date()));
  protected readonly rows = signal<DirectRow[]>([]);
  protected readonly saving = signal(false);

  protected readonly totals = computed(() => {
    let bag = 0;
    let qty = 0;
    let amount = 0;
    const qtyValues: string[] = [];
    const amountValues: string[] = [];
    for (const row of this.rows()) {
      const b = parseInt(row.bag, 10);
      if (!Number.isNaN(b)) {
        bag += b;
      }
      const q = parseFloat(row.qty);
      if (!Number.isNaN(q)) {
        qty += q;
        qtyValues.push(row.qty);
      }
      const a = parseFloat(row.amount);
      if (!Number.isNaN(a)) {
        amount += a;
        amountValues.push(row.amount);
      }
    }
    return {
      bag: String(bag),
      qty: formatTotalWithPrecision(qty, maxDecimalPlaces(qtyValues)),
      amount: formatTotalWithPrecision(amount, maxDecimalPlaces(amountValues)),
      amountValue: amount,
    };
  });

  protected readonly columns: DataTableColumn[] = [
    { key: 'sno', header: 'flower.sno', icon: 'format_list_numbered', type: 'text', align: 'center', width: '56px', className: 'col-center', sortable: false, filterable: false },
    { key: 'bag', header: 'sales.bag', icon: 'shopping_basket', type: 'text', align: 'right', width: '90px', className: 'col-num', sortable: false, filterable: false },
    { key: 'flowerType', header: 'flower.name', icon: 'local_florist', type: 'text', width: '26%', className: 'col-text col-name', sortable: false, filterable: false },
    { key: 'qty', header: 'sales.qty', icon: 'weight', type: 'text', align: 'right', width: '100px', className: 'col-num', sortable: false, filterable: false },
    { key: 'rate', header: 'sales.rate', icon: 'payments', type: 'text', align: 'right', width: '100px', className: 'col-num', sortable: false, filterable: false },
    { key: 'amount', header: 'sales.amount', icon: 'currency_rupee', type: 'text', align: 'right', width: '110px', className: 'col-num', sortable: false, filterable: false },
    { key: 'actions', header: 'flower.actions', icon: 'more_horiz', type: 'text', align: 'center', width: '110px', className: 'col-center col-actions', sortable: false, filterable: false },
  ];

  constructor() {
    this.rows.set([this.emptyRow()]);
  }

  ngOnInit(): void {
    this.loadMasterData();
  }

  private loadMasterData(): void {
    this.salesService.getMasterData().subscribe({
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

  protected validateBuyer(): void {
    const value = this.buyerName().trim();
    if (value !== '') {
      this.buyerInvalid.set(!this.matchesMaster(value, this.master().buyers));
    }
  }

  protected validateFlower(index: number): void {
    const value = this.rows()[index].flowerType;
    if (value.trim() !== '') {
      this.updateRow(index, { flowerInvalid: !this.matchesMaster(value, this.master().flowers) });
    }
  }

  private matchesMaster(value: string, list: string[]): boolean {
    const lower = value.trim().toLowerCase();
    return list.some((item) => item.toLowerCase() === lower);
  }

  protected updateRow(index: number, patch: Partial<DirectRow>): void {
    this.rows.update((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  protected addRow(): void {
    this.rows.update((rows) => [...rows, this.emptyRow()]);
  }

  protected addRowBelow(index: number): void {
    this.rows.update((rows) => {
      const next = [...rows];
      next.splice(index + 1, 0, this.emptyRow());
      return next;
    });
  }

  protected removeRow(index: number): void {
    if (this.rows().length <= 1) {
      return;
    }
    this.rows.update((rows) => rows.filter((_, i) => i !== index));
  }

  private emptyRow(): DirectRow {
    return { bag: '', flowerType: '', qty: '', rate: '', amount: '', flowerInvalid: false };
  }

  protected onDecimalKeydown(event: KeyboardEvent): void {
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }
    const key = event.key;
    if (
      key.length !== 1 ||
      key === 'Backspace' || key === 'Delete' || key === 'Tab' || key === 'Enter' ||
      key === 'Escape' || key === 'ArrowLeft' || key === 'ArrowRight' || key === 'ArrowUp' ||
      key === 'ArrowDown' || key === 'Home' || key === 'End'
    ) {
      return;
    }
    if (key === '.') {
      if ((event.target as HTMLInputElement).value.includes('.')) {
        event.preventDefault();
      }
      return;
    }
    if (!/[0-9]/.test(key)) {
      event.preventDefault();
    }
  }

  protected sanitizeDecimal(value: string): string {
    const cleaned = value.replace(/[^0-9.]/g, '');
    const firstDot = cleaned.indexOf('.');
    if (firstDot === -1) {
      return cleaned;
    }
    return cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, '');
  }

  protected sanitizeBag(value: string): string {
    return (value ?? '').replace(/[^0-9]/g, '');
  }

  protected onQtyChange(index: number): void {
    const row = this.rows()[index];
    if (row.qty.trim() === '') {
      return;
    }
    if (row.rate.trim() !== '' && isDecimal(row.rate)) {
      this.recalcAmount(index);
    } else if (row.amount.trim() !== '' && isDecimal(row.amount)) {
      this.recalcRate(index);
    }
  }

  protected recalcAmount(index: number): void {
    const row = this.rows()[index];
    if (row.qty.trim() === '' || row.rate.trim() === '') {
      return;
    }
    const qty = parseFloat(row.qty);
    const rate = parseFloat(row.rate);
    if (!Number.isNaN(qty) && !Number.isNaN(rate)) {
      this.updateRow(index, { amount: String(roundOff(qty * rate)) });
    }
  }

  protected recalcRate(index: number): void {
    const row = this.rows()[index];
    if (row.qty.trim() === '' || row.amount.trim() === '') {
      return;
    }
    const qty = parseFloat(row.qty);
    const amount = parseFloat(row.amount);
    if (!Number.isNaN(qty) && !Number.isNaN(amount) && qty !== 0) {
      this.updateRow(index, { rate: String(roundOff(amount / qty)) });
    }
  }

  protected onAmountInput(index: number): void {
    const row = this.rows()[index];
    if (row.qty.trim() !== '' && row.amount.trim() !== '') {
      this.recalcRate(index);
    }
  }

  protected onAmountEnter(index: number): void {
    if (index === this.rows().length - 1) {
      this.addRow();
    }
  }

  protected save(): void {
    if (this.saving()) {
      return;
    }
    const buyer = this.buyerName().trim();
    if (!buyer) {
      this.buyerInvalid.set(true);
      this.toast.error(this.i18n.translate('sales.error.buyer.required'));
      return;
    }
    if (!this.matchesMaster(buyer, this.master().buyers)) {
      this.buyerInvalid.set(true);
      this.toast.error(this.i18n.translate('sales.error.buyer.notfound'));
      return;
    }
    if (!this.salesDate()) {
      this.toast.error(this.i18n.translate('fls.error.date.required'));
      return;
    }

    const rows = this.rows();
    const filled = rows.filter((row) => this.rowFilled(row));
    if (filled.length === 0) {
      this.toast.error(this.i18n.translate('direct.error.no.rows'));
      return;
    }

    const lines = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!this.rowFilled(row)) {
        continue;
      }
      const flower = row.flowerType.trim();
      const qty = row.qty.trim();
      const rate = row.rate.trim();
      const amount = row.amount.trim();
      if (!flower || !qty || !rate || !amount || !isDecimal(qty) || !isDecimal(rate) || !isDecimal(amount)) {
        this.toast.error(this.i18n.translate('direct.error.incomplete.row', i + 1));
        return;
      }
      if (!this.matchesMaster(flower, this.master().flowers)) {
        this.toast.error(this.i18n.translate('sales.error.flower.notfound'));
        return;
      }
      if (parseFloat(amount) <= 0) {
        this.toast.error(this.i18n.translate('sales.error.amount.positive.row', i + 1));
        return;
      }
      lines.push({
        flowerType: flower,
        bagCount: row.bag.trim() || undefined,
        totalWeight: qty,
        rate,
        amount,
      });
    }

    this.saving.set(true);
    this.salesService
      .saveBuyerDirect({
        buyerName: buyer,
        salesDate: this.salesDate(),
        rows: lines,
      })
      .subscribe({
        next: (response) => {
          this.saving.set(false);
          if (response.success) {
            this.toast.success(response.message);
            this.rows.set([this.emptyRow()]);
            this.buyerName.set('');
            this.buyerInvalid.set(false);
          } else {
            this.toast.error(response.message);
          }
        },
        error: (error) => {
          this.saving.set(false);
          this.toast.error(extractErrorMessage(error, this.i18n.translate('direct.error.save.failed')));
        },
      });
  }

  protected async printReport(format: ReceiptFormat): Promise<void> {
    const t = this.i18n.translate.bind(this.i18n);
    const buyer = this.buyerName().trim();
    if (!buyer) {
      this.toast.error(this.i18n.translate('direct.error.enter.details.print'));
      return;
    }
    const filled = this.rows().filter((row) => this.rowFilled(row));
    if (filled.length === 0) {
      this.toast.error(this.i18n.translate('fls.error.no.rows.print'));
      return;
    }

    let rowsHtml = '';
    filled.forEach((row, i) => {
      rowsHtml +=
        '<tr>' +
        '<td class="left">' + (i + 1) + '</td>' +
        '<td class="left">' + (row.bag || '-') + '</td>' +
        '<td class="left">' + (row.flowerType || '-') + '</td>' +
        '<td class="right">' + (row.qty || '-') + '</td>' +
        '<td class="right">' + (row.rate || '-') + '</td>' +
        '<td class="right">' + (row.amount || '-') + '</td>' +
        '</tr>';
    });

    const content =
      '<div class="print-info">' +
      '<span><strong>' + t('fls.buyer.name') + '</strong> ' + buyer + '</span>' +
      '<span><strong>' + t('report.date') + '</strong> ' + formatDate(this.salesDate()) + '</span>' +
      '</div>' +
      '<table>' +
      '<colgroup><col style="width:8%"><col style="width:10%"><col style="width:30%"><col style="width:13%"><col style="width:15%"><col style="width:24%"></colgroup>' +
      '<thead><tr>' +
      '<th class="left">#</th>' +
      '<th class="left">' + t('sales.bag') + '</th>' +
      '<th class="left">' + t('flower.name') + '</th>' +
      '<th class="right">' + t('sales.qty') + '</th>' +
      '<th class="right">' + t('sales.rate') + '</th>' +
      '<th class="right">' + t('sales.amount') + '</th>' +
      '</tr></thead><tbody>' + rowsHtml + '</tbody></table>' +
      '<div class="print-info"><span><strong>' + t('direct.total') + '</strong> ' + this.totals().amount + '</span></div>';

    const result = await this.receipt.output(content, {
      title: t('direct.title'),
      fileBase: 'buyer-direct-sale-receipt',
      format,
    });
    if (result.status !== 'ok') {
      this.toast.error(result.message);
    }
  }

  private rowFilled(row: DirectRow): boolean {
    return !!(
      row.flowerType.trim() ||
      row.bag.trim() ||
      row.qty.trim() ||
      row.rate.trim() ||
      row.amount.trim()
    );
  }
}
