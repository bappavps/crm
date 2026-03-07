
"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { 
  Search, 
  Plus, 
  Loader2, 
  FilterX, 
  Pencil,
  Trash2,
  Package,
  RefreshCw,
  Filter,
  SlidersHorizontal,
  ArrowRight,
  Eye,
  ChevronRight
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
  SheetDescription,
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
  onSnapshot,
  serverTimestamp,
  runTransaction,
  addDoc
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
  const [defaultDate, setDefaultDate] = useState("")
  
  const [modal, setModal] = useState<{
    isOpen: boolean;
    type: ModalType;
    title: string;
    description?: string;
    onConfirm?: () => void;
    autoClose?: boolean;
  }>({ isOpen: false, type: 'SUCCESS', title: '' });

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isAdvancedFilterOpen, setIsAdvancedFilterOpen] = useState(false)
  const [editingRoll, setEditingRoll] = useState<any>(null)
  
  // Quick Add States
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false)
  const [quickAddType, setQuickAddType] = useState<'company' | 'type'>('company')
  const [quickAddValue, setQuickAddValue] = useState("")

  const initialFilters = {
    search: "",
    startDate: "",
    endDate: "",
    paperCompany: "all",
    paperType: "all",
    status: "all",
    gsmMin: "",
    gsmMax: "",
    widthMin: "",
    widthMax: "",
    lotNo: ""
  }

  const [filters, setFilters] = useState(initialFilters)

  const initialFormData = {
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
  }

  const [formData, setFormData] = useState(initialFormData)
  const [isProcessing, setIsProcessing] = useState(false)
  const [allData, setAllData] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Fetch Master Metadata
  const companiesQuery = useMemoFirebase(() => firestore ? collection(firestore, 'paper_companies') : null, [firestore]);
  const typesQuery = useMemoFirebase(() => firestore ? collection(firestore, 'paper_types') : null, [firestore]);
  const { data: companyList } = useCollection(companiesQuery);
  const { data: paperTypeList } = useCollection(typesQuery);

  useEffect(() => { 
    setIsMounted(true)
    setDefaultDate(new Date().toISOString().split('T')[0])
  }, [])

  // SQM Auto-calculation
  useEffect(() => {
    const w = Number(formData.widthMm) || 0
    const l = Number(formData.lengthMeters) || 0
    const calculatedSqm = Number(((w * l) / 1000).toFixed(2))
    setFormData(prev => ({ ...prev, sqm: calculatedSqm }))
  }, [formData.widthMm, formData.lengthMeters])

  // Real-time Data Listener
  useEffect(() => {
    if (!firestore || !isMounted) return;
    setIsLoading(true);
    const q = query(collection(firestore, 'paper_stock'), limit(1000));
    const unsubscribe = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setAllData(docs);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [firestore, isMounted]);

  const filteredRows = useMemo(() => {
    return allData.filter(row => {
      if (filters.search) {
        const s = filters.search.toLowerCase();
        if (!row.rollNo?.toLowerCase().includes(s) && !row.lotNo?.toLowerCase().includes(s)) return false;
      }
      if (filters.paperCompany !== "all" && row.paperCompany !== filters.paperCompany) return false;
      if (filters.paperType !== "all" && row.paperType !== filters.paperType) return false;
      if (filters.status !== "all" && row.status !== filters.status) return false;
      if (filters.startDate && row.receivedDate < filters.startDate) return false;
      if (filters.endDate && row.receivedDate > filters.endDate) return false;
      if (filters.gsmMin && Number(row.gsm) < Number(filters.gsmMin)) return false;
      if (filters.gsmMax && Number(row.gsm) > Number(filters.gsmMax)) return false;
      return true;
    });
  }, [allData, filters]);

  const showModal = (type: ModalType, title: string, description?: string, onConfirm?: () => void, autoClose = false) => {
    setModal({ isOpen: true, type, title, description, onConfirm, autoClose });
  };

  const handleOpenDialog = (roll?: any) => {
    if (roll) {
      setEditingRoll(roll)
      setFormData({ ...initialFormData, ...roll })
    } else {
      setEditingRoll(null)
      setFormData({ ...initialFormData, receivedDate: defaultDate, createdByName: user?.displayName || "System" })
    }
    setIsDialogOpen(true)
  }

  const handleSaveMetadata = async () => {
    if (!firestore || !quickAddValue.trim()) return;
    
    const collectionName = quickAddType === 'company' ? 'paper_companies' : 'paper_types';
    const list = quickAddType === 'company' ? companyList : paperTypeList;
    
    // Check for duplicates
    if (list?.some(item => item.name.toLowerCase() === quickAddValue.trim().toLowerCase())) {
      showModal('ERROR', 'Duplicate Value', 'This name already exists in the master list.');
      return;
    }

    setIsProcessing(true);
    try {
      await addDoc(collection(firestore, collectionName), {
        name: quickAddValue.trim(),
        createdAt: serverTimestamp()
      });
      
      // Auto-select newly added value
      if (quickAddType === 'company') setFormData(p => ({ ...p, paperCompany: quickAddValue.trim() }));
      else setFormData(p => ({ ...p, paperType: quickAddValue.trim() }));

      setIsQuickAddOpen(false);
      setQuickAddValue("");
      showModal('SUCCESS', 'Metadata Added', undefined, undefined, true);
    } catch (e: any) {
      showModal('ERROR', 'Save Failed', e.message);
    } finally {
      setIsProcessing(true); // Component refresh
      setIsProcessing(false);
    }
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firestore || !user) return;
    setIsProcessing(true);

    try {
      if (editingRoll) {
        updateDocumentNonBlocking(doc(firestore, 'paper_stock', editingRoll.id), { ...formData, updatedAt: serverTimestamp() });
        setIsDialogOpen(false);
        showModal('SUCCESS', 'Roll Updated', undefined, undefined, true);
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
        showModal('SUCCESS', 'Roll Initialized', undefined, undefined, true);
      }
    } catch (error: any) {
      showModal('ERROR', 'Transaction Failed', error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isMounted) return null;

  return (
    <div className="flex flex-col h-[calc(100vh-10rem)] space-y-4 font-sans">
      <ActionModal isOpen={modal.isOpen} onClose={() => setModal(p => ({ ...p, isOpen: false }))} {...modal} isProcessing={isProcessing} />

      {/* QUICK FILTERS */}
      <div className="flex flex-wrap items-center gap-3 bg-white p-3 rounded-xl border shadow-sm px-6">
        <div className="relative min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search Roll / Lot..." className="pl-8 h-9 text-xs" value={filters.search} onChange={e => setFilters({ ...filters, search: e.target.value })} />
        </div>
        <div className="flex items-center gap-2">
          <Input type="date" className="h-9 text-[10px] w-[130px]" value={filters.startDate} onChange={e => setFilters({ ...filters, startDate: e.target.value })} />
          <ArrowRight className="h-3 w-3 text-muted-foreground" />
          <Input type="date" className="h-9 text-[10px] w-[130px]" value={filters.endDate} onChange={e => setFilters({ ...filters, endDate: e.target.value })} />
        </div>
        <Select value={filters.paperCompany} onValueChange={v => setFilters({ ...filters, paperCompany: v })}>
          <SelectTrigger className="h-9 text-xs w-[150px]"><SelectValue placeholder="Company" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Companies</SelectItem>
            {companyList?.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.status} onValueChange={v => setFilters({ ...filters, status: v })}>
          <SelectTrigger className="h-9 text-xs w-[120px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="Available">Available</SelectItem>
            <SelectItem value="Reserved">Reserved</SelectItem>
            <SelectItem value="Used">Used</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex-1" />
        <Sheet open={isAdvancedFilterOpen} onOpenChange={setIsAdvancedFilterOpen}>
          <SheetTrigger asChild><Button variant="outline" size="sm" className="h-9 gap-2 font-bold text-xs"><SlidersHorizontal className="h-4 w-4" /> Advanced</Button></SheetTrigger>
          <SheetContent className="sm:max-w-[500px]">
            <SheetHeader><SheetTitle className="font-black uppercase">Technical Filters</SheetTitle></SheetHeader>
            <div className="grid grid-cols-2 gap-6 py-10">
              <div className="space-y-2"><Label className="text-[10px] uppercase font-black">GSM Min</Label><Input type="number" value={filters.gsmMin} onChange={e => setFilters({...filters, gsmMin: e.target.value})} /></div>
              <div className="space-y-2"><Label className="text-[10px] uppercase font-black">GSM Max</Label><Input type="number" value={filters.gsmMax} onChange={e => setFilters({...filters, gsmMax: e.target.value})} /></div>
            </div>
            <SheetFooter><Button className="w-full font-black uppercase" onClick={() => setIsAdvancedFilterOpen(false)}>Apply Search</Button></SheetFooter>
          </SheetContent>
        </Sheet>
        <Button variant="ghost" size="sm" onClick={() => setFilters(initialFilters)} className="h-9 text-xs text-destructive hover:bg-destructive/10"><FilterX className="h-4 w-4 mr-1" /> Clear</Button>
      </div>

      {/* ERP GRID */}
      <Card className="flex-1 overflow-hidden flex flex-col border-none shadow-xl rounded-2xl bg-white">
        <div className="bg-[#4db6ac] text-white p-3 flex items-center justify-between shrink-0 px-6 shadow-md">
          <div className="flex items-center gap-4">
            <h2 className="font-black text-sm uppercase tracking-widest flex items-center gap-2"><Package className="h-5 w-5" /> Paper Stock Registry</h2>
            <Badge className="bg-white/20 text-[10px] font-bold border-none uppercase">Filtered: {filteredRows.length}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/20" onClick={() => handleOpenDialog()}><Plus className="h-5 w-5" /></Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/20"><RefreshCw className="h-4 w-4" /></Button>
          </div>
        </div>

        <div className="flex-1 overflow-auto scrollbar-thin">
          <Table className="border-separate border-spacing-0">
            <TableHeader className="sticky top-0 z-30 bg-slate-50 border-b">
              <TableRow>
                <TableHead className="w-[60px] text-center font-black text-[10px] uppercase border-r sticky left-0 bg-slate-50">Sr.</TableHead>
                <TableHead className="font-black text-[10px] uppercase border-r text-left bg-slate-50 sticky left-[60px]">Roll No</TableHead>
                <TableHead className="font-black text-[10px] uppercase border-r text-center">Status</TableHead>
                <TableHead className="font-black text-[10px] uppercase border-r">Company</TableHead>
                <TableHead className="font-black text-[10px] uppercase border-r">Type</TableHead>
                <TableHead className="font-black text-[10px] uppercase border-r text-right">Width (MM)</TableHead>
                <TableHead className="font-black text-[10px] uppercase border-r text-right">Length (MTR)</TableHead>
                <TableHead className="font-black text-[10px] uppercase border-r text-right text-teal-700">SQM</TableHead>
                <TableHead className="font-black text-[10px] uppercase border-r text-right">GSM</TableHead>
                <TableHead className="font-black text-[10px] uppercase border-r text-right">Weight (KG)</TableHead>
                <TableHead className="font-black text-[10px] uppercase border-r text-center">Received</TableHead>
                <TableHead className="font-black text-[10px] uppercase border-r text-right">Rate</TableHead>
                <TableHead className="font-black text-[10px] uppercase border-r text-center">Used Date</TableHead>
                <TableHead className="font-black text-[10px] uppercase border-r">Job No</TableHead>
                <TableHead className="font-black text-[10px] uppercase border-r">Lot No</TableHead>
                <TableHead className="font-black text-[10px] uppercase border-r">Remarks</TableHead>
                <TableHead className="text-right font-black text-[10px] uppercase sticky right-0 bg-slate-50 z-40 border-l">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={17} className="text-center py-20"><Loader2 className="animate-spin mx-auto text-teal-500 h-8 w-8" /></TableCell></TableRow>
              ) : filteredRows.map((j, i) => (
                <TableRow key={j.id} className="hover:bg-slate-50 transition-colors border-b h-10 group">
                  <TableCell className="text-center font-bold text-[11px] text-slate-400 border-r sticky left-0 bg-white z-20">{i+1}</TableCell>
                  <TableCell className="font-bold text-[11px] text-teal-700 border-r bg-white sticky left-[60px] z-20">{j.rollNo}</TableCell>
                  <TableCell className="text-center border-r">
                    <Badge variant="outline" className={cn("text-[9px] font-bold h-5 uppercase px-2", 
                      j.status === 'Available' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 
                      j.status === 'Reserved' ? 'bg-amber-100 text-amber-700 border-amber-200' : 
                      'bg-red-100 text-red-700 border-red-200')}>
                      {j.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-[11px] border-r">{j.paperCompany}</TableCell>
                  <TableCell className="text-[11px] border-r">{j.paperType}</TableCell>
                  <TableCell className="text-right text-[11px] border-r font-mono">{j.widthMm}mm</TableCell>
                  <TableCell className="text-right text-[11px] border-r font-mono">{j.lengthMeters}m</TableCell>
                  <TableCell className="text-right text-[11px] border-r font-black text-teal-600 font-mono">{j.sqm}</TableCell>
                  <TableCell className="text-right text-[11px] border-r font-mono">{j.gsm}</TableCell>
                  <TableCell className="text-right text-[11px] border-r font-mono">{j.weightKg}kg</TableCell>
                  <TableCell className="text-center text-[11px] border-r whitespace-nowrap">{j.receivedDate}</TableCell>
                  <TableCell className="text-right text-[11px] border-r">₹{j.purchaseRate}</TableCell>
                  <TableCell className="text-center text-[11px] border-r italic text-muted-foreground">{j.dateOfSlit}</TableCell>
                  <TableCell className="text-[11px] border-r font-bold text-blue-600">{j.jobNo || "-"}</TableCell>
                  <TableCell className="text-[11px] border-r font-medium">{j.lotNo || "-"}</TableCell>
                  <TableCell className="text-[11px] border-r max-w-[150px] truncate">{j.remarks || "-"}</TableCell>
                  <TableCell className="text-right sticky right-0 bg-white z-20 group-hover:bg-slate-50 border-l px-2">
                    <div className="flex justify-end gap-1.5">
                      <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full bg-blue-50 text-blue-500 hover:bg-blue-500 hover:text-white" onClick={() => handleOpenDialog(j)}><Pencil className="h-3 w-3" /></Button>
                      {isAdmin && <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full bg-red-50 text-red-500 hover:bg-red-500 hover:text-white" onClick={() => {
                        showModal('CONFIRMATION', 'Delete Roll?', `Remove ${j.rollNo} from registry?`, () => deleteDocumentNonBlocking(doc(firestore!, 'paper_stock', j.id)));
                      }}><Trash2 className="h-3 w-3" /></Button>}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* MAIN INTAKE DIALOG */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[800px] max-h-[95vh] overflow-y-auto p-0 border-none rounded-2xl">
          <form onSubmit={handleSave}>
            <DialogHeader className="p-6 bg-[#4db6ac] text-white">
              <DialogTitle className="uppercase font-black flex items-center gap-2">{editingRoll ? `Edit Roll: ${formData.rollNo}` : 'Add New Substrate'}</DialogTitle>
            </DialogHeader>
            <div className="p-8 grid grid-cols-2 gap-x-8 gap-y-6 bg-white font-sans">
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-black text-slate-500">1. Roll No (System)</Label>
                <Input value={editingRoll ? formData.rollNo : 'RL-XXXX (Auto)'} readOnly className="h-10 font-black bg-slate-50 border-primary/20" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-black text-slate-500">2. Status</Label>
                <Select value={formData.status} onValueChange={v => setFormData({ ...formData, status: v })}>
                  <SelectTrigger className="h-10 font-bold"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Available">Available</SelectItem>
                    <SelectItem value="Reserved">Reserved</SelectItem>
                    <SelectItem value="Used">Used</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-black text-slate-500">3. Paper Company</Label>
                <div className="flex gap-2">
                  <Select value={formData.paperCompany} onValueChange={v => setFormData({ ...formData, paperCompany: v })}>
                    <SelectTrigger className="h-10 font-bold flex-1"><SelectValue placeholder="Select Company" /></SelectTrigger>
                    <SelectContent>
                      {companyList?.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {isAdmin && (
                    <Button type="button" size="icon" className="h-10 w-10 shrink-0 bg-[#4db6ac] hover:bg-[#3d9e94]" onClick={() => { setQuickAddType('company'); setIsQuickAddOpen(true); }}>
                      <Plus className="h-5 w-5" />
                    </Button>
                  )}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-black text-slate-500">4. Paper Type</Label>
                <div className="flex gap-2">
                  <Select value={formData.paperType} onValueChange={v => setFormData({ ...formData, paperType: v })}>
                    <SelectTrigger className="h-10 font-bold flex-1"><SelectValue placeholder="Select substrate" /></SelectTrigger>
                    <SelectContent>
                      {paperTypeList?.map(t => <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {isAdmin && (
                    <Button type="button" size="icon" className="h-10 w-10 shrink-0 bg-[#4db6ac] hover:bg-[#3d9e94]" onClick={() => { setQuickAddType('type'); setIsQuickAddOpen(true); }}>
                      <Plus className="h-5 w-5" />
                    </Button>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-black text-teal-600">5. Width (MM)</Label>
                <Input type="number" value={formData.widthMm} onChange={e => setFormData({ ...formData, widthMm: Number(e.target.value) })} required className="h-10 font-black border-teal-100" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-black text-teal-600">6. Length (MTR)</Label>
                <Input type="number" value={formData.lengthMeters} onChange={e => setFormData({ ...formData, lengthMeters: Number(e.target.value) })} required className="h-10 font-black border-teal-100" />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-black text-primary">7. SQM (Auto)</Label>
                <Input value={formData.sqm} readOnly className="h-10 font-black bg-primary/5 text-primary border-primary/20" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-black text-slate-500">8. GSM</Label>
                <Input type="number" value={formData.gsm} onChange={e => setFormData({ ...formData, gsm: Number(e.target.value) })} required className="h-10 font-bold" />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-black text-slate-500">9. Weight (KG)</Label>
                <Input type="number" value={formData.weightKg} onChange={e => setFormData({ ...formData, weightKg: Number(e.target.value) })} className="h-10 font-bold" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-black text-slate-500">10. Date of Received</Label>
                <Input type="date" value={formData.receivedDate} onChange={e => setFormData({ ...formData, receivedDate: e.target.value })} required className="h-10 font-bold" />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-black text-slate-500">11. Purchase Rate (Optional)</Label>
                <Input type="number" value={formData.purchaseRate} onChange={e => setFormData({ ...formData, purchaseRate: Number(e.target.value) })} className="h-10 font-bold" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-black text-slate-500">12. Date of Slit / Use</Label>
                <Input value={formData.dateOfSlit} readOnly className="h-10 font-bold bg-slate-50 italic text-muted-foreground" />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-black text-slate-500">13. Job No</Label>
                <Input value={formData.jobNo} onChange={e => setFormData({ ...formData, jobNo: e.target.value })} className="h-10 font-bold" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-black text-slate-500">14. Job Name</Label>
                <Input value={formData.jobName} onChange={e => setFormData({ ...formData, jobName: e.target.value })} className="h-10 font-bold" />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-black text-slate-500">15. Lot No / Invoice No</Label>
                <Input value={formData.lotNo} onChange={e => setFormData({ ...formData, lotNo: e.target.value })} className="h-10 font-bold" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-black text-slate-500">16. Created By</Label>
                <Input value={formData.createdByName} readOnly className="h-10 font-bold bg-slate-50 text-slate-400" />
              </div>

              <div className="col-span-2 space-y-1.5">
                <Label className="text-[10px] uppercase font-black text-slate-500">17. Remarks</Label>
                <Textarea value={formData.remarks} onChange={e => setFormData({ ...formData, remarks: e.target.value })} className="min-h-[80px]" />
              </div>
            </div>
            <DialogFooter className="p-6 bg-slate-50 border-t rounded-b-2xl">
              <Button type="submit" disabled={isProcessing} className="w-full h-14 uppercase font-black text-lg bg-[#4db6ac] hover:bg-[#3d9e94]">
                {isProcessing ? <Loader2 className="animate-spin mr-2" /> : <ChevronRight className="mr-2 h-6 w-6" />}
                {editingRoll ? 'Commit Updates' : 'Initialize substrate'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* QUICK ADD METADATA MODAL */}
      <Dialog open={isQuickAddOpen} onOpenChange={setIsQuickAddOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="uppercase font-black">Add Paper {quickAddType === 'company' ? 'Company' : 'Type'}</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label className="text-[10px] uppercase font-black">Name</Label>
              <Input value={quickAddValue} onChange={e => setQuickAddValue(e.target.value)} placeholder={`e.g. ${quickAddType === 'company' ? 'ITC Paper' : 'Maplitho'}`} />
            </div>
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="ghost" className="font-bold flex-1" onClick={() => setIsQuickAddOpen(false)}>Cancel</Button>
            <Button className="font-black uppercase flex-1 bg-[#4db6ac] hover:bg-[#3d9e94]" onClick={handleSaveMetadata}>Save {quickAddType}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
