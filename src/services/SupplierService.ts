import { Supplier } from '../types';
import { getBackendConfig } from './config';
import { ServiceResponse } from './InventoryService';
import { fetchSuppliers, persistSupplier } from './supabaseClient';

export class SupplierService {
  private static localSuppliers: Supplier[] = [];

  static async fetchSuppliers(): Promise<ServiceResponse<Supplier[]>> {
    const config = getBackendConfig();
    if (config.isSupabaseConfigured) {
      const res = await fetchSuppliers();
      this.localSuppliers = res.suppliers;
      return {
        data: res.suppliers,
        isBackendConnected: true,
        error: res.error,
      };
    }
    return {
      data: this.localSuppliers,
      isBackendConnected: false,
    };
  }

  static async getById(id: string): Promise<ServiceResponse<Supplier | null>> {
    const sup = this.localSuppliers.find(s => s.id === id) || null;
    const config = getBackendConfig();
    return {
      data: sup,
      isBackendConnected: config.isSupabaseConfigured,
    };
  }

  static async updateSupplier(supplier: Supplier): Promise<ServiceResponse<Supplier>> {
    const config = getBackendConfig();
    const idx = this.localSuppliers.findIndex(s => s.id === supplier.id);
    if (idx !== -1) {
      this.localSuppliers[idx] = supplier;
    } else {
      this.localSuppliers.push(supplier);
    }

    if (config.isSupabaseConfigured) {
      await persistSupplier(supplier);
    }

    return {
      data: supplier,
      isBackendConnected: config.isSupabaseConfigured,
      message: config.isSupabaseConfigured 
        ? 'Supplier updated in database' 
        : 'Supplier updated in active session',
    };
  }

  static clearState(): void {
    this.localSuppliers = [];
  }
}
