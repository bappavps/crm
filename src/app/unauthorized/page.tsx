'use client';

import { Button } from "@/components/ui/button";
import { ShieldAlert, ArrowLeft, Lock } from "lucide-react";
import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center space-y-6 text-center">
      <div className="relative">
        <div className="absolute inset-0 animate-ping rounded-full bg-destructive/10"></div>
        <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-destructive/5 border-2 border-destructive/20">
          <Lock className="h-10 w-10 text-destructive" />
        </div>
      </div>
      
      <div className="space-y-2">
        <h1 className="text-4xl font-black tracking-tight text-foreground">Access Denied</h1>
        <p className="max-w-[400px] text-muted-foreground">
          You do not have the required permissions to view this module. Please contact your system administrator to update your role settings.
        </p>
      </div>

      <div className="flex gap-4">
        <Button asChild variant="outline">
          <Link href="/"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard</Link>
        </Button>
        <Button asChild className="bg-primary hover:bg-primary/90">
          <Link href="/">Request Access</Link>
        </Button>
      </div>

      <div className="pt-10">
        <div className="rounded-lg border border-dashed p-4 bg-muted/20">
          <p className="text-[10px] font-mono text-muted-foreground uppercase">
            Security Violation Logged • Level 4 Registry Protected
          </p>
        </div>
      </div>
    </div>
  );
}
