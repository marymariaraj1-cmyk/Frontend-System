import { Component, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { I18nPipe } from '../pipes/i18n.pipe';
import { AuthService } from '../services/auth.service';
import { I18nService, Language } from '../services/i18n.service';

const TITLE_KEYS: Record<string, string> = {
  dashboard: 'sidebar.dashboard',
  flowers: 'sidebar.flower.master',
  farmers: 'sidebar.farmer.master',
  buyers: 'sidebar.buyer.master',
  clients: 'sidebar.client.master',
  'opening-balance': 'sidebar.opening.balance',
  'sales-entry': 'sidebar.sales.entry',
  'multi-sales': 'sidebar.multi.sales',
  'sales-details-edit': 'sidebar.sales.details.edit',
  'farmer-transaction': 'sidebar.farmer.transaction',
  'buyer-transaction': 'sidebar.buyer.transaction',
  'farmer-transaction-history': 'sidebar.farmer.txn.history',
  'buyer-transaction-history': 'sidebar.buyer.txn.history',
  'farmer-account-check': 'fac.title',
  'farmer-ledger-list': 'sidebar.updated.farmer.ledger.report',
  'buyer-ledger-list': 'sidebar.updated.buyer.ledger.report',
  'farmer-ledger-report': 'sidebar.farmer.ledger.report',
  'buyer-ledger-report': 'sidebar.buyer.ledger.report',
  'farmer-sales-report': 'sidebar.farmer.sales.report',
  'buyer-sales-report': 'sidebar.buyer.sales.report',
  'current-day-profit': 'sidebar.current.day.total.commission',
};

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, I18nPipe],
  templateUrl: './layout.html',
  styleUrl: './layout.css',
})
export class LayoutComponent {
  protected readonly auth = inject(AuthService);
  protected readonly i18n = inject(I18nService);

  private readonly router = inject(Router);
  private readonly openParents = new Set<string>();

  protected readonly collapsed = signal(
    typeof window !== 'undefined' ? window.innerWidth <= 1024 : false,
  );
  protected readonly titleKey = signal('sidebar.dashboard');

  constructor() {
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        const segment = event.urlAfterRedirects.split('?')[0].split('/')[1] ?? 'dashboard';
        this.titleKey.set(TITLE_KEYS[segment] ?? 'dashboard.title');
      }
    });
  }

  protected isParentOpen(name: string): boolean {
    return this.openParents.has(name);
  }

  protected toggleParent(name: string): void {
    if (this.openParents.has(name)) {
      this.openParents.delete(name);
    } else {
      this.openParents.add(name);
    }
  }

  protected toggleSidebar(): void {
    this.collapsed.set(!this.collapsed());
  }

  protected switchLang(lang: Language): void {
    this.i18n.switchLang(lang);
  }

  protected logout(): void {
    sessionStorage.removeItem('bb_farmer_ledger');
    sessionStorage.removeItem('bb_buyer_ledger');
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
