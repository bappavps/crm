
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
import { useFirestore, useUser, useCollection, useMemoFirebase, useDoc } from "@/firebase"
import { 
  collection, 
  doc, 
  query, 
  limit, 
  serverTimestamp,
  runTransaction,
  writeBatch,
  orderBy,
  setDoc,
  updateDoc
} from "firebase/firestore"
import { deleteDocumentNonBlocking } from "@/firebase/non-blocking-updates"
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

  // Validation State
  const [errors, setErrors] = useState<Record<string, string>>({})

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
    jobNo: [],
    jobName: [],
    lotNo: [],
    productName: [],
    code: [],
    location: [],
    supplier: [],
    createdByName: []
  })

  const [formData, setFormData] = useState({
    rollNo: "", 
    receivedDate: "",
    jobNo: "",
    paperCompany: "",
    paperType: "",
    gsm: 0,
    size: "",
    widthMm: 0,
    lengthMeters: 0,
    quantity: 1,
    sqm: 0,
    lotNo: "",
    productName: "",
    code: "",
    status: "Available",
    location: "",
    supplier: "",
    createdByName: "",
    remarks: "",
    dateOfSlit: "Not Used"
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

  const getUniqueOptions = (key: string) => {
    if (!rolls) return [];
    const values = rolls.map(r => r[key]).filter(v => v !== undefined && v !== null && v !== "");
    return Array.from(new Set(values)).sort();
  }

  const handleInputChange = (name: string, value: any) => {
    if (['widthMm', 'lengthMeters', 'gsm', 'quantity', 'weightKg', 'purchaseRate'].includes(name)) {
      const numVal = value === "" ? 0 : Number(value);
      setFormData(prev => ({ ...prev, [name]: numVal }));
      
      // Validation
      if (['widthMm', 'lengthMeters', 'gsm', 'quantity'].includes(name) && numVal <= 0) {
        setErrors(prev => ({ ...prev, [name]: `${name} must be > 0` }));
      } else {
        setErrors(prev => { const n = { ...prev }; delete n[name]; return n; });
      }
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const calculatedSqm = useMemo(() => {
    const w = Number(formData.widthMm) || 0;
    const l = Number(formData.lengthMeters) || 0;
    const q = Number(formData.quantity) || 1;
    return Number(((w / 1000) * l * q).toFixed(2));
  }, [formData.widthMm, formData.lengthMeters, formData.quantity]);

  const filteredRows = useMemo(() => {
    if (!rolls) return [];
    return rolls.filter(row => {
      if (filters.search) {
        const s = filters.search.toLowerCase();
        const searchableValues = Object.values(row).map(v => String(v || "").toLowerCase());
        if (!searchableValues.some(val => val.includes(s))) return false;
      }
      const multiFilters = Object.keys(filters).filter(k => Array.isArray(filters[k]) && filters[k].length > 0);
      for (const key of multiFilters) {
        if (!filters[key].includes(row[key])) return false;
      }
      return true;
    });
  }, [rolls, filters]);

  const totalPages = Math.ceil(filteredRows.length / rowsPerPage);
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredRows.slice(start, start + rowsPerPage);
  }, [filteredRows, currentPage, rowsPerPage]);

  const startRange = filteredRows.length === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1;
  const endRange = Math.min(currentPage * rowsPerPage, filteredRows.length);

  const toggleMultiFilter = (key: string, value: any) => {
    setFilters((prev: any) => {
      const current = prev[key] || [];
      const next = current.includes(value) ? current.filter((v: any) => v !== value) : [...current, value];
      return { ...prev, [key]: next };
    });
    setCurrentPage(1);
  };

  const MultiSelectFilter = ({ label, field, options }: { label: string, field: string, options: any[] }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className={cn(
          "h-9 px-3 text-xs gap-2 font-bold bg-white border-primary/10",
          filters[field]?.length > 0 && "border-primary bg-primary/5 text-primary"
        )}>
          {label}
          {filters[field]?.length > 0 && <Badge variant="secondary" className="h-4 px-1 text-[9px] bg-primary text-white">{filters[field].length}</Badge>}
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56 max-h-[300px] overflow-y-auto">
        <DropdownMenuLabel className="text-[10px] uppercase font-black text-muted-foreground">{label} Options</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {options.map(opt => (
          <DropdownMenuCheckboxItem key={opt} checked={filters[field]?.includes(opt)} onCheckedChange={() => toggleMultiFilter(field, opt)} className="text-xs font-bold">
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
    setErrors({});
    if (roll) {
      setEditingRoll(roll);
      setFormData({ ...formData, ...roll });
    } else {
      setEditingRoll(null);
      setFormData({
        rollNo: "", receivedDate: new Date().toISOString().split('T')[0], jobNo: "", paperCompany: "", paperType: "",
        gsm: 0, size: "", widthMm: 0, lengthMeters: 0, quantity: 1, sqm: 0, lotNo: "", productName: "",
        code: "", status: "Available", location: "", supplier: "", createdByName: user?.displayName || user?.email || "System",
        remarks: "", dateOfSlit: "Not Used"
      });
    }
    setIsDialogOpen(true);
  }

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firestore || !user || isProcessing) return; // STEP 1: Prevent multiple submits
    setIsProcessing(true); // STEP 5: Loading state starts

    const finalData = { ...formData, sqm: calculatedSqm };

    try {
      if (editingRoll) {
        // STEP 2: Single awaited Firestore write
        await updateDoc(doc(firestore, 'paper_stock', editingRoll.id), { ...finalData, updatedAt: serverTimestamp() });
        setIsDialogOpen(false); // STEP 6: Close form
        showModal('SUCCESS', 'Roll Updated', 'Technical record has been committed.', undefined, true);
      } else {
        await runTransaction(firestore, async (transaction) => {
          const counterRef = doc(firestore, 'counters', 'paper_roll');
          const counterSnap = await transaction.get(counterRef);
          let nextNum = counterSnap.exists() ? (counterSnap.data().current_number || 0) + 1 : 1;
          const rollId = `RL-${nextNum.toString().padStart(4, '0')}`;
          const newDocRef = doc(collection(firestore, 'paper_stock'), rollId);
          
          transaction.set(newDocRef, { ...finalData, rollNo: rollId, createdAt: serverTimestamp(), createdById: user.uid, id: rollId });
          transaction.set(counterRef, { current_number: nextNum }, { merge: true });
        });
        setIsDialogOpen(false); // STEP 6: Close form
        showModal('SUCCESS', 'Roll Added', `Roll created successfully.`, undefined, true);
      }
    } catch (error: any) {
      // STEP 4: Handle error properly
      showModal('ERROR', 'Transaction Failed', error.message || 'Please try again.');
    } finally {
      setIsProcessing(false); // Enable button again
    }
  };

  const handleSaveMetadata = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formDataObj = new FormData(e.currentTarget);
    const name = formDataObj.get('name') as string;
    const col = metadataType === 'Company' ? 'paper_companies' : 'paper_types';
    if (!name) return;
    try {
      const docId = name.toLowerCase().replace(/\s+/g, '-');
      await setDoc(doc(firestore!, col, docId), { name, createdAt: serverTimestamp() });
      handleInputChange(metadataType === 'Company' ? 'paperCompany' : 'paperType', name);
      setIsMetadataModalOpen(false);
      showModal('SUCCESS', 'Entry Authorized', `${metadataType} added.`, undefined, true);
    } catch (err: any) {
      showModal('ERROR', 'Authorization Failed', err.message);
    }
  }

  const handleBulkDelete = () => {
    if (!firestore || selectedIds.size === 0) return;
    showModal('CONFIRMATION', 'Authorize Bulk Deletion?', `Permanently remove ${selectedIds.size} records?`, async () => {
      setIsProcessing(true);
      const batch = writeBatch(firestore);
      selectedIds.forEach(id => batch.delete(doc(firestore, 'paper_stock', id)));
      await batch.commit().then(() => {
        setSelectedIds(new Set());
        showModal('SUCCESS', 'Batch Deleted', 'Selected rolls removed.', undefined, true);
      }).catch(err => showModal('ERROR', 'Batch Failed', err.message)).finally(() => setIsProcessing(false));
    });
  };

  if (!isMounted) return null;

  return (
    <div className="flex flex-col h-[calc(100vh-10rem)] space-y-4 font-sans">
      <ActionModal isOpen={modal.isOpen} onClose={() => setModal(p => ({ ...p, isOpen: false }))} {...modal} isProcessing={isProcessing} />

      {/* QUICK FILTERS */}
      <div className="bg-white p-4 rounded-2xl border shadow-sm space-y-4 px-6 shrink-0">
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-primary opacity-50" />
            <Input placeholder="Search Roll, Job, Lot..." className="pl-9 h-10 text-sm font-bold bg-slate-50/50" value={filters.search} onChange={e => setFilters({ ...filters, search: e.target.value })} />
          </div>
          <Button variant="ghost" size="sm" onClick={() => setFilters({ search: "", paperCompany: [], paperType: [], status: [] })} className="text-[10px] font-black uppercase text-destructive tracking-widest"><FilterX className="h-4 w-4 mr-1.5" /> Reset All</Button>
        </div>
        <div className="flex flex-wrap gap-2 pt-2">
          <MultiSelectFilter label="Company" field="paperCompany" options={getUniqueOptions('paperCompany')} />
          <MultiSelectFilter label="Type" field="paperType" options={getUniqueOptions('paperType')} />
          <MultiSelectFilter label="Status" field="status" options={['Available', 'Reserved', 'Used']} />
        </div>
      </div>

      {/* HEADER */}
      <div className="bg-[#4db6ac] text-white p-3 flex items-center justify-between shrink-0 px-6 rounded-t-2xl shadow-lg">
        <div className="flex items-center gap-4">
          <h2 className="font-black text-sm uppercase tracking-widest flex items-center gap-2"><Package className="h-5 w-5" /> Technical Registry Hub</h2>
          <Badge className="bg-white/20 text-[10px] font-black border-none h-6 px-3">{filteredRows.length} Rolls Found</Badge>
          {selectedIds.size > 0 && <Button variant="destructive" size="sm" className="h-7 text-[9px] font-black uppercase px-4" onClick={handleBulkDelete}><Trash2 className="h-3 w-3 mr-1.5" /> Wipe ({selectedIds.size})</Button>}
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/20" onClick={() => handleOpenDialog()}><Plus className="h-5 w-5" /></Button>
      </div>

      {/* THE GRID */}
      <Card className="flex-1 overflow-hidden flex flex-col border-none shadow-2xl bg-white rounded-b-2xl">
        <div className="flex-1 overflow-auto scrollbar-thin">
          <Table className="border-separate border-spacing-0 min-w-[3000px]">
            <TableHeader className="sticky top-0 z-40 bg-slate-50 border-b shadow-sm">
              <TableRow>
                <TableHead className="w-[50px] text-center border-r sticky left-0 bg-slate-50 z-50">
                  <Checkbox checked={selectedIds.size === paginatedRows.length && paginatedRows.length > 0} onCheckedChange={(val) => val ? setSelectedIds(new Set(paginatedRows.map(r => r.id))) : setSelectedIds(new Set())} />
                </TableHead>
                <TableHead className="w-[60px] text-center font-black text-[10px] uppercase border-r sticky left-[50px] bg-slate-50 z-50">Sl No.</TableHead>
                <TableHead className="font-black text-[10px] uppercase border-r text-center">Roll ID</TableHead>
                <TableHead className="font-black text-[10px] uppercase border-r text-center">Date Received</TableHead>
                <TableHead className="font-black text-[10px] uppercase border-r">Job No</TableHead>
                <TableHead className="font-black text-[10px] uppercase border-r">Paper Company</TableHead>
                <TableHead className="font-black text-[10px] uppercase border-r">Paper Type</TableHead>
                <TableHead className="font-black text-[10px] uppercase border-r text-right">GSM</TableHead>
                <TableHead className="font-black text-[10px] uppercase border-r">Size</TableHead>
                <TableHead className="font-black text-[10px] uppercase border-r text-right">Width</TableHead>
                <TableHead className="font-black text-[10px] uppercase border-r text-right">Length</TableHead>
                <TableHead className="font-black text-[10px] uppercase border-r text-right">Quantity</TableHead>
                <TableHead className="font-black text-[10px] uppercase border-r text-right text-teal-700">SQM</TableHead>
                <TableHead className="font-black text-[10px] uppercase border-r">Lot No</TableHead>
                <TableHead className="font-black text-[10px] uppercase border-r">Product</TableHead>
                <TableHead className="font-black text-[10px] uppercase border-r">Code</TableHead>
                <TableHead className="font-black text-[10px] uppercase border-r">Status</TableHead>
                <TableHead className="font-black text-[10px] uppercase border-r">Location</TableHead>
                <TableHead className="font-black text-[10px] uppercase border-r">Supplier</TableHead>
                <TableHead className="font-black text-[10px] uppercase border-r">Created By</TableHead>
                <TableHead className="font-black text-[10px] uppercase border-r">Remarks</TableHead>
                <TableHead className="text-right font-black text-[10px] uppercase sticky right-0 bg-slate-50 z-50 border-l shadow-[-4px_0_10px_rgba(0,0,0,0.05)]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {itemsLoading ? (
                <TableRow><TableCell colSpan={22} className="text-center py-20"><Loader2 className="animate-spin mx-auto text-teal-500 h-8 w-8" /></TableCell></TableRow>
              ) : paginatedRows.map((j, i) => (
                <TableRow key={j.id} className={cn("hover:bg-slate-50 transition-colors border-b h-10 group", selectedIds.has(j.id) && "bg-primary/5")}>
                  <TableCell className="text-center border-r sticky left-0 bg-white z-20 group-hover:bg-slate-50"><Checkbox checked={selectedIds.has(j.id)} onCheckedChange={(val) => { const next = new Set(selectedIds); val ? next.add(j.id) : next.delete(j.id); setSelectedIds(next); }} /></TableCell>
                  <TableCell className="text-center font-bold text-[11px] text-slate-400 border-r sticky left-[50px] bg-white z-20 group-hover:bg-slate-50">{(currentPage - 1) * rowsPerPage + i + 1}</TableCell>
                  <TableCell className="font-bold text-[11px] text-teal-700 border-r text-center font-mono">{j.rollNo}</TableCell>
                  <TableCell className="text-center text-[11px] border-r">{j.receivedDate}</TableCell>
                  <TableCell className="text-[11px] border-r font-mono">{j.jobNo || '-'}</TableCell>
                  <TableCell className="text-[11px] border-r uppercase font-bold">{j.paperCompany}</TableCell>
                  <TableCell className="text-[11px] border-r font-medium">{j.paperType}</TableCell>
                  <TableCell className="text-right text-[11px] border-r font-mono">{j.gsm}</TableCell>
                  <TableCell className="text-[11px] border-r">{j.size || '-'}</TableCell>
                  <TableCell className="text-right text-[11px] border-r font-mono">{j.widthMm}mm</TableCell>
                  <TableCell className="text-right text-[11px] border-r font-mono">{j.lengthMeters}m</TableCell>
                  <TableCell className="text-right text-[11px] border-r font-mono">{j.quantity}</TableCell>
                  <TableCell className="text-right text-[11px] border-r font-black text-teal-600 font-mono">{j.sqm}</TableCell>
                  <TableCell className="text-[11px] border-r font-mono">{j.lotNo || '-'}</TableCell>
                  <TableCell className="text-[11px] border-r truncate max-w-[150px] font-medium">{j.productName || '-'}</TableCell>
                  <TableCell className="text-[11px] border-r font-mono">{j.code || '-'}</TableCell>
                  <TableCell className="text-center border-r"><Badge variant="outline" className="text-[9px] font-black h-5 uppercase px-2">{j.status}</Badge></TableCell>
                  <TableCell className="text-[11px] border-r uppercase">{j.location || '-'}</TableCell>
                  <TableCell className="text-[11px] border-r">{j.supplier || '-'}</TableCell>
                  <TableCell className="text-[11px] border-r whitespace-nowrap">{j.createdByName || '-'}</TableCell>
                  <TableCell className="text-[11px] border-r truncate max-w-[200px] italic text-slate-400">{j.remarks || '-'}</TableCell>
                  <TableCell className="text-right sticky right-0 bg-white z-20 group-hover:bg-slate-50 border-l px-2 shadow-[-4px_0_10px_rgba(0,0,0,0.05)]">
                    <div className="flex justify-end gap-1.5"><Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={() => handleOpenDialog(j)}><Pencil className="h-3 w-3" /></Button></div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="bg-slate-50 p-3 border-t flex items-center justify-between shrink-0 px-6">
          <div className="flex items-center gap-4">
            <Select value={rowsPerPage.toString()} onValueChange={v => { setRowsPerPage(Number(v)); setCurrentPage(1); }}><SelectTrigger className="h-8 w-[70px] bg-white text-xs font-bold"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="10">10</SelectItem><SelectItem value="20">20</SelectItem><SelectItem value="50">50</SelectItem><SelectItem value="100">100</SelectItem></SelectContent></Select>
            <span className="text-[10px] font-black text-muted-foreground uppercase border-l pl-4">Showing {startRange}–{endRange} of {filteredRows.length} Rolls</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1}><ChevronLeft className="h-4 w-4" /></Button>
            <span className="text-xs font-black bg-primary text-white h-6 w-6 flex items-center justify-center rounded-md">{currentPage}</span>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage >= totalPages}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      </Card>

      {/* FORM DIALOG */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[800px] max-h-[95vh] overflow-y-auto p-0 border-none rounded-2xl shadow-3xl">
          <form onSubmit={handleSave}>
            <DialogHeader className="p-6 bg-[#4db6ac] text-white">
              <DialogTitle className="uppercase font-black text-xl tracking-tighter">
                {editingRoll ? `Edit Roll: ${formData.rollNo}` : 'Add New Paper Roll'}
              </DialogTitle>
            </DialogHeader>
            <div className="p-8 grid grid-cols-2 gap-x-8 gap-y-6 bg-white font-sans">
              <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black text-slate-500">Roll ID</Label><Input value={formData.rollNo || "AUTO-GEN"} readOnly className="h-10 bg-slate-50 font-black text-teal-600" /></div>
              <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black text-slate-500">Date Received</Label><Input type="date" value={formData.receivedDate} onChange={e => handleInputChange('receivedDate', e.target.value)} required className="h-10 font-bold" /></div>
              
              <div className="space-y-1.5 relative"><Label className="text-[10px] uppercase font-black text-slate-500">Paper Company</Label>
                <div className="flex gap-2"><Select value={formData.paperCompany} onValueChange={v => handleInputChange('paperCompany', v)}><SelectTrigger className="h-10 font-bold flex-1"><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{companyList?.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}</SelectContent></Select>
                {isAdmin && <Button type="button" size="icon" className="h-10 w-10 shrink-0" variant="outline" onClick={() => { setMetadataType('Company'); setIsMetadataModalOpen(true); }}><Plus className="h-4 w-4" /></Button>}</div>
              </div>
              <div className="space-y-1.5 relative"><Label className="text-[10px] uppercase font-black text-slate-500">Paper Type</Label>
                <div className="flex gap-2"><Select value={formData.paperType} onValueChange={v => handleInputChange('paperType', v)}><SelectTrigger className="h-10 font-bold flex-1"><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{paperTypeList?.map(t => <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>)}</SelectContent></Select>
                {isAdmin && <Button type="button" size="icon" className="h-10 w-10 shrink-0" variant="outline" onClick={() => { setMetadataType('Type'); setIsMetadataModalOpen(true); }}><Plus className="h-4 w-4" /></Button>}</div>
              </div>

              <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black text-slate-500">GSM</Label>
                <Input type="number" min="0" value={formData.gsm || ""} onChange={e => handleInputChange('gsm', e.target.value)} required className={cn("h-10 font-bold", errors.gsm && "border-destructive")} />
                {errors.gsm && <p className="text-[9px] font-bold text-destructive">{errors.gsm}</p>}</div>
              <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black text-slate-500">Size</Label><Input value={formData.size} onChange={e => handleInputChange('size', e.target.value)} className="h-10 font-bold" /></div>

              <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black text-slate-500">Width (MM)</Label>
                <Input type="number" min="0" step="0.01" value={formData.widthMm || ""} onChange={e => handleInputChange('widthMm', e.target.value)} required className={cn("h-10 font-bold", errors.widthMm && "border-destructive")} />
                {errors.widthMm && <p className="text-[9px] font-bold text-destructive">{errors.widthMm}</p>}</div>
              <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black text-slate-500">Length (MTR)</Label>
                <Input type="number" min="0" step="0.01" value={formData.lengthMeters || ""} onChange={e => handleInputChange('lengthMeters', e.target.value)} required className={cn("h-10 font-bold", errors.lengthMeters && "border-destructive")} />
                {errors.lengthMeters && <p className="text-[9px] font-bold text-destructive">{errors.lengthMeters}</p>}</div>

              <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black text-slate-500">Quantity</Label>
                <Input type="number" min="0" value={formData.quantity || ""} onChange={e => handleInputChange('quantity', e.target.value)} required className={cn("h-10 font-bold", errors.quantity && "border-destructive")} />
                {errors.quantity && <p className="text-[9px] font-bold text-destructive">{errors.quantity}</p>}</div>
              <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black text-primary">SQM (AUTO-CALCULATED)</Label><Input value={calculatedSqm} readOnly className="h-10 font-black bg-primary/5 text-primary" /></div>

              <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black text-slate-500">Lot No</Label><Input value={formData.lotNo} onChange={e => handleInputChange('lotNo', e.target.value)} className="h-10 font-bold" /></div>
              <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black text-slate-500">Product</Label><Input value={formData.productName} onChange={e => handleInputChange('productName', e.target.value)} className="h-10 font-bold" /></div>

              <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black text-slate-500">Code</Label><Input value={formData.code} onChange={e => handleInputChange('code', e.target.value)} className="h-10 font-bold" /></div>
              <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black text-slate-500">Inventory Status</Label>
                <Select value={formData.status} onValueChange={v => handleInputChange('status', v)}><SelectTrigger className="h-10 font-bold"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Available">Available</SelectItem><SelectItem value="Reserved">Reserved</SelectItem><SelectItem value="Used">Used</SelectItem></SelectContent></Select></div>

              <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black text-slate-500">Location</Label><Input value={formData.location} onChange={e => handleInputChange('location', e.target.value)} className="h-10 font-bold" /></div>
              <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black text-slate-500">Supplier</Label><Input value={formData.supplier} onChange={e => handleInputChange('supplier', e.target.value)} className="h-10 font-bold" /></div>

              <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black text-slate-500">Created By</Label><Input value={formData.createdByName} readOnly className="h-10 bg-slate-50 text-slate-400 font-bold" /></div>
              <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black text-slate-500">Job No</Label><Input value={formData.jobNo} onChange={e => handleInputChange('jobNo', e.target.value)} className="h-10 font-bold" /></div>

              <div className="col-span-2 space-y-1.5"><Label className="text-[10px] uppercase font-black text-slate-500">Technical Production Remarks</Label><Textarea value={formData.remarks} onChange={e => handleInputChange('remarks', e.target.value)} className="min-h-[100px] font-medium" /></div>
            </div>
            <DialogFooter className="p-6 bg-slate-50 border-t rounded-b-2xl">
              <Button type="submit" disabled={isProcessing || Object.keys(errors).length > 0} className="w-full h-14 uppercase font-black text-lg bg-[#4db6ac] hover:bg-[#3d9e94] transition-all">
                {isProcessing ? <Loader2 className="animate-spin mr-2" /> : editingRoll ? 'Commit Technical Updates' : 'Authorize Production Entry'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* METADATA MODAL */}
      <Dialog open={isMetadataModalOpen} onOpenChange={setIsMetadataModalOpen}>
        <DialogContent className="sm:max-w-[400px] border-none shadow-2xl rounded-2xl">
          <form onSubmit={handleSaveMetadata}>
            <DialogHeader className="p-6 bg-primary text-white rounded-t-2xl"><DialogTitle className="uppercase font-black text-lg tracking-tight">Add New {metadataType}</DialogTitle></DialogHeader>
            <div className="p-8 space-y-4"><div className="space-y-2"><Label className="text-[10px] uppercase font-black text-slate-500">Name</Label><Input name="name" required autoFocus className="h-12 text-lg font-black" /></div></div>
            <DialogFooter className="p-6 pt-0"><Button type="submit" className="w-full h-12 uppercase font-black tracking-widest">Save System Entry</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
