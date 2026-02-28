
"use client"

import { useState, useMemo, useEffect } from "react"
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
  DialogFooter
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
  ArrowUpDown, 
  X, 
  FileDown, 
  FileUp, 
  Settings2,
  Search,
  FilterX,
  Calendar
} from "lucide-react"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import { useCollection, useFirestore, useMemoFirebase, useUser, useDoc } from "@/firebase"
import { collection, doc, query, where, orderBy, getDocs, writeBatch, serverTimestamp, getCountFromServer, limit, startAfter, QueryDocumentSnapshot, DocumentData, deleteDoc, onSnapshot } from "firebase/firestore"
import { updateDocumentNonBlocking, addDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase/non-blocking-updates"
import { exportPaperStockToExcel } from "@/lib/export-utils"
import { cn } from "@/lib/utils"

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

export default function MasterDataPage() {
  const { toast } = useToast()
  const { user } = useUser()
  const firestore = useFirestore()
  const [isMounted, setIsMounted] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [dialogType, setDialogType] = useState<any>("raw_materials")
  const [editingItem, setEditingItem] = useState<any>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  
  // Selection & Pagination
  const [selectedStockIds, setSelectedStockIds] = useState<Set<string>>(new Set())
  const [pageSize, setPageSize] = useState<number>(20)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalRecords, setTotalRecords] = useState(0)
  const [lastVisible, setLastVisible] = useState<QueryDocumentSnapshot<DocumentData> | null>(null)
  const [pageStack, setPageStack] = useState<any[]>([null])
  const [pagedJumbos, setPagedJumbos] = useState<any[]>([])
  const [isPageLoading, setIsPageLoading] = useState(false)
  
  // Sort & Advanced Filter State
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

  // Authorization Check
  const adminDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'adminUsers', user.uid);
  }, [firestore, user]);
  const { data: adminData, isLoading: adminCheckLoading } = useDoc(adminDocRef);
  const isAdmin = !!adminData;

  // Static Queries for non-paginated tabs
  const rawMaterialsQuery = useMemoFirebase(() => (!firestore || !isAdmin) ? null : collection(firestore, 'raw_materials'), [firestore, isAdmin])
  const suppliersQuery = useMemoFirebase(() => (!firestore || !isAdmin) ? null : collection(firestore, 'suppliers'), [firestore, isAdmin])
  const machinesQuery = useMemoFirebase(() => (!firestore || !isAdmin) ? null : collection(firestore, 'machines'), [firestore, isAdmin])
  const customersQuery = useMemoFirebase(() => (!firestore || !isAdmin) ? null : collection(firestore, 'customers'), [firestore, isAdmin])
  const cylindersQuery = useMemoFirebase(() => (!firestore || !isAdmin) ? null : collection(firestore, 'cylinders'), [firestore, isAdmin])

  const { data: rawMaterials } = useCollection(rawMaterialsQuery)
  const { data: suppliers } = useCollection(suppliersQuery)
  const { data: machines } = useCollection(machinesQuery)
  const { data: customers } = useCollection(customersQuery)
  const { data: cylinders } = useCollection(cylindersQuery)

  // Sync unique values for filters
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

  // Query Builder Utility
  const buildBaseQuery = (isCount = false) => {
    if (!firestore) return null;
    let q = collection(firestore, 'jumbo_stock');
    let constraints: any[] = [];

    // Multi-selects
    if (filters.companies.length > 0) constraints.push(where('paperCompany', 'in', filters.companies.slice(0, 10)));
    if (filters.types.length > 0) constraints.push(where('paperType', 'in', filters.types.slice(0, 10)));
    if (filters.gsms.length > 0) constraints.push(where('gsm', 'in', filters.gsms.slice(0, 10).map(Number)));
    if (filters.suppliers.length > 0) constraints.push(where('supplier', 'in', filters.suppliers.slice(0, 10)));
    if (filters.locations.length > 0) constraints.push(where('location', 'in', filters.locations.slice(0, 10)));
    if (filters.statuses.length > 0) constraints.push(where('status', 'in', filters.statuses.slice(0, 10)));

    // Equality
    if (filters.width) constraints.push(where('widthMm', '==', Number(filters.width)));
    if (filters.length) constraints.push(where('lengthMeters', '==', Number(filters.length)));

    // Range (Single field limitation)
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

  // Load Paginated Data
  useEffect(() => {
    if (!firestore || !isAdmin) return;
    const load = async () => {
      setIsPageLoading(true);
      try {
        const countQ = buildBaseQuery(true);
        if (countQ) {
          const countSnap = await getCountFromServer(countQ);
          setTotalRecords(countSnap.data().count);
        }

        const dataQ = buildBaseQuery();
        if (dataQ) {
          const snap = await getDocs(dataQ);
          setPagedJumbos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
          if (snap.docs.length > 0) setLastVisible(snap.docs[snap.docs.length - 1]);
        }
      } catch (e) {
        console.error(e);
        toast({ variant: "destructive", title: "Complex Query", description: "This filter combination requires a Firestore index." });
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

  const handleExport = async () => {
    if (!firestore) return;
    setIsExporting(true);
    try {
      await exportPaperStockToExcel(firestore, filters as any);
      toast({ title: "Export Started" });
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

  const handleBulkDelete = async () => {
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

  const activeFiltersCount = Object.entries(filters).reduce((acc, [k, v]) => {
    if (Array.isArray(v)) return acc + v.length;
    return v ? acc + 1 : acc;
  }, 0);

  if (!isMounted || adminCheckLoading) return <div className="flex h-[70vh] items-center justify-center"><Loader2 className="animate-spin" /></div>

  const startIdx = totalRecords === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endIdx = Math.min(currentPage * pageSize, totalRecords);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h2 className="text-3xl font-bold tracking-tight text-primary uppercase">Master Control Panel</h2><p className="text-muted-foreground font-medium">Technical constants and advanced inventory management.</p></div>
      </div>

      <Tabs defaultValue="raw_materials" className="w-full">
        <TabsList className="bg-muted/50 p-1 mb-6 flex overflow-x-auto h-auto whitespace-nowrap">
          <TabsTrigger value="raw_materials" className="gap-2 font-bold"><FlaskConical className="h-4 w-4" /> Raw Materials</TabsTrigger>
          <TabsTrigger value="paper_stock" className="gap-2 font-bold"><Package className="h-4 w-4" /> Paper Stock</TabsTrigger>
          <TabsTrigger value="boms" className="gap-2 font-bold"><Layers className="h-4 w-4" /> BOM Master</TabsTrigger>
          <TabsTrigger value="suppliers" className="gap-2 font-bold"><Truck className="h-4 w-4" /> Suppliers</TabsTrigger>
          <TabsTrigger value="machines" className="gap-2 font-bold"><Factory className="h-4 w-4" /> Machines</TabsTrigger>
          <TabsTrigger value="cylinders" className="gap-2 font-bold"><Ruler className="h-4 w-4" /> Cylinders</TabsTrigger>
          <TabsTrigger value="customers" className="gap-2 font-bold"><Users className="h-4 w-4" /> Clients</TabsTrigger>
        </TabsList>
        
        <TabsContent value="paper_stock">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)} className={cn(activeFiltersCount > 0 && "border-primary text-primary")}>
                  <Settings2 className="h-4 w-4 mr-2" /> Advanced Filters {activeFiltersCount > 0 && `(${activeFiltersCount})`}
                </Button>
                {activeFiltersCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={() => setFilters(INITIAL_FILTERS)} className="text-destructive">
                    <FilterX className="h-4 w-4 mr-2" /> Reset
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => {}} className="border-primary text-primary"><FileUp className="h-4 w-4 mr-2" /> Upload Excel</Button>
                <Button variant="outline" size="sm" onClick={handleExport} disabled={isExporting}>{isExporting ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <FileDown className="h-4 w-4 mr-2" />} Export</Button>
              </div>
            </div>

            {showFilters && (
              <Card className="bg-muted/30 border-dashed">
                <CardContent className="p-4 grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase">Lot Number Search</Label>
                    <Input placeholder="Lot prefix..." value={filters.lotNo} onChange={(e) => handleFilterChange('lotNo', e.target.value)} className="h-8 text-xs bg-background" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase">GRN Search</Label>
                    <Input placeholder="GRN prefix..." value={filters.grnNo} onChange={(e) => handleFilterChange('grnNo', e.target.value)} className="h-8 text-xs bg-background" />
                  </div>
                  <div className="md:col-span-2 space-y-1">
                    <Label className="text-[10px] font-black uppercase">Date Range</Label>
                    <div className="flex items-center gap-2">
                      <Input type="date" value={filters.startDate} onChange={(e) => handleFilterChange('startDate', e.target.value)} className="h-8 text-xs bg-background" />
                      <Input type="date" value={filters.endDate} onChange={(e) => handleFilterChange('endDate', e.target.value)} className="h-8 text-xs bg-background" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="border-none shadow-xl overflow-hidden">
              <div className="p-4 bg-muted/10 border-b flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <Select value={pageSize.toString()} onValueChange={(v) => setPageSize(Number(v))}>
                    <SelectTrigger className="w-[100px] h-8 text-[10px] font-black"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[10, 20, 50, 100].map(v => <SelectItem key={v} value={v.toString()}>{v} Rows</SelectItem>)}
                    </SelectContent>
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
                        <TableHead className="w-[50px] sticky left-0 bg-muted/30 z-20"><Checkbox checked={selectedStockIds.size === pagedJumbos.length && pagedJumbos.length > 0} onCheckedChange={() => selectedStockIds.size === pagedJumbos.length ? setSelectedStockIds(new Set()) : setSelectedStockIds(new Set(pagedJumbos.map(j => j.id)))} /></TableHead>
                        <TableHead className="w-[60px] text-center font-black text-[10px] uppercase sticky left-[50px] bg-muted/30 z-20">S/N</TableHead>
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
                        <TableHead className="text-right sticky right-0 bg-muted/30 z-20 font-black text-[10px]">ACTION</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isPageLoading ? <TableRow><TableCell colSpan={22} className="text-center py-20"><Loader2 className="animate-spin mx-auto text-primary" /></TableCell></TableRow> : pagedJumbos.map((j, index) => (
                        <TableRow key={j.id} className="hover:bg-primary/5 h-12">
                          <TableCell className="sticky left-0 bg-background z-10"><Checkbox checked={selectedStockIds.has(j.id)} onCheckedChange={() => { const next = new Set(selectedStockIds); if (next.has(j.id)) next.delete(j.id); else next.add(j.id); setSelectedStockIds(next); }} /></TableCell>
                          <TableCell className="text-center font-bold text-[10px] text-muted-foreground sticky left-[50px] bg-background z-10">{(currentPage - 1) * pageSize + index + 1}</TableCell>
                          <TableCell className="font-black text-primary font-mono text-xs">{j.rollNo}</TableCell>
                          <TableCell className="text-[11px] font-bold">{j.paperCompany}</TableCell>
                          <TableCell className="text-[11px]">{j.paperType}</TableCell>
                          <TableCell className="text-[11px]">{j.widthMm}mm</TableCell>
                          <TableCell className="text-[11px]">{j.lengthMeters}m</TableCell>
                          <TableCell className="text-[11px] font-black">{j.sqm}</TableCell>
                          <TableCell className="text-[11px]">{j.gsm}</TableCell>
                          <TableCell className="text-[11px]">{j.weightKg}kg</TableCell>
                          <TableCell className="text-[11px] text-emerald-700">₹{j.purchaseRate?.toLocaleString()}</TableCell>
                          <TableCell className="text-[11px]">{j.wastage}%</TableCell>
                          <TableCell className="text-[10px]">{j.dateOfUse || '-'}</TableCell>
                          <TableCell className="text-[10px] font-bold">{j.receivedDate}</TableCell>
                          <TableCell className="text-[11px] font-mono">{j.jobNo || '-'}</TableCell>
                          <TableCell className="text-[11px]">{j.size || '-'}</TableCell>
                          <TableCell className="text-[11px]">{j.productName || '-'}</TableCell>
                          <TableCell className="text-[11px] font-mono">{j.code || '-'}</TableCell>
                          <TableCell className="text-[11px] font-mono font-bold text-accent">{j.lotNo}</TableCell>
                          <TableCell className="text-[10px]">{j.date || '-'}</TableCell>
                          <TableCell className="text-[11px] font-mono">{j.companyRollNo || '-'}</TableCell>
                          <TableCell className="text-right sticky right-0 bg-background z-10"><Button variant="ghost" size="icon" className="text-destructive h-8 w-8" onClick={() => handleSingleDelete(j)}><Trash2 className="h-4 w-4" /></Button></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="raw_materials">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div><CardTitle>Raw Material Catalog</CardTitle><CardDescription>Manage unit costs for inks, varnishes, and base substrates.</CardDescription></div>
              <Button onClick={() => { setDialogType("raw_materials"); setEditingItem(null); setIsDialogOpen(true); }}><Plus className="mr-2 h-4 w-4" /> Add Material</Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Material Name</TableHead><TableHead>Unit</TableHead><TableHead>Rate (₹)</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {rawMaterials?.map((m) => (
                    <TableRow key={m.id}><TableCell className="font-bold">{m.name}</TableCell><TableCell>{m.unit}</TableCell><TableCell>₹{m.rate_per_unit}</TableCell>
                      <TableCell className="text-right flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => { setEditingItem(m); setDialogType("raw_materials"); setIsDialogOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => { if(confirm('Delete?')) deleteDocumentNonBlocking(doc(firestore!, 'raw_materials', m.id)) }}><Trash2 className="h-4 w-4" /></Button>
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
              <div><CardTitle>Vendor Directory</CardTitle><CardDescription>Supplier contact details and material sourcing history.</CardDescription></div>
              <Button onClick={() => { setDialogType("suppliers"); setEditingItem(null); setIsDialogOpen(true); }}><Plus className="mr-2 h-4 w-4" /> Add Supplier</Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Company Name</TableHead><TableHead>Contact</TableHead><TableHead>Location</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {suppliers?.map((s) => (
                    <TableRow key={s.id}><TableCell className="font-bold">{s.name}</TableCell><TableCell>{s.contactPerson}</TableCell><TableCell>{s.location}</TableCell>
                      <TableCell className="text-right flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => { setEditingItem(s); setDialogType("suppliers"); setIsDialogOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => { if(confirm('Delete?')) deleteDocumentNonBlocking(doc(firestore!, 'suppliers', s.id)) }}><Trash2 className="h-4 w-4" /></Button>
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
              <div><CardTitle>Production Lines</CardTitle><CardDescription>Printing press technical limits and capacity settings.</CardDescription></div>
              <Button onClick={() => { setDialogType("machines"); setEditingItem(null); setIsDialogOpen(true); }}><Plus className="mr-2 h-4 w-4" /> Add Machine</Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Machine Name</TableHead><TableHead>Width (mm)</TableHead><TableHead>Speed (m/min)</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {machines?.map((m) => (
                    <TableRow key={m.id}><TableCell className="font-bold">{m.name}</TableCell><TableCell>{m.maxPrintingWidthMm}</TableCell><TableCell>{m.speed}</TableCell>
                      <TableCell className="text-right flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => { setEditingItem(m); setDialogType("machines"); setIsDialogOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => { if(confirm('Delete?')) deleteDocumentNonBlocking(doc(firestore!, 'machines', m.id)) }}><Trash2 className="h-4 w-4" /></Button>
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
              <div><CardTitle>Cylinder & Plate Master</CardTitle><CardDescription>Inventory of printing tools indexed by repeat size.</CardDescription></div>
              <Button onClick={() => { setDialogType("cylinders"); setEditingItem(null); setIsDialogOpen(true); }}><Plus className="mr-2 h-4 w-4" /> Add Cylinder</Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Cylinder Size</TableHead><TableHead>Teeth</TableHead><TableHead>Location</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {cylinders?.map((c) => (
                    <TableRow key={c.id}><TableCell className="font-bold">{c.size} mm</TableCell><TableCell>{c.teeth} T</TableCell><TableCell>{c.location}</TableCell>
                      <TableCell className="text-right flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => { setEditingItem(c); setDialogType("cylinders"); setIsDialogOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => { if(confirm('Delete?')) deleteDocumentNonBlocking(doc(firestore!, 'cylinders', c.id)) }}><Trash2 className="h-4 w-4" /></Button>
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
              <div><CardTitle>Client Ledger Registry</CardTitle><CardDescription>Manage customer profiles and credit limits.</CardDescription></div>
              <Button onClick={() => { setDialogType("customers"); setEditingItem(null); setIsDialogOpen(true); }}><Plus className="mr-2 h-4 w-4" /> Add Client</Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Company Name</TableHead><TableHead>Sales Rep</TableHead><TableHead>Credit Days</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {customers?.map((c) => (
                    <TableRow key={c.id}><TableCell className="font-bold">{c.companyName}</TableCell><TableCell>{c.sales_owner_name}</TableCell><TableCell>{c.creditDays} days</TableCell>
                      <TableCell className="text-right flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => { setEditingItem(c); setDialogType("customers"); setIsDialogOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => { if(confirm('Delete?')) deleteDocumentNonBlocking(doc(firestore!, 'customers', c.id)) }}><Trash2 className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {selectedStockIds.size > 0 && isAdmin && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 bg-zinc-900 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-6 animate-in slide-in-from-bottom-4">
          <span className="text-sm font-bold uppercase tracking-widest">{selectedStockIds.size} Selected</span>
          <Separator orientation="vertical" className="h-6 bg-white/20" />
          <Button variant="destructive" size="sm" className="font-black uppercase h-9 px-6 rounded-full" onClick={handleBulkDelete} disabled={isDeleting}>{isDeleting ? <Loader2 className="animate-spin h-3 w-3 mr-2" /> : <Trash2 className="h-3 w-3 mr-2" />} Delete Selected</Button>
          <Button variant="ghost" size="icon" className="h-9 w-9 text-white/60 hover:text-white" onClick={() => setSelectedStockIds(new Set())}><X className="h-4 w-4" /></Button>
        </div>
      )}

      {/* Unified Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <form onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            const rawData = Object.fromEntries(formData.entries());
            if (!firestore || !user) return;
            let finalData: any = { ...rawData };
            if (editingItem) {
              updateDocumentNonBlocking(doc(firestore, dialogType, editingItem.id), { ...finalData, updatedAt: new Date().toISOString() });
            } else {
              addDocumentNonBlocking(collection(firestore, dialogType), { ...finalData, id: crypto.randomUUID(), createdAt: new Date().toISOString() });
            }
            setIsDialogOpen(false); setEditingItem(null);
          }}>
            <DialogHeader>
              <DialogTitle>{editingItem ? 'Edit Record' : 'Create New Record'}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Name / Label</Label>
                <Input id="name" name={dialogType === 'customers' ? 'companyName' : 'name'} defaultValue={editingItem?.name || editingItem?.companyName} required />
              </div>
            </div>
            <DialogFooter><Button type="submit" className="w-full">{editingItem ? 'Update Registry' : 'Save Record'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
