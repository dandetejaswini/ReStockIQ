import React, { useState, useRef, useEffect } from 'react';
import { NavLink, useLocation, useNavigate, Link } from 'react-router-dom';
import { 
  ChevronDown, 
  Search, 
  Bell, 
  Sparkles, 
  Boxes, 
  Settings, 
  LogOut, 
  Clock, 
  AlertTriangle,
  TrendingUp,
  CheckCircle2,
  FileText
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { OperationsDropdown } from '../common/OperationsDropdown';
import { calculateReorderPlan, checkSupplierPriceChange } from '../../utils/reorderCalculations';
import { BRAND_CONFIG } from '../../services/config';

export const TopNavigation: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser, inventory, suppliers, orders, requests, logoutUser, setSelectedSku } = useApp();
  const { firebaseUser, userProfile, logout } = useAuth();
  const isAuthenticated = Boolean(firebaseUser || currentUser);
  const isAboutActive = location.pathname === '/' || location.pathname === '/about';
  const isBriefingActive = location.pathname === '/briefing' || location.pathname === '/daily-briefing';

  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchActive, setIsSearchActive] = useState(false);

  const notifDropdownRef = useRef<HTMLDivElement>(null);
  const userDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifDropdownRef.current && !notifDropdownRef.current.contains(e.target as Node)) {
        setIsNotificationsOpen(false);
      }
      if (userDropdownRef.current && !userDropdownRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const pendingApprovals = requests.filter(r => r.status === 'Pending Approval');
  const budgetReviews = requests.filter(r => r.status === 'Needs Budget Review');
  const atRiskItems = inventory.filter(item => {
    const sup = suppliers.find(s => s.id === item.supplierId) || suppliers[0];
    if (!sup) return false;
    const plan = calculateReorderPlan(item, sup, orders);
    return plan.stockStatus === 'Critical' || plan.stockStatus === 'Stockout Risk';
  });
  const priceSpikes = suppliers.filter(s => checkSupplierPriceChange(s.currentUnitPrice, s.previousUnitPrice).isPriceJumped);

  const totalAlertsCount = pendingApprovals.length + budgetReviews.length + atRiskItems.length + priceSpikes.length;

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    navigate(`/inventory?search=${encodeURIComponent(searchQuery)}`);
    setIsSearchActive(false);
  };

  const displayName = userProfile?.displayName || firebaseUser?.displayName || currentUser?.name || firebaseUser?.email?.split('@')[0] || 'User';
  const displayEmail = userProfile?.email || firebaseUser?.email || currentUser?.email || '';

  return (
    <header className="sticky top-0 z-50 bg-[#46362F] text-white border-b border-[#E7E0D8]/15 shadow-sm">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16 gap-3">
          
          {/* LEFT: Brand Mark & Identity */}
          <div className="flex items-center gap-3 shrink-0">
            <Link to="/" className="flex items-center gap-2.5 group">
              <div className="w-9 h-9 rounded-full bg-[#324536] border border-[#8A9A83]/40 flex items-center justify-center text-[#BCE8D3] shadow-xs group-hover:scale-105 transition-transform">
                <Boxes className="w-5 h-5 text-[#BCE8D3]" />
              </div>

              <div className="flex flex-col">
                <div className="flex items-center gap-1.5 leading-none">
                  <span className="font-serif font-bold text-lg tracking-tight text-white">
                    {BRAND_CONFIG.appName}
                  </span>
                  <span className="px-1.5 py-0.5 text-[10px] font-bold text-[#46362F] bg-[#D9C6A5] rounded tracking-wider">
                    AI
                  </span>
                </div>
                <span className="text-[9px] uppercase tracking-widest text-white/60 mt-1 font-medium">
                  {BRAND_CONFIG.tagline}
                </span>
              </div>
            </Link>
          </div>

          {/* CENTER: Navigation Tabs (1. About, 2. Home, 3. ReStockIQ Copilot, 4. Operations, 5. Contact) */}
          <nav className="hidden lg:flex items-center gap-1.5 h-full" aria-label="Primary Navigation">
            <NavLink
              to="/"
              end
              className={() =>
                `flex items-center gap-1.5 px-4 py-1.5 text-[13px] font-medium rounded-full transition-all ${
                  isAboutActive
                    ? 'bg-[#E8E2F0] text-[#46362F] font-semibold shadow-xs'
                    : 'text-white/85 hover:text-white hover:bg-white/10'
                }`
              }
            >
              About
            </NavLink>

            <NavLink
              to="/home"
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-4 py-1.5 text-[13px] font-medium rounded-full transition-all ${
                  isActive
                    ? 'bg-[#E8E2F0] text-[#46362F] font-semibold shadow-xs'
                    : 'text-white/85 hover:text-white hover:bg-white/10'
                }`
              }
            >
              Home
            </NavLink>

            <NavLink
              to="/agent"
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-4 py-1.5 text-[13px] font-medium rounded-full transition-all ${
                  isActive
                    ? 'bg-[#E8E2F0] text-[#46362F] font-semibold shadow-xs'
                    : 'text-white/85 hover:text-white hover:bg-white/10'
                }`
              }
            >
              <span>{BRAND_CONFIG.copilotName}</span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#D9C6A5] ml-0.5 animate-pulse" />
            </NavLink>

            <OperationsDropdown 
              pendingApprovalsCount={pendingApprovals.length + budgetReviews.length} 
            />

            <NavLink
              to="/contact"
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-4 py-1.5 text-[13px] font-medium rounded-full transition-all ${
                  isActive
                    ? 'bg-[#E8E2F0] text-[#46362F] font-semibold shadow-xs'
                    : 'text-white/85 hover:text-white hover:bg-white/10'
                }`
              }
            >
              Contact
            </NavLink>
          </nav>

          {/* RIGHT: Search, Notifications, User Pill, Simulation Button */}
          <div className="flex items-center gap-2 sm:gap-3">
            {isSearchActive ? (
              <form onSubmit={handleSearchSubmit} className="relative flex items-center">
                <input
                  type="text"
                  autoFocus
                  placeholder="Search SKU..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onBlur={() => !searchQuery && setIsSearchActive(false)}
                  className="w-36 sm:w-44 pl-7 pr-3 py-1 text-xs bg-black/30 border border-white/20 rounded-full text-white placeholder-white/50 focus:outline-none focus:border-white/50"
                />
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/60" />
              </form>
            ) : (
              <button
                onClick={() => setIsSearchActive(true)}
                className="p-1.5 rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Search SKUs"
              >
                <Search className="w-4 h-4" />
              </button>
            )}

            {/* Notification Bell */}
            <div className="relative" ref={notifDropdownRef}>
              <button
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                className="relative p-1.5 rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="View notifications"
              >
                <Bell className="w-4 h-4" />
                {totalAlertsCount > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-[#D9C6A5] rounded-full ring-2 ring-[#46362F]" />
                )}
              </button>

              {isNotificationsOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white text-[#46362F] rounded-xl shadow-xl border border-[#E7E0D8] py-2 z-50 animate-in fade-in duration-100">
                  <div className="flex items-center justify-between px-4 py-2 border-b border-[#E7E0D8]">
                    <span className="text-xs font-bold text-[#46362F]">Replenishment Alert Queue</span>
                    <span className="text-[10px] text-[#6B625B] font-mono">{totalAlertsCount} Active</span>
                  </div>
                  <div className="max-h-72 overflow-y-auto divide-y divide-[#E7E0D8]">
                    {totalAlertsCount === 0 && (
                      <div className="p-5 text-center space-y-1">
                        <CheckCircle2 className="w-6 h-6 text-[#8A9A83] mx-auto" />
                        <p className="text-xs font-semibold text-[#46362F]">No active alerts</p>
                        <p className="text-[11px] text-[#6B625B]">Notifications will appear here when SKUs need replenishment or approvals.</p>
                      </div>
                    )}

                    {budgetReviews.map(req => (
                      <div 
                        key={req.id}
                        onClick={() => {
                          setIsNotificationsOpen(false);
                          navigate('/approvals');
                        }}
                        className="p-3 hover:bg-[#F8F6F2] cursor-pointer transition-colors"
                      >
                        <div className="flex items-start gap-2.5">
                          <div className="p-1.5 rounded-md bg-[#FFF8E6] text-[#B7791F] shrink-0 mt-0.5">
                            <TrendingUp className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-[#46362F]">Budget Review: {req.supplierName}</p>
                            <p className="text-[11px] text-[#6B625B]">Price variance on {req.sku}</p>
                            <span className="text-[10px] text-[#B7791F] font-bold mt-1 inline-block">
                              Requires Budget Review →
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}

                    {pendingApprovals.map(req => (
                      <div 
                        key={req.id}
                        onClick={() => {
                          setIsNotificationsOpen(false);
                          navigate('/approvals');
                        }}
                        className="p-3 hover:bg-[#F8F6F2] cursor-pointer transition-colors"
                      >
                        <div className="flex items-start gap-2.5">
                          <div className="p-1.5 rounded-md bg-[#E8E2F0] text-[#46362F] shrink-0 mt-0.5">
                            <Clock className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-[#46362F]">Approval Required: {req.sku}</p>
                            <p className="text-[11px] text-[#6B625B] line-clamp-1">{req.reason}</p>
                            <span className="text-[10px] text-[#46362F] font-semibold mt-1 inline-block">
                              Review in Approvals →
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}

                    {atRiskItems.map(item => (
                      <div 
                        key={item.id}
                        onClick={() => {
                          setIsNotificationsOpen(false);
                          setSelectedSku(item.sku);
                          navigate('/inventory');
                        }}
                        className="p-3 hover:bg-[#F8F6F2] cursor-pointer transition-colors"
                      >
                        <div className="flex items-start gap-2.5">
                          <div className="p-1.5 rounded-md bg-[#FDF0F2] text-[#B42335] shrink-0 mt-0.5">
                            <AlertTriangle className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-[#46362F]">Stockout Risk: {item.sku}</p>
                            <p className="text-[11px] text-[#6B625B]">Lead-time demand ({item.averageDailySales * item.leadTimeDays}u) vs stock ({item.currentStock - item.reservedStock}u)</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="px-4 py-2 border-t border-[#E7E0D8] flex items-center justify-between bg-[#FAF9F6] rounded-b-xl">
                    <Link
                      to="/briefing"
                      onClick={() => setIsNotificationsOpen(false)}
                      className="text-xs font-semibold text-[#324536] hover:underline"
                    >
                      Open Daily Briefing
                    </Link>
                    <Link
                      to="/approvals"
                      onClick={() => setIsNotificationsOpen(false)}
                      className="text-xs font-semibold text-[#46362F] hover:underline"
                    >
                      View All Requests
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* Persistent Daily Briefing Quick Action (Header) */}
            <button
              type="button"
              onClick={() => navigate('/briefing')}
              aria-label="Open In-App Daily Briefing"
              aria-current={isBriefingActive ? 'page' : undefined}
              title="Open In-App Daily Briefing"
              className={`quick-action-3d flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D9C6A5] focus-visible:ring-offset-2 focus-visible:ring-offset-[#46362F] ${
                isBriefingActive
                  ? 'bg-[#BCE8D3] text-[#223327] shadow-xs ring-1 ring-white/40'
                  : 'bg-[#324536] hover:bg-[#3d5442] text-[#BCE8D3] border border-[#8A9A83]/50 shadow-xs'
              }`}
            >
              <FileText className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span className="hidden sm:inline whitespace-nowrap">Daily Briefing</span>
              {totalAlertsCount > 0 && (
                <span
                  className={`px-1.5 py-0.2 text-[10px] font-mono font-bold rounded-full leading-tight tabular-nums ${
                    isBriefingActive
                      ? 'bg-[#223327] text-[#BCE8D3]'
                      : 'bg-[#D9C6A5] text-[#46362F]'
                  }`}
                  aria-label={`${totalAlertsCount} active briefing signals`}
                >
                  {totalAlertsCount}
                </span>
              )}
            </button>

            {/* User Account Pill or Sign In / Sign Up Links */}
            {isAuthenticated ? (
              <div className="relative" ref={userDropdownRef}>
                <button
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center gap-2 px-3 py-1 rounded-full border border-white/20 text-xs font-medium text-white hover:bg-white/10 transition-colors"
                >
                  {userProfile?.photoURL || firebaseUser?.photoURL ? (
                    <img 
                      src={userProfile?.photoURL || firebaseUser?.photoURL || ''} 
                      alt="User Avatar"
                      className="w-5 h-5 rounded-full object-cover border border-white/30"
                    />
                  ) : (
                    <span className="w-5 h-5 rounded-full bg-[#324536] text-[#BCE8D3] flex items-center justify-center font-bold text-[10px]">
                      {displayName.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <span>
                    {displayName.split(' ')[0]}
                  </span>
                  <ChevronDown className="w-3 h-3 text-white/70" />
                </button>

                {isUserMenuOpen && (
                  <div className="absolute right-0 mt-2 w-60 bg-white text-[#46362F] rounded-xl shadow-xl border border-[#E7E0D8] py-1 z-50 animate-in fade-in duration-100">
                    <div className="px-4 py-2.5 border-b border-[#E7E0D8]">
                      <p className="text-xs font-bold text-[#46362F]">
                        {displayName}
                      </p>
                      {displayEmail && (
                        <p className="text-[11px] text-[#6B625B] truncate">
                          {displayEmail}
                        </p>
                      )}
                      {userProfile?.storeName && (
                        <p className="text-[10px] text-[#8A9A83] font-semibold mt-0.5 truncate">
                          Store: {userProfile.storeName}
                        </p>
                      )}
                      <span className="inline-block mt-1 text-[10px] font-bold text-[#46362F] bg-[#E8E2F0] px-1.5 py-0.5 rounded">
                        {firebaseUser?.providerData[0]?.providerId === 'google.com' ? 'Google Auth Session' : 'Authenticated Session'}
                      </span>
                    </div>

                    <div className="py-1">
                      <Link
                        to="/settings"
                        onClick={() => setIsUserMenuOpen(false)}
                        className="flex items-center gap-2 px-4 py-2 text-xs text-[#46362F] hover:bg-[#F8F6F2] transition-colors"
                      >
                        <Settings className="w-3.5 h-3.5 text-[#8A9A83]" />
                        <span>Workspace Settings</span>
                      </Link>
                    </div>

                    <div className="pt-1 border-t border-[#E7E0D8]">
                      <button
                        onClick={async () => {
                          await logout();
                          logoutUser();
                          setIsUserMenuOpen(false);
                          navigate('/login');
                        }}
                        className="w-full flex items-center gap-2 px-4 py-2 text-xs text-[#B42335] hover:bg-[#FDF0F2] transition-colors text-left font-medium"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Sign Out / Switch User</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  className="px-3 py-1.5 rounded-full border border-white/25 text-xs font-semibold text-white hover:bg-white/10 transition-colors whitespace-nowrap"
                >
                  Sign In
                </Link>
                <Link
                  to="/signup"
                  className="hidden sm:inline-flex items-center px-3.5 py-1.5 rounded-full bg-[#E8E2F0] hover:bg-white text-[#46362F] text-xs font-semibold transition-colors whitespace-nowrap"
                >
                  Sign Up
                </Link>
              </div>
            )}

            {/* Launch Simulation Pill Button */}
            <button
              onClick={() => navigate('/test-lab')}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#D9C6A5] hover:bg-[#CABA97] text-[#46362F] text-xs font-semibold shadow-xs hover:shadow-sm transition-all"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#46362F]" />
              <span className="whitespace-nowrap">Test Lab</span>
            </button>
          </div>
        </div>

        {/* Responsive Mobile / Tablet Horizontal Tab Strip (1. About, 2. Home, 3. ReStockIQ Copilot, 4. Operations, 5. Contact) */}
        <div className="lg:hidden flex items-center gap-1.5 overflow-x-auto py-2 border-t border-white/10 no-scrollbar">
          <NavLink
            to="/"
            end
            className={() =>
              `shrink-0 px-3 py-1 text-xs font-medium rounded-full transition-all ${
                isAboutActive ? 'bg-[#E8E2F0] text-[#46362F] font-semibold' : 'text-white/80 bg-white/5'
              }`
            }
          >
            About
          </NavLink>
          <NavLink
            to="/home"
            className={({ isActive }) =>
              `shrink-0 px-3 py-1 text-xs font-medium rounded-full transition-all ${
                isActive ? 'bg-[#E8E2F0] text-[#46362F] font-semibold' : 'text-white/80 bg-white/5'
              }`
            }
          >
            Home
          </NavLink>
          <NavLink
            to="/agent"
            className={({ isActive }) =>
              `shrink-0 px-3 py-1 text-xs font-medium rounded-full transition-all ${
                isActive ? 'bg-[#E8E2F0] text-[#46362F] font-semibold' : 'text-white/80 bg-white/5'
              }`
            }
          >
            {BRAND_CONFIG.copilotName}
          </NavLink>
          <OperationsDropdown 
            pendingApprovalsCount={pendingApprovals.length + budgetReviews.length} 
          />
          <NavLink
            to="/contact"
            className={({ isActive }) =>
              `shrink-0 px-3 py-1 text-xs font-medium rounded-full transition-all ${
                isActive ? 'bg-[#E8E2F0] text-[#46362F] font-semibold' : 'text-white/80 bg-white/5'
              }`
            }
          >
            Contact
          </NavLink>
          <NavLink
            to="/briefing"
            aria-label="Open In-App Daily Briefing"
            className={() =>
              `shrink-0 inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-full transition-all ${
                isBriefingActive
                  ? 'bg-[#BCE8D3] text-[#223327]'
                  : 'bg-[#324536] text-[#BCE8D3] border border-[#8A9A83]/40'
              }`
            }
          >
            <FileText className="w-3 h-3 shrink-0" aria-hidden="true" />
            <span>Daily Briefing</span>
          </NavLink>
        </div>
      </div>
    </header>
  );
};
