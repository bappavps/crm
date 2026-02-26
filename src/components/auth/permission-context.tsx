'use client';

import React, { createContext, useContext, ReactNode, useMemo } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, doc } from 'firebase/firestore';

export type PermissionKey = 
  | 'dashboard' | 'estimates' | 'quotations' | 'salesOrders' | 'createJob' 
  | 'jobPlanning' | 'artwork' | 'purchaseOrders' | 'grn' 
  | 'stockDashboard' | 'stockRegistry' | 'slitting' | 'finishedGoods' | 'dieManagement'
  | 'jobCards' | 'bom' | 'workOrders' | 'liveFloor'
  | 'qualityControl' | 'dispatch' | 'billing' | 'reports' | 'admin'
  | 'client_add' | 'client_edit' | 'client_delete' | 'client_credit_edit';

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

  const userRef = useMemoFirebase(() => {
    if (!firestore || !user || isAuthLoading) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user, isAuthLoading]);
  const { data: profile, isLoading: isProfileLoading } = useDoc(userRef);

  const rolesQuery = useMemoFirebase(() => {
    if (!firestore || !user || isAuthLoading) return null;
    return collection(firestore, 'roles');
  }, [firestore, user, isAuthLoading]);
  const { data: allRoles, isLoading: isRolesLoading } = useCollection(rolesQuery);

  const permissions = useMemo(() => {
    if (!profile) return {};
    
    const userRoleIds = profile.roles || (profile.roleId ? [profile.roleId] : []);
    const mergedPermissions: PermissionsMap = {};

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
    
    const customOverrides = profile?.customPermissions || {};
    Object.entries(customOverrides).forEach(([key, val]) => {
      mergedPermissions[key] = !!val;
    });
    
    return mergedPermissions;
  }, [allRoles, profile]);

  const hasPermission = (key: PermissionKey): boolean => {
    if (user?.email === 'gm.shreelabel@gmail.com') return true;
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
