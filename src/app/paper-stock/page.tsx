"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
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
  LayoutGrid,
  Eye,
  Scissors,
  Printer,
  FileDown,
  Columns as ColumnsIcon,
  ArrowUp,
  ArrowDown,
  ArrowUpDown
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
import { useFirestore, useUser, useCollection, useMemoFirebase } from "@/firebase"
import { 
  collection, 
  doc, 
  query, 
  limit, 
  serverTimestamp,
  runTransaction,
  deleteDoc,
  updateDoc
} from "firebase/firestore"
import { cn } from "@/lib/utils"
import { usePermissions } from "@/components/auth/permission-context"
import { ActionModal, ModalType } from "@/components/action-modal"
import * as XLSX from 'xlsx'

const STATUS_OPTIONS = [
  { value: "Available", label: "Available", color: "bg-emerald-500", rowBg: "bg-[#E8F8F1]" },
  { value: "Reserved", label: "Reserved", color: "bg-amber-500", rowBg: "bg-[#FFF4E5]" },
  { value: "In Production", label: "In Production", color: "bg-blue-500", rowBg: "bg-[#EAF2FF]" },
  { value: "Slitted", label: "Slitted", color: "bg-purple-500", rowBg: "bg-[#F4E8FF]" },
  { value: "Consumed", label: "Consumed", color: "bg-destructive", rowBg: "bg-[#FFECEC]" },
];

const COLUMN_KEYS = [
  { id: 'paperCompany', label: 'Paper Company' },
  { id: 'paperType', label: 'Paper Type' },
  { id: 'widthMm', label: 'Width (MM)' },
  { id: 'lengthMeters', label: 'Length (MTR)' },
  { id: 'sqm', label: 'SQM' },
  { id: 'gsm', label: 'GSM' },
  { id: 'weightKg', label: 'Weight (KG)' },
  { id: 'purchaseRate', label: 'Purchase Rate' },
  { id: 'receivedDate', label: 'Date of Received' },
  { id: 'dateOfUsed', label: 'Date of Used' },
  { id: 'jobNo', label: 'Job No' },
  { id: 'jobSize', label: 'Job Size' },
  { id: 'jobName', label: 'Job Name' },
  { id: 'lotNo', label: 'Lot No / Batch No' },
  { id: 'companyRollNo', label: 'Company Roll No' },
  { id: 'remarks', label: 'Remarks' },
];

const FIELD_LABELS: Record<string, string> = {
  rollNo: "Roll No",
  status: "Status",
  paperCompany: "Paper Company",
  paperType: "Paper Type",
  widthMm: "Width (MM)",
  lengthMeters: "Length (MTR)",
  sqm: "SQM",
  gsm: "GSM",
  weightKg: "Weight (KG)",
  purchaseRate: "Purchase Rate",
  receivedDate: "Date of Received",
  dateOfUsed: "Date of Used",
  jobNo: "Job No",
  jobSize: "Job Size",
  jobName: "Job Name",
  lotNo: "Lot No / Batch No",
  companyRollNo: "Company Roll No",
  remarks: "Remarks"
};

type SortDirection = 'asc' | 'desc' | null;

interface SortConfig {
  key: string;
  direction: SortDirection;
}

export default function PaperStockPage() {
  const { user } = useUser()
  const router = useRouter()
  const firestore = useFirestore()
  const { hasPermission } = usePermissions()
  
  const [isMounted, setIsMounted] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isViewOpen, setIsViewOpen] = useState(false)
  const [isPrintOpen, setIsPrintOpen] = useState(false)
  const [editingRoll, setEditingRoll] = useState<any>(null)
  const [viewingRoll, setViewingRoll] = useState<any>(null)
  const [printingRoll, setPrintingRoll] = useState<any>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  
  const [currentPage, setCurrentPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(50) 
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'rollNo', direction: 'desc' })

  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    rollNo: true,
    status: true,
    paperCompany: true,
    paperType: true,
    widthMm: true,
    lengthMeters: true,
    sqm: true,
    gsm: true,
    weightKg: true,
    purchaseRate: true,
    receivedDate: true,
    dateOfUsed: true,
    jobNo: true,
    jobSize: true,
    jobName: true,
    lotNo: true,
    companyRollNo: true,
    remarks: true
  })

  useEffect(() => { 
    setIsMounted(true);
    setFormData(prev => ({ ...prev, receivedDate: new Date().toISOString().split('T')[0] }));
    
    const saved = localStorage.getItem('paperStockVisibleColumns')
    if (saved) {
      try {
        setVisibleColumns(prev => ({ ...prev, ...JSON.parse(saved) }))
      } catch (e) {
        console.error("Failed to load column settings", e)
      }
    }
  }, [])

  useEffect(() => {
    if (isMounted) {
      localStorage.setItem('paperStockVisibleColumns', JSON.stringify(visibleColumns))
    }
  }, [visibleColumns, isMounted])

  const [modal, setModal] = useState<{
    isOpen: boolean;
    type: ModalType;
    title: string;
    description?: string;
  }>({ isOpen: false, type: 'SUCCESS', title: '' });

  const [filters, setFilters] = useState<any>({
    search: "",
    paperCompany: [],
    paperType: [],
    status: [],
    jobNo: [],
    jobSize: [],
    jobName: [],
    lotNo: [],
    companyRollNo: [],
    widthMin: "", widthMax: "",
    lengthMin: "", lengthMax: "",
    sqmMin: "", sqmMax: "",
    gsmMin: "", gsmMax: "",
    weightMin: "", weightMax: "",
    rateMin: "", rateMax: "",
    receivedFrom: "", receivedTo: "",
    usedFrom: "", usedTo: ""
  })

  const [formData, setFormData] = useState({
    rollNo: "", 
    paperCompany: "",
    paperType: "",
    status: "Available",
    widthMm: 0,
    lengthMeters: 0,
    sqm: 0,
    gsm: 0,
    weightKg: 0,
    purchaseRate: 0,
    receivedDate: "",
    dateOfUsed: "",
    jobNo: "",
    jobSize: "",
    jobName: "",
    lotNo: "",
    companyRollNo: "",
    remarks: ""
  })

  const registryQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'paper_stock'), limit(1000));
  }, [firestore]);

  const { data: rolls, isLoading: itemsLoading } = useCollection(registryQuery);

  const getUniqueOptions = (key: string) => {
    if (!rolls) return [];
    const values = rolls.map(r => r[key]).filter(v => v !== undefined && v !== null && v !== "");
    return Array.from(new Set(values.map(String))).sort();
  }

  const calculatedSqm = useMemo(() => {
    const w = Number(formData.widthMm) || 0;
    const l = Number(formData.lengthMeters) || 0;
    return Number(((w / 1000) * l).toFixed(2));
  }, [formData.widthMm, formData.lengthMeters]);

  const requestSort = (key: string) => {
    let direction: SortDirection = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    } else if (sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = null;
    }
    setSortConfig({ key, direction });
  }

  const filteredRows = useMemo(() => {
    if (!rolls) return [];
    let result = rolls.filter(row => {
      if (filters.search) {
        const s = filters.search.toLowerCase();
        return Object.values(row).some(v => String(v || "").toLowerCase().includes(s));
      }

      const categories = ['paperCompany', 'paperType', 'status', 'jobNo', 'jobSize', 'jobName', 'lotNo', 'companyRollNo'];
      for (const cat of categories) {
        if (filters[cat]?.length > 0 && !filters[cat].includes(String(row[cat] || ""))) return false;
      }

      const numericRanges = [
        { key: 'widthMm', min: 'widthMin', max: 'widthMax' },
        { key: 'lengthMeters', min: 'lengthMin', max: 'lengthMax' },
        { key: 'sqm', min: 'sqmMin', max: 'sqmMax' },
        { key: 'gsm', min: 'gsmMin', max: 'gsmMax' },
        { key: 'weightKg', min: 'weightMin', max: 'weightMax' },
        { key: 'purchaseRate', min: 'rateMin', max: 'rateMax' }
      ];
      for (const r of numericRanges) {
        const val = Number(row[r.key] || 0);
        if (filters[r.min] && val < Number(filters[r.min])) return false;
        if (filters[r.max] && val > Number(filters[r.max])) return false;
      }

      if (filters.receivedFrom && (row.receivedDate || "") < filters.receivedFrom) return false;
      if (filters.receivedTo && (row.receivedDate || "") > filters.receivedTo) return false;
      if (filters.usedFrom && (row.dateOfUsed || "") < filters.usedFrom) return false;
      if (filters.usedTo && (row.dateOfUsed || "") > filters.usedTo) return false;

      return true;
    });

    if (sortConfig.key && sortConfig.direction) {
      result.sort((a, b) => {
        const key = sortConfig.key;
        let valA = a[key];
        let valB = b[key];

        if (['widthMm', 'lengthMeters', 'sqm', 'gsm', 'weightKg', 'purchaseRate'].includes(key)) {
          valA = Number(valA || 0);
          valB = Number(valB || 0);
          return sortConfig.direction === 'asc' ? valA - valB : valB - valA;
        }

        valA = String(valA || "").toLowerCase();
        valB = String(valB || "").toLowerCase();
        
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [rolls, filters, sortConfig]);

  const totalPages = Math.ceil(filteredRows.length / rowsPerPage);
  const startRange = filteredRows.length === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1;
  const endRange = Math.min(currentPage * rowsPerPage, filteredRows.length);

  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredRows.slice(start, start + rowsPerPage);
  }, [filteredRows, currentPage, rowsPerPage]);

  const handleOpenDialog = (roll?: any) => {
    if (roll) {
      setEditingRoll(roll);
      setFormData({ ...formData, ...roll });
    } else {
      setEditingRoll(null);
      setFormData({
        rollNo: "", paperCompany: "", paperType: "", status: "Available",
        widthMm: 0, lengthMeters: 0, sqm: 0, gsm: 0, weightKg: 0, purchaseRate: 0,
        receivedDate: new Date().toISOString().split('T')[0],
        dateOfUsed: "", jobNo: "", jobSize: "", jobName: "", lotNo: "", 
        companyRollNo: "", remarks: ""
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
        setModal({ isOpen: true, type: 'SUCCESS', title: 'Record Updated' });
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
        setIsDialogOpen(false);
        setModal({ isOpen: true, type: 'SUCCESS', title: 'Roll Generated' });
      }
    } catch (error: any) {
      setModal({ isOpen: true, type: 'ERROR', title: 'Transaction Failed', description: error.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const exportStock = () => {
    if (filteredRows.length === 0) return;
    const ws = XLSX.utils.json_to_sheet(filteredRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Stock Registry");
    XLSX.writeFile(wb, "Reel_Inventory_Export.xlsx");
  }

  const MultiSelectFilter = ({ label, field, options }: { label: string, field: string, options: any[] }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className={cn(
          "h-8 px-2 text-[10px] gap-1 font-black uppercase border-slate-200 bg-white tracking-widest",
          filters[field]?.length > 0 && "border-primary bg-primary/5 text-primary"
        )}>
          {label}
          {filters[field]?.length > 0 && <Badge variant="secondary" className="h-3 px-1 text-[8px] bg-primary text-white">{filters[field].length}</Badge>}
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56 max-h-[300px] overflow-y-auto z-[200]">
        <DropdownMenuLabel className="text-[10px] uppercase font-black">{label}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {options.map(opt => (
          <DropdownMenuCheckboxItem 
            key={opt} 
            checked={filters[field]?.includes(String(opt))} 
            onCheckedChange={() => {
              const current = filters[field] || [];
              const next = current.includes(String(opt)) ? current.filter((v: any) => v !== String(opt)) : [...current, String(opt)];
              setFilters({ ...filters, [field]: next });
              setCurrentPage(1);
            }} 
            className="text-xs font-bold"
          >
            {String(opt)}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const SortableHeader = ({ label, field, className = "" }: { label: string, field: string, className?: string }) => {
    if (!visibleColumns[field]) return null;
    const isActive = sortConfig.key === field;
    return (
      <TableHead 
        className={cn(
          "cursor-pointer select-none transition-colors hover:bg-slate-200 border-r border-b sticky top-0 bg-slate-100 p-0 h-10 z-[20]", 
          isActive && "bg-slate-200", 
          className
        )} 
        onClick={() => requestSort(field)} 
      >
        <div className="flex items-center justify-center gap-1.5 px-2">
          <span className="font-black text-[10px] uppercase text-slate-700 tracking-tighter">{label}</span>
          {isActive ? (
            sortConfig.direction === 'asc' ? <ArrowUp className="h-3 w-3 text-primary" /> : <ArrowDown className="h-3 w-3 text-primary" />
          ) : (
            <ArrowUpDown className="h-2.5 w-2.5 opacity-30" />
          )}
        </div>
      </TableHead>
    );
  };

  if (!isMounted) return null;

  return (
    <div className="flex flex-col h-full space-y-3 font-sans animate-in fade-in duration-500">
      <ActionModal isOpen={modal.isOpen} onClose={() => setModal(p => ({ ...p, isOpen: false }))} {...modal} />

      <div className="bg-white p-3 rounded-xl border shadow-sm space-y-3 px-6 shrink-0 border-slate-200">
        <div className="flex items-center gap-6">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Search master registry..." 
              className="pl-10 h-10 text-xs bg-slate-50 border-slate-200 font-bold" 
              value={filters.search} 
              onChange={e => setFilters({ ...filters, search: e.target.value })} 
            />
          </div>
          <div className="ml-auto flex items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-10 px-4 gap-2 font-black uppercase text-[10px] tracking-widest border-2">
                  <ColumnsIcon className="h-4 w-4 text-primary" /> Display Settings
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 p-3 shadow-2xl z-[200]">
                <DropdownMenuLabel className="text-[10px] uppercase font-black opacity-50 mb-2 tracking-widest">Toggle Columns</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <div className="max-h-[400px] overflow-y-auto industrial-scroll">
                  {COLUMN_KEYS.map(col => (
                    <DropdownMenuCheckboxItem 
                      key={col.id} 
                      checked={visibleColumns[col.id]} 
                      onCheckedChange={v => setVisibleColumns({...visibleColumns, [col.id]: v})}
                      className="text-xs font-bold py-2"
                    >
                      {col.label}
                    </DropdownMenuCheckboxItem>
                  ))}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button variant="outline" size="sm" onClick={exportStock} className="h-10 px-4 gap-2 font-black uppercase text-[10px] tracking-widest border-2 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 transition-all">
              <FileDown className="h-4 w-4" /> Download XLSX
            </Button>

            <Button variant="ghost" size="sm" onClick={() => setFilters({
              search: "", paperCompany: [], paperType: [], status: [], jobNo: [], jobSize: [], jobName: [], lotNo: [], companyRollNo: [],
              widthMin: "", widthMax: "", lengthMin: "", lengthMax: "", sqmMin: "", sqmMax: "", gsmMin: "", gsmMax: "", weightMin: "", weightMax: "", rateMin: "", rateMax: "",
              receivedFrom: "", receivedTo: "", usedFrom: "", usedTo: ""
            })} className="text-[10px] font-black uppercase text-destructive tracking-widest"><FilterX className="h-4 w-4 mr-1.5" /> Reset</Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 pb-1">
          <MultiSelectFilter label="Status" field="status" options={STATUS_OPTIONS.map(o => o.value)} />
          <MultiSelectFilter label="Mfr" field="paperCompany" options={getUniqueOptions('paperCompany')} />
          <MultiSelectFilter label="Substrate" field="paperType" options={getUniqueOptions('paperType')} />
          <MultiSelectFilter label="Job #" field="jobNo" options={getUniqueOptions('jobNo')} />
          <MultiSelectFilter label="Job Name" field="jobName" options={getUniqueOptions('jobName')} />
          <MultiSelectFilter label="Lot No" field="lotNo" options={getUniqueOptions('lotNo')} />
        </div>
      </div>

      <Card className="flex-1 overflow-hidden flex flex-col border-slate-200 shadow-2xl rounded-xl bg-white">
        <div className="bg-slate-800 text-white p-3 px-6 flex items-center justify-between shrink-0">
          <h2 className="font-black text-xs uppercase tracking-[0.2em] flex items-center gap-3">
            <LayoutGrid className="h-5 w-5 text-primary" /> Technical Data Grid
          </h2>
          <Button variant="ghost" size="sm" className="h-9 px-4 text-white hover:bg-white/10 font-black uppercase text-[10px] tracking-widest" onClick={() => handleOpenDialog()}>
            <Plus className="h-4 w-4 mr-2" /> New Technical Intake
          </Button>
        </div>

        <div className="w-full h-[600px] overflow-scroll relative border-t industrial-scroll table-container">
          <Table className="border-separate border-spacing-0 min-w-[2800px]">
            <TableHeader className="sticky top-0 z-[30] bg-white">
              <TableRow className="h-10">
                <TableHead className="w-[40px] text-center border-r border-b sticky top-0 left-0 bg-slate-100 z-[40] p-0 shadow-[1px_0_0_#e2e8f0]">
                  <div className="flex items-center justify-center h-full">
                    <Checkbox checked={paginatedRows.length > 0 && paginatedRows.every(r => selectedIds.has(r.id))} onCheckedChange={(val) => { const next = new Set(selectedIds); paginatedRows.forEach(r => val ? next.add(r.id) : next.delete(r.id)); setSelectedIds(next); }} />
                  </div>
                </TableHead>
                <TableHead className="w-[50px] text-center font-bold text-[10px] uppercase border-r border-b sticky top-0 left-[40px] bg-slate-100 z-[40] p-0 shadow-[1px_0_0_#e2e8f0]">Sl No</TableHead>
                <SortableHeader label="Roll No" field="rollNo" className="w-[110px] border-r sticky top-0 left-[90px] bg-slate-100 z-[40] shadow-[1px_0_0_#e2e8f0]" />
                <SortableHeader label="Status" field="status" className="w-[120px]" />
                <SortableHeader label="Paper Company" field="paperCompany" />
                <SortableHeader label="Paper Type" field="paperType" />
                <SortableHeader label="Width (MM)" field="widthMm" />
                <SortableHeader label="Length (MTR)" field="lengthMeters" />
                <SortableHeader label="SQM" field="sqm" />
                <SortableHeader label="GSM" field="gsm" />
                <SortableHeader label="Weight (KG)" field="weightKg" />
                <SortableHeader label="Purchase Rate" field="purchaseRate" />
                <SortableHeader label="Date of Received" field="receivedDate" />
                <SortableHeader label="Date of Used" field="dateOfUsed" />
                <SortableHeader label="Job No" field="jobNo" />
                <SortableHeader label="Job Size" field="jobSize" />
                <SortableHeader label="Job Name" field="jobName" />
                <SortableHeader label="Lot No / Batch No" field="lotNo" />
                <SortableHeader label="Company Roll No" field="companyRollNo" />
                <SortableHeader label="Remarks" field="remarks" />
                <TableHead className="text-center font-bold text-[10px] uppercase sticky top-0 right-0 bg-slate-100 z-[40] border-l border-b shadow-[-1px_0_0_#e2e8f0] w-[180px] p-0">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {itemsLoading ? (
                <TableRow><TableCell colSpan={25} className="text-center py-20"><Loader2 className="animate-spin mx-auto text-primary h-10 w-10" /></TableCell></TableRow>
              ) : paginatedRows.map((j, i) => {
                const statusColor = STATUS_OPTIONS.find(o => o.value === j.status)?.color || "bg-slate-500";
                const rowBg = STATUS_OPTIONS.find(o => o.value === j.status)?.rowBg || "bg-white";
                return (
                  <TableRow key={j.id} className={cn("h-9 group hover:brightness-95 transition-all", rowBg)}>
                    <TableCell className="text-center border-r border-b sticky left-0 z-10 bg-inherit shadow-[1px_0_0_#e2e8f0] p-0">
                      <div className="flex items-center justify-center h-full">
                        <Checkbox checked={selectedIds.has(j.id)} onCheckedChange={(val) => { const next = new Set(selectedIds); val ? next.add(j.id) : next.delete(j.id); setSelectedIds(next); }} />
                      </div>
                    </TableCell>
                    <TableCell className="text-center font-black text-[10px] text-slate-400 border-r border-b sticky left-[40px] z-10 bg-inherit shadow-[1px_0_0_#e2e8f0] p-0">{(currentPage - 1) * rowsPerPage + i + 1}</TableCell>
                    <TableCell className="font-black text-[11px] text-primary border-r border-b text-center font-mono sticky left-[90px] z-10 bg-inherit shadow-[1px_0_0_#e2e8f0] p-0">{j.rollNo}</TableCell>
                    <TableCell className="text-center border-r border-b p-0">
                      <div className="flex items-center justify-center">
                        <span className={cn("px-2.5 py-0.5 rounded-full text-[8px] font-black text-white uppercase tracking-tighter shadow-sm", statusColor)}>{j.status || "Available"}</span>
                      </div>
                    </TableCell>
                    {visibleColumns['paperCompany'] && <TableCell className="text-[10px] font-bold border-r border-b uppercase px-3 truncate max-w-[150px] text-center">{j.paperCompany}</TableCell>}
                    {visibleColumns['paperType'] && <TableCell className="text-[10px] font-bold border-r border-b px-3 truncate max-w-[150px] text-center">{j.paperType}</TableCell>}
                    {visibleColumns['widthMm'] && <TableCell className="text-center text-[10px] border-r border-b font-mono font-bold px-2">{j.widthMm}</TableCell>}
                    {visibleColumns['lengthMeters'] && <TableCell className="text-center text-[10px] border-r border-b font-mono font-bold px-2">{j.lengthMeters}</TableCell>}
                    {visibleColumns['sqm'] && <TableCell className="text-center text-[10px] border-r border-b font-black text-primary font-mono px-2">{j.sqm}</TableCell>}
                    {visibleColumns['gsm'] && <TableCell className="text-center text-[10px] border-r border-b font-mono font-bold px-2">{j.gsm}</TableCell>}
                    {visibleColumns['weightKg'] && <TableCell className="text-center text-[10px] border-r border-b font-mono font-bold px-2">{j.weightKg || 0}</TableCell>}
                    {visibleColumns['purchaseRate'] && <TableCell className="text-center text-[10px] border-r border-b font-mono font-bold px-2">₹{j.purchaseRate || 0}</TableCell>}
                    {visibleColumns['receivedDate'] && <TableCell className="text-center text-[10px] font-bold border-r border-b px-2">{j.receivedDate}</TableCell>}
                    {visibleColumns['dateOfUsed'] && <TableCell className="text-center text-[10px] font-bold border-r border-b px-2">{j.dateOfUsed || '-'}</TableCell>}
                    {visibleColumns['jobNo'] && <TableCell className="text-center text-[10px] border-r border-b font-mono font-black text-slate-700 px-2">{j.jobNo || '-'}</TableCell>}
                    {visibleColumns['jobSize'] && <TableCell className="text-center text-[10px] border-r border-b px-2">{j.jobSize || '-'}</TableCell>}
                    {visibleColumns['jobName'] && <TableCell className="text-[10px] font-bold border-r border-b truncate max-w-[150px] px-2 text-center">{j.jobName || '-'}</TableCell>}
                    {visibleColumns['lotNo'] && <TableCell className="text-center text-[10px] border-r border-b font-mono font-bold px-2">{j.lotNo || '-'}</TableCell>}
                    {visibleColumns['companyRollNo'] && <TableCell className="text-center text-[10px] border-r border-b px-2">{j.companyRollNo || '-'}</TableCell>}
                    {visibleColumns['remarks'] && <TableCell className="text-[10px] border-r border-b px-2 italic text-center">{j.remarks || '-'}</TableCell>}
                    <TableCell className="text-center border-b sticky right-0 z-10 bg-inherit border-l shadow-[-1px_0_0_#e2e8f0] w-[180px] p-0">
                      <div className="flex items-center justify-center gap-1.5">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-500 hover:text-primary transition-colors" onClick={() => { setViewingRoll(j); setIsViewOpen(true); }}><Eye className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-blue-500 hover:bg-blue-50" onClick={() => handleOpenDialog(j)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-orange-500 hover:bg-orange-50" onClick={() => router.push(`/inventory/slitting?rollId=${j.id}`)}><Scissors className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-700 hover:bg-slate-100" onClick={() => { setPrintingRoll(j); setIsPrintOpen(true); }}><Printer className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:bg-red-50" onClick={() => { if(confirm('Delete roll?')) deleteDoc(doc(firestore!, 'paper_stock', j.id)); }}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <div className="bg-slate-50 p-2.5 border-t flex items-center justify-between shrink-0 px-6">
          <div className="flex items-center gap-4">
            <Select value={rowsPerPage.toString()} onValueChange={v => { setRowsPerPage(Number(v)); setCurrentPage(1); }}>
              <SelectTrigger className="h-8 w-[100px] bg-white text-[10px] font-black uppercase">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-[200]">
                {[10, 20, 50, 100].map(v => <SelectItem key={v} value={v.toString()}>{v} Rows</SelectItem>)}
              </SelectContent>
            </Select>
            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Showing {startRange}–{endRange} of {filteredRows.length} Rolls</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8 px-4 text-[10px] font-black uppercase tracking-widest border-2" onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1}><ChevronLeft className="h-4 w-4 mr-2" /> Prev</Button>
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-black bg-white border-2 border-slate-200 h-8 w-12 flex items-center justify-center rounded-lg shadow-inner">{currentPage}</span>
              <span className="text-[10px] font-black text-slate-400 mx-1">/</span>
              <span className="text-[10px] font-black text-slate-500">{totalPages || 1}</span>
            </div>
            <Button variant="outline" size="sm" className="h-8 px-4 text-[10px] font-black uppercase tracking-widest border-2" onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage >= totalPages}>Next <ChevronRight className="h-4 w-4 ml-2" /></Button>
          </div>
        </div>
      </Card>

      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="sm:max-w-[650px] p-0 border-none shadow-3xl overflow-hidden rounded-2xl z-[300]">
          <DialogHeader className="p-6 bg-slate-800 text-white flex flex-row items-center justify-between">
            <DialogTitle className="uppercase font-black text-sm flex items-center gap-3 tracking-widest"><Package className="h-5 w-5 text-primary" /> Technical Profile: {viewingRoll?.rollNo}</DialogTitle>
          </DialogHeader>
          <div className="p-8 grid grid-cols-2 md:grid-cols-3 gap-8 bg-white industrial-scroll max-h-[70vh] overflow-y-auto">
            {COLUMN_KEYS.map((item, idx) => (
              <div key={idx} className="space-y-1 group">
                <Label className="text-[9px] uppercase font-black text-slate-400 tracking-widest block transition-colors group-hover:text-primary">{item.label}</Label>
                <p className="text-xs font-black text-slate-800 tracking-tight">{viewingRoll?.[item.id] || '-'}</p>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isPrintOpen} onOpenChange={setIsPrintOpen}>
        <DialogContent className="sm:max-w-[450px] p-8 z-[300]">
          <div className="p-8 border-8 border-black text-center space-y-6 rounded-lg bg-white shadow-2xl">
            <h2 className="text-2xl font-black uppercase tracking-tighter">SHREE LABEL CREATION</h2>
            <div className="border-y-4 border-black py-4 bg-black/5">
              <p className="text-[10px] font-black uppercase mb-1">TECHNICAL REEL ID</p>
              <p className="text-5xl font-black tracking-tighter">{printingRoll?.rollNo}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-left"><p className="text-[9px] font-black uppercase opacity-50">WIDTH</p><p className="text-lg font-black">{printingRoll?.widthMm} MM</p></div>
              <div className="text-right"><p className="text-[9px] font-black uppercase opacity-50">LENGTH</p><p className="text-lg font-black">{printingRoll?.lengthMeters} MTR</p></div>
            </div>
          </div>
          <DialogFooter className="mt-6"><Button onClick={() => window.print()} className="w-full h-12 font-black uppercase tracking-widest bg-slate-900 shadow-xl"><Printer className="h-5 w-5 mr-3" /> Execute Thermal Print</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[850px] max-h-[95vh] overflow-y-auto p-0 border-none rounded-2xl shadow-3xl z-[300]">
          <form onSubmit={handleSave}>
            <DialogHeader className="p-6 bg-slate-800 text-white flex flex-row items-center justify-between">
              <DialogTitle className="uppercase font-black text-sm tracking-widest">
                {editingRoll ? `Update Registry: ${formData.rollNo}` : 'Direct Technical Stock Intake'}
              </DialogTitle>
            </DialogHeader>
            <div className="p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 bg-white">
              <div className="space-y-2"><Label className="text-[10px] uppercase font-black text-slate-500 tracking-widest">Status</Label>
                <Select value={formData.status} onValueChange={v => setFormData({...formData, status: v})}>
                  <SelectTrigger className="h-11 font-black border-2"><SelectValue /></SelectTrigger>
                  <SelectContent className="shadow-2xl z-[400]">{STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value} className="font-bold">{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label className="text-[10px] uppercase font-black text-slate-500 tracking-widest">Paper Company</Label><Input value={formData.paperCompany} onChange={e => setFormData({...formData, paperCompany: e.target.value})} className="h-11 font-bold border-2" /></div>
              <div className="space-y-2"><Label className="text-[10px] uppercase font-black text-slate-500 tracking-widest">Paper Type</Label><Input value={formData.paperType} onChange={e => setFormData({...formData, paperType: e.target.value})} className="h-11 font-bold border-2" /></div>
              <div className="space-y-2"><Label className="text-[10px] uppercase font-black text-slate-500 tracking-widest">Width (MM)</Label><Input type="number" step="0.01" value={formData.widthMm || ""} onChange={e => setFormData({...formData, widthMm: Number(e.target.value)})} required className="h-11 font-mono font-bold border-2" /></div>
              <div className="space-y-2"><Label className="text-[10px] uppercase font-black text-slate-500 tracking-widest">Length (MTR)</Label><Input type="number" step="0.01" value={formData.lengthMeters || ""} onChange={e => setFormData({...formData, lengthMeters: Number(e.target.value)})} required className="h-11 font-mono font-bold border-2" /></div>
              <div className="space-y-2 bg-primary/5 p-4 rounded-xl border-2 border-primary/20"><Label className="text-[10px] uppercase font-black text-primary tracking-widest">SQM (Auto-calc)</Label><Input value={calculatedSqm} readOnly className="h-11 bg-white font-black text-xl text-primary border-none shadow-inner" /></div>
              <div className="space-y-2"><Label className="text-[10px] uppercase font-black text-slate-500 tracking-widest">GSM</Label><Input type="number" value={formData.gsm || ""} onChange={e => setFormData({...formData, gsm: Number(e.target.value)})} required className="h-11 font-mono font-bold border-2" /></div>
              <div className="space-y-2"><Label className="text-[10px] uppercase font-black text-slate-500 tracking-widest">Weight (KG)</Label><Input type="number" step="0.01" value={formData.weightKg || ""} onChange={e => setFormData({...formData, weightKg: Number(e.target.value)})} className="h-11 font-bold border-2" /></div>
              <div className="space-y-2"><Label className="text-[10px] uppercase font-black text-slate-500 tracking-widest">Purchase Rate</Label><Input type="number" step="0.01" value={formData.purchaseRate || ""} onChange={e => setFormData({...formData, purchaseRate: Number(e.target.value)})} className="h-11 font-bold border-2" /></div>
              <div className="space-y-2"><Label className="text-[10px] uppercase font-black text-slate-500 tracking-widest">Date of Received</Label><Input type="date" value={formData.receivedDate} onChange={e => setFormData({...formData, receivedDate: e.target.value})} className="h-11 font-bold border-2" /></div>
              <div className="space-y-2"><Label className="text-[10px] uppercase font-black text-slate-500 tracking-widest">Date of Used</Label><Input type="date" value={formData.dateOfUsed} onChange={e => setFormData({...formData, dateOfUsed: e.target.value})} className="h-11 font-bold border-2" /></div>
              <div className="space-y-2"><Label className="text-[10px] uppercase font-black text-slate-500 tracking-widest">Job No</Label><Input value={formData.jobNo} onChange={e => setFormData({...formData, jobNo: e.target.value})} className="h-11 font-bold border-2" /></div>
              <div className="space-y-2"><Label className="text-[10px] uppercase font-black text-slate-500 tracking-widest">Job Size</Label><Input value={formData.jobSize} onChange={e => setFormData({...formData, jobSize: e.target.value})} className="h-11 font-bold border-2" /></div>
              <div className="space-y-2"><Label className="text-[10px] uppercase font-black text-slate-500 tracking-widest">Job Name</Label><Input value={formData.jobName} onChange={e => setFormData({...formData, jobName: e.target.value})} className="h-11 font-bold border-2" /></div>
              <div className="space-y-2"><Label className="text-[10px] uppercase font-black text-slate-500 tracking-widest">Lot No / Batch No</Label><Input value={formData.lotNo} onChange={e => setFormData({...formData, lotNo: e.target.value})} className="h-11 font-bold border-2" /></div>
              <div className="space-y-2"><Label className="text-[10px] uppercase font-black text-slate-500 tracking-widest">Company Roll No</Label><Input value={formData.companyRollNo} onChange={e => setFormData({...formData, companyRollNo: e.target.value})} className="h-11 font-bold border-2" /></div>
              <div className="space-y-2 col-span-1 md:col-span-2 lg:col-span-3"><Label className="text-[10px] uppercase font-black text-slate-500 tracking-widest">Remarks</Label><Textarea value={formData.remarks} onChange={e => setFormData({...formData, remarks: e.target.value})} className="min-h-[80px] border-2 font-medium" /></div>
            </div>
            <DialogFooter className="p-6 bg-slate-50 border-t flex gap-4"><Button type="submit" disabled={isProcessing} className="w-full h-14 uppercase font-black tracking-[0.2em] bg-slate-800 shadow-2xl hover:scale-[1.01] active:scale-[0.99] transition-all">{isProcessing ? <Loader2 className="animate-spin mr-3 h-6 w-6" /> : 'Commit Registry Entry'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
