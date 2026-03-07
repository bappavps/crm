
"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { 
  Search, 
  Plus, 
  Loader2, 
  FilterX, 
  Settings2,
  FileDown,
  Pencil,
  Trash2,
  AlertTriangle,
  Info,
  Package,
  CheckCircle2,
  Copy,
  RefreshCw,
  Filter,
  Eye,
  ChevronLeft,
  ChevronRight
} from "lucide-react"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter
} from "@/components/ui/dialog"
import { useFirestore, useUser, useMemoFirebase } from "@/firebase"
import { 
  collection, 
  doc, 
  query, 
  where, 
  orderBy, 
  limit, 
  onSnapshot,
  deleteDoc,
  serverTimestamp,
  setDoc,
  updateDoc
} from "firebase/firestore"
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
  
  // Messaging Modal State
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
  const [editingRoll, setEditingRoll] = useState<any>(null)
  const [intakeForm, setIntakeForm] = useState({ widthMm: 0, lengthMeters: 0, quantity: 1 })
  const [isProcessing, setIsProcessing] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  
  const [rows, setRows] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [indexErrorUrl, setIndexErrorUrl] = useState<string | null>(null)

  const [filters, setFilters] = useState({
    company: "",
    paperType: "",
    gsm: "",
    status: "",
    startDate: "",
    endDate: "",
    search: ""
  })

  useEffect(() => { 
    setIsMounted(true)
    setDefaultDate(new Date().toISOString().split('T')[0])
  }, [])

  const liveSqm = useMemo(() => {
    const w = intakeForm.widthMm || 0;
    const l = intakeForm.lengthMeters || 0;
    const q = intakeForm.quantity || 1;
    return ((w / 1000) * l * q).toFixed(2);
  }, [intakeForm]);

  const showModal = (type: ModalType, title: string, description?: string, onConfirm?: () => void, autoClose = false) => {
    setModal({ isOpen: true, type, title, description, onConfirm, autoClose });
  };

  const closeModal = () => setModal(prev => ({ ...prev, isOpen: false }));

  useEffect(() => {
    if (!firestore || !isMounted) return;

    setIsLoading(true);
    setIndexErrorUrl(null);

    const buildQuery = () => {
      let q = collection(firestore, 'paper_stock');
      let constraints: any[] = [];

      if (filters.company) constraints.push(where('paperCompany', '==', filters.company));
      if (filters.paperType) constraints.push(where('paperType', '==', filters.paperType));
      if (filters.gsm) constraints.push(where('gsm', '==', Number(filters.gsm)));
      if (filters.status) constraints.push(where('status', '==', filters.status));
      if (filters.startDate) constraints.push(where('receivedDate', '>=', filters.startDate));
      if (filters.endDate) constraints.push(where('receivedDate', '<=', filters.endDate));

      if (constraints.length > 0) {
        return query(q, ...constraints, limit(200));
      }
      return query(q, limit(200));
    };

    const unsubscribe = onSnapshot(buildQuery(), 
      (snap) => {
        let docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        if (filters.search) {
          const s = filters.search.toLowerCase();
          docs = docs.filter(d => 
            (d.rollNo || "").toLowerCase().includes(s) || 
            (d.lotNo || "").toLowerCase().includes(s) || 
            (d.jobNo || "").toLowerCase().includes(s)
          );
        }

        setRows(docs);
        setIsLoading(false);
      },
      (err: any) => {
        if (err.message?.includes("index")) {
          const match = err.message.match(/https:\/\/console\.firebase\.google\.com[^\s]*/);
          setIndexErrorUrl(match ? match[0] : "unknown");
          onSnapshot(query(collection(firestore, 'paper_stock'), limit(100)), (s) => {
            setRows(s.docs.map(d => ({ id: d.id, ...d.data() })));
            setIsLoading(false);
          });
        } else {
          setIsLoading(false);
        }
      }
    );

    return () => unsubscribe();
  }, [firestore, isMounted, filters]);

  const handleDeleteRoll = (roll: any) => {
    showModal('CONFIRMATION', 'Delete Roll?', `Remove ${roll.rollNo} from registry permanently?`, async () => {
      setIsProcessing(true);
      try {
        await deleteDoc(doc(firestore!, 'paper_stock', roll.id));
        closeModal();
        showModal('SUCCESS', 'Roll Deleted Successfully', undefined, undefined, true);
      } catch (err: any) {
        showModal('ERROR', 'System Error', err.message);
      } finally {
        setIsProcessing(false);
      }
    });
  }

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsProcessing(true);
    const form = new FormData(e.currentTarget);
    const data: any = Object.fromEntries(form.entries());
    
    const width = Number(data.widthMm);
    const length = Number(data.lengthMeters);
    const quantity = Number(data.quantity) || 1;
    const sqm = Number(((width / 1000) * length * quantity).toFixed(2));

    try {
      const rollId = String(data.rollNo);
      const docRef = doc(firestore!, 'paper_stock', rollId);
      
      const payload = {
        ...data,
        widthMm: width,
        lengthMeters: length,
        quantity,
        gsm: Number(data.gsm),
        purchaseRate: Number(data.purchaseRate),
        sqm,
        updatedAt: serverTimestamp(),
        ...(editingRoll ? {} : { status: 'Available', createdAt: serverTimestamp(), createdById: user?.uid })
      };

      if (editingRoll) {
        await updateDoc(docRef, payload);
      } else {
        await setDoc(docRef, payload, { merge: true });
      }

      setIsDialogOpen(false);
      showModal('SUCCESS', editingRoll ? 'Roll Updated Successfully' : 'Roll Added Successfully', undefined, undefined, true);
    } catch (err: any) {
      showModal('ERROR', 'Save Failed', err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'available':
      case 'in stock':
        return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'reserved':
      case 'partial':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'used':
      case 'consumed':
        return 'bg-red-100 text-red-700 border-red-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  if (!isMounted) return <div className="flex h-[70vh] items-center justify-center" suppressHydrationWarning><Loader2 className="animate-spin text-primary" /></div>

  return (
    <div className="flex flex-col h-[calc(100vh-10rem)] space-y-4 font-sans" suppressHydrationWarning>
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

      {/* SEARCH AND FILTER BAR */}
      <div className="flex flex-wrap items-center gap-2 bg-white p-3 rounded-lg border shadow-sm">
        <div className="relative min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search Roll ID, Lot..." 
            className="pl-8 h-9 text-xs" 
            value={filters.search} 
            onChange={e => setFilters({...filters, search: e.target.value})} 
          />
        </div>
        <Input 
          type="date" 
          className="h-9 text-xs w-[140px]" 
          value={filters.startDate} 
          onChange={e => setFilters({...filters, startDate: e.target.value})} 
        />
        <Input 
          placeholder="Company" 
          className="h-9 text-xs w-[140px]" 
          value={filters.company} 
          onChange={e => setFilters({...filters, company: e.target.value})} 
        />
        <Input 
          placeholder="Paper Type" 
          className="h-9 text-xs w-[140px]" 
          value={filters.paperType} 
          onChange={e => setFilters({...filters, paperType: e.target.value})} 
        />
        <Input 
          placeholder="GSM" 
          type="number" 
          className="h-9 text-xs w-[100px]" 
          value={filters.gsm} 
          onChange={e => setFilters({...filters, gsm: e.target.value})} 
        />
        <Button variant="ghost" size="sm" onClick={() => setFilters({company:"", paperType:"", gsm:"", status:"", startDate:"", endDate:"", search:""})} className="h-9 px-2 text-xs">
          <FilterX className="h-4 w-4 mr-1" /> Clear
        </Button>
      </div>

      {indexErrorUrl && (
        <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg flex items-center justify-between">
          <p className="text-[10px] font-bold text-amber-800 uppercase flex items-center gap-2">
            <AlertTriangle className="h-3 w-3" /> Firestore Index Required for combined sorting.
          </p>
          <Button asChild size="sm" className="h-7 text-[9px] bg-amber-600 hover:bg-amber-700">
            <a href={indexErrorUrl} target="_blank">Authorize Now</a>
          </Button>
        </div>
      )}

      {/* ERP STYLE TABLE CONTAINER */}
      <Card className="flex-1 overflow-hidden flex flex-col border-none shadow-xl rounded-xl bg-white">
        {/* TEAL HEADER BAR */}
        <div className="bg-[#4db6ac] text-white p-3 flex items-center justify-between shrink-0 px-6">
          <h2 className="font-bold text-sm uppercase tracking-wider flex items-center gap-2">
            <Package className="h-4 w-4" /> Paper Stock Registry
          </h2>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/20" onClick={() => setFilters({...filters})}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/20" onClick={() => setShowFilters(!showFilters)}>
              <Filter className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/20" onClick={() => { setEditingRoll(null); setIsDialogOpen(true); }}>
              <Plus className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/20">
              <Search className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-auto relative scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
          <Table className="border-separate border-spacing-0">
            <TableHeader className="sticky top-0 z-30 bg-slate-50 border-b shadow-sm">
              <TableRow>
                <TableHead className="w-[50px] text-center font-bold text-[11px] uppercase border-r sticky left-0 bg-slate-50 z-40 text-slate-600">Sr</TableHead>
                <TableHead className="font-bold text-[11px] uppercase text-center border-r text-slate-600">Date Received</TableHead>
                <TableHead className="font-bold text-[11px] uppercase border-r text-slate-600">Roll ID</TableHead>
                <TableHead className="font-bold text-[11px] uppercase border-r text-slate-600">Job No</TableHead>
                <TableHead className="font-bold text-[11px] uppercase border-r text-slate-600">Paper Company</TableHead>
                <TableHead className="font-bold text-[11px] uppercase border-r text-slate-600">Paper Type</TableHead>
                <TableHead className="font-bold text-[11px] uppercase text-right border-r text-slate-600">GSM</TableHead>
                <TableHead className="font-bold text-[11px] uppercase border-r text-slate-600">Size</TableHead>
                <TableHead className="font-bold text-[11px] uppercase text-right border-r text-slate-600">Width</TableHead>
                <TableHead className="font-bold text-[11px] uppercase text-right border-r text-slate-600">Length</TableHead>
                <TableHead className="font-bold text-[11px] uppercase text-right border-r text-slate-600 text-teal-700">SQM</TableHead>
                <TableHead className="font-bold text-[11px] uppercase border-r text-slate-600">Lot No</TableHead>
                <TableHead className="font-bold text-[11px] uppercase border-r text-slate-600">Product</TableHead>
                <TableHead className="font-bold text-[11px] uppercase border-r text-slate-600">Code</TableHead>
                <TableHead className="font-bold text-[11px] uppercase text-center border-r text-slate-600">Status</TableHead>
                <TableHead className="font-bold text-[11px] uppercase border-r text-slate-600">Location</TableHead>
                <TableHead className="font-bold text-[11px] uppercase border-r text-slate-600">Supplier</TableHead>
                <TableHead className="font-bold text-[11px] uppercase border-r text-slate-600">Created By</TableHead>
                <TableHead className="text-right font-bold text-[11px] uppercase sticky right-0 bg-slate-50 z-40 text-slate-600 border-l">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={19} className="text-center py-20"><Loader2 className="animate-spin mx-auto text-teal-500 h-8 w-8" /></TableCell></TableRow>
              ) : rows.map((j, i) => (
                <TableRow key={j.id} className="hover:bg-slate-50 transition-colors border-b h-10 group">
                  <TableCell className="text-center font-bold text-[11px] text-slate-400 border-r sticky left-0 bg-white z-20 group-hover:bg-slate-50">{i+1}</TableCell>
                  <TableCell className="text-center text-[11px] border-r whitespace-nowrap">{j.receivedDate}</TableCell>
                  <TableCell className="font-bold text-[11px] text-teal-700 border-r">{j.rollNo}</TableCell>
                  <TableCell className="text-[11px] border-r font-medium text-blue-600">{j.jobNo || "-"}</TableCell>
                  <TableCell className="text-[11px] border-r whitespace-nowrap">{j.paperCompany}</TableCell>
                  <TableCell className="text-[11px] border-r">{j.paperType}</TableCell>
                  <TableCell className="text-right text-[11px] border-r font-mono">{j.gsm}</TableCell>
                  <TableCell className="text-[11px] border-r">{j.size || "-"}</TableCell>
                  <TableCell className="text-right text-[11px] border-r font-mono">{j.widthMm}mm</TableCell>
                  <TableCell className="text-right text-[11px] border-r font-mono">{j.lengthMeters}m</TableCell>
                  <TableCell className="text-right text-[11px] border-r font-bold text-teal-600 font-mono">{j.sqm}</TableCell>
                  <TableCell className="text-[11px] border-r font-medium">{j.lotNo}</TableCell>
                  <TableCell className="text-[11px] border-r max-w-[150px] truncate">{j.productName || "-"}</TableCell>
                  <TableCell className="text-[11px] border-r font-mono text-slate-500">{j.code || "-"}</TableCell>
                  <TableCell className="text-center border-r">
                    <Badge variant="outline" className={cn("text-[9px] font-bold h-5 uppercase px-2 py-0 border", getStatusColor(j.status))}>
                      {j.status || "Available"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-[11px] border-r">{j.location || "-"}</TableCell>
                  <TableCell className="text-[11px] border-r">{j.supplier || "-"}</TableCell>
                  <TableCell className="text-[11px] border-r text-slate-400 italic">Admin</TableCell>
                  <TableCell className="text-right sticky right-0 bg-white z-20 group-hover:bg-slate-50 border-l px-2">
                    <div className="flex justify-end gap-1.5">
                      <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full bg-blue-50 text-blue-500 hover:bg-blue-500 hover:text-white transition-all shadow-sm" onClick={() => { setEditingRoll(j); setIntakeForm({ widthMm: j.widthMm, lengthMeters: j.lengthMeters, quantity: j.quantity || 1 }); setIsDialogOpen(true); }}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full bg-amber-50 text-amber-500 hover:bg-amber-500 hover:text-white transition-all shadow-sm">
                        <Eye className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-sm" onClick={() => handleDeleteRoll(j)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* COMPACT PAGINATION FOOTER */}
        <div className="bg-slate-50 border-t p-2 flex items-center justify-between px-6 shrink-0">
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
            Showing {rows.length} records in Technical Registry
          </p>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" className="h-7 px-2 text-[10px] font-bold"><ChevronLeft className="h-3 w-3" /> Previous</Button>
            <Button variant="outline" size="sm" className="h-7 px-2 text-[10px] font-bold">Next <ChevronRight className="h-3 w-3" /></Button>
          </div>
        </div>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[800px] rounded-2xl p-0 overflow-hidden border-none shadow-2xl">
          <form onSubmit={handleSave}>
            <DialogHeader className="p-6 bg-[#4db6ac] text-white border-b">
              <DialogTitle className="uppercase font-black text-xl tracking-tight flex items-center gap-2">
                {editingRoll ? <Pencil className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
                {editingRoll ? 'Edit Substrate Record' : 'Add New substrate'}
              </DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-6 p-8 bg-white">
              <div className="space-y-2"><Label className="text-[10px] uppercase font-black text-slate-500">RELL NO (Unique ID)</Label><Input name="rollNo" defaultValue={editingRoll?.rollNo} required readOnly={!!editingRoll} className="h-11 font-black bg-slate-50" /></div>
              <div className="space-y-2"><Label className="text-[10px] uppercase font-black text-slate-500">Paper Company</Label><Input name="paperCompany" defaultValue={editingRoll?.paperCompany} required className="h-11 font-bold" /></div>
              <div className="space-y-2"><Label className="text-[10px] uppercase font-black text-slate-500">Paper Type</Label><Input name="paperType" defaultValue={editingRoll?.paperType} required className="h-11 font-bold" /></div>
              <div className="space-y-2"><Label className="text-[10px] uppercase font-black text-slate-500">GSM</Label><Input name="gsm" type="number" defaultValue={editingRoll?.gsm} required className="h-11 font-bold" /></div>
              
              <div className="grid grid-cols-3 gap-4 col-span-2 bg-slate-50 p-6 rounded-2xl border-2 border-dashed border-teal-200">
                <div className="space-y-2"><Label className="text-[10px] uppercase font-black text-teal-600">Width (mm)</Label><Input name="widthMm" type="number" step="0.01" value={intakeForm.widthMm} onChange={e => setIntakeForm({...intakeForm, widthMm: Number(e.target.value)})} required className="h-11 bg-white font-black" /></div>
                <div className="space-y-2"><Label className="text-[10px] uppercase font-black text-teal-600">Length (m)</Label><Input name="lengthMeters" type="number" step="0.01" value={intakeForm.lengthMeters} onChange={e => setIntakeForm({...intakeForm, lengthMeters: Number(e.target.value)})} required className="h-11 bg-white font-black" /></div>
                <div className="space-y-2"><Label className="text-[10px] uppercase font-black text-teal-600">Quantity</Label><Input name="quantity" type="number" value={intakeForm.quantity} onChange={e => setIntakeForm({...intakeForm, quantity: Number(e.target.value)})} required className="h-11 bg-white font-black" /></div>
                <div className="space-y-2 col-span-3">
                  <Label className="text-[10px] uppercase font-black text-[#4db6ac]">SQM (Automatic Calculation)</Label>
                  <Input value={liveSqm} readOnly className="h-14 font-black text-3xl text-[#4db6ac] bg-teal-50 border-teal-100 text-center tracking-tighter" />
                </div>
              </div>

              <div className="space-y-2"><Label className="text-[10px] uppercase font-black text-slate-500">Lot Number</Label><Input name="lotNo" defaultValue={editingRoll?.lotNo} required className="h-11 font-black" /></div>
              <div className="space-y-2"><Label className="text-[10px] uppercase font-black text-slate-500">Purchase Rate (₹)</Label><Input name="purchaseRate" type="number" step="0.01" defaultValue={editingRoll?.purchaseRate} required className="h-11 font-black text-teal-600" /></div>
              <div className="space-y-2"><Label className="text-[10px] uppercase font-black text-slate-500">Received Date</Label><Input name="receivedDate" type="date" defaultValue={editingRoll?.receivedDate || defaultDate} required className="h-11 font-bold" /></div>
              <div className="space-y-2"><Label className="text-[10px] uppercase font-black text-slate-500">Location</Label><Input name="location" defaultValue={editingRoll?.location} className="h-11 font-bold" /></div>
            </div>
            <DialogFooter className="p-6 bg-slate-50 border-t">
              <Button type="submit" className="w-full h-14 uppercase font-black tracking-widest text-lg shadow-xl bg-[#4db6ac] hover:bg-[#3d9e94]">
                {isProcessing ? <Loader2 className="animate-spin mr-2" /> : <CheckCircle2 className="mr-2" />}
                {editingRoll ? 'Update Record' : 'Confirm Entry'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
