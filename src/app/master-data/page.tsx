
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
  Settings, 
  Users, 
  Database, 
  Box, 
  Plus, 
  TrendingUp, 
  Ruler, 
  Truck, 
  Trash2, 
  Pencil, 
  ShieldCheck, 
  Eye, 
  Info, 
  Phone, 
  Mail, 
  Upload, 
  X,
  Globe,
  MapPin,
  Loader2,
  FlaskConical,
  Layers,
  ChevronRight,
  ShieldAlert,
  FileDown,
  Package,
  FileUp,
  Download,
  CheckCircle2,
  AlertTriangle,
  History,
  Filter,
  FilterX,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Factory,
  IdCard
} from "lucide-react"
import { useCollection, useFirestore, useMemoFirebase, useUser, useDoc } from "@/firebase"
import { collection, doc, query, where, orderBy, getDocs, writeBatch, serverTimestamp, getCountFromServer, limit, startAfter, QueryDocumentSnapshot, DocumentData, deleteDoc } from "firebase/firestore"
import { addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase/non-blocking-updates"
import { usePermissions } from "@/components/auth/permission-context"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import { Checkbox } from "@/components/ui/checkbox"
import { exportPaperStockToExcel } from "@/lib/export-utils"
import Image from "next/image"
import * as XLSX from 'xlsx'
import { cn } from "@/lib/utils"

const TEMPLATE_HEADERS = [
  "ROLL NO", "PAPER COMPANY", "PAPER TYPE", "GSM", "WIDTH (MM)", "LENGTH (MTR)", 
  "WEIGHT (KG)", "SUPPLIER", "GRN NO", "PURCHASE DATE", "RATE PER SQM", "LOCATION"
];

const SYSTEM_FIELDS = [
  { id: 'roll_no', label: 'ROLL NO (Required)' },
  { id: 'paper_company', label: 'PAPER COMPANY' },
  { id: 'paper_type', label: 'PAPER TYPE' },
  { id: 'gsm', label: 'GSM (Numeric)' },
  { id: 'width_mm', label: 'WIDTH (MM) (Numeric)' },
  { id: 'length_mtr', label: 'LENGTH (MTR) (Numeric)' },
  { id: 'weight_kg', label: 'WEIGHT (KG)' },
  { id: 'supplier', label: 'SUPPLIER' },
  { id: 'grn_number', label: 'GRN NO' },
  { id: 'purchase_date', label: 'PURCHASE DATE' },
  { id: 'rate_per_sqm', label: 'RATE PER SQM' },
  { id: 'location', label: 'LOCATION' }
];

export default function MasterDataPage() {
  const { toast } = useToast()
  const { user } = useUser()
  const firestore = useFirestore()
  const { hasPermission, roles: userRoles } = usePermissions()
  const [isMounted, setIsMounted] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [dialogType, setDialogType] = useState<"materials" | "machines" | "customers" | "cylinders" | "suppliers" | "raw_materials" | "boms">("raw_materials")
  const [editingItem, setEditingItem] = useState<any>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  
  // Selection State
  const [selectedStockIds, setSelectedStockIds] = useState<Set<string>>(new Set())

  // Stock Registry Paging State
  const [pageSize, setPageSize] = useState<number | 'all'>(20)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalRecords, setTotalRecords] = useState(0)
  const [lastVisible, setLastVisible] = useState<QueryDocumentSnapshot<DocumentData> | null>(null)
  const [pageStack, setPageStack] = useState<any[]>([null])
  const [pagedJumbos, setPagedJumbos] = useState<any[]>([])
  const [isPageLoading, setIsPageLoading] = useState(false)
  const [showFilters, setShowFilters] = useState(false)

  // Sort State
  const [sortField, setSortField] = useState('receivedDate')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  // Stock Filter State
  const [stockFilters, setStockFilters] = useState({
    rollNo: "",
    paperType: "all",
    status: "all"
  })

  // Import State
  const [isImporting, setIsImporting] = useState(false)
  const [importProgress, setImportProgress] = useState(0)
  const [importData, setImportData] = useState<any[]>([])
  const [excelHeaders, setExcelHeaders] = useState<string[]>([])
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({})
  const [importStep, setImportStep] = useState<1 | 2 | 3>(1)
  const [importSummary, setImportSummary] = useState<any>(null)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Authorization check
  const adminDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'adminUsers', user.uid);
  }, [firestore, user]);
  const { data: adminData, isLoading: adminLoading } = useDoc(adminDocRef);

  // DATA QUERIES
  const rawMaterialsQuery = useMemoFirebase(() => {
    if (!firestore || !user || !adminData) return null;
    return collection(firestore, 'raw_materials');
  }, [firestore, user, adminData])

  const suppliersQuery = useMemoFirebase(() => {
    if (!firestore || !user || !adminData) return null;
    return collection(firestore, 'suppliers');
  }, [firestore, user, adminData])

  const machinesQuery = useMemoFirebase(() => {
    if (!firestore || !user || !adminData) return null;
    return collection(firestore, 'machines');
  }, [firestore, user, adminData])

  const customersQuery = useMemoFirebase(() => {
    if (!firestore || !user || !adminData) return null;
    return collection(firestore, 'customers');
  }, [firestore, user, adminData])

  const cylindersQuery = useMemoFirebase(() => {
    if (!firestore || !user || !adminData) return null;
    return collection(firestore, 'cylinders');
  }, [firestore, user, adminData])

  const bomsQuery = useMemoFirebase(() => {
    if (!firestore || !user || !adminData) return null;
    return collection(firestore, 'boms');
  }, [firestore, user, adminData])

  const { data: rawMaterials } = useCollection(rawMaterialsQuery)
  const { data: suppliers } = useCollection(suppliersQuery)
  const { data: machines } = useCollection(machinesQuery)
  const { data: customers } = useCollection(customersQuery)
  const { data: cylinders } = useCollection(cylindersQuery)
  const { data: boms } = useCollection(bomsQuery)

  // PAPER STOCK PAGINATION LOGIC
  useEffect(() => {
    if (!firestore || !user || !adminData) return;
    const fetchCount = async () => {
      const baseRef = collection(firestore, 'jumbo_stock');
      let q = query(baseRef);
      if (stockFilters.paperType !== "all") q = query(q, where("paperType", "==", stockFilters.paperType));
      if (stockFilters.status !== "all") q = query(q, where("status", "==", stockFilters.status));
      if (stockFilters.rollNo) q = query(q, where("rollNo", "==", stockFilters.rollNo));
      const snapshot = await getCountFromServer(q);
      setTotalRecords(snapshot.data().count);
    };
    fetchCount();
    setCurrentPage(1);
    setPageStack([null]);
    setLastVisible(null);
    setSelectedStockIds(new Set());
  }, [firestore, user, adminData, stockFilters.paperType, stockFilters.status, stockFilters.rollNo]);

  useEffect(() => {
    if (!firestore || !user || !adminData) return;
    const fetchData = async () => {
      setIsPageLoading(true);
      try {
        const baseRef = collection(firestore, 'jumbo_stock');
        let q = query(baseRef, orderBy(sortField, sortOrder));
        if (stockFilters.paperType !== "all") q = query(q, where("paperType", "==", stockFilters.paperType));
        if (stockFilters.status !== "all") q = query(q, where("status", "==", stockFilters.status));
        if (stockFilters.rollNo) q = query(q, where("rollNo", "==", stockFilters.rollNo));
        const cursor = pageStack[currentPage - 1];
        if (cursor) q = query(q, startAfter(cursor));
        if (pageSize !== 'all') q = query(q, limit(pageSize as number));
        const snapshot = await getDocs(q);
        setPagedJumbos(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        if (snapshot.docs.length > 0) setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
      } finally {
        setIsPageLoading(false);
      }
    };
    fetchData();
  }, [firestore, user, adminData, pageSize, currentPage, sortField, sortOrder, stockFilters.paperType, stockFilters.status, stockFilters.rollNo, pageStack]);

  const handleNextPage = () => {
    if (currentPage * (pageSize === 'all' ? totalRecords : (pageSize as number)) < totalRecords) {
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

  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const rawData = Object.fromEntries(formData.entries())
    if (!firestore || !user) return
    
    let finalData: any = { ...rawData };
    
    // Numeric conversions
    if (dialogType === 'raw_materials') finalData.rate_per_unit = Number(rawData.rate_per_unit);
    if (dialogType === 'machines') { finalData.maxPrintingWidthMm = Number(rawData.maxPrintingWidthMm); finalData.speed = Number(rawData.speed); }
    if (dialogType === 'cylinders') { finalData.size = Number(rawData.size); finalData.teeth = Number(rawData.teeth); }
    if (dialogType === 'customers') finalData.creditDays = Number(rawData.creditDays);

    if (editingItem) {
      updateDocumentNonBlocking(doc(firestore, dialogType, editingItem.id), { ...finalData, updatedAt: new Date().toISOString(), updatedById: user.uid })
      toast({ title: "Record Updated" })
    } else {
      addDocumentNonBlocking(collection(firestore, dialogType), { ...finalData, id: crypto.randomUUID(), createdAt: new Date().toISOString(), createdById: user.uid })
      toast({ title: "Created" })
    }
    setIsDialogOpen(false)
    setEditingItem(null)
  }

  const handleMasterDelete = (type: string, id: string, name: string) => {
    if (!firestore) return
    if (confirm(`Delete "${name}" permanently?`)) {
      deleteDocumentNonBlocking(doc(firestore, type, id))
      toast({ title: "Deleted" })
    }
  }

  const handleSingleStockDelete = async (roll: any) => {
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
      } finally {
        setIsDeleting(false);
      }
    }
  }

  if (!isMounted) return <div className="flex h-[70vh] items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>

  const currentLimit = pageSize === 'all' ? totalRecords : (pageSize as number);
  const startIdx = totalRecords === 0 ? 0 : (currentPage - 1) * currentLimit + 1;
  const endIdx = pageSize === 'all' ? totalRecords : Math.min(currentPage * currentLimit, totalRecords);

  return (
    <div className="space-y-6 relative">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary uppercase">Master Control Panel</h2>
          <p className="text-muted-foreground">Manage global technical constants and resource registries.</p>
        </div>
      </div>

      <Tabs defaultValue="raw_materials" className="w-full">
        <TabsList className="bg-muted/50 p-1 mb-6 flex overflow-x-auto h-auto scrollbar-none whitespace-nowrap">
          <TabsTrigger value="raw_materials" className="gap-2 font-bold"><FlaskConical className="h-4 w-4" /> Raw Materials</TabsTrigger>
          <TabsTrigger value="paper_stock" className="gap-2 font-bold"><Package className="h-4 w-4" /> Paper Stock</TabsTrigger>
          <TabsTrigger value="boms" className="gap-2 font-bold"><Layers className="h-4 w-4" /> BOM Master</TabsTrigger>
          <TabsTrigger value="suppliers" className="gap-2 font-bold"><Truck className="h-4 w-4" /> Suppliers</TabsTrigger>
          <TabsTrigger value="machines" className="gap-2 font-bold"><Factory className="h-4 w-4" /> Machines</TabsTrigger>
          <TabsTrigger value="cylinders" className="gap-2 font-bold"><Ruler className="h-4 w-4" /> Cylinders</TabsTrigger>
          <TabsTrigger value="customers" className="gap-2 font-bold"><Users className="h-4 w-4" /> Clients</TabsTrigger>
        </TabsList>
        
        {/* RAW MATERIALS TAB */}
        <TabsContent value="raw_materials">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div><CardTitle>Raw Material Registry</CardTitle><CardDescription>Manage inks, varnishes, and other consumables.</CardDescription></div>
              <Button onClick={() => { setDialogType("raw_materials"); setEditingItem(null); setIsDialogOpen(true); }}><Plus className="h-4 w-4 mr-2" /> Add Material</Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Category</TableHead><TableHead>Unit</TableHead><TableHead>Rate (₹)</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
                <TableBody>
                  {rawMaterials?.map((rm) => (
                    <TableRow key={rm.id}>
                      <TableCell className="font-bold">{rm.name}</TableCell>
                      <TableCell><Badge variant="secondary" className="uppercase text-[9px]">{rm.category}</Badge></TableCell>
                      <TableCell className="uppercase text-xs">{rm.unit}</TableCell>
                      <TableCell>₹{rm.rate_per_unit}</TableCell>
                      <TableCell className="text-right flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => { setEditingItem(rm); setDialogType("raw_materials"); setIsDialogOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleMasterDelete("raw_materials", rm.id, rm.name)}><Trash2 className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* PAPER STOCK TAB (Advanced Pagination & Bulk Controls) */}
        <TabsContent value="paper_stock" className="space-y-6">
          <Card className="border-none shadow-xl">
            <CardHeader className="flex flex-col md:flex-row md:items-center justify-between bg-primary/5 gap-4">
              <div>
                <CardTitle className="flex items-center gap-2"><Package className="h-5 w-5 text-primary" /> Jumbo Substrate Registry</CardTitle>
                <CardDescription>Transactional stock directory with pagination and bulk management.</CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                {isAdmin && (
                  <>
                    <Button variant="outline" size="sm" onClick={() => { 
                      const ws = XLSX.utils.json_to_sheet([], { header: TEMPLATE_HEADERS });
                      const wb = XLSX.utils.book_new();
                      XLSX.utils.book_append_sheet(wb, ws, "Template");
                      XLSX.writeFile(wb, "stock_template.xlsx");
                    }}><Download className="h-4 w-4 mr-2" /> Template</Button>
                    <Button variant="outline" size="sm" onClick={() => { setImportStep(1); setIsImportDialogOpen(true); }} className="border-primary text-primary"><FileUp className="h-4 w-4 mr-2" /> Upload Excel</Button>
                  </>
                )}
                <Button variant="outline" size="sm" onClick={async () => {
                  setIsExporting(true);
                  try { await exportPaperStockToExcel(firestore); toast({title: "Export Success"}); } finally { setIsExporting(false); }
                }} disabled={isExporting}>{isExporting ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <FileDown className="h-4 w-4 mr-2" />} Export All</Button>
              </div>
            </CardHeader>

            <div className="p-4 border-b bg-muted/10 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
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
                  <div className="text-[10px] font-bold text-muted-foreground uppercase bg-background px-3 py-1.5 rounded-full border border-primary/10">
                    {totalRecords > 0 ? <>Showing <span className="text-primary">{startIdx}–{endIdx}</span> of {totalRecords.toLocaleString()}</> : "No records"}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={handlePrevPage} disabled={currentPage === 1 || isPageLoading}><ChevronLeft className="h-4 w-4" /></Button>
                  <Badge variant="secondary" className="h-8 px-3 text-xs font-black">PAGE {currentPage}</Badge>
                  <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={handleNextPage} disabled={pageSize === 'all' || endIdx >= totalRecords || isPageLoading}><ChevronRight className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="sm" className="h-8 px-2 text-[10px] font-bold" onClick={() => setShowFilters(!showFilters)}><Filter className="h-3 w-3 mr-1" /> {showFilters ? 'Hide' : 'Show'} Filters</Button>
                </div>
              </div>
              {showFilters && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-background border rounded-xl animate-in fade-in">
                  <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase">Paper Type</Label><Select value={stockFilters.paperType} onValueChange={val => setStockFilters({...stockFilters, paperType: val})}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Types</SelectItem>{rawMaterials?.filter(rm => rm.category === 'Paper').map(m => <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>)}</SelectContent></Select></div>
                  <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase">Status</Label><Select value={stockFilters.status} onValueChange={val => setStockFilters({...stockFilters, status: val})}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Status</SelectItem><SelectItem value="In Stock">In Stock</SelectItem><SelectItem value="Consumed">Consumed</SelectItem></SelectContent></Select></div>
                  <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase">Roll ID</Label><Input className="h-9" value={stockFilters.rollNo} onChange={e => setStockFilters({...stockFilters, rollNo: e.target.value})} placeholder="Search ID..." /></div>
                  <div className="flex items-end gap-2"><Button variant="outline" className="h-9 flex-1" onClick={() => setStockFilters({rollNo: "", paperType: "all", status: "all"})}><FilterX className="h-4 w-4 mr-2" /> Reset</Button></div>
                </div>
              )}
            </div>

            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="w-[50px] text-center"><Checkbox checked={selectedStockIds.size === pagedJumbos.length && pagedJumbos.length > 0} onCheckedChange={() => selectedStockIds.size === pagedJumbos.length ? setSelectedStockIds(new Set()) : setSelectedStockIds(new Set(pagedJumbos.map(j => j.id)))} /></TableHead>
                    <TableHead className="font-black text-[10px] uppercase">Roll ID</TableHead><TableHead className="font-black text-[10px] uppercase">Paper Type</TableHead><TableHead className="font-black text-[10px] uppercase">GSM</TableHead><TableHead className="font-black text-[10px] uppercase">SQM</TableHead><TableHead className="font-black text-[10px] uppercase">Status</TableHead><TableHead className="text-right font-black text-[10px] uppercase">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isPageLoading ? <TableRow><TableCell colSpan={7} className="text-center py-20"><Loader2 className="animate-spin mx-auto text-primary" /></TableCell></TableRow> : pagedJumbos.map((j) => (
                    <TableRow key={j.id} className="hover:bg-primary/5">
                      <TableCell className="text-center"><Checkbox checked={selectedStockIds.has(j.id)} onCheckedChange={() => { const next = new Set(selectedStockIds); if (next.has(j.id)) next.delete(j.id); else next.add(j.id); setSelectedStockIds(next); }} /></TableCell>
                      <TableCell className="font-black text-primary font-mono text-xs">{j.rollNo}</TableCell><TableCell className="text-xs">{j.paperType}</TableCell><TableCell className="text-xs">{j.gsm}</TableCell><TableCell className="font-bold text-xs">{j.sqm}</TableCell><TableCell><Badge className={cn("text-[10px]", j.status === 'In Stock' ? 'bg-emerald-500' : 'bg-amber-500')}>{j.status?.toUpperCase()}</Badge></TableCell>
                      <TableCell className="text-right">{isAdmin && <Button variant="ghost" size="icon" className="text-destructive h-8 w-8" onClick={() => handleSingleStockDelete(j)}><Trash2 className="h-4 w-4" /></Button>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* BOM MASTER TAB */}
        <TabsContent value="boms">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div><CardTitle>BOM Templates</CardTitle><CardDescription>Manage Bill of Materials masters.</CardDescription></div>
              <Button onClick={() => { setDialogType("boms"); setEditingItem(null); setIsDialogOpen(true); }}><Plus className="h-4 w-4 mr-2" /> Create Template</Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>BOM Number</TableHead><TableHead>Description</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
                <TableBody>
                  {boms?.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="font-mono text-xs font-bold text-primary">{b.bomNumber}</TableCell>
                      <TableCell className="text-xs">{b.description}</TableCell>
                      <TableCell><Badge variant="outline">{b.status}</Badge></TableCell>
                      <TableCell className="text-right flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => { setEditingItem(b); setDialogType("boms"); setIsDialogOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleMasterDelete("boms", b.id, b.bomNumber)}><Trash2 className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SUPPLIERS TAB */}
        <TabsContent value="suppliers">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div><CardTitle>Supplier Directory</CardTitle><CardDescription>Manage raw material vendors.</CardDescription></div>
              <Button onClick={() => { setDialogType("suppliers"); setEditingItem(null); setIsDialogOpen(true); }}><Plus className="h-4 w-4 mr-2" /> Add Supplier</Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Vendor Name</TableHead><TableHead>Contact</TableHead><TableHead>Email</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
                <TableBody>
                  {suppliers?.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-bold">{s.name}</TableCell>
                      <TableCell className="text-xs">{s.phone}</TableCell>
                      <TableCell className="text-xs">{s.email}</TableCell>
                      <TableCell className="text-right flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => { setEditingItem(s); setDialogType("suppliers"); setIsDialogOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleMasterDelete("suppliers", s.id, s.name)}><Trash2 className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* MACHINES TAB */}
        <TabsContent value="machines">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div><CardTitle>Machine Registry</CardTitle><CardDescription>Production lines and press specifications.</CardDescription></div>
              <Button onClick={() => { setDialogType("machines"); setEditingItem(null); setIsDialogOpen(true); }}><Plus className="h-4 w-4 mr-2" /> Add Machine</Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Machine Name</TableHead><TableHead>Max Width</TableHead><TableHead>Speed (m/min)</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
                <TableBody>
                  {machines?.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-bold">{m.name}</TableCell>
                      <TableCell className="text-xs">{m.maxPrintingWidthMm}mm</TableCell>
                      <TableCell className="text-xs">{m.speed}</TableCell>
                      <TableCell className="text-right flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => { setEditingItem(m); setDialogType("machines"); setIsDialogOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleMasterDelete("machines", m.id, m.name)}><Trash2 className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* CYLINDERS TAB */}
        <TabsContent value="cylinders">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div><CardTitle>Cylinder Library</CardTitle><CardDescription>Track printing tool sizes and teeth counts.</CardDescription></div>
              <Button onClick={() => { setDialogType("cylinders"); setEditingItem(null); setIsDialogOpen(true); }}><Plus className="h-4 w-4 mr-2" /> Add Cylinder</Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Cylinder Size</TableHead><TableHead>Teeth</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
                <TableBody>
                  {cylinders?.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-bold">{c.size}mm</TableCell>
                      <TableCell className="text-xs">{c.teeth}</TableCell>
                      <TableCell><Badge variant="outline">{c.status || 'Available'}</Badge></TableCell>
                      <TableCell className="text-right flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => { setEditingItem(c); setDialogType("cylinders"); setIsDialogOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleMasterDelete("cylinders", c.id, `${c.size}mm`)}><Trash2 className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* CUSTOMERS TAB */}
        <TabsContent value="customers">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div><CardTitle>Client Registry</CardTitle><CardDescription>Customer account management and credit settings.</CardDescription></div>
              <Button onClick={() => { setDialogType("customers"); setEditingItem(null); setIsDialogOpen(true); }}><Plus className="h-4 w-4 mr-2" /> Add Client</Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Company Name</TableHead><TableHead>Location</TableHead><TableHead>Credit Days</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
                <TableBody>
                  {customers?.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-bold">{c.companyName}</TableCell>
                      <TableCell className="text-xs truncate max-w-[150px]">{c.city || 'N/A'}</TableCell>
                      <TableCell className="text-xs">{c.creditDays} Days</TableCell>
                      <TableCell className="text-right flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => { setEditingItem(c); setDialogType("customers"); setIsDialogOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleMasterDelete("customers", c.id, c.companyName)}><Trash2 className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* FLOATING ACTION BAR FOR BULK STOCK DELETE */}
      {selectedStockIds.size > 0 && isAdmin && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 bg-zinc-900 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-6 animate-in slide-in-from-bottom-4">
          <span className="text-sm font-bold uppercase tracking-widest">{selectedStockIds.size} Selected</span>
          <Separator orientation="vertical" className="h-6 bg-white/20" />
          <Button variant="destructive" size="sm" className="font-black uppercase h-9 px-6 rounded-full" onClick={handleBulkStockDelete} disabled={isDeleting}>
            {isDeleting ? <Loader2 className="animate-spin h-3 w-3 mr-2" /> : <Trash2 className="h-3 w-3 mr-2" />} Delete Selected
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9 text-white/60 hover:text-white" onClick={() => setSelectedStockIds(new Set())}><X className="h-4 w-4" /></Button>
        </div>
      )}

      {/* MULTI-PURPOSE CRUD DIALOG */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <form onSubmit={handleSave}>
            <DialogHeader><DialogTitle className="uppercase font-black">{editingItem ? 'Edit' : 'Create'} {dialogType.replace(/_/g, ' ')}</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2"><Label className="text-[10px] font-black uppercase">Official Name / ID</Label><Input name={dialogType === 'cylinders' ? 'size' : 'name'} defaultValue={editingItem?.name || editingItem?.size} required /></div>
              
              {dialogType === 'raw_materials' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label className="text-[10px] uppercase font-bold">Category</Label><Input name="category" defaultValue={editingItem?.category} placeholder="e.g. Ink" /></div>
                  <div className="space-y-2"><Label className="text-[10px] uppercase font-bold">Base Rate (₹)</Label><Input name="rate_per_unit" type="number" step="0.01" defaultValue={editingItem?.rate_per_unit} /></div>
                </div>
              )}

              {dialogType === 'machines' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label className="text-[10px] uppercase font-bold">Max Width (mm)</Label><Input name="maxPrintingWidthMm" type="number" defaultValue={editingItem?.maxPrintingWidthMm} /></div>
                  <div className="space-y-2"><Label className="text-[10px] uppercase font-bold">Speed (m/min)</Label><Input name="speed" type="number" defaultValue={editingItem?.speed} /></div>
                </div>
              )}

              {dialogType === 'cylinders' && (
                <div className="space-y-2"><Label className="text-[10px] uppercase font-bold">Total Teeth Count</Label><Input name="teeth" type="number" defaultValue={editingItem?.teeth} /></div>
              )}

              {dialogType === 'suppliers' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label className="text-[10px] uppercase font-bold">Phone</Label><Input name="phone" defaultValue={editingItem?.phone} /></div>
                  <div className="space-y-2"><Label className="text-[10px] uppercase font-bold">Email</Label><Input name="email" type="email" defaultValue={editingItem?.email} /></div>
                </div>
              )}

              {dialogType === 'customers' && (
                <>
                  <div className="space-y-2"><Label className="text-[10px] uppercase font-bold">Company Name</Label><Input name="companyName" defaultValue={editingItem?.companyName} required /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label className="text-[10px] uppercase font-bold">City</Label><Input name="city" defaultValue={editingItem?.city} /></div>
                    <div className="space-y-2"><Label className="text-[10px] uppercase font-bold">Credit Limit (Days)</Label><Input name="creditDays" type="number" defaultValue={editingItem?.creditDays || 30} /></div>
                  </div>
                </>
              )}
            </div>
            <DialogFooter><Button type="submit" className="w-full font-black uppercase tracking-widest h-12">Commit Record</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* BULK IMPORT DIALOG */}
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{isImporting ? "Importing Stock..." : importStep === 3 ? "Import Completed" : "Excel Stock Import"}</DialogTitle></DialogHeader>
          {importStep === 1 && (
            <div className="py-10 text-center border-2 border-dashed rounded-2xl bg-muted/10 relative hover:bg-muted/20">
              <input type="file" accept=".xlsx,.xls" onChange={(e) => {
                const file = e.target.files?.[0]; if (!file) return;
                const reader = new FileReader(); reader.onload = (evt) => {
                  try { const wb = XLSX.read(evt.target?.result, { type: 'binary' }); const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]); setImportData(data); setExcelHeaders(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 })[0] as string[]); setImportStep(2); } catch (err) { toast({ variant: "destructive", title: "Parsing Error" }); }
                }; reader.readAsBinaryString(file);
              }} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
              <FileUp className="h-12 w-12 text-primary mx-auto mb-4" /><p className="font-black">Click or Drag Excel File</p><Button size="sm" className="mt-4">Browse Files</Button>
            </div>
          )}
          {importStep === 2 && (
            <div className="space-y-6">
              <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-lg flex items-center justify-between"><p className="text-sm font-bold text-emerald-800">{importData.length} Rows Found. Map columns.</p><Button variant="outline" size="sm" onClick={() => setImportStep(1)}>Change File</Button></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border p-4 rounded-xl">{SYSTEM_FIELDS.map(f => (
                <div key={f.id} className="space-y-1"><Label className="text-[10px] font-black uppercase text-muted-foreground">{f.label}</Label><Select value={columnMapping[f.id] || ""} onValueChange={val => setColumnMapping({...columnMapping, [f.id]: val})}><SelectTrigger className="h-9"><SelectValue placeholder="Excel Column" /></SelectTrigger><SelectContent>{excelHeaders.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent></Select></div>
              ))}</div>
              {isImporting && <div className="space-y-2"><div className="flex justify-between text-[10px] font-black uppercase text-primary"><span>Processing Chunks...</span><span>{importProgress}%</span></div><Progress value={importProgress} className="h-2" /></div>}
              <Button onClick={async () => {
                setIsImporting(true); setImportProgress(0); let successCount = 0; let skipCount = 0;
                try {
                  const existingSnap = await getDocs(collection(firestore, 'jumbo_stock')); const existingRolls = new Set(existingSnap.docs.map(d => d.data().rollNo));
                  for (let i = 0; i < importData.length; i += 200) {
                    const batch = writeBatch(firestore); const chunk = importData.slice(i, i + 200);
                    chunk.forEach((row: any) => {
                      const rollNo = String(row[columnMapping['roll_no']] || "").trim();
                      if (!rollNo || existingRolls.has(rollNo)) { skipCount++; return; }
                      const width = Number(row[columnMapping['width_mm']]) || 0; const length = Number(row[columnMapping['length_mtr']]) || 0;
                      batch.set(doc(collection(firestore, 'jumbo_stock')), { rollNo, paperCompany: row[columnMapping['paper_company']] || "Unknown", paperType: row[columnMapping['paper_type']] || "Standard", gsm: Number(row[columnMapping['gsm']]) || 0, widthMm: width, lengthMeters: length, sqm: Number((width * length / 1000).toFixed(2)), status: "In Stock", receivedDate: row[columnMapping['purchase_date']] || new Date().toISOString().split('T')[0], createdAt: new Date().toISOString(), createdById: user.uid });
                      existingRolls.add(rollNo); successCount++;
                    });
                    await batch.commit(); setImportProgress(Math.round((Math.min(i + 200, importData.length) / importData.length) * 100));
                  }
                  setImportSummary({ total: importData.length, success: successCount, skipped: skipCount, errors: 0 }); setImportStep(3);
                } finally { setIsImporting(false); }
              }} disabled={isImporting || !columnMapping['roll_no']} className="w-full h-12 font-black uppercase">Execute Multi-Stock Import</Button>
            </div>
          )}
          {importStep === 3 && (
            <div className="py-10 text-center space-y-6"><CheckCircle2 className="h-16 w-16 text-emerald-500 mx-auto" /><div><h3 className="text-xl font-black">Success!</h3><p className="text-muted-foreground">Process complete.</p></div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-muted/20 rounded-xl"><p className="text-[10px] font-bold">Total</p><p className="text-2xl font-black">{importSummary?.total}</p></div>
                <div className="p-4 bg-emerald-50 rounded-xl"><p className="text-[10px] font-bold">Added</p><p className="text-2xl font-black text-emerald-600">{importSummary?.success}</p></div>
                <div className="p-4 bg-amber-50 rounded-xl"><p className="text-[10px] font-bold">Skipped</p><p className="text-2xl font-black text-amber-600">{importSummary?.skipped}</p></div>
                <div className="p-4 bg-destructive/5 rounded-xl"><p className="text-[10px] font-bold">Errors</p><p className="text-2xl font-black text-destructive">0</p></div>
              </div>
              <Button onClick={() => setIsImportDialogOpen(false)} className="w-full">Close Registry</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
