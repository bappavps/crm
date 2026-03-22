'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth, useUser, useFirestore } from '@/firebase/provider';
import { setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { doc, getDoc, serverTimestamp } from 'firebase/firestore';

/**
 * Handles authentication state changes, role initialization, and redirection.
 * Ensures unauthenticated users are forced to the login page.
 */
export function AuthInitializer() {
  const auth = useAuth();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Define paths that do not require authentication
    const isPublicPath = pathname === '/login' || pathname.startsWith('/roll/');
    
    // If auth state is resolved and no user is present on a protected path, redirect to login
    if (!isUserLoading && !user && !isPublicPath) {
      router.replace('/login');
    }
  }, [user, isUserLoading, pathname, router]);

  useEffect(() => {
    if (user && firestore) {
      const isTargetAdmin = user.email === 'gm.shreelabel@gmail.com';
      const userRef = doc(firestore, 'users', user.uid);
      const emailPath = user.email?.toLowerCase() || "";
      const emailRef = emailPath ? doc(firestore, 'users', emailPath) : null;

      getDoc(userRef).then(async (snap) => {
        if (!snap.exists()) {
          let preProvisionedData: any = null;

          if (emailRef) {
            const emailSnap = await getDoc(emailRef);
            if (emailSnap.exists()) {
              preProvisionedData = emailSnap.data();
            }
          }

          if (preProvisionedData) {
            const migratedData = {
              ...preProvisionedData,
              id: user.uid,
              updatedAt: serverTimestamp()
            };
            setDocumentNonBlocking(userRef, migratedData, { merge: true });
            
            if (preProvisionedData.roles?.includes('Admin')) {
              setDocumentNonBlocking(doc(firestore, 'adminUsers', user.uid), { 
                id: user.uid, 
                email: user.email, 
                roles: preProvisionedData.roles 
              }, { merge: true });
              deleteDocumentNonBlocking(doc(firestore, 'adminUsers', emailPath));
            }

            deleteDocumentNonBlocking(emailRef!);
          } else {
            const userData = {
              id: user.uid,
              email: user.email || 'guest@shreelabel.com',
              firstName: isTargetAdmin ? "Mriganka" : (user.displayName?.split(' ')[0] || (user.isAnonymous ? 'Guest' : 'New')),
              lastName: isTargetAdmin ? "Debnath" : (user.displayName?.split(' ')[1] || (user.isAnonymous ? 'User' : 'Employee')),
              roles: isTargetAdmin ? ['Admin'] : ['Operator'], 
              isActive: true,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            };

            setDocumentNonBlocking(userRef, userData, { merge: true });
            
            if (isTargetAdmin) {
              setDocumentNonBlocking(doc(firestore, 'adminUsers', user.uid), { 
                id: user.uid, 
                email: userData.email,
                roles: ['Admin']
              }, { merge: true });
            }
          }
        }
        
        if (isTargetAdmin) {
          seedSystemRoles(firestore);
          seedCleanDemoData(firestore, user.uid);
        }
      });
    }
  }, [user, firestore]);

  return null;
}

async function seedSystemRoles(db: any) {
  const roles = [
    {
      id: 'Admin',
      name: 'System Administrator',
      permissions: {
        dashboard: true, estimates: true, quotations: true, salesOrders: true, createJob: true,
        jobPlanning: true, artwork: true, purchaseOrders: true, grn: true,
        stockDashboard: true, stockRegistry: true, slitting: true, finishedGoods: true,
        dieManagement: true, jobCards: true, bom: true, workOrders: true, liveFloor: true,
        qualityControl: true, dispatch: true, billing: true, reports: true, admin: true,
        client_add: true, client_edit: true, client_delete: true, client_credit_edit: true,
        rawMaterials: true, bomMaster: true, quotationTemplates: true, printStudio: true,
        stockAudit: true
      }
    },
    {
      id: 'Sales',
      name: 'Sales Executive',
      permissions: {
        dashboard: true, estimates: true, quotations: true, salesOrders: true, createJob: true,
        artwork: true, reports: true, client_add: true, quotationTemplates: false
      }
    },
    {
      id: 'Operator',
      name: 'Production Operator',
      permissions: {
        dashboard: true, slitting: true, jobCards: true, bom: true, workOrders: true,
        liveFloor: true, qualityControl: true, stockAudit: true
      }
    }
  ];

  for (const role of roles) {
    setDocumentNonBlocking(doc(db, 'roles', role.id), {
      ...role,
      updatedAt: serverTimestamp()
    }, { merge: true });
  }
}

function seedCleanDemoData(db: any, userId: string) {
  setDocumentNonBlocking(doc(db, 'system_settings', 'pricing_config'), {
    sqInchDivider: 625,
    lastUpdatedAt: serverTimestamp()
  }, { merge: true });

  setDocumentNonBlocking(doc(db, 'roll_settings', 'global_config'), {
    parentPrefix: "TLC-",
    startNumber: 1000,
    separator: "-",
    trackingYear: 2026
  }, { merge: true });
}
