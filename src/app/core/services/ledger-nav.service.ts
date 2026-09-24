import { Injectable, signal } from '@angular/core';

export interface LedgerContext {
  id: string;
  name: string;
  source: 'ledger' | 'report';
}

const FARMER_KEY = 'bb_farmer_ledger';
const BUYER_KEY = 'bb_buyer_ledger';

@Injectable({ providedIn: 'root' })
export class LedgerNavService {
  private readonly farmerCtx = signal<LedgerContext | null>(null);
  private readonly buyerCtx = signal<LedgerContext | null>(null);

  setFarmer(id: string, name: string, source: LedgerContext['source']): void {
    this.farmerCtx.set({ id, name, source });
    this.persist(FARMER_KEY, { farmerId: id, farmerName: name, source });
  }

  farmer(): LedgerContext | null {
    return this.farmerCtx();
  }

  setBuyer(id: string, name: string, source: LedgerContext['source']): void {
    this.buyerCtx.set({ id, name, source });
    this.persist(BUYER_KEY, { buyerId: id, buyerName: name, source });
  }

  buyer(): LedgerContext | null {
    return this.buyerCtx();
  }

  clearAll(): void {
    this.farmerCtx.set(null);
    this.buyerCtx.set(null);
    this.remove(FARMER_KEY);
    this.remove(BUYER_KEY);
  }

  private persist(key: string, value: Record<string, unknown>): void {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
      // storage unavailable - in-memory signal still works
    }
  }

  private remove(key: string): void {
    try {
      sessionStorage.removeItem(key);
    } catch {
      // storage unavailable
    }
  }
}