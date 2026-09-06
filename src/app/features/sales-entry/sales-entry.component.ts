import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { AutocompleteComponent } from '../../core/components/autocomplete/autocomplete.component';
import { BagCountConfigRow } from '../../core/models/bag-count-config';
import { SalesLineInput, SalesMasterData } from '../../core/models/sales';
import { I18nPipe } from '../../core/pipes/i18n.pipe';
import { AuthService } from '../../core/services/auth.service';
import { BagCountConfigService } from '../../core/services/bag-count-config.service';
import { FarmerLedgerService } from '../../core/services/farmer-ledger.service';
import { I18nService } from '../../core/services/i18n.service';
import { SalesService } from '../../core/services/sales.service';
import { ToastService } from '../../core/services/toast.service';
import { formatCurrency } from '../../core/utils/currency-format.util';
import { extractErrorMessage } from '../../core/utils/http-error.util';
import { roundOff } from '../../core/utils/round-off.util';
import { formatApiDate, isDecimal } from '../../core/utils/sales.util';
import { printHtml } from '../../core/utils/print.util';

interface SalesRow {
  flowerType: string;
  bagCount: string;
  totalWeight: string;
  price: string;
  amount: string;
  customerName: string;
  flowerInvalid: boolean;
  customerInvalid: boolean;
}

@Component({
  selector: 'app-sales-entry',
  standalone: true,
  imports: [FormsModule, I18nPipe, AutocompleteComponent],
  templateUrl: './sales-entry.html',
  styleUrl: './sales-entry.css',
})
export class SalesEntryComponent implements OnInit {
  private readonly salesService = inject(SalesService);
  private readonly farmerLedgerService = inject(FarmerLedgerService);
  private readonly auth = inject(AuthService);
  private readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);
  private readonly bagCountConfigService = inject(BagCountConfigService);

  protected readonly master = signal<SalesMasterData>({
    farmers: [],
    flowers: [],
    buyers: [],
  });
  protected readonly farmer = signal('');
  protected readonly farmerInvalid = signal(false);
  protected readonly salesDate = signal(formatApiDate(new Date()));
  protected readonly rows = signal<SalesRow[]>([]);
  protected readonly debit = signal('0');
  protected readonly calcOpen = signal(true);
  protected readonly saving = signal(false);
  protected readonly bagLimitsOpen = signal(false);
  protected readonly bagConfigs = signal<BagCountConfigRow[]>([]);

  protected readonly formatCurrency = formatCurrency;

  protected readonly bagLimits = computed(() =>
    this.bagConfigs()
      .filter((c) => c.salesDate === this.salesDate() && (c.bagCheck ?? 'E').toUpperCase() === 'E')
      .sort((a, b) => a.flowerName.localeCompare(b.flowerName)),
  );

  protected readonly bagLimitNotice = computed(() => this.bagLimits().length > 0);

  protected readonly summary = computed(() => {
    let total = 0;
    for (const row of this.rows()) {
      const value = parseFloat(row.amount);
      if (!Number.isNaN(value)) {
        total += value;
      }
    }
    const totalRounded = roundOff(total);
    const commission = roundOff(total * 0.1);
    const net = totalRounded - commission;
    const debitValue = parseFloat(this.debit());
    const debitAmount = Number.isNaN(debitValue) ? 0 : debitValue;
    const finalTotal = net - debitAmount;
    return { total: totalRounded, commission, net, debit: debitAmount, final: finalTotal };
  });

  ngOnInit(): void {
    this.loadMasterData();
    this.loadBagConfigs();
    this.addRow();
  }

  private loadBagConfigs(): void {
    this.bagCountConfigService.getConfigs().subscribe({
      next: (response) => {
        if (response.success) {
          this.bagConfigs.set(response.data ?? []);
        }
      },
      error: () => this.bagConfigs.set([]),
    });
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

  protected updateRow(index: number, patch: Partial<SalesRow>): void {
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

  protected isLastRow(index: number): boolean {
    return index === this.rows().length - 1;
  }

  private emptyRow(): SalesRow {
    return {
      flowerType: '',
      bagCount: '',
      totalWeight: '',
      price: '',
      amount: '',
      customerName: '',
      flowerInvalid: false,
      customerInvalid: false,
    };
  }

  protected onBagInput(index: number): void {
    const row = this.rows()[index];
    const cleaned = row.bagCount.replace(/[^0-9]/g, '');
    this.updateRow(index, { bagCount: cleaned });
  }

  protected recalcRowAmount(index: number): void {
    const row = this.rows()[index];
    if (row.totalWeight.trim() === '' || row.price.trim() === '') {
      return;
    }
    const weight = parseFloat(row.totalWeight);
    const rate = parseFloat(row.price);
    if (!Number.isNaN(weight) && !Number.isNaN(rate)) {
      this.updateRow(index, { amount: String(roundOff(weight * rate)) });
    }
  }

  protected recalcRowRate(index: number): void {
    const row = this.rows()[index];
    if (row.totalWeight.trim() === '' || row.amount.trim() === '') {
      return;
    }
    const weight = parseFloat(row.totalWeight);
    const amount = parseFloat(row.amount);
    if (!Number.isNaN(weight) && !Number.isNaN(amount) && weight !== 0) {
      this.updateRow(index, { price: String(roundOff(amount / weight)) });
    }
  }

  protected onQtyChange(index: number): void {
    const row = this.rows()[index];
    if (row.totalWeight.trim() === '') {
      return;
    }
    // If rate exists, qty change => amount = rate * qty (traditional)
    // If rate empty but amount exists => rate = amount / qty (amount-first workflow)
    if (row.price.trim() !== '') {
      this.recalcRowAmount(index);
    } else if (row.amount.trim() !== '') {
      this.recalcRowRate(index);
    }
  }

  protected validateFarmer(): void {
    const value = this.farmer().trim();
    if (value === '') {
      this.farmerInvalid.set(false);
      return;
    }
    this.farmerInvalid.set(!this.matchesMaster(value, this.master().farmers));
  }

  protected validateFlower(index: number): void {
    const value = this.rows()[index].flowerType.trim();
    this.updateRow(index, { flowerInvalid: value !== '' && !this.matchesMaster(value, this.master().flowers) });
  }

  protected validateCustomer(index: number): void {
    const value = this.rows()[index].customerName.trim();
    this.updateRow(index, { customerInvalid: value !== '' && !this.matchesMaster(value, this.master().buyers) });
  }

  protected onCustomerEnter(index: number): void {
    if (!this.isLastRow(index)) {
      return;
    }
    this.addRow();
  }

  private matchesMaster(value: string, list: string[]): boolean {
    const lower = value.trim().toLowerCase();
    return list.some((item) => item.toLowerCase() === lower);
  }

  protected resetGrid(): void {
    this.farmer.set('');
    this.farmerInvalid.set(false);
    this.salesDate.set(formatApiDate(new Date()));
    this.rows.set([]);
    this.debit.set('0');
    this.addRow();
  }

  protected save(): void {
    if (this.saving()) {
      return;
    }
    const farmer = this.farmer().trim();
    if (!farmer) {
      this.toast.error(this.i18n.translate('sales.error.farmer.required'));
      this.farmerInvalid.set(true);
      return;
    }
    if (!this.salesDate()) {
      this.toast.error(this.i18n.translate('sales.error.date.required'));
      return;
    }
    if (!this.matchesMaster(farmer, this.master().farmers)) {
      this.toast.error(this.i18n.translate('sales.error.farmer.notfound'));
      this.farmerInvalid.set(true);
      return;
    }

    const lineItems: SalesLineInput[] = [];
    for (let i = 0; i < this.rows().length; i++) {
      const row = this.rows()[i];
      const flower = row.flowerType.trim();
      const customer = row.customerName.trim();
      const weight = row.totalWeight.trim();
      const price = row.price.trim();
      const amount = row.amount.trim();

      if (!flower) {
        this.toast.error(this.i18n.translate('sales.error.flower.type.row', i + 1));
        return;
      }
      if (!this.matchesMaster(flower, this.master().flowers)) {
        this.toast.error(this.i18n.translate('sales.error.flower.notfound.row', i + 1));
        this.updateRow(i, { flowerInvalid: true });
        return;
      }
      if (!customer) {
        this.toast.error(this.i18n.translate('sales.error.customer.name.row', i + 1));
        return;
      }
      if (!this.matchesMaster(customer, this.master().buyers)) {
        this.toast.error(this.i18n.translate('sales.error.buyer.notfound.row', i + 1));
        this.updateRow(i, { customerInvalid: true });
        return;
      }
      if (weight !== '' && !isDecimal(weight)) {
        this.toast.error(this.i18n.translate('sales.error.weight.row', i + 1));
        return;
      }
      if (price !== '' && !isDecimal(price)) {
        this.toast.error(this.i18n.translate('sales.error.price.row', i + 1));
        return;
      }
      if (!amount) {
        this.toast.error(this.i18n.translate('sales.error.amount.row', i + 1));
        return;
      }
      if (!isDecimal(amount)) {
        this.toast.error(this.i18n.translate('sales.error.amount.row', i + 1));
        return;
      }
      if (parseFloat(amount) <= 0) {
        this.toast.error(this.i18n.translate('sales.error.amount.positive.row', i + 1));
        return;
      }

      lineItems.push({ flowerType: flower, bagCount: row.bagCount, totalWeight: weight, price, amount, customerName: customer });
    }

    if (lineItems.length === 0) {
      this.toast.error(this.i18n.translate('sales.error.no.rows'));
      return;
    }

    const summary = this.summary();
    this.saving.set(true);
    this.farmerLedgerService.getFarmerList().subscribe({
      next: (ledgerResponse) => {
        let ledgerActive = 'Y';
        let updatePreviousYRecords = false;
        if (ledgerResponse.success && ledgerResponse.data) {
          const farmerEntry = ledgerResponse.data.find(
            (e) => e.farmerName.toLowerCase() === farmer.toLowerCase(),
          );
          if (farmerEntry) {
            const newClosingBalance = (farmerEntry.outstandingBalance ?? 0) + summary.final;
            if (newClosingBalance === 0) {
              ledgerActive = 'N';
              updatePreviousYRecords = true;
            }
          }
        }
        this.salesService
          .save({
            farmerName: farmer,
            salesDate: this.salesDate(),
            totalSalesAmt: String(summary.total),
            commissionAmt: String(summary.commission),
            netAmount: String(summary.net),
            finalTotal: String(summary.final),
            debitAmount: String(summary.debit),
            rows: lineItems,
            ledgerActive,
            updatePreviousYRecords,
          })
          .subscribe({
            next: (response) => {
              this.saving.set(false);
              if (response.success) {
                this.toast.success(response.message);
                this.resetGrid();
              } else {
                this.toast.error(response.message);
              }
            },
            error: (error) => {
              this.saving.set(false);
              this.toast.error(extractErrorMessage(error, this.i18n.translate('sales.error.save.failed')));
            },
          });
      },
      error: () => {
        this.salesService
          .save({
            farmerName: farmer,
            salesDate: this.salesDate(),
            totalSalesAmt: String(summary.total),
            commissionAmt: String(summary.commission),
            netAmount: String(summary.net),
            finalTotal: String(summary.final),
            debitAmount: String(summary.debit),
            rows: lineItems,
          })
          .subscribe({
            next: (response) => {
              this.saving.set(false);
              if (response.success) {
                this.toast.success(response.message);
                this.resetGrid();
              } else {
                this.toast.error(response.message);
              }
            },
            error: (error) => {
              this.saving.set(false);
              this.toast.error(extractErrorMessage(error, this.i18n.translate('sales.error.save.failed')));
            },
          });
      },
    });
  }

  protected printReport(): void {
    if (!this.farmer().trim()) {
      this.toast.error(this.i18n.translate('sales.error.enter.farmer.print'));
      return;
    }
    const rows = this.rows();
    if (rows.length === 0) {
      this.toast.error(this.i18n.translate('sales.error.no.rows.print'));
      return;
    }

    const bagLimits = this.bagLimits();

    const shopName = this.auth.user()?.shopName ?? '';
    const summary = this.summary();
    const t = this.i18n.translate.bind(this.i18n);

    let rowsHtml = '';
    rows.forEach((row, i) => {
      rowsHtml +=
        '<tr>' +
        '<td class="left">' + (i + 1) + '</td>' +
        '<td class="left">' + (row.flowerType || '-') + '</td>' +
        '<td class="right">' + (row.totalWeight || '-') + '</td>' +
        '<td class="right">' + (row.price || '-') + '</td>' +
        '<td class="right">' + (row.amount || '-') + '</td>' +
        '</tr>';
    });

    let bagLimitHtml = '';
    if (bagLimits.length > 0) {
      let body = '';
      bagLimits.forEach((config, i) => {
        body +=
          '<tr>' +
          '<td class="left">' + (i + 1) + '</td>' +
          '<td class="left">' + (config.flowerName || '-') + '</td>' +
          '<td class="right">' + (config.bagCount ?? 0) + '</td>' +
          '</tr>';
      });
      bagLimitHtml =
        '<div class="divider"></div>' +
        '<div class="bl-title">' + t('bag.limit.title') + '</div>' +
        '<table>' +
        '<colgroup><col style="width:12%"><col style="width:60%"><col style="width:28%"></colgroup>' +
        '<thead><tr>' +
        '<th class="left">#</th>' +
        '<th class="left">' + t('sales.flower') + '</th>' +
        '<th class="right">' + t('bag.limit.limit') + '</th>' +
        '</tr></thead><tbody>' + body + '</tbody></table>';
    }

    const reportHtml =
      '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>' + t('print.receipt.title') + '</title>' +
      '<style>' +
      '@page{size:80mm auto;margin:3mm 2mm;}' +
      'body{margin:0;padding:2mm 1mm;width:76mm;font-family:"Courier New",monospace;font-size:9px;line-height:1.4;color:#000;background:#fff;}' +
      '.print-header{text-align:center;border-bottom:1px dashed #000;padding-bottom:5px;margin-bottom:5px;}' +
      '.print-header h2{font-size:13px;margin:0 0 2px;font-weight:700;letter-spacing:0.5px;}' +
      '.print-header p{font-size:8px;margin:1px 0;color:#333;}' +
      '.print-info{margin-bottom:6px;font-size:8px;line-height:1.5;}' +
      '.print-info span{display:block;}' +
      '.print-info strong{font-size:8px;}' +
      'table{width:100%;border-collapse:collapse;margin:0 0 6px;font-size:8.5px;table-layout:fixed;}' +
      'th,td{padding:3px 2.5px;vertical-align:top;word-wrap:break-word;overflow-wrap:break-word;}' +
      'th{border-bottom:1.5px solid #000;font-weight:700;font-size:8px;text-transform:uppercase;letter-spacing:0.3px;}' +
      'th.left,td.left{text-align:left;}' +
      'th.right,td.right{text-align:right;}' +
      'tbody tr{border-bottom:0.5px dotted #ccc;}' +
      'tbody tr:last-child{border-bottom:none;}' +
      '.divider{border-top:1px dashed #000;margin:6px 0;}' +
      '.bl-title{font-size:9px;font-weight:700;text-align:center;text-transform:uppercase;letter-spacing:0.4px;margin:0 0 3px;}' +
      '.summary{margin:0 0 4px;}' +
      '.summary p{display:flex;justify-content:flex-end;gap:8px;margin:2px 0;font-size:8px;line-height:1.4;}' +
      '.summary p strong{min-width:40px;text-align:right;}' +
      '.summary .final{font-size:10px;font-weight:700;border-top:1px solid #000;padding-top:4px;margin-top:4px;gap:10px;}' +
      '.summary .final strong{min-width:45px;}' +
      '.footer{text-align:center;margin-top:10px;font-size:7px;border-top:1px dashed #000;padding-top:5px;letter-spacing:0.5px;}' +
      '</style></head><body>' +
      '<div class="print-header">' +
      '<h2>' + shopName + '</h2>' +
      '</div>' +
      '<div class="print-info">' +
      '<span><strong>' + t('report.farmer') + '</strong> ' + this.farmer() + '</span>' +
      '<span><strong>' + t('report.date') + '</strong> ' + this.salesDate() + '</span>' +
      '</div>' +
      '<table>' +
      '<colgroup>' +
      '<col style="width:8%"><col style="width:31%"><col style="width:18%"><col style="width:18%"><col style="width:25%">' +
      '</colgroup>' +
      '<thead><tr>' +
      '<th class="left">#</th>' +
      '<th class="left">' + t('report.col.flower.type') + '</th>' +
      '<th class="right">' + t('report.col.weight') + '</th>' +
      '<th class="right">' + t('report.col.price') + '</th>' +
      '<th class="right">' + t('report.col.total') + '</th>' +
      '</tr></thead><tbody>' + rowsHtml + '</tbody></table>' + bagLimitHtml +
      '<div class="divider"></div>' +
      '<div class="summary">' +
      '<p><span>' + t('report.total') + '</span><strong>' + this.formatCurrency(summary.total) + '</strong></p>' +
      '<p><span>' + t('report.commission') + '</span><strong>' + this.formatCurrency(summary.commission) + '</strong></p>' +
      '<p><span>' + t('report.net.amount') + '</span><strong>' + this.formatCurrency(summary.net) + '</strong></p>' +
      '<p><span>' + t('report.debit') + '</span><strong>' + this.formatCurrency(summary.debit) + '</strong></p>' +
      '<p class="final"><span>' + t('report.final.total') + '</span><strong>' + this.formatCurrency(summary.final) + '</strong></p>' +
      '</div>' +
      '<div class="footer">' + t('print.thankyou') + '</div>' +
      '</body></html>';

    if (!printHtml(reportHtml)) {
      this.toast.error(this.i18n.translate('sales.error.print.blocked'));
    }
  }

  protected shareReport(): void {
    if (!this.farmer().trim()) {
      this.toast.error(this.i18n.translate('sales.error.enter.farmer.share'));
      return;
    }
    const rows = this.rows();
    if (rows.length === 0) {
      this.toast.error(this.i18n.translate('sales.error.no.rows.share'));
      return;
    }

    const shopName = this.auth.user()?.shopName ?? '';
    const t = this.i18n.translate.bind(this.i18n);
    const lines: string[] = [];
    lines.push(shopName);
    lines.push('');
    lines.push('=== ' + t('report.sales.collection') + ' ===');
    lines.push(t('report.farmer') + this.farmer());
    lines.push(t('report.date') + this.salesDate());
    lines.push('');
    lines.push(t('report.col.sno') + ' | ' + t('sales.flower') + ' | ' + t('report.col.weight') + ' | ' + t('report.col.price') + ' | ' + t('report.col.total') + ' | ' + t('report.col.customer'));
    lines.push('-----------------------------------------------');

    rows.forEach((row, i) => {
      lines.push(
        (i + 1) + '     | ' + (row.flowerType || '-') + ' | ' + (row.totalWeight || '-') + ' | ' +
        (row.price || '-') + ' | ' + (row.amount || '-') + ' | ' + (row.customerName || '-'),
      );
    });

    lines.push('');
    lines.push(t('report.total') + this.formatCurrency(this.summary().total));
    lines.push(t('report.commission') + this.formatCurrency(this.summary().commission));
    lines.push(t('report.net.amount') + this.formatCurrency(this.summary().net));
    lines.push(t('report.debit') + this.formatCurrency(this.summary().debit));
    lines.push(t('report.final.total') + this.formatCurrency(this.summary().final));

    const text = lines.join('\n');
    const title = shopName + ' - ' + t('report.title');

    if (navigator.share) {
      navigator
        .share({ title, text })
        .catch(() => {});
    } else {
      window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
    }
  }
}
