import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { Buyer, emptyBuyer } from '../../core/models/buyer';
import { I18nPipe } from '../../core/pipes/i18n.pipe';
import { BuyerService } from '../../core/services/buyer.service';
import { I18nService } from '../../core/services/i18n.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-buyers',
  standalone: true,
  imports: [FormsModule, I18nPipe],
  templateUrl: './buyers.html',
  styleUrl: './buyers.css',
})
export class BuyersComponent implements OnInit {
  private readonly buyerService = inject(BuyerService);
  private readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);

  protected readonly rows = signal<Buyer[]>([]);
  protected readonly showForm = signal(false);
  protected readonly nameFilter = signal('');
  protected readonly contactFilter = signal('');
  protected readonly addressFilter = signal('');
  protected readonly filteredRows = computed(() => {
    const name = this.nameFilter().trim().toLowerCase();
    const contact = this.contactFilter().trim().toLowerCase();
    const address = this.addressFilter().trim().toLowerCase();
    return this.rows().filter((row) => {
      const matchName = !name || (row.buyerName ?? '').toLowerCase().includes(name);
      const matchContact = !contact || (row.buyerContactNo ?? '').toLowerCase().includes(contact);
      const matchAddress = !address || (row.buyerAddress ?? '').toLowerCase().includes(address);
      return matchName && matchContact && matchAddress;
    });
  });
  protected initials(name: string): string {
    return (name || '').trim().split(/\s+/).slice(0, 2).map((part) => part.charAt(0)).join('').toUpperCase() || '?';
  }

  protected form = emptyBuyer();
  protected editing = false;
  protected submitting = false;

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.buyerService.getBuyers().subscribe({
      next: (response) => {
        if (response.success) {
          this.rows.set(response.data);
        } else {
          this.toast.error(response.message);
        }
      },
      error: () => this.toast.error(this.i18n.translate('common.load.failed')),
    });
  }

  protected startAdd(): void {
    this.editing = false;
    this.showForm.set(true);
    this.form = emptyBuyer();
  }

  protected startEdit(row: Buyer): void {
    this.editing = true;
    this.showForm.set(true);
    this.form = { ...row };
  }

  protected cancel(): void {
    this.showForm.set(false);
  }

  protected submit(): void {
    if (this.submitting) {
      return;
    }
    if (!this.form.buyerName?.trim()) {
      this.toast.error(this.i18n.translate('buyer.name.required'));
      return;
    }
    this.submitting = true;
    this.buyerService.saveBuyer(this.form).subscribe({
      next: (response) => {
        this.submitting = false;
        if (response.success) {
          this.toast.success(response.message);
          this.showForm.set(false);
          this.form = emptyBuyer();
          this.load();
        } else {
          this.toast.error(response.message);
        }
      },
      error: () => {
        this.submitting = false;
        this.toast.error(this.i18n.translate('common.save.failed'));
      },
    });
  }
}
