import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { AutocompleteComponent } from '../../core/components/autocomplete/autocomplete.component';
import { ReceiptPrintButtonsComponent } from '../../core/components/receipt-print-buttons/receipt-print-buttons.component';
import { DraggableDirective } from '../../core/directives/draggable.directive';
import { FlowerLootRow, SalesMasterData } from '../../core/models/sales';
import { I18nPipe } from '../../core/pipes/i18n.pipe';
import { I18nService } from '../../core/services/i18n.service';
import { ReceiptFormat, ReceiptService } from '../../core/services/receipt.service';
import { SalesService } from '../../core/services/sales.service';
import { ToastService } from '../../core/services/toast.service';
import { formatCurrency } from '../../core/utils/currency-format.util';
import { extractErrorMessage } from '../../core/utils/http-error.util';
import { roundOff } from '../../core/utils/round-off.util';
import { formatApiDate, isDecimal } from '../../core/utils/sales.util';

interface BuyerRow {
  bag: string;
  buyerName: string;
  qty: string;
  rate: string;
  amount: string;
  buyerInvalid: boolean;
}

interface FarmerRow {
  bag: string;
  farmerName: string;
  qty: string;
  rate: string;
  amount: string;
  farmerInvalid: boolean;
}

@Component({
  selector: 'app-flower-loot-sale',
  standalone: true,
  imports: [FormsModule, I18nPipe, AutocompleteComponent, ReceiptPrintButtonsComponent],
  templateUrl: './flower-loot-sale.html',
  styleUrl: './flower-loot-sale.css',
})
export class FlowerLootSaleComponent implements OnInit {
  private readonly salesService = inject(SalesService);
  private readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);
  private readonly receipt = inject(ReceiptService);

  protected readonly formatRateParam = (value: number): string =>
    value.toLocaleString('en-IN', {
      minimumFractionDigits: value % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    });

  protected readonly formatCurrency = formatCurrency;

  protected readonly master = signal<SalesMasterData>({
    farmers: [],
    flowers: [],
    buyers: [],
  });
  protected readonly flowerName = signal('');
  protected readonly flowerInvalid = signal(false);
  protected readonly salesDate = signal(formatApiDate(new Date()));
  protected readonly buyerRows = signal<BuyerRow[]>([]);
  protected readonly farmerRows = signal<FarmerRow[]>([]);
  protected readonly saving = signal(false);

  protected readonly avgDialogOpen = signal(false);
  protected readonly rateDialogOpen = signal(false);

  protected readonly avgRate = signal(0);
  protected readonly customRate = signal('');

  constructor() {
    this.buyerRows.set([this.emptyBuyerRow()]);
    this.farmerRows.set([this.emptyFarmerRow()]);
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

  protected validateFlower(): void {
    if (this.flowerName().trim() !== '') {
      this.flowerInvalid.set(!this.matchesMaster(this.flowerName(), this.master().flowers));
    }
  }

  protected validateBuyer(index: number): void {
    const value = this.buyerRows()[index].buyerName;
    if (value !== '') {
      this.updateBuyerRow(index, { buyerInvalid: !this.matchesMaster(value, this.master().buyers) });
    }
  }

  protected validateFarmer(index: number): void {
    const value = this.farmerRows()[index].farmerName;
    if (value !== '') {
      this.updateFarmerRow(index, {
        farmerInvalid: !this.matchesMaster(value, this.master().farmers),
      });
    }
  }

  private matchesMaster(value: string, list: string[]): boolean {
    return list.some((entry) => entry.toLowerCase() === value.trim().toLowerCase());
  }

  protected readonly avgRateAll = computed(() => {
    const rates: number[] = [];
    for (const row of this.buyerRows()) {
      if (row.rate.trim() !== '' && isDecimal(row.rate)) {
        const n = parseFloat(row.rate);
        if (!Number.isNaN(n)) {
          rates.push(n);
        }
      }
    }
    if (rates.length === 0) {
      return 0;
    }
    const sum = rates.reduce((a, b) => a + b, 0);
    return Math.round((sum / rates.length) * 100) / 100;
  });

  protected readonly canCalculate = computed(() => {
    const hasBuyerRate = this.buyerRows().some(
      (row) => row.rate.trim() !== '' && isDecimal(row.rate),
    );
    const hasFarmerQty = this.farmerRows().some(
      (row) => row.qty.trim() !== '' && isDecimal(row.qty),
    );
    return hasBuyerRate && hasFarmerQty;
  });

  protected updateBuyerRow(index: number, patch: Partial<BuyerRow>): void {
    this.buyerRows.update((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  protected updateFarmerRow(index: number, patch: Partial<FarmerRow>): void {
    this.farmerRows.update((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  protected addBuyerRow(): void {
    this.buyerRows.update((rows) => [...rows, this.emptyBuyerRow()]);
  }

  protected addBuyerRowBelow(index: number): void {
    this.buyerRows.update((rows) => {
      const next = [...rows];
      next.splice(index + 1, 0, this.emptyBuyerRow());
      return next;
    });
  }

  protected removeBuyerRow(index: number): void {
    if (this.buyerRows().length <= 1) {
      return;
    }
    this.buyerRows.update((rows) => rows.filter((_, i) => i !== index));
  }

  protected addFarmerRow(): void {
    this.farmerRows.update((rows) => [...rows, this.emptyFarmerRow()]);
  }

  protected addFarmerRowBelow(index: number): void {
    this.farmerRows.update((rows) => {
      const next = [...rows];
      next.splice(index + 1, 0, this.emptyFarmerRow());
      return next;
    });
  }

  protected removeFarmerRow(index: number): void {
    if (this.farmerRows().length <= 1) {
      return;
    }
    this.farmerRows.update((rows) => rows.filter((_, i) => i !== index));
  }

  private emptyBuyerRow(): BuyerRow {
    return { bag: '', buyerName: '', qty: '', rate: '', amount: '', buyerInvalid: false };
  }

  private emptyFarmerRow(): FarmerRow {
    return { bag: '', farmerName: '', qty: '', rate: '', amount: '', farmerInvalid: false };
  }

  protected onBuyerAmountEnter(index: number): void {
    const rows = this.buyerRows();
    if (index !== rows.length - 1) {
      return;
    }
    this.addBuyerRow();
  }

  protected onFarmerQtyEnter(index: number): void {
    const rows = this.farmerRows();
    if (index !== rows.length - 1) {
      return;
    }
    this.addFarmerRow();
  }

  protected onDecimalKeydown(event: KeyboardEvent): void {
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }
    const key = event.key;
    if (
      key.length !== 1 ||
      key === 'Backspace' ||
      key === 'Delete' ||
      key === 'Tab' ||
      key === 'Enter' ||
      key === 'Escape' ||
      key === 'ArrowLeft' ||
      key === 'ArrowRight' ||
      key === 'ArrowUp' ||
      key === 'ArrowDown' ||
      key === 'Home' ||
      key === 'End'
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

  protected onBagInput(type: 'buyer' | 'farmer', index: number): void {
    if (type === 'buyer') {
      const row = this.buyerRows()[index];
      this.updateBuyerRow(index, { bag: row.bag.replace(/[^0-9]/g, '') });
    } else {
      const row = this.farmerRows()[index];
      this.updateFarmerRow(index, { bag: row.bag.replace(/[^0-9]/g, '') });
    }
  }

  protected onQtyChange(type: 'buyer' | 'farmer', index: number): void {
    if (type === 'buyer') {
      const row = this.buyerRows()[index];
      if (row.qty.trim() === '') {
        return;
      }
      if (row.rate.trim() !== '' && isDecimal(row.rate)) {
        this.recalcBuyerRowAmount(index);
      } else if (row.amount.trim() !== '' && isDecimal(row.amount)) {
        this.recalcBuyerRowRate(index);
      }
    } else {
      const row = this.farmerRows()[index];
      if (row.qty.trim() === '') {
        return;
      }
      if (row.rate.trim() !== '' && isDecimal(row.rate)) {
        this.recalcFarmerRowAmount(index);
      }
    }
  }

  protected recalcBuyerRowAmount(index: number): void {
    const row = this.buyerRows()[index];
    if (row.qty.trim() === '' || row.rate.trim() === '') {
      return;
    }
    const weight = parseFloat(row.qty);
    const rate = parseFloat(row.rate);
    if (!Number.isNaN(weight) && !Number.isNaN(rate)) {
      this.updateBuyerRow(index, { amount: String(roundOff(weight * rate)) });
    }
  }

  protected recalcBuyerRowRate(index: number): void {
    const row = this.buyerRows()[index];
    if (row.qty.trim() === '' || row.amount.trim() === '') {
      return;
    }
    const weight = parseFloat(row.qty);
    const amount = parseFloat(row.amount);
    if (!Number.isNaN(weight) && !Number.isNaN(amount) && weight !== 0) {
      this.updateBuyerRow(index, { rate: String(roundOff(amount / weight)) });
    }
  }

  protected onBuyerAmountInput(index: number): void {
    const row = this.buyerRows()[index];
    if (row.qty.trim() !== '' && row.amount.trim() !== '') {
      this.recalcBuyerRowRate(index);
    }
  }

  protected recalcFarmerRowAmount(index: number): void {
    const row = this.farmerRows()[index];
    if (row.qty.trim() === '' || row.rate.trim() === '') {
      return;
    }
    const weight = parseFloat(row.qty);
    const rate = parseFloat(row.rate);
    if (!Number.isNaN(weight) && !Number.isNaN(rate)) {
      this.updateFarmerRow(index, { amount: String(roundOff(weight * rate)) });
    }
  }

  protected onFarmerAmountEnter(index: number): void {
    const rows = this.farmerRows();
    if (index !== rows.length - 1) {
      return;
    }
    this.addFarmerRow();
  }

  protected calculateAverage(): void {
    if (!this.flowerName().trim()) {
      this.toast.error(this.i18n.translate('fls.error.flower.required'));
      return;
    }
    this.validateFlower();
    if (this.flowerInvalid()) {
      this.toast.error(this.i18n.translate('sales.error.flower.notfound'));
      return;
    }
    if (!this.salesDate()) {
      this.toast.error(this.i18n.translate('fls.error.date.required'));
      return;
    }
    if (!this.avgRateAll()) {
      this.toast.error(this.i18n.translate('fls.error.no.buyer.rates'));
      return;
    }
    if (this.farmerRows().length === 0) {
      this.toast.error(this.i18n.translate('fls.error.no.farmer.rows'));
      return;
    }
    this.avgRate.set(this.avgRateAll());
    this.avgDialogOpen.set(true);
  }

  protected useThisRate(): void {
    this.applyRate(this.avgRate());
    this.avgDialogOpen.set(false);
    this.toast.success(
      this.i18n.translate('fls.rate.applied', this.formatRateParam(this.avgRate())),
    );
  }

  protected openRateDialog(): void {
    this.avgDialogOpen.set(false);
    this.customRate.set(String(this.avgRate()));
    this.rateDialogOpen.set(true);
  }

  protected confirmCustomRate(): void {
    const raw = this.customRate().trim();
    if (raw === '' || !isDecimal(raw)) {
      this.toast.error(this.i18n.translate('fls.error.invalid.rate'));
      return;
    }
    const value = parseFloat(raw);
    if (Number.isNaN(value)) {
      this.toast.error(this.i18n.translate('fls.error.invalid.rate'));
      return;
    }
    this.applyRate(value);
    this.rateDialogOpen.set(false);
    this.toast.success(this.i18n.translate('fls.custom.rate.applied', this.formatRateParam(value)));
  }

  private applyRate(value: number): void {
    this.farmerRows.update((rows) =>
      rows.map((row) => {
        if (row.qty.trim() !== '' && isDecimal(row.qty)) {
          const qty = parseFloat(row.qty);
          return { ...row, rate: String(value), amount: String(roundOff(qty * value)) };
        }
        return { ...row, rate: String(value) };
      }),
    );
  }

  protected closeRateDialog(): void {
    this.rateDialogOpen.set(false);
  }

  protected onRateOverlayClick(event: Event): void {
    if (event.target === event.currentTarget) {
      this.closeRateDialog();
    }
  }

  protected onAvgOverlayClick(event: Event): void {
    if (event.target === event.currentTarget) {
      this.avgDialogOpen.set(false);
    }
  }

  protected save(): void {
    if (this.saving()) {
      return;
    }
    if (!this.flowerName().trim()) {
      this.toast.error(this.i18n.translate('fls.error.flower.required'));
      return;
    }
    this.validateFlower();
    if (this.flowerInvalid()) {
      this.toast.error(this.i18n.translate('sales.error.flower.notfound'));
      return;
    }
    if (!this.salesDate()) {
      this.toast.error(this.i18n.translate('fls.error.date.required'));
      return;
    }

    const buyerRows = this.buyerRows();
    const filledBuyerRows = buyerRows.filter((row) => this.rowFilled(row.buyerName, row));
    if (filledBuyerRows.length === 0) {
      this.toast.error(this.i18n.translate('fls.error.no.buyer.rows'));
      return;
    }
    const buyerLines: FlowerLootRow[] = [];
    for (let i = 0; i < buyerRows.length; i++) {
      const row = buyerRows[i];
      if (!this.rowFilled(row.buyerName, row)) {
        continue;
      }
      const bag = row.bag.trim();
      const name = row.buyerName.trim();
      const qty = row.qty.trim();
      const rate = row.rate.trim();
      const amount = row.amount.trim();
      if (!name || !qty || !rate || !amount) {
        this.toast.error(this.i18n.translate('fls.error.buyer.incomplete.row', i + 1));
        return;
      }
      if (!this.matchesMaster(name, this.master().buyers)) {
        this.toast.error(this.i18n.translate('sales.error.buyer.notfound'));
        return;
      }
      if (!isDecimal(qty) || !isDecimal(rate) || !isDecimal(amount)) {
        this.toast.error(this.i18n.translate('fls.error.buyer.incomplete.row', i + 1));
        return;
      }
      if (parseFloat(amount) <= 0) {
        this.toast.error(this.i18n.translate('sales.error.amount.positive.row', i + 1));
        return;
      }
      buyerLines.push({ bag, name, qty, rate, amount });
    }

    const farmerRows = this.farmerRows();
    const filledFarmerRows = farmerRows.filter((row) => this.rowFilled(row.farmerName, row));
    if (filledFarmerRows.length === 0) {
      this.toast.error(this.i18n.translate('fls.error.farmer.required'));
      return;
    }
    const farmerLines: FlowerLootRow[] = [];
    for (let i = 0; i < farmerRows.length; i++) {
      const row = farmerRows[i];
      if (!this.rowFilled(row.farmerName, row)) {
        continue;
      }
      const bag = row.bag.trim();
      const name = row.farmerName.trim();
      const qty = row.qty.trim();
      const rate = row.rate.trim();
      const amount = row.amount.trim();
      if (!name || !qty) {
        this.toast.error(this.i18n.translate('fls.error.farmer.incomplete.row', i + 1));
        return;
      }
      if (!this.matchesMaster(name, this.master().farmers)) {
        this.toast.error(this.i18n.translate('sales.error.farmer.notfound'));
        return;
      }
      if (!isDecimal(qty)) {
        this.toast.error(this.i18n.translate('fls.error.farmer.incomplete.row', i + 1));
        return;
      }
      if (!rate || !amount || !isDecimal(rate) || !isDecimal(amount)) {
        this.toast.error(this.i18n.translate('fls.error.farmer.rate.required'));
        return;
      }
      if (parseFloat(amount) <= 0) {
        this.toast.error(this.i18n.translate('sales.error.amount.positive.row', i + 1));
        return;
      }
      farmerLines.push({ bag, name, qty, rate, amount });
    }

    this.saving.set(true);
    this.salesService
      .saveFlowerLoot({
        flowerName: this.flowerName().trim(),
        salesDate: this.salesDate(),
        buyerRows: buyerLines,
        farmerRows: farmerLines,
      })
      .subscribe({
        next: (response) => {
          this.saving.set(false);
          if (response.success) {
            this.toast.success(response.message);
            this.buyerRows.set([this.emptyBuyerRow()]);
            this.farmerRows.set([this.emptyFarmerRow()]);
          } else {
            this.toast.error(response.message);
          }
        },
        error: (error) => {
          this.saving.set(false);
          this.toast.error(
            extractErrorMessage(error, this.i18n.translate('fls.error.save.failed')),
          );
        },
      });
  }

  protected async printReport(format: ReceiptFormat): Promise<void> {
    const t = this.i18n.translate.bind(this.i18n);

    if (!this.flowerName().trim()) {
      this.toast.error(this.i18n.translate('fls.error.enter.details.print'));
      return;
    }

    const buyerLines = this.buyerRows().filter((row) => this.rowFilled(row.buyerName, row));
    const farmerLines = this.farmerRows().filter((row) => this.rowFilled(row.farmerName, row));
    if (buyerLines.length === 0 && farmerLines.length === 0) {
      this.toast.error(this.i18n.translate('fls.error.no.rows.print'));
      return;
    }

    let buyerHtml = '';
    buyerLines.forEach((row, i) => {
      buyerHtml +=
        '<tr>' +
        '<td class="left">' + (i + 1) + '</td>' +
        '<td class="left">' + (row.bag || '-') + '</td>' +
        '<td class="left">' + (row.buyerName || '-') + '</td>' +
        '<td class="right">' + (row.qty || '-') + '</td>' +
        '<td class="right">' + (row.rate || '-') + '</td>' +
        '<td class="right">' + (row.amount || '-') + '</td>' +
        '</tr>';
    });

    let farmerHtml = '';
    farmerLines.forEach((row, i) => {
      farmerHtml +=
        '<tr>' +
        '<td class="left">' + (i + 1) + '</td>' +
        '<td class="left">' + (row.bag || '-') + '</td>' +
        '<td class="left">' + (row.farmerName || '-') + '</td>' +
        '<td class="right">' + (row.qty || '-') + '</td>' +
        '<td class="right">' + (row.rate || '-') + '</td>' +
        '<td class="right">' + (row.amount || '-') + '</td>' +
        '</tr>';
    });

    const buyerSection = buyerLines.length > 0
      ? '<div class="section-title">' + t('fls.buyer.purchase') + '</div>' +
        '<table>' +
        '<colgroup><col style="width:8%"><col style="width:10%"><col style="width:30%"><col style="width:13%"><col style="width:15%"><col style="width:24%"></colgroup>' +
        '<thead><tr>' +
        '<th class="left">#</th>' +
        '<th class="left">' + t('sales.bag') + '</th>' +
        '<th class="left">' + t('fls.buyer.name') + '</th>' +
        '<th class="right">' + t('sales.qty') + '</th>' +
        '<th class="right">' + t('sales.rate') + '</th>' +
        '<th class="right">' + t('sales.amount') + '</th>' +
        '</tr></thead><tbody>' + buyerHtml + '</tbody></table>'
      : '';

    const farmerSection = farmerLines.length > 0
      ? '<div class="section-title">' + t('fls.farmer.sale') + '</div>' +
        '<table>' +
        '<colgroup><col style="width:8%"><col style="width:10%"><col style="width:30%"><col style="width:13%"><col style="width:15%"><col style="width:24%"></colgroup>' +
        '<thead><tr>' +
        '<th class="left">#</th>' +
        '<th class="left">' + t('sales.bag') + '</th>' +
        '<th class="left">' + t('farmer.name') + '</th>' +
        '<th class="right">' + t('sales.qty') + '</th>' +
        '<th class="right">' + t('sales.rate') + '</th>' +
        '<th class="right">' + t('sales.amount') + '</th>' +
        '</tr></thead><tbody>' + farmerHtml + '</tbody></table>'
      : '';

    const content =
      '<div class="print-info">' +
      '<span><strong>' + t('flower.name') + '</strong> ' + this.flowerName() + '</span>' +
      '<span><strong>' + t('report.date') + '</strong> ' + this.salesDate() + '</span>' +
      '</div>' +
      buyerSection +
      farmerSection;

    const result = await this.receipt.output(content, {
      title: t('fls.title'),
      fileBase: 'flower-loot-receipt',
      format,
    });
    if (result.status !== 'ok') {
      this.toast.error(result.message);
    }
  }

  private rowFilled(name: string, row: { qty: string; rate: string; amount: string }): boolean {
    return !!(name.trim() || row.qty.trim() || row.rate.trim() || row.amount.trim());
  }
}