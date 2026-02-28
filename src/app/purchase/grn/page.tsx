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
  X
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

type SortField = 'rollNo' | 'receivedDate' | 'purchaseRate' | 'gsm' | 'sqm' | 'weightKg';
type SortOrder = 'asc' | 'desc';

export default function GRNPage() {
  const { toast } = useToast()
  const { user } = useUser()
  const firestore = useFirestore()
  const [isMounted, setIsMounted] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isManualId, setIsManualId] = useState(false)
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
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

  // Sort State
  const [sortField, setSortField] = useState<SortField>('receivedDate')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')

  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Filter State
  const [filters, setFilters] = useState({
    rollNo: "",
    paperType: "all",
    lotNo: "",
    companyRollNo: "",
    jobNo: "",
    productName: "",
    receivedDateStart: "",
    receivedDateEnd: "",
    gsmMin: "",
    gsmMax: "",
    widthMin: "",
    widthMax: "",
    rateMin: "",
    rateMax: "",
    status: "all"
  })

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

  // Simple loaders for dropdowns
  const [materials, setMaterials] = useState<any[]>([])
  const [suppliers, setSuppliers] = useState<any[]>([])

  useEffect(() => {
    if (!firestore || !user || !adminData) return
    const unsubM = onSnapshot(collection(firestore, 'raw_materials'), s => setMaterials(s.docs.map(d => ({id: d.id, ...d.data()}))))
    const unsubS = onSnapshot(collection(firestore, 'suppliers'), s => setSuppliers(s.docs.map(d => ({id: d.id, ...d.data()}))))
    return () => { unsubM(); unsubS(); }
  }, [firestore, user, adminData])

  // 1. Fetch Total Count & Handle Pagination Reset
  useEffect(() => {
    if (!firestore || !user || !adminData) return;

    const fetchCount = async () => {
      const baseRef = collection(firestore, 'jumbo_stock');
      let q = query(baseRef);
      if (filters.paperType && filters.paperType !== "all") q = query(q, where("paperType", "==", filters.paperType));
      if (filters.status && filters.status !== "all") q = query(q, where("status", "==", filters.status));
      if (filters.rollNo) q = query(q, where("rollNo", "==", filters.rollNo));
      
      const snapshot = await getCountFromServer(q);
      setTotalRecords(snapshot.data().count);
    };

    fetchCount();
    setCurrentPage(1);
    setPageStack([null]);
    setLastVisible(null);
    setSelectedIds(new Set()); // Reset selection on filter change
  }, [firestore, user, adminData, filters.paperType, filters.status, filters.rollNo]);

  // 2. Fetch Paginated Data
  useEffect(() => {
    if (!firestore || !user || !adminData) return;

    const fetchData = async () => {
      setIsPageLoading(true);
      try {
        const baseRef = collection(firestore, 'jumbo_stock');
        let q = query(baseRef, orderBy(sortField, sortOrder));

        if (filters.paperType && filters.paperType !== "all") q = query(q, where("paperType", "==", filters.paperType));
        if (filters.status && filters.status !== "all") q = query(q, where("status", "==", filters.status));
        if (filters.rollNo) q = query(q, where("rollNo", "==", filters.rollNo));

        const cursor = pageStack[currentPage - 1];
        if (cursor) {
          q = query(q, startAfter(cursor));
        }

        if (pageSize !== 'all') {
          q = query(q, limit(pageSize as number));
        }

        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        
        setPagedJumbos(data);
        
        if (snapshot.docs.length > 0) {
          setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
        }
      } catch (e) {
        console.error("Pagination error:", e);
      } finally {
        setIsPageLoading(false);
      }
    };

    fetchData();
  }, [firestore, user, adminData, pageSize, currentPage, sortField, sortOrder, filters.paperType, filters.status, filters.rollNo, pageStack]);

  // SQM Auto-Calculation
  useEffect(() => {
    if (formData.widthMm > 0 && formData.lengthMeters > 0) {
      setFormData(prev => ({
        ...prev,
        sqm: Number((prev.widthMm * prev.lengthMeters / 1000).toFixed(2))
      }))
    }
  }, [formData.widthMm, formData.lengthMeters])

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
        toast({
          variant: "destructive",
          title: "Large Dataset Warning",
          description: "Cannot load all records (over 2,000). Use pagination or filters."
        });
        return;
      }
      if (confirm("Loading all records may slow down your browser performance. Continue?")) {
        setPageSize('all');
      }
    } else {
      setPageSize(Number(val));
    }
    setCurrentPage(1);
    setPageStack([null]);
    setSelectedIds(new Set());
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === pagedJumbos.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(pagedJumbos.map(j => j.id)))
    }
  }

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedIds(next)
  }

  const handleSingleDelete = async (roll: any) => {
    if (!isAdmin || !firestore) return;
    if (confirm(`Are you sure you want to delete Roll ID ${roll.rollNo}? This action is permanent and only intended for correcting data entry errors.`)) {
      setIsDeleting(true);
      try {
        await deleteDoc(doc(firestore, 'jumbo_stock', roll.id));
        toast({ title: "Roll Deleted", description: `Record ${roll.rollNo} removed from registry.` });
        setTotalRecords(prev => prev - 1);
      } catch (e) {
        toast({ variant: "destructive", title: "Delete Failed", description: "You might not have administrative permissions." });
      } finally {
        setIsDeleting(false);
      }
    }
  }

  const handleBulkDelete = async () => {
    if (!isAdmin || !firestore || selectedIds.size === 0) return;
    if (confirm(`CRITICAL ACTION: You are about to delete ${selectedIds.size} stock records. This cannot be undone. Proceed?`)) {
      setIsDeleting(true);
      try {
        const ids = Array.from(selectedIds);
        const totalToDelete = ids.length;
        
        for (let i = 0; i < ids.length; i += 500) {
          const batch = writeBatch(firestore);
          const chunk = ids.slice(i, i + 500);
          chunk.forEach(id => batch.delete(doc(firestore, 'jumbo_stock', id)));
          await batch.commit();
        }
        
        toast({ title: "Bulk Delete Successful", description: `${totalToDelete} records removed.` });
        setSelectedIds(new Set());
        setTotalRecords(prev => prev - totalToDelete);
      } catch (e) {
        toast({ variant: "destructive", title: "Bulk Delete Failed" });
      } finally {
        setIsDeleting(false);
      }
    }
  }

  const handleExport = async (type: 'filtered' | 'full') => {
    if (!firestore) return
    setIsExporting(true)
    try {
      await exportPaperStockToExcel(firestore);
      toast({ 
        title: type === 'filtered' ? "Filtered Export Complete" : "Full Stock Export Complete", 
        description: `Exporting standard registry.` 
      })
    } catch (e: any) {
      toast({ variant: "destructive", title: "Export Failed", description: e.message })
    } finally {
      setIsExporting(false)
    }
  }

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortOrder('asc'); }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: e.target.type === 'number' ? Number(value) : value }));
  }

  const resetFilters = () => {
    setFilters({
      rollNo: "", paperType: "all", lotNo: "", companyRollNo: "", jobNo: "", productName: "",
      receivedDateStart: "", receivedDateEnd: "", 
      gsmMin: "", gsmMax: "", widthMin: "", widthMax: "", rateMin: "", rateMax: "", status: "all"
    })
  }

  const handleAddJumbo = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!firestore || !user) return

    setIsGenerating(true)
    const submissionData = new FormData(e.currentTarget)
    const manualRollNo = submissionData.get("manualRollNo") as string;
    
    runTransaction(firestore, async (transaction) => {
      let finalRollNo = "";
      if (isManualId) {
        if (!manualRollNo) throw new Error("RELL NO is required.");
        finalRollNo = manualRollNo;
      } else {
        const counterRef = doc(firestore, 'counters', 'jumbo_roll');
        const counterSnap = await transaction.get(counterRef);
        const currentYear = new Date().getFullYear().toString();
        let currentNumber = 1;
        if (counterSnap.exists()) {
          const data = counterSnap.data();
          if (data.year === currentYear) currentNumber = data.current_number + 1;
        }
        const prefix = settings?.parentPrefix || "TLC-";
        const startNum = Number(settings?.startNumber) || 1000;
        finalRollNo = `${prefix}${startNum + currentNumber}`;
        transaction.set(counterRef, { year: currentYear, current_number: currentNumber }, { merge: true });
      }

      const jumboRef = doc(collection(firestore, 'jumbo_stock'));
      transaction.set(jumboRef, {
        rollNo: finalRollNo,
        paperCompany: submissionData.get("paperCompany") as string,
        paperType: submissionData.get("paperType") as string,
        widthMm: formData.widthMm,
        lengthMeters: formData.lengthMeters,
        sqm: formData.sqm,
        gsm: formData.gsm,
        weightKg: formData.weightKg,
        purchaseRate: formData.purchaseRate,
        wastage: formData.wastage,
        jobNo: formData.jobNo,
        size: formData.size,
        productName: formData.productName,
        code: formData.code,
        lotNo: formData.lotNo,
        companyRollNo: formData.companyRollNo,
        dateOfUse: formData.dateOfUse,
        date: formData.date,
        receivedDate: submissionData.get("receivedDate") || new Date().toISOString(),
        status: "In Stock",
        createdAt: new Date().toISOString(),
        createdById: user.uid
      });
    }).then(() => {
      setIsGenerating(false);
      setIsDialogOpen(false);
      setFormData({ 
        widthMm: 1020, lengthMeters: 0, sqm: 0, gsm: 0, weightKg: 0, purchaseRate: 0, wastage: 0, 
        jobNo: "", size: "", productName: "", code: "", lotNo: "", companyRollNo: "",
        dateOfUse: "", date: new Date().toISOString().split('T')[0]
      });
      toast({ title: "GRN Recorded", description: "Technical stock entry successful." });
    }).catch(async (serverError) => {
      setIsGenerating(false);
      const permissionError = new FirestorePermissionError({
        path: 'jumbo_stock',
        operation: 'create',
      });
      errorEmitter.emit('permission-error', permissionError);
    })
  }

  if (!isMounted || authLoading) {
    return (
      <div className="flex h-[calc(100vh-10rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const currentLimit = pageSize === 'all' ? totalRecords : (pageSize as number);
  const startIdx = totalRecords === 0 ? 0 : (currentPage - 1) * currentLimit + 1;
  const endIdx = pageSize === 'all' ? totalRecords : Math.min(currentPage * currentLimit, totalRecords);

  return (
    <div className="space-y-6 relative">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">GRN (Jumbo Entry)</h2>
          <p className="text-muted-foreground">Professional registry with server-side pagination and bulk management.</p>
        </div>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={isExporting}>
                {isExporting ? <Loader2 className="animate-spin mr-2" /> : <FileDown className="mr-2 h-4 w-4" />}
                Export Stock
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => handleExport('full')} className="font-bold">
                Export Full Stock Registry
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={() => setIsDialogOpen(true)} className="shadow-lg"><Plus className="mr-2 h-4 w-4" /> New Entry</Button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-muted/30 p-4 rounded-xl border border-primary/10">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Label className="text-[10px] font-black uppercase text-muted-foreground whitespace-nowrap">Show Rows:</Label>
            <Select value={pageSize.toString()} onValueChange={handlePageSizeChange}>
              <SelectTrigger className="w-[80px] h-8 text-xs font-bold">
                <SelectValue />
              </SelectTrigger>
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
            {totalRecords > 0 ? (
              <>Showing <span className="text-primary">{startIdx}–{endIdx}</span> of {totalRecords.toLocaleString()} records</>
            ) : (
              "No records found"
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="h-8 w-8 p-0" 
            onClick={handlePrevPage} 
            disabled={currentPage === 1 || isPageLoading}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-1">
            <Badge variant="secondary" className="h-8 px-3 text-xs font-black">PAGE {currentPage}</Badge>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            className="h-8 w-8 p-0" 
            onClick={handleNextPage} 
            disabled={pageSize === 'all' || endIdx >= totalRecords || isPageLoading}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Card className="border-primary/10 bg-muted/20">
        <CardHeader className="py-3 px-6 flex flex-row items-center justify-between cursor-pointer" onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}>
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Filter className="h-4 w-4 text-primary" /> Advanced Filters
          </CardTitle>
          {showAdvancedFilters ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </CardHeader>
        {showAdvancedFilters && (
          <CardContent className="px-6 pb-6 pt-0 space-y-6 animate-in fade-in slide-in-from-top-2">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-bold">Paper Type</Label>
                <Select value={filters.paperType} onValueChange={val => setFilters({...filters, paperType: val})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {materials?.map(m => <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-bold">Status</Label>
                <Select value={filters.status} onValueChange={val => setFilters({...filters, status: val})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="In Stock">In Stock</SelectItem>
                    <SelectItem value="Consumed">Consumed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-bold">Find Roll ID (Equality)</Label>
                <Input value={filters.rollNo} onChange={e => setFilters({...filters, rollNo: e.target.value})} placeholder="Full RELL NO..." />
              </div>
              <div className="flex items-end gap-2">
                <Button variant="outline" onClick={resetFilters} className="w-full h-10"><FilterX className="mr-2 h-4 w-4" /> Reset</Button>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      <Card className="shadow-2xl border-none overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="min-w-[2000px]">
              <TableHeader className="sticky top-0 bg-background z-20 shadow-sm border-b-2">
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="w-[50px] text-center sticky left-0 bg-muted/50 z-30">
                    <Checkbox checked={selectedIds.size === pagedJumbos.length && pagedJumbos.length > 0} onCheckedChange={toggleSelectAll} />
                  </TableHead>
                  <TableHead className="w-[80px] text-center font-black sticky left-[50px] bg-muted/50 border-r z-30">PRINT</TableHead>
                  <TableHead className="cursor-pointer font-black text-primary sticky left-[130px] bg-muted/50 border-r z-20" onClick={() => toggleSort('rollNo')}>
                    <div className="flex items-center gap-1">RELL NO {sortField === 'rollNo' ? (sortOrder === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-20" />}</div>
                  </TableHead>
                  <TableHead className="font-black">PAPER COMPANY</TableHead>
                  <TableHead className="font-black">PAPER TYPE</TableHead>
                  <TableHead className="font-black">WIDTH (MM)</TableHead>
                  <TableHead className="font-black">LENGTH (MTR)</TableHead>
                  <TableHead className="cursor-pointer font-black text-primary" onClick={() => toggleSort('sqm')}>
                    <div className="flex items-center gap-1">SQM {sortField === 'sqm' ? (sortOrder === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-20" />}</div>
                  </TableHead>
                  <TableHead className="cursor-pointer font-black text-primary" onClick={() => toggleSort('gsm')}>
                    <div className="flex items-center gap-1">GSM {sortField === 'gsm' ? (sortOrder === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-20" />}</div>
                  </TableHead>
                  <TableHead className="cursor-pointer font-black text-primary" onClick={() => toggleSort('weightKg')}>
                    <div className="flex items-center gap-1">WEIGHT(KG) {sortField === 'weightKg' ? (sortOrder === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-20" />}</div>
                  </TableHead>
                  <TableHead className="cursor-pointer font-black text-primary" onClick={() => toggleSort('purchaseRate')}>
                    <div className="flex items-center gap-1">Rate {sortField === 'purchaseRate' ? (sortOrder === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-20" />}</div>
                  </TableHead>
                  <TableHead className="cursor-pointer font-black text-primary" onClick={() => toggleSort('receivedDate')}>
                    <div className="flex items-center gap-1">RECEIVED {sortField === 'receivedDate' ? (sortOrder === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-20" />}</div>
                  </TableHead>
                  <TableHead className="font-black">LOT NO</TableHead>
                  <TableHead className="font-black">STATUS</TableHead>
                  {isAdmin && <TableHead className="text-right sticky right-0 bg-muted/50 border-l font-black">ACTIONS</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isPageLoading ? (
                  <TableRow><TableCell colSpan={15} className="text-center py-20"><Loader2 className="h-10 w-10 animate-spin mx-auto text-primary" /><p className="mt-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">Streaming data from server...</p></TableCell></TableRow>
                ) : pagedJumbos.map((j) => (
                  <TableRow key={j.id} className="hover:bg-primary/5 transition-colors group h-14">
                    <TableCell className="text-center sticky left-0 bg-background z-10 border-r">
                      <Checkbox checked={selectedIds.has(j.id)} onCheckedChange={() => toggleSelect(j.id)} />
                    </TableCell>
                    <TableCell className="text-center sticky left-[50px] bg-background border-r z-10"><Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => window.print()}><Printer className="h-4 w-4" /></Button></TableCell>
                    <TableCell className="font-black text-primary sticky left-[130px] bg-background border-r z-10 font-mono text-xs">{j.rollNo}</TableCell>
                    <TableCell className="text-xs">{j.paperCompany}</TableCell>
                    <TableCell><Badge variant="outline" className="font-bold bg-white text-[10px]">{j.paperType}</Badge></TableCell>
                    <TableCell className="font-mono text-xs">{j.widthMm}mm</TableCell>
                    <TableCell className="font-mono text-xs">{j.lengthMeters}m</TableCell>
                    <TableCell className="font-black text-xs text-primary">{j.sqm}</TableCell>
                    <TableCell className="text-xs">{j.gsm}</TableCell>
                    <TableCell className="font-bold text-xs">{j.weightKg}kg</TableCell>
                    <TableCell className="text-emerald-700 font-bold text-xs">₹{j.purchaseRate?.toLocaleString()}</TableCell>
                    <TableCell className="text-[10px] font-bold text-muted-foreground">{j.receivedDate}</TableCell>
                    <TableCell className="text-[10px] font-mono">{j.lotNo || '-'}</TableCell>
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
                {pagedJumbos.length === 0 && !isPageLoading && (
                  <TableRow><TableCell colSpan={15} className="text-center py-40 text-muted-foreground italic">No substrate records found for current filters.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Floating Action Bar for Bulk Delete */}
      {selectedIds.size > 0 && isAdmin && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 bg-zinc-900 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-6 animate-in slide-in-from-bottom-4">
          <div className="flex items-center gap-2">
            <div className="bg-primary h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-black">{selectedIds.size}</div>
            <span className="text-sm font-bold uppercase tracking-tight">Records Selected</span>
          </div>
          <Separator orientation="vertical" className="h-6 bg-white/20" />
          <div className="flex items-center gap-2">
            <Button variant="destructive" size="sm" className="font-black uppercase h-9 px-4 rounded-full" onClick={handleBulkDelete} disabled={isDeleting}>
              {isDeleting ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <Trash2 className="h-3 w-3 mr-2" />}
              Delete Selection
            </Button>
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-white/60 hover:text-white hover:bg-white/10" onClick={() => setSelectedIds(new Set())}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[900px] max-h-[95vh] overflow-y-auto">
          <form onSubmit={handleAddJumbo}>
            <DialogHeader>
              <DialogTitle>Substrate Technical Intake (19 Columns)</DialogTitle>
              <DialogDescription>Full ERP technical entry for substrate rolls.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-6 py-4">
              <div className="flex items-center justify-between p-4 bg-primary/5 rounded-lg border border-primary/10">
                <div className="flex items-center gap-2">
                  <Hash className="h-5 w-5 text-primary" />
                  <div>
                    <Label className="font-bold text-base">RELL NO Identification</Label>
                    <p className="text-[10px] text-muted-foreground uppercase font-medium">Internal Master Serial</p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-muted-foreground">AUTO</span>
                    <Switch checked={isManualId} onCheckedChange={setIsManualId} />
                    <span className="text-[10px] font-bold text-primary">MANUAL</span>
                  </div>
                  {isManualId ? (
                    <Input id="manualRollNo" name="manualRollNo" placeholder="VEN-001" className="w-40 h-10 font-bold" required />
                  ) : (
                    <div className="px-4 py-2 bg-background border rounded-md font-mono font-bold text-primary shadow-inner">
                      {settings?.parentPrefix || "TLC-"}1XXX
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label className="text-[11px] font-bold text-primary">PAPER COMPANY</Label>
                  <Select name="paperCompany" required>
                    <SelectTrigger className="h-10"><SelectValue placeholder="Select Vendor" /></SelectTrigger>
                    <SelectContent>
                      {suppliers?.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[11px] font-bold text-primary">PAPER TYPE</Label>
                  <Select name="paperType" required>
                    <SelectTrigger className="h-10"><SelectValue placeholder="Select Type" /></SelectTrigger>
                    <SelectContent>
                      {materials?.map(m => <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[11px] font-bold text-primary">DATE OF RECEIVED</Label>
                  <Input name="receivedDate" type="date" defaultValue={new Date().toISOString().split('T')[0]} required />
                </div>
              </div>

              <div className="bg-muted/30 p-5 rounded-lg border border-border/50 space-y-5">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold uppercase">Lot no / BATCH NO</Label>
                    <Input name="lotNo" value={formData.lotNo} onChange={handleInputChange} required />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold uppercase">Company Roll no</Label>
                    <Input name="companyRollNo" value={formData.companyRollNo} onChange={handleInputChange} required />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold uppercase">PRODUCT NAME</Label>
                    <Input name="productName" value={formData.productName} onChange={handleInputChange} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold uppercase">Code</Label>
                    <Input name="code" value={formData.code} onChange={handleInputChange} />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold uppercase">WIDTH (MM)</Label>
                  <Input name="widthMm" type="number" value={formData.widthMm} onChange={handleInputChange} className="font-bold" required />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold uppercase">LENGTH (MTR)</Label>
                  <Input name="lengthMeters" type="number" value={formData.lengthMeters} onChange={handleInputChange} className="font-bold" required />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold uppercase text-primary">SQM (AUTO-CALC)</Label>
                  <div className="h-10 px-3 flex items-center bg-primary/5 border-2 border-primary/20 rounded-md font-black text-primary">
                    {formData.sqm}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold uppercase">GSM</Label>
                  <Input name="gsm" type="number" value={formData.gsm} onChange={handleInputChange} required />
                </div>
              </div>
            </div>
            <DialogFooter className="pt-4 border-t">
              <Button variant="ghost" type="button" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button type="submit" className="h-12 px-10 text-lg font-bold bg-primary" disabled={isGenerating}>Complete GRN</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
