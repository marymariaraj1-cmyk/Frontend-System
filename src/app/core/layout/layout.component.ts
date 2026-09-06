import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { I18nPipe } from '../pipes/i18n.pipe';
import { AuthService } from '../services/auth.service';
import { I18nService, Language } from '../services/i18n.service';

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
