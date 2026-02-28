
"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Checkbox } from "@/components/ui/checkbox"
import { 
  Plus, 
  Loader2, 
  Search, 
  ArrowUpDown, 
  FilterX, 
  Hash, 
  Calendar,
  Filter,
  FileDown,
  ChevronLeft,
  ChevronRight,
  Trash2,
  X,
  Settings2,
  CheckCircle2,
  AlertCircle
} from "lucide-react"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter
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
  setDoc,
  getDoc,
  runTransaction
} from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
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
  width: string;
  length: string;
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
  width: "",
  length: "",
  startDate: "",
  endDate: ""
};

export default function GRNPage() {
  const { toast } = useToast()
  const { user } = useUser()
  const firestore = useFirestore()
  const [isMounted, setIsMounted] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isManualId, setIsManualId] = useState(false)
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

  // Sort & Filter State
  const [sortField, setSortField] = useState<SortField>('receivedDate')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS)

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

  // Auth & Settings
  const adminDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'adminUsers', user.uid);
  }, [firestore, user]);
  const { data: adminData } = useDoc(adminDocRef);
  const isAdmin = !!adminData;

  const settingsRef = useMemoFirebase(() => (!firestore ? null : doc(firestore, 'roll_settings', 'global_config')), [firestore]);
  const { data: settings } = useDoc(settingsRef);

  // Fetch unique values for filter options
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

  // Dynamic Query Builder
  const buildQuery = (isCount = false) => {
    if (!firestore) return null;
    let q = collection(firestore, 'jumbo_stock');
    let constraints: any[] = [];

    // Multi-selects (using 'in' operator)
    if (filters.companies.length > 0) constraints.push(where('paperCompany', 'in', filters.companies.slice(0, 10)));
    if (filters.types.length > 0) constraints.push(where('paperType', 'in', filters.types.slice(0, 10)));
    if (filters.gsms.length > 0) constraints.push(where('gsm', 'in', filters.gsms.slice(0, 10).map(Number)));
    if (filters.suppliers.length > 0) constraints.push(where('supplier', 'in', filters.suppliers.slice(0, 10)));
    if (filters.locations.length > 0) constraints.push(where('location', 'in', filters.locations.slice(0, 10)));
    if (filters.statuses.length > 0) constraints.push(where('status', 'in', filters.statuses.slice(0, 10)));

    // Equality filters
    if (filters.width) constraints.push(where('widthMm', '==', Number(filters.width)));
    if (filters.length) constraints.push(where('lengthMeters', '==', Number(filters.length)));

    // Range constraints (Only one field allowed per query in Firestore)
    // Priority: Date Range > Lot No > GRN No
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

    // Sorting & Pagination
    constraints.push(orderBy(sortField, sortOrder));
    const cursor = pageStack[currentPage - 1];
    if (cursor) constraints.push(startAfter(cursor));
    if (pageSize !== 0) constraints.push(limit(pageSize));

    return query(q, ...constraints);
  }

  // Effect for Count & Data
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
      } catch (e: any) {
        console.error(e);
        toast({ variant: "destructive", title: "Query Error", description: "This combination might require a composite index or is too complex." });
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
    const next = current.includes(value) 
      ? current.filter(v => v !== value) 
      : [...current, value];
    
    if (next.length > 10) {
      toast({ variant: "destructive", title: "Limit Reached", description: "Maximum 10 values per filter." });
      return;
    }
    handleFilterChange(field, next);
  }

  const handleExport = async () => {
    if (!firestore) return;
    setIsExporting(true);
    try {
      await exportPaperStockToExcel(firestore, filters as any);
      toast({ title: "Export Started", description: "Your custom filtered report is being generated." });
    } finally {
      setIsExporting(false);
    }
  }

  const handleSingleDelete = async (roll: any) => {
    if (!isAdmin || !firestore) return;
    if (confirm(`Delete Roll ID ${roll.rollNo}?`)) {
      setIsDeleting(true);
      try {
        await deleteDoc(doc(firestore, 'jumbo_stock', roll.id));
        toast({ title: "Roll Removed" });
        setTotalRecords(prev => prev - 1);
      } finally { setIsDeleting(false); }
    }
  }

  // --- RENDER HELPERS ---
  const activeFiltersCount = Object.entries(filters).reduce((acc, [k, v]) => {
    if (Array.isArray(v)) return acc + v.length;
    return v ? acc + 1 : acc;
  }, 0);

  if (!isMounted) return null;

  const startIdx = totalRecords === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endIdx = Math.min(currentPage * pageSize, totalRecords);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black tracking-tight text-primary uppercase">Registry Center</h2>
          <p className="text-muted-foreground font-medium italic">High-precision technical stock management & multi-field analysis.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowFilters(!showFilters)} className={cn(activeFiltersCount > 0 && "border-primary text-primary")}>
            <Settings2 className="mr-2 h-4 w-4" /> Filters {activeFiltersCount > 0 && `(${activeFiltersCount})`}
          </Button>
          <Button variant="outline" onClick={handleExport} disabled={isExporting}>
            {isExporting ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <FileDown className="mr-2 h-4 w-4" />} Export
          </Button>
          <Button onClick={() => setIsDialogOpen(true)} className="shadow-lg font-bold uppercase tracking-widest"><Plus className="mr-2 h-4 w-4" /> New Entry</Button>
        </div>
      </div>

      {/* --- ADVANCED FILTER PANEL --- */}
      {showFilters && (
        <Card className="border-primary/20 bg-primary/5 animate-in slide-in-from-top-2">
          <CardContent className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase flex items-center gap-1"><Search className="h-3 w-3" /> Lot / Batch Search</Label>
                <Input placeholder="Prefix search..." value={filters.lotNo} onChange={(e) => handleFilterChange('lotNo', e.target.value)} className="bg-background h-9 text-xs" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase flex items-center gap-1"><Hash className="h-3 w-3" /> GRN Number</Label>
                <Input placeholder="Prefix search..." value={filters.grnNo} onChange={(e) => handleFilterChange('grnNo', e.target.value)} className="bg-background h-9 text-xs" />
              </div>
              <div className="md:col-span-2 space-y-2">
                <Label className="text-[10px] font-black uppercase flex items-center gap-1"><Calendar className="h-3 w-3" /> Date Range Picker</Label>
                <div className="flex items-center gap-2">
                  <Input type="date" value={filters.startDate} onChange={(e) => handleFilterChange('startDate', e.target.value)} className="bg-background h-9 text-xs" />
                  <span className="text-muted-foreground text-xs">to</span>
                  <Input type="date" value={filters.endDate} onChange={(e) => handleFilterChange('endDate', e.target.value)} className="bg-background h-9 text-xs" />
                </div>
              </div>
            </div>

            <Separator className="bg-primary/10" />

            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
              {[
                { label: 'Company', field: 'companies', options: options.companies },
                { label: 'Paper Type', field: 'types', options: options.types },
                { label: 'GSM', field: 'gsms', options: options.gsms },
                { label: 'Supplier', field: 'suppliers', options: options.suppliers },
                { label: 'Location', field: 'locations', options: options.locations },
                { label: 'Status', field: 'statuses', options: options.statuses },
              ].map((group) => (
                <div key={group.label} className="space-y-2">
                  <Label className="text-[9px] font-black uppercase text-muted-foreground">{group.label}</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="w-full justify-between h-8 text-[10px] font-bold bg-background">
                        {filters[group.field as keyof FilterState].length === 0 ? 'Any' : `${filters[group.field as keyof FilterState].length} selected`}
                        <ChevronLeft className="h-3 w-3 rotate-270" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-56 p-2 h-64 overflow-y-auto" align="start">
                      <div className="space-y-1">
                        {group.options.map(opt => (
                          <div key={opt} className="flex items-center space-x-2 p-1 hover:bg-muted rounded cursor-pointer" onClick={() => toggleMultiSelect(group.field as keyof FilterState, opt)}>
                            <Checkbox checked={filters[group.field as keyof FilterState].includes(opt)} />
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
                {Object.entries(filters).map(([k, v]) => {
                  if (!v || (Array.isArray(v) && v.length === 0)) return null;
                  return (
                    <Badge key={k} variant="secondary" className="text-[9px] font-black uppercase bg-primary/10 text-primary border-none flex items-center gap-1 pr-1 h-6">
                      {k}: {Array.isArray(v) ? v.length : v}
                      <Button variant="ghost" size="icon" className="h-4 w-4 p-0 hover:bg-transparent" onClick={() => handleFilterChange(k as any, Array.isArray(v) ? [] : "")}>
                        <X className="h-2 w-2" />
                      </Button>
                    </Badge>
                  )
                })}
              </div>
              <Button variant="ghost" size="sm" onClick={() => setFilters(INITIAL_FILTERS)} className="text-[10px] font-black uppercase text-destructive hover:text-destructive">
                <FilterX className="mr-1 h-3 w-3" /> Reset All Filters
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* --- DATA TABLE --- */}
      <Card className="shadow-2xl border-none overflow-hidden">
        <div className="bg-muted/30 p-4 border-b flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Select value={pageSize.toString()} onValueChange={(v) => { setPageSize(Number(v)); setCurrentPage(1); setPageStack([null]); }}>
              <SelectTrigger className="w-[80px] h-8 text-[10px] font-black"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[10, 20, 50, 100].map(v => <SelectItem key={v} value={v.toString()}>{v} Rows</SelectItem>)}
              </SelectContent>
            </Select>
            <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
              Showing <span className="text-primary">{startIdx}-{endIdx}</span> of {totalRecords.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1 || isPageLoading} className="h-8 w-8 p-0"><ChevronLeft className="h-4 w-4" /></Button>
            <Badge variant="secondary" className="h-8 px-3 text-[10px] font-black">PAGE {currentPage}</Badge>
            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => p + 1)} disabled={endIdx >= totalRecords || isPageLoading} className="h-8 w-8 p-0"><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="min-w-[2500px]">
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-[60px] font-black text-[10px] uppercase text-center sticky left-0 bg-muted/50 z-20">S/N</TableHead>
                  {[
                    { label: 'RELL NO', field: 'rollNo' },
                    { label: 'PAPER COMPANY', field: 'paperCompany' },
                    { label: 'PAPER TYPE', field: 'paperType' },
                    { label: 'WIDTH (MM)', field: 'widthMm' },
                    { label: 'LENGTH (MTR)', field: 'lengthMeters' },
                    { label: 'SQM', field: 'sqm' },
                    { label: 'GSM', field: 'gsm' },
                    { label: 'WEIGHT (KG)', field: 'weightKg' },
                    { label: 'PURCHASE RATE', field: 'purchaseRate' },
                    { label: 'WASTAGE', field: 'wastage' },
                    { label: 'DATE OF USE', field: 'dateOfUse' },
                    { label: 'DATE RECEIVED', field: 'receivedDate' },
                    { label: 'JOB NO', field: 'jobNo' },
                    { label: 'SIZE', field: 'size' },
                    { label: 'PRODUCT NAME', field: 'productName' },
                    { label: 'CODE', field: 'code' },
                    { label: 'LOT NO', field: 'lotNo' },
                    { label: 'DATE', field: 'date' },
                    { label: 'COMPANY RELL NO', field: 'companyRollNo' }
                  ].map(col => (
                    <TableHead key={col.field}>
                      <Button variant="ghost" size="sm" onClick={() => {
                        const isAsc = sortField === col.field && sortOrder === 'asc';
                        setSortField(col.field as any);
                        setSortOrder(isAsc ? 'desc' : 'asc');
                      }} className="h-7 text-[10px] font-black uppercase hover:bg-transparent p-0">
                        {col.label} <ArrowUpDown className="ml-1 h-3 w-3" />
                      </Button>
                    </TableHead>
                  ))}
                  {isAdmin && <TableHead className="text-right sticky right-0 bg-muted/50 z-20 font-black text-[10px]">ACTION</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isPageLoading ? (
                  <TableRow><TableCell colSpan={21} className="text-center py-20"><Loader2 className="animate-spin mx-auto text-primary" /></TableCell></TableRow>
                ) : pagedJumbos.map((j, index) => (
                  <TableRow key={j.id} className="hover:bg-primary/5 h-12">
                    <TableCell className="text-center font-bold text-[10px] text-muted-foreground sticky left-0 bg-background z-10 border-r">
                      {(currentPage - 1) * pageSize + index + 1}
                    </TableCell>
                    <TableCell className="font-black text-primary font-mono text-xs">
                      <div className="flex flex-col">
                        <span>{j.rollNo}</span>
                        <Badge variant="outline" className={cn("text-[8px] h-4 mt-0.5", j.status === 'In Stock' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700')}>
                          {j.status?.toUpperCase()}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-[11px] font-bold">{j.paperCompany}</TableCell>
                    <TableCell className="text-[11px] font-medium">{j.paperType}</TableCell>
                    <TableCell className="text-[11px] font-mono">{j.widthMm}mm</TableCell>
                    <TableCell className="text-[11px] font-mono">{j.lengthMeters}m</TableCell>
                    <TableCell className="text-[11px] font-black text-primary">{j.sqm}</TableCell>
                    <TableCell className="text-[11px]">{j.gsm}</TableCell>
                    <TableCell className="text-[11px] font-bold">{j.weightKg}kg</TableCell>
                    <TableCell className="text-[11px] text-emerald-700 font-bold">₹{j.purchaseRate?.toLocaleString()}</TableCell>
                    <TableCell className="text-[11px]">{j.wastage || 0}%</TableCell>
                    <TableCell className="text-[10px] font-medium text-muted-foreground">{j.dateOfUse || '-'}</TableCell>
                    <TableCell className="text-[10px] font-bold">{j.receivedDate}</TableCell>
                    <TableCell className="text-[11px] font-mono text-primary font-black">{j.jobNo || '-'}</TableCell>
                    <TableCell className="text-[11px]">{j.size || '-'}</TableCell>
                    <TableCell className="text-[11px] truncate max-w-[150px]">{j.productName || '-'}</TableCell>
                    <TableCell className="text-[11px] font-mono">{j.code || '-'}</TableCell>
                    <TableCell className="text-[11px] font-mono font-bold text-accent">{j.lotNo}</TableCell>
                    <TableCell className="text-[10px] font-medium text-muted-foreground">{j.date || '-'}</TableCell>
                    <TableCell className="text-[11px] font-mono">{j.companyRollNo || '-'}</TableCell>
                    {isAdmin && (
                      <TableCell className="text-right sticky right-0 bg-background z-10 border-l">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => handleSingleDelete(j)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[900px]">
          <form onSubmit={async (e) => {
            e.preventDefault();
            if (!firestore || !user) return;
            setIsGenerating(true);
            const form = new FormData(e.currentTarget);
            const data = Object.fromEntries(form.entries());
            
            try {
              await runTransaction(firestore, async (transaction) => {
                const counterRef = doc(firestore, 'counters', 'jumbo_roll');
                const snap = await transaction.get(counterRef);
                const nextNum = (snap.exists() ? snap.data().current_number : 1000) + 1;
                const rollNo = isManualId ? (data.manualRollNo as string) : `${settings?.parentPrefix || "TLC-"}${nextNum}`;
                
                const newDocRef = doc(collection(firestore, 'jumbo_stock'));
                transaction.set(newDocRef, {
                  ...data,
                  rollNo,
                  widthMm: Number(data.widthMm),
                  lengthMeters: Number(data.lengthMeters),
                  gsm: Number(data.gsm),
                  sqm: (Number(data.widthMm) * Number(data.lengthMeters)) / 1000,
                  status: 'In Stock',
                  createdAt: serverTimestamp()
                });
                
                if (!isManualId) transaction.update(counterRef, { current_number: nextNum });
              });
              toast({ title: "Roll Added" });
              setIsDialogOpen(false);
            } finally { setIsGenerating(false); }
          }}>
            <DialogHeader><DialogTitle>Technical Intake (19 Columns)</DialogTitle></DialogHeader>
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
            <DialogFooter><Button type="submit" disabled={isGenerating}>{isGenerating ? <Loader2 className="animate-spin" /> : 'Complete GRN'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
