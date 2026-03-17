
"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { 
  Plus, 
  Loader2, 
  Save, 
  X, 
  ArrowRightLeft, 
  MoreVertical, 
  PauseCircle, 
  PlayCircle, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  ArrowRight,
  ArrowDownCircle,
  Wallet
} from "lucide-react"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription,
  DialogTrigger
} from "@/components/ui/dialog"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu"
import { useFirestore, useUser, useCollection, useMemoFirebase } from "@/firebase"
import { collection, doc, serverTimestamp, setDoc, updateDoc, deleteDoc, query, orderBy } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

/**
 * PRINTED LABEL JOB PLANNING (Industrial Board V1)
 * Replicates the Excel planning sheet with three categorized sections.
 */

const STATUS_COLORS: Record<string, string> = {
  Running: "bg-blue-500",
  Completed: "bg-green-500",
  Hold: "bg-red-500",
  Pending: "bg-slate-400"
};

const SECTIONS = {
  MAIN: "main",
  HOLD_MATERIAL: "hold_material",
  HOLD_PAYMENT: "hold_payment"
};

export default function JobPlanningBoard() {
  const { toast } = useToast()
  const { user } = useUser()
  const firestore = useFirestore()
  const [isMounted, setIsMounted] = useState(false)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editFormData, setEditFormData] = useState<any>({})

  useEffect(() => { setIsMounted(true) }, [])

  // 1. Data Fetching (Real-time)
  const planningQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'label_job_planning'), orderBy('sn', 'asc'));
  }, [firestore]);

  const { data: allRows, isLoading } = useCollection(planningQuery);

  const sections = useMemo(() => {
    if (!allRows) return { main: [], holdMaterial: [], holdPayment: [] };
    return {
      main: allRows.filter(r => r.section === SECTIONS.MAIN),
      holdMaterial: allRows.filter(r => r.section === SECTIONS.HOLD_MATERIAL),
      holdPayment: allRows.filter(r => r.section === SECTIONS.HOLD_PAYMENT)
    };
  }, [allRows]);

  // 2. Handlers
  const handleStartEdit = (row: any) => {
    setEditingId(row.id);
    setEditFormData(row);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditFormData({});
  };

  const handleSaveInline = async () => {
    if (!firestore || !editingId || isProcessing) return;
    setIsProcessing(true);
    try {
      await updateDoc(doc(firestore, 'label_job_planning', editingId), {
        ...editFormData,
        updated_at: serverTimestamp()
      });
      setEditingId(null);
      toast({ title: "Plan Updated" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Update Failed" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMoveSection = async (id: string, newSection: string) => {
    if (!firestore) return;
    try {
      await updateDoc(doc(firestore, 'label_job_planning', id), {
        section: newSection,
        updated_at: serverTimestamp()
      });
      toast({ title: `Moved to ${newSection.replace('_', ' ')}` });
    } catch (e) {
      toast({ variant: "destructive", title: "Move Failed" });
    }
  };

  const handleCreateRow = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firestore || !user || isProcessing) return;
    
    setIsProcessing(true);
    const formData = new FormData(e.currentTarget);
    const id = crypto.randomUUID();
    
    const newRow = {
      id,
      section: SECTIONS.MAIN,
      data_source: "manual",
      sn: Number(formData.get("sn")) || (allRows?.length || 0) + 1,
      order_date: formData.get("order_date"),
      dispatch_date: formData.get("dispatch_date"),
      printing_planning: formData.get("printing_planning") || "Pending",
      plate_no: formData.get("plate_no"),
      name: formData.get("name"),
      size: formData.get("size"),
      repeat: formData.get("repeat"),
      material: formData.get("material"),
      paper_size: formData.get("paper_size"),
      die: formData.get("die"),
      allocate_mtrs: formData.get("allocate_mtrs"),
      qty_pcs: formData.get("qty_pcs"),
      core_size: formData.get("core_size"),
      qty_per_roll: formData.get("qty_per_roll"),
      roll_direction: formData.get("roll_direction"),
      remarks: formData.get("remarks"),
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
      created_by: user.uid
    };

    try {
      await setDoc(doc(firestore, 'label_job_planning', id), newRow);
      setIsCreateOpen(false);
      toast({ title: "Job Added to Board" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Creation Failed" });
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isMounted) return null;

  return (
    <div className="space-y-10 font-sans pb-20 animate-in fade-in duration-500">
      {/* 1. Header Section */}
      <div className="flex items-center justify-between">
        <div className="flex-1 text-center">
          <h1 className="text-3xl font-black tracking-[0.2em] text-slate-900 uppercase">
            PRINTED LABEL <br />
            <span className="text-primary">JOB PLANNING</span>
          </h1>
        </div>
        <div className="w-48 text-right space-y-1">
          <Badge variant="outline" className="h-8 border-2 font-black uppercase text-[10px] tracking-widest bg-white">
            Date : {new Date().toLocaleDateString()}
          </Badge>
          <p className="text-[9px] font-bold text-muted-foreground uppercase opacity-50">Industrial Planning V1.0</p>
        </div>
      </div>

      {/* 2. Control Toolbar */}
      <div className="flex justify-start">
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="h-12 px-8 font-black uppercase text-[11px] tracking-widest rounded-xl shadow-xl bg-slate-900 text-white hover:bg-black">
              <Plus className="mr-2 h-5 w-5 text-primary" /> Add Job Planning Row
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[800px] p-0 overflow-hidden rounded-3xl border-none shadow-3xl">
            <form onSubmit={handleCreateRow}>
              <div className="bg-slate-900 text-white p-6">
                <DialogTitle className="text-xl font-black uppercase tracking-tight flex items-center gap-3">
                  <PlayCircle className="h-5 w-5 text-primary" /> New Planning Entry
                </DialogTitle>
                <DialogDescription className="text-slate-400 font-bold uppercase text-[9px] tracking-widest mt-1">Manual Production Schedule Input</DialogDescription>
              </div>
              <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-50 max-h-[70vh] overflow-y-auto industrial-scroll">
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black uppercase text-primary border-b border-primary/10 pb-1">Basic Flow</h4>
                  <div className="space-y-2"><Label className="text-[10px] uppercase font-bold opacity-50">S.N</Label><Input name="sn" type="number" defaultValue={(allRows?.length || 0) + 1} className="h-10 rounded-lg border-2" /></div>
                  <div className="space-y-2"><Label className="text-[10px] uppercase font-bold opacity-50">Order Date</Label><Input name="order_date" type="date" className="h-10 rounded-lg border-2" /></div>
                  <div className="space-y-2"><Label className="text-[10px] uppercase font-bold opacity-50">Dispatch Date</Label><Input name="dispatch_date" type="date" className="h-10 rounded-lg border-2" /></div>
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold opacity-50">Status</Label>
                    <Select name="printing_planning" defaultValue="Pending">
                      <SelectTrigger className="h-10 rounded-lg border-2"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Pending">Pending</SelectItem>
                        <SelectItem value="Running">Running</SelectItem>
                        <SelectItem value="Completed">Completed</SelectItem>
                        <SelectItem value="Hold">Hold</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black uppercase text-primary border-b border-primary/10 pb-1">Technical Specs</h4>
                  <div className="space-y-2"><Label className="text-[10px] uppercase font-bold opacity-50">Plate No</Label><Input name="plate_no" className="h-10 rounded-lg border-2" /></div>
                  <div className="space-y-2"><Label className="text-[10px] uppercase font-bold opacity-50">Job Name</Label><Input name="name" required className="h-10 rounded-lg border-2" /></div>
                  <div className="space-y-2"><Label className="text-[10px] uppercase font-bold opacity-50">Size</Label><Input name="size" className="h-10 rounded-lg border-2" /></div>
                  <div className="space-y-2"><Label className="text-[10px] uppercase font-bold opacity-50">Repeat</Label><Input name="repeat" className="h-10 rounded-lg border-2" /></div>
                  <div className="space-y-2"><Label className="text-[10px] uppercase font-bold opacity-50">Material</Label><Input name="material" className="h-10 rounded-lg border-2" /></div>
                </div>
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black uppercase text-primary border-b border-primary/10 pb-1">Factory Floor</h4>
                  <div className="space-y-2"><Label className="text-[10px] uppercase font-bold opacity-50">Die Ref</Label><Input name="die" className="h-10 rounded-lg border-2" /></div>
                  <div className="space-y-2"><Label className="text-[10px] uppercase font-bold opacity-50">Qty (PCS)</Label><Input name="qty_pcs" className="h-10 rounded-lg border-2" /></div>
                  <div className="space-y-2"><Label className="text-[10px] uppercase font-bold opacity-50">Allocated MTRS</Label><Input name="allocate_mtrs" className="h-10 rounded-lg border-2" /></div>
                  <div className="space-y-2"><Label className="text-[10px] uppercase font-bold opacity-50">Remarks</Label><Input name="remarks" className="h-10 rounded-lg border-2" /></div>
                </div>
              </div>
              <DialogFooter className="p-6 bg-white border-t">
                <Button type="button" variant="outline" className="h-12 px-8 rounded-xl font-black uppercase text-[10px] tracking-widest border-2" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={isProcessing} className="h-12 px-12 rounded-xl bg-primary hover:bg-primary/90 text-white font-black uppercase text-[10px] tracking-widest shadow-xl">
                  {isProcessing ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  Commit to Board
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* 3. Main Planning Table */}
      <SectionTable 
        title="Live Production Board" 
        rows={sections.main} 
        editingId={editingId}
        editFormData={editFormData}
        onEdit={handleStartEdit}
        onCancel={handleCancelEdit}
        onSave={handleSaveInline}
        onFormChange={(val: any) => setEditFormData(val)}
        onMove={handleMoveSection}
        isLoading={isLoading}
      />

      {/* 4. Hold Section 1: Material/Die/Plate */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-1 bg-red-500 rounded-full" />
          <h2 className="text-xl font-black uppercase tracking-tight text-slate-800">Hold for Plate / Die / Paper OR others Reason</h2>
        </div>
        <SectionTable 
          rows={sections.holdMaterial} 
          editingId={editingId}
          editFormData={editFormData}
          onEdit={handleStartEdit}
          onCancel={handleCancelEdit}
          onSave={handleSaveInline}
          onFormChange={(val: any) => setEditFormData(val)}
          onMove={handleMoveSection}
          hideTitle
        />
      </div>

      {/* 5. Hold Section 2: Payment */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-1 bg-rose-600 rounded-full" />
          <h2 className="text-xl font-black uppercase tracking-tight text-slate-800">Hold For Payment Due</h2>
        </div>
        <SectionTable 
          rows={sections.holdPayment} 
          editingId={editingId}
          editFormData={editFormData}
          onEdit={handleStartEdit}
          onCancel={handleCancelEdit}
          onSave={handleSaveInline}
          onFormChange={(val: any) => setEditFormData(val)}
          onMove={handleMoveSection}
          hideTitle
        />
      </div>

      <style jsx global>{`
        .sheet-header {
          background-color: #F5F5DC !important; /* Light Beige / Planning Style */
        }
        .industrial-scroll::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        .industrial-scroll::-webkit-scrollbar-track {
          background: #f1f1f1;
        }
        .industrial-scroll::-webkit-scrollbar-thumb {
          background: #ccc;
          border-radius: 4px;
        }
        .industrial-scroll::-webkit-scrollbar-thumb:hover {
          background: #aaa;
        }
      `}</style>
    </div>
  )
}

function SectionTable({ 
  title, 
  rows, 
  editingId, 
  editFormData, 
  onEdit, 
  onCancel, 
  onSave, 
  onFormChange, 
  onMove,
  isLoading,
  hideTitle = false 
}: any) {
  
  const headers = [
    "S.N", "Order Date", "Dispatch Date", "Printing Planing", "Plate No", "NAME", "SIZE", "Repeat", 
    "MATERIAL", "PAPER SIZE", "Die", "Allocate MTRS", "QTY (PCS)", "CORE SIZE", "QTY PER ROLL", "Roll Direction", "Remarks"
  ];

  return (
    <Card className="border-none shadow-xl rounded-2xl overflow-hidden bg-white">
      {!hideTitle && (
        <CardHeader className="bg-slate-900 text-white p-6">
          <CardTitle className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-3">
            <LayoutDashboard className="h-5 w-5 text-primary" /> {title}
          </CardTitle>
        </CardHeader>
      )}
      <CardContent className="p-0">
        <div className="overflow-x-auto industrial-scroll">
          <Table className="min-w-[2200px] border-separate border-spacing-0">
            <TableHeader className="sticky top-0 z-20">
              <TableRow className="h-12 border-b-2 border-slate-200">
                <TableHead className="w-16 bg-slate-100 border-r" />
                {headers.map((h, i) => (
                  <TableHead key={i} className="sheet-header text-slate-900 font-black text-[10px] uppercase text-center border-r border-slate-200 px-4">
                    {h}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={20} className="text-center py-20"><Loader2 className="animate-spin h-10 w-10 mx-auto text-primary" /></TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={20} className="text-center py-20 text-muted-foreground italic font-medium">No records in this planning section.</TableCell></TableRow>
              ) : rows.map((row: any) => (
                <TableRow 
                  key={row.id} 
                  className={cn(
                    "group transition-all hover:bg-slate-50 h-10 select-none",
                    editingId === row.id ? "bg-primary/5 ring-2 ring-primary ring-inset" : "even:bg-slate-50/30"
                  )}
                  onClick={() => editingId !== row.id && onEdit(row)}
                >
                  <TableCell className="text-center border-r p-0 sticky left-0 bg-white z-10">
                    {editingId === row.id ? (
                      <div className="flex items-center justify-center gap-1 px-2">
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-emerald-600 hover:bg-emerald-50" onClick={(e) => { e.stopPropagation(); onSave(); }}><Save className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-rose-600 hover:bg-rose-50" onClick={(e) => { e.stopPropagation(); onCancel(); }}><X className="h-4 w-4" /></Button>
                      </div>
                    ) : (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100"><MoreVertical className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-56 z-[100]">
                          <DropdownMenuLabel className="text-[9px] font-black uppercase text-muted-foreground">Logistics & Hold</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => onMove(row.id, SECTIONS.MAIN)} className="gap-2 font-bold"><PlayCircle className="h-4 w-4 text-emerald-500" /> Move to Production</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onMove(row.id, SECTIONS.HOLD_MATERIAL)} className="gap-2 font-bold"><ArrowDownCircle className="h-4 w-4 text-orange-500" /> Move to Tech Hold</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onMove(row.id, SECTIONS.HOLD_PAYMENT)} className="gap-2 font-bold"><Wallet className="h-4 w-4 text-rose-500" /> Move to Payment Hold</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>

                  {/* S.N */}
                  <TableCell className="text-center font-bold text-xs border-r">
                    {editingId === row.id ? (
                      <Input value={editFormData.sn} onChange={e => onFormChange({...editFormData, sn: e.target.value})} className="h-7 text-xs text-center border-none focus-visible:ring-0 p-0" />
                    ) : row.sn}
                  </TableCell>

                  {/* Order Date */}
                  <TableCell className="text-center text-[11px] font-medium border-r px-2">
                    {editingId === row.id ? (
                      <Input type="date" value={editFormData.order_date} onChange={e => onFormChange({...editFormData, order_date: e.target.value})} className="h-7 text-[10px] border-none focus-visible:ring-0 p-0" />
                    ) : row.order_date || "-"}
                  </TableCell>

                  {/* Dispatch Date */}
                  <TableCell className="text-center text-[11px] font-medium border-r px-2">
                    {editingId === row.id ? (
                      <Input type="date" value={editFormData.dispatch_date} onChange={e => onFormChange({...editFormData, dispatch_date: e.target.value})} className="h-7 text-[10px] border-none focus-visible:ring-0 p-0" />
                    ) : row.dispatch_date || "-"}
                  </TableCell>

                  {/* Printing Planing (Status) */}
                  <TableCell className="text-center border-r px-2">
                    {editingId === row.id ? (
                      <Select value={editFormData.printing_planning} onValueChange={v => onFormChange({...editFormData, printing_planning: v})}>
                        <SelectTrigger className="h-7 text-[10px] border-none focus-visible:ring-0 p-0 bg-transparent"><SelectValue /></SelectTrigger>
                        <SelectContent className="z-[110]">
                          <SelectItem value="Pending">Pending</SelectItem>
                          <SelectItem value="Running">Running</SelectItem>
                          <SelectItem value="Completed">Completed</SelectItem>
                          <SelectItem value="Hold">Hold</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge className={cn("text-[9px] font-black h-5 px-3 uppercase border-none", STATUS_COLORS[row.printing_planning])}>
                        {row.printing_planning}
                      </Badge>
                    )}
                  </TableCell>

                  {/* Plate No */}
                  <TableCell className="text-center font-mono font-bold text-xs text-primary border-r">
                    {editingId === row.id ? (
                      <Input value={editFormData.plate_no} onChange={e => onFormChange({...editFormData, plate_no: e.target.value})} className="h-7 text-xs text-center border-none focus-visible:ring-0 p-0 font-mono" />
                    ) : row.plate_no || "-"}
                  </TableCell>

                  {/* NAME */}
                  <TableCell className="font-bold text-xs border-r px-4 truncate max-w-[250px]">
                    {editingId === row.id ? (
                      <Input value={editFormData.name} onChange={e => onFormChange({...editFormData, name: e.target.value})} className="h-7 text-xs border-none focus-visible:ring-0 p-0 font-bold" />
                    ) : row.name}
                  </TableCell>

                  {/* SIZE */}
                  <TableCell className="text-center text-xs border-r">
                    {editingId === row.id ? (
                      <Input value={editFormData.size} onChange={e => onFormChange({...editFormData, size: e.target.value})} className="h-7 text-xs text-center border-none focus-visible:ring-0 p-0" />
                    ) : row.size || "-"}
                  </TableCell>

                  {/* Repeat */}
                  <TableCell className="text-center text-xs border-r font-mono">
                    {editingId === row.id ? (
                      <Input value={editFormData.repeat} onChange={e => onFormChange({...editFormData, repeat: e.target.value})} className="h-7 text-xs text-center border-none focus-visible:ring-0 p-0" />
                    ) : row.repeat || "-"}
                  </TableCell>

                  {/* MATERIAL */}
                  <TableCell className="text-center text-[11px] font-medium border-r px-2">
                    {editingId === row.id ? (
                      <Input value={editFormData.material} onChange={e => onFormChange({...editFormData, material: e.target.value})} className="h-7 text-[10px] border-none focus-visible:ring-0 p-0" />
                    ) : row.material || "-"}
                  </TableCell>

                  {/* PAPER SIZE */}
                  <TableCell className="text-center text-xs border-r font-bold">
                    {editingId === row.id ? (
                      <Input value={editFormData.paper_size} onChange={e => onFormChange({...editFormData, paper_size: e.target.value})} className="h-7 text-xs text-center border-none focus-visible:ring-0 p-0" />
                    ) : row.paper_size || "-"}
                  </TableCell>

                  {/* Die */}
                  <TableCell className="text-center text-xs border-r">
                    {editingId === row.id ? (
                      <Input value={editFormData.die} onChange={e => onFormChange({...editFormData, die: e.target.value})} className="h-7 text-xs text-center border-none focus-visible:ring-0 p-0" />
                    ) : row.die || "-"}
                  </TableCell>

                  {/* Allocate MTRS */}
                  <TableCell className="text-center text-xs font-black text-accent border-r">
                    {editingId === row.id ? (
                      <Input value={editFormData.allocate_mtrs} onChange={e => onFormChange({...editFormData, allocate_mtrs: e.target.value})} className="h-7 text-xs text-center border-none focus-visible:ring-0 p-0 font-black" />
                    ) : row.allocate_mtrs || "-"}
                  </TableCell>

                  {/* QTY (PCS) */}
                  <TableCell className="text-center text-xs font-black border-r">
                    {editingId === row.id ? (
                      <Input value={editFormData.qty_pcs} onChange={e => onFormChange({...editFormData, qty_pcs: e.target.value})} className="h-7 text-xs text-center border-none focus-visible:ring-0 p-0 font-black" />
                    ) : row.qty_pcs?.toLocaleString() || "-"}
                  </TableCell>

                  {/* CORE SIZE */}
                  <TableCell className="text-center text-xs border-r">
                    {editingId === row.id ? (
                      <Input value={editFormData.core_size} onChange={e => onFormChange({...editFormData, core_size: e.target.value})} className="h-7 text-xs text-center border-none focus-visible:ring-0 p-0" />
                    ) : row.core_size || "-"}
                  </TableCell>

                  {/* QTY PER ROLL */}
                  <TableCell className="text-center text-xs border-r">
                    {editingId === row.id ? (
                      <Input value={editFormData.qty_per_roll} onChange={e => onFormChange({...editFormData, qty_per_roll: e.target.value})} className="h-7 text-xs text-center border-none focus-visible:ring-0 p-0" />
                    ) : row.qty_per_roll || "-"}
                  </TableCell>

                  {/* Roll Direction */}
                  <TableCell className="text-center text-[10px] font-bold uppercase border-r">
                    {editingId === row.id ? (
                      <Input value={editFormData.roll_direction} onChange={e => onFormChange({...editFormData, roll_direction: e.target.value})} className="h-7 text-[10px] text-center border-none focus-visible:ring-0 p-0 font-bold" />
                    ) : row.roll_direction || "-"}
                  </TableCell>

                  {/* Remarks */}
                  <TableCell className="text-xs italic text-muted-foreground border-r px-4 max-w-[200px] truncate">
                    {editingId === row.id ? (
                      <Input value={editFormData.remarks} onChange={e => onFormChange({...editFormData, remarks: e.target.value})} className="h-7 text-xs border-none focus-visible:ring-0 p-0 italic" />
                    ) : row.remarks || "-"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
