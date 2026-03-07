
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
  Package
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
  setDoc
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

  useEffect(() => { setIsMounted(true) }, [])

  // Auto-calculation logic for SQM
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

  // Dynamic Real-time Data Loading
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

      // Always fallback to unsorted if index missing, otherwise default to newest
      try {
        if (constraints.length === 0) {
          constraints.push(orderBy('receivedDate', 'desc'));
        }
        constraints.push(limit(100));
        return query(q, ...constraints);
      } catch (e) {
        return query(q, limit(100));
      }
    };

    const unsubscribe = onSnapshot(buildQuery(), 
      (snap) => {
        let docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        // Client-side global search for Roll ID, Lot, Job
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
        console.error("Firestore Listen Error:", err);
        if (err.message?.includes("index")) {
          const match = err.message.match(/https:\/\/console\.firebase\.google\.com[^\s]*/);
          setIndexErrorUrl(match ? match[0] : "unknown");
          // Fallback to simpler query
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
      
      await setDoc(docRef, {
        ...data,
        widthMm: width,
        lengthMeters: length,
        quantity,
        gsm: Number(data.gsm),
        purchaseRate: Number(data.purchaseRate),
        sqm,
        updatedAt: serverTimestamp(),
        ...(editingRoll ? {} : { status: 'In Stock', createdAt: serverTimestamp(), createdById: user?.uid })
      }, { merge: true });

      setIsDialogOpen(false);
      showModal('SUCCESS', editingRoll ? 'Roll Updated Successfully' : 'Roll Added Successfully', undefined, undefined, true);
    } catch (err: any) {
      showModal('ERROR', 'Save Failed', err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isMounted) return <div className="flex h-[70vh] items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>

  return (
    <div className="space-y-6 font-sans">
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

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black tracking-tight text-primary uppercase">Paper Stock Registry</h2>
          <p className="text-muted-foreground font-medium">Enterprise technical repository for narrow-web flexo substrates.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowFilters(!showFilters)} className={cn(showFilters && "border-primary text-primary")}>
            <Settings2 className="h-4 w-4 mr-2" /> Filters
          </Button>
          <Button onClick={() => { setEditingRoll(null); setIntakeForm({ widthMm: 0, lengthMeters: 0, quantity: 1 }); setIsDialogOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> New Roll
          </Button>
        </div>
      </div>

      {showFilters && (
        <Card className="border-primary/20 bg-primary/5 p-6 animate-in slide-in-from-top-2">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <Label className="text-[10px] font-black uppercase">Search</Label>
              <Input placeholder="Roll ID, Lot, Job..." value={filters.search} onChange={e => setFilters({...filters, search: e.target.value})} className="h-9 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-black uppercase">Company</Label>
              <Input placeholder="Filter by Company" value={filters.company} onChange={e => setFilters({...filters, company: e.target.value})} className="h-9 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-black uppercase">Start Date</Label>
              <Input type="date" value={filters.startDate} onChange={e => setFilters({...filters, startDate: e.target.value})} className="h-9 text-xs" />
            </div>
            <div className="space-y-1 flex items-end">
              <Button variant="ghost" size="sm" onClick={() => setFilters({company:"", paperType:"", gsm:"", status:"", startDate:"", endDate:"", search:""})} className="text-[10px] font-black uppercase">
                <FilterX className="mr-1 h-3 w-3" /> Clear
              </Button>
            </div>
          </div>
        </Card>
      )}

      {indexErrorUrl && (
        <Card className="bg-amber-50 border-amber-200 p-4 flex justify-between items-center">
          <div className="flex items-center gap-2 text-amber-800">
            <AlertTriangle className="h-5 w-5" />
            <span className="text-xs font-bold">Query requires an index. Results may be unsorted.</span>
          </div>
          <Button asChild size="sm" variant="outline" className="border-amber-300 font-bold">
            <a href={indexErrorUrl} target="_blank">Authorize Index</a>
          </Button>
        </Card>
      )}

      <Card className="shadow-2xl border-none overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="min-w-[2500px]">
              <TableHeader className="bg-muted/50 border-b">
                <TableRow>
                  <TableHead className="w-[60px] text-center font-black text-[10px] uppercase border-r sticky left-0 bg-muted/50 z-20">S/N</TableHead>
                  <TableHead className="font-black text-[10px] uppercase">RELL NO</TableHead>
                  <TableHead className="font-black text-[10px] uppercase">PAPER COMPANY</TableHead>
                  <TableHead className="font-black text-[10px] uppercase">PAPER TYPE</TableHead>
                  <TableHead className="font-black text-[10px] uppercase">WIDTH (MM)</TableHead>
                  <TableHead className="font-black text-[10px] uppercase">LENGTH (MTR)</TableHead>
                  <TableHead className="font-black text-[10px] uppercase">SQM</TableHead>
                  <TableHead className="font-black text-[10px] uppercase">GSM</TableHead>
                  <TableHead className="font-black text-[10px] uppercase">WEIGHT (KG)</TableHead>
                  <TableHead className="font-black text-[10px] uppercase">RATE</TableHead>
                  <TableHead className="font-black text-[10px] uppercase">WASTAGE</TableHead>
                  <TableHead className="font-black text-[10px] uppercase">DATE RECEIVED</TableHead>
                  <TableHead className="font-black text-[10px] uppercase">JOB NO</TableHead>
                  <TableHead className="font-black text-[10px] uppercase">SIZE</TableHead>
                  <TableHead className="font-black text-[10px] uppercase">PRODUCT</TableHead>
                  <TableHead className="font-black text-[10px] uppercase">CODE</TableHead>
                  <TableHead className="font-black text-[10px] uppercase">LOT NO</TableHead>
                  <TableHead className="font-black text-[10px] uppercase">DATE</TableHead>
                  <TableHead className="font-black text-[10px] uppercase">CO RELL NO</TableHead>
                  <TableHead className="text-right font-black text-[10px] uppercase sticky right-0 bg-muted/50 z-20">ACTIONS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={20} className="text-center py-20"><Loader2 className="animate-spin mx-auto text-primary" /></TableCell></TableRow>
                ) : rows.map((j, i) => (
                  <TableRow key={j.id} className="hover:bg-primary/5 h-12 text-xs font-medium">
                    <TableCell className="text-center font-bold text-[10px] text-muted-foreground border-r sticky left-0 bg-background z-10">{i+1}</TableCell>
                    <TableCell className="font-black text-primary font-mono">{j.rollNo}</TableCell>
                    <TableCell className="font-bold">{j.paperCompany}</TableCell>
                    <TableCell className="font-bold">{j.paperType}</TableCell>
                    <TableCell>{j.widthMm}mm</TableCell>
                    <TableCell>{j.lengthMeters}m</TableCell>
                    <TableCell className="font-black text-emerald-600">{j.sqm}</TableCell>
                    <TableCell>{j.gsm}</TableCell>
                    <TableCell>{j.weightKg}kg</TableCell>
                    <TableCell>₹{j.purchaseRate}</TableCell>
                    <TableCell>{j.wastage}%</TableCell>
                    <TableCell>{j.receivedDate}</TableCell>
                    <TableCell className="font-bold text-blue-600">{j.jobNo || "-"}</TableCell>
                    <TableCell>{j.size || "-"}</TableCell>
                    <TableCell className="truncate max-w-[150px]">{j.productName || "-"}</TableCell>
                    <TableCell>{j.code || "-"}</TableCell>
                    <TableCell className="font-black text-accent">{j.lotNo}</TableCell>
                    <TableCell>{j.date || "-"}</TableCell>
                    <TableCell className="font-mono text-muted-foreground">{j.companyRollNo || "-"}</TableCell>
                    <TableCell className="text-right sticky right-0 bg-background z-10 border-l px-2">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => { setEditingRoll(j); setIntakeForm({ widthMm: j.widthMm, lengthMeters: j.lengthMeters, quantity: j.quantity || 1 }); setIsDialogOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteRoll(j)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 && !isLoading && (
                  <TableRow><TableCell colSpan={20} className="text-center py-20 text-muted-foreground italic">No rolls found matching criteria.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[800px]">
          <form onSubmit={handleSave}>
            <DialogHeader><DialogTitle className="uppercase font-black">{editingRoll ? 'Edit Technical Record' : 'New Substrate Entry'}</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-6 py-6">
              <div className="space-y-2"><Label className="text-[10px] uppercase font-black">RELL NO (Unique ID)</Label><Input name="rollNo" defaultValue={editingRoll?.rollNo} required readOnly={!!editingRoll} /></div>
              <div className="space-y-2"><Label className="text-[10px] uppercase font-black">Paper Company</Label><Input name="paperCompany" defaultValue={editingRoll?.paperCompany} required /></div>
              <div className="space-y-2"><Label className="text-[10px] uppercase font-black">Paper Type</Label><Input name="paperType" defaultValue={editingRoll?.paperType} required /></div>
              <div className="space-y-2"><Label className="text-[10px] uppercase font-black">GSM</Label><Input name="gsm" type="number" defaultValue={editingRoll?.gsm} required /></div>
              
              <div className="grid grid-cols-3 gap-4 col-span-2 bg-muted/20 p-4 rounded-xl">
                <div className="space-y-2"><Label className="text-[10px] uppercase font-black">Width (mm)</Label><Input name="widthMm" type="number" step="0.01" value={intakeForm.widthMm} onChange={e => setIntakeForm({...intakeForm, widthMm: Number(e.target.value)})} required /></div>
                <div className="space-y-2"><Label className="text-[10px] uppercase font-black">Length (m)</Label><Input name="lengthMeters" type="number" step="0.01" value={intakeForm.lengthMeters} onChange={e => setIntakeForm({...intakeForm, lengthMeters: Number(e.target.value)})} required /></div>
                <div className="space-y-2"><Label className="text-[10px] uppercase font-black">Quantity</Label><Input name="quantity" type="number" value={intakeForm.quantity} onChange={e => setIntakeForm({...intakeForm, quantity: Number(e.target.value)})} required /></div>
                <div className="space-y-2 col-span-3"><Label className="text-[10px] uppercase font-black text-primary">SQM (Auto-Calculated)</Label><Input value={liveSqm} readOnly className="font-black text-primary bg-background" /></div>
              </div>

              <div className="space-y-2"><Label className="text-[10px] uppercase font-black">Lot Number</Label><Input name="lotNo" defaultValue={editingRoll?.lotNo} required /></div>
              <div className="space-y-2"><Label className="text-[10px] uppercase font-black">Purchase Rate</Label><Input name="purchaseRate" type="number" step="0.01" defaultValue={editingRoll?.purchaseRate} required /></div>
              <div className="space-y-2"><Label className="text-[10px] uppercase font-black">Received Date</Label><Input name="receivedDate" type="date" defaultValue={editingRoll?.receivedDate || new Date().toISOString().split('T')[0]} required /></div>
              <div className="space-y-2"><Label className="text-[10px] uppercase font-black">Company Roll Ref</Label><Input name="companyRollNo" defaultValue={editingRoll?.companyRollNo} /></div>
            </div>
            <DialogFooter><Button type="submit" className="w-full h-12 uppercase font-black tracking-widest">{isProcessing ? <Loader2 className="animate-spin mr-2" /> : 'Confirm Record'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
