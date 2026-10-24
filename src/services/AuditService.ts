import { AuditEvent } from '../types';
import { getBackendConfig } from './config';
import { ServiceResponse } from './InventoryService';
import { fetchAuditEvents, persistAuditEvent } from './supabaseClient';

export class AuditService {
  private static localEvents: AuditEvent[] = [];

  static async fetchAuditEvents(): Promise<ServiceResponse<AuditEvent[]>> {
    const config = getBackendConfig();
    if (config.isSupabaseConfigured) {
      const res = await fetchAuditEvents();
      this.localEvents = res.events;
      return {
        data: res.events,
        isBackendConnected: true,
        error: res.error,
      };
    }
    return {
      data: this.localEvents,
      isBackendConnected: false,
    };
  }

  static async logEvent(event: Omit<AuditEvent, 'id' | 'timestamp'>): Promise<ServiceResponse<AuditEvent>> {
    const config = getBackendConfig();
    const newEvent: AuditEvent = {
      ...event,
      id: `EVT-${Date.now().toString().slice(-6)}`,
      timestamp: new Date().toISOString(),
    };
    this.localEvents.unshift(newEvent);

    if (config.isSupabaseConfigured) {
      await persistAuditEvent(event);
    }

    return {
      data: newEvent,
      isBackendConnected: config.isSupabaseConfigured,
      message: 'Audit event logged',
    };
  }

  static clearState(): void {
    this.localEvents = [];
  }
}
