import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { DataTableComponent, DataTableColumn } from '../../core/components/data-table/data-table.component';
import { Farmer, emptyFarmer } from '../../core/models/farmer';
import { I18nPipe } from '../../core/pipes/i18n.pipe';
import { FarmerService } from '../../core/services/farmer.service';
import { I18nService } from '../../core/services/i18n.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-farmers',
  standalone: true,
  imports: [FormsModule, I18nPipe, DataTableComponent],
  templateUrl: './farmers.html',
  styleUrl: './farmers.css',
})
export class FarmersComponent implements OnInit {
  private readonly farmerService = inject(FarmerService);
  private readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);

  protected readonly rows = signal<Farmer[]>([]);
  protected readonly showForm = signal(false);

  protected readonly columns: DataTableColumn[] = [
    {
      key: 'sno',
      header: 'farmer.sno',
      type: 'text',
      align: 'center',
      width: '50px',
      sortable: false,
      filterable: false,
    },
    {
      key: 'farmerName',
      header: 'farmer.name',
      type: 'text',
    },
    {
      key: 'farmerContactNo',
      header: 'farmer.contact',
      type: 'text',
    },
    {
      key: 'farmerAddress',
      header: 'farmer.address',
      type: 'text',
    },
    {
      key: 'actions',
      header: 'farmer.actions',
      type: 'text',
      align: 'center',
      width: '100px',
      sortable: false,
      filterable: false,
    },
  ];
  protected initials(name: string): string {
    return (name || '').trim().split(/\s+/).slice(0, 2).map((part) => part.charAt(0)).join('').toUpperCase() || '?';
  }

  protected form = emptyFarmer();
  protected editing = false;
  protected submitting = false;

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.farmerService.getFarmers().subscribe({
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
    this.form = emptyFarmer();
  }

  protected startEdit(row: Farmer): void {
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
    if (!this.form.farmerName?.trim()) {
      this.toast.error(this.i18n.translate('farmer.name.required'));
      return;
    }
    this.submitting = true;
    this.farmerService.saveFarmer(this.form).subscribe({
      next: (response) => {
        this.submitting = false;
        if (response.success) {
          this.toast.success(response.message);
          this.showForm.set(false);
          this.form = emptyFarmer();
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
