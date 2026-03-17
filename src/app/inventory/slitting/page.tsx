"use client"

import { useState, useMemo, useEffect, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
  ArrowRight
} from "lucide-react"
import { useFirestore, useUser, useCollection, useMemoFirebase } from "@/firebase"
import { collection, doc, query, where, runTransaction, serverTimestamp, limit } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { ActionModal, ModalType } from "@/components/action-modal"

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
  const [selectedParent, setSelectedParent] = useState<any>(null)
  const [slitRuns, setSlitRuns] = useState<SlitRun[]>([
    { id: crypto.randomUUID(), jobNo: "", jobName: "", jobSize: "", widthMm: 0, lengthMeters: 0, parts: 1 }
  ])

  // --- AUTO PLANNER STATE ---
  const [plannerSearch, setPlannerSearch] = useState("")
  const [selectedPlanningJob, setSelectedJob] = useState<any>(null)
  const [plannerRecommendation, setRecommendation] = useState<any>(null)

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
      setSelectedParent(initialRollData[0]);
      setSlitRuns(prev => prev.map(r => ({ 
        ...r, 
        lengthMeters: initialRollData[0].lengthMeters, 
        widthMm: initialRollData[0].widthMm 
      })));
    }
  }, [initialRollData]);

  // --- ANALYSIS ENGINE ---
  useEffect(() => {
    if (selectedPlanningJob && stockData) {
      // Extract target width from planning job (e.g., "165 mm" -> 165)
      const rawWidth = selectedPlanningJob.values.paper_size || selectedPlanningJob.values.size;
      const targetWidth = parseInt(String(rawWidth).replace(/[^0-9]/g, '')) || 0;
      
      if (targetWidth <= 0) return;

      const results = stockData
        .filter(roll => {
          const rw = Number(roll.widthMm) || 0;
          return rw >= targetWidth;
        })
        .map(roll => {
          const rw = Number(roll.widthMm);
          const splits = Math.floor(rw / targetWidth);
          const waste = rw % targetWidth;
          const isChild = roll.rollNo.includes('-');
          const isJumbo = rw >= 999;

          // Efficiency Scoring
          let score = (splits * targetWidth / rw) * 100;
          if (isChild) score += 20; // Bonus for using remnants
          if (isJumbo) score -= 50; // Penalty for using full jumbos if others exist

          return {
            roll,
            targetWidth,
            splits,
            waste,
            score
          };
        })
        .sort((a, b) => b.score - a.score);

      if (results.length > 0) {
        setRecommendation(results[0]);
      } else {
        setRecommendation(null);
      }
    } else {
      setRecommendation(null);
    }
  }, [selectedPlanningJob, stockData]);

  const handleAcceptPlan = () => {
    if (!plannerRecommendation) return;
    const { roll, targetWidth, splits } = plannerRecommendation;
    
    setSelectedParent(roll);
    setSlitRuns([{ 
      id: crypto.randomUUID(), 
      jobNo: String(selectedPlanningJob.values.sn || selectedPlanningJob.id),
      jobName: selectedPlanningJob.values.name || "",
      jobSize: selectedPlanningJob.values.size || "",
      widthMm: targetWidth, 
      lengthMeters: roll.lengthMeters, 
      parts: splits 
    }]);

    toast({ title: "Plan Accepted", description: "Source roll and run specs pre-filled." });
    setRecommendation(null);
    setSelectedJob(null);
    setPlannerSearch("");
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
        setSelectedParent(null);
      } else {
        const data = { ...snap.docs[0].data(), id: snap.docs[0].id };
        if (!["Main", "Stock", "Slitting", "Available"].includes(data.status)) {
          toast({ variant: "destructive", title: "Invalid Status", description: `Roll status is ${data.status}.` });
          setSelectedParent(null);
        } else {
          setSelectedParent(data);
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
    } catch (e) {
      toast({ variant: "destructive", title: "Search Error" });
    } finally {
      setIsProcessing(false);
    }
  }

  const addRun = () => {
    setSlitRuns([...slitRuns, { 
      id: crypto.randomUUID(), 
      jobNo: "", 
      jobName: "", 
      jobSize: "", 
      widthMm: selectedParent?.widthMm || 0, 
      lengthMeters: selectedParent?.lengthMeters || 0, 
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
    if (!selectedParent) return { usedWidth: 0, remainder: 0, isValid: true, mode: 'WIDTH' };
    
    const hasLengthSplit = slitRuns.some(r => Number(r.lengthMeters) > 0 && Number(r.lengthMeters) < Number(selectedParent.lengthMeters));
    const mode = hasLengthSplit ? 'LENGTH' : 'WIDTH';

    if (mode === 'WIDTH') {
      const usedWidth = slitRuns.reduce((acc, r) => acc + (Number(r.widthMm) * Number(r.parts)), 0);
      const remainder = Number(selectedParent.widthMm) - usedWidth;
      return { usedWidth, remainder, isValid: remainder >= 0, mode: 'WIDTH' };
    } else {
      const usedLength = slitRuns.reduce((acc, r) => acc + (Number(r.lengthMeters) * Number(r.parts)), 0);
      const remainder = Number(selectedParent.lengthMeters) - usedLength;
      return { usedLength, remainder, isValid: remainder >= 0, mode: 'LENGTH' };
    }
  }, [selectedParent, slitRuns]);

  const previewParts = useMemo(() => {
    if (!selectedParent) return [];
    const parts: any[] = [];
    let childIdx = 0;

    slitRuns.forEach((run) => {
      const pCount = Number(run.parts) || 0;
      for (let i = 0; i < pCount; i++) {
        const suffix = getChildSuffix(selectedParent.rollNo, childIdx);
        
        parts.push({
          label: suffix,
          rollId: `${selectedParent.rollNo}-${suffix}`,
          width: calculation.mode === 'WIDTH' ? (Number(run.widthMm) || selectedParent.widthMm) : selectedParent.widthMm,
          length: calculation.mode === 'LENGTH' ? (Number(run.lengthMeters) || selectedParent.lengthMeters) : selectedParent.lengthMeters,
          isJob: !!run.jobNo,
          jobNo: run.jobNo
        });
        childIdx++;
      }
    });

    if (calculation.remainder > 0) {
      const suffix = getChildSuffix(selectedParent.rollNo, childIdx);
      parts.push({
        label: suffix,
        rollId: `${selectedParent.rollNo}-${suffix}`,
        width: calculation.mode === 'WIDTH' ? calculation.remainder : selectedParent.widthMm,
        length: calculation.mode === 'LENGTH' ? calculation.remainder : selectedParent.lengthMeters,
        isRemainder: true
      });
    }

    return parts;
  }, [selectedParent, slitRuns, calculation]);

  const handleExecuteSlitting = async () => {
    if (!firestore || !user || !selectedParent || !calculation.isValid) return;
    setIsProcessing(true);

    try {
      await runTransaction(firestore, async (transaction) => {
        const parentRef = doc(firestore, 'paper_stock', selectedParent.id);
        transaction.update(parentRef, { 
          status: "Consumed", 
          dateOfUsed: new Date().toISOString().split('T')[0],
          updatedAt: serverTimestamp() 
        });

        let childIdx = 0;
        for (const run of slitRuns) {
          for (let i = 0; i < run.parts; i++) {
            const suffix = getChildSuffix(selectedParent.rollNo, childIdx);
            const childId = `${selectedParent.rollNo}-${suffix}`;
            const childRef = doc(firestore, 'paper_stock', childId);
            
            const childStatus = run.jobNo ? "Job Assign" : "Slitting";
            const finalWidth = calculation.mode === 'WIDTH' ? Number(run.widthMm) : Number(selectedParent.widthMm);
            const finalLength = calculation.mode === 'LENGTH' ? Number(run.lengthMeters) : Number(selectedParent.lengthMeters);

            transaction.set(childRef, {
              ...selectedParent,
              id: childId,
              rollNo: childId,
              widthMm: finalWidth,
              lengthMeters: finalLength,
              status: childStatus,
              jobNo: run.jobNo || "",
              jobName: run.jobName || "",
              jobSize: run.jobSize || "",
              parentRollNo: selectedParent.rollNo,
              sqm: Number(((finalWidth / 1000) * finalLength).toFixed(2)),
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
              createdById: user.uid
            });
            childIdx++;
          }
        }

        if (calculation.remainder > 0) {
          const suffix = getChildSuffix(selectedParent.rollNo, childIdx);
          const remainderId = `${selectedParent.rollNo}-${suffix}`;
          const remainderRef = doc(firestore, 'paper_stock', remainderId);
          
          const remWidth = calculation.mode === 'WIDTH' ? calculation.remainder : Number(selectedParent.widthMm);
          const remLength = calculation.mode === 'LENGTH' ? calculation.remainder : Number(selectedParent.lengthMeters);

          transaction.set(remainderRef, {
            ...selectedParent,
            id: remainderId,
            rollNo: remainderId,
            widthMm: remWidth,
            lengthMeters: remLength,
            status: "Stock", 
            jobNo: "",
            jobName: "",
            jobSize: "",
            parentRollNo: selectedParent.rollNo,
            sqm: Number(((remWidth / 1000) * remLength).toFixed(2)),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            createdById: user.uid,
            remarks: `Remainder from slitting ${selectedParent.rollNo}`
          });
        }
      });

      setModal({ 
        isOpen: true, 
        type: 'SUCCESS', 
        title: 'Transaction Complete', 
        description: `Successfully converted ${selectedParent.rollNo} into technical child units.` 
      });
      setSelectedParent(null);
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
    if (!plannerSearch) return planningJobs.slice(0, 5);
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
          <Button variant="outline" onClick={() => window.print()} disabled={!selectedParent} className="font-bold text-[10px] uppercase h-10 px-6 border-2 rounded-xl">
            <Printer className="mr-2 h-4 w-4" /> Print Slit Sheet
          </Button>
          <Button variant="ghost" onClick={() => router.push('/paper-stock')} className="font-bold text-[10px] uppercase h-10 px-6">
            <ArrowLeft className="mr-2 h-3 w-3" /> Technical Registry
          </Button>
        </div>
      </div>

      {/* --- NEW: AUTO SLITTING PLANNER --- */}
      <Card className="shadow-2xl border-none rounded-3xl overflow-hidden bg-white">
        <CardHeader className="bg-slate-900 text-white p-8">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-sm font-black uppercase tracking-[0.2em] flex items-center gap-3">
                <Sparkles className="h-5 w-5 text-primary" /> Auto Slitting Planner
              </CardTitle>
              <CardDescription className="text-slate-400 text-xs font-medium uppercase tracking-widest"> Intelligent Stock Analysis Engine (V1.0)</CardDescription>
            </div>
            <Badge className="bg-primary/20 text-primary border-primary/30 font-black text-[9px] px-3 py-1 uppercase tracking-tighter">Powered by CRM Intelligence</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Step 1: Select Job */}
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

              <div className="space-y-3 max-h-[300px] overflow-y-auto industrial-scroll pr-2">
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
                        <div className="flex gap-3 text-[9px] font-bold text-slate-400 uppercase">
                          <span className="flex items-center gap-1"><Maximize2 className="h-3 w-3" /> {job.values.paper_size || job.values.size}</span>
                          <span className="flex items-center gap-1"><FileText className="h-3 w-3" /> {job.values.material}</span>
                        </div>
                      </div>
                    </div>
                    {selectedPlanningJob?.id === job.id ? <CheckCircle2 className="h-5 w-5 text-primary" /> : <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-primary" />}
                  </div>
                ))}
              </div>
            </div>

            {/* Step 2: Recommendations */}
            <div className="space-y-6">
              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">2. Smart Stock Recommendation</Label>
              
              {!selectedPlanningJob ? (
                <div className="h-[300px] border-4 border-dashed rounded-[2rem] flex flex-col items-center justify-center text-center p-8 opacity-30 gap-4">
                  <Zap className="h-12 w-12" />
                  <p className="text-xs font-black uppercase tracking-widest">Select a job to analyze inventory</p>
                </div>
              ) : plannerRecommendation ? (
                <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
                  <div className="p-8 bg-slate-900 rounded-[2rem] text-white space-y-8 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4"><Badge className="bg-emerald-500 font-black">98% Match</Badge></div>
                    
                    <div className="space-y-1">
                      <p className="text-[9px] font-black uppercase text-primary tracking-[0.2em]">Recommended Source Roll</p>
                      <h3 className="text-4xl font-black tracking-tighter">{plannerRecommendation.roll.rollNo}</h3>
                      <p className="text-[10px] font-bold uppercase opacity-50">{plannerRecommendation.roll.paperType} • {plannerRecommendation.roll.paperCompany}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-8 border-t border-white/10 pt-8">
                      <div className="space-y-1">
                        <p className="text-[9px] font-black uppercase opacity-40">Output Potential</p>
                        <p className="text-2xl font-black">{plannerRecommendation.splits} <small className="text-xs font-medium opacity-60">Slits @ {plannerRecommendation.targetWidth}mm</small></p>
                      </div>
                      <div className="space-y-1 text-right">
                        <p className="text-[9px] font-black uppercase opacity-40">Predicted Waste</p>
                        <p className="text-2xl font-black text-rose-400">{plannerRecommendation.waste} <small className="text-xs font-medium opacity-60">MM</small></p>
                      </div>
                    </div>

                    <div className="pt-4">
                      <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden flex">
                        {Array.from({ length: plannerRecommendation.splits }).map((_, i) => (
                          <div key={i} className="h-full border-r border-slate-900/50 bg-primary" style={{ width: `${(plannerRecommendation.targetWidth / plannerRecommendation.roll.widthMm) * 100}%` }} />
                        ))}
                        <div className="h-full bg-rose-500/40" style={{ width: `${(plannerRecommendation.waste / plannerRecommendation.roll.widthMm) * 100}%` }} />
                      </div>
                      <div className="flex justify-between mt-2 text-[8px] font-black uppercase tracking-widest opacity-40">
                        <span>Layout Visualization</span>
                        <span>Width: {plannerRecommendation.roll.widthMm}mm</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <Button variant="outline" className="flex-1 h-14 rounded-2xl font-black uppercase text-[11px] tracking-widest border-2" onClick={() => { setSelectedJob(null); setRecommendation(null); }}>Reject Suggestion</Button>
                    <Button onClick={handleAcceptPlan} className="flex-[2] h-14 rounded-2xl bg-primary hover:bg-primary/90 text-white font-black uppercase text-[11px] tracking-widest shadow-2xl">
                      Accept Plan & Pre-Fill <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="h-[300px] bg-rose-50 border-2 border-rose-100 rounded-[2rem] flex flex-col items-center justify-center text-center p-8 gap-4">
                  <AlertTriangle className="h-10 w-10 text-rose-500" />
                  <div className="space-y-1">
                    <p className="text-sm font-black uppercase text-rose-900">No Compatible Stock</p>
                    <p className="text-[10px] font-bold uppercase text-rose-600 max-w-[200px]">We couldn't find a roll wide enough for this job in the active registry.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 print:hidden">
        <div className="lg:col-span-1 space-y-6">
          <Card className="shadow-xl border-none rounded-3xl overflow-hidden bg-white">
            <CardHeader className="bg-slate-900 text-white p-6">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Search className="h-4 w-4 text-primary" /> Source Roll Selection
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

              {selectedParent ? (
                <div className="space-y-4 animate-in slide-in-from-top-2">
                  <div className="p-4 bg-primary/5 rounded-2xl border-2 border-primary/20 space-y-3">
                    <div className="flex justify-between items-center">
                      <Badge className="bg-purple-600 font-semibold">{selectedParent.rollNo}</Badge>
                      <Badge variant="outline" className="font-semibold uppercase">{selectedParent.status}</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-[10px] font-semibold uppercase opacity-50">Substrate</Label>
                        <p className="text-sm font-bold truncate">{selectedParent.paperType}</p>
                      </div>
                      <div>
                        <Label className="text-[10px] font-semibold uppercase opacity-50">Mfr</Label>
                        <p className="text-sm font-bold truncate">{selectedParent.paperCompany}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 pt-2 border-t border-primary/10">
                      <div className="flex items-center gap-2">
                        <Ruler className="h-4 w-4 text-primary" />
                        <span className="text-lg font-bold">{selectedParent.widthMm}<small className="text-[10px] ml-1">MM</small></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <ArrowRightLeft className="h-4 w-4 text-primary" />
                        <span className="text-lg font-bold">{selectedParent.lengthMeters}<small className="text-[10px] ml-1">MTR</small></span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-12 text-center space-y-4 border-4 border-dashed rounded-3xl opacity-30">
                  <Package className="h-12 w-12 mx-auto" />
                  <p className="text-[10px] font-semibold uppercase tracking-widest">No Roll Loaded</p>
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
                  <p className="text-[10px] font-semibold uppercase opacity-60">Total Conversion</p>
                  <p className="text-4xl font-bold tracking-tight">
                    {calculation.mode === 'WIDTH' ? calculation.usedWidth : (calculation as any).usedLength} 
                    <small className="text-xs ml-1 font-normal">{calculation.mode === 'WIDTH' ? 'MM' : 'MTR'}</small>
                  </p>
                </div>
                <div className="text-right space-y-1">
                  <p className="text-[10px] font-semibold uppercase opacity-60">Stock Remainder</p>
                  <p className={cn("text-2xl font-bold tracking-tight", calculation.remainder < 0 ? "text-rose-200" : "text-emerald-400")}>
                    {calculation.remainder} <small className="text-xs font-normal">{calculation.mode === 'WIDTH' ? 'MM' : 'MTR'}</small>
                  </p>
                </div>
              </div>
              
              {!calculation.isValid && (
                <div className="bg-white/10 p-3 rounded-xl flex items-center gap-3 animate-pulse">
                  <AlertTriangle className="h-5 w-5 text-rose-200" />
                  <p className="text-[10px] font-semibold uppercase leading-tight">
                    Dimension exceeds parent limits. Reduce qty or dimension.
                  </p>
                </div>
              )}
            </CardContent>
            <CardFooter className="p-0 border-t border-white/10">
              <Button 
                onClick={handleExecuteSlitting} 
                disabled={!selectedParent || !calculation.isValid || isProcessing || (calculation.remainder === selectedParent?.widthMm && calculation.mode === 'WIDTH') || (calculation.remainder === selectedParent?.lengthMeters && calculation.mode === 'LENGTH')} 
                className={cn("w-full h-16 rounded-none font-semibold uppercase tracking-widest transition-all", calculation.isValid ? "bg-primary hover:bg-primary/90" : "bg-rose-700")}
              >
                {isProcessing ? <Loader2 className="animate-spin h-6 w-6" /> : <Scissors className="mr-3 h-5 w-5" />}
                Execute Run
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
                <p className="text-[10px] font-medium text-slate-400 uppercase">Define target widths, lengths, and job assignments for conversion.</p>
              </div>
              <Button size="sm" variant="outline" onClick={addRun} className="h-9 px-4 font-semibold uppercase text-[10px] rounded-xl border-2">
                <Plus className="h-4 w-4 mr-2" /> Add Run Row
              </Button>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-auto industrial-scroll max-h-[400px]">
              <Table>
                <TableHeader className="bg-slate-50/50 sticky top-0 z-10">
                  <TableRow>
                    <TableHead className="font-semibold text-[10px] uppercase pl-8 py-4">Job Details</TableHead>
                    <TableHead className="font-semibold text-[10px] uppercase text-center w-[120px]">Width (MM)</TableHead>
                    <TableHead className="font-semibold text-[10px] uppercase text-center w-[120px]">Length (MTR)</TableHead>
                    <TableHead className="font-semibold text-[10px] uppercase text-center w-[100px]">Qty</TableHead>
                    <TableHead className="font-semibold text-[10px] uppercase text-right w-[150px]">Total Conversion</TableHead>
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
                            placeholder={selectedParent?.widthMm}
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
                            placeholder={selectedParent?.lengthMeters}
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
                            ? `${Number(run.widthMm || selectedParent?.widthMm) * Number(run.parts)} MM` 
                            : `${Number(run.lengthMeters || selectedParent?.lengthMeters) * Number(run.parts)} MTR`
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
                  <History className="h-4 w-4 text-slate-400" />
                  <span className="text-[10px] font-semibold uppercase text-slate-500">
                    Mode: {calculation.mode === 'WIDTH' ? 'Width Slitting' : 'Length Split / Rewind'}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle2 className={cn("h-5 w-5 transition-colors", calculation.isValid && selectedParent ? "text-emerald-500" : "text-slate-200")} />
                <span className="text-[10px] font-semibold uppercase text-slate-400">Integrity Verified</span>
              </div>
            </CardFooter>
          </Card>

          <Card className="shadow-xl border-none rounded-3xl overflow-hidden bg-white">
            <CardHeader className="bg-slate-50 border-b py-6 px-8">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <LayoutGrid className="h-4 w-4 text-primary" /> Slitting Layout Preview
              </CardTitle>
              <p className="text-[10px] font-medium text-slate-400 uppercase">Live layout visualization of output rolls and stock remainders.</p>
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

export default function SlittingPage() {
  return (
    <Suspense fallback={<div className="p-20 text-center"><Loader2 className="animate-spin h-8 w-8 mx-auto text-primary" /></div>}>
      <SlittingHubContent />
    </Suspense>
  )
}
