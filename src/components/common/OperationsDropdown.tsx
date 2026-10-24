import React, { useState, useRef, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { 
  ChevronDown, 
  Package, 
  Truck, 
  CheckSquare, 
  TrendingUp, 
  FlaskConical, 
  FileText 
} from 'lucide-react';

interface OperationsDropdownProps {
  pendingApprovalsCount?: number;
  className?: string;
  onNavigate?: () => void;
}

export interface OperationsNavItem {
  id: string;
  name: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  badge?: number;
}

export function getOperationsNavItems(pendingApprovalsCount = 0): OperationsNavItem[] {
  return [
    {
      id: 'briefing',
      name: 'Daily Briefing',
      path: '/briefing',
      icon: FileText,
      description: 'Explainable daily synthesis of exposure, pipeline & guardrails',
    },
    {
      id: 'inventory',
      name: 'Inventory & Suppliers',
      path: '/inventory',
      icon: Package,
      description: 'SKU health, lead times, safety buffers & stock levels',
    },
    {
      id: 'orders',
      name: 'Incoming Orders',
      path: '/suppliers',
      icon: Truck,
      description: 'In-transit vendor shipments & delivery schedules',
    },
    {
      id: 'approvals',
      name: 'Approvals',
      path: '/approvals',
      icon: CheckSquare,
      description: 'Procurement sign-offs & budget threshold reviews',
      badge: pendingApprovalsCount > 0 ? pendingApprovalsCount : undefined,
    },
    {
      id: 'insights',
      name: 'Insights',
      path: '/insights',
      icon: TrendingUp,
      description: 'Demand trends, capital commitments & analytics',
    },
    {
      id: 'test-lab',
      name: 'Test Lab',
      path: '/test-lab',
      icon: FlaskConical,
      description: 'Execute official disruption assertions (TC1–TC4)',
    },
    {
      id: 'audit',
      name: 'Audit Trail',
      path: '/audit',
      icon: FileText,
      description: 'Immutable ledger of decisions & calculation traces',
    },
  ];
}

export const OperationsDropdown: React.FC<OperationsDropdownProps> = ({
  pendingApprovalsCount = 0,
  className = '',
  onNavigate,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const location = useLocation();
  const navigate = useNavigate();

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemsRef = useRef<(HTMLAnchorElement | null)[]>([]);

  const operationsItems = getOperationsNavItems(pendingApprovalsCount);
  const isOperationsActive = operationsItems.some(item => location.pathname === item.path);

  // Close when clicking or touching outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setFocusedIndex(-1);
      }
    };
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        setFocusedIndex(-1);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick, { passive: true });
    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
      document.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [isOpen]);

  // Close on route change
  useEffect(() => {
    setIsOpen(false);
    setFocusedIndex(-1);
  }, [location.pathname]);

  const handleTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setIsOpen(true);
      setFocusedIndex(0);
      setTimeout(() => itemsRef.current[0]?.focus(), 10);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      setFocusedIndex(-1);
    }
  };

  const handleItemKeyDown = (e: React.KeyboardEvent<HTMLAnchorElement>, index: number) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = (index + 1) % operationsItems.length;
      setFocusedIndex(next);
      itemsRef.current[next]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = (index - 1 + operationsItems.length) % operationsItems.length;
      setFocusedIndex(prev);
      itemsRef.current[prev]?.focus();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      setFocusedIndex(-1);
      triggerRef.current?.focus();
    } else if (e.key === 'Tab') {
      setIsOpen(false);
      setFocusedIndex(-1);
    }
  };

  const handleSelect = (path: string) => {
    setIsOpen(false);
    setFocusedIndex(-1);
    navigate(path);
    if (onNavigate) onNavigate();
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {/* Operations Navigation Trigger */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        onKeyDown={handleTriggerKeyDown}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls="desktop-operations-menu"
        aria-label="Operations Menu"
        className={`flex items-center gap-1.5 px-4 py-1.5 text-[13px] font-medium rounded-full transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 ${
          isOperationsActive || isOpen
            ? 'bg-[#E8E2F0] text-[#46362F] font-semibold shadow-xs'
            : 'text-white/85 hover:text-white hover:bg-white/10'
        }`}
      >
        <span>Operations</span>
        {pendingApprovalsCount > 0 && (
          <span 
            className="px-1.5 py-0.2 text-[10px] font-bold bg-[#B42335] text-white rounded-full leading-none"
            aria-label={`${pendingApprovalsCount} pending approvals`}
          >
            {pendingApprovalsCount}
          </span>
        )}
        <ChevronDown 
          className={`w-3.5 h-3.5 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`} 
          aria-hidden="true" 
        />
      </button>

      {/* Dropdown Surface */}
      {isOpen && (
        <div
          id="desktop-operations-menu"
          role="menu"
          aria-label="Operations & Governance Submenu"
          className="absolute left-0 top-full mt-2 w-80 sm:w-88 max-w-[calc(100vw-2rem)] bg-white text-[#46362F] rounded-2xl shadow-xl border border-[#E7E0D8] overflow-hidden z-[70] animate-in fade-in zoom-in-95 duration-100"
        >
          {/* Header strip */}
          <div className="px-4 py-2.5 bg-[#F8F6F2] border-b border-[#E7E0D8] flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B625B]">
              Supply Chain Operations & Governance
            </span>
            {pendingApprovalsCount > 0 && (
              <span className="text-[10px] font-semibold text-[#B42335] shrink-0">
                {pendingApprovalsCount} Action{pendingApprovalsCount > 1 ? 's' : ''} Required
              </span>
            )}
          </div>

          {/* Menu Items */}
          <div className="p-1.5 space-y-0.5 max-h-[75vh] overflow-y-auto">
            {operationsItems.map((item, idx) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;

              return (
                <NavLink
                  key={item.id}
                  to={item.path}
                  ref={el => {
                    itemsRef.current[idx] = el;
                  }}
                  role="menuitem"
                  tabIndex={isOpen ? 0 : -1}
                  onClick={(e) => {
                    e.preventDefault();
                    handleSelect(item.path);
                  }}
                  onKeyDown={(e) => handleItemKeyDown(e, idx)}
                  className={`group flex items-start gap-3 px-3 py-2.5 rounded-xl transition-all focus:outline-none ${
                    isActive
                      ? 'bg-[#E8E2F0] text-[#46362F] font-semibold'
                      : 'hover:bg-[#E8E2F0]/60 text-[#46362F] focus:bg-[#E8E2F0]/60'
                  }`}
                >
                  {/* Clean uniform icon */}
                  <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 transition-colors ${
                    isActive 
                      ? 'bg-white text-[#46362F] shadow-2xs' 
                      : 'bg-[#F8F6F2] text-[#46362F] group-hover:bg-white'
                  }`}>
                    <Icon className="w-4 h-4" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold leading-tight text-[#46362F]">
                        {item.name}
                      </p>
                      {item.badge !== undefined && (
                        <span className="px-1.5 py-0.5 text-[9px] font-bold bg-[#B42335] text-white rounded-full leading-none shrink-0">
                          {item.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-[#6B625B] leading-tight mt-1 line-clamp-1">
                      {item.description}
                    </p>
                  </div>
                </NavLink>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
