'use client';

import React, { useState, useEffect } from 'react';
import { useFirestore, useDoc, useMemoFirebase } from "@/firebase"
import { doc } from "firebase/firestore"

/**
 * Global application footer.
 * Provides dynamic branding, current year, versioning info, and developer credit.
 */
export function Footer() {
  const [mounted, setMounted] = useState(false);
  const firestore = useFirestore()

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch company settings for dynamic name
  const companyDocRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'company_settings', 'global');
  }, [firestore]);
  const { data: companySettings } = useDoc(companyDocRef);
  
  const companyName = (mounted && companySettings?.name) ? companySettings.name : "SHREE LABEL CREATION";
  const currentYear = mounted ? new Date().getFullYear() : "2026";

  return (
    <footer className="w-full py-6 px-6 border-t bg-card/30 backdrop-blur-sm mt-auto shrink-0">
      <div className="max-w-7xl mx-auto text-center space-y-1.5">
        <p className="text-[10px] md:text-xs font-medium text-muted-foreground uppercase tracking-[0.2em] opacity-80">
          © {currentYear} {companyName} • ERP Master System v3.0
        </p>
        <p className="text-[10px] md:text-xs font-medium text-muted-foreground/70 uppercase tracking-[0.1em]">
          @ Developed by Mriganka Bhusan Debnath
        </p>
      </div>
    </footer>
  );
}
