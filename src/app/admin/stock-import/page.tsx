"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { 
  FileDown, 
  FileUp, 
  Loader2, 
  Download,
  Boxes,
  Database,
  History
} from "lucide-react"
import { useFirestore, useUser, useDoc, useMemoFirebase, useCollection } from "@/firebase"
import { 
  collection, 
  doc, 
  writeBatch, 
  getDocs, 
  query, 
  setDoc,
  serverTimestamp,
  orderBy,
  limit
} from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import * as XLSX from 'xlsx'

const TEMPLATE_HEADERS = [
  "RELL NO", "PAPER COMPANY", "PAPER TYPE", "WIDTH (MM)", "LENGTH (MTR)", 
  "SQM", "GSM", "WEIGHT(KG)", "Purchase Rate", "WASTAGE", 
  "DATE OF USE", "DATE OF RECEIVED", "Job no", "SIZE", "PRODUCT NAME", 
  "Code", "Lot no/BATCH NO", "Date", "Company Rell no"
];

export default function StockImportPage() {
  const { toast } = useToast()
  const { user } = useUser()
  const firestore = useFirestore()
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [importSummary, setSummary] = useState<any>(null)

  const adminDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'adminUsers', user.uid);
  }, [firestore, user]);
  const { data: adminData } = useDoc(adminDocRef);

  const logsQuery = useMemoFirebase(() => {
    if (!firestore || !adminData) return null;
    return query(collection(firestore, 'system_logs/stock_import_logs/history'), orderBy('timestamp', 'desc'), limit(10));
  }, [firestore, adminData]);
  const { data: history } = useCollection(logsQuery);

  const downloadTemplate = () => {
    const sampleData = [
      {
        "RELL NO": "TLC-1001",
        "PAPER COMPANY": "Avery Dennison",
        "PAPER TYPE": "CHROMO",
        "WIDTH (MM)": 1020,
        "LENGTH (MTR)": 3000,
        "SQM": 3060,
        "GSM": 80,
        "WEIGHT(KG)": 245,
        "Purchase Rate": 22.50,
        "WASTAGE": 0,
        "DATE OF USE": "",
        "DATE OF RECEIVED": new Date().toISOString().split('T')[0],
        "Job no": "",
        "SIZE": "1020mm",
        "PRODUCT NAME": "Fasson Chromo",
        "Code": "AW0331",
        "Lot no/BATCH NO": "LOT-998877",
        "Date": new Date().toISOString().split('T')[0],
        "Company Rell no": "MFR-ROLL-01"
      }
    ];

    const ws = XLSX.utils.json_to_sheet(sampleData, { header: TEMPLATE_HEADERS });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Jumbo Stock Template");
    XLSX.writeFile(wb, "jumbo_stock_template_v2.xlsx");
    toast({ title: "Template Downloaded", description: "Use this 19-column structure for imports." });
  }

  const exportCurrentStock = async () => {
    if (!firestore) return;
    setIsProcessing(true);
    try {
      const snapshot = await getDocs(query(collection(firestore, 'jumbo_stock'), orderBy('rollNo', 'asc')));
      const data = snapshot.docs.map(d => {
        const item = d.data();
        return {
          "RELL NO": item.rollNo,
          "PAPER COMPANY": item.paperCompany,
          "PAPER TYPE": item.paperType,
          "WIDTH (MM)": item.widthMm,
          "LENGTH (MTR)": item.lengthMeters,
          "SQM": item.sqm,
          "GSM": item.gsm,
          "WEIGHT(KG)": item.weightKg,
          "Purchase Rate": item.purchaseRate,
          "WASTAGE": item.wastage || 0,
          "DATE OF USE": item.dateOfUse || "",
          "DATE OF RECEIVED": item.receivedDate || "",
          "Job no": item.jobNo || "",
          "SIZE": item.size || "",
          "PRODUCT NAME": item.productName || "",
          "Code": item.code || "",
          "Lot no/BATCH NO": item.lotNo || "",
          "Date": item.date || "",
          "Company Rell no": item.companyRollNo || ""
        };
      });

      const ws = XLSX.utils.json_to_sheet(data, { header: TEMPLATE_HEADERS });
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Current Stock");
      const date = new Date().toISOString().split('T')[0].replace(/-/g, '_');
      XLSX.writeFile(wb, `jumbo_stock_export_${date}.xlsx`);
      toast({ title: "Export Complete", description: `Exported ${data.length} records.` });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Export Failed", description: e.message });
    } finally {
      setIsProcessing(false);
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !firestore || !user) return;

    setIsProcessing(true);
    setProgress(0);
    setSummary(null);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        if (data.length === 0) throw new Error("File is empty.");

        const firstRow = data[0] as any;
        const required = ["RELL NO", "PAPER COMPANY", "PAPER TYPE", "WIDTH (MM)", "LENGTH (MTR)", "Lot no/BATCH NO"];
        const missing = required.filter(k => !(k in firstRow));
        if (missing.length > 0) throw new Error(`Missing columns: ${missing.join(', ')}`);

        const existingSnap = await getDocs(collection(firestore, 'jumbo_stock'));
        const existingRolls = new Set(existingSnap.docs.map(d => d.data().rollNo));

        let inserted = 0;
        let skipped = 0;
        let maxSerial = 0;

        const totalRows = data.length;
        for (let i = 0; i < totalRows; i += 50) {
          const batch = writeBatch(firestore);
          const chunk = data.slice(i, i + 50);

          chunk.forEach((row: any) => {
            const rollId = String(row["RELL NO"]);
            if (existingRolls.has(rollId)) {
              skipped++;
              return;
            }

            const width = Number(row["WIDTH (MM)"]);
            const length = Number(row["LENGTH (MTR)"]);
            const sqm = Number(row["SQM"]) || (width * length / 1000);

            const docRef = doc(collection(firestore, 'jumbo_stock'));
            batch.set(docRef, {
              rollNo: rollId,
              barcode: rollId,
              paperCompany: row["PAPER COMPANY"],
              paperType: row["PAPER TYPE"],
              widthMm: width,
              lengthMeters: length,
              sqm: sqm,
              gsm: Number(row["GSM"]),
              weightKg: Number(row["WEIGHT(KG)"]),
              purchaseRate: Number(row["Purchase Rate"]),
              wastage: Number(row["WASTAGE"] || 0),
              dateOfUse: row["DATE OF USE"] || "",
              receivedDate: row["DATE OF RECEIVED"] || new Date().toISOString(),
              jobNo: row["Job no"] || "",
              size: row["SIZE"] || "",
              productName: row["PRODUCT NAME"] || "",
              code: row["Code"] || "",
              lotNo: row["Lot no/BATCH NO"] || "",
              date: row["Date"] || "",
              companyRollNo: row["Company Rell no"] || "",
              status: "In Stock",
              createdAt: new Date().toISOString(),
              createdById: user.uid
            });

            const numericPart = parseInt(rollId.replace(/\D/g, ''));
            if (!isNaN(numericPart) && numericPart > maxSerial) {
              maxSerial = numericPart;
            }
            inserted++;
          });

          await batch.commit();
          setProgress(Math.round(((i + chunk.length) / totalRows) * 100));
        }

        if (maxSerial > 0) {
          const counterRef = doc(firestore, 'counters', 'jumbo_roll');
          await setDoc(counterRef, { current_number: maxSerial - 1000 }, { merge: true });
        }

        const logRef = doc(collection(firestore, 'system_logs/stock_import_logs/history'));
        await setDoc(logRef, {
          fileName: file.name,
          totalRows,
          inserted,
          skipped,
          timestamp: serverTimestamp(),
          userId: user.uid,
          userName: user.displayName || user.email
        });

        setSummary({ totalRows, inserted, skipped, maxSerial });
        toast({ title: "Import Successful", description: `Added ${inserted} rolls. ${skipped} duplicates skipped.` });
      } catch (err: any) {
        toast({ variant: "destructive", title: "Import Failed", description: err.message });
      } finally {
        setIsProcessing(false);
      }
    };
    reader.readAsBinaryString(file);
  }

  if (!adminData) return <div className="p-20 text-center text-muted-foreground">Admin Access Required.</div>

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">Bulk Stock Management (GRN V2)</h2>
          <p className="text-muted-foreground">Import legacy jumbo inventory with full 19-column technical mapping.</p>
        </div>
        <Badge variant="outline" className="h-8 px-4 font-bold text-lg">ADMIN CONSOLE</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileUp className="h-5 w-5 text-primary" /> Stock Import (Excel)
              </CardTitle>
              <CardDescription>Upload stock using the standard .xlsx template to maintain numbering and pharma traceability.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <Button variant="outline" onClick={downloadTemplate} className="h-20 flex-col gap-2 border-dashed">
                  <Download className="h-6 w-6" />
                  <span>Download Template</span>
                </Button>
                <Button variant="outline" onClick={exportCurrentStock} className="h-20 flex-col gap-2 border-dashed" disabled={isProcessing}>
                  {isProcessing ? <Loader2 className="animate-spin h-6 w-6" /> : <FileDown className="h-6 w-6" />}
                  <span>Export Current Stock</span>
                </Button>
              </div>

              <div className="border-2 border-dashed rounded-xl p-8 text-center space-y-4 bg-muted/10 relative">
                <Input 
                  type="file" 
                  accept=".xlsx" 
                  className="absolute inset-0 opacity-0 cursor-pointer z-10" 
                  onChange={handleFileUpload}
                  disabled={isProcessing}
                />
                <Boxes className="h-12 w-12 mx-auto text-muted-foreground/40" />
                <div className="space-y-1">
                  <p className="font-bold">Click or drag Excel file here</p>
                  <p className="text-xs text-muted-foreground">Only .xlsx files are supported. Template v2 required.</p>
                </div>
              </div>

              {isProcessing && (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-bold text-primary uppercase">
                    <span>Processing Batch...</span>
                    <span>{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
              )}

              {importSummary && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 grid grid-cols-3 gap-4 text-center animate-in fade-in slide-in-from-top-2">
                  <div className="space-y-1">
                    <p className="text-[10px] text-emerald-700 font-bold uppercase">Inserted</p>
                    <p className="text-2xl font-black text-emerald-900">{importSummary.inserted}</p>
                  </div>
                  <div className="space-y-1 border-x border-emerald-200">
                    <p className="text-[10px] text-emerald-700 font-bold uppercase">Skipped</p>
                    <p className="text-2xl font-black text-emerald-900">{importSummary.skipped}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-emerald-700 font-bold uppercase">Counter Updated</p>
                    <p className="text-2xl font-black text-emerald-900">#{importSummary.maxSerial}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <History className="h-4 w-4 text-primary" /> Recent Import Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {history?.map((log) => (
                  <div key={log.id} className="flex items-center justify-between p-3 border rounded-lg bg-muted/5">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-full">
                        <Database className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-bold truncate max-w-[200px]">{log.fileName}</p>
                        <p className="text-[10px] text-muted-foreground">{new Date(log.timestamp?.toDate()).toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant="secondary" className="text-[10px]">{log.inserted} Added</Badge>
                      <p className="text-[9px] text-muted-foreground mt-1">by {log.userName}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-sm font-bold text-primary uppercase">Full Schema Registry</CardTitle>
          </CardHeader>
          <CardContent className="text-[10px] space-y-2 text-muted-foreground">
            <p>1. <strong>RELL NO</strong> (Primary Key)</p>
            <p>2. <strong>PAPER COMPANY</strong></p>
            <p>3. <strong>PAPER TYPE</strong> (Substrate)</p>
            <p>4. <strong>WIDTH (MM)</strong></p>
            <p>5. <strong>LENGTH (MTR)</strong></p>
            <p>6. <strong>SQM</strong> (Auto-calc if null)</p>
            <p>7. <strong>GSM</strong></p>
            <p>8. <strong>WEIGHT(KG)</strong></p>
            <p>9. <strong>Lot no/BATCH NO</strong> (Mandatory)</p>
            <p>10. <strong>Company Rell no</strong> (Mandatory)</p>
            <div className="pt-2 border-t mt-4 text-[9px] italic">
              * The system preserves pharmaceutical traceability across all 19 technical columns.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
