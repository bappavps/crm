
"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { 
  FileUp, 
  FileDown, 
  Loader2, 
  CheckCircle2, 
  Table as TableIcon,
  Sparkles,
  ArrowRight,
  AlertCircle
} from "lucide-react"
import { useFirestore, useUser, errorEmitter, FirestorePermissionError } from "@/firebase"
import { doc, writeBatch, serverTimestamp } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import * as XLSX from 'xlsx'
import { ActionModal, ModalType } from "@/components/action-modal"

const TEMPLATE_HEADERS = [
  "RELL NO", "PAPER COMPANY", "PAPER TYPE", "WIDTH (MM)", "LENGTH (MTR)", 
  "SQM", "GSM", "WEIGHT(KG)", "Purchase Rate", "WASTAGE", 
  "DATE OF RECEIVED", "Job no", "SIZE", "PRODUCT NAME", 
  "Code", "Lot no/BATCH NO", "Date", "Company Rell no", "QUANTITY"
];

const SCHEMA_MAP: Record<string, string> = {
  "RELL NO": "rollNo",
  "PAPER COMPANY": "paperCompany",
  "PAPER TYPE": "paperType",
  "WIDTH (MM)": "widthMm",
  "LENGTH (MTR)": "lengthMeters",
  "SQM": "sqm",
  "GSM": "gsm",
  "WEIGHT(KG)": "weightKg",
  "Purchase Rate": "purchaseRate",
  "WASTAGE": "wastage",
  "DATE OF RECEIVED": "receivedDate",
  "Job no": "jobNo",
  "SIZE": "size",
  "PRODUCT NAME": "productName",
  "Code": "code",
  "Lot no/BATCH NO": "lotNo",
  "Date": "date",
  "Company Rell no": "companyRollNo",
  "QUANTITY": "quantity"
};

export default function StockImportPage() {
  const { user } = useUser()
  const firestore = useFirestore()
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [excelData, setExcelData] = useState<any[]>([])
  const [summary, setSummary] = useState<any>(null)

  const [modal, setModal] = useState<{
    isOpen: boolean;
    type: ModalType;
    title: string;
    description?: string;
    autoClose?: boolean;
  }>({
    isOpen: false,
    type: 'SUCCESS',
    title: '',
  });

  const showModal = (type: ModalType, title: string, description?: string, autoClose = false) => {
    setModal({ isOpen: true, type, title, description, autoClose });
  };

  const closeModal = () => setModal(prev => ({ ...prev, isOpen: false }));

  const downloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([], { header: TEMPLATE_HEADERS });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Stock Template");
    XLSX.writeFile(wb, "paper_stock_template_v2.xlsx");
    showModal('SUCCESS', 'Template Ready', 'Standard technical header mapping initiated.', true);
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const ab = evt.target?.result as ArrayBuffer;
        const wb = XLSX.read(ab, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws);
        
        if (data.length === 0) {
          showModal('ERROR', 'Empty Payload', 'No valid data rows detected in the spreadsheet.');
          return;
        }

        setExcelData(data);
        showModal('SUCCESS', 'Validation Passed', `${data.length} records verified for technical mapping.`, true);
      } catch (err) {
        showModal('ERROR', 'Parsing Error', 'File structure is invalid or corrupted.');
      }
    };
    reader.readAsArrayBuffer(file);
  }

  const executeImport = async () => {
    if (!firestore || !user || !excelData.length) return;
    setIsProcessing(true);
    setProgress(0);

    try {
      let imported = 0;
      const totalRows = excelData.length;

      for (let i = 0; i < totalRows; i += 500) {
        const batch = writeBatch(firestore);
        const chunk = excelData.slice(i, i + 500);

        chunk.forEach((row: any) => {
          const rollId = String(row["RELL NO"]);
          if (!rollId || rollId.trim() === "") return;

          const data: any = { 
            status: 'In Stock', 
            createdAt: serverTimestamp(), 
            createdById: user.uid 
          };

          Object.entries(SCHEMA_MAP).forEach(([header, key]) => {
            let val = row[header];
            if (['widthMm', 'lengthMeters', 'gsm', 'weightKg', 'purchaseRate', 'wastage', 'quantity'].includes(key)) {
              val = Number(val) || 0;
            }
            data[key] = val;
          });

          const w = Number(data.widthMm) || 0;
          const l = Number(data.lengthMeters) || 0;
          const q = Number(data.quantity) || 1;
          data.sqm = Number(((w / 1000) * l * q).toFixed(2));

          batch.set(doc(firestore, 'paper_stock', rollId), data, { merge: true });
          imported++;
        });

        await batch.commit().catch(async (serverError) => {
          const permissionError = new FirestorePermissionError({
            path: 'paper_stock',
            operation: 'write',
          });
          errorEmitter.emit('permission-error', permissionError);
          throw serverError;
        });
        
        setProgress(Math.round(((i + chunk.length) / totalRows) * 100));
      }

      setSummary({ total: totalRows, imported });
      showModal('SUCCESS', 'Bulk Import Complete', `Successfully processed ${imported} substrate records.`, true);
    } catch (err: any) {
      showModal('ERROR', 'Transactional Failure', err.message);
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 font-sans">
      <ActionModal 
        isOpen={modal.isOpen}
        onClose={closeModal}
        type={modal.type}
        title={modal.title}
        description={modal.description}
        autoClose={modal.autoClose}
      />

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black text-primary uppercase tracking-tight">Stock Import Engine</h2>
          <p className="text-muted-foreground font-medium text-xs">Bulk technical migration via optimized Excel mapping.</p>
        </div>
        <Button variant="outline" onClick={downloadTemplate} className="font-black text-[10px] uppercase h-10 border-2">
          <FileDown className="mr-2 h-4 w-4" /> Download V2 Template
        </Button>
      </div>

      <div className="grid gap-6">
        <Card className="border-dashed border-2 bg-muted/5 rounded-2xl overflow-hidden">
          <CardContent className="pt-12 pb-12 text-center space-y-4">
            <div className="h-20 w-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-primary/20 border-dashed">
              <FileUp className="h-10 w-10 text-primary opacity-60" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="file-upload" className="cursor-pointer group block">
                <span className="text-2xl font-black text-primary underline underline-offset-8 decoration-primary/30 group-hover:decoration-primary transition-all">Upload Spreadsheet</span>
                <Input id="file-upload" type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileUpload} />
              </Label>
              <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest pt-2">Only .xlsx / .xls technical maps supported</p>
            </div>
          </CardContent>
        </Card>

        {excelData.length > 0 && !summary && (
          <Card className="shadow-2xl border-none rounded-2xl overflow-hidden animate-in slide-in-from-bottom-4">
            <CardHeader className="bg-primary/5 border-b p-6">
              <CardTitle className="text-sm font-black uppercase flex items-center justify-between tracking-widest">
                <div className="flex items-center gap-2">
                  <TableIcon className="h-4 w-4 text-primary" />
                  <span>Validation Preview: {excelData.length} technical Rows</span>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
              <div className="bg-amber-50 border border-amber-200 p-5 rounded-2xl flex items-start gap-4 shadow-inner">
                <Sparkles className="h-6 w-6 text-amber-600 mt-0.5" />
                <div className="text-xs text-amber-800 space-y-1.5 font-medium">
                  <p className="font-black uppercase tracking-widest">Enterprise Formula Active</p>
                  <p className="opacity-80">System will auto-calculate SQM for all rows: (Width / 1000) × Length × Quantity.</p>
                </div>
              </div>

              {isProcessing && (
                <div className="space-y-3">
                  <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-primary">
                    <span>Batch Transaction in progress...</span>
                    <span>{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-3 rounded-full" />
                </div>
              )}

              <Button onClick={executeImport} disabled={isProcessing} className="w-full h-16 text-lg font-black uppercase tracking-widest shadow-2xl rounded-xl">
                {isProcessing ? <Loader2 className="animate-spin mr-2 h-6 w-6" /> : <CheckCircle2 className="mr-2 h-6 w-6" />}
                Confirm Master Migration
              </Button>
            </CardContent>
          </Card>
        )}

        {summary && (
          <Card className="bg-emerald-50 border-emerald-200 text-center p-12 animate-in zoom-in-95 rounded-2xl border-2">
            <div className="h-24 w-24 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-8 shadow-xl border-4 border-white">
              <CheckCircle2 className="text-white h-12 w-12" />
            </div>
            <h3 className="text-4xl font-black text-emerald-900 uppercase tracking-tighter mb-2">Success</h3>
            <p className="text-emerald-700 font-bold mb-10 text-lg">Successfully migrated {summary.imported} technical rolls to the Master Registry.</p>
            <Button asChild className="bg-emerald-600 hover:bg-emerald-700 font-black uppercase tracking-widest h-16 w-full text-lg shadow-lg rounded-xl">
              <a href="/paper-stock">View Registry Hub <ArrowRight className="ml-2 h-5 w-5" /></a>
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
}
