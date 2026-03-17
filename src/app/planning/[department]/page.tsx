
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
  MoreVertical, 
  PauseCircle, 
  PlayCircle, 
  CheckCircle2, 
  LayoutDashboard,
  Settings2,
  Trash2,
  NotebookPen,
  History,
  ArrowDownCircle,
  Wallet,
  ArrowRightLeft,
  RefreshCw
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
} from "@/components/ui/dropdown-menu"
import { useFirestore, useUser, useCollection, useMemoFirebase, useDoc } from "@/firebase"
import { collection, doc, serverTimestamp, setDoc, updateDoc, deleteDoc, query, orderBy, getDoc, getDocs, writeBatch, limit } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

/**
 * DYNAMIC PRODUCTION PLANNING BOARD (V4)
 * Optimized for 15+ job visibility and precision technical data seeding.
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

const DEFAULT_LABEL_COLUMNS = [
  { id: "sn", name: "S.N", type: "Number" },
  { id: "order_date", name: "Order Date", type: "Date" },
  { id: "dispatch_date", name: "Dispatch Date", type: "Date" },
  { id: "printing_planning", name: "Printing Planing", type: "Status" },
  { id: "plate_no", name: "Plate No", type: "Text" },
  { id: "name", name: "NAME", type: "Text" },
  { id: "size", name: "SIZE", type: "Text" },
  { id: "repeat", name: "Repeat", type: "Text" },
  { id: "material", name: "MATERIAL", type: "Text" },
  { id: "paper_size", name: "PAPER SIZE", type: "Text" },
  { id: "die", name: "Die", type: "Text" },
  { id: "allocate_mtrs", name: "Allocate MTRS", type: "Number" },
  { id: "qty_pcs", name: "QTY (PCS)", type: "Number" },
  { id: "core_size", name: "CORE SIZE", type: "Text" },
  { id: "qty_per_roll", name: "QTY PER ROLL", type: "Text" },
  { id: "roll_direction", name: "Roll Direction", type: "Text" },
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

  // 3. Robust Seeding Logic
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
            { sn: 3, order_date: "10.03.26", dispatch_date: "20.03.26", printing_planning: "Pending", plate_no: "939", name: "Blue 500ml", size: "117.5mm X 27mm", repeat: "2.63mm", material: "PP White", paper_size: "130mm", die: "Rotary", allocate_mtrs: 11000, qty_pcs: 360000, core_size: "3 inc", qty_per_roll: "9 INC OD", roll_direction: "Head First", remarks: "" },
            { sn: 4, order_date: "10.03.26", dispatch_date: "20.03.26", printing_planning: "Pending", plate_no: "940", name: "Blue 200ml", size: "80mm X 20mm", repeat: "2.578mm", material: "PP White", paper_size: "175mm", die: "Rotary", allocate_mtrs: 3000, qty_pcs: 240000, core_size: "3 inc", qty_per_roll: "9 INC OD", roll_direction: "Head First", remarks: "" },
            { sn: 5, order_date: "11.03.26", dispatch_date: "21.03.26", printing_planning: "Pending", plate_no: "516", name: "Dabur", size: "20mm X 50mm", repeat: "3.34 mm", material: "Transparent Paper Release", paper_size: "145mm", die: "Rotary", allocate_mtrs: 20000, qty_pcs: 2000000, core_size: "", qty_per_roll: "", roll_direction: "Sheet Form", remarks: "" },
            { sn: 6, order_date: "11.03.26", dispatch_date: "21.03.26", printing_planning: "Pending", plate_no: "871", name: "Amrit 750ml", size: "100mm X 35mm", repeat: "3.1mm", material: "Silver Metalic", paper_size: "220mm", die: "Rotary", allocate_mtrs: 20000, qty_pcs: 1000000, core_size: "3 inc", qty_per_roll: "7000", roll_direction: "Left First", remarks: "" }
          ];

          mainRows.forEach(sr => {
            const rowId = crypto.randomUUID();
            batch.set(doc(firestore, `planning_tables/label-printing/rows`, rowId), {
              id: rowId,
              section: SECTIONS.MAIN,
              data_source: "manual",
              values: sr,
              created_at: serverTimestamp()
            });
          });

          const holdRows = [
            { sn: 7, order_date: "23/2/2026", dispatch_date: "03.03.26", printing_planning: "Hold", plate_no: "1046", name: "AMD Clot Activator", size: "45mm x 17mm", repeat: "3.32mm", material: "Chromo (70gsm)", paper_size: "155mm", die: "Flat Bed", allocate_mtrs: 0, qty_pcs: "sampling", core_size: "3 inch", qty_per_roll: "3000", roll_direction: "Bottom First", remarks: "Rotary die not recv." }
          ];

          holdRows.forEach(sr => {
            const rowId = crypto.randomUUID();
            batch.set(doc(firestore, `planning_tables/label-printing/rows`, rowId), {
              id: rowId,
              section: SECTIONS.HOLD_MATERIAL,
              data_source: "manual",
              values: sr,
              created_at: serverTimestamp()
            });
          });

          await batch.commit();
          toast({ title: "Industrial Plan Seeded" });
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
        id: rowId,
        section: SECTIONS.MAIN,
        data_source: "manual",
        values,
        created_at: serverTimestamp()
      });
      setIsRowCreateOpen(false);
      toast({ title: "New Job Added" });
    } catch (e) {
      toast({ variant: "destructive", title: "Error Creating Entry" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMove = async (rowId: string, newSection: string) => {
    if (!firestore) return;
    await updateDoc(doc(firestore, `planning_tables/${department}/rows`, rowId), {
      section: newSection,
      updated_at: serverTimestamp()
    });
    toast({ title: "Workflow Updated" });
  };

  if (!isMounted || tableLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-500">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div className="flex-1 text-center">
          <h1 className="text-3xl font-black tracking-[0.2em] text-slate-900 uppercase">
            {tableDef?.department || department.replace('-', ' ')} <br />
            <span className="text-primary">PRODUCTION PLANNING</span>
          </h1>
        </div>
        <div className="w-48 text-right space-y-1">
          <Badge variant="outline" className="h-8 border-2 font-black uppercase text-[10px] tracking-widest bg-white shadow-sm">
            Date : {new Date().toLocaleDateString()}
          </Badge>
        </div>
      </div>

      {/* TOOLBAR */}
      <div className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl border-2 border-dashed border-slate-200">
        <div className="flex gap-3">
          <Dialog open={isRowCreateOpen} onOpenChange={setIsRowCreateOpen}>
            <DialogTrigger asChild>
              <Button className="h-12 px-8 font-black uppercase text-[11px] tracking-widest rounded-xl shadow-xl bg-slate-900 text-white hover:bg-black">
                <Plus className="mr-2 h-5 w-5 text-primary" /> Add Job Entry
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[800px] p-0 overflow-hidden rounded-3xl border-none shadow-3xl">
              <form onSubmit={handleCreateRow}>
                <div className="bg-slate-900 text-white p-6">
                  <DialogTitle className="text-xl font-black uppercase tracking-tight flex items-center gap-3">
                    <NotebookPen className="h-5 w-5 text-primary" /> Technical Data Entry
                  </DialogTitle>
                </div>
                <div className="p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 bg-slate-50 max-h-[60vh] overflow-y-auto industrial-scroll">
                  {tableDef?.columns.map((col: any) => (
                    <div key={col.id} className="space-y-2 text-left">
                      <Label className="text-[10px] font-black uppercase opacity-50 block">{col.name}</Label>
                      {col.type === 'Status' ? (
                        <Select name={col.id} defaultValue="Pending">
                          <SelectTrigger className="h-10 border-2 rounded-lg bg-white"><SelectValue /></SelectTrigger>
                          <SelectContent className="z-[110]">
                            <SelectItem value="Pending">Pending</SelectItem>
                            <SelectItem value="Running">Running</SelectItem>
                            <SelectItem value="Completed">Completed</SelectItem>
                            <SelectItem value="Hold">Hold</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input name={col.id} type={col.type === 'Number' ? 'number' : col.type === 'Date' ? 'date' : 'text'} className="h-10 border-2 rounded-lg bg-white" />
                      )}
                    </div>
                  ))}
                </div>
                <DialogFooter className="p-6 bg-white border-t">
                  <Button type="submit" disabled={isProcessing} className="w-full h-12 font-black uppercase tracking-widest bg-primary">
                    {isProcessing ? <Loader2 className="animate-spin h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
                    Confirm Job Addition
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <Button variant="outline" className="h-12 px-6 font-black uppercase text-[11px] tracking-widest border-2 rounded-xl" onClick={() => setIsSetupOpen(true)}>
            <Settings2 className="h-5 w-5 mr-2 text-primary" /> Setup Board Layout
          </Button>
        </div>
        
        <div className="flex items-center gap-2 text-[10px] font-black uppercase opacity-40">
          <History className="h-4 w-4" /> Real-time Sync Active
        </div>
      </div>

      {/* TABLES */}
      <div className="space-y-12">
        <BoardTable 
          title="Active Production Board" 
          columns={tableDef?.columns || []} 
          rows={sections.main} 
          editingId={editingId}
          onEdit={(r: any) => { setEditingId(r.id); setEditFormData(r.values); }}
          onSave={handleSaveRow}
          onCancel={() => setEditingId(null)}
          onFormChange={setEditFormData}
          onMove={handleMove}
          isProcessing={isProcessing}
        />

        {department === 'label-printing' && (
          <div className="space-y-8 pt-10 border-t-4 border-dashed border-slate-200">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-8 w-1 bg-red-500 rounded-full" />
                <h2 className="text-xl font-black uppercase tracking-tight text-slate-800">Hold for Technical Reasons (Plate / Die / Paper)</h2>
              </div>
              <BoardTable 
                columns={tableDef?.columns || []} 
                rows={sections.holdMaterial} 
                editingId={editingId}
                onEdit={(r: any) => { setEditingId(r.id); setEditFormData(r.values); }}
                onSave={handleSaveRow}
                onCancel={() => setEditingId(null)}
                onFormChange={setEditFormData}
                onMove={handleMove}
                isProcessing={isProcessing}
                hideTitle
              />
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-8 w-1 bg-rose-600 rounded-full" />
                <h2 className="text-xl font-black uppercase tracking-tight text-slate-800">Hold For Payment Pending</h2>
              </div>
              <BoardTable 
                columns={tableDef?.columns || []} 
                rows={sections.holdPayment} 
                editingId={editingId}
                onEdit={(r: any) => { setEditingId(r.id); setEditFormData(r.values); }}
                onSave={handleSaveRow}
                onCancel={() => setEditingId(null)}
                onFormChange={setEditFormData}
                onMove={handleMove}
                isProcessing={isProcessing}
                hideTitle
              />
            </div>
          </div>
        )}
      </div>

      {/* SETUP MODAL */}
      <Dialog open={isSetupOpen} onOpenChange={setIsSetupOpen}>
        <DialogContent className="sm:max-w-[600px] rounded-3xl">
          <DialogHeader>
            <DialogTitle className="font-black uppercase text-xl flex items-center gap-2"><Settings2 className="h-6 w-6 text-primary" /> Planning Board Configuration</DialogTitle>
            <DialogDescription className="font-bold text-[10px] uppercase opacity-60">Define the technical headers for this department</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-4 max-h-[400px] overflow-y-auto industrial-scroll pr-2">
              {tableDef?.columns.map((col: any, idx: number) => (
                <div key={idx} className="flex gap-2 items-end bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <div className="flex-1 space-y-1">
                    <Label className="text-[10px] font-black uppercase opacity-50">Column Label</Label>
                    <Input value={col.name} onChange={(e) => {
                      const next = [...tableDef.columns];
                      next[idx].name = e.target.value;
                      updateDoc(tableRef!, { columns: next });
                    }} className="h-9 border-2 font-bold" />
                  </div>
                  <div className="w-32 space-y-1">
                    <Label className="text-[10px] font-black uppercase opacity-50">Data Type</Label>
                    <Select value={col.type} onValueChange={(val) => {
                      const next = [...tableDef.columns];
                      next[idx].type = val;
                      updateDoc(tableRef!, { columns: next });
                    }}>
                      <SelectTrigger className="h-9 border-2"><SelectValue /></SelectTrigger>
                      <SelectContent className="z-[110]">
                        {['Text', 'Number', 'Date', 'Dropdown', 'Status'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button variant="ghost" size="icon" className="h-9 w-9 text-rose-500 hover:bg-rose-50 rounded-lg" onClick={() => {
                    const next = tableDef.columns.filter((_: any, i: number) => i !== idx);
                    updateDoc(tableRef!, { columns: next });
                  }}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
            </div>
            <Button variant="outline" className="w-full h-12 border-2 border-dashed font-black uppercase text-[10px] tracking-widest rounded-xl hover:bg-primary/5" onClick={() => {
              const next = [...(tableDef?.columns || []), { id: `col_${Date.now()}`, name: "New Header", type: "Text" }];
              updateDoc(tableRef!, { columns: next });
            }}><Plus className="h-4 w-4 mr-2" /> Insert New Column</Button>
          </div>
          <DialogFooter>
            <Button onClick={() => setIsSetupOpen(false)} className="w-full h-12 font-black uppercase tracking-widest">Commit Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <style jsx global>{`
        .sheet-header { background-color: #F5F5DC !important; border-bottom: 2px solid #ddd !important; }
        .industrial-scroll::-webkit-scrollbar { width: 8px; height: 8px; }
        .industrial-scroll::-webkit-scrollbar-track { background: #f1f1f1; }
        .industrial-scroll::-webkit-scrollbar-thumb { background: #ccc; border-radius: 4px; }
      `}</style>
    </div>
  )
}

function BoardTable({ title, columns, rows, editingId, onEdit, onSave, onCancel, onFormChange, onMove, isProcessing, hideTitle }: any) {
  return (
    <Card className="border-none shadow-2xl rounded-[2rem] overflow-hidden bg-white">
      {!hideTitle && (
        <CardHeader className="bg-slate-900 text-white p-6 px-10">
          <CardTitle className="text-xs font-black uppercase tracking-[0.25em] flex items-center gap-3">
            <LayoutDashboard className="h-5 w-5 text-primary" /> {title}
          </CardTitle>
        </CardHeader>
      )}
      <CardContent className="p-0">
        <div className="overflow-x-auto industrial-scroll min-h-[850px]">
          <Table className="min-w-[2800px] border-separate border-spacing-0">
            <TableHeader className="sticky top-0 z-20">
              <TableRow className="h-12">
                <TableHead className="w-16 bg-slate-100 border-r border-b sticky left-0 z-30" />
                {columns.map((col: any) => (
                  <TableHead key={col.id} className="sheet-header text-slate-900 font-black text-[10px] uppercase text-center border-r border-slate-200 px-4 whitespace-nowrap">
                    {col.name}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row: any) => (
                <TableRow 
                  key={row.id} 
                  className={cn(
                    "group transition-all hover:bg-slate-50 h-11 select-none",
                    editingId === row.id ? "bg-primary/5 ring-4 ring-primary ring-inset z-10" : "even:bg-slate-50/30"
                  )}
                  onClick={() => editingId !== row.id && onEdit(row)}
                >
                  <TableCell className={cn("text-center border-r p-0 sticky left-0 z-10 shadow-lg group-hover:bg-slate-100 transition-colors", editingId === row.id ? "bg-white" : "bg-slate-50")}>
                    {editingId === row.id ? (
                      <div className="flex items-center justify-center gap-1 px-2">
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-emerald-600 hover:bg-emerald-50 rounded-full" onClick={(e) => { e.stopPropagation(); onSave(); }}><CheckCircle2 className="h-5 w-5" /></Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-rose-600 hover:bg-rose-50 rounded-full" onClick={(e) => { e.stopPropagation(); onCancel(); }}><X className="h-5 w-5" /></Button>
                      </div>
                    ) : (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100"><MoreVertical className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="z-[100] w-64 rounded-xl border-none shadow-2xl">
                          <DropdownMenuLabel className="text-[10px] font-black uppercase text-muted-foreground tracking-widest p-3">Production Logistics</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => onMove(row.id, SECTIONS.MAIN)} className="gap-3 py-3 font-bold"><PlayCircle className="h-5 w-5 text-emerald-500" /> Release to Production</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onMove(row.id, SECTIONS.HOLD_MATERIAL)} className="gap-3 py-3 font-bold"><ArrowDownCircle className="h-5 w-5 text-orange-500" /> Technical Hold (Plate/Die)</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onMove(row.id, SECTIONS.HOLD_PAYMENT)} className="gap-3 py-3 font-bold"><Wallet className="h-5 w-5 text-rose-500" /> Account Hold (Payment)</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>

                  {columns.map((col: any) => (
                    <TableCell key={col.id} className="text-center text-[13px] border-r px-4 py-0">
                      {editingId === row.id ? (
                        col.type === 'Status' ? (
                          <Select value={row.values[col.id]} onValueChange={v => onFormChange(prev => ({...prev, [col.id]: v}))}>
                            <SelectTrigger className="h-8 text-[11px] font-black uppercase border-none focus-visible:ring-0 p-0 bg-transparent text-center flex justify-center"><SelectValue /></SelectTrigger>
                            <SelectContent className="z-[110]">
                              <SelectItem value="Pending">Pending</SelectItem>
                              <SelectItem value="Running">Running</SelectItem>
                              <SelectItem value="Completed">Completed</SelectItem>
                              <SelectItem value="Hold">Hold</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input 
                            type={col.type === 'Number' ? 'number' : col.type === 'Date' ? 'date' : 'text'} 
                            value={row.values[col.id] || ''} 
                            onChange={e => onFormChange(prev => ({...prev, [col.id]: col.type === 'Number' ? Number(e.target.value) : e.target.value}))} 
                            className="h-8 text-xs text-center border-none focus-visible:ring-0 p-0 bg-transparent font-bold"
                            autoFocus={col.id === 'sn'}
                          />
                        )
                      ) : (
                        col.type === 'Status' ? (
                          <Badge className={cn("text-[9px] font-black h-5 px-3 uppercase border-none shadow-sm", STATUS_COLORS[row.values[col.id]])}>
                            {row.values[col.id] || 'Pending'}
                          </Badge>
                        ) : (
                          <span className={cn(
                            "font-semibold tabular-nums tracking-tight",
                            col.id === 'plate_no' && "font-mono font-black text-primary text-sm",
                            col.id === 'sn' && "text-slate-400 font-black"
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
                  <TableCell colSpan={columns.length + 1} className="text-center py-24 text-muted-foreground italic font-black uppercase text-[10px] tracking-[0.2em] opacity-30 bg-slate-50/50">
                    Departmental queue is currently clear
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
