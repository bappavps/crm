
"use client"

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

/**
 * REDIRECTOR: The GRN system has been rebuilt into Paper Stock.
 */
export default function GRNLegacyPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/paper-stock');
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center py-40 font-sans">
      <Loader2 className="animate-spin h-10 w-10 mb-4 text-primary" />
      <p className="text-lg font-black uppercase tracking-tight">System Transitioning...</p>
      <p className="text-sm text-muted-foreground">Moving to the new Paper Stock technical hub.</p>
    </div>
  );
}
