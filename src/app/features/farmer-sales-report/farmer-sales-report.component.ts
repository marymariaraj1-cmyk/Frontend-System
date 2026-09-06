import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { FarmerSalesReportItem, FarmerSalesReportRow } from '../../core/models/report';
import { DraggableDirective } from '../../core/directives/draggable.directive';
import { I18nPipe } from '../../core/pipes/i18n.pipe';
import { SalesReportService } from '../../core/services/sales-report.service';
import { I18nService } from '../../core/services/i18n.service';
import { ToastService } from '../../core/services/toast.service';
import { formatCurrency } from '../../core/utils/currency-format.util';
import { extractErrorMessage } from '../../core/utils/http-error.util';
import { openPrintWindow } from '../../core/utils/print.util';
import { formatDecimal } from '../../core/utils/round-off.util';
import { formatApiDate } from '../../core/utils/sales.util';

type ReportPeriod = 'daily' | 'monthly' | 'yearly' | 'custom';

@Component({
  selector: 'app-farmer-sales-report',
  standalone: true,
  imports: [FormsModule, DraggableDirective, I18nPipe],
  templateUrl: './farmer-sales-report.html',
  styleUrl: './farmer-sales-report.css',
})
export class FarmerSalesReportComponent {
  private readonly service = inject(SalesReportService);
  private readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);

  protected readonly formatCurrency = formatCurrency;
  protected readonly formatDecimal = formatDecimal;
  protected readonly fromDate = signal(formatApiDate(this.daysAgo(7)));
  protected readonly toDate = signal(formatApiDate(new Date()));
  protected readonly period = signal<ReportPeriod>('custom');
  protected readonly farmerSearch = signal('');
  protected readonly rows = signal<FarmerSalesReportRow[]>([]);
  protected readonly loading = signal(false);
  protected readonly searched = signal(false);

  protected readonly popupOpen = signal(false);
  protected readonly popupTitle = signal('');
  protected readonly popupFarmer = signal<FarmerSalesReportRow | null>(null);
  protected readonly popupItems = signal<FarmerSalesReportItem[]>([]);

  private applyingPeriod = false;

  protected filteredRows(): FarmerSalesReportRow[] {
    const q = this.farmerSearch().trim().toLowerCase();
    if (!q) {
      return this.rows();
    }
    return this.rows().filter((row) => (row.farmerName || '').toLowerCase().includes(q));
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

  protected totalTotal(): number {
    return this.rows().reduce((sum, row) => sum + (Number(row.total) || 0), 0);
  }

  protected totalCommission(): number {
    return this.rows().reduce((sum, row) => sum + (Number(row.commission) || 0), 0);
  }

  protected totalDebit(): number {
    return this.rows().reduce((sum, row) => sum + (Number(row.debit) || 0), 0);
  }

  protected totalNet(): number {
    return this.rows().reduce((sum, row) => sum + (Number(row.totalNetAmt) || 0), 0);
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

  protected printPopup(): void {
    const farmer = this.popupFarmer();
    if (!farmer) {
      return;
    }
    const items = farmer.items ?? [];

    const rowsHtml = items
      .map(
        (item, i) =>
          `<tr>` +
          `<td class="left">${i + 1}</td>` +
          `<td class="left">${this.escapeHtml(item.salesDate || '-')}</td>` +
          `<td class="left">${this.escapeHtml(item.flowerType || '-')}</td>` +
          `<td class="right">${this.formatDecimal(item.totalWeight)}</td>` +
          `<td class="right">${this.formatNum(item.perKgRate)}</td>` +
          `<td class="right">${this.formatNum(item.price)}</td>` +
          `</tr>`,
      )
      .join('');

    const debitBreakdown = (farmer as any)?.debitBreakdown ?? '';
    const reportHtml =
      this.printStyle('80mm auto', '76mm') +
      `<div class="print-header">` +
      `<h2>${this.escapeHtml(this.i18n.translate('farmer.sales.daily.report.detail.farmer'))}: ${this.escapeHtml(farmer.farmerName || '')}</h2>` +
      `</div>` +
      `<div class="print-info">` +
      `<span><strong>${this.escapeHtml(this.i18n.translate('txn.from.date'))}</strong> ${this.formatDateStr(this.fromDate())} &nbsp; ` +
      `<strong>${this.escapeHtml(this.i18n.translate('txn.to.date'))}</strong> ${this.formatDateStr(this.toDate())}</span>` +
      `</div>` +
      `<table>` +
      `<thead><tr>` +
      `<th class="left">#</th>` +
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
      `</table>` +
      `<div class="footer">${this.escapeHtml(this.i18n.translate('print.thankyou'))}</div>` +
      `<script>window.onload=function(){window.print();}<\/script></body></html>`;

    openPrintWindow(reportHtml, 320, 600);
  }

  private formatNum(value: number | null | undefined | string): string {
    return formatCurrency(value);
  }

  private formatDateStr(dateStr: string): string {
    if (!dateStr) {
      return '';
    }
    const parts = dateStr.split('-');
    if (parts.length !== 3) {
      return dateStr;
    }
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
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

  private printStyle(pageSize: string, bodyWidth: string): string {
    return (
      `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>` +
      `@page{size:${pageSize};margin:0;}` +
      `body{margin:0;padding:2mm 1.5mm;width:${bodyWidth};box-sizing:border-box;font-family:"Courier New",monospace;font-size:9px;line-height:1.4;color:#000;background:#fff;}` +
      `.print-header{text-align:center;border-bottom:1px dashed #000;padding-bottom:5px;margin-bottom:5px;}` +
      `.print-header h2{font-size:12px;margin:0 0 2px;font-weight:700;letter-spacing:0.5px;}` +
      `.print-header p{font-size:8px;margin:1px 0;color:#333;}` +
      `.print-info{margin-bottom:6px;font-size:8px;line-height:1.5;}` +
      `.print-info span{display:block;}` +
      `.print-info strong{font-size:8px;}` +
      `table{width:100%;border-collapse:collapse;margin:0 0 6px;font-size:8px;table-layout:fixed;}` +
      `th,td{padding:3px 2px;vertical-align:top;word-wrap:break-word;overflow-wrap:break-word;}` +
      `th{border-bottom:1.5px solid #000;font-weight:700;font-size:7.5px;text-transform:uppercase;letter-spacing:0.3px;}` +
      `th.left,td.left{text-align:left;}` +
      `th.right,td.right{text-align:right;}` +
      `tbody tr{border-bottom:0.5px dotted #ccc;}` +
      `tbody tr:last-child{border-bottom:none;}` +
      `.divider{border-top:1px dashed #000;margin:6px 0;}` +
      `.summary-table{width:100%;border-collapse:collapse;font-size:8px;margin:0 0 4px;}` +
      `.summary-table td{padding:2px 2px;border:none;}` +
      `.summary-table td.lbl{width:40%;text-align:left;}` +
      `.summary-table td.wgt{width:25%;text-align:right;}` +
      `.summary-table td.amt{width:35%;text-align:right;}` +
      `.summary-table tr.final td{font-size:10px;font-weight:700;border-top:1px solid #000;padding-top:4px;}` +
      `.footer{text-align:center;margin-top:10px;font-size:7px;border-top:1px dashed #000;padding-top:5px;letter-spacing:0.5px;}` +
      `</style></head><body>`
    );
  }

  private daysAgo(days: number): Date {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date;
  }
}
