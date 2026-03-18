"use client"

import { useState, useMemo, useEffect, use } from "react"
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
  Trash2, 
  Settings2,
  NotebookPen,
  History,
  CheckCircle2,
  AlertTriangle,
  MoveHorizontal,
  GripHorizontal,
  Pencil
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useFirestore, useUser, useCollection, useMemoFirebase, useDoc } from "@/firebase"
import { collection, doc, serverTimestamp, setDoc, updateDoc, deleteDoc, query, orderBy, getDocs, writeBatch, limit } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

/**
 * PRODUCTION PLANNING BOARD (V5.1)
 * Redesigned for Industrial Dominance, Compact Data, and Fixed Inline Editing.
 */

const STATUS_COLORS: Record<string, string> = {
  Running: "bg-blue-500",
  Completed: "bg-emerald-500",
  Hold: "bg-rose-500",
  Pending: "bg-slate-400"
};

const SECTIONS = {
  MAIN: "main",
  HOLD_MATERIAL: "hold_material",
  HOLD_PAYMENT: "hold_payment"
};

const DEFAULT_LABEL_COLUMNS = [
  { id: "sn", name: "S.N", type: "Number" },
  { id: "order_date", name: "Order Date", type: "Date" },
  { id: "dispatch_date", name: "Dispatch Date", type: "Date" },
  { id: "printing_planning", name: "Status", type: "Status" },
  { id: "plate_no", name: "Plate No", type: "Text" },
  { id: "name", name: "Job Name", type: "Text" },
  { id: "size", name: "Size", type: "Text" },
  { id: "repeat", name: "Repeat", type: "Text" },
  { id: "material", name: "Material", type: "Text" },
  { id: "paper_size", name: "Paper Size", type: "Text" },
  { id: "die", name: "Die", type: "Text" },
  { id: "allocate_mtrs", name: "MTRS", type: "Number" },
  { id: "qty_pcs", name: "QTY", type: "Number" },
  { id: "core_size", name: "Core", type: "Text" },
  { id: "qty_per_roll", name: "Qty/Roll", type: "Text" },
  { id: "roll_direction", name: "Direction", type: "Text" },
  { id: "remarks", name: "Remarks", type: "Text" }
];

export default function DynamicPlanningPage({ params }: { params: Promise<{ department: string }> }) {
  const { department } = use(params);
  const { toast } = useToast()
  const { user } = useUser()
  const firestore = useFirestore()
  const [isMounted, setIsMounted] = useState(false)
  
  const [isSetupOpen, setIsSetupOpen] = useState(false)
  const [isRowCreateOpen, setIsRowCreateOpen] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editFormData, setEditFormData] = useState<any>({})
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  
  // Column Reordering State
  const [columnOrder, setColumnOrder] = useState<string[]>([])

  useEffect(() => { setIsMounted(true) }, [])

  // 1. Fetch Table Definition
  const tableRef = useMemoFirebase(() => {
    if (!firestore || !department) return null;
    return doc(firestore, 'planning_tables', department);
  }, [firestore, department]);
  
  const { data: tableDef, isLoading: tableLoading } = useDoc(tableRef);

  // 2. Fetch Rows
  const rowsQuery = useMemoFirebase(() => {
    if (!firestore || !department) return null;
    return query(collection(firestore, `planning_tables/${department}/rows`), orderBy('values.sn', 'asc'));
  }, [firestore, department]);

  const { data: rows, isLoading: rowsLoading } = useCollection(rowsQuery);

  // Initialize Column Order
  useEffect(() => {
    if (tableDef?.columns && columnOrder.length === 0) {
      setColumnOrder(tableDef.columns.map((c: any) => c.id));
    }
  }, [tableDef, columnOrder]);

  // Seeding Logic
  useEffect(() => {
    if (isMounted && firestore && !tableLoading && department === 'label-printing') {
      const initTable = async () => {
        if (!tableDef) {
          await setDoc(doc(firestore, 'planning_tables', 'label-printing'), {
            id: 'label-printing',
            department: 'Label Printing',
            columns: DEFAULT_LABEL_COLUMNS,
            created_at: serverTimestamp()
          });
        }

        const rowsSnap = await getDocs(query(collection(firestore, `planning_tables/label-printing/rows`), limit(1)));
        if (rowsSnap.empty) {
          const batch = writeBatch(firestore);
          const mainRows = [
            { sn: 1, order_date: "11.03.26", dispatch_date: "21.03.26", printing_planning: "Running", plate_no: "1052", name: "YaisnaCookies", size: "75mm X 90mm", repeat: "3.133 mm", material: "Chromo", paper_size: "165 mm", die: "Rotary", allocate_mtrs: 4000, qty_pcs: 82000, core_size: "1 inch", qty_per_roll: "500", roll_direction: "Anticlock", remarks: "" },
            { sn: 2, order_date: "10.03.26", dispatch_date: "20.03.26", printing_planning: "Pending", plate_no: "938", name: "Blue 1ltr", size: "158mm X 34mm", repeat: "3.306 mm", material: "PP White", paper_size: "172mm", die: "Rotary", allocate_mtrs: 2500, qty_pcs: 60000, core_size: "3 inc", qty_per_roll: "9 INC OD", roll_direction: "Head First", remarks: "" },
            { sn: 3, order_date: "10.03.26", dispatch_date: "20.03.26", printing_planning: "Pending", plate_no: "939", name: "Blue 500ml", size: "117.5mm X 27mm", repeat: "2.63mm", material: "PP White", paper_size: "130mm", die: "Rotary", allocate_mtrs: 11000, qty_pcs: 360000, core_size: "3 inc", qty_per_roll: "9 INC OD", roll_direction: "Head First", remarks: "" }
          ];
          mainRows.forEach(sr => {
            const rowId = crypto.randomUUID();
            batch.set(doc(firestore, `planning_tables/label-printing/rows`, rowId), {
              id: rowId, section: SECTIONS.MAIN, values: sr, created_at: serverTimestamp()
            });
          });
          await batch.commit();
        }
      };
      initTable();
    }
  }, [isMounted, firestore, tableLoading, tableDef, department]);

  const sections = useMemo(() => {
    if (!rows) return { main: [], holdMaterial: [], holdPayment: [] };
    return {
      main: rows.filter(r => r.section === SECTIONS.MAIN || !r.section),
      holdMaterial: rows.filter(r => r.section === SECTIONS.HOLD_MATERIAL),
      holdPayment: rows.filter(r => r.section === SECTIONS.HOLD_PAYMENT)
    };
  }, [rows]);

  const handleSaveRow = async () => {
    if (!firestore || !editingId || isProcessing) return;
    setIsProcessing(true);
    try {
      console.log("Saving Row Data:", editFormData);
      await updateDoc(doc(firestore, `planning_tables/${department}/rows`, editingId), {
        values: editFormData,
        updated_at: serverTimestamp()
      });
      setEditingId(null);
      toast({ title: "Plan Saved" });
    } catch (e) {
      toast({ variant: "destructive", title: "Error Saving Row" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreateRow = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firestore || isProcessing) return;
    setIsProcessing(true);
    const fd = new FormData(e.currentTarget);
    const values: any = {};
    tableDef?.columns.forEach((col: any) => {
      let val: any = fd.get(col.id);
      if (col.type === 'Number') val = Number(val);
      values[col.id] = val;
    });

    const rowId = crypto.randomUUID();
    try {
      await setDoc(doc(firestore, `planning_tables/${department}/rows`, rowId), {
        id: rowId, section: SECTIONS.MAIN, values, created_at: serverTimestamp()
      });
      setIsRowCreateOpen(false);
      toast({ title: "New Job Added" });
    } catch (e) {
      toast({ variant: "destructive", title: "Error Creating Entry" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteRow = async () => {
    if (!firestore || !deleteConfirmId) return;
    setIsProcessing(true);
    try {
      await deleteDoc(doc(firestore, `planning_tables/${department}/rows`, deleteConfirmId));
      setDeleteConfirmId(null);
      toast({ title: "Row Deleted" });
    } catch (e) {
      toast({ variant: "destructive", title: "Error" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReorder = (draggedId: string, overId: string) => {
    const next = [...columnOrder];
    const draggedIdx = next.indexOf(draggedId);
    const overIdx = next.indexOf(overId);
    next.splice(draggedIdx, 1);
    next.splice(overIdx, 0, draggedId);
    setColumnOrder(next);
  };

  if (!isMounted || tableLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>

  const orderedColumns = columnOrder.map(id => tableDef?.columns.find((c: any) => c.id === id)).filter(Boolean);

  return (
    <div className="space-y-4 font-sans animate-in fade-in duration-500">
      {/* HEADER SECTION */}
      <div className="flex items-end justify-between border-b pb-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 uppercase leading-none">
            {tableDef?.department || department.replace('-', ' ')} Planning
          </h1>
          <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mt-1">Industrial Production Management</p>
        </div>
        <div className="text-right">
          <Badge variant="secondary" className="h-7 border px-3 font-bold uppercase text-[10px] tracking-widest bg-white">
            Floor Date: {new Date().toLocaleDateString()}
          </Badge>
        </div>
      </div>

      {/* ACTION BAR */}
      <div className="flex justify-between items-center bg-white p-3 rounded-xl border shadow-sm">
        <div className="flex gap-2">
          <Button onClick={() => setIsRowCreateOpen(true)} className="h-10 px-6 font-bold uppercase text-[11px] tracking-widest rounded-lg bg-slate-900 text-white hover:bg-black transition-all shadow-md">
            <Plus className="mr-2 h-4 w-4 text-primary" /> Add Job Entry
          </Button>
          <Button variant="outline" className="h-10 px-4 font-bold uppercase text-[11px] tracking-widest border-2 rounded-lg" onClick={() => setIsSetupOpen(true)}>
            <Settings2 className="h-4 w-4 mr-2 text-primary" /> Board Layout
          </Button>
        </div>
        <div className="flex items-center gap-2 text-[9px] font-black uppercase opacity-40">
          <History className="h-3.5 w-3.5" /> Registry Live Sync
        </div>
      </div>

      {/* MAIN PRODUCTION TABLE */}
      <div className="space-y-3">
        <BoardTable 
          title="Active Production Board" 
          columns={orderedColumns} 
          rows={sections.main} 
          editingId={editingId}
          editFormData={editFormData}
          onEdit={(r: any) => { 
            console.log("Entering Edit Mode for Row:", r.id);
            setEditingId(r.id); 
            setEditFormData(r.values); 
          }}
          onSave={handleSaveRow}
          onCancel={() => setEditingId(null)}
          onFormChange={setEditFormData}
          onDelete={setDeleteConfirmId}
          onReorder={handleReorder}
          height="h-[65vh] min-height-[500px]"
          isProcessing={isProcessing}
        />
      </div>

      {/* SECONDARY TABLES */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BoardTable 
          title="Hold for Technical Reasons" 
          columns={orderedColumns} 
          rows={sections.holdMaterial} 
          editingId={editingId}
          editFormData={editFormData}
          onEdit={(r: any) => { setEditingId(r.id); setEditFormData(r.values); }}
          onSave={handleSaveRow}
          onCancel={() => setEditingId(null)}
          onFormChange={setEditFormData}
          onDelete={setDeleteConfirmId}
          onReorder={handleReorder}
          height="h-[25vh] min-h-[200px]"
          isProcessing={isProcessing}
          emptyMessage="No technical holds logged."
        />
        <BoardTable 
          title="Hold for Payment Pending" 
          columns={orderedColumns} 
          rows={sections.holdPayment} 
          editingId={editingId}
          editFormData={editFormData}
          onEdit={(r: any) => { setEditingId(r.id); setEditFormData(r.values); }}
          onSave={handleSaveRow}
          onCancel={() => setEditingId(null)}
          onFormChange={setEditFormData}
          onDelete={setDeleteConfirmId}
          onReorder={handleReorder}
          height="h-[25vh] min-h-[200px]"
          isProcessing={isProcessing}
          emptyMessage="No payment holds in queue."
        />
      </div>

      {/* CREATE DIALOG */}
      <Dialog open={isRowCreateOpen} onOpenChange={setIsRowCreateOpen}>
        <DialogContent className="sm:max-w-[800px] p-0 overflow-hidden rounded-3xl border-none shadow-3xl">
          <form onSubmit={handleCreateRow}>
            <div className="bg-slate-900 text-white p-6"><DialogTitle className="text-xl font-black uppercase tracking-tight flex items-center gap-3"><NotebookPen className="h-5 w-5 text-primary" /> Technical Data Entry</DialogTitle></div>
            <div className="p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 bg-slate-50 max-h-[60vh] overflow-y-auto industrial-scroll">
              {tableDef?.columns.map((col: any) => (
                <div key={col.id} className="space-y-1.5 text-left">
                  <Label className="text-[10px] font-black uppercase opacity-50 block">{col.name}</Label>
                  {col.id === 'material' ? (
                    <Select name={col.id} defaultValue="Chromo">
                      <SelectTrigger className="h-10 border-2 rounded-lg bg-white"><SelectValue /></SelectTrigger>
                      <SelectContent className="z-[110]">
                        <SelectItem value="Chromo">Chromo</SelectItem>
                        <SelectItem value="PP White">PP White</SelectItem>
                        <SelectItem value="Silver Metalic">Silver Metalic</SelectItem>
                        <SelectItem value="PE White">PE White</SelectItem>
                        <SelectItem value="Transparent">Transparent</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : col.type === 'Status' ? (
                    <Select name={col.id} defaultValue="Pending">
                      <SelectTrigger className="h-10 border-2 rounded-lg bg-white"><SelectValue /></SelectTrigger>
                      <SelectContent className="z-[110]">
                        {Object.keys(STATUS_COLORS).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input name={col.id} type={col.type === 'Number' ? 'number' : col.type === 'Date' ? 'date' : 'text'} className="h-10 border-2 rounded-lg bg-white font-bold" />
                  )}
                </div>
              ))}
            </div>
            <DialogFooter className="p-6 bg-white border-t">
              <Button type="submit" disabled={isProcessing} className="w-full h-12 font-black uppercase tracking-widest bg-primary">Confirm Addition</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DELETE ALERT */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent className="rounded-2xl border-none shadow-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-black uppercase">Permanently Delete Row?</AlertDialogTitle>
            <AlertDialogDescription className="font-medium text-slate-600">This action will remove the technical entry from the planning board. It cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg font-bold">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteRow} className="bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold">Confirm Deletion</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* SETUP DIALOG */}
      <Dialog open={isSetupOpen} onOpenChange={setIsSetupOpen}>
        <DialogContent className="sm:max-w-[600px] rounded-3xl">
          <DialogHeader>
            <DialogTitle className="font-black uppercase text-xl flex items-center gap-2"><Settings2 className="h-6 w-6 text-primary" /> Board Header Configuration</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-4 max-h-[400px] overflow-y-auto industrial-scroll pr-2">
              {tableDef?.columns.map((col: any, idx: number) => (
                <div key={idx} className="flex gap-2 items-end bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <div className="flex-1 space-y-1">
                    <Label className="text-[10px] font-black uppercase opacity-50">Header Label</Label>
                    <Input value={col.name} onChange={(e) => {
                      const next = [...tableDef.columns];
                      next[idx].name = e.target.value;
                      updateDoc(tableRef!, { columns: next });
                    }} className="h-9 border-2 font-bold" />
                  </div>
                  <div className="w-32 space-y-1">
                    <Label className="text-[10px] font-black uppercase opacity-50">Type</Label>
                    <Select value={col.type} onValueChange={(val) => {
                      const next = [...tableDef.columns];
                      next[idx].type = val;
                      updateDoc(tableRef!, { columns: next });
                    }}>
                      <SelectTrigger className="h-9 border-2"><SelectValue /></SelectTrigger>
                      <SelectContent className="z-[110]">
                        {['Text', 'Number', 'Date', 'Status'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter><Button onClick={() => setIsSetupOpen(false)} className="w-full h-12 font-black uppercase tracking-widest shadow-lg">Commit Header Changes</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <style jsx global>{`
        .sheet-header { background-color: #f5f1e6 !important; height: 48px; position: sticky; top: 0; z-index: 20; border-bottom: 1px solid #ddd !important; }
        .action-col { position: sticky; left: 0; z-index: 30; border-right: 1px solid #ddd !important; }
        .industrial-scroll::-webkit-scrollbar { width: 8px; height: 8px; }
        .industrial-scroll::-webkit-scrollbar-track { background: #f8fafc; }
        .industrial-scroll::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
        .industrial-scroll::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}</style>
    </div>
  )
}

function BoardTable({ 
  title, columns, rows, editingId, editFormData, onEdit, onSave, onCancel, onFormChange, onDelete, onReorder, height, isProcessing, emptyMessage 
}: any) {
  const [draggedHeader, setDraggedHeader] = useState<string | null>(null);

  return (
    <Card className="border-none shadow-sm rounded-xl overflow-hidden bg-white border">
      <div className="bg-slate-50 border-b h-12 flex items-center px-6">
        <h2 className="text-xs font-black uppercase tracking-widest text-slate-600 flex items-center gap-2">
          {title} <Badge variant="outline" className="h-5 text-[9px] font-black border-slate-300">{rows.length}</Badge>
        </h2>
      </div>
      <CardContent className="p-0">
        <div className={cn("overflow-auto industrial-scroll", height)}>
          <Table className="min-w-[2500px] border-separate border-spacing-0">
            <TableHeader>
              <TableRow className="h-12 bg-[#f5f1e6]">
                <TableHead className="w-20 text-center sheet-header action-col bg-[#f5f1e6] border-r">
                  <span className="text-[10px] font-black uppercase opacity-40">Actions</span>
                </TableHead>
                {columns.map((col: any) => (
                  <TableHead 
                    key={col.id} 
                    draggable
                    onDragStart={() => setDraggedHeader(col.id)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => draggedHeader && draggedHeader !== col.id && onReorder(draggedHeader, col.id)}
                    className="sheet-header text-slate-900 font-bold text-[13px] uppercase text-center border-r border-slate-200 px-4 whitespace-nowrap cursor-move hover:bg-slate-200/50 transition-colors"
                  >
                    <div className="flex items-center justify-center gap-2">
                      <GripHorizontal className="h-3 w-3 opacity-20" />
                      {col.name}
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row: any) => (
                <TableRow 
                  key={row.id} 
                  className={cn(
                    "group transition-all hover:bg-slate-50/80 h-9 select-none",
                    editingId === row.id ? "bg-primary/5 ring-2 ring-primary/20 ring-inset" : "even:bg-slate-50/30"
                  )}
                  onClick={() => editingId !== row.id && onEdit(row)}
                >
                  <TableCell className={cn("text-center action-col p-0 bg-white group-hover:bg-slate-50 transition-colors border-r")}>
                    {editingId === row.id ? (
                      <div className="flex items-center justify-center gap-1 px-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-emerald-600 hover:bg-emerald-50 rounded-lg" onClick={(e) => { e.stopPropagation(); onSave(); }}><CheckCircle2 className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-rose-600 hover:bg-rose-50 rounded-lg" onClick={(e) => { e.stopPropagation(); onCancel(); }}><X className="h-4 w-4" /></Button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-1 px-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-slate-400 hover:text-primary"><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-slate-400 hover:text-rose-600" onClick={(e) => { e.stopPropagation(); onDelete(row.id); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    )}
                  </TableCell>

                  {columns.map((col: any) => (
                    <TableCell key={col.id} className="text-center text-[13px] border-r px-2 py-0 border-b">
                      {editingId === row.id ? (
                        col.id === 'material' ? (
                          <Select 
                            value={editFormData[col.id] || ''} 
                            onValueChange={v => {
                              const next = { ...editFormData, [col.id]: v };
                              console.log("Editing Row (Material):", next);
                              onFormChange(next);
                            }}
                          >
                            <SelectTrigger className="h-7 text-[11px] font-bold uppercase border-none focus-visible:ring-0 p-0 bg-transparent text-center flex justify-center">
                              <SelectValue placeholder="Select Material" />
                            </SelectTrigger>
                            <SelectContent className="z-[110]">
                              <SelectItem value="Chromo">Chromo</SelectItem>
                              <SelectItem value="PP White">PP White</SelectItem>
                              <SelectItem value="Silver Metalic">Silver Metalic</SelectItem>
                              <SelectItem value="PE White">PE White</SelectItem>
                              <SelectItem value="Transparent">Transparent</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : col.type === 'Status' ? (
                          <Select 
                            value={editFormData[col.id] || ''} 
                            onValueChange={v => {
                              const next = { ...editFormData, [col.id]: v };
                              console.log("Editing Row (Status):", next);
                              onFormChange(next);
                            }}
                          >
                            <SelectTrigger className="h-7 text-[11px] font-bold uppercase border-none focus-visible:ring-0 p-0 bg-transparent text-center flex justify-center">
                              <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent className="z-[110]">
                              {Object.keys(STATUS_COLORS).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input 
                            type={col.type === 'Number' ? 'number' : col.type === 'Date' ? 'date' : 'text'} 
                            value={editFormData[col.id] || ''} 
                            onChange={e => {
                              const next = { ...editFormData, [col.id]: col.type === 'Number' ? Number(e.target.value) : e.target.value };
                              console.log("Editing Row:", next);
                              onFormChange(next);
                            }} 
                            className="h-7 text-[13px] text-center border-none focus-visible:ring-0 p-0 bg-transparent font-bold"
                            autoFocus={col.id === 'sn'}
                          />
                        )
                      ) : (
                        col.type === 'Status' ? (
                          <div className="flex justify-center">
                            <Badge className={cn("text-[10px] font-bold h-5 px-2 py-0 rounded-[6px] uppercase border-none text-white", STATUS_COLORS[row.values[col.id]])}>
                              {row.values[col.id] || 'Pending'}
                            </Badge>
                          </div>
                        ) : (
                          <span className={cn(
                            "font-medium tabular-nums tracking-tight text-slate-700",
                            col.id === 'plate_no' && "font-mono font-bold text-primary",
                            col.id === 'sn' && "text-slate-400 font-bold"
                          )}>
                            {row.values[col.id] || '—'}
                          </span>
                        )
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
              {rows?.length === 0 && !isProcessing && (
                <TableRow>
                  <TableCell colSpan={columns.length + 1} className="text-center py-20 text-muted-foreground italic font-bold uppercase text-[10px] tracking-widest opacity-30 bg-slate-50/50">
                    {emptyMessage || "Departmental queue is clear"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
