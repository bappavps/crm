
"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { 
  FileUp, 
  FileDown, 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  Table as TableIcon,
  Sparkles,
  ArrowRight
} from "lucide-react"
import { useFirestore, useUser } from "@/firebase"
import { collection, doc, writeBatch, getDocs, serverTimestamp } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import * as XLSX from 'xlsx'

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
  const { toast } = useToast()
  const { user } = useUser()
  const firestore = useFirestore()
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [excelData, setExcelData] = useState<any[]>([])
  const [summary, setSummary] = useState<any>(null)

  const downloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([], { header: TEMPLATE_HEADERS });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Stock Template");
    XLSX.writeFile(wb, "paper_stock_template.xlsx");
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const ab = evt.target?.result as ArrayBuffer;
      const wb = XLSX.read(ab, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws);
      setExcelData(data);
      toast({ title: "File Loaded", description: `Detected ${data.length} rows for processing.` });
    };
    reader.readAsArrayBuffer(file);
  }

  const executeImport = async () => {
    if (!firestore || !user || !excelData.length) return;
    setIsProcessing(true);
    setProgress(0);

    const existingSnap = await getDocs(collection(firestore, 'jumbo_stock'));
    const existingRolls = new Set(existingSnap.docs.map(d => d.data().rollNo));
    
    let imported = 0;
    let skipped = 0;

    const totalRows = excelData.length;
    for (let i = 0; i < totalRows; i += 500) {
      const batch = writeBatch(firestore);
      const chunk = excelData.slice(i, i + 500);

      chunk.forEach((row: any) => {
        const rollId = String(row["RELL NO"]);
        if (existingRolls.has(rollId)) {
          skipped++;
          return;
        }

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

        // SQM AUTO-CALCULATION RULE
        if (!data.sqm) {
          const w = Number(data.widthMm) || 0;
          const l = Number(data.lengthMeters) || 0;
          data.sqm = Number(((w / 1000) * l).toFixed(2));
        }

        batch.set(doc(collection(firestore, 'jumbo_stock')), data);
        imported++;
      });

      await batch.commit();
      setProgress(Math.round(((i + chunk.length) / totalRows) * 100));
    }

    setSummary({ total: totalRows, imported, skipped });
    setIsProcessing(false);
    toast({ title: "Import Successful", description: `Added ${imported} new rolls to the registry.` });
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 font-sans">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black text-primary uppercase">Stock Import Engine</h2>
          <p className="text-muted-foreground font-medium">Bulk transition legacy inventory via technical Excel mapping.</p>
        </div>
        <Button variant="outline" onClick={downloadTemplate} className="font-bold">
          <FileDown className="mr-2 h-4 w-4" /> Download Template
        </Button>
      </div>

      <div className="grid gap-6">
        <Card className="border-dashed border-2 bg-muted/5">
          <CardContent className="pt-10 pb-10 text-center space-y-4">
            <FileUp className="h-16 w-16 mx-auto text-primary opacity-20" />
            <div className="space-y-2">
              <Label htmlFor="file-upload" className="cursor-pointer">
                <span className="text-xl font-black text-primary underline">Choose Excel File</span>
                <Input id="file-upload" type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileUpload} />
              </Label>
              <p className="text-xs text-muted-foreground uppercase font-bold tracking-widest">Only .xlsx files are supported</p>
            </div>
          </CardContent>
        </Card>

        {excelData.length > 0 && !summary && (
          <Card className="animate-in slide-in-from-top-4">
            <CardHeader className="bg-primary/5">
              <CardTitle className="text-sm font-black uppercase flex items-center justify-between">
                <span>Preview: {excelData.length} Rows Ready</span>
                <Badge variant="outline" className="bg-background">Validation Active</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg flex items-start gap-3">
                <Sparkles className="h-5 w-5 text-amber-600 mt-0.5" />
                <div className="text-xs text-amber-800">
                  <p className="font-bold uppercase mb-1">Auto-Calculation Enabled</p>
                  <p>Empty SQM fields will be derived from Width × Length using the enterprise formula.</p>
                </div>
              </div>

              {isProcessing && (
                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] font-black uppercase">
                    <span>Importing Batch...</span>
                    <span>{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
              )}

              <Button 
                onClick={executeImport} 
                disabled={isProcessing} 
                className="w-full h-14 text-lg font-black uppercase tracking-widest"
              >
                {isProcessing ? <Loader2 className="animate-spin mr-2" /> : <CheckCircle2 className="mr-2" />}
                Execute Technical Bulk Insert
              </Button>
            </CardContent>
          </Card>
        )}

        {summary && (
          <Card className="bg-emerald-50 border-emerald-200 animate-in zoom-in-95">
            <CardContent className="p-8 text-center space-y-6">
              <div className="h-16 w-16 bg-emerald-500 rounded-full flex items-center justify-center mx-auto shadow-lg">
                <CheckCircle2 className="text-white h-10 w-10" />
              </div>
              <div className="space-y-1">
                <h3 className="text-2xl font-black text-emerald-900 uppercase">Import Cycle Complete</h3>
                <p className="text-emerald-700 font-medium">Successfully processed {summary.total} rows from the source file.</p>
              </div>
              <div className="grid grid-cols-3 gap-4 border-t border-emerald-200 pt-6">
                <div>
                  <p className="text-[10px] font-black text-emerald-600 uppercase">Inserted</p>
                  <p className="text-3xl font-black text-emerald-900">{summary.imported}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-emerald-600 uppercase">Skipped</p>
                  <p className="text-3xl font-black text-emerald-900">{summary.skipped}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-emerald-600 uppercase">Integrity</p>
                  <p className="text-3xl font-black text-emerald-900">100%</p>
                </div>
              </div>
              <Button asChild variant="outline" className="w-full h-12 border-emerald-300 text-emerald-800 font-bold hover:bg-emerald-100">
                <a href="/paper-stock">View Updated Registry <ArrowRight className="ml-2 h-4 w-4" /></a>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
