
"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { 
  Search, 
  Plus, 
  Loader2, 
  FilterX, 
  Pencil,
  Trash2,
  Package,
  RefreshCw,
  SlidersHorizontal,
  ChevronRight,
  Filter,
  ChevronLeft,
  ChevronRight as ChevronRightIcon,
  Eye
} from "lucide-react"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from "@/components/ui/sheet"
import { useFirestore, useUser, useCollection, useMemoFirebase } from "@/firebase"
import { 
  collection, 
  doc, 
  query, 
  limit, 
  serverTimestamp,
  runTransaction,
  writeBatch,
  orderBy
} from "firebase/firestore"
import { updateDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase/non-blocking-updates"
import { cn } from "@/lib/utils"
import { usePermissions } from "@/components/auth/permission-context"
import { ActionModal, ModalType } from "@/components/action-modal"

export default function PaperStockPage() {
  const { user } = useUser()
  const firestore = useFirestore()
  const { hasPermission } = usePermissions()
  const isAdmin = hasPermission('admin')
  
  const [isMounted, setIsMounted] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isAdvancedFilterOpen, setIsAdvancedFilterOpen] = useState(false)
  const [editingRoll, setEditingRoll] = useState<any>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  
  // Pagination & Display State
  const [currentPage, setCurrentPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(20)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const [modal, setModal] = useState<{
    isOpen: boolean;
    type: ModalType;
    title: string;
    description?: string;
    onConfirm?: () => void;
    autoClose?: boolean;
  }>({ isOpen: false, type: 'SUCCESS', title: '' });

  // Comprehensive Filter State
  const [filters, setFilters] = useState({
    search: "",
    status: "all",
    paperCompany: "all",
    paperType: "all",
    width: "",
    length: "",
    rollNo: "",
    jobNo: "",
    jobName: "",
    lotNo: "",
    remarks: "",
    widthMin: "", widthMax: "",
    lengthMin: "", lengthMax: "",
    gsmMin: "", gsmMax: "",
    weightMin: "", weightMax: "",
    sqmMin: "", sqmMax: "",
    purchaseRateMin: "", purchaseRateMax: "",
    dateReceived: "",
    dateOfSlit: ""
  })

  const [formData, setFormData] = useState({
    rollNo: "", 
    status: "Available",
    paperCompany: "",
    paperType: "",
    widthMm: 0,
    lengthMeters: 0,
    sqm: 0,
    gsm: 0,
    weightKg: 0,
    receivedDate: "",
    purchaseRate: 0,
    dateOfSlit: "Not Used", 
    jobNo: "",
    jobName: "",
    lotNo: "",
    remarks: "",
    createdByName: ""
  })

  useEffect(() => { 
    setIsMounted(true);
    setFormData(prev => ({ ...prev, receivedDate: new Date().toISOString().split('T')[0] }));
  }, [])

  const companiesQuery = useMemoFirebase(() => firestore ? collection(firestore, 'paper_companies') : null, [firestore]);
  const typesQuery = useMemoFirebase(() => firestore ? collection(firestore, 'paper_types') : null, [firestore]);
  const { data: companyList } = useCollection(companiesQuery);
  const { data: paperTypeList } = useCollection(typesQuery);

  const registryQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'paper_stock'), orderBy('rollNo', 'desc'), limit(500));
  }, [firestore]);

  const { data: rolls, isLoading: itemsLoading } = useCollection(registryQuery);

  // Advanced Combinatorial Filtering Logic
  const filteredRows = useMemo(() => {
    if (!rolls) return [];
    return rolls.filter(row => {
      // Top Level Search
      if (filters.search) {
        const s = filters.search.toLowerCase();
        if (!row.rollNo?.toLowerCase().includes(s) && 
            !row.lotNo?.toLowerCase().includes(s) && 
            !row.jobNo?.toLowerCase().includes(s)) return false;
      }

      // Dropdowns
      if (filters.status !== "all" && row.status !== filters.status) return false;
      if (filters.paperCompany !== "all" && row.paperCompany !== filters.paperCompany) return false;
      if (filters.paperType !== "all" && row.paperType !== filters.paperType) return false;

      // Quick Numeric Filters
      if (filters.width && Number(row.widthMm) !== Number(filters.width)) return false;
      if (filters.length && Number(row.lengthMeters) !== Number(filters.length)) return false;

      // Advanced Text Fields
      if (filters.rollNo && !row.rollNo?.toLowerCase().includes(filters.rollNo.toLowerCase())) return false;
      if (filters.jobNo && !row.jobNo?.toLowerCase().includes(filters.jobNo.toLowerCase())) return false;
      if (filters.jobName && !row.jobName?.toLowerCase().includes(filters.jobName.toLowerCase())) return false;
      if (filters.lotNo && !row.lotNo?.toLowerCase().includes(filters.lotNo.toLowerCase())) return false;
      if (filters.remarks && !row.remarks?.toLowerCase().includes(filters.remarks.toLowerCase())) return false;

      // Number Ranges
      const checkRange = (val: any, min: string, max: string) => {
        const n = Number(val);
        if (min && n < Number(min)) return false;
        if (max && n > Number(max)) return false;
        return true;
      };

      if (!checkRange(row.widthMm, filters.widthMin, filters.widthMax)) return false;
      if (!checkRange(row.lengthMeters, filters.lengthMin, filters.lengthMax)) return false;
      if (!checkRange(row.gsm, filters.gsmMin, filters.gsmMax)) return false;
      if (!checkRange(row.weightKg, filters.weightMin, filters.weightMax)) return false;
      if (!checkRange(row.sqm, filters.sqmMin, filters.sqmMax)) return false;
      if (!checkRange(row.purchaseRate, filters.purchaseRateMin, filters.purchaseRateMax)) return false;

      // Dates
      if (filters.dateReceived && row.receivedDate !== filters.dateReceived) return false;
      if (filters.dateOfSlit && row.dateOfSlit !== filters.dateOfSlit) return false;

      return true;
    });
  }, [rolls, filters]);

  // Pagination Logic
  const totalPages = Math.ceil(filteredRows.length / rowsPerPage);
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredRows.slice(start, start + rowsPerPage);
  }, [filteredRows, currentPage, rowsPerPage]);

  const startRange = (currentPage - 1) * rowsPerPage + 1;
  const endRange = Math.min(currentPage * rowsPerPage, filteredRows.length);

  // SQM Auto-calculation
  useEffect(() => {
    const w = Number(formData.widthMm) || 0;
    const l = Number(formData.lengthMeters) || 0;
    setFormData(prev => ({ ...prev, sqm: Number(((w * l) / 1000).toFixed(2)) }));
  }, [formData.widthMm, formData.lengthMeters]);

  const showModal = (type: ModalType, title: string, description?: string, onConfirm?: () => void, autoClose = false) => {
    setModal({ isOpen: true, type, title, description, onConfirm, autoClose });
  };

  const handleOpenDialog = (roll?: any) => {
    if (roll) {
      setEditingRoll(roll);
      setFormData({ ...formData, ...roll });
    } else {
      setEditingRoll(null);
      setFormData({
        rollNo: "", status: "Available", paperCompany: "", paperType: "", widthMm: 0, lengthMeters: 0, sqm: 0,
        gsm: 0, weightKg: 0, receivedDate: new Date().toISOString().split('T')[0], purchaseRate: 0,
        dateOfSlit: "Not Used", jobNo: "", jobName: "", lotNo: "", remarks: "",
        createdByName: user?.displayName || user?.email || "System"
      });
    }
    setIsDialogOpen(true);
  }

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firestore || !user) return;
    setIsProcessing(true);

    try {
      if (editingRoll) {
        updateDocumentNonBlocking(doc(firestore, 'paper_stock', editingRoll.id), { ...formData, updatedAt: serverTimestamp() });
        setIsDialogOpen(false);
        showModal('SUCCESS', 'Roll Updated', 'Substrate record has been committed.', true);
      } else {
        await runTransaction(firestore, async (transaction) => {
          const counterRef = doc(firestore, 'counters', 'paper_roll');
          const counterSnap = await transaction.get(counterRef);
          let nextNum = counterSnap.exists() ? (counterSnap.data().current_number || 0) + 1 : 1;
          const rollId = `RL-${nextNum.toString().padStart(4, '0')}`;
          const newDocRef = doc(collection(firestore, 'paper_stock'), rollId);
          
          transaction.set(newDocRef, { ...formData, rollNo: rollId, createdAt: serverTimestamp(), createdById: user.uid, id: rollId });
          transaction.set(counterRef, { current_number: nextNum }, { merge: true });
        });
        setIsDialogOpen(false);
        showModal('SUCCESS', 'Roll Initialized', `Roll ${formData.rollNo} saved.`, true);
      }
    } catch (error: any) {
      showModal('ERROR', 'Transaction Failed', error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkDelete = () => {
    if (!firestore || selectedIds.size === 0) return;
    showModal('CONFIRMATION', 'Delete Selected?', `Are you sure you want to delete ${selectedIds.size} rolls?`, async () => {
      setIsProcessing(true);
      const batch = writeBatch(firestore);
      selectedIds.forEach(id => {
        batch.delete(doc(firestore, 'paper_stock', id));
      });
      await batch.commit().then(() => {
        setSelectedIds(new Set());
        showModal('SUCCESS', 'Deleted', 'Selected records removed.', true);
      }).catch(err => {
        showModal('ERROR', 'Batch Failed', err.message);
      }).finally(() => setIsProcessing(false));
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === paginatedRows.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedRows.map(r => r.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleClearFilters = () => {
    setFilters({
      search: "", status: "all", paperCompany: "all", paperType: "all", width: "", length: "",
      rollNo: "", jobNo: "", jobName: "", lotNo: "", remarks: "", widthMin: "", widthMax: "", 
      lengthMin: "", lengthMax: "", gsmMin: "", gsmMax: "", weightMin: "", weightMax: "", 
      sqmMin: "", sqmMax: "", purchaseRateMin: "", purchaseRateMax: "", dateReceived: "", 
      dateOfSlit: ""
    });
    setCurrentPage(1);
  };

  if (!isMounted) return null;

  return (
    <div className="flex flex-col h-[calc(100vh-10rem)] space-y-4 font-sans">
      <ActionModal isOpen={modal.isOpen} onClose={() => setModal(p => ({ ...p, isOpen: false }))} {...modal} isProcessing={isProcessing} />

      {/* SEARCH & QUICK FILTERS */}
      <div className="flex flex-wrap items-center gap-3 bg-white p-3 rounded-xl border shadow-sm px-6 shrink-0">
        <div className="relative min-w-[240px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search Roll / Lot / Job..." className="pl-8 h-9 text-xs" value={filters.search} onChange={e => setFilters({ ...filters, search: e.target.value })} />
        </div>
        
        <Select value={filters.paperCompany} onValueChange={v => setFilters({ ...filters, paperCompany: v })}>
          <SelectTrigger className="h-9 text-xs w-[140px]"><SelectValue placeholder="Company" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Companies</SelectItem>
            {companyList?.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filters.paperType} onValueChange={v => setFilters({ ...filters, paperType: v })}>
          <SelectTrigger className="h-9 text-xs w-[140px]"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {paperTypeList?.map(t => <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filters.status} onValueChange={v => setFilters({ ...filters, status: v })}>
          <SelectTrigger className="h-9 text-xs w-[110px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="Available">Available</SelectItem>
            <SelectItem value="Reserved">Reserved</SelectItem>
            <SelectItem value="Used">Used</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <Input 
            type="number" 
            placeholder="Width" 
            className="h-9 w-20 text-xs" 
            value={filters.width} 
            onChange={e => setFilters({...filters, width: e.target.value})} 
          />
          <Input 
            type="number" 
            placeholder="Length" 
            className="h-9 w-20 text-xs" 
            value={filters.length} 
            onChange={e => setFilters({...filters, length: e.target.value})} 
          />
        </div>

        <div className="flex-1" />
        
        <Sheet open={isAdvancedFilterOpen} onOpenChange={setIsAdvancedFilterOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 gap-2 font-bold text-xs border-primary/20">
              <Filter className="h-4 w-4 text-primary" /> Advanced
            </Button>
          </SheetTrigger>
          <SheetContent className="sm:max-w-[600px] overflow-y-auto">
            <SheetHeader>
              <SheetTitle className="font-black uppercase flex items-center gap-2">
                <SlidersHorizontal className="h-5 w-5 text-primary" /> Technical Filter Suite
              </SheetTitle>
            </SheetHeader>
            <div className="grid grid-cols-2 gap-6 py-10">
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-black">Roll No</Label>
                <Input value={filters.rollNo} onChange={e => setFilters({...filters, rollNo: e.target.value})} className="h-8 text-xs" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-black">Job No</Label>
                <Input value={filters.jobNo} onChange={e => setFilters({...filters, jobNo: e.target.value})} className="h-8 text-xs" />
              </div>
              
              <div className="space-y-2"><Label className="text-[10px] uppercase font-black text-teal-600">GSM Range</Label>
                <div className="flex gap-2"><Input type="number" placeholder="Min" value={filters.gsmMin} onChange={e => setFilters({...filters, gsmMin: e.target.value})} className="h-8 text-xs" /><Input type="number" placeholder="Max" value={filters.gsmMax} onChange={e => setFilters({...filters, gsmMax: e.target.value})} className="h-8 text-xs" /></div>
              </div>
              <div className="space-y-2"><Label className="text-[10px] uppercase font-black text-teal-600">Width Range</Label>
                <div className="flex gap-2"><Input type="number" placeholder="Min" value={filters.widthMin} onChange={e => setFilters({...filters, widthMin: e.target.value})} className="h-8 text-xs" /><Input type="number" placeholder="Max" value={filters.widthMax} onChange={e => setFilters({...filters, widthMax: e.target.value})} className="h-8 text-xs" /></div>
              </div>
              <div className="space-y-2"><Label className="text-[10px] uppercase font-black text-teal-600">Length Range</Label>
                <div className="flex gap-2"><Input type="number" placeholder="Min" value={filters.lengthMin} onChange={e => setFilters({...filters, lengthMin: e.target.value})} className="h-8 text-xs" /><Input type="number" placeholder="Max" value={filters.lengthMax} onChange={e => setFilters({...filters, lengthMax: e.target.value})} className="h-8 text-xs" /></div>
              </div>
              <div className="space-y-2"><Label className="text-[10px] uppercase font-black text-teal-600">SQM Range</Label>
                <div className="flex gap-2"><Input type="number" placeholder="Min" value={filters.sqmMin} onChange={e => setFilters({...filters, sqmMin: e.target.value})} className="h-8 text-xs" /><Input type="number" placeholder="Max" value={filters.sqmMax} onChange={e => setFilters({...filters, sqmMax: e.target.value})} className="h-8 text-xs" /></div>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-black">Date Received</Label>
                <Input type="date" value={filters.dateReceived} onChange={e => setFilters({...filters, dateReceived: e.target.value})} className="h-8 text-xs" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-black">Date of Slit</Label>
                <Input type="date" value={filters.dateOfSlit} onChange={e => setFilters({...filters, dateOfSlit: e.target.value})} className="h-8 text-xs" />
              </div>

              <div className="col-span-2 space-y-2">
                <Label className="text-[10px] uppercase font-black">Remarks Search</Label>
                <Input value={filters.remarks} onChange={e => setFilters({...filters, remarks: e.target.value})} className="h-8 text-xs" />
              </div>
            </div>
            <SheetFooter>
              <Button className="w-full font-black uppercase" onClick={() => setIsAdvancedFilterOpen(false)}>Apply Global Parameters</Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>

        <Button variant="ghost" size="sm" onClick={handleClearFilters} className="h-9 text-xs text-destructive hover:bg-destructive/10">
          <FilterX className="h-4 w-4 mr-1" /> Reset All
        </Button>
      </div>

      {/* ERP GRID HEADER BAR */}
      <div className="bg-[#4db6ac] text-white p-3 flex items-center justify-between shrink-0 px-6 rounded-t-2xl shadow-lg">
        <div className="flex items-center gap-4">
          <h2 className="font-black text-sm uppercase tracking-widest flex items-center gap-2">
            <Package className="h-5 w-5" /> Paper Stock Registry
          </h2>
          <Badge className="bg-white/20 text-[10px] font-bold border-none uppercase">
            Showing {startRange}–{endRange} of {filteredRows.length} Rolls
          </Badge>
          {selectedIds.size > 0 && (
            <Button variant="destructive" size="sm" className="h-7 text-[9px] font-black uppercase animate-in zoom-in" onClick={handleBulkDelete}>
              <Trash2 className="h-3 w-3 mr-1" /> Delete Selected ({selectedIds.size})
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/20" onClick={() => handleOpenDialog()}>
            <Plus className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/20" onClick={() => window.location.reload()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* THE ERP GRID */}
      <Card className="flex-1 overflow-hidden flex flex-col border-none shadow-2xl bg-white rounded-b-2xl">
        <div className="flex-1 overflow-auto scrollbar-thin">
          <Table className="border-separate border-spacing-0 min-w-[2400px]">
            <TableHeader className="sticky top-0 z-40 bg-slate-50 border-b shadow-sm">
              <TableRow>
                <TableHead className="w-[50px] text-center border-r sticky left-0 bg-slate-50 z-50">
                  <Checkbox checked={selectedIds.size === paginatedRows.length && paginatedRows.length > 0} onCheckedChange={toggleSelectAll} />
                </TableHead>
                <TableHead className="w-[60px] text-center font-black text-[10px] uppercase border-r sticky left-[50px] bg-slate-50 z-50">Sl No.</TableHead>
                <TableHead className="font-black text-[10px] uppercase border-r text-center">Roll No</TableHead>
                <TableHead className="font-black text-[10px] uppercase border-r text-center">Status</TableHead>
                <TableHead className="font-black text-[10px] uppercase border-r">Paper Company</TableHead>
                <TableHead className="font-black text-[10px] uppercase border-r">Paper Type</TableHead>
                <TableHead className="font-black text-[10px] uppercase border-r text-right">Width (MM)</TableHead>
                <TableHead className="font-black text-[10px] uppercase border-r text-right">Length (MTR)</TableHead>
                <TableHead className="font-black text-[10px] uppercase border-r text-right text-teal-700">SQM</TableHead>
                <TableHead className="font-black text-[10px] uppercase border-r text-right">GSM</TableHead>
                <TableHead className="font-black text-[10px] uppercase border-r text-right">Weight (KG)</TableHead>
                <TableHead className="font-black text-[10px] uppercase border-r text-center">Date Received</TableHead>
                <TableHead className="font-black text-[10px] uppercase border-r text-right">Purchase Rate</TableHead>
                <TableHead className="font-black text-[10px] uppercase border-r text-center">Date of Slit</TableHead>
                <TableHead className="font-black text-[10px] uppercase border-r">Job No</TableHead>
                <TableHead className="font-black text-[10px] uppercase border-r">Job Name</TableHead>
                <TableHead className="font-black text-[10px] uppercase border-r">Lot No / Invoice</TableHead>
                <TableHead className="font-black text-[10px] uppercase border-r">Remarks</TableHead>
                <TableHead className="text-right font-black text-[10px] uppercase sticky right-0 bg-slate-50 z-50 border-l shadow-[-4px_0_10px_rgba(0,0,0,0.05)]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {itemsLoading ? (
                <TableRow><TableCell colSpan={19} className="text-center py-20"><Loader2 className="animate-spin mx-auto text-teal-500 h-8 w-8" /></TableCell></TableRow>
              ) : paginatedRows.map((j, i) => (
                <TableRow key={j.id} className={cn("hover:bg-slate-50 transition-colors border-b h-10 group", selectedIds.has(j.id) && "bg-primary/5")}>
                  <TableCell className="text-center border-r sticky left-0 bg-white z-20 group-hover:bg-slate-50">
                    <Checkbox checked={selectedIds.has(j.id)} onCheckedChange={() => toggleSelect(j.id)} />
                  </TableCell>
                  <TableCell className="text-center font-bold text-[11px] text-slate-400 border-r sticky left-[50px] bg-white z-20 group-hover:bg-slate-50">
                    {(currentPage - 1) * rowsPerPage + i + 1}
                  </TableCell>
                  <TableCell className="font-bold text-[11px] text-teal-700 border-r text-center font-mono">{j.rollNo}</TableCell>
                  <TableCell className="text-center border-r">
                    <Badge variant="outline" className={cn("text-[9px] font-bold h-5 uppercase px-2", 
                      j.status === 'Available' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 
                      j.status === 'Reserved' ? 'bg-amber-100 text-amber-700 border-amber-200' : 
                      'bg-red-100 text-red-700 border-red-200')}>
                      {j.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-[11px] border-r uppercase">{j.paperCompany}</TableCell>
                  <TableCell className="text-[11px] border-r">{j.paperType}</TableCell>
                  <TableCell className="text-right text-[11px] border-r font-mono">{j.widthMm}mm</TableCell>
                  <TableCell className="text-right text-[11px] border-r font-mono">{j.lengthMeters}m</TableCell>
                  <TableCell className="text-right text-[11px] border-r font-black text-teal-600 font-mono">{j.sqm}</TableCell>
                  <TableCell className="text-right text-[11px] border-r font-mono">{j.gsm}</TableCell>
                  <TableCell className="text-right text-[11px] border-r font-mono">{j.weightKg}kg</TableCell>
                  <TableCell className="text-center text-[11px] border-r whitespace-nowrap">{j.receivedDate}</TableCell>
                  <TableCell className="text-right text-[11px] border-r font-mono">₹{j.purchaseRate || 0}</TableCell>
                  <TableCell className="text-center text-[11px] border-r whitespace-nowrap font-bold text-slate-400">{j.dateOfSlit || 'Not Used'}</TableCell>
                  <TableCell className="text-[11px] border-r font-mono">{j.jobNo || '-'}</TableCell>
                  <TableCell className="text-[11px] border-r truncate max-w-[150px]">{j.jobName || '-'}</TableCell>
                  <TableCell className="text-[11px] border-r font-mono">{j.lotNo || '-'}</TableCell>
                  <TableCell className="text-[11px] border-r truncate max-w-[200px] italic text-slate-400">{j.remarks || '-'}</TableCell>
                  <TableCell className="text-right sticky right-0 bg-white z-20 group-hover:bg-slate-50 border-l px-2 shadow-[-4px_0_10px_rgba(0,0,0,0.05)]">
                    <div className="flex justify-end gap-1.5">
                      <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full bg-blue-50 text-blue-500 hover:bg-blue-500 hover:text-white" onClick={() => handleOpenDialog(j)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full bg-red-50 text-red-500 hover:bg-red-500 hover:text-white" onClick={() => {
                        showModal('CONFIRMATION', 'Delete Roll?', `Remove ${j.rollNo} permanently?`, () => deleteDocumentNonBlocking(doc(firestore!, 'paper_stock', j.id)));
                      }}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* PAGINATION FOOTER */}
        <div className="bg-slate-50 p-3 border-t flex items-center justify-between shrink-0 px-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-muted-foreground">Rows per page:</span>
              <Select value={rowsPerPage.toString()} onValueChange={v => { setRowsPerPage(Number(v)); setCurrentPage(1); }}>
                <SelectTrigger className="h-8 w-[70px] bg-white text-xs font-bold"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              Total {filteredRows.length} technical rolls in registry
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-1 mx-2">
              <span className="text-xs font-bold">Page</span>
              <Input className="h-8 w-12 text-center text-xs font-black p-0" value={currentPage} onChange={e => {
                const val = Number(e.target.value);
                if (val > 0 && val <= totalPages) setCurrentPage(val);
              }} />
              <span className="text-xs font-bold text-muted-foreground">of {totalPages || 1}</span>
            </div>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage >= totalPages}>
              <ChevronRightIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

      {/* INTAKE / EDIT DIALOG */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[800px] max-h-[95vh] overflow-y-auto p-0 border-none rounded-2xl">
          <form onSubmit={handleSave}>
            <DialogHeader className="p-6 bg-[#4db6ac] text-white">
              <DialogTitle className="uppercase font-black flex items-center gap-2">
                {editingRoll ? `Edit Registry: ${formData.rollNo}` : 'Initialize New Substrate'}
              </DialogTitle>
            </DialogHeader>
            <div className="p-8 grid grid-cols-2 gap-x-8 gap-y-6 bg-white font-sans">
              {/* Form fields remain the same as previous functional version */}
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-black text-slate-500">Roll No (Automatic)</Label>
                <Input value={formData.rollNo || "RL-XXXX"} readOnly className="h-10 font-black bg-slate-50 text-teal-600 border-teal-100" />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-black text-slate-500">Status</Label>
                <Select value={formData.status} onValueChange={v => setFormData({ ...formData, status: v })}>
                  <SelectTrigger className="h-10 font-bold"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Available">Available</SelectItem>
                    <SelectItem value="Reserved">Reserved</SelectItem>
                    <SelectItem value="Used">Used</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5 relative">
                <Label className="text-[10px] uppercase font-black text-slate-500">Paper Company</Label>
                <div className="flex gap-2">
                  <Select value={formData.paperCompany} onValueChange={v => setFormData({ ...formData, paperCompany: v })}>
                    <SelectTrigger className="h-10 font-bold flex-1"><SelectValue placeholder="Select Company" /></SelectTrigger>
                    <SelectContent>
                      {companyList?.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {isAdmin && <Button type="button" size="icon" className="h-10 w-10 shrink-0" variant="outline" onClick={() => toast({ title: "Admin Mode", description: "Use Master Data to add companies." })}><Plus className="h-4 w-4" /></Button>}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-black text-slate-500">Paper Type</Label>
                <div className="flex gap-2">
                  <Select value={formData.paperType} onValueChange={v => setFormData({ ...formData, paperType: v })}>
                    <SelectTrigger className="h-10 font-bold flex-1"><SelectValue placeholder="Select substrate" /></SelectTrigger>
                    <SelectContent>
                      {paperTypeList?.map(t => <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {isAdmin && <Button type="button" size="icon" className="h-10 w-10 shrink-0" variant="outline" onClick={() => toast({ title: "Admin Mode", description: "Use Master Data to add types." })}><Plus className="h-4 w-4" /></Button>}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-black text-teal-600">Width (MM)</Label>
                <Input type="number" value={formData.widthMm} onChange={e => setFormData({ ...formData, widthMm: Number(e.target.value) })} required className="h-10 font-black border-teal-100" />
              </div>
              
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-black text-teal-600">Length (MTR)</Label>
                <Input type="number" value={formData.lengthMeters} onChange={e => setFormData({ ...formData, lengthMeters: Number(e.target.value) })} required className="h-10 font-black border-teal-100" />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-black text-primary">SQM (Auto-Calculated)</Label>
                <Input value={formData.sqm} readOnly className="h-10 font-black bg-primary/5 text-primary border-primary/20" />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-black text-slate-500">GSM</Label>
                <Input type="number" value={formData.gsm} onChange={e => setFormData({ ...formData, gsm: Number(e.target.value) })} required className="h-10 font-bold" />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-black text-slate-500">Weight (KG)</Label>
                <Input type="number" value={formData.weightKg} onChange={e => setFormData({ ...formData, weightKg: Number(e.target.value) })} className="h-10 font-bold" />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-black text-slate-500">Date of Received</Label>
                <Input type="date" value={formData.receivedDate} onChange={e => setFormData({ ...formData, receivedDate: e.target.value })} required className="h-10 font-bold" />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-black text-slate-500">Purchase Rate (Optional)</Label>
                <Input type="number" value={formData.purchaseRate} onChange={e => setFormData({ ...formData, purchaseRate: Number(e.target.value) })} className="h-10 font-bold" />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-black text-slate-500">Job No</Label>
                <Input value={formData.jobNo} onChange={e => setFormData({ ...formData, jobNo: e.target.value })} className="h-10 font-bold" />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-black text-slate-500">Job Name</Label>
                <Input value={formData.jobName} onChange={e => setFormData({ ...formData, jobName: e.target.value })} className="h-10 font-bold" />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-black text-slate-500">Lot No / Invoice No</Label>
                <Input value={formData.lotNo} onChange={e => setFormData({ ...formData, lotNo: e.target.value })} className="h-10 font-bold" />
              </div>

              <div className="col-span-2 space-y-1.5">
                <Label className="text-[10px] uppercase font-black text-slate-500">Technical Remarks</Label>
                <Textarea value={formData.remarks} onChange={e => setFormData({ ...formData, remarks: e.target.value })} className="min-h-[80px]" placeholder="Add production notes..." />
              </div>
            </div>
            <DialogFooter className="p-6 bg-slate-50 border-t rounded-b-2xl">
              <Button type="submit" disabled={isProcessing} className="w-full h-14 uppercase font-black text-lg bg-[#4db6ac] hover:bg-[#3d9e94]">
                {isProcessing ? <Loader2 className="animate-spin mr-2" /> : <ChevronRight className="mr-2 h-6 w-6" />}
                {editingRoll ? 'Confirm Registry Updates' : 'Authorize substrate intake'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
