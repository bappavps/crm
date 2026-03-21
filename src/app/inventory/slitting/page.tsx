
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
  Settings2
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

interface SlitRun {
  id: string;
  jobNo: string;
  jobName: string;
  jobSize: string;
  widthMm: number;
  lengthMeters: number;
  parts: number;
}

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/**
 * Industrial Naming Rules (V2):
 * Level 1 (Base Roll T-1038) -> Alphabetical (-A, -B)
 * Level 2 (Slitted Roll T-1038-C) -> Numeric (-1, -2)
 */
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

/**
 * Normalizes material names for matching (e.g., "PP WHITE" and "PP-WHITE" become "ppwhite")
 */
const normalizeMaterial = (m: string) => String(m || "").toLowerCase().replace(/[\s-]/g, '').trim();

/**
 * Sanitizes ID for Firestore paths (replacing slashes with hyphens)
 */
const sanitizeDocId = (id: string) => String(id || "").replace(/\//g, '-');

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
  
  // SUPPORT MULTI-ROLL SELECTION
  const [selectedRolls, setSelectedRolls] = useState<any[]>([])
  
  const [slitRuns, setSlitRuns] = useState<SlitRun[]>([
    { id: crypto.randomUUID(), jobNo: "", jobName: "", jobSize: "", widthMm: 0, lengthMeters: 0, parts: 1 }
  ])

  // --- AUTO PLANNER STATE ---
  const [plannerSearch, setPlannerSearch] = useState("")
  const [selectedPlanningJob, setSelectedJob] = useState<any>(null)
  const [isOptionsModalOpen, setIsOptionsModalOpen] = useState(false)
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false)
  const [isReportModalOpen, setIsReportModalOpen] = useState(false)
  const [slittingReport, setSlittingReport] = useState<any>(null)
  const [selectedSupplier, setSelectedSupplier] = useState<string>("all")
  const [selectionMap, setSelectionMap] = useState<Record<string, number>>({})

  const [modal, setModal] = useState<{ isOpen: boolean; type: ModalType; title: string; description?: string }>({ 
    isOpen: false, type: 'SUCCESS', title: '' 
  });

  useEffect(() => { setIsMounted(true) }, [])

  // 1. Fetch Planning Jobs for Auto Planner
  const planningJobsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'planning_tables/label-printing/rows'), where('values.printing_planning', '!=', 'Completed'));
  }, [firestore]);
  const { data: planningJobs, isLoading: planningLoading } = useCollection(planningJobsQuery);

  // 2. Fetch Available Stock for Analysis
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

  useEffect(() => {
    if (initialRollData && initialRollData.length > 0) {
      setSelectedRolls([initialRollData[0]]);
      setSlitRuns(prev => prev.map(r => ({ 
        ...r, 
        lengthMeters: initialRollData[0].lengthMeters, 
        widthMm: initialRollData[0].widthMm 
      })));
    }
  }, [initialRollData]);

  // --- ADVANCED OPTIONS ANALYTICS ---
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
        const usableLengthPerRoll = rl * splits;
        const requiredRolls = usableLengthPerRoll > 0 ? Math.ceil(jobLengthRequired / usableLengthPerRoll) : 1;

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
          availableCount: 0,
          rolls: [],
          exampleId: roll.rollNo
        };
      }
      groups[key].availableCount += 1;
      groups[key].rolls.push(roll);
    });

    return Object.values(groups).sort((a: any, b: any) => {
      if (a.width === targetWidth && b.width !== targetWidth) return -1;
      if (b.width === targetWidth && a.width !== targetWidth) return 1;
      const isAChild = a.width < 1000;
      const isBChild = b.width < 1000;
      if (isAChild && !isBChild) return -1;
      if (!isAChild && isBChild) return 1;
      return b.efficiency - a.efficiency;
    });
  }, [selectedPlanningJob, stockData]);

  const suppliers = useMemo(() => {
    const set = new Set(availableOptions.map((o: any) => o.company));
    return Array.from(set).sort();
  }, [availableOptions]);

  const filteredOptions = useMemo(() => {
    if (selectedSupplier === "all") return availableOptions;
    return availableOptions.filter((o: any) => o.company === selectedSupplier);
  }, [availableOptions, selectedSupplier]);

  const stats = useMemo(() => {
    if (!selectedPlanningJob) return null;
    const targetWidth = parseInt(String(selectedPlanningJob.values.paper_size || selectedPlanningJob.values.size).replace(/[^0-9]/g, '')) || 0;
    const jobLengthRequired = Number(selectedPlanningJob.values.allocate_mtrs) || 0;

    let totalProduced = 0;
    let totalWasteMm = 0;
    let totalRolls = 0;

    Object.entries(selectionMap).forEach(([key, qty]) => {
      const opt = availableOptions.find((o: any) => o.key === key) as any;
      if (opt && qty > 0) {
        totalProduced += (opt.length * opt.splits * qty);
        totalWasteMm += (opt.waste * qty);
        totalRolls += qty;
      }
    });

    return {
      targetWidth,
      required: jobLengthRequired,
      produced: totalProduced,
      remaining: Math.max(0, jobLengthRequired - totalProduced),
      isFulfilled: totalProduced >= jobLengthRequired,
      totalWasteMm,
      totalRolls
    };
  }, [selectionMap, availableOptions, selectedPlanningJob]);

  const handleOpenOptions = () => {
    setSelectionMap({});
    setSelectedSupplier("all");
    setIsOptionsModalOpen(true);
  };

  const handleConfirmSelection = () => {
    const selectedEntries = Object.entries(selectionMap).filter(([_, qty]) => qty > 0);
    if (selectedEntries.length === 0) return;
    setIsOptionsModalOpen(false);
    setIsSummaryModalOpen(true);
  };

  const handleInitializeTerminal = () => {
    const selectedEntries = Object.entries(selectionMap).filter(([_, qty]) => qty > 0);
    if (selectedEntries.length === 0) return;

    const allSelected: any[] = [];
    selectedEntries.forEach(([key, qty]) => {
      const opt = availableOptions.find((o: any) => o.key === key) as any;
      allSelected.push(...opt.rolls.slice(0, qty));
    });

    setSelectedRolls(allSelected);
    
    const runs: SlitRun[] = selectedEntries.map(([key, qty]) => {
      const opt = availableOptions.find((o: any) => o.key === key) as any;
      return {
        id: crypto.randomUUID(),
        jobNo: String(selectedPlanningJob.values.sn || selectedPlanningJob.id),
        jobName: selectedPlanningJob.values.name || "",
        jobSize: selectedPlanningJob.values.size || "",
        widthMm: opt.width === stats?.targetWidth ? opt.width : stats?.targetWidth || opt.width,
        lengthMeters: opt.length,
        parts: qty
      };
    });

    setSlitRuns(runs);
    setIsSummaryModalOpen(false);
    toast({ title: "Terminal Initialized", description: `Pre-filled workspace with ${allSelected.length} source rolls.` });
  };

  const handleAutoExecute = async () => {
    if (!firestore || !user || !selectedPlanningJob || !stats) return;
    setIsProcessing(true);

    try {
      const reportSourceRolls: any[] = [];
      const reportChildRolls: any[] = [];
      let totalWasteMm = 0;

      await runTransaction(firestore, async (transaction) => {
        const selectedEntries = Object.entries(selectionMap).filter(([_, qty]) => qty > 0);
        
        for (const [key, qty] of selectedEntries) {
          const opt = availableOptions.find((o: any) => o.key === key) as any;
          const rollsToProcess = opt.rolls.slice(0, qty);

          for (const roll of rollsToProcess) {
            const parentRef = doc(firestore, 'paper_stock', roll.id);
            transaction.update(parentRef, { 
              status: "Consumed", 
              dateOfUsed: new Date().toISOString().split('T')[0],
              updatedAt: serverTimestamp() 
            });
            
            reportSourceRolls.push(roll);
            totalWasteMm += opt.waste;

            let childIdx = 0;
            const targetWidth = stats.targetWidth;
            const splits = opt.splits;

            for (let i = 0; i < splits; i++) {
              const suffix = getChildSuffix(roll.rollNo, childIdx);
              const childId = sanitizeDocId(`${roll.rollNo}-${suffix}`);
              const childRef = doc(firestore, 'paper_stock', childId);
              
              const childData = {
                ...roll,
                id: childId,
                rollNo: childId,
                widthMm: targetWidth,
                lengthMeters: roll.lengthMeters,
                status: "Job Assign",
                jobNo: String(selectedPlanningJob.values.sn || selectedPlanningJob.id),
                jobName: selectedPlanningJob.values.name || "",
                jobSize: selectedPlanningJob.values.size || "",
                parentRollNo: roll.rollNo,
                sqm: Number(((targetWidth / 1000) * roll.lengthMeters).toFixed(2)),
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                createdById: user.uid
              };

              transaction.set(childRef, childData);
              reportChildRolls.push(childData);
              childIdx++;
            }

            if (opt.waste > 0) {
              const suffix = getChildSuffix(roll.rollNo, childIdx);
              const remainderId = sanitizeDocId(`${roll.rollNo}-${suffix}`);
              const remainderRef = doc(firestore, 'paper_stock', remainderId);
              
              transaction.set(remainderRef, {
                ...roll,
                id: remainderId,
                rollNo: remainderId,
                widthMm: opt.waste,
                lengthMeters: roll.lengthMeters,
                status: "Stock", 
                jobNo: "",
                jobName: "",
                jobSize: "",
                parentRollNo: roll.rollNo,
                sqm: Number(((opt.waste / 1000) * roll.lengthMeters).toFixed(2)),
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                createdById: user.uid,
                remarks: `Remainder from auto-slitting ${roll.rollNo}`
              });
            }
          }
        }

        const jobId = `JJC-AUTO-${Date.now().toString().slice(-6)}`;
        const jobCardRef = doc(firestore, 'jumbo_job_cards', jobId);
        
        transaction.set(jobCardRef, {
          id: jobId,
          job_card_no: jobId,
          parent_roll: reportSourceRolls[0]?.rollNo || "MULTI",
          parent_rolls: reportSourceRolls.map(r => r.rollNo),
          child_rolls: reportChildRolls.map(r => r.rollNo),
          status: "PENDING",
          createdAt: new Date().toISOString(),
          createdById: user.uid,
          createdByName: user.displayName || user.email,
          type: "AUTO_PLANNER",
          machine: "AUTO",
          operator: user.displayName || user.email,
          target_job_no: String(selectedPlanningJob.values.sn || selectedPlanningJob.id),
          target_job_name: selectedPlanningJob.values.name || ""
        });
      });

      setSlittingReport({
        jobName: selectedPlanningJob.values.name,
        material: selectedPlanningJob.values.material,
        targetWidth: stats.targetWidth,
        producedLength: stats.produced,
        remainingRequirement: stats.remaining,
        sourceRolls: reportSourceRolls,
        childRolls: reportChildRolls,
        totalWaste: totalWasteMm
      });

      setIsSummaryModalOpen(false);
      setIsReportModalOpen(true);
      toast({ title: "Auto Slitting Successful", description: "Paper stock updated and Job Card generated." });

    } catch (e: any) {
      setModal({ isOpen: true, type: 'ERROR', title: 'Execution Failed', description: e.message });
    } finally {
      setIsProcessing(false);
    }
  };

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
        } else {
          // APPEND TO LIST
          setSelectedRolls(prev => [...prev, data]);
          setSearchQuery(""); // Clear for next input
          if (slitRuns[0].widthMm === 0) {
            setSlitRuns([{ 
              id: crypto.randomUUID(), 
              jobNo: "", 
              jobName: "", 
              jobSize: "", 
              widthMm: data.widthMm, 
              lengthMeters: data.lengthMeters, 
              parts: 1 
            }]);
          }
        }
      }
    } catch (e) {
      toast({ variant: "destructive", title: "Search Error" });
    } finally {
      setIsProcessing(false);
    }
  }

  const addRun = () => {
    const baseline = selectedRolls[0];
    setSlitRuns([...slitRuns, { 
      id: crypto.randomUUID(), 
      jobNo: "", 
      jobName: "", 
      jobSize: "", 
      widthMm: baseline?.widthMm || 0, 
      lengthMeters: baseline?.lengthMeters || 0, 
      parts: 1 
    }]);
  }

  const removeRun = (id: string) => {
    if (slitRuns.length > 1) setSlitRuns(slitRuns.filter(r => r.id !== id));
  }

  const updateRun = (id: string, field: keyof SlitRun, value: any) => {
    setSlitRuns(slitRuns.map(r => r.id === id ? { ...r, [field]: value } : r));
  }

  const calculation = useMemo(() => {
    if (selectedRolls.length === 0) return { usedWidth: 0, remainder: 0, isValid: true, mode: 'WIDTH' };
    
    // Check against the first roll as baseline for sizing
    const baseline = selectedRolls[0];
    const hasLengthSplit = slitRuns.some(r => Number(r.lengthMeters) > 0 && Number(r.lengthMeters) < Number(baseline.lengthMeters));
    const mode = hasLengthSplit ? 'LENGTH' : 'WIDTH';

    if (mode === 'WIDTH') {
      const usedWidth = slitRuns.reduce((acc, r) => acc + (Number(r.widthMm) * Number(r.parts)), 0);
      const remainder = Number(baseline.widthMm) - usedWidth;
      // Also validate that this pattern fits ALL selected rolls
      const allValid = selectedRolls.every(r => (Number(r.widthMm) - usedWidth) >= 0);
      return { usedWidth, remainder, isValid: allValid, mode: 'WIDTH' };
    } else {
      const usedLength = slitRuns.reduce((acc, r) => acc + (Number(r.lengthMeters) * Number(r.parts)), 0);
      const remainder = Number(baseline.lengthMeters) - usedLength;
      const allValid = selectedRolls.every(r => (Number(r.lengthMeters) - usedLength) >= 0);
      return { usedLength, remainder, isValid: allValid, mode: 'LENGTH' };
    }
  }, [selectedRolls, slitRuns]);

  const previewParts = useMemo(() => {
    if (selectedRolls.length === 0) return [];
    const baseline = selectedRolls[0];
    const parts: any[] = [];
    let childIdx = 0;

    slitRuns.forEach((run) => {
      const pCount = Number(run.parts) || 0;
      for (let i = 0; i < pCount; i++) {
        const suffix = getChildSuffix(baseline.rollNo, childIdx);
        
        parts.push({
          label: suffix,
          rollId: `${baseline.rollNo}-${suffix}`,
          width: calculation.mode === 'WIDTH' ? (Number(run.widthMm) || baseline.widthMm) : baseline.widthMm,
          length: calculation.mode === 'LENGTH' ? (Number(run.lengthMeters) || baseline.lengthMeters) : baseline.lengthMeters,
          isJob: !!run.jobNo,
          jobNo: run.jobNo
        });
        childIdx++;
      }
    });

    if (calculation.remainder > 0) {
      const suffix = getChildSuffix(baseline.rollNo, childIdx);
      parts.push({
        label: suffix,
        rollId: `${baseline.rollNo}-${suffix}`,
        width: calculation.mode === 'WIDTH' ? calculation.remainder : baseline.widthMm,
        length: calculation.mode === 'LENGTH' ? calculation.remainder : baseline.lengthMeters,
        isRemainder: true
      });
    }

    return parts;
  }, [selectedRolls, slitRuns, calculation]);

  const handleExecuteSlitting = async () => {
    if (!firestore || !user || selectedRolls.length === 0 || !calculation.isValid) return;
    setIsProcessing(true);

    try {
      const reportChildRolls: any[] = [];
      const reportParentRollNos: string[] = [];

      await runTransaction(firestore, async (transaction) => {
        for (const parent of selectedRolls) {
          const parentRef = doc(firestore, 'paper_stock', parent.id);
          transaction.update(parentRef, { 
            status: "Consumed", 
            dateOfUsed: new Date().toISOString().split('T')[0],
            updatedAt: serverTimestamp() 
          });
          reportParentRollNos.push(parent.rollNo);

          let childIdx = 0;
          for (const run of slitRuns) {
            for (let i = 0; i < run.parts; i++) {
              const suffix = getChildSuffix(parent.rollNo, childIdx);
              const childId = sanitizeDocId(`${parent.rollNo}-${suffix}`);
              const childRef = doc(firestore, 'paper_stock', childId);
              
              const childStatus = run.jobNo ? "Job Assign" : "Slitting";
              const finalWidth = calculation.mode === 'WIDTH' ? Number(run.widthMm) : Number(parent.widthMm);
              const finalLength = calculation.mode === 'LENGTH' ? Number(run.lengthMeters) : Number(parent.lengthMeters);

              const childData = {
                ...parent,
                id: childId,
                rollNo: childId,
                widthMm: finalWidth,
                lengthMeters: finalLength,
                status: childStatus,
                jobNo: run.jobNo || "",
                jobName: run.jobName || "",
                jobSize: run.jobSize || "",
                parentRollNo: parent.rollNo,
                sqm: Number(((finalWidth / 1000) * finalLength).toFixed(2)),
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                createdById: user.uid
              };

              transaction.set(childRef, childData);
              reportChildRolls.push(childData);
              childIdx++;
            }
          }

          if (calculation.remainder > 0) {
            const suffix = getChildSuffix(parent.rollNo, childIdx);
            const remainderId = sanitizeDocId(`${parent.rollNo}-${suffix}`);
            const remainderRef = doc(firestore, 'paper_stock', remainderId);
            
            const remWidth = calculation.mode === 'WIDTH' ? calculation.remainder : Number(parent.widthMm);
            const remLength = calculation.mode === 'LENGTH' ? calculation.remainder : Number(parent.lengthMeters);

            transaction.set(remainderRef, {
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
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
              createdById: user.uid,
              remarks: `Remainder from slitting ${parent.rollNo}`
            });
          }
        }

        const jobId = `JJC-MANUAL-${Date.now().toString().slice(-6)}`;
        const jobCardRef = doc(firestore, 'jumbo_job_cards', jobId);
        transaction.set(jobCardRef, {
          id: jobId,
          job_card_no: jobId,
          parent_roll: reportParentRollNos[0],
          parent_rolls: reportParentRollNos,
          child_rolls: reportChildRolls.map(r => r.rollNo),
          status: "PENDING",
          createdAt: new Date().toISOString(),
          createdById: user.uid,
          createdByName: user.displayName || user.email,
          type: "MANUAL",
          machine: "MANUAL",
          operator: user.displayName || user.email,
          target_job_no: slitRuns[0]?.jobNo || "",
          target_job_name: slitRuns[0]?.jobName || ""
        });
      });

      setModal({ 
        isOpen: true, 
        type: 'SUCCESS', 
        title: 'Batch Complete', 
        description: `Successfully converted ${selectedRolls.length} rolls into technical child units.` 
      });
      setSelectedRolls([]);
      setSlitRuns([{ id: crypto.randomUUID(), jobNo: "", jobName: "", jobSize: "", widthMm: 0, lengthMeters: 0, parts: 1 }]);
      setSearchQuery("");
    } catch (e: any) {
      setModal({ isOpen: true, type: 'ERROR', title: 'Transaction Failed', description: e.message });
    } finally {
      setIsProcessing(false);
    }
  }

  const filteredPlanningJobs = useMemo(() => {
    if (!planningJobs) return [];
    if (!plannerSearch) return planningJobs.slice(0, 10);
    return planningJobs.filter(j => 
      String(j.values?.name || "").toLowerCase().includes(plannerSearch.toLowerCase()) ||
      String(j.values?.sn || "").includes(plannerSearch)
    );
  }, [planningJobs, plannerSearch]);

  if (!isMounted) return null;

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-20 font-sans animate-in fade-in duration-500">
      <ActionModal isOpen={modal.isOpen} onClose={() => setModal(p => ({ ...p, isOpen: false }))} {...modal} />

      <div className="flex items-center justify-between print:hidden">
        <div className="space-y-1">
          <h1 className="text-[28px] font-semibold tracking-tight text-slate-900">Advanced Slitting Terminal</h1>
          <p className="text-sm font-normal text-muted-foreground">Precision conversion engine matching production planning with live substrate inventory.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => window.print()} disabled={selectedRolls.length === 0} className="font-bold text-[10px] uppercase h-10 px-6 border-2 rounded-xl">
            <Printer className="mr-2 h-4 w-4" /> Print Slit Sheet
          </Button>
          <Button variant="ghost" onClick={() => router.push('/paper-stock')} className="font-bold text-[10px] uppercase h-10 px-6">
            <ArrowLeft className="mr-2 h-3 w-3" /> Technical Registry
          </Button>
        </div>
      </div>

      {/* --- AUTO SLITTING PLANNER --- */}
      <Card className="shadow-2xl border-none rounded-3xl overflow-hidden bg-white">
        <CardHeader className="bg-slate-900 text-white p-8">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-sm font-black uppercase tracking-[0.2em] flex items-center gap-3">
                <Sparkles className="h-5 w-5 text-primary" /> Auto Slitting Planner (Advanced Decision Mode)
              </CardTitle>
              <CardDescription className="text-slate-400 text-xs font-medium uppercase tracking-widest"> Analyze all stock options and combine rolls for maximum efficiency</CardDescription>
            </div>
            <Badge className="bg-primary/20 text-primary border-primary/30 font-black text-[9px] px-3 py-1 uppercase tracking-tighter">Powered by CRM Intelligence</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div className="space-y-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">1. Find Pending Job from Planning</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                  <Input 
                    placeholder="Search by Job Name or SN..." 
                    className="h-12 pl-10 rounded-2xl border-2 font-bold text-sm bg-slate-50"
                    value={plannerSearch}
                    onChange={e => setPlannerSearch(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-3 max-h-[350px] overflow-y-auto industrial-scroll pr-2">
                {planningLoading ? (
                  <div className="py-10 text-center"><Loader2 className="animate-spin h-6 w-6 mx-auto text-primary" /></div>
                ) : filteredPlanningJobs.map(job => (
                  <div 
                    key={job.id} 
                    onClick={() => setSelectedJob(job)}
                    className={cn(
                      "p-4 rounded-2xl border-2 transition-all cursor-pointer group flex items-center justify-between",
                      selectedPlanningJob?.id === job.id ? "border-primary bg-primary/5" : "border-slate-100 hover:border-primary/20 hover:bg-slate-50"
                    )}
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 bg-white rounded-xl flex items-center justify-center font-black text-xs shadow-sm border group-hover:text-primary transition-colors">
                        {job.values.sn || '—'}
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-sm font-black uppercase tracking-tight">{job.values.name}</p>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[9px] font-bold text-slate-400 uppercase">
                          <span className="flex items-center gap-1"><Maximize2 className="h-3 w-3" /> {job.values.paper_size || job.values.size}</span>
                          <span className="flex items-center gap-1"><ArrowRightLeft className="h-3 w-3" /> {job.values.allocate_mtrs} MTR</span>
                          <span className="flex items-center gap-1 text-primary"><FileText className="h-3 w-3" /> {job.values.material}</span>
                        </div>
                      </div>
                    </div>
                    {selectedPlanningJob?.id === job.id ? <CheckCircle2 className="h-5 w-5 text-primary" /> : <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-primary" />}
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-6">
              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">2. Smart Selection Logic</Label>
              
              {!selectedPlanningJob ? (
                <div className="h-[350px] border-4 border-dashed rounded-[2rem] flex flex-col items-center justify-center text-center p-8 opacity-30 gap-4">
                  <Zap className="h-12 w-12" />
                  <p className="text-xs font-black uppercase tracking-widest">Select a job to start analysis</p>
                </div>
              ) : (
                <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
                  <div className="p-8 bg-slate-900 rounded-[2rem] text-white space-y-8 relative overflow-hidden">
                    <div className="space-y-1">
                      <p className="text-[9px] font-black uppercase text-primary tracking-[0.2em]">Decision Support Engine</p>
                      <h3 className="text-2xl font-black tracking-tight">{selectedPlanningJob.values.name}</h3>
                      <div className="grid grid-cols-2 gap-4 mt-4">
                        <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                          <p className="text-[8px] font-bold uppercase opacity-40">Target Width</p>
                          <p className="text-xl font-black">{parseInt(String(selectedPlanningJob.values.paper_size || selectedPlanningJob.values.size).replace(/[^0-9]/g, ''))} mm</p>
                        </div>
                        <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                          <p className="text-[8px] font-bold uppercase opacity-40">Allocated Meters</p>
                          <p className="text-xl font-black">{selectedPlanningJob.values.allocate_mtrs} m</p>
                        </div>
                      </div>
                    </div>

                    <div className="text-[10px] font-medium leading-relaxed opacity-60">
                      We found <strong>{availableOptions.length} stock variants</strong> matching the material <strong>"{selectedPlanningJob.values.material}"</strong>. Click below to view all options and compare efficiencies.
                    </div>

                    <Button onClick={handleOpenOptions} className="w-full h-14 rounded-2xl bg-primary hover:bg-primary/90 text-white font-black uppercase text-[11px] tracking-widest shadow-2xl">
                      <LayoutGrid className="mr-2 h-4 w-4" /> View All Stock Options
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* --- SMART SLITTING OPTIONS MODAL --- */}
      <Dialog open={isOptionsModalOpen} onOpenChange={setIsOptionsModalOpen}>
        <DialogContent className="sm:max-w-[1100px] p-0 overflow-hidden rounded-[2.5rem] border-none shadow-3xl bg-slate-50 flex flex-col h-[90vh]">
          <div className="bg-slate-900 text-white p-8 shrink-0">
            <div className="flex justify-between items-center">
              <div className="space-y-1">
                <DialogTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-3">
                  <Sparkles className="h-5 w-5 text-primary" /> Smart Slitting Options
                </DialogTitle>
                <DialogDescription className="text-slate-400 text-[10px] font-bold uppercase tracking-tighter">Compare substrate efficiency and select optimal rolls</DialogDescription>
              </div>
              <div className="flex gap-4">
                <div className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-xl border border-white/10">
                  <Filter className="h-3.5 w-3.5 text-primary" />
                  <span className="text-[10px] font-black uppercase mr-2">Supplier Filter</span>
                  <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
                    <SelectTrigger className="h-8 w-[180px] bg-transparent border-none text-white font-bold text-[10px] focus:ring-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="z-[110]">
                      <SelectItem value="all">ALL SUPPLIERS</SelectItem>
                      {suppliers.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setIsOptionsModalOpen(false)} className="text-white hover:bg-white/10"><X className="h-5 w-5" /></Button>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-auto industrial-scroll p-8">
            <div className="space-y-8">
              <Table>
                <TableHeader className="bg-slate-100/50">
                  <TableRow className="h-12 border-none">
                    <TableHead className="font-black text-[9px] uppercase pl-6 rounded-l-2xl">Roll ID</TableHead>
                    <TableHead className="font-black text-[9px] uppercase">Roll Specs</TableHead>
                    <TableHead className="font-black text-[9px] uppercase">Company</TableHead>
                    <TableHead className="font-black text-[9px] uppercase text-center">Output Potential</TableHead>
                    <TableHead className="font-black text-[9px] uppercase text-center">Waste Analysis</TableHead>
                    <TableHead className="font-black text-[9px] uppercase text-center">Efficiency</TableHead>
                    <TableHead className="font-black text-[9px] uppercase text-center">Available</TableHead>
                    <TableHead className="font-black text-[9px] uppercase text-right pr-6 rounded-r-2xl">Select Quantity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOptions.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="py-20 text-center opacity-30 font-black uppercase text-[10px]">No compatible rolls found for this supplier</TableCell></TableRow>
                  ) : filteredOptions.map((opt: any, i: number) => {
                    const isSystemRecommended = i === 0 && selectedSupplier === 'all';
                    const isSelected = (selectionMap[opt.key] || 0) > 0;
                    const isDisabled = stats?.totalRolls && stats.totalRolls > 0 && selectedSupplier === 'all' && Object.keys(selectionMap).some(k => availableOptions.find(o => o.key === k)?.company !== opt.company && selectionMap[k] > 0);

                    return (
                      <TableRow 
                        key={opt.key} 
                        className={cn(
                          "group h-20 transition-all border-b border-slate-100",
                          isSelected ? "bg-primary/5" : "hover:bg-slate-50",
                          isDisabled && "opacity-30 pointer-events-none grayscale"
                        )}
                      >
                        <TableCell className="pl-6 font-black text-xs text-primary font-mono">{opt.exampleId}</TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-black text-sm">{opt.width}mm x {opt.length}m</span>
                            <span className="text-[9px] font-bold text-slate-400 uppercase">{opt.material}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[9px] font-black uppercase tracking-tighter border-slate-200">{opt.company}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex flex-col">
                            <span className="text-sm font-black">{opt.splits} <small className="text-[9px] font-medium opacity-50">Slits/Roll</small></span>
                            <span className="text-[9px] font-bold text-emerald-600 uppercase">{(opt.splits * opt.length)} mtr yield</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex flex-col">
                            <span className={cn("text-sm font-black", opt.waste > 0 ? "text-rose-500" : "text-emerald-500")}>{opt.waste} mm</span>
                            <span className="text-[9px] font-bold text-slate-400 uppercase">Side Waste</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex flex-col items-center gap-1.5">
                            <span className="text-xs font-black">{(opt.efficiency * 100).toFixed(1)}%</span>
                            <div className="w-16 h-1 bg-slate-200 rounded-full overflow-hidden">
                              <div className="h-full bg-primary" style={{ width: `${opt.efficiency * 100}%` }} />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary" className="font-black text-[9px]">{opt.availableCount} ROLLS</Badge>
                        </TableCell>
                        <TableCell className="text-right pr-6">
                          <div className="flex items-center justify-end gap-3">
                            {isSystemRecommended && !isSelected && <Badge className="bg-emerald-500 font-black text-[8px] h-5">BEST CHOICE</Badge>}
                            <div className="flex items-center bg-white border-2 border-slate-200 rounded-xl p-1">
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const current = selectionMap[opt.key] || 0;
                                  if (current > 0) {
                                    const next = { ...selectionMap, [opt.key]: current - 1 };
                                    setSelectionMap(next);
                                    if (Object.values(next).every(v => v === 0)) setSelectedSupplier("all");
                                  }
                                }}
                                className="h-8 w-8 flex items-center justify-center hover:bg-slate-50 text-slate-400"
                              >-</button>
                              <Input 
                                className="w-12 h-8 border-none text-center font-black text-xs focus-visible:ring-0" 
                                value={selectionMap[opt.key] || 0}
                                readOnly
                              />
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const current = selectionMap[opt.key] || 0;
                                  if (current < opt.availableCount) {
                                    setSelectionMap({ ...selectionMap, [opt.key]: current + 1 });
                                    setSelectedSupplier(opt.company);
                                  }
                                }}
                                className="h-8 w-8 flex items-center justify-center hover:bg-slate-50 text-primary font-black"
                              >+</button>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="shrink-0 bg-white border-t border-slate-200 p-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              <div className="md:col-span-3">
                <div className="grid grid-cols-3 gap-6">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase text-slate-400">Production Goal</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-black">{stats?.produced.toLocaleString()}</span>
                      <span className="text-xs font-bold opacity-40">/ {stats?.required.toLocaleString()} MTR</span>
                    </div>
                    <Progress value={((stats?.produced || 0) / (stats?.required || 1)) * 100} className="h-1.5 mt-2" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase text-slate-400">Total Selection</p>
                    <p className="text-2xl font-black">{stats?.totalRolls} <small className="text-xs font-medium opacity-40">Rolls</small></p>
                    <p className={cn("text-[9px] font-bold uppercase", stats?.isFulfilled ? "text-emerald-600" : "text-amber-500")}>
                      {stats?.isFulfilled ? "Goal Reached" : `${stats?.remaining.toLocaleString()} mtr short`}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase text-slate-400">Material Waste</p>
                    <p className="text-2xl font-black text-rose-500">{stats?.totalWasteMm} <small className="text-xs font-medium opacity-40">MM</small></p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase">Width Summation</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center">
                <Button 
                  onClick={handleConfirmSelection} 
                  disabled={!stats?.totalRolls || stats.totalRolls === 0}
                  className="w-full h-16 rounded-2xl bg-primary hover:bg-primary/90 text-white font-black uppercase text-xs tracking-[0.1em] shadow-xl transition-all active:scale-95"
                >
                  Confirm Selection <ArrowRight className="ml-3 h-5 w-5" />
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* --- SLITTING EXECUTION SUMMARY MODAL --- */}
      <Dialog open={isSummaryModalOpen} onOpenChange={setIsSummaryModalOpen}>
        <DialogContent className="sm:max-w-[900px] p-0 overflow-hidden rounded-[2.5rem] border-none shadow-3xl bg-white flex flex-col max-h-[90vh]">
          <div className="bg-slate-900 text-white p-8 shrink-0">
            <div className="flex justify-between items-center">
              <div className="space-y-1">
                <DialogTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" /> Slitting Execution Summary
                </DialogTitle>
                <DialogDescription className="text-slate-400 text-[10px] font-bold uppercase tracking-tighter">Technical audit before production release</DialogDescription>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setIsSummaryModalOpen(false)} className="text-white hover:bg-white/10"><X className="h-5 w-5" /></Button>
            </div>
          </div>

          <div className="flex-1 overflow-auto industrial-scroll p-8">
            <div className="space-y-10">
              <div className="space-y-4">
                <div className="flex items-center gap-3 border-b pb-2">
                  <Briefcase className="h-4 w-4 text-primary" />
                  <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-900">1. Job Information</h4>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 bg-slate-50 p-6 rounded-2xl border-2 border-slate-100">
                  <SummaryField label="Job Name" value={selectedPlanningJob?.values.name} />
                  <SummaryField label="Job Number" value={selectedPlanningJob?.values.sn || selectedPlanningJob?.id} />
                  <SummaryField label="Material" value={selectedPlanningJob?.values.material} highlight />
                  <SummaryField label="Required Width" value={stats?.targetWidth + " mm"} />
                  <SummaryField label="Required Length" value={stats?.required.toLocaleString() + " mtr"} />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-3 border-b pb-2">
                  <Package className="h-4 w-4 text-primary" />
                  <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-900">2. Source Rolls Allocation</h4>
                </div>
                <div className="bg-white border-2 border-slate-100 rounded-2xl overflow-hidden">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow className="h-10 border-none">
                        <TableHead className="font-bold text-[9px] uppercase pl-6">Roll ID</TableHead>
                        <TableHead className="font-bold text-[9px] uppercase">Dimension</TableHead>
                        <TableHead className="font-bold text-[9px] uppercase">Company</TableHead>
                        <TableHead className="font-bold text-[9px] uppercase text-center">Allocated Qty</TableHead>
                        <TableHead className="font-bold text-[9px] uppercase text-right pr-6">Yield Potential</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(selectionMap).map(([key, qty]) => {
                        const opt = availableOptions.find((o: any) => o.key === key) as any;
                        if (!opt || qty <= 0) return null;
                        return (
                          <TableRow key={key} className="h-12 border-b last:border-none">
                            <TableCell className="pl-6 font-bold text-xs font-mono text-primary">{opt.exampleId}</TableCell>
                            <TableCell className="font-bold text-xs">{opt.width}mm x {opt.length}m</TableCell>
                            <TableCell><Badge variant="outline" className="text-[8px] font-black">{opt.company}</Badge></TableCell>
                            <TableCell className="text-center font-black text-primary">{qty} ROLLS</TableCell>
                            <TableCell className="text-right pr-6 font-bold text-xs">{(opt.length * opt.splits * qty).toLocaleString()} mtr</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <div className="flex items-center gap-3 border-b pb-2">
                    <Maximize2 className="h-4 w-4 text-primary" />
                    <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-900">3. Slitting Yield Plan</h4>
                  </div>
                  <div className="bg-slate-50 p-6 rounded-2xl border-2 border-slate-100 space-y-4">
                    <div className="flex justify-between items-center"><span className="text-[10px] font-bold text-slate-500 uppercase">Target Slit Width</span><span className="font-black text-sm">{stats?.targetWidth} mm</span></div>
                    <div className="flex justify-between items-center"><span className="text-[10px] font-bold text-slate-500 uppercase">Total Produced Length</span><span className="font-black text-sm text-emerald-600">{stats?.produced.toLocaleString()} mtr</span></div>
                    <div className="flex justify-between items-center"><span className="text-[10px] font-bold text-slate-500 uppercase">Remaining Requirement</span><span className="font-black text-sm text-primary">{stats?.remaining.toLocaleString()} mtr</span></div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center gap-3 border-b pb-2">
                    <AlertTriangle className="h-4 w-4 text-rose-500" />
                    <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-900">4. Waste Analytics</h4>
                  </div>
                  <div className="bg-rose-50/30 p-6 rounded-2xl border-2 border-rose-100 space-y-4">
                    <div className="flex justify-between items-center"><span className="text-[10px] font-bold text-rose-600/60 uppercase">Side Waste Calculation</span><span className="font-black text-sm text-rose-600">Dynamic per roll</span></div>
                    <div className="flex justify-between items-center"><span className="text-[10px] font-bold text-rose-600/60 uppercase">Width Loss</span><span className="font-black text-sm text-rose-600">{stats?.totalWasteMm} mm</span></div>
                    <div className="text-[9px] font-medium text-rose-400 italic">Total width waste across {stats?.totalRolls} units.</div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-3 border-b pb-2">
                  <Layers className="h-4 w-4 text-primary" />
                  <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-900">5. Registry Impact (Stock Movement)</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-5 border-2 rounded-2xl border-rose-100 bg-rose-50/20">
                    <div className="flex items-center gap-2 mb-3"><X className="h-3 w-3 text-rose-500" /><span className="text-[9px] font-black uppercase text-rose-600">Consumed Rolls (Retired)</span></div>
                    <div className="space-y-1">
                      {Object.entries(selectionMap).map(([key, qty]) => {
                        const opt = availableOptions.find((o: any) => o.key === key) as any;
                        if (!opt || qty <= 0) return null;
                        return <p key={key} className="text-[10px] font-bold text-slate-700 opacity-70">{qty}x {opt.width}mm ({opt.company})</p>
                      })}
                    </div>
                  </div>
                  <div className="p-5 border-2 rounded-2xl border-emerald-100 bg-emerald-50/20">
                    <div className="flex items-center gap-2 mb-3"><CheckCircle2 className="h-3 w-3 text-emerald-500" /><span className="text-[9px] font-black uppercase text-emerald-600">New Child Units (Generated)</span></div>
                    <p className="text-xl font-black text-emerald-700">
                      {Object.entries(selectionMap).reduce((acc, [key, qty]) => {
                        const opt = availableOptions.find((o: any) => o.key === key) as any;
                        return acc + (opt?.splits || 0) * qty;
                      }, 0)} <small className="text-[10px] font-bold opacity-60">TECHNICAL UNITS</small>
                    </p>
                    <p className="text-[9px] font-medium text-emerald-600/60 mt-1 italic">Child units will inherit parent lineage and job assignment.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="shrink-0 bg-slate-50 border-t p-8">
            <div className="flex gap-4">
              <Button variant="outline" className="flex-1 h-14 rounded-2xl font-black uppercase text-[11px] tracking-widest border-2" onClick={() => setIsSummaryModalOpen(false)}>Discard Plan</Button>
              <Button variant="outline" onClick={handleInitializeTerminal} className="flex-1 h-14 rounded-2xl font-black uppercase text-[11px] tracking-widest border-2">
                Manual Terminal <Settings2 className="ml-2 h-4 w-4" />
              </Button>
              <Button onClick={handleAutoExecute} disabled={isProcessing} className="flex-[2] h-14 rounded-2xl bg-primary hover:bg-primary/90 text-white font-black uppercase text-[11px] tracking-widest shadow-2xl">
                {isProcessing ? <Loader2 className="animate-spin h-5 w-5 mr-2" /> : <Scissors className="mr-2 h-5 w-5" />}
                Confirm & Execute Slitting
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* --- SLITTING TRANSACTION REPORT MODAL --- */}
      <Dialog open={isReportModalOpen} onOpenChange={setIsReportModalOpen}>
        <DialogContent className="sm:max-w-[800px] p-0 overflow-hidden rounded-[2.5rem] border-none shadow-3xl bg-white flex flex-col max-h-[90vh]">
          <div className="bg-emerald-600 text-white p-8 shrink-0">
            <div className="flex justify-between items-center">
              <div className="space-y-1">
                <DialogTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5" /> Slitting Transaction Report
                </DialogTitle>
                <DialogDescription className="text-emerald-100 text-[10px] font-bold uppercase tracking-tighter">Execution completed successfully</DialogDescription>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setIsReportModalOpen(false)} className="text-white hover:bg-white/10"><X className="h-5 w-5" /></Button>
            </div>
          </div>

          <div className="flex-1 overflow-auto industrial-scroll p-8 space-y-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 bg-slate-50 p-6 rounded-2xl border-2 border-slate-100">
              <SummaryField label="Job Name" value={slittingReport?.jobName} />
              <SummaryField label="Material" value={slittingReport?.material} highlight />
              <SummaryField label="Total Produced" value={slittingReport?.producedLength?.toLocaleString() + " mtr"} />
              <SummaryField label="Child Units" value={slittingReport?.childRolls?.length} />
            </div>

            <div className="space-y-4">
              <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-900 border-b pb-2 flex items-center gap-2">
                <Package className="h-4 w-4 text-primary" /> Generated Child Rolls
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {slittingReport?.childRolls.slice(0, 15).map((roll: any) => (
                  <div key={roll.rollNo} className="p-3 border rounded-xl bg-white shadow-sm flex flex-col gap-1">
                    <span className="text-[10px] font-black text-primary font-mono">{roll.rollNo}</span>
                    <span className="text-[9px] font-bold opacity-50 uppercase">{roll.widthMm}mm x {roll.lengthMeters}m</span>
                  </div>
                ))}
                {slittingReport?.childRolls.length > 15 && (
                  <div className="p-3 border rounded-xl bg-slate-50 flex items-center justify-center italic text-[9px] font-bold opacity-40">
                    + {slittingReport.childRolls.length - 15} more units
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 bg-amber-50/50 rounded-2xl border-2 border-amber-100">
              <div className="flex items-center gap-3 mb-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <span className="text-[11px] font-black uppercase text-amber-700">Production Waste Summary</span>
              </div>
              <p className="text-xs font-bold text-amber-800">Total Material Waste: {slittingReport?.totalWaste} mm (Width Cumulative)</p>
            </div>
          </div>

          <div className="shrink-0 bg-slate-50 border-t p-8">
            <Button onClick={() => setIsReportModalOpen(false)} className="w-full h-14 rounded-2xl bg-slate-900 hover:bg-black text-white font-black uppercase text-[11px] tracking-widest shadow-xl">
              Close Report & Return to Terminal
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 print:hidden">
        {/* Source Roll Selection (MULTI SUPPORT) */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="shadow-xl border-none rounded-3xl overflow-hidden bg-white">
            <CardHeader className="bg-slate-900 text-white p-6">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Search className="h-4 w-4 text-primary" /> Source Roll Batch
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="flex gap-2">
                <Input 
                  placeholder="Scan or Enter Roll ID..." 
                  className="h-12 font-semibold uppercase rounded-xl border-2" 
                  value={searchQuery} 
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                />
                <Button onClick={handleSearch} disabled={isProcessing} className="h-12 w-12 rounded-xl bg-slate-900 text-white shrink-0">
                  {isProcessing ? <Loader2 className="animate-spin h-5 w-5" /> : <Search className="h-5 w-5" />}
                </Button>
              </div>

              {selectedRolls.length > 0 ? (
                <div className="space-y-3 max-h-[400px] overflow-y-auto industrial-scroll pr-2">
                  {selectedRolls.map((roll, idx) => (
                    <div key={roll.id} className="p-4 bg-primary/5 rounded-2xl border-2 border-primary/20 space-y-3 relative group/roll animate-in slide-in-from-top-2">
                      <button 
                        onClick={() => setSelectedRolls(selectedRolls.filter(r => r.id !== roll.id))}
                        className="absolute top-2 right-2 h-6 w-6 rounded-full bg-white border shadow-sm flex items-center justify-center text-slate-400 hover:text-rose-500 opacity-0 group-hover/roll:opacity-100 transition-opacity"
                      >
                        <X className="h-3 w-3" />
                      </button>
                      <div className="flex justify-between items-center">
                        <Badge className="bg-purple-600 font-semibold">{roll.rollNo}</Badge>
                        <Badge variant="outline" className="font-semibold uppercase text-[9px]">{roll.status}</Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[10px] font-bold uppercase opacity-60">
                        <span>{roll.paperType}</span>
                        <span className="text-right">{roll.widthMm}mm x {roll.lengthMeters}m</span>
                      </div>
                    </div>
                  ))}
                  <div className="pt-2">
                    <Button variant="ghost" className="w-full border-2 border-dashed border-slate-200 h-12 rounded-xl font-bold uppercase text-[10px] text-slate-400 hover:text-primary hover:border-primary/40" onClick={() => { setSearchQuery(""); document.querySelector('input')?.focus(); }}>
                      <Plus className="h-4 w-4 mr-2" /> Add Another Roll
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="py-12 text-center space-y-4 border-4 border-dashed rounded-3xl opacity-30">
                  <Package className="h-12 w-12 mx-auto" />
                  <p className="text-[10px] font-semibold uppercase tracking-widest">No Rolls Loaded</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className={cn("shadow-2xl border-none rounded-3xl overflow-hidden transition-all duration-500", calculation.isValid ? "bg-slate-900 text-white" : "bg-rose-600 text-white")}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold opacity-90">
                Slitting Conversion Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 py-4">
              <div className="flex justify-between items-end">
                <div className="space-y-1">
                  <p className="text-[10px] font-semibold uppercase opacity-60">Batch Output Potential</p>
                  <p className="text-4xl font-bold tracking-tight">
                    {calculation.mode === 'WIDTH' ? calculation.usedWidth : (calculation as any).usedLength} 
                    <small className="text-xs ml-1 font-normal">{calculation.mode === 'WIDTH' ? 'MM' : 'MTR'}</small>
                  </p>
                </div>
                <div className="text-right space-y-1">
                  <p className="text-[10px] font-semibold uppercase opacity-60">Remainder / Roll</p>
                  <p className={cn("text-2xl font-bold tracking-tight", calculation.remainder < 0 ? "text-rose-200" : "text-emerald-400")}>
                    {calculation.remainder} <small className="text-xs font-normal">{calculation.mode === 'WIDTH' ? 'MM' : 'MTR'}</small>
                  </p>
                </div>
              </div>
              
              {!calculation.isValid && (
                <div className="bg-white/10 p-3 rounded-xl flex items-center gap-3 animate-pulse">
                  <AlertTriangle className="h-5 w-5 text-rose-200" />
                  <p className="text-[10px] font-semibold uppercase leading-tight">
                    Dimension exceeds limits for one or more rolls in batch.
                  </p>
                </div>
              )}
            </CardContent>
            <CardFooter className="p-0 border-t border-white/10">
              <Button 
                onClick={handleExecuteSlitting} 
                disabled={selectedRolls.length === 0 || !calculation.isValid || isProcessing} 
                className={cn("w-full h-16 rounded-none font-semibold uppercase tracking-widest transition-all", calculation.isValid ? "bg-primary hover:bg-primary/90" : "bg-rose-700")}
              >
                {isProcessing ? <Loader2 className="animate-spin h-6 w-6" /> : <Scissors className="mr-3 h-5 w-5" />}
                Execute Batch ({selectedRolls.length})
              </Button>
            </CardFooter>
          </Card>
        </div>

        <div className="lg:col-span-3 space-y-6">
          <Card className="shadow-xl border-none rounded-3xl overflow-hidden flex flex-col bg-white">
            <CardHeader className="bg-slate-50 border-b flex flex-row items-center justify-between p-6">
              <div className="space-y-1">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-primary" /> Slitting Run Specification
                </CardTitle>
                <p className="text-[10px] font-medium text-slate-400 uppercase">Pattern applies to all rolls in the batch.</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => setSlitRuns([{ id: crypto.randomUUID(), jobNo: "", jobName: "", jobSize: "", widthMm: selectedRolls[0]?.widthMm || 0, lengthMeters: selectedRolls[0]?.lengthMeters || 0, parts: 1 }])} className="h-9 px-4 font-black uppercase text-[10px] text-rose-500">
                  Clear Table
                </Button>
                <Button size="sm" variant="outline" onClick={addRun} className="h-9 px-4 font-semibold uppercase text-[10px] rounded-xl border-2">
                  <Plus className="h-4 w-4 mr-2" /> Add Run Row
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-auto industrial-scroll max-h-[400px]">
              <Table>
                <TableHeader className="bg-slate-50/50 sticky top-0 z-10">
                  <TableRow>
                    <TableHead className="font-semibold text-[10px] uppercase pl-8 py-4">Job Details</TableHead>
                    <TableHead className="font-semibold text-[10px] uppercase text-center w-[120px]">Width (MM)</TableHead>
                    <TableHead className="font-semibold text-[10px] uppercase text-center w-[120px]">Length (MTR)</TableHead>
                    <TableHead className="font-semibold text-[10px] uppercase text-center w-[100px]">Qty</TableHead>
                    <TableHead className="font-semibold text-[10px] uppercase text-right w-[150px]">Conversion/Roll</TableHead>
                    <TableHead className="w-20 pr-8"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {slitRuns.map((run, idx) => (
                    <TableRow key={run.id} className="hover:bg-slate-50/50 min-h-24 group border-b">
                      <TableCell className="pl-8 py-4">
                        <div className="flex flex-col gap-3 max-w-lg">
                          <div className="relative">
                            <Input 
                              placeholder="Job No (e.g. JOB-4501)" 
                              className="h-10 font-semibold uppercase border-none bg-slate-100/50 rounded-xl text-xs pl-9" 
                              value={run.jobNo} 
                              onChange={e => updateRun(run.id, 'jobNo', e.target.value)}
                            />
                            <Briefcase className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="relative">
                              <Input 
                                placeholder="Job Name" 
                                className="h-9 font-medium border-none bg-slate-100/30 rounded-xl text-[10px] pl-8" 
                                value={run.jobName} 
                                onChange={e => updateRun(run.id, 'jobName', e.target.value)}
                              />
                              <FileText className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                            </div>
                            <div className="relative">
                              <Input 
                                placeholder="Job Size" 
                                className="h-9 font-medium border-none bg-slate-100/30 rounded-xl text-[10px] pl-8" 
                                value={run.jobSize} 
                                onChange={e => updateRun(run.id, 'jobSize', e.target.value)}
                              />
                              <Maximize2 className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center">
                          <Input 
                            type="number" 
                            className="h-10 w-24 text-center font-bold border-2 border-slate-200 rounded-xl" 
                            value={run.widthMm || ""} 
                            placeholder={String(selectedRolls[0]?.widthMm || 0)}
                            onChange={e => updateRun(run.id, 'widthMm', Number(e.target.value))}
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center">
                          <Input 
                            type="number" 
                            className="h-10 w-24 text-center font-bold border-2 border-slate-200 rounded-xl" 
                            value={run.lengthMeters || ""} 
                            placeholder={String(selectedRolls[0]?.lengthMeters || 0)}
                            onChange={e => updateRun(run.id, 'lengthMeters', Number(e.target.value))}
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center">
                          <Input 
                            type="number" 
                            className="h-10 w-16 text-center font-bold border-2 border-slate-200 rounded-xl" 
                            value={run.parts || ""} 
                            onChange={e => updateRun(run.id, 'parts', Number(e.target.value))}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-sm font-semibold text-slate-400 group-hover:text-primary transition-colors">
                          {calculation.mode === 'WIDTH' 
                            ? `${Number(run.widthMm || selectedRolls[0]?.widthMm) * Number(run.parts)} MM` 
                            : `${Number(run.lengthMeters || selectedRolls[0]?.lengthMeters) * Number(run.parts)} MTR`
                          }
                        </span>
                      </TableCell>
                      <TableCell className="pr-8 text-right">
                        <Button variant="ghost" size="icon" onClick={() => removeRun(run.id)} className="h-8 w-8 text-slate-300 hover:text-rose-500 transition-colors">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
            <CardFooter className="bg-slate-50 p-6 border-t flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white border-2 rounded-xl flex items-center gap-3">
                  <History className="h-4 w-4 text-primary" />
                  <span className="text-[10px] font-semibold uppercase text-slate-500">
                    Mode: {calculation.mode === 'WIDTH' ? 'Width Slitting' : 'Length Split / Rewind'}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle2 className={cn("h-5 w-5 transition-colors", calculation.isValid && selectedRolls.length > 0 ? "text-emerald-500" : "text-slate-200")} />
                <span className="text-[10px] font-semibold uppercase text-slate-400">Batch Integrity Verified</span>
              </div>
            </CardFooter>
          </Card>

          <Card className="shadow-xl border-none rounded-3xl overflow-hidden bg-white">
            <CardHeader className="bg-slate-50 border-b py-6 px-8">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <LayoutGrid className="h-4 w-4 text-primary" /> Slitting Layout Preview (Per Roll)
              </CardTitle>
              <p className="text-[10px] font-medium text-slate-400 uppercase">Visualizing pattern for roll batch.</p>
            </CardHeader>
            <CardContent className="p-8">
              <div className="flex flex-wrap gap-6 justify-start">
                {previewParts.length === 0 ? (
                  <div className="py-12 text-center w-full border-4 border-dashed rounded-3xl opacity-20 flex flex-col items-center gap-3">
                    <LayoutGrid className="h-10 w-10" />
                    <p className="text-[10px] font-semibold uppercase tracking-widest">Define runs to visualize layout</p>
                  </div>
                ) : (
                  previewParts.map((part, i) => (
                    <div key={i} className={cn(
                      "w-[150px] h-[150px] rounded-2xl border-4 flex flex-col items-center justify-center p-4 relative transition-all duration-300 shadow-lg hover:scale-105",
                      part.isRemainder ? "bg-emerald-50 border-emerald-200 text-emerald-700" : 
                      part.isJob ? "bg-blue-50 border-blue-200 text-blue-700" : "bg-slate-50 border-slate-200 text-slate-600"
                    )}>
                      <div className="absolute top-3 left-4 font-bold text-[11px] uppercase opacity-40">[{part.label}]</div>
                      
                      {part.isRemainder && <Badge className="absolute top-3 right-3 bg-emerald-500 text-[8px] h-4 px-1.5 font-semibold uppercase border-none">STOCK</Badge>}
                      {part.isJob && <Badge className="absolute top-3 right-3 bg-blue-500 text-[8px] h-4 px-1.5 font-semibold uppercase border-none">JOB</Badge>}
                      
                      <div className="flex flex-col items-center gap-3 mt-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[12px] font-bold opacity-40">↔</span>
                          <span className="text-xl font-bold tracking-tight tabular-nums leading-none">
                            {part.width}<small className="text-[9px] ml-0.5 font-medium uppercase opacity-60">MM</small>
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[12px] font-bold opacity-40">↕</span>
                          <span className="text-xl font-bold tracking-tight tabular-nums leading-none">
                            {part.length}<small className="text-[9px] ml-0.5 font-medium uppercase opacity-60">MTR</small>
                          </span>
                        </div>
                      </div>
                      
                      {part.jobNo && (
                        <div className="mt-4 pt-3 border-t w-full text-center border-blue-100">
                          <p className="text-[10px] font-semibold uppercase truncate leading-none opacity-80">{part.jobNo}</p>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          body * { visibility: hidden !important; }
          #print-area, #print-area * { visibility: visible !important; }
          #print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
            display: block !important;
          }
          #print-area table {
            width: 100% !important;
            border-collapse: collapse !important;
          }
          #print-area th, #print-area td {
            border: 2px solid black !important;
            padding: 12px !important;
          }
        }
      `}</style>
    </div>
  )
}

function SummaryField({ label, value, highlight = false }: { label: string, value: any, highlight?: boolean }) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-black uppercase text-slate-400 tracking-tighter">{label}</p>
      <p className={cn("text-sm font-black tracking-tight", highlight ? "text-primary" : "text-slate-900")}>
        {value || "—"}
      </p>
    </div>
  );
}

export default function SlittingPage() {
  return (
    <Suspense fallback={<div className="p-20 text-center"><Loader2 className="animate-spin h-8 w-8 mx-auto text-primary" /></div>}>
      <SlittingHubContent />
    </Suspense>
  )
}
