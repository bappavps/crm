
"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/hooks/use-toast"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter
} from "@/components/ui/dialog"
import { 
  Plus, 
  Trash2, 
  Pencil, 
  Loader2, 
  CheckCircle2, 
  ChevronLeft, 
  ChevronRight, 
  ArrowUpDown, 
  X, 
  FileDown, 
  FileUp, 
  Settings2,
  Download,
  FilterX,
  Sparkles,
  AlertTriangle,
  ExternalLink,
  Info
} from "lucide-react"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useCollection, useFirestore, useMemoFirebase, useUser, useDoc } from "@/firebase"
import { collection, doc, query, where, orderBy, getDocs, writeBatch, serverTimestamp, getCountFromServer, limit, startAfter, deleteDoc, onSnapshot } from "firebase/firestore"
import { updateDocumentNonBlocking, addDocumentNonBlocking } from "@/firebase/non-blocking-updates"
import { cn } from "@/lib/utils"
import * as XLSX from 'xlsx'
import { exportPaperStockToExcel } from "@/lib/export-utils"
import { usePermissions } from "@/components/auth/permission-context"

// --- TYPES & CONSTANTS ---
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
  { label: "Location", value: "location" },
  { label: "Supplier", value: "supplier" }
];

const TEMPLATE_HEADERS = [
  "RELL NO", "PAPER COMPANY", "PAPER TYPE", "WIDTH (MM)", "LENGTH (MTR)", 
  "SQM", "GSM", "WEIGHT(KG)", "Purchase Rate", "WASTAGE", 
  "DATE OF RECEIVED", "Lot no/BATCH NO", "Company Rell no", "Location", "Supplier"
];

export default function MasterDataPage() {
  const { toast } = useToast()
  const { user } = useUser()
  const firestore = useFirestore()
  const { hasPermission } = usePermissions()
  const [isMounted, setIsMounted] = useState(false)
  
  // Generic CRUD state
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [dialogType, setDialogType] = useState<string>("raw_materials")
  const [editingItem, setEditingItem] = useState<any>(null)

  // Paper Stock State
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [importStep, setImportStep] = useState(1) 
  const [excelData, setExcelData] = useState<any[]>([])
  const [excelHeaders, setExcelHeaders] = useState<string[]>([])
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({})
  const [uploadProgress, setUploadProgress] = useState(0)
  const [importSummary, setImportSummary] = useState<any>(null)
  
  const [intakeForm, setIntakeForm] = useState({ widthMm: 0, lengthMeters: 0 })
  const liveSqm = useMemo(() => {
    const w = intakeForm.widthMm || 0;
    const l = intakeForm.lengthMeters || 0;
    return w > 0 && l > 0 ? ((w * l) / 1000).toFixed(2) : "0.00";
  }, [intakeForm]);

  const [isExporting, setIsExporting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  
  const [selectedStockIds, setSelectedStockIds] = useState<Set<string>>(new Set())
  const [pageSize, setPageSize] = useState<number>(20)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalRecords, setTotalRecords] = useState(0)
  const [pageStack, setPageStack] = useState<any[]>([null])
  const [pagedJumbos, setPagedJumbos] = useState<any[]>([])
  const [isPageLoading, setIsPageLoading] = useState(false)
  const [indexErrorUrl, setIndexErrorUrl] = useState<string | null>(null)
  
  const [sortField, setSortField] = useState<SortField>('receivedDate')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS)

  const [options, setOptions] = useState({
    companies: [] as string[],
    types: [] as string[],
    gsms: [] as string[],
    suppliers: [] as string[],
    locations: [] as string[],
    statuses: ['In Stock', 'Consumed', 'Partial', 'Reserved']
  })

  // Authorization
  const isAdmin = hasPermission('admin')

  // Top-level hooks
  const rawMaterialsQuery = useMemoFirebase(() => (firestore ? collection(firestore, 'raw_materials') : null), [firestore]);
  const { data: rawMaterials } = useCollection(rawMaterialsQuery);

  const suppliersQuery = useMemoFirebase(() => (firestore ? collection(firestore, 'suppliers') : null), [firestore]);
  const { data: suppliers } = useCollection(suppliersQuery);

  const machinesQuery = useMemoFirebase(() => (firestore ? collection(firestore, 'machines') : null), [firestore]);
  const { data: machines } = useCollection(machinesQuery);

  const cylindersQuery = useMemoFirebase(() => (firestore ? collection(firestore, 'cylinders') : null), [firestore]);
  const { data: cylinders } = useCollection(cylindersQuery);

  const customersQuery = useMemoFirebase(() => (firestore ? collection(firestore, 'customers') : null), [firestore]);
  const { data: customers } = useCollection(customersQuery);

  const bomsQuery = useMemoFirebase(() => (firestore ? collection(firestore, 'boms') : null), [firestore]);
  const { data: boms } = useCollection(bomsQuery);

  useEffect(() => { setIsMounted(true) }, []);

  // Sync Data Options
  useEffect(() => {
    if (!firestore || !isMounted) return;
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
  }, [firestore, isMounted]);

  const activeFiltersCount = useMemo(() => {
    return Object.entries(filters).reduce((acc, [k, v]) => {
      if (Array.isArray(v)) return acc + v.length;
      return v ? acc + 1 : acc;
    }, 0);
  }, [filters]);

  const buildQuery = (isCount = false) => {
    if (!firestore) return null;
    let q = collection(firestore, 'jumbo_stock');
    let constraints: any[] = [];
    let hasRange = false;
    let hasIn = false;

    const addSafeFilter = (field: string, values: any[]) => {
      if (!values || values.length === 0) return;
      if (values.length === 1) {
        constraints.push(where(field, '==', values[0]));
      } else if (!hasIn) {
        constraints.push(where(field, 'in', values.slice(0, 10)));
        hasIn = true;
      } else {
        console.warn(`Firestore limitation: Only one 'in' filter allowed. Skipping ${field}.`);
      }
    };

    addSafeFilter('paperCompany', filters.companies);
    addSafeFilter('paperType', filters.types);
    addSafeFilter('gsm', filters.gsms.map(Number));
    addSafeFilter('supplier', filters.suppliers);
    addSafeFilter('location', filters.locations);
    addSafeFilter('status', filters.statuses);

    if (filters.lotNo) {
      constraints.push(where('lotNo', '>=', filters.lotNo));
      constraints.push(where('lotNo', '<=', filters.lotNo + '\uf8ff'));
      hasRange = true;
    } else if (filters.grnNo) {
      constraints.push(where('rollNo', '>=', filters.grnNo));
      constraints.push(where('rollNo', '<=', filters.grnNo + '\uf8ff'));
      hasRange = true;
    } else if (filters.startDate || filters.endDate) {
      if (filters.startDate) constraints.push(where('receivedDate', '>=', filters.startDate));
      if (filters.endDate) constraints.push(where('receivedDate', '<=', filters.endDate));
      hasRange = true;
    }

    if (isCount) return query(q, ...constraints);

    // If we have a range filter, we MUST order by that field first in Firestore
    if (hasRange) {
      if (filters.lotNo) constraints.push(orderBy('lotNo', 'asc'));
      else if (filters.grnNo) constraints.push(orderBy('rollNo', 'asc'));
      else if (filters.startDate || filters.endDate) constraints.push(orderBy('receivedDate', sortOrder));
    } else {
      constraints.push(orderBy(sortField, sortOrder));
    }

    const cursor = pageStack[currentPage - 1];
    if (cursor) constraints.push(startAfter(cursor));
    constraints.push(limit(pageSize));

    return query(q, ...constraints);
  };

  useEffect(() => {
    if (!firestore || !isMounted) return;
    const load = async () => {
      setIsPageLoading(true);
      setIndexErrorUrl(null);
      setPagedJumbos([]); // Clear table immediately on filter change

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
          if (snap.docs.length > 0) {
            const last = snap.docs[snap.docs.length - 1];
            setPageStack(prev => {
              const next = [...prev];
              next[currentPage] = last;
              return next;
            });
          }
        }
      } catch (e: any) {
        setPagedJumbos([]);
        if (e.message?.includes("index") || e.code === 'failed-precondition') {
          const match = e.message.match(/https:\/\/console\.firebase\.google\.com[^\s]*/);
          if (match) setIndexErrorUrl(match[0]);
          else console.error("Missing Index Error:", e.message);
        } else {
          console.error("Query Error:", e);
        }
      } finally {
        setIsPageLoading(false);
      }
    };
    load();
  }, [firestore, isMounted, filters, sortField, sortOrder, pageSize, currentPage, refreshTrigger]);

  const handleFilterChange = (field: keyof FilterState, value: any) => {
    setFilters(prev => ({ ...prev, [field]: value }));
    setCurrentPage(1);
    setPageStack([null]);
  };

  const toggleMultiSelect = (field: keyof FilterState, value: string) => {
    const current = (filters[field] as string[]) || [];
    const next = current.includes(value) ? current.filter(v => v !== value) : [...current, value];
    handleFilterChange(field, next);
  };

  const resetFilters = () => {
    setFilters(INITIAL_FILTERS);
    setCurrentPage(1);
    setPageStack([null]);
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await exportPaperStockToExcel(firestore!, filters as any);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Export Failed", description: e.message });
    } finally {
      setIsExporting(false);
    }
  };

  const handleSingleDelete = async (item: any, type: string) => {
    if (!firestore || !isAdmin) return;
    const collName = (type === 'paper_stock' || type === 'jumbo_stock') ? 'jumbo_stock' : type;
    if (confirm(`Permanently delete this record?`)) {
      setIsDeleting(true);
      try {
        await deleteDoc(doc(firestore, collName, item.id));
        toast({ title: "Record Deleted" });
        setRefreshTrigger(p => p + 1);
      } catch (e: any) {
        toast({ variant: "destructive", title: "Delete Failed", description: e.message });
      } finally {
        setIsDeleting(false);
      }
    }
  };

  const handleBulkDelete = async () => {
    if (!isAdmin || !firestore || selectedStockIds.size === 0) return;
    if (!confirm(`Delete ${selectedStockIds.size} rolls?`)) return;
    setIsDeleting(true);
    try {
      const ids = Array.from(selectedStockIds);
      for (let i = 0; i < ids.length; i += 500) {
        const batch = writeBatch(firestore);
        ids.slice(i, i + 500).forEach(id => batch.delete(doc(firestore, 'jumbo_stock', id)));
        await batch.commit();
      }
      setSelectedStockIds(new Set());
      setRefreshTrigger(p => p + 1);
      toast({ title: "Bulk Delete Successful" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Bulk Delete Failed", description: e.message });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExcelImport = async () => {
    if (!firestore || !user || !excelData.length) return;
    const rollNoMapping = Object.keys(columnMapping).find(k => columnMapping[k] === 'rollNo');
    if (!rollNoMapping) {
      toast({ variant: "destructive", title: "Mapping Error", description: "You must map 'Roll No' to continue." });
      return;
    }
    setImportStep(3);
    setUploadProgress(0);
    const existingSnap = await getDocs(collection(firestore, 'jumbo_stock'));
    const existingRolls = new Set(existingSnap.docs.map(d => d.data().rollNo));
    let imported = 0;
    let skipped = 0;
    for (let i = 0; i < excelData.length; i += 500) {
      const batch = writeBatch(firestore);
      const chunk = excelData.slice(i, i + 500);
      chunk.forEach((row: any) => {
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
        const w = Number(data.widthMm) || 0;
        const l = Number(data.lengthMeters) || 0;
        data.sqm = Number(((w * l) / 1000).toFixed(2));
        batch.set(doc(collection(firestore, 'jumbo_stock')), data);
        imported++;
      });
      await batch.commit();
      setUploadProgress(Math.round(((i + chunk.length) / excelData.length) * 100));
    }
    setImportSummary({ total: excelData.length, imported, skipped });
    setRefreshTrigger(prev => prev + 1);
    setImportStep(4);
  };

  const handleOpenEdit = (item: any, type: string) => {
    setEditingItem(item);
    setDialogType(type);
    if (type === 'paper_stock') {
      setIntakeForm({ widthMm: item.widthMm || 0, lengthMeters: item.lengthMeters || 0 });
    }
    setIsDialogOpen(true);
  }

  if (!isMounted) return <div className="flex h-[70vh] items-center justify-center"><Loader2 className="animate-spin" /></div>;

  const startIdx = totalRecords === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endIdx = Math.min(currentPage * pageSize, totalRecords);

  return (
    <div className="space-y-6" suppressHydrationWarning>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary uppercase">Master Control Panel</h2>
          <p className="text-muted-foreground font-medium">Enterprise technical constants and inventory.</p>
        </div>
      </div>

      <Tabs defaultValue="raw_materials" className="w-full">
        <TabsList className="bg-muted/50 p-1 mb-6 flex overflow-x-auto h-auto whitespace-nowrap rounded-xl">
          <TabsTrigger value="raw_materials" className="gap-2 font-bold px-6">Raw Materials</TabsTrigger>
          <TabsTrigger value="paper_stock" className="gap-2 font-bold px-6">Paper Stock</TabsTrigger>
          <TabsTrigger value="boms" className="gap-2 font-bold px-6">BOM Master</TabsTrigger>
          <TabsTrigger value="suppliers" className="gap-2 font-bold px-6">Suppliers</TabsTrigger>
          <TabsTrigger value="machines" className="gap-2 font-bold px-6">Machines</TabsTrigger>
          <TabsTrigger value="cylinders" className="gap-2 font-bold px-6">Cylinders</TabsTrigger>
          <TabsTrigger value="customers" className="gap-2 font-bold px-6">Clients</TabsTrigger>
        </TabsList>
        
        <TabsContent value="paper_stock">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)} className={cn(showFilters && "border-primary text-primary")}><Settings2 className="h-4 w-4 mr-2" /> Filters</Button>
                {activeFiltersCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={resetFilters} className="text-destructive font-black text-[10px] uppercase"><FilterX className="h-4 w-4 mr-2" /> Reset All</Button>
                )}
              </div>
              <div className="flex gap-2">
                {isAdmin && (
                  <>
                    <Button variant="outline" size="sm" onClick={() => {
                      const ws = XLSX.utils.json_to_sheet([], { header: TEMPLATE_HEADERS });
                      const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Template");
                      XLSX.writeFile(wb, "paper_stock_template.xlsx");
                    }}><Download className="h-4 w-4 mr-2" /> Template</Button>
                    <Button variant="outline" size="sm" onClick={() => { setImportStep(1); setIsImportDialogOpen(true); }} className="border-primary text-primary font-bold"><FileUp className="h-4 w-4 mr-2" /> Upload Excel</Button>
                  </>
                )}
                <Button variant="outline" size="sm" onClick={handleExport} disabled={isExporting}>{isExporting ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <FileDown className="h-4 w-4 mr-2" />} Export All</Button>
              </div>
            </div>

            {showFilters && (
              <Card className="bg-muted/30 border-dashed border-2 animate-in slide-in-from-top-2">
                <CardContent className="p-6 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="space-y-1"><Label className="text-[10px] uppercase font-black">Lot Search</Label><Input value={filters.lotNo} onChange={e => handleFilterChange('lotNo', e.target.value)} className="h-9 text-xs bg-background" /></div>
                    <div className="space-y-1"><Label className="text-[10px] uppercase font-black">GRN Search</Label><Input value={filters.grnNo} onChange={e => handleFilterChange('grnNo', e.target.value)} className="h-9 text-xs bg-background" /></div>
                    <div className="md:col-span-2 space-y-1">
                      <Label className="text-[10px] uppercase font-black">Date Range</Label>
                      <div className="flex gap-2"><Input type="date" value={filters.startDate} onChange={e => handleFilterChange('startDate', e.target.value)} className="h-9 text-xs bg-background" /><Input type="date" value={filters.endDate} onChange={e => handleFilterChange('endDate', e.target.value)} className="h-9 text-xs bg-background" /></div>
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
                      <div key={g.label} className="space-y-1">
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
                </CardContent>
              </Card>
            )}

            <Card className="border-none shadow-xl overflow-hidden relative">
              <div className="p-4 bg-muted/10 border-b flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <Select value={pageSize.toString()} onValueChange={v => { setPageSize(Number(v)); setCurrentPage(1); setPageStack([null]); }}>
                    <SelectTrigger className="w-[100px] h-8 text-[10px] font-black"><SelectValue /></SelectTrigger>
                    <SelectContent>{[10, 20, 50, 100].map(v => <SelectItem key={v} value={v.toString()}>{v} Rows</SelectItem>)}</SelectContent>
                  </Select>
                  <span className="text-[10px] font-black uppercase text-muted-foreground">Showing {startIdx}-{endIdx} of {totalRecords.toLocaleString()}</span>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="h-8 w-8 p-0"><ChevronLeft className="h-4 w-4" /></Button>
                  <Badge variant="secondary" className="h-8 px-3 text-[10px] font-black">PAGE {currentPage}</Badge>
                  <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => p + 1)} disabled={endIdx >= totalRecords} className="h-8 w-8 p-0"><ChevronRight className="h-4 w-4" /></Button>
                </div>
              </div>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table className="min-w-[2500px]">
                    <TableHeader className="bg-muted/30">
                      <TableRow>
                        <TableHead className="w-[50px] sticky left-0 bg-muted/30 z-20"><Checkbox checked={selectedStockIds.size === pagedJumbos.length && pagedJumbos.length > 0} onCheckedChange={(checked) => checked ? setSelectedStockIds(new Set(pagedJumbos.map(j => j.id))) : setSelectedStockIds(new Set())} /></TableHead>
                        <TableHead className="w-[60px] text-center font-black text-[10px] uppercase sticky left-[50px] bg-muted/30 z-20 border-r">S/N</TableHead>
                        {[
                          { label: 'RELL NO', field: 'rollNo' },
                          { label: 'PAPER COMPANY', field: 'paperCompany' },
                          { label: 'PAPER TYPE', field: 'paperType' },
                          { label: 'WIDTH (MM)', field: 'widthMm' },
                          { label: 'LENGTH (MTR)', field: 'lengthMeters' },
                          { label: 'SQM', field: 'sqm' },
                          { label: 'GSM', field: 'gsm' },
                          { label: 'WEIGHT (KG)', field: 'weightKg' },
                          { label: 'RATE', field: 'purchaseRate' },
                          { label: 'WASTAGE', field: 'wastage' },
                          { label: 'DATE RECEIVED', field: 'receivedDate' },
                          { label: 'LOT NO', field: 'lotNo' }
                        ].map(col => (
                          <TableHead key={col.field} className="text-[10px] font-black uppercase">
                            <Button variant="ghost" onClick={() => {
                              const isAsc = sortField === col.field && sortOrder === 'asc';
                              setSortField(col.field as any);
                              setSortOrder(isAsc ? 'desc' : 'asc');
                            }} className="h-7 p-0 hover:bg-transparent font-black">
                              {col.label} <ArrowUpDown className="ml-1 h-3 w-3" />
                            </Button>
                          </TableHead>
                        ))}
                        <TableHead className="text-right sticky right-0 bg-muted/30 z-20 font-black text-[10px]">ACTION</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isPageLoading ? (
                        <TableRow>
                          <TableCell colSpan={20} className="text-center py-20"><Loader2 className="animate-spin mx-auto text-primary" /></TableCell>
                        </TableRow>
                      ) : indexErrorUrl ? (
                        <TableRow>
                          <TableCell colSpan={20} className="py-20">
                            <div className="flex flex-col items-center gap-4 text-center max-w-2xl mx-auto">
                              <AlertTriangle className="h-12 w-12 text-amber-500" />
                              <div className="space-y-2">
                                <p className="font-bold text-lg">Registry Index Required</p>
                                <p className="text-sm text-muted-foreground">This filter combination requires a database index. Please authorize it in the Firebase Console.</p>
                              </div>
                              <div className="flex flex-col gap-3 w-full max-w-md">
                                <Button asChild className="bg-amber-600 hover:bg-amber-700 h-12">
                                  <a href={indexErrorUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="mr-2 h-4 w-4" /> Authorize Registry Index</a>
                                </Button>
                                <div className="p-3 bg-muted rounded-md border border-dashed text-left">
                                  <p className="text-[10px] font-black uppercase text-muted-foreground mb-1">Manual Link (if button fails):</p>
                                  <p className="text-[10px] break-all font-mono text-primary select-all">{indexErrorUrl}</p>
                                </div>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : pagedJumbos.map((j, idx) => (
                        <TableRow key={j.id} className="hover:bg-primary/5 h-12">
                          <TableCell className="sticky left-0 bg-background z-10">
                            <Checkbox checked={selectedStockIds.has(j.id)} onCheckedChange={(checked) => { 
                              const next = new Set(selectedStockIds); 
                              if (checked) next.add(j.id); else next.delete(j.id); 
                              setSelectedStockIds(next); 
                            }} />
                          </TableCell>
                          <TableCell className="text-center font-bold text-[10px] text-muted-foreground sticky left-[50px] bg-background z-10 border-r">{(currentPage-1)*pageSize+idx+1}</TableCell>
                          <TableCell className="font-black text-primary font-mono text-xs">{j.rollNo}</TableCell>
                          <TableCell className="text-[11px] font-bold">{j.paperCompany}</TableCell>
                          <TableCell className="text-[11px]">{j.paperType}</TableCell>
                          <TableCell className="text-[11px] font-mono">{j.widthMm}mm</TableCell>
                          <TableCell className="text-[11px] font-mono">{j.lengthMeters}m</TableCell>
                          <TableCell className="text-[11px] font-black text-primary">{j.sqm}</TableCell>
                          <TableCell className="text-[11px]">{j.gsm}</TableCell>
                          <TableCell className="text-[11px] font-bold">{j.weightKg}kg</TableCell>
                          <TableCell className="text-[11px] text-emerald-700 font-bold">₹{j.purchaseRate?.toLocaleString()}</TableCell>
                          <TableCell className="text-[11px]">{j.wastage}%</TableCell>
                          <TableCell className="text-[10px] font-bold">{j.receivedDate}</TableCell>
                          <TableCell className="text-[11px] font-mono font-bold text-accent">{j.lotNo}</TableCell>
                          <TableCell className="text-right sticky right-0 bg-background z-10 border-l">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => handleOpenEdit(j, 'paper_stock')}><Pencil className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="icon" className="text-destructive h-8 w-8" onClick={() => handleSingleDelete(j, 'paper_stock')} disabled={isDeleting}><Trash2 className="h-4 w-4" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {pagedJumbos.length === 0 && !isPageLoading && !indexErrorUrl && (
                        <TableRow><TableCell colSpan={20} className="text-center py-20 text-muted-foreground italic">No matching records found.</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {selectedStockIds.size > 0 && (
              <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4">
                <Card className="bg-zinc-900 text-white border-none shadow-2xl px-6 py-3 flex items-center gap-6">
                  <div className="flex flex-col">
                    <span className="text-xs font-black uppercase text-zinc-500 tracking-widest">Bulk Registry</span>
                    <span className="text-lg font-black text-primary leading-tight">{selectedStockIds.size} selected</span>
                  </div>
                  <div className="h-10 w-px bg-zinc-800" />
                  <div className="flex items-center gap-3">
                    <Button variant="destructive" className="h-10 font-bold" onClick={handleBulkDelete} disabled={isDeleting}>
                      {isDeleting ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                      Delete Permanent
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setSelectedStockIds(new Set())} className="text-zinc-400 hover:text-white hover:bg-zinc-800">
                      <X className="h-5 w-5" />
                    </Button>
                  </div>
                </Card>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="raw_materials">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div><CardTitle>Raw Material Catalog</CardTitle><CardDescription>Unit costs for inks and substrates.</CardDescription></div>
              <Button onClick={() => { setDialogType("raw_materials"); setEditingItem(null); setIsDialogOpen(true); }}><Plus className="mr-2 h-4 w-4" /> Add Material</Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Material Name</TableHead><TableHead>Unit</TableHead><TableHead>Rate (₹)</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {rawMaterials?.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-bold">{m.name}</TableCell>
                      <TableCell>{m.unit}</TableCell>
                      <TableCell>₹{m.rate_per_unit}</TableCell>
                      <TableCell className="text-right flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => { setEditingItem(m); setDialogType("raw_materials"); setIsDialogOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleSingleDelete(m, "raw_materials")} disabled={isDeleting}><Trash2 className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="suppliers">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div><CardTitle>Vendor Directory</CardTitle><CardDescription>Manage suppliers.</CardDescription></div>
              <Button onClick={() => { setDialogType("suppliers"); setEditingItem(null); setIsDialogOpen(true); }}><Plus className="mr-2 h-4 w-4" /> Add Supplier</Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Supplier Name</TableHead><TableHead>Category</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {suppliers?.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-bold">{s.name}</TableCell>
                      <TableCell>{s.unit || 'Substrates'}</TableCell>
                      <TableCell className="text-right flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => { setEditingItem(s); setDialogType("suppliers"); setIsDialogOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleSingleDelete(s, "suppliers")} disabled={isDeleting}><Trash2 className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="machines">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div><CardTitle>Production Lines</CardTitle><CardDescription>Manage machines.</CardDescription></div>
              <Button onClick={() => { setDialogType("machines"); setEditingItem(null); setIsDialogOpen(true); }}><Plus className="mr-2 h-4 w-4" /> Add Machine</Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Machine Name</TableHead><TableHead>Max Width</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {machines?.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-bold">{m.name}</TableCell>
                      <TableCell>{m.unit || '250mm'}</TableCell>
                      <TableCell className="text-right flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => { setEditingItem(m); setDialogType("machines"); setIsDialogOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleSingleDelete(m, "machines")} disabled={isDeleting}><Trash2 className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cylinders">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div><CardTitle>Cylinder Library</CardTitle><CardDescription>Plate cylinders.</CardDescription></div>
              <Button onClick={() => { setDialogType("cylinders"); setEditingItem(null); setIsDialogOpen(true); }}><Plus className="mr-2 h-4 w-4" /> Add Cylinder</Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Tool ID</TableHead><TableHead>Repeat Length</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {cylinders?.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-bold">{c.name}</TableCell>
                      <TableCell>{c.unit || '508mm'}</TableCell>
                      <TableCell className="text-right flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => { setEditingItem(c); setDialogType("cylinders"); setIsDialogOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleSingleDelete(c, "cylinders")} disabled={isDeleting}><Trash2 className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="customers">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div><CardTitle>Client Registry</CardTitle><CardDescription>Manage customer profiles.</CardDescription></div>
              <Button onClick={() => { setDialogType("customers"); setEditingItem(null); setIsDialogOpen(true); }}><Plus className="mr-2 h-4 w-4" /> Add Client</Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Company Name</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {customers?.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-bold">{c.name || c.companyName}</TableCell>
                      <TableCell><Badge variant="outline">{c.status || 'Active'}</Badge></TableCell>
                      <TableCell className="text-right flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => { setEditingItem(c); setDialogType("customers"); setIsDialogOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleSingleDelete(c, "customers")} disabled={isDeleting}><Trash2 className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="boms">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div><CardTitle>BOM Master Templates</CardTitle><CardDescription>Technical Bill-of-Materials templates.</CardDescription></div>
              <Button onClick={() => { setDialogType("boms"); setEditingItem(null); setIsDialogOpen(true); }}><Plus className="mr-2 h-4 w-4" /> Add Template</Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Template Name</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {boms?.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="font-bold">{b.name || b.bomNumber}</TableCell>
                      <TableCell className="text-xs truncate max-w-[200px]">{b.unit || b.description}</TableCell>
                      <TableCell className="text-right flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => { setEditingItem(b); setDialogType("boms"); setIsDialogOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleSingleDelete(b, "boms")} disabled={isDeleting}><Trash2 className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {importStep === 3 ? <Loader2 className="animate-spin" /> : <FileUp />}
              {importStep === 1 ? "Select Excel File" : importStep === 2 ? "Verify Column Mapping" : importStep === 3 ? "Importing Data..." : "Import Summary"}
            </DialogTitle>
          </DialogHeader>
          {importStep === 1 && (
            <div className="py-10 text-center border-2 border-dashed rounded-xl space-y-4">
              <input type="file" accept=".xlsx,.xls" onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (evt) => {
                  const ab = evt.target?.result as ArrayBuffer;
                  const wb = XLSX.read(ab, { type: 'array' });
                  const ws = wb.Sheets[wb.SheetNames[0]];
                  const data = XLSX.utils.sheet_to_json(ws);
                  const headers = XLSX.utils.sheet_to_json(ws, { header: 1 })[0] as string[];
                  setExcelData(data);
                  setExcelHeaders(headers);
                  setImportStep(2);
                };
                reader.readAsArrayBuffer(file);
              }} className="hidden" id="excel-upload" />
              <Label htmlFor="excel-upload" className="cursor-pointer flex flex-col items-center">
                <FileUp className="h-12 w-12 text-muted-foreground opacity-20 mb-2" />
                <span className="font-bold text-primary underline">Browse Excel Files</span>
              </Label>
            </div>
          )}
          {importStep === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 bg-muted/30 p-2 rounded text-[10px] font-black uppercase">
                <span>Excel Column</span><span>System Field</span>
              </div>
              <div className="max-h-60 overflow-y-auto space-y-2">
                {excelHeaders.map(header => (
                  <div key={header} className="grid grid-cols-2 gap-4 items-center border-b pb-2">
                    <span className="text-xs font-bold truncate">{header}</span>
                    <Select value={columnMapping[header] || ""} onValueChange={v => setColumnMapping(p => ({...p, [header]: v}))}>
                      <SelectTrigger className="h-8 text-[10px]"><SelectValue placeholder="Map to..." /></SelectTrigger>
                      <SelectContent>{SYSTEM_FIELDS.map(sf => <SelectItem key={sf.value} value={sf.value}>{sf.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
              <Button onClick={handleExcelImport} className="w-full h-12 font-black uppercase tracking-widest"><Sparkles className="mr-2 h-4 w-4" /> Execute Import</Button>
            </div>
          )}
          {importStep === 3 && (
            <div className="py-10 space-y-6">
              <div className="flex justify-between text-xs font-black uppercase"><span>Processing Chunks...</span><span>{uploadProgress}%</span></div>
              <Progress value={uploadProgress} className="h-3" />
            </div>
          )}
          {importStep === 4 && importSummary && (
            <div className="py-6 space-y-6">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="p-4 bg-primary/5 rounded-lg"><p className="text-[10px] font-black uppercase">Found</p><p className="text-2xl font-black">{importSummary.total}</p></div>
                <div className="p-4 bg-emerald-50 rounded-lg text-emerald-700"><p className="text-[10px] font-black uppercase">New</p><p className="text-2xl font-black">{importSummary.imported}</p></div>
                <div className="p-4 bg-amber-50 rounded-lg text-amber-700"><p className="text-[10px] font-black uppercase">Exists</p><p className="text-2xl font-black">{importSummary.skipped}</p></div>
              </div>
              <Button onClick={() => setIsImportDialogOpen(false)} className="w-full">Close</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className={cn("sm:max-w-[500px]", (dialogType === 'paper_stock' || dialogType === 'jumbo_stock') && "sm:max-w-[800px]")}>
          <form onSubmit={async (e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            const data: any = Object.fromEntries(formData.entries());
            const collName = (dialogType === 'paper_stock' || dialogType === 'jumbo_stock') ? 'jumbo_stock' : dialogType;
            if (collName === 'jumbo_stock') {
              data.widthMm = Number(data.widthMm); data.lengthMeters = Number(data.lengthMeters); data.gsm = Number(data.gsm);
              data.sqm = Number(((data.widthMm * data.lengthMeters) / 1000).toFixed(2));
            } else if (data.rate_per_unit) {
              data.rate_per_unit = Number(data.rate_per_unit);
            }
            if (editingItem) updateDocumentNonBlocking(doc(firestore!, collName, editingItem.id), data);
            else addDocumentNonBlocking(collection(firestore!, collName), { ...data, createdAt: serverTimestamp() });
            setRefreshTrigger(p => p + 1);
            setIsDialogOpen(false);
          }}>
            <DialogHeader><DialogTitle className="flex items-center gap-2"><Info className="h-5 w-5 text-primary" />{editingItem ? 'Edit' : 'Create'} {dialogType.replace('_', ' ')}</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
              {dialogType === 'paper_stock' || dialogType === 'jumbo_stock' ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Company</Label><Input name="paperCompany" defaultValue={editingItem?.paperCompany} required /></div>
                    <div className="space-y-2"><Label>Type</Label><Input name="paperType" defaultValue={editingItem?.paperType} required /></div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2"><Label>Width (mm)</Label><Input name="widthMm" type="number" step="0.01" defaultValue={editingItem?.widthMm} required onChange={e => setIntakeForm(p => ({...p, widthMm: Number(e.target.value)}))} /></div>
                    <div className="space-y-2"><Label>Length (m)</Label><Input name="lengthMeters" type="number" step="0.01" defaultValue={editingItem?.lengthMeters} required onChange={e => setIntakeForm(p => ({...p, lengthMeters: Number(e.target.value)}))} /></div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1">SQM (Auto) <Badge variant="outline" className="text-[8px] h-4">READ-ONLY</Badge></Label>
                      <Input value={liveSqm} readOnly className="bg-muted font-mono font-bold" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Supplier</Label><Input name="supplier" defaultValue={editingItem?.supplier} /></div>
                    <div className="space-y-2"><Label>Location</Label><Input name="location" defaultValue={editingItem?.location} /></div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="space-y-2"><Label>Name</Label><Input name="name" defaultValue={editingItem?.name || editingItem?.companyName} required /></div>
                  <div className="space-y-2"><Label>Unit/Specs</Label><Input name="unit" defaultValue={editingItem?.unit || editingItem?.description} /></div>
                  <div className="space-y-2"><Label>Rate</Label><Input name="rate_per_unit" type="number" defaultValue={editingItem?.rate_per_unit} /></div>
                </>
              )}
            </div>
            <DialogFooter><Button type="submit" className="w-full h-12 uppercase font-black">Save Master Record</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
