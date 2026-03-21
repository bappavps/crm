"use client"

import { useState, useMemo, useEffect, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Switch } from "@/components/ui/switch"
import { 
  Scissors, 
  Plus, 
  Loader2, 
  Search, 
  Trash2, 
  Save, 
  ArrowLeft, 
  AlertTriangle, 
  CheckCircle2, 
  Package, 
  Ruler, 
  Briefcase,
  History,
  ArrowRightLeft,
  FileText,
  Maximize2,
  LayoutGrid,
  ArrowUpDown,
  Printer,
  Sparkles,
  ChevronDown,
  ChevronRight,
  Zap,
  ArrowRight,
  X,
  Filter,
  Info,
  Layers,
  ArrowUpRight,
  Settings2,
  Settings,
  Activity,
  Target,
  ShoppingCart,
  Building2
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
  SelectValue 
} from "@/components/ui/select"
import { useFirestore, useUser, useCollection, useMemoFirebase } from "@/firebase"
import { collection, doc, query, where, runTransaction, serverTimestamp, limit } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { ActionModal, ModalType } from "@/components/action-modal"
import { Separator } from "@/components/ui/separator"
import { QRCodeSVG } from 'qrcode.react'

interface SlitRun {
  id: string;
  widthMm: number;
  lengthMeters: number;
  parts: number;
}

interface RollConfig {
  jobNo: string;
  jobName: string;
  jobSize: string;
  runs: SlitRun[];
  remainderAction?: 'STOCK' | 'ADJUST';
}

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

const getChildSuffix = (parentRollNo: string, index: number): string => {
  const parts = parentRollNo.split('-');
  const isBaseRoll = parts.length <= 2; 
  if (isBaseRoll) {
    const char = ALPHABET[index % 26];
    return index >= 26 ? `${char}${Math.floor(index / 26)}` : char;
  } else {
    return (index + 1).toString();
  }
};

const normalizeMaterial = (m: string) => String(m || "").toLowerCase().replace(/[\s-]/g, '').trim();
const sanitizeDocId = (id: string) => String(id || "").replace(/\//g, '-');

// Unified Status Colors
const getStatusColor = (status: string) => {
  const s = String(status || "").toLowerCase();
  if (s === 'pending') return 'bg-slate-400';
  if (s.includes('running') || s.includes('approved')) return 'bg-blue-500';
  if (s.includes('completed') || s.includes('slitted')) return 'bg-emerald-500';
  return 'bg-amber-500';
};

function SlittingHubContent() {
  const { toast } = useToast()
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialRollNo = searchParams.get('rollNo')
  
  const { user } = useUser()
  const firestore = useFirestore()
  const [isMounted, setIsMounted] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [searchQuery, setSearchQuery] = useState(initialRollNo || "")
  
  // SELECTION STATE
  const [selectedRolls, setSelectedRolls] = useState<any[]>([])
  const [activeRollId, setActiveRollId] = useState<string | null>(null)
  const [rollConfigs, setRollConfigs] = useState<Record<string, RollConfig>>({})

  // AUTO PLANNER STATE
  const [plannerSearch, setPlannerSearch] = useState("")
  const [selectedPlanningJob, setSelectedJob] = useState<any>(null)
  const [isOptionsModalOpen, setIsOptionsModalOpen] = useState(false)
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false)
  const [isReportModalOpen, setIsReportModalOpen] = useState(false)
  const [slittingReport, setSlittingReport] = useState<any>(null)
  const [selectedSupplier, setSelectedSupplier] = useState<string>("all")
  const [selectionMap, setSelectionMap] = useState<Record<string, number>>({})
  const [wastagePreferences, setWastagePreferences] = useState<Record<string, 'STOCK' | 'ADJUST'>>({})

  const [modal, setModal] = useState<{ isOpen: boolean; type: ModalType; title: string; description?: string }>({ 
    isOpen: false, type: 'SUCCESS', title: '' 
  });

  useEffect(() => { setIsMounted(true) }, [])

  // Planning Data
  const planningJobsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, 'planning_tables/label-printing/rows'), 
      limit(1000)
    );
  }, [firestore]);
  const { data: rawPlanningJobs, isLoading: planningLoading } = useCollection(planningJobsQuery);

  const planningJobs = useMemo(() => {
    if (!rawPlanningJobs) return [];
    return rawPlanningJobs.filter(j => {
      const status = String(j.values.printing_planning || "").trim();
      // Strictly show ONLY Pending jobs in the Auto Planner terminal
      return status === 'Pending';
    });
  }, [rawPlanningJobs]);

  const stockQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'paper_stock'), where('status', 'in', ["Main", "Stock", "Available", "Slitting"]));
  }, [firestore]);
  const { data: stockData } = useCollection(stockQuery);

  const rollsQuery = useMemoFirebase(() => {
    if (!firestore || !initialRollNo) return null;
    return query(collection(firestore, 'paper_stock'), where('rollNo', '==', initialRollNo), limit(1));
  }, [firestore, initialRollNo]);
  const { data: initialRollData } = useCollection(rollsQuery);

  // Initialize from URL
  useEffect(() => {
    if (initialRollData && initialRollData.length > 0 && selectedRolls.length === 0) {
      const roll = initialRollData[0];
      setSelectedRolls([roll]);
      setActiveRollId(roll.id);
      setRollConfigs({
        [roll.id]: {
          jobNo: "", jobName: "", jobSize: "",
          runs: [{ id: crypto.randomUUID(), widthMm: roll.widthMm, lengthMeters: roll.lengthMeters, parts: 1 }]
        }
      });
    }
  }, [initialRollData, selectedRolls.length]);

  const handleSearch = async () => {
    if (!firestore || !searchQuery) return;
    setIsProcessing(true);
    try {
      const q = query(collection(firestore, 'paper_stock'), where('rollNo', '==', searchQuery.trim()), limit(1));
      const { getDocs } = await import('firebase/firestore');
      const snap = await getDocs(q);
      if (snap.empty) {
        toast({ variant: "destructive", title: "Roll Not Found", description: `ID ${searchQuery} does not exist.` });
      } else {
        const data = { ...snap.docs[0].data(), id: snap.docs[0].id };
        if (!["Main", "Stock", "Slitting", "Available"].includes(data.status)) {
          toast({ variant: "destructive", title: "Invalid Status", description: `Roll status is ${data.status}.` });
        } else if (selectedRolls.some(r => r.id === data.id)) {
          toast({ title: "Roll already loaded" });
          setActiveRollId(data.id);
        } else {
          setSelectedRolls(prev => [...prev, data]);
          setActiveRollId(data.id);
          setRollConfigs(prev => ({
            ...prev,
            [data.id]: {
              jobNo: "", jobName: "", jobSize: "",
              runs: [{ id: crypto.randomUUID(), widthMm: data.widthMm, lengthMeters: data.lengthMeters, parts: 1 }]
            }
          }));
          setSearchQuery("");
        }
      }
    } catch (e) {
      toast({ variant: "destructive", title: "Search Error" });
    } finally {
      setIsProcessing(false);
    }
  }

  const calculateRollStatus = (rollId: string) => {
    const roll = selectedRolls.find(r => r.id === rollId);
    const config = rollConfigs[rollId];
    if (!roll || !config) return { used: 0, remainder: 0, isValid: true, mode: 'WIDTH' };

    const hasLengthSplit = config.runs.some(r => Number(r.lengthMeters) > 0 && Number(r.lengthMeters) < Number(roll.lengthMeters));
    const mode = hasLengthSplit ? 'LENGTH' : 'WIDTH';

    if (mode === 'WIDTH') {
      const used = config.runs.reduce((acc, r) => acc + (Number(r.widthMm) * Number(r.parts)), 0);
      const remainder = Number(roll.widthMm) - used;
      return { used, remainder, isValid: remainder >= 0, mode: 'WIDTH' };
    } else {
      const used = config.runs.reduce((acc, r) => acc + (Number(r.lengthMeters) * Number(r.parts)), 0);
      const remainder = Number(roll.lengthMeters) - used;
      return { used, remainder, isValid: remainder >= 0, mode: 'LENGTH' };
    }
  }

  const getPreviewParts = (rollId: string) => {
    const roll = selectedRolls.find(r => r.id === rollId);
    const config = rollConfigs[rollId];
    if (!roll || !config) return [];

    const calc = calculateRollStatus(rollId);
    const parts: any[] = [];
    let childIdx = 0;

    config.runs.forEach((run) => {
      const pCount = Number(run.parts) || 0;
      for (let i = 0; i < pCount; i++) {
        const suffix = getChildSuffix(roll.rollNo, childIdx);
        parts.push({
          label: suffix,
          rollId: `${roll.rollNo}-${suffix}`,
          width: calc.mode === 'WIDTH' ? Number(run.widthMm) : roll.widthMm,
          length: calc.mode === 'LENGTH' ? Number(run.lengthMeters) : roll.lengthMeters,
          isJob: !!config.jobNo,
          jobNo: config.jobNo
        });
        childIdx++;
      }
    });

    if (calc.remainder > 0) {
      const suffix = getChildSuffix(roll.rollNo, childIdx);
      parts.push({
        label: suffix,
        rollId: `${roll.rollNo}-${suffix}`,
        width: calc.mode === 'WIDTH' ? calc.remainder : roll.widthMm,
        length: calc.mode === 'LENGTH' ? calc.remainder : roll.lengthMeters,
        isRemainder: true
      });
    }
    return parts;
  };

  const addRun = (rollId: string) => {
    const roll = selectedRolls.find(r => r.id === rollId);
    if (!roll) return;
    setRollConfigs(prev => ({
      ...prev,
      [rollId]: {
        ...prev[rollId],
        runs: [...prev[rollId].runs, { id: crypto.randomUUID(), widthMm: roll.widthMm, lengthMeters: roll.lengthMeters, parts: 1 }]
      }
    }));
  }

  const removeRun = (rollId: string, runId: string) => {
    setRollConfigs(prev => ({
      ...prev,
      [rollId]: {
        ...prev[rollId],
        runs: prev[rollId].runs.filter(r => r.id !== runId)
      }
    }));
  }

  const updateRun = (rollId: string, runId: string, field: keyof SlitRun, value: any) => {
    setRollConfigs(prev => ({
      ...prev,
      [rollId]: {
        ...prev[rollId],
        runs: prev[rollId].runs.map(r => r.id === runId ? { ...r, [field]: value } : r)
      }
    }));
  }

  const updateRollConfig = (rollId: string, field: keyof RollConfig, value: any) => {
    setRollConfigs(prev => ({
      ...prev,
      [rollId]: { ...prev[rollId], [field]: value }
    }));
  }

  const handleExecuteSlitting = async () => {
    if (!firestore || !user || selectedRolls.length === 0) return;
    
    const allValid = selectedRolls.every(r => calculateRollStatus(r.id).isValid);
    if (!allValid) {
      toast({ variant: "destructive", title: "Pattern Conflict", description: "One or more rolls have invalid slitting patterns." });
      return;
    }

    setIsProcessing(true);
    try {
      const reportChildRolls: any[] = [];
      const reportParentRolls: any[] = [];

      await runTransaction(firestore, async (transaction) => {
        // Sync Job Planning Status
        if (selectedPlanningJob) {
          const jobRowRef = doc(firestore, `planning_tables/label-printing/rows`, selectedPlanningJob.id);
          transaction.update(jobRowRef, {
            "values.printing_planning": "Slitted Paper",
            updatedAt: serverTimestamp()
          });
        }

        for (const parent of selectedRolls) {
          const config = rollConfigs[parent.id];
          const calc = calculateRollStatus(parent.id);
          const remainderAction = config.remainderAction || 'STOCK'; 
          
          const parentRef = doc(firestore, 'paper_stock', parent.id);
          transaction.update(parentRef, { 
            status: "Consumed", 
            dateOfUsed: new Date().toISOString().split('T')[0],
            updatedAt: serverTimestamp() 
          });
          reportParentRolls.push(parent);

          let childIdx = 0;
          for (const run of config.runs) {
            for (let i = 0; i < run.parts; i++) {
              const suffix = getChildSuffix(parent.rollNo, childIdx);
              const childId = sanitizeDocId(`${parent.rollNo}-${suffix}`);
              const childRef = doc(firestore, 'paper_stock', childId);
              
              const finalWidth = calc.mode === 'WIDTH' ? Number(run.widthMm) : Number(parent.widthMm);
              const finalLength = calc.mode === 'LENGTH' ? Number(run.lengthMeters) : Number(parent.lengthMeters);

              const childData = {
                ...parent,
                id: childId,
                rollNo: childId,
                widthMm: finalWidth,
                lengthMeters: finalLength,
                status: config.jobNo ? "Job Assign" : "Slitting",
                jobNo: config.jobNo || "",
                jobName: config.jobName || "",
                jobSize: config.jobSize || "",
                parentRollNo: parent.rollNo,
                sqm: Number(((finalWidth / 1000) * finalLength).toFixed(2)),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                createdById: user.uid
              };

              transaction.set(childRef, childData);
              reportChildRolls.push(childData);
              childIdx++;
            }
          }

          if (calc.remainder > 0 && remainderAction === 'STOCK') {
            const suffix = getChildSuffix(parent.rollNo, childIdx);
            const remainderId = sanitizeDocId(`${parent.rollNo}-${suffix}`);
            const remainderRef = doc(firestore, 'paper_stock', remainderId);
            
            const remWidth = calc.mode === 'WIDTH' ? calc.remainder : Number(parent.widthMm);
            const remLength = calc.mode === 'LENGTH' ? calc.remainder : Number(parent.lengthMeters);

            const remData = {
              ...parent,
              id: remainderId,
              rollNo: remainderId,
              widthMm: remWidth,
              lengthMeters: remLength,
              status: "Stock", 
              jobNo: "",
              jobName: "",
              jobSize: "",
              parentRollNo: parent.rollNo,
              sqm: Number(((remWidth / 1000) * remLength).toFixed(2)),
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              createdById: user.uid,
              remarks: `Remainder from slitting ${parent.rollNo}`
            };
            transaction.set(remainderRef, remData);
            reportChildRolls.push(remData);
          }
        }

        const jobId = `JJC-BATCH-${Date.now().toString().slice(-6)}`;
        const jobCardRef = doc(firestore, 'jumbo_job_cards', jobId);
        transaction.set(jobCardRef, {
          id: jobId,
          job_card_no: jobId,
          parent_rolls: reportParentRolls.map(r => r.rollNo),
          child_rolls: reportChildRolls.map(r => r.rollNo),
          status: "PENDING",
          createdAt: new Date().toISOString(),
          createdById: user.uid,
          createdByName: user.displayName || user.email,
          type: "BATCH_INDEPENDENT",
          machine: "MANUAL_TERMINAL",
          operator: user.displayName || user.email
        });
      });

      setSlittingReport({ 
        parents: reportParentRolls, 
        children: reportChildRolls, 
        job: selectedPlanningJob ? { name: selectedPlanningJob.values.name, id: selectedPlanningJob.values.sn } : null,
        date: new Date().toLocaleDateString(),
        operator: user.displayName || user.email
      });
      setIsReportModalOpen(true);
      
      setSelectedRolls([]);
      setRollConfigs({});
      setActiveRollId(null);
      setSelectedJob(null);
      toast({ title: "Batch Processed Successfully" });
    } catch (e: any) {
      setModal({ isOpen: true, type: 'ERROR', title: 'Execution Failed', description: e.message });
    } finally {
      setIsProcessing(false);
    }
  }

  const availableOptions = useMemo(() => {
    if (!selectedPlanningJob || !stockData) return [];
    const rawWidth = selectedPlanningJob.values.paper_size || selectedPlanningJob.values.size;
    const targetWidth = parseInt(String(rawWidth).replace(/[^0-9]/g, '')) || 0;
    const jobMaterial = normalizeMaterial(selectedPlanningJob.values.material);
    const jobLengthRequired = Number(selectedPlanningJob.values.allocate_mtrs) || 0;
    
    if (targetWidth <= 0) return [];

    const matchingStock = stockData.filter(roll => 
      normalizeMaterial(roll.paperType) === jobMaterial && 
      (Number(roll.widthMm) || 0) >= targetWidth
    );

    const groups: Record<string, any> = {};
    matchingStock.forEach(roll => {
      const key = `${roll.widthMm}-${roll.lengthMeters}-${roll.paperCompany}`;
      if (!groups[key]) {
        const rw = Number(roll.widthMm);
        const rl = Number(roll.lengthMeters) || 0;
        const splits = Math.floor(rw / targetWidth);
        const waste = rw % targetWidth;
        const efficiency = (splits * targetWidth) / rw;
        
        const yieldPerRoll = rl * splits;
        const requiredRolls = yieldPerRoll > 0 ? Math.ceil(jobLengthRequired / yieldPerRoll) : 1;

        let priorityLabel = "Alternate";
        if (rw === targetWidth) priorityLabel = "Best Fit";
        else if (rw >= 1000) priorityLabel = "Use Jumbo if required";

        groups[key] = { 
          key, 
          width: rw, 
          length: rl, 
          company: roll.paperCompany, 
          material: roll.paperType, 
          splits, 
          waste, 
          efficiency, 
          requiredForJob: requiredRolls, 
          yieldPerRoll,
          priorityLabel,
          availableCount: 0, 
          rolls: [], 
          exampleId: roll.rollNo 
        };
      }
      groups[key].availableCount += 1;
      groups[key].rolls.push(roll);
    });

    return Object.values(groups).sort((a: any, b: any) => {
      if (a.priorityLabel === "Best Fit" && b.priorityLabel !== "Best Fit") return -1;
      if (b.priorityLabel === "Best Fit" && a.priorityLabel !== "Best Fit") return 1;
      return b.efficiency - a.efficiency;
    });
  }, [selectedPlanningJob, stockData]);

  const totalValidRollsSummary = useMemo(() => {
    return availableOptions
      .filter((o: any) => selectedSupplier === 'all' || o.company === selectedSupplier)
      .reduce((acc, opt) => acc + opt.availableCount, 0);
  }, [availableOptions, selectedSupplier]);

  const selectionInsights = useMemo(() => {
    if (!selectedPlanningJob) return { totalProduced: 0, remaining: 0, required: 0 };
    const required = Number(selectedPlanningJob.values.allocate_mtrs) || 0;
    
    let totalProduced = 0;
    Object.entries(selectionMap).forEach(([key, qty]) => {
      const opt = availableOptions.find((o: any) => o.key === key) as any;
      if (opt) {
        totalProduced += (opt.yieldPerRoll * qty);
      }
    });

    return {
      totalProduced,
      required,
      remaining: Math.max(0, required - totalProduced)
    };
  }, [selectionMap, availableOptions, selectedPlanningJob]);

  const handleInitializeTerminalFromPlanner = () => {
    const selectedEntries = Object.entries(selectionMap).filter(([_, qty]) => qty > 0);
    if (selectedEntries.length === 0) return;
    const allSelected: any[] = [];
    const newConfigs: Record<string, RollConfig> = {};
    const rawTargetWidth = selectedPlanningJob.values.paper_size || selectedPlanningJob.values.size;
    const targetWidth = parseInt(String(rawTargetWidth).replace(/[^0-9]/g, '')) || 0;

    selectedEntries.forEach(([key, qty]) => {
      const opt = availableOptions.find((o: any) => o.key === key) as any;
      const rolls = opt.rolls.slice(0, qty);
      const preference = wastagePreferences[key] || 'STOCK';
      
      allSelected.push(...rolls);
      rolls.forEach((r: any) => {
        const finalWidth = preference === 'ADJUST' 
          ? (Number(r.widthMm) / opt.splits) 
          : targetWidth;

        newConfigs[r.id] = {
          jobNo: String(selectedPlanningJob.values.sn || selectedPlanningJob.id),
          jobName: selectedPlanningJob.values.name || "",
          jobSize: selectedPlanningJob.values.size || "",
          runs: [{ id: crypto.randomUUID(), widthMm: Number(finalWidth.toFixed(2)), lengthMeters: r.lengthMeters, parts: opt.splits }],
          remainderAction: preference
        };
      });
    });

    setSelectedRolls(allSelected);
    setRollConfigs(newConfigs);
    setActiveRollId(allSelected[0].id);
    setIsOptionsModalOpen(false);
    toast({ title: "Terminal Initialized" });
  };

  const activeConfig = activeRollId ? rollConfigs[activeRollId] : null;
  const activeRoll = activeRollId ? selectedRolls.find(r => r.id === activeRollId) : null;
  const activeCalc = activeRollId ? calculateRollStatus(activeRollId) : null;

  const filteredPlannerJobs = useMemo(() => {
    if (!planningJobs) return [];
    if (!plannerSearch) return planningJobs;
    const q = plannerSearch.toLowerCase();
    return planningJobs.filter(j => 
      String(j.values.name || "").toLowerCase().includes(q) || 
      String(j.values.sn || "").toLowerCase().includes(q)
    );
  }, [planningJobs, plannerSearch]);

  const handlePrintReport = async () => {
    const reportContent = document.getElementById('slitting-report-a4');
    if (!reportContent) return;

    const html2canvas = (await import('html2canvas')).default;
    setIsProcessing(true);

    try {
      const canvas = await html2canvas(reportContent, {
        scale: 3,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/png', 1.0);
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed'; iframe.style.right = '0'; iframe.style.bottom = '0';
      iframe.style.width = '0'; iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);

      const iframeDoc = iframe.contentWindow?.document || iframe.contentDocument;
      if (iframeDoc) {
        iframeDoc.write(`
          <html>
            <head><title>Slitting Traceability Report</title>
            <style>@page { size: A4 portrait; margin: 0; } body { margin: 0; padding: 0; display: flex; justify-content: center; } img { width: 210mm; }</style></head>
            <body><img src="${imgData}" /></body>
          </html>
        `);
        iframeDoc.close();
        setTimeout(() => {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          document.body.removeChild(iframe);
          setIsProcessing(false);
        }, 500);
      }
    } catch (err) {
      toast({ variant: "destructive", title: "Render Error" });
      setIsProcessing(false);
    }
  };

  if (!isMounted) return null;

  return (
    <div className="max-w-full mx-auto space-y-8 pb-20 font-sans animate-in fade-in duration-500">
      <ActionModal isOpen={modal.isOpen} onClose={() => setModal(p => ({ ...p, isOpen: false }))} {...modal} />

      <div className="flex items-center justify-between print:hidden px-4">
        <div className="space-y-1">
          <h1 className="text-[28px] font-black tracking-tight text-slate-900 uppercase">Industrial Slitting Terminal</h1>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Decision Support & Multi-Unit technical controller</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => router.push('/paper-stock')} className="font-bold text-[10px] uppercase h-10 px-6">
            <ArrowLeft className="mr-2 h-3 w-3" /> Technical Registry
          </Button>
        </div>
      </div>

      {/* --- AUTO SLITTING PLANNER PANEL --- */}
      <Card className="shadow-2xl border-none rounded-3xl overflow-hidden bg-white mx-4">
        <CardHeader className="bg-slate-900 text-white p-6">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-primary" /> Auto Planner Integration
            </CardTitle>
            <Badge className="bg-primary/20 text-primary border-primary/30 font-black text-[9px]">Decision Support active</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-4">
              <Label className="text-[10px] font-black uppercase text-slate-400">Search Active Planning Job</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input placeholder="Search job name or SN..." className="h-10 pl-10 rounded-xl" value={plannerSearch} onChange={e => setPlannerSearch(e.target.value)} />
              </div>
              <div className="space-y-2 max-h-[350px] overflow-y-auto industrial-scroll pr-2 border rounded-2xl p-2 bg-slate-50/50">
                {planningLoading ? (
                  <div className="py-10 text-center"><Loader2 className="animate-spin h-6 w-6 mx-auto text-primary" /></div>
                ) : filteredPlannerJobs.length === 0 ? (
                  <div className="py-10 text-center text-muted-foreground italic text-xs">No active planning jobs found.</div>
                ) : filteredPlannerJobs.map(job => (
                  <div key={job.id} onClick={() => setSelectedJob(job)} className={cn("p-3 rounded-xl border-2 cursor-pointer flex justify-between items-center transition-all", selectedPlanningJob?.id === job.id ? "border-primary bg-primary/5" : "border-white bg-white hover:border-primary/20 shadow-sm")}>
                    <div className="flex flex-col flex-1 min-w-0">
                      <span className="text-[11px] font-black uppercase tracking-tight truncate">{job.values.name}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-[9px] font-bold opacity-50 uppercase">{job.values.material} | {job.values.paper_size || job.values.size}</span>
                        <Badge variant="outline" className="h-4 px-1.5 text-[8px] font-black border-primary text-primary uppercase shadow-sm">
                          REQ: {job.values.allocate_mtrs} MTR
                        </Badge>
                      </div>
                    </div>
                    <Badge className={cn("text-[8px] font-black text-white px-2 py-0.5 rounded-full uppercase", getStatusColor(job.values.printing_planning))}>
                      {job.values.printing_planning}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-col justify-center items-center p-6 bg-slate-50 rounded-2xl border-2 border-dashed">
              {selectedPlanningJob ? (
                <div className="text-center space-y-4 animate-in fade-in zoom-in-95 w-full max-w-sm">
                  <div className="p-6 bg-white rounded-3xl shadow-sm border space-y-4 mb-4 text-left">
                    <div className="space-y-1">
                      <p className="text-[10px] font-black uppercase text-slate-400">Targeting Job</p>
                      <p className="text-lg font-black text-primary truncate">{selectedPlanningJob.values.name}</p>
                    </div>
                    <div className="space-y-1 border-t pt-2">
                      <p className="text-[10px] font-black uppercase text-slate-400">Substrate</p>
                      <p className="text-sm font-black">{selectedPlanningJob.values.material}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-slate-50 p-3 rounded-2xl">
                        <p className="text-[8px] font-black uppercase text-slate-400">Job Width</p>
                        <p className="text-sm font-black">{selectedPlanningJob.values.paper_size || selectedPlanningJob.values.size}</p>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-2xl">
                        <p className="text-[8px] font-black uppercase text-slate-400">Goal Meter</p>
                        <p className="text-sm font-black">{selectedPlanningJob.values.allocate_mtrs} M</p>
                      </div>
                    </div>
                  </div>
                  <Button onClick={() => setIsOptionsModalOpen(true)} className="h-14 w-full rounded-2xl bg-slate-900 text-white font-black uppercase text-xs tracking-widest shadow-xl hover:bg-black group">
                    Analyze Stock Options 
                    <ChevronRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Button>
                </div>
              ) : (
                <div className="text-center opacity-30 space-y-3">
                  <LayoutGrid className="h-10 w-10 mx-auto" />
                  <p className="text-[10px] font-black uppercase tracking-widest">Select job from technical board to auto-populate terminal</p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* --- MANUAL INDEPENDENT TERMINAL --- */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 px-4 h-[calc(100vh-400px)] min-h-[600px]">
        
        {/* LEFT: ROLL INGESTION */}
        <div className="lg:col-span-1 space-y-4 flex flex-col">
          <Card className="shadow-xl border-none rounded-2xl overflow-hidden bg-white h-full flex flex-col">
            <CardHeader className="bg-slate-900 text-white p-4">
              <CardTitle className="text-[11px] font-black uppercase tracking-widest flex items-center gap-2">
                <Plus className="h-4 w-4 text-primary" /> Load Jumbos
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 flex-1 flex flex-col gap-4">
              <div className="flex gap-2">
                <Input 
                  placeholder="Scan Roll ID..." 
                  className="h-10 font-bold uppercase rounded-lg border-2" 
                  value={searchQuery} 
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                />
                <Button onClick={handleSearch} disabled={isProcessing} className="h-10 w-10 bg-slate-900 text-white"><Search className="h-4 w-4" /></Button>
              </div>

              <div className="space-y-2 overflow-y-auto industrial-scroll">
                {selectedRolls.length === 0 ? (
                  <div className="py-20 text-center opacity-20"><Package className="h-8 w-8 mx-auto mb-2" /><p className="text-[10px] font-black uppercase">Batch Empty</p></div>
                ) : selectedRolls.map(r => (
                  <div 
                    key={r.id} 
                    onClick={() => setActiveRollId(r.id)}
                    className={cn(
                      "p-3 rounded-xl border-2 transition-all cursor-pointer relative group",
                      activeRollId === r.id ? "border-primary bg-primary/5 shadow-inner" : "border-slate-50 hover:bg-slate-50"
                    )}
                  >
                    <button onClick={(e) => { e.stopPropagation(); setSelectedRolls(selectedRolls.filter(x => x.id !== r.id)); if(activeRollId === r.id) setActiveRollId(null); }} className="absolute top-1 right-1 h-5 w-5 bg-white border rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center hover:text-rose-500 transition-opacity"><X className="h-3 w-3" /></button>
                    <div className="flex flex-col">
                      <span className="text-xs font-black text-primary font-mono">{r.rollNo}</span>
                      <span className="text-[9px] font-bold opacity-50 uppercase">{r.widthMm}mm x {r.lengthMeters}m</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* CENTER: BATCH MONITOR & SUMMARY */}
        <div className="lg:col-span-1 space-y-4 flex flex-col">
          <Card className="shadow-xl border-none rounded-2xl overflow-hidden bg-white h-full flex flex-col">
            <CardHeader className="bg-slate-50 border-b p-4">
              <CardTitle className="text-[11px] font-black uppercase tracking-widest flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" /> Batch Status
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 flex-1 overflow-y-auto industrial-scroll space-y-4">
              {selectedRolls.map(r => {
                const calc = calculateRollStatus(r.id);
                const config = rollConfigs[r.id];
                return (
                  <div key={r.id} className={cn("p-4 rounded-xl border-2 transition-all", activeRollId === r.id ? "border-primary bg-primary/5" : "border-slate-100")}>
                    <div className="flex justify-between items-start mb-3">
                      <span className="text-[10px] font-black uppercase opacity-40">{r.rollNo}</span>
                      <Badge className={calc.isValid ? "bg-emerald-500" : "bg-rose-500"}>{calc.isValid ? 'READY' : 'EXCEEDED'}</Badge>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-baseline"><span className="text-[10px] font-bold opacity-60">Pattern Used:</span><span className="font-black text-sm">{calc.used} {calc.mode}</span></div>
                      <div className="flex justify-between items-baseline"><span className="text-[10px] font-bold opacity-60">To Stock:</span><span className="font-black text-sm text-emerald-600">{calc.remainder} {calc.mode}</span></div>
                      <Progress value={(calc.used / (calc.mode === 'WIDTH' ? r.widthMm : r.lengthMeters)) * 100} className="h-1" />
                    </div>
                    <div className="mt-3 pt-2 border-t flex justify-between items-center"><span className="text-[9px] font-black uppercase text-slate-400">{config?.jobNo || 'STOCK RUN'}</span><Settings className="h-3 w-3 opacity-20" /></div>
                  </div>
                );
              })}
            </CardContent>
            <CardFooter className="p-0 border-t">
              <Button onClick={handleExecuteSlitting} disabled={selectedRolls.length === 0 || isProcessing} className="w-full h-14 rounded-none bg-primary text-white font-black uppercase text-[11px] tracking-widest hover:bg-primary/90">
                {isProcessing ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Scissors className="mr-2 h-4 w-4" />}
                Execute Batch ({selectedRolls.length})
              </Button>
            </CardFooter>
          </Card>
        </div>

        {/* RIGHT: CONFIGURATION TERMINAL */}
        <div className="lg:col-span-2 space-y-4 flex flex-col">
          {!activeRollId ? (
            <div className="flex-1 flex flex-col items-center justify-center p-12 bg-slate-50 border-2 border-dashed rounded-3xl opacity-30 text-center gap-4">
              <Settings2 className="h-12 w-12" />
              <p className="text-sm font-black uppercase tracking-widest">Select a roll from the batch to configure its technical pattern</p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col gap-4 animate-in slide-in-from-right-4 duration-300">
              <Card className="shadow-xl border-none rounded-2xl overflow-hidden bg-white shrink-0">
                <CardHeader className="bg-primary/5 border-b p-4">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 bg-white rounded-xl shadow-sm border-2 border-primary/20 flex items-center justify-center font-black text-xs text-primary">{activeRoll?.rollNo}</div>
                      <div>
                        <h2 className="text-sm font-black uppercase tracking-tight">Active Configuration</h2>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{activeRoll?.paperType} • {activeRoll?.widthMm}mm x {activeRoll?.lengthMeters}m</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => addRun(activeRollId)} className="h-9 px-4 font-black uppercase text-[10px] text-primary"><Plus className="h-4 w-4 mr-1.5" /> Add Slit</Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                    <div className="space-y-1.5"><Label className="text-[9px] font-black uppercase opacity-40">Job Number</Label><Input className="h-10 font-bold bg-slate-50 border-none rounded-lg" value={activeConfig?.jobNo} onChange={e => updateRollConfig(activeRollId, 'jobNo', e.target.value)} /></div>
                    <div className="space-y-1.5"><Label className="text-[9px] font-black uppercase opacity-40">Job Name</Label><Input className="h-10 font-bold bg-slate-50 border-none rounded-lg" value={activeConfig?.jobName} onChange={e => updateRollConfig(activeRollId, 'jobName', e.target.value)} /></div>
                    <div className="space-y-1.5"><Label className="text-[9px] font-black uppercase opacity-40">Job Size</Label><Input className="h-10 font-bold bg-slate-50 border-none rounded-lg" value={activeConfig?.jobSize} onChange={e => updateRollConfig(activeRollId, 'jobSize', e.target.value)} /></div>
                  </div>

                  <div className="max-h-[250px] overflow-y-auto industrial-scroll">
                    <Table>
                      <TableHeader className="bg-slate-50/50 sticky top-0"><TableRow className="h-10 border-none">
                        <TableHead className="font-black text-[9px] uppercase">Slit Width (MM)</TableHead>
                        <TableHead className="font-black text-[9px] uppercase">Length (MTR)</TableHead>
                        <TableHead className="font-black text-[9px] uppercase">Qty</TableHead>
                        <TableHead className="w-10"></TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {activeConfig?.runs.map(run => (
                          <TableRow key={run.id} className="h-12 border-b last:border-none">
                            <TableCell><Input type="number" className="h-9 w-24 text-center font-bold" value={run.widthMm} onChange={e => updateRun(activeRollId, run.id, 'widthMm', Number(e.target.value))} /></TableCell>
                            <TableCell><Input type="number" className="h-9 w-24 text-center font-bold" value={run.lengthMeters} onChange={e => updateRun(activeRollId, run.id, 'lengthMeters', Number(e.target.value))} /></TableCell>
                            <TableCell><Input type="number" className="h-9 w-16 text-center font-bold" value={run.parts} onChange={e => updateRun(activeRollId, run.id, 'parts', Number(e.target.value))} /></TableCell>
                            <TableCell><Button variant="ghost" size="icon" onClick={() => removeRun(activeRollId, run.id)} className="h-8 w-8 text-slate-300 hover:text-rose-500"><Trash2 className="h-4 w-4" /></Button></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {/* DYNAMIC PATTERN PREVIEW (FOCUSED ROLL) */}
              <Card className="flex-1 shadow-xl border-none rounded-2xl overflow-hidden bg-white">
                <CardHeader className="bg-slate-50 border-b p-4">
                  <CardTitle className="text-[11px] font-black uppercase tracking-widest flex items-center gap-2"><LayoutGrid className="h-4 w-4 text-primary" /> Visual Yield Preview</CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="flex flex-wrap gap-4 justify-start overflow-y-auto h-[200px] industrial-scroll">
                    {getPreviewParts(activeRollId).map((part, i) => (
                      <div key={i} className={cn(
                        "w-[100px] h-[100px] rounded-xl border-2 flex flex-col items-center justify-center p-2 relative shadow-sm transition-all",
                        part.isRemainder ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-blue-50 border-blue-200 text-blue-700"
                      )}>
                        <span className="absolute top-1 left-2 text-[8px] font-black opacity-30">{part.label}</span>
                        <span className="text-xs font-black">{part.width} <small className="text-[8px]">MM</small></span>
                        <span className="text-[10px] font-bold opacity-40">x {part.length} M</span>
                        {part.isRemainder && <Badge className="absolute bottom-1 right-1 h-3 px-1 text-[6px] bg-emerald-500 uppercase">STOCK</Badge>}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* --- PLANNER OPTIONS MODAL --- */}
      <Dialog open={isOptionsModalOpen} onOpenChange={setIsOptionsModalOpen}>
        <DialogContent className="sm:max-w-[1200px] p-0 overflow-hidden rounded-[2.5rem] border-none shadow-3xl bg-slate-50 flex flex-col h-[90vh]">
          <div className="bg-slate-900 text-white p-8 shrink-0">
            <div className="flex justify-between items-center">
              <div className="space-y-1">
                <DialogTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-3">
                  <Sparkles className="h-5 w-5 text-primary" /> Stock Decision Support
                </DialogTitle>
                <div className="flex items-center gap-4">
                  <DialogDescription className="text-slate-400 text-[10px] font-bold uppercase">Compare efficiencies and technical yield</DialogDescription>
                  <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 font-black text-[9px] h-6 px-3">
                    AVAILABLE FOR JOB: {totalValidRollsSummary} ROLLS
                  </Badge>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-xl">
                  <span className="text-[10px] font-black uppercase">Supplier:</span>
                  <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
                    <SelectTrigger className="h-8 w-[180px] bg-transparent border-none text-white text-[10px]"><SelectValue /></SelectTrigger>
                    <SelectContent className="z-[110]"><SelectItem value="all">ALL SUPPLIERS</SelectItem>{Array.from(new Set(availableOptions.map((o: any) => o.company))).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setIsOptionsModalOpen(false)} className="text-white hover:bg-white/10"><X className="h-5 w-5" /></Button>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-8 industrial-scroll">
            <div className="grid grid-cols-1 gap-6">
              <Table>
                <TableHeader className="bg-slate-100/50">
                  <TableRow className="h-12">
                    <TableHead className="font-black text-[9px] uppercase pl-6">Dimension & Priority</TableHead>
                    <TableHead className="font-black text-[9px] uppercase text-center">Wastage Control</TableHead>
                    <TableHead className="font-black text-[9px] uppercase">Slitting Result</TableHead>
                    <TableHead className="font-black text-[9px] uppercase">Yield Details</TableHead>
                    <TableHead className="font-black text-[9px] uppercase text-center">Efficiency</TableHead>
                    <TableHead className="font-black text-[9px] uppercase text-right pr-6">Batch Selection</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {availableOptions.filter((o: any) => selectedSupplier === 'all' || o.company === selectedSupplier).map((opt: any) => {
                    const preference = wastagePreferences[opt.key] || 'STOCK';
                    const targetWidth = parseInt(String(selectedPlanningJob.values.paper_size || selectedPlanningJob.values.size).replace(/[^0-9]/g, '')) || 0;
                    
                    const adjustedWidth = opt.width / opt.splits;
                    const needsPrecisionWarning = (adjustedWidth * 10) % 5 !== 0;

                    const slittingText = preference === 'STOCK' 
                      ? `${targetWidth} mm x ${opt.splits}${opt.waste > 0 ? ` + ${opt.waste} mm (Stock)` : ''}`
                      : `${adjustedWidth.toFixed(1)} mm x ${opt.splits} (Adjusted)`;

                    return (
                      <TableRow key={opt.key} className="h-24 hover:bg-white transition-colors border-b last:border-none">
                        <TableCell className="pl-6">
                          <div className="flex flex-col gap-1">
                            <span className="text-[13px] font-black">{opt.width}mm x {opt.length}m</span>
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] font-black text-primary font-mono tracking-tighter">Roll: {opt.exampleId} | {opt.company}</span>
                            </div>
                            <Badge className={cn(
                              "text-[8px] font-black uppercase border-none px-2 w-fit",
                              opt.priorityLabel === "Best Fit" ? "bg-emerald-500" : 
                              opt.priorityLabel === "Alternate" ? "bg-blue-500" : "bg-slate-500"
                            )}>
                              {opt.priorityLabel}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex flex-col items-center gap-2">
                            <p className="text-[9px] font-black uppercase text-slate-400">Wastage: {opt.waste} mm</p>
                            <div className="flex items-center bg-slate-200 p-1 rounded-xl shadow-inner scale-90">
                              <Button 
                                variant={preference === 'STOCK' ? "default" : "ghost"} 
                                size="sm" 
                                className={cn("h-7 px-4 text-[9px] font-black uppercase rounded-lg transition-all", preference === 'STOCK' && "bg-emerald-500 text-white shadow-md hover:bg-emerald-600")}
                                onClick={() => setWastagePreferences({...wastagePreferences, [opt.key]: 'STOCK'})}
                              >STOCK</Button>
                              <Button 
                                variant={preference === 'ADJUST' ? "default" : "ghost"} 
                                size="sm" 
                                className={cn("h-7 px-4 text-[9px] font-black uppercase rounded-lg transition-all", preference === 'ADJUST' && "bg-orange-500 text-white shadow-md hover:bg-orange-600")}
                                onClick={() => setWastagePreferences({...wastagePreferences, [opt.key]: 'ADJUST'})}
                              >ADJUST</Button>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1.5">
                            <div className="bg-primary/5 border border-primary/10 rounded-xl p-3 inline-block">
                              <p className="text-[10px] font-black text-primary uppercase tracking-tight">{slittingText}</p>
                            </div>
                            {preference === 'ADJUST' && needsPrecisionWarning && (
                              <p className="text-[8px] font-bold text-orange-600 uppercase flex items-center gap-1">
                                <AlertTriangle className="h-2.5 w-2.5" /> Machine precision will apply
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="text-[10px] font-bold text-slate-600">
                              {opt.splits} units @ {opt.length} mtr
                            </div>
                            <div className="text-[9px] font-black text-slate-400 uppercase">
                              Output: {opt.yieldPerRoll.toLocaleString()} M
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-[9px] font-black">{Math.round(opt.efficiency * 100)}%</span>
                            <Progress value={opt.efficiency * 100} className="h-1 w-16 mx-auto" />
                          </div>
                        </TableCell>
                        <TableCell className="text-right pr-6">
                          <div className="flex items-center justify-end gap-2">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectionMap({...selectionMap, [opt.key]: Math.max(0, (selectionMap[opt.key] || 0) - 1)})}>-</Button>
                            <span className="w-10 text-center font-black text-xs bg-white border h-8 flex items-center justify-center rounded-lg">{selectionMap[opt.key] || 0}</span>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectionMap({...selectionMap, [opt.key]: Math.min(opt.availableCount, (selectionMap[opt.key] || 0) + 1)})}>+</Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="p-8 bg-white border-t border-slate-100 shadow-[0_-10px_20px_rgba(0,0,0,0.02)]">
            <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="flex-1 w-full space-y-4">
                <div className="flex justify-between items-end">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase text-slate-400">Total Production Progress</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-black text-slate-900">{selectionInsights.totalProduced.toLocaleString()} M</span>
                      <span className="text-xs font-bold text-slate-400">of {selectionInsights.required.toLocaleString()} M required</span>
                    </div>
                  </div>
                  <Badge variant={selectionInsights.remaining === 0 ? "default" : "outline"} className={cn(
                    "h-6 font-black text-[10px] uppercase border-2",
                    selectionInsights.remaining === 0 ? "bg-emerald-500 border-emerald-500 text-white" : "text-amber-600 border-amber-200"
                  )}>
                    {selectionInsights.remaining === 0 ? "Target Achieved" : `Remaining: ${selectionInsights.remaining.toLocaleString()} M`}
                  </Badge>
                </div>
                <Progress value={(selectionInsights.totalProduced / selectionInsights.required) * 100} className="h-2 bg-slate-100" />
              </div>
              <Button onClick={handleInitializeTerminalFromPlanner} size="lg" className="h-16 px-12 rounded-2xl bg-primary text-white font-black uppercase text-xs tracking-widest shadow-xl hover:shadow-2xl transition-all">
                Deploy Selection to Terminal
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* --- POST-EXECUTION REPORT DIALOG --- */}
      <Dialog open={isReportModalOpen} onOpenChange={setIsReportModalOpen}>
        <DialogContent className="sm:max-w-[1000px] p-0 overflow-hidden bg-slate-50 border-none shadow-3xl">
          <div className="bg-slate-900 text-white p-6 flex justify-between items-center no-print">
            <div className="flex items-center gap-4">
              <DialogTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /> Slitting Traceability Report</DialogTitle>
            </div>
            <div className="flex gap-2">
              <Button disabled={isProcessing} onClick={handlePrintReport} className="h-9 px-6 bg-primary font-black uppercase text-[10px] tracking-widest">
                {isProcessing ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Printer className="h-4 w-4 mr-2" />}
                Print Traceability Sheet
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setIsReportModalOpen(false)} className="text-white hover:bg-white/10"><X className="h-4 w-4" /></Button>
            </div>
          </div>
          
          <div className="p-10 overflow-y-auto max-h-[80vh] industrial-scroll">
            <div id="slitting-report-a4" className="bg-white p-12 shadow-sm mx-auto w-[210mm] min-h-[297mm] text-black font-sans">
              <div className="border-b-4 border-black pb-6 flex justify-between items-end mb-8">
                <div className="space-y-1">
                  <h1 className="text-4xl font-black tracking-tighter">SHREE LABEL CREATION</h1>
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-60">Production Log: Technical Slitting</p>
                </div>
                <div className="text-right space-y-1">
                  <Badge className="bg-black text-white px-4 py-1 font-black text-lg">BATCH LOG</Badge>
                  <p className="text-[10px] font-bold uppercase pt-2">DATE: {slittingReport?.date}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-12 mb-10">
                <div className="space-y-4">
                  <h3 className="text-xs font-black uppercase border-b-2 border-black pb-1">Job Information</h3>
                  <div className="grid grid-cols-2 gap-y-2 text-xs font-bold">
                    <span className="opacity-50 uppercase">Job Ref:</span><span className="font-mono">{slittingReport?.job?.id || "STOCK_RUN"}</span>
                    <span className="opacity-50 uppercase">Job Name:</span><span>{slittingReport?.job?.name || "UNASSIGNED"}</span>
                    <span className="opacity-50 uppercase">Operator:</span><span>{slittingReport?.operator}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <div className="border-2 border-black p-1"><QRCodeSVG value={`BATCH-${Date.now()}`} size={80} /></div>
                  <p className="text-[8px] font-black uppercase mt-1">Audit Batch ID</p>
                </div>
              </div>

              <div className="space-y-8">
                <div className="space-y-3">
                  <h3 className="text-xs font-black uppercase border-b-2 border-black pb-1">Source Material (Parent)</h3>
                  <Table className="border-2 border-black">
                    <TableHeader className="bg-slate-100">
                      <TableRow className="border-b-2 border-black"><TableHead className="font-black text-black text-[10px] uppercase text-center">Roll ID</TableHead><TableHead className="font-black text-black text-[10px] uppercase text-center">Type</TableHead><TableHead className="font-black text-black text-[10px] uppercase text-center">Dimension</TableHead></TableRow>
                    </TableHeader>
                    <TableBody>
                      {slittingReport?.parents.map((p: any) => (
                        <TableRow key={p.id} className="border-b border-black last:border-none text-center">
                          <TableCell className="font-bold font-mono">{p.rollNo}</TableCell>
                          <TableCell className="font-bold uppercase">{p.paperType}</TableCell>
                          <TableCell>{p.widthMm}mm x {p.lengthMeters}m</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="space-y-3">
                  <h3 className="text-xs font-black uppercase border-b-2 border-black pb-1">Slitting Output (Child Units)</h3>
                  <Table className="border-2 border-black">
                    <TableHeader className="bg-slate-100">
                      <TableRow className="border-b-2 border-black"><TableHead className="font-black text-black text-[10px] uppercase text-center">Child Roll ID</TableHead><TableHead className="font-black text-black text-[10px] uppercase text-center">Width</TableHead><TableHead className="font-black text-black text-[10px] uppercase text-center">Length</TableHead><TableHead className="font-black text-black text-[10px] uppercase text-center">Destination</TableHead></TableRow>
                    </TableHeader>
                    <TableBody>
                      {slittingReport?.children.map((c: any) => (
                        <TableRow key={c.id} className="border-b border-black last:border-none text-center">
                          <TableCell className="font-bold font-mono">{c.rollNo}</TableCell>
                          <TableCell>{c.widthMm} mm</TableCell>
                          <TableCell>{c.lengthMeters} mtr</TableCell>
                          <TableCell><Badge variant="outline" className="font-black text-[9px] uppercase">{c.jobNo ? 'JOB' : 'STOCK'}</Badge></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="mt-20 grid grid-cols-3 gap-12">
                <div className="border-2 border-black p-4 flex flex-col justify-end h-24">
                  <div className="border-t-2 border-black text-center pt-2"><p className="text-[9px] font-black uppercase">Operator Signature</p></div>
                </div>
                <div className="border-2 border-black p-4 flex flex-col justify-end h-24">
                  <div className="border-t-2 border-black text-center pt-2"><p className="text-[9px] font-black uppercase">QC Inspector</p></div>
                </div>
                <div className="border-2 border-black p-4 flex flex-col justify-end h-24">
                  <div className="border-t-2 border-black text-center pt-2"><p className="text-[9px] font-black uppercase">Store Manager</p></div>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <style jsx global>{`
        .industrial-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
        .industrial-scroll::-webkit-scrollbar-track { background: transparent; }
        .industrial-scroll::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .industrial-scroll::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        @media print {
          body * { visibility: hidden !important; }
          #slitting-report-a4, #slitting-report-a4 * { visibility: visible !important; }
          #slitting-report-a4 { position: absolute !important; left: 0; top: 0; width: 100%; display: block !important; }
        }
      `}</style>
    </div>
  )
}

export default function SlittingPage() {
  return (
    <Suspense fallback={<div className="p-20 text-center"><Loader2 className="animate-spin h-8 w-8 mx-auto text-primary" /></div>}>
      <SlittingHubContent />
    </Suspense>
  )
}
