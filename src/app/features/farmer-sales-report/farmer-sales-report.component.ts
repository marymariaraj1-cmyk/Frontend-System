import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { FarmerSalesReportItem, FarmerSalesReportRow } from '../../core/models/report';
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
  selector: 'app-farmer-sales-report',
  standalone: true,
  imports: [FormsModule, DraggableDirective, I18nPipe, DateFormatPipe, ReceiptPrintButtonsComponent, DataTableComponent],
  templateUrl: './farmer-sales-report.html',
  styleUrl: './farmer-sales-report.css',
})
export class FarmerSalesReportComponent {
  private readonly service = inject(SalesReportService);
  private readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);
  private readonly receipt = inject(ReceiptService);

  protected readonly formatCurrency = formatCurrency;
  protected readonly formatDecimal = formatDecimal;
  protected readonly fromDate = signal(formatApiDate(this.daysAgo(7)));
  protected readonly toDate = signal(formatApiDate(new Date()));
  protected readonly period = signal<ReportPeriod>('custom');
  protected readonly farmerSearch = signal('');
  protected readonly rows = signal<FarmerSalesReportRow[]>([]);
  protected readonly loading = signal(false);
  protected readonly searched = signal(false);

  protected readonly sourceRows = computed<FarmerSalesReportRow[]>(() => {
    const q = this.farmerSearch().trim().toLowerCase();
    if (!q) {
      return this.rows();
    }
    return this.rows().filter((row) => (row.farmerName || '').toLowerCase().includes(q));
  });

  protected onFarmerSearch(event: Event): void {
    this.farmerSearch.set((event.target as HTMLInputElement).value);
  }

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
      key: 'farmerName',
      header: 'farmer.sales.report.col.farmer',
      type: 'text',
    },
    {
      key: 'total',
      header: 'farmer.sales.report.col.total',
      type: 'number',
      className: 'amount-col',
    },
    {
      key: 'commission',
      header: 'farmer.sales.report.col.commission',
      type: 'number',
      className: 'amount-col',
    },
    {
      key: 'debit',
      header: 'farmer.sales.report.col.debit.amt',
      type: 'number',
      className: 'amount-col',
    },
    {
      key: 'totalNetAmt',
      header: 'farmer.sales.report.col.net.amt',
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

  protected readonly popupOpen = signal(false);
  protected readonly popupTitle = signal('');
  protected readonly popupFarmer = signal<FarmerSalesReportRow | null>(null);
  protected readonly popupItems = signal<FarmerSalesReportItem[]>([]);

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
      this.toast.error(this.i18n.translate('farmer.sales.report.error.from.date.required'));
      return;
    }
    if (!toDate) {
      this.toast.error(this.i18n.translate('farmer.sales.report.error.to.date.required'));
      return;
    }
    if (fromDate > toDate) {
      this.toast.error(this.i18n.translate('farmer.sales.report.error.dates.invalid'));
      return;
    }

    this.loading.set(true);
    this.service.getFarmerSalesReport(fromDate, toDate).subscribe({
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

  protected totalTotal(rows: FarmerSalesReportRow[]): number {
    return rows.reduce((sum, row) => sum + (Number(row.total) || 0), 0);
  }

  protected totalCommission(rows: FarmerSalesReportRow[]): number {
    return rows.reduce((sum, row) => sum + (Number(row.commission) || 0), 0);
  }

  protected totalDebit(rows: FarmerSalesReportRow[]): number {
    return rows.reduce((sum, row) => sum + (Number(row.debit) || 0), 0);
  }

  protected totalNetAmt(rows: FarmerSalesReportRow[]): number {
    return rows.reduce((sum, row) => sum + (Number(row.totalNetAmt) || 0), 0);
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

  protected openPopup(farmerId: string): void {
    const farmer = this.rows().find((row) => row.farmerId === farmerId);
    if (!farmer) {
      return;
    }
    this.popupFarmer.set(farmer);
    this.popupItems.set(farmer.items ?? []);
    this.popupTitle.set(
      `${this.i18n.translate('farmer.sales.daily.report.detail.farmer')}: ${farmer.farmerName || ''}`,
    );
    this.popupOpen.set(true);
  }

  protected closePopup(): void {
    this.popupOpen.set(false);
    this.popupFarmer.set(null);
    this.popupItems.set([]);
  }

  protected onOverlayClick(event: Event): void {
    if (event.target === event.currentTarget) {
      this.closePopup();
    }
  }

  protected popupTotal(): number {
    return this.popupFarmer()?.total ?? 0;
  }

  protected popupCommission(): number {
    return this.popupFarmer()?.commission ?? 0;
  }

  protected popupNetAmount(): number {
    return this.popupFarmer()?.netAmount ?? 0;
  }

  protected popupDebit(): number {
    return this.popupFarmer()?.debit ?? 0;
  }

  protected popupDebitBreakdown(): string {
    return (this.popupFarmer() as any)?.debitBreakdown ?? '';
  }

  protected popupFinalTotal(): number {
    return this.popupFarmer()?.finalTotal ?? 0;
  }

  protected async printPopup(format: ReceiptFormat): Promise<void> {
    const farmer = this.popupFarmer();
    if (!farmer) {
      return;
    }
    const items = farmer.items ?? [];

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

    const debitBreakdown = (farmer as any)?.debitBreakdown ?? '';
    const content =
      `<div class="print-header">` +
      `<h2>${this.escapeHtml(this.i18n.translate('farmer.sales.daily.report.detail.farmer'))}: ${this.escapeHtml(farmer.farmerName || '')}</h2>` +
      `</div>` +
      `<div class="print-info">` +
      `<span><strong>${this.escapeHtml(this.i18n.translate('txn.from.date'))}</strong> ${this.formatDateStr(this.fromDate())} &nbsp; ` +
      `<strong>${this.escapeHtml(this.i18n.translate('txn.to.date'))}</strong> ${this.formatDateStr(this.toDate())}</span>` +
      `</div>` +
      `<table>` +
      `<thead><tr>` +
      `<th class="left">${this.escapeHtml(this.i18n.translate('farmer.sales.daily.report.detail.sales.date'))}</th>` +
      `<th class="left">${this.escapeHtml(this.i18n.translate('report.col.flower.type'))}</th>` +
      `<th class="right">${this.escapeHtml(this.i18n.translate('report.col.weight'))}</th>` +
      `<th class="right">${this.escapeHtml(this.i18n.translate('report.col.price'))}</th>` +
      `<th class="right">${this.escapeHtml(this.i18n.translate('report.col.total'))}</th>` +
      `</tr></thead><tbody>${rowsHtml}</tbody></table>` +
      `<div class="divider"></div>` +
      `<table class="summary-table">` +
      `<tr><td class="lbl">${this.escapeHtml(this.i18n.translate('farmer.sales.daily.report.detail.total'))}</td><td class="wgt"></td><td class="amt">${this.formatNum(this.popupTotal())}</td></tr>` +
      `<tr><td class="lbl">${this.escapeHtml(this.i18n.translate('farmer.sales.daily.report.detail.commission'))}</td><td class="wgt"></td><td class="amt">${this.formatNum(this.popupCommission())}</td></tr>` +
      `<tr><td class="lbl">${this.escapeHtml(this.i18n.translate('farmer.sales.daily.report.detail.net.amount'))}</td><td class="wgt"></td><td class="amt">${this.formatNum(this.popupNetAmount())}</td></tr>` +
      `<tr><td class="lbl">${this.escapeHtml(this.i18n.translate('farmer.sales.daily.report.detail.debit.amount'))}${debitBreakdown ? ' (' + this.escapeHtml(debitBreakdown) + ')' : ''}</td><td class="wgt"></td><td class="amt">${this.formatNum(this.popupDebit())}</td></tr>` +
      `<tr class="final"><td class="lbl">${this.escapeHtml(this.i18n.translate('farmer.sales.daily.report.detail.final.total'))}</td><td class="wgt"></td><td class="amt">${this.formatNum(this.popupFinalTotal())}</td></tr>` +
      `</table>`;

    const result = await this.receipt.output(content, {
      title: this.i18n.translate('farmer.sales.daily.report.detail.farmer'),
      fileBase: 'farmer-sales-report',
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
