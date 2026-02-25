'use client';

import { useUser } from "@/firebase";

/**
 * A client-side component that displays the current user's identity.
 * Replaces the static placeholder in the header with dynamic Firebase Auth data.
 */
export function UserNav() {
  const { user, isUserLoading } = useUser();

  if (isUserLoading) {
    return (
      <div className="flex items-center gap-4 animate-pulse">
        <div className="h-4 w-24 bg-muted rounded"></div>
        <div className="w-8 h-8 rounded-full bg-muted"></div>
      </div>
    );
  }

  // Extract initials from display name or email
  const getInitials = () => {
    if (user?.displayName) {
      return user.displayName
        .split(' ')
        .map(n => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();
    }
    if (user?.email) {
      return user.email.substring(0, 2).toUpperCase();
    }
    return "??";
  };

  return (
    <div className="flex items-center gap-4">
      <div className="flex flex-col items-end">
        <span className="text-sm font-bold text-foreground">
          {user?.displayName || "System User"}
        </span>
        <span className="text-[10px] text-muted-foreground uppercase tracking-tighter">
          {user?.email || "Active Session"}
        </span>
      </div>
      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 shadow-sm transition-all hover:bg-primary/20">
        <span className="text-xs font-bold text-primary">{getInitials()}</span>
      </div>
    </div>
  );
}
