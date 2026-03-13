
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
  CheckCircle2
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useFirestore, useUser, useCollection, useMemoFirebase } from "@/firebase"
import { 
  collection, 
  doc, 
  query, 
  limit, 
  serverTimestamp,
  runTransaction,
  writeBatch,
  deleteDoc,
  updateDoc,
  getDoc
} from "firebase/firestore"
import { cn } from "@/lib/utils"
import { usePermissions } from "@/components/auth/permission-context"
import { ActionModal, ModalType } from "@/components/action-modal"

const STATUS_OPTIONS = [
  { value: "Available", label: "Available", color: "bg-emerald-500" },
  { value: "Reserved", label: "Reserved", color: "bg-amber-500" },
  { value: "In Production", label: "In Production", color: "bg-blue-500" },
  { value: "Slitted", label: "Slitted", color: "bg-purple-500" },
  { value: "Consumed", label: "Consumed", color: "bg-destructive" },
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
  const [rowsPerPage, setRowsPerPage] = useState(20)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'rollNo', direction: 'desc' })

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

  useEffect(() => { 
    setIsMounted(true);
    setFormData(prev => ({ ...prev, receivedDate: new Date().toISOString().split('T')[0] }));
  }, [])

  const companiesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'paper_companies'), limit(100)) : null, [firestore]);
  const typesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'paper_types'), limit(100)) : null, [firestore]);
  const { data: companyList } = useCollection(companiesQuery);
  const { data: paperTypeList } = useCollection(typesQuery);

  const registryQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'paper_stock'), limit(500));
  }, [firestore]);

  const { data: rolls, isLoading: itemsLoading } = useCollection(registryQuery);

  const getUniqueOptions = (key: string) => {
    if (!rolls) return [];
    if (key === 'paperCompany') return companyList?.map(c => c.name).sort() || [];
    if (key === 'paperType') return paperTypeList?.map(t => t.name).sort() || [];
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

  const handleViewDetails = (roll: any) => {
    setViewingRoll(roll);
    setIsViewOpen(true);
  }

  const handleOpenPrint = (roll: any) => {
    setPrintingRoll(roll);
    setIsPrintOpen(true);
  }

  const handleSlitRoll = (roll: any) => {
    router.push(`/inventory/slitting?rollId=${roll.id}`);
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

  const handleDeleteRoll = async (roll: any) => {
    setModal({
      isOpen: true,
      type: 'CONFIRMATION',
      title: 'Delete this roll?',
      description: `Permanently remove ${roll.rollNo} from registry?`,
      onConfirm: async () => {
        setIsProcessing(true);
        try {
          await deleteDoc(doc(firestore!, 'paper_stock', roll.id));
          setModal({ isOpen: true, type: 'SUCCESS', title: 'Roll Deleted', autoClose: true });
        } catch (error: any) {
          setModal({ isOpen: true, type: 'ERROR', title: 'Delete Failed', description: error.message });
        } finally {
          setIsProcessing(false);
        }
      }
    });
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    setModal({
      isOpen: true,
      type: 'WARNING',
      title: `Delete ${selectedIds.size} rolls?`,
      description: 'This bulk action cannot be undone.',
      onConfirm: async () => {
        setIsProcessing(true);
        try {
          const batch = writeBatch(firestore!);
          selectedIds.forEach(id => {
            batch.delete(doc(firestore!, 'paper_stock', id));
          });
          await batch.commit();
          setSelectedIds(new Set());
          setModal({ isOpen: true, type: 'SUCCESS', title: 'Bulk Delete Complete', autoClose: true });
        } catch (error: any) {
          setModal({ isOpen: true, type: 'ERROR', title: 'Bulk Delete Failed', description: error.message });
        } finally {
          setIsProcessing(false);
        }
      }
    });
  };

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

  const RangeFilter = ({ label, minKey, maxKey, type = "number" }: { label: string, minKey: string, maxKey: string, type?: string }) => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={cn(
          "h-9 px-3 text-[10px] gap-2 font-black uppercase tracking-tighter bg-white border-primary/10",
          (filters[minKey] || filters[maxKey]) && "border-primary bg-primary/5 text-primary"
        )}>
          {label}
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-4 shadow-2xl rounded-xl" align="start">
        <div className="space-y-4">
          <p className="text-[10px] font-black uppercase text-muted-foreground">{label} Range</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[9px] uppercase font-bold">Min / From</Label>
              <Input 
                type={type} 
                className="h-8 text-xs font-bold" 
                value={filters[minKey]} 
                onChange={e => { setFilters({...filters, [minKey]: e.target.value}); setCurrentPage(1); }} 
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[9px] uppercase font-bold">Max / To</Label>
              <Input 
                type={type} 
                className="h-8 text-xs font-bold" 
                value={filters[maxKey]} 
                onChange={e => { setFilters({...filters, [maxKey]: e.target.value}); setCurrentPage(1); }} 
              />
            </div>
          </div>
          {(filters[minKey] || filters[maxKey]) && (
            <Button variant="ghost" size="sm" className="w-full text-[9px] font-black uppercase" onClick={() => setFilters({...filters, [minKey]: "", [maxKey]: ""})}>Clear Range</Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );

  const SortableHeader = ({ label, field, className = "" }: { label: string, field: string, className?: string }) => {
    const isActive = sortConfig.key === field;
    return (
      <TableHead className={cn("cursor-pointer select-none transition-colors hover:bg-slate-100", isActive && "text-primary bg-primary/5", className)} onClick={() => requestSort(field)}>
        <div className="flex items-center justify-center gap-1">
          <span className="font-black text-[10px] uppercase">{label}</span>
          {isActive ? (
            sortConfig.direction === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
          ) : (
            <ArrowUpDown className="h-2.5 w-2.5 opacity-20" />
          )}
        </div>
      </TableHead>
    );
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
              placeholder="Global Registry Search..." 
              className="pl-9 h-10 text-xs font-bold bg-slate-50/50 border-none shadow-inner" 
              value={filters.search} 
              onChange={e => setFilters({ ...filters, search: e.target.value })} 
            />
          </div>
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-3 animate-in fade-in slide-in-from-left-2">
              <Badge className="bg-primary text-white font-black h-8 px-4 rounded-lg">
                {selectedIds.size} SELECTED
              </Badge>
              <Button 
                variant="destructive" 
                size="sm" 
                onClick={handleBulkDelete}
                className="h-8 font-black text-[10px] uppercase tracking-widest rounded-lg shadow-lg"
              >
                <Trash2 className="h-3 w-3 mr-1.5" /> Delete Selected
              </Button>
            </div>
          )}
          <Button variant="ghost" size="sm" onClick={() => setFilters({
            search: "", paperCompany: [], paperType: [], status: [], jobNo: [], jobSize: [], jobName: [], lotNo: [], companyRollNo: [],
            widthMin: "", widthMax: "", lengthMin: "", lengthMax: "", sqmMin: "", sqmMax: "", gsmMin: "", gsmMax: "", weightMin: "", weightMax: "", rateMin: "", rateMax: "",
            receivedFrom: "", receivedTo: "", usedFrom: "", usedTo: ""
          })} className="ml-auto text-[10px] font-black uppercase text-destructive tracking-widest"><FilterX className="h-4 w-4 mr-1.5" /> Reset Filters</Button>
        </div>
        <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-50">
          <MultiSelectFilter label="Status" field="status" options={STATUS_OPTIONS.map(o => o.value)} />
          <MultiSelectFilter label="Company" field="paperCompany" options={getUniqueOptions('paperCompany')} />
          <MultiSelectFilter label="Type" field="paperType" options={getUniqueOptions('paperType')} />
          <MultiSelectFilter label="Job ID" field="jobNo" options={getUniqueOptions('jobNo')} />
          <MultiSelectFilter label="Job Name" field="jobName" options={getUniqueOptions('jobName')} />
          <MultiSelectFilter label="Lot No" field="lotNo" options={getUniqueOptions('lotNo')} />
          
          <Separator orientation="vertical" className="h-8 mx-1 opacity-20" />
          
          <RangeFilter label="Width" minKey="widthMin" maxKey="widthMax" />
          <RangeFilter label="GSM" minKey="gsmMin" maxKey="gsmMax" />
          <RangeFilter label="SQM" minKey="sqmMin" maxKey="sqmMax" />
          <RangeFilter label="Date Received" minKey="receivedFrom" maxKey="receivedTo" type="date" />
          
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 px-3 text-[10px] font-black uppercase tracking-tighter bg-white border-primary/10">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-4 shadow-2xl rounded-xl" align="end">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-4 col-span-2"><p className="text-[10px] font-black uppercase text-primary border-b pb-1">Additional Ranges</p></div>
                <RangeFilter label="Length" minKey="lengthMin" maxKey="lengthMax" />
                <RangeFilter label="Weight" minKey="weightMin" maxKey="weightMax" />
                <RangeFilter label="Rate" minKey="rateMin" maxKey="rateMax" />
                <RangeFilter label="Date Used" minKey="usedFrom" maxKey="usedTo" type="date" />
                <div className="col-span-2 pt-2"><Separator className="mb-4" /></div>
                <MultiSelectFilter label="Job Size" field="jobSize" options={getUniqueOptions('jobSize')} />
                <MultiSelectFilter label="Company Roll" field="companyRollNo" options={getUniqueOptions('companyRollNo')} />
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="bg-primary text-white p-3 flex items-center justify-between shrink-0 px-6 rounded-t-2xl shadow-lg">
        <div className="flex items-center gap-4">
          <h2 className="font-black text-sm uppercase tracking-widest flex items-center gap-2"><LayoutGrid className="h-5 w-5" /> Technical Stock Registry</h2>
          <Badge className="bg-white/20 text-[10px] font-black border-none h-6 px-3">
            {filteredRows.length} Rolls Filtered
          </Badge>
        </div>
        <Button variant="ghost" size="icon" className="h-10 w-10 text-white hover:bg-white/20 rounded-full" onClick={() => handleOpenDialog()}><Plus className="h-6 w-6" /></Button>
      </div>

      <Card className="flex-1 overflow-hidden flex flex-col border-none shadow-2xl bg-white rounded-b-2xl">
        <div className="flex-1 overflow-auto scrollbar-thin">
          <Table className="border-separate border-spacing-0 min-w-[3200px]">
            <TableHeader className="sticky top-0 z-40 bg-slate-50 border-b shadow-sm">
              <TableRow>
                <TableHead className="w-[50px] text-center border-r sticky left-0 bg-slate-50 z-50">
                  <Checkbox 
                    checked={paginatedRows.length > 0 && paginatedRows.every(r => selectedIds.has(r.id))} 
                    onCheckedChange={(val) => {
                      const next = new Set(selectedIds);
                      paginatedRows.forEach(r => val ? next.add(r.id) : next.delete(r.id));
                      setSelectedIds(next);
                    }} 
                  />
                </TableHead>
                <TableHead className="w-[60px] text-center font-black text-[10px] uppercase border-r sticky left-[50px] bg-slate-50 z-50">Sl No</TableHead>
                <SortableHeader label="Roll No" field="rollNo" className="w-[120px] border-r text-center sticky left-[110px] bg-slate-50 z-50" />
                <SortableHeader label="Status" field="status" className="w-[140px] border-r text-center" />
                <SortableHeader label="Paper Company" field="paperCompany" className="border-r text-center" />
                <SortableHeader label="Paper Type" field="paperType" className="border-r text-center" />
                <SortableHeader label="Width (MM)" field="widthMm" className="border-r text-center" />
                <SortableHeader label="Length (MTR)" field="lengthMeters" className="border-r text-center" />
                <SortableHeader label="SQM" field="sqm" className="border-r text-center" />
                <SortableHeader label="GSM" field="gsm" className="border-r text-center" />
                <SortableHeader label="Weight (KG)" field="weightKg" className="border-r text-center" />
                <SortableHeader label="Purchase Rate" field="purchaseRate" className="border-r text-center" />
                <SortableHeader label="Date Received" field="receivedDate" className="border-r text-center" />
                <SortableHeader label="Date of Used" field="dateOfUsed" className="border-r text-center" />
                <SortableHeader label="Job No" field="jobNo" className="border-r text-center" />
                <SortableHeader label="Job Size" field="jobSize" className="border-r text-center" />
                <SortableHeader label="Job Name" field="jobName" className="border-r text-center" />
                <SortableHeader label="Lot No / Batch No" field="lotNo" className="border-r text-center" />
                <SortableHeader label="Company Roll No" field="companyRollNo" className="border-r text-center" />
                <TableHead className="font-black text-[10px] uppercase border-r text-center min-w-[200px]">Remarks</TableHead>
                <TableHead className="text-center font-black text-[10px] uppercase sticky right-0 bg-slate-50 z-50 border-l shadow-[-4px_0_10px_rgba(0,0,0,0.05)] w-[220px]">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {itemsLoading ? (
                <TableRow><TableCell colSpan={21} className="text-center py-20"><Loader2 className="animate-spin mx-auto text-primary h-10 w-10" /></TableCell></TableRow>
              ) : paginatedRows.map((j, i) => (
                <TableRow key={j.id} className={cn("hover:bg-slate-50 transition-colors border-b h-11 group", selectedIds.has(j.id) && "bg-primary/5")}>
                  <TableCell className="text-center border-r sticky left-0 bg-white z-20 group-hover:bg-slate-50">
                    <Checkbox checked={selectedIds.has(j.id)} onCheckedChange={(val) => { const next = new Set(selectedIds); val ? next.add(j.id) : next.delete(j.id); setSelectedIds(next); }} />
                  </TableCell>
                  <TableCell className="text-center font-bold text-[11px] text-slate-400 border-r sticky left-[50px] bg-white z-20 group-hover:bg-slate-50">{(currentPage - 1) * rowsPerPage + i + 1}</TableCell>
                  <TableCell className="font-black text-[11px] text-primary border-r text-center font-mono sticky left-[110px] bg-white z-20 group-hover:bg-slate-50">{j.rollNo}</TableCell>
                  <TableCell className="text-center border-r">
                    <Badge className={cn("text-[9px] font-black uppercase h-5", STATUS_OPTIONS.find(o => o.value === j.status)?.color || "bg-slate-500")}>
                      {j.status || "Available"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-[11px] border-r uppercase font-bold text-center px-4">{j.paperCompany}</TableCell>
                  <TableCell className="text-[11px] border-r font-medium text-center px-4">{j.paperType}</TableCell>
                  <TableCell className="text-center text-[11px] border-r font-mono font-bold">{j.widthMm}</TableCell>
                  <TableCell className="text-center text-[11px] border-r font-mono font-bold">{j.lengthMeters}</TableCell>
                  <TableCell className="text-center text-[11px] border-r font-black text-primary font-mono">{j.sqm}</TableCell>
                  <TableCell className="text-center text-[11px] border-r font-mono">{j.gsm}</TableCell>
                  <TableCell className="text-center text-[11px] border-r font-mono">{j.weightKg || 0}</TableCell>
                  <TableCell className="text-center text-[11px] border-r font-mono">₹{j.purchaseRate || 0}</TableCell>
                  <TableCell className="text-center text-[11px] border-r">{j.receivedDate}</TableCell>
                  <TableCell className="text-center text-[11px] border-r italic text-slate-400">{j.dateOfUsed || '-'}</TableCell>
                  <TableCell className="text-center text-[11px] border-r font-mono font-bold">{j.jobNo || '-'}</TableCell>
                  <TableCell className="text-center text-[11px] border-r font-medium">{j.jobSize || '-'}</TableCell>
                  <TableCell className="text-center text-[11px] border-r truncate max-w-[150px] font-medium px-4">{j.jobName || '-'}</TableCell>
                  <TableCell className="text-center text-[11px] border-r font-mono">{j.lotNo || '-'}</TableCell>
                  <TableCell className="text-center text-[11px] border-r font-mono">{j.companyRollNo || '-'}</TableCell>
                  <TableCell className="text-[11px] border-r text-center truncate max-w-[200px] italic text-slate-400 px-4">{j.remarks || '-'}</TableCell>
                  <TableCell className="text-center sticky right-0 bg-white z-20 group-hover:bg-slate-50 border-l px-2 shadow-[-4px_0_10px_rgba(0,0,0,0.05)] w-[220px]">
                    <TooltipProvider>
                      <div className="flex items-center justify-center gap-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:bg-slate-100" onClick={() => handleViewDetails(j)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent><p className="text-[10px] font-bold uppercase">View Roll</p></TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-500 hover:bg-blue-50" onClick={() => handleOpenDialog(j)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent><p className="text-[10px] font-bold uppercase">Edit Roll</p></TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-orange-500 hover:bg-orange-50" onClick={() => handleSlitRoll(j)}>
                              <Scissors className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent><p className="text-[10px] font-bold uppercase">Send to Slitting</p></TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-700 hover:bg-zinc-100" onClick={() => handleOpenPrint(j)}>
                              <Printer className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent><p className="text-[10px] font-bold uppercase">Print Label</p></TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:bg-red-50" onClick={() => handleDeleteRoll(j)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent><p className="text-[10px] font-bold uppercase">Delete Roll</p></TooltipContent>
                        </Tooltip>
                      </div>
                    </TooltipProvider>
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

      {/* VIEW MODAL */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto p-0 border-none rounded-2xl shadow-3xl">
          <DialogHeader className="p-6 bg-slate-50 border-b">
            <div className="flex items-center justify-between">
              <DialogTitle className="uppercase font-black text-xl tracking-tighter flex items-center gap-2 text-primary">
                <Package className="h-6 w-6" /> Roll Specifications: {viewingRoll?.rollNo}
              </DialogTitle>
              <Badge className={cn("text-[10px] font-black uppercase h-6 px-3", STATUS_OPTIONS.find(o => o.value === viewingRoll?.status)?.color || "bg-slate-500")}>
                {viewingRoll?.status}
              </Badge>
            </div>
          </DialogHeader>
          <div className="p-8 grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-6 bg-white">
            {[
              { label: "Paper Company", value: viewingRoll?.paperCompany },
              { label: "Paper Type", value: viewingRoll?.paperType },
              { label: "Width (MM)", value: viewingRoll?.widthMm, mono: true },
              { label: "Length (MTR)", value: viewingRoll?.lengthMeters, mono: true },
              { label: "SQM", value: viewingRoll?.sqm, mono: true, highlight: true },
              { label: "GSM", value: viewingRoll?.gsm, mono: true },
              { label: "Weight (KG)", value: viewingRoll?.weightKg, mono: true },
              { label: "Purchase Rate", value: `₹${viewingRoll?.purchaseRate}`, mono: true },
              { label: "Received Date", value: viewingRoll?.receivedDate },
              { label: "Used Date", value: viewingRoll?.dateOfUsed || "N/A" },
              { label: "Job No", value: viewingRoll?.jobNo || "—", mono: true },
              { label: "Job Size", value: viewingRoll?.jobSize || "—" },
              { label: "Job Name", value: viewingRoll?.jobName || "—" },
              { label: "Lot No", value: viewingRoll?.lotNo || "—", mono: true },
              { label: "Company Roll", value: viewingRoll?.companyRollNo || "—", mono: true },
            ].map((item, idx) => (
              <div key={idx} className="space-y-1">
                <Label className="text-[10px] uppercase font-black text-slate-400">{item.label}</Label>
                <p className={cn(
                  "text-sm font-bold",
                  item.mono && "font-mono",
                  item.highlight && "text-primary font-black"
                )}>
                  {item.value}
                </p>
              </div>
            ))}
            <div className="col-span-full pt-4">
              <Label className="text-[10px] uppercase font-black text-slate-400">Remarks</Label>
              <p className="text-xs italic text-slate-600 bg-slate-50 p-3 rounded-lg mt-1 border">
                {viewingRoll?.remarks || "No additional technical flags recorded."}
              </p>
            </div>
          </div>
          <DialogFooter className="p-6 border-t bg-slate-50 flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setIsViewOpen(false)} className="font-black uppercase text-xs">Close Dossier</Button>
            <Button onClick={() => { setIsViewOpen(false); handleOpenPrint(viewingRoll); }} className="font-black uppercase text-xs bg-zinc-800 text-white">
              <Printer className="mr-2 h-4 w-4" /> Print Label
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PRINT LABEL MODAL */}
      <Dialog open={isPrintOpen} onOpenChange={setIsPrintOpen}>
        <DialogContent className="sm:max-w-[400px] p-0 border-none overflow-hidden rounded-2xl shadow-3xl">
          <div className="bg-white p-10 font-sans text-black" id="printable-label">
            <div className="border-4 border-black p-6 space-y-6">
              <div className="text-center space-y-1 pb-4 border-b-2 border-black">
                <h2 className="text-2xl font-black uppercase tracking-tighter">SHREE LABEL CREATION</h2>
                <p className="text-[10px] font-bold">Technical Substrate Identity</p>
              </div>
              
              <div className="flex justify-between items-start">
                <div className="space-y-4">
                  <div>
                    <p className="text-[9px] font-bold uppercase">Roll ID</p>
                    <p className="text-3xl font-black leading-none">{printingRoll?.rollNo}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold uppercase">Material</p>
                    <p className="text-lg font-black uppercase leading-none">{printingRoll?.paperType}</p>
                    <p className="text-[10px] font-bold text-slate-600">{printingRoll?.paperCompany}</p>
                  </div>
                </div>
                <div className="h-20 w-20 bg-slate-100 flex items-center justify-center border-2 border-black">
                  <span className="text-[8px] font-bold text-slate-400 rotate-45">BARCODE</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t-2 border-black">
                <div>
                  <p className="text-[9px] font-bold uppercase">Width</p>
                  <p className="text-xl font-black">{printingRoll?.widthMm} mm</p>
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase">Length</p>
                  <p className="text-xl font-black">{printingRoll?.lengthMeters} m</p>
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase">GSM</p>
                  <p className="text-xl font-black">{printingRoll?.gsm}</p>
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase">Weight</p>
                  <p className="text-xl font-black">{printingRoll?.weightKg} kg</p>
                </div>
              </div>

              <div className="pt-4 border-t border-black/20 text-[8px] font-bold uppercase flex justify-between">
                <span>REC: {printingRoll?.receivedDate}</span>
                <span>LOT: {printingRoll?.lotNo}</span>
              </div>
            </div>
          </div>
          <DialogFooter className="p-6 bg-slate-50 border-t flex flex-col gap-2">
            <Button onClick={() => window.print()} className="w-full h-12 font-black uppercase bg-primary text-white shadow-lg">
              Confirm & Print Label
            </Button>
            <Button variant="ghost" onClick={() => setIsPrintOpen(false)} className="w-full text-[10px] font-bold uppercase text-slate-400">
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ADD/EDIT MODAL */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[850px] max-h-[95vh] overflow-y-auto p-0 border-none rounded-2xl shadow-3xl">
          <form onSubmit={handleSave}>
            <DialogHeader className="p-6 bg-primary text-white">
              <DialogTitle className="uppercase font-black text-xl tracking-tighter flex items-center gap-2">
                <Package className="h-6 w-6" /> {editingRoll ? `Update Roll: ${formData.rollNo}` : 'New Technical Roll Intake'}
              </DialogTitle>
            </DialogHeader>
            <div className="p-8 grid grid-cols-2 gap-x-8 gap-y-6 bg-white">
              <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black text-slate-500">Roll Number</Label><Input value={formData.rollNo || "AUTO-GENERATED"} readOnly className="h-11 bg-slate-50 font-black text-primary border-2" /></div>
              <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black text-slate-500">Inventory Status</Label>
                <Select value={formData.status} onValueChange={v => setFormData({...formData, status: v})}>
                  <SelectTrigger className="h-11 font-bold border-2"><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              
              <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black text-slate-500">Paper Company</Label>
                <Select value={formData.paperCompany} onValueChange={v => setFormData({...formData, paperCompany: v})}>
                  <SelectTrigger className="h-11 font-bold border-2"><SelectValue placeholder="Select Supplier" /></SelectTrigger>
                  <SelectContent>{companyList?.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black text-slate-500">Paper Type</Label>
                <Select value={formData.paperType} onValueChange={v => setFormData({...formData, paperType: v})}>
                  <SelectTrigger className="h-11 font-bold border-2"><SelectValue placeholder="Select Material" /></SelectTrigger>
                  <SelectContent>{paperTypeList?.map(t => <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black text-slate-500">Width (MM)</Label>
                  <Input type="number" min="0" step="0.01" value={formData.widthMm || ""} onChange={e => setFormData({...formData, widthMm: Number(e.target.value)})} required className="h-11 font-black" />
                </div>
                <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black text-slate-500">Length (MTR)</Label>
                  <Input type="number" min="0" step="0.01" value={formData.lengthMeters || ""} onChange={e => setFormData({...formData, lengthMeters: Number(e.target.value)})} required className="h-11 font-black" />
                </div>
              </div>

              <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black text-primary">Total SQM (Auto)</Label>
                <Input value={calculatedSqm} readOnly className="h-11 font-black bg-primary/5 text-primary border-primary/20 text-xl shadow-inner" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black text-slate-500">GSM</Label>
                  <Input type="number" value={formData.gsm || ""} onChange={e => setFormData({...formData, gsm: Number(e.target.value)})} required className="h-11 font-bold" />
                </div>
                <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black text-slate-500">Weight (KG)</Label>
                  <Input type="number" step="0.01" value={formData.weightKg || ""} onChange={e => setFormData({...formData, weightKg: Number(e.target.value)})} className="h-11 font-bold" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black text-slate-500">Purchase Rate (₹)</Label>
                  <Input type="number" step="0.01" value={formData.purchaseRate || ""} onChange={e => setFormData({...formData, purchaseRate: Number(e.target.value)})} className="h-11 font-bold" />
                </div>
                <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black text-slate-500">Date Received</Label>
                  <Input type="date" value={formData.receivedDate} onChange={e => setFormData({...formData, receivedDate: e.target.value})} required className="h-11 font-black" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black text-slate-500">Job No</Label>
                  <Input value={formData.jobNo} onChange={e => setFormData({...formData, jobNo: e.target.value})} className="h-11 font-bold" />
                </div>
                <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black text-slate-500">Job Size</Label>
                  <Input value={formData.jobSize} onChange={e => setFormData({...formData, jobSize: e.target.value})} className="h-11 font-bold" />
                </div>
              </div>

              <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black text-slate-500">Job Name</Label>
                <Input value={formData.jobName} onChange={e => setFormData({...formData, jobName: e.target.value})} className="h-11 font-bold" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black text-slate-500">Lot No / Batch</Label>
                  <Input value={formData.lotNo} onChange={e => setFormData({...formData, lotNo: e.target.value})} className="h-11 font-bold" />
                </div>
                <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black text-slate-500">Company Roll No</Label>
                  <Input value={formData.companyRollNo} onChange={e => setFormData({...formData, companyRollNo: e.target.value})} className="h-11 font-bold" />
                </div>
              </div>

              <div className="space-y-1.5 col-span-2"><Label className="text-[10px] uppercase font-black text-slate-500">Remarks</Label>
                <Textarea value={formData.remarks} onChange={e => setFormData({...formData, remarks: e.target.value})} className="min-h-[60px]" />
              </div>
            </div>
            <DialogFooter className="p-6 bg-slate-50 border-t rounded-b-2xl">
              <Button type="submit" disabled={isProcessing} className="w-full h-16 uppercase font-black text-xl bg-primary hover:bg-primary/90 shadow-2xl rounded-xl">
                {isProcessing ? <Loader2 className="animate-spin mr-2 h-6 w-6" /> : editingRoll ? 'Update Technical Record' : 'Authorize Production Intake'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
