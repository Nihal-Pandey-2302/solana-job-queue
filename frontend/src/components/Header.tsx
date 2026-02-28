import React from 'react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

export function Header() {
  return (
    <header className="flex items-center justify-between border-b border-border pb-4 mb-6">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold tracking-tight">Solana Job Queue</h1>
        <span className="bg-primary/10 text-primary border border-primary/20 text-xs font-mono px-2 py-0.5 rounded-sm">
          devnet
        </span>
      </div>
      <WalletMultiButton />
    </header>
  );
}
