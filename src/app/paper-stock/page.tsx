
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
  ChevronLeft,
  ChevronRight,
  Filter,
  Check,
  ChevronDown
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
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useFirestore, useUser, useCollection, useMemoFirebase } from "@/firebase"
import { 
  collection, 
  doc, 
  query, 
  limit, 
  serverTimestamp,
  runTransaction,
  writeBatch,
  orderBy,
  setDoc
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

  // Quick-Add Modals
  const [isMetadataModalOpen, setIsMetadataModalOpen] = useState(false)
  const [metadataType, setMetadataType] = useState<'Company' | 'Type'>('Company')

  const [modal, setModal] = useState<{
    isOpen: boolean;
    type: ModalType;
    title: string;
    description?: string;
    onConfirm?: () => void;
    autoClose?: boolean;
  }>({ isOpen: false, type: 'SUCCESS', title: '' });

  // Comprehensive Filter State
  const [filters, setFilters] = useState<any>({
    search: "",
    paperCompany: [],
    paperType: [],
    status: [],
    widthMm: [],
    lengthMeters: [],
    sqm: [],
    gsm: [],
    weightKg: [],
    dateOfSlit: [],
    jobNo: [],
    jobName: [],
    lotNo: [],
    // Range filters for Advanced Panel
    widthMin: "", widthMax: "",
    lengthMin: "", lengthMax: "",
    gsmMin: "", gsmMax: "",
    weightMin: "", weightMax: "",
    sqmMin: "", sqmMax: "",
    dateReceived: "",
    remarks: ""
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
    quantity: 1,
    createdByName: ""
  })

  useEffect(() => { 
    setIsMounted(true);
    setFormData(prev => ({ ...prev, receivedDate: new Date().toISOString().split('T')[0] }));
  }, [])

  // Optimized fetches for metadata
  const companiesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'paper_companies'), limit(100)) : null, [firestore]);
  const typesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'paper_types'), limit(100)) : null, [firestore]);
  const { data: companyList } = useCollection(companiesQuery);
  const { data: paperTypeList } = useCollection(typesQuery);

  // Registry Query: Limited to 100 to save Quota
  const registryQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'paper_stock'), orderBy('rollNo', 'desc'), limit(100));
  }, [firestore]);

  const { data: rolls, isLoading: itemsLoading } = useCollection(registryQuery);

  // Helper to extract unique values from table data for filters
  const getUniqueOptions = (key: string) => {
    if (!rolls) return [];
    const values = rolls.map(r => r[key]).filter(v => v !== undefined && v !== null && v !== "");
    return Array.from(new Set(values)).sort();
  }

  // Advanced Combinatorial Filtering Logic
  const filteredRows = useMemo(() => {
    if (!rolls) return [];
    return rolls.filter(row => {
      // 1. Global Search Logic
      if (filters.search) {
        const s = filters.search.toLowerCase();
        const searchableValues = [
          row.rollNo, row.paperCompany, row.paperType, row.widthMm, 
          row.lengthMeters, row.sqm, row.gsm, row.weightKg, 
          row.jobNo, row.jobName, row.lotNo, row.remarks, row.createdByName
        ].map(v => String(v || "").toLowerCase());
        
        if (!searchableValues.some(val => val.includes(s))) return false;
      }

      // 2. Multi-Select Dropdown Logic (AND between groups, OR within group)
      const multiFilters = [
        'paperCompany', 'paperType', 'status', 'widthMm', 'lengthMeters', 
        'sqm', 'gsm', 'weightKg', 'dateOfSlit', 'jobNo', 'jobName', 'lotNo'
      ];

      for (const key of multiFilters) {
        if (filters[key] && filters[key].length > 0) {
          if (!filters[key].includes(row[key])) return false;
        }
      }

      // 3. Advanced Range Filtering
      const checkRange = (val: any, min: string, max: string) => {
        const n = Number(val);
        if (min && n < Number(min)) return false;
        if (max && n > Number(max)) return false;
        return true;
      };

      if (!checkRange(row.widthMm, filters.widthMin, filters.widthMax)) return false;
      if (!checkRange(row.lengthMeters, filters.lengthMin, filters.lengthMax)) return false;
      if (!checkRange(row.gsm, filters.gsmMin, filters.gsmMax)) return false;
      if (!checkRange(row.sqm, filters.sqmMin, filters.sqmMax)) return false;

      if (filters.remarks && !row.remarks?.toLowerCase().includes(filters.remarks.toLowerCase())) return false;

      return true;
    });
  }, [rolls, filters]);

  // Pagination Logic
  const totalPages = Math.ceil(filteredRows.length / rowsPerPage);
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredRows.slice(start, start + rowsPerPage);
  }, [filteredRows, currentPage, rowsPerPage]);

  const toggleMultiFilter = (key: string, value: any) => {
    setFilters((prev: any) => {
      const current = prev[key] || [];
      const next = current.includes(value)
        ? current.filter((v: any) => v !== value)
        : [...current, value];
      return { ...prev, [key]: next };
    });
    setCurrentPage(1);
  };

  // UI Components for Multi-Select
  const MultiSelectFilter = ({ label, field, options }: { label: string, field: string, options: any[] }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className={cn(
          "h-9 px-3 text-xs gap-2 font-bold bg-white border-primary/10 hover:bg-slate-50 transition-all",
          filters[field]?.length > 0 && "border-primary bg-primary/5 text-primary"
        )}>
          {label}
          {filters[field]?.length > 0 && (
            <Badge variant="secondary" className="h-4 px-1 text-[9px] font-black bg-primary text-white">
              {filters[field].length}
            </Badge>
          )}
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56 max-h-[300px] overflow-y-auto">
        <DropdownMenuLabel className="text-[10px] uppercase font-black text-muted-foreground">{label} Options</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {options.length === 0 ? (
          <div className="p-2 text-[10px] text-muted-foreground italic">No data found</div>
        ) : options.map(opt => (
          <DropdownMenuCheckboxItem
            key={opt}
            checked={filters[field]?.includes(opt)}
            onCheckedChange={() => toggleMultiFilter(field, opt)}
            className="text-xs font-bold"
          >
            {String(opt)}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );

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
        dateOfSlit: "Not Used", jobNo: "", jobName: "", lotNo: "", remarks: "", quantity: 1,
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
        showModal('SUCCESS', 'Roll Updated', 'Technical record has been committed.', undefined, true);
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
        showModal('SUCCESS', 'Roll Added', `Roll ${formData.rollNo} initialized.`, undefined, true);
      }
    } catch (error: any) {
      showModal('ERROR', 'Transaction Failed', error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveMetadata = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formDataObj = new FormData(e.currentTarget);
    const name = formDataObj.get('name') as string;
    const col = metadataType === 'Company' ? 'paper_companies' : 'paper_types';
    
    if (!name) return;

    const list = metadataType === 'Company' ? companyList : paperTypeList;
    if (list?.some(item => item.name.toLowerCase() === name.toLowerCase())) {
      showModal('WARNING', 'Duplicate Value', `This ${metadataType} already exists in the registry.`);
      return;
    }

    try {
      const docId = name.toLowerCase().replace(/\s+/g, '-');
      await setDoc(doc(firestore!, col, docId), { name, createdAt: serverTimestamp() });
      setFormData(prev => ({ ...prev, [metadataType === 'Company' ? 'paperCompany' : 'paperType']: name }));
      setIsMetadataModalOpen(false);
      showModal('SUCCESS', 'Entry Authorized', `${metadataType} added to system master data.`, undefined, true);
    } catch (err: any) {
      showModal('ERROR', 'Authorization Failed', err.message);
    }
  }

  const handleBulkDelete = () => {
    if (!firestore || selectedIds.size === 0) return;
    showModal('CONFIRMATION', 'Authorize Bulk Deletion?', `Permanently remove ${selectedIds.size} substrate records?`, async () => {
      setIsProcessing(true);
      const batch = writeBatch(firestore);
      selectedIds.forEach(id => batch.delete(doc(firestore, 'paper_stock', id)));
      await batch.commit().then(() => {
        setSelectedIds(new Set());
        showModal('SUCCESS', 'Batch Deleted', 'Selected rolls removed from registry.', undefined, true);
      }).catch(err => showModal('ERROR', 'Batch Failed', err.message)).finally(() => setIsProcessing(false));
    });
  };

  if (!isMounted) return null;

  return (
    <div className="flex flex-col h-[calc(100vh-10rem)] space-y-4 font-sans">
      <ActionModal isOpen={modal.isOpen} onClose={() => setModal(p => ({ ...p, isOpen: false }))} {...modal} isProcessing={isProcessing} />

      {/* SEARCH & ERP QUICK FILTERS */}
      <div className="bg-white p-4 rounded-2xl border shadow-sm space-y-4 shrink-0 px-6">
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-primary opacity-50" />
            <Input 
              placeholder="Global Search (Roll, Job, Type, Size...)" 
              className="pl-9 h-10 text-sm font-bold border-primary/10 bg-slate-50/50 focus:bg-white transition-all" 
              value={filters.search} 
              onChange={e => setFilters({ ...filters, search: e.target.value })} 
            />
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setFilters({
                search: "", paperCompany: [], paperType: [], status: [], widthMm: [], lengthMeters: [], sqm: [], gsm: [], weightKg: [], dateOfSlit: [], jobNo: [], jobName: [], lotNo: [],
                widthMin: "", widthMax: "", lengthMin: "", lengthMax: "", gsmMin: "", gsmMax: "", weightMin: "", weightMax: "", sqmMin: "", sqmMax: "", dateReceived: "", remarks: ""
              })} 
              className="h-9 text-[10px] font-black uppercase text-destructive hover:bg-destructive/5 tracking-widest"
            >
              <FilterX className="h-4 w-4 mr-1.5" /> Reset All
            </Button>
            <Sheet open={isAdvancedFilterOpen} onOpenChange={setIsAdvancedFilterOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 gap-2 font-black text-[10px] uppercase border-primary/20 tracking-widest">
                  <SlidersHorizontal className="h-4 w-4 text-primary" /> Advanced Suite
                </Button>
              </SheetTrigger>
              <SheetContent className="sm:max-w-[500px]">
                <SheetHeader><SheetTitle className="font-black uppercase flex items-center gap-2 tracking-tighter"><SlidersHorizontal className="h-5 w-5 text-primary" /> Technical Filter Suite</SheetTitle></SheetHeader>
                <div className="grid grid-cols-2 gap-6 py-8">
                  <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-slate-500">GSM Range</Label><div className="flex gap-2"><Input type="number" placeholder="Min" value={filters.gsmMin} onChange={e => setFilters({...filters, gsmMin: e.target.value})} className="h-9 text-xs font-bold" /><Input type="number" placeholder="Max" value={filters.gsmMax} onChange={e => setFilters({...filters, gsmMax: e.target.value})} className="h-9 text-xs font-bold" /></div></div>
                  <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-slate-500">SQM Range</Label><div className="flex gap-2"><Input type="number" placeholder="Min" value={filters.sqmMin} onChange={e => setFilters({...filters, sqmMin: e.target.value})} className="h-9 text-xs font-bold" /><Input type="number" placeholder="Max" value={filters.sqmMax} onChange={e => setFilters({...filters, sqmMax: e.target.value})} className="h-9 text-xs font-bold" /></div></div>
                  <div className="col-span-2 space-y-1.5"><Label className="text-[10px] font-black uppercase text-slate-500">Technical Remarks Match</Label><Input value={filters.remarks} onChange={e => setFilters({...filters, remarks: e.target.value})} className="h-9 text-xs font-bold" placeholder="Keywords in remarks..." /></div>
                </div>
                <SheetFooter><Button className="w-full font-black uppercase tracking-widest h-12" onClick={() => setIsAdvancedFilterOpen(false)}>Apply Global Logic</Button></SheetFooter>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <MultiSelectFilter label="Company" field="paperCompany" options={getUniqueOptions('paperCompany')} />
          <MultiSelectFilter label="Type" field="paperType" options={getUniqueOptions('paperType')} />
          <MultiSelectFilter label="Status" field="status" options={['Available', 'Reserved', 'Used']} />
          <MultiSelectFilter label="Width" field="widthMm" options={getUniqueOptions('widthMm')} />
          <MultiSelectFilter label="Length" field="lengthMeters" options={getUniqueOptions('lengthMeters')} />
          <MultiSelectFilter label="GSM" field="gsm" options={getUniqueOptions('gsm')} />
          <MultiSelectFilter label="SQM" field="sqm" options={getUniqueOptions('sqm')} />
          <MultiSelectFilter label="Weight" field="weightKg" options={getUniqueOptions('weightKg')} />
          <MultiSelectFilter label="Job No" field="jobNo" options={getUniqueOptions('jobNo')} />
          <MultiSelectFilter label="Job Name" field="jobName" options={getUniqueOptions('jobName')} />
          <MultiSelectFilter label="Lot No" field="lotNo" options={getUniqueOptions('lotNo')} />
          <MultiSelectFilter label="Slit Date" field="dateOfSlit" options={getUniqueOptions('dateOfSlit')} />
        </div>
      </div>

      {/* ERP GRID HEADER BAR */}
      <div className="bg-[#4db6ac] text-white p-3 flex items-center justify-between shrink-0 px-6 rounded-t-2xl shadow-lg">
        <div className="flex items-center gap-4">
          <h2 className="font-black text-sm uppercase tracking-widest flex items-center gap-2">
            <Package className="h-5 w-5" /> Technical Registry Hub
          </h2>
          <Badge className="bg-white/20 text-[10px] font-black border-none uppercase tracking-widest h-6 px-3">
            {filteredRows.length} Matches Found
          </Badge>
          {selectedIds.size > 0 && (
            <Button variant="destructive" size="sm" className="h-7 text-[9px] font-black uppercase animate-in zoom-in px-4" onClick={handleBulkDelete}>
              <Trash2 className="h-3 w-3 mr-1.5" /> Authorize Wipe ({selectedIds.size})
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
          <Table className="border-separate border-spacing-0 min-w-[2200px]">
            <TableHeader className="sticky top-0 z-40 bg-slate-50 border-b shadow-sm">
              <TableRow>
                <TableHead className="w-[50px] text-center border-r sticky left-0 bg-slate-50 z-50">
                  <Checkbox checked={selectedIds.size === paginatedRows.length && paginatedRows.length > 0} onCheckedChange={(val) => {
                    if (val) setSelectedIds(new Set(paginatedRows.map(r => r.id)));
                    else setSelectedIds(new Set());
                  }} />
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
                    <Checkbox checked={selectedIds.has(j.id)} onCheckedChange={(val) => {
                      const next = new Set(selectedIds);
                      if (val) next.add(j.id); else next.delete(j.id);
                      setSelectedIds(next);
                    }} />
                  </TableCell>
                  <TableCell className="text-center font-bold text-[11px] text-slate-400 border-r sticky left-[50px] bg-white z-20 group-hover:bg-slate-50">
                    {(currentPage - 1) * rowsPerPage + i + 1}
                  </TableCell>
                  <TableCell className="font-bold text-[11px] text-teal-700 border-r text-center font-mono">{j.rollNo}</TableCell>
                  <TableCell className="text-center border-r">
                    <Badge variant="outline" className={cn("text-[9px] font-black h-5 uppercase px-2", 
                      j.status === 'Available' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 
                      j.status === 'Reserved' ? 'bg-amber-100 text-amber-700 border-amber-200' : 
                      'bg-red-100 text-red-700 border-red-200')}>
                      {j.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-[11px] border-r uppercase font-bold">{j.paperCompany}</TableCell>
                  <TableCell className="text-[11px] border-r font-medium">{j.paperType}</TableCell>
                  <TableCell className="text-right text-[11px] border-r font-mono">{j.widthMm}mm</TableCell>
                  <TableCell className="text-right text-[11px] border-r font-mono">{j.lengthMeters}m</TableCell>
                  <TableCell className="text-right text-[11px] border-r font-black text-teal-600 font-mono">{j.sqm}</TableCell>
                  <TableCell className="text-right text-[11px] border-r font-mono">{j.gsm}</TableCell>
                  <TableCell className="text-right text-[11px] border-r font-mono">{j.weightKg}kg</TableCell>
                  <TableCell className="text-center text-[11px] border-r whitespace-nowrap">{j.receivedDate}</TableCell>
                  <TableCell className="text-right text-[11px] border-r font-mono">₹{j.purchaseRate || 0}</TableCell>
                  <TableCell className="text-center text-[11px] border-r whitespace-nowrap font-bold text-slate-400">{j.dateOfSlit || 'Not Used'}</TableCell>
                  <TableCell className="text-[11px] border-r font-mono">{j.jobNo || '-'}</TableCell>
                  <TableCell className="text-[11px] border-r truncate max-w-[150px] font-medium">{j.jobName || '-'}</TableCell>
                  <TableCell className="text-[11px] border-r font-mono">{j.lotNo || '-'}</TableCell>
                  <TableCell className="text-[11px] border-r truncate max-w-[200px] italic text-slate-400">{j.remarks || '-'}</TableCell>
                  <TableCell className="text-right sticky right-0 bg-white z-20 group-hover:bg-slate-50 border-l px-2 shadow-[-4px_0_10px_rgba(0,0,0,0.05)]">
                    <div className="flex justify-end gap-1.5">
                      <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full bg-blue-50 text-blue-500 hover:bg-blue-500 hover:text-white" onClick={() => handleOpenDialog(j)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      {isAdmin && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full bg-red-50 text-red-500 hover:bg-red-500 hover:text-white" onClick={() => {
                          showModal('CONFIRMATION', 'Authorize Deletion?', `Remove technical record ${j.rollNo}?`, () => deleteDocumentNonBlocking(doc(firestore!, 'paper_stock', j.id)));
                        }}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
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
              <span className="text-[10px] font-black uppercase text-muted-foreground">Grid Density:</span>
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
            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest border-l pl-4">
              Showing {startRange}–{endRange} of {filteredRows.length} Technical Units
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-1 mx-4">
              <span className="text-[10px] font-black uppercase tracking-widest opacity-50">Page</span>
              <span className="text-xs font-black bg-primary text-white h-6 w-6 flex items-center justify-center rounded-md shadow-sm">{currentPage}</span>
              <span className="text-[10px] font-black uppercase tracking-widest opacity-50">of {totalPages || 1}</span>
            </div>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage >= totalPages}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

      {/* INTAKE / EDIT DIALOG */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[800px] max-h-[95vh] overflow-y-auto p-0 border-none rounded-2xl shadow-3xl">
          <form onSubmit={handleSave}>
            <DialogHeader className="p-6 bg-[#4db6ac] text-white">
              <DialogTitle className="uppercase font-black text-xl tracking-tighter flex items-center gap-2">
                {editingRoll ? `Edit Tech Registry: ${formData.rollNo}` : 'Initialize Technical Unit Intake'}
              </DialogTitle>
            </DialogHeader>
            <div className="p-8 grid grid-cols-2 gap-x-8 gap-y-6 bg-white font-sans">
              {/* Row 1: Sl No / Roll No & Date Received */}
              <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black text-slate-500">Technical Roll No (Read Only)</Label><Input value={formData.rollNo || "RL-XXXX"} readOnly className="h-10 font-black bg-slate-50 text-teal-600 border-teal-100" /></div>
              <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black text-slate-500">Date Received</Label><Input type="date" value={formData.receivedDate} onChange={e => setFormData({ ...formData, receivedDate: e.target.value })} required className="h-10 font-bold" /></div>
              
              {/* Row 2: Status & Paper Company */}
              <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black text-slate-500">Inventory Status</Label>
                <Select value={formData.status} onValueChange={v => setFormData({ ...formData, status: v })}>
                  <SelectTrigger className="h-10 font-bold"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="Available">Available</SelectItem><SelectItem value="Reserved">Reserved</SelectItem><SelectItem value="Used">Used</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 relative"><Label className="text-[10px] uppercase font-black text-slate-500">Paper Company</Label>
                <div className="flex gap-2">
                  <Select value={formData.paperCompany} onValueChange={v => setFormData({ ...formData, paperCompany: v })}>
                    <SelectTrigger className="h-10 font-bold flex-1"><SelectValue placeholder="Select Company" /></SelectTrigger>
                    <SelectContent>{companyList?.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                  {isAdmin && <Button type="button" size="icon" className="h-10 w-10 shrink-0" variant="outline" onClick={() => { setMetadataType('Company'); setIsMetadataModalOpen(true); }}><Plus className="h-4 w-4" /></Button>}
                </div>
              </div>

              {/* Row 3: Paper Type & Width */}
              <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black text-slate-500">Paper Type (Substrate)</Label>
                <div className="flex gap-2">
                  <Select value={formData.paperType} onValueChange={v => setFormData({ ...formData, paperType: v })}>
                    <SelectTrigger className="h-10 font-bold flex-1"><SelectValue placeholder="Select substrate" /></SelectTrigger>
                    <SelectContent>{paperTypeList?.map(t => <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>)}</SelectContent>
                  </Select>
                  {isAdmin && <Button type="button" size="icon" className="h-10 w-10 shrink-0" variant="outline" onClick={() => { setMetadataType('Type'); setIsMetadataModalOpen(true); }}><Plus className="h-4 w-4" /></Button>}
                </div>
              </div>
              <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black text-teal-600">Width (MM)</Label><Input type="number" value={formData.widthMm} onChange={e => setFormData({ ...formData, widthMm: Number(e.target.value) })} required className="h-10 font-black border-teal-100" /></div>

              {/* Row 4: Length & SQM */}
              <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black text-teal-600">Length (MTR)</Label><Input type="number" value={formData.lengthMeters} onChange={e => setFormData({ ...formData, lengthMeters: Number(e.target.value) })} required className="h-10 font-black border-teal-100" /></div>
              <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black text-primary">SQM (Auto-Calculated)</Label><Input value={((Number(formData.widthMm) || 0) * (Number(formData.lengthMeters) || 0) / 1000).toFixed(2)} readOnly className="h-10 font-black bg-primary/5 text-primary border-primary/20" /></div>

              {/* Row 5: GSM & Weight */}
              <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black text-slate-500">GSM</Label><Input type="number" value={formData.gsm} onChange={e => setFormData({ ...formData, gsm: Number(e.target.value) })} required className="h-10 font-bold" /></div>
              <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black text-slate-500">Weight (KG)</Label><Input type="number" value={formData.weightKg} onChange={e => setFormData({ ...formData, weightKg: Number(e.target.value) })} required className="h-10 font-bold" /></div>

              {/* Row 6: Purchase Rate & Date of Slit */}
              <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black text-slate-500">Purchase Rate (Optional)</Label><Input type="number" value={formData.purchaseRate} onChange={e => setFormData({ ...formData, purchaseRate: Number(e.target.value) })} className="h-10 font-bold" /></div>
              <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black text-slate-500">Date of Slit / Use</Label><Input value={formData.dateOfSlit || "Not Used"} readOnly className="h-10 font-black bg-slate-50 text-slate-400 border-slate-100" /></div>

              {/* Row 7: Job No & Job Name */}
              <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black text-slate-500">Job No</Label><Input value={formData.jobNo} onChange={e => setFormData({ ...formData, jobNo: e.target.value })} className="h-10 font-bold" /></div>
              <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black text-slate-500">Job Name / Product</Label><Input value={formData.jobName} onChange={e => setFormData({ ...formData, jobName: e.target.value })} className="h-10 font-bold" /></div>

              {/* Row 8: Lot No & Remarks */}
              <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black text-slate-500">Lot No / Invoice No</Label><Input value={formData.lotNo} onChange={e => setFormData({ ...formData, lotNo: e.target.value })} className="h-10 font-bold" /></div>
              <div className="col-span-2 space-y-1.5"><Label className="text-[10px] uppercase font-black text-slate-500">Technical Production Remarks</Label><Textarea value={formData.remarks} onChange={e => setFormData({ ...formData, remarks: e.target.value })} className="min-h-[100px] font-medium" placeholder="Add relevant production notes..." /></div>
            </div>
            <DialogFooter className="p-6 bg-slate-50 border-t rounded-b-2xl">
              <Button type="submit" disabled={isProcessing} className="w-full h-14 uppercase font-black text-lg bg-[#4db6ac] hover:bg-[#3d9e94] shadow-xl transition-all">
                {isProcessing ? <Loader2 className="animate-spin mr-2" /> : editingRoll ? 'Commit Technical Updates' : 'Authorize Production Entry'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* QUICK ADD MODAL */}
      <Dialog open={isMetadataModalOpen} onOpenChange={setIsMetadataModalOpen}>
        <DialogContent className="sm:max-w-[400px] border-none shadow-2xl rounded-2xl">
          <form onSubmit={handleSaveMetadata}>
            <DialogHeader className="p-6 bg-primary text-white rounded-t-2xl">
              <DialogTitle className="uppercase font-black text-lg tracking-tight">Add New {metadataType}</DialogTitle>
            </DialogHeader>
            <div className="p-8 space-y-4">
              <div className="space-y-2"><Label className="text-[10px] uppercase font-black text-slate-500">Authorized Name / Title</Label><Input name="name" required autoFocus className="h-12 text-lg font-black tracking-tight" /></div>
            </div>
            <DialogFooter className="p-6 pt-0"><Button type="submit" className="w-full h-12 uppercase font-black tracking-widest shadow-lg">Authorize System Entry</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
