
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
  ArrowRight
} from "lucide-react"
import { useFirestore, useUser } from "@/firebase"
import { doc, writeBatch, serverTimestamp } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import * as XLSX from 'xlsx'
import { ActionModal, ModalType } from "@/components/action-modal"

const TEMPLATE_HEADERS = [
  "RELL NO", "PAPER COMPANY", "PAPER TYPE", "WIDTH (MM)", "LENGTH (MTR)", 
  "SQM", "GSM", "WEIGHT(KG)", "Purchase Rate", "WASTAGE", 
  "DATE OF RECEIVED", "Job no", "SIZE", "PRODUCT NAME", 
  "Code", "Lot no/BATCH NO", "Date", "Company Rell no"
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
  "Company Rell no": "companyRollNo"
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
    XLSX.writeFile(wb, "paper_stock_template.xlsx");
    showModal('SUCCESS', 'Template Downloaded', 'Use this file to map your technical stock data.', true);
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
          showModal('ERROR', 'Empty File', 'No data rows detected.');
          return;
        }

        setExcelData(data);
        showModal('SUCCESS', 'File Validated', `Detected ${data.length} rows ready for import.`, true);
      } catch (err) {
        showModal('ERROR', 'Invalid File', 'Could not parse Excel file.');
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
            if (['widthMm', 'lengthMeters', 'gsm', 'weightKg', 'purchaseRate', 'wastage'].includes(key)) {
              val = Number(val) || 0;
            }
            data[key] = val;
          });

          // Formula Enforcement
          const w = Number(data.widthMm) || 0;
          const l = Number(data.lengthMeters) || 0;
          data.sqm = Number(((w / 1000) * l).toFixed(2));

          batch.set(doc(firestore, 'paper_stock', rollId), data, { merge: true });
          imported++;
        });

        await batch.commit();
        setProgress(Math.round(((i + chunk.length) / totalRows) * 100));
      }

      setSummary({ total: totalRows, imported });
      showModal('SUCCESS', 'Stock Imported Successfully', undefined, true);
    } catch (err: any) {
      showModal('ERROR', 'Import Failed', err.message);
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
          <h2 className="text-3xl font-black text-primary uppercase">Stock Import Engine</h2>
          <p className="text-muted-foreground font-medium">Bulk transition legacy inventory via technical Excel mapping.</p>
        </div>
        <Button variant="outline" onClick={downloadTemplate} className="font-bold">
          <FileDown className="mr-2 h-4 w-4" /> Template.xlsx
        </Button>
      </div>

      <div className="grid gap-6">
        <Card className="border-dashed border-2 bg-muted/5">
          <CardContent className="pt-10 pb-10 text-center space-y-4">
            <FileUp className="h-16 w-16 mx-auto text-primary opacity-20" />
            <div className="space-y-2">
              <Label htmlFor="file-upload" className="cursor-pointer group">
                <span className="text-xl font-black text-primary underline">Choose Data File</span>
                <Input id="file-upload" type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileUpload} />
              </Label>
              <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Excel spreadsheets only</p>
            </div>
          </CardContent>
        </Card>

        {excelData.length > 0 && !summary && (
          <Card className="shadow-xl border-none">
            <CardHeader className="bg-primary/5 border-b">
              <CardTitle className="text-sm font-black uppercase flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TableIcon className="h-4 w-4 text-primary" />
                  <span>Validation Preview: {excelData.length} Rows</span>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-start gap-3">
                <Sparkles className="h-5 w-5 text-amber-600 mt-0.5" />
                <div className="text-xs text-amber-800 space-y-1">
                  <p className="font-black uppercase">Auto-Calculation Active</p>
                  <p>All SQM fields will be derived using enterprise formula: (Width / 1000) × Length.</p>
                </div>
              </div>

              {isProcessing && (
                <div className="space-y-2">
                  <Progress value={progress} className="h-2" />
                </div>
              )}

              <Button onClick={executeImport} disabled={isProcessing} className="w-full h-16 text-lg font-black uppercase tracking-widest shadow-lg">
                {isProcessing ? <Loader2 className="animate-spin mr-2" /> : <CheckCircle2 className="mr-2" />}
                Initialize Master Migration
              </Button>
            </CardContent>
          </Card>
        )}

        {summary && (
          <Card className="bg-emerald-50 border-emerald-200 text-center p-10 animate-in zoom-in-95">
            <div className="h-20 w-20 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
              <CheckCircle2 className="text-white h-12 w-12" />
            </div>
            <h3 className="text-3xl font-black text-emerald-900 uppercase">Migration Complete</h3>
            <p className="text-emerald-700 font-bold mb-8">Successfully imported {summary.imported} technical rolls.</p>
            <Button asChild className="bg-emerald-600 hover:bg-emerald-700 font-black uppercase tracking-widest h-14 w-full">
              <a href="/paper-stock">View Registry <ArrowRight className="ml-2 h-4 w-4" /></a>
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
}
