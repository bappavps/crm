'use client';

import { useUser, useAuth } from "@/firebase";
import { signOut } from "firebase/auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { LogOut, User, Settings, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

/**
 * A client-side component that displays the current user's identity and provides navigation options.
 * Includes a dropdown menu for profile management and logout.
 */
export function UserNav() {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const { toast } = useToast();

  const handleLogout = async () => {
    if (auth) {
      await signOut(auth);
      toast({
        title: "Signed Out",
        description: "Your session has been cleared. The system will re-initialize your access.",
      });
      // Delay slightly to allow the toast to be seen before reload
      setTimeout(() => {
        window.location.href = '/';
      }, 1000);
    }
  };

  const handleFeatureNotice = (feature: string) => {
    toast({
      title: feature,
      description: `${feature} module is currently under development.`,
    });
  };

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
    return user?.uid.substring(0, 2).toUpperCase() || "??";
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-10 w-auto px-2 flex items-center gap-3 hover:bg-primary/5">
          <div className="flex flex-col items-end">
            <span className="text-sm font-bold text-foreground">
              {user?.displayName || "System Admin"}
            </span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-tighter">
              {user?.email || "Active Session"}
            </span>
          </div>
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 shadow-sm transition-all">
            <span className="text-xs font-bold text-primary">{getInitials()}</span>
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{user?.displayName || "System User"}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {user?.email || "Authenticated via Anonymous"}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => handleFeatureNotice("Profile Settings")} className="cursor-pointer">
            <User className="mr-2 h-4 w-4" />
            <span>Profile</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleFeatureNotice("System Settings")} className="cursor-pointer">
            <Settings className="mr-2 h-4 w-4" />
            <span>Settings</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleFeatureNotice("Security Controls")} className="cursor-pointer">
            <Shield className="mr-2 h-4 w-4" />
            <span>Security</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive cursor-pointer">
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
