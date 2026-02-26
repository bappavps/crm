'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth, useUser, useFirestore, setDocumentNonBlocking } from '@/firebase';
import { doc, getDoc, serverTimestamp } from 'firebase/firestore';

/**
 * Handles authentication state changes, role initialization, and sample data seeding.
 */
export function AuthInitializer() {
  const auth = useAuth();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const pathname = usePathname();

  // Handle Redirection
  useEffect(() => {
    if (!isUserLoading && !user && pathname !== '/login') {
      router.push('/login');
    }
  }, [user, isUserLoading, pathname, router]);

  // Data Seeding
  useEffect(() => {
    if (user && firestore && user.email) {
      const isTargetAdmin = user.email === 'gm.shreelabel@gmail.com';
      const userRef = doc(firestore, 'users', user.uid);

      getDoc(userRef).then((snap) => {
        if (!snap.exists() || isTargetAdmin) {
          const userData = {
            id: user.uid,
            email: user.email,
            firstName: isTargetAdmin ? "Mriganka" : (user.displayName?.split(' ')[0] || 'System'),
            lastName: isTargetAdmin ? "Debnath" : (user.displayName?.split(' ')[1] || 'User'),
            roleId: isTargetAdmin ? 'Admin' : 'Operator', 
            isActive: true,
            createdAt: snap.exists() ? snap.data().createdAt : serverTimestamp(),
            updatedAt: serverTimestamp()
          };

          setDocumentNonBlocking(userRef, userData, { merge: true });
          
          if (isTargetAdmin) {
            setDocumentNonBlocking(doc(firestore, 'adminUsers', user.uid), { 
              id: user.uid, 
              email: userData.email,
              roleId: 'Admin'
            }, { merge: true });
          }
        }
        
        seedSystemRoles(firestore);
        seedCleanDemoData(firestore, user.uid);
      });
    }
  }, [user, firestore]);

  return null;
}

/**
 * Seeds initial role definitions if they don't exist.
 */
async function seedSystemRoles(db: any) {
  const roles = [
    {
      id: 'Admin',
      name: 'System Administrator',
      permissions: {
        dashboard: true, estimates: true, salesOrders: true, createJob: true,
        jobPlanning: true, artwork: true, purchaseOrders: true, grn: true,
        stockDashboard: true, stockRegistry: true, slitting: true, finishedGoods: true,
        dieManagement: true, jobCards: true, bom: true, workOrders: true, liveFloor: true,
        qualityControl: true, dispatch: true, billing: true, reports: true, admin: true
      }
    },
    {
      id: 'Sales',
      name: 'Sales Executive',
      permissions: {
        dashboard: true, estimates: true, salesOrders: true, createJob: true,
        artwork: true, reports: true
      }
    },
    {
      id: 'Operator',
      name: 'Production Operator',
      permissions: {
        dashboard: true, slitting: true, jobCards: true, bom: true, workOrders: true,
        liveFloor: true, qualityControl: true
      }
    },
    {
      id: 'Manager',
      name: 'Operations Manager',
      permissions: {
        dashboard: true, estimates: true, jobPlanning: true, purchaseOrders: true,
        stockDashboard: true, stockRegistry: true, reports: true, jobCards: true
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
