
"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { 
  FileUp, 
  FileDown, 
  Loader2, 
  CheckCircle2, 
  Table as TableIcon,
  Sparkles,
  ArrowRight,
  AlertCircle,
  X,
  RefreshCw,
  Download
} from "lucide-react"
import { useFirestore, useUser, errorEmitter, FirestorePermissionError } from "@/firebase"
import { doc, writeBatch, serverTimestamp, getDoc, runTransaction, collection } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import * as XLSX from 'xlsx'
import { ActionModal, ModalType } from "@/components/action-modal"

const REQUIRED_FIELDS = ["paperCompany", "paperType", "widthMm", "lengthMeters", "gsm"];

const FIELD_LABELS: Record<string, string> = {
  paperCompany: "Paper Company",
  paperType: "Paper Type",
  widthMm: "Width (MM)",
  lengthMeters: "Length (MTR)",
  gsm: "GSM",
  quantity: "Quantity",
  weightKg: "Weight (KG)",
  purchaseRate: "Purchase Rate",
  receivedDate: "Date of Received",
  jobNo: "Job No",
  jobName: "Job Name",
  lotNo: "Lot / Invoice No",
  remarks: "Remarks",
  location: "Location",
  supplier: "Supplier"
};

const TEMPLATE_HEADERS = Object.values(FIELD_LABELS);

export default function StockImportPage() {
  const { toast } = useToast()
  const router = useRouter()
  const { user } = useUser()
  const firestore = useFirestore()
  
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [excelData, setExcelData] = useState<any[]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview' | 'success'>('upload')
  const [summary, setSummary] = useState<any>(null)

  const [modal, setModal] = useState<{
    isOpen: boolean;
    type: ModalType;
    title: string;
    description?: string;
    autoClose?: boolean;
  }>({ isOpen: false, type: 'SUCCESS', title: '' });

  const showModal = (type: ModalType, title: string, description?: string, autoClose = false) => {
    setModal({ isOpen: true, type, title, description, autoClose });
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([], { header: TEMPLATE_HEADERS });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Import Template");
    XLSX.writeFile(wb, "Shree_Label_Stock_Template.xlsx");
    toast({ title: "Template Downloaded", description: "Use this structure for fastest imports." });
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
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
        
        if (data.length < 2) {
          showModal('ERROR', 'Empty File', 'Your spreadsheet contains no data rows.');
          return;
        }

        const fileHeaders = data[0] as string[];
        const rows = XLSX.utils.sheet_to_json(ws);
        
        setHeaders(fileHeaders);
        setExcelData(rows);

        // Attempt Auto-Mapping
        const initialMapping: Record<string, string> = {};
        Object.entries(FIELD_LABELS).forEach(([key, label]) => {
          const match = fileHeaders.find(h => h.toLowerCase() === label.toLowerCase() || h.toLowerCase() === key.toLowerCase());
          if (match) initialMapping[key] = match;
        });
        setMapping(initialMapping);

        // Check if all required fields are mapped automatically
        const allRequiredMapped = REQUIRED_FIELDS.every(f => !!initialMapping[f]);
        if (allRequiredMapped && fileHeaders.length === TEMPLATE_HEADERS.length) {
          setStep('preview');
        } else {
          setStep('mapping');
        }
      } catch (err) {
        showModal('ERROR', 'Parsing Error', 'Could not read the spreadsheet. Ensure it is a valid .xlsx or .csv file.');
      }
    };
    reader.readAsArrayBuffer(file);
  }

  const mappedPreviewData = useMemo(() => {
    return excelData.slice(0, 10).map((row: any) => {
      const mappedRow: any = {};
      Object.entries(mapping).forEach(([key, header]) => {
        mappedRow[key] = row[header];
      });
      return mappedRow;
    });
  }, [excelData, mapping]);

  const validationErrors = useMemo(() => {
    const errors: string[] = [];
    excelData.forEach((row: any, index) => {
      REQUIRED_FIELDS.forEach(field => {
        const header = mapping[field];
        if (!header || row[header] === undefined || row[header] === "") {
          errors.push(`Row ${index + 2}: Missing required field "${FIELD_LABELS[field]}"`);
        }
      });

      // Numeric Validations
      ["widthMm", "lengthMeters", "gsm"].forEach(field => {
        const header = mapping[field];
        if (header && (Number(row[header]) <= 0 || isNaN(Number(row[header])))) {
          errors.push(`Row ${index + 2}: Invalid value for "${FIELD_LABELS[field]}". Must be greater than 0.`);
        }
      });
    });
    return errors;
  }, [excelData, mapping]);

  const executeImport = async () => {
    if (!firestore || !user || isProcessing) return;
    setIsProcessing(true);
    setProgress(0);

    try {
      // 1. Get starting serial number
      const counterRef = doc(firestore, 'counters', 'paper_roll');
      const counterSnap = await getDoc(counterRef);
      let currentSerial = counterSnap.exists() ? (counterSnap.data().current_number || 0) : 0;

      const totalRows = excelData.length;
      let imported = 0;

      // 2. Chunk processing
      for (let i = 0; i < totalRows; i += 500) {
        const batch = writeBatch(firestore);
        const chunk = excelData.slice(i, i + 500);

        chunk.forEach((row: any) => {
          currentSerial++;
          const rollId = `RL-${currentSerial.toString().padStart(4, '0')}`;
          
          const data: any = {
            rollNo: rollId,
            id: rollId,
            status: "Available",
            dateOfSlit: "Not Used",
            createdAt: serverTimestamp(),
            createdById: user.uid,
            createdByName: user.displayName || user.email
          };

          // Map values
          Object.entries(mapping).forEach(([key, header]) => {
            let val = row[header];
            if (["widthMm", "lengthMeters", "gsm", "weightKg", "purchaseRate", "quantity"].includes(key)) {
              val = Number(val) || 0;
            }
            data[key] = val;
          });

          // Calculations
          const w = Number(data.widthMm) || 0;
          const l = Number(data.lengthMeters) || 0;
          const q = Number(data.quantity) || 1;
          data.sqm = Number(((w / 1000) * l * q).toFixed(2));

          batch.set(doc(firestore, 'paper_stock', rollId), data);
          imported++;
        });

        // 3. Update counter in batch (or at end)
        if (i + 500 >= totalRows) {
          batch.set(counterRef, { current_number: currentSerial }, { merge: true });
        }

        await batch.commit();
        setProgress(Math.round(((i + chunk.length) / totalRows) * 100));
      }

      setSummary({ total: totalRows, imported });
      setStep('success');
      showModal('SUCCESS', 'Bulk Import Complete', `Successfully added ${imported} rolls to the registry.`, true);
    } catch (error: any) {
      showModal('ERROR', 'Import Failed', error.message || 'Firestore write error.');
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 font-sans pb-20">
      <ActionModal isOpen={modal.isOpen} onClose={() => setModal(p => ({ ...p, isOpen: false }))} {...modal} />

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black text-primary uppercase tracking-tight">Stock Import Engine</h2>
          <p className="text-muted-foreground font-medium text-xs">Technical technical bulk ingestion from Excel / CSV.</p>
        </div>
        <Button variant="outline" onClick={downloadTemplate} className="font-black text-[10px] uppercase h-10 border-2">
          <Download className="mr-2 h-4 w-4" /> Download Template
        </Button>
      </div>

      {step === 'upload' && (
        <Card className="border-dashed border-2 bg-muted/5 rounded-2xl overflow-hidden py-20">
          <CardContent className="text-center space-y-6">
            <div className="h-24 w-24 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-primary/20 border-dashed">
              <FileUp className="h-12 w-12 text-primary opacity-60" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="file-upload" className="cursor-pointer group inline-block">
                <span className="text-3xl font-black text-primary underline underline-offset-8 decoration-primary/30 group-hover:decoration-primary transition-all">Select Inventory File</span>
                <Input id="file-upload" type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileUpload} />
              </Label>
              <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest pt-4">Supported formats: .xlsx, .xls, .csv</p>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'mapping' && (
        <Card className="shadow-2xl border-none rounded-2xl overflow-hidden animate-in slide-in-from-bottom-4">
          <CardHeader className="bg-slate-50 border-b p-6">
            <CardTitle className="text-sm font-black uppercase flex items-center justify-between tracking-widest">
              <div className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-primary" />
                <span>Column Mapping Configuration</span>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setStep('upload')}><X className="h-4 w-4" /></Button>
            </CardTitle>
            <CardDescription>Link your spreadsheet columns to the ERP technical fields.</CardDescription>
          </CardHeader>
          <CardContent className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
              {Object.entries(FIELD_LABELS).map(([key, label]) => (
                <div key={key} className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <Label className={cn("text-[10px] font-black uppercase", REQUIRED_FIELDS.includes(key) ? "text-primary" : "text-slate-500")}>
                      {label} {REQUIRED_FIELDS.includes(key) && "*"}
                    </Label>
                    {mapping[key] && <Badge variant="secondary" className="h-4 text-[8px] bg-emerald-50 text-emerald-700">MAPPED</Badge>}
                  </div>
                  <Select value={mapping[key]} onValueChange={(val) => setMapping({ ...mapping, [key]: val })}>
                    <SelectTrigger className="h-10 text-xs font-bold border-2">
                      <SelectValue placeholder="Select Excel Column" />
                    </SelectTrigger>
                    <SelectContent>
                      {headers.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            <div className="mt-12 flex justify-end">
              <Button 
                onClick={() => setStep('preview')} 
                disabled={!REQUIRED_FIELDS.every(f => !!mapping[f])}
                className="h-12 px-8 font-black uppercase tracking-widest bg-primary"
              >
                Validate & Preview Data
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'preview' && (
        <div className="space-y-6 animate-in fade-in zoom-in-95">
          <Card className="shadow-2xl border-none rounded-2xl overflow-hidden">
            <CardHeader className="bg-primary/5 border-b p-6">
              <CardTitle className="text-sm font-black uppercase flex items-center justify-between tracking-widest">
                <div className="flex items-center gap-2">
                  <TableIcon className="h-4 w-4 text-primary" />
                  <span>Import Preview: {excelData.length} technical rows</span>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setStep('mapping')} className="text-[10px] font-black uppercase">Edit Mapping</Button>
                  <Button variant="ghost" size="sm" onClick={() => setStep('upload')}><X className="h-4 w-4" /></Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      {REQUIRED_FIELDS.map(f => (
                        <TableHead key={f} className="text-[10px] font-black uppercase">{FIELD_LABELS[f]}</TableHead>
                      ))}
                      <TableHead className="text-[10px] font-black uppercase">SQM (AUTO)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mappedPreviewData.map((row, i) => (
                      <TableRow key={i} className="h-10 text-[11px] font-medium border-b">
                        {REQUIRED_FIELDS.map(f => (
                          <TableCell key={f}>{row[f] || "-"}</TableCell>
                        ))}
                        <TableCell className="font-black text-teal-600">
                          {((Number(row.widthMm) / 1000) * Number(row.lengthMeters) * (Number(row.quantity) || 1)).toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              
              <div className="p-8 space-y-8 bg-white">
                {validationErrors.length > 0 ? (
                  <div className="bg-destructive/5 border border-destructive/20 p-6 rounded-2xl space-y-4">
                    <div className="flex items-center gap-2 text-destructive font-black text-xs uppercase tracking-widest">
                      <AlertCircle className="h-5 w-5" />
                      Critical Validation Failures ({validationErrors.length})
                    </div>
                    <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1">
                      {validationErrors.slice(0, 20).map((err, i) => (
                        <li key={i} className="text-[10px] font-bold text-destructive/80">• {err}</li>
                      ))}
                      {validationErrors.length > 20 && <li className="text-[10px] font-black text-destructive italic">...and {validationErrors.length - 20} more errors</li>}
                    </ul>
                    <p className="text-[10px] text-muted-foreground italic pt-2">Please fix your Excel file or adjust the column mapping to proceed.</p>
                  </div>
                ) : (
                  <div className="bg-emerald-50 border border-emerald-200 p-6 rounded-2xl flex items-start gap-4">
                    <Sparkles className="h-6 w-6 text-emerald-600 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-xs font-black uppercase text-emerald-800 tracking-widest">Technical Validation Passed</p>
                      <p className="text-[11px] text-emerald-700 opacity-80">All mandatory technical columns are correctly mapped and numeric values are verified.</p>
                    </div>
                  </div>
                )}

                {isProcessing && (
                  <div className="space-y-3">
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-primary">
                      <span>Batch Transaction: Processing {excelData.length} technical records...</span>
                      <span>{progress}%</span>
                    </div>
                    <Progress value={progress} className="h-3 rounded-full" />
                  </div>
                )}

                <Button 
                  onClick={executeImport} 
                  disabled={isProcessing || validationErrors.length > 0} 
                  className="w-full h-16 text-lg font-black uppercase tracking-widest shadow-2xl rounded-xl"
                >
                  {isProcessing ? <Loader2 className="animate-spin mr-2 h-6 w-6" /> : <CheckCircle2 className="mr-2 h-6 w-6" />}
                  Finalize Bulk Technical Import
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {step === 'success' && (
        <Card className="bg-emerald-50 border-emerald-200 text-center p-12 animate-in zoom-in-95 rounded-2xl border-2">
          <div className="h-24 w-24 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-8 shadow-xl border-4 border-white">
            <CheckCircle2 className="text-white h-12 w-12" />
          </div>
          <h3 className="text-4xl font-black text-emerald-900 uppercase tracking-tighter mb-2">Technical Ingestion Complete</h3>
          <p className="text-emerald-700 font-bold mb-10 text-lg">Successfully migrated {summary?.imported} technical units to the Master Paper Stock Registry.</p>
          <div className="flex gap-4 max-w-md mx-auto">
            <Button variant="outline" onClick={() => setStep('upload')} className="flex-1 font-black uppercase tracking-widest h-12 border-2">Import More</Button>
            <Button asChild className="flex-1 bg-emerald-600 hover:bg-emerald-700 font-black uppercase tracking-widest h-12 shadow-lg">
              <a href="/paper-stock">View Stock Registry <ArrowRight className="ml-2 h-4 w-4" /></a>
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
