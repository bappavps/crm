'use client';

import React, { createContext, useContext, ReactNode, useMemo } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';

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
  roleName: string;
}

const PermissionContext = createContext<PermissionContextType | undefined>(undefined);

export function PermissionProvider({ children }: { children: ReactNode }) {
  const { user, isUserLoading: isAuthLoading } = useUser();
  const firestore = useFirestore();

  // 1. Fetch User Profile (contains roleId and customPermissions)
  const userRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);
  const { data: profile, isLoading: isProfileLoading } = useDoc(userRef);

  // 2. Fetch Role Permissions
  const roleRef = useMemoFirebase(() => {
    if (!firestore || !profile?.roleId) return null;
    return doc(firestore, 'roles', profile.roleId);
  }, [firestore, profile?.roleId]);
  const { data: roleData, isLoading: isRoleLoading } = useDoc(roleRef);

  const permissions = useMemo(() => {
    if (!roleData) return {};
    
    // Default from Role
    const rolePermissions = roleData.permissions || {};
    
    // Override with User Custom Permissions
    const customOverrides = profile?.customPermissions || {};
    
    return {
      ...rolePermissions,
      ...customOverrides
    };
  }, [roleData, profile?.customPermissions]);

  const hasPermission = (key: PermissionKey): boolean => {
    // Admin role bypasses all checks (if explicitly set in role or if it's the target admin email)
    if (user?.email === 'gm.shreelabel@gmail.com') return true;
    if (permissions['admin'] === true) return true;
    
    return !!permissions[key];
  };

  const value = {
    permissions,
    hasPermission,
    isLoading: isAuthLoading || isProfileLoading || isRoleLoading,
    roleName: roleData?.name || 'Guest'
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
