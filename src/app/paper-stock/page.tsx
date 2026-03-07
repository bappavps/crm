
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
  Copy
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

  useEffect(() => { setIsMounted(true) }, [])

  // Auto-calculation logic for SQM: (Width/1000) * Length * Quantity
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

  // Dynamic Real-time Data Loading with Robust Fallback
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

      // Optimization: Only use orderBy if we have a basic query to avoid index requirements for simple 'All' views
      if (constraints.length > 0) {
        return query(q, ...constraints, limit(200));
      }
      
      // Default view: No filters, no ordering (fastest, no index required)
      return query(q, limit(200));
    };

    const unsubscribe = onSnapshot(buildQuery(), 
      (snap) => {
        let docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        // Client-side search for better performance and no index errors
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
        console.error("Registry Sync Error:", err);
        if (err.message?.includes("index")) {
          const match = err.message.match(/https:\/\/console\.firebase\.google\.com[^\s]*/);
          setIndexErrorUrl(match ? match[0] : "unknown");
          // Fallback to absolute simplest query if index missing
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
        ...(editingRoll ? {} : { status: 'In Stock', createdAt: serverTimestamp(), createdById: user?.uid })
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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Link Copied", description: "Firebase Index URL copied to clipboard." });
  }

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
          <h2 className="text-3xl font-black tracking-tight text-primary uppercase">Paper Stock Hub</h2>
          <p className="text-muted-foreground font-medium text-xs">Unified technical repository for all narrow-web flexo substrates.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowFilters(!showFilters)} className={cn("h-10 px-4 font-bold text-xs uppercase", showFilters && "border-primary text-primary")}>
            <Settings2 className="h-4 w-4 mr-2" /> {showFilters ? 'Hide Filters' : 'Filter Data'}
          </Button>
          <Button onClick={() => { setEditingRoll(null); setIntakeForm({ widthMm: 0, lengthMeters: 0, quantity: 1 }); setIsDialogOpen(true); }} className="h-10 px-6 font-black uppercase text-xs tracking-widest shadow-lg">
            <Plus className="mr-2 h-4 w-4" /> New Roll Entry
          </Button>
        </div>
      </div>

      {showFilters && (
        <Card className="border-primary/20 bg-primary/5 p-6 animate-in slide-in-from-top-2 rounded-xl">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <Label className="text-[10px] font-black uppercase text-muted-foreground">Search Registry</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3 w-3 text-muted-foreground" />
                <Input placeholder="Roll ID, Lot, Job..." value={filters.search} onChange={e => setFilters({...filters, search: e.target.value})} className="pl-8 h-9 text-xs font-bold" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-black uppercase text-muted-foreground">Paper Company</Label>
              <Input placeholder="Filter by Company" value={filters.company} onChange={e => setFilters({...filters, company: e.target.value})} className="h-9 text-xs font-bold" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-black uppercase text-muted-foreground">Received Date</Label>
              <Input type="date" value={filters.startDate} onChange={e => setFilters({...filters, startDate: e.target.value})} className="h-9 text-xs font-bold" />
            </div>
            <div className="space-y-1 flex items-end">
              <Button variant="ghost" size="sm" onClick={() => setFilters({company:"", paperType:"", gsm:"", status:"", startDate:"", endDate:"", search:""})} className="text-[10px] font-black uppercase text-primary">
                <FilterX className="mr-1 h-3 w-3" /> Reset All Filters
              </Button>
            </div>
          </div>
        </Card>
      )}

      {indexErrorUrl && (
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3 text-amber-800">
            <div className="p-2 bg-amber-100 rounded-full"><AlertTriangle className="h-5 w-5" /></div>
            <div className="space-y-0.5">
              <p className="text-xs font-black uppercase tracking-tight">Index Required for Sorting</p>
              <p className="text-[10px] font-medium opacity-80">Composite indexes are needed for combined filters. Results shown may be unsorted.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => copyToClipboard(indexErrorUrl)} className="h-8 text-[10px] font-black border-amber-300">
              <Copy className="h-3 w-3 mr-1" /> Copy URL
            </Button>
            <Button asChild size="sm" className="h-8 text-[10px] font-black bg-amber-600 hover:bg-amber-700">
              <a href={indexErrorUrl} target="_blank">Authorize Now</a>
            </Button>
          </div>
        </div>
      )}

      <Card className="shadow-2xl border-none overflow-hidden rounded-2xl">
        <CardContent className="p-0">
          <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-muted-foreground/20">
            <Table className="min-w-[2500px]">
              <TableHeader className="bg-muted/50 border-b sticky top-0 z-20">
                <TableRow>
                  <TableHead className="w-[60px] text-center font-black text-[10px] uppercase border-r sticky left-0 bg-muted/50 z-30">S/N</TableHead>
                  <TableHead className="font-black text-[10px] uppercase">RELL NO</TableHead>
                  <TableHead className="font-black text-[10px] uppercase">PAPER COMPANY</TableHead>
                  <TableHead className="font-black text-[10px] uppercase">PAPER TYPE</TableHead>
                  <TableHead className="font-black text-[10px] uppercase">WIDTH (MM)</TableHead>
                  <TableHead className="font-black text-[10px] uppercase">LENGTH (MTR)</TableHead>
                  <TableHead className="font-black text-[10px] uppercase text-primary">SQM</TableHead>
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
                  <TableHead className="text-right font-black text-[10px] uppercase sticky right-0 bg-muted/50 z-30 border-l">ACTIONS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={20} className="text-center py-20"><Loader2 className="animate-spin mx-auto text-primary" /></TableCell></TableRow>
                ) : rows.map((j, i) => (
                  <TableRow key={j.id} className="hover:bg-primary/5 h-12 text-[11px] transition-colors border-b last:border-0">
                    <TableCell className="text-center font-black text-[10px] text-muted-foreground border-r sticky left-0 bg-background z-10">{i+1}</TableCell>
                    <TableCell className="font-black text-primary font-mono tracking-tighter">{j.rollNo}</TableCell>
                    <TableCell className="font-bold whitespace-nowrap">{j.paperCompany}</TableCell>
                    <TableCell className="font-bold">{j.paperType}</TableCell>
                    <TableCell className="font-mono">{j.widthMm}mm</TableCell>
                    <TableCell className="font-mono">{j.lengthMeters}m</TableCell>
                    <TableCell className="font-black text-emerald-600 font-mono text-xs">{j.sqm}</TableCell>
                    <TableCell className="font-bold">{j.gsm}</TableCell>
                    <TableCell className="font-mono">{j.weightKg}kg</TableCell>
                    <TableCell className="font-mono">₹{j.purchaseRate}</TableCell>
                    <TableCell className="font-mono">{j.wastage}%</TableCell>
                    <TableCell className="font-bold">{j.receivedDate}</TableCell>
                    <TableCell className="font-black text-blue-600 font-mono">{j.jobNo || "-"}</TableCell>
                    <TableCell>{j.size || "-"}</TableCell>
                    <TableCell className="truncate max-w-[150px] italic">{j.productName || "-"}</TableCell>
                    <TableCell className="font-mono text-muted-foreground">{j.code || "-"}</TableCell>
                    <TableCell className="font-black text-accent tracking-tighter">{j.lotNo}</TableCell>
                    <TableCell className="text-muted-foreground">{j.date || "-"}</TableCell>
                    <TableCell className="font-mono text-muted-foreground opacity-60">{j.companyRollNo || "-"}</TableCell>
                    <TableCell className="text-right sticky right-0 bg-background z-10 border-l px-2">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:bg-primary/10" onClick={() => { setEditingRoll(j); setIntakeForm({ widthMm: j.widthMm, lengthMeters: j.lengthMeters, quantity: j.quantity || 1 }); setIsDialogOpen(true); }}><Pencil className="h-3 w-3" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => handleDeleteRoll(j)}><Trash2 className="h-3 w-3" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 && !isLoading && (
                  <TableRow>
                    <TableCell colSpan={20} className="text-center py-20 text-muted-foreground italic">
                      <div className="flex flex-col items-center gap-3">
                        <Package className="h-10 w-10 opacity-10" />
                        <p className="text-xs font-bold uppercase tracking-widest">No technical records matched your query.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[800px] rounded-2xl p-0 overflow-hidden border-none shadow-2xl">
          <form onSubmit={handleSave}>
            <DialogHeader className="p-6 bg-primary/5 border-b">
              <DialogTitle className="uppercase font-black text-xl tracking-tight flex items-center gap-2">
                {editingRoll ? <Pencil className="h-5 w-5 text-primary" /> : <Plus className="h-5 w-5 text-primary" />}
                {editingRoll ? 'Edit Technical Record' : 'New Substrate Entry'}
              </DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-6 p-8">
              <div className="space-y-2"><Label className="text-[10px] uppercase font-black text-muted-foreground">RELL NO (Unique ID)</Label><Input name="rollNo" defaultValue={editingRoll?.rollNo} required readOnly={!!editingRoll} className="h-11 font-black bg-muted/20" /></div>
              <div className="space-y-2"><Label className="text-[10px] uppercase font-black text-muted-foreground">Paper Company</Label><Input name="paperCompany" defaultValue={editingRoll?.paperCompany} required className="h-11 font-bold" /></div>
              <div className="space-y-2"><Label className="text-[10px] uppercase font-black text-muted-foreground">Paper Type</Label><Input name="paperType" defaultValue={editingRoll?.paperType} required className="h-11 font-bold" /></div>
              <div className="space-y-2"><Label className="text-[10px] uppercase font-black text-muted-foreground">GSM</Label><Input name="gsm" type="number" defaultValue={editingRoll?.gsm} required className="h-11 font-bold" /></div>
              
              <div className="grid grid-cols-3 gap-4 col-span-2 bg-muted/20 p-6 rounded-2xl border-2 border-dashed">
                <div className="space-y-2"><Label className="text-[10px] uppercase font-black text-muted-foreground">Width (mm)</Label><Input name="widthMm" type="number" step="0.01" value={intakeForm.widthMm} onChange={e => setIntakeForm({...intakeForm, widthMm: Number(e.target.value)})} required className="h-11 bg-background font-black" /></div>
                <div className="space-y-2"><Label className="text-[10px] uppercase font-black text-muted-foreground">Length (m)</Label><Input name="lengthMeters" type="number" step="0.01" value={intakeForm.lengthMeters} onChange={e => setIntakeForm({...intakeForm, lengthMeters: Number(e.target.value)})} required className="h-11 bg-background font-black" /></div>
                <div className="space-y-2"><Label className="text-[10px] uppercase font-black text-muted-foreground">Quantity</Label><Input name="quantity" type="number" value={intakeForm.quantity} onChange={e => setIntakeForm({...intakeForm, quantity: Number(e.target.value)})} required className="h-11 bg-background font-black" /></div>
                <div className="space-y-2 col-span-3">
                  <Label className="text-[10px] uppercase font-black text-primary">SQM (System Calculated)</Label>
                  <Input value={liveSqm} readOnly className="h-12 font-black text-2xl text-primary bg-primary/5 border-primary/20 text-center tracking-tighter" />
                </div>
              </div>

              <div className="space-y-2"><Label className="text-[10px] uppercase font-black text-muted-foreground">Lot Number</Label><Input name="lotNo" defaultValue={editingRoll?.lotNo} required className="h-11 font-black text-accent" /></div>
              <div className="space-y-2"><Label className="text-[10px] uppercase font-black text-muted-foreground">Purchase Rate (₹)</Label><Input name="purchaseRate" type="number" step="0.01" defaultValue={editingRoll?.purchaseRate} required className="h-11 font-black text-emerald-600" /></div>
              <div className="space-y-2"><Label className="text-[10px] uppercase font-black text-muted-foreground">Received Date</Label><Input name="receivedDate" type="date" defaultValue={editingRoll?.receivedDate || new Date().toISOString().split('T')[0]} required className="h-11 font-bold" /></div>
              <div className="space-y-2"><Label className="text-[10px] uppercase font-black text-muted-foreground">Co. Roll Reference</Label><Input name="companyRollNo" defaultValue={editingRoll?.companyRollNo} className="h-11 font-mono" /></div>
            </div>
            <DialogFooter className="p-6 bg-muted/10 border-t">
              <Button type="submit" className="w-full h-14 uppercase font-black tracking-widest text-lg shadow-xl">
                {isProcessing ? <Loader2 className="animate-spin mr-2" /> : <CheckCircle2 className="mr-2" />}
                {editingRoll ? 'Update technical Record' : 'Confirm Master Entry'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
