
'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth, useUser, useFirestore, setDocumentNonBlocking } from '@/firebase';
import { doc, getDoc, serverTimestamp } from 'firebase/firestore';

/**
 * Handles authentication state changes, role initialization, and sample data seeding.
 * Redirects unauthenticated users to the login page.
 */
export function AuthInitializer() {
  const auth = useAuth();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const pathname = usePathname();

  // Handle Redirection based on Auth State
  useEffect(() => {
    if (!isUserLoading && !user && pathname !== '/login') {
      router.push('/login');
    }
  }, [user, isUserLoading, pathname, router]);

  // Handle Data Seeding and Admin Role Initialization
  useEffect(() => {
    if (user && firestore) {
      // Identity check for the specific requested admin user
      const isTargetAdmin = user.email === 'gm.shreelabel@gmail.com';
      
      const adminRef = doc(firestore, 'adminUsers', user.uid);
      const userRef = doc(firestore, 'users', user.uid);

      getDoc(userRef).then((snap) => {
        // Initialize or update user profile if it doesn't exist or is the target admin
        if (!snap.exists() || isTargetAdmin) {
          const userData = {
            id: user.uid,
            email: user.email || 'gm.shreelabel@gmail.com',
            firstName: isTargetAdmin ? "Mriganka" : (user.displayName?.split(' ')[0] || 'System'),
            lastName: isTargetAdmin ? "Debnath" : (user.displayName?.split(' ')[1] || 'Admin'),
            roleId: 'Admin', // Required for current security rules (hasRole helper)
            role: 'admin',   // Specifically requested by user
            isActive: true,
            createdAt: snap.exists() ? snap.data().createdAt : serverTimestamp(),
            updatedAt: serverTimestamp()
          };

          // 1. Create main User document (Non-blocking)
          setDocumentNonBlocking(userRef, userData, { merge: true });
          
          // 2. Create Security Marker in adminUsers collection (Non-blocking)
          // This allows isAdmin() helper in firestore.rules to return true
          setDocumentNonBlocking(adminRef, { 
            id: user.uid, 
            email: userData.email,
            roleId: 'Admin',
            isActive: true,
            createdAt: userData.createdAt 
          }, { merge: true });
        }
        
        // 3. Seed Sample Data - Ensures critical system configs exist
        seedCleanDemoData(firestore, user.uid);
      });
    }
  }, [user, firestore]);

  return null;
}

/**
 * Ensures system constants exist in Firestore for the ERP logic to function correctly.
 */
function seedCleanDemoData(db: any, userId: string) {
  // Use non-blocking writes for system seeding
  const pricingRef = doc(db, 'system_settings', 'pricing_config');
  setDocumentNonBlocking(pricingRef, {
    sqInchDivider: 625,
    decimalPrecision: 4,
    currencySymbol: "₹",
    pricingMode: "divider",
    lastUpdatedAt: serverTimestamp()
  }, { merge: true });

  const rollSettingsRef = doc(db, 'roll_settings', 'global_config');
  setDocumentNonBlocking(rollSettingsRef, {
    parentPrefix: "TLC-",
    startNumber: 1000,
    childType: "alphabet",
    subChildType: "number",
    separator: "-",
    barcodePrefix: "BC-",
    trackingYear: 2026
  }, { merge: true });

  const jobCounterRef = doc(db, 'counters', 'job_counter');
  setDocumentNonBlocking(jobCounterRef, {
    prefix: "JOB-",
    year: 2026,
    current_number: 1
  }, { merge: true });

  const clientRef = doc(db, 'customers', 'alexa-demo-id');
  setDocumentNonBlocking(clientRef, {
    id: 'alexa-demo-id',
    name: "Alexa Lifesciences",
    address: "Kolkata",
    phone: "9876543210",
    email: "info@alexa.com",
    gstNumber: "19ABCDE1234F1Z5",
    status: "Active",
    createdAt: serverTimestamp(),
    createdById: userId
  }, { merge: true });

  const matRef = doc(db, 'materials', 'chromo-demo');
  setDocumentNonBlocking(matRef, { id: 'chromo-demo', name: 'CHROMO', gsm: 80, ratePerSqMeter: 22.50 }, { merge: true });

  const machRef = doc(db, 'machines', 'flexo-demo');
  setDocumentNonBlocking(machRef, { id: 'flexo-demo', name: 'UV Flexo 8-Color', maxPrintingWidthMm: 250, costPerHour: 1500 }, { merge: true });
}
