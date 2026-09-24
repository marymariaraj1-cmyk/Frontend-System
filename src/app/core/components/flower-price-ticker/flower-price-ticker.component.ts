import { Component, OnInit, effect, inject, signal } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';

import { FlowerPriceTickerEntry } from '../../models/flower-price-config';
import { AuthService } from '../../services/auth.service';
import { FlowerPriceConfigService } from '../../services/flower-price-config.service';

@Component({
  selector: 'app-flower-price-ticker',
  standalone: true,
  templateUrl: './flower-price-ticker.component.html',
  styleUrl: './flower-price-ticker.component.css',
})
export class FlowerPriceTickerComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly flowerPriceService = inject(FlowerPriceConfigService);
  private readonly router = inject(Router);

  protected readonly ticker = signal<FlowerPriceTickerEntry[]>([]);
  protected readonly tickerDuplicated = signal<FlowerPriceTickerEntry[]>([]);
  protected readonly tickerPaused = signal(false);
  protected readonly visible = signal(false);

  constructor() {
    effect(() => {
      const user = this.auth.user();
      if (user?.role === 'ROLE_CLIENT') {
        this.loadTicker();
      } else {
        this.ticker.set([]);
        this.tickerDuplicated.set([]);
        this.visible.set(false);
      }
    });
  }

  ngOnInit(): void {
    this.flowerPriceService.tickerRefresh$obs.subscribe(() => {
      if (this.auth.user()?.role === 'ROLE_CLIENT') this.loadTicker();
    });
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => {
      if (this.auth.user()?.role === 'ROLE_CLIENT') this.loadTicker();
    });
    if (this.auth.user()?.role === 'ROLE_CLIENT') this.loadTicker();
  }

  private loadTicker(): void {
    this.flowerPriceService.getTicker().subscribe({
      next: (res) => {
        if (res.success) {
          const data = res.data ?? [];
          this.ticker.set(data);
          this.tickerDuplicated.set([...data, ...data]);
          this.visible.set(data.length > 0);
        }
      },
      error: () => {},
    });
  }
}
