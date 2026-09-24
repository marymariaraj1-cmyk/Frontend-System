import { Component, EventEmitter, Input, Output } from '@angular/core';

import { I18nPipe } from '../../pipes/i18n.pipe';
import { ReceiptFormat } from '../../services/receipt.service';

@Component({
  selector: 'app-receipt-print-buttons',
  standalone: true,
  imports: [I18nPipe],
  template: `
    <span class="rcpt-print-group">
      <button type="button" [class]="cssClass" [disabled]="disabled" (click)="print.emit('pdf')">
        <span class="material-symbols-rounded">print</span>
        {{ 'print.format.pdf' | i18n }}
      </button>
      <button type="button" [class]="cssClass" [disabled]="disabled" (click)="print.emit('image')">
        <span class="material-symbols-rounded">image</span>
        {{ 'print.format.image' | i18n }}
      </button>
    </span>
  `,
  styles: [
    `
      .rcpt-print-group {
        display: inline-flex;
        gap: 8px;
        align-items: center;
      }
    `,
  ],
})
export class ReceiptPrintButtonsComponent {
  @Input() cssClass = 'btn btn-secondary';
  @Input() disabled = false;
  @Output() print = new EventEmitter<ReceiptFormat>();
}
