import { IncomingOrder } from '../types';
import { getBackendConfig } from './config';
import { ServiceResponse } from './InventoryService';
import { fetchIncomingOrders } from './supabaseClient';

export class OrderService {
  private static localOrders: IncomingOrder[] = [];

  static async fetchOrders(): Promise<ServiceResponse<IncomingOrder[]>> {
    const config = getBackendConfig();
    if (config.isSupabaseConfigured) {
      const res = await fetchIncomingOrders();
      this.localOrders = res.orders;
      return {
        data: res.orders,
        isBackendConnected: true,
        error: res.error,
      };
    }
    return {
      data: this.localOrders,
      isBackendConnected: false,
    };
  }

  static async getOrdersBySku(sku: string): Promise<ServiceResponse<IncomingOrder[]>> {
    const config = getBackendConfig();
    const orders = this.localOrders.filter(o => o.sku === sku);
    return {
      data: orders,
      isBackendConnected: config.isSupabaseConfigured,
    };
  }

  static clearState(): void {
    this.localOrders = [];
  }
}
