import { useState } from 'react';
import { cn } from '@/utils/cn';

interface AdminStoreIdentityMarkProps {
  storeName: string;
  logoUrl: string | null | undefined;
  size?: 'sm' | 'md';
}

function getStoreInitials(storeName: string): string {
  const words = storeName.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'E';
  return words.slice(0, 2).map((word) => word[0]).join('').toUpperCase();
}

export function AdminStoreIdentityMark({
  storeName,
  logoUrl,
  size = 'md',
}: AdminStoreIdentityMarkProps) {
  const [failedLogoUrl, setFailedLogoUrl] = useState<string | null>(null);
  const normalizedLogoUrl = logoUrl?.trim() || null;
  const canShowLogo = normalizedLogoUrl && failedLogoUrl !== normalizedLogoUrl;

  return (
    <div
      className={cn(
        'grid shrink-0 place-items-center overflow-hidden border border-gray-200 bg-white shadow-sm',
        size === 'md' ? 'h-10 w-10 rounded-xl' : 'h-8 w-8 rounded-lg',
      )}
    >
      {canShowLogo ? (
        <img
          src={normalizedLogoUrl}
          alt={`Logo de ${storeName}`}
          className="h-full w-full object-contain p-1"
          onError={() => setFailedLogoUrl(normalizedLogoUrl)}
        />
      ) : (
        <span
          aria-label={`Empresa ${storeName}`}
          className={cn(
            'font-bold tracking-tight text-indigo-700',
            size === 'md' ? 'text-sm' : 'text-xs',
          )}
        >
          {getStoreInitials(storeName)}
        </span>
      )}
    </div>
  );
}
