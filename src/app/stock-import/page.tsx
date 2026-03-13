
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
    XLSX.writeFile(wb, "Shree_Label_Technical_Template.xlsx");
    toast({ title: "Template Downloaded", description: "Use this 18-column grid for the best results." });
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
          showModal('ERROR', 'File Empty', 'Your spreadsheet does not contain any data rows.');
          setIsProcessing(false);
          return;
        }

        const fileHeaders = (data[0] as string[]).map(h => String(h).trim());
        const rows = XLSX.utils.sheet_to_json(ws);
        
        setHeaders(fileHeaders);
        setExcelData(rows);
        setFileInfo({
          name: file.name,
          size: (file.size / 1024).toFixed(1) + ' KB',
          rows: rows.length
        });

        // Auto-detection logic
        const initialMapping: Record<string, string> = {};
        Object.entries(FIELD_LABELS).forEach(([key, label]) => {
          const match = fileHeaders.find(h => 
            h.toLowerCase() === label.toLowerCase() || 
            h.toLowerCase() === key.toLowerCase() ||
            h.toLowerCase().includes(label.toLowerCase())
          );
          if (match) initialMapping[key] = match;
        });
        setMapping(initialMapping);

        setProgress(100);
        setTimeout(() => {
          setIsProcessing(false);
          setCurrentStep(2);
        }, 500);
      } catch (err) {
        showModal('ERROR', 'Parsing Error', 'We could not read this file. Please ensure it is a valid Excel or CSV.');
        setIsProcessing(false);
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

  const validationResults = useMemo(() => {
    const invalidRows: string[] = [];
    let validCount = 0;

    excelData.forEach((row: any, index) => {
      let hasError = false;
      
      REQUIRED_FIELDS.forEach(field => {
        const header = mapping[field];
        const val = row[header];
        if (!header || val === undefined || val === "") {
          invalidRows.push(`Row ${index + 2}: Missing mandatory field "${FIELD_LABELS[field]}"`);
          hasError = true;
        }
      });

      // Numeric validation
      ["widthMm", "lengthMeters", "gsm"].forEach(field => {
        const header = mapping[field];
        if (header) {
          const num = Number(row[header]);
          if (isNaN(num) || num <= 0) {
            invalidRows.push(`Row ${index + 2}: "${FIELD_LABELS[field]}" must be a positive number`);
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
            createdById: user.uid,
            createdByName: user.displayName || user.email
          };

          Object.entries(mapping).forEach(([key, header]) => {
            let val = row[header];
            if (["widthMm", "lengthMeters", "gsm", "weightKg", "purchaseRate"].includes(key)) {
              val = Number(val) || 0;
            }
            data[key] = val;
          });

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
        const p = Math.round(((i + chunk.length) / totalRows) * 100);
        setProgress(p);
      }

      setSummary({ total: totalRows, imported });
      setCurrentStep(4); // Success state
      showModal('SUCCESS', 'Migration Complete', `Successfully added ${imported} technical units to your registry.`, true);
    } catch (error: any) {
      showModal('ERROR', 'Import Blocked', error.message);
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 font-sans pb-32">
      <ActionModal isOpen={modal.isOpen} onClose={() => setModal(p => ({ ...p, isOpen: false }))} {...modal} />

      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black text-primary uppercase tracking-tighter">Bulk Technical Import</h2>
          <p className="text-muted-foreground font-medium text-xs">Migrate your legacy inventory into the unified 18-column technical grid.</p>
        </div>
        {currentStep < 4 && currentStep > 0 && (
          <Button variant="ghost" onClick={() => setCurrentStep(currentStep - 1)} className="font-bold text-[10px] uppercase">
            <ArrowLeft className="mr-2 h-3 w-3" /> Previous Step
          </Button>
        )}
      </div>

      {/* STEP TRACKER */}
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
            <span className={cn(
              "text-[10px] font-black uppercase tracking-widest",
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
          <CardContent className="p-16 text-center space-y-10">
            <div className="h-32 w-32 bg-primary/10 rounded-full flex items-center justify-center mx-auto border-4 border-white shadow-inner">
              <FileSpreadsheet className="h-16 w-16 text-primary" />
            </div>
            <div className="space-y-4 max-w-lg mx-auto">
              <h3 className="text-2xl font-black uppercase tracking-tight">Begin with the Template</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                To ensure a perfect technical match, download our official 18-column Excel template. 
                Fill in your stock data and return here to upload.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Button onClick={downloadTemplate} size="lg" className="h-16 px-10 rounded-2xl font-black uppercase tracking-widest shadow-xl bg-primary hover:bg-primary/90">
                <Download className="mr-3 h-6 w-6" /> Download Template
              </Button>
              <Button variant="outline" onClick={() => setCurrentStep(1)} size="lg" className="h-16 px-10 rounded-2xl font-black uppercase tracking-widest border-2">
                I already have a file <ChevronRight className="ml-2 h-6 w-6" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* --- STEP 2: UPLOAD --- */}
      {currentStep === 1 && (
        <div className="max-w-3xl mx-auto space-y-6">
          <Card className={cn(
            "border-4 border-dashed rounded-3xl transition-all duration-300 relative group",
            isProcessing ? "border-primary/50 bg-primary/5" : "border-muted-foreground/20 hover:border-primary/40 hover:bg-primary/5"
          )}>
            <CardContent className="p-20 text-center space-y-6">
              {!isProcessing ? (
                <>
                  <div className="h-24 w-24 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                    <FileUp className="h-12 w-12 text-primary opacity-60" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="file-upload" className="cursor-pointer">
                      <span className="text-3xl font-black text-primary underline underline-offset-8 decoration-primary/20">Drop Inventory File</span>
                      <Input id="file-upload" type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileUpload} />
                    </Label>
                    <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest pt-4">Accepted: .xlsx, .xls, .csv</p>
                  </div>
                </>
              ) : (
                <div className="space-y-8 py-10">
                  <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                    <h4 className="font-black uppercase tracking-widest text-primary">Analyzing Technical Matrix...</h4>
                  </div>
                  <div className="max-w-md mx-auto space-y-2">
                    <Progress value={progress} className="h-3 rounded-full" />
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">{progress}% Complete</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          
          <div className="p-6 bg-amber-50 border border-amber-100 rounded-2xl flex items-start gap-4">
            <Info className="h-6 w-6 text-amber-600 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-black text-amber-900 uppercase tracking-tight">Security Note</p>
              <p className="text-xs text-amber-700 leading-relaxed font-medium">
                Our system handles parsing locally in your browser. No data is sent to the server until you confirm the final import step.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* --- STEP 3: MAPPING --- */}
      {currentStep === 2 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card className="shadow-2xl border-none rounded-3xl overflow-hidden animate-in slide-in-from-bottom-4">
              <CardHeader className="bg-slate-50 border-b p-8">
                <CardTitle className="text-sm font-black uppercase flex items-center justify-between tracking-widest">
                  <div className="flex items-center gap-3">
                    <RefreshCw className="h-5 w-5 text-primary" />
                    <span>Synchronize Columns</span>
                  </div>
                  <Badge variant="outline" className="font-black text-[10px]">{fileInfo?.rows} ROWS DETECTED</Badge>
                </CardTitle>
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
                            <span className={cn("text-xs font-black uppercase tracking-tight", REQUIRED_FIELDS.includes(key) ? "text-primary" : "text-slate-600")}>
                              {label} {REQUIRED_FIELDS.includes(key) && <span className="text-destructive">*</span>}
                            </span>
                            {REQUIRED_FIELDS.includes(key) && <span className="text-[9px] text-muted-foreground font-bold uppercase">Mandatory Field</span>}
                          </div>
                        </TableCell>
                        <TableCell className="py-4">
                          <Select value={mapping[key]} onValueChange={(val) => setMapping({ ...mapping, [key]: val })}>
                            <SelectTrigger className={cn(
                              "h-10 text-xs font-bold border-2 transition-all",
                              mapping[key] ? "border-emerald-200 bg-emerald-50/30 text-emerald-900" : "border-slate-200"
                            )}>
                              <SelectValue placeholder="Link Spreadsheet Column..." />
                            </SelectTrigger>
                            <SelectContent>
                              {headers.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="py-4 pr-8">
                          {mapping[key] && <CheckCircle2 className="h-5 w-5 text-emerald-500 animate-in zoom-in" />}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="rounded-3xl border-none shadow-xl bg-primary text-white sticky top-24">
              <CardHeader className="pb-4">
                <CardTitle className="text-xs font-black uppercase tracking-[0.2em] opacity-70">Mapping Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-8">
                <div className="space-y-2">
                  <div className="flex justify-between items-end">
                    <span className="text-[10px] font-black uppercase">Mapped Fields</span>
                    <span className="text-2xl font-black">{Object.keys(mapping).length} / {Object.keys(FIELD_LABELS).length}</span>
                  </div>
                  <Progress value={(Object.keys(mapping).length / Object.keys(FIELD_LABELS).length) * 100} className="h-2 bg-white/20" />
                </div>

                <div className="p-4 bg-white/10 rounded-2xl space-y-3">
                  <p className="text-[10px] font-black uppercase opacity-70">Requirements Check</p>
                  <div className="space-y-2">
                    {REQUIRED_FIELDS.map(f => (
                      <div key={f} className="flex items-center gap-2">
                        {mapping[f] ? (
                          <div className="h-4 w-4 bg-emerald-400 rounded-full flex items-center justify-center"><CheckCircle2 className="h-3 w-3 text-emerald-900" /></div>
                        ) : (
                          <div className="h-4 w-4 bg-white/20 rounded-full flex items-center justify-center"><X className="h-3 w-3 text-white" /></div>
                        )}
                        <span className="text-[11px] font-bold tracking-tight">{FIELD_LABELS[f]}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <Button 
                  onClick={() => setCurrentStep(3)} 
                  disabled={!REQUIRED_FIELDS.every(f => !!mapping[f])}
                  className="w-full h-16 rounded-2xl bg-white text-primary hover:bg-slate-50 font-black uppercase tracking-widest shadow-2xl disabled:opacity-50"
                >
                  Confirm Mapping <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* --- STEP 4: PREVIEW & IMPORT --- */}
      {currentStep === 3 && (
        <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-emerald-50 border-emerald-100 shadow-sm rounded-3xl">
              <CardContent className="p-6 flex flex-col items-center text-center">
                <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest mb-1">Healthy Records</span>
                <span className="text-4xl font-black text-emerald-600">{validationResults.validCount}</span>
              </CardContent>
            </Card>
            <Card className={cn("shadow-sm rounded-3xl", validationResults.invalidCount > 0 ? "bg-destructive/5 border-destructive/10" : "bg-slate-50 border-slate-100")}>
              <CardContent className="p-6 flex flex-col items-center text-center">
                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Issue Detected</span>
                <span className={cn("text-4xl font-black", validationResults.invalidCount > 0 ? "text-destructive" : "text-slate-400")}>{validationResults.invalidCount}</span>
              </CardContent>
            </Card>
            <Card className="bg-primary/5 border-primary/10 shadow-sm rounded-3xl">
              <CardContent className="p-6 flex flex-col items-center text-center">
                <span className="text-[10px] font-black text-primary uppercase tracking-widest mb-1">Total Payload</span>
                <span className="text-4xl font-black text-primary">{excelData.length}</span>
              </CardContent>
            </Card>
          </div>

          <Card className="shadow-2xl border-none rounded-3xl overflow-hidden">
            <CardHeader className="bg-slate-50 border-b p-8 flex flex-row items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                  <TableIcon className="h-5 w-5 text-primary" /> Technical Registry Preview (Top 10)
                </CardTitle>
                <p className="text-[10px] text-muted-foreground font-bold uppercase">Columns shown match the unified registry grid.</p>
              </div>
              {validationResults.invalidCount > 0 && (
                <Button variant="outline" size="sm" onClick={() => setIsErrorListOpen(!isErrorListOpen)} className="font-black text-[10px] uppercase border-destructive text-destructive hover:bg-destructive/5">
                  {isErrorListOpen ? "Hide Errors" : `View ${validationResults.invalidCount} Validation Issues`}
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {isErrorListOpen && (
                <div className="p-8 bg-destructive/5 border-b border-destructive/10 space-y-4">
                  <div className="flex items-center gap-2 text-destructive font-black text-xs uppercase tracking-widest">
                    <AlertTriangle className="h-5 w-5" /> Incompatible Rows Detected
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-2">
                    {validationResults.errors.slice(0, 20).map((err, i) => (
                      <p key={i} className="text-[10px] font-bold text-destructive/80 flex items-center gap-2">
                        <span className="h-1 w-1 bg-destructive rounded-full" /> {err}
                      </p>
                    ))}
                    {validationResults.errors.length > 20 && <p className="text-[10px] italic text-destructive/60">...and {validationResults.errors.length - 20} more issues.</p>}
                  </div>
                </div>
              )}

              <div className="overflow-x-auto">
                <Table className="min-w-[2000px]">
                  <TableHeader className="bg-muted/20">
                    <TableRow>
                      {Object.keys(FIELD_LABELS).map(key => (
                        <TableHead key={key} className="text-[10px] font-black uppercase whitespace-nowrap">{FIELD_LABELS[key]}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mappedPreviewData.map((row, i) => (
                      <TableRow key={i} className="h-12 border-b">
                        {Object.keys(FIELD_LABELS).map(key => (
                          <TableCell key={key} className={cn(
                            "text-[11px] font-medium whitespace-nowrap",
                            key === 'sqm' ? "font-black text-primary" : "",
                            (!row[key] && REQUIRED_FIELDS.includes(key)) ? "bg-destructive/10 text-destructive font-black" : ""
                          )}>
                            {key === 'sqm' ? ((Number(row.widthMm) / 1000) * Number(row.lengthMeters)).toFixed(2) : (row[key] || "-")}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              
              <div className="p-12 space-y-8 bg-white text-center">
                {isProcessing ? (
                  <div className="space-y-6 max-w-xl mx-auto">
                    <div className="flex flex-col items-center gap-4">
                      <Loader2 className="h-10 w-10 animate-spin text-primary" />
                      <h4 className="text-xl font-black uppercase tracking-widest text-primary">Committing Bulk Transaction...</h4>
                    </div>
                    <div className="space-y-2">
                      <Progress value={progress} className="h-4 rounded-full shadow-inner" />
                      <p className="text-[10px] font-black text-muted-foreground uppercase">Progress: {progress}% • Stay on this page</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-6">
                    <div className="p-6 bg-primary/5 rounded-3xl border-2 border-dashed border-primary/20 max-w-lg">
                      <p className="text-xs text-slate-600 font-medium leading-relaxed">
                        Ready to ingest <span className="font-black text-primary">{excelData.length} records</span>. This will automatically generate sequential Roll IDs starting from the next available number in the registry.
                      </p>
                    </div>
                    <div className="flex gap-4">
                      <Button variant="outline" onClick={() => setCurrentStep(2)} className="h-16 px-10 rounded-2xl font-black uppercase tracking-widest border-2">
                        Re-Map Columns
                      </Button>
                      <Button 
                        onClick={executeImport} 
                        disabled={validationResults.invalidCount > 0} 
                        className="h-16 px-16 rounded-2xl text-lg font-black uppercase tracking-widest shadow-2xl bg-primary hover:bg-primary/90"
                      >
                        <Sparkles className="mr-3 h-6 w-6" /> Finalize Technical Ingestion
                      </Button>
                    </div>
                    {validationResults.invalidCount > 0 && (
                      <p className="text-[10px] text-destructive font-black uppercase flex items-center gap-2">
                        <AlertCircle className="h-4 w-4" /> Please resolve validation errors before finalizing import.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* --- STEP 5: SUCCESS --- */}
      {currentStep === 4 && (
        <Card className="border-none shadow-3xl text-center p-24 animate-in zoom-in-95 duration-700 rounded-3xl bg-emerald-50">
          <CardContent className="space-y-10">
            <div className="h-32 w-32 bg-emerald-500 rounded-full flex items-center justify-center mx-auto shadow-2xl border-8 border-white animate-bounce">
              <CheckCircle2 className="text-white h-16 w-16" />
            </div>
            <div className="space-y-3">
              <h3 className="text-5xl font-black text-emerald-900 uppercase tracking-tighter">Registry Updated</h3>
              <p className="text-emerald-700 font-bold text-xl">Successfully ingested {summary?.imported} technical units.</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-8">
              <Button asChild size="lg" className="h-16 px-12 rounded-2xl bg-emerald-600 hover:bg-emerald-700 font-black uppercase tracking-widest shadow-xl">
                <a href="/paper-stock">Open Paper Stock <ArrowRight className="ml-2 h-6 w-6" /></a>
              </Button>
              <Button variant="outline" onClick={() => {
                setExcelData([]);
                setMapping({});
                setFileInfo(null);
                setCurrentStep(1);
              }} size="lg" className="h-16 px-12 rounded-2xl font-black uppercase tracking-widest border-emerald-200 text-emerald-800">
                Import Another File
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
