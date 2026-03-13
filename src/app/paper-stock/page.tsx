
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
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  LayoutGrid
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
  updateDoc,
  getDoc
} from "firebase/firestore"
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
  const [editingRoll, setEditingRoll] = useState<any>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(20)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Metadata queries
  const companiesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'paper_companies'), limit(100)) : null, [firestore]);
  const typesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'paper_types'), limit(100)) : null, [firestore]);
  const { data: companyList } = useCollection(companiesQuery);
  const { data: paperTypeList } = useCollection(typesQuery);

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

  const [filters, setFilters] = useState<any>({
    search: "",
    paperCompany: [],
    paperType: [],
    widthMm: [],
    gsm: [],
    jobNo: [],
    lotNo: []
  })

  const [formData, setFormData] = useState({
    rollNo: "", 
    paperCompany: "",
    paperType: "",
    widthMm: 0,
    lengthMeters: 0,
    sqm: 0,
    gsm: 0,
    weightKg: 0,
    purchaseRate: 0,
    receivedDate: "",
    dateOfUsed: "Not Used",
    jobNo: "",
    jobSize: "",
    jobName: "",
    lotNo: "",
    companyRollNo: "",
    remarks: ""
  })

  useEffect(() => { 
    setIsMounted(true);
    setFormData(prev => ({ ...prev, receivedDate: new Date().toISOString().split('T')[0] }));
  }, [])

  // Optimized Registry Query
  const registryQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'paper_stock'), orderBy('rollNo', 'desc'), limit(100));
  }, [firestore]);

  const { data: rolls, isLoading: itemsLoading } = useCollection(registryQuery);

  const getUniqueOptions = (key: string) => {
    if (!rolls) return [];
    if (key === 'paperCompany') return companyList?.map(c => c.name).sort() || [];
    if (key === 'paperType') return paperTypeList?.map(t => t.name).sort() || [];
    const values = rolls.map(r => r[key]).filter(v => v !== undefined && v !== null && v !== "");
    return Array.from(new Set(values.map(String))).sort();
  }

  const handleInputChange = (name: string, value: any) => {
    if (['widthMm', 'lengthMeters', 'gsm', 'weightKg', 'purchaseRate'].includes(name)) {
      const numVal = value === "" ? 0 : Number(value);
      setFormData(prev => ({ ...prev, [name]: numVal }));
      
      if (['widthMm', 'lengthMeters', 'gsm'].includes(name) && numVal <= 0) {
        setErrors(prev => ({ ...prev, [name]: `${name} must be greater than 0` }));
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
    return Number(((w / 1000) * l).toFixed(2));
  }, [formData.widthMm, formData.lengthMeters]);

  const filteredRows = useMemo(() => {
    if (!rolls) return [];
    return rolls.filter(row => {
      if (filters.search) {
        const s = filters.search.toLowerCase();
        const searchableKeys = [
          'rollNo', 'paperCompany', 'paperType', 'jobNo', 'jobName', 
          'lotNo', 'companyRollNo', 'remarks'
        ];
        const isMatch = searchableKeys.some(key => String(row[key] || "").toLowerCase().includes(s));
        if (!isMatch) return false;
      }

      const multiFilters = Object.keys(filters).filter(k => Array.isArray(filters[k]) && filters[k].length > 0);
      for (const key of multiFilters) {
        if (!filters[key].includes(String(row[key]))) return false;
      }

      return true;
    });
  }, [rolls, filters]);

  const totalPages = Math.ceil(filteredRows.length / rowsPerPage);
  const startRange = filteredRows.length === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1;
  const endRange = Math.min(currentPage * rowsPerPage, filteredRows.length);

  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredRows.slice(start, start + rowsPerPage);
  }, [filteredRows, currentPage, rowsPerPage]);

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
          "h-9 px-3 text-[11px] gap-2 font-black uppercase tracking-tighter bg-white border-primary/10",
          filters[field]?.length > 0 && "border-primary bg-primary/5 text-primary"
        )}>
          {label}
          {filters[field]?.length > 0 && <Badge variant="secondary" className="h-4 px-1 text-[9px] bg-primary text-white">{filters[field].length}</Badge>}
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56 max-h-[300px] overflow-y-auto shadow-2xl rounded-xl border-primary/10">
        <DropdownMenuLabel className="text-[10px] uppercase font-black text-muted-foreground">{label} List</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {options.map(opt => (
          <DropdownMenuCheckboxItem 
            key={opt} 
            checked={filters[field]?.includes(String(opt))} 
            onCheckedChange={() => toggleMultiFilter(field, String(opt))} 
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
    setErrors({});
    if (roll) {
      setEditingRoll(roll);
      setFormData({ ...formData, ...roll });
    } else {
      setEditingRoll(null);
      setFormData({
        rollNo: "", 
        paperCompany: "", 
        paperType: "",
        widthMm: 0, 
        lengthMeters: 0, 
        sqm: 0, 
        gsm: 0, 
        weightKg: 0, 
        purchaseRate: 0,
        receivedDate: new Date().toISOString().split('T')[0],
        dateOfUsed: "Not Used",
        jobNo: "", 
        jobSize: "",
        jobName: "", 
        lotNo: "", 
        companyRollNo: "",
        remarks: ""
      });
    }
    setIsDialogOpen(true);
  }

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firestore || !user || isProcessing) return;
    
    setIsProcessing(true);
    
    const finalData = { 
      ...formData, 
      sqm: calculatedSqm,
      updatedAt: serverTimestamp(),
      updatedById: user.uid
    };

    try {
      if (editingRoll) {
        await updateDoc(doc(firestore, 'paper_stock', editingRoll.id), finalData);
        setIsDialogOpen(false);
        showModal('SUCCESS', 'Record Updated', 'Technical updates verified and saved.', undefined, true);
      } else {
        await runTransaction(firestore, async (transaction) => {
          const counterRef = doc(firestore, 'counters', 'paper_roll');
          const counterSnap = await transaction.get(counterRef);
          let nextNum = counterSnap.exists() ? (counterSnap.data().current_number || 0) + 1 : 1;
          const rollId = `RL-${nextNum.toString().padStart(4, '0')}`;
          const newDocRef = doc(collection(firestore, 'paper_stock'), rollId);
          
          const newRollData = { 
            ...finalData, 
            rollNo: rollId, 
            createdAt: serverTimestamp(), 
            createdById: user.uid, 
            id: rollId 
          };
          
          transaction.set(newDocRef, newRollData);
          transaction.set(counterRef, { current_number: nextNum }, { merge: true });
        });
        setIsDialogOpen(false);
        showModal('SUCCESS', 'Roll Generated', `Transaction complete. Roll ID: RL-${formData.rollNo}`, undefined, true);
      }
    } catch (error: any) {
      showModal('ERROR', 'Save Failed', error.message || 'Firestore write denied.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkDelete = () => {
    if (!firestore || selectedIds.size === 0) return;
    showModal('CONFIRMATION', 'Authorize Bulk Wipe?', `Permanently purge ${selectedIds.size} technical records?`, async () => {
      setIsProcessing(true);
      const batch = writeBatch(firestore);
      selectedIds.forEach(id => batch.delete(doc(firestore, 'paper_stock', id)));
      await batch.commit().then(() => {
        setSelectedIds(new Set());
        showModal('SUCCESS', 'Batch Purged', 'Selected inventory removed from registry.', undefined, true);
      }).catch(err => showModal('ERROR', 'Wipe Failed', err.message)).finally(() => setIsProcessing(false));
    });
  };

  if (!isMounted) return null;

  return (
    <div className="flex flex-col h-[calc(100vh-10rem)] space-y-4 font-sans">
      <ActionModal isOpen={modal.isOpen} onClose={() => setModal(p => ({ ...p, isOpen: false }))} {...modal} isProcessing={isProcessing} />

      <div className="bg-white p-4 rounded-2xl border shadow-sm space-y-4 px-6 shrink-0 border-primary/10">
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-primary opacity-50" />
            <Input 
              placeholder="Global Search (Roll, Job, Type, Lot...)" 
              className="pl-9 h-10 text-xs font-bold bg-slate-50/50 border-none shadow-inner" 
              value={filters.search} 
              onChange={e => setFilters({ ...filters, search: e.target.value })} 
            />
          </div>
          <Button variant="ghost" size="sm" onClick={() => setFilters({
            search: "", paperCompany: [], paperType: [], widthMm: [], gsm: [], jobNo: [], lotNo: []
          })} className="text-[10px] font-black uppercase text-destructive tracking-widest hover:bg-destructive/5"><FilterX className="h-4 w-4 mr-1.5" /> Reset All</Button>
        </div>
        <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-50">
          <MultiSelectFilter label="Company" field="paperCompany" options={getUniqueOptions('paperCompany')} />
          <MultiSelectFilter label="Type" field="paperType" options={getUniqueOptions('paperType')} />
          <MultiSelectFilter label="Width" field="widthMm" options={getUniqueOptions('widthMm')} />
          <MultiSelectFilter label="GSM" field="gsm" options={getUniqueOptions('gsm')} />
          <MultiSelectFilter label="Job ID" field="jobNo" options={getUniqueOptions('jobNo')} />
          <MultiSelectFilter label="Lot No" field="lotNo" options={getUniqueOptions('lotNo')} />
        </div>
      </div>

      <div className="bg-primary text-white p-3 flex items-center justify-between shrink-0 px-6 rounded-t-2xl shadow-lg">
        <div className="flex items-center gap-4">
          <h2 className="font-black text-sm uppercase tracking-widest flex items-center gap-2"><LayoutGrid className="h-5 w-5" /> Paper Stock Registry (18-Column)</h2>
          <Badge className="bg-white/20 text-[10px] font-black border-none h-6 px-3">
            Showing {startRange}-{endRange} of {filteredRows.length} Rolls
          </Badge>
          {selectedIds.size > 0 && <Button variant="destructive" size="sm" className="h-7 text-[9px] font-black uppercase px-4 border-2 border-white/20 shadow-xl" onClick={handleBulkDelete}><Trash2 className="h-3 w-3 mr-1.5" /> Bulk Purge ({selectedIds.size})</Button>}
        </div>
        <Button variant="ghost" size="icon" className="h-10 w-10 text-white hover:bg-white/20 rounded-full" onClick={() => handleOpenDialog()}><Plus className="h-6 w-6" /></Button>
      </div>

      <Card className="flex-1 overflow-hidden flex flex-col border-none shadow-2xl bg-white rounded-b-2xl">
        <div className="flex-1 overflow-auto scrollbar-thin">
          <Table className="border-separate border-spacing-0 min-w-[3000px]">
            <TableHeader className="sticky top-0 z-40 bg-slate-50 border-b shadow-sm">
              <TableRow>
                <TableHead className="w-[50px] text-center border-r sticky left-0 bg-slate-50 z-50">
                  <Checkbox 
                    checked={selectedIds.size === paginatedRows.length && paginatedRows.length > 0} 
                    onCheckedChange={(val) => val ? setSelectedIds(new Set(paginatedRows.map(r => r.id))) : setSelectedIds(new Set())} 
                  />
                </TableHead>
                <TableHead className="w-[60px] text-center font-black text-[10px] uppercase border-r sticky left-[50px] bg-slate-50 z-50">Sl No</TableHead>
                <TableHead className="w-[120px] font-black text-[10px] uppercase border-r text-center">Roll No</TableHead>
                <TableHead className="font-black text-[10px] uppercase border-r">Paper Company</TableHead>
                <TableHead className="font-black text-[10px] uppercase border-r">Paper Type</TableHead>
                <TableHead className="font-black text-[10px] uppercase border-r text-right">Width (MM)</TableHead>
                <TableHead className="font-black text-[10px] uppercase border-r text-right">Length (MTR)</TableHead>
                <TableHead className="font-black text-[10px] uppercase border-r text-right text-primary">SQM</TableHead>
                <TableHead className="font-black text-[10px] uppercase border-r text-right">GSM</TableHead>
                <TableHead className="font-black text-[10px] uppercase border-r text-right">Weight (KG)</TableHead>
                <TableHead className="font-black text-[10px] uppercase border-r text-right">Rate</TableHead>
                <TableHead className="font-black text-[10px] uppercase border-r text-center">Date Received</TableHead>
                <TableHead className="font-black text-[10px] uppercase border-r text-center">Date of Used</TableHead>
                <TableHead className="font-black text-[10px] uppercase border-r">Job No</TableHead>
                <TableHead className="font-black text-[10px] uppercase border-r">Job Size</TableHead>
                <TableHead className="font-black text-[10px] uppercase border-r">Job Name</TableHead>
                <TableHead className="font-black text-[10px] uppercase border-r">Lot No / Batch No</TableHead>
                <TableHead className="font-black text-[10px] uppercase border-r">Company Roll No</TableHead>
                <TableHead className="font-black text-[10px] uppercase border-r">Remarks</TableHead>
                <TableHead className="text-right font-black text-[10px] uppercase sticky right-0 bg-slate-50 z-50 border-l shadow-[-4px_0_10px_rgba(0,0,0,0.05)]">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {itemsLoading ? (
                <TableRow><TableCell colSpan={20} className="text-center py-20"><Loader2 className="animate-spin mx-auto text-primary h-10 w-10" /></TableCell></TableRow>
              ) : paginatedRows.map((j, i) => (
                <TableRow key={j.id} className={cn("hover:bg-slate-50 transition-colors border-b h-11 group", selectedIds.has(j.id) && "bg-primary/5")}>
                  <TableCell className="text-center border-r sticky left-0 bg-white z-20 group-hover:bg-slate-50"><Checkbox checked={selectedIds.has(j.id)} onCheckedChange={(val) => { const next = new Set(selectedIds); val ? next.add(j.id) : next.delete(j.id); setSelectedIds(next); }} /></TableCell>
                  <TableCell className="text-center font-bold text-[11px] text-slate-400 border-r sticky left-[50px] bg-white z-20 group-hover:bg-slate-50">{(currentPage - 1) * rowsPerPage + i + 1}</TableCell>
                  <TableCell className="font-black text-[11px] text-primary border-r text-center font-mono">{j.rollNo}</TableCell>
                  <TableCell className="text-[11px] border-r uppercase font-bold text-left">{j.paperCompany}</TableCell>
                  <TableCell className="text-[11px] border-r font-medium text-left">{j.paperType}</TableCell>
                  <TableCell className="text-right text-[11px] border-r font-mono font-bold">{j.widthMm}</TableCell>
                  <TableCell className="text-right text-[11px] border-r font-mono font-bold">{j.lengthMeters}</TableCell>
                  <TableCell className="text-right text-[11px] border-r font-black text-primary font-mono">{j.sqm}</TableCell>
                  <TableCell className="text-right text-[11px] border-r font-mono">{j.gsm}</TableCell>
                  <TableCell className="text-right text-[11px] border-r font-mono">{j.weightKg || 0}</TableCell>
                  <TableCell className="text-right text-[11px] border-r font-mono">₹{j.purchaseRate || 0}</TableCell>
                  <TableCell className="text-center text-[11px] border-r">{j.receivedDate}</TableCell>
                  <TableCell className="text-center text-[11px] border-r italic text-slate-400">{j.dateOfUsed || 'Not Used'}</TableCell>
                  <TableCell className="text-[11px] border-r font-mono text-left font-bold">{j.jobNo || '-'}</TableCell>
                  <TableCell className="text-[11px] border-r text-left font-medium">{j.jobSize || '-'}</TableCell>
                  <TableCell className="text-[11px] border-r text-left truncate max-w-[150px] font-medium">{j.jobName || '-'}</TableCell>
                  <TableCell className="text-[11px] border-r text-left font-mono">{j.lotNo || '-'}</TableCell>
                  <TableCell className="text-[11px] border-r text-left font-mono">{j.companyRollNo || '-'}</TableCell>
                  <TableCell className="text-[11px] border-r text-left truncate max-w-[200px] italic text-slate-400">{j.remarks || '-'}</TableCell>
                  <TableCell className="text-right sticky right-0 bg-white z-20 group-hover:bg-slate-50 border-l px-2 shadow-[-4px_0_10px_rgba(0,0,0,0.05)]">
                    <div className="flex justify-end gap-1.5"><Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => handleOpenDialog(j)}><Pencil className="h-4 w-4" /></Button></div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="bg-slate-50 p-3 border-t flex items-center justify-between shrink-0 px-6">
          <div className="flex items-center gap-4">
            <Select value={rowsPerPage.toString()} onValueChange={v => { setRowsPerPage(Number(v)); setCurrentPage(1); }}>
              <SelectTrigger className="h-8 w-[100px] bg-white text-[10px] font-black uppercase"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[10, 20, 50, 100].map(v => <SelectItem key={v} value={v.toString()}>{v} Rows</SelectItem>)}
              </SelectContent>
            </Select>
            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest border-l pl-4">
              Showing {startRange}–{endRange} of {filteredRows.length} Technical Units
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8 px-3 text-[10px] font-black uppercase" onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1}><ChevronLeft className="h-4 w-4 mr-1" /> Prev</Button>
            <span className="text-xs font-black bg-primary text-white h-8 px-4 flex items-center justify-center rounded-md shadow-inner">{currentPage} / {totalPages || 1}</span>
            <Button variant="outline" size="sm" className="h-8 px-3 text-[10px] font-black uppercase" onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage >= totalPages}>Next <ChevronRight className="h-4 w-4 ml-1" /></Button>
          </div>
        </div>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[850px] max-h-[95vh] overflow-y-auto p-0 border-none rounded-2xl shadow-3xl">
          <form onSubmit={handleSave}>
            <DialogHeader className="p-6 bg-primary text-white">
              <DialogTitle className="uppercase font-black text-xl tracking-tighter flex items-center gap-2">
                <Package className="h-6 w-6" /> {editingRoll ? `Update Roll: ${formData.rollNo}` : 'New Technical Roll Intake'}
              </DialogTitle>
            </DialogHeader>
            <div className="p-8 grid grid-cols-2 gap-x-8 gap-y-6 bg-white">
              {/* Field 1: Sl No (Displayed only in table, but listed in request order for form logic) */}
              <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black text-slate-500">1. Serial Number (Auto Table)</Label><Input value="AUTO" readOnly className="h-11 bg-slate-50" /></div>
              
              {/* Field 2: Roll No */}
              <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black text-slate-500">2. Roll Number (System ID)</Label><Input value={formData.rollNo || "AUTO-GENERATED"} readOnly className="h-11 bg-slate-50 font-black text-primary border-2" /></div>
              
              {/* Field 3: Paper Company */}
              <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black text-slate-500">3. Paper Company</Label>
                <Select value={formData.paperCompany} onValueChange={v => handleInputChange('paperCompany', v)}>
                  <SelectTrigger className="h-11 font-bold border-2"><SelectValue placeholder="Select Supplier" /></SelectTrigger>
                  <SelectContent>{companyList?.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>

              {/* Field 4: Paper Type */}
              <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black text-slate-500">4. Paper Type (Substrate)</Label>
                <Select value={formData.paperType} onValueChange={v => handleInputChange('paperType', v)}>
                  <SelectTrigger className="h-11 font-bold border-2"><SelectValue placeholder="Select Material" /></SelectTrigger>
                  <SelectContent>{paperTypeList?.map(t => <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>

              {/* Field 5 & 6: Width and Length */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black text-slate-500">5. Width (MM)</Label>
                  <Input type="number" min="0" step="0.01" value={formData.widthMm || ""} onChange={e => handleInputChange('widthMm', e.target.value)} required className={cn("h-11 font-black", errors.widthMm && "border-destructive border-2")} />
                </div>
                <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black text-slate-500">6. Length (MTR)</Label>
                  <Input type="number" min="0" step="0.01" value={formData.lengthMeters || ""} onChange={e => handleInputChange('lengthMeters', e.target.value)} required className={cn("h-11 font-black", errors.lengthMeters && "border-destructive border-2")} />
                </div>
              </div>

              {/* Field 7: SQM */}
              <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black text-primary">7. Total SQM (Calculated)</Label>
                <Input value={calculatedSqm} readOnly className="h-11 font-black bg-primary/5 text-primary border-primary/20 text-xl shadow-inner" />
              </div>

              {/* Field 8: GSM */}
              <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black text-slate-500">8. GSM</Label>
                <Input type="number" value={formData.gsm || ""} onChange={e => handleInputChange('gsm', e.target.value)} required className={cn("h-11 font-bold", errors.gsm && "border-destructive border-2")} />
              </div>

              {/* Field 9: Weight */}
              <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black text-slate-500">9. Weight (KG)</Label>
                <Input type="number" step="0.01" value={formData.weightKg || ""} onChange={e => handleInputChange('weightKg', e.target.value)} className="h-11 font-bold" />
              </div>

              {/* Field 10: Purchase Rate */}
              <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black text-slate-500">10. Purchase Rate (₹)</Label>
                <Input type="number" step="0.01" value={formData.purchaseRate || ""} onChange={e => handleInputChange('purchaseRate', e.target.value)} className="h-11 font-bold" />
              </div>

              {/* Field 11: Date Received */}
              <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black text-slate-500">11. Date of Received</Label>
                <Input type="date" value={formData.receivedDate} onChange={e => handleInputChange('receivedDate', e.target.value)} required className="h-11 font-black" />
              </div>

              {/* Field 12: Date of Used */}
              <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black text-slate-500">12. Date of Used</Label>
                <Input value={formData.dateOfUsed} readOnly className="h-11 bg-slate-50 text-slate-400 italic" />
              </div>

              {/* Field 13: Job No */}
              <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black text-slate-500">13. Job No</Label>
                <Input value={formData.jobNo} onChange={e => handleInputChange('jobNo', e.target.value)} className="h-11 font-bold" />
              </div>

              {/* Field 14: Job Size */}
              <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black text-slate-500">14. Job Size</Label>
                <Input value={formData.jobSize} onChange={e => handleInputChange('jobSize', e.target.value)} className="h-11 font-bold" />
              </div>

              {/* Field 15: Job Name */}
              <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black text-slate-500">15. Job Name</Label>
                <Input value={formData.jobName} onChange={e => handleInputChange('jobName', e.target.value)} className="h-11 font-bold" />
              </div>

              {/* Field 16: Lot / Batch No */}
              <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black text-slate-500">16. Lot No / Batch No</Label>
                <Input value={formData.lotNo} onChange={e => handleInputChange('lotNo', e.target.value)} className="h-11 font-bold" />
              </div>

              {/* Field 17: Company Roll No */}
              <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black text-slate-500">17. Company Roll No</Label>
                <Input value={formData.companyRollNo} onChange={e => handleInputChange('companyRollNo', e.target.value)} className="h-11 font-bold" />
              </div>

              {/* Field 18: Remarks */}
              <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black text-slate-500">18. Remarks</Label>
                <Textarea value={formData.remarks} onChange={e => handleInputChange('remarks', e.target.value)} className="min-h-[44px] h-11" />
              </div>
            </div>
            <DialogFooter className="p-6 bg-slate-50 border-t rounded-b-2xl">
              <Button type="submit" disabled={isProcessing || Object.keys(errors).length > 0} className="w-full h-16 uppercase font-black text-xl bg-primary hover:bg-primary/90 transition-all shadow-2xl rounded-xl border-4 border-white/20">
                {isProcessing ? <Loader2 className="animate-spin mr-2 h-6 w-6" /> : editingRoll ? 'Commit Technical Updates' : 'Authorize Production Entry'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
