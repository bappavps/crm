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
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
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
  Download,
  ChevronRight,
  Database,
  ArrowLeft,
  FileSpreadsheet,
  AlertTriangle,
  Info,
  History,
  Trash2,
  Settings2
} from "lucide-react"
import { useFirestore, useUser } from "@/firebase"
import { doc, writeBatch, serverTimestamp, getDoc, collection } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import * as XLSX from 'xlsx'
import { ActionModal, ModalType } from "@/components/action-modal"
import { cn } from "@/lib/utils"

const STEPS = [
  { id: 'template', label: 'Template', icon: Download },
  { id: 'upload', label: 'Upload', icon: FileUp },
  { id: 'mapping', label: 'Analysis', icon: Settings2 },
  { id: 'preview', label: 'Correction', icon: TableIcon },
  { id: 'final', label: 'Result', icon: Database }
];

const REQUIRED_FIELDS = ["paperCompany", "paperType", "widthMm", "lengthMeters", "gsm", "receivedDate"];

const FIELD_LABELS: Record<string, string> = {
  rollNo: "Roll No",
  paperCompany: "Paper Company",
  paperType: "Paper Type",
  widthMm: "Width (MM)",
  lengthMeters: "Length (MTR)",
  sqm: "SQM",
  gsm: "GSM",
  weightKg: "Weight (KG)",
  purchaseRate: "Purchase Rate",
  receivedDate: "Date of Received",
  dateOfUsed: "Date of Used",
  jobNo: "Job No",
  jobSize: "Job Size",
  jobName: "Job Name",
  lotNo: "Lot No / Batch No",
  companyRollNo: "Company Roll No",
  remarks: "Remarks"
};

const TEMPLATE_HEADERS = Object.values(FIELD_LABELS);

// PERFORMANCE LIMITS
const MAX_ROWS = 5000;
const MAX_FILE_SIZE_MB = 5;
const CHUNK_SIZE = 200; // rows to process per "tick"

/**
 * INTELLIGENT UTILS
 */
const normalize = (str: string) => 
  String(str || "").toLowerCase()
    .replace(/\s+/g, '') 
    .replace(/[^a-z0-9]/g, '') 
    .replace(/of/g, '') 
    .trim();

const cleanNumeric = (val: any): number => {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  // Strip units like "Kgs", "mm", etc. and separators
  const cleaned = String(val).replace(/,/g, '').replace(/[^0-9.]/g, '');
  return parseFloat(cleaned) || 0;
};

const parseExcelDate = (val: any): string => {
  if (!val) return new Date().toISOString().split('T')[0];
  if (typeof val === 'number') {
    const date = new Date((val - 25569) * 86400 * 1000);
    return date.toISOString().split('T')[0];
  }
  const str = String(val).trim();
  try {
    const d = new Date(str);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  } catch (e) {}
  const parts = str.split(/[-/]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    if (parts[2].length === 4) return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
  }
  return str;
};

const findBestMatch = (targetLabel: string, systemKey: string, fileHeaders: string[]) => {
  const normTarget = normalize(targetLabel);
  const normKey = normalize(systemKey);
  let match = fileHeaders.find(h => normalize(h) === normTarget || normalize(h) === normKey);
  if (match) return match;
  const aliases: Record<string, string[]> = {
    receivedDate: ['date', 'entry', 'received'],
    widthMm: ['width', 'wmm'],
    lengthMeters: ['length', 'lmtr', 'mtr'],
    paperCompany: ['company', 'mfr', 'supplier'],
    paperType: ['type', 'substrate', 'material'],
    lotNo: ['lot', 'batch', 'invoice'],
    companyRollNo: ['parent', 'reel', 'mfrroll']
  };
  const currentAliases = aliases[systemKey] || [];
  return fileHeaders.find(h => {
    const nh = normalize(h);
    return currentAliases.some(alias => nh.includes(alias)) || nh.includes(normTarget) || normTarget.includes(nh);
  });
};

export default function StockImportPage() {
  const { toast } = useToast()
  const router = useRouter()
  const { user } = useUser()
  const firestore = useFirestore()
  
  const [currentStep, setCurrentStep] = useState(0)
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [excelData, setExcelData] = useState<any[]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [summary, setSummary] = useState<any>(null)
  const [allowPartial, setAllowPartial] = useState(false)
  const [fileInfo, setFileInfo] = useState<{ name: string; rows: number } | null>(null)

  // Background Processing State
  const [processedData, setProcessedData] = useState<any[]>([])
  const [invalidRows, setInvalidRows] = useState<any[]>([])
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisProgress, setAnalysisProgress] = useState(0)

  const [modal, setModal] = useState<{
    isOpen: boolean;
    type: ModalType;
    title: string;
    description?: string;
  }>({ isOpen: false, type: 'SUCCESS', title: '' });

  const showModal = (type: ModalType, title: string, description?: string) => {
    setModal({ isOpen: true, type, title, description });
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([], { header: TEMPLATE_HEADERS });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Technical Template");
    XLSX.writeFile(wb, "Shree_Label_Technical_Grid.xlsx");
    toast({ title: "Template Ready", description: "Standard 18-column grid downloaded." });
    if (currentStep === 0) setCurrentStep(1);
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 1. File Size Limit (5MB)
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      showModal('ERROR', 'File Too Large', `Spreadsheet exceeds ${MAX_FILE_SIZE_MB}MB limit. Please split the file.`);
      return;
    }

    setIsProcessing(true);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const ab = evt.target?.result as ArrayBuffer;
        const wb = XLSX.read(ab, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1 });
        
        if (rawRows.length < 2) throw new Error("Spreadsheet has no data.");
        
        // 2. Row Count Limit
        if (rawRows.length > MAX_ROWS + 1) {
          throw new Error(`File contains ${rawRows.length - 1} rows. Maximum allowed is ${MAX_ROWS}.`);
        }

        const fileHeaders = (rawRows[0] as any[]).map(h => String(h || "").trim()).filter(h => h !== "");
        const rows = XLSX.utils.sheet_to_json(ws);
        
        setHeaders(fileHeaders);
        setExcelData(rows);
        setFileInfo({ name: file.name, rows: rows.length });
        
        // Smart Initial Mapping
        const initialMapping: Record<string, string> = {};
        Object.entries(FIELD_LABELS).forEach(([key, label]) => {
          const match = findBestMatch(label, key, fileHeaders);
          if (match) initialMapping[key] = match;
        });
        setMapping(initialMapping);
        
        setIsProcessing(false);
        setCurrentStep(2);
      } catch (err: any) {
        showModal('ERROR', 'Parse Failed', err.message);
        setIsProcessing(false);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  /**
   * BACKGROUND CHUNKED ANALYSIS
   * Processes data in chunks to keep the UI thread responsive.
   */
  const startDataAnalysis = async () => {
    setIsAnalyzing(true);
    setAnalysisProgress(0);
    
    const results: any[] = [];
    const errors: any[] = [];
    const total = excelData.length;

    for (let i = 0; i < total; i += CHUNK_SIZE) {
      const chunk = excelData.slice(i, i + CHUNK_SIZE);
      
      // Allow UI thread to breathe
      await new Promise(resolve => setTimeout(resolve, 0));

      chunk.forEach((row, chunkIdx) => {
        const globalIdx = i + chunkIdx;
        const mapped: any = { _original: row };
        const reasons: string[] = [];

        Object.entries(mapping).forEach(([key, header]) => {
          let val = row[header];
          if (["widthMm", "lengthMeters", "gsm", "weightKg", "purchaseRate"].includes(key)) {
            val = cleanNumeric(val);
            if (["widthMm", "lengthMeters", "gsm"].includes(key) && val <= 0) {
              reasons.push(`${FIELD_LABELS[key]} must be > 0 (Found: ${row[header]})`);
            }
          } else if (key === "receivedDate") {
            val = parseExcelDate(val);
            if (!val) reasons.push("Invalid date format");
          }
          mapped[key] = val;
        });

        REQUIRED_FIELDS.forEach(f => {
          if (!mapping[f] || mapped[f] === undefined || mapped[f] === "") {
            reasons.push(`Missing mandatory field: ${FIELD_LABELS[f]}`);
          }
        });

        if (reasons.length > 0) {
          errors.push({ index: globalIdx + 2, row, reasons });
        }
        
        results.push({ ...mapped, _errors: reasons });
      });

      setAnalysisProgress(Math.round(((i + chunk.length) / total) * 100));
    }

    setProcessedData(results);
    setInvalidRows(errors);
    setIsAnalyzing(false);
    setCurrentStep(3);
  };

  const downloadErrorReport = () => {
    const reportData = invalidRows.map(err => ({
      "Row No": err.index,
      "Failure Reason": err.reasons.join(" | "),
      ...err.row
    }));
    const ws = XLSX.utils.json_to_sheet(reportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Import Failures");
    XLSX.writeFile(wb, `Import_Error_Report_${new Date().getTime()}.xlsx`);
  };

  const executeImport = async () => {
    if (!firestore || !user || isProcessing) return;
    setIsProcessing(true);
    setProgress(0);
    
    try {
      const counterRef = doc(firestore, 'counters', 'paper_roll');
      const counterSnap = await getDoc(counterRef);
      let currentSerial = counterSnap.exists() ? (counterSnap.data().current_number || 0) : 0;
      
      const dataToImport = allowPartial 
        ? processedData.filter(d => d._errors.length === 0)
        : processedData;

      if (dataToImport.length === 0) throw new Error("No valid rows to import.");

      const total = dataToImport.length;
      let imported = 0;

      for (let i = 0; i < total; i += 500) {
        const batch = writeBatch(firestore);
        const chunk = dataToImport.slice(i, i + 500);

        chunk.forEach((d) => {
          currentSerial++;
          const rollId = `RL-${currentSerial.toString().padStart(4, '0')}`;
          const final: any = {
            ...d,
            rollNo: rollId,
            id: rollId,
            createdAt: serverTimestamp(),
            createdById: user.uid,
            sqm: Number(((d.widthMm / 1000) * d.lengthMeters).toFixed(2))
          };
          delete final._original;
          delete final._errors;
          batch.set(doc(firestore, 'paper_stock', rollId), final);
          imported++;
        });

        // Update counter only on last batch
        if (i + 500 >= total) {
          batch.set(counterRef, { current_number: currentSerial }, { merge: true });
        }

        await batch.commit();
        setProgress(Math.round(((i + chunk.length) / total) * 100));
      }

      setSummary({ total, imported });
      setCurrentStep(4);
    } catch (e: any) {
      showModal('ERROR', 'Import Failed', e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20 font-sans animate-in fade-in duration-500">
      <ActionModal isOpen={modal.isOpen} onClose={() => setModal(p => ({ ...p, isOpen: false }))} {...modal} />

      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-3xl font-black text-primary uppercase tracking-tighter">High-Performance Intake</h2>
          <p className="text-muted-foreground text-[10px] font-black uppercase tracking-widest">Resilient ingestion with asynchronous chunked processing.</p>
        </div>
        {currentStep > 0 && currentStep < 4 && !isAnalyzing && (
          <Button variant="ghost" onClick={() => setCurrentStep(currentStep - 1)} className="font-black text-[10px] uppercase">
            <ArrowLeft className="mr-2 h-3 w-3" /> Back
          </Button>
        )}
      </div>

      <div className="flex items-center justify-between w-full max-w-4xl mx-auto px-4">
        {STEPS.map((step, idx) => (
          <div key={step.id} className="flex flex-col items-center gap-2 relative flex-1">
            <div className={cn(
              "h-10 w-10 rounded-full flex items-center justify-center border-2 transition-all duration-500 z-10",
              currentStep === idx ? "bg-primary border-primary text-white scale-110 shadow-lg" : 
              currentStep > idx ? "bg-emerald-500 border-emerald-500 text-white" : "bg-background border-muted text-muted-foreground"
            )}>
              {currentStep > idx ? <CheckCircle2 className="h-5 w-5" /> : <step.icon className="h-5 w-5" />}
            </div>
            <span className={cn("text-[9px] font-black uppercase tracking-widest", currentStep === idx ? "text-primary" : "text-muted-foreground")}>{step.label}</span>
            {idx < STEPS.length - 1 && <div className={cn("absolute h-[2px] w-full top-5 left-[50%] transition-all duration-500", currentStep > idx ? "bg-emerald-500" : "bg-muted")} />}
          </div>
        ))}
      </div>

      {/* STEP 1: TEMPLATE */}
      {currentStep === 0 && (
        <Card className="border-none shadow-2xl rounded-3xl overflow-hidden bg-primary/5">
          <CardContent className="p-16 text-center space-y-8">
            <div className="h-24 w-24 bg-white rounded-full flex items-center justify-center mx-auto shadow-xl"><Download className="h-10 w-10 text-primary" /></div>
            <div className="space-y-2 max-w-md mx-auto">
              <h3 className="text-xl font-black uppercase tracking-tight">Technical Data Preparation</h3>
              <p className="text-xs text-muted-foreground font-medium">Use the official 18-column grid for bulk inventory migration. Supports up to 5,000 rows per session.</p>
            </div>
            <div className="flex gap-4 justify-center">
              <Button onClick={downloadTemplate} size="lg" className="h-14 px-8 rounded-xl font-black uppercase shadow-xl">Download V2 Template</Button>
              <Button variant="outline" onClick={() => setCurrentStep(1)} size="lg" className="h-14 px-8 rounded-xl font-black uppercase border-2">I have my own file</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP 2: UPLOAD */}
      {currentStep === 1 && (
        <div className="max-w-3xl mx-auto space-y-6">
          <Card className="border-4 border-dashed rounded-3xl border-slate-200 hover:border-primary/40 hover:bg-primary/5 transition-all">
            <CardContent className="p-20 text-center space-y-6">
              {isProcessing ? (
                <div className="space-y-4">
                  <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
                  <p className="text-sm font-bold uppercase">Parsing Spreadsheet...</p>
                </div>
              ) : (
                <>
                  <div className="h-20 w-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-2"><FileUp className="h-10 w-10 text-primary" /></div>
                  <Label htmlFor="file-upload" className="cursor-pointer space-y-4 block">
                    <span className="text-2xl font-black text-primary underline underline-offset-8">Select inventory file</span>
                    <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest pt-4">XLSX, XLS, or CSV (Max 5MB)</p>
                    <Input id="file-upload" type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileUpload} />
                  </Label>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* STEP 3: MAPPING & ANALYSIS */}
      {currentStep === 2 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <Card className="lg:col-span-2 shadow-xl border-none rounded-2xl overflow-hidden">
            <CardHeader className="bg-slate-50 border-b py-6 px-8">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2"><Settings2 className="h-4 w-4 text-primary" /> Heuristic Mapping</CardTitle>
                <Badge className="bg-primary text-white font-black text-[10px] h-7 px-4">{fileInfo?.rows} ROWS DETECTED</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[500px] overflow-y-auto scrollbar-thin">
                <Table>
                  <TableHeader className="bg-muted/30"><TableRow>
                    <TableHead className="font-black text-[10px] uppercase pl-8 py-4">System Field</TableHead>
                    <TableHead className="font-black text-[10px] uppercase py-4">Source Column</TableHead>
                    <TableHead className="w-20"></TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {Object.entries(FIELD_LABELS).map(([key, label]) => (
                      <TableRow key={key} className="hover:bg-slate-50/50">
                        <TableCell className="pl-8 py-4">
                          <span className={cn("text-xs font-black uppercase tracking-tight", REQUIRED_FIELDS.includes(key) ? "text-primary" : "text-slate-500")}>
                            {label} {REQUIRED_FIELDS.includes(key) && "*"}
                          </span>
                        </TableCell>
                        <TableCell className="py-4">
                          <Select value={mapping[key]} onValueChange={(val) => setMapping({ ...mapping, [key]: val })}>
                            <SelectTrigger className={cn("h-10 text-xs font-bold border-2 transition-all", mapping[key] ? "border-emerald-200 bg-emerald-50/30 text-emerald-900" : "border-slate-200")}>
                              <SelectValue placeholder="Select column..." />
                            </SelectTrigger>
                            <SelectContent>{headers.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="py-4 text-center">{mapping[key] && <CheckCircle2 className="h-5 w-5 text-emerald-500 mx-auto" />}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
          <div className="space-y-6">
            <Card className="rounded-2xl border-none shadow-xl bg-primary text-white sticky top-24">
              <CardHeader className="pb-4"><CardTitle className="text-[10px] font-black uppercase tracking-widest opacity-70">Analysis Dashboard</CardTitle></CardHeader>
              <CardContent className="space-y-8">
                {isAnalyzing ? (
                  <div className="space-y-4">
                    <div className="flex justify-between text-[10px] font-black uppercase">
                      <span>Analyzing Data...</span>
                      <span>{analysisProgress}%</span>
                    </div>
                    <Progress value={analysisProgress} className="h-1.5 bg-white/20" />
                    <p className="text-[10px] italic opacity-60">Running background checks to keep UI responsive.</p>
                  </div>
                ) : (
                  <>
                    <div className="p-4 bg-white/10 rounded-xl space-y-4">
                      <div className="flex justify-between items-center text-[10px] font-black uppercase"><span>Mapped</span><span>{Object.keys(mapping).length} / 18</span></div>
                      <Progress value={(Object.keys(mapping).length / 18) * 100} className="h-1.5 bg-white/20" />
                      <div className="space-y-2 pt-2">
                        {REQUIRED_FIELDS.map(f => (
                          <div key={f} className="flex items-center gap-2">
                            {mapping[f] ? <CheckCircle2 className="h-3 w-3 text-emerald-400" /> : <X className="h-3 w-3 text-white/40" />}
                            <span className="text-[10px] font-bold">{FIELD_LABELS[f]}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <Button onClick={startDataAnalysis} disabled={!REQUIRED_FIELDS.every(f => !!mapping[f])} className="w-full h-14 rounded-xl bg-white text-primary hover:bg-slate-50 font-black uppercase tracking-widest shadow-2xl transition-all active:scale-95">
                      Verify & Analyze <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* STEP 4: PREVIEW & CORRECTION */}
      {currentStep === 3 && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-emerald-50 border-emerald-100 shadow-sm rounded-2xl"><CardContent className="p-6 text-center">
              <p className="text-[9px] font-black text-emerald-700 uppercase mb-1">Technical Sync OK</p>
              <span className="text-3xl font-black text-emerald-600">{processedData.length - invalidRows.length}</span>
            </CardContent></Card>
            <Card className={cn("rounded-2xl shadow-sm", invalidRows.length > 0 ? "bg-destructive/5 border-destructive/10" : "bg-slate-50")}><CardContent className="p-6 text-center">
              <p className="text-[9px] font-black text-muted-foreground uppercase mb-1">Data Conflicts</p>
              <span className={cn("text-3xl font-black", invalidRows.length > 0 ? "text-destructive" : "text-slate-400")}>{invalidRows.length}</span>
            </CardContent></Card>
            <Card className="bg-primary/10 border-primary/20 shadow-sm rounded-2xl"><CardContent className="p-6 text-center">
              <p className="text-[9px] font-black text-primary uppercase mb-1">Import Controller</p>
              <div className="flex items-center justify-center gap-3 mt-1">
                <Switch checked={allowPartial} onCheckedChange={setAllowPartial} />
                <span className="text-[10px] font-black uppercase text-primary">Import Valid Only</span>
              </div>
            </CardContent></Card>
          </div>

          <Card className="shadow-2xl border-none rounded-2xl overflow-hidden">
            <CardHeader className="bg-slate-50 border-b p-8 flex flex-row items-center justify-between">
              <div><CardTitle className="text-xs font-black uppercase tracking-widest">Integrity Review (Top 10 Rows)</CardTitle>
              <p className="text-[9px] text-muted-foreground font-black uppercase mt-1">Lazy rendering enabled for maximum performance.</p></div>
              <div className="flex gap-3">
                {invalidRows.length > 0 && <Button variant="outline" size="sm" onClick={downloadErrorReport} className="font-black text-[9px] uppercase border-destructive text-destructive"><FileDown className="mr-2 h-3 w-3" /> Download Conflict Log</Button>}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto scrollbar-thin">
                <Table className="min-w-[1500px]">
                  <TableHeader className="bg-muted/20"><TableRow>
                    {Object.keys(FIELD_LABELS).map(key => <TableHead key={key} className="text-[9px] font-black uppercase">{FIELD_LABELS[key]}</TableHead>)}
                  </TableRow></TableHeader>
                  <TableBody>
                    {processedData.slice(0, 10).map((d, i) => (
                      <TableRow key={i} className={cn("h-10", d._errors.length > 0 && "bg-destructive/5")}>
                        {Object.keys(FIELD_LABELS).map(key => {
                          const original = d._original[mapping[key]];
                          const corrected = d[key];
                          const hasChanged = original && String(original) !== String(corrected);
                          return (
                            <TableCell key={key} className="text-[10px] font-medium border-r">
                              <div className="flex flex-col">
                                <span className={cn(hasChanged && "text-emerald-600 font-bold")}>{corrected}</span>
                                {hasChanged && <span className="text-[8px] opacity-40 line-through">was: {original}</span>}
                              </div>
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="p-12 text-center space-y-6">
                {isProcessing ? (
                  <div className="max-w-md mx-auto space-y-4">
                    <div className="flex flex-col items-center gap-2"><Loader2 className="h-8 w-8 animate-spin text-primary" /><h4 className="text-sm font-black uppercase tracking-widest text-primary">Ingesting {allowPartial ? (processedData.length - invalidRows.length) : processedData.length} records...</h4></div>
                    <Progress value={progress} className="h-2" />
                  </div>
                ) : (
                  <div className="space-y-6">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                      Ready to sync <span className="text-primary font-black">{allowPartial ? (processedData.length - invalidRows.length) : processedData.length} technical units</span> to cloud.
                    </p>
                    <Button onClick={executeImport} disabled={!allowPartial && invalidRows.length > 0} className="h-14 px-12 rounded-xl text-md font-black uppercase bg-primary shadow-xl transition-all active:scale-95">
                      <Sparkles className="mr-3 h-5 w-5" /> Commit Technical Intake
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* STEP 5: SUCCESS */}
      {currentStep === 4 && (
        <Card className="border-none shadow-3xl text-center p-20 rounded-3xl bg-emerald-50 animate-in zoom-in-95">
          <CardContent className="space-y-8">
            <div className="h-24 w-24 bg-emerald-500 rounded-full flex items-center justify-center mx-auto shadow-2xl animate-bounce"><CheckCircle2 className="text-white h-12 w-12" /></div>
            <div className="space-y-2">
              <h3 className="text-4xl font-black text-emerald-900 uppercase tracking-tighter">Inventory Synchronized</h3>
              <p className="text-emerald-700 font-bold uppercase text-xs tracking-widest">Successfully ingested {summary?.imported} technical units into core registry.</p>
            </div>
            <div className="flex gap-4 justify-center pt-6">
              <Button onClick={() => router.push('/paper-stock')} size="lg" className="h-14 px-10 rounded-xl bg-emerald-600 font-black uppercase shadow-xl">View Stock Registry <ArrowRight className="ml-2 h-5 w-5" /></Button>
              <Button variant="outline" onClick={() => { setExcelData([]); setMapping({}); setCurrentStep(1); }} size="lg" className="h-14 px-10 rounded-xl font-black uppercase border-emerald-200 text-emerald-800">New Import Session</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
