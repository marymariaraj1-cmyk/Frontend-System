import { Routes } from '@angular/router';

import { authGuard } from './core/guards/auth.guard';
import { LayoutComponent } from './core/layout/layout.component';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  {
    path: 'login',
    loadComponent: () => import('./features/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: '',
    component: LayoutComponent,
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'flowers',
        loadComponent: () =>
          import('./features/flowers/flowers.component').then((m) => m.FlowersComponent),
      },
      {
        path: 'farmers',
        loadComponent: () =>
          import('./features/farmers/farmers.component').then((m) => m.FarmersComponent),
      },
      {
        path: 'buyers',
        loadComponent: () =>
          import('./features/buyers/buyers.component').then((m) => m.BuyersComponent),
      },
      {
        path: 'clients',
        loadComponent: () =>
          import('./features/clients/clients.component').then((m) => m.ClientsComponent),
      },
      {
        path: 'opening-balance',
        loadComponent: () =>
          import('./features/opening-balance/opening-balance.component').then(
            (m) => m.OpeningBalanceComponent,
          ),
      },
      {
        path: 'bag-count-config',
        loadComponent: () =>
          import('./features/bag-count-config/bag-count-config.component').then(
            (m) => m.BagCountConfigComponent,
          ),
      },
      {
        path: 'sales-entry',
        loadComponent: () =>
          import('./features/sales-entry/sales-entry.component').then(
            (m) => m.SalesEntryComponent,
          ),
      },
      {
        path: 'multi-sales',
        loadComponent: () =>
          import('./features/multi-sales/multi-sales.component').then(
            (m) => m.MultiSalesComponent,
          ),
      },
      {
        path: 'sales-details-edit',
        loadComponent: () =>
          import('./features/sales-details-edit/sales-details-edit.component').then(
            (m) => m.SalesDetailsEditComponent,
          ),
      },
      {
        path: 'farmer-transaction',
        loadComponent: () =>
          import('./features/farmer-transaction/farmer-transaction.component').then(
            (m) => m.FarmerTransactionComponent,
          ),
      },
      {
        path: 'buyer-transaction',
        loadComponent: () =>
          import('./features/buyer-transaction/buyer-transaction.component').then(
            (m) => m.BuyerTransactionComponent,
          ),
      },
      {
        path: 'farmer-account-check',
        loadComponent: () =>
          import('./features/farmer-account-check/farmer-account-check.component').then(
            (m) => m.FarmerAccountCheckComponent,
          ),
      },
      {
        path: 'farmer-ledger-list',
        loadComponent: () =>
          import('./features/farmer-ledger-list/farmer-ledger-list.component').then(
            (m) => m.FarmerLedgerListComponent,
          ),
      },
      {
        path: 'farmer-ledger-detail',
        loadComponent: () =>
          import('./features/farmer-ledger-detail/farmer-ledger-detail.component').then(
            (m) => m.FarmerLedgerDetailComponent,
          ),
      },
      {
        path: 'farmer-ledger-report',
        loadComponent: () =>
          import('./features/farmer-ledger-report/farmer-ledger-report.component').then(
            (m) => m.FarmerLedgerReportComponent,
          ),
      },
      {
        path: 'buyer-ledger-list',
        loadComponent: () =>
          import('./features/buyer-ledger-list/buyer-ledger-list.component').then(
            (m) => m.BuyerLedgerListComponent,
          ),
      },
      {
        path: 'buyer-ledger-detail',
        loadComponent: () =>
          import('./features/buyer-ledger-detail/buyer-ledger-detail.component').then(
            (m) => m.BuyerLedgerDetailComponent,
          ),
      },
      {
        path: 'inactive-list',
        loadComponent: () =>
          import('./features/inactive-list/inactive-list.component').then(
            (m) => m.InactiveListComponent,
          ),
      },
      {
        path: 'buyer-ledger-report',
        loadComponent: () =>
          import('./features/buyer-ledger-report/buyer-ledger-report.component').then(
            (m) => m.BuyerLedgerReportComponent,
          ),
      },
      {
        path: 'farmer-sales-report',
        loadComponent: () =>
          import('./features/farmer-sales-report/farmer-sales-report.component').then(
            (m) => m.FarmerSalesReportComponent,
          ),
      },
      {
        path: 'buyer-sales-report',
        loadComponent: () =>
          import('./features/buyer-sales-report/buyer-sales-report.component').then(
            (m) => m.BuyerSalesReportComponent,
          ),
      },
      {
        path: 'current-day-profit',
        loadComponent: () =>
          import('./features/current-day-profit/current-day-profit.component').then(
            (m) => m.CurrentDayProfitComponent,
          ),
      },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
