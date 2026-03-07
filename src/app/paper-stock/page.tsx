
"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { 
  Search, 
  Plus, 
  Loader2, 
  FilterX, 
  ArrowUpDown, 
  Settings2,
  FileDown,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Pencil,
  AlertTriangle,
  Info,
  Copy,
  ExternalLink,
  Package
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
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useFirestore, useUser, useMemoFirebase, useCollection, useDoc } from "@/firebase"
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
type SortField = 'rollNo' | 'receivedDate' | 'gsm' | 'widthMm' | 'sqm';
type SortOrder = 'asc' | 'desc';

interface FilterState {
  companies: string[];
  types: string[];
  gsms: string[];
  statuses: string[];
  search: string;
  startDate: string;
  endDate: string;
}

const INITIAL_FILTERS: FilterState = {
  companies: [],
  types: [],
  gsms: [],
  statuses: [],
  search: "",
  startDate: "",
  endDate: ""
};

export default function PaperStockPage() {
  const { toast } = useToast()
  const { user } = useUser()
  const firestore = useFirestore()
  const { hasPermission } = usePermissions()
  const [isMounted, setIsMounted] = useState(false)
  
  // States
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingRoll, setEditingRoll] = useState<any>(null)
  const [intakeForm, setIntakeForm] = useState({ widthMm: 0, lengthMeters: 0, quantity: 1 })
  const [isProcessing, setIsProcessing] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  
  // Pagination & Index
  const [pageSize, setPageSize] = useState<number>(20)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalRecords, setTotalRecords] = useState(0)
  const [pageStack, setPageStack] = useState<any[]>([null])
  const [pagedJumbos, setPagedJumbos] = useState<any[]>([])
  const [isPageLoading, setIsPageLoading] = useState(false)
  const [indexErrorUrl, setIndexErrorUrl] = useState<string | null>(null)
  const [usingFallback, setUsingFallback] = useState(false)

  // Filter & Sort
  const [sortField, setSortField] = useState<SortField>('receivedDate')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS)
  const [options, setOptions] = useState({
    companies: [] as string[],
    types: [] as string[],
    gsms: [] as string[],
    statuses: ['In Stock', 'Consumed', 'Partial', 'Reserved']
  })

  const liveSqm = useMemo(() => {
    const w = intakeForm.widthMm || 0;
    const l = intakeForm.lengthMeters || 0;
    const q = intakeForm.quantity || 1;
    return w > 0 && l > 0 ? ((w / 1000) * l * q).toFixed(2) : "0.00";
  }, [intakeForm]);

  const activeFiltersCount = useMemo(() => {
    return Object.entries(filters).reduce((acc, [k, v]) => {
      if (Array.isArray(v)) return acc + v.length;
      return v && k !== 'search' ? acc + 1 : acc;
    }, 0);
  }, [filters]);

  useEffect(() => { setIsMounted(true) }, [])

  // Sync Filter Options
  useEffect(() => {
    if (!firestore || !isMounted) return;
    const unsub = onSnapshot(collection(firestore, 'jumbo_stock'), (snap) => {
      const docs = snap.docs.map(d => d.data());
      setOptions(prev => ({
        ...prev,
        companies: Array.from(new Set(docs.map(d => d.paperCompany).filter(Boolean))).sort(),
        types: Array.from(new Set(docs.map(d => d.paperType).filter(Boolean))).sort(),
        gsms: Array.from(new Set(docs.map(d => d.gsm?.toString()).filter(Boolean))).sort((a,b) => Number(a)-Number(b)),
      }));
    });
    return () => unsub();
  }, [firestore, isMounted]);

  const buildQuery = (isCount = false, skipSort = false) => {
    if (!firestore) return null;
    let q = collection(firestore, 'jumbo_stock');
    let constraints: any[] = [];
    let rangeField: string | null = null;

    if (filters.companies.length > 0) constraints.push(where('paperCompany', 'in', filters.companies.slice(0, 10)));
    if (filters.types.length > 0) constraints.push(where('paperType', 'in', filters.types.slice(0, 10)));
    if (filters.gsms.length > 0) constraints.push(where('gsm', 'in', filters.gsms.map(Number).slice(0, 10)));
    if (filters.statuses.length > 0) constraints.push(where('status', 'in', filters.statuses.slice(0, 10)));

    if (filters.startDate) constraints.push(where('receivedDate', '>=', filters.startDate));
    if (filters.endDate) constraints.push(where('receivedDate', '<=', filters.endDate));
    if (filters.startDate || filters.endDate) rangeField = 'receivedDate';

    if (isCount) return query(q, ...constraints);

    if (!skipSort) {
      const activeSortField = rangeField || sortField;
      constraints.push(orderBy(activeSortField, activeSortField === 'receivedDate' ? 'desc' : sortOrder));
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
      setUsingFallback(false);
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
          let docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          
          if (filters.search) {
            const s = filters.search.toLowerCase();
            docs = docs.filter(d => 
              (d.rollNo || "").toLowerCase().includes(s) || 
              (d.lotNo || "").toLowerCase().includes(s) || 
              (d.jobNo || "").toLowerCase().includes(s)
            );
          }

          setPagedJumbos(docs);
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
          setUsingFallback(true);
          const fallbackQ = buildQuery(false, true);
          if (fallbackQ) {
            const snap = await getDocs(fallbackQ);
            setPagedJumbos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
          }
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

  const handleDelete = async (roll: any) => {
    if (!firestore || !hasPermission('admin')) return;
    if (confirm(`Delete Roll ID ${roll.rollNo}?`)) {
      await deleteDoc(doc(firestore, 'jumbo_stock', roll.id));
      toast({ title: "Roll Removed" });
      setRefreshTrigger(p => p + 1);
    }
  }

  if (!isMounted) return <div className="flex h-[70vh] items-center justify-center"><Loader2 className="animate-spin" /></div>

  const startIdx = totalRecords === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endIdx = Math.min(currentPage * pageSize, totalRecords);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black tracking-tight text-primary uppercase">Paper Stock Registry</h2>
          <p className="text-muted-foreground font-medium">Enterprise inventory hub with 19 technical columns and precision tracking.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowFilters(!showFilters)} className={cn(activeFiltersCount > 0 && "border-primary text-primary")}>
            <Settings2 className="h-4 w-4 mr-2" /> Filters
          </Button>
          <Button variant="outline" onClick={() => exportPaperStockToExcel(firestore!, filters)}>
            <FileDown className="mr-2 h-4 w-4" /> Export All
          </Button>
          <Button onClick={() => { setEditingRoll(null); setIntakeForm({ widthMm: 0, lengthMeters: 0, quantity: 1 }); setIsDialogOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Add Roll
          </Button>
        </div>
      </div>

      {showFilters && (
        <Card className="border-primary/20 bg-primary/5 animate-in slide-in-from-top-2">
          <CardContent className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase">Search Registry</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Roll ID, Lot, Job..." 
                    value={filters.search} 
                    onChange={(e) => handleFilterChange('search', e.target.value)} 
                    className="bg-background h-9 text-xs pl-8" 
                  />
                </div>
              </div>
              <div className="md:col-span-2 space-y-2">
                <Label className="text-[10px] font-black uppercase">Date Received Range</Label>
                <div className="flex items-center gap-2">
                  <Input type="date" value={filters.startDate} onChange={(e) => handleFilterChange('startDate', e.target.value)} className="bg-background h-9 text-xs" />
                  <Input type="date" value={filters.endDate} onChange={(e) => handleFilterChange('endDate', e.target.value)} className="bg-background h-9 text-xs" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase">Status</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full justify-between h-9 text-xs bg-background">
                      {filters.statuses.length === 0 ? 'All Statuses' : `${filters.statuses.length} selected`}
                      <ChevronRight className="h-3 w-3 rotate-90" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56 p-2">
                    {options.statuses.map(s => (
                      <div key={s} className="flex items-center gap-2 p-1 hover:bg-muted rounded cursor-pointer" onClick={() => toggleMultiSelect('statuses', s)}>
                        <Checkbox checked={filters.statuses.includes(s)} />
                        <span className="text-xs">{s}</span>
                      </div>
                    ))}
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { label: 'Paper Company', field: 'companies', opts: options.companies },
                { label: 'Paper Type', field: 'types', opts: options.types },
                { label: 'GSM', field: 'gsms', opts: options.gsms },
              ].map((g) => (
                <div key={g.field} className="space-y-2">
                  <Label className="text-[9px] font-black uppercase text-muted-foreground">{g.label}</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="w-full justify-between h-9 text-xs bg-background font-bold">
                        {filters[g.field as keyof FilterState].length === 0 ? 'Any' : `${filters[g.field as keyof FilterState].length} selected`}
                        <ChevronRight className="h-3 w-3 rotate-90" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-2 max-h-64 overflow-y-auto">
                      <div className="space-y-1">
                        {g.opts.map(opt => (
                          <div key={opt} className="flex items-center gap-2 p-1.5 hover:bg-muted rounded cursor-pointer" onClick={() => toggleMultiSelect(g.field as keyof FilterState, opt)}>
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

            <div className="flex items-center justify-between border-t pt-4">
              <span className="text-[10px] font-black text-primary uppercase">{activeFiltersCount} Filters Applied</span>
              <Button variant="ghost" size="sm" onClick={resetFilters} className="text-[10px] font-black uppercase text-destructive">
                <FilterX className="mr-1 h-3 w-3" /> Clear All Filters
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {usingFallback && indexErrorUrl && (
        <Card className="bg-amber-50 border-amber-200 border-2">
          <CardContent className="p-4 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-amber-900 text-sm">Sorting Disabled: Index Required</p>
                <p className="text-xs text-amber-700">Database index needed for combined sorting. Results shown in default order.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(indexErrorUrl); toast({ title: "Link Copied" }); }}>
                <Copy className="h-3 w-3 mr-1" /> Copy Link
              </Button>
              <Button asChild size="sm" className="bg-amber-600">
                <a href={indexErrorUrl} target="_blank" rel="noopener noreferrer">Authorize Index</a>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="shadow-2xl border-none overflow-hidden">
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
                  <TableHead className="w-[60px] text-center font-black text-[10px] uppercase border-r sticky left-0 bg-muted/50 z-20">S/N</TableHead>
                  <TableHead className="font-black text-[10px] uppercase">RELL NO</TableHead>
                  <TableHead className="font-black text-[10px] uppercase">PAPER COMPANY</TableHead>
                  <TableHead className="font-black text-[10px] uppercase">PAPER TYPE</TableHead>
                  <TableHead className="font-black text-[10px] uppercase">WIDTH (MM)</TableHead>
                  <TableHead className="font-black text-[10px] uppercase">LENGTH (MTR)</TableHead>
                  <TableHead className="font-black text-[10px] uppercase">SQM</TableHead>
                  <TableHead className="font-black text-[10px] uppercase">GSM</TableHead>
                  <TableHead className="font-black text-[10px] uppercase">WEIGHT (KG)</TableHead>
                  <TableHead className="font-black text-[10px] uppercase">RATE</TableHead>
                  <TableHead className="font-black text-[10px] uppercase">WASTAGE</TableHead>
                  <TableHead className="font-black text-[10px] uppercase">DATE RECEIVED</TableHead>
                  <TableHead className="font-black text-[10px] uppercase">JOB NO</TableHead>
                  <TableHead className="font-black text-[10px] uppercase">SIZE</TableHead>
                  <TableHead className="font-black text-[10px] uppercase">PRODUCT</TableHead>
                  <TableHead className="font-black text-[10px] uppercase">CODE</TableHead>
                  <TableHead className="font-black text-[10px] uppercase">LOT NO</TableHead>
                  <TableHead className="font-black text-[10px] uppercase">DATE</TableHead>
                  <TableHead className="font-black text-[10px] uppercase">CO RELL NO</TableHead>
                  <TableHead className="text-right font-black text-[10px] uppercase sticky right-0 bg-muted/50 z-20">ACTIONS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isPageLoading ? (
                  <TableRow><TableCell colSpan={21} className="text-center py-20"><Loader2 className="animate-spin mx-auto text-primary" /></TableCell></TableRow>
                ) : pagedJumbos.map((j, i) => (
                  <TableRow key={j.id} className="hover:bg-primary/5 h-12 font-sans text-xs">
                    <TableCell className="text-center font-bold text-[10px] text-muted-foreground border-r sticky left-0 bg-background z-10">{(currentPage-1)*pageSize+i+1}</TableCell>
                    <TableCell className="font-black text-primary font-mono">{j.rollNo}</TableCell>
                    <TableCell className="font-bold">{j.paperCompany}</TableCell>
                    <TableCell>{j.paperType}</TableCell>
                    <TableCell className="font-mono">{j.widthMm}mm</TableCell>
                    <TableCell className="font-mono">{j.lengthMeters}m</TableCell>
                    <TableCell className="font-black text-primary">{j.sqm}</TableCell>
                    <TableCell className="font-bold">{j.gsm}</TableCell>
                    <TableCell>{j.weightKg}kg</TableCell>
                    <TableCell className="text-emerald-700 font-bold">₹{j.purchaseRate?.toLocaleString()}</TableCell>
                    <TableCell>{j.wastage}%</TableCell>
                    <TableCell className="font-bold">{j.receivedDate}</TableCell>
                    <TableCell className="font-mono text-muted-foreground">{j.jobNo || "-"}</TableCell>
                    <TableCell>{j.size || "-"}</TableCell>
                    <TableCell className="truncate max-w-[150px]">{j.productName || "-"}</TableCell>
                    <TableCell className="font-mono text-muted-foreground">{j.code || "-"}</TableCell>
                    <TableCell className="font-mono font-bold text-accent">{j.lotNo}</TableCell>
                    <TableCell>{j.date || "-"}</TableCell>
                    <TableCell className="font-mono text-muted-foreground">{j.companyRollNo || "-"}</TableCell>
                    <TableCell className="text-right sticky right-0 bg-background z-10 border-l">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => { setEditingRoll(j); setIntakeForm({ widthMm: j.widthMm, lengthMeters: j.lengthMeters, quantity: j.quantity || 1 }); setIsDialogOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(j)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {pagedJumbos.length === 0 && !isPageLoading && (
                  <TableRow><TableCell colSpan={21} className="text-center py-20 text-muted-foreground italic"><div className="flex flex-col items-center gap-2"><Package className="h-10 w-10 opacity-10" /> No records found in current view.</div></TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[900px] font-sans">
          <form onSubmit={async (e) => {
            e.preventDefault();
            setIsProcessing(true);
            const form = new FormData(e.currentTarget);
            const data: any = Object.fromEntries(form.entries());
            
            const width = Number(data.widthMm);
            const length = Number(data.lengthMeters);
            const quantity = Number(data.quantity) || 1;
            const sqm = Number(((width / 1000) * length * quantity).toFixed(2));

            try {
              if (editingRoll) {
                await runTransaction(firestore!, async (tx) => {
                  tx.update(doc(firestore!, 'jumbo_stock', editingRoll.id), {
                    ...data, widthMm: width, lengthMeters: length, quantity, sqm, updatedAt: serverTimestamp()
                  });
                });
                toast({ title: "Record Updated" });
              } else {
                await runTransaction(firestore!, async (tx) => {
                  tx.set(doc(collection(firestore!, 'jumbo_stock')), {
                    ...data, widthMm: width, lengthMeters: length, quantity, sqm, status: 'In Stock', createdAt: serverTimestamp()
                  });
                });
                toast({ title: "Roll Added Successfully" });
              }
              setRefreshTrigger(p => p + 1);
              setIsDialogOpen(false);
            } catch (err: any) {
              toast({ variant: "destructive", title: "Save Failed", description: err.message });
            } finally { setIsProcessing(false); }
          }}>
            <DialogHeader><DialogTitle className="flex items-center gap-2 uppercase font-black"><Info className="h-5 w-5 text-primary" />{editingRoll ? 'Edit Technical Data' : 'New Roll Intake'}</DialogTitle></DialogHeader>
            <div className="grid gap-6 py-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2"><Label className="text-[10px] uppercase font-black">RELL NO</Label><Input name="rollNo" defaultValue={editingRoll?.rollNo} required /></div>
                <div className="space-y-2"><Label className="text-[10px] uppercase font-black">Company</Label><Input name="paperCompany" defaultValue={editingRoll?.paperCompany} required /></div>
                <div className="space-y-2"><Label className="text-[10px] uppercase font-black">Type</Label><Input name="paperType" defaultValue={editingRoll?.paperType} required /></div>
              </div>
              <div className="grid grid-cols-4 gap-4">
                <div className="space-y-2"><Label className="text-[10px] uppercase font-black">Width (mm)</Label><Input name="widthMm" type="number" step="0.01" value={intakeForm.widthMm} required onChange={e => setIntakeForm(p => ({...p, widthMm: Number(e.target.value)}))} /></div>
                <div className="space-y-2"><Label className="text-[10px] uppercase font-black">Length (m)</Label><Input name="lengthMeters" type="number" step="0.01" value={intakeForm.lengthMeters} required onChange={e => setIntakeForm(p => ({...p, lengthMeters: Number(e.target.value)}))} /></div>
                <div className="space-y-2"><Label className="text-[10px] uppercase font-black">Qty</Label><Input name="quantity" type="number" value={intakeForm.quantity} required onChange={e => setIntakeForm(p => ({...p, quantity: Number(e.target.value)}))} /></div>
                <div className="space-y-2"><Label className="text-[10px] uppercase font-black">SQM (Auto)</Label><Input value={liveSqm} readOnly className="bg-muted font-mono font-bold" /></div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2"><Label className="text-[10px] uppercase font-black">GSM</Label><Input name="gsm" type="number" defaultValue={editingRoll?.gsm} required /></div>
                <div className="space-y-2"><Label className="text-[10px] uppercase font-black">Lot No</Label><Input name="lotNo" defaultValue={editingRoll?.lotNo} required /></div>
                <div className="space-y-2"><Label className="text-[10px] uppercase font-black">Rate (₹)</Label><Input name="purchaseRate" type="number" step="0.01" defaultValue={editingRoll?.purchaseRate} required /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label className="text-[10px] uppercase font-black">Received Date</Label><Input name="receivedDate" type="date" defaultValue={editingRoll?.receivedDate || new Date().toISOString().split('T')[0]} required /></div>
                <div className="space-y-2"><Label className="text-[10px] uppercase font-black">Co Rell No</Label><Input name="companyRollNo" defaultValue={editingRoll?.companyRollNo} /></div>
              </div>
            </div>
            <DialogFooter><Button type="submit" disabled={isProcessing} className="w-full h-12 uppercase font-black">{isProcessing ? <Loader2 className="animate-spin" /> : 'Confirm Technical Entry'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
