
"use client"

import { useState, useRef, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog"
import { 
  Plus, 
  Trash2, 
  Pencil, 
  Loader2, 
  FlaskConical, 
  Layers, 
  Truck, 
  Factory, 
  Ruler, 
  Users, 
  Package, 
  ChevronLeft, 
  ChevronRight, 
  Filter, 
  FilterX, 
  ArrowUpDown, 
  X, 
  FileDown, 
  FileUp, 
  Download,
  CheckCircle2,
  Hash
} from "lucide-react"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { useCollection, useFirestore, useMemoFirebase, useUser, useDoc } from "@/firebase"
import { collection, doc, query, where, orderBy, getDocs, writeBatch, serverTimestamp, getCountFromServer, limit, startAfter, QueryDocumentSnapshot, DocumentData, deleteDoc, onSnapshot } from "firebase/firestore"
import { updateDocumentNonBlocking, addDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase/non-blocking-updates"
import { usePermissions } from "@/components/auth/permission-context"
import { exportPaperStockToExcel } from "@/lib/export-utils"
import * as XLSX from 'xlsx'
import { cn } from "@/lib/utils"

const TEMPLATE_HEADERS = ["ROLL NO", "PAPER COMPANY", "PAPER TYPE", "GSM", "WIDTH (MM)", "LENGTH (MTR)", "WEIGHT (KG)", "SUPPLIER", "GRN NO", "PURCHASE DATE", "RATE PER SQM", "LOCATION"];
const SYSTEM_FIELDS = [
  { id: 'roll_no', label: 'ROLL NO' },
  { id: 'paper_company', label: 'PAPER COMPANY' },
  { id: 'paper_type', label: 'PAPER TYPE' },
  { id: 'gsm', label: 'GSM' },
  { id: 'width_mm', label: 'WIDTH (MM)' },
  { id: 'length_mtr', label: 'LENGTH (MTR)' },
  { id: 'weight_kg', label: 'WEIGHT (KG)' },
  { id: 'supplier', label: 'SUPPLIER' },
  { id: 'grn_number', label: 'GRN NO' },
  { id: 'purchase_date', label: 'PURCHASE DATE' },
  { id: 'rate_per_sqm', label: 'RATE PER SQM' },
  { id: 'location', label: 'LOCATION' }
];

type SortField = 'rollNo' | 'receivedDate' | 'purchaseRate' | 'gsm' | 'sqm' | 'weightKg' | 'paperCompany' | 'status';
type SortOrder = 'asc' | 'desc';

export default function MasterDataPage() {
  const { toast } = useToast()
  const { user } = useUser()
  const firestore = useFirestore()
  const { hasPermission, roles: userRoles } = usePermissions()
  const [isMounted, setIsMounted] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [dialogType, setDialogType] = useState<any>("raw_materials")
  const [editingItem, setEditingItem] = useState<any>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  
  const [selectedStockIds, setSelectedStockIds] = useState<Set<string>>(new Set())
  const [pageSize, setPageSize] = useState<number | 'all'>(20)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalRecords, setTotalRecords] = useState(0)
  const [lastVisible, setLastVisible] = useState<QueryDocumentSnapshot<DocumentData> | null>(null)
  const [pageStack, setPageStack] = useState<any[]>([null])
  const [pagedJumbos, setPagedJumbos] = useState<any[]>([])
  const [isPageLoading, setIsPageLoading] = useState(false)
  
  const [sortField, setSortField] = useState<SortField>('receivedDate')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [columnFilters, setColumnFilters] = useState<Record<string, { field: string, operator: any, value: any }>>({})

  // Import State
  const [isImporting, setIsImporting] = useState(false)
  const [importProgress, setImportProgress] = useState(0)
  const [importData, setImportData] = useState<any[]>([])
  const [excelHeaders, setExcelHeaders] = useState<string[]>([])
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({})
  const [importStep, setImportStep] = useState<1 | 2 | 3>(1)
  const [importSummary, setImportSummary] = useState<any>(null)

  useEffect(() => { setIsMounted(true) }, [])

  const adminDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'adminUsers', user.uid);
  }, [firestore, user]);
  const { data: adminData, isLoading: adminCheckLoading } = useDoc(adminDocRef);
  const isAdmin = !!adminData || userRoles.includes('Admin');

  // Queries
  const rawMaterialsQuery = useMemoFirebase(() => (!firestore || !user || !adminData) ? null : collection(firestore, 'raw_materials'), [firestore, user, adminData])
  const suppliersQuery = useMemoFirebase(() => (!firestore || !user || !adminData) ? null : collection(firestore, 'suppliers'), [firestore, user, adminData])
  const machinesQuery = useMemoFirebase(() => (!firestore || !user || !adminData) ? null : collection(firestore, 'machines'), [firestore, user, adminData])
  const customersQuery = useMemoFirebase(() => (!firestore || !user || !adminData) ? null : collection(firestore, 'customers'), [firestore, user, adminData])
  const cylindersQuery = useMemoFirebase(() => (!firestore || !user || !adminData) ? null : collection(firestore, 'cylinders'), [firestore, user, adminData])
  const bomsQuery = useMemoFirebase(() => (!firestore || !user || !adminData) ? null : collection(firestore, 'boms'), [firestore, user, adminData])

  const { data: rawMaterials } = useCollection(rawMaterialsQuery)
  const { data: suppliers } = useCollection(suppliersQuery)
  const { data: machines } = useCollection(machinesQuery)
  const { data: customers } = useCollection(customersQuery)
  const { data: cylinders } = useCollection(cylindersQuery)
  const { data: boms } = useCollection(bomsQuery)

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
    return queries.length <= 3 ? query(q, ...queries) : null;
  }

  useEffect(() => {
    if (!firestore || !user || !adminData) return;
    const fetchCount = async () => {
      const baseQ = buildBaseQuery();
      if (!baseQ) return setTotalRecords(0);
      const snapshot = await getCountFromServer(baseQ);
      setTotalRecords(snapshot.data().count);
    };
    fetchCount();
    setCurrentPage(1);
    setPageStack([null]);
    setLastVisible(null);
    setSelectedStockIds(new Set());
  }, [firestore, user, adminData, columnFilters]);

  useEffect(() => {
    if (!firestore || !user || !adminData) return;
    const fetchData = async () => {
      setIsPageLoading(true);
      try {
        const baseQ = buildBaseQuery();
        if (!baseQ) return setPagedJumbos([]);
        const rangeFilter = Object.values(columnFilters).find(f => ['startsWith', '>=', '<='].includes(f.operator));
        let q = query(baseQ, orderBy(rangeFilter ? rangeFilter.field : sortField, sortOrder));
        const cursor = pageStack[currentPage - 1];
        if (cursor) q = query(q, startAfter(cursor));
        if (pageSize !== 'all') q = query(q, limit(pageSize as number));
        const snapshot = await getDocs(q);
        setPagedJumbos(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        if (snapshot.docs.length > 0) setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
      } finally { setIsPageLoading(false); }
    };
    fetchData();
  }, [firestore, user, adminData, pageSize, currentPage, sortField, sortOrder, columnFilters, pageStack]);

  const handleNextPage = () => {
    const limitVal = pageSize === 'all' ? totalRecords : (pageSize as number);
    if (currentPage * limitVal < totalRecords) {
      setPageStack(prev => { const next = [...prev]; next[currentPage] = lastVisible; return next; });
      setCurrentPage(prev => prev + 1);
      setSelectedStockIds(new Set());
    }
  }

  const handlePrevPage = () => { if (currentPage > 1) { setCurrentPage(prev => prev - 1); setSelectedStockIds(new Set()); } }

  const handlePageSizeChange = (val: string) => {
    if (val === 'all' && totalRecords > 2000) return toast({ variant: "destructive", title: "Limit Exceeded" });
    setPageSize(val === 'all' ? 'all' : Number(val));
    setCurrentPage(1);
    setPageStack([null]);
  }

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortOrder('asc'); }
  };

  const updateFilter = (field: string, operator: any, value: any) => {
    setColumnFilters(prev => {
      const next = { ...prev };
      if (value === "" || value === "all") delete next[field];
      else next[field] = { field, operator, value };
      return next;
    });
  }

  const handleSingleStockDelete = async (roll: any) => {
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

  const handleBulkStockDelete = async () => {
    if (!isAdmin || !firestore || selectedStockIds.size === 0) return;
    if (confirm(`Delete ${selectedStockIds.size} records?`)) {
      setIsDeleting(true);
      try {
        const ids = Array.from(selectedStockIds);
        for (let i = 0; i < ids.length; i += 500) {
          const batch = writeBatch(firestore);
          ids.slice(i, i + 500).forEach(id => batch.delete(doc(firestore, 'jumbo_stock', id)));
          await batch.commit();
        }
        toast({ title: "Bulk Delete Successful" });
        setSelectedStockIds(new Set());
        setTotalRecords(prev => prev - ids.length);
      } finally { setIsDeleting(false); }
    }
  }

  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const rawData = Object.fromEntries(formData.entries());
    if (!firestore || !user) return;
    let finalData: any = { ...rawData };
    if (dialogType === 'raw_materials') finalData.rate_per_unit = Number(rawData.rate_per_unit);
    if (dialogType === 'machines') { finalData.maxPrintingWidthMm = Number(rawData.maxPrintingWidthMm); finalData.speed = Number(rawData.speed); }
    if (dialogType === 'cylinders') { finalData.size = Number(rawData.size); finalData.teeth = Number(rawData.teeth); }
    if (dialogType === 'customers') finalData.creditDays = Number(rawData.creditDays);

    if (editingItem) {
      updateDocumentNonBlocking(doc(firestore, dialogType, editingItem.id), { ...finalData, updatedAt: new Date().toISOString(), updatedById: user.uid });
      toast({ title: "Updated" });
    } else {
      addDocumentNonBlocking(collection(firestore, dialogType), { ...finalData, id: crypto.randomUUID(), createdAt: new Date().toISOString(), createdById: user.uid });
      toast({ title: "Created" });
    }
    setIsDialogOpen(false); setEditingItem(null);
  }

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
            <Select value={columnFilters[field]?.value || 'all'} onValueChange={(val) => updateFilter(field, '==', val)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">All Status</SelectItem>{options?.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}</SelectContent>
            </Select>
          ) : (
            <>
              <Select value={columnFilters[field]?.operator || (type === 'text' ? 'startsWith' : '==')} onValueChange={(op) => updateFilter(field, op, columnFilters[field]?.value || '')}>
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
              <Input placeholder="Value..." className="h-8 text-xs" defaultValue={columnFilters[field]?.value || ''} onBlur={(e) => updateFilter(field, columnFilters[field]?.operator || (type === 'text' ? 'startsWith' : '=='), e.target.value)} />
            </>
          )}
        </div>
        <Button variant="ghost" size="sm" className="w-full text-[10px] h-7" onClick={() => updateFilter(field, 'all', 'all')}>Clear</Button>
      </PopoverContent>
    </Popover>
  );

  if (!isMounted || adminCheckLoading) return <div className="flex h-[70vh] items-center justify-center"><Loader2 className="animate-spin" /></div>

  const startIdx = totalRecords === 0 ? 0 : (currentPage - 1) * (pageSize === 'all' ? totalRecords : (pageSize as number)) + 1;
  const endIdx = pageSize === 'all' ? totalRecords : Math.min(currentPage * (pageSize as number), totalRecords);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h2 className="text-3xl font-bold tracking-tight text-primary uppercase">Master Control Panel</h2><p className="text-muted-foreground font-medium">Technical constants and advanced inventory management.</p></div>
      </div>

      <Tabs defaultValue="raw_materials" className="w-full">
        <TabsList className="bg-muted/50 p-1 mb-6 flex overflow-x-auto h-auto whitespace-nowrap"><TabsTrigger value="raw_materials" className="gap-2 font-bold"><FlaskConical className="h-4 w-4" /> Raw Materials</TabsTrigger><TabsTrigger value="paper_stock" className="gap-2 font-bold"><Package className="h-4 w-4" /> Paper Stock</TabsTrigger><TabsTrigger value="boms" className="gap-2 font-bold"><Layers className="h-4 w-4" /> BOM Master</TabsTrigger><TabsTrigger value="suppliers" className="gap-2 font-bold"><Truck className="h-4 w-4" /> Suppliers</TabsTrigger><TabsTrigger value="machines" className="gap-2 font-bold"><Factory className="h-4 w-4" /> Machines</TabsTrigger><TabsTrigger value="cylinders" className="gap-2 font-bold"><Ruler className="h-4 w-4" /> Cylinders</TabsTrigger><TabsTrigger value="customers" className="gap-2 font-bold"><Users className="h-4 w-4" /> Clients</TabsTrigger></TabsList>
        
        <TabsContent value="paper_stock">
          <Card className="border-none shadow-xl">
            <CardHeader className="flex flex-col md:flex-row md:items-center justify-between bg-primary/5 gap-4">
              <div><CardTitle className="flex items-center gap-2"><Package className="h-5 w-5 text-primary" /> Substrate Stock Registry</CardTitle><CardDescription>Full ERP traceability with column-wise filtering.</CardDescription></div>
              <div className="flex flex-wrap gap-2">
                {Object.keys(columnFilters).length > 0 && <Button variant="outline" size="sm" onClick={resetFilters} className="border-primary text-primary font-bold"><FilterX className="h-4 w-4 mr-2" /> Reset Filters</Button>}
                {isAdmin && <><Button variant="outline" size="sm" onClick={() => XLSX.writeFile(XLSX.utils.book_new(), "stock_template.xlsx")}><Download className="h-4 w-4 mr-2" /> Template</Button><Button variant="outline" size="sm" onClick={() => { setImportStep(1); setIsImportDialogOpen(true); }} className="border-primary text-primary"><FileUp className="h-4 w-4 mr-2" /> Upload Excel</Button></>}
                <Button variant="outline" size="sm" onClick={handleExport} disabled={isExporting}>{isExporting ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <FileDown className="h-4 w-4 mr-2" />} Export All</Button>
              </div>
            </CardHeader>

            <div className="p-4 border-b bg-muted/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Label className="text-[10px] font-black uppercase">Rows:</Label>
                  <Select value={pageSize.toString()} onValueChange={handlePageSizeChange}><SelectTrigger className="w-[80px] h-8 text-xs font-bold"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="10">10</SelectItem><SelectItem value="20">20</SelectItem><SelectItem value="50">50</SelectItem><SelectItem value="100">100</SelectItem><SelectItem value="all">All</SelectItem></SelectContent></Select>
                </div>
                <div className="text-[10px] font-bold text-muted-foreground uppercase bg-background px-3 py-1.5 rounded-full border">{totalRecords > 0 ? <>Showing <span className="text-primary">{startIdx}–{endIdx}</span> of {totalRecords.toLocaleString()}</> : "No records"}</div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={handlePrevPage} disabled={currentPage === 1 || isPageLoading}><ChevronLeft className="h-4 w-4" /></Button>
                <Badge variant="secondary" className="h-8 px-3 text-xs font-black">PAGE {currentPage}</Badge>
                <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={handleNextPage} disabled={pageSize === 'all' || endIdx >= totalRecords || isPageLoading}><ChevronRight className="h-4 w-4" /></Button>
              </div>
            </div>

            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table className="min-w-[2000px]">
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="w-[50px] text-center"><Checkbox checked={selectedStockIds.size === pagedJumbos.length && pagedJumbos.length > 0} onCheckedChange={() => selectedStockIds.size === pagedJumbos.length ? setSelectedStockIds(new Set()) : setSelectedStockIds(new Set(pagedJumbos.map(j => j.id)))} /></TableHead>
                      <TableHead className="w-[60px] font-black text-[10px] uppercase">S/N</TableHead>
                      <TableHead className="w-[150px]">
                        <div className="flex items-center">
                          <span className="font-black text-primary text-[10px]">ROLL ID</span>
                          <FilterControl field="rollNo" type="text" />
                          <Button variant="ghost" size="icon" className="h-6 w-6 ml-1" onClick={() => toggleSort('rollNo')}><ArrowUpDown className="h-3 w-3" /></Button>
                        </div>
                      </TableHead>
                      <TableHead className="w-[180px]">
                        <div className="flex items-center">
                          <span className="font-black text-[10px]">PAPER COMPANY</span>
                          <FilterControl field="paperCompany" type="text" />
                        </div>
                      </TableHead>
                      <TableHead className="w-[100px]">
                        <div className="flex items-center">
                          <span className="font-black text-[10px]">GSM</span>
                          <FilterControl field="gsm" type="number" />
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
                          <span className="font-black text-[10px]">SQM</span>
                          <FilterControl field="sqm" type="number" />
                        </div>
                      </TableHead>
                      <TableHead className="w-[150px]">
                        <div className="flex items-center">
                          <span className="font-black text-[10px]">STATUS</span>
                          <FilterControl field="status" type="select" options={['In Stock', 'Consumed', 'Partial']} />
                        </div>
                      </TableHead>
                      <TableHead className="text-right font-black text-[10px] uppercase">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isPageLoading ? <TableRow><TableCell colSpan={9} className="text-center py-20"><Loader2 className="animate-spin mx-auto text-primary" /></TableCell></TableRow> : pagedJumbos.map((j, index) => (
                      <TableRow key={j.id} className="hover:bg-primary/5">
                        <TableCell className="text-center"><Checkbox checked={selectedStockIds.has(j.id)} onCheckedChange={() => { const next = new Set(selectedStockIds); if (next.has(j.id)) next.delete(j.id); else next.add(j.id); setSelectedStockIds(next); }} /></TableCell>
                        <TableCell className="text-[10px] font-bold text-muted-foreground">{((currentPage - 1) * (pageSize === 'all' ? 0 : pageSize)) + index + 1}</TableCell>
                        <TableCell className="font-black text-primary font-mono text-xs">{j.rollNo}</TableCell>
                        <TableCell className="text-xs">{j.paperCompany}</TableCell>
                        <TableCell className="text-xs">{j.gsm}</TableCell>
                        <TableCell className="text-xs">{j.widthMm}mm</TableCell>
                        <TableCell className="font-bold text-xs">{j.sqm}</TableCell>
                        <TableCell><Badge className={cn("text-[10px]", j.status === 'In Stock' ? 'bg-emerald-500' : 'bg-amber-500')}>{j.status?.toUpperCase()}</Badge></TableCell>
                        <TableCell className="text-right">{isAdmin && <Button variant="ghost" size="icon" className="text-destructive h-8 w-8" onClick={() => handleSingleStockDelete(j)}><Trash2 className="h-4 w-4" /></Button>}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        {/* Other tabs remain unchanged */}
      </Tabs>

      {selectedStockIds.size > 0 && isAdmin && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 bg-zinc-900 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-6 animate-in slide-in-from-bottom-4">
          <span className="text-sm font-bold uppercase tracking-widest">{selectedStockIds.size} Selected</span>
          <Separator orientation="vertical" className="h-6 bg-white/20" />
          <Button variant="destructive" size="sm" className="font-black uppercase h-9 px-6 rounded-full" onClick={handleBulkStockDelete} disabled={isDeleting}>{isDeleting ? <Loader2 className="animate-spin h-3 w-3 mr-2" /> : <Trash2 className="h-3 w-3 mr-2" />} Delete Selected</Button>
          <Button variant="ghost" size="icon" className="h-9 w-9 text-white/60 hover:text-white" onClick={() => setSelectedStockIds(new Set())}><X className="h-4 w-4" /></Button>
        </div>
      )}
    </div>
  )
}
