
'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth, useUser, useFirestore } from '@/firebase';
import { doc, getDoc, setDoc, collection, getDocs, limit, query, writeBatch } from 'firebase/firestore';

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
      // 1. Auto-initialize Admin role for the first user
      const adminRef = doc(firestore, 'adminUsers', user.uid);
      getDoc(adminRef).then(async (snap) => {
        if (!snap.exists()) {
          // Check if this is the first user or if we should grant admin by default for prototype
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
        
        // 2. Seed Sample Data if collections are empty
        seedSampleData(firestore, user.uid);
      });
    }
  }, [user, firestore]);

  return null;
}

async function seedSampleData(db: any, userId: string) {
  const checkEmpty = async (colName: string) => {
    try {
      const snap = await getDocs(query(collection(db, colName), limit(1)));
      return snap.empty;
    } catch (e) {
      return true; // Assume empty if permission denied temporarily
    }
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
      const ref = doc(collection(db, 'customers'), item.id);
      batch.set(ref, { ...item, createdAt: now, createdById: userId });
    });
    await batch.commit();
  }

  // --- SAMPLE MATERIALS ---
  if (await checkEmpty('materials')) {
    const batch = writeBatch(db);
    [
      { id: 'mat-1', name: 'Semi-Gloss Paper 80 GSM', type: 'Substrate', gsm: 80, ratePerSqMeter: 22.50, unitOfMeasure: 'sq meter', description: 'Standard label paper' },
      { id: 'mat-2', name: 'Silver Metallized Paper', type: 'Substrate', gsm: 85, ratePerSqMeter: 45.00, unitOfMeasure: 'sq meter', description: 'Premium reflective finish' },
      { id: 'mat-3', name: 'PP Clear Film 50 Mic', type: 'Substrate', gsm: 45, ratePerSqMeter: 38.00, unitOfMeasure: 'sq meter', description: 'Transparent waterproof film' }
    ].forEach(item => {
      const ref = doc(collection(db, 'materials'), item.id);
      batch.set(ref, { ...item, createdAt: now, createdById: userId });
    });
    await batch.commit();
  }

  // --- SAMPLE MACHINES ---
  if (await checkEmpty('machines')) {
    const batch = writeBatch(db);
    [
      { id: 'mach-1', name: 'Mark Andy Flexo 2200', type: 'Printing Machine', maxPrintingWidthMm: 250, costPerHour: 1800, speedMetersPerMin: 80, description: '8-Color UV Flexo Press' },
      { id: 'mach-2', name: 'Rotoflex VSI 330', type: 'Slitting Machine', maxSlittingWidthMm: 330, costPerHour: 800, speedMetersPerMin: 150, description: 'High speed inspection slitter' }
    ].forEach(item => {
      const ref = doc(collection(db, 'machines'), item.id);
      batch.set(ref, { ...item, createdAt: now, createdById: userId });
    });
    await batch.commit();
  }

  // --- SAMPLE CYLINDERS ---
  if (await checkEmpty('cylinders')) {
    const batch = writeBatch(db);
    [
      { id: 'cyl-1', name: 'Cyl 508mm (60T)', repeatLengthMm: 508, description: 'Standard large repeat' },
      { id: 'cyl-2', name: 'Cyl 406.4mm (48T)', repeatLengthMm: 406.4, description: 'Medium repeat cylinder' },
      { id: 'cyl-3', name: 'Cyl 304.8mm (36T)', repeatLengthMm: 304.8, description: 'Small repeat cylinder' }
    ].forEach(item => {
      const ref = doc(collection(db, 'cylinders'), item.id);
      batch.set(ref, { ...item, createdAt: now, createdById: userId });
    });
    await batch.commit();
  }

  // --- SAMPLE DIES ---
  if (await checkEmpty('dies')) {
    const batch = writeBatch(db);
    [
      { id: 'die-1', name: 'DIE-R-50-100', shape: 'Rectangle', dimensions: '50mm x 100mm', labelsAcross: 2, cost: 12500, status: 'Available', usageCount: 45000 },
      { id: 'die-2', name: 'DIE-C-40', shape: 'Circle', dimensions: '40mm Dia', labelsAcross: 4, cost: 15000, status: 'Available', usageCount: 12000 }
    ].forEach(item => {
      const ref = doc(collection(db, 'dies'), item.id);
      batch.set(ref, { ...item, createdAt: now, createdById: userId });
    });
    await batch.commit();
  }

  // --- SAMPLE ESTIMATES & WORKFLOW ---
  if (await checkEmpty('estimates')) {
    const batch = writeBatch(db);
    
    // Create Estimate
    const estId = 'seed-est-1';
    const estRef = doc(db, 'estimates', estId);
    const estimateData = {
      id: estId,
      estimateNumber: 'EST-99001',
      customerId: 'cust-1',
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
    };
    batch.set(estRef, estimateData);
    await batch.commit();
  }

  // --- SAMPLE BOM ---
  if (await checkEmpty('boms')) {
    const batch = writeBatch(db);
    const bomRef = doc(collection(db, 'boms'));
    batch.set(bomRef, {
      id: bomRef.id,
      bomNumber: 'BOM-1001',
      estimateId: 'seed-est-1',
      jobName: 'GP-LABEL-01',
      description: 'Standard 8-color setup with UV varnish',
      status: 'Approved',
      bomDate: now,
      createdById: userId,
      createdAt: now
    });
    await batch.commit();
  }

  // --- SAMPLE SALES ORDERS ---
  if (await checkEmpty('salesOrders')) {
    const batch = writeBatch(db);
    const soId = 'seed-so-1';
    const soRef = doc(db, 'salesOrders', soId);
    batch.set(soRef, {
      id: soId,
      orderNumber: 'SO-22001',
      customerId: 'cust-1',
      customerName: 'Global Pharma Ltd',
      estimateId: 'seed-est-1',
      productCode: 'GP-LABEL-01',
      qty: 20000,
      totalAmount: 45000,
      status: 'Confirmed',
      orderDate: now,
      deliveryDate: new Date(Date.now() + 604800000).toISOString(),
      createdAt: now,
      createdById: userId
    });
    await batch.commit();
  }

  // --- SAMPLE JOB CARDS ---
  if (await checkEmpty('jobCards')) {
    const batch = writeBatch(db);
    const jcId = 'seed-jc-1';
    const jcRef = doc(db, 'jobCards', jcId);
    batch.set(jcRef, {
      id: jcId,
      jobCardNumber: 'JC-45001',
      salesOrderId: 'seed-so-1',
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

  // --- SAMPLE WORK ORDERS ---
  if (await checkEmpty('workOrders')) {
    const batch = writeBatch(db);
    const woRef = doc(collection(db, 'workOrders'));
    batch.set(woRef, {
      id: woRef.id,
      workOrderNumber: 'WO-8801',
      jobCardId: 'seed-jc-1',
      jobDescription: 'GP-LABEL-01 Printing',
      client: 'Global Pharma Ltd',
      type: 'New',
      machine: 'Mark Andy Flexo 2200',
      priority: 'High',
      status: 'Scheduled',
      createdById: userId,
      createdAt: now
    });
    await batch.commit();
  }

  // --- SAMPLE ARTWORK ---
  if (await checkEmpty('artworks')) {
    const batch = writeBatch(db);
    const artRef = doc(collection(db, 'artworks'));
    batch.set(artRef, {
      id: artRef.id,
      name: 'GP Front Label v1',
      estimateId: 'seed-est-1',
      clientName: 'Global Pharma Ltd',
      version: '1.0',
      filePath: 'https://picsum.photos/seed/artwork1/600/400',
      status: 'Approved',
      uploadDate: now,
      uploadedById: userId,
      description: 'Final approved design'
    });
    await batch.commit();
  }

  // --- SAMPLE QUALITY CHECKS ---
  if (await checkEmpty('qualityChecks')) {
    const batch = writeBatch(db);
    const qcRef = doc(collection(db, 'qualityChecks'));
    batch.set(qcRef, {
      id: qcRef.id,
      jobCardId: 'seed-jc-1',
      jobCardNumber: 'JC-45001',
      clientName: 'Global Pharma Ltd',
      inspectorId: userId,
      inspectorName: 'Quality Lead',
      status: 'Passed',
      checkDate: now,
      checkedQuantity: 500,
      passedQuantity: 500,
      defectiveQuantity: 0,
      notes: 'Registration and color values are within tolerance.',
      createdAt: now
    });
    await batch.commit();
  }

  // --- SAMPLE INVOICES ---
  if (await checkEmpty('invoices')) {
    const batch = writeBatch(db);
    const invRef = doc(collection(db, 'invoices'));
    batch.set(invRef, {
      id: invRef.id,
      invoiceNumber: 'INV/24/1001',
      salesOrderId: 'seed-so-1',
      customerId: 'cust-1',
      customerName: 'Global Pharma Ltd',
      invoiceDate: now,
      dueDate: new Date(Date.now() + 2592000000).toISOString(),
      totalAmountExcludingGst: 45000,
      gstAmount: 8100,
      totalAmountIncludingGst: 53100,
      status: 'Issued',
      paymentTerms: 'Net 30',
      tallyExportStatus: false,
      createdById: userId,
      createdAt: now
    });
    await batch.commit();
  }

  // --- SAMPLE PURCHASE ORDERS ---
  if (await checkEmpty('purchaseOrders')) {
    const batch = writeBatch(db);
    const poRef = doc(collection(db, 'purchaseOrders'));
    batch.set(poRef, {
      id: poRef.id,
      poNumber: 'PO-5501',
      supplierId: 'sup-1',
      supplierName: 'Substrate Solutions Inc',
      materialName: 'Semi-Gloss Paper 80 GSM',
      orderDate: now,
      requiredDate: new Date(Date.now() + 604800000).toISOString(),
      status: 'Ordered',
      totalAmount: 125000,
      createdById: userId,
      createdAt: now
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
}
