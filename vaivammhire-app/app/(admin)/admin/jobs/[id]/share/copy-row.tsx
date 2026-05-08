'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

export function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium">{label}</p>
      <div className="flex gap-2">
        <input
          readOnly
          value={value}
          className="flex-1 rounded-[var(--radius-input)] border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs font-mono"
        />
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={async () => {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
    </div>
  );
}
