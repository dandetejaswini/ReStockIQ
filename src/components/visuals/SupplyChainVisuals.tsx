import React, { useState } from 'react';

interface Interactive3DCardProps {
  children: React.ReactNode;
  className?: string;
  intensity?: number;
}

/**
 * Lightweight, accessible 3D perspective container using compositor-only transform.
 * Automatically respects prefers-reduced-motion via CSS and subtle tilt bounds.
 */
export const Interactive3DContainer: React.FC<Interactive3DCardProps> = ({
  children,
  className = '',
  intensity = 3.5,
}) => {
  const [tilt, setTilt] = useState<{ rotateX: number; rotateY: number }>({ rotateX: 0, rotateY: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({
      rotateX: Number((-y * intensity).toFixed(2)),
      rotateY: Number((x * intensity).toFixed(2)),
    });
  };

  const handleMouseLeave = () => {
    setTilt({ rotateX: 0, rotateY: 0 });
  };

  return (
    <div
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`transition-transform duration-200 ease-out will-change-transform motion-reduce:transform-none ${className}`}
      style={{
        transform:
          tilt.rotateX === 0 && tilt.rotateY === 0
            ? undefined
            : `perspective(1000px) rotateX(${tilt.rotateX}deg) rotateY(${tilt.rotateY}deg) translateZ(2px)`,
      }}
    >
      {children}
    </div>
  );
};

/**
 * Isometric 3D Supply-Chain & AI Inventory Intelligence Illustration
 * Pure inline SVG — zero external network requests, crisp at any DPI, reduced-motion safe.
 */
export const IsometricSupplyChainVisual: React.FC<{ className?: string }> = ({ className = 'w-full h-36' }) => {
  return (
    <svg
      viewBox="0 0 420 155"
      className={className}
      role="img"
      aria-label="Isometric 3D illustration of AI-powered inventory intelligence connecting store stock, inbound logistics, and verified purchase orders"
    >
      <defs>
        <linearGradient id="isoPlatformGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#F8F6F2" />
          <stop offset="100%" stopColor="#E8E2F0" />
        </linearGradient>
        <linearGradient id="isoCoreTop" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#5D483F" />
          <stop offset="100%" stopColor="#46362F" />
        </linearGradient>
        <linearGradient id="isoCoreLeft" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#46362F" />
          <stop offset="100%" stopColor="#2B201C" />
        </linearGradient>
        <linearGradient id="isoCoreRight" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#3A2C26" />
          <stop offset="100%" stopColor="#221916" />
        </linearGradient>
        <linearGradient id="isoGoldTop" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#EFE3CE" />
          <stop offset="100%" stopColor="#D9C6A5" />
        </linearGradient>
        <linearGradient id="isoSageTop" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#BCE8D3" />
          <stop offset="100%" stopColor="#8A9A83" />
        </linearGradient>
      </defs>

      {/* Subtle Isometric Grid Base */}
      <g opacity="0.45">
        <polygon
          points="210,16 390,78 210,142 30,78"
          fill="url(#isoPlatformGrad)"
          stroke="#D9C6A5"
          strokeWidth="1"
        />
        <line x1="120" y1="47" x2="300" y2="110" stroke="#E7E0D8" strokeWidth="1" strokeDasharray="3 3" />
        <line x1="300" y1="47" x2="120" y2="110" stroke="#E7E0D8" strokeWidth="1" strokeDasharray="3 3" />
      </g>

      {/* Animated Data-Flow Conduits */}
      <path
        d="M 108 78 L 168 78"
        stroke="#8A9A83"
        strokeWidth="2.2"
        strokeDasharray="4 4"
        fill="none"
        className="animate-flow-dash"
      />
      <path
        d="M 252 78 L 312 78"
        stroke="#46362F"
        strokeWidth="2.2"
        strokeDasharray="4 4"
        fill="none"
        className="animate-flow-dash"
      />

      {/* LEFT NODE: Isometric Store Shelf / SKU Telemetry Cube */}
      <g transform="translate(46, 38)" className="iso-layer-subtle">
        {/* Shadow */}
        <polygon points="36,68 70,54 36,40 2,54" fill="#46362F" opacity="0.10" />
        {/* Cube Top */}
        <polygon points="36,12 68,25 36,38 4,25" fill="url(#isoGoldTop)" stroke="#C5B08B" strokeWidth="0.8" />
        {/* Cube Left */}
        <polygon points="4,25 36,38 36,62 4,49" fill="#D9C6A5" stroke="#C5B08B" strokeWidth="0.8" />
        {/* Cube Right */}
        <polygon points="68,25 36,38 36,62 68,49" fill="#C4B08D" stroke="#B39E7B" strokeWidth="0.8" />
        {/* Label */}
        <text x="36" y="28" textAnchor="middle" fill="#46362F" fontSize="8" fontWeight="700" fontFamily="monospace">
          SKU LEDGER
        </text>
        <text x="36" y="75" textAnchor="middle" fill="#46362F" fontSize="8.5" fontWeight="700">
          Stock &amp; Velocity
        </text>
      </g>

      {/* CENTER NODE: ReStockIQ 3D Intelligence Core */}
      <g transform="translate(166, 20)" className="iso-layer-float">
        {/* Base Platform Glow */}
        <polygon points="44,98 86,80 44,62 2,80" fill="#324536" opacity="0.18" />
        {/* Outer Isometric Prism Top */}
        <polygon points="44,12 84,29 44,46 4,29" fill="url(#isoCoreTop)" stroke="#D9C6A5" strokeWidth="1.2" />
        {/* Outer Prism Left */}
        <polygon points="4,29 44,46 44,86 4,69" fill="url(#isoCoreLeft)" stroke="#D9C6A5" strokeWidth="0.9" />
        {/* Outer Prism Right */}
        <polygon points="84,29 44,46 44,86 84,69" fill="url(#isoCoreRight)" stroke="#8A9A83" strokeWidth="0.9" />
        {/* Inner Floating AI Ring */}
        <ellipse cx="44" cy="29" rx="16" ry="7" fill="#324536" stroke="#BCE8D3" strokeWidth="1.2" />
        <text x="44" y="32" textAnchor="middle" fill="#BCE8D3" fontSize="7.5" fontWeight="700" fontFamily="monospace">
          AI CORE
        </text>
        {/* Front Facet Telemetry Lines */}
        <line x1="14" y1="48" x2="36" y2="57" stroke="#D9C6A5" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="14" y1="56" x2="30" y2="63" stroke="#8A9A83" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="52" y1="57" x2="74" y2="48" stroke="#BCE8D3" strokeWidth="1.5" strokeLinecap="round" />
        <text x="44" y="102" textAnchor="middle" fill="#46362F" fontSize="9" fontWeight="700">
          ReStockIQ Engine
        </text>
      </g>

      {/* RIGHT NODE: Verified Case-Pack Replenishment & PO Gate */}
      <g transform="translate(302, 38)" className="iso-layer-subtle">
        {/* Shadow */}
        <polygon points="36,68 70,54 36,40 2,54" fill="#324536" opacity="0.12" />
        {/* Cube Top */}
        <polygon points="36,12 68,25 36,38 4,25" fill="url(#isoSageTop)" stroke="#6F8268" strokeWidth="0.8" />
        {/* Cube Left */}
        <polygon points="4,25 36,38 36,62 4,49" fill="#8A9A83" stroke="#6F8268" strokeWidth="0.8" />
        {/* Cube Right */}
        <polygon points="68,25 36,38 36,62 68,49" fill="#6F8268" stroke="#5A6B54" strokeWidth="0.8" />
        {/* Verified Checkmark on Top Plane */}
        <path
          d="M 30 24 L 34 28 L 43 20"
          stroke="#223327"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <text x="36" y="75" textAnchor="middle" fill="#324536" fontSize="8.5" fontWeight="700">
          Verified PO Gate
        </text>
      </g>
    </svg>
  );
};

/**
 * Predictive Replenishment & Stockout Prevention 3D-Depth Visual
 * Used in Hero / Dashboard to illustrate Lead-Time Depletion vs Inbound Protection.
 */
export const PredictiveReplenishmentVisual: React.FC<{ className?: string }> = ({
  className = 'w-full h-24',
}) => {
  return (
    <svg
      viewBox="0 0 360 92"
      className={className}
      role="img"
      aria-label="Predictive replenishment curve showing safety stock threshold and stockout prevention"
    >
      <defs>
        <linearGradient id="curveAreaGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#BCE8D3" stopOpacity="0.38" />
          <stop offset="100%" stopColor="#BCE8D3" stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {/* Subtle perspective grid planes */}
      <rect x="8" y="8" width="344" height="76" rx="10" fill="#2B201C" fillOpacity="0.55" stroke="#D9C6A5" strokeOpacity="0.22" />
      <line x1="24" y1="62" x2="336" y2="62" stroke="#D9C6A5" strokeOpacity="0.35" strokeWidth="1" strokeDasharray="3 3" />
      <text x="332" y="58" textAnchor="end" fill="#D9C6A5" fontSize="7.5" fontFamily="monospace">
        SAFETY BUFFER
      </text>

      {/* Depletion & Replenishment Trajectory Fill */}
      <path
        d="M 28 24 Q 95 34, 155 58 L 155 22 Q 235 30, 326 42 L 326 74 L 28 74 Z"
        fill="url(#curveAreaGrad)"
      />

      {/* Depletion & Replenishment Trajectory Line */}
      <path
        d="M 28 24 Q 95 34, 155 58 L 155 22 Q 235 30, 326 42"
        fill="none"
        stroke="#BCE8D3"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Key Decision Nodes */}
      <circle cx="28" cy="24" r="3.5" fill="#D9C6A5" />
      <circle cx="155" cy="58" r="4" fill="#EAAA00" stroke="#2B201C" strokeWidth="1.2" />
      <circle cx="155" cy="22" r="4" fill="#BCE8D3" stroke="#2B201C" strokeWidth="1.2" />
      <circle cx="326" cy="42" r="3.5" fill="#BCE8D3" />

      {/* Annotations */}
      <text x="36" y="21" fill="#F8F6F2" fontSize="8" fontWeight="600">
        On-Hand Stock
      </text>
      <text x="163" y="21" fill="#BCE8D3" fontSize="8" fontWeight="700">
        +Inbound Case-Pack Offset
      </text>
      <text x="163" y="71" fill="#D9C6A5" fontSize="7.5">
        Reorder Point Triggered Before Stockout
      </text>
    </svg>
  );
};

/**
 * Daily Briefing Isometric 4-Layer Synthesis Visual
 * Represents the 4 deterministic layers of the ReStockIQ Daily Briefing.
 */
export const DailyBriefingSynthesisVisual: React.FC<{ className?: string }> = ({
  className = 'w-28 h-24',
}) => {
  return (
    <svg
      viewBox="0 0 140 110"
      className={className}
      role="img"
      aria-label="Layered 3D visual of the Daily Briefing synthesis across stockout exposure, approvals, inbound pipeline, and pricing guardrails"
    >
      {/* Layer 4 (Bottom): Pricing Guardrails */}
      <g transform="translate(0, 48)">
        <polygon points="70,12 126,32 70,52 14,32" fill="#E8E2F0" stroke="#46362F" strokeWidth="1" opacity="0.85" />
      </g>
      {/* Layer 3: Inbound Pipeline */}
      <g transform="translate(0, 34)">
        <polygon points="70,12 126,32 70,52 14,32" fill="#D9C6A5" stroke="#46362F" strokeWidth="1" opacity="0.9" />
      </g>
      {/* Layer 2: Pending Authorizations */}
      <g transform="translate(0, 20)">
        <polygon points="70,12 126,32 70,52 14,32" fill="#8A9A83" stroke="#324536" strokeWidth="1" opacity="0.92" />
      </g>
      {/* Layer 1 (Top): Lead-Time Stockout Exposure & AI Synthesis */}
      <g transform="translate(0, 6)" className="iso-layer-float">
        <polygon points="70,12 126,32 70,52 14,32" fill="#46362F" stroke="#D9C6A5" strokeWidth="1.2" />
        <circle cx="70" cy="32" r="9" fill="#324536" stroke="#BCE8D3" strokeWidth="1" />
        <path
          d="M 66 32 L 69 35 L 75 29"
          stroke="#BCE8D3"
          strokeWidth="1.8"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
};
