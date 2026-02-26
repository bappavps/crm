'use client';

import { ReactNode, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { usePermissions, PermissionKey } from './permission-context';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: ReactNode;
  permission?: PermissionKey;
}

/**
 * Route-level guard that checks for permissions before rendering content.
 * Redirects to /unauthorized if check fails.
 */
export function ProtectedRoute({ children, permission }: ProtectedRouteProps) {
  const { hasPermission, isLoading } = usePermissions();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && permission && !hasPermission(permission)) {
      router.push('/unauthorized');
    }
  }, [isLoading, permission, hasPermission, router]);

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-10rem)] flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-4 text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Authorizing Access...
        </p>
      </div>
    );
  }

  // If a specific permission is required and user doesn't have it, don't render children
  if (permission && !hasPermission(permission)) {
    return null;
  }

  return <>{children}</>;
}
