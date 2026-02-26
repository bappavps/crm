
'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth, useUser, useFirestore } from '@/firebase';
import { doc, getDoc, setDoc, collection, getDocs, limit, query, writeBatch, serverTimestamp } from 'firebase/firestore';

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
      // 1. Auto-initialize Admin role for the current user
      const adminRef = doc(firestore, 'adminUsers', user.uid);
      getDoc(adminRef).then(async (snap) => {
        if (!snap.exists()) {
          await setDoc(adminRef, { 
            id: user.uid, 
            username: user.displayName || user.email?.split('@')[0] || 'Admin', 
            email: user.email,
            roleId: 'Admin',
            isActive: true,
            createdAt: new Date().toISOString() 
          });
          
          await setDoc(doc(firestore, 'users', user.uid), {
            id: user.uid,
            username: user.displayName || user.email?.split('@')[0] || 'Admin',
            email: user.email,
            firstName: 'System',
            lastName: 'Admin',
            roleId: 'Admin',
            isActive: true,
            createdAt: new Date().toISOString()
          });
        }
        
        // 2. Seed Sample Data - Overwrites with clean demo data
        seedCleanDemoData(firestore, user.uid);
      });
    }
  }, [user, firestore]);

  return null;
}

async function seedCleanDemoData(db: any, userId: string) {
  // We use a "flag" to ensure we only reset once per session if needed, 
  // but for this specific request we want to ensure these specific documents exist.
  const batch = writeBatch(db);

  // --- SYSTEM SETTINGS ---
  const pricingRef = doc(db, 'system_settings', 'pricing_config');
  batch.set(pricingRef, {
    sqInchDivider: 625,
    decimalPrecision: 4,
    currencySymbol: "₹",
    pricingMode: "divider",
    lastUpdatedAt: serverTimestamp()
  });

  // --- ROLL SETTINGS ---
  const rollSettingsRef = doc(db, 'roll_settings', 'global_config');
  batch.set(rollSettingsRef, {
    parentPrefix: "TLC-",
    startNumber: 1000,
    childType: "alphabet",
    subChildType: "number",
    separator: "-",
    barcodePrefix: "BC-",
    trackingYear: 2026
  });

  // --- COUNTERS ---
  const jobCounterRef = doc(db, 'counters', 'job_counter');
  batch.set(jobCounterRef, {
    prefix: "JOB-",
    year: 2026,
    current_number: 1
  });

  // --- CLIENTS (Stored in 'customers' for UI compatibility) ---
  const clientRef = doc(db, 'customers', 'alexa-demo-id');
  batch.set(clientRef, {
    id: 'alexa-demo-id',
    name: "Alexa Lifesciences",
    address: "Kolkata",
    phone: "9876543210",
    email: "info@alexa.com",
    gstNumber: "19ABCDE1234F1Z5",
    status: "Active",
    createdAt: serverTimestamp(),
    createdById: userId
  });

  // --- SAMPLE JOB ---
  const jobRef = doc(db, 'jobs', 'demo-job-1');
  batch.set(jobRef, {
    jobId: "demo-job-1",
    jobNumber: "JOB-2026-0001",
    jobType: "Repeat",
    clientName: "Alexa Lifesciences",
    salesUserName: "Sales User",
    jobDate: serverTimestamp(),
    status: "Pending Approval",
    adminApproved: false,
    remarks: "Send for Plates.",
    artworkUrl: "https://picsum.photos/seed/alexa1/400/400",
    items: [
      {
        id: "item-1",
        material: "CHROMO",
        brand: "ALEXA",
        itemName: "NOREX 500ml",
        widthMM: 55,
        heightMM: 75,
        core: "3 inch",
        od: "9 inch OD",
        rollDirection: "Bottom First",
        quantity: 300000,
        pricePerSqInch: 0.45,
        totalSqInch: 6.6,
        costPerLabel: 2.97,
        totalJobValue: 891000,
        artworkUrl: "https://picsum.photos/seed/alexa1/400/400"
      }
    ],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    salesUserId: userId
  });

  // --- MASTER DATA FALLBACKS (To ensure dropdowns work) ---
  const matRef = doc(db, 'materials', 'chromo-demo');
  batch.set(matRef, { id: 'chromo-demo', name: 'CHROMO', gsm: 80, ratePerSqMeter: 22.50 });

  const machRef = doc(db, 'machines', 'flexo-demo');
  batch.set(machRef, { id: 'flexo-demo', name: 'UV Flexo 8-Color', maxPrintingWidthMm: 250, costPerHour: 1500 });

  await batch.commit();
}
