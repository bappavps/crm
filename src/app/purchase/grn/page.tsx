
"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import { 
  Plus, 
  Loader2, 
  Search, 
  ArrowUpDown, 
  FilterX, 
  Hash, 
  Calendar,
  FileDown,
  FileUp,
  ChevronLeft,
  ChevronRight,
  Trash2,
  X,
  Settings2,
  Download,
  AlertTriangle,
  CheckCircle2,
  Sparkles
} from "lucide-react"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useFirestore, useUser, useMemoFirebase, useDoc, useCollection, errorEmitter, FirestorePermissionError } from "@/firebase"
import { 
  collection, 
  doc, 
  query, 
  where, 
  getDocs, 
  orderBy, 
  limit, 
  startAfter, 
  getCountFromServer,
  QueryDocumentSnapshot,
  DocumentData,
  onSnapshot,
  deleteDoc,
  writeBatch,
  serverTimestamp,
  runTransaction
} from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import * as XLSX from 'xlsx'
import { exportPaperStockToExcel } from "@/lib/export-utils"

// --- TYPES ---
type SortField = 'rollNo' | 'receivedDate' | 'gsm' | 'widthMm' | 'sqm' | 'createdAt';
type SortOrder = 'asc' | 'desc';

interface FilterState {
  companies: string[];
  types: string[];
  gsms: string[];
  suppliers: string[];
  locations: string[];
  statuses: string[];
  lotNo: string;
  grnNo: string;
  startDate: string;
  endDate: string;
}

const INITIAL_FILTERS: FilterState = {
  companies: [],
  types: [],
  gsms: [],
  suppliers: [],
  locations: [],
  statuses: [],
  lotNo: "",
  grnNo: "",
  startDate: "",
  endDate: ""
};

const TEMPLATE_HEADERS = [
  "RELL NO", "PAPER COMPANY", "PAPER TYPE", "WIDTH (MM)", "LENGTH (MTR)", 
  "GSM", "WEIGHT(KG)", "PURCHASE RATE", "WASTAGE", "DATE RECEIVED", 
  "LOT NO", "COMPANY RELL NO", "LOCATION"
];

const SYSTEM_FIELDS = [
  { label: "Roll No (Mandatory)", value: "rollNo" },
  { label: "Paper Company", value: "paperCompany" },
  { label: "Paper Type", value: "paperType" },
  { label: "Width (mm)", value: "widthMm" },
  { label: "Length (mtr)", value: "lengthMeters" },
  { label: "GSM", value: "gsm" },
  { label: "Weight (kg)", value: "weightKg" },
  { label: "Purchase Rate", value: "purchaseRate" },
  { label: "Wastage (%)", value: "wastage" },
  { label: "Date Received", value: "receivedDate" },
  { label: "Lot No", value: "lotNo" },
  { label: "Company Roll No", value: "companyRollNo" },
  { label: "Location", value: "location" }
];

export default function GRNPage() {
  const { toast } = useToast()
  const { user } = useUser()
  const firestore = useFirestore()
  const [isMounted, setIsMounted] = useState(false)
  
  // Dialogs
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  
  // Data States
  const [isGenerating, setIsGenerating] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  
  // Selection & Pagination
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [pageSize, setPageSize] = useState<number>(20)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalRecords, setTotalRecords] = useState(0)
  const [lastVisible, setLastVisible] = useState<QueryDocumentSnapshot<DocumentData> | null>(null)
  const [pageStack, setPageStack] = useState<any[]>([null])
  const [pagedJumbos, setPagedJumbos] = useState<any[]>([])
  const [isPageLoading, setIsPageLoading] = useState(false)

  // Filter & Sort State
  const [sortField, setSortField] = useState<SortField>('receivedDate')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS)

  // Upload State
  const [importStep, setImportStep] = useState(1)
  const [excelData, setExcelData] = useState<any[]>([])
  const [excelHeaders, setExcelHeaders] = useState<string[]>([])
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({})
  const [uploadProgress, setUploadProgress] = useState(0)
  const [importSummary, setImportSummary] = useState<any>(null)

  // Options for multi-selects
  const [options, setOptions] = useState({
    companies: [] as string[],
    types: [] as string[],
    gsms: [] as string[],
    suppliers: [] as string[],
    locations: [] as string[],
    statuses: ['In Stock', 'Consumed', 'Partial', 'Reserved']
  })

  useEffect(() => { setIsMounted(true) }, [])

  // Auth check
  const adminDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'adminUsers', user.uid);
  }, [firestore, user]);
  const { data: adminData } = useDoc(adminDocRef);
  const isAdmin = !!adminData;

  const settingsRef = useMemoFirebase(() => (!firestore ? null : doc(firestore, 'roll_settings', 'global_config')), [firestore]);
  const { data: settings } = useDoc(settingsRef);

  // Auto-generate filter options from data
  useEffect(() => {
    if (!firestore || !isAdmin) return;
    const unsub = onSnapshot(collection(firestore, 'jumbo_stock'), (snap) => {
      const docs = snap.docs.map(d => d.data());
      setOptions(prev => ({
        ...prev,
        companies: Array.from(new Set(docs.map(d => d.paperCompany).filter(Boolean))).sort(),
        types: Array.from(new Set(docs.map(d => d.paperType).filter(Boolean))).sort(),
        gsms: Array.from(new Set(docs.map(d => d.gsm?.toString()).filter(Boolean))).sort((a,b) => Number(a)-Number(b)),
        suppliers: Array.from(new Set(docs.map(d => d.supplier).filter(Boolean))).sort(),
        locations: Array.from(new Set(docs.map(d => d.location).filter(Boolean))).sort(),
      }));
    });
    return () => unsub();
  }, [firestore, isAdmin]);

  // Query Builder
  const buildQuery = (isCount = false) => {
    if (!firestore) return null;
    let q = collection(firestore, 'jumbo_stock');
    let constraints: any[] = [];

    if (filters.companies.length > 0) constraints.push(where('paperCompany', 'in', filters.companies.slice(0, 10)));
    if (filters.types.length > 0) constraints.push(where('paperType', 'in', filters.types.slice(0, 10)));
    if (filters.gsms.length > 0) constraints.push(where('gsm', 'in', filters.gsms.slice(0, 10).map(Number)));
    if (filters.suppliers.length > 0) constraints.push(where('supplier', 'in', filters.suppliers.slice(0, 10)));
    if (filters.locations.length > 0) constraints.push(where('location', 'in', filters.locations.slice(0, 10)));
    if (filters.statuses.length > 0) constraints.push(where('status', 'in', filters.statuses.slice(0, 10)));

    if (filters.startDate || filters.endDate) {
      if (filters.startDate) constraints.push(where('receivedDate', '>=', filters.startDate));
      if (filters.endDate) constraints.push(where('receivedDate', '<=', filters.endDate));
    } else if (filters.lotNo) {
      constraints.push(where('lotNo', '>=', filters.lotNo));
      constraints.push(where('lotNo', '<=', filters.lotNo + '\uf8ff'));
    } else if (filters.grnNo) {
      constraints.push(where('rollNo', '>=', filters.grnNo));
      constraints.push(where('rollNo', '<=', filters.grnNo + '\uf8ff'));
    }

    if (isCount) return query(q, ...constraints);

    constraints.push(orderBy(sortField, sortOrder));
    const cursor = pageStack[currentPage - 1];
    if (cursor) constraints.push(startAfter(cursor));
    constraints.push(limit(pageSize));

    return query(q, ...constraints);
  }

  // Load Data
  useEffect(() => {
    if (!firestore || !isAdmin) return;
    const load = async () => {
      setIsPageLoading(true);
      try {
        const countQ = buildQuery(true);
        if (countQ) {
          const countSnap = await getCountFromServer(countQ);
          setTotalRecords(countSnap.data().count);
        }

        const dataQ = buildQuery();
        if (dataQ) {
          const snap = await getDocs(dataQ);
          setPagedJumbos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
          if (snap.docs.length > 0) setLastVisible(snap.docs[snap.docs.length - 1]);
        }
      } catch (e) {
        toast({ variant: "destructive", title: "Query Complexity", description: "This filter combination is too complex or requires an index." });
      } finally {
        setIsPageLoading(false);
      }
    };
    load();
  }, [firestore, isAdmin, filters, sortField, sortOrder, pageSize, currentPage]);

  const handleFilterChange = (field: keyof FilterState, value: any) => {
    setFilters(prev => ({ ...prev, [field]: value }));
    setCurrentPage(1);
    setPageStack([null]);
  }

  const toggleMultiSelect = (field: keyof FilterState, value: string) => {
    const current = (filters[field] as string[]) || [];
    const next = current.includes(value) ? current.filter(v => v !== value) : [...current, value];
    handleFilterChange(field, next);
  }

  const resetFilters = () => {
    setFilters(INITIAL_FILTERS);
    setSortField('receivedDate');
    setSortOrder('desc');
    setCurrentPage(1);
    setPageStack([null]);
  }

  const downloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([], { header: TEMPLATE_HEADERS });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Stock Template");
    XLSX.writeFile(wb, "paper_stock_template.xlsx");
    toast({ title: "Template Downloaded" });
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const ab = evt.target?.result;
        const wb = XLSX.read(ab, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws);
        const headers = XLSX.utils.sheet_to_json(ws, { header: 1 })[0] as string[];

        setExcelData(data);
        setExcelHeaders(headers);
        setImportStep(2);
      } catch (err) {
        console.error("Excel Parse Error:", err);
        toast({ variant: "destructive", title: "Format Error", description: "Could not parse Excel file." });
      }
    };
    reader.readAsArrayBuffer(file);
  }

  const executeBulkImport = async () => {
    if (!firestore || !user || !excelData.length) return;
    
    const rollNoMapping = Object.keys(columnMapping).find(k => columnMapping[k] === 'rollNo');
    if (!rollNoMapping) {
      toast({ variant: "destructive", title: "Mapping Error", description: "Roll No must be mapped." });
      return;
    }

    setImportStep(3);
    setUploadProgress(0);

    const existingSnap = await getDocs(collection(firestore, 'jumbo_stock'));
    const existingRolls = new Set(existingSnap.docs.map(d => d.data().rollNo));

    let imported = 0;
    let skipped = 0;
    let errors = 0;

    for (let i = 0; i < excelData.length; i += 200) {
      const batch = writeBatch(firestore);
      const chunk = excelData.slice(i, i + 200);

      chunk.forEach((row) => {
        const rollId = String(row[rollNoMapping]);
        if (existingRolls.has(rollId)) {
          skipped++;
          return;
        }

        const data: any = { status: 'In Stock', createdAt: serverTimestamp(), createdById: user.uid };
        Object.entries(columnMapping).forEach(([excelHeader, systemKey]) => {
          let val = row[excelHeader];
          if (['widthMm', 'lengthMeters', 'gsm', 'weightKg', 'purchaseRate', 'wastage'].includes(systemKey)) {
            val = Number(val) || 0;
          }
          data[systemKey] = val;
        });

        // Auto-calc SQM
        if (data.widthMm && data.lengthMeters) {
          data.sqm = (data.widthMm * data.lengthMeters) / 1000;
        }

        const docRef = doc(collection(firestore, 'jumbo_stock'));
        batch.set(docRef, data);
        imported++;
      });

      try {
        await batch.commit();
        setUploadProgress(Math.round(((i + chunk.length) / excelData.length) * 100));
      } catch (err) {
        console.error("Batch Commit Error:", err);
        errors += chunk.length;
      }
    }

    setImportSummary({ total: excelData.length, imported, skipped, errors });
    setImportStep(4);
    toast({ title: "Import Processed" });
  }

  const handleExportAll = async () => {
    setIsExporting(true);
    try {
      await exportPaperStockToExcel(firestore, filters as any);
    } finally { setIsExporting(false); }
  }

  const handleSingleDelete = async (roll: any) => {
    if (!isAdmin || !firestore) return;
    if (confirm(`Delete Roll ID ${roll.rollNo}?`)) {
      setIsDeleting(true);
      try {
        await deleteDoc(doc(firestore, 'jumbo_stock', roll.id));
        toast({ title: "Roll Deleted" });
        setTotalRecords(prev => prev - 1);
      } finally { setIsDeleting(false); }
    }
  }

  if (!isMounted) return null;

  const activeFiltersCount = Object.entries(filters).reduce((acc, [k, v]) => {
    if (Array.isArray(v)) return acc + v.length;
    return v ? acc + 1 : acc;
  }, 0);

  const startIdx = totalRecords === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endIdx = Math.min(currentPage * pageSize, totalRecords);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black tracking-tight text-primary uppercase">Substrate Registry (GRN)</h2>
          <p className="text-muted-foreground font-medium italic">High-precision inventory analysis and technical data intake.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowFilters(!showFilters)} className={cn(activeFiltersCount > 0 && "border-primary text-primary")}>
            <Settings2 className="h-4 w-4 mr-2" /> Filters {activeFiltersCount > 0 && `(${activeFiltersCount})`}
          </Button>
          <Button variant="outline" onClick={handleExportAll} disabled={isExporting}>
            {isExporting ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <FileDown className="mr-2 h-4 w-4" />} Export
          </Button>
          <Button onClick={() => setIsDialogOpen(true)} className="shadow-lg font-bold uppercase tracking-widest"><Plus className="mr-2 h-4 w-4" /> New Intake</Button>
        </div>
      </div>

      {/* ADVANCED FILTERS */}
      {showFilters && (
        <Card className="border-primary/20 bg-primary/5 animate-in slide-in-from-top-2">
          <CardContent className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase flex items-center gap-1"><Search className="h-3 w-3" /> Lot Search</Label>
                <Input placeholder="Prefix..." value={filters.lotNo} onChange={(e) => handleFilterChange('lotNo', e.target.value)} className="bg-background h-9 text-xs" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase flex items-center gap-1"><Hash className="h-3 w-3" /> GRN Number</Label>
                <Input placeholder="Prefix..." value={filters.grnNo} onChange={(e) => handleFilterChange('grnNo', e.target.value)} className="bg-background h-9 text-xs" />
              </div>
              <div className="md:col-span-2 space-y-2">
                <Label className="text-[10px] font-black uppercase flex items-center gap-1"><Calendar className="h-3 w-3" /> Date Range</Label>
                <div className="flex items-center gap-2">
                  <Input type="date" value={filters.startDate} onChange={(e) => handleFilterChange('startDate', e.target.value)} className="bg-background h-9 text-xs" />
                  <Input type="date" value={filters.endDate} onChange={(e) => handleFilterChange('endDate', e.target.value)} className="bg-background h-9 text-xs" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
              {[
                { label: 'Company', field: 'companies', opts: options.companies },
                { label: 'Type', field: 'types', opts: options.types },
                { label: 'GSM', field: 'gsms', opts: options.gsms },
                { label: 'Supplier', field: 'suppliers', opts: options.suppliers },
                { label: 'Location', field: 'locations', opts: options.locations },
                { label: 'Status', field: 'statuses', opts: options.statuses },
              ].map((g) => (
                <div key={g.label} className="space-y-2">
                  <Label className="text-[9px] font-black uppercase text-muted-foreground">{g.label}</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="w-full justify-between h-8 text-[10px] font-bold bg-background">
                        {filters[g.field as keyof FilterState].length === 0 ? 'Any' : `${filters[g.field as keyof FilterState].length} selected`}
                        <ChevronRight className="h-3 w-3 rotate-90" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-56 p-2 max-h-64 overflow-y-auto" align="start">
                      <div className="space-y-1">
                        {g.opts.map(opt => (
                          <div key={opt} className="flex items-center space-x-2 p-1 hover:bg-muted rounded cursor-pointer" onClick={() => toggleMultiSelect(g.field as keyof FilterState, opt)}>
                            <Checkbox checked={filters[g.field as keyof FilterState].includes(opt)} />
                            <span className="text-xs font-medium">{opt}</span>
                          </div>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="flex gap-2 flex-wrap">
                {activeFiltersCount > 0 && <Badge variant="secondary" className="bg-primary text-white h-6 font-black uppercase text-[10px]">{activeFiltersCount} ACTIVE FILTERS</Badge>}
              </div>
              <Button variant="ghost" size="sm" onClick={resetFilters} className="text-[10px] font-black uppercase text-destructive hover:text-destructive">
                <FilterX className="mr-1 h-3 w-3" /> Reset Registry View
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* REGISTRY TABLE */}
      <Card className="shadow-2xl border-none overflow-hidden">
        <div className="bg-muted/30 p-4 border-b flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Select value={pageSize.toString()} onValueChange={(v) => { setPageSize(Number(v)); setCurrentPage(1); setPageStack([null]); }}>
              <SelectTrigger className="w-[80px] h-8 text-[10px] font-black"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[10, 20, 50, 100].map(v => <SelectItem key={v} value={v.toString()}>{v} Rows</SelectItem>)}
              </SelectContent>
            </Select>
            <span className="text-[10px] font-black uppercase text-muted-foreground">Showing {startIdx}-{endIdx} of {totalRecords.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="h-8 w-8 p-0"><ChevronLeft className="h-4 w-4" /></Button>
            <Badge variant="secondary" className="h-8 px-3 text-[10px] font-black">PAGE {currentPage}</Badge>
            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => p + 1)} disabled={endIdx >= totalRecords} className="h-8 w-8 p-0"><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="min-w-[2500px]">
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-[60px] font-black text-[10px] uppercase text-center sticky left-0 bg-muted/50 z-20">S/N</TableHead>
                  {[
                    { l: 'RELL NO', f: 'rollNo' },
                    { l: 'COMPANY', f: 'paperCompany' },
                    { l: 'TYPE', f: 'paperType' },
                    { l: 'WIDTH (MM)', f: 'widthMm' },
                    { l: 'LENGTH (MTR)', f: 'lengthMeters' },
                    { l: 'SQM', f: 'sqm' },
                    { l: 'GSM', f: 'gsm' },
                    { l: 'WEIGHT (KG)', f: 'weightKg' },
                    { l: 'RATE', f: 'purchaseRate' },
                    { l: 'WASTAGE', f: 'wastage' },
                    { l: 'USE DATE', f: 'dateOfUse' },
                    { l: 'RECEIVED', f: 'receivedDate' },
                    { l: 'JOB NO', f: 'jobNo' },
                    { l: 'SIZE', f: 'size' },
                    { l: 'PRODUCT', f: 'productName' },
                    { l: 'CODE', f: 'code' },
                    { l: 'LOT NO', f: 'lotNo' },
                    { l: 'DATE', f: 'date' },
                    { l: 'CO RELL NO', f: 'companyRollNo' }
                  ].map(c => (
                    <TableHead key={c.f} className="text-[10px] font-black uppercase">
                      <Button variant="ghost" onClick={() => {
                        const isAsc = sortField === c.f && sortOrder === 'asc';
                        setSortField(c.f as any);
                        setSortOrder(isAsc ? 'desc' : 'asc');
                      }} className="h-7 p-0 hover:bg-transparent font-black">
                        {c.l} <ArrowUpDown className="ml-1 h-3 w-3" />
                      </Button>
                    </TableHead>
                  ))}
                  <TableHead className="text-right sticky right-0 bg-muted/50 z-20 font-black text-[10px]">ACTION</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isPageLoading ? <TableRow><TableCell colSpan={21} className="text-center py-20"><Loader2 className="animate-spin mx-auto text-primary" /></TableCell></TableRow> : pagedJumbos.map((j, i) => (
                  <TableRow key={j.id} className="hover:bg-primary/5 h-12">
                    <TableCell className="text-center font-bold text-[10px] text-muted-foreground sticky left-0 bg-background z-10">{(currentPage-1)*pageSize+i+1}</TableCell>
                    <TableCell className="font-black text-primary font-mono text-xs">{j.rollNo}</TableCell>
                    <TableCell className="text-[11px] font-bold">{j.paperCompany}</TableCell>
                    <TableCell className="text-[11px]">{j.paperType}</TableCell>
                    <TableCell className="text-[11px] font-mono">{j.widthMm}mm</TableCell>
                    <TableCell className="text-[11px] font-mono">{j.lengthMeters}m</TableCell>
                    <TableCell className="text-[11px] font-black text-primary">{j.sqm}</TableCell>
                    <TableCell className="text-[11px]">{j.gsm}</TableCell>
                    <TableCell className="text-[11px]">{j.weightKg}kg</TableCell>
                    <TableCell className="text-[11px] text-emerald-700 font-bold">₹{j.purchaseRate}</TableCell>
                    <TableCell className="text-[11px]">{j.wastage}%</TableCell>
                    <TableCell className="text-[10px]">{j.dateOfUse || '-'}</TableCell>
                    <TableCell className="text-[10px] font-bold">{j.receivedDate}</TableCell>
                    <TableCell className="text-[11px] font-mono">{j.jobNo || '-'}</TableCell>
                    <TableCell className="text-[11px]">{j.size || '-'}</TableCell>
                    <TableCell className="text-[11px] truncate max-w-[150px]">{j.productName || '-'}</TableCell>
                    <TableCell className="text-[11px] font-mono">{j.code || '-'}</TableCell>
                    <TableCell className="text-[11px] font-mono font-bold text-accent">{j.lotNo}</TableCell>
                    <TableCell className="text-[10px]">{j.date || '-'}</TableCell>
                    <TableCell className="text-[11px] font-mono">{j.companyRollNo || '-'}</TableCell>
                    <TableCell className="text-right sticky right-0 bg-background z-10 border-l">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleSingleDelete(j)}><Trash2 className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* INTAKE DIALOG */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[900px]">
          <form onSubmit={async (e) => {
            e.preventDefault();
            setIsGenerating(true);
            const form = new FormData(e.currentTarget);
            const data = Object.fromEntries(form.entries());
            try {
              await runTransaction(firestore!, async (tx) => {
                const countRef = doc(firestore!, 'counters', 'jumbo_roll');
                const snap = await tx.get(countRef);
                const nextNum = (snap.exists() ? snap.data().current_number : 1000) + 1;
                const rollNo = `${settings?.parentPrefix || "TLC-"}${nextNum}`;
                tx.set(doc(collection(firestore!, 'jumbo_stock')), {
                  ...data,
                  rollNo,
                  widthMm: Number(data.widthMm),
                  lengthMeters: Number(data.lengthMeters),
                  gsm: Number(data.gsm),
                  sqm: (Number(data.widthMm) * Number(data.lengthMeters)) / 1000,
                  status: 'In Stock',
                  createdAt: serverTimestamp()
                });
                tx.update(countRef, { current_number: nextNum });
              });
              toast({ title: "Roll Added Successfully" });
              setIsDialogOpen(false);
            } finally { setIsGenerating(false); }
          }}>
            <DialogHeader><DialogTitle>Technical Stock Intake</DialogTitle><DialogDescription>Manual entry for single jumbo roll substrate.</DialogDescription></DialogHeader>
            <div className="grid gap-6 py-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2"><Label>Paper Company</Label><Input name="paperCompany" required /></div>
                <div className="space-y-2"><Label>Paper Type</Label><Input name="paperType" required /></div>
                <div className="space-y-2"><Label>Width (mm)</Label><Input name="widthMm" type="number" required /></div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2"><Label>Length (m)</Label><Input name="lengthMeters" type="number" required /></div>
                <div className="space-y-2"><Label>GSM</Label><Input name="gsm" type="number" required /></div>
                <div className="space-y-2"><Label>Lot No</Label><Input name="lotNo" required /></div>
              </div>
            </div>
            <DialogFooter><Button type="submit" disabled={isGenerating}>{isGenerating ? <Loader2 className="animate-spin" /> : 'Complete Intake'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
