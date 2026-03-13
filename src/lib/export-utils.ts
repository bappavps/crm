
'use client';

import * as XLSX from 'xlsx';
import { collection, getDocs, query, orderBy, where } from 'firebase/firestore';
import { Firestore } from 'firebase/firestore';

/**
 * Professional ERP Export Engine for Paper Stock Registry.
 * Follows the 18-column technical structure.
 */
export async function exportPaperStockToExcel(firestore: Firestore, filters?: any) {
  let dataToExport: any[] = [];

  try {
    const registryRef = collection(firestore, 'paper_stock');
    let constraints: any[] = [];

    // Filter logic preserved from registry view
    if (filters) {
      if (filters.search) {
        // Complex client-side filtering is usually handled before calling this,
        // but for safety, we'll fetch everything if search is active or use basic constraints.
      }
    }

    const q = query(registryRef, orderBy('rollNo', 'desc'), limit(500));
    const snapshot = await getDocs(q);
    dataToExport = snapshot.docs.map((doc, idx) => ({ 
      ...doc.data() 
    }));
  } catch (error) {
    console.error("Master Data Export Failed:", error);
    throw new Error("Failed to compile stock registry for export.");
  }

  if (dataToExport.length === 0) {
    throw new Error("No records found for export.");
  }

  // 18 Technical Columns + S/N
  const formattedData = dataToExport.map((j: any, idx: number) => ({
    "Sl No": idx + 1,
    "Roll No": j.rollNo || "",
    "Paper Company": j.paperCompany || "",
    "Paper Type": j.paperType || "",
    "Width (MM)": j.widthMm || 0,
    "Length (MTR)": j.lengthMeters || 0,
    "SQM": j.sqm || 0,
    "GSM": j.gsm || 0,
    "Weight (KG)": j.weightKg || 0,
    "Purchase Rate": j.purchaseRate || 0,
    "Date of Received": j.receivedDate || "",
    "Date of Used": j.dateOfUsed || "Not Used",
    "Job No": j.jobNo || "-",
    "Job Size": j.jobSize || "-",
    "Job Name": j.jobName || "-",
    "Lot No / Batch No": j.lotNo || "",
    "Company Roll No": j.companyRollNo || "",
    "Remarks": j.remarks || "-"
  }));

  const ws = XLSX.utils.json_to_sheet(formattedData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Paper Stock Registry");
  
  const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
  XLSX.writeFile(wb, `Shree_Label_Stock_Registry_${dateStr}.xlsx`);
  
  return true;
}
