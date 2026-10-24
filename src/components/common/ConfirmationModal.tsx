import React from 'react';
import { AlertCircle, X } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'primary';
  children?: React.ReactNode;
  onConfirm: () => void;
  onClose: () => void;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'primary',
  children,
  onConfirm,
  onClose,
}) => {
  if (!isOpen) return null;

  const getButtonBg = () => {
    switch (variant) {
      case 'danger':
        return 'bg-[#D94F5C] hover:bg-rose-700 text-white';
      case 'warning':
        return 'bg-[#B7791F] hover:bg-amber-700 text-white';
      case 'primary':
      default:
        return 'bg-[#8B7CF6] hover:bg-violet-600 text-white';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="w-full max-w-md bg-white rounded-xl shadow-xl border border-[#E8EAF2] overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="flex items-center justify-between p-4 border-b border-[#E8EAF2]">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-lg ${variant === 'danger' ? 'bg-rose-50 text-[#D94F5C]' : variant === 'warning' ? 'bg-amber-50 text-[#B7791F]' : 'bg-[#F0EDFF] text-[#8B7CF6]'}`}>
              <AlertCircle className="w-5 h-5" />
            </div>
            <h3 id="modal-title" className="text-base font-semibold text-[#20243A]">
              {title}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-[#747B91] hover:text-[#20243A] hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <p className="text-sm text-[#747B91] leading-relaxed">
            {description}
          </p>
          {children}
        </div>

        <div className="flex items-center justify-end gap-2 p-4 bg-[#F8F9FC] border-t border-[#E8EAF2]">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-medium text-[#747B91] hover:text-[#20243A] bg-white border border-[#E8EAF2] rounded-lg hover:bg-slate-50 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg shadow-xs transition-colors ${getButtonBg()}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
