
"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { 
  Plus, 
  Loader2, 
  Pencil,
  Trash2,
  Package,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  Eye,
  Scissors,
  Printer,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  History,
  Calendar,
  Info,
  QrCode,
  Hash,
  Building2,
  FileText,
  Ruler,
  ArrowRightLeft,
  Layers,
  Weight,
  Scale,
  CircleDollarSign,
  Maximize2,
  MessageSquare,
  Camera,
  CalendarDays,
  Save,
  X,
  Settings2,
  FilterX
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useFirestore, useUser, useCollection, useMemoFirebase } from "@/firebase"
import { 
  collection, 
  doc, 
  query, 
  limit, 
  serverTimestamp,
  deleteDoc,
  setDoc,
  writeBatch,
  where,
  getDocs
} from "firebase/firestore"
import { cn } from "@/lib/utils"
import { ActionModal, ModalType } from "@/components/action-modal"
import { QRCodeSVG } from 'qrcode.react'
import Barcode from 'react-barcode'
import { Html5QrcodeScanner } from "html5-qrcode"
import { PaperStockFilters } from "@/components/inventory/paper-stock-filters"
import { TemplateRenderer } from "@/components/printing/template-renderer"
import { ColumnHeaderFilter } from "@/components/inventory/column-header-filter"

const STATUS_OPTIONS = [
  { value: "Main", label: "Main", color: "bg-purple-600", rowBg: "bg-purple-50" },
  { value: "Stock", label: "Stock", color: "bg-emerald-600", rowBg: "bg-emerald-50" },
  { value: "Slitting", label: "Slitting", color: "bg-orange-500", rowBg: "bg-orange-50" },
  { value: "Job Assign", label: "Job Assign", color: "bg-rose-500", rowBg: "bg-rose-50" },
  { value: "In Production", label: "In Production", color: "bg-cyan-500", rowBg: "bg-cyan-50" },
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
  { id: 'receivedDate', label: 'Date Received' },
  { id: 'dateOfUsed', label: 'Date Used' },
  { id: 'jobNo', label: 'Job No' },
  { id: 'jobSize', label: 'Job Size' },
  { id: 'jobName', label: 'Job Name' },
  { id: 'lotNo', label: 'Lot / Batch No' },
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
  const [isReportOpen, setIsReportOpen] = useState(false)
  const [isScannerOpen, setIsScannerOpen] = useState(false)
  
  const [editingRoll, setEditingRoll] = useState<any>(null)
  const [viewingRoll, setViewingRoll] = useState<any>(null)
  const [printingRolls, setPrintingRolls] = useState<any[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("default")
  const [isProcessing, setIsProcessing] = useState(false)
  
  const [currentPage, setCurrentPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(50) 
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'rollNo', direction: 'desc' })
  const [highlightedId, setHighlightedId] = useState<string | null>(null)
  const [isCustomStatus, setIsCustomStatus] = useState(false)

  // Header Filters State
  const [headerFilters, setHeaderFilters] = useState<Record<string, string[]>>({})
  const [filterMode, setFilterMode] = useState<'quick' | 'advanced'>('quick')

  const defaultVisibleColumns = COLUMN_KEYS.reduce((acc, col) => ({ ...acc, [col.id]: true }), {})

  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(defaultVisibleColumns)

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

  const [modal, setModal] = useState<{ isOpen: boolean; type: ModalType; title: string; description?: string; }>({ isOpen: false, type: 'SUCCESS', title: '' });

  const initialFilters = {
    search: "",
    paperCompany: [],
    paperType: [],
    gsm: [],
    status: [],
    lotNoSearch: "",
    rollNoSearch: "",
    receivedFrom: "",
    receivedTo: ""
  }

  const [filters, setFilters] = useState<any>(initialFilters)

  const [formData, setFormData] = useState({
    rollNo: "", paperCompany: "", paperType: "", status: "Main", widthMm: 0, lengthMeters: 0, sqm: 0, gsm: 0, weightKg: 0,
    purchaseRate: 0, receivedDate: "", dateOfUsed: "", jobNo: "", jobSize: "", jobName: "", lotNo: "", companyRollNo: "", remarks: ""
  })

  const registryQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'paper_stock'), limit(1000));
  }, [firestore]);

  const templatesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'print_templates'), where('documentType', '==', 'Label'));
  }, [firestore]);

  const { data: rolls, isLoading: itemsLoading } = useCollection(registryQuery);
  const { data: labelTemplates } = useCollection(templatesQuery);

  const selectedTemplate = useMemo(() => {
    if (selectedTemplateId === "default") return null;
    return labelTemplates?.find(t => t.id === selectedTemplateId);
  }, [labelTemplates, selectedTemplateId]);

  const getPrintDataMapping = (roll: any) => {
    if (!roll) return {};
    return {
      roll_number: roll.rollNo,
      paper_item: roll.paperType,
      width: roll.widthMm,
      length: roll.lengthMeters,
      gsm: roll.gsm,
      weight: roll.weightKg,
      received_date: roll.receivedDate,
      company_name: "SHREE LABEL CREATION",
      customer_name: roll.jobName || "-",
      date: new Date().toLocaleDateString()
    };
  };

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
      // 1. Global Search
      if (filters.search) {
        const s = filters.search.toLowerCase();
        const matchesGlobal = Object.entries(row).some(([key, val]) => {
          if (['id', 'updatedAt', 'createdAt', 'createdById', 'updatedById'].includes(key)) return false;
          return String(val || "").toLowerCase().includes(s);
        });
        if (!matchesGlobal) return false;
      }
      
      // 2. Specific Advanced Filters
      if (filters.lotNoSearch && !String(row.lotNo || "").toLowerCase().includes(filters.lotNoSearch.toLowerCase())) return false;
      if (filters.rollNoSearch && !String(row.rollNo || "").toLowerCase().includes(filters.rollNoSearch.toLowerCase())) return false;
      if (filters.paperCompany?.length > 0 && !filters.paperCompany.includes(String(row.paperCompany || ""))) return false;
      if (filters.paperType?.length > 0 && !filters.paperType.includes(String(row.paperType || ""))) return false;
      if (filters.gsm?.length > 0 && !filters.gsm.includes(String(row.gsm || ""))) return false;
      if (filters.status?.length > 0 && !filters.status.includes(String(row.status || ""))) return false;
      if (filters.receivedFrom && row.receivedDate < filters.receivedFrom) return false;
      if (filters.receivedTo && row.receivedDate > filters.receivedTo) return false;

      // 3. Header Excel-Style Filters - Only if in advanced mode
      if (filterMode === 'advanced') {
        for (const [key, selected] of Object.entries(headerFilters)) {
          if (selected && selected.length > 0) {
            const val = String(row[key] || "");
            if (!selected.includes(val)) return false;
          }
        }
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
  }, [rolls, filters, sortConfig, headerFilters, filterMode]);

  // Report Data logic
  const reportRows = useMemo(() => {
    if (selectedIds.size > 0) {
      return rolls?.filter(r => selectedIds.has(r.id)) || [];
    }
    return filteredRows;
  }, [selectedIds, filteredRows, rolls]);

  const reportTotals = useMemo(() => {
    return reportRows.reduce((acc, r) => ({
      rolls: acc.rolls + 1,
      weight: acc.weight + (Number(r.weightKg) || 0),
      sqm: acc.sqm + (Number(r.sqm) || 0)
    }), { rolls: 0, weight: 0, sqm: 0 });
  }, [reportRows]);

  const activeFiltersSummary = useMemo(() => {
    const list: string[] = [];
    if (filters.search) list.push(`Search: ${filters.search}`);
    if (filters.paperCompany?.length) list.push(`Company: ${filters.paperCompany.join(', ')}`);
    if (filters.paperType?.length) list.push(`Type: ${filters.paperType.join(', ')}`);
    if (filters.status?.length) list.push(`Status: ${filters.status.join(', ')}`);
    
    // Include header filters in summary
    Object.entries(headerFilters).forEach(([key, values]) => {
      if (values.length > 0) {
        const label = COLUMN_KEYS.find(c => c.id === key)?.label || key;
        list.push(`${label}: ${values.join(', ')}`);
      }
    });

    return list.length > 0 ? list.join(' | ') : "None";
  }, [filters, headerFilters]);

  const hierarchicalRows = useMemo(() => {
    if (filteredRows.length === 0) return [];

    const itemMap = new Map();
    filteredRows.forEach(item => {
      itemMap.set(item.rollNo, { ...item, children: [] });
    });

    const roots: any[] = [];
    filteredRows.forEach(item => {
      const parts = item.rollNo.split('-');
      if (parts.length > 1) {
        const parentId = parts.slice(0, -1).join('-');
        if (itemMap.has(parentId)) {
          itemMap.get(parentId).children.push(itemMap.get(item.rollNo));
        } else {
          roots.push(itemMap.get(item.rollNo));
        }
      } else {
        roots.push(itemMap.get(item.rollNo));
      }
    });

    const flattened: any[] = [];
    const traverse = (node: any, level: number, isLast: boolean) => {
      flattened.push({ ...node, level, isLast });
      const sortedChildren = node.children.sort((a: any, b: any) => a.rollNo.localeCompare(b.rollNo));
      sortedChildren.forEach((child: any, idx: number) => {
        traverse(child, level + 1, idx === sortedChildren.length - 1);
      });
    };

    roots.forEach(root => traverse(root, 0, true));
    return flattened;
  }, [filteredRows]);

  const suggestions = useMemo(() => {
    if (!rolls) return { companies: [], types: [], gsms: [], lots: [], mfrRolls: [] };
    return {
      companies: Array.from(new Set(rolls.map(r => String(r.paperCompany || "").trim()).filter(Boolean))).sort(),
      types: Array.from(new Set(rolls.map(r => String(r.paperType || "").trim()).filter(Boolean))).sort(),
      gsms: Array.from(new Set(rolls.map(r => String(r.gsm || "").trim()).filter(Boolean))).sort((a, b) => Number(a) - Number(b)),
      lots: Array.from(new Set(rolls.map(r => String(r.lotNo || "").trim()).filter(Boolean))).sort(),
      mfrRolls: Array.from(new Set(rolls.map(r => String(r.companyRollNo || "").trim()).filter(Boolean))).sort(),
    };
  }, [rolls]);

  const totalPages = Math.ceil(hierarchicalRows.length / rowsPerPage);
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return hierarchicalRows.slice(start, start + rowsPerPage);
  }, [hierarchicalRows, currentPage, rowsPerPage]);

  const handleOpenDialog = (roll?: any) => {
    if (roll) {
      setEditingRoll(roll);
      setFormData({ ...formData, ...roll });
      setIsCustomStatus(!STATUS_OPTIONS.some(o => o.value === roll.status));
    } else {
      setEditingRoll(null);
      setIsCustomStatus(false);

      let suggestedRollNo = "T-1001";
      if (rolls && rolls.length > 0) {
        const numericParts = rolls
          .map(r => r.rollNo)
          .filter(id => /^T-\d+$/.test(id))
          .map(id => parseInt(id.split('-')[1]))
          .filter(num => !isNaN(num));

        if (numericParts.length > 0) {
          const maxVal = Math.max(...numericParts);
          suggestedRollNo = `T-${maxVal + 1}`;
        }
      }

      setFormData({
        rollNo: suggestedRollNo,
        paperCompany: "", paperType: "", status: "Main", widthMm: 0, lengthMeters: 0, sqm: 0,
        gsm: 0, weightKg: 0, purchaseRate: 0, receivedDate: new Date().toISOString().split('T')[0],
        dateOfUsed: "", jobNo: "", jobSize: "", jobName: "", lotNo: "", companyRollNo: "", remarks: ""
      });
    }
    setIsDialogOpen(true);
  }

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firestore || !user || isProcessing) return;

    const rollId = formData.rollNo.trim();

    if (!editingRoll && rolls?.some(r => r.rollNo === rollId)) {
      setModal({ 
        isOpen: true, 
        type: 'ERROR', 
        title: 'Duplicate Roll ID', 
        description: `Roll Number "${rollId}" is already assigned to another record. Please use a unique ID.` 
      });
      return;
    }

    setIsProcessing(true);
    const finalData = { 
      ...formData, 
      sqm: calculatedSqm, 
      updatedAt: serverTimestamp(), 
      updatedById: user.uid 
    };

    try {
      if (editingRoll) {
        await setDoc(doc(firestore, 'paper_stock', editingRoll.id), finalData, { merge: true });
        setIsDialogOpen(false); 
        setModal({ isOpen: true, type: 'SUCCESS', title: 'Record Updated' });
      } else {
        await setDoc(doc(firestore, 'paper_stock', rollId), { ...finalData, id: rollId, createdAt: serverTimestamp(), createdById: user.uid });
        setIsDialogOpen(false); 
        setModal({ isOpen: true, type: 'SUCCESS', title: 'Roll Generated' });
      }
    } catch (error: any) { 
      setModal({ isOpen: true, type: 'ERROR', title: 'Operation Failed', description: error.message }); 
    } finally { 
      setIsProcessing(false); 
    }
  };

  const handleBulkDelete = async () => {
    if (!firestore || selectedIds.size === 0) return;
    if (!confirm(`Permanently delete ${selectedIds.size} rolls?`)) return;
    
    setIsProcessing(true);
    try {
      const batch = writeBatch(firestore);
      selectedIds.forEach(id => {
        batch.delete(doc(firestore, 'paper_stock', id));
      });
      await batch.commit();
      setSelectedIds(new Set());
      setModal({ isOpen: true, type: 'SUCCESS', title: 'Batch Delete Complete' });
    } catch (e: any) {
      setModal({ isOpen: true, type: 'ERROR', title: 'Delete Failed', description: e.message });
    } finally {
      setIsProcessing(false);
    }
  }

  const handleBulkPrint = () => {
    if (selectedIds.size === 0) return;
    const selectedRolls = rolls?.filter(r => selectedIds.has(r.id)) || [];
    setPrintingRolls(selectedRolls);
    setIsPrintOpen(true);
  }

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

  const SortableHeader = ({ label, field, className = "", stickLeft }: { label: string, field: string, className?: string, stickLeft?: string }) => {
    if (!visibleColumns[field]) return null;
    const isActive = sortConfig.key === field;

    return (
      <TableHead 
        className={cn(
          "transition-colors border-r border-b sticky top-0 bg-slate-100 p-0 h-10 z-[30]", 
          isActive && "bg-slate-200", 
          stickLeft && "z-[40] shadow-[2px_0_5px_rgba(0,0,0,0.1)]",
          className
        )}
        style={stickLeft ? { left: stickLeft } : {}}
      >
        <div className="flex items-center justify-between h-full px-2 gap-1 group/header">
          <div 
            className="flex items-center gap-1.5 flex-1 justify-center cursor-pointer h-full" 
            onClick={() => requestSort(field)}
          >
            <span className="font-semibold text-[11px] uppercase text-slate-700 tracking-tight">{label}</span>
            {isActive ? (
              sortConfig.direction === 'asc' ? <ArrowUp className="h-3 w-3 text-primary" /> : <ArrowDown className="h-3 w-3 text-primary" />
            ) : (
              <ArrowUpDown className="h-2.5 w-2.5 opacity-30 group-hover/header:opacity-100 transition-opacity" />
            )}
          </div>
          {filterMode === 'advanced' && (
            <ColumnHeaderFilter 
              columnKey={field}
              label={label}
              data={rolls || []}
              selectedValues={headerFilters[field] || []}
              onFilterChange={(values) => setHeaderFilters(prev => ({ ...prev, [field]: values }))}
            />
          )}
        </div>
      </TableHead>
    );
  };

  const handleResetAll = () => {
    setFilters(initialFilters);
    setHeaderFilters({});
    setSortConfig({ key: 'rollNo', direction: 'desc' });
    setCurrentPage(1);
    setSelectedIds(new Set());
  }

  if (!isMounted) return null;

  return (
    <div className="flex flex-col h-full space-y-6 font-sans animate-in fade-in duration-500 pb-20">
      <ActionModal isOpen={modal.isOpen} onClose={() => setModal(p => ({ ...p, isOpen: false }))} {...modal} />

      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-[28px] font-semibold tracking-tight">Paper Stock Details</h1>
          <p className="text-sm font-normal text-muted-foreground">
            Master inventory of all parent and child paper rolls including width, length, stock status, and job allocation.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            onClick={() => setIsReportOpen(true)}
            className="h-10 px-6 font-black uppercase text-[10px] tracking-widest border-2 rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            <FileText className="h-4 w-4 mr-2 text-primary" /> Print Stock Report
          </Button>
          <Button 
            variant="outline" 
            onClick={() => setFilterMode(filterMode === 'quick' ? 'advanced' : 'quick')}
            className={cn(
              "h-10 px-6 font-black uppercase text-[10px] tracking-widest border-2 rounded-xl transition-all",
              filterMode === 'advanced' ? "bg-primary text-white border-primary" : "border-slate-200 text-slate-600"
            )}
          >
            {filterMode === 'quick' ? (
              <><Settings2 className="h-4 w-4 mr-2" /> Advance Filter</>
            ) : (
              <><FilterX className="h-4 w-4 mr-2" /> Back to Quick Filter</>
            )}
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleResetAll} 
            className="text-[10px] font-black uppercase text-destructive tracking-widest h-10 px-4 border-2 rounded-xl border-destructive/20 hover:bg-destructive/5"
          >
            <FilterX className="h-4 w-4 mr-1.5" /> Reset Filters
          </Button>
        </div>
      </div>

      {filterMode === 'quick' && (
        <PaperStockFilters 
          data={rolls || []} 
          filters={filters} 
          setFilters={setFilters} 
          onReset={handleResetAll} 
        />
      )}

      <Card className="flex-1 overflow-hidden flex flex-col border-slate-200 shadow-xl rounded-2xl bg-white border-none">
        <div className="bg-slate-900 text-white p-4 px-8 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-6">
            <h2 className="font-semibold text-sm uppercase tracking-wider flex items-center gap-3">
              <LayoutGrid className="h-5 w-5 text-primary" /> Master Grid
            </h2>
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-3 animate-in fade-in slide-in-from-left-2">
                <Badge className="bg-primary text-white font-semibold">{selectedIds.size} SELECTED</Badge>
                <Button variant="secondary" size="sm" onClick={handleBulkPrint} className="h-8 px-3 rounded-lg font-semibold text-[10px] uppercase tracking-wider bg-white text-slate-900 hover:bg-slate-100">
                  <Printer className="h-3.5 w-3.5 mr-1.5" /> Print Selected Labels
                </Button>
                <Button variant="destructive" size="sm" onClick={handleBulkDelete} className="h-8 px-3 rounded-lg font-semibold text-[10px] uppercase tracking-wider">
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Bulk Delete
                </Button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 px-4 bg-transparent border-white/20 text-white hover:bg-white/10 font-semibold uppercase text-[10px] tracking-wider rounded-xl transition-all">
                  <Settings2 className="h-4 w-4 mr-2" /> Columns
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-white rounded-xl shadow-2xl border-none p-2 z-[100]">
                <div className="p-2 border-b mb-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Visibility Settings</span>
                </div>
                <div className="max-h-[300px] overflow-y-auto industrial-scroll">
                  {COLUMN_KEYS.map((col) => (
                    <DropdownMenuCheckboxItem
                      key={col.id}
                      checked={visibleColumns[col.id]}
                      onCheckedChange={(val) => setVisibleColumns(prev => ({ ...prev, [col.id]: val }))}
                      className="font-medium text-xs py-2 rounded-lg"
                    >
                      {col.label}
                    </DropdownMenuCheckboxItem>
                  ))}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" size="sm" onClick={startScanner} className="h-9 px-4 bg-transparent border-primary/30 text-white hover:bg-primary hover:text-white font-semibold uppercase text-[10px] tracking-wider rounded-xl transition-all">
              <QrCode className="h-4 w-4 mr-2" /> Live Scanner
            </Button>
            <Button variant="secondary" size="sm" className="h-9 px-6 bg-primary hover:bg-primary/90 text-white font-semibold uppercase text-[10px] tracking-wider rounded-xl shadow-lg border-none" onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4 mr-2" /> Add Roll
            </Button>
          </div>
        </div>

        <div className="w-full h-[calc(100vh-320px)] overflow-scroll relative border-t industrial-scroll">
          <Table className="border-separate border-spacing-0 min-w-[3000px]">
            <TableHeader className="sticky top-0 z-[30] bg-white">
              <TableRow className="h-12">
                <TableHead className="w-[40px] text-center border-r border-b sticky top-0 left-0 bg-slate-100 z-[40] p-0 shadow-[2px_0_5px_rgba(0,0,0,0.1)]">
                  <div className="flex items-center justify-center h-full">
                    <Checkbox checked={paginatedRows.length > 0 && paginatedRows.every(r => selectedIds.has(r.id))} onCheckedChange={(val) => { const next = new Set(selectedIds); paginatedRows.forEach(r => val ? next.add(r.id) : next.delete(r.id)); setSelectedIds(next); }} />
                  </div>
                </TableHead>
                <TableHead className="w-[60px] text-center font-semibold text-[11px] uppercase border-r border-b sticky top-0 left-[40px] bg-slate-100 z-[40] p-0 shadow-[2px_0_5px_rgba(0,0,0,0.1)]">Sl No</TableHead>
                <SortableHeader label="Roll No" field="rollNo" className="w-[200px]" stickLeft="100px" />
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
                <SortableHeader label="Lot / Batch No" field="lotNo" />
                <SortableHeader label="Company Roll No" field="companyRollNo" />
                <SortableHeader label="Remarks" field="remarks" />
                <TableHead className="text-center font-semibold text-[11px] uppercase sticky top-0 right-0 bg-slate-100 z-[40] border-l border-b shadow-[-2px_0_5px_rgba(0,0,0,0.1)] w-[240px] p-0">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {itemsLoading ? (
                <TableRow><TableCell colSpan={25} className="text-center py-20"><Loader2 className="animate-spin mx-auto text-primary h-10 w-10" /></TableCell></TableRow>
              ) : paginatedRows.map((j, i) => {
                const statusInfo = STATUS_OPTIONS.find(o => o.value === j.status) || { color: "bg-slate-500", rowBg: "bg-slate-100" };
                const isHighlighted = highlightedId === j.id;
                const canSlit = ["Main", "Stock", "Slitting", "Available"].includes(j.status);
                
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
                    <TableCell className={cn("text-center font-bold text-[12px] text-slate-400 border-r border-b sticky left-[40px] z-10 p-0 shadow-[2px_0_5px_rgba(0,0,0,0.05)]", statusInfo.rowBg, isHighlighted && "bg-yellow-200")}>{(currentPage - 1) * rowsPerPage + i + 1}</TableCell>
                    <TableCell className={cn("font-bold text-[15px] text-primary border-r border-b text-left font-mono sticky left-[100px] z-10 p-0 shadow-[2px_0_5px_rgba(0,0,0,0.05)]", statusInfo.rowBg, isHighlighted && "bg-yellow-200")}>
                      <div className="flex items-center gap-1 h-full px-4" style={{ paddingLeft: `${(j.level || 0) * 24 + 16}px` }}>
                        {j.level > 0 && (
                          <span className="text-slate-400 font-mono font-bold mr-1">
                            {j.isLast ? '└' : '├'}
                          </span>
                        )}
                        {j.rollNo}
                      </div>
                    </TableCell>
                    <TableCell className="border-r border-b text-center">
                      <Badge className={cn("text-[10px] font-semibold text-white px-2", statusInfo.color)}>{j.status}</Badge>
                    </TableCell>
                    {visibleColumns['paperCompany'] && <TableCell className="text-[13px] font-medium border-r border-b px-3 text-center">{j.paperCompany}</TableCell>}
                    {visibleColumns['paperType'] && <TableCell className="text-[13px] font-medium border-r border-b px-3 text-center">{j.paperType}</TableCell>}
                    {visibleColumns['widthMm'] && <TableCell className="text-[13px] border-r border-b font-mono font-medium text-center">{j.widthMm}</TableCell>}
                    {visibleColumns['lengthMeters'] && <TableCell className="text-[13px] border-r border-b font-mono font-medium text-center">{j.lengthMeters}</TableCell>}
                    {visibleColumns['sqm'] && <TableCell className="text-[13px] border-r border-b font-semibold text-primary font-mono text-center">{j.sqm}</TableCell>}
                    {visibleColumns['gsm'] && <TableCell className="text-[13px] border-r border-b font-mono font-medium text-center">{j.gsm}</TableCell>}
                    {visibleColumns['weightKg'] && <TableCell className="text-[13px] border-r border-b font-mono font-medium text-center">{j.weightKg || 0}</TableCell>}
                    {visibleColumns['purchaseRate'] && <TableCell className="text-[13px] border-r border-b font-mono font-medium text-center">₹{j.purchaseRate || 0}</TableCell>}
                    {visibleColumns['receivedDate'] && <TableCell className="text-[13px] font-medium border-r border-b px-2 text-center">{j.receivedDate}</TableCell>}
                    {visibleColumns['dateOfUsed'] && <TableCell className="text-[13px] font-medium border-r border-b px-2 text-center">{j.dateOfUsed || '-'}</TableCell>}
                    {visibleColumns['jobNo'] && <TableCell className="text-[13px] border-r border-b font-mono font-semibold text-slate-700 text-center">{j.jobNo || '-'}</TableCell>}
                    {visibleColumns['jobSize'] && <TableCell className="text-[13px] border-r border-b text-center">{j.jobSize || '-'}</TableCell>}
                    {visibleColumns['jobName'] && <TableCell className="text-[13px] font-medium border-r border-b truncate max-w-[150px] text-center">{j.jobName || '-'}</TableCell>}
                    {visibleColumns['lotNo'] && <TableCell className="text-[13px] border-r border-b font-mono font-medium text-center">{j.lotNo || '-'}</TableCell>}
                    {visibleColumns['companyRollNo'] && <TableCell className="text-[13px] border-r border-b text-center font-medium">{j.companyRollNo || '-'}</TableCell>}
                    {visibleColumns['remarks'] && <TableCell className="text-[13px] border-r border-b px-2 italic truncate max-w-[150px] text-center">{j.remarks || '-'}</TableCell>}
                    <TableCell className={cn("text-center border-b sticky right-0 z-10 border-l shadow-[-2px_0_5px_rgba(0,0,0,0.05)] w-[240px] p-0", statusInfo.rowBg, isHighlighted && "bg-yellow-200")}>
                      <div className="flex items-center justify-center gap-1.5 px-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg shadow-sm" onClick={(e) => { e.stopPropagation(); setViewingRoll(j); setIsViewOpen(true); }}><Eye className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 bg-sky-500 hover:bg-sky-600 text-white rounded-lg shadow-sm" onClick={(e) => { e.stopPropagation(); handleOpenDialog(j); }}><Pencil className="h-4 w-4" /></Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          disabled={!canSlit}
                          className={cn("h-8 w-8 rounded-lg shadow-sm text-white transition-all", canSlit ? "bg-orange-500 hover:bg-orange-600 opacity-100" : "bg-slate-300 cursor-not-allowed opacity-50")} 
                          onClick={(e) => { e.stopPropagation(); if(canSlit) router.push(`/inventory/slitting?rollNo=${j.rollNo}`); }}
                        >
                          <Scissors className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 bg-slate-700 hover:bg-slate-800 text-white rounded-lg shadow-sm" onClick={(e) => { e.stopPropagation(); setPrintingRolls([j]); setIsPrintOpen(true); }}><Printer className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 bg-rose-500 hover:bg-rose-600 text-white rounded-lg shadow-sm" onClick={(e) => { e.stopPropagation(); if(confirm('Delete permanently?')) deleteDoc(doc(firestore!, 'paper_stock', j.id)); }}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <div className="bg-slate-50 p-4 border-t flex items-center justify-between shrink-0 px-8 rounded-b-2xl print:hidden">
          <div className="flex items-center gap-4">
            <Select value={rowsPerPage.toString()} onValueChange={v => { setRowsPerPage(Number(v)); setCurrentPage(1); }}>
              <SelectTrigger className="h-9 w-[120px] bg-white text-[12px] font-semibold uppercase rounded-xl border-none shadow-sm"><SelectValue /></SelectTrigger>
              <SelectContent className="z-[100] border-none shadow-2xl rounded-xl">
                {[10, 20, 50, 100].map(v => <SelectItem key={v} value={v.toString()}>{v} Rows</SelectItem>)}
              </SelectContent>
            </Select>
            <span className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wider">Showing {filteredRows.length === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1}–{Math.min(currentPage * rowsPerPage, filteredRows.length)} of {filteredRows.length} Rolls</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" className="h-9 px-6 text-[12px] font-semibold uppercase border-2 rounded-xl" onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1}><ChevronLeft className="h-4 w-4 mr-2" /> Prev</Button>
            <span className="text-[12px] font-bold bg-white border-2 border-slate-200 h-9 w-12 flex items-center justify-center rounded-xl shadow-inner">{currentPage}</span>
            <Button variant="outline" size="sm" className="h-9 px-6 text-[12px] font-semibold uppercase border-2 rounded-xl" onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage >= totalPages}>Next <ChevronRight className="h-4 w-4 ml-2" /></Button>
          </div>
        </div>
      </Card>

      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="sm:max-w-[800px] p-0 overflow-hidden rounded-3xl border-none shadow-3xl [&>button]:text-white [&>button]:opacity-100">
          <div className="bg-slate-900 text-white p-8">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center gap-2">
                  <Package className="h-4 w-4" /> Technical Profile
                </h3>
                <p className="text-3xl font-bold tracking-tight">Roll ID: {viewingRoll?.rollNo}</p>
              </div>
              <Badge className={cn("px-4 py-1.5 rounded-full font-semibold text-[10px] uppercase shadow-lg", STATUS_OPTIONS.find(o => o.value === viewingRoll?.status)?.color || "bg-slate-500")}>
                {viewingRoll?.status}
              </Badge>
            </div>
          </div>
          <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-8 bg-slate-50 industrial-scroll overflow-y-auto max-h-[70vh]">
            <div className="space-y-6 text-left">
              <h4 className="text-sm font-semibold text-slate-700 border-b pb-2 flex items-center gap-2">
                <Info className="h-3 w-3 text-primary" /> Basic Details
              </h4>
              <ProfileField icon={Hash} label="Roll No" value={viewingRoll?.rollNo} highlight />
              <ProfileField icon={Building2} label="Paper Company" value={viewingRoll?.paperCompany} />
              <ProfileField icon={FileText} label="Paper Type" value={viewingRoll?.paperType} />
              <ProfileField icon={Layers} label="Company Roll No" value={viewingRoll?.companyRollNo} />
            </div>
            <div className="space-y-6 text-left">
              <h4 className="text-sm font-semibold text-slate-700 border-b pb-2 flex items-center gap-2">
                <Maximize2 className="h-3 w-3 text-primary" /> Size Details
              </h4>
              <ProfileField icon={Ruler} label="Width (MM)" value={viewingRoll?.widthMm} />
              <ProfileField icon={ArrowRightLeft} label="Length (MTR)" value={viewingRoll?.lengthMeters} />
              <ProfileField icon={Layers} label="SQM" value={viewingRoll?.sqm} highlight />
              <ProfileField icon={Weight} label="GSM" value={viewingRoll?.gsm} />
              <ProfileField icon={Scale} label="Weight (KG)" value={viewingRoll?.weightKg} />
            </div>
            <div className="space-y-6 text-left">
              <h4 className="text-sm font-semibold text-slate-700 border-b pb-2 flex items-center gap-2">
                <CircleDollarSign className="h-3 w-3 text-primary" /> Info & Jobs
              </h4>
              <ProfileField icon={CircleDollarSign} label="Purchase Rate" value={`₹${viewingRoll?.purchaseRate || 0}`} />
              <ProfileField icon={Calendar} label="Received Date" value={viewingRoll?.receivedDate} />
              <ProfileField icon={CalendarDays} label="Job No" value={viewingRoll?.jobNo} highlight />
              <ProfileField icon={History} label="Lot No" value={viewingRoll?.lotNo} />
              <ProfileField icon={MessageSquare} label="Remarks" value={viewingRoll?.remarks} />
            </div>
          </div>
          <DialogFooter className="p-6 bg-white border-t flex flex-row gap-3">
            <Button variant="outline" className="flex-1 h-12 rounded-xl font-semibold uppercase text-[10px] tracking-wider border-2" onClick={() => setIsViewOpen(false)}>Close</Button>
            <Button className="flex-1 h-12 rounded-xl bg-slate-800 hover:bg-slate-900 font-semibold uppercase text-[10px] tracking-wider" onClick={() => { setPrintingRolls([viewingRoll]); setIsPrintOpen(true); }}>
              <Printer className="h-4 w-4 mr-2" /> Print Label
            </Button>
            <Button className="flex-1 h-12 rounded-xl bg-primary hover:bg-primary/90 font-semibold uppercase text-[10px] tracking-wider" onClick={() => { setEditingRoll(viewingRoll); setFormData({...viewingRoll}); setIsViewOpen(false); setIsDialogOpen(true); }}>
              <Pencil className="h-4 w-4 mr-2" /> Edit Roll
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[1000px] p-0 overflow-hidden rounded-3xl border-none shadow-3xl [&>button]:text-white [&>button]:opacity-100">
          <form onSubmit={handleSave}>
            <div className="bg-slate-900 text-white p-6">
              <DialogTitle className="text-xl font-semibold uppercase tracking-wider flex items-center gap-3">
                {editingRoll ? <Pencil className="h-5 w-5 text-primary" /> : <Plus className="h-5 w-5 text-primary" />}
                {editingRoll ? 'Edit Technical Master Record' : 'Add New Master Roll Entry'}
              </DialogTitle>
              <DialogDescription className="text-slate-400 font-medium uppercase text-[10px] mt-1 tracking-wider">Enterprise Technical Inventory Registry System</DialogDescription>
            </div>
            <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-8 max-h-[75vh] overflow-y-auto bg-slate-50 industrial-scroll text-left">
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-primary border-b border-primary/10 pb-2 text-left">Identity & Source</h4>
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-semibold opacity-50 block text-left">Roll ID / Serial *</Label>
                  <Input value={formData.rollNo} onChange={e => setFormData({...formData, rollNo: e.target.value})} placeholder="e.g. T-1044" required className="h-11 rounded-xl font-semibold border-2 bg-white" disabled={!!editingRoll} />
                </div>
                <div className="space-y-2 text-left">
                  <Label className="text-[10px] uppercase font-semibold opacity-50 block text-left">Current Status</Label>
                  <Select value={isCustomStatus ? "Other" : formData.status} onValueChange={(val) => { if (val === "Other") { setIsCustomStatus(true); } else { setIsCustomStatus(false); setFormData({...formData, status: val}); } }}>
                    <SelectTrigger className="h-11 rounded-xl border-2 bg-white font-semibold"><SelectValue placeholder="Select Status" /></SelectTrigger>
                    <SelectContent className="z-[100] border-none shadow-2xl rounded-xl">
                      {STATUS_OPTIONS.map(opt => <SelectItem key={opt.value} value={opt.value} className="font-semibold py-3"><div className="flex items-center gap-2"><div className={cn("w-2 h-2 rounded-full", opt.color)} />{opt.label}</div></SelectItem>)}
                      <SelectSeparator />
                      <SelectItem value="Other" className="font-semibold text-primary">Add Custom Stage...</SelectItem>
                    </SelectContent>
                  </Select>
                  {isCustomStatus && <Input placeholder="Type custom stage name..." className="mt-2 h-11 rounded-xl font-semibold border-2 border-primary/20 bg-primary/5" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} />}
                </div>
                <div className="space-y-2"><Label className="text-[10px] uppercase font-semibold opacity-50 block text-left">Paper Company</Label><Input list="companies-list" value={formData.paperCompany} onChange={e => setFormData({...formData, paperCompany: e.target.value})} className="h-11 rounded-xl border-2 bg-white font-medium" /></div>
                <div className="space-y-2"><Label className="text-[10px] uppercase font-semibold opacity-50 block text-left">Paper Type</Label><Input list="types-list" value={formData.paperType} onChange={e => setFormData({...formData, paperType: e.target.value})} className="h-11 rounded-xl border-2 bg-white font-medium" /></div>
                <div className="space-y-2"><Label className="text-[10px] uppercase font-semibold opacity-50 block text-left">Company Roll No</Label><Input list="mfr-rolls-list" value={formData.companyRollNo} onChange={e => setFormData({...formData, companyRollNo: e.target.value})} className="h-11 rounded-xl border-2 bg-white font-medium" /></div>
                <div className="space-y-2"><Label className="text-[10px] uppercase font-semibold opacity-50 block text-left">Lot / Batch No</Label><Input list="lots-list" value={formData.lotNo} onChange={e => setFormData({...formData, lotNo: e.target.value})} className="h-11 rounded-xl border-2 bg-white font-medium" /></div>
              </div>
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-primary border-b border-primary/10 pb-2 text-left">Technical Specs</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label className="text-[10px] uppercase font-semibold opacity-50 block text-left">Width (MM)</Label><Input type="number" value={formData.widthMm} onChange={e => setFormData({...formData, widthMm: Number(e.target.value)})} className="h-11 rounded-xl border-2 bg-white font-semibold" /></div>
                  <div className="space-y-2"><Label className="text-[10px] uppercase font-semibold opacity-50 block text-left">Length (MTR)</Label><Input type="number" value={formData.lengthMeters} onChange={e => setFormData({...formData, lengthMeters: Number(e.target.value)})} className="h-11 rounded-xl border-2 bg-white font-semibold" /></div>
                </div>
                <div className="space-y-2"><Label className="text-[10px] uppercase font-semibold opacity-50 block text-left">Calculated SQM (System)</Label><div className="h-11 rounded-xl border-2 border-dashed bg-slate-100 flex items-center px-4 font-semibold text-primary">{calculatedSqm}</div></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label className="text-[10px] uppercase font-semibold opacity-50 block text-left">GSM</Label><Input list="gsms-list" type="number" value={formData.gsm} onChange={e => setFormData({...formData, gsm: Number(e.target.value)})} className="h-11 rounded-xl border-2 bg-white font-semibold" /></div>
                  <div className="space-y-2"><Label className="text-[10px] uppercase font-semibold opacity-50 block text-left">Weight (KG)</Label><Input type="number" value={formData.weightKg} onChange={e => setFormData({...formData, weightKg: Number(e.target.value)})} className="h-11 rounded-xl border-2 bg-white font-semibold" /></div>
                </div>
                <div className="space-y-2"><Label className="text-[10px] uppercase font-semibold opacity-50 block text-left">Purchase Rate (₹)</Label><Input type="number" value={formData.purchaseRate} onChange={e => setFormData({...formData, purchaseRate: Number(e.target.value)})} className="h-11 rounded-xl border-2 bg-white font-semibold" /></div>
              </div>
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-primary border-b border-primary/10 pb-2 text-left">Workflow & History</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label className="text-[10px] uppercase font-semibold opacity-50 block text-left">Received Date</Label><Input type="date" value={formData.receivedDate} onChange={e => setFormData({...formData, receivedDate: e.target.value})} className="h-11 rounded-xl border-2 bg-white font-medium" /></div>
                  <div className="space-y-2"><Label className="text-[10px] uppercase font-semibold opacity-50 block text-left">Date Used</Label><Input type="date" value={formData.dateOfUsed} onChange={e => setFormData({...formData, dateOfUsed: e.target.value})} className="h-11 rounded-xl border-2 bg-white font-medium" /></div>
                </div>
                <div className="space-y-2"><Label className="text-[10px] uppercase font-semibold opacity-50 block text-left">Job ID / Order Ref</Label><Input value={formData.jobNo} onChange={e => setFormData({...formData, jobNo: e.target.value})} className="h-11 rounded-xl border-2 bg-white font-semibold" /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label className="text-[10px] uppercase font-semibold opacity-50 block text-left">Job Name</Label><Input value={formData.jobName} onChange={e => setFormData({...formData, jobName: e.target.value})} className="h-11 rounded-xl border-2 bg-white font-medium" /></div>
                  <div className="space-y-2"><Label className="text-[10px] uppercase font-semibold opacity-50 block text-left">Job Size</Label><Input value={formData.jobSize} onChange={e => setFormData({...formData, jobSize: e.target.value})} className="h-11 rounded-xl border-2 bg-white font-medium" /></div>
                </div>
                <div className="space-y-2 text-left">
                  <Label className="text-[10px] uppercase font-semibold opacity-50 block text-left">Technical Remarks</Label>
                  <Textarea value={formData.remarks} onChange={e => setFormData({...formData, remarks: e.target.value})} className="rounded-xl border-2 bg-white font-medium min-h-[80px]" />
                </div>
              </div>
            </div>
            <DialogFooter className="p-6 bg-white border-t">
              <Button type="button" variant="outline" className="h-12 px-8 rounded-xl font-semibold uppercase text-[10px] tracking-wider border-2" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isProcessing} className="h-12 px-12 rounded-xl bg-primary hover:bg-primary/90 text-white font-semibold uppercase text-[10px] tracking-wider shadow-xl">
                {isProcessing ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                {editingRoll ? 'Update Master Record' : 'Initialize Roll Record'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <datalist id="companies-list">
        {suggestions.companies.map(c => <option key={c} value={c}>{`🏭 ${c}`}</option>)}
      </datalist>
      <datalist id="types-list">
        {suggestions.types.map(t => <option key={t} value={t}>{`📄 ${t}`}</option>)}
      </datalist>
      <datalist id="gsms-list">
        {suggestions.gsms.map(g => <option key={g} value={g}>{`⚖️ ${g} GSM`}</option>)}
      </datalist>
      <datalist id="lots-list">
        {suggestions.lots.map(l => <option key={l} value={l}>{`📦 ${l}`}</option>)}
      </datalist>
      <datalist id="mfr-rolls-list">
        {suggestions.mfrRolls.map(m => <option key={m} value={m}>{`🆔 ${m}`}</option>)}
      </datalist>

      <Dialog open={isPrintOpen} onOpenChange={setIsPrintOpen}>
        <DialogContent className="sm:max-w-[700px] p-0 overflow-hidden bg-slate-50 border-none shadow-3xl [&>button]:text-white [&>button]:opacity-100">
          <div className="bg-slate-900 text-white p-6">
            <div className="flex justify-between items-center">
              <DialogTitle className="text-xs font-semibold uppercase tracking-wider flex items-center gap-2"><Printer className="h-4 w-4 text-primary" /> Professional Print Engine</DialogTitle>
              <div className="flex items-center gap-2">
                <Label className="text-[10px] uppercase font-bold text-slate-400">Layout:</Label>
                <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                  <SelectTrigger className="h-8 w-[200px] bg-white/10 border-none text-[10px] font-bold text-white">
                    <SelectValue placeholder="Select Template" />
                  </SelectTrigger>
                  <SelectContent className="z-[100]">
                    <SelectItem value="default" className="text-[10px] font-bold">Standard Industrial (150x100)</SelectItem>
                    {labelTemplates?.map(t => (
                      <SelectItem key={t.id} value={t.id} className="text-[10px] font-bold">{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <div className="p-10 flex flex-col items-center bg-slate-200 overflow-auto max-h-[60vh] industrial-scroll gap-10">
            <div id="print-area">
              {printingRolls.map((roll, idx) => (
                <div key={roll.id} className="label-page">
                  {selectedTemplate ? (
                    <TemplateRenderer 
                      elements={selectedTemplate.elements} 
                      data={getPrintDataMapping(roll)} 
                      paperWidth={selectedTemplate.paperWidth} 
                      paperHeight={selectedTemplate.paperHeight} 
                    />
                  ) : (
                    <div className="bg-white p-8 shadow-2xl border-4 border-black relative overflow-hidden" style={{ width: '150mm', height: '100mm', color: 'black', fontFamily: 'monospace' }}>
                      <div className="flex justify-between items-center border-b-4 border-black pb-4 text-left">
                        <span className="text-3xl font-bold tracking-tighter">SHREE LABEL CREATION</span>
                        <span className="text-xl font-bold">V2.1</span>
                      </div>
                      <div className="mt-6 flex justify-between">
                        <div className="space-y-2 max-w-[60%] text-left">
                          <p className="text-[12px] font-bold uppercase opacity-60">Item Name (Substrate)</p>
                          <p className="text-3xl font-bold leading-none truncate">{roll.paperType}</p>
                          <p className="text-[12px] font-bold uppercase opacity-60 mt-4">TECHNICAL REEL ID</p>
                          <p className="text-6xl font-bold tracking-tighter leading-none">{roll.rollNo}</p>
                        </div>
                        <div className="flex flex-col items-end gap-4">
                          <div className="bg-white border-2 border-black p-1">
                            <QRCodeSVG value={roll.rollNo} size={120} />
                          </div>
                          <div className="scale-75 origin-right"><Barcode value={roll.rollNo || "00000"} width={2} height={50} fontSize={14} /></div>
                        </div>
                      </div>
                      <div className="mt-8 grid grid-cols-2 gap-x-12 gap-y-4 border-t-4 border-black pt-6">
                        <div className="flex justify-between border-b-2 border-black pb-1"><span className="text-xl font-bold">Width:</span><span className="text-2xl font-bold">{roll.widthMm} mm</span></div>
                        <div className="flex justify-between border-b-2 border-black pb-1"><span className="text-xl font-bold">Length:</span><span className="text-2xl font-bold">{roll.lengthMeters} mtr</span></div>
                        <div className="flex justify-between border-b-2 border-black pb-1"><span className="text-xl font-bold">GSM:</span><span className="text-2xl font-bold">{roll.gsm}</span></div>
                        <div className="flex justify-between border-b-2 border-black pb-1"><span className="text-xl font-bold">Weight:</span><span className="text-2xl font-bold">{roll.weightKg} kg</span></div>
                      </div>
                      <div className="mt-auto absolute bottom-6 left-8 right-8 flex justify-between text-[14px] font-semibold uppercase">
                        <span>Company: {roll.paperCompany}</span>
                        <span>Received: {roll.receivedDate}</span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
          <DialogFooter className="p-6 bg-white border-t">
            <Button variant="outline" className="h-12 px-8 rounded-xl font-semibold uppercase text-[10px] tracking-wider border-2" onClick={() => setIsPrintOpen(false)}>Cancel</Button>
            <Button className="h-12 px-12 rounded-xl bg-slate-900 hover:bg-black font-semibold uppercase text-[10px] tracking-wider shadow-xl" onClick={() => window.print()}>
              <Printer className="h-4 w-4 mr-2" /> Execute Print ({printingRolls.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Report Preview Dialog */}
      <Dialog open={isReportOpen} onOpenChange={setIsReportOpen}>
        <DialogContent className="sm:max-w-[95vw] h-[95vh] p-0 overflow-hidden bg-slate-100 rounded-none border-none shadow-3xl">
          <div className="bg-slate-900 text-white p-4 flex items-center justify-between no-print">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-primary/20 rounded-lg flex items-center justify-center"><FileText className="h-5 w-5 text-primary" /></div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest">Stock Report Generator</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase">A4 Industrial Layout • {reportRows.length} Rows</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" className="bg-white/10 border-white/20 text-white hover:bg-white/20 h-10 px-6 font-black uppercase text-[10px] tracking-widest" onClick={() => setIsReportOpen(false)}>Close Preview</Button>
              <Button className="bg-primary hover:bg-primary/90 text-white h-10 px-8 font-black uppercase text-[10px] tracking-widest shadow-xl" onClick={() => window.print()}>
                <Printer className="h-4 w-4 mr-2" /> Execute A4 Print
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-10 bg-slate-200 industrial-scroll">
            <div id="stock-report-print" className="bg-white mx-auto shadow-2xl p-12 min-h-screen text-black font-sans" style={{ width: '210mm' }}>
              <div className="border-b-4 border-black pb-6 flex justify-between items-end">
                <div className="space-y-1">
                  <h1 className="text-4xl font-black tracking-tighter">SHREE LABEL CREATION</h1>
                  <p className="text-sm font-bold uppercase tracking-widest opacity-70">Industrial Paper Stock Registry</p>
                </div>
                <div className="text-right space-y-1">
                  <h2 className="text-xl font-black uppercase">Technical Report</h2>
                  <p className="text-xs font-bold">DATE: {new Date().toLocaleDateString()}</p>
                </div>
              </div>

              <div className="mt-8 grid grid-cols-1 gap-4 text-[10px] font-bold bg-slate-50 p-4 border rounded-lg">
                <div className="flex gap-2">
                  <span className="text-primary uppercase shrink-0">Active Filters:</span>
                  <span className="opacity-70 font-mono uppercase leading-relaxed">{activeFiltersSummary}</span>
                </div>
              </div>

              <table className="w-full mt-8 border-collapse table-fixed">
                <thead>
                  <tr className="bg-slate-100 border-y-2 border-black">
                    {COLUMN_KEYS.map(col => visibleColumns[col.id] && (
                      <th key={col.id} className="p-2 text-center text-[8px] font-black uppercase border-r border-black/10 overflow-hidden truncate">
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reportRows.map((r, i) => (
                    <tr key={i} className="border-b border-black/10 h-8">
                      {COLUMN_KEYS.map(col => visibleColumns[col.id] && (
                        <td key={col.id} className={cn(
                          "p-1 text-[8px] border-r border-black/10 text-center overflow-hidden truncate",
                          col.id === 'rollNo' ? "font-black font-mono text-primary" : "font-medium"
                        )}>
                          {r[col.id] || '-'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="mt-10 grid grid-cols-3 gap-8 p-6 bg-slate-900 text-white rounded-xl shadow-xl">
                <div className="text-center space-y-1 border-r border-white/10">
                  <p className="text-[9px] font-black uppercase opacity-60 tracking-widest">Total Inventory Units</p>
                  <p className="text-2xl font-black">{reportTotals.rolls}</p>
                </div>
                <div className="text-center space-y-1 border-r border-white/10">
                  <p className="text-[9px] font-black uppercase opacity-60 tracking-widest">Total Material Weight</p>
                  <p className="text-2xl font-black">{reportTotals.weight.toLocaleString()} <small className="text-[10px] font-bold">KG</small></p>
                </div>
                <div className="text-center space-y-1">
                  <p className="text-[9px] font-black uppercase opacity-60 tracking-widest">Total Square Meters</p>
                  <p className="text-2xl font-black">{reportTotals.sqm.toLocaleString()} <small className="text-[10px] font-bold">SQM</small></p>
                </div>
              </div>

              <div className="mt-20 flex justify-between pt-10 border-t border-dashed border-black/20 text-[9px] font-black uppercase opacity-50">
                <p>Generated by {user?.displayName || user?.email}</p>
                <p>ERP System v3.5 • Confidential Operational Data</p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isScannerOpen} onOpenChange={setIsScannerOpen}>
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden rounded-3xl border-none shadow-3xl [&>button]:text-white [&>button]:opacity-100">
          <div className="bg-slate-900 text-white p-6"><DialogTitle className="text-xs font-semibold uppercase tracking-wider flex items-center gap-2"><Camera className="h-4 w-4 text-primary" /> Technical Intake Scanner</DialogTitle></div>
          <div className="p-8 space-y-6">
            <div id="reader" className="rounded-2xl overflow-hidden border-4 border-slate-200 shadow-inner bg-black aspect-square"></div>
            <div className="p-4 bg-primary/5 border-2 border-dashed border-primary/20 rounded-2xl text-center">
              <p className="text-[10px] font-semibold uppercase text-primary tracking-wider">Alignment Required</p>
              <p className="text-xs text-muted-foreground font-medium mt-1">Center the Roll QR within the scan area for automatic detection.</p>
            </div>
          </div>
          <DialogFooter className="p-6 bg-white border-t"><Button variant="outline" className="w-full h-12 rounded-xl font-semibold uppercase text-[10px] tracking-wider border-2" onClick={() => setIsScannerOpen(false)}>Terminate Camera</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <style jsx global>{`
        @media print {
          /* 1. Hide every UI element by default */
          body * { 
            visibility: hidden !important; 
          }
          
          /* 2. Target specific print areas and their children */
          #print-area, #print-area *, 
          #stock-report-print, #stock-report-print * { 
            visibility: visible !important; 
          }
          
          /* 3. Global Print Sanity */
          @page { 
            size: A4 portrait; 
            margin: 10mm !important; 
          }
          
          body { 
            background: white !important; 
            margin: 0 !important;
            padding: 0 !important;
          }

          /* 4. Labels Layout (Small Thermal Labels) */
          #print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            display: block !important;
          }

          .label-page {
            page-break-after: always;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
          }

          /* 5. Stock Report Layout (A4 Management Report) */
          #stock-report-print {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 210mm !important;
            display: block !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            box-shadow: none !important;
          }

          #stock-report-print table {
            width: 100% !important;
            border-collapse: collapse !important;
            table-layout: fixed !important; /* Forces columns to stay aligned */
          }

          #stock-report-print thead {
            display: table-header-group !important; /* Repeats header on every page */
          }

          #stock-report-print tr {
            page-break-inside: avoid !important; /* Prevents rows from splitting */
          }

          #stock-report-print th, #stock-report-print td {
            border: 1px solid #000 !important;
            padding: 4px !important;
            font-size: 8px !important;
          }

          /* Hide Dialog overlays and close buttons */
          .no-print, 
          [role="dialog"] button[aria-label="Close"],
          .z-portal,
          header,
          aside {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}

function ProfileField({ icon: Icon, label, value, highlight = false }: { icon: any, label: string, value: any, highlight?: boolean }) {
  return (
    <div className="space-y-1.5 transition-all group text-left">
      <Label className="text-[10px] uppercase font-semibold text-slate-400 flex items-center gap-1.5 transition-colors group-hover:text-primary block text-left">
        <Icon className="h-3 w-3" /> {label}
      </Label>
      <div className={cn(
        "text-sm font-semibold tracking-tight rounded-xl p-3 bg-white border border-slate-200 shadow-sm text-left",
        highlight ? "text-primary text-base border-primary/20 bg-primary/5" : "text-slate-800"
      )}>
        {value || "—"}
      </div>
    </div>
  );
}
