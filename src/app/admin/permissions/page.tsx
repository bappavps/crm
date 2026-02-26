'use client';

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

/**
 * REDIRECTOR: This page has been merged into User Management.
 */
export default function LegacyPermissionsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/users');
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center py-40 text-muted-foreground">
      <Loader2 className="animate-spin h-10 w-10 mb-4 text-primary" />
      <p className="text-lg font-bold">Consolidating Security Controls...</p>
      <p className="text-sm">Role & Permission management has moved to the User Management page.</p>
    </div>
  );
}
