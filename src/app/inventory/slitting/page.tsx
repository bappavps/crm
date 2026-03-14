
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
  ArrowUpDown
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

  const [modal, setModal] = useState<{ isOpen: boolean; type: ModalType; title: string; description?: string }>({ 
    isOpen: false, type: 'SUCCESS', title: '' 
  });

  useEffect(() => { setIsMounted(true) }, [])

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
        if (!["Main", "Stock", "Slitting"].includes(data.status)) {
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

  if (!isMounted) return null;

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-20 font-sans animate-in fade-in duration-500">
      <ActionModal isOpen={modal.isOpen} onClose={() => setModal(p => ({ ...p, isOpen: false }))} {...modal} />

      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-[28px] font-semibold tracking-tight">Advanced Slitting Features</h1>
          <p className="text-sm font-normal text-muted-foreground">Precision width conversion and length split engine for converting parent rolls into production-ready job rolls.</p>
        </div>
        <Button variant="ghost" onClick={() => router.push('/paper-stock')} className="font-semibold text-xs">
          <ArrowLeft className="mr-2 h-3 w-3" /> Back to Registry
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <Card className="shadow-xl border-none rounded-2xl overflow-hidden">
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

          <Card className={cn("shadow-2xl border-none rounded-2xl overflow-hidden transition-all duration-500", calculation.isValid ? "bg-slate-900 text-white" : "bg-rose-600 text-white")}>
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
          <Card className="shadow-xl border-none rounded-2xl overflow-hidden flex flex-col">
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

          <Card className="shadow-xl border-none rounded-2xl overflow-hidden bg-white">
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
    </div>
  )
}

export default function SlittingPage() {
  return (
    <Suspense fallback={<div className="p-20 text-center"><Loader2 className="animate-spin h-8 w-8 mx-auto" /></div>}>
      <SlittingHubContent />
    </Suspense>
  )
}
