'use client';

import React, { createContext, useContext, ReactNode, useMemo } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, doc } from 'firebase/firestore';

export type PermissionKey = 
  | 'dashboard' | 'estimates' | 'salesOrders' | 'createJob' 
  | 'jobPlanning' | 'artwork' | 'purchaseOrders' | 'grn' 
  | 'stockDashboard' | 'stockRegistry' | 'slitting' | 'finishedGoods' | 'dieManagement'
  | 'jobCards' | 'bom' | 'workOrders' | 'liveFloor'
  | 'qualityControl' | 'dispatch' | 'billing' | 'reports' | 'admin';

export interface PermissionsMap {
  [key: string]: boolean;
}

interface PermissionContextType {
  permissions: PermissionsMap;
  hasPermission: (key: PermissionKey) => boolean;
  isLoading: boolean;
  roles: string[];
}

const PermissionContext = createContext<PermissionContextType | undefined>(undefined);

export function PermissionProvider({ children }: { children: ReactNode }) {
  const { user, isUserLoading: isAuthLoading } = useUser();
  const firestore = useFirestore();

  // 1. Fetch User Profile (contains roles[] and customPermissions)
  const userRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);
  const { data: profile, isLoading: isProfileLoading } = useDoc(userRef);

  // 2. Fetch All Roles
  /**
   * CRITICAL: Only query roles if the user is authenticated to prevent security rule violations.
   * The rules for the 'roles' collection require an authenticated session.
   */
  const rolesQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, 'roles');
  }, [firestore, user]);
  const { data: allRoles, isLoading: isRolesLoading } = useCollection(rolesQuery);

  const permissions = useMemo(() => {
    if (!profile) return {};
    
    const userRoleIds = profile.roles || (profile.roleId ? [profile.roleId] : []);
    const mergedPermissions: PermissionsMap = {};

    // 1. Merge all assigned roles (if any is true, result is true)
    if (allRoles) {
      userRoleIds.forEach((roleId: string) => {
        const roleData = allRoles.find(r => r.id === roleId);
        if (roleData?.permissions) {
          Object.entries(roleData.permissions).forEach(([key, val]) => {
            if (val === true) mergedPermissions[key] = true;
          });
        }
      });
    }
    
    // 2. Override with User Custom Permissions (Highest Priority)
    const customOverrides = profile?.customPermissions || {};
    Object.entries(customOverrides).forEach(([key, val]) => {
      mergedPermissions[key] = !!val;
    });
    
    return mergedPermissions;
  }, [allRoles, profile]);

  const hasPermission = (key: PermissionKey): boolean => {
    // Admin override: target email always has full access
    if (user?.email === 'gm.shreelabel@gmail.com') return true;
    
    // Check if user has explicit 'admin' permission
    if (permissions['admin'] === true) return true;
    
    return !!permissions[key];
  };

  const value = {
    permissions,
    hasPermission,
    isLoading: isAuthLoading || isProfileLoading || isRolesLoading,
    roles: profile?.roles || (profile?.roleId ? [profile.roleId] : [])
  };

  return (
    <PermissionContext.Provider value={value}>
      {children}
    </PermissionContext.Provider>
  );
}

export const usePermissions = () => {
  const context = useContext(PermissionContext);
  if (context === undefined) {
    throw new Error('usePermissions must be used within a PermissionProvider');
  }
  return context;
};
