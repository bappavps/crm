
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
  Maximize2
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
  parts: number;
}

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

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
    { id: crypto.randomUUID(), jobNo: "", jobName: "", jobSize: "", widthMm: 0, parts: 1 }
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
        toast({ variant: "destructive", title: "Roll Not Found", description: `ID ${searchQuery} does not exist in master registry.` });
        setSelectedParent(null);
      } else {
        const data = { ...snap.docs[0].data(), id: snap.docs[0].id };
        if (!["Main", "Stock", "Slitting"].includes(data.status)) {
          toast({ variant: "destructive", title: "Invalid Status", description: `Roll status is ${data.status}. Only Main, Stock, or Slitting rolls can be slit.` });
          setSelectedParent(null);
        } else {
          setSelectedParent(data);
        }
      }
    } catch (e) {
      toast({ variant: "destructive", title: "Search Error" });
    } finally {
      setIsProcessing(false);
    }
  }

  const addRun = () => {
    setSlitRuns([...slitRuns, { id: crypto.randomUUID(), jobNo: "", jobName: "", jobSize: "", widthMm: 0, parts: 1 }]);
  }

  const removeRun = (id: string) => {
    if (slitRuns.length > 1) setSlitRuns(slitRuns.filter(r => r.id !== id));
  }

  const updateRun = (id: string, field: keyof SlitRun, value: any) => {
    setSlitRuns(slitRuns.map(r => r.id === id ? { ...r, [field]: value } : r));
  }

  const calculation = useMemo(() => {
    if (!selectedParent) return { usedWidth: 0, remainder: 0, isValid: true };
    const usedWidth = slitRuns.reduce((acc, r) => acc + (Number(r.widthMm) * Number(r.parts)), 0);
    const remainder = Number(selectedParent.widthMm) - usedWidth;
    return { usedWidth, remainder, isValid: remainder >= 0 };
  }, [selectedParent, slitRuns]);

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
            const char = ALPHABET[childIdx % 26];
            const suffix = childIdx >= 26 ? `${char}${Math.floor(childIdx / 26)}` : char;
            const childId = `${selectedParent.rollNo}-${suffix}`;
            const childRef = doc(firestore, 'paper_stock', childId);
            
            const childStatus = run.jobNo ? "Job Assign" : "Slitting";

            transaction.set(childRef, {
              ...selectedParent,
              id: childId,
              rollNo: childId,
              widthMm: Number(run.widthMm),
              status: childStatus,
              jobNo: run.jobNo || "",
              jobName: run.jobName || "",
              jobSize: run.jobSize || "",
              parentRollNo: selectedParent.rollNo,
              sqm: Number(((Number(run.widthMm) / 1000) * Number(selectedParent.lengthMeters)).toFixed(2)),
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
              createdById: user.uid
            });
            childIdx++;
          }
        }

        if (calculation.remainder > 0) {
          const char = ALPHABET[childIdx % 26];
          const suffix = childIdx >= 26 ? `${char}${Math.floor(childIdx / 26)}` : char;
          const remainderId = `${selectedParent.rollNo}-${suffix}`;
          const remainderRef = doc(firestore, 'paper_stock', remainderId);
          
          transaction.set(remainderRef, {
            ...selectedParent,
            id: remainderId,
            rollNo: remainderId,
            widthMm: calculation.remainder,
            status: "Stock", 
            jobNo: "",
            jobName: "",
            jobSize: "",
            parentRollNo: selectedParent.rollNo,
            sqm: Number(((calculation.remainder / 1000) * Number(selectedParent.lengthMeters)).toFixed(2)),
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
        title: 'Slitting Complete', 
        description: `Successfully converted ${selectedParent.rollNo} into technical child units.` 
      });
      setSelectedParent(null);
      setSlitRuns([{ id: crypto.randomUUID(), jobNo: "", jobName: "", jobSize: "", widthMm: 0, parts: 1 }]);
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
          <h2 className="text-3xl font-black text-primary uppercase tracking-tighter">Industrial Slitting Hub</h2>
          <p className="text-muted-foreground text-[10px] font-black uppercase tracking-widest">Precision width conversion and job allocation engine.</p>
        </div>
        <Button variant="ghost" onClick={() => router.push('/paper-stock')} className="font-black text-[10px] uppercase">
          <ArrowLeft className="mr-2 h-3 w-3" /> Back to Registry
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <Card className="shadow-xl border-none rounded-2xl overflow-hidden">
            <CardHeader className="bg-slate-900 text-white p-6">
              <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
                <Search className="h-4 w-4 text-primary" /> Source Roll Selection
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="flex gap-2">
                <Input 
                  placeholder="Scan or Enter Roll ID..." 
                  className="h-12 font-black uppercase rounded-xl border-2" 
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
                      <Badge className="bg-purple-600 font-black">{selectedParent.rollNo}</Badge>
                      <Badge variant="outline" className="font-black uppercase">{selectedParent.status}</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-[10px] font-black uppercase opacity-50">Substrate</Label>
                        <p className="text-sm font-bold truncate">{selectedParent.paperType}</p>
                      </div>
                      <div>
                        <Label className="text-[10px] font-black uppercase opacity-50">Mfr</Label>
                        <p className="text-sm font-bold truncate">{selectedParent.paperCompany}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 pt-2 border-t border-primary/10">
                      <div className="flex items-center gap-2">
                        <Ruler className="h-4 w-4 text-primary" />
                        <span className="text-lg font-black">{selectedParent.widthMm}<small className="text-[10px] ml-1">MM</small></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <ArrowRightLeft className="h-4 w-4 text-primary" />
                        <span className="text-lg font-black">{selectedParent.lengthMeters}<small className="text-[10px] ml-1">MTR</small></span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-12 text-center space-y-4 border-4 border-dashed rounded-3xl opacity-30">
                  <Package className="h-12 w-12 mx-auto" />
                  <p className="text-[10px] font-black uppercase tracking-widest">No Roll Loaded</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className={cn("shadow-2xl border-none rounded-2xl overflow-hidden transition-all duration-500", calculation.isValid ? "bg-slate-900 text-white" : "bg-rose-600 text-white")}>
            <CardHeader className="pb-2">
              <CardTitle className="text-[10px] font-black uppercase tracking-widest opacity-70">Slitting Analytics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 py-4">
              <div className="flex justify-between items-end">
                <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase opacity-60">Total Conversion</p>
                  <p className="text-4xl font-black tracking-tighter">{calculation.usedWidth} <small className="text-xs">MM</small></p>
                </div>
                <div className="text-right space-y-1">
                  <p className="text-[10px] font-black uppercase opacity-60">Stock Remainder</p>
                  <p className={cn("text-2xl font-black tracking-tighter", calculation.remainder < 0 ? "text-rose-200" : "text-emerald-400")}>{calculation.remainder} <small className="text-xs">MM</small></p>
                </div>
              </div>
              
              {!calculation.isValid && (
                <div className="bg-white/10 p-3 rounded-xl flex items-center gap-3 animate-pulse">
                  <AlertTriangle className="h-5 w-5 text-rose-200" />
                  <p className="text-[10px] font-black uppercase leading-tight">Conversion exceeds parent width. Reduce parts or width.</p>
                </div>
              )}
            </CardContent>
            <CardFooter className="p-0 border-t border-white/10">
              <Button 
                onClick={handleExecuteSlitting} 
                disabled={!selectedParent || !calculation.isValid || isProcessing || calculation.usedWidth === 0} 
                className={cn("w-full h-16 rounded-none font-black uppercase tracking-[0.25em] transition-all", calculation.isValid ? "bg-primary hover:bg-primary/90" : "bg-rose-700")}
              >
                {isProcessing ? <Loader2 className="animate-spin h-6 w-6" /> : <Scissors className="mr-3 h-5 w-5" />}
                Execute Slit Run
              </Button>
            </CardFooter>
          </Card>
        </div>

        <div className="lg:col-span-3 space-y-6">
          <Card className="shadow-xl border-none rounded-2xl overflow-hidden min-h-[500px] flex flex-col">
            <CardHeader className="bg-slate-50 border-b flex flex-row items-center justify-between p-6">
              <div className="space-y-1">
                <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-primary" /> Run Specification Table
                </CardTitle>
                <p className="text-[9px] font-black text-slate-400 uppercase">Define target widths, job assignments, and technical details for conversion.</p>
              </div>
              <Button size="sm" variant="outline" onClick={addRun} className="h-9 px-4 font-black uppercase text-[10px] rounded-xl border-2">
                <Plus className="h-4 w-4 mr-2" /> Add Part
              </Button>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-auto industrial-scroll">
              <Table>
                <TableHeader className="bg-slate-50/50 sticky top-0 z-10">
                  <TableRow>
                    <TableHead className="font-black text-[10px] uppercase pl-8 py-4">Job Assignment Details</TableHead>
                    <TableHead className="font-black text-[10px] uppercase text-center w-[150px]">Part Width (MM)</TableHead>
                    <TableHead className="font-black text-[10px] uppercase text-center w-[120px]">Qty (Parts)</TableHead>
                    <TableHead className="font-black text-[10px] uppercase text-right w-[150px]">Total Width</TableHead>
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
                              className="h-10 font-black uppercase border-none bg-slate-100/50 rounded-xl text-xs pl-9" 
                              value={run.jobNo} 
                              onChange={e => updateRun(run.id, 'jobNo', e.target.value)}
                            />
                            <Briefcase className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="relative">
                              <Input 
                                placeholder="Job Name" 
                                className="h-9 font-bold border-none bg-slate-100/30 rounded-xl text-[10px] pl-8" 
                                value={run.jobName} 
                                onChange={e => updateRun(run.id, 'jobName', e.target.value)}
                              />
                              <FileText className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                            </div>
                            <div className="relative">
                              <Input 
                                placeholder="Job Size" 
                                className="h-9 font-bold border-none bg-slate-100/30 rounded-xl text-[10px] pl-8" 
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
                            className="h-10 w-24 text-center font-black border-2 border-slate-200 rounded-xl" 
                            value={run.widthMm || ""} 
                            onChange={e => updateRun(run.id, 'widthMm', Number(e.target.value))}
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center">
                          <Input 
                            type="number" 
                            className="h-10 w-16 text-center font-black border-2 border-slate-200 rounded-xl" 
                            value={run.parts || ""} 
                            onChange={e => updateRun(run.id, 'parts', Number(e.target.value))}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-sm font-black text-slate-400 group-hover:text-primary transition-colors">
                          {Number(run.widthMm) * Number(run.parts)} MM
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
                  <span className="text-[10px] font-black uppercase text-slate-500">Naming logic: Continuous Dash (-) Sequence (-A, -B, -C...)</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle2 className={cn("h-5 w-5 transition-colors", calculation.isValid && selectedParent ? "text-emerald-500" : "text-slate-200")} />
                <span className="text-[10px] font-black uppercase text-slate-400">Integrity Verified</span>
              </div>
            </CardFooter>
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
