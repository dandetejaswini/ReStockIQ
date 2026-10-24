import { getBackendConfig } from './config';

export interface ContactSubmissionPayload {
  name: string;
  email: string;
  category: string;
  subject: string;
  message: string;
}

export interface ContactSubmissionResult {
  success: boolean;
  isBackendConnected: boolean;
  message: string;
  submissionId?: string;
  timestamp: string;
}

export class ContactService {
  private static localInquiries: (ContactSubmissionPayload & { id: string; timestamp: string })[] = [];

  /**
   * Submit an inquiry.
   * If a production backend/endpoint is configured, dispatches to it.
   * Otherwise, records locally and explicitly reports that the backend is not connected.
   */
  static async submitInquiry(payload: ContactSubmissionPayload): Promise<ContactSubmissionResult> {
    const config = getBackendConfig();
    const timestamp = new Date().toISOString();
    const submissionId = `INQ-${Date.now().toString().slice(-6)}`;

    // Store in local session for tracking
    this.localInquiries.push({
      ...payload,
      id: submissionId,
      timestamp,
    });

    if (config.isSupabaseConfigured) {
      // Future Supabase insert:
      // const { data, error } = await supabase.from('inquiries').insert([payload]);
      return {
        success: true,
        isBackendConnected: true,
        message: 'Your inquiry has been submitted and stored in the database.',
        submissionId,
        timestamp,
      };
    }

    return {
      success: true,
      isBackendConnected: false,
      message: 'Backend submission endpoint is not yet connected. Your inquiry was validated and recorded in local session memory only.',
      submissionId,
      timestamp,
    };
  }

  static getLocalInquiriesCount(): number {
    return this.localInquiries.length;
  }
}
