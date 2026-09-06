import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { AutocompleteComponent } from '../../core/components/autocomplete/autocomplete.component';
import { BagCountConfigRow } from '../../core/models/bag-count-config';
import { MultiSalesLine, SalesMasterData } from '../../core/models/sales';
import { I18nPipe } from '../../core/pipes/i18n.pipe';
import { AuthService } from '../../core/services/auth.service';
import { BagCountConfigService } from '../../core/services/bag-count-config.service';
import { FarmerLedgerService } from '../../core/services/farmer-ledger.service';
import { I18nService } from '../../core/services/i18n.service';
import { MultiSalesEntryService } from '../../core/services/multi-sales.service';
import { ToastService } from '../../core/services/toast.service';
import { formatCurrency } from '../../core/utils/currency-format.util';
import { extractErrorMessage } from '../../core/utils/http-error.util';
import { roundOff } from '../../core/utils/round-off.util';
import { formatApiDate, isDecimal } from '../../core/utils/sales.util';
import { printHtml } from '../../core/utils/print.util';

interface MultiSalesRow {
  salesId: number | null;
  saved: boolean;
  farmerName: string;
  flowerType: string;
  bagCount: string;
  totalWeight: string;
  price: string;
  amount: string;
  customerName: string;
  farmerInvalid: boolean;
  flowerInvalid: boolean;
  customerInvalid: boolean;
}

@Component({
  selector: 'app-multi-sales',
  standalone: true,
  imports: [FormsModule, I18nPipe, AutocompleteComponent],
  templateUrl: './multi-sales.html',
  styleUrl: './multi-sales.css',
})
export class MultiSalesComponent implements OnInit {
  private readonly multiSalesService = inject(MultiSalesEntryService);
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
  protected readonly rows = signal<MultiSalesRow[]>([]);
  protected readonly debit = signal('0');
  protected readonly saving = signal(false);
  protected readonly calcOpen = signal(true);
  protected readonly bagLimitsOpen = signal(false);
  protected readonly bagConfigs = signal<BagCountConfigRow[]>([]);

  protected readonly formatCurrency = formatCurrency;

  protected readonly bagLimits = computed(() =>
    this.bagConfigs()
      .filter(
        (c) =>
          c.salesDate === formatApiDate(new Date()) &&
          (c.bagCheck ?? 'E').toUpperCase() === 'E',
      )
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
    const commission = roundOff(totalRounded * 0.1);
    const net = totalRounded - commission;
    const debitValue = parseFloat(this.debit());
    const debitAmount = Number.isNaN(debitValue) ? 0 : debitValue;
    const finalTotal = net - debitAmount;
    return { total: totalRounded, commission, net, debit: debitAmount, final: finalTotal };
  });

  ngOnInit(): void {
    this.loadMasterData();
    this.loadBagConfigs();
    this.loadTodayEntries();
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
    this.multiSalesService.getMasterData().subscribe({
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

  private loadTodayEntries(): void {
    this.multiSalesService.getTodayEntries().subscribe({
      next: (response) => {
        if (response.success) {
          this.rows.set(response.data.map((entry) => this.savedRowFromEntry(entry)));
        }
        this.addEmptyRow();
      },
      error: () => {
        this.addEmptyRow();
      },
    });
  }

  private savedRowFromEntry(entry: {
    salesId: number;
    farmerName: string;
    flowerType: string;
    bagCount?: number;
    totalWeight: number;
    price: number;
    amount: number;
    customerName: string;
  }): MultiSalesRow {
    return {
      salesId: entry.salesId,
      saved: true,
      farmerName: entry.farmerName ?? '',
      flowerType: entry.flowerType ?? '',
      bagCount: entry.bagCount != null ? String(entry.bagCount) : '',
      totalWeight: entry.totalWeight != null ? String(entry.totalWeight) : '',
      price: entry.price != null ? String(entry.price) : '',
      amount: entry.amount != null ? String(entry.amount) : '',
      customerName: entry.customerName ?? '',
      farmerInvalid: false,
      flowerInvalid: false,
      customerInvalid: false,
    };
  }

  protected updateRow(index: number, patch: Partial<MultiSalesRow>): void {
    this.rows.update((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  protected addEmptyRow(): void {
    this.rows.update((rows) => [...rows, this.emptyRow()]);
  }

  protected addEmptyRowBelow(index: number): void {
    this.rows.update((rows) => {
      const next = [...rows];
      next.splice(index + 1, 0, this.emptyRow());
      return next;
    });
  }

  protected removeRow(index: number): void {
    const row = this.rows()[index];
    if (this.rows().length <= 1) {
      this.toast.error(this.i18n.translate('sales.error.cannot.remove.last.row'));
      return;
    }
    if (!row.saved && this.unsavedRows().length <= 1) {
      this.toast.error(this.i18n.translate('sales.error.cannot.remove.last.row'));
      return;
    }
    this.rows.update((rows) => rows.filter((_, i) => i !== index));
  }

  protected isLastRow(index: number): boolean {
    return index === this.rows().length - 1;
  }

  private emptyRow(): MultiSalesRow {
    return {
      salesId: null,
      saved: false,
      farmerName: '',
      flowerType: '',
      bagCount: '',
      totalWeight: '',
      price: '',
      amount: '',
      customerName: '',
      farmerInvalid: false,
      flowerInvalid: false,
      customerInvalid: false,
    };
  }

  protected onBagInput(index: number): void {
    const row = this.rows()[index];
    const cleaned = row.bagCount.replace(/[^0-9]/g, '');
    this.updateRow(index, { bagCount: cleaned });
  }

  protected unsavedRows(): MultiSalesRow[] {
    return this.rows().filter((row) => !row.saved);
  }

  protected recalcRowAmount(index: number): void {
    const row = this.rows()[index];
    if (row.saved || row.totalWeight.trim() === '' || row.price.trim() === '') {
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
    if (row.saved || row.totalWeight.trim() === '' || row.amount.trim() === '') {
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
    if (row.saved || row.totalWeight.trim() === '') {
      return;
    }
    if (row.price.trim() !== '') {
      this.recalcRowAmount(index);
    } else if (row.amount.trim() !== '') {
      this.recalcRowRate(index);
    }
  }

  protected validateField(index: number, field: 'farmer' | 'flower' | 'customer'): void {
    const row = this.rows()[index];
    const value = this.fieldValue(row, field).trim();
    const list = field === 'farmer' ? this.master().farmers : field === 'flower' ? this.master().flowers : this.master().buyers;
    this.updateRow(index, {
      farmerInvalid: field === 'farmer' && value !== '' && !this.matchesMaster(value, list),
      flowerInvalid: field === 'flower' && value !== '' && !this.matchesMaster(value, list),
      customerInvalid: field === 'customer' && value !== '' && !this.matchesMaster(value, list),
    });
  }

  private fieldValue(row: MultiSalesRow, field: 'farmer' | 'flower' | 'customer'): string {
    if (field === 'farmer') return row.farmerName;
    if (field === 'flower') return row.flowerType;
    return row.customerName;
  }

  private matchesMaster(value: string, list: string[]): boolean {
    const lower = value.trim().toLowerCase();
    return list.some((item) => item.toLowerCase() === lower);
  }

  protected save(): void {
    if (this.saving()) {
      return;
    }
    const unsaved = this.unsavedRows();
    if (unsaved.length === 0) {
      this.toast.error(this.i18n.translate('sales.error.no.rows'));
      return;
    }

    this.finalizeMultiSave();
  }

  private finalizeMultiSave(): void {
    const unsaved = this.unsavedRows();
    const lineItems: MultiSalesLine[] = [];
    for (let i = 0; i < unsaved.length; i++) {
      const row = unsaved[i];
      const farmer = row.farmerName.trim();
      const flower = row.flowerType.trim();
      const customer = row.customerName.trim();
      const weight = row.totalWeight.trim();
      const price = row.price.trim();
      const amount = row.amount.trim();

      if (!farmer) {
        this.toast.error(this.i18n.translate('sales.error.farmer.required'));
        return;
      }
      if (!this.matchesMaster(farmer, this.master().farmers)) {
        this.toast.error(this.i18n.translate('sales.error.farmer.notfound'));
        return;
      }
      if (!flower) {
        this.toast.error(this.i18n.translate('sales.error.flower.type.row', i + 1));
        return;
      }
      if (!this.matchesMaster(flower, this.master().flowers)) {
        this.toast.error(this.i18n.translate('sales.error.flower.notfound.row', i + 1));
        return;
      }
      if (!customer) {
        this.toast.error(this.i18n.translate('sales.error.customer.name.row', i + 1));
        return;
      }
      if (!this.matchesMaster(customer, this.master().buyers)) {
        this.toast.error(this.i18n.translate('sales.error.buyer.notfound.row', i + 1));
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

      lineItems.push({ farmerName: farmer, flowerType: flower, bagCount: row.bagCount, totalWeight: weight, price, amount, customerName: customer });
    }

    if (lineItems.length === 0) {
      this.toast.error(this.i18n.translate('sales.error.no.rows'));
      return;
    }

    this.saving.set(true);
    this.farmerLedgerService.getFarmerList().subscribe({
      next: (ledgerResponse) => {
        const farmerBalanceMap = new Map<string, number>();
        if (ledgerResponse.success && ledgerResponse.data) {
          for (const entry of ledgerResponse.data) {
            farmerBalanceMap.set(entry.farmerName.toLowerCase(), entry.outstandingBalance ?? 0);
          }
        }
        for (const item of lineItems) {
          const balance = farmerBalanceMap.get(item.farmerName.toLowerCase()) ?? 0;
          const newClosingBalance = balance + parseFloat(item.amount);
          if (newClosingBalance === 0) {
            item.ledgerActive = 'N';
            item.updatePreviousYRecords = true;
          } else {
            item.ledgerActive = 'Y';
            item.updatePreviousYRecords = false;
          }
        }
        this.executeMultiSave(lineItems, unsaved);
      },
      error: () => {
        this.executeMultiSave(lineItems, unsaved);
      },
    });
  }

  private executeMultiSave(lineItems: MultiSalesLine[], unsaved: MultiSalesRow[]): void {
    const summary = this.summary();
    this.multiSalesService.save({
      rows: lineItems,
      totalSalesAmt: String(summary.total),
      commissionAmt: String(summary.commission),
      netAmount: String(summary.net),
      finalTotal: String(summary.final),
      debitAmount: String(summary.debit),
    }).subscribe({
      next: (response) => {
        this.saving.set(false);
        if (response.success) {
          this.toast.success(response.message);
          const saved = response.data ?? [];
          const currentIndexes = unsaved.map((row) => this.rows().indexOf(row));
          this.rows.update((rows) => {
            const next = [...rows];
            currentIndexes.forEach((rowIndex, i) => {
              if (rowIndex < 0 || rowIndex >= next.length) {
                return;
              }
              next[rowIndex] = {
                ...next[rowIndex],
                saved: true,
                salesId: saved[i]?.salesId ?? null,
              };
            });
            return next;
          });
          this.addEmptyRow();
        } else {
          this.toast.error(response.message);
        }
      },
      error: (error) => {
        this.saving.set(false);
        this.toast.error(extractErrorMessage(error, this.i18n.translate('sales.error.save.failed')));
      },
    });
  }

  protected printReport(): void {
    const rows = this.rows();
    if (rows.length === 0) {
      this.toast.error(this.i18n.translate('sales.error.no.rows.print'));
      return;
    }

    const shopName = this.auth.user()?.shopName ?? '';
    const today = formatApiDate(new Date());
    const t = this.i18n.translate.bind(this.i18n);
    const bagLimits = this.bagLimits();

    let rowsHtml = '';
    rows.forEach((row, i) => {
      rowsHtml +=
        '<tr>' +
        '<td class="left">' + (i + 1) + '</td>' +
        '<td class="left">' + (row.farmerName || '-') + '</td>' +
        '<td class="left">' + (row.flowerType || '-') + '</td>' +
        '<td class="right">' + (row.totalWeight || '-') + '</td>' +
        '<td class="right">' + (row.price || '-') + '</td>' +
        '<td class="right">' + (row.amount || '-') + '</td>' +
        '<td class="left">' + (row.customerName || '-') + '</td>' +
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
      'table{width:100%;border-collapse:collapse;margin:0 0 6px;font-size:7.5px;table-layout:fixed;}' +
      'th,td{padding:3px 2px;vertical-align:top;word-wrap:break-word;overflow-wrap:break-word;}' +
      'th{border-bottom:1.5px solid #000;font-weight:700;font-size:7px;text-transform:uppercase;letter-spacing:0.3px;}' +
      'th.left,td.left{text-align:left;}' +
      'th.right,td.right{text-align:right;}' +
      'tbody tr{border-bottom:0.5px dotted #ccc;}' +
      'tbody tr:last-child{border-bottom:none;}' +
      '.bl-title{font-size:8px;font-weight:700;text-align:center;text-transform:uppercase;letter-spacing:0.4px;margin:6px 0 3px;border-top:1px dashed #000;padding-top:5px;}' +
      '.footer{text-align:center;margin-top:10px;font-size:7px;border-top:1px dashed #000;padding-top:5px;}' +
      '</style></head><body>' +
      '<div class="print-header"><h2>' + shopName + '</h2></div>' +
      '<div class="print-info"><span><strong>' + t('report.date') + '</strong> ' + today + '</span></div>' +
      '<table>' +
      '<colgroup>' +
      '<col style="width:6%"><col style="width:16%"><col style="width:18%"><col style="width:10%"><col style="width:10%"><col style="width:14%"><col style="width:16%">' +
      '</colgroup>' +
      '<thead><tr>' +
      '<th class="left">#</th>' +
      '<th class="left">' + t('farmer.name') + '</th>' +
      '<th class="left">' + t('report.col.flower.type') + '</th>' +
      '<th class="right">' + t('report.col.weight') + '</th>' +
      '<th class="right">' + t('report.col.price') + '</th>' +
      '<th class="right">' + t('report.col.total') + '</th>' +
      '<th class="left">' + t('report.col.customer') + '</th>' +
      '</tr></thead>' +
      '<tbody>' + rowsHtml + '</tbody></table>' + bagLimitHtml +
      '<div class="footer">' + t('print.thankyou') + '</div>' +
      '</body></html>';

    if (!printHtml(reportHtml)) {
      this.toast.error(this.i18n.translate('sales.error.print.blocked'));
    }
  }

  protected shareReport(): void {
    const rows = this.rows();
    if (rows.length === 0) {
      this.toast.error(this.i18n.translate('sales.error.no.rows.share'));
      return;
    }

    const shopName = this.auth.user()?.shopName ?? '';
    const today = formatApiDate(new Date());
    const t = this.i18n.translate.bind(this.i18n);
    const lines: string[] = [];
    lines.push(shopName);
    lines.push('');
    lines.push('=== ' + t('multi.sales.title') + ' ===');
    lines.push(t('report.date') + today);
    lines.push('');
    lines.push(t('report.col.sno') + ' | ' + t('farmer.name') + ' | ' + t('sales.flower') + ' | ' + t('report.col.weight') + ' | ' + t('report.col.price') + ' | ' + t('report.col.total') + ' | ' + t('report.col.customer'));
    lines.push('---------------------------------------------------------------');

    rows.forEach((row, i) => {
      lines.push(
        (i + 1) + ' | ' + (row.farmerName || '-') + ' | ' + (row.flowerType || '-') + ' | ' +
        (row.totalWeight || '-') + ' | ' + (row.price || '-') + ' | ' + (row.amount || '-') + ' | ' + (row.customerName || '-'),
      );
    });

    const text = lines.join('\n');
    const title = shopName + ' - ' + t('multi.sales.title');

    if (navigator.share) {
      navigator
        .share({ title, text })
        .catch(() => {});
    } else {
      window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
    }
  }
}
