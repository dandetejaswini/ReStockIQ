import React, { useState } from 'react';
import { 
  Send, 
  CheckCircle2, 
  HelpCircle, 
  ChevronDown, 
  ChevronUp, 
  Info
} from 'lucide-react';
import { ContactService, ContactSubmissionResult } from '../services/ContactService';

export const ContactPage: React.FC = () => {

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    category: 'General Inquiry',
    subject: '',
    message: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<ContactSubmissionResult | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.message) return;

    setIsSubmitting(true);
    setSubmissionResult(null);

    try {
      const result = await ContactService.submitInquiry(formData);
      setSubmissionResult(result);
      if (result.success) {
        setFormData({
          name: '',
          email: '',
          category: 'General Inquiry',
          subject: '',
          message: '',
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const faqs = [
    {
      q: 'How does ReStockIQ calculate replenishment during supplier lead time?',
      a: 'The engine applies the formula: Target Stock = (Daily Sales Run-rate × Supplier Lead Time Days) + Safety Buffer. It then subtracts current effective stock and any active in-transit open orders. If net demand > 0, it rounds to the supplier’s case packaging multiple.',
    },
    {
      q: 'How are duplicate purchase orders prevented when an inbound order exists?',
      a: 'The rule engine queries open purchase orders in the pipeline. If open inbound quantity already covers the lead-time demand window (as demonstrated in official test TC3 for SKU-103), proposal generation is automatically suppressed, preventing double-ordering.',
    },
    {
      q: 'What triggers the "Needs Budget Review" status?',
      a: 'If a supplier increases unit prices by 20.0% or more (as demonstrated in test TC4 for SKU-104 with a 25% price jump), standard approval is blocked. The proposal is escalated to "Needs Budget Review" so store executives can verify price variance.',
    },
    {
      q: 'Can ReStockIQ Copilot automatically place orders with suppliers?',
      a: 'No. ReStockIQ enforces a strict human-in-the-loop principle. ReStockIQ Copilot prepares explainable purchase proposals, but consequential orders require explicit manager authentication and sign-off in the Approval Center.',
    },
    {
      q: 'How are my inventory and approval records stored?',
      a: 'ReStockIQ provides a modular service layer backed by Firebase Authentication, Cloud Firestore user profiles, and Supabase PostgreSQL with Row-Level Security (RLS) so all inventory telemetry, inbound shipments, and audit trails remain isolated to your workspace.',
    },
  ];

  return (
    <div className="space-y-8 max-w-6xl mx-auto py-2">
      {/* Editorial Page Headline */}
      <div className="text-center space-y-2 max-w-2xl mx-auto">
        <h1 className="font-serif text-3xl sm:text-4xl font-normal tracking-tight text-[#46362F]">
          Contact & Technical Support
        </h1>
        <p className="text-xs text-[#6B625B] leading-relaxed">
          Questions regarding inventory replenishment formulas, official test assertions, or workspace setup? Submit an inquiry below.
        </p>
      </div>

      {/* Balanced Two-Column Desktop Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* ======================================================== */}
        {/* LEFT COLUMN: SUBMIT AN INQUIRY (6 cols)                  */}
        {/* ======================================================== */}
        <div className="lg:col-span-6 bg-white border border-[#E7E0D8] rounded-2xl p-6 sm:p-7 shadow-xs space-y-5">
          <div className="space-y-1">
            <h2 className="font-serif text-xl font-normal text-[#46362F]">
              Submit an Inquiry
            </h2>
            <p className="text-[11px] text-[#6B625B]">
              Complete the form below. Messages are validated by the platform service layer.
            </p>
          </div>

          {/* Submission Feedback */}
          {submissionResult && (
            <div className={`p-3.5 rounded-xl text-xs space-y-1.5 ${
              submissionResult.isBackendConnected
                ? 'bg-[#EBF7F0] border border-[#BCE8D3] text-[#327456]'
                : 'bg-[#FFF8E6] border border-[#EAAA00]/40 text-[#8A5F00]'
            }`}>
              <div className="flex items-center gap-1.5 font-bold">
                {submissionResult.isBackendConnected ? (
                  <CheckCircle2 className="w-4 h-4 text-[#327456]" />
                ) : (
                  <Info className="w-4 h-4 text-[#8A5F00]" />
                )}
                <span>
                  {submissionResult.isBackendConnected 
                    ? 'Inquiry Submitted' 
                    : 'Inquiry Recorded in Session'}
                </span>
              </div>
              <p className="text-[11px] leading-relaxed">
                {submissionResult.message}
              </p>
              {submissionResult.submissionId && (
                <p className="text-[10px] font-mono text-[#6B625B] pt-1 border-t border-black/10">
                  Tracking ID: {submissionResult.submissionId} · {submissionResult.timestamp.slice(0, 19)}Z
                </p>
              )}
            </div>
          )}

          {/* Inquiry Form */}
          <form onSubmit={handleSubmit} className="space-y-4 text-xs font-['Manrope',sans-serif]">
            {/* Name and Email Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block font-semibold text-[#46362F] mb-1">
                  Your Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rahul Verma"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full h-10 px-3 bg-[#F8F6F2] border border-[#E7E0D8] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#46362F] text-[#46362F]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#46362F] mb-1">
                  Work Email *
                </label>
                <input
                  type="email"
                  required
                  placeholder="name@company.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full h-10 px-3 bg-[#F8F6F2] border border-[#E7E0D8] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#46362F] text-[#46362F]"
                />
              </div>
            </div>

            {/* Category and Subject Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block font-semibold text-[#46362F] mb-1">
                  Inquiry Category
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full h-10 px-3 bg-[#F8F6F2] border border-[#E7E0D8] rounded-xl text-[#46362F] focus:outline-none focus:ring-1 focus:ring-[#46362F]"
                >
                  <option value="General Inquiry">General Inquiry</option>
                  <option value="Replenishment Architecture">Replenishment Architecture</option>
                  <option value="Test Lab Verification">Test Lab Verification</option>
                  <option value="Workspace Setup">Workspace Setup</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-[#46362F] mb-1">
                  Subject
                </label>
                <input
                  type="text"
                  placeholder="Brief summary of your topic"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  className="w-full h-10 px-3 bg-[#F8F6F2] border border-[#E7E0D8] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#46362F] text-[#46362F]"
                />
              </div>
            </div>

            {/* Full-Width Message */}
            <div>
              <label className="block font-semibold text-[#46362F] mb-1">
                Message *
              </label>
              <textarea
                rows={4}
                required
                placeholder="How can we assist you with ReStockIQ inventory intelligence?"
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                className="w-full p-3 bg-[#F8F6F2] border border-[#E7E0D8] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#46362F] resize-none text-[#46362F]"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-11 px-4 text-xs font-bold text-white bg-[#46362F] hover:bg-[#342721] rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-40"
            >
              <Send className="w-3.5 h-3.5 text-[#D9C6A5]" />
              <span>{isSubmitting ? 'Validating Submission...' : 'Submit Inquiry'}</span>
            </button>
          </form>
        </div>

        {/* ======================================================== */}
        {/* RIGHT COLUMN: FAQS & GENUINE SUPPORT (6 cols)            */}
        {/* ======================================================== */}
        <div className="lg:col-span-6 space-y-5">
          {/* FAQ Accordion Panel */}
          <div className="bg-white border border-[#E7E0D8] rounded-2xl p-6 sm:p-7 shadow-xs space-y-4">
            <div className="space-y-1">
              <h2 className="font-serif text-xl font-normal text-[#46362F] flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-[#8A9A83]" />
                <span>Frequently Asked Questions</span>
              </h2>
              <p className="text-[11px] text-[#6B625B]">
                Key principles of deterministic inventory replenishment and system integration.
              </p>
            </div>

            <div className="space-y-2 pt-1">
              {faqs.map((faq, index) => {
                const isOpen = openFaq === index;
                return (
                  <div key={index} className="border border-[#E7E0D8] rounded-xl overflow-hidden">
                    <button
                      onClick={() => setOpenFaq(isOpen ? null : index)}
                      className="w-full p-3 text-left flex items-center justify-between text-xs font-semibold text-[#46362F] hover:bg-[#F8F6F2] transition-colors"
                    >
                      <span className="line-clamp-1 pr-2">{faq.q}</span>
                      {isOpen ? (
                        <ChevronUp className="w-3.5 h-3.5 text-[#6B625B] shrink-0" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-[#6B625B] shrink-0" />
                      )}
                    </button>
                    {isOpen && (
                      <div className="px-3 pb-3 text-[11px] text-[#6B625B] leading-relaxed border-t border-[#E7E0D8] pt-2 bg-[#F8F6F2]">
                        {faq.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Genuine Workspace Support Panel */}
          <div className="p-5 bg-[#F8F6F2] border border-[#E7E0D8] rounded-2xl text-xs space-y-2">
            <h3 className="font-semibold text-xs text-[#46362F]">
              Technical Inquiries & Verification
            </h3>
            <p className="text-[11px] text-[#6B625B] leading-relaxed">
              ReStockIQ runs in deterministic verification mode. You can test all replenishment formulas, duplicate prevention rules, and price spike triggers live inside the <strong>Test Lab</strong> or review our platform overview in the <strong>About</strong> section.
            </p>
            <div className="pt-2 flex flex-wrap gap-2">
              <a
                href="/test-lab"
                className="px-3 py-1.5 text-[11px] font-semibold text-[#46362F] bg-white border border-[#E7E0D8] rounded-lg hover:bg-[#E8E2F0]/40 transition-colors"
              >
                Inspect 4 Official Tests →
              </a>
              <a
                href="/"
                className="px-3 py-1.5 text-[11px] font-semibold text-[#46362F] bg-white border border-[#E7E0D8] rounded-lg hover:bg-[#E8E2F0]/40 transition-colors"
              >
                Read Platform Overview →
              </a>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
