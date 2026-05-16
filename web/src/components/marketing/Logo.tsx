import { useId } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <Link to="/" className={cn("inline-flex items-center gap-2 group", className)}>
      <LogoMark />
      <span className="text-base font-semibold">GeToken</span>
    </Link>
  );
}

export function LogoMark({ className }: { className?: string }) {
  const uid = useId().replaceAll(":", "");
  const gradientId = `getoken-mark-${uid}`;
  const glowId = `getoken-glow-${uid}`;

  return (
    <span className={cn("grid size-8 place-items-center rounded-lg shadow-sm shadow-primary/20", className)}>
      <svg viewBox="0 0 40 40" className="size-full" role="img" aria-label="GeToken">
        <defs>
          <linearGradient id={gradientId} x1="7" y1="5" x2="33" y2="35" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="var(--primary-start)" />
            <stop offset="48%" stopColor="var(--primary)" />
            <stop offset="100%" stopColor="var(--primary-end)" />
          </linearGradient>
          <radialGradient id={glowId} cx="0" cy="0" r="1" gradientTransform="translate(15 12) rotate(52) scale(24)">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.75" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect x="3" y="3" width="34" height="34" rx="10" fill={`url(#${gradientId})`} />
        <rect x="3" y="3" width="34" height="34" rx="10" fill={`url(#${glowId})`} />
        <path
          d="M24.8 12.4h-7.2c-4.6 0-8 3.2-8 7.6s3.4 7.6 8 7.6h4.9c4.5 0 7.9-3.1 7.9-7.2v-.9H20.2"
          fill="none"
          stroke="#07110a"
          strokeWidth="3.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M17 20h10.3M23.6 14.2l4.1-4.1M27.7 9.8h3.3v3.3"
          fill="none"
          stroke="#07110a"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="13.2" cy="20" r="2.1" fill="#07110a" />
      </svg>
    </span>
  );
}
