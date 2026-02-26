'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth, useUser, useFirestore, setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { doc, getDoc, serverTimestamp } from 'firebase/firestore';

/**
 * Handles authentication state changes, role initialization, and sample data seeding.
 * Includes logic for migrating pre-provisioned email-keyed profiles to UID-keyed profiles.
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

  // Data Seeding & Profile Provisioning
  useEffect(() => {
    if (user && firestore) {
      const isTargetAdmin = user.email === 'gm.shreelabel@gmail.com';
      const userRef = doc(firestore, 'users', user.uid);
      const emailPath = user.email?.toLowerCase() || "";
      const emailRef = emailPath ? doc(firestore, 'users', emailPath) : null;

      getDoc(userRef).then(async (snap) => {
        // Provision profile if it doesn't exist
        if (!snap.exists()) {
          let preProvisionedData: any = null;

          // Check if there is a pre-provisioned doc by email (Admin added them first)
          if (emailRef) {
            const emailSnap = await getDoc(emailRef);
            if (emailSnap.exists()) {
              preProvisionedData = emailSnap.data();
            }
          }

          if (preProvisionedData) {
            // MIGRATION: Move data from email-key to uid-key
            const migratedData = {
              ...preProvisionedData,
              id: user.uid,
              updatedAt: serverTimestamp()
            };
            setDocumentNonBlocking(userRef, migratedData, { merge: true });
            
            // Sync Admin Markers
            if (preProvisionedData.roles?.includes('Admin')) {
              setDocumentNonBlocking(doc(firestore, 'adminUsers', user.uid), { 
                id: user.uid, 
                email: user.email, 
                roles: preProvisionedData.roles 
              }, { merge: true });
              deleteDocumentNonBlocking(doc(firestore, 'adminUsers', emailPath));
            }

            // Cleanup the email-keyed placeholder
            deleteDocumentNonBlocking(emailRef!);
          } else {
            // DEFAULT PROVISIONING: New user with no pre-existing record
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
        
        /**
         * CRITICAL: Only the target admin should attempt to seed system-wide roles.
         */
        if (isTargetAdmin) {
          seedSystemRoles(firestore);
          seedCleanDemoData(firestore, user.uid);
        }
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
