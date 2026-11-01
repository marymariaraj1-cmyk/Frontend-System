import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import {
  CashBookFieldConfig,
  CashBookFieldType,
} from '../../core/models/cash-book-field-config';
import { I18nPipe } from '../../core/pipes/i18n.pipe';
import { CashBookFieldConfigService } from '../../core/services/cash-book-field-config.service';
import { I18nService } from '../../core/services/i18n.service';
import { ToastService } from '../../core/services/toast.service';
import { extractErrorMessage } from '../../core/utils/http-error.util';

@Component({
  selector: 'app-cash-book-field-config',
  standalone: true,
  imports: [FormsModule, I18nPipe],
  templateUrl: './cash-book-field-config.html',
  styleUrl: './cash-book-field-config.css',
})
export class CashBookFieldConfigComponent implements OnInit {
  private readonly service = inject(CashBookFieldConfigService);
  private readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);

  protected readonly fields = signal<CashBookFieldConfig[]>([]);
  protected readonly loading = signal(false);
  protected readonly adding = signal(false);
  protected readonly deleting = signal(false);

  protected readonly addLabel = signal('');
  protected readonly addLabelTa = signal('');
  protected readonly addType = signal<CashBookFieldType>('DEBIT');

  protected readonly editingId = signal<number | null>(null);
  protected readonly editLabel = signal('');
  protected readonly editLabelTa = signal('');

  protected readonly deleteTarget = signal<CashBookFieldConfig | null>(null);

  protected readonly debitFields = computed(() =>
    this.fields().filter((f) => f.fieldType === 'DEBIT'),
  );
  protected readonly creditFields = computed(() =>
    this.fields().filter((f) => f.fieldType === 'CREDIT'),
  );

  ngOnInit(): void {
    this.load();
  }

  protected addField(): void {
    const label = this.validateLabel(this.addLabel());
    if (label === null) {
      return;
    }
    const type = this.addType();
    if (this.isDuplicate(type, label, null)) {
      this.toast.error(this.i18n.translate('cbcfg.err.duplicate'));
      return;
    }
    const side = type === 'DEBIT' ? this.debitFields() : this.creditFields();
    if (side.length >= 25) {
      this.toast.error(this.i18n.translate('cbcfg.err.max'));
      return;
    }
    this.adding.set(true);
    this.service
      .create({
        label,
        labelTa: this.nullIfBlank(this.addLabelTa()),
        fieldType: type,
      })
      .subscribe({
        next: (response) => {
          this.adding.set(false);
          if (response.success) {
            this.addLabel.set('');
            this.addLabelTa.set('');
            this.toast.success(this.i18n.translate('cbcfg.added'));
            this.load();
          } else {
            this.toast.error(response.message);
          }
        },
        error: (error) => {
          this.adding.set(false);
          this.toast.error(extractErrorMessage(error, this.i18n.translate('cbcfg.added')));
        },
      });
  }

  protected beginEdit(field: CashBookFieldConfig): void {
    this.editingId.set(field.fieldConfigId);
    this.editLabel.set(field.label);
    this.editLabelTa.set(field.labelTa ?? '');
    if (field.inUse) {
      this.toast.success(this.i18n.translate('cbcfg.edit.keep.old.label'));
    }
  }

  protected cancelEdit(): void {
    this.editingId.set(null);
  }

  protected saveEdit(field: CashBookFieldConfig): void {
    const label = this.validateLabel(this.editLabel());
    if (label === null) {
      return;
    }
    if (this.isDuplicate(field.fieldType, label, field.fieldConfigId)) {
      this.toast.error(this.i18n.translate('cbcfg.err.duplicate'));
      return;
    }
    this.service
      .update({
        fieldConfigId: field.fieldConfigId,
        label,
        labelTa: this.nullIfBlank(this.editLabelTa()),
        fieldType: field.fieldType,
      })
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.editingId.set(null);
            this.toast.success(this.i18n.translate('cbcfg.updated'));
            this.load();
          } else {
            this.toast.error(response.message);
          }
        },
        error: (error) => {
          this.toast.error(extractErrorMessage(error, this.i18n.translate('cbcfg.updated')));
        },
      });
  }

  protected move(field: CashBookFieldConfig, direction: -1 | 1): void {
    const list = field.fieldType === 'DEBIT' ? this.debitFields() : this.creditFields();
    const index = list.findIndex((f) => f.fieldConfigId === field.fieldConfigId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= list.length) {
      return;
    }
    const ids = list.map((f) => f.fieldConfigId);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    this.service.reorder(field.fieldType, ids).subscribe({
      next: (response) => {
        if (response.success) {
          this.toast.success(this.i18n.translate('cbcfg.reordered'));
          this.load();
        } else {
          this.toast.error(response.message);
        }
      },
      error: (error) => {
        this.toast.error(extractErrorMessage(error, this.i18n.translate('cbcfg.reordered')));
      },
    });
  }

  protected openDelete(field: CashBookFieldConfig): void {
    if (field.inUse) {
      return;
    }
    this.deleteTarget.set(field);
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
    const target = this.deleteTarget();
    if (!target || this.deleting()) {
      return;
    }
    this.deleting.set(true);
    this.service.remove(target.fieldConfigId).subscribe({
      next: (response) => {
        this.deleting.set(false);
        if (response.success) {
          this.closeDelete();
          this.toast.success(this.i18n.translate('cbcfg.deleted'));
          this.load();
        } else {
          this.toast.error(response.message);
        }
      },
      error: (error) => {
        this.deleting.set(false);
        this.toast.error(extractErrorMessage(error, this.i18n.translate('cbcfg.deleted')));
      },
    });
  }

  protected isEditable(field: CashBookFieldConfig): boolean {
    return this.editingId() === field.fieldConfigId;
  }

  private load(): void {
    this.loading.set(true);
    this.service.list().subscribe({
      next: (response) => {
        this.loading.set(false);
        if (response.success) {
          this.fields.set(response.data);
        } else {
          this.toast.error(response.message);
        }
      },
      error: (error) => {
        this.loading.set(false);
        this.toast.error(extractErrorMessage(error, this.i18n.translate('common.load.failed')));
      },
    });
  }

  private validateLabel(value: string): string | null {
    const label = (value ?? '').trim();
    if (label.length < 1 || label.includes('=') || label.includes('&')) {
      this.toast.error(this.i18n.translate('cbcfg.err.label'));
      return null;
    }
    if (label.length > 50) {
      this.toast.error(this.i18n.translate('cbcfg.label.max'));
      return null;
    }
    return label;
  }

  private isDuplicate(type: CashBookFieldType, label: string, excludeId: number | null): boolean {
    const side = type === 'DEBIT' ? this.debitFields() : this.creditFields();
    const normalized = label.toLowerCase();
    return side.some(
      (f) => f.fieldConfigId !== excludeId && f.label.toLowerCase() === normalized,
    );
  }

  private nullIfBlank(value: string): string | null {
    const trimmed = (value ?? '').trim();
    return trimmed === '' ? null : trimmed;
  }
}