import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { BuyerSalesReportItem, BuyerSalesReportRow } from '../../core/models/report';
import { ReceiptPrintButtonsComponent } from '../../core/components/receipt-print-buttons/receipt-print-buttons.component';
import { DataTableComponent, DataTableColumn } from '../../core/components/data-table/data-table.component';
import { DraggableDirective } from '../../core/directives/draggable.directive';
import { I18nPipe } from '../../core/pipes/i18n.pipe';
import { DateFormatPipe } from '../../core/pipes/date-format.pipe';
import { ReceiptFormat, ReceiptService } from '../../core/services/receipt.service';
import { SalesReportService } from '../../core/services/sales-report.service';
import { I18nService } from '../../core/services/i18n.service';
import { ToastService } from '../../core/services/toast.service';
import { formatCurrency } from '../../core/utils/currency-format.util';
import { formatDate } from '../../core/utils/date.util';
import { extractErrorMessage } from '../../core/utils/http-error.util';
import { formatDecimal } from '../../core/utils/round-off.util';
import { formatApiDate } from '../../core/utils/sales.util';

type ReportPeriod = 'daily' | 'monthly' | 'yearly' | 'custom';

@Component({
  selector: 'app-buyer-sales-report',
  standalone: true,
  imports: [FormsModule, DraggableDirective, I18nPipe, DateFormatPipe, ReceiptPrintButtonsComponent, DataTableComponent],
  templateUrl: './buyer-sales-report.html',
  styleUrl: './buyer-sales-report.css',
})
export class BuyerSalesReportComponent {
  private readonly service = inject(SalesReportService);
  private readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);
  private readonly receipt = inject(ReceiptService);

  protected readonly formatCurrency = formatCurrency;
  protected readonly formatDecimal = formatDecimal;
  protected readonly fromDate = signal(formatApiDate(this.daysAgo(7)));
  protected readonly toDate = signal(formatApiDate(new Date()));
  protected readonly period = signal<ReportPeriod>('custom');
  protected readonly buyerSearch = signal('');
  protected readonly rows = signal<BuyerSalesReportRow[]>([]);
  protected readonly loading = signal(false);
  protected readonly searched = signal(false);

  protected readonly gridColumns: DataTableColumn[] = [
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
      key: 'buyerName',
      header: 'buyer.sales.report.col.buyer',
      type: 'text',
    },
    {
      key: 'totalWeight',
      header: 'buyer.sales.report.col.total.weight',
      type: 'number',
      className: 'amount-col',
    },
    {
      key: 'discount',
      header: 'buyer.sales.report.col.discount',
      type: 'number',
      className: 'amount-col',
    },
    {
      key: 'totalAmount',
      header: 'buyer.sales.report.col.total.amount',
      type: 'number',
      className: 'amount-col',
    },
  ];

  protected readonly detailColumns: DataTableColumn[] = [
    {
      key: 'salesDate',
      header: 'buyer.sales.report.detail.sales.date',
      type: 'date',
    },
    {
      key: 'flowerType',
      header: 'buyer.sales.report.detail.flower.type',
      type: 'text',
    },
    {
      key: 'totalWeight',
      header: 'buyer.sales.report.detail.weight',
      type: 'number',
      className: 'amount-col',
    },
    {
      key: 'perKgRate',
      header: 'buyer.sales.report.detail.price',
      type: 'number',
      className: 'amount-col',
    },
    {
      key: 'price',
      header: 'buyer.sales.report.detail.total',
      type: 'number',
      className: 'amount-col',
    },
  ];

  protected readonly sourceRows = computed<BuyerSalesReportRow[]>(() => {
    const q = this.buyerSearch().trim().toLowerCase();
    if (!q) {
      return this.rows();
    }
    return this.rows().filter((row) => (row.buyerName || '').toLowerCase().includes(q));
  });

  protected onBuyerSearch(event: Event): void {
    this.buyerSearch.set((event.target as HTMLInputElement).value);
  }

  protected readonly popupOpen = signal(false);
  protected readonly popupTitle = signal('');
  protected readonly popupBuyer = signal<BuyerSalesReportRow | null>(null);
  protected readonly popupItems = signal<BuyerSalesReportItem[]>([]);

  private applyingPeriod = false;

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
    this.search();
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

  protected searchCustom(): void {
    this.period.set('custom');
    this.search();
  }

  protected search(): void {
    if (this.loading()) {
      return;
    }
    const fromDate = this.fromDate();
    const toDate = this.toDate();
    if (!fromDate) {
      this.toast.error(this.i18n.translate('buyer.sales.report.error.from.date.required'));
      return;
    }
    if (!toDate) {
      this.toast.error(this.i18n.translate('buyer.sales.report.error.to.date.required'));
      return;
    }
    if (fromDate > toDate) {
      this.toast.error(this.i18n.translate('buyer.sales.report.error.dates.invalid'));
      return;
    }

    this.loading.set(true);
    this.service.getBuyerSalesReport(fromDate, toDate).subscribe({
      next: (response) => {
        this.loading.set(false);
        this.searched.set(true);
        if (response.success) {
          this.rows.set(response.data);
        } else {
          this.rows.set([]);
          this.toast.error(response.message);
        }
      },
      error: (error) => {
        this.loading.set(false);
        this.searched.set(true);
        this.rows.set([]);
        this.toast.error(extractErrorMessage(error, this.i18n.translate('common.load.failed')));
      },
    });
  }

  protected totalWeight(rows: BuyerSalesReportRow[]): number {
    return rows.reduce((sum, row) => sum + (Number(row.totalWeight) || 0), 0);
  }

  protected totalDiscount(rows: BuyerSalesReportRow[]): number {
    return rows.reduce((sum, row) => sum + (Number(row.discount) || 0), 0);
  }

  protected totalAmount(rows: BuyerSalesReportRow[]): number {
    return rows.reduce((sum, row) => sum + (Number(row.totalAmount) || 0), 0);
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

  protected openPopup(buyerId: string): void {
    const buyer = this.rows().find((row) => row.buyerId === buyerId);
    if (!buyer) {
      return;
    }
    this.popupBuyer.set(buyer);
    this.popupItems.set(buyer.items ?? []);
    this.popupTitle.set(
      `${this.i18n.translate('buyer.sales.report.detail.buyer')}: ${buyer.buyerName || ''}`,
    );
    this.popupOpen.set(true);
  }

  protected closePopup(): void {
    this.popupOpen.set(false);
    this.popupBuyer.set(null);
    this.popupItems.set([]);
  }

  protected onOverlayClick(event: Event): void {
    if (event.target === event.currentTarget) {
      this.closePopup();
    }
  }

  protected popupTotal(): number {
    return this.popupBuyer()?.totalAmount ?? 0;
  }

  protected async printPopup(format: ReceiptFormat): Promise<void> {
    const buyer = this.popupBuyer();
    if (!buyer) {
      return;
    }
    const items = buyer.items ?? [];

    const rowsHtml = items
      .map(
        (item, i) =>
          `<tr>` +
          `<td class="left">${this.escapeHtml(item.salesDate ? formatDate(item.salesDate) : '-')}</td>` +
          `<td class="left">${this.escapeHtml(item.flowerType || '-')}</td>` +
          `<td class="right">${this.formatDecimal(item.totalWeight)}</td>` +
          `<td class="right">${this.formatNum(item.perKgRate)}</td>` +
          `<td class="right">${this.formatNum(item.price)}</td>` +
          `</tr>`,
      )
      .join('');

    const total = this.popupTotal();

    const content =
      `<div class="print-header">` +
      `<h2>${this.escapeHtml(this.i18n.translate('buyer.sales.report.detail.buyer'))}: ${this.escapeHtml(buyer.buyerName || '')}</h2>` +
      `</div>` +
      `<div class="print-info">` +
      `<span><strong>${this.escapeHtml(this.i18n.translate('txn.from.date'))}</strong> ${this.formatDateStr(this.fromDate())} &nbsp; ` +
      `<strong>${this.escapeHtml(this.i18n.translate('txn.to.date'))}</strong> ${this.formatDateStr(this.toDate())}</span>` +
      `</div>` +
      `<table>` +
      `<thead><tr>` +
      `<th class="left">${this.escapeHtml(this.i18n.translate('buyer.sales.report.detail.sales.date'))}</th>` +
      `<th class="left">${this.escapeHtml(this.i18n.translate('report.col.flower.type'))}</th>` +
      `<th class="right">${this.escapeHtml(this.i18n.translate('report.col.weight'))}</th>` +
      `<th class="right">${this.escapeHtml(this.i18n.translate('report.col.price'))}</th>` +
      `<th class="right">${this.escapeHtml(this.i18n.translate('report.col.total'))}</th>` +
      `</tr></thead><tbody>${rowsHtml}</tbody></table>` +
      `<table class="summary-table">` +
      `<tr class="final"><td class="lbl">${this.escapeHtml(this.i18n.translate('buyer.sales.report.detail.total'))}</td><td class="amt">${this.formatNum(total)}</td></tr>` +
      `</table>`;

    const result = await this.receipt.output(content, {
      title: this.i18n.translate('buyer.sales.report.detail.buyer'),
      fileBase: 'buyer-sales-report',
      format,
    });
    if (result.status !== 'ok') {
      this.toast.error(result.message);
    }
  }

  private formatNum(value: number | null | undefined | string): string {
    return formatCurrency(value);
  }

  private formatDateStr(dateStr: string): string {
    return formatDate(dateStr);
  }

  private escapeHtml(value: string | null | undefined): string {
    if (value === null || value === undefined) {
      return '';
    }
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private daysAgo(days: number): Date {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date;
  }
}
