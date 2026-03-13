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
  Info
} from "lucide-react"
import { useFirestore, useUser } from "@/firebase"
import { doc, writeBatch, serverTimestamp, getDoc } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import * as XLSX from 'xlsx'
import { ActionModal, ModalType } from "@/components/action-modal"
import { cn } from "@/lib/utils"

const STEPS = [
  { id: 'template', label: 'Template', icon: Download },
  { id: 'upload', label: 'Upload', icon: FileUp },
  { id: 'mapping', label: 'Mapping', icon: TableIcon },
  { id: 'preview', label: 'Import', icon: Database }
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

/**
 * HELPER: Advanced Normalization for fuzzy matching
 */
const normalize = (str: string) => 
  String(str || "").toLowerCase()
    .replace(/\s+/g, '') // remove all spaces
    .replace(/[^a-z0-9]/g, '') // remove special chars/underscores
    .replace(/of/g, '') // common stop word in "Date of Received"
    .trim();

/**
 * HELPER: Robust numeric parsing (strips units like "Kgs", "mm")
 */
const cleanNumeric = (val: any): number => {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  // Handle commas and strip non-numeric except decimal point
  const cleaned = String(val).replace(/,/g, '').replace(/[^0-9.]/g, '');
  return parseFloat(cleaned) || 0;
};

/**
 * HELPER: Robust date parsing for various formats
 */
const parseExcelDate = (val: any): string => {
  if (!val) return new Date().toISOString().split('T')[0];
  
  // 1. Handle Excel Serial Dates (Numeric)
  if (typeof val === 'number') {
    const date = new Date((val - 25569) * 86400 * 1000);
    return date.toISOString().split('T')[0];
  }

  const str = String(val).trim();
  
  // 2. Try standard ISO format or common strings
  try {
    const d = new Date(str);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  } catch (e) {}

  // 3. Handle DD-MM-YYYY or DD/MM/YYYY manually
  const parts = str.split(/[-/]/);
  if (parts.length === 3) {
    // If year is the first part (YYYY-MM-DD)
    if (parts[0].length === 4) return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    // If year is the last part (DD-MM-YYYY)
    if (parts[2].length === 4) return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
  }

  return str; // Return raw as fallback
};

/**
 * HEURISTIC: Find the best column match for a system field
 */
const findBestMatch = (targetLabel: string, systemKey: string, fileHeaders: string[]) => {
  const normTarget = normalize(targetLabel);
  const normKey = normalize(systemKey);

  // 1. Exact or close normalized match
  let match = fileHeaders.find(h => {
    const nh = normalize(h);
    return nh === normTarget || nh === normKey;
  });
  if (match) return match;

  // 2. Keyword containment
  match = fileHeaders.find(h => {
    const nh = normalize(h);
    return nh.includes(normTarget) || normTarget.includes(nh);
  });
  if (match) return match;

  // 3. Custom Aliases for technical fields
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
  match = fileHeaders.find(h => {
    const nh = normalize(h);
    return currentAliases.some(alias => nh.includes(alias));
  });

  return match;
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
  const [isErrorListOpen, setIsErrorListOpen] = useState(false)
  const [fileInfo, setFileInfo] = useState<{ name: string; size: string; rows: number } | null>(null)

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
    XLSX.utils.book_append_sheet(wb, ws, "Technical Stock Template");
    XLSX.writeFile(wb, "Shree_Label_V2_Template.xlsx");
    toast({ title: "Template Ready", description: "V2 Grid downloaded. Fill and upload." });
    if (currentStep === 0) setCurrentStep(1);
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setProgress(30);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const ab = evt.target?.result as ArrayBuffer;
        const wb = XLSX.read(ab, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
        
        if (data.length < 2) {
          showModal('ERROR', 'File Empty', 'The spreadsheet does not contain valid technical rows.');
          setIsProcessing(false);
          return;
        }

        const fileHeaders = (data[0] as any[]).map(h => String(h || "").trim()).filter(h => h !== "");
        const rows = XLSX.utils.sheet_to_json(ws);
        
        setHeaders(fileHeaders);
        setExcelData(rows);
        setFileInfo({
          name: file.name,
          size: (file.size / 1024).toFixed(1) + ' KB',
          rows: rows.length
        });

        // Smart Heuristic Auto-detection
        const initialMapping: Record<string, string> = {};
        Object.entries(FIELD_LABELS).forEach(([key, label]) => {
          const match = findBestMatch(label, key, fileHeaders);
          if (match) initialMapping[key] = match;
        });
        
        setMapping(initialMapping);

        setProgress(100);
        setTimeout(() => {
          setIsProcessing(false);
          setCurrentStep(2);
        }, 500);
      } catch (err) {
        showModal('ERROR', 'Read Failure', 'Could not parse Excel structure. Please use the official V2 template.');
        setIsProcessing(false);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  const mappedPreviewData = useMemo(() => {
    return excelData.slice(0, 10).map((row: any) => {
      const mappedRow: any = {};
      Object.entries(mapping).forEach(([key, header]) => {
        let val = row[header];
        if (["widthMm", "lengthMeters", "gsm", "weightKg", "purchaseRate"].includes(key)) {
          val = cleanNumeric(val);
        } else if (key === "receivedDate" || key === "dateOfUsed") {
          val = parseExcelDate(val);
        }
        mappedRow[key] = val;
      });
      return mappedRow;
    });
  }, [excelData, mapping]);

  const validationResults = useMemo(() => {
    const invalidRows: string[] = [];
    let validCount = 0;

    excelData.forEach((row: any, index) => {
      let hasError = false;
      
      REQUIRED_FIELDS.forEach(field => {
        const header = mapping[field];
        const val = row[header];
        if (!header || val === undefined || val === "") {
          invalidRows.push(`Row ${index + 2}: Missing mandatory column "${FIELD_LABELS[field]}"`);
          hasError = true;
        }
      });

      // Range checks
      ["widthMm", "lengthMeters", "gsm"].forEach(field => {
        const header = mapping[field];
        if (header) {
          const num = cleanNumeric(row[header]);
          if (num <= 0) {
            invalidRows.push(`Row ${index + 2}: Invalid ${FIELD_LABELS[field]} value (Found: ${row[header]})`);
            hasError = true;
          }
        }
      });

      if (!hasError) validCount++;
    });

    return {
      validCount,
      invalidCount: excelData.length - validCount,
      errors: invalidRows
    };
  }, [excelData, mapping]);

  const executeImport = async () => {
    if (!firestore || !user || isProcessing) return;
    setIsProcessing(true);
    setProgress(0);

    try {
      const counterRef = doc(firestore, 'counters', 'paper_roll');
      const counterSnap = await getDoc(counterRef);
      let currentSerial = counterSnap.exists() ? (counterSnap.data().current_number || 0) : 0;

      const totalRows = excelData.length;
      let imported = 0;

      for (let i = 0; i < totalRows; i += 500) {
        const batch = writeBatch(firestore);
        const chunk = excelData.slice(i, i + 500);

        chunk.forEach((row: any) => {
          currentSerial++;
          const rollId = `RL-${currentSerial.toString().padStart(4, '0')}`;
          
          const data: any = {
            rollNo: rollId,
            id: rollId,
            dateOfUsed: "Not Used",
            createdAt: serverTimestamp(),
            createdById: user.uid
          };

          Object.entries(mapping).forEach(([key, header]) => {
            let val = row[header];
            if (["widthMm", "lengthMeters", "gsm", "weightKg", "purchaseRate"].includes(key)) {
              val = cleanNumeric(val);
            } else if (key === "receivedDate" || key === "dateOfUsed") {
              val = parseExcelDate(val);
            }
            data[key] = val;
          });

          // Logic formulas
          const w = Number(data.widthMm) || 0;
          const l = Number(data.lengthMeters) || 0;
          data.sqm = Number(((w / 1000) * l).toFixed(2));

          batch.set(doc(firestore, 'paper_stock', rollId), data);
          imported++;
        });

        if (i + 500 >= totalRows) {
          batch.set(counterRef, { current_number: currentSerial }, { merge: true });
        }

        await batch.commit();
        setProgress(Math.round(((i + chunk.length) / totalRows) * 100));
      }

      setSummary({ total: totalRows, imported });
      setCurrentStep(4);
      toast({ title: "Import Successful", description: `Added ${imported} units to inventory.` });
    } catch (error: any) {
      showModal('ERROR', 'Batch Failed', error.message);
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20 font-sans">
      <ActionModal isOpen={modal.isOpen} onClose={() => setModal(p => ({ ...p, isOpen: false }))} {...modal} />

      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-3xl font-black text-primary uppercase tracking-tighter">Bulk Stock Ingestion</h2>
          <p className="text-muted-foreground text-xs font-bold uppercase">Technical migration hub for paper inventory.</p>
        </div>
        {currentStep > 0 && currentStep < 4 && (
          <Button variant="ghost" size="sm" onClick={() => setCurrentStep(currentStep - 1)} className="font-black text-[10px] uppercase">
            <ArrowLeft className="mr-2 h-3 w-3" /> Back
          </Button>
        )}
      </div>

      <div className="flex items-center justify-between w-full max-w-4xl mx-auto">
        {STEPS.map((step, idx) => (
          <div key={step.id} className="flex flex-col items-center gap-2 relative flex-1">
            <div className={cn(
              "h-10 w-10 rounded-full flex items-center justify-center border-2 transition-all duration-500 z-10",
              currentStep === idx ? "bg-primary border-primary text-white scale-110 shadow-lg" : 
              currentStep > idx ? "bg-emerald-500 border-emerald-500 text-white" : "bg-background border-muted text-muted-foreground"
            )}>
              {currentStep > idx ? <CheckCircle2 className="h-5 w-5" /> : <step.icon className="h-5 w-5" />}
            </div>
            <span className={cn(
              "text-[9px] font-black uppercase tracking-widest",
              currentStep === idx ? "text-primary" : "text-muted-foreground"
            )}>{step.label}</span>
            {idx < STEPS.length - 1 && (
              <div className={cn(
                "absolute h-[2px] w-full top-5 left-[50%] transition-all duration-500",
                currentStep > idx ? "bg-emerald-500" : "bg-muted"
              )} />
            )}
          </div>
        ))}
      </div>

      {/* --- STEP 1: DOWNLOAD --- */}
      {currentStep === 0 && (
        <Card className="border-none shadow-2xl rounded-3xl overflow-hidden bg-gradient-to-br from-primary/5 to-background">
          <CardContent className="p-16 text-center space-y-8">
            <div className="h-24 w-24 bg-primary/10 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <Download className="h-10 w-10 text-primary" />
            </div>
            <div className="space-y-2 max-w-md mx-auto">
              <h3 className="text-xl font-black uppercase tracking-tight">Technical Data Prep</h3>
              <p className="text-xs text-muted-foreground font-medium">Use the official 18-column grid to ensure perfect technical synchronization.</p>
            </div>
            <div className="flex gap-4 justify-center">
              <Button onClick={downloadTemplate} size="lg" className="h-14 px-8 rounded-xl font-black uppercase bg-primary shadow-xl">
                Download V2 Matrix
              </Button>
              <Button variant="outline" onClick={() => setCurrentStep(1)} size="lg" className="h-14 px-8 rounded-xl font-black uppercase border-2">
                Already Prepared
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* --- STEP 2: UPLOAD --- */}
      {currentStep === 1 && (
        <div className="max-w-3xl mx-auto space-y-6">
          <Card className={cn(
            "border-4 border-dashed rounded-3xl transition-all relative group",
            isProcessing ? "border-primary/50 bg-primary/5" : "border-slate-200 hover:border-primary/40 hover:bg-primary/5"
          )}>
            <CardContent className="p-20 text-center space-y-6">
              {!isProcessing ? (
                <>
                  <div className="h-20 w-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-2">
                    <FileUp className="h-10 w-10 text-primary" />
                  </div>
                  <Label htmlFor="file-upload" className="cursor-pointer space-y-4 block">
                    <span className="text-2xl font-black text-primary underline underline-offset-8">Select technical data file</span>
                    <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest pt-4">XLSX, XLS, or CSV supported</p>
                    <Input id="file-upload" type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileUpload} />
                  </Label>
                </>
              ) : (
                <div className="space-y-6 py-10">
                  <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    <h4 className="font-black uppercase tracking-widest text-primary">Normalizing Header Matrix...</h4>
                  </div>
                  <Progress value={progress} className="h-2 max-w-sm mx-auto" />
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* --- STEP 3: MAPPING --- */}
      {currentStep === 2 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card className="shadow-xl border-none rounded-2xl overflow-hidden">
              <CardHeader className="bg-slate-50 border-b py-6 px-8">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
                      <RefreshCw className="h-4 w-4 text-primary" /> Attribute Synchronization
                    </CardTitle>
                    <p className="text-[9px] text-muted-foreground font-black uppercase mt-1">Cross-map your spreadsheet headers to ERP fields.</p>
                  </div>
                  <Badge className="bg-primary text-white border-none h-7 px-4 font-black text-[10px]">
                    {fileInfo?.rows} ROWS DETECTED
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="font-black text-[10px] uppercase pl-8 py-4">System Technical Field</TableHead>
                      <TableHead className="font-black text-[10px] uppercase py-4">Excel Source Column</TableHead>
                      <TableHead className="w-20"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(FIELD_LABELS).map(([key, label]) => (
                      <TableRow key={key} className="group hover:bg-slate-50/50">
                        <TableCell className="pl-8 py-4">
                          <div className="flex flex-col">
                            <span className={cn(
                              "text-xs font-black uppercase tracking-tight",
                              REQUIRED_FIELDS.includes(key) && !mapping[key] ? "text-destructive" : mapping[key] ? "text-primary" : "text-slate-600"
                            )}>
                              {label} {REQUIRED_FIELDS.includes(key) && <span className="text-destructive">*</span>}
                            </span>
                            {REQUIRED_FIELDS.includes(key) && <span className="text-[8px] text-muted-foreground font-black uppercase">Mandatory</span>}
                          </div>
                        </TableCell>
                        <TableCell className="py-4">
                          <Select value={mapping[key]} onValueChange={(val) => setMapping({ ...mapping, [key]: val })}>
                            <SelectTrigger className={cn(
                              "h-10 text-xs font-bold border-2 transition-all",
                              mapping[key] ? "border-emerald-200 bg-emerald-50/30 text-emerald-900" : "border-slate-200"
                            )}>
                              <SelectValue placeholder="Auto-detection failed..." />
                            </SelectTrigger>
                            <SelectContent>
                              {headers.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="py-4 pr-8 text-center">
                          {mapping[key] ? (
                            <CheckCircle2 className="h-5 w-5 text-emerald-500 mx-auto" />
                          ) : REQUIRED_FIELDS.includes(key) ? (
                            <AlertTriangle className="h-5 w-5 text-destructive mx-auto animate-pulse" />
                          ) : null}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="rounded-2xl border-none shadow-xl bg-primary text-white sticky top-24">
              <CardHeader className="pb-4">
                <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70">Mapping Progress</CardTitle>
              </CardHeader>
              <CardContent className="space-y-8">
                <div className="space-y-2">
                  <div className="flex justify-between items-end">
                    <span className="text-[10px] font-black uppercase">Technical Coverage</span>
                    <span className="text-xl font-black">{Object.keys(mapping).length} / {Object.keys(FIELD_LABELS).length}</span>
                  </div>
                  <Progress value={(Object.keys(mapping).length / Object.keys(FIELD_LABELS).length) * 100} className="h-1.5 bg-white/20" />
                </div>

                <div className="p-4 bg-white/10 rounded-xl space-y-3">
                  <p className="text-[10px] font-black uppercase opacity-70">Status Check</p>
                  <div className="space-y-2">
                    {REQUIRED_FIELDS.map(f => (
                      <div key={f} className="flex items-center gap-2">
                        {mapping[f] ? <CheckCircle2 className="h-3 w-3 text-emerald-400" /> : <X className="h-3 w-3 text-white/40" />}
                        <span className="text-[10px] font-bold">{FIELD_LABELS[f]}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <Button 
                  onClick={() => setCurrentStep(3)} 
                  disabled={!REQUIRED_FIELDS.every(f => !!mapping[f])}
                  className="w-full h-14 rounded-xl bg-white text-primary hover:bg-slate-50 font-black uppercase tracking-widest shadow-2xl"
                >
                  Generate Ingestion Preview <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* --- STEP 4: PREVIEW & IMPORT --- */}
      {currentStep === 3 && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-emerald-50 border-emerald-100 shadow-sm rounded-2xl">
              <CardContent className="p-6 text-center">
                <p className="text-[9px] font-black text-emerald-700 uppercase mb-1">Valid Technical Units</p>
                <span className="text-3xl font-black text-emerald-600">{validationResults.validCount}</span>
              </CardContent>
            </Card>
            <Card className={cn("shadow-sm rounded-2xl", validationResults.invalidCount > 0 ? "bg-destructive/5 border-destructive/10" : "bg-slate-50")}>
              <CardContent className="p-6 text-center">
                <p className="text-[9px] font-black text-muted-foreground uppercase mb-1">Rejected Entries</p>
                <span className={cn("text-3xl font-black", validationResults.invalidCount > 0 ? "text-destructive" : "text-slate-400")}>{validationResults.invalidCount}</span>
              </CardContent>
            </Card>
            <Card className="bg-primary/5 border-primary/10 shadow-sm rounded-2xl">
              <CardContent className="p-6 text-center">
                <p className="text-[9px] font-black text-primary uppercase mb-1">Total Payload</p>
                <span className="text-3xl font-black text-primary">{excelData.length}</span>
              </CardContent>
            </Card>
          </div>

          <Card className="shadow-2xl border-none rounded-2xl overflow-hidden">
            <CardHeader className="bg-slate-50 border-b p-8 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
                  <TableIcon className="h-4 w-4 text-primary" /> Technical Preview (Top 10)
                </CardTitle>
                <p className="text-[9px] text-muted-foreground font-black uppercase mt-1">Verify technical ingestion logic before committing.</p>
              </div>
              {validationResults.invalidCount > 0 && (
                <Button variant="outline" size="sm" onClick={() => setIsErrorListOpen(!isErrorListOpen)} className="font-black text-[9px] uppercase border-destructive text-destructive">
                  {isErrorListOpen ? "Hide Conflicts" : `View ${validationResults.invalidCount} Conflicts`}
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {isErrorListOpen && (
                <div className="p-6 bg-destructive/5 border-b border-destructive/10 space-y-2">
                  <div className="flex items-center gap-2 text-destructive font-black text-[10px] uppercase">
                    <AlertTriangle className="h-4 w-4" /> validation conflict summary
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-1">
                    {validationResults.errors.slice(0, 10).map((err, i) => (
                      <p key={i} className="text-[9px] font-bold text-destructive/80 flex items-center gap-2">
                        <span className="h-1 w-1 bg-destructive rounded-full" /> {err}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              <div className="overflow-x-auto">
                <Table className="min-w-[2000px]">
                  <TableHeader className="bg-muted/20">
                    <TableRow>
                      {Object.keys(FIELD_LABELS).map(key => (
                        <TableHead key={key} className="text-[9px] font-black uppercase whitespace-nowrap">{FIELD_LABELS[key]}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mappedPreviewData.map((row, i) => (
                      <TableRow key={i} className="h-10 border-b">
                        {Object.keys(FIELD_LABELS).map(key => (
                          <TableCell key={key} className={cn(
                            "text-[10px] font-medium whitespace-nowrap",
                            key === 'sqm' ? "font-black text-primary" : "",
                            (!row[key] && REQUIRED_FIELDS.includes(key)) ? "bg-destructive/10 text-destructive font-black" : ""
                          )}>
                            {row[key] || "-"}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              
              <div className="p-12 space-y-6 bg-white text-center">
                {isProcessing ? (
                  <div className="max-w-md mx-auto space-y-4">
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      <h4 className="text-sm font-black uppercase tracking-widest text-primary">Synchronizing Central Registry...</h4>
                    </div>
                    <Progress value={progress} className="h-2 shadow-inner" />
                  </div>
                ) : (
                  <div className="space-y-6">
                    <p className="text-xs text-slate-500 font-bold uppercase">
                      Authorized to ingest <span className="font-black text-primary">{excelData.length} technical units</span> into the registry.
                    </p>
                    <div className="flex gap-4 justify-center">
                      <Button variant="outline" onClick={() => setCurrentStep(2)} className="h-14 px-10 rounded-xl font-black uppercase border-2">
                        Adjust Mapping
                      </Button>
                      <Button 
                        onClick={executeImport} 
                        disabled={validationResults.invalidCount > 0} 
                        className="h-14 px-12 rounded-xl text-md font-black uppercase bg-primary shadow-xl shadow-primary/20"
                      >
                        <Sparkles className="mr-3 h-5 w-5" /> Commit Technical Intake
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* --- STEP 5: SUCCESS --- */}
      {currentStep === 4 && (
        <Card className="border-none shadow-3xl text-center p-20 rounded-3xl bg-emerald-50 animate-in zoom-in-95">
          <CardContent className="space-y-8">
            <div className="h-24 w-24 bg-emerald-500 rounded-full flex items-center justify-center mx-auto shadow-2xl border-4 border-white animate-bounce">
              <CheckCircle2 className="text-white h-12 w-12" />
            </div>
            <div className="space-y-2">
              <h3 className="text-4xl font-black text-emerald-900 uppercase tracking-tighter">Registry Synchronized</h3>
              <p className="text-emerald-700 font-bold">Successfully ingested {summary?.imported} technical paper units.</p>
            </div>
            <div className="flex gap-4 justify-center pt-6">
              <Button asChild size="lg" className="h-14 px-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 font-black uppercase shadow-xl">
                <a href="/paper-stock">View Stock Registry <ArrowRight className="ml-2 h-5 w-5" /></a>
              </Button>
              <Button variant="outline" onClick={() => {
                setExcelData([]);
                setMapping({});
                setFileInfo(null);
                setCurrentStep(1);
              }} size="lg" className="h-14 px-10 rounded-xl font-black uppercase border-emerald-200 text-emerald-800">
                Import Another File
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
