import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { AutocompleteComponent } from '../../core/components/autocomplete/autocomplete.component';
import { DraggableDirective } from '../../core/directives/draggable.directive';
import { DataTableComponent, DataTableColumn } from '../../core/components/data-table/data-table.component';
import { FlowerLootSaleEditRow, SalesMasterData } from '../../core/models/sales';
import { I18nPipe } from '../../core/pipes/i18n.pipe';
import { FlowerLootSaleEditService } from '../../core/services/flower-loot-sale-edit.service';
import { I18nService } from '../../core/services/i18n.service';
import { ToastService } from '../../core/services/toast.service';
import { formatTotalWithPrecision, maxDecimalPlaces } from '../../core/utils/currency-format.util';
import { extractErrorMessage } from '../../core/utils/http-error.util';
import { roundOff } from '../../core/utils/round-off.util';
import { formatApiDate, isDecimal } from '../../core/utils/sales.util';

interface EditRow {
  salesId: number;
  bag: string;
  origBag: string;
  name: string;
  origName: string;
  qty: string;
  origQty: string;
  rate: string;
  origRate: string;
  amount: string;
  origAmount: string;
  enabled: boolean;
  edited: boolean;
  nameInvalid: boolean;
}

@Component({
  selector: 'app-flower-loot-sale-edit',
  standalone: true,
  imports: [FormsModule, I18nPipe, AutocompleteComponent, DraggableDirective, DataTableComponent],
  templateUrl: './flower-loot-sale-edit.html',
  styleUrl: './flower-loot-sale-edit.css',
})
export class FlowerLootSaleEditComponent implements OnInit {
  private readonly flowerLootSaleEditService = inject(FlowerLootSaleEditService);
  private readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);

  protected readonly master = signal<SalesMasterData>({
    farmers: [],
    flowers: [],
    buyers: [],
  });
  protected readonly flowerName = signal('');
  protected readonly flowerInvalid = signal(false);
  protected readonly salesDate = signal(formatApiDate(new Date()));
  protected readonly buyerRows = signal<EditRow[]>([]);
  protected readonly farmerRows = signal<EditRow[]>([]);

  protected readonly buyerTotals = computed(() => {
    let bag = 0;
    let qty = 0;
    let amount = 0;
    const qtyValues: string[] = [];
    const amountValues: string[] = [];
    for (const row of this.buyerRows()) {
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
    };
  });

  protected readonly farmerTotals = computed(() => {
    let bag = 0;
    let qty = 0;
    let amount = 0;
    const qtyValues: string[] = [];
    const amountValues: string[] = [];
    for (const row of this.farmerRows()) {
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
    };
  });

  protected readonly buyerColumns: DataTableColumn[] = [
    {
      key: 'sno',
      header: 'flower.sno',
      icon: 'format_list_numbered',
      type: 'text',
      align: 'center',
      width: '56px',
      className: 'col-center',
      sortable: false,
      filterable: false,
    },
    {
      key: 'bag',
      header: 'sales.bag',
      icon: 'shopping_basket',
      type: 'text',
      align: 'right',
      width: '90px',
      className: 'col-num',
      sortable: false,
      filterable: false,
    },
    {
      key: 'name',
      header: 'fls.buyer.name',
      icon: 'storefront',
      type: 'text',
      width: '26%',
      className: 'col-text col-name',
      sortable: false,
      filterable: false,
    },
    {
      key: 'qty',
      header: 'sales.qty',
      icon: 'weight',
      type: 'text',
      align: 'right',
      width: '100px',
      className: 'col-num',
      sortable: false,
      filterable: false,
    },
    {
      key: 'rate',
      header: 'sales.rate',
      icon: 'payments',
      type: 'text',
      align: 'right',
      width: '100px',
      className: 'col-num',
      sortable: false,
      filterable: false,
    },
    {
      key: 'amount',
      header: 'sales.amount',
      icon: 'currency_rupee',
      type: 'text',
      align: 'right',
      width: '110px',
      className: 'col-num',
      sortable: false,
      filterable: false,
    },
    {
      key: 'actions',
      header: 'flower.actions',
      icon: 'more_horiz',
      type: 'text',
      align: 'center',
      width: '110px',
      className: 'col-center col-actions',
      sortable: false,
      filterable: false,
    },
  ];

  protected readonly farmerColumns: DataTableColumn[] = [
    {
      key: 'sno',
      header: 'flower.sno',
      icon: 'format_list_numbered',
      type: 'text',
      align: 'center',
      width: '56px',
      className: 'col-center',
      sortable: false,
      filterable: false,
    },
    {
      key: 'bag',
      header: 'sales.bag',
      icon: 'shopping_basket',
      type: 'text',
      align: 'right',
      width: '90px',
      className: 'col-num',
      sortable: false,
      filterable: false,
    },
    {
      key: 'name',
      header: 'farmer.name',
      icon: 'agriculture',
      type: 'text',
      width: '26%',
      className: 'col-text col-name',
      sortable: false,
      filterable: false,
    },
    {
      key: 'qty',
      header: 'sales.qty',
      icon: 'weight',
      type: 'text',
      align: 'right',
      width: '100px',
      className: 'col-num',
      sortable: false,
      filterable: false,
    },
    {
      key: 'rate',
      header: 'sales.rate',
      icon: 'payments',
      type: 'text',
      align: 'right',
      width: '100px',
      className: 'col-num',
      sortable: false,
      filterable: false,
    },
    {
      key: 'amount',
      header: 'sales.amount',
      icon: 'currency_rupee',
      type: 'text',
      align: 'right',
      width: '110px',
      className: 'col-num',
      sortable: false,
      filterable: false,
    },
    {
      key: 'actions',
      header: 'flower.actions',
      icon: 'more_horiz',
      type: 'text',
      align: 'center',
      width: '110px',
      className: 'col-center col-actions',
      sortable: false,
      filterable: false,
    },
  ];
  protected readonly fetching = signal(false);
  protected readonly saving = signal(false);
  protected readonly deleting = signal(false);
  protected readonly deleteTarget = signal<EditRow | null>(null);
  protected readonly noData = signal(false);

  protected currentFlower = '';
  protected currentDate = '';

  ngOnInit(): void {
    this.loadMasterData();
  }

  private loadMasterData(): void {
    this.flowerLootSaleEditService.getMasterData().subscribe({
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
    const value = this.flowerName().trim();
    if (value !== '') {
      this.flowerInvalid.set(!this.matchesMaster(value, this.master().flowers));
    }
  }

  protected matchesMaster(value: string, list: string[]): boolean {
    const lower = value.trim().toLowerCase();
    return list.some((item) => item.toLowerCase() === lower);
  }

  protected updateBuyerRow(index: number, patch: Partial<EditRow>): void {
    this.buyerRows.update((rows) =>
      rows.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  }

  protected updateFarmerRow(index: number, patch: Partial<EditRow>): void {
    this.farmerRows.update((rows) =>
      rows.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  }

  protected fetchData(): void {
    if (this.fetching()) {
      return;
    }
    const flower = this.flowerName().trim();
    const date = this.salesDate();

    if (!flower) {
      this.toast.error(this.i18n.translate('fls.error.flower.required'));
      this.flowerInvalid.set(true);
      return;
    }
    if (!this.matchesMaster(flower, this.master().flowers)) {
      this.toast.error(this.i18n.translate('sales.error.flower.notfound'));
      this.flowerInvalid.set(true);
      return;
    }
    if (!date) {
      this.toast.error(this.i18n.translate('fls.error.date.required'));
      return;
    }

    this.fetching.set(true);
    this.flowerLootSaleEditService.fetch(flower, date).subscribe({
      next: (response) => {
        this.fetching.set(false);
        if (!response.success) {
          this.toast.error(response.message);
          return;
        }
        const data = response.data;
        this.buyerRows.set((data.buyerRows ?? []).map((entry) => this.mapRow(entry)));
        this.farmerRows.set((data.farmerRows ?? []).map((entry) => this.mapRow(entry)));
        this.currentFlower = flower;
        this.currentDate = date;
        const empty =
          (data.buyerRows ?? []).length === 0 && (data.farmerRows ?? []).length === 0;
        this.noData.set(empty);
        if (empty) {
          this.toast.error(this.i18n.translate('sales.edit.no.rows'));
        }
      },
      error: (error) => {
        this.fetching.set(false);
        this.toast.error(
          extractErrorMessage(error, this.i18n.translate('sales.edit.error.fetch.failed')),
        );
      },
    });
  }

  private mapRow(entry: FlowerLootSaleEditRow): EditRow {
    return {
      salesId: entry.salesId,
      bag: this.formatDecimal(entry.bag),
      origBag: this.formatDecimal(entry.bag),
      name: entry.name ?? '',
      origName: entry.name ?? '',
      qty: this.formatDecimal(entry.qty),
      origQty: this.formatDecimal(entry.qty),
      rate: this.formatDecimal(entry.rate),
      origRate: this.formatDecimal(entry.rate),
      amount: this.formatDecimal(entry.amount),
      origAmount: this.formatDecimal(entry.amount),
      enabled: false,
      edited: false,
      nameInvalid: false,
    };
  }

  private formatDecimal(value: unknown): string {
    if (value === null || value === undefined || value === '') {
      return '';
    }
    return String(value);
  }

  protected toggleRowEdit(section: 'buyer' | 'farmer', index: number): void {
    if (section === 'buyer') {
      const row = this.buyerRows()[index];
      if (row.enabled) {
        this.disableRowEdit('buyer', index);
      } else {
        this.updateBuyerRow(index, { enabled: true });
      }
    } else {
      const row = this.farmerRows()[index];
      if (row.enabled) {
        this.disableRowEdit('farmer', index);
      } else {
        this.updateFarmerRow(index, { enabled: true });
      }
    }
  }

  private disableRowEdit(section: 'buyer' | 'farmer', index: number): void {
    const edited = this.isEdited(section, index);
    if (section === 'buyer') {
      this.updateBuyerRow(index, { enabled: false, edited });
    } else {
      this.updateFarmerRow(index, { enabled: false, edited });
    }
  }

  protected markEdited(section: 'buyer' | 'farmer', index: number): void {
    const edited = this.isEdited(section, index);
    if (section === 'buyer') {
      this.updateBuyerRow(index, { edited });
    } else {
      this.updateFarmerRow(index, { edited });
    }
  }

  private isEdited(section: 'buyer' | 'farmer', index: number): boolean {
    const row = section === 'buyer' ? this.buyerRows()[index] : this.farmerRows()[index];
    return (
      row.bag !== row.origBag ||
      row.name.trim() !== row.origName.trim() ||
      row.qty !== row.origQty ||
      row.rate !== row.origRate ||
      row.amount !== row.origAmount
    );
  }

  protected validateName(section: 'buyer' | 'farmer', index: number): void {
    const row = section === 'buyer' ? this.buyerRows()[index] : this.farmerRows()[index];
    const value = row.name.trim();
    const list = section === 'buyer' ? this.master().buyers : this.master().farmers;
    const invalid = value !== '' && !this.matchesMaster(value, list);
    if (section === 'buyer') {
      this.updateBuyerRow(index, { nameInvalid: invalid });
    } else {
      this.updateFarmerRow(index, { nameInvalid: invalid });
    }
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

  protected sanitizeBag(value: string): string {
    return (value ?? '').replace(/[^0-9]/g, '');
  }

  protected recalcRowAmount(section: 'buyer' | 'farmer', index: number): void {
    const row = section === 'buyer' ? this.buyerRows()[index] : this.farmerRows()[index];
    if (!row.enabled) {
      return;
    }
    if (row.qty.trim() !== '' && row.rate.trim() !== '') {
      const qty = parseFloat(row.qty);
      const rate = parseFloat(row.rate);
      if (!Number.isNaN(qty) && !Number.isNaN(rate)) {
        if (section === 'buyer') {
          this.updateBuyerRow(index, { amount: String(roundOff(qty * rate)) });
        } else {
          this.updateFarmerRow(index, { amount: String(roundOff(qty * rate)) });
        }
      }
    }
    this.markEdited(section, index);
  }

  protected recalcRowRate(section: 'buyer' | 'farmer', index: number): void {
    const row = section === 'buyer' ? this.buyerRows()[index] : this.farmerRows()[index];
    if (!row.enabled) {
      return;
    }
    if (row.qty.trim() !== '' && row.amount.trim() !== '') {
      const qty = parseFloat(row.qty);
      const amount = parseFloat(row.amount);
      if (!Number.isNaN(qty) && !Number.isNaN(amount) && qty !== 0) {
        if (section === 'buyer') {
          this.updateBuyerRow(index, { rate: String(roundOff(amount / qty)) });
        } else {
          this.updateFarmerRow(index, { rate: String(roundOff(amount / qty)) });
        }
      }
    }
    this.markEdited(section, index);
  }

  protected onQtyChange(section: 'buyer' | 'farmer', index: number): void {
    const row = section === 'buyer' ? this.buyerRows()[index] : this.farmerRows()[index];
    if (!row.enabled || row.qty.trim() === '') {
      return;
    }
    if (row.rate.trim() !== '') {
      this.recalcRowAmount(section, index);
    } else if (row.amount.trim() !== '') {
      this.recalcRowRate(section, index);
    }
  }

  protected clearForm(): void {
    this.flowerName.set('');
    this.flowerInvalid.set(false);
    this.salesDate.set(formatApiDate(new Date()));
    this.buyerRows.set([]);
    this.farmerRows.set([]);
    this.currentFlower = '';
    this.currentDate = '';
    this.noData.set(true);
  }

  protected openDeleteConfirm(section: 'buyer' | 'farmer', index: number): void {
    const row = section === 'buyer' ? this.buyerRows()[index] : this.farmerRows()[index];
    if (row) {
      this.deleteTarget.set(row);
    }
  }

  protected closeDelete(): void {
    this.deleteTarget.set(null);
  }

  protected onDeleteOverlayClick(event: Event): void {
    if (event.target === event.currentTarget) {
      this.closeDelete();
    }
  }

  protected confirmDelete(): void {
    const row = this.deleteTarget();
    if (!row || this.deleting()) {
      return;
    }
    this.deleting.set(true);
    this.flowerLootSaleEditService.delete(row.salesId).subscribe({
      next: (response) => {
        this.deleting.set(false);
        if (response.success) {
          this.closeDelete();
          this.toast.success(response.message);
          this.fetchData();
        } else {
          this.toast.error(response.message);
        }
      },
      error: (error) => {
        this.deleting.set(false);
        this.toast.error(
          extractErrorMessage(error, this.i18n.translate('sales.edit.error.delete.failed')),
        );
      },
    });
  }

  protected save(): void {
    if (this.saving()) {
      return;
    }
    const flower = this.flowerName().trim();
    const date = this.salesDate();

    if (!flower) {
      this.toast.error(this.i18n.translate('fls.error.flower.required'));
      this.flowerInvalid.set(true);
      return;
    }
    if (!this.matchesMaster(flower, this.master().flowers)) {
      this.toast.error(this.i18n.translate('sales.error.flower.notfound'));
      this.flowerInvalid.set(true);
      return;
    }
    if (!date) {
      this.toast.error(this.i18n.translate('fls.error.date.required'));
      return;
    }
    if (
      !this.currentFlower ||
      this.currentFlower !== flower ||
      !this.currentDate ||
      this.currentDate !== date
    ) {
      this.toast.error(this.i18n.translate('sales.edit.error.fetch.first'));
      return;
    }

    const buyerEdits: FlowerLootSaleEditRow[] = [];
    const farmerEdits: FlowerLootSaleEditRow[] = [];

    for (let i = 0; i < this.buyerRows().length; i++) {
      const row = this.buyerRows()[i];
      if (!row.edited) {
        continue;
      }
      if (!this.validateEditableRow(row, i + 1, 'buyer', this.master().buyers)) {
        return;
      }
      buyerEdits.push({
        salesId: row.salesId,
        bag: row.bag.trim(),
        name: row.name.trim(),
        qty: row.qty.trim(),
        rate: row.rate.trim(),
        amount: row.amount.trim(),
      });
    }

    for (let i = 0; i < this.farmerRows().length; i++) {
      const row = this.farmerRows()[i];
      if (!row.edited) {
        continue;
      }
      if (!this.validateEditableRow(row, i + 1, 'farmer', this.master().farmers)) {
        return;
      }
      farmerEdits.push({
        salesId: row.salesId,
        bag: row.bag.trim(),
        name: row.name.trim(),
        qty: row.qty.trim(),
        rate: row.rate.trim(),
        amount: row.amount.trim(),
      });
    }

    if (buyerEdits.length === 0 && farmerEdits.length === 0) {
      this.toast.error(this.i18n.translate('sales.edit.error.no.edits'));
      return;
    }

    this.saving.set(true);
    this.flowerLootSaleEditService
      .save({ flowerName: flower, salesDate: date, buyerRows: buyerEdits, farmerRows: farmerEdits })
      .subscribe({
        next: (response) => {
          this.saving.set(false);
          if (response.success) {
            this.toast.success(response.message);
            this.fetchData();
          } else {
            this.toast.error(response.message);
          }
        },
        error: (error) => {
          this.saving.set(false);
          this.toast.error(
            extractErrorMessage(error, this.i18n.translate('fls.edit.error.save.failed')),
          );
        },
      });
  }

  private validateEditableRow(
    row: EditRow,
    rowNo: number,
    section: 'buyer' | 'farmer',
    list: string[],
  ): boolean {
    const bag = row.bag.trim();
    if (bag === '' || parseInt(bag, 10) <= 0) {
      this.toast.error(this.i18n.translate('bag.count.config.invalid.count'));
      return false;
    }
    const name = row.name.trim();
    if (!name) {
      this.toast.error(
        this.i18n.translate(
          section === 'buyer' ? 'fls.edit.error.buyer.name' : 'fls.edit.error.farmer.name',
          rowNo,
        ),
      );
      return false;
    }
    if (!this.matchesMaster(name, list)) {
      this.toast.error(
        this.i18n.translate(
          section === 'buyer'
            ? 'sales.error.buyer.notfound.row'
            : 'fls.edit.error.farmer.notfound.row',
          rowNo,
        ),
      );
      return false;
    }
    const qty = row.qty.trim();
    if (qty === '' || !isDecimal(qty)) {
      this.toast.error(this.i18n.translate('fls.edit.error.qty.row', rowNo));
      return false;
    }
    const rate = row.rate.trim();
    if (rate === '' || !isDecimal(rate)) {
      this.toast.error(this.i18n.translate('fls.edit.error.rate.row', rowNo));
      return false;
    }
    const amount = row.amount.trim();
    if (amount === '' || !isDecimal(amount)) {
      this.toast.error(this.i18n.translate('sales.error.amount.row', rowNo));
      return false;
    }
    if (parseFloat(amount) <= 0) {
      this.toast.error(this.i18n.translate('sales.error.amount.positive.row', rowNo));
      return false;
    }
    return true;
  }
}