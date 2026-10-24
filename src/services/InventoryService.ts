import { InventoryItem } from '../types';
import { getBackendConfig } from './config';
import { fetchInventoryItems, persistInventoryItem } from './supabaseClient';

export interface ServiceResponse<T> {
  data: T;
  isBackendConnected: boolean;
  message?: string;
  error?: string;
}

export class InventoryService {
  private static localInventory: InventoryItem[] = [];

  static async fetchInventory(): Promise<ServiceResponse<InventoryItem[]>> {
    const config = getBackendConfig();

    if (config.isSupabaseConfigured) {
      const res = await fetchInventoryItems();
      this.localInventory = res.items;
      return {
        data: res.items,
        isBackendConnected: res.isConnected,
        message: res.error ? undefined : 'Loaded from connected database',
        error: res.error,
      };
    }

    return {
      data: this.localInventory,
      isBackendConnected: false,
      message: 'Supabase backend not connected.',
    };
  }

  static async getBySku(sku: string): Promise<ServiceResponse<InventoryItem | null>> {
    const item = this.localInventory.find(i => i.sku === sku) || null;
    const config = getBackendConfig();
    return {
      data: item,
      isBackendConnected: config.isSupabaseConfigured,
      message: item ? undefined : `SKU ${sku} not found`,
    };
  }

  static async updateItem(item: InventoryItem): Promise<ServiceResponse<InventoryItem>> {
    const config = getBackendConfig();
    const index = this.localInventory.findIndex(i => i.id === item.id || i.sku === item.sku);
    
    if (index !== -1) {
      this.localInventory[index] = { ...item, updatedAt: new Date().toISOString() };
    } else {
      this.localInventory.push({ ...item, updatedAt: new Date().toISOString() });
    }

    if (config.isSupabaseConfigured) {
      await persistInventoryItem(item);
    }

    return {
      data: item,
      isBackendConnected: config.isSupabaseConfigured,
      message: config.isSupabaseConfigured 
        ? 'Updated in database' 
        : 'Updated in active session',
    };
  }

  static async importBatch(items: InventoryItem[]): Promise<ServiceResponse<InventoryItem[]>> {
    const config = getBackendConfig();
    this.localInventory = [...items, ...this.localInventory];
    return {
      data: this.localInventory,
      isBackendConnected: config.isSupabaseConfigured,
      message: `Imported ${items.length} records into active session.`,
    };
  }

  static clearState(): void {
    this.localInventory = [];
  }
}
