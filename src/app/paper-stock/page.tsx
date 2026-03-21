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
  CalendarDays,
  Save,
  X,
  Settings2,
  FilterX,
  RotateCcw,
  CheckCircle2,
  IdCard,
  Search,
  RotateCcw as RotateCcwIcon,
  Activity,
  FileSpreadsheet,
  FileDown
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
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { useFirestore, useUser, useCollection, useMemoFirebase, useDoc } from "@/firebase"
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
  getDocs,
  orderBy
} from "firebase/firestore"
import { cn } from "@/lib/utils"
import { ActionModal, ModalType } from "@/components/action-modal"
import { QRCodeSVG } from 'qrcode.react'
import Barcode from 'react-barcode'
import { Html5QrcodeScanner } from "html5-qrcode"
import { PaperStockFilters } from "@/components/inventory/paper-stock-filters"
import { ColumnHeaderFilter } from "@/components/inventory/column-header-filter"
import { useToast } from "@/hooks/use-toast"
import { TemplateRenderer } from "@/components/printing/template-renderer"
import * as XLSX from 'xlsx'

const STATUS_OPTIONS = [
  { value: "Main", label: "Main", color: "bg-purple-600", rowBg: "bg-purple-50" },
  { value: "Stock", label: "Stock", color: "bg-emerald-600", rowBg: "bg-emerald-50" },
  { value: "Slitting", label: "Slitting", color: "bg-orange-500", rowBg: "bg-orange-50" },
  { value: "Job Assign", label: "Job Assign", color: "bg-rose-500", rowBg: "bg-rose-50" },
  { value: "In Production", label: "In Production", color: "bg-cyan-500", rowBg: "bg-cyan-50" },
  { value: "Consumed", label: "Consumed", color: "bg-slate-400", rowBg: "bg-slate-100" },
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
  const { toast } = useToast()
  const { user } = useUser()
  const router = useRouter()
  const firestore = useFirestore()
  
  const [isMounted, setIsMounted] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isViewOpen, setIsViewOpen] = useState(false)
  const [isPrintOpen, setIsPrintOpen] = useState(false)
  const [isReportOpen, setIsReportOpen] = useState(false)
  const [isScannerOpen, setIsScannerOpen] = useState(false)
  const [isManualJobCardOpen, setIsManualJobCardOpen] = useState(false)
  
  const [editingRoll, setEditingRoll] = useState<any>(null)
  const [viewingRoll, setViewingRoll] = useState<any>(null)
  const [printingRolls, setPrintingRolls] = useState<any[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  
  const [currentPage, setCurrentPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(50) 
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'rollNo', direction: 'desc' })
  const [highlightedId, setHighlightedId] = useState<string | null>(null)
  const [isCustomStatus, setIsCustomStatus] = useState(false)
  const [siteOrigin, setSiteOrigin] = useState("")

  // Template Selection State
  const [selectedLabelTemplateId, setSelectedLabelTemplateId] = useState("default")
  const [selectedReportTemplateId, setSelectedReportTemplateId] = useState("default")

  const [headerFilters, setHeaderFilters] = useState<Record<string, string[]>>({})
  const [filterMode, setFilterMode] = useState<'quick' | 'advanced'>('quick')

  const [manualParentRoll, setManualParentRoll] = useState("")
  const [manualChildRolls, setManualChildRolls] = useState<string[]>([])
  const [manualMachine, setManualMachine] = useState("")
  const [manualOperator, setManualOperator] = useState("")
  const [parentSearch, setParentSearch] = useState("")

  const defaultVisibleColumns = useMemo(() => COLUMN_KEYS.reduce((acc, col) => ({ ...acc, [col.id]: true }), {}), []);
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(defaultVisibleColumns)

  useEffect(() => { 
    setIsMounted(true);
    if (typeof window !== 'undefined') {
      setSiteOrigin(window.location.origin);
      const saved = localStorage.getItem('paperStockVisibleColumns')
      if (saved) {
        try { setVisibleColumns(prev => ({ ...prev, ...JSON.parse(saved) })) } catch (e) {}
      }
    }
  }, [])

  useEffect(() => {
    if (isMounted) localStorage.setItem('paperStockVisibleColumns', JSON.stringify(visibleColumns))
  }, [visibleColumns, isMounted])

  const [modal, setModal] = useState<{ isOpen: boolean; type: ModalType; title: string; description?: string; onConfirm?: () => void; }>({ isOpen: false, type: 'SUCCESS', title: '' });

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

  // Data Subscriptions
  const registryQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'paper_stock'), limit(10000));
  }, [firestore]);

  const machinesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'machines'), where('status', '==', 'Active'));
  }, [firestore]);

  const usersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'users');
  }, [firestore]);

  const { data: rolls, isLoading: itemsLoading } = useCollection(registryQuery);
  const { data: machines } = useCollection(machinesQuery);
  const { data: users } = useCollection(usersQuery);

  // Template Queries
  const labelTemplatesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'print_templates'), where('documentType', '==', 'Industrial Label'));
  }, [firestore]);

  const reportTemplatesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'print_templates'), where('documentType', '==', 'Report'));
  }, [firestore]);

  const { data: labelTemplates } = useCollection(labelTemplatesQuery);
  const { data: reportTemplates } = useCollection(reportTemplatesQuery);

  const uniqueCompanies = useMemo(() => Array.from(new Set(rolls?.map(r => r.paperCompany).filter(Boolean))).sort(), [rolls]);
  const uniqueTypes = useMemo(() => Array.from(new Set(rolls?.map(r => r.paperType).filter(Boolean))).sort(), [rolls]);

  const parentRolls = useMemo(() => rolls?.filter(r => !r.rollNo.includes('-')) || [], [rolls]);
  
  const searchedParentRolls = useMemo(() => {
    if (!parentSearch) return parentRolls;
    return parentRolls.filter(r => r.rollNo.toLowerCase().includes(parentSearch.toLowerCase()));
  }, [parentRolls, parentSearch]);

  const filteredChildRollsManual = useMemo(() => {
    if (!manualParentRoll) return [];
    return rolls?.filter(r => r.rollNo.startsWith(manualParentRoll + '-') && r.rollNo !== manualParentRoll) || [];
  }, [rolls, manualParentRoll]);

  const operators = useMemo(() => {
    if (!users) return [];
    return users.filter(u => u.roles?.includes('Operator') || u.roles?.includes('Admin'));
  }, [users]);

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
    
    let result = rolls.filter(item => {
      if (filters.search) {
        const s = filters.search.toLowerCase();
        const matchesGlobal = Object.values(item).some(v => String(v || "").toLowerCase().includes(s));
        if (!matchesGlobal) return false;
      }
      
      if (filters.lotNoSearch && !String(item.lotNo || "").toLowerCase().includes(filters.lotNoSearch.toLowerCase())) return false;
      if (filters.rollNoSearch && !String(item.rollNo || "").toLowerCase().includes(filters.rollNoSearch.toLowerCase())) return false;
      
      if (filters.paperCompany?.length > 0 && !filters.paperCompany.includes(String(item.paperCompany || ""))) return false;
      if (filters.paperType?.length > 0 && !filters.paperType.includes(String(item.paperType || ""))) return false;
      if (filters.gsm?.length > 0 && !filters.gsm.includes(String(item.gsm || ""))) return false;
      if (filters.status?.length > 0 && !filters.status.includes(String(item.status || ""))) return false;
      
      if (filters.receivedFrom && item.receivedDate < filters.receivedFrom) return false;
      if (filters.receivedTo && item.receivedDate > filters.receivedTo) return false;

      if (filterMode === 'advanced') {
        for (const [key, selected] of Object.entries(headerFilters)) {
          if (selected && selected.length > 0) {
            const val = String(item[key] || "");
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

  const metricsSummary = useMemo(() => {
    const summary = {
      companies: {} as Record<string, number>,
      types: {} as Record<string, number>,
      totalMtr: 0,
      totalSqm: 0,
      groups: [] as any[]
    };

    const groupMap: Record<string, any> = {};

    filteredRows.forEach(r => {
      const co = String(r.paperCompany || "Unknown").trim();
      const pt = String(r.paperType || "Other").trim();
      const key = `${co}|${pt}`;

      if (co) summary.companies[co] = (summary.companies[co] || 0) + 1;
      if (pt) summary.types[pt] = (summary.types[pt] || 0) + 1;
      summary.totalMtr += Number(r.lengthMeters || 0);
      summary.totalSqm += Number(r.sqm || 0);

      if (!groupMap[key]) {
        groupMap[key] = {
          company: co,
          paperType: pt,
          totalRolls: 0,
          totalLength: 0,
          totalSqm: 0
        };
      }
      groupMap[key].totalRolls += 1;
      groupMap[key].totalLength += Number(r.lengthMeters || 0);
      groupMap[key].totalSqm += Number(r.sqm || 0);
    });

    summary.groups = Object.values(groupMap).sort((a: any, b: any) => b.totalSqm - a.totalSqm);
    return summary;
  }, [filteredRows]);

  const hierarchicalRows = useMemo(() => {
    if (filteredRows.length === 0) return [];
    const itemMap = new Map();
    filteredRows.forEach(item => { itemMap.set(item.rollNo, { ...item, children: [] }); });
    const roots: any[] = [];
    filteredRows.forEach(item => {
      const parts = item.rollNo.split('-');
      if (parts.length > 1) {
        const parentId = parts.slice(0, -1).join('-');
        if (itemMap.has(parentId)) { itemMap.get(parentId).children.push(itemMap.get(item.rollNo)); }
        else { roots.push(itemMap.get(item.rollNo)); }
      } else { roots.push(itemMap.get(item.rollNo)); }
    });
    const flattened: any[] = [];
    const traverse = (node: any, level: number, isLast: boolean) => {
      flattened.push({ ...node, level, isLast });
      const sortedChildren = node.children.sort((a: any, b: any) => a.rollNo.localeCompare(b.rollNo));
      sortedChildren.forEach((child: any, idx: number) => { traverse(child, level + 1, idx === sortedChildren.length - 1); });
    };
    roots.forEach(root => traverse(root, 0, true));
    return flattened;
  }, [filteredRows]);

  const totalPages = Math.ceil(hierarchicalRows.length / rowsPerPage);
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return hierarchicalRows.slice(start, start + rowsPerPage);
  }, [hierarchicalRows, currentPage, rowsPerPage]);

  const handleOpenDialog = (roll?: any) => {
    if (roll) {
      setEditingRoll(roll);
      setFormData({ 
        rollNo: roll.rollNo || "", paperCompany: roll.paperCompany || "", paperType: roll.paperType || "", status: roll.status || "Main", 
        widthMm: roll.widthMm || 0, lengthMeters: roll.lengthMeters || 0, sqm: roll.sqm || 0, gsm: roll.gsm || 0, weightKg: roll.weightKg || 0,
        purchaseRate: roll.purchaseRate || 0, receivedDate: roll.receivedDate || "", dateOfUsed: roll.dateOfUsed || "", jobNo: roll.jobNo || "", 
        jobSize: roll.jobSize || "", jobName: roll.jobName || "", lotNo: roll.lotNo || "", companyRollNo: roll.companyRollNo || "", remarks: roll.remarks || ""
      });
      setIsCustomStatus(!STATUS_OPTIONS.some(o => o.value === roll.status));
    } else {
      setEditingRoll(null);
      setIsCustomStatus(false);
      let suggestedRollNo = "T-1001";
      if (rolls && rolls.length > 0) {
        const numericParts = rolls.map(r => r.rollNo).filter(id => /^T-\d+$/.test(id)).map(id => parseInt(id.split('-')[1])).filter(num => !isNaN(num));
        if (numericParts.length > 0) {
          const maxVal = Math.max(...numericParts);
          suggestedRollNo = `T-${maxVal + 1}`;
        }
      }
      setFormData({
        rollNo: suggestedRollNo, paperCompany: "", paperType: "", status: "Main", widthMm: 0, lengthMeters: 0, sqm: 0,
        gsm: 0, weightKg: 0, purchaseRate: 0, receivedDate: new Date().toISOString().split('T')[0],
        dateOfUsed: "", jobNo: "", jobSize: "", jobName: "", lotNo: "", companyRollNo: "", remarks: ""
      });
    }
    setIsDialogOpen(true);
  }

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firestore || !user || isProcessing) return;
    
    const rollId = formData.rollNo.trim().replace(/\//g, '-');
    
    if (!editingRoll && rolls?.some(r => r.rollNo === rollId)) {
      toast({ variant: "destructive", title: "Duplicate Roll ID", description: `Roll Number "${rollId}" already exists.` });
      return;
    }

    setIsProcessing(true);
    const finalData = { ...formData, rollNo: rollId, sqm: calculatedSqm, updatedAt: serverTimestamp(), updatedById: user.uid };
    try {
      if (editingRoll) { await setDoc(doc(firestore, 'paper_stock', editingRoll.id), finalData, { merge: true }); setIsDialogOpen(false); setModal({ isOpen: true, type: 'SUCCESS', title: 'Record Updated' }); }
      else { await setDoc(doc(firestore, 'paper_stock', rollId), { ...finalData, id: rollId, createdAt: serverTimestamp(), createdById: user.uid }); setIsDialogOpen(false); setModal({ isOpen: true, type: 'SUCCESS', title: 'Roll Generated' }); }
    } catch (error: any) { setModal({ isOpen: true, type: 'ERROR', title: 'Operation Failed', description: error.message }); } finally { setIsProcessing(false); }
  };

  const handleExportExcel = () => {
    setIsProcessing(true);
    try {
      const dataToExport = filteredRows.map((r, i) => {
        const row: any = { "Sl No": i + 1 };
        COLUMN_KEYS.forEach(col => {
          row[col.label] = r[col.id] || "-";
        });
        return row;
      });

      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Paper Stock Registry");
      XLSX.writeFile(wb, `Paper_Stock_Registry_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast({ title: "Export Successful", description: "Registry data saved to Excel." });
    } catch (e) {
      toast({ variant: "destructive", title: "Export Failed", description: "Could not generate Excel file." });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0 || !firestore) return;
    setModal({
      isOpen: true,
      type: 'CONFIRMATION',
      title: `Delete ${selectedIds.size} Rolls?`,
      description: `Are you sure you want to permanently remove these ${selectedIds.size} records? This action cannot be undone.`,
      onConfirm: async () => {
        setIsProcessing(true);
        try {
          const batch = writeBatch(firestore);
          selectedIds.forEach(id => {
            batch.delete(doc(firestore, 'paper_stock', id));
          });
          await batch.commit();
          setSelectedIds(new Set());
          setModal(p => ({ ...p, isOpen: false }));
          toast({ title: "Bulk Delete Successful" });
        } catch (err: any) {
          setModal({ isOpen: true, type: 'ERROR', title: 'Deletion Failed', description: err.message });
        } finally {
          setIsProcessing(false);
        }
      }
    });
  };

  const handleBulkPrint = () => {
    const toPrint = rolls?.filter(r => selectedIds.has(r.id)) || [];
    if (toPrint.length === 0) return;
    setPrintingRolls(toPrint);
    setIsPrintOpen(true);
  };

  const handleExecutePrint = async (containerId: string, templateType: 'label' | 'report') => {
    const printContent = document.getElementById(containerId);
    if (!printContent) return;

    const html2canvas = (await import('html2canvas')).default;
    
    setIsProcessing(true);
    await document.fonts.ready;

    const template = templateType === 'label' ? (activeLabelTemplate || { paperWidth: 150, paperHeight: 100 }) : (activeReportTemplate || { paperWidth: 210, paperHeight: 297 });
    const paperW = template.paperWidth;
    const paperH = template.paperHeight;

    const elements = Array.from(printContent.querySelectorAll('.label-print-item, .template-renderer-root'));
    const images: string[] = [];

    try {
      for (const el of elements) {
        const canvas = await html2canvas(el as HTMLElement, {
          scale: 4, 
          useCORS: true,
          allowTaint: true,
          logging: false,
          backgroundColor: '#ffffff',
          width: paperW * 3.78, 
          height: paperH * 3.78
        });
        images.push(canvas.toDataURL('image/png', 1.0));
      }
    } catch (err) {
      toast({ variant: "destructive", title: "Render Error" });
      setIsProcessing(false);
      return;
    }

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0'; iframe.style.bottom = '0';
    iframe.style.width = '0'; iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const renderedItems = images.map(img => `
      <div class="print-page">
        <img src="${img}" />
      </div>
    `).join('');

    const iframeDoc = iframe.contentWindow?.document || iframe.contentDocument;
    if (iframeDoc) {
      iframeDoc.write(`
        <html>
          <head>
            <title>Industrial Print</title>
            <style>
              @page { size: ${paperW}mm ${paperH}mm; margin: 0; }
              body { margin: 0; padding: 0; background: white; display: flex; flex-direction: column; align-items: center; }
              .print-page { width: ${paperW}mm; height: ${paperH}mm; page-break-after: always; break-inside: avoid; display: flex; justify-content: center; align-items: center; overflow: hidden; }
              img { width: 100%; height: 100%; object-fit: contain; image-rendering: -webkit-optimize-contrast; }
            </style>
          </head>
          <body>${renderedItems}</body>
        </html>
      `);
      iframeDoc.close();

      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => {
          document.body.removeChild(iframe);
          setIsProcessing(false);
        }, 1000);
      }, 500);
    }
  };

  const startScanner = () => {
    setIsScannerOpen(true);
    setTimeout(() => {
      const scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: 250 }, false);
      scanner.render((decodedText) => {
        const sanitizedText = decodedText.replace(/\//g, '-');
        const match = rolls?.find(r => r.rollNo === sanitizedText || r.rollNo === decodedText || r.id === sanitizedText || r.id === decodedText);
        if (match) { setHighlightedId(match.id); setViewingRoll(match); setIsViewOpen(true); scanner.clear(); setIsScannerOpen(false); }
      }, () => {});
    }, 500);
  };

  const handleCreateManualJobCard = async () => {
    if (!firestore || !user || !manualParentRoll || manualChildRolls.length === 0) return;
    setIsProcessing(true);
    const jobId = `JJC-MANUAL-${Date.now().toString().slice(-6)}`;
    const firstChild = rolls?.find(r => r.rollNo === manualChildRolls[0]);
    try {
      await setDoc(doc(firestore, 'jumbo_job_cards', jobId), {
        id: jobId, job_card_no: jobId, parent_roll: manualParentRoll, parent_rolls: [manualParentRoll],
        child_rolls: manualChildRolls, status: "PENDING", createdAt: new Date().toISOString(), createdById: user.uid, 
        type: "MANUAL", machine: manualMachine || "MANUAL", operator: manualOperator || user.displayName || user.email,
        target_job_no: firstChild?.jobNo || "", target_job_name: firstChild?.jobName || ""
      });
      setIsManualJobCardOpen(false);
      toast({ title: "Manual Job Card Created" });
      router.push('/production/jobcards/jumbo-job');
    } catch (e: any) { toast({ variant: "destructive", title: "Error", description: e.message }); } finally { setIsProcessing(false); }
  }

  const renderSortableHeader = (label: string, field: string, className = "", stickLeft?: string) => {
    if (!visibleColumns[field]) return null;
    const isActive = sortConfig.key === field;
    return (
      <TableHead className={cn("transition-colors border-r border-b sticky top-0 bg-slate-100 p-0 h-10 z-[30]", isActive && "bg-slate-200", stickLeft && "z-[40] shadow-[2px_0_5px_rgba(0,0,0,0.1)]", className)} style={stickLeft ? { left: stickLeft } : {}}>
        <div className="flex items-center justify-between h-full px-2 gap-1 group/header">
          <div className="flex items-center gap-1.5 flex-1 justify-center cursor-pointer h-full" onClick={() => requestSort(field)}>
            <span className="font-semibold text-[11px] uppercase text-slate-700 tracking-tight">{label}</span>
            {isActive ? (sortConfig.direction === 'asc' ? <ArrowUp className="h-3 w-3 text-primary" /> : <ArrowDown className="h-3 w-3 text-primary" />) : (<ArrowUpDown className="h-2.5 w-2.5 opacity-30 group-hover/header:opacity-100 transition-opacity" />)}
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

  const handleResetAll = () => { setFilters(initialFilters); setHeaderFilters({}); setSortConfig({ key: 'rollNo', direction: 'desc' }); setCurrentPage(1); setSelectedIds(new Set()); }

  const activeLabelTemplate = labelTemplates?.find(t => t.id === selectedLabelTemplateId);
  const activeReportTemplate = reportTemplates?.find(t => t.id === selectedReportTemplateId);

  const prepareRollData = (roll: any) => ({
    ...roll, roll_no: roll.rollNo || "", id: roll.id || "", parent_roll_no: roll.rollNo || "", paper_type: roll.paperType || "",
    width: roll.widthMm || 0, length: roll.lengthMeters || 0, gsm: roll.gsm || 0, weight: roll.weightKg || 0,
    company: roll.paperCompany || "", date: roll.receivedDate || "", company_name: roll.paperCompany || "",
    current_date: new Date().toLocaleDateString(), roll_url: siteOrigin ? `${siteOrigin}/roll/${roll.id}` : (roll.id || "")
  });

  if (!isMounted) return null;

  return (
    <div className="flex flex-col h-full space-y-6 font-sans animate-in fade-in duration-500 pb-20">
      <ActionModal isOpen={modal.isOpen} onClose={() => setModal(p => ({ ...p, isOpen: false }))} {...modal} />

      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-[28px] font-semibold tracking-tight">Paper Stock Details</h1>
          <p className="text-sm font-normal text-muted-foreground">Master inventory of all parent and child paper rolls.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            onClick={handleExportExcel}
            disabled={isProcessing}
            className="h-10 px-6 font-black uppercase text-[10px] tracking-widest border-2 rounded-xl"
          >
            {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileDown className="h-4 w-4 mr-2 text-emerald-500" />}
            Export To Excel
          </Button>
          <Button 
            variant="outline" 
            onClick={handleBulkPrint} 
            disabled={selectedIds.size === 0 || isProcessing}
            className="h-10 px-6 font-black uppercase text-[10px] tracking-widest border-2 rounded-xl disabled:opacity-50"
          >
            {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Printer className="h-4 w-4 mr-2 text-primary" />}
            Print Selected Labels
          </Button>
          <Button variant="outline" onClick={() => setIsReportOpen(true)} className="h-10 px-6 font-black uppercase text-[10px] tracking-widest border-2 rounded-xl">
            <FileText className="h-4 w-4 mr-2 text-primary" /> Print Stock Report
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="h-10 px-6 font-black uppercase text-[10px] tracking-widest border-2 rounded-xl">
                <Settings2 className="h-4 w-4 mr-2" /> Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 z-[100]">
              <DropdownMenuLabel className="text-[10px] uppercase font-black">Visibility Settings</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {COLUMN_KEYS.map((col) => (
                <DropdownMenuCheckboxItem key={col.id} checked={visibleColumns[col.id]} onCheckedChange={(val) => setVisibleColumns(prev => ({ ...prev, [col.id]: val }))} className="text-xs font-bold">
                  {col.label}
                </DropdownMenuCheckboxItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setVisibleColumns(defaultVisibleColumns)} className="text-[10px] font-black uppercase text-primary justify-center">
                <RotateCcw className="h-3 w-3 mr-2" /> Reset Columns
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" onClick={() => setFilterMode(filterMode === 'quick' ? 'advanced' : 'quick')} className={cn("h-10 px-6 font-black uppercase text-[10px] tracking-widest border-2 rounded-xl transition-all", filterMode === 'advanced' ? "bg-primary text-white border-primary" : "border-slate-200 text-slate-600")}>
            {filterMode === 'quick' ? <><Settings2 className="h-4 w-4 mr-2" /> Advance Filter</> : <><FilterX className="h-4 w-4 mr-2" /> Back to Quick Filter</>}
          </Button>
          <Button variant="outline" size="sm" onClick={handleResetAll} className="text-[10px] font-black uppercase text-destructive tracking-widest h-10 px-4 border-2 rounded-xl border-destructive/20 hover:bg-destructive/5"><FilterX className="h-4 w-4 mr-1.5" /> Reset Filters</Button>
        </div>
      </div>

      <div className="space-y-3 no-print">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] flex items-center gap-2">
            <LayoutGrid className="h-3 w-3 text-primary" /> Technical Inventory Summary
          </h3>
          <div className="flex gap-4 items-center">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Total Meter:</span>
              <span className="text-xs font-black text-primary">{Math.round(metricsSummary.totalMtr).toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Total SQM:</span>
              <span className="text-xs font-black text-primary">{Math.round(metricsSummary.totalSqm).toLocaleString()}</span>
            </div>
            <Badge variant="outline" className="text-[9px] font-bold h-5 border-slate-200 bg-white">
              {metricsSummary.groups.length} Technical Groups
            </Badge>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 max-h-[320px] overflow-y-auto industrial-scroll p-1 pr-2">
          {metricsSummary.groups.map((g, i) => (
            <Card key={i} className="bg-white shadow-sm border-slate-200 hover:border-primary/30 transition-all group">
              <CardContent className="p-4 space-y-3">
                <div className="flex justify-between items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-[9px] font-black uppercase text-primary truncate tracking-tighter" title={g.company}>{g.company}</p>
                    <h4 className="text-xs font-black uppercase truncate" title={g.paperType}>{g.paperType}</h4>
                  </div>
                  <Badge className="bg-slate-900 text-white font-black text-[9px] h-5 rounded-md shrink-0">{g.totalRolls} ROLLS</Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-50">
                  <div className="space-y-0.5"><p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Running Length</p><p className="text-[11px] font-black tabular-nums">{Math.round(g.totalLength).toLocaleString()}<span className="text-[8px] ml-0.5 opacity-40">MTR</span></p></div>
                  <div className="space-y-0.5 text-right"><p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Surface Area</p><p className="text-[11px] font-black text-emerald-600 tabular-nums">{Math.round(g.totalSqm).toLocaleString()}<span className="text-[8px] ml-0.5 opacity-40">SQM</span></p></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <PaperStockFilters data={rolls || []} filters={filters} setFilters={setFilters} onReset={handleResetAll} />

      <Card className="flex-1 overflow-hidden flex flex-col border-slate-200 shadow-xl rounded-2xl bg-white border-none">
        <div className="bg-slate-900 text-white p-4 px-8 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-6">
            <h2 className="font-semibold text-sm uppercase tracking-wider flex items-center gap-3"><LayoutGrid className="h-5 w-5 text-primary" /> Master Grid</h2>
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-3 animate-in slide-in-from-left-4 duration-300">
                <Separator orientation="vertical" className="h-6 bg-white/20" />
                <Badge className="bg-primary text-white font-black text-[10px]">{selectedIds.size} SELECTED</Badge>
                <Button variant="ghost" size="sm" className="h-8 px-3 text-rose-400 hover:text-white hover:bg-rose-600 font-bold uppercase text-[9px] tracking-widest rounded-lg" onClick={handleBulkDelete}><Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete Selected</Button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden">
              <Button variant="outline" size="sm" onClick={startScanner} className="h-9 px-4 bg-transparent border-primary/30 text-white font-semibold uppercase text-[10px] tracking-wider rounded-xl"><QrCode className="h-4 w-4 mr-2" /> Live Scanner</Button>
            </div>
            <Button variant="secondary" size="sm" className="h-9 px-6 bg-primary hover:bg-primary/90 text-white font-semibold uppercase text-[10px] tracking-wider rounded-xl shadow-lg border-none" onClick={() => handleOpenDialog()}><Plus className="h-4 w-4 mr-2" /> Add Roll</Button>
          </div>
        </div>

        <div className="w-full h-[800px] overflow-scroll relative border-t industrial-scroll">
          <Table className="border-separate border-spacing-0 min-w-[3000px]">
            <TableHeader className="sticky top-0 z-[30] bg-white">
              <TableRow className="h-12">
                <TableHead className="w-[40px] text-center border-r border-b sticky top-0 left-0 bg-slate-100 z-[40] p-0 shadow-[2px_0_5px_rgba(0,0,0,0.1)]">
                  <div className="flex items-center justify-center h-full"><Checkbox checked={paginatedRows.length > 0 && paginatedRows.every(r => selectedIds.has(r.id))} onCheckedChange={(val) => { const next = new Set(selectedIds); paginatedRows.forEach(r => val ? next.add(r.id) : next.delete(r.id)); setSelectedIds(next); }} /></div>
                </TableHead>
                <TableHead className="w-[60px] text-center font-semibold text-[11px] uppercase border-r border-b sticky top-0 left-[40px] bg-slate-100 z-[40] p-0 shadow-[2px_0_5px_rgba(0,0,0,0.1)]">Sl No</TableHead>
                {renderSortableHeader("Roll No", "rollNo", "w-[200px]", "100px")}
                {renderSortableHeader("Status", "status", "w-[120px]")}
                {renderSortableHeader("Paper Company", "paperCompany")}
                {renderSortableHeader("Paper Type", "paperType")}
                {renderSortableHeader("Width (MM)", "widthMm")}
                {renderSortableHeader("Length (MTR)", "lengthMeters")}
                {renderSortableHeader("SQM", "sqm")}
                {renderSortableHeader("GSM", "gsm")}
                {renderSortableHeader("Weight (KG)", "weightKg")}
                {renderSortableHeader("Purchase Rate", "purchaseRate")}
                {renderSortableHeader("Date Received", "receivedDate")}
                {renderSortableHeader("Date Used", "dateOfUsed")}
                {renderSortableHeader("Job No", "jobNo")}
                {renderSortableHeader("Job Size", "jobSize")}
                {renderSortableHeader("Job Name", "jobName")}
                {renderSortableHeader("Lot / Batch No", "lotNo")}
                {renderSortableHeader("Company Roll No", "companyRollNo")}
                {renderSortableHeader("Remarks", "remarks")}
                <TableHead className="text-center font-semibold text-[11px] uppercase sticky top-0 right-0 bg-slate-100 z-[40] border-l border-b shadow-[-2px_0_5px_rgba(0,0,0,0.1)] w-[240px] p-0">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {itemsLoading ? (
                <TableRow><TableCell colSpan={25} className="text-center py-20"><Loader2 className="animate-spin mx-auto text-primary h-10 w-10" /></TableCell></TableRow>
              ) : paginatedRows.map((j, i) => {
                const statusInfo = STATUS_OPTIONS.find(o => o.value === j.status) || { color: "bg-slate-500", rowBg: "bg-slate-100" };
                const isHighlighted = highlightedId === j.id;
                const isParent = !j.rollNo.includes('-');
                return (
                  <TableRow key={j.id} className={cn("h-12 group transition-all text-center cursor-pointer select-none", statusInfo.rowBg, isHighlighted && "bg-yellow-200 animate-pulse ring-2 ring-yellow-400 z-20")} onDoubleClick={() => handleOpenDialog(j)}>
                    <TableCell className={cn("text-center border-r border-b sticky left-0 z-10 p-0 shadow-[2px_0_5px_rgba(0,0,0,0.05)]", statusInfo.rowBg, isHighlighted && "bg-yellow-200")}><Checkbox checked={selectedIds.has(j.id)} onCheckedChange={(val) => { const next = new Set(selectedIds); val ? next.add(j.id) : next.delete(j.id); setSelectedIds(next); }} /></TableCell>
                    <TableCell className={cn("text-center font-bold text-[12px] text-slate-400 border-r border-b sticky left-[40px] z-10 p-0 shadow-[2px_0_5px_rgba(0,0,0,0.05)]", statusInfo.rowBg, isHighlighted && "bg-yellow-200")}>{(currentPage - 1) * rowsPerPage + i + 1}</TableCell>
                    <TableCell className={cn("font-bold text-[15px] text-primary border-r border-b text-left font-mono sticky left-[100px] z-10 p-0 shadow-[2px_0_5px_rgba(0,0,0,0.05)]", statusInfo.rowBg, isHighlighted && "bg-yellow-200")}><div className="flex items-center gap-1 h-full px-4" style={{ paddingLeft: `${(j.level || 0) * 24 + 16}px` }}>{j.level > 0 && <span className="text-slate-400 font-mono font-bold mr-1">{j.isLast ? '└' : '├'}</span>}{j.rollNo}</div></TableCell>
                    <TableCell className="border-r border-b text-center"><Badge className={cn("text-[10px] font-semibold text-white px-2", statusInfo.color)}>{j.status}</Badge></TableCell>
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
                    <TableCell className={cn("text-center border-b sticky right-0 z-10 border-l shadow-[-2px_0_5px_rgba(0,0,0,0.05)] w-[240px] p-0", statusInfo.rowBg, isHighlighted && "bg-yellow-200")}><div className="flex items-center justify-center gap-1.5 px-2">
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white shadow-sm" onClick={() => { setViewingRoll(j); setIsViewOpen(true); }}><Eye className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg bg-teal-50 text-teal-600 hover:bg-teal-600 hover:text-white shadow-sm" onClick={() => handleOpenDialog(j)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg bg-orange-50 text-orange-600 hover:bg-orange-600 hover:text-white shadow-sm" onClick={() => router.push(`/inventory/slitting?rollNo=${j.rollNo}`)}><Scissors className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg bg-purple-50 text-purple-600 hover:bg-purple-600 hover:text-white shadow-sm" onClick={() => { setManualParentRoll(isParent ? j.rollNo : j.rollNo.split('-')[0]); const children = rolls?.filter(r => r.rollNo.startsWith(j.rollNo + '-') && r.rollNo !== j.rollNo).map(r => r.rollNo) || []; setManualChildRolls(children); setIsManualJobCardOpen(true); }}><IdCard className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-600 hover:text-white shadow-sm" onClick={() => { setPrintingRolls([j]); setIsPrintOpen(true); }}><Printer className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white shadow-sm" onClick={() => { if(confirm('Delete permanently?')) deleteDoc(doc(firestore!, 'paper_stock', j.id)); }}><Trash2 className="h-4 w-4" /></Button>
                    </div></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <div className="bg-slate-50 p-4 border-t flex items-center justify-between shrink-0 px-8 rounded-b-2xl">
          <div className="flex items-center gap-4">
            <Select value={rowsPerPage.toString()} onValueChange={v => { setRowsPerPage(Number(v)); setCurrentPage(1); }}>
              <SelectTrigger className="h-9 w-[120px] bg-white text-[12px] font-semibold uppercase rounded-xl border-none shadow-sm"><SelectValue /></SelectTrigger>
              <SelectContent className="z-[100] border-none shadow-2xl rounded-xl">{[10, 20, 50, 100].map(v => <SelectItem key={v} value={v.toString()}>{v} Rows</SelectItem>)}</SelectContent>
            </Select>
            <span className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wider">
              Showing {filteredRows.length === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1}–{Math.min(currentPage * rowsPerPage, filteredRows.length)} of {filteredRows.length} Rolls
              <span className="mx-2 opacity-30">|</span> Page {currentPage} of {totalPages}
            </span>
          </div>
          <div className="flex items-center gap-3"><Button variant="outline" size="sm" className="h-9 px-6 text-[12px] font-semibold uppercase border-2 rounded-xl" onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1}><ChevronLeft className="h-4 w-4 mr-2" /> Prev</Button><span className="text-[12px] font-bold bg-white border-2 border-slate-200 h-9 w-12 flex items-center justify-center rounded-xl shadow-inner">{currentPage}</span><Button variant="outline" size="sm" className="h-9 px-6 text-[12px] font-semibold uppercase border-2 rounded-xl" onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage >= totalPages}>Next <ChevronRight className="h-4 w-4 ml-2" /></Button></div>
        </div>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[1000px] max-h-[90vh] p-0 flex flex-col overflow-hidden rounded-3xl border-none shadow-3xl">
          <form onSubmit={handleSave} className="flex flex-col h-full overflow-hidden">
            <div className="bg-slate-900 text-white p-6 shrink-0">
              <DialogTitle className="text-xl font-semibold uppercase tracking-wider flex items-center gap-3">
                {editingRoll ? <Pencil className="h-5 w-5 text-primary" /> : <Plus className="h-5 w-5 text-primary" />}
                {editingRoll ? 'EDIT TECHNICAL MASTER RECORD' : 'Add New Master Roll Entry'}
              </DialogTitle>
              <DialogDescription className="text-slate-400 font-medium uppercase text-[10px] mt-1 tracking-wider">Enterprise Technical Inventory Registry System</DialogDescription>
            </div>
            <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-8 flex-1 overflow-y-auto bg-slate-50 industrial-scroll text-left">
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-primary border-b border-primary/10 pb-2 text-left">Identity & Source</h4>
                <div className="space-y-2"><Label className="text-[10px] uppercase font-semibold opacity-50 block text-left">Roll ID / Serial *</Label><Input value={formData.rollNo} onChange={e => setFormData({...formData, rollNo: e.target.value})} placeholder="e.g. T-1044" required className="h-11 rounded-xl font-semibold border-2 bg-white" disabled={!!editingRoll} /></div>
                <div className="space-y-2 text-left"><Label className="text-[10px] uppercase font-semibold opacity-50 block text-left">Current Status</Label><Select value={isCustomStatus ? "Other" : formData.status} onValueChange={(val) => { if (val === "Other") { setIsCustomStatus(true); } else { setIsCustomStatus(false); setFormData({...formData, status: val}); } }}><SelectTrigger className="h-11 rounded-xl border-2 bg-white font-semibold"><SelectValue placeholder="Select Status" /></SelectTrigger><SelectContent className="z-[100]">{STATUS_OPTIONS.map(opt => <SelectItem key={opt.value} value={opt.value} className="font-semibold py-3"><div className="flex items-center gap-2"><div className={cn("w-2 h-2 rounded-full", opt.color)} />{opt.label}</div></SelectItem>)}<SelectSeparator /><SelectItem value="Other" className="font-semibold text-primary">Add Custom Stage...</SelectItem></SelectContent></Select>{isCustomStatus && <Input placeholder="Type custom stage name..." className="mt-2 h-11 rounded-xl font-semibold border-2 border-primary/20 bg-primary/5" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} />}</div>
                
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-semibold opacity-50 block text-left">Paper Company</Label>
                  <Input list="companies-list" value={formData.paperCompany} onChange={e => setFormData({...formData, paperCompany: e.target.value})} className="h-11 rounded-xl border-2 bg-white font-medium" />
                  <datalist id="companies-list">{uniqueCompanies.map(c => <option key={c} value={c} />)}</datalist>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-semibold opacity-50 block text-left">Paper Type</Label>
                  <Input list="types-list" value={formData.paperType} onChange={e => setFormData({...formData, paperType: e.target.value})} className="h-11 rounded-xl border-2 bg-white font-medium" />
                  <datalist id="types-list">{uniqueTypes.map(t => <option key={t} value={t} />)}</datalist>
                </div>
                
                <div className="space-y-2"><Label className="text-[10px] uppercase font-semibold opacity-50 block text-left">Company Roll No</Label><Input value={formData.companyRollNo} onChange={e => setFormData({...formData, companyRollNo: e.target.value})} className="h-11 rounded-xl border-2 bg-white font-medium" /></div>
                <div className="space-y-2"><Label className="text-[10px] uppercase font-semibold opacity-50 block text-left">Lot / Batch No</Label><Input value={formData.lotNo} onChange={e => setFormData({...formData, lotNo: e.target.value})} className="h-11 rounded-xl border-2 bg-white font-medium" /></div>
              </div>
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-primary border-b border-primary/10 pb-2 text-left">Technical Specs</h4>
                <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label className="text-[10px] uppercase font-semibold opacity-50 block text-left">Width (MM)</Label><Input type="number" value={formData.widthMm} onChange={e => setFormData({...formData, widthMm: Number(e.target.value)})} className="h-11 rounded-xl border-2 bg-white font-semibold" /></div><div className="space-y-2"><Label className="text-[10px] uppercase font-semibold opacity-50 block text-left">Length (MTR)</Label><Input type="number" value={formData.lengthMeters} onChange={e => setFormData({...formData, lengthMeters: Number(e.target.value)})} className="h-11 rounded-xl border-2 bg-white font-semibold" /></div></div>
                <div className="space-y-2"><Label className="text-[10px] uppercase font-semibold opacity-50 block text-left">Calculated SQM (system)</Label><div className="h-11 rounded-xl border-2 border-dashed bg-slate-100 flex items-center px-4 font-semibold text-primary">{calculatedSqm}</div></div>
                <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label className="text-[10px] uppercase font-semibold opacity-50 block text-left">GSM</Label><Input type="number" value={formData.gsm} onChange={e => setFormData({...formData, gsm: Number(e.target.value)})} className="h-11 rounded-xl border-2 bg-white font-semibold" /></div><div className="space-y-2"><Label className="text-[10px] uppercase font-semibold opacity-50 block text-left">Weight (KG)</Label><Input type="number" value={formData.weightKg} onChange={e => setFormData({...formData, weightKg: Number(e.target.value)})} className="h-11 rounded-xl border-2 bg-white font-semibold" /></div></div>
                <div className="space-y-2"><Label className="text-[10px] uppercase font-semibold opacity-50 block text-left">Purchase Rate</Label><Input type="number" value={formData.purchaseRate} onChange={e => setFormData({...formData, purchaseRate: Number(e.target.value)})} className="h-11 rounded-xl border-2 bg-white font-semibold" /></div>
              </div>
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-primary border-b border-primary/10 pb-2 text-left">Workflow & History</h4>
                <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label className="text-[10px] uppercase font-semibold opacity-50 block text-left">Received Date</Label><Input type="date" value={formData.receivedDate} onChange={e => setFormData({...formData, receivedDate: e.target.value})} className="h-11 rounded-xl border-2 bg-white font-medium" /></div><div className="space-y-2"><Label className="text-[10px] uppercase font-semibold opacity-50 block text-left">Date Used</Label><Input type="date" value={formData.dateOfUsed} onChange={e => setFormData({...formData, dateOfUsed: e.target.value})} className="h-11 rounded-xl border-2 bg-white font-medium" /></div></div>
                <div className="space-y-2"><Label className="text-[10px] uppercase font-semibold opacity-50 block text-left">Job ID / Order Ref</Label><Input value={formData.jobNo} onChange={e => setFormData({...formData, jobNo: e.target.value})} className="h-11 rounded-xl border-2 bg-white font-semibold" /></div>
                <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label className="text-[10px] uppercase font-semibold opacity-50 block text-left">Job Name</Label><Input value={formData.jobName} onChange={e => setFormData({...formData, jobName: e.target.value})} className="h-11 rounded-xl border-2 bg-white font-medium" /></div><div className="space-y-2"><Label className="text-[10px] uppercase font-semibold opacity-50 block text-left">Job Size</Label><Input value={formData.jobSize} onChange={e => setFormData({...formData, jobSize: e.target.value})} className="h-11 rounded-xl border-2 bg-white font-medium" /></div></div>
                <div className="space-y-2 text-left"><Label className="text-[10px] uppercase font-semibold opacity-50 block text-left">Technical Remarks</Label><Textarea value={formData.remarks} onChange={e => setFormData({...formData, remarks: e.target.value})} className="rounded-xl border-2 bg-white font-medium min-h-[80px]" /></div>
              </div>
            </div>
            <DialogFooter className="p-6 bg-white border-t shrink-0">
              <Button type="button" variant="outline" className="h-12 px-8 rounded-xl font-semibold uppercase text-[10px] tracking-wider border-2" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isProcessing} className="h-12 px-12 rounded-xl bg-primary hover:bg-primary/90 text-white font-semibold uppercase text-[10px] tracking-wider shadow-xl">{isProcessing ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Save className="h-4 w-4 mr-2" />}{editingRoll ? 'Update Master Record' : 'Initialize Roll Record'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isScannerOpen} onOpenChange={setIsScannerOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader><DialogTitle>Scan Paper Roll QR</DialogTitle></DialogHeader>
          <div id="reader" className="w-full"></div>
        </DialogContent>
      </Dialog>

      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="sm:max-w-[800px] p-0 overflow-hidden rounded-3xl border-none shadow-3xl">
          <div className="bg-slate-900 text-white p-6">
            <DialogTitle className="text-xl font-black uppercase tracking-tight flex items-center gap-3">
              <Eye className="h-5 w-5 text-primary" /> Roll Profile: {viewingRoll?.rollNo}
            </DialogTitle>
          </div>
          <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8 bg-slate-50">
            <div className="space-y-6">
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-black opacity-50">Technical Specs</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-white rounded-xl border-2 border-slate-100 shadow-sm">
                    <p className="text-[9px] font-black text-slate-400 uppercase">Width</p>
                    <p className="text-lg font-black">{viewingRoll?.widthMm} MM</p>
                  </div>
                  <div className="p-4 bg-white rounded-xl border-2 border-slate-100 shadow-sm">
                    <p className="text-[9px] font-black text-slate-400 uppercase">Length</p>
                    <p className="text-lg font-black">{viewingRoll?.lengthMeters} MTR</p>
                  </div>
                </div>
              </div>
              <div className="p-4 bg-white rounded-xl border-2 border-slate-100 shadow-sm">
                <p className="text-[9px] font-black text-slate-400 uppercase">Material Type</p>
                <p className="text-sm font-bold">{viewingRoll?.paperType} - {viewingRoll?.gsm} GSM</p>
              </div>
            </div>
            <div className="space-y-6 flex flex-col items-center justify-center">
              <div className="p-4 bg-white rounded-2xl shadow-xl border-2 border-primary/10">
                <QRCodeSVG value={siteOrigin ? `${siteOrigin}/roll/${viewingRoll?.id}` : (viewingRoll?.id || "")} size={180} />
              </div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Scan to access full technical logs</p>
            </div>
          </div>
          <DialogFooter className="p-6 bg-white border-t">
            <Button variant="outline" className="w-full h-12 rounded-xl font-black uppercase text-[10px] tracking-widest border-2" onClick={() => setIsViewOpen(false)}>Close Inspector</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isReportOpen} onOpenChange={setIsReportOpen}>
        <DialogContent className="sm:max-w-[1000px] max-h-[90vh] p-0 flex flex-col overflow-hidden rounded-3xl border-none shadow-3xl">
          <div className="bg-slate-900 text-white p-6 flex items-center justify-between no-print">
            <div className="flex items-center gap-4">
              <DialogTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /> Technical Audit Stream</DialogTitle>
              <Select value={selectedReportTemplateId} onValueChange={setSelectedReportTemplateId}>
                <SelectTrigger className="h-8 w-[250px] bg-white/10 border-white/20 text-white text-[10px] font-bold uppercase rounded-lg">
                  <SelectValue placeholder="Select Template" />
                </SelectTrigger>
                <SelectContent className="z-[110]">
                  <SelectItem value="default" className="text-xs font-bold uppercase">Default Audit Grid</SelectItem>
                  {reportTemplates?.map(t => <SelectItem key={t.id} value={t.id} className="text-xs font-bold uppercase">{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button disabled={isProcessing} variant="outline" className="bg-white/10 border-white/20 text-white h-9 px-4 font-black uppercase text-[10px] tracking-widest" onClick={() => handleExecutePrint('report-container', 'report')}>
                {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Printer className="h-4 w-4 mr-2" />}
                Execute Print Stream
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setIsReportOpen(false)} className="text-white hover:bg-white/10"><X className="h-4 w-4" /></Button>
            </div>
          </div>
          <div id="report-container" className="flex-1 overflow-y-auto bg-white p-12 industrial-scroll">
            {selectedReportTemplateId === 'default' ? (
              <div className="label-print-item w-[210mm] mx-auto text-black">
                <h1 className="text-3xl font-black mb-8 border-b-4 border-black pb-4">PAPER STOCK AUDIT - {new Date().toLocaleDateString()}</h1>
                <Table className="border-2 border-black">
                  <TableHeader className="bg-slate-100"><TableRow className="border-b-2 border-black">{COLUMN_KEYS.map(col => <TableHead key={col.id} className="font-black text-black text-[9px] uppercase border-r-2 border-black text-center">{col.label}</TableHead>)}</TableRow></TableHeader>
                  <TableBody>{filteredRows.map((r, i) => (<TableRow key={i} className="border-b border-black last:border-b-0">{COLUMN_KEYS.map(col => <TableCell key={col.id} className="text-[9px] font-bold border-r border-black p-2 text-center">{r[col.id] || '-'}</TableCell>)}</TableRow>))}</TableBody>
                </Table>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-10">
                {filteredRows.slice(0, 100).map((r, i) => (
                  <TemplateRenderer key={i} template={activeReportTemplate} data={prepareRollData(r)} />
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isPrintOpen} onOpenChange={setIsPrintOpen}>
        <DialogContent className="sm:max-w-[1000px] max-h-[90vh] p-0 flex flex-col overflow-hidden rounded-3xl border-none shadow-3xl">
          <div className="bg-slate-900 text-white p-6 flex items-center justify-between no-print">
            <div className="flex items-center gap-4">
              <DialogTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2"><Printer className="h-4 w-4 text-primary" /> Thermal Label Spooler</DialogTitle>
              <Select value={selectedLabelTemplateId} onValueChange={setSelectedLabelTemplateId}>
                <SelectTrigger className="h-8 w-[250px] bg-white/10 border-white/20 text-white text-[10px] font-bold uppercase rounded-lg">
                  <SelectValue placeholder="Select Template" />
                </SelectTrigger>
                <SelectContent className="z-[110]">
                  <SelectItem value="default" className="text-xs font-bold uppercase">Default Thermal (150x100)</SelectItem>
                  {labelTemplates?.map(t => <SelectItem key={t.id} value={t.id} className="text-xs font-bold uppercase">{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button disabled={isProcessing} variant="outline" className="bg-white/10 border-white/20 text-white h-9 px-4 font-black uppercase text-[10px] tracking-widest" onClick={() => handleExecutePrint('label-batch', 'label')}>
                {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Printer className="h-4 w-4 mr-2" />}
                Execute Spooler
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setIsPrintOpen(false)} className="text-white hover:bg-white/10"><X className="h-4 w-4" /></Button>
            </div>
          </div>
          <div id="label-batch" className="flex-1 overflow-y-auto bg-slate-50 p-12 industrial-scroll flex flex-col items-center gap-10">
            {printingRolls.map((roll, i) => (
              <div key={i} className="flex flex-col items-center">
                {selectedLabelTemplateId === 'default' ? (
                  <div className="label-print-item bg-white p-8 border-4 border-black relative overflow-hidden" style={{ width: '150mm', height: '100mm', fontFamily: 'monospace', color: 'black' }}>
                    <div className="border-b-4 border-black pb-4 flex justify-between items-center"><span className="text-3xl font-black tracking-tighter">SHREE LABEL</span><span className="text-xl font-bold">REEL ID</span></div>
                    <div className="mt-6 flex justify-between gap-6">
                      <div className="flex-1 space-y-4">
                        <div><p className="text-[10px] font-black opacity-50 uppercase">Roll Identity</p><p className="text-6xl font-black tracking-tighter leading-none">{roll.rollNo}</p></div>
                        <div><p className="text-[10px] font-black opacity-50 uppercase">Paper Item</p><p className="text-2xl font-bold truncate">{roll.paperType || "SUBSTRATE"}</p></div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <div className="border-2 border-black p-1"><QRCodeSVG value={siteOrigin ? `${siteOrigin}/roll/${roll.id}` : (roll.id || "")} size={120} /></div>
                        <p className="text-[8px] font-black uppercase">Scan for Full Specs</p>
                      </div>
                    </div>
                    <div className="mt-8 grid grid-cols-2 gap-8 border-t-4 border-black pt-6">
                      <div className="flex justify-between border-b-2 border-black pb-1"><span className="text-lg font-bold">W:</span><span className="text-xl font-black">{roll.widthMm} MM</span></div>
                      <div className="flex justify-between border-b-2 border-black pb-1"><span className="text-lg font-bold">L:</span><span className="text-xl font-black">{roll.lengthMeters} MTR</span></div>
                    </div>
                  </div>
                ) : (
                  <TemplateRenderer template={activeLabelTemplate} data={prepareRollData(roll)} />
                )}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isManualJobCardOpen} onOpenChange={setIsManualJobCardOpen}>
        <DialogContent className="sm:max-w-[500px] rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 uppercase font-black">
              <IdCard className="h-5 w-5 text-primary" /> Manual Job Card
            </DialogTitle>
            <DialogDescription className="font-bold uppercase text-[10px]">Technical override for slitting lineage</DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            <div className="space-y-2">
              <Label className="text-[10px] uppercase font-black opacity-50">Parent Source ID</Label>
              <Input value={manualParentRoll} disabled className="h-11 rounded-xl bg-slate-50 font-bold border-none" />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] uppercase font-black opacity-50">Units Assigned ({manualChildRolls.length})</Label>
              <div className="p-4 bg-slate-50 rounded-2xl text-[10px] font-black uppercase max-h-[120px] overflow-y-auto industrial-scroll border-2 border-dashed">
                {manualChildRolls.join(', ') || "No slitted children found."}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-black opacity-50">Slitting Machine</Label>
                <Select value={manualMachine} onValueChange={setManualMachine}>
                  <SelectTrigger className="h-11 rounded-xl border-2"><SelectValue placeholder="Machine" /></SelectTrigger>
                  <SelectContent className="z-[110]">
                    {machines?.map(m => <SelectItem key={m.id} value={m.machine_name}>{m.machine_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-black opacity-50">Technician</Label>
                <Select value={manualOperator} onValueChange={setManualOperator}>
                  <SelectTrigger className="h-11 rounded-xl border-2"><SelectValue placeholder="Operator" /></SelectTrigger>
                  <SelectContent className="z-[110]">
                    {operators.map(o => <SelectItem key={o.id} value={`${o.firstName} ${o.lastName}`}>{o.firstName} {o.lastName}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="h-12 px-6 rounded-xl font-black uppercase text-[10px]" onClick={() => setIsManualJobCardOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateManualJobCard} disabled={isProcessing} className="h-12 px-10 rounded-xl bg-primary font-black uppercase text-[10px] tracking-widest shadow-xl">
              {isProcessing ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Commit Job Card
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <style jsx global>{`
        @media print {
          body * { visibility: hidden !important; }
          #report-container, #report-container *, #label-batch, #label-batch * { visibility: visible !important; }
          #report-container, #label-batch { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; display: block !important; background: white !important; }
          .label-print-item { page-break-after: always; margin: 0 !important; box-shadow: none !important; display: flex !important; justify-content: center !important; align-items: center !important; }
          .no-print { display: none !important; }
          @page { margin: 0; size: auto; }
        }
      `}</style>
    </div>
  );
}