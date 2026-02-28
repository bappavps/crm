'use client';

import * as XLSX from 'xlsx';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { Firestore } from 'firebase/firestore';

/**
 * Shared utility to export paper stock (jumbo_stock) to Excel.
 * Supports exporting full stock or a filtered subset.
 */
export async function exportPaperStockToExcel(firestore: Firestore, filteredData?: any[]) {
  let dataToExport = filteredData;

  // If no filtered data is provided, fetch everything from the master registry
  if (!dataToExport) {
    try {
      const jumboRef = collection(firestore, 'jumbo_stock');
      const q = query(jumboRef, orderBy('receivedDate', 'desc'));
      const snapshot = await getDocs(q);
      dataToExport = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error("Export failed:", error);
      throw new Error("Failed to fetch full stock for export. Check connectivity.");
    }
  }

  if (!dataToExport || dataToExport.length === 0) {
    throw new Error("No data available to export.");
  }

  // Map Firestore fields to the requested professional column headers
  const formattedData = dataToExport.map((j: any) => ({
    "ROLL NO": j.rollNo || "",
    "PAPER COMPANY": j.paperCompany || "",
    "PAPER TYPE": j.paperType || "",
    "GSM": j.gsm || 0,
    "WIDTH (MM)": j.widthMm || 0,
    "LENGTH (MTR)": j.lengthMeters || 0,
    "SQM": j.sqm || 0,
    "WEIGHT (KG)": j.weightKg || 0,
    "SUPPLIER": j.paperCompany || "", 
    "GRN NO": j.rollNo || "", 
    "PURCHASE DATE": j.receivedDate || "",
    "RATE PER SQM": j.purchaseRate || 0,
    "LOCATION": j.location || "Main Store",
    "STATUS": j.status || "In Stock"
  }));

  const ws = XLSX.utils.json_to_sheet(formattedData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Paper Stock Registry");
  
  // Format: paper_stock_full_export_YYYYMMDD.xlsx
  const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
  XLSX.writeFile(wb, `paper_stock_full_export_${dateStr}.xlsx`);
  
  return true;
}
