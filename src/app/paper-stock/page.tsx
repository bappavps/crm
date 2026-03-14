
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
  Eye,
  Scissors,
  Printer,
  FileDown,
  Columns as ColumnsIcon,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  History,
  FileSpreadsheet,
  AlertTriangle,
  MoreHorizontal,
  Calendar,
  CheckCircle2,
  Info,
  QrCode,
  Barcode as BarcodeIcon,
  Hash,
  Building2,
  FileText,
  Ruler,
  ArrowRightLeft,
  Layers,
  Weight,
  Scale,
  CircleDollarSign,
  Tag,
  Maximize2,
  MessageSquare,
  X,
  Camera
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
  SelectSeparator
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
  setDoc,
  writeBatch
} from "firebase/firestore"
import { cn } from "@/lib/utils"
import { usePermissions } from "@/components/auth/permission-context"
import { ActionModal, ModalType } from "@/components/action-modal"
import * as XLSX from 'xlsx'
import { QRCodeSVG } from 'qrcode.react'
import Barcode from 'react-barcode'
import { Html5QrcodeScanner } from "html5-qrcode"

const STATUS_OPTIONS = [
  { value: "Main", label: "Main", color: "bg-purple-600", rowBg: "bg-purple-100" },
  { value: "Stock", label: "Stock", color: "bg-emerald-600", rowBg: "bg-emerald-100" },
  { value: "Slitting", label: "Slitting", color: "bg-orange-500", rowBg: "bg-orange-100" },
  { value: "Job Assign", label: "Job Assign", color: "bg-rose-500", rowBg: "bg-rose-100" },
  { value: "In Production", label: "In Production", color: "bg-cyan-500", rowBg: "bg-cyan-100" },
];

const COLUMN_KEYS = [
  { id: 'rollNo', label: 'Roll No' },
  { id: 'status', label: 'Status' },
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

type SortDirection = 'asc' | 'desc' | null;

interface SortConfig {
  key: string;
  direction: SortDirection;
}

export default function PaperStockPage() {
  const { user } = useUser()
  const router = useRouter()
  const firestore = useFirestore()
  
  const [isMounted, setIsMounted] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isViewOpen, setIsViewOpen] = useState(false)
  const [isPrintOpen, setIsPrintOpen] = useState(false)
  const [isScannerOpen, setIsScannerOpen] = useState(false)
  
  const [editingRoll, setEditingRoll] = useState<any>(null)
  const [viewingRoll, setViewingRoll] = useState<any>(null)
  const [printingRoll, setPrintingRoll] = useState<any>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  
  const [currentPage, setCurrentPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(50) 
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'rollNo', direction: 'desc' })
  const [highlightedId, setHighlightedId] = useState<string | null>(null)
  const [isCustomStatus, setIsCustomStatus] = useState(false)

  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    rollNo: true, status: true, paperCompany: true, paperType: true, widthMm: true, lengthMeters: true,
    sqm: true, gsm: true, weightKg: true, purchaseRate: true, receivedDate: true, dateOfUsed: true,
    jobNo: true, jobSize: true, jobName: true, lotNo: true, companyRollNo: true, remarks: true
  })

  useEffect(() => { 
    setIsMounted(true);
    const saved = localStorage.getItem('paperStockVisibleColumns')
    if (saved) {
      try { setVisibleColumns(prev => ({ ...prev, ...JSON.parse(saved) })) } catch (e) {}
    }
  }, [])

  useEffect(() => {
    if (isMounted) localStorage.setItem('paperStockVisibleColumns', JSON.stringify(visibleColumns))
  }, [visibleColumns, isMounted])

  useEffect(() => {
    if (highlightedId && isMounted) {
      const el = document.getElementById(`row-${highlightedId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => setHighlightedId(null), 5000);
      }
    }
  }, [highlightedId, isMounted]);

  const [modal, setModal] = useState<{ isOpen: boolean; type: ModalType; title: string; description?: string; }>({ isOpen: false, type: 'SUCCESS', title: '' });

  const [filters, setFilters] = useState<any>({
    search: "", paperCompany: [], paperType: [], status: [], jobNo: [], jobSize: [], jobName: [], lotNo: [], companyRollNo: [],
    widthMin: "", widthMax: "", lengthMin: "", lengthMax: "", sqmMin: "", sqmMax: "", gsmMin: "", gsmMax: "", weightMin: "", weightMax: "",
    rateMin: "", rateMax: "", receivedFrom: "", receivedTo: "", usedFrom: "", usedTo: ""
  })

  const [formData, setFormData] = useState({
    rollNo: "", paperCompany: "", paperType: "", status: "Main", widthMm: 0, lengthMeters: 0, sqm: 0, gsm: 0, weightKg: 0,
    purchaseRate: 0, receivedDate: "", dateOfUsed: "", jobNo: "", jobSize: "", jobName: "", lotNo: "", companyRollNo: "", remarks: ""
  })

  const registryQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'paper_stock'), limit(1000));
  }, [firestore]);

  const { data: rolls, isLoading: itemsLoading } = useCollection(registryQuery);

  const getUniqueOptions = (key: string) => {
    if (!rolls) return [];
    return Array.from(new Set(rolls.map(r => String(r[key] || "")).filter(v => v !== ""))).sort();
  }

  const calculatedSqm = useMemo(() => {
    const w = Number(formData.widthMm) || 0;
    const l = Number(formData.lengthMeters) || 0;
    return Number(((w / 1000) * l).toFixed(2));
  }, [formData.widthMm, formData.lengthMeters]);

  const requestSort = (key: string) => {
    let direction: SortDirection = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    else if (sortConfig.key === key && sortConfig.direction === 'desc') direction = null;
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
      return true;
    });

    if (sortConfig.key && sortConfig.direction) {
      result.sort((a, b) => {
        const key = sortConfig.key;
        let valA = a[key]; let valB = b[key];
        if (['widthMm', 'lengthMeters', 'sqm', 'gsm', 'weightKg', 'purchaseRate'].includes(key)) {
          valA = Number(valA || 0); valB = Number(valB || 0);
          return sortConfig.direction === 'asc' ? valA - valB : valB - valA;
        }
        valA = String(valA || "").toLowerCase(); valB = String(valB || "").toLowerCase();
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [rolls, filters, sortConfig]);

  const totalPages = Math.ceil(filteredRows.length / rowsPerPage);
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredRows.slice(start, start + rowsPerPage);
  }, [filteredRows, currentPage, rowsPerPage]);

  const handleOpenDialog = (roll?: any) => {
    if (roll) {
      setEditingRoll(roll);
      setFormData({ ...formData, ...roll });
      setIsCustomStatus(!STATUS_OPTIONS.some(o => o.value === roll.status));
    } else {
      let nextRollNo = "T-1001";
      if (rolls && rolls.length > 0) {
        let maxNum = -1; let bestPrefix = "T-";
        rolls.forEach(r => {
          const match = String(r.rollNo || "").match(/^(.*?)(\d+)$/);
          if (match) {
            const num = parseInt(match[2], 10);
            if (num > maxNum) { maxNum = num; bestPrefix = match[1]; }
          }
        });
        if (maxNum !== -1) nextRollNo = `${bestPrefix}${(maxNum + 1).toString()}`;
      }
      setEditingRoll(null);
      setIsCustomStatus(false);
      setFormData({
        rollNo: nextRollNo, paperCompany: "", paperType: "", status: "Main", widthMm: 0, lengthMeters: 0, sqm: 0,
        gsm: 0, weightKg: 0, purchaseRate: 0, receivedDate: new Date().toISOString().split('T')[0],
        dateOfUsed: "", jobNo: "", jobSize: "", jobName: "", lotNo: "", companyRollNo: "", remarks: ""
      });
    }
    setIsDialogOpen(true);
  }

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firestore || !user || isProcessing) return;
    setIsProcessing(true);
    
    const rollId = formData.rollNo.trim();
    const finalData = { 
      ...formData, 
      rollNo: rollId,
      sqm: calculatedSqm, 
      updatedAt: serverTimestamp(), 
      updatedById: user.uid 
    };

    try {
      if (editingRoll) {
        if (editingRoll.id !== rollId) {
          await runTransaction(firestore, async (transaction) => {
            const oldRef = doc(firestore, 'paper_stock', editingRoll.id);
            const newRef = doc(firestore, 'paper_stock', rollId);
            const checkSnap = await transaction.get(newRef);
            if (checkSnap.exists()) throw new Error(`Roll No ${rollId} already exists.`);
            transaction.delete(oldRef);
            transaction.set(newRef, { ...finalData, id: rollId, createdAt: editingRoll.createdAt || serverTimestamp() });
          });
        } else {
          await setDoc(doc(firestore, 'paper_stock', editingRoll.id), finalData, { merge: true });
        }
        setIsDialogOpen(false); 
        setModal({ isOpen: true, type: 'SUCCESS', title: 'Record Updated' });
      } else {
        await runTransaction(firestore, async (transaction) => {
          const newDocRef = doc(firestore, 'paper_stock', rollId);
          const checkSnap = await transaction.get(newDocRef);
          if (checkSnap.exists()) throw new Error(`Roll No ${rollId} already exists.`);
          transaction.set(newDocRef, { ...finalData, id: rollId, createdAt: serverTimestamp(), createdById: user.uid });
        });
        setIsDialogOpen(false); 
        setModal({ isOpen: true, type: 'SUCCESS', title: 'Roll Generated' });
      }
    } catch (error: any) { 
      setModal({ isOpen: true, type: 'ERROR', title: 'Operation Failed', description: error.message }); 
    } finally { 
      setIsProcessing(false); 
    }
  };

  const startScanner = () => {
    setIsScannerOpen(true);
    setTimeout(() => {
      const scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: 250 }, false);
      scanner.render((decodedText) => {
        const rollId = decodedText;
        const match = rolls?.find(r => r.rollNo === rollId);
        if (match) {
          setHighlightedId(match.id);
          setViewingRoll(match);
          setIsViewOpen(true);
          scanner.clear();
          setIsScannerOpen(false);
        }
      }, (error) => {});
    }, 500);
  };

  const MultiSelectFilter = ({ label, field, options }: { label: string, field: string, options: any[] }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className={cn(
          "h-10 px-4 text-[11px] gap-2 font-black uppercase border-slate-200 bg-white tracking-widest transition-all hover:bg-slate-50",
          filters[field]?.length > 0 && "border-primary bg-primary/5 text-primary shadow-sm"
        )}>
          {label}
          {filters[field]?.length > 0 && <Badge className="h-4 px-1.5 text-[9px] bg-primary text-white">{filters[field].length}</Badge>}
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64 max-h-[400px] overflow-y-auto p-2 shadow-2xl z-[100]">
        <DropdownMenuLabel className="text-[10px] uppercase font-black opacity-50 pb-2">{label}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {options.map(opt => (
          <DropdownMenuCheckboxItem 
            key={opt} checked={filters[field]?.includes(String(opt))} 
            onCheckedChange={() => {
              const current = filters[field] || [];
              const next = current.includes(String(opt)) ? current.filter((v: any) => v !== String(opt)) : [...current, String(opt)];
              setFilters({ ...filters, [field]: next }); setCurrentPage(1);
            }} 
            className="text-xs font-bold py-2"
          >{String(opt)}</DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const SortableHeader = ({ label, field, className = "" }: { label: string, field: string, className?: string }) => {
    if (!visibleColumns[field]) return null;
    const isActive = sortConfig.key === field;
    return (
      <TableHead className={cn("cursor-pointer select-none transition-colors hover:bg-slate-200 border-r border-b sticky top-0 bg-slate-100 p-0 h-10 z-[30] text-center", isActive && "bg-slate-200", className)} onClick={() => requestSort(field)}>
        <div className="flex items-center justify-center gap-1.5 px-2">
          <span className="font-black text-[11px] uppercase text-slate-700 tracking-tighter">{label}</span>
          {isActive ? (sortConfig.direction === 'asc' ? <ArrowUp className="h-3 w-3 text-primary" /> : <ArrowDown className="h-3 w-3 text-primary" />) : <ArrowUpDown className="h-2.5 w-2.5 opacity-30" />}
        </div>
      </TableHead>
    );
  };

  return (
    <div className="flex flex-col h-full space-y-4 font-sans animate-in fade-in duration-500 pb-20">
      <ActionModal isOpen={modal.isOpen} onClose={() => setModal(p => ({ ...p, isOpen: false }))} {...modal} />

      <div className="bg-white p-6 rounded-2xl border shadow-sm space-y-6 shrink-0 border-slate-200">
        <div className="flex items-center gap-6">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input placeholder="Search Roll ID, Company, Job..." className="pl-10 h-10 text-xs bg-slate-50 border-slate-200 font-bold rounded-xl" value={filters.search} onChange={e => setFilters({ ...filters, search: e.target.value })} />
          </div>
          <div className="ml-auto flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={startScanner} className="h-10 px-4 gap-2 font-black uppercase text-[10px] tracking-widest border-2 rounded-xl border-indigo-200 text-indigo-700 hover:bg-indigo-50">
              <QrCode className="h-4 w-4" /> Scan Roll QR
            </Button>
            {selectedIds.size > 0 && (
              <Button variant="destructive" size="sm" onClick={() => { if(confirm(`Delete ${selectedIds.size}?`)) { const batch = writeBatch(firestore!); selectedIds.forEach(id => batch.delete(doc(firestore!, 'paper_stock', id))); batch.commit(); setSelectedIds(new Set()); }}} className="h-10 px-4 gap-2 font-black uppercase text-[10px] tracking-widest rounded-xl shadow-lg">
                <Trash2 className="h-4 w-4" /> Delete {selectedIds.size} Selected
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-10 px-4 gap-2 font-black uppercase text-[10px] tracking-widest border-2 rounded-xl">
                  <ColumnsIcon className="h-4 w-4 text-primary" /> Column Toggle ({Object.values(visibleColumns).filter(Boolean).length}/18)
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 p-3 shadow-2xl z-[100] rounded-xl border-none">
                <DropdownMenuLabel className="text-[10px] uppercase font-black opacity-50 mb-2">Toggle Visibility</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <div className="max-h-[400px] overflow-y-auto industrial-scroll">
                  {COLUMN_KEYS.map(col => (
                    <DropdownMenuCheckboxItem key={col.id} checked={visibleColumns[col.id]} onCheckedChange={v => setVisibleColumns({...visibleColumns, [col.id]: v})} className="text-xs font-bold py-2">{col.label}</DropdownMenuCheckboxItem>
                  ))}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" size="sm" onClick={() => { 
              const formatted = filteredRows.map(r => ({
                "RELL NO": r.rollNo,
                "PAPER COMPANY": r.paperCompany,
                "PAPER TYPE": r.paperType,
                "WIDTH (MM)": r.widthMm,
                "LENGTH (MTR)": r.lengthMeters,
                "SQM": r.sqm,
                "GSM": r.gsm,
                "WEIGHT(KG)": r.weightKg,
                "Purchase Rate": r.purchaseRate,
                "DATE OF RECEIVED": r.receivedDate,
                "DATE OF USE": r.dateOfUsed || "",
                "Job no": r.jobNo || "",
                "SIZE": r.jobSize || "",
                "PRODUCT NAME": r.jobName || "",
                "Lot no/BATCH NO": r.lotNo || "",
                "Company Rell no": r.companyRollNo || "",
                "STATUS": r.status,
                "REMARKS": r.remarks || ""
              }));
              const ws = XLSX.utils.json_to_sheet(formatted);
              const wb = XLSX.utils.book_new();
              XLSX.utils.book_append_sheet(wb, ws, "Master Stock");
              XLSX.writeFile(wb, `Shree_Label_Stock_${new Date().toISOString().split('T')[0]}.xlsx`);
            }} className="h-10 px-4 gap-2 font-black uppercase text-[10px] tracking-widest border-2 rounded-xl hover:bg-emerald-50 text-emerald-700">
              <FileDown className="h-4 w-4" /> Export Stock
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { setFilters({ search: "", paperCompany: [], paperType: [], status: [], jobNo: [], jobSize: [], jobName: [], lotNo: [], companyRollNo: [] }); setSortConfig({ key: 'rollNo', direction: 'desc' }); setCurrentPage(1); }} className="text-[10px] font-black uppercase text-destructive tracking-widest h-10 px-4"><FilterX className="h-4 w-4 mr-1.5" /> Reset All</Button>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 pb-1 overflow-x-auto no-scrollbar">
          <MultiSelectFilter label="STATUS" field="status" options={STATUS_OPTIONS.map(o => o.value)} />
          <MultiSelectFilter label="COMPANY" field="paperCompany" options={getUniqueOptions('paperCompany')} />
          <MultiSelectFilter label="TYPE" field="paperType" options={getUniqueOptions('paperType')} />
          <MultiSelectFilter label="JOB ID" field="jobNo" options={getUniqueOptions('jobNo')} />
          <MultiSelectFilter label="LOT NO" field="lotNo" options={getUniqueOptions('lotNo')} />
          <div className="h-6 w-px bg-slate-200 mx-2" />
          <div className="flex items-center gap-2 group">
            <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Status Board:</span>
            {STATUS_OPTIONS.map(opt => (
              <div key={opt.value} className="flex items-center gap-1.5"><div className={cn("w-2.5 h-2.5 rounded-sm shadow-sm", opt.color)} /><span className="text-[10px] font-bold text-slate-600 uppercase">{opt.label}</span></div>
            ))}
          </div>
        </div>
      </div>

      <Card className="flex-1 overflow-hidden flex flex-col border-slate-200 shadow-2xl rounded-2xl bg-white border-none">
        <div className="bg-slate-900 text-white p-4 px-8 flex items-center justify-between shrink-0">
          <h2 className="font-black text-xs uppercase tracking-[0.25em] flex items-center gap-3">
            <LayoutGrid className="h-5 w-5 text-primary" /> Paper Stock Details
          </h2>
          <Button variant="secondary" size="sm" className="h-9 px-6 bg-primary hover:bg-primary/90 text-white font-black uppercase text-[10px] tracking-widest rounded-xl shadow-lg border-none" onClick={() => handleOpenDialog()}>
            <Plus className="h-4 w-4 mr-2" /> Add Roll
          </Button>
        </div>

        <div className="w-full h-[600px] overflow-scroll relative border-t industrial-scroll">
          <Table className="border-separate border-spacing-0 min-w-[2800px]">
            <TableHeader className="sticky top-0 z-[30] bg-white">
              <TableRow className="h-12">
                <TableHead className="w-[40px] text-center border-r border-b sticky top-0 left-0 bg-slate-100 z-[40] p-0 shadow-[2px_0_5px_rgba(0,0,0,0.1)]">
                  <div className="flex items-center justify-center h-full">
                    <Checkbox checked={paginatedRows.length > 0 && paginatedRows.every(r => selectedIds.has(r.id))} onCheckedChange={(val) => { const next = new Set(selectedIds); paginatedRows.forEach(r => val ? next.add(r.id) : next.delete(r.id)); setSelectedIds(next); }} />
                  </div>
                </TableHead>
                <TableHead className="w-[60px] text-center font-bold text-[11px] uppercase border-r border-b sticky top-0 left-[40px] bg-slate-100 z-[40] p-0 shadow-[2px_0_5px_rgba(0,0,0,0.1)]">Sl No</TableHead>
                <SortableHeader label="Roll No" field="rollNo" className="w-[120px] border-r sticky top-0 left-[100px] bg-slate-100 z-[40] shadow-[2px_0_5px_rgba(0,0,0,0.1)]" />
                <SortableHeader label="Status" field="status" className="w-[120px]" />
                <SortableHeader label="Paper Company" field="paperCompany" />
                <SortableHeader label="Paper Type" field="paperType" />
                <SortableHeader label="Width (MM)" field="widthMm" />
                <SortableHeader label="Length (MTR)" field="lengthMeters" />
                <SortableHeader label="SQM" field="sqm" />
                <SortableHeader label="GSM" field="gsm" />
                <SortableHeader label="Weight (KG)" field="weightKg" />
                <SortableHeader label="Purchase Rate" field="purchaseRate" />
                <SortableHeader label="Date Received" field="receivedDate" />
                <SortableHeader label="Date Used" field="dateOfUsed" />
                <SortableHeader label="Job No" field="jobNo" />
                <SortableHeader label="Job Size" field="jobSize" />
                <SortableHeader label="Job Name" field="jobName" />
                <SortableHeader label="Lot No" field="lotNo" />
                <SortableHeader label="Remarks" field="remarks" />
                <TableHead className="text-center font-bold text-[11px] uppercase sticky top-0 right-0 bg-slate-100 z-[40] border-l border-b shadow-[-2px_0_5px_rgba(0,0,0,0.1)] w-[200px] p-0">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {itemsLoading ? (
                <TableRow><TableCell colSpan={25} className="text-center py-20"><Loader2 className="animate-spin mx-auto text-primary h-10 w-10" /></TableCell></TableRow>
              ) : paginatedRows.map((j, i) => {
                const statusInfo = STATUS_OPTIONS.find(o => o.value === j.status) || { color: "bg-slate-500", rowBg: "bg-slate-50" };
                const isHighlighted = highlightedId === j.id;
                return (
                  <TableRow 
                    id={`row-${j.id}`} 
                    key={j.id} 
                    onDoubleClick={() => handleOpenDialog(j)}
                    className={cn("h-12 group transition-all text-center cursor-pointer select-none", statusInfo.rowBg, isHighlighted && "bg-yellow-200 animate-pulse ring-2 ring-yellow-400 z-20")}
                  >
                    <TableCell className={cn("text-center border-r border-b sticky left-0 z-10 p-0 shadow-[2px_0_5px_rgba(0,0,0,0.05)]", statusInfo.rowBg, isHighlighted && "bg-yellow-200")}>
                      <Checkbox checked={selectedIds.has(j.id)} onCheckedChange={(val) => { const next = new Set(selectedIds); val ? next.add(j.id) : next.delete(j.id); setSelectedIds(next); }} />
                    </TableCell>
                    <TableCell className={cn("text-center font-black text-[12px] text-slate-400 border-r border-b sticky left-[40px] z-10 p-0 shadow-[2px_0_5px_rgba(0,0,0,0.05)]", statusInfo.rowBg, isHighlighted && "bg-yellow-200")}>{(currentPage - 1) * rowsPerPage + i + 1}</TableCell>
                    <TableCell className={cn("font-black text-[13px] text-primary border-r border-b text-center font-mono sticky left-[100px] z-10 p-0 shadow-[2px_0_5px_rgba(0,0,0,0.05)]", statusInfo.rowBg, isHighlighted && "bg-yellow-200")}>{j.rollNo}</TableCell>
                    <TableCell className="border-r border-b text-center">
                      <Badge className={cn("text-[10px] font-black text-white px-2", statusInfo.color)}>{j.status}</Badge>
                    </TableCell>
                    {visibleColumns['paperCompany'] && <TableCell className="text-[13px] font-bold border-r border-b uppercase px-3 text-center">{j.paperCompany}</TableCell>}
                    {visibleColumns['paperType'] && <TableCell className="text-[13px] font-bold border-r border-b px-3 text-center">{j.paperType}</TableCell>}
                    {visibleColumns['widthMm'] && <TableCell className="text-[13px] border-r border-b font-mono font-bold text-center">{j.widthMm}</TableCell>}
                    {visibleColumns['lengthMeters'] && <TableCell className="text-[13px] border-r border-b font-mono font-bold text-center">{j.lengthMeters}</TableCell>}
                    {visibleColumns['sqm'] && <TableCell className="text-[13px] border-r border-b font-black text-primary font-mono text-center">{j.sqm}</TableCell>}
                    {visibleColumns['gsm'] && <TableCell className="text-[13px] border-r border-b font-mono font-bold text-center">{j.gsm}</TableCell>}
                    {visibleColumns['weightKg'] && <TableCell className="text-[13px] border-r border-b font-mono font-bold text-center">{j.weightKg || 0}</TableCell>}
                    {visibleColumns['purchaseRate'] && <TableCell className="text-[13px] border-r border-b font-mono font-bold text-center">₹{j.purchaseRate || 0}</TableCell>}
                    {visibleColumns['receivedDate'] && <TableCell className="text-[13px] font-bold border-r border-b px-2 text-center">{j.receivedDate}</TableCell>}
                    {visibleColumns['dateOfUsed'] && <TableCell className="text-[13px] font-bold border-r border-b px-2 text-center">{j.dateOfUsed || '-'}</TableCell>}
                    {visibleColumns['jobNo'] && <TableCell className="text-[13px] border-r border-b font-mono font-black text-slate-700 text-center">{j.jobNo || '-'}</TableCell>}
                    {visibleColumns['jobSize'] && <TableCell className="text-[13px] border-r border-b text-center">{j.jobSize || '-'}</TableCell>}
                    {visibleColumns['jobName'] && <TableCell className="text-[13px] font-bold border-r border-b truncate max-w-[150px] text-center">{j.jobName || '-'}</TableCell>}
                    {visibleColumns['lotNo'] && <TableCell className="text-[13px] border-r border-b font-mono font-bold text-center">{j.lotNo || '-'}</TableCell>}
                    {visibleColumns['remarks'] && <TableCell className="text-[13px] border-r border-b px-2 italic truncate max-w-[150px] text-center">{j.remarks || '-'}</TableCell>}
                    <TableCell className={cn("text-center border-b sticky right-0 z-10 border-l shadow-[-2px_0_5px_rgba(0,0,0,0.05)] w-[200px] p-0", statusInfo.rowBg, isHighlighted && "bg-yellow-200")}>
                      <div className="flex items-center justify-center gap-1.5 px-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg shadow-sm" onClick={(e) => { e.stopPropagation(); setViewingRoll(j); setIsViewOpen(true); }}><Eye className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 bg-sky-500 hover:bg-sky-600 text-white rounded-lg shadow-sm" onClick={(e) => { e.stopPropagation(); handleOpenDialog(j); }}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 bg-orange-500 hover:bg-orange-600 text-white rounded-lg shadow-sm" onClick={(e) => { e.stopPropagation(); router.push(`/inventory/slitting?rollId=${j.id}`); }}><Scissors className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 bg-slate-700 hover:bg-slate-800 text-white rounded-lg shadow-sm" onClick={(e) => { e.stopPropagation(); setPrintingRoll(j); setIsPrintOpen(true); }}><Printer className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 bg-rose-500 hover:bg-rose-600 text-white rounded-lg shadow-sm" onClick={(e) => { e.stopPropagation(); if(confirm('Delete?')) deleteDoc(doc(firestore!, 'paper_stock', j.id)); }}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <div className="bg-slate-50 p-4 border-t flex items-center justify-between shrink-0 px-8 rounded-b-2xl">
          <div className="flex items-center gap-4">
            <Select value={rowsPerPage.toString()} onValueChange={v => { setRowsPerPage(Number(v)); setCurrentPage(1); }}>
              <SelectTrigger className="h-9 w-[120px] bg-white text-[12px] font-black uppercase rounded-xl border-none shadow-sm"><SelectValue /></SelectTrigger>
              <SelectContent className="z-[100] border-none shadow-2xl rounded-xl">
                {[10, 20, 50, 100].map(v => <SelectItem key={v} value={v.toString()}>{v} Rows</SelectItem>)}
              </SelectContent>
            </Select>
            <span className="text-[12px] font-black text-muted-foreground uppercase tracking-widest">Showing {filteredRows.length === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1}–{Math.min(currentPage * rowsPerPage, filteredRows.length)} of {filteredRows.length} Rolls</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" className="h-9 px-6 text-[12px] font-black uppercase border-2 rounded-xl" onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1}><ChevronLeft className="h-4 w-4 mr-2" /> Prev</Button>
            <span className="text-[12px] font-black bg-white border-2 border-slate-200 h-9 w-12 flex items-center justify-center rounded-xl shadow-inner">{currentPage}</span>
            <Button variant="outline" size="sm" className="h-9 px-6 text-[12px] font-black uppercase border-2 rounded-xl" onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage >= totalPages}>Next <ChevronRight className="h-4 w-4 ml-2" /></Button>
          </div>
        </div>
      </Card>

      {/* TECHNICAL PROFILE MODAL */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="sm:max-w-[850px] p-0 border-none shadow-3xl overflow-hidden rounded-3xl z-[100] [&>button]:text-white [&>button]:opacity-100">
          <DialogHeader className="p-8 bg-slate-900 text-white flex flex-row items-center justify-between border-b border-white/5">
            <div className="space-y-1">
              <DialogTitle className="uppercase font-black text-xl flex items-center gap-3 tracking-tighter">
                <Package className="h-6 w-6 text-primary" /> Technical Profile
              </DialogTitle>
              <DialogDescription className="text-slate-400 text-xs font-bold uppercase tracking-widest">Roll ID: {viewingRoll?.rollNo}</DialogDescription>
            </div>
          </DialogHeader>
          
          <div className="p-10 bg-slate-50 space-y-8 max-h-[75vh] overflow-y-auto industrial-scroll text-left">
            <div className="space-y-4">
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                <Info className="h-3 w-3" /> Section 1 — Basic Details
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <ProfileField icon={Hash} label="Roll No" value={viewingRoll?.rollNo} />
                <div className="space-y-1 text-left">
                  <Label className="text-[10px] uppercase font-black text-slate-400">Status</Label>
                  <div className="flex">
                    <Badge className={cn("font-black uppercase text-[10px] px-3", STATUS_OPTIONS.find(o => o.value === viewingRoll?.status)?.color || "bg-slate-500")}>
                      {viewingRoll?.status}
                    </Badge>
                  </div>
                </div>
                <ProfileField icon={Building2} label="Paper Company" value={viewingRoll?.paperCompany} />
                <ProfileField icon={FileText} label="Paper Type" value={viewingRoll?.paperType} />
              </div>
            </div>

            <Separator className="bg-slate-200" />

            <div className="space-y-4">
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                <Ruler className="h-3 w-3" /> Section 2 — Size Details
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <ProfileField icon={Ruler} label="Width (mm)" value={viewingRoll?.widthMm} highlight />
                <ProfileField icon={ArrowRightLeft} label="Length (mtr)" value={viewingRoll?.lengthMeters} highlight />
                <ProfileField icon={Layers} label="SQM" value={viewingRoll?.sqm} highlight />
                <ProfileField icon={Weight} label="GSM" value={viewingRoll?.gsm} />
                <ProfileField icon={Scale} label="Weight (kg)" value={viewingRoll?.weightKg} />
              </div>
            </div>

            <Separator className="bg-slate-200" />

            <div className="space-y-4">
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                <CircleDollarSign className="h-3 w-3" /> Section 3 — Purchase Info
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <ProfileField icon={CircleDollarSign} label="Purchase Rate" value={`₹${viewingRoll?.purchaseRate}`} />
                <ProfileField icon={Calendar} label="Date Received" value={viewingRoll?.receivedDate} />
                <ProfileField icon={History} label="Date Used" value={viewingRoll?.dateOfUsed || "—"} />
              </div>
            </div>

            <Separator className="bg-slate-200" />

            <div className="space-y-4">
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                <Tag className="h-3 w-3" /> Section 4 — Job Details
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <ProfileField icon={Hash} label="Job No" value={viewingRoll?.jobNo || "—"} />
                <ProfileField icon={Tag} label="Job Name" value={viewingRoll?.jobName || "—"} />
                <ProfileField icon={Maximize2} label="Job Size" value={viewingRoll?.jobSize || "—"} />
              </div>
            </div>

            <Separator className="bg-slate-200" />

            <div className="space-y-4">
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                <Package className="h-3 w-3" /> Section 5 — Additional Info
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <ProfileField icon={BarcodeIcon} label="Lot / Batch No" value={viewingRoll?.lotNo || "—"} />
                <ProfileField icon={Package} label="Company Roll No" value={viewingRoll?.companyRollNo || "—"} />
                <div className="md:col-span-2 space-y-1">
                  <Label className="text-[10px] uppercase font-black text-slate-400 flex items-center gap-1.5"><MessageSquare className="h-3 w-3" /> Remarks</Label>
                  <p className="text-sm font-bold text-slate-700 bg-white p-4 rounded-xl border border-slate-200 italic">{viewingRoll?.remarks || "No additional technical flags recorded."}</p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="p-8 bg-white border-t flex flex-row gap-4 items-center justify-end">
            <Button variant="outline" onClick={() => setIsViewOpen(false)} className="h-12 px-8 font-black uppercase text-[10px] tracking-widest rounded-xl border-2">Close</Button>
            <Button variant="outline" onClick={() => { handleOpenDialog(viewingRoll); setIsViewOpen(false); }} className="h-12 px-8 font-black uppercase text-[10px] tracking-widest rounded-xl border-2 hover:bg-sky-50 text-sky-700">Edit Roll</Button>
            <Button onClick={() => { setPrintingRoll(viewingRoll); setIsPrintOpen(true); }} className="h-12 px-10 font-black uppercase text-[10px] tracking-widest rounded-xl shadow-xl bg-slate-900 text-white">Execute Thermal Print</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* THERMAL PRINT MODAL */}
      <Dialog open={isPrintOpen} onOpenChange={setIsPrintOpen}>
        <DialogContent className="sm:max-w-[600px] p-0 border-none shadow-3xl rounded-3xl z-[150] overflow-hidden [&>button]:text-white [&>button]:opacity-100">
          <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-widest">Thermal Print Preview (150x100mm)</h3>
          </div>
          
          <div className="p-12 bg-slate-100 flex justify-center overflow-hidden">
            <div id="thermal-label" className="bg-white border-[4px] border-black p-8 w-[150mm] h-[100mm] shadow-2xl flex flex-col text-black font-sans box-border overflow-hidden relative">
              <div className="text-center border-b-[2px] border-black pb-3 mb-4 shrink-0">
                <h1 className="text-2xl font-black uppercase tracking-tighter">SHREE LABEL CREATION</h1>
              </div>
              
              <div className="flex-1 flex flex-col justify-between overflow-hidden">
                <div className="text-center space-y-1">
                  <p className="text-[10px] font-bold uppercase opacity-70">Item Name</p>
                  <p className="text-xl font-black uppercase tracking-tight truncate">{printingRoll?.paperType}</p>
                </div>

                <div className="text-center py-2 bg-black/5 rounded-lg border-[2px] border-black/10">
                  <p className="text-[10px] font-black uppercase opacity-60">TECHNICAL REEL ID</p>
                  <p className="text-5xl font-black tracking-tighter leading-none">{printingRoll?.rollNo}</p>
                </div>

                <div className="flex items-center justify-between gap-6 py-4 px-2">
                  <div className="p-2 border-[2px] border-black rounded flex items-center justify-center bg-white shrink-0">
                    {printingRoll && (
                      <QRCodeSVG 
                        value={JSON.stringify({
                          roll: printingRoll.rollNo,
                          company: printingRoll.paperCompany,
                          width: printingRoll.widthMm,
                          gsm: printingRoll.gsm,
                          length: printingRoll.lengthMeters
                        })} 
                        size={90}
                        level="H"
                      />
                    )}
                  </div>
                  <div className="flex-1 flex flex-col items-center justify-center overflow-hidden">
                    {printingRoll && (
                      <Barcode 
                        value={printingRoll.rollNo} 
                        width={1.8} 
                        height={60} 
                        fontSize={12} 
                        margin={0} 
                        format="CODE128"
                      />
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-x-10 gap-y-1.5 text-sm border-t-[2px] border-black pt-4">
                  <div className="flex justify-between">
                    <span className="font-bold uppercase text-[9px]">Width:</span>
                    <span className="font-black">{printingRoll?.widthMm} mm</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-bold uppercase text-[9px]">Company:</span>
                    <span className="font-black uppercase truncate">{printingRoll?.paperCompany}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-bold uppercase text-[9px]">Length:</span>
                    <span className="font-black">{printingRoll?.lengthMeters} mtr</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-bold uppercase text-[9px]">Received:</span>
                    <span className="font-black">{printingRoll?.receivedDate}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-bold uppercase text-[9px]">GSM:</span>
                    <span className="font-black">{printingRoll?.gsm}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-bold uppercase text-[9px]">Weight:</span>
                    <span className="font-black">{printingRoll?.weightKg} kg</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="p-8 bg-white border-t">
            <Button onClick={() => window.print()} className="w-full h-14 rounded-2xl bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-[0.2em] shadow-2xl">
              <Printer className="h-5 w-5 mr-3" /> Finalize Thermal Print
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QR SCANNER DIALOG */}
      <Dialog open={isScannerOpen} onOpenChange={(open) => { setIsScannerOpen(open); if(!open) Html5QrcodeScanner.prototype.clear; }}>
        <DialogContent className="sm:max-w-[450px] p-0 border-none shadow-3xl rounded-3xl z-[200] overflow-hidden [&>button]:text-white [&>button]:opacity-100">
          <DialogHeader className="p-6 bg-indigo-600 text-white flex flex-row items-center justify-between border-none">
            <div className="space-y-1">
              <DialogTitle className="uppercase font-black text-sm flex items-center gap-2 tracking-widest"><Camera className="h-4 w-4" /> Scanner Hub</DialogTitle>
              <DialogDescription className="text-white/70 text-[10px] font-bold">Point camera at roll QR or Barcode</DialogDescription>
            </div>
          </DialogHeader>
          <div className="p-0 bg-black min-h-[350px]">
            <div id="reader" className="w-full"></div>
          </div>
          <div className="p-6 bg-white text-center">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Hardware acceleration active • 10 FPS</p>
          </div>
        </DialogContent>
      </Dialog>

      {/* ADD/EDIT DIALOG */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[850px] max-h-[95vh] overflow-y-auto p-0 border-none rounded-3xl shadow-3xl z-[100] animate-in slide-in-from-bottom-4 [&>button]:text-white [&>button]:opacity-100">
          <form onSubmit={handleSave}>
            <DialogHeader className="p-8 bg-slate-900 text-white">
              <DialogTitle className="uppercase font-black text-xl tracking-widest flex items-center gap-3 text-left">
                {editingRoll ? <Pencil className="h-6 w-6 text-sky-400" /> : <Plus className="h-6 w-6 text-primary" />}
                {editingRoll ? `Edit Registry: ${editingRoll.rollNo}` : 'New Master Roll Registration'}
              </DialogTitle>
              <DialogDescription className="text-slate-400 text-xs font-bold uppercase tracking-widest pt-1 text-left">Populate all 18 technical parameters for pharma-grade tracking.</DialogDescription>
            </DialogHeader>
            <div className="p-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 bg-white text-left">
              <div className="space-y-2 text-left">
                <Label className="text-[11px] uppercase font-black text-slate-500">Roll ID (Primary Key)</Label>
                <Input value={formData.rollNo} onChange={e => setFormData({...formData, rollNo: e.target.value})} className="h-12 font-black text-primary border-2 rounded-xl text-sm" required />
              </div>
              
              <div className="space-y-2 text-left">
                <Label className="text-[11px] uppercase font-black text-slate-500">Stock Status</Label>
                {isCustomStatus ? (
                  <div className="flex gap-2">
                    <Input 
                      placeholder="Enter Custom Status..." 
                      className="h-12 font-bold border-primary rounded-xl text-sm flex-1"
                      value={formData.status}
                      onChange={e => setFormData({...formData, status: e.target.value})}
                      autoFocus
                    />
                    <Button variant="ghost" type="button" onClick={() => { setIsCustomStatus(false); setFormData({...formData, status: "Main"}); }} className="h-12 w-12 text-muted-foreground"><X className="h-4 w-4" /></Button>
                  </div>
                ) : (
                  <Select value={formData.status} onValueChange={v => { if(v === "CUSTOM") setIsCustomStatus(true); else setFormData({...formData, status: v}); }}>
                    <SelectTrigger className="h-12 font-black border-2 rounded-xl text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent className="shadow-2xl rounded-xl border-none z-[110]">
                      {STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value} className="font-bold">{o.label}</SelectItem>)}
                      <SelectSeparator />
                      <SelectItem value="CUSTOM" className="font-bold text-primary italic">+ Add Custom Stage</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="space-y-2 text-left"><Label className="text-[11px] uppercase font-black text-slate-500">Mfr / Company</Label><Input value={formData.paperCompany} list="paper-company-suggestions" onChange={e => setFormData({...formData, paperCompany: e.target.value})} className="h-12 font-bold border-2 rounded-xl text-sm" /></div>
              <div className="space-y-2 text-left"><Label className="text-[11px] uppercase font-black text-slate-500">Substrate / Type</Label><Input value={formData.paperType} list="paper-type-suggestions" onChange={e => setFormData({...formData, paperType: e.target.value})} className="h-12 font-bold border-2 rounded-xl text-sm" /></div>
              <div className="space-y-2 text-left"><Label className="text-[11px] uppercase font-black text-slate-500">Width (mm)</Label><Input type="number" step="0.01" value={formData.widthMm || ""} onChange={e => setFormData({...formData, widthMm: Number(e.target.value)})} required className="h-12 font-mono font-bold border-2 rounded-xl text-sm" /></div>
              <div className="space-y-2 text-left"><Label className="text-[11px] uppercase font-black text-slate-500">Length (mtr)</Label><Input type="number" step="0.01" value={formData.lengthMeters || ""} onChange={e => setFormData({...formData, lengthMeters: Number(e.target.value)})} required className="h-12 font-mono font-bold border-2 rounded-xl text-sm" /></div>
              <div className="space-y-2 bg-primary/5 p-4 rounded-2xl border-2 border-primary/20 text-left"><Label className="text-[11px] uppercase font-black text-primary">SQM (Auto-calc)</Label><Input value={calculatedSqm} readOnly className="h-12 bg-white font-black text-2xl text-primary border-none shadow-inner rounded-xl" /></div>
              <div className="space-y-2 text-left"><Label className="text-[11px] uppercase font-black text-slate-500">GSM</Label><Input type="number" value={formData.gsm || ""} onChange={e => setFormData({...formData, gsm: Number(e.target.value)})} required className="h-12 font-mono font-bold border-2 rounded-xl text-sm" /></div>
              <div className="space-y-2 text-left"><Label className="text-[11px] uppercase font-black text-slate-500">Weight (kg)</Label><Input type="number" step="0.01" value={formData.weightKg || ""} onChange={e => setFormData({...formData, weightKg: Number(e.target.value)})} className="h-12 font-bold border-2 rounded-xl text-sm" /></div>
              <div className="space-y-2 text-left"><Label className="text-[11px] uppercase font-black text-slate-500">Rate (₹)</Label><Input type="number" step="0.01" value={formData.purchaseRate || ""} onChange={e => setFormData({...formData, purchaseRate: Number(e.target.value)})} className="h-12 font-bold border-2 rounded-xl text-sm" /></div>
              <div className="space-y-2 text-left"><Label className="text-[11px] uppercase font-black text-slate-500">Date Received</Label><Input type="date" value={formData.receivedDate} onChange={e => setFormData({...formData, receivedDate: e.target.value})} className="h-12 font-bold border-2 rounded-xl text-sm" /></div>
              <div className="space-y-2 text-left"><Label className="text-[11px] uppercase font-black text-slate-500">Date Used</Label><Input type="date" value={formData.dateOfUsed} onChange={e => setFormData({...formData, dateOfUsed: e.target.value})} className="h-12 font-bold border-2 rounded-xl text-sm" /></div>
              <div className="space-y-2 text-left"><Label className="text-[11px] uppercase font-black text-slate-500">Job No</Label><Input value={formData.jobNo} list="job-no-suggestions" onChange={e => setFormData({...formData, jobNo: e.target.value})} className="h-12 font-bold border-2 rounded-xl text-sm" /></div>
              <div className="space-y-2 text-left"><Label className="text-[11px] uppercase font-black text-slate-500">Job Name</Label><Input value={formData.jobName} list="job-name-suggestions" onChange={e => setFormData({...formData, jobName: e.target.value})} className="h-12 font-bold border-2 rounded-xl text-sm" /></div>
              <div className="space-y-2 text-left"><Label className="text-[11px] uppercase font-black text-slate-500">Job Size</Label><Input value={formData.jobSize} list="job-size-suggestions" onChange={e => setFormData({...formData, jobSize: e.target.value})} className="h-12 font-bold border-2 rounded-xl text-sm" /></div>
              <div className="space-y-2 text-left"><Label className="text-[11px] uppercase font-black text-slate-500">Lot No</Label><Input value={formData.lotNo} list="lot-no-suggestions" onChange={e => setFormData({...formData, lotNo: e.target.value})} className="h-12 font-bold border-2 rounded-xl text-sm" /></div>
              <div className="space-y-2 text-left"><Label className="text-[11px] uppercase font-black text-slate-500">Company Roll No</Label><Input value={formData.companyRollNo} list="company-roll-suggestions" onChange={e => setFormData({...formData, companyRollNo: e.target.value})} className="h-12 font-bold border-2 rounded-xl text-sm" /></div>
              <div className="space-y-2 md:col-span-2 lg:col-span-3 text-left"><Label className="text-[11px] uppercase font-black text-slate-500">Technical Remarks</Label><Textarea value={formData.remarks} onChange={e => setFormData({...formData, remarks: e.target.value})} className="min-h-[100px] border-2 rounded-2xl font-medium text-sm" placeholder="Any quality issues or technical flags..." /></div>
            </div>
            <DialogFooter className="p-8 bg-slate-50 border-t">
              <Button type="submit" disabled={isProcessing} className="w-full h-16 uppercase font-black tracking-[0.25em] bg-slate-900 text-white rounded-2xl shadow-2xl hover:scale-[1.01] active:scale-[0.99] transition-all">
                {isProcessing ? <Loader2 className="animate-spin mr-3 h-6 w-6" /> : editingRoll ? 'Update Technical Record' : 'Commit to Registry'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <datalist id="paper-company-suggestions">{getUniqueOptions('paperCompany').map(o => <option key={o} value={o} />)}</datalist>
      <datalist id="paper-type-suggestions">{getUniqueOptions('paperType').map(o => <option key={o} value={o} />)}</datalist>
      <datalist id="job-no-suggestions">{getUniqueOptions('jobNo').map(o => <option key={o} value={o} />)}</datalist>
      <datalist id="job-size-suggestions">{getUniqueOptions('jobSize').map(o => <option key={o} value={o} />)}</datalist>
      <datalist id="job-name-suggestions">{getUniqueOptions('jobName').map(o => <option key={o} value={o} />)}</datalist>
      <datalist id="lot-no-suggestions">{getUniqueOptions('lotNo').map(o => <option key={o} value={o} />)}</datalist>
      <datalist id="company-roll-suggestions">{getUniqueOptions('companyRollNo').map(o => <option key={o} value={o} />)}</datalist>

      <style jsx global>{`
        @media print {
          body * { visibility: hidden !important; }
          #thermal-label, #thermal-label * { visibility: visible !important; }
          #thermal-label {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            margin: 0 !important;
            width: 150mm !important;
            height: 100mm !important;
            border: 4px solid black !important;
            box-shadow: none !important;
            box-sizing: border-box !important;
            background: white !important;
            z-index: 9999 !important;
          }
          @page { 
            size: 150mm 100mm; 
            margin: 0 !important; 
          }
        }
      `}</style>
    </div>
  );
}

function ProfileField({ icon: Icon, label, value, highlight = false }: { icon: any, label: string, value: any, highlight?: boolean }) {
  return (
    <div className="space-y-1.5 transition-all group text-left">
      <Label className="text-[10px] uppercase font-black text-slate-400 flex items-center gap-1.5 transition-colors group-hover:text-primary">
        <Icon className="h-3 w-3" /> {label}
      </Label>
      <div className={cn(
        "text-sm font-black tracking-tight rounded-xl p-3 bg-white border border-slate-200 shadow-sm",
        highlight ? "text-primary text-base border-primary/20 bg-primary/5" : "text-slate-800"
      )}>
        {value || "—"}
      </div>
    </div>
  );
}
