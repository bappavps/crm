'use client';

import { useEffect } from 'react';
import { useAuth, useUser, initiateAnonymousSignIn, useFirestore } from '@/firebase';
import { doc, getDoc, setDoc, collection, getDocs, limit, query, writeBatch } from 'firebase/firestore';

/**
 * Automatically signs the user in anonymously if they aren't authenticated.
 * Also initializes the Admin role and seeds sample data for the prototype.
 */
export function AuthInitializer() {
  const auth = useAuth();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();

  useEffect(() => {
    if (!isUserLoading && !user && auth) {
      initiateAnonymousSignIn(auth);
    }
  }, [user, isUserLoading, auth]);

  useEffect(() => {
    if (user && firestore) {
      // 1. Auto-initialize Admin role for the first user
      const adminRef = doc(firestore, 'adminUsers', user.uid);
      getDoc(adminRef).then(async (snap) => {
        if (!snap.exists()) {
          await setDoc(adminRef, { 
            id: user.uid, 
            username: user.displayName || 'Admin', 
            email: user.email,
            roleId: 'Admin',
            isActive: true,
            createdAt: new Date().toISOString() 
          });
          
          await setDoc(doc(firestore, 'users', user.uid), {
            id: user.uid,
            username: user.displayName || 'Admin',
            email: user.email,
            firstName: 'System',
            lastName: 'Admin',
            roleId: 'Admin',
            isActive: true,
            createdAt: new Date().toISOString()
          });

          // 2. Seed Sample Data if collections are empty
          seedSampleData(firestore, user.uid);
        }
      });
    }
  }, [user, firestore]);

  return null;
}

async function seedSampleData(db: any, userId: string) {
  const checkEmpty = async (colName: string) => {
    const snap = await getDocs(query(collection(db, colName), limit(1)));
    return snap.empty;
  };

  const now = new Date().toISOString();

  // --- SAMPLE CUSTOMERS ---
  if (await checkEmpty('customers')) {
    const batch = writeBatch(db);
    [
      { id: 'cust-1', name: 'Global Pharma Ltd', contactPerson: 'Dr. Amit Shah', email: 'amit@globalpharma.com', phone: '9876543210', address: 'Plot 45, GIDC, Ahmedabad', gstNumber: '24AAAAA0000A1Z5' },
      { id: 'cust-2', name: 'Organic Foods Co', contactPerson: 'Sarah Jones', email: 'sarah@organic.com', phone: '9123456789', address: 'Block B, Sector 12, Noida', gstNumber: '09BBBBB1111B1Z2' },
      { id: 'cust-3', name: 'Evergreen Logistics', contactPerson: 'Rajesh Kumar', email: 'rajesh@evergreen.in', phone: '9000011111', address: 'Warehouse 7, Port Area, Mumbai', gstNumber: '27CCCCC2222C1Z3' }
    ].forEach(item => {
      const ref = doc(collection(db, 'customers'));
      batch.set(ref, { ...item, id: ref.id, createdAt: now, createdById: userId });
    });
    await batch.commit();
  }

  // --- SAMPLE MATERIALS ---
  if (await checkEmpty('materials')) {
    const batch = writeBatch(db);
    [
      { name: 'Semi-Gloss Paper 80 GSM', type: 'Substrate', gsm: 80, ratePerSqMeter: 22.50, unitOfMeasure: 'sq meter', description: 'Standard label paper' },
      { name: 'Silver Metallized Paper', type: 'Substrate', gsm: 85, ratePerSqMeter: 45.00, unitOfMeasure: 'sq meter', description: 'Premium reflective finish' },
      { name: 'PP Clear Film 50 Mic', type: 'Substrate', gsm: 45, ratePerSqMeter: 38.00, unitOfMeasure: 'sq meter', description: 'Transparent waterproof film' }
    ].forEach(item => {
      const ref = doc(collection(db, 'materials'));
      batch.set(ref, { ...item, id: ref.id, createdAt: now, createdById: userId });
    });
    await batch.commit();
  }

  // --- SAMPLE MACHINES ---
  if (await checkEmpty('machines')) {
    const batch = writeBatch(db);
    [
      { name: 'Mark Andy Flexo 2200', type: 'Printing Machine', maxPrintingWidthMm: 250, costPerHour: 1800, speedMetersPerMin: 80, description: '8-Color UV Flexo Press' },
      { name: 'Rotoflex VSI 330', type: 'Slitting Machine', maxSlittingWidthMm: 330, costPerHour: 800, speedMetersPerMin: 150, description: 'High speed inspection slitter' }
    ].forEach(item => {
      const ref = doc(collection(db, 'machines'));
      batch.set(ref, { ...item, id: ref.id, createdAt: now, createdById: userId });
    });
    await batch.commit();
  }

  // --- SAMPLE CYLINDERS ---
  if (await checkEmpty('cylinders')) {
    const batch = writeBatch(db);
    [
      { name: 'Cyl 508mm (60T)', repeatLengthMm: 508, description: 'Standard large repeat' },
      { name: 'Cyl 406.4mm (48T)', repeatLengthMm: 406.4, description: 'Medium repeat cylinder' },
      { name: 'Cyl 304.8mm (36T)', repeatLengthMm: 304.8, description: 'Small repeat cylinder' }
    ].forEach(item => {
      const ref = doc(collection(db, 'cylinders'));
      batch.set(ref, { ...item, id: ref.id, createdAt: now, createdById: userId });
    });
    await batch.commit();
  }

  // --- SAMPLE DIES ---
  if (await checkEmpty('dies')) {
    const batch = writeBatch(db);
    [
      { name: 'DIE-R-50-100', shape: 'Rectangle', dimensions: '50mm x 100mm', labelsAcross: 2, cost: 12500, status: 'Available', usageCount: 45000 },
      { name: 'DIE-C-40', shape: 'Circle', dimensions: '40mm Dia', labelsAcross: 4, cost: 15000, status: 'Available', usageCount: 12000 }
    ].forEach(item => {
      const ref = doc(collection(db, 'dies'));
      batch.set(ref, { ...item, id: ref.id, createdAt: now, createdById: userId });
    });
    await batch.commit();
  }

  // --- SAMPLE INVENTORY ---
  if (await checkEmpty('inventoryItems')) {
    const batch = writeBatch(db);
    [
      { barcode: 'JMB-SG-001', name: 'Semi-Gloss Paper', itemType: 'Jumbo Roll', dimensions: '1020mm x 4000m', currentQuantity: 5, unitOfMeasure: 'rolls', status: 'In Stock' },
      { barcode: 'JMB-PP-002', name: 'Clear PP Film', itemType: 'Jumbo Roll', dimensions: '1020mm x 2000m', currentQuantity: 2, unitOfMeasure: 'rolls', status: 'Low Stock' },
      { barcode: 'INK-CYAN-01', name: 'UV Cyan Ink', itemType: 'Ink', currentQuantity: 15, unitOfMeasure: 'kg', status: 'In Stock' }
    ].forEach(item => {
      const ref = doc(collection(db, 'inventoryItems'));
      batch.set(ref, { ...item, id: ref.id, createdAt: now, createdById: userId });
    });
    await batch.commit();
  }

  // --- SAMPLE ESTIMATES & TRANSACTIONS ---
  if (await checkEmpty('estimates')) {
    const batch = writeBatch(db);
    const estRef = doc(collection(db, 'estimates'));
    batch.set(estRef, {
      id: estRef.id,
      estimateNumber: 'EST-99001',
      customerId: 'seed-cust-1',
      customerName: 'Global Pharma Ltd',
      productCode: 'GP-LABEL-01',
      labelLength: 50,
      labelWidth: 100,
      gap: 3,
      sideMargin: 5,
      repeatLength: 508,
      orderQuantity: 20000,
      status: 'Approved',
      totalSellingPrice: 45000,
      sellingPricePerLabel: 2.25,
      profit: 8500,
      createdAt: now,
      createdById: userId,
      estimateDate: now
    });
    
    // Convert to a Sales Order automatically for the seed
    const soRef = doc(collection(db, 'salesOrders'));
    batch.set(soRef, {
      id: soRef.id,
      orderNumber: 'SO-22001',
      customerId: 'seed-cust-1',
      customerName: 'Global Pharma Ltd',
      estimateId: estRef.id,
      productCode: 'GP-LABEL-01',
      qty: 20000,
      totalAmount: 45000,
      status: 'Confirmed',
      orderDate: now,
      deliveryDate: new Date(Date.now() + 604800000).toISOString(),
      createdAt: now,
      createdById: userId
    });

    // Create a Job Card for the seed
    const jcRef = doc(collection(db, 'jobCards'));
    batch.set(jcRef, {
      id: jcRef.id,
      jobCardNumber: 'JC-45001',
      salesOrderId: soRef.id,
      client: 'Global Pharma Ltd',
      label: 'GP-LABEL-01',
      productionQuantity: 20000,
      startDate: now,
      dueDate: new Date(Date.now() + 432000000).toISOString(),
      status: 'Running',
      progress: 35,
      createdAt: now,
      createdById: userId
    });

    await batch.commit();
  }
}
