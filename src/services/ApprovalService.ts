import { ReorderRequest, ReorderRequestStatus } from '../types';
import { getBackendConfig } from './config';
import { ServiceResponse } from './InventoryService';
import { fetchReorderRequests, persistReorderRequest, persistRequestStatus } from './supabaseClient';

export class ApprovalService {
  private static localRequests: ReorderRequest[] = [];

  static async fetchRequests(): Promise<ServiceResponse<ReorderRequest[]>> {
    const config = getBackendConfig();
    if (config.isSupabaseConfigured) {
      const res = await fetchReorderRequests();
      this.localRequests = res.requests;
      return {
        data: res.requests,
        isBackendConnected: true,
        error: res.error,
      };
    }
    return {
      data: this.localRequests,
      isBackendConnected: false,
    };
  }

  static async createRequest(newReq: ReorderRequest): Promise<ServiceResponse<ReorderRequest>> {
    const config = getBackendConfig();
    this.localRequests.unshift(newReq);
    if (config.isSupabaseConfigured) {
      await persistReorderRequest(newReq);
    }
    return {
      data: newReq,
      isBackendConnected: config.isSupabaseConfigured,
      message: config.isSupabaseConfigured 
        ? 'Purchase proposal saved to database queue' 
        : 'Proposal recorded in active session queue',
    };
  }

  static async updateStatus(
    requestId: string,
    newStatus: ReorderRequestStatus,
    comment?: string
  ): Promise<ServiceResponse<ReorderRequest | null>> {
    const config = getBackendConfig();
    const idx = this.localRequests.findIndex(r => r.id === requestId);
    if (idx === -1) {
      return {
        data: null,
        isBackendConnected: config.isSupabaseConfigured,
        error: `Request ${requestId} not found`,
      };
    }

    const updated = {
      ...this.localRequests[idx],
      status: newStatus,
      updatedAt: new Date().toISOString(),
      reviewComment: comment || this.localRequests[idx].reviewComment,
    };
    this.localRequests[idx] = updated;

    if (config.isSupabaseConfigured) {
      await persistRequestStatus(requestId, newStatus, comment);
    }

    return {
      data: updated,
      isBackendConnected: config.isSupabaseConfigured,
      message: `Status updated to ${newStatus}`,
    };
  }

  static clearState(): void {
    this.localRequests = [];
  }
}
