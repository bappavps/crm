
"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
  Printer, 
  Search, 
  ArrowUpDown, 
  FilterX, 
  ArrowUp, 
  ArrowDown, 
  Hash, 
  Info, 
  Calendar,
  Filter,
  ChevronDown,
  ChevronUp,
  Download,
  FileDown,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Trash2,
  X,
  MoreVertical
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useFirestore, useUser, useMemoFirebase, useDoc, errorEmitter, FirestorePermissionError } from "@/firebase"
import { 
  collection, 
  doc, 
  runTransaction, 
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
  writeBatch
} from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { exportPaperStockToExcel } from "@/lib/export-utils"

type SortField = 'rollNo' | 'receivedDate' | 'purchaseRate' | 'gsm' | 'sqm' | 'weightKg' | 'paperCompany' | 'status';
type SortOrder = 'asc' | 'desc';

interface ColumnFilter {
  field: string;
  operator: '==' | 'startsWith' | '>=' | '<=' | 'all';
  value: any;
}

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
  
  // Selection State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Pagination & Display State
  const [pageSize, setPageSize] = useState<number | 'all'>(20)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalRecords, setTotalRecords] = useState(0)
  const [lastVisible, setLastVisible] = useState<QueryDocumentSnapshot<DocumentData> | null>(null)
  const [pageStack, setPageStack] = useState<any[]>([null])
  const [pagedJumbos, setPagedJumbos] = useState<any[]>([])
  const [isPageLoading, setIsPageLoading] = useState(false)

  // Sort & Advanced Filter State
  const [sortField, setSortField] = useState<SortField>('receivedDate')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [columnFilters, setColumnFilters] = useState<Record<string, ColumnFilter>>({})

  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Form State
  const [formData, setFormData] = useState({
    widthMm: 1020,
    lengthMeters: 0,
    sqm: 0,
    gsm: 0,
    weightKg: 0,
    purchaseRate: 0,
    wastage: 0,
    jobNo: "",
    size: "",
    productName: "",
    code: "",
    lotNo: "",
    companyRollNo: "",
    dateOfUse: "",
    date: ""
  })

  useEffect(() => {
    if (isMounted) {
      setFormData(prev => ({ ...prev, date: new Date().toISOString().split('T')[0] }));
    }
  }, [isMounted])

  const adminDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'adminUsers', user.uid);
  }, [firestore, user]);
  const { data: adminData, isLoading: authLoading } = useDoc(adminDocRef);
  const isAdmin = !!adminData;

  const settingsDocRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'roll_settings', 'global_config');
  }, [firestore]);
  const { data: settings } = useDoc(settingsDocRef);

  const [materials, setMaterials] = useState<any[]>([])
  const [suppliers, setSuppliers] = useState<any[]>([])

  useEffect(() => {
    if (!firestore || !user || !adminData) return
    const unsubM = onSnapshot(collection(firestore, 'raw_materials'), s => setMaterials(s.docs.map(d => ({id: d.id, ...d.data()}))))
    const unsubS = onSnapshot(collection(firestore, 'suppliers'), s => setSuppliers(s.docs.map(d => ({id: d.id, ...d.data()}))))
    return () => { unsubM(); unsubS(); }
  }, [firestore, user, adminData])

  // Query Builder Utility
  const buildBaseQuery = () => {
    if (!firestore) return null;
    let q = collection(firestore, 'jumbo_stock');
    let queries: any[] = [];
    
    Object.values(columnFilters).forEach(f => {
      if (f.value === "" || f.value === "all") return;
      
      if (f.operator === 'startsWith') {
        queries.push(where(f.field, '>=', f.value));
        queries.push(where(f.field, '<=', f.value + '\uf8ff'));
      } else {
        queries.push(where(f.field, f.operator, f.value));
      }
    });

    if (queries.length > 3) {
      toast({ variant: "destructive", title: "Query Too Complex", description: "Please limit to 3 simultaneous filters." });
      return null;
    }

    let finalQ = query(q, ...queries);
    return finalQ;
  }

  // 1. Fetch Total Count & Handle Pagination Reset
  useEffect(() => {
    if (!firestore || !user || !adminData) return;

    const fetchCount = async () => {
      const baseQ = buildBaseQuery();
      if (!baseQ) {
        setTotalRecords(0);
        return;
      }
      const snapshot = await getCountFromServer(baseQ);
      setTotalRecords(snapshot.data().count);
    };

    fetchCount();
    setCurrentPage(1);
    setPageStack([null]);
    setLastVisible(null);
    setSelectedIds(new Set());
  }, [firestore, user, adminData, columnFilters]);

  // 2. Fetch Paginated Data
  useEffect(() => {
    if (!firestore || !user || !adminData) return;

    const fetchData = async () => {
      setIsPageLoading(true);
      try {
        const baseQ = buildBaseQuery();
        if (!baseQ) {
          setPagedJumbos([]);
          return;
        }

        // Handle Firestore range sort rule: First order by must match range filter field
        const rangeFilter = Object.values(columnFilters).find(f => ['startsWith', '>=', '<='].includes(f.operator));
        let finalSortField: any = sortField;
        if (rangeFilter) finalSortField = rangeFilter.field;

        let q = query(baseQ, orderBy(finalSortField, sortOrder));

        const cursor = pageStack[currentPage - 1];
        if (cursor) q = query(q, startAfter(cursor));
        if (pageSize !== 'all') q = query(q, limit(pageSize as number));

        const snapshot = await getDocs(q);
        setPagedJumbos(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        if (snapshot.docs.length > 0) setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
      } catch (e) {
        console.error("Pagination error:", e);
      } finally {
        setIsPageLoading(false);
      }
    };

    fetchData();
  }, [firestore, user, adminData, pageSize, currentPage, sortField, sortOrder, columnFilters, pageStack]);

  const handleNextPage = () => {
    const currentLimit = pageSize === 'all' ? totalRecords : (pageSize as number);
    if (currentPage * currentLimit < totalRecords) {
      const nextStack = [...pageStack];
      nextStack[currentPage] = lastVisible;
      setPageStack(nextStack);
      setCurrentPage(prev => prev + 1);
      setSelectedIds(new Set());
    }
  }

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
      setSelectedIds(new Set());
    }
  }

  const handlePageSizeChange = (val: string) => {
    if (val === 'all') {
      if (totalRecords > 2000) {
        toast({ variant: "destructive", title: "Limit Exceeded", description: "Too many records for single page load." });
        return;
      }
      setPageSize('all');
    } else {
      setPageSize(Number(val));
    }
    setCurrentPage(1);
    setPageStack([null]);
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === pagedJumbos.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(pagedJumbos.map(j => j.id)))
  }

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedIds(next)
  }

  const handleSingleDelete = async (roll: any) => {
    if (!isAdmin || !firestore) return;
    if (confirm(`Delete Roll ID ${roll.rollNo}?`)) {
      setIsDeleting(true);
      try {
        await deleteDoc(doc(firestore, 'jumbo_stock', roll.id));
        toast({ title: "Roll Deleted" });
        setTotalRecords(prev => prev - 1);
      } finally {
        setIsDeleting(false);
      }
    }
  }

  const handleBulkDelete = async () => {
    if (!isAdmin || !firestore || selectedIds.size === 0) return;
    if (confirm(`Delete ${selectedIds.size} records?`)) {
      setIsDeleting(true);
      try {
        const ids = Array.from(selectedIds);
        for (let i = 0; i < ids.length; i += 500) {
          const batch = writeBatch(firestore);
          ids.slice(i, i + 500).forEach(id => batch.delete(doc(firestore, 'jumbo_stock', id)));
          await batch.commit();
        }
        toast({ title: "Bulk Delete Successful" });
        setSelectedIds(new Set());
        setTotalRecords(prev => prev - ids.length);
      } finally {
        setIsDeleting(false);
      }
    }
  }

  const handleExport = async () => {
    if (!firestore) return
    setIsExporting(true)
    try {
      await exportPaperStockToExcel(firestore);
      toast({ title: "Export Complete" })
    } finally {
      setIsExporting(false)
    }
  }

  const updateFilter = (field: string, operator: any, value: any) => {
    setColumnFilters(prev => {
      const next = { ...prev };
      if (value === "" || value === "all") delete next[field];
      else next[field] = { field, operator, value };
      return next;
    });
  }

  const resetFilters = () => {
    setColumnFilters({});
    setSortField('receivedDate');
    setSortOrder('desc');
    setCurrentPage(1);
  }

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortOrder('asc'); }
  };

  const activeFiltersCount = Object.keys(columnFilters).length;

  const FilterControl = ({ field, type, options }: { field: string, type: 'text' | 'number' | 'select', options?: any[] }) => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className={cn("h-6 w-6 ml-1", columnFilters[field] && "text-primary bg-primary/10")}>
          <Filter className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-60 p-4 space-y-4" align="start">
        <div className="space-y-2">
          <Label className="text-[10px] font-black uppercase">Filter {field}</Label>
          {type === 'select' ? (
            <Select 
              value={columnFilters[field]?.value || 'all'} 
              onValueChange={(val) => updateFilter(field, '==', val)}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {options?.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
              </SelectContent>
            </Select>
          ) : (
            <>
              <Select 
                value={columnFilters[field]?.operator || (type === 'text' ? 'startsWith' : '==')} 
                onValueChange={(op) => updateFilter(field, op, columnFilters[field]?.value || '')}
              >
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {type === 'text' ? (
                    <>
                      <SelectItem value="startsWith">Starts With</SelectItem>
                      <SelectItem value="==">Equals</SelectItem>
                    </>
                  ) : (
                    <>
                      <SelectItem value="==">Equals</SelectItem>
                      <SelectItem value=">=">Greater Than</SelectItem>
                      <SelectItem value="<=">Less Than</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
              <Input 
                placeholder="Value..." 
                className="h-8 text-xs" 
                defaultValue={columnFilters[field]?.value || ''}
                onBlur={(e) => updateFilter(field, columnFilters[field]?.operator || (type === 'text' ? 'startsWith' : '=='), e.target.value)}
              />
            </>
          )}
        </div>
        <Button variant="ghost" size="sm" className="w-full text-[10px] h-7" onClick={() => updateFilter(field, 'all', 'all')}>Clear</Button>
      </PopoverContent>
    </Popover>
  );

  return (
    <div className="space-y-6 relative">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">GRN (Jumbo Entry)</h2>
          <p className="text-muted-foreground font-medium">ERP Stock Registry with technical column filtering.</p>
        </div>
        <div className="flex gap-2">
          {activeFiltersCount > 0 && (
            <Button variant="outline" onClick={resetFilters} className="border-primary text-primary font-bold">
              <FilterX className="mr-2 h-4 w-4" /> Reset Filters ({activeFiltersCount})
            </Button>
          )}
          <Button variant="outline" onClick={handleExport} disabled={isExporting}>
            {isExporting ? <Loader2 className="animate-spin mr-2" /> : <FileDown className="mr-2 h-4 w-4" />}
            Export Stock
          </Button>
          <Button onClick={() => setIsDialogOpen(true)} className="shadow-lg"><Plus className="mr-2 h-4 w-4" /> New Entry</Button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-muted/30 p-4 rounded-xl border border-primary/10">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Label className="text-[10px] font-black uppercase text-muted-foreground">Rows:</Label>
            <Select value={pageSize.toString()} onValueChange={handlePageSizeChange}>
              <SelectTrigger className="w-[80px] h-8 text-xs font-bold"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
                <SelectItem value="all" disabled={totalRecords > 2000}>All</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest bg-background px-3 py-1.5 rounded-full border">
            {totalRecords > 0 ? <>Showing <span className="text-primary">{startIdx}–{endIdx}</span> of {totalRecords.toLocaleString()}</> : "No records"}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={handlePrevPage} disabled={currentPage === 1 || isPageLoading}><ChevronLeft className="h-4 w-4" /></Button>
          <Badge variant="secondary" className="h-8 px-3 text-xs font-black">PAGE {currentPage}</Badge>
          <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={handleNextPage} disabled={pageSize === 'all' || endIdx >= totalRecords || isPageLoading}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      <Card className="shadow-2xl border-none overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="min-w-[2200px]">
              <TableHeader className="sticky top-0 bg-background z-20 shadow-sm border-b-2">
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="w-[50px] text-center sticky left-0 bg-muted/50 z-30">
                    <Checkbox checked={selectedIds.size === pagedJumbos.length && pagedJumbos.length > 0} onCheckedChange={toggleSelectAll} />
                  </TableHead>
                  <TableHead className="w-[60px] font-black text-center text-[10px] uppercase">S/N</TableHead>
                  <TableHead className="w-[120px] sticky left-[50px] bg-muted/50 border-r z-30">
                    <div className="flex items-center">
                      <span className="font-black text-primary text-[10px]">RELL NO</span>
                      <FilterControl field="rollNo" type="text" />
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => toggleSort('rollNo')}>
                        <ArrowUpDown className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableHead>
                  <TableHead className="w-[180px]">
                    <div className="flex items-center">
                      <span className="font-black text-[10px]">COMPANY</span>
                      <FilterControl field="paperCompany" type="text" />
                    </div>
                  </TableHead>
                  <TableHead className="w-[150px]">
                    <div className="flex items-center">
                      <span className="font-black text-[10px]">TYPE</span>
                      <FilterControl field="paperType" type="text" />
                    </div>
                  </TableHead>
                  <TableHead className="w-[100px]">
                    <div className="flex items-center">
                      <span className="font-black text-[10px]">WIDTH</span>
                      <FilterControl field="widthMm" type="number" />
                    </div>
                  </TableHead>
                  <TableHead className="w-[100px]">
                    <div className="flex items-center">
                      <span className="font-black text-[10px]">LENGTH</span>
                      <FilterControl field="lengthMeters" type="number" />
                    </div>
                  </TableHead>
                  <TableHead className="w-[100px]">
                    <div className="flex items-center text-primary">
                      <span className="font-black text-[10px]">SQM</span>
                      <FilterControl field="sqm" type="number" />
                    </div>
                  </TableHead>
                  <TableHead className="w-[80px]">
                    <div className="flex items-center text-primary">
                      <span className="font-black text-[10px]">GSM</span>
                      <FilterControl field="gsm" type="number" />
                    </div>
                  </TableHead>
                  <TableHead className="w-[100px]">
                    <div className="flex items-center">
                      <span className="font-black text-[10px]">WEIGHT</span>
                      <FilterControl field="weightKg" type="number" />
                    </div>
                  </TableHead>
                  <TableHead className="w-[120px]">
                    <div className="flex items-center text-primary">
                      <span className="font-black text-[10px]">RATE</span>
                      <FilterControl field="purchaseRate" type="number" />
                    </div>
                  </TableHead>
                  <TableHead className="w-[120px]">
                    <div className="flex items-center">
                      <span className="font-black text-[10px]">RECEIVED</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => toggleSort('receivedDate')}>
                        <ArrowUpDown className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableHead>
                  <TableHead className="w-[120px]">
                    <div className="flex items-center">
                      <span className="font-black text-[10px]">STATUS</span>
                      <FilterControl field="status" type="select" options={['In Stock', 'Consumed', 'Partial']} />
                    </div>
                  </TableHead>
                  {isAdmin && <TableHead className="text-right sticky right-0 bg-muted/50 border-l font-black text-[10px]">ACTIONS</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isPageLoading ? (
                  <TableRow><TableCell colSpan={15} className="text-center py-20"><Loader2 className="animate-spin mx-auto text-primary" /></TableCell></TableRow>
                ) : pagedJumbos.map((j, index) => (
                  <TableRow key={j.id} className="hover:bg-primary/5 h-14">
                    <TableCell className="text-center sticky left-0 bg-background z-10 border-r">
                      <Checkbox checked={selectedIds.has(j.id)} onCheckedChange={() => toggleSelect(j.id)} />
                    </TableCell>
                    <TableCell className="text-center text-[10px] font-bold text-muted-foreground">
                      {((currentPage - 1) * (pageSize === 'all' ? 0 : pageSize)) + index + 1}
                    </TableCell>
                    <TableCell className="font-black text-primary sticky left-[50px] bg-background border-r z-10 font-mono text-xs">{j.rollNo}</TableCell>
                    <TableCell className="text-xs">{j.paperCompany}</TableCell>
                    <TableCell><Badge variant="outline" className="font-bold bg-white text-[10px]">{j.paperType}</Badge></TableCell>
                    <TableCell className="font-mono text-xs">{j.widthMm}mm</TableCell>
                    <TableCell className="font-mono text-xs">{j.lengthMeters}m</TableCell>
                    <TableCell className="font-black text-xs text-primary">{j.sqm}</TableCell>
                    <TableCell className="text-xs">{j.gsm}</TableCell>
                    <TableCell className="font-bold text-xs">{j.weightKg}kg</TableCell>
                    <TableCell className="text-emerald-700 font-bold text-xs">₹{j.purchaseRate?.toLocaleString()}</TableCell>
                    <TableCell className="text-[10px] font-bold text-muted-foreground">{j.receivedDate}</TableCell>
                    <TableCell>
                      <Badge className={cn("text-[10px]", j.status === 'In Stock' ? 'bg-emerald-500' : 'bg-amber-500')}>
                        {j.status}
                      </Badge>
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="text-right sticky right-0 bg-background border-l z-10">
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

      {selectedIds.size > 0 && isAdmin && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 bg-zinc-900 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-6 animate-in slide-in-from-bottom-4">
          <div className="flex items-center gap-2">
            <div className="bg-primary h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-black">{selectedIds.size}</div>
            <span className="text-sm font-bold uppercase tracking-tight">Records Selected</span>
          </div>
          <Separator orientation="vertical" className="h-6 bg-white/20" />
          <Button variant="destructive" size="sm" className="font-black uppercase h-9 px-4 rounded-full" onClick={handleBulkDelete} disabled={isDeleting}>
            {isDeleting ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <Trash2 className="h-3 w-3 mr-2" />} Delete Selection
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-white/60 hover:text-white" onClick={() => setSelectedIds(new Set())}><X className="h-4 w-4" /></Button>
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[900px] max-h-[95vh] overflow-y-auto">
          <form onSubmit={handleAddJumbo}>
            <DialogHeader><DialogTitle>Substrate Technical Intake (19 Columns)</DialogTitle></DialogHeader>
            <div className="grid gap-6 py-4">
              <div className="flex items-center justify-between p-4 bg-primary/5 rounded-lg border border-primary/10">
                <div className="flex items-center gap-2">
                  <Hash className="h-5 w-5 text-primary" />
                  <div><Label className="font-bold text-base">RELL NO Identification</Label><p className="text-[10px] text-muted-foreground uppercase font-medium">Internal Master Serial</p></div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-muted-foreground">AUTO</span>
                    <Switch checked={isManualId} onCheckedChange={setIsManualId} />
                    <span className="text-[10px] font-bold text-primary">MANUAL</span>
                  </div>
                  {isManualId ? <Input name="manualRollNo" placeholder="VEN-001" className="w-40 h-10 font-bold" required /> : <div className="px-4 py-2 bg-background border rounded-md font-mono font-bold text-primary shadow-inner">{settings?.parentPrefix || "TLC-"}1XXX</div>}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2"><Label className="text-[11px] font-bold text-primary">PAPER COMPANY</Label><Select name="paperCompany" required><SelectTrigger className="h-10"><SelectValue placeholder="Vendor" /></SelectTrigger><SelectContent>{suppliers?.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><Label className="text-[11px] font-bold text-primary">PAPER TYPE</Label><Select name="paperType" required><SelectTrigger className="h-10"><SelectValue placeholder="Type" /></SelectTrigger><SelectContent>{materials?.map(m => <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><Label className="text-[11px] font-bold text-primary">DATE RECEIVED</Label><Input name="receivedDate" type="date" defaultValue={new Date().toISOString().split('T')[0]} required /></div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                <div className="space-y-1"><Label className="text-[10px] uppercase font-bold">WIDTH (MM)</Label><Input name="widthMm" type="number" value={formData.widthMm} onChange={handleInputChange} required /></div>
                <div className="space-y-1"><Label className="text-[10px] uppercase font-bold">LENGTH (MTR)</Label><Input name="lengthMeters" type="number" value={formData.lengthMeters} onChange={handleInputChange} required /></div>
                <div className="space-y-1"><Label className="text-[10px] uppercase font-bold text-primary">SQM (AUTO)</Label><div className="h-10 px-3 flex items-center bg-primary/5 border-2 border-primary/20 rounded-md font-black text-primary">{formData.sqm}</div></div>
                <div className="space-y-1"><Label className="text-[10px] uppercase font-bold">GSM</Label><Input name="gsm" type="number" value={formData.gsm} onChange={handleInputChange} required /></div>
              </div>
            </div>
            <DialogFooter className="pt-4 border-t"><Button type="submit" className="h-12 px-10 text-lg font-bold bg-primary" disabled={isGenerating}>{isGenerating ? <Loader2 className="animate-spin" /> : "Complete GRN"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
