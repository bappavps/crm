
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
import { 
  Plus, 
  Loader2, 
  Search, 
  ArrowUpDown, 
  FilterX, 
  FileDown,
  ChevronLeft,
  ChevronRight,
  Trash2,
  X,
  Settings2,
  AlertTriangle,
  Pencil,
  ExternalLink,
  Info,
  Copy,
  CheckCircle2
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
import { useFirestore, useUser, useMemoFirebase, useDoc } from "@/firebase"
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
  onSnapshot,
  deleteDoc,
  writeBatch,
  serverTimestamp,
  runTransaction
} from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
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

export default function GRNPage() {
  const { toast } = useToast()
  const { user } = useUser()
  const firestore = useFirestore()
  const { hasPermission } = usePermissions()
  const [isMounted, setIsMounted] = useState(false)
  
  // Authorization
  const isAdmin = hasPermission('admin')

  // Dialogs
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingRoll, setEditingRoll] = useState<any>(null)
  
  // Intake Form Logic
  const [intakeForm, setIntakeForm] = useState({ widthMm: 0, lengthMeters: 0 })
  const liveSqm = useMemo(() => {
    const w = intakeForm.widthMm || 0;
    const l = intakeForm.lengthMeters || 0;
    return w > 0 && l > 0 ? ((w / 1000) * l).toFixed(2) : "0.00";
  }, [intakeForm]);

  // Data States
  const [isGenerating, setIsGenerating] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [indexErrorUrl, setIndexErrorUrl] = useState<string | null>(null)
  const [usingFallbackQuery, setUsingFallbackQuery] = useState(false)
  
  // Selection & Pagination
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [pageSize, setPageSize] = useState<number>(20)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalRecords, setTotalRecords] = useState(0)
  const [pageStack, setPageStack] = useState<any[]>([null])
  const [pagedJumbos, setPagedJumbos] = useState<any[]>([])
  const [isPageLoading, setIsPageLoading] = useState(false)

  // Filter & Sort State
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

  const activeFiltersCount = useMemo(() => {
    return Object.entries(filters).reduce((acc, [k, v]) => {
      if (Array.isArray(v)) return acc + v.length;
      return v ? acc + 1 : acc;
    }, 0);
  }, [filters]);

  useEffect(() => { setIsMounted(true) }, [])

  const settingsRef = useMemoFirebase(() => (!firestore ? null : doc(firestore, 'roll_settings', 'global_config')), [firestore]);
  const { data: settings } = useDoc(settingsRef);

  // Sync Options from DB
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

  const buildQuery = (isCount = false, skipSort = false) => {
    if (!firestore) return null;
    let q = collection(firestore, 'jumbo_stock');
    let constraints: any[] = [];
    let rangeField: string | null = null;
    let hasIn = false;

    const addSafeFilter = (field: string, values: any[]) => {
      if (!values || values.length === 0) return;
      if (values.length === 1) {
        constraints.push(where(field, '==', values[0]));
      } else if (!hasIn) {
        constraints.push(where(field, 'in', values.slice(0, 10)));
        hasIn = true;
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
      rangeField = 'lotNo';
    } else if (filters.grnNo) {
      constraints.push(where('rollNo', '>=', filters.grnNo));
      constraints.push(where('rollNo', '<=', filters.grnNo + '\uf8ff'));
      rangeField = 'rollNo';
    } else if (filters.startDate || filters.endDate) {
      if (filters.startDate) constraints.push(where('receivedDate', '>=', filters.startDate));
      if (filters.endDate) constraints.push(where('receivedDate', '<=', filters.endDate));
      rangeField = 'receivedDate';
    }

    if (isCount) return query(q, ...constraints);

    if (!skipSort) {
      if (rangeField) {
        constraints.push(orderBy(rangeField, rangeField === 'receivedDate' ? sortOrder : 'asc'));
      } else {
        constraints.push(orderBy(sortField, sortOrder));
      }
    }

    const cursor = pageStack[currentPage - 1];
    if (cursor) constraints.push(startAfter(cursor));
    constraints.push(limit(pageSize));

    return query(q, ...constraints);
  }

  useEffect(() => {
    if (!firestore || !isMounted) return;
    const load = async () => {
      setIsPageLoading(true);
      setIndexErrorUrl(null);
      setUsingFallbackQuery(false);
      setPagedJumbos([]); 

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
        if (e.message?.includes("index") || e.code === 'failed-precondition') {
          const match = e.message.match(/https:\/\/console\.firebase\.google\.com[^\s]*/);
          setIndexErrorUrl(match ? match[0] : "unknown");
          
          // Fallback logic: Retry without sorting
          setUsingFallbackQuery(true);
          try {
            const fallbackQ = buildQuery(false, true);
            if (fallbackQ) {
              const snap = await getDocs(fallbackQ);
              setPagedJumbos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            }
          } catch (err) {
            setPagedJumbos([]);
          }
        } else {
          setPagedJumbos([]);
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
  }

  const toggleMultiSelect = (field: keyof FilterState, value: string) => {
    const current = (filters[field] as string[]) || [];
    const next = current.includes(value) ? current.filter(v => v !== value) : [...current, value];
    handleFilterChange(field, next);
  }

  const resetFilters = () => {
    setFilters(INITIAL_FILTERS);
    setCurrentPage(1);
    setPageStack([null]);
  }

  const handleExportAll = async () => {
    setIsExporting(true);
    try {
      await exportPaperStockToExcel(firestore!, filters as any);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Export Failed", description: e.message });
    } finally { setIsExporting(false); }
  }

  const handleSingleDelete = async (roll: any) => {
    if (!isAdmin || !firestore) return;
    if (confirm(`Are you sure you want to delete Roll ID ${roll.rollNo}?`)) {
      setIsDeleting(true);
      try {
        await deleteDoc(doc(firestore, 'jumbo_stock', roll.id));
        toast({ title: "Roll Deleted" });
        setRefreshTrigger(prev => prev + 1);
      } catch (e: any) {
        toast({ variant: "destructive", title: "Delete Failed", description: e.message });
      } finally { setIsDeleting(false); }
    }
  }

  const handleBulkDelete = async () => {
    if (!isAdmin || !firestore || selectedIds.size === 0) return;
    if (!confirm(`You are about to delete ${selectedIds.size} rolls. Proceed?`)) return;

    setIsDeleting(true);
    const ids = Array.from(selectedIds);
    try {
      for (let i = 0; i < ids.length; i += 500) {
        const batch = writeBatch(firestore);
        ids.slice(i, i + 500).forEach(id => batch.delete(doc(firestore, 'jumbo_stock', id)));
        await batch.commit();
      }
      toast({ title: "Bulk Delete Successful" });
      setSelectedIds(new Set());
      setRefreshTrigger(prev => prev + 1);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Bulk Delete Failed", description: e.message });
    } finally { setIsDeleting(false); }
  }

  const handleOpenEdit = (roll: any) => {
    setEditingRoll(roll);
    setIntakeForm({ widthMm: roll.widthMm || 0, lengthMeters: roll.lengthMeters || 0 });
    setIsDialogOpen(true);
  }

  const handleCopyIndexUrl = () => {
    if (indexErrorUrl) {
      navigator.clipboard.writeText(indexErrorUrl);
      toast({ title: "Copied to Clipboard", description: "Authorization link is ready." });
    }
  }

  if (!isMounted) return <div className="flex h-[70vh] items-center justify-center"><Loader2 className="animate-spin" /></div>

  const startIdx = totalRecords === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endIdx = Math.min(currentPage * pageSize, totalRecords);

  return (
    <div className="space-y-6" suppressHydrationWarning>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black tracking-tight text-primary uppercase">Substrate Registry (GRN)</h2>
          <p className="text-muted-foreground font-medium italic">High-precision inventory analysis and technical data intake.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowFilters(!showFilters)} className={cn(activeFiltersCount > 0 && "border-primary text-primary")}>
            <Settings2 className="h-4 w-4 mr-2" /> Filters
          </Button>
          <Button variant="outline" onClick={handleExportAll} disabled={isExporting}>
            {isExporting ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <FileDown className="mr-2 h-4 w-4" />} Export
          </Button>
          <Button onClick={() => { setEditingRoll(null); setIntakeForm({ widthMm: 0, lengthMeters: 0 }); setIsDialogOpen(true); }} className="shadow-lg font-bold uppercase tracking-widest"><Plus className="mr-2 h-4 w-4" /> New Intake</Button>
        </div>
      </div>

      {showFilters && (
        <Card className="border-primary/20 bg-primary/5 animate-in slide-in-from-top-2">
          <CardContent className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="space-y-2"><Label className="text-[10px] font-black uppercase">Lot Search</Label><Input placeholder="Prefix..." value={filters.lotNo} onChange={(e) => handleFilterChange('lotNo', e.target.value)} className="bg-background h-9 text-xs" /></div>
              <div className="space-y-2"><Label className="text-[10px] font-black uppercase">GRN Number</Label><Input placeholder="Prefix..." value={filters.grnNo} onChange={(e) => handleFilterChange('grnNo', e.target.value)} className="bg-background h-9 text-xs" /></div>
              <div className="md:col-span-2 space-y-2">
                <Label className="text-[10px] font-black uppercase">Date Range</Label>
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
              {activeFiltersCount > 0 && <Badge variant="secondary" className="bg-primary text-white h-6 font-black uppercase text-[10px]">{activeFiltersCount} ACTIVE FILTERS</Badge>}
              <Button variant="ghost" size="sm" onClick={resetFilters} className="text-[10px] font-black uppercase text-destructive">
                <FilterX className="mr-1 h-3 w-3" /> Reset View
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {usingFallbackQuery && indexErrorUrl && (
        <Card className="bg-amber-50 border-amber-200 border-2">
          <CardContent className="p-4 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-amber-900 text-sm">Index Required for Professional Sorting</p>
                <p className="text-xs text-amber-700">Displaying unordered results. Authorize the database index to enable chronological sorting for this filter combination.</p>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button size="sm" variant="outline" className="h-8 text-[10px] border-amber-300" onClick={handleCopyIndexUrl}>
                <Copy className="h-3 w-3 mr-1" /> Copy Link
              </Button>
              <Button asChild size="sm" className="h-8 text-[10px] bg-amber-600 hover:bg-amber-700">
                <a href={indexErrorUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3 w-3 mr-1" /> Authorize Now
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="shadow-2xl border-none overflow-hidden relative">
        <div className="bg-muted/30 p-4 border-b flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Select value={pageSize.toString()} onValueChange={(v) => { setPageSize(Number(v)); setCurrentPage(1); setPageStack([null]); }}>
              <SelectTrigger className="w-[100px] h-8 text-[10px] font-black"><SelectValue /></SelectTrigger>
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
                  <TableHead className="w-[50px] sticky left-0 bg-muted/50 z-20">
                    <Checkbox checked={selectedIds.size === pagedJumbos.length && pagedJumbos.length > 0} onCheckedChange={(checked) => checked ? setSelectedIds(new Set(pagedJumbos.map(j => j.id))) : setSelectedIds(new Set())} />
                  </TableHead>
                  <TableHead className="w-[60px] font-black text-[10px] uppercase text-center sticky left-[50px] bg-muted/50 z-20 border-r">S/N</TableHead>
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
                    { l: 'DATE RECEIVED', f: 'receivedDate' },
                    { l: 'LOT NO', f: 'lotNo' }
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
                {isPageLoading ? (
                  <TableRow><TableCell colSpan={20} className="text-center py-20"><Loader2 className="animate-spin mx-auto text-primary" /></TableCell></TableRow>
                ) : pagedJumbos.map((j, i) => (
                  <TableRow key={j.id} className="hover:bg-primary/5 h-12">
                    <TableCell className="sticky left-0 bg-background z-10">
                      <Checkbox checked={selectedIds.has(j.id)} onCheckedChange={(checked) => {
                        const next = new Set(selectedIds);
                        if (checked) next.add(j.id); else next.delete(j.id);
                        setSelectedIds(next);
                      }} />
                    </TableCell>
                    <TableCell className="text-center font-bold text-[10px] text-muted-foreground sticky left-[50px] bg-background z-10 border-r">{(currentPage-1)*pageSize+i+1}</TableCell>
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
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => handleOpenEdit(j)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleSingleDelete(j)} disabled={isDeleting}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {pagedJumbos.length === 0 && !isPageLoading && (
                  <TableRow><TableCell colSpan={20} className="text-center py-20 text-muted-foreground italic">No matching records found.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4">
          <Card className="bg-zinc-900 text-white border-none shadow-2xl px-6 py-3 flex items-center gap-6">
            <div className="flex flex-col">
              <span className="text-xs font-black uppercase text-zinc-500 tracking-widest">Selected Inventory</span>
              <span className="text-lg font-black text-primary leading-tight">{selectedIds.size} rolls</span>
            </div>
            <div className="h-10 w-px bg-zinc-800" />
            <div className="flex items-center gap-3">
              <Button variant="destructive" className="h-10 font-bold" onClick={handleBulkDelete} disabled={isDeleting}>
                {isDeleting ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                Delete Permanent
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setSelectedIds(new Set())} className="text-zinc-400 hover:text-white hover:bg-zinc-800">
                <X className="h-5 w-5" />
              </Button>
            </div>
          </Card>
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[900px]">
          <form onSubmit={async (e) => {
            e.preventDefault();
            setIsGenerating(true);
            const form = new FormData(e.currentTarget);
            const data: any = Object.fromEntries(form.entries());
            const width = Number(data.widthMm);
            const length = Number(data.lengthMeters);
            const sqm = Number(((width / 1000) * length).toFixed(2));

            try {
              if (editingRoll) {
                await runTransaction(firestore!, async (tx) => {
                  tx.update(doc(firestore!, 'jumbo_stock', editingRoll.id), {
                    ...data, widthMm: width, lengthMeters: length, sqm, updatedAt: serverTimestamp()
                  });
                });
                toast({ title: "Roll Updated" });
                setRefreshTrigger(p => p + 1);
                setIsDialogOpen(false);
              } else {
                await runTransaction(firestore!, async (tx) => {
                  const countRef = doc(firestore!, 'counters', 'jumbo_roll');
                  const snap = await tx.get(countRef);
                  const nextNum = (snap.exists() ? snap.data().current_number : 1000) + 1;
                  const rollNo = `${settings?.parentPrefix || "TLC-"}${nextNum}`;
                  tx.set(doc(collection(firestore!, 'jumbo_stock')), {
                    ...data, rollNo, widthMm: width, lengthMeters: length, sqm, status: 'In Stock', createdAt: serverTimestamp()
                  });
                  tx.update(countRef, { current_number: nextNum });
                });
                toast({ title: "Roll Added" });
                setRefreshTrigger(p => p + 1);
                setIsDialogOpen(false);
              }
            } finally { setIsGenerating(false); }
          }}>
            <DialogHeader><DialogTitle className="flex items-center gap-2"><Info className="h-5 w-5 text-primary" />{editingRoll ? 'Edit' : 'New'} Technical Intake</DialogTitle></DialogHeader>
            <div className="grid gap-6 py-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2"><Label>Company</Label><Input name="paperCompany" defaultValue={editingRoll?.paperCompany} required /></div>
                <div className="space-y-2"><Label>Type</Label><Input name="paperType" defaultValue={editingRoll?.paperType} required /></div>
                <div className="space-y-2"><Label>Supplier</Label><Input name="supplier" defaultValue={editingRoll?.supplier} /></div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2"><Label>Width (mm)</Label><Input name="widthMm" type="number" step="0.01" defaultValue={editingRoll?.widthMm} required onChange={e => setIntakeForm(p => ({...p, widthMm: Number(e.target.value)}))} /></div>
                <div className="space-y-2"><Label>Length (m)</Label><Input name="lengthMeters" type="number" step="0.01" defaultValue={editingRoll?.lengthMeters} required onChange={e => setIntakeForm(p => ({...p, lengthMeters: Number(e.target.value)}))} /></div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">SQM (Auto) <Badge variant="outline" className="text-[8px] h-4">READ-ONLY</Badge></Label>
                  <Input value={liveSqm} readOnly className="bg-muted font-mono font-bold" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2"><Label>GSM</Label><Input name="gsm" type="number" defaultValue={editingRoll?.gsm} required /></div>
                <div className="space-y-2"><Label>Lot No</Label><Input name="lotNo" defaultValue={editingRoll?.lotNo} required /></div>
                <div className="space-y-2"><Label>Rate</Label><Input name="purchaseRate" type="number" step="0.01" defaultValue={editingRoll?.purchaseRate} required /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Location</Label><Input name="location" defaultValue={editingRoll?.location} /></div>
                <div className="space-y-2">
                  <Label>Date Received</Label>
                  <Input 
                    name="receivedDate" 
                    type="date" 
                    defaultValue={editingRoll?.receivedDate || ""} 
                    required 
                  />
                </div>
              </div>
            </div>
            <DialogFooter><Button type="submit" disabled={isGenerating} className="w-full h-12 uppercase font-black">{isGenerating ? <Loader2 className="animate-spin" /> : 'Confirm Technical Entry'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
