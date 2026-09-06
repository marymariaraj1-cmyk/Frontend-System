import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';

import { BuyerLedgerDetailRow, BuyerSalesItem } from '../../core/models/ledger';
import { DraggableDirective } from '../../core/directives/draggable.directive';
import { I18nPipe } from '../../core/pipes/i18n.pipe';
import { BuyerLedgerService } from '../../core/services/buyer-ledger.service';
import { I18nService } from '../../core/services/i18n.service';
import { ToastService } from '../../core/services/toast.service';
import { formatCurrency } from '../../core/utils/currency-format.util';
import { extractErrorMessage } from '../../core/utils/http-error.util';
import { openPrintWindow } from '../../core/utils/print.util';
import { formatDecimal } from '../../core/utils/round-off.util';

@Component({
  selector: 'app-buyer-ledger-detail',
  standalone: true,
  imports: [I18nPipe, DraggableDirective, FormsModule],
  templateUrl: './buyer-ledger-detail.html',
  styleUrl: './buyer-ledger-detail.css',
})
export class BuyerLedgerDetailComponent implements OnInit {
  private readonly service = inject(BuyerLedgerService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);

  protected readonly formatCurrency = formatCurrency;
  protected readonly formatDecimal = formatDecimal;
  protected readonly buyerId = signal('');
  protected readonly buyerName = signal('');
  protected readonly rows = signal<BuyerLedgerDetailRow[]>([]);
  protected readonly loading = signal(false);
  protected readonly loaded = signal(false);

  protected readonly popupOpen = signal(false);
  protected readonly popupLoading = signal(false);
  protected readonly popupTitle = signal('');
  protected readonly popupItems = signal<BuyerSalesItem[]>([]);
  protected readonly currentSalesDate = signal('');
  protected readonly source = signal<'ledger' | 'report'>('ledger');
  protected readonly showClosed = signal(false);

  protected readonly period = signal<'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom'>('monthly');
  protected readonly fromDate = signal(this.toDateStr(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  protected readonly toDate = signal(this.toDateStr(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)));

  private applyingPeriod = false;

  ngOnInit(): void {
    this.route.queryParams.subscribe((params) => {
      this.buyerId.set(params['buyerId'] ?? '');
      this.buyerName.set(params['buyerName'] ?? '');
      this.source.set(params['source'] === 'report' ? 'report' : 'ledger');
    });
    // Fallback to sessionStorage if coming from report view (no buyerId in queryParams)
    const stored = sessionStorage.getItem('bb_buyer_ledger');
    if (!this.buyerId() && stored) {
      try {
        const parsed = JSON.parse(stored) as { buyerId?: string; buyerName?: string };
        this.buyerId.set(parsed.buyerId ?? '');
        this.buyerName.set(parsed.buyerName ?? '');
      } catch {
        // ignore
      }
    }
    if (this.buyerId()) {
      this.loadDetail();
    }
  }

  protected isReport(): boolean {
    return this.source() === 'report';
  }

  protected toggleClosed(): void {
    this.showClosed.set(!this.showClosed());
  }

  protected displayRows(): BuyerLedgerDetailRow[] {
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
      this.buyerId.set(params['buyerId'] ?? '');
      this.buyerName.set(params['buyerName'] ?? '');
    });
  }

  protected goBack(): void {
    // Navigate based on source mode - if report, go to report; if ledger, go to list
    if (this.isReport()) {
      this.router.navigate(['/buyer-ledger-report']);
    } else {
      this.router.navigate(['/buyer-ledger-list']);
    }
  }

  protected openPopup(salesDate: string, ledgerActive?: string): void {
    if (!this.buyerId()) {
      return;
    }
    this.currentSalesDate.set(salesDate);
    this.popupLoading.set(true);
    this.popupOpen.set(true);
    this.popupTitle.set(
      `${this.i18n.translate('buyer.ledger.detail.title')} - ${this.formatDateStr(salesDate)}`,
    );
    this.service.getBuyerSalesByDate(this.buyerId(), salesDate, ledgerActive).subscribe({
      next: (response) => {
        this.popupLoading.set(false);
        if (response.success) {
          this.popupItems.set(response.data ?? []);
        } else {
          this.popupItems.set([]);
          this.toast.error(response.message);
        }
      },
      error: (error) => {
        this.popupLoading.set(false);
        this.popupItems.set([]);
        this.toast.error(extractErrorMessage(error, this.i18n.translate('common.load.failed')));
      },
    });
  }

  protected closePopup(): void {
    this.popupOpen.set(false);
    this.popupItems.set([]);
    this.currentSalesDate.set('');
  }

  protected onOverlayClick(event: Event): void {
    if (event.target === event.currentTarget) {
      this.closePopup();
    }
  }

  protected popupTotal(): number {
    return this.popupItems().reduce((sum, item) => sum + (Number(item.price) || 0), 0);
  }

  protected popupDiscount(): number {
    const salesDate = this.currentSalesDate();
    const row = this.rows().find((r) => r.salesDate === salesDate);
    return row ? Number(row.discount) || 0 : 0;
  }

  protected popupFinalTotal(): number {
    return this.popupTotal() - this.popupDiscount();
  }

  protected printDetail(): void {
    const currentRows = this.rows();
    if (!currentRows || currentRows.length === 0) {
      this.toast.error(this.i18n.translate('msg.no.records'));
      return;
    }
    const printRows = this.isReport() ? currentRows.filter((row) => this.isActive(row)) : this.displayRows();
    if (!printRows || printRows.length === 0) {
      this.toast.error(this.i18n.translate('msg.no.records'));
      return;
    }
    const lastRow = printRows[printRows.length - 1];
    const report = this.isReport();

    const rowsHtml = printRows
      .map((row, idx) => {
        const base =
          `<tr>` +
          `<td class="left">${idx + 1}</td>` +
          `<td class="left">${this.escapeHtml(row.salesDate)}</td>`;
        const body = report
          ? `<td class="right"><span style="color:#b91c1c;">${this.formatNum(row.purchase)}</span></td>` +
            `<td class="right"><span style="color:#15803d;">${this.formatNum(row.cash)}</span></td>`
          : `<td class="right">${this.formatNum(row.openingBalance)}</td>` +
            `<td class="right"><span style="color:#b91c1c;">${this.formatNum(row.purchase)}</span></td>` +
            `<td class="right"><span style="color:#15803d;">${this.formatNum(row.cash)}</span></td>` +
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
        `<th class="right">${this.escapeHtml(this.i18n.translate('buyer.ledger.detail.col.purchase'))}</th>` +
        `<th class="right">${this.escapeHtml(this.i18n.translate('buyer.ledger.detail.col.cash'))}</th>` +
        `<th class="right">${this.escapeHtml(this.i18n.translate('ledger.detail.col.closing.balance'))}</th>`;

    const totalPurchasePrint = printRows.reduce((sum, r) => sum + (Number(r.purchase) || 0), 0);
    const totalCashPrint = printRows.reduce((sum, r) => sum + (Number(r.cash) || 0), 0);
    const balancePrint = totalCashPrint - totalPurchasePrint;
    const balancePrintAbs = Math.abs(balancePrint);
    const balancePrintLabel =
      balancePrint < 0
        ? this.i18n.translate('ledger.summary.balance.debit')
        : balancePrint > 0
          ? this.i18n.translate('ledger.summary.balance.credit')
          : this.i18n.translate('ledger.summary.balance');
    const balancePrintColor = balancePrint < 0 ? '#b91c1c' : balancePrint > 0 ? '#15803d' : '#4338ca';

    const summaryHtml =
      `<div style="max-width:420px;margin:10px auto 0;background:#f8fafc;border:1px solid #e0e7ff;border-radius:8px;padding:8px 10px;">` +
      `<div style="text-align:center;font-weight:700;font-size:8px;color:#4338ca;letter-spacing:0.6px;text-transform:uppercase;padding-bottom:6px;margin-bottom:6px;border-bottom:1px solid #e0e7ff;">&#9998; ${this.escapeHtml(this.i18n.translate('ledger.summary.title'))}</div>` +
      `<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px dashed #e0e7ff;font-size:8px;"><span style="color:#475569;">&#10022; ${this.escapeHtml(this.i18n.translate('ledger.summary.flower.purchase'))}</span><strong style="color:#15803d;">${this.formatNum(totalPurchasePrint)}</strong></div>` +
      `<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px dashed #e0e7ff;font-size:8px;"><span style="color:#475569;">&#9673; ${this.escapeHtml(this.i18n.translate('ledger.summary.cash.received'))}</span><strong style="color:#b91c1c;">${this.formatNum(totalCashPrint)}</strong></div>` +
      `<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 8px;margin-top:6px;background:#fff;border:1px solid #c7d2fe;border-radius:6px;font-size:9px;font-weight:700;"><span style="color:${balancePrintColor};">&#9670; ${this.escapeHtml(balancePrintLabel)}</span><span style="color:${balancePrintColor};">${this.formatNum(balancePrintAbs)}</span></div>` +
      `</div>`;

    const reportHtml =
      this.printStyle('80mm auto', '76mm') +
      `<div class="print-header">` +
      `<h2>${this.escapeHtml(this.i18n.translate('buyer.ledger.detail.title'))}</h2>` +
      `<p>${this.escapeHtml(this.buyerName() || '')}</p>` +
      `</div>` +
      `<table>` +
      `<thead><tr>${headers}</tr></thead><tbody>${rowsHtml}</tbody></table>` +
      summaryHtml +
      (report
        ? ``
        : `<div class="summary-line"><strong>${this.escapeHtml(this.i18n.translate('ledger.detail.col.closing.balance'))}</strong> ${this.formatNum(lastRow.closingBalance)}</div>`) +
      `<div class="footer">${this.escapeHtml(this.i18n.translate('print.thankyou'))}</div>` +
      `<script>window.onload=function(){window.print();}<\/script></body></html>`;

    openPrintWindow(reportHtml, 320, 600);
  }

  protected printPopup(): void {
    const items = this.popupItems();
    if (!items || items.length === 0) {
      this.toast.error(this.i18n.translate('msg.no.records'));
      return;
    }
    const total = this.popupTotal();
    const discount = this.popupDiscount();
    const finalTotal = total - discount;

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

    let summaryRows =
      `<tr><td class="lbl">${this.escapeHtml(this.i18n.translate('buyer.sales.report.detail.total'))}</td><td class="amt">${this.formatNum(total)}</td></tr>`;
    if (discount > 0) {
      summaryRows +=
        `<tr><td class="lbl">${this.escapeHtml(this.i18n.translate('buyer.sales.report.detail.discount'))}</td><td class="amt">${this.formatNum(discount)}</td></tr>` +
        `<tr class="final"><td class="lbl">${this.escapeHtml(this.i18n.translate('buyer.sales.report.detail.final.total'))}</td><td class="amt">${this.formatNum(finalTotal)}</td></tr>`;
    }

    const reportHtml =
      this.printStyle('3in auto', '3in') +
      `<div class="print-header">` +
      `<h2>${this.escapeHtml(this.i18n.translate('buyer.ledger.detail.title'))}</h2>` +
      `<p>${this.escapeHtml(this.buyerName() || '')} - ${this.escapeHtml(this.formatDateStr(this.currentSalesDate()))}</p>` +
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
      `<table class="summary-table">${summaryRows}</table>` +
      `<div class="footer">${this.escapeHtml(this.i18n.translate('print.thankyou'))}</div>` +
      `<script>window.onload=function(){window.print();}<\/script></body></html>`;

    openPrintWindow(reportHtml, 320, 600);
  }

  private loadDetail(): void {
    if (!this.buyerId()) {
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
      ? this.service.getBuyerReportDetail(this.buyerId(), this.fromDate(), this.toDate())
      : this.service.getBuyerDetail(this.buyerId());
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

  private totalBase(): BuyerLedgerDetailRow[] {
    return this.isReport() ? this.rows().filter((row) => this.isActive(row)) : this.displayRows();
  }

  protected totalOpening(): number {
    return this.totalBase().reduce((sum, row) => sum + (Number(row.openingBalance) || 0), 0);
  }

  protected totalPurchase(): number {
    return this.totalBase().reduce((sum, row) => sum + (Number(row.purchase) || 0), 0);
  }

  protected totalCash(): number {
    return this.totalBase().reduce((sum, row) => sum + (Number(row.cash) || 0), 0);
  }

  protected totalClosing(): number {
    return this.totalBase().reduce((sum, row) => sum + (Number(row.closingBalance) || 0), 0);
  }

  protected balance(): number {
    return this.totalCash() - this.totalPurchase();
  }

  protected balanceAbs(): number {
    return Math.abs(this.balance());
  }

  protected balanceIsDebit(): boolean {
    return this.balance() < 0;
  }

  protected balanceIsCredit(): boolean {
    return this.balance() > 0;
  }

  protected balanceLabel(): string {
    if (this.balance() < 0) {
      return this.i18n.translate('ledger.summary.balance.debit');
    }
    if (this.balance() > 0) {
      return this.i18n.translate('ledger.summary.balance.credit');
    }
    return this.i18n.translate('ledger.summary.balance');
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

  private isActive(row: BuyerLedgerDetailRow): boolean {
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
      `.summary-line{margin:8px 0 4px;text-align:right;font-weight:700;font-size:10px;border-top:1px solid #000;padding-top:6px;}` +
      `.footer{text-align:center;margin-top:10px;font-size:7px;border-top:1px dashed #000;padding-top:5px;letter-spacing:0.5px;}` +
      `</style></head><body>`
    );
  }
}
