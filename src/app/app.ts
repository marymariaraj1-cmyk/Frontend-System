import { Location } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';

import { LoaderComponent } from './core/components/loader/loader.component';
import { ToastComponent } from './core/components/toast/toast.component';

const LOCK_PATH = '/bloom-buddy';
const ROUTE_KEY = 'bb_last_route';
const DEFAULT_PATH = '/dashboard';
const LOGIN_PATH = '/login';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, LoaderComponent, ToastComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  protected readonly title = signal('BloomBuddy');

  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private restored = false;

  ngOnInit(): void {
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => {
        if (!this.restored) {
          this.restored = true;
          const stored = this.readStoredRoute();
          if (stored && stored !== event.url && stored !== DEFAULT_PATH && stored !== LOGIN_PATH) {
            this.router.navigateByUrl(stored);
            return;
          }
        }
        if (event.url !== LOGIN_PATH) {
          this.saveStoredRoute(event.url);
        }
        this.location.replaceState(LOCK_PATH);
      });
  }

  private readStoredRoute(): string | null {
    try {
      return sessionStorage.getItem(ROUTE_KEY);
    } catch {
      return null;
    }
  }

  private saveStoredRoute(route: string): void {
    try {
      sessionStorage.setItem(ROUTE_KEY, route);
    } catch {
      // ignore storage failures
    }
  }
}