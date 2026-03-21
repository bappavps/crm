
'use client';

import React from 'react';

/**
 * Global application footer.
 * Provides developer attribution and copyright info in a subtle, minimal style.
 */
export function Footer() {
  return (
    <footer className="w-full py-6 px-6 border-t bg-card/30 backdrop-blur-sm mt-auto shrink-0">
      <div className="max-w-7xl mx-auto text-center">
        <p className="text-[10px] md:text-xs font-bold text-muted-foreground uppercase tracking-[0.2em] opacity-60">
          © Developed by Mriganka Bhusan Debnath | 2026
        </p>
      </div>
    </footer>
  );
}
