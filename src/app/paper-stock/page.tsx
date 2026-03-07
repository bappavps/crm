
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
  ChevronRight,
  ArrowRight,
  Eye,
  Calendar,
  Settings
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
import { useFirestore, useUser } from "@/firebase"
import { 
  collection, 
  doc, 
  query, 
  limit, 
  onSnapshot,
  serverTimestamp,
  runTransaction,
  where,
  orderBy
} from "firebase/firestore"
import { updateDocumentNonBlocking, setDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase/non-blocking-updates"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { usePermissions } from "@/components/auth/permission-context"
import { ActionModal, ModalType } from "@/components/action-modal"

export default function PaperStockPage() {
  const { toast } = useToast()
  const { user } = useUser()
  const firestore = useFirestore()
  const { hasPermission } = usePermissions()
  const [isMounted, setIsMounted] = useState(false)
  const [defaultDate, setDefaultDate] = useState("")
  
  const [modal, setModal] = useState<{
    isOpen: boolean;
    type: ModalType;
    title: string;
    description?: string;
    onConfirm?: () => void;
    autoClose?: boolean;
  }>({
    isOpen: false,
    type: 'SUCCESS',
    title: '',
  });

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isAdvancedFilterOpen, setIsAdvancedFilterOpen] = useState(false)
  const [editingRoll, setEditingRoll] = useState<any>(null)
  
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
    lengthMin: "",
    lengthMax: "",
    jobNo: "",
    jobName: "",
    lotNo: ""
  }

  const [filters, setFilters] = useState(initialFilters)

  const initialFormData = {
    rollNo: "", // System generated
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
    dateOfSlit: "", // Auto from slitting
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

  useEffect(() => { 
    setIsMounted(true)
    const today = new Date().toISOString().split('T')[0]
    setDefaultDate(today)
  }, [])

  // SQM Auto-calculation: (Width * Length) / 1000
  useEffect(() => {
    const w = Number(formData.widthMm) || 0
    const l = Number(formData.lengthMeters) || 0
    const calculatedSqm = Number(((w * l) / 1000).toFixed(2))
    setFormData(prev => ({ ...prev, sqm: calculatedSqm }))
  }, [formData.widthMm, formData.lengthMeters])

  // Data Fetching
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

  // Combined Filtering Logic
  const filteredRows = useMemo(() => {
    return allData.filter(row => {
      if (filters.search) {
        const s = filters.search.toLowerCase();
        const matches = (row.rollNo || "").toLowerCase().includes(s) || 
                        (row.lotNo || "").toLowerCase().includes(s) ||
                        (row.jobNo || "").toLowerCase().includes(s);
        if (!matches) return false;
      }

      if (filters.paperCompany !== "all" && row.paperCompany !== filters.paperCompany) return false;
      if (filters.paperType !== "all" && row.paperType !== filters.paperType) return false;
      if (filters.status !== "all" && row.status !== filters.status) return false;
      
      if (filters.startDate && row.receivedDate < filters.startDate) return false;
      if (filters.endDate && row.receivedDate > filters.endDate) return false;

      if (filters.gsmMin && Number(row.gsm) < Number(filters.gsmMin)) return false;
      if (filters.gsmMax && Number(row.gsm) > Number(filters.gsmMax)) return false;
      if (filters.widthMin && Number(row.widthMm) < Number(filters.widthMin)) return false;
      if (filters.widthMax && Number(row.widthMm) > Number(filters.widthMax)) return false;

      if (filters.jobNo && !(row.jobNo || "").toLowerCase().includes(filters.jobNo.toLowerCase())) return false;
      if (filters.jobName && !(row.jobName || "").toLowerCase().includes(filters.jobName.toLowerCase())) return false;
      if (filters.lotNo && !(row.lotNo || "").toLowerCase().includes(filters.lotNo.toLowerCase())) return false;

      return true;
    });
  }, [allData, filters]);

  const showModal = (type: ModalType, title: string, description?: string, onConfirm?: () => void, autoClose = false) => {
    setModal({ isOpen: true, type, title, description, onConfirm, autoClose });
  };

  const closeModal = () => setModal(prev => ({ ...prev, isOpen: false }));

  const handleOpenDialog = (roll?: any) => {
    if (roll) {
      setEditingRoll(roll)
      setFormData({
        ...initialFormData,
        ...roll,
        gsm: Number(roll.gsm) || 0,
        widthMm: Number(roll.widthMm) || 0,
        lengthMeters: Number(roll.lengthMeters) || 0,
        weightKg: Number(roll.weightKg) || 0,
        purchaseRate: Number(roll.purchaseRate) || 0,
        sqm: Number(roll.sqm) || 0
      })
    } else {
      setEditingRoll(null)
      setFormData({
        ...initialFormData,
        receivedDate: defaultDate,
        createdByName: user?.displayName || "System"
      })
    }
    setIsDialogOpen(true)
  }

  const handleDeleteRoll = (roll: any) => {
    showModal('CONFIRMATION', 'Delete Roll?', `Remove ${roll.rollNo} from registry permanently?`, () => {
      setIsProcessing(true);
      deleteDocumentNonBlocking(doc(firestore!, 'paper_stock', roll.id));
      closeModal();
      showModal('SUCCESS', 'Roll Deleted Successfully', undefined, undefined, true);
      setIsProcessing(false);
    });
  }

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firestore || !user) return;

    setIsProcessing(true);

    try {
      if (editingRoll) {
        // UPDATE EXISTING
        const docRef = doc(firestore, 'paper_stock', editingRoll.id);
        const payload = {
          ...formData,
          gsm: Number(formData.gsm),
          widthMm: Number(formData.widthMm),
          lengthMeters: Number(formData.lengthMeters),
          weightKg: Number(formData.weightKg),
          purchaseRate: Number(formData.purchaseRate),
          sqm: Number(formData.sqm),
          updatedAt: serverTimestamp()
        };
        updateDocumentNonBlocking(docRef, payload);
        setIsDialogOpen(false);
        showModal('SUCCESS', 'Roll Updated Successfully', undefined, undefined, true);
      } else {
        // ADD NEW WITH AUTO-INCREMENT ROLL NO
        await runTransaction(firestore, async (transaction) => {
          const counterRef = doc(firestore, 'counters', 'paper_roll');
          const counterSnap = await transaction.get(counterRef);
          
          let nextNum = 1;
          if (counterSnap.exists()) {
            nextNum = (counterSnap.data().current_number || 0) + 1;
          }
          
          const formattedRollNo = `RL-${nextNum.toString().padStart(4, '0')}`;
          const newDocRef = doc(collection(firestore, 'paper_stock'));
          
          const payload = {
            ...formData,
            rollNo: formattedRollNo,
            gsm: Number(formData.gsm),
            widthMm: Number(formData.widthMm),
            lengthMeters: Number(formData.lengthMeters),
            weightKg: Number(formData.weightKg),
            purchaseRate: Number(formData.purchaseRate),
            sqm: Number(formData.sqm),
            createdAt: serverTimestamp(),
            createdById: user.uid,
            id: newDocRef.id
          };

          transaction.set(newDocRef, payload);
          transaction.set(counterRef, { current_number: nextNum }, { merge: true });
        });
        setIsDialogOpen(false);
        showModal('SUCCESS', 'Roll Added Successfully', 'Unique sequence RL-xxxx assigned.', undefined, true);
      }
    } catch (error: any) {
      showModal('ERROR', 'Operation Failed', error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const clearAllFilters = () => setFilters(initialFilters);

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'available': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'reserved': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'used': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  if (!isMounted) return null;

  return (
    <div className="flex flex-col h-[calc(100vh-10rem)] space-y-4 font-sans">
      <ActionModal 
        isOpen={modal.isOpen}
        onClose={closeModal}
        type={modal.type}
        title={modal.title}
        description={modal.description}
        onConfirm={modal.onConfirm}
        isProcessing={isProcessing}
        autoClose={modal.autoClose}
      />

      {/* QUICK FILTERS */}
      <div className="flex flex-wrap items-center gap-3 bg-white p-3 rounded-xl border shadow-sm px-6">
        <div className="relative min-w-[240px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search Roll No, Lot, Job..." 
            className="pl-8 h-9 text-xs" 
            value={filters.search} 
            onChange={e => setFilters({ ...filters, search: e.target.value })} 
          />
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
            <SelectItem value="Avery Dennison">Avery Dennison</SelectItem>
            <SelectItem value="SMI">SMI</SelectItem>
            <SelectItem value="UPM Raflatac">UPM Raflatac</SelectItem>
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

        <div className="flex items-center gap-2 border-l pl-3">
          <Sheet open={isAdvancedFilterOpen} onOpenChange={setIsAdvancedFilterOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-2 font-bold text-xs">
                <SlidersHorizontal className="h-4 w-4" /> Advanced
              </Button>
            </SheetTrigger>
            <SheetContent className="sm:max-w-[500px] overflow-y-auto">
              <SheetHeader className="pb-6">
                <SheetTitle className="text-xl font-black uppercase tracking-tight">Advanced Technical Filters</SheetTitle>
                <SheetDescription>Granular analysis across all technical fields.</SheetDescription>
              </SheetHeader>
              
              <div className="grid grid-cols-2 gap-6 pb-20">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase">Job No</Label>
                  <Input className="h-9 text-xs" value={filters.jobNo} onChange={e => setFilters({...filters, jobNo: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase">Job Name</Label>
                  <Input className="h-9 text-xs" value={filters.jobName} onChange={e => setFilters({...filters, jobName: e.target.value})} />
                </div>
                <div className="col-span-2 grid grid-cols-2 gap-4 bg-muted/20 p-3 rounded-lg border">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-teal-600">GSM Min</Label>
                    <Input type="number" className="h-8 text-xs" value={filters.gsmMin} onChange={e => setFilters({...filters, gsmMin: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-teal-600">GSM Max</Label>
                    <Input type="number" className="h-8 text-xs" value={filters.gsmMax} onChange={e => setFilters({...filters, gsmMax: e.target.value})} />
                  </div>
                </div>
                <div className="col-span-2 grid grid-cols-2 gap-4 bg-muted/20 p-3 rounded-lg border">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-primary">Width Min</Label>
                    <Input type="number" className="h-8 text-xs" value={filters.widthMin} onChange={e => setFilters({...filters, widthMin: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-primary">Width Max</Label>
                    <Input type="number" className="h-8 text-xs" value={filters.widthMax} onChange={e => setFilters({...filters, widthMax: e.target.value})} />
                  </div>
                </div>
              </div>

              <SheetFooter className="absolute bottom-0 left-0 right-0 bg-white p-6 border-t shadow-lg flex flex-row gap-3">
                <Button variant="outline" className="flex-1 font-bold" onClick={clearAllFilters}>Reset All</Button>
                <Button className="flex-1 font-black uppercase tracking-widest" onClick={() => setIsAdvancedFilterOpen(false)}>Apply Search</Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>

          <Button variant="ghost" size="sm" onClick={clearAllFilters} className="h-9 px-2 text-xs text-destructive hover:bg-destructive/10">
            <FilterX className="h-4 w-4 mr-1" /> Clear
          </Button>
        </div>
      </div>

      {/* ERP TABLE GRID */}
      <Card className="flex-1 overflow-hidden flex flex-col border-none shadow-xl rounded-2xl bg-white">
        <div className="bg-[#4db6ac] text-white p-3 flex items-center justify-between shrink-0 px-6 shadow-md relative z-10">
          <div className="flex items-center gap-4">
            <h2 className="font-black text-sm uppercase tracking-widest flex items-center gap-2">
              <Package className="h-5 w-5" /> Paper Stock Registry
            </h2>
            <Badge className="bg-white/20 text-[10px] font-bold border-none uppercase tracking-tighter">
              Filtered: {filteredRows.length} rows
            </Badge>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/20" onClick={() => handleOpenDialog()}>
              <Plus className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/20">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-auto relative scrollbar-thin">
          <Table className="border-separate border-spacing-0">
            <TableHeader className="sticky top-0 z-30 bg-slate-50 border-b shadow-sm">
              <TableRow>
                <TableHead className="w-[60px] text-center font-black text-[10px] uppercase border-r sticky left-0 bg-slate-50 z-40">Sl No.</TableHead>
                <TableHead className="font-black text-[10px] uppercase border-r text-left bg-slate-50 sticky left-[60px] z-40">Roll No</TableHead>
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
                <TableHead className="font-black text-[10px] uppercase border-r">Lot / Invoice No</TableHead>
                <TableHead className="font-black text-[10px] uppercase border-r">Remarks</TableHead>
                <TableHead className="text-right font-black text-[10px] uppercase sticky right-0 bg-slate-50 z-40 border-l">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={18} className="text-center py-20"><Loader2 className="animate-spin mx-auto text-teal-500 h-8 w-8" /></TableCell></TableRow>
              ) : filteredRows.map((j, i) => (
                <TableRow key={j.id} className="hover:bg-slate-50 transition-colors border-b h-10 group">
                  <TableCell className="text-center font-bold text-[11px] text-slate-400 border-r sticky left-0 bg-white z-20">{i+1}</TableCell>
                  <TableCell className="font-bold text-[11px] text-teal-700 border-r bg-white sticky left-[60px] z-20">{j.rollNo}</TableCell>
                  <TableCell className="text-center border-r">
                    <Badge variant="outline" className={cn("text-[9px] font-bold h-5 uppercase px-2 border shadow-sm", getStatusColor(j.status))}>
                      {j.status || "Available"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-[11px] border-r whitespace-nowrap">{j.paperCompany}</TableCell>
                  <TableCell className="text-[11px] border-r">{j.paperType}</TableCell>
                  <TableCell className="text-right text-[11px] border-r font-mono">{j.widthMm}mm</TableCell>
                  <TableCell className="text-right text-[11px] border-r font-mono">{j.lengthMeters}m</TableCell>
                  <TableCell className="text-right text-[11px] border-r font-black text-teal-600 font-mono">{j.sqm}</TableCell>
                  <TableCell className="text-right text-[11px] border-r font-mono">{j.gsm}</TableCell>
                  <TableCell className="text-right text-[11px] border-r font-mono">{j.weightKg}kg</TableCell>
                  <TableCell className="text-center text-[11px] border-r whitespace-nowrap">{j.receivedDate}</TableCell>
                  <TableCell className="text-right text-[11px] border-r">₹{j.purchaseRate || "0"}</TableCell>
                  <TableCell className="text-center text-[11px] border-r whitespace-nowrap italic text-muted-foreground">{j.dateOfSlit || "Not Used"}</TableCell>
                  <TableCell className="text-[11px] border-r text-blue-600 font-bold">{j.jobNo || "-"}</TableCell>
                  <TableCell className="text-[11px] border-r whitespace-nowrap">{j.jobName || "-"}</TableCell>
                  <TableCell className="text-[11px] border-r font-medium">{j.lotNo || "-"}</TableCell>
                  <TableCell className="text-[11px] border-r max-w-[150px] truncate">{j.remarks || "-"}</TableCell>
                  <TableCell className="text-right sticky right-0 bg-white z-20 group-hover:bg-slate-50 border-l px-2 shadow-[-4px_0_10px_rgba(0,0,0,0.02)]">
                    <div className="flex justify-end gap-1.5">
                      <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full bg-blue-50 text-blue-500 hover:bg-blue-500 hover:text-white" onClick={() => handleOpenDialog(j)}><Pencil className="h-3 w-3" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full bg-yellow-50 text-yellow-600 hover:bg-yellow-500 hover:text-white"><Eye className="h-3 w-3" /></Button>
                      {hasPermission('admin') && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full bg-red-50 text-red-500 hover:bg-red-500 hover:text-white" onClick={() => handleDeleteRoll(j)}><Trash2 className="h-3 w-3" /></Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* UNIFIED ADD/EDIT DIALOG (17 Fields) */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[800px] max-h-[95vh] overflow-y-auto p-0 border-none shadow-2xl rounded-2xl">
          <form onSubmit={handleSave}>
            <DialogHeader className="p-6 bg-[#4db6ac] text-white">
              <DialogTitle className="uppercase font-black text-xl tracking-tight flex items-center gap-2">
                {editingRoll ? <Pencil className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
                {editingRoll ? `Edit Roll: ${formData.rollNo}` : 'Add New substrate'}
              </DialogTitle>
            </DialogHeader>
            
            <div className="p-8 grid grid-cols-2 gap-x-8 gap-y-6 bg-white font-sans">
              {/* ROW 1: Roll No | Status */}
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-black text-slate-500">1. Roll No (System)</Label>
                <Input value={editingRoll ? formData.rollNo : 'RL-XXXX (Auto)'} readOnly className="h-10 font-black uppercase bg-slate-50 text-primary border-primary/20" />
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

              {/* ROW 2: Company | Type */}
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-black text-slate-500">3. Paper Company</Label>
                <Select value={formData.paperCompany} onValueChange={v => setFormData({ ...formData, paperCompany: v })}>
                  <SelectTrigger className="h-10 font-bold"><SelectValue placeholder="Select Company" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Avery Dennison">Avery Dennison</SelectItem>
                    <SelectItem value="SMI">SMI</SelectItem>
                    <SelectItem value="UPM Raflatac">UPM Raflatac</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-black text-slate-500">4. Paper Type</Label>
                <Select value={formData.paperType} onValueChange={v => setFormData({ ...formData, paperType: v })}>
                  <SelectTrigger className="h-10 font-bold"><SelectValue placeholder="Select substrate" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Chromo">Chromo</SelectItem>
                    <SelectItem value="Film">Film</SelectItem>
                    <SelectItem value="Direct Thermal">Direct Thermal</SelectItem>
                    <SelectItem value="Polyester">Polyester</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* ROW 3: Width | Length */}
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-black text-teal-600">5. Width (MM)</Label>
                <Input type="number" value={formData.widthMm} onChange={e => setFormData({ ...formData, widthMm: Number(e.target.value) })} required className="h-10 font-black border-teal-100" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-black text-teal-600">6. Length (MTR)</Label>
                <Input type="number" value={formData.lengthMeters} onChange={e => setFormData({ ...formData, lengthMeters: Number(e.target.value) })} required className="h-10 font-black border-teal-100" />
              </div>

              {/* ROW 4: SQM | GSM */}
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-black text-primary">7. SQM (Auto)</Label>
                <Input value={formData.sqm} readOnly className="h-10 font-black bg-primary/5 text-primary border-primary/20" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-black text-slate-500">8. GSM</Label>
                <Input type="number" value={formData.gsm} onChange={e => setFormData({ ...formData, gsm: Number(e.target.value) })} required className="h-10 font-bold" />
              </div>

              {/* ROW 5: Weight | Date Received */}
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-black text-slate-500">9. Weight (KG)</Label>
                <Input type="number" value={formData.weightKg} onChange={e => setFormData({ ...formData, weightKg: Number(e.target.value) })} className="h-10 font-bold" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-black text-slate-500">10. Date of Received</Label>
                <Input type="date" value={formData.receivedDate} onChange={e => setFormData({ ...formData, receivedDate: e.target.value })} required className="h-10 font-bold" />
              </div>

              {/* ROW 6: Purchase Rate | Date of Slit */}
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-black text-slate-500">11. Purchase Rate (Optional)</Label>
                <Input type="number" value={formData.purchaseRate} onChange={e => setFormData({ ...formData, purchaseRate: Number(e.target.value) })} className="h-10 font-bold" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-black text-slate-500">12. Date of Slit / Use</Label>
                <Input value={formData.dateOfSlit || "System Pending"} readOnly className="h-10 font-bold bg-slate-50 italic text-muted-foreground" />
              </div>

              {/* ROW 7: Job No | Job Name */}
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-black text-slate-500">13. Job No</Label>
                <Input value={formData.jobNo} onChange={e => setFormData({ ...formData, jobNo: e.target.value })} className="h-10 font-bold" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-black text-slate-500">14. Job Name</Label>
                <Input value={formData.jobName} onChange={e => setFormData({ ...formData, jobName: e.target.value })} className="h-10 font-bold" />
              </div>

              {/* ROW 8: Lot No | Created By */}
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-black text-slate-500">15. Lot No / Invoice No</Label>
                <Input value={formData.lotNo} onChange={e => setFormData({ ...formData, lotNo: e.target.value })} className="h-10 font-bold" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-black text-slate-500">16. Created By</Label>
                <Input value={formData.createdByName} readOnly className="h-10 font-bold bg-slate-50 text-slate-400" />
              </div>

              {/* ROW 9: Remarks */}
              <div className="col-span-2 space-y-1.5">
                <Label className="text-[10px] uppercase font-black text-slate-500">17. Remarks</Label>
                <Textarea value={formData.remarks} onChange={e => setFormData({ ...formData, remarks: e.target.value })} className="min-h-[80px]" />
              </div>
            </div>

            <DialogFooter className="p-6 bg-slate-50 border-t rounded-b-2xl">
              <Button type="submit" disabled={isProcessing} className="w-full h-14 uppercase font-black tracking-widest text-lg shadow-xl bg-[#4db6ac] hover:bg-[#3d9e94]">
                {isProcessing ? <Loader2 className="animate-spin mr-2" /> : <ChevronRight className="mr-2 h-6 w-6" />}
                {editingRoll ? 'Commit Updates' : 'Initialize substrate'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
