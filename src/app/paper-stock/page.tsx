"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
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
  Calendar,
  MoreHorizontal,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Eye,
  Scissors,
  Printer,
  Info,
  CheckCircle2,
  FileDown,
  Columns as ColumnsIcon
} from "lucide-react"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
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
  updateDoc,
  getDoc
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
  { id: 'bf', label: 'BF' },
  { id: 'shade', label: 'Shade' },
  { id: 'location', label: 'Location' },
  { id: 'weightKg', label: 'Weight (KG)' },
  { id: 'purchaseRate', label: 'Purchase Rate' },
  { id: 'receivedDate', label: 'Date Received' },
  { id: 'dateOfUsed', label: 'Date Used' },
  { id: 'jobNo', label: 'Job No' },
  { id: 'jobSize', label: 'Job Size' },
  { id: 'jobName', label: 'Job Name' },
  { id: 'lotNo', label: 'Lot No' },
  { id: 'companyRollNo', label: 'Company Roll No' },
  { id: 'remarks', label: 'Remarks' },
];

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

  // Column Visibility State
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    rollNo: true,
    status: true,
    paperCompany: true,
    paperType: true,
    widthMm: true,
    lengthMeters: true,
    sqm: true,
    gsm: true,
    bf: true,
    shade: true,
    location: true,
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
    
    // Load column visibility after hydration
    const saved = localStorage.getItem('paperStockVisibleColumns')
    if (saved) {
      try {
        setVisibleColumns(prev => ({ ...prev, ...JSON.parse(saved) }))
      } catch (e) {
        console.error("Failed to load column settings", e)
      }
    }
  }, [])

  // Persist Visibility
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
    onConfirm?: () => void;
    autoClose?: boolean;
  }>({ isOpen: false, type: 'SUCCESS', title: '' });

  // Filter State
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
    location: [],
    shade: [],
    gsm: [],
    bf: [],
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
    bf: "",
    shade: "",
    location: "",
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
        const isMatch = Object.values(row).some(v => String(v || "").toLowerCase().includes(s));
        if (!isMatch) return false;
      }

      const categories = ['paperCompany', 'paperType', 'status', 'jobNo', 'jobSize', 'jobName', 'lotNo', 'companyRollNo', 'location', 'shade', 'gsm', 'bf'];
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
        bf: "", shade: "", location: "",
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
        setModal({ isOpen: true, type: 'SUCCESS', title: 'Record Updated', autoClose: true });
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
        setModal({ isOpen: true, type: 'SUCCESS', title: 'Roll Generated', autoClose: true });
      }
    } catch (error: any) {
      setModal({ isOpen: true, type: 'ERROR', title: 'Transaction Failed', description: error.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const exportStock = () => {
    if (filteredRows.length === 0) {
      toast({ title: "No Data", description: "No records found to export with current filters." })
      return
    }

    const exportData = filteredRows.map((r, i) => ({
      "Sl No": i + 1,
      "Roll No": r.rollNo,
      "Status": r.status,
      "Paper Company": r.paperCompany,
      "Paper Type": r.paperType,
      "Width (MM)": r.widthMm,
      "Length (MTR)": r.lengthMeters,
      "SQM": r.sqm,
      "GSM": r.gsm,
      "BF": r.bf || '-',
      "Shade": r.shade || '-',
      "Location": r.location || '-',
      "Weight (KG)": r.weightKg,
      "Purchase Rate": r.purchaseRate,
      "Date of Received": r.receivedDate,
      "Date of Used": r.dateOfUsed || '-',
      "Job No": r.jobNo || '-',
      "Job Size": r.jobSize || '-',
      "Job Name": r.jobName || '-',
      "Lot No / Batch No": r.lotNo || '-',
      "Company Roll No": r.companyRollNo || '-',
      "Remarks": r.remarks || '-'
    }))

    const ws = XLSX.utils.json_to_sheet(exportData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Paper Stock Registry")
    const date = new Date().toISOString().split('T')[0]
    XLSX.writeFile(wb, `Shree_Label_Stock_${date}.xlsx`)
    toast({ title: "Export Successful", description: `Downloaded ${filteredRows.length} technical records.` })
  }

  const MultiSelectFilter = ({ label, field, options }: { label: string, field: string, options: any[] }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className={cn(
          "h-9 px-3 text-[10px] gap-2 font-black uppercase tracking-tighter bg-white border-primary/10",
          filters[field]?.length > 0 && "border-primary bg-primary/5 text-primary"
        )}>
          {label}
          {filters[field]?.length > 0 && <Badge variant="secondary" className="h-4 px-1 text-[8px] bg-primary text-white">{filters[field].length}</Badge>}
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
          "cursor-pointer select-none transition-colors hover:bg-slate-100 border-b sticky top-0 bg-white shadow-[0_2px_2px_-1px_rgba(0,0,0,0.05)]", 
          isActive && "text-primary bg-primary/5", 
          className
        )} 
        onClick={() => requestSort(field)} 
        style={{ zIndex: field === 'rollNo' ? 70 : 50 }}
      >
        <div className="flex items-center justify-center gap-1 h-9">
          <span className="font-black text-[10px] uppercase leading-none">{label}</span>
          {isActive ? (
            sortConfig.direction === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
          ) : (
            <ArrowUpDown className="h-2.5 w-2.5 opacity-20" />
          )}
        </div>
      </TableHead>
    );
  };

  const getStatusRowColor = (status: string) => {
    const option = STATUS_OPTIONS.find(o => o.value === status);
    return option?.rowBg || "bg-white";
  }

  const hiddenCount = Object.values(visibleColumns).filter(v => v === false).length;

  if (!isMounted) return null;

  return (
    <div className="flex flex-col h-full space-y-4 font-sans">
      <ActionModal isOpen={modal.isOpen} onClose={() => setModal(p => ({ ...p, isOpen: false }))} {...modal} isProcessing={isProcessing} />

      <div className="bg-white p-4 rounded-2xl border shadow-sm space-y-4 px-6 shrink-0 border-primary/10">
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-primary opacity-50" />
            <Input 
              placeholder="Global Registry Search..." 
              className="pl-9 h-10 text-xs font-bold bg-slate-50/50 border-none shadow-inner" 
              value={filters.search} 
              onChange={e => setFilters({ ...filters, search: e.target.value })} 
            />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 px-3 gap-2 font-black uppercase text-[10px] border-primary/20">
                  <ColumnsIcon className="h-4 w-4" /> 
                  Columns 
                  {hiddenCount > 0 && <Badge variant="secondary" className="h-4 px-1 text-[8px] bg-accent text-white">{hiddenCount}</Badge>}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 p-2 rounded-xl shadow-2xl">
                <DropdownMenuLabel className="text-[10px] uppercase font-black">Display Controls</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <div className="max-h-[400px] overflow-y-auto">
                  {COLUMN_KEYS.map(col => (
                    <DropdownMenuCheckboxItem 
                      key={col.id} 
                      checked={visibleColumns[col.id]} 
                      onCheckedChange={v => setVisibleColumns({...visibleColumns, [col.id]: v})}
                      className="text-xs font-bold"
                    >
                      {col.label}
                    </DropdownMenuCheckboxItem>
                  ))}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button variant="outline" size="sm" onClick={exportStock} className="h-9 px-3 gap-2 font-black uppercase text-[10px] border-emerald-200 text-emerald-700 hover:bg-emerald-50">
              <FileDown className="h-4 w-4" /> Export Filtered
            </Button>

            <Button variant="ghost" size="sm" onClick={() => setFilters({
              search: "", paperCompany: [], paperType: [], status: [], jobNo: [], jobSize: [], jobName: [], lotNo: [], companyRollNo: [],
              location: [], shade: [], gsm: [], bf: [], widthMin: "", widthMax: "", lengthMin: "", lengthMax: "", sqmMin: "", sqmMax: "", gsmMin: "", gsmMax: "", weightMin: "", weightMax: "", rateMin: "", rateMax: "",
              receivedFrom: "", receivedTo: "", usedFrom: "", usedTo: ""
            })} className="text-[10px] font-black uppercase text-destructive tracking-widest"><FilterX className="h-4 w-4 mr-1.5" /> Reset</Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-50">
          <MultiSelectFilter label="Status" field="status" options={STATUS_OPTIONS.map(o => o.value)} />
          <MultiSelectFilter label="Company" field="paperCompany" options={getUniqueOptions('paperCompany')} />
          <MultiSelectFilter label="Material Type" field="paperType" options={getUniqueOptions('paperType')} />
          <MultiSelectFilter label="Job No" field="jobNo" options={getUniqueOptions('jobNo')} />
          <MultiSelectFilter label="Job Name" field="jobName" options={getUniqueOptions('jobName')} />
          <MultiSelectFilter label="Lot No" field="lotNo" options={getUniqueOptions('lotNo')} />
          <MultiSelectFilter label="GSM" field="gsm" options={getUniqueOptions('gsm')} />
          <MultiSelectFilter label="BF" field="bf" options={getUniqueOptions('bf')} />
          <MultiSelectFilter label="Shade" field="shade" options={getUniqueOptions('shade')} />
          <MultiSelectFilter label="Location" field="location" options={getUniqueOptions('location')} />
        </div>
      </div>

      <div className="bg-primary text-white p-2.5 flex items-center justify-between shrink-0 px-6 rounded-t-2xl shadow-lg">
        <h2 className="font-black text-sm uppercase tracking-widest flex items-center gap-2"><LayoutGrid className="h-5 w-5" /> Technical Stock Registry</h2>
        <Button variant="ghost" size="icon" className="h-9 w-9 text-white hover:bg-white/20 rounded-full" onClick={() => handleOpenDialog()}><Plus className="h-5 w-5" /></Button>
      </div>

      <Card className="flex-1 overflow-hidden flex flex-col border-none shadow-2xl bg-white rounded-b-2xl">
        <div className="w-full h-[600px] overflow-auto relative border-t industrial-scroll table-container">
          <Table className="border-separate border-spacing-0 min-w-[2800px]">
            <TableHeader className="sticky top-0 z-[100] bg-white">
              <TableRow className="h-9 bg-white">
                <TableHead className="w-[50px] text-center border-r border-b sticky top-0 left-0 bg-white z-[65] p-0 shadow-[2px_2px_5px_rgba(0,0,0,0.05)]">
                  <Checkbox checked={paginatedRows.length > 0 && paginatedRows.every(r => selectedIds.has(r.id))} onCheckedChange={(val) => { const next = new Set(selectedIds); paginatedRows.forEach(r => val ? next.add(r.id) : next.delete(r.id)); setSelectedIds(next); }} />
                </TableHead>
                <TableHead className="w-[60px] text-center font-black text-[10px] uppercase border-r border-b sticky top-0 left-[50px] bg-white z-[65] p-0 shadow-[2px_2px_5px_rgba(0,0,0,0.05)]">Sl No</TableHead>
                <SortableHeader label="Roll No" field="rollNo" className="w-[120px] border-r sticky top-0 left-[110px] bg-white z-[65] shadow-[2px_2px_5px_rgba(0,0,0,0.05)]" />
                <SortableHeader label="Status" field="status" className="w-[140px] border-r" />
                <SortableHeader label="Paper Company" field="paperCompany" className="border-r" />
                <SortableHeader label="Paper Type" field="paperType" className="border-r" />
                <SortableHeader label="Width (MM)" field="widthMm" className="border-r" />
                <SortableHeader label="Length (MTR)" field="lengthMeters" className="border-r" />
                <SortableHeader label="SQM" field="sqm" className="border-r" />
                <SortableHeader label="GSM" field="gsm" className="border-r" />
                <SortableHeader label="BF" field="bf" className="border-r" />
                <SortableHeader label="Shade" field="shade" className="border-r" />
                <SortableHeader label="Location" field="location" className="border-r" />
                <SortableHeader label="Weight (KG)" field="weightKg" className="border-r" />
                <SortableHeader label="Received Date" field="receivedDate" className="border-r" />
                <SortableHeader label="Job No" field="jobNo" className="border-r" />
                <SortableHeader label="Job Name" field="jobName" className="border-r" />
                <SortableHeader label="Lot No" field="lotNo" className="border-r" />
                <TableHead className="text-center font-black text-[10px] uppercase sticky top-0 right-0 bg-white z-[65] border-l border-b shadow-[-2px_2px_10px_rgba(0,0,0,0.05)] w-[220px] p-0">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {itemsLoading ? (
                <TableRow><TableCell colSpan={25} className="text-center py-20"><Loader2 className="animate-spin mx-auto text-primary h-10 w-10" /></TableCell></TableRow>
              ) : paginatedRows.map((j, i) => {
                const rowColorClass = getStatusRowColor(j.status);
                return (
                  <TableRow key={j.id} className={cn("transition-all border-b h-8 group", rowColorClass, selectedIds.has(j.id) && "brightness-95")}>
                    <TableCell className={cn("text-center border-r sticky left-0 z-20 transition-all group-hover:brightness-90 p-0 shadow-[2px_0_5px_rgba(0,0,0,0.05)]", rowColorClass)}>
                      <Checkbox checked={selectedIds.has(j.id)} onCheckedChange={(val) => { const next = new Set(selectedIds); val ? next.add(j.id) : next.delete(j.id); setSelectedIds(next); }} />
                    </TableCell>
                    <TableCell className={cn("text-center font-bold text-[11px] text-slate-400 border-r sticky left-[50px] z-20 transition-all group-hover:brightness-90 p-0 shadow-[2px_0_5px_rgba(0,0,0,0.05)]", rowColorClass)}>{(currentPage - 1) * rowsPerPage + i + 1}</TableCell>
                    <TableCell className={cn("font-black text-[12px] text-primary border-r text-center font-mono sticky left-[110px] z-20 transition-all group-hover:brightness-90 p-0 shadow-[2px_0_5px_rgba(0,0,0,0.05)]", rowColorClass)}>{j.rollNo}</TableCell>
                    <TableCell className="text-center border-r p-0"><Badge className={cn("text-[8px] font-black uppercase h-4 px-1.5 leading-none", STATUS_OPTIONS.find(o => o.value === j.status)?.color || "bg-slate-500")}>{j.status || "Available"}</Badge></TableCell>
                    {visibleColumns['paperCompany'] && <TableCell className="text-[12px] border-r uppercase font-bold text-center px-2 truncate max-w-[150px]">{j.paperCompany}</TableCell>}
                    {visibleColumns['paperType'] && <TableCell className="text-[12px] border-r font-medium text-center px-2 truncate max-w-[150px]">{j.paperType}</TableCell>}
                    {visibleColumns['widthMm'] && <TableCell className="text-center text-[12px] border-r font-mono font-bold px-2">{j.widthMm}</TableCell>}
                    {visibleColumns['lengthMeters'] && <TableCell className="text-center text-[12px] border-r font-mono font-bold px-2">{j.lengthMeters}</TableCell>}
                    {visibleColumns['sqm'] && <TableCell className="text-center text-[12px] border-r font-black text-primary font-mono px-2">{j.sqm}</TableCell>}
                    {visibleColumns['gsm'] && <TableCell className="text-center text-[12px] border-r font-mono px-2">{j.gsm}</TableCell>}
                    {visibleColumns['bf'] && <TableCell className="text-center text-[12px] border-r font-mono px-2">{j.bf || '-'}</TableCell>}
                    {visibleColumns['shade'] && <TableCell className="text-center text-[12px] border-r font-medium px-2">{j.shade || '-'}</TableCell>}
                    {visibleColumns['location'] && <TableCell className="text-center text-[12px] border-r font-bold px-2 text-blue-600">{j.location || '-'}</TableCell>}
                    {visibleColumns['weightKg'] && <TableCell className="text-center text-[12px] border-r font-mono px-2 text-right">{j.weightKg || 0}</TableCell>}
                    {visibleColumns['receivedDate'] && <TableCell className="text-center text-[12px] border-r px-2">{j.receivedDate}</TableCell>}
                    {visibleColumns['jobNo'] && <TableCell className="text-center text-[12px] border-r font-mono font-bold px-2">{j.jobNo || '-'}</TableCell>}
                    {visibleColumns['jobName'] && <TableCell className="text-center text-[12px] border-r truncate max-w-[150px] font-medium px-2">{j.jobName || '-'}</TableCell>}
                    {visibleColumns['lotNo'] && <TableCell className="text-center text-[12px] border-r font-mono px-2">{j.lotNo || '-'}</TableCell>}
                    <TableCell className={cn("text-center sticky right-0 z-20 border-l px-1 shadow-[-4px_0_10px_rgba(0,0,0,0.05)] w-[220px] transition-all group-hover:brightness-90 p-0", rowColorClass)}>
                      <div className="flex items-center justify-center gap-1.5">
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-500" onClick={() => { setViewingRoll(j); setIsViewOpen(true); }}><Eye className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-blue-500" onClick={() => handleOpenDialog(j)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-orange-500" onClick={() => router.push(`/inventory/slitting?rollId=${j.id}`)}><Scissors className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-700" onClick={() => { setPrintingRoll(j); setIsPrintOpen(true); }}><Printer className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500" onClick={() => { if(confirm('Delete roll?')) deleteDoc(doc(firestore!, 'paper_stock', j.id)); }}><Trash2 className="h-3.5 w-3.5" /></Button>
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
              <SelectTrigger className="h-8 w-[100px] bg-white text-[10px] font-black uppercase"><SelectValue /></Trigger>
              <SelectContent>{[10, 20, 50, 100].map(v => <SelectItem key={v} value={v.toString()}>{v} Rows</SelectItem>)}</SelectContent>
            </Select>
            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Showing {startRange}–{endRange} of {filteredRows.length} Rolls</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8 px-3 text-[10px] font-black uppercase" onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1}><ChevronLeft className="h-4 w-4 mr-1" /> Prev</Button>
            <span className="text-xs font-black bg-primary text-white h-8 px-4 flex items-center justify-center rounded-md">{currentPage} / {totalPages || 1}</span>
            <Button variant="outline" size="sm" className="h-8 px-3 text-[10px] font-black uppercase" onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage >= totalPages}>Next <ChevronRight className="h-4 w-4 ml-1" /></Button>
          </div>
        </div>
      </Card>

      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="sm:max-w-[700px] p-0 border-none rounded-2xl shadow-3xl">
          <DialogHeader className="p-6 bg-slate-50 border-b">
            <DialogTitle className="uppercase font-black text-xl flex items-center gap-2 text-primary"><Package className="h-6 w-6" /> Roll Info: {viewingRoll?.rollNo}</DialogTitle>
          </DialogHeader>
          <div className="p-8 grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-6 bg-white">
            {[
              { label: "Company", value: viewingRoll?.paperCompany },
              { label: "Material", value: viewingRoll?.paperType },
              { label: "Width (MM)", value: viewingRoll?.widthMm, mono: true },
              { label: "Length (MTR)", value: viewingRoll?.lengthMeters, mono: true },
              { label: "SQM", value: viewingRoll?.sqm, highlight: true },
              { label: "GSM", value: viewingRoll?.gsm },
              { label: "Location", value: viewingRoll?.location || '-' },
              { label: "BF", value: viewingRoll?.bf || '-' },
              { label: "Shade", value: viewingRoll?.shade || '-' }
            ].map((item, idx) => (
              <div key={idx} className="space-y-1">
                <Label className="text-[10px] uppercase font-black text-slate-400">{item.label}</Label>
                <p className={cn("text-sm font-bold", item.highlight && "text-primary font-black")}>{item.value}</p>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isPrintOpen} onOpenChange={setIsPrintOpen}>
        <DialogContent className="sm:max-w-[400px] p-0 border-none rounded-2xl shadow-3xl">
          <div className="bg-white p-10 font-sans text-black" id="printable-label">
            <div className="border-4 border-black p-6 space-y-6">
              <h2 className="text-2xl font-black uppercase text-center pb-4 border-b-2 border-black">SHREE LABEL</h2>
              <div>
                <p className="text-[9px] font-bold uppercase">Roll ID</p>
                <p className="text-3xl font-black leading-none">{printingRoll?.rollNo}</p>
              </div>
              <div className="grid grid-cols-2 gap-4 border-t-2 border-black pt-4">
                <div><p className="text-[9px] font-bold uppercase">Width</p><p className="text-xl font-black">{printingRoll?.widthMm} mm</p></div>
                <div><p className="text-[9px] font-bold uppercase">Length</p><p className="text-xl font-black">{printingRoll?.lengthMeters} m</p></div>
              </div>
            </div>
          </div>
          <DialogFooter className="p-6 bg-slate-50 border-t"><Button onClick={() => window.print()} className="w-full h-12 font-black uppercase bg-primary text-white">Print Technical Tag</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[850px] max-h-[95vh] overflow-y-auto p-0 border-none rounded-2xl shadow-3xl">
          <form onSubmit={handleSave}>
            <DialogHeader className="p-6 bg-primary text-white">
              <DialogTitle className="uppercase font-black text-xl">{editingRoll ? `Update Roll: ${formData.rollNo}` : 'New Roll Intake'}</DialogTitle>
            </DialogHeader>
            <div className="p-8 grid grid-cols-2 gap-x-8 gap-y-6 bg-white">
              <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black text-slate-500">Roll Status</Label>
                <Select value={formData.status} onValueChange={v => setFormData({...formData, status: v})}>
                  <SelectTrigger className="h-11 font-bold border-2"><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black text-slate-500">Paper Company</Label><Input value={formData.paperCompany} onChange={e => setFormData({...formData, paperCompany: e.target.value})} className="h-11 border-2" /></div>
              <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black text-slate-500">Paper Type</Label><Input value={formData.paperType} onChange={e => setFormData({...formData, paperType: e.target.value})} className="h-11 border-2" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black text-slate-500">Width (MM)</Label><Input type="number" step="0.01" value={formData.widthMm || ""} onChange={e => setFormData({...formData, widthMm: Number(e.target.value)})} required className="h-11 font-black" /></div>
                <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black text-slate-500">Length (MTR)</Label><Input type="number" step="0.01" value={formData.lengthMeters || ""} onChange={e => setFormData({...formData, lengthMeters: Number(e.target.value)})} required className="h-11 font-black" /></div>
              </div>
              <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black text-primary">SQM (Auto)</Label><Input value={calculatedSqm} readOnly className="h-11 font-black bg-primary/5 text-primary border-primary/20 text-xl" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black text-slate-500">GSM</Label><Input type="number" value={formData.gsm || ""} onChange={e => setFormData({...formData, gsm: Number(e.target.value)})} required className="h-11" /></div>
                <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black text-slate-500">Location</Label><Input value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} className="h-11" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black text-slate-500">BF</Label><Input value={formData.bf} onChange={e => setFormData({...formData, bf: e.target.value})} className="h-11" /></div>
                <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black text-slate-500">Shade</Label><Input value={formData.shade} onChange={e => setFormData({...formData, shade: e.target.value})} className="h-11" /></div>
              </div>
              <div className="space-y-1.5 col-span-2"><Label className="text-[10px] uppercase font-black text-slate-500">Remarks</Label><Textarea value={formData.remarks} onChange={e => setFormData({...formData, remarks: e.target.value})} className="min-h-[60px]" /></div>
            </div>
            <DialogFooter className="p-6 bg-slate-50 border-t rounded-b-2xl"><Button type="submit" disabled={isProcessing} className="w-full h-16 uppercase font-black text-xl bg-primary shadow-2xl rounded-xl">{isProcessing ? <Loader2 className="animate-spin mr-2" /> : 'Commit Technical Entry'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
