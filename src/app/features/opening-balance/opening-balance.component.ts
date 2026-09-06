import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { OpeningBalanceBuyerRow, OpeningBalanceFarmerRow } from '../../core/models/opening-balance';
import { I18nPipe } from '../../core/pipes/i18n.pipe';
import { I18nService } from '../../core/services/i18n.service';
import { OpeningBalanceService } from '../../core/services/opening-balance.service';
import { ToastService } from '../../core/services/toast.service';
import { formatCurrency } from '../../core/utils/currency-format.util';
import { extractErrorMessage } from '../../core/utils/http-error.util';

@Component({
  selector: 'app-opening-balance',
  standalone: true,
  imports: [FormsModule, I18nPipe],
  templateUrl: './opening-balance.html',
  styleUrl: './opening-balance.css',
})
export class OpeningBalanceComponent implements OnInit {
  private readonly openingBalanceService = inject(OpeningBalanceService);
  private readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);

  protected readonly farmers = signal<OpeningBalanceFarmerRow[]>([]);
  protected readonly buyers = signal<OpeningBalanceBuyerRow[]>([]);
  protected readonly section = signal<'farmer' | 'buyer'>('farmer');
  protected readonly farmerSearch = signal('');
  protected readonly buyerSearch = signal('');
  protected readonly filteredFarmers = computed(() => {
    const term = this.farmerSearch().trim().toLowerCase();
    if (!term) {
      return this.farmers();
    }
    return this.farmers().filter((row) =>
      (row.farmerName ?? '').toLowerCase().includes(term),
    );
  });
  protected readonly filteredBuyers = computed(() => {
    const term = this.buyerSearch().trim().toLowerCase();
    if (!term) {
      return this.buyers();
    }
    return this.buyers().filter((row) =>
      (row.buyerName ?? '').toLowerCase().includes(term),
    );
  });
  protected farmerEdits: Record<string, string> = {};
  protected buyerEdits: Record<string, string> = {};
  protected farmerDateEdits: Record<string, string> = {};
  protected buyerDateEdits: Record<string, string> = {};
  protected savingFarmerId = '';
  protected savingBuyerId = '';

  protected readonly formatCurrency = formatCurrency;

protected initials(name: string): string {
    return (name || '').trim().split(/\s+/).slice(0, 2).map((part) => part.charAt(0)).join('').toUpperCase() || '?';
  }

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.openingBalanceService.getFarmers().subscribe({
      next: (response) => {
        if (response.success) {
          this.farmers.set(response.data);
          this.syncFarmerEdits(response.data);
        }
      },
      error: () => this.toast.error(this.i18n.translate('common.load.failed')),
    });
    this.openingBalanceService.getBuyers().subscribe({
      next: (response) => {
        if (response.success) {
          this.buyers.set(response.data);
          this.syncBuyerEdits(response.data);
        }
      },
      error: () => this.toast.error(this.i18n.translate('common.load.failed')),
    });
  }

  private syncFarmerEdits(rows: OpeningBalanceFarmerRow[]): void {
    const edits: Record<string, string> = {};
    const dates: Record<string, string> = {};
    for (const row of rows) {
      edits[row.farmerId] = row.openingBalance != null ? String(row.openingBalance) : '0';
      dates[row.farmerId] = row.openingBalanceDate ?? '';
    }
    this.farmerEdits = edits;
    this.farmerDateEdits = dates;
  }

  private syncBuyerEdits(rows: OpeningBalanceBuyerRow[]): void {
    const edits: Record<string, string> = {};
    const dates: Record<string, string> = {};
    for (const row of rows) {
      edits[row.buyerId] = row.openingBalance != null ? String(row.openingBalance) : '0';
      dates[row.buyerId] = row.openingBalanceDate ?? '';
    }
    this.buyerEdits = edits;
    this.buyerDateEdits = dates;
  }

  protected saveFarmer(row: OpeningBalanceFarmerRow): void {
    if (this.savingFarmerId) {
      return;
    }
    const value = (this.farmerEdits[row.farmerId] ?? '').trim();
    const date = (this.farmerDateEdits[row.farmerId] ?? '').trim();
    if (value === '' || Number.isNaN(Number(value)) || Number(value) <= 0) {
      this.toast.error(this.i18n.translate('opening.balance.config.invalid.amount'));
      return;
    }
    if (!date || !this.isValidDate(date)) {
      this.toast.error(this.i18n.translate('opening.balance.config.invalid.date'));
      return;
    }
    this.savingFarmerId = row.farmerId;
    this.openingBalanceService.saveFarmer(row.farmerId, value, date).subscribe({
      next: (response) => {
        this.savingFarmerId = '';
        if (response.success) {
          this.toast.success(response.message);
          this.load();
        } else {
          this.toast.error(response.message);
        }
      },
      error: (error) => {
        this.savingFarmerId = '';
        this.toast.error(extractErrorMessage(error, this.i18n.translate('opening.balance.config.save.failed')));
      },
    });
  }

  protected saveBuyer(row: OpeningBalanceBuyerRow): void {
    if (this.savingBuyerId) {
      return;
    }
    const value = (this.buyerEdits[row.buyerId] ?? '').trim();
    const date = (this.buyerDateEdits[row.buyerId] ?? '').trim();
    if (value === '' || Number.isNaN(Number(value)) || Number(value) <= 0) {
      this.toast.error(this.i18n.translate('opening.balance.config.invalid.amount'));
      return;
    }
    if (!date || !this.isValidDate(date)) {
      this.toast.error(this.i18n.translate('opening.balance.config.invalid.date'));
      return;
    }
    this.savingBuyerId = row.buyerId;
    this.openingBalanceService.saveBuyer(row.buyerId, value, date).subscribe({
      next: (response) => {
        this.savingBuyerId = '';
        if (response.success) {
          this.toast.success(response.message);
          this.load();
        } else {
          this.toast.error(response.message);
        }
      },
      error: (error) => {
        this.savingBuyerId = '';
        this.toast.error(extractErrorMessage(error, this.i18n.translate('opening.balance.config.save.failed')));
      },
    });
  }

  protected resetFarmer(row: OpeningBalanceFarmerRow): void {
    this.farmerEdits[row.farmerId] = String(row.openingBalance ?? 0);
    this.farmerDateEdits[row.farmerId] = row.openingBalanceDate ?? '';
  }

  protected resetBuyer(row: OpeningBalanceBuyerRow): void {
    this.buyerEdits[row.buyerId] = String(row.openingBalance ?? 0);
    this.buyerDateEdits[row.buyerId] = row.openingBalanceDate ?? '';
  }

  private isValidDate(date: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return false;
    }
    const parsed = new Date(`${date}T00:00:00`);
    return !Number.isNaN(parsed.getTime());
  }
}
