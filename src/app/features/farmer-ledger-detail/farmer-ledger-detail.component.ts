import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';

import {
  FarmerLedgerDetailRow,
  FarmerSalesByDateData,
  FarmerSalesItem,
  FarmerSalesSummary,
} from '../../core/models/ledger';
import { I18nPipe } from '../../core/pipes/i18n.pipe';
import { DraggableDirective } from '../../core/directives/draggable.directive';
import { FarmerLedgerService } from '../../core/services/farmer-ledger.service';
import { I18nService } from '../../core/services/i18n.service';
import { ToastService } from '../../core/services/toast.service';
import { formatCurrency } from '../../core/utils/currency-format.util';
import { extractErrorMessage } from '../../core/utils/http-error.util';
import { openPrintWindow } from '../../core/utils/print.util';
import { formatDecimal } from '../../core/utils/round-off.util';

@Component({
  selector: 'app-farmer-ledger-detail',
  standalone: true,
  imports: [I18nPipe, DraggableDirective, FormsModule],
  templateUrl: './farmer-ledger-detail.html',
  styleUrl: './farmer-ledger-detail.css',
})
export class FarmerLedgerDetailComponent implements OnInit {
  private readonly service = inject(FarmerLedgerService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);

  protected readonly formatCurrency = formatCurrency;
  protected readonly formatDecimal = formatDecimal;
  protected readonly farmerId = signal('');
  protected readonly farmerName = signal('');
  protected readonly rows = signal<FarmerLedgerDetailRow[]>([]);
  protected readonly loading = signal(false);
  protected readonly loaded = signal(false);

  protected readonly popupOpen = signal(false);
  protected readonly popupLoading = signal(false);
  protected readonly popupTitle = signal('');
  protected readonly popupItems = signal<FarmerSalesItem[]>([]);
  protected readonly popupSummary = signal<FarmerSalesSummary | null>(null);
  protected readonly currentSalesDate = signal('');
  protected readonly source = signal<'ledger' | 'report'>('ledger');
  protected readonly showClosed = signal(false);

  protected readonly period = signal<'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom'>('monthly');
  protected readonly fromDate = signal(this.toDateStr(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  protected readonly toDate = signal(this.toDateStr(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)));

  private applyingPeriod = false;

  ngOnInit(): void {
    this.route.queryParams.subscribe((params) => {
      this.farmerId.set(params['farmerId'] ?? '');
      this.farmerName.set(params['farmerName'] ?? '');
      this.source.set(params['source'] === 'report' ? 'report' : 'ledger');
    });
    // Fallback to sessionStorage if coming from report view (no farmerId in queryParams)
    const stored = sessionStorage.getItem('bb_farmer_ledger');
    if (!this.farmerId() && stored) {
      try {
        const parsed = JSON.parse(stored) as { farmerId?: string; farmerName?: string };
        this.farmerId.set(parsed.farmerId ?? '');
        this.farmerName.set(parsed.farmerName ?? '');
      } catch {
        // ignore
      }
    }
    if (this.farmerId()) {
      this.loadDetail();
    }
  }

  protected isReport(): boolean {
    return this.source() === 'report';
  }

  protected toggleClosed(): void {
    this.showClosed.set(!this.showClosed());
  }

  protected displayRows(): FarmerLedgerDetailRow[] {
    if (this.isReport()) {
      return this.rows();
    }
    return this.showClosed() ? this.rows() : this.rows().filter((row) => this.isActive(row));
  }

  protected hasActiveRows(): boolean {
    return this.rows().some((row) => this.isActive(row));
  }

  protected hasInactiveRows(): boolean {
    return this.rows().some((row) => row.ledgerActive === 'N');
  }

  protected applyPeriod(p: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom'): void {
    this.applyingPeriod = true;
    this.period.set(p);
    const now = new Date();
    if (p === 'daily') {
      this.fromDate.set(this.toDateStr(now));
      this.toDate.set(this.toDateStr(now));
    } else if (p === 'weekly') {
      const mondayOffset = (now.getDay() + 6) % 7;
      const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - mondayOffset);
      const sunday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - mondayOffset + 6);
      this.fromDate.set(this.toDateStr(monday));
      this.toDate.set(this.toDateStr(sunday));
    } else if (p === 'monthly') {
      this.fromDate.set(this.toDateStr(new Date(now.getFullYear(), now.getMonth(), 1)));
      this.toDate.set(this.toDateStr(new Date(now.getFullYear(), now.getMonth() + 1, 0)));
    } else if (p === 'yearly') {
      this.fromDate.set(this.toDateStr(new Date(now.getFullYear(), 0, 1)));
      this.toDate.set(this.toDateStr(new Date(now.getFullYear(), 11, 31)));
    }
    this.applyingPeriod = false;
    this.loadDetail();
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

  protected applyCustom(): void {
    this.period.set('custom');
    this.loadDetail();
  }

  private readFromRoute(): void {
    this.route.queryParams.subscribe((params) => {
      this.farmerId.set(params['farmerId'] ?? '');
      this.farmerName.set(params['farmerName'] ?? '');
    });
  }

  protected goBack(): void {
    // Navigate based on source mode - if report, go to report; if ledger, go to list
    if (this.isReport()) {
      this.router.navigate(['/farmer-ledger-report']);
    } else {
      this.router.navigate(['/farmer-ledger-list']);
    }
  }

  protected openPopup(salesDate: string, ledgerActive?: string, creditAmt?: number): void {
    if (!this.farmerId()) {
      return;
    }
    this.currentSalesDate.set(salesDate);
    this.popupLoading.set(true);
    this.popupOpen.set(true);
    this.popupTitle.set(`${this.i18n.translate('farmer.ledger.detail.title')} - ${this.formatDateStr(salesDate)}`);
    this.service.getFarmerSalesByDate(this.farmerId(), salesDate, ledgerActive, creditAmt).subscribe({
      next: (response) => {
        this.popupLoading.set(false);
        if (response.success) {
          const data = response.data as FarmerSalesByDateData;
          this.popupItems.set(data.data ?? []);
          this.popupSummary.set(data.summary ?? null);
        } else {
          this.popupItems.set([]);
          this.popupSummary.set(null);
          this.toast.error(response.message);
        }
      },
      error: (error) => {
        this.popupLoading.set(false);
        this.popupItems.set([]);
        this.popupSummary.set(null);
        this.toast.error(extractErrorMessage(error, this.i18n.translate('common.load.failed')));
      },
    });
  }

  protected closePopup(): void {
    this.popupOpen.set(false);
    this.popupItems.set([]);
    this.popupSummary.set(null);
    this.currentSalesDate.set('');
  }

  protected onOverlayClick(event: Event): void {
    if (event.target === event.currentTarget) {
      this.closePopup();
    }
  }

  protected popupTotal(): number {
    const sTotal = this.popupItems().reduce((sum, item) => sum + (Number(item.price) || 0), 0);
    return this.popupSummary()?.total != null ? Number(this.popupSummary()!.total) : sTotal;
  }

  protected popupCommission(): number {
    const sTotal = this.popupItems().reduce((sum, item) => sum + (Number(item.price) || 0), 0);
    return this.popupSummary()?.commission != null
      ? Number(this.popupSummary()!.commission)
      : Math.round(sTotal * 0.1);
  }

  protected popupNetAmount(): number {
    const sTotal = this.popupItems().reduce((sum, item) => sum + (Number(item.price) || 0), 0);
    return this.popupSummary()?.netAmount != null
      ? Number(this.popupSummary()!.netAmount)
      : sTotal - this.popupCommission();
  }

  protected popupDebit(): number {
    return this.popupSummary()?.debit ?? 0;
  }

  protected popupFinalTotal(): number {
    return this.popupSummary()?.finalTotal != null
      ? Number(this.popupSummary()!.finalTotal)
      : this.popupNetAmount() - this.popupDebit();
  }

  protected printDetail(): void {
    const currentRows = this.rows();
    if (!currentRows || currentRows.length === 0) {
      this.toast.error(this.i18n.translate('msg.no.records'));
      return;
    }
    const report = this.isReport();

    const printRows = this.isReport() ? currentRows.filter((row) => this.isActive(row)) : this.displayRows();
    if (!printRows || printRows.length === 0) {
      this.toast.error(this.i18n.translate('msg.no.records'));
      return;
    }

    const rowsHtml = printRows
      .map((row, idx) => {
        const base =
          `<tr>` +
          `<td class="left">${idx + 1}</td>` +
          `<td class="left">${this.escapeHtml(row.salesDate)}</td>`;
        const body = report
          ? `<td class="right">${this.formatNum(row.sales)}</td>` +
            `<td class="right">${this.formatNum(row.creditAmount)}</td>`
          : `<td class="right">${this.formatNum(row.openingBalance)}</td>` +
            `<td class="right">${this.formatNum(row.sales)}</td>` +
            `<td class="right">${this.formatNum(row.creditAmount)}</td>` +
            `<td class="right">${this.formatNum(row.closingBalance)}</td>`;
        return base + body + `</tr>`;
      })
      .join('');

    const headers = report
      ? `<th class="left">#</th>` +
        `<th class="left">${this.escapeHtml(this.i18n.translate('ledger.report.col.sales.date'))}</th>` +
        `<th class="right">${this.escapeHtml(this.i18n.translate('ledger.report.col.debit.amt'))}</th>` +
        `<th class="right">${this.escapeHtml(this.i18n.translate('ledger.report.col.credit.amt'))}</th>`
      : `<th class="left">#</th>` +
        `<th class="left">${this.escapeHtml(this.i18n.translate('ledger.report.col.sales.date'))}</th>` +
        `<th class="right">${this.escapeHtml(this.i18n.translate('ledger.detail.col.opening.balance'))}</th>` +
        `<th class="right">${this.escapeHtml(this.i18n.translate('farmer.ledger.detail.col.sales'))}</th>` +
        `<th class="right">${this.escapeHtml(this.i18n.translate('farmer.ledger.detail.col.received'))}</th>` +
        `<th class="right">${this.escapeHtml(this.i18n.translate('ledger.detail.col.closing.balance'))}</th>`;

    const reportHtml =
      this.printStyle('80mm auto', '76mm') +
      `<div class="print-header">` +
      `<h2>${this.escapeHtml(this.i18n.translate('farmer.ledger.detail.title'))}</h2>` +
      `<p>${this.escapeHtml(this.farmerName() || '')}</p>` +
      `</div>` +
      `<table>` +
      `<thead><tr>${headers}</tr></thead><tbody>${rowsHtml}</tbody></table>` +
      `<div class="footer">${this.escapeHtml(this.i18n.translate('print.thankyou'))}</div>` +
      `<script>window.onload=function(){window.print();}<\/script></body></html>`;

    openPrintWindow(reportHtml, 320, 600);
  }

  protected printPopup(): void {
    const salesDate = this.currentSalesDate();
    if (!salesDate || !this.farmerId()) {
      return;
    }
    this.popupLoading.set(true);
    this.service.getFarmerSalesByDate(this.farmerId(), salesDate).subscribe({
      next: (response) => {
        this.popupLoading.set(false);
        if (response.success) {
          const data = response.data as FarmerSalesByDateData;
          this.popupSummary.set(data.summary ?? null);
          this.printSales(data.data ?? [], data.summary);
        } else {
          this.toast.error(response.message);
        }
      },
      error: (error) => {
        this.popupLoading.set(false);
        this.toast.error(extractErrorMessage(error, this.i18n.translate('common.load.failed')));
      },
    });
  }

  private printSales(items: FarmerSalesItem[], summary: FarmerSalesSummary | null): void {
    const sTotal = items.reduce((sum, item) => sum + (Number(item.price) || 0), 0);
    const fTotal = summary?.total != null ? Number(summary.total) : sTotal;
    const fCommission = summary?.commission != null ? Number(summary.commission) : Math.round(sTotal * 0.1);
    const fNet = summary?.netAmount != null ? Number(summary.netAmount) : sTotal - fCommission;
    const fDebit = summary?.debit != null ? Number(summary.debit) : 0;
    const fFinal = summary?.finalTotal != null ? Number(summary.finalTotal) : fNet - fDebit;

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

    const reportHtml =
      this.printStyle('3in auto', '3in') +
      `<div class="print-header">` +
      `<h2>${this.escapeHtml(this.i18n.translate('farmer.ledger.detail.title'))}</h2>` +
      `<p>${this.escapeHtml(this.farmerName() || '')} - ${this.escapeHtml(this.formatDateStr(this.currentSalesDate()))}</p>` +
      `</div>` +
      `<table>` +
      `<thead><tr>` +
      `<th class="left">#</th>` +
      `<th class="left">${this.escapeHtml(this.i18n.translate('buyer.sales.report.detail.sales.date'))}</th>` +
      `<th class="left">${this.escapeHtml(this.i18n.translate('report.col.flower.type'))}</th>` +
      `<th class="right">${this.escapeHtml(this.i18n.translate('report.col.weight'))}</th>` +
      `<th class="right">${this.escapeHtml(this.i18n.translate('report.col.price'))}</th>` +
      `<th class="right">${this.escapeHtml(this.i18n.translate('report.col.total'))}</th>` +
      `</tr></thead><tbody>${rowsHtml}</tbody></table>` +
      `<div class="divider"></div>` +
      `<table class="summary-table">` +
      `<tr><td class="lbl">${this.escapeHtml(this.i18n.translate('farmer.sales.daily.report.detail.total'))}</td><td class="amt">${this.formatNum(fTotal)}</td></tr>` +
      `<tr><td class="lbl">${this.escapeHtml(this.i18n.translate('farmer.sales.daily.report.detail.commission'))}</td><td class="amt">${this.formatNum(fCommission)}</td></tr>` +
      `<tr><td class="lbl">${this.escapeHtml(this.i18n.translate('farmer.sales.daily.report.detail.net.amount'))}</td><td class="amt">${this.formatNum(fNet)}</td></tr>` +
      `<tr><td class="lbl">${this.escapeHtml(this.i18n.translate('farmer.sales.daily.report.detail.debit.amount'))}</td><td class="amt">${this.formatNum(fDebit)}</td></tr>` +
      `<tr class="final"><td class="lbl">${this.escapeHtml(this.i18n.translate('farmer.sales.daily.report.detail.final.total'))}</td><td class="amt">${this.formatNum(fFinal)}</td></tr>` +
      `</table>` +
      `<div class="footer">${this.escapeHtml(this.i18n.translate('print.thankyou'))}</div>` +
      `<script>window.onload=function(){window.print();}<\/script></body></html>`;

    openPrintWindow(reportHtml, 320, 600);
  }

  private loadDetail(): void {
    if (!this.farmerId()) {
      return;
    }
    if (this.isReport()) {
      const from = this.fromDate();
      const to = this.toDate();
      if (from && to && from > to) {
        this.toast.error(this.i18n.translate('msg.invalid.date.range'));
        return;
      }
    }
    this.loading.set(true);
    const request = this.isReport()
      ? this.service.getFarmerReportDetail(this.farmerId(), this.fromDate(), this.toDate())
      : this.service.getFarmerDetail(this.farmerId());
    request.subscribe({
      next: (response) => {
        this.loading.set(false);
        this.loaded.set(true);
        if (response.success) {
          this.rows.set(response.data);
        } else {
          this.rows.set([]);
          this.toast.error(response.message);
        }
      },
      error: (error) => {
        this.loading.set(false);
        this.loaded.set(true);
        this.rows.set([]);
        this.toast.error(extractErrorMessage(error, this.i18n.translate('common.load.failed')));
      },
    });
  }

  private totalBase(): FarmerLedgerDetailRow[] {
    return this.isReport() ? this.rows().filter((row) => this.isActive(row)) : this.displayRows();
  }

  protected totalOpening(): number {
    return this.totalBase().reduce((sum, row) => sum + (Number(row.openingBalance) || 0), 0);
  }

  protected totalSales(): number {
    return this.totalBase().reduce((sum, row) => sum + (Number(row.sales) || 0), 0);
  }

  protected totalReceived(): number {
    return this.totalBase().reduce((sum, row) => sum + (Number(row.creditAmount) || 0), 0);
  }

  protected totalClosing(): number {
    return this.totalBase().reduce((sum, row) => sum + (Number(row.closingBalance) || 0), 0);
  }

  private isActive(row: FarmerLedgerDetailRow): boolean {
    return row.ledgerActive === undefined || row.ledgerActive === null || row.ledgerActive === 'Y';
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

  private toDateStr(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
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
      `.summary-table td.amt{width:60%;text-align:right;}` +
      `.summary-table tr.final td{font-size:10px;font-weight:700;border-top:1px solid #000;padding-top:4px;}` +
      `.footer{text-align:center;margin-top:10px;font-size:7px;border-top:1px dashed #000;padding-top:5px;letter-spacing:0.5px;}` +
      `</style></head><body>`
    );
  }
}
