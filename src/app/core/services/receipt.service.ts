import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { ShopProfile } from '../models/shop-profile';
import { printHtml } from '../utils/print.util';
import { AuthService } from './auth.service';
import { ClientProfileService } from './client-profile.service';
import { I18nService } from './i18n.service';
import { PaperSize, PaperSizeService } from './paper-size.service';

export type ReceiptFormat = 'pdf' | 'image';

export interface ReceiptPaperSpec {
  pageSize: string;
  bodyWidth: string;
  winWidth: number;
}

const PAPER_SPECS: Record<PaperSize, ReceiptPaperSpec> = {
  '3in': { pageSize: '76mm auto', bodyWidth: '72mm', winWidth: 340 },
  '4in': { pageSize: '108mm auto', bodyWidth: '101mm', winWidth: 460 },
};

export interface ReceiptOutput {
  status: 'ok' | 'blocked' | 'error';
  message: string;
}

@Injectable({ providedIn: 'root' })
export class ReceiptService {
  private readonly paperSize = inject(PaperSizeService);
  private readonly clientProfile = inject(ClientProfileService);
  private readonly auth = inject(AuthService);
  private readonly i18n = inject(I18nService);

  spec(): ReceiptPaperSpec {
    return PAPER_SPECS[this.paperSize.size()];
  }

  /** Fetch fresh shop profile; fall back to the session shop name on failure. */
  async shopProfile(): Promise<ShopProfile> {
    const fallback: ShopProfile = {
      shopName: this.auth.user()?.shopName ?? '',
      shopAddress: '',
      contactNo: '',
    };
    try {
      const response = await firstValueFrom(this.clientProfile.getShopProfile());
      if (response.success && response.data) {
        return {
          shopName: response.data.shopName ?? fallback.shopName,
          shopAddress: response.data.shopAddress ?? '',
          contactNo: response.data.contactNo ?? '',
        };
      }
    } catch {
      // fall through to session fallback
    }
    return fallback;
  }

  billNo(): string {
    const now = new Date();
    const pad = (n: number, len = 2): string => String(n).padStart(len, '0');
    const stamp =
      `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
      `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const suffix = Math.floor(100 + Math.random() * 900);
    return `${stamp}${suffix}`;
  }

  billDateTime(): { date: string; time: string } {
    const now = new Date();
    const pad = (n: number): string => String(n).padStart(2, '0');
    const date = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;
    let hours = now.getHours();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    if (hours === 0) {
      hours = 12;
    }
    const time = `${pad(hours)}:${pad(now.getMinutes())}:${pad(now.getSeconds())} ${ampm}`;
    return { date, time };
  }

  headerHtml(profile: ShopProfile, billNo: string, date: string, time: string): string {
    const t = this.i18n.translate.bind(this.i18n);
    const esc = ReceiptService.escape;
    let html =
      `<div class="rcpt-shop">` +
      `<h2>${esc(profile.shopName)}</h2>`;
    if ((profile.shopAddress ?? '').trim() !== '') {
      html += `<p>${esc(profile.shopAddress)}</p>`;
    }
    if ((profile.contactNo ?? '').trim() !== '') {
      html += `<p>${esc(t('receipt.mobile'))}: ${esc(profile.contactNo)}</p>`;
    }
    html +=
      `</div>` +
      `<div class="rcpt-meta">` +
      `<div><span>${esc(t('receipt.bill.no'))}: ${esc(billNo)}</span></div>` +
      `<div><span>${esc(t('receipt.date'))}: ${esc(date)}</span></div>` +
      `<div><span>${esc(t('receipt.time'))}: ${esc(time)}</span></div>` +
      `</div>`;
    return html;
  }

  footerHtml(): string {
    const t = this.i18n.translate.bind(this.i18n);
    const esc = ReceiptService.escape;
    return `<div class="rcpt-footer"><div>${esc(t('receipt.thanks'))}</div></div>`;
  }

  styleHtml(spec: ReceiptPaperSpec): string {
    return (
      `<style>` +
      `@page{size:${spec.pageSize};margin:0;}` +
      `html{margin:0;padding:0;}` +
      `body{margin:0;padding:2mm 1.5mm;width:${spec.bodyWidth};box-sizing:border-box;` +
      `font-family:"Courier New",monospace;font-size:9px;line-height:1.4;color:#000;background:#fff;}` +
      `.rcpt-shop{text-align:center;border-bottom:1px dashed #000;padding-bottom:4px;margin-bottom:4px;}` +
      `.rcpt-shop h2{font-size:13px;margin:0 0 2px;font-weight:700;letter-spacing:0.5px;}` +
      `.rcpt-shop p{font-size:8px;margin:1px 0;color:#222;}` +
      `.rcpt-meta{border-bottom:1px dashed #000;padding-bottom:4px;margin-bottom:5px;font-size:8px;line-height:1.5;text-align:right;}` +
      `.rcpt-meta span{display:block;}` +
      `table{width:100%;border-collapse:collapse;margin:0 0 6px;font-size:8.5px;table-layout:fixed;}` +
      `th,td{padding:3px 2.5px;vertical-align:top;word-wrap:break-word;overflow-wrap:break-word;}` +
      `th{border-bottom:1.5px solid #000;font-weight:700;font-size:8px;text-transform:uppercase;letter-spacing:0.3px;}` +
      `th.left,td.left{text-align:left;}` +
      `th.right,td.right{text-align:right;}` +
      `tbody tr{border-bottom:0.5px dotted #ccc;}` +
      `tbody tr:last-child{border-bottom:none;}` +
      `.divider{border-top:1px dashed #000;margin:6px 0;}` +
      `.rcpt-footer{text-align:center;margin-top:8px;font-size:8px;line-height:1.5;border-top:1px dashed #000;padding-top:5px;}` +
      `.print-info{margin-bottom:6px;font-size:8px;line-height:1.5;}` +
      `.print-info span{display:block;}` +
      `.print-info strong{font-size:8px;}` +
      `.print-header{text-align:center;border-bottom:1px dashed #000;padding-bottom:5px;margin-bottom:5px;}` +
      `.print-header h2{font-size:12px;margin:0 0 2px;font-weight:700;letter-spacing:0.5px;}` +
      `.print-header p{font-size:8px;margin:1px 0;color:#333;}` +
      `.summary-table{width:100%;border-collapse:collapse;font-size:8px;margin:0 0 4px;}` +
      `.summary-table td{padding:2px 2px;border:none;}` +
      `.summary-table td.lbl{width:40%;text-align:left;}` +
      `.summary-table td.wgt{width:20%;text-align:center;}` +
      `.summary-table td.amt{width:40%;text-align:right;}` +
      `.summary-table tr.final td{font-size:10px;font-weight:700;border-top:1px solid #000;padding-top:4px;}` +
      `.summary-table td.desc{width:46%;text-align:left;font-size:7px;color:#555;}` +
      `.total-row td{border-top:1px solid #000;padding-top:3px;}` +
      `.summary-line{margin:8px 0 4px;text-align:right;font-weight:700;font-size:10px;border-top:1px solid #000;padding-top:6px;}` +
      `.bl-title{font-size:8px;font-weight:700;text-align:center;text-transform:uppercase;letter-spacing:0.4px;margin:6px 0 3px;border-top:1px dashed #000;padding-top:5px;}` +
      `.section-title{font-size:9px;font-weight:700;text-align:center;text-transform:uppercase;letter-spacing:0.4px;margin:6px 0 3px;border-top:1px dashed #000;padding-top:5px;}` +
      `.summary{margin:0 0 4px;}` +
      `.summary p{display:flex;justify-content:flex-end;gap:8px;margin:2px 0;font-size:8px;line-height:1.4;}` +
      `.summary p strong{min-width:40px;text-align:right;}` +
      `.summary .final{font-size:10px;font-weight:700;border-top:1px solid #000;padding-top:4px;margin-top:4px;gap:10px;}` +
      `.summary .final strong{min-width:45px;}` +
      `.bl-head{display:flex;justify-content:space-between;gap:8px;align-items:flex-start;margin-bottom:6px;}` +
      `.bl-block{display:block;}` +
      `.rcpt-total{font-size:10px;font-weight:700;text-align:right;border-top:1px solid #000;padding-top:3px;margin-top:3px;}` +
      `@media print{html,body{width:fit-content;margin:0;padding:0;}}` +
      `</style>`
    );
  }

  /** Build the full receipt document (without the auto-print script). */
  async buildDocument(title: string, contentHtml: string): Promise<{ doc: string; billNo: string }> {
    const spec = this.spec();
    const profile = await this.shopProfile();
    const billNo = this.billNo();
    const { date, time } = this.billDateTime();
    const doc =
      `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${ReceiptService.escape(title)}</title>` +
      this.styleHtml(spec) +
      `</head><body>` +
      this.headerHtml(profile, billNo, date, time) +
      contentHtml +
      this.footerHtml() +
      `</body></html>`;
    return { doc, billNo };
  }

  /**
   * Output a receipt in the requested format using the selected paper width
   * and the shared global header/footer. Content HTML is the screen-specific
   * main content only (no header/footer/style).
   */
  async output(
    contentHtml: string,
    opts: { title: string; fileBase: string; format: ReceiptFormat },
  ): Promise<ReceiptOutput> {
    try {
      const spec = this.spec();
      const { doc, billNo } = await this.buildDocument(opts.title, contentHtml);
      if (opts.format === 'pdf') {
        const opened = printHtml(doc, spec.winWidth);
        return opened
          ? { status: 'ok', message: '' }
          : { status: 'blocked', message: this.i18n.translate('sales.error.print.blocked') };
      }
      return this.openImage(doc, spec, opts.title, `${opts.fileBase}-${billNo}.png`);
    } catch {
      return { status: 'error', message: this.i18n.translate('receipt.image.failed') };
    }
  }

  private async renderCanvas(docHtml: string, spec: ReceiptPaperSpec): Promise<HTMLCanvasElement> {
    const { default: html2canvas } = await import('html2canvas');
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText =
      `position:fixed;left:-10000px;top:0;width:${spec.bodyWidth};` +
      `border:0;margin:0;padding:0;visibility:hidden;`;
    document.body.appendChild(frame);
    try {
      const frameDoc = frame.contentDocument;
      if (!frameDoc) {
        throw new Error('print frame unavailable');
      }
      frameDoc.open();
      frameDoc.write(docHtml);
      frameDoc.close();
      await new Promise((resolve) => setTimeout(resolve, 120));
      const target = frameDoc.body;
      frame.style.height = `${target.scrollHeight}px`;
      return await html2canvas(target, {
        backgroundColor: '#ffffff',
        scale: 2,
        logging: false,
      });
    } finally {
      frame.remove();
    }
  }

  /** Render the receipt to PNG and open a popup showing it, ready to print or save. */
  private async openImage(
    docHtml: string,
    spec: ReceiptPaperSpec,
    title: string,
    filename: string,
  ): Promise<ReceiptOutput> {
    let canvas: HTMLCanvasElement;
    try {
      canvas = await this.renderCanvas(docHtml, spec);
    } catch {
      return { status: 'error', message: this.i18n.translate('receipt.image.failed') };
    }
    let url: string;
    try {
      url = canvas.toDataURL('image/png');
    } catch {
      return { status: 'error', message: this.i18n.translate('receipt.image.failed') };
    }
    const cssWidth = Math.round(canvas.width / 2);
    const cssHeight = Math.round(canvas.height / 2) + 64;
    const win = window.open(
      '',
      '_blank',
      `width=${Math.max(cssWidth, 320)},height=${Math.min(Math.max(cssHeight, 420), 900)}`,
    );
    if (!win) {
      return { status: 'blocked', message: this.i18n.translate('sales.error.print.blocked') };
    }
    const t = this.i18n.translate.bind(this.i18n);
    const view =
      `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${ReceiptService.escape(title)}</title>` +
      `<style>` +
      `html,body{margin:0;padding:0;background:#fff;}` +
      `.rcpt-bar{position:sticky;top:0;z-index:2;display:flex;gap:10px;padding:8px 14px;` +
      `background:#eef2f6;border-bottom:1px solid #cdd5dd;align-items:center;}` +
      `.rcpt-bar button,.rcpt-bar a{border:1px solid #9aa5b1;background:#fff;border-radius:4px;` +
      `padding:6px 14px;font-size:13px;cursor:pointer;text-decoration:none;color:#111;}` +
      `#rcpt-img{display:block;margin:12px auto 24px;width:${cssWidth}px;max-width:100%;height:auto;}` +
      `@media print{.rcpt-bar{display:none!important;}#rcpt-img{margin:0;}}` +
      `</style></head><body>` +
      `<div class="rcpt-bar">` +
      `<button type="button" onclick="window.print()">${ReceiptService.escape(t('btn.print'))}</button>` +
      `<a id="rcpt-save" href="${url}" download="${ReceiptService.escape(filename)}">` +
      `${ReceiptService.escape(t('print.image.save'))}</a>` +
      `</div>` +
      `<img id="rcpt-img" alt="" src="${url}">` +
      `<script>window.onload=function(){window.print();};<\/script>` +
      `</body></html>`;
    win.document.write(view);
    win.document.close();
    return { status: 'ok', message: '' };
  }

  private static escape(value: string | null | undefined): string {
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
}
