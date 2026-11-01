import { Injectable, inject, signal } from '@angular/core';

import { ApiService } from './api.service';

export type Language = 'en' | 'ta';

const MARKER_ALIASES: Record<string, string> = {
  'Flower Intake Sale': 'marker.flower.intake.sale',
  'Buyer Direct Sale': 'marker.buyer.direct.sale',
};

@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly api = inject(ApiService);

  readonly lang = signal<Language>(this.loadStoredLang());

  private readonly messages = signal<Record<string, string>>({});

  constructor() {
    this.load();
  }

  private loadStoredLang(): Language {
    try {
      const stored = localStorage.getItem('bb_lang');
      return stored === 'ta' ? 'ta' : 'en';
    } catch {
      return 'en';
    }
  }

  translate(key: string, ...args: (string | number)[]): string {
    this.lang();
    const resolvedKey = MARKER_ALIASES[key] ?? key;
    const message = this.messages()[resolvedKey] ?? resolvedKey;
    return message.replace(/\{(\d+)\}/g, (match, index: string) => {
      const arg = args[Number(index)];
      return arg !== undefined ? String(arg) : match;
    });
  }

  switchLang(lang: Language): void {
    this.lang.set(lang);
    try {
      localStorage.setItem('bb_lang', lang);
    } catch {
      // ignore
    }
    this.load();
  }

  private load(): void {
    this.api.getRaw<Record<string, string>>(`/i18n/messages?lang=${this.lang()}`).subscribe({
      next: (messages) => this.messages.set(messages),
      error: () => this.messages.set({}),
    });
  }
}
