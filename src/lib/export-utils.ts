
'use client';

import * as XLSX from 'xlsx';
import { collection, getDocs, query, orderBy, where } from 'firebase/firestore';
import { Firestore } from 'firebase/firestore';

/**
 * Professional ERP Export Engine for Substrate Stock.
 * Supports multi-field filtering and pharmaceutical traceability columns.
 */
export async function exportPaperStockToExcel(firestore: Firestore, filters?: any) {
  let dataToExport: any[] = [];

  try {
    const jumboRef = collection(firestore, 'jumbo_stock');
    let constraints: any[] = [];

    if (filters) {
      if (filters.companies?.length > 0) constraints.push(where('paperCompany', 'in', filters.companies.slice(0, 10)));
      if (filters.types?.length > 0) constraints.push(where('paperType', 'in', filters.types.slice(0, 10)));
      if (filters.gsms?.length > 0) constraints.push(where('gsm', 'in', filters.gsms.slice(0, 10).map(Number)));
      if (filters.suppliers?.length > 0) constraints.push(where('supplier', 'in', filters.suppliers.slice(0, 10)));
      if (filters.locations?.length > 0) constraints.push(where('location', 'in', filters.locations.slice(0, 10)));
      if (filters.statuses?.length > 0) constraints.push(where('status', 'in', filters.statuses.slice(0, 10)));
      
      if (filters.startDate) constraints.push(where('receivedDate', '>=', filters.startDate));
      if (filters.endDate) constraints.push(where('receivedDate', '<=', filters.endDate));
    }

    const q = constraints.length > 0 
      ? query(jumboRef, ...constraints)
      : query(jumboRef, orderBy('receivedDate', 'desc'));

    const snapshot = await getDocs(q);
    dataToExport = snapshot.docs.map((doc, idx) => ({ 
      sn: idx + 1,
      ...doc.data() 
    }));
  } catch (error) {
    console.error("Master Data Export Failed:", error);
    throw new Error("Failed to compile stock registry for export.");
  }

  if (dataToExport.length === 0) {
    throw new Error("No matching records found for the current filter criteria.");
  }

  // 19 Technical Columns + S/N
  const formattedData = dataToExport.map((j: any) => ({
    "S/N": j.sn,
    "RELL NO": j.rollNo || "",
    "PAPER COMPANY": j.paperCompany || "",
    "PAPER TYPE": j.paperType || "",
    "WIDTH (MM)": j.widthMm || 0,
    "LENGTH (MTR)": j.lengthMeters || 0,
    "SQM": j.sqm || 0,
    "GSM": j.gsm || 0,
    "WEIGHT (KG)": j.weightKg || 0,
    "PURCHASE RATE": j.purchaseRate || 0,
    "WASTAGE": j.wastage || 0,
    "DATE OF USE": j.dateOfUse || "-",
    "DATE RECEIVED": j.receivedDate || "",
    "JOB NO": j.jobNo || "-",
    "SIZE": j.size || "-",
    "PRODUCT NAME": j.productName || "-",
    "CODE": j.code || "-",
    "LOT NO": j.lotNo || "",
    "DATE": j.date || "-",
    "COMPANY RELL NO": j.companyRollNo || ""
  }));

  const ws = XLSX.utils.json_to_sheet(formattedData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Stock Registry");
  
  const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
  XLSX.writeFile(wb, `shree_label_stock_export_${dateStr}.xlsx`);
  
  return true;
}
