
"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { 
  Loader2, 
  Play, 
  CheckCircle2, 
  Clock, 
  Scissors, 
  AlertTriangle, 
  UserCog, 
  History,
  Timer,
  FileText,
  Save,
  ArrowRight,
  Package,
  ArrowUpDown
} from "lucide-react"
import { useFirestore, useUser, useCollection, useMemoFirebase } from "@/firebase"
import { collection, doc, query, where, updateDoc, serverTimestamp, writeBatch, getDocs } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

export default function JumboOperatorPage() {
  const { toast } = useToast()
  const { user } = useUser()
  const firestore = useFirestore()
  
  const [activeJob, setActiveJob] = useState<any>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  
  const [formData, setFormData] = useState({
    startTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    endTime: "",
    notes: ""
  })

  // Data Subscriptions
  const jobsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'jumbo_job_cards'), where('status', 'in', ['PENDING', 'RUNNING']));
  }, [firestore]);

  const rollsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'paper_stock');
  }, [firestore]);

  const { data: jobs, isLoading } = useCollection(jobsQuery);
  const { data: allRolls } = useCollection(rollsQuery);

  const handleStartJob = async (job: any) => {
    if (!firestore) return;
    setIsProcessing(true);
    try {
      await updateDoc(doc(firestore, 'jumbo_job_cards', job.id), {
        status: 'RUNNING',
        startTime: new Date().toISOString()
      });
      toast({ title: "Machine Started", description: `Processing ${job.job_card_no}` });
    } catch (e) {
      toast({ variant: "destructive", title: "Error" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCompleteJob = async () => {
    if (!firestore || !activeJob || isProcessing) return;
    setIsProcessing(true);
    
    try {
      const batch = writeBatch(firestore);
      
      // 1. Update Job Card
      batch.update(doc(firestore, 'jumbo_job_cards', activeJob.id), {
        status: 'COMPLETED',
        endTime: new Date().toISOString(),
        notes: formData.notes,
        actualEndTime: formData.endTime
      });

      // 2. Update status of JOB rolls only
      const jobRollCodes = activeJob.child_rolls || [];
      const jobRollDocs = allRolls?.filter(r => jobRollCodes.includes(r.rollNo)) || [];
      
      jobRollDocs.forEach(roll => {
        const isJobDest = !!roll.jobNo;
        if (isJobDest) {
          batch.update(doc(firestore, 'paper_stock', roll.id), {
            status: "Ready for Printing",
            updatedAt: serverTimestamp()
          });
        }
      });

      await batch.commit();
      
      setActiveJob(null);
      setFormData({ startTime: "", endTime: "", notes: "" });
      toast({ title: "Run Completed", description: "JOB rolls moved to printing queue. STOCK rolls preserved." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Completion Error", description: e.message });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-3xl font-black text-primary uppercase tracking-tighter">Jumbo Slitting Console</h2>
          <p className="text-muted-foreground font-medium text-xs tracking-widest uppercase">Machine Telemetry & Run Log</p>
        </div>
        <Badge variant="outline" className="h-10 px-6 font-black uppercase text-[10px] tracking-[0.2em] border-2 rounded-xl">
          <Timer className="h-4 w-4 mr-2 text-primary" /> Shift Time: {new Date().toLocaleTimeString()}
        </Badge>
      </div>

      {!activeJob ? (
        <Card className="border-none shadow-xl rounded-3xl overflow-hidden">
          <CardHeader className="bg-slate-900 text-white p-6">
            <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-3">
              <Scissors className="h-5 w-5 text-primary" /> Assigned Work Queue
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {isLoading ? (
                <div className="p-20 text-center"><Loader2 className="animate-spin h-8 w-8 mx-auto text-primary" /></div>
              ) : jobs?.length === 0 ? (
                <div className="p-20 text-center opacity-30 flex flex-col items-center gap-4">
                  <History className="h-12 w-12" />
                  <p className="font-black uppercase text-[10px] tracking-widest">Queue is clear. No active slitting jobs.</p>
                </div>
              ) : jobs?.map((j) => (
                <div key={j.id} className="p-6 flex items-center justify-between hover:bg-slate-50 transition-all group">
                  <div className="flex items-center gap-6">
                    <div className="h-14 w-14 bg-slate-100 rounded-2xl flex items-center justify-center font-black text-slate-400 group-hover:bg-primary/10 group-hover:text-primary transition-all">
                      <FileText className="h-6 w-6" />
                    </div>
                    <div className="space-y-1">
                      <p className="font-black text-primary uppercase tracking-tighter text-lg">{j.job_card_no}</p>
                      <div className="flex gap-4 text-[10px] font-bold text-slate-400 uppercase">
                        <span>Parent: {j.parent_roll}</span>
                        <span>Operator: {j.operator}</span>
                        <span>Total Units: {j.child_rolls?.length || 0}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    {j.status === 'RUNNING' ? (
                      <Button onClick={() => setActiveJob(j)} className="bg-blue-600 hover:bg-blue-700 h-12 px-8 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg">
                        Resume Run <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    ) : (
                      <Button onClick={() => handleStartJob(j)} disabled={isProcessing} className="bg-primary hover:bg-primary/90 h-12 px-8 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg">
                        <Play className="mr-2 h-4 w-4" /> Start Slitting
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-none shadow-2xl rounded-3xl overflow-hidden animate-in zoom-in-95 duration-300">
          <CardHeader className="bg-blue-600 text-white p-8">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <Badge className="bg-white/20 text-white border-none font-black text-[10px] px-3 mb-2">RUNNING IN PRODUCTION</Badge>
                <CardTitle className="text-4xl font-black tracking-tighter uppercase">{activeJob.job_card_no}</CardTitle>
                <p className="text-blue-100 font-bold uppercase text-[10px] tracking-widest">Technician: {activeJob.operator}</p>
              </div>
              <div className="text-right space-y-4">
                <Button variant="ghost" onClick={() => setActiveJob(null)} className="text-white hover:bg-white/10 font-bold uppercase text-[10px]">Switch Job</Button>
                <div className="p-4 bg-black/20 rounded-2xl border border-white/10 flex items-center gap-4">
                  <div className="text-center border-r border-white/10 pr-4">
                    <p className="text-[9px] opacity-60 uppercase font-black">Parent ID</p>
                    <p className="text-lg font-black">{activeJob.parent_roll}</p>
                  </div>
                  <div className="text-center pl-2">
                    <p className="text-[9px] opacity-60 uppercase font-black">Output Count</p>
                    <p className="text-lg font-black">{activeJob.child_rolls?.length || 0}</p>
                  </div>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-10 bg-slate-50">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              <div className="space-y-8">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 border-b pb-2 flex items-center gap-2">
                  <Timer className="h-4 w-4 text-primary" /> Shift Parameters
                </h3>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase">Start Time</Label>
                    <Input className="h-12 rounded-xl font-bold border-2 bg-white" value={formData.startTime} disabled />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase">End Time</Label>
                    <Input 
                      type="time" 
                      className="h-12 rounded-xl font-bold border-2 bg-white" 
                      value={formData.endTime}
                      onChange={e => setFormData({...formData, endTime: e.target.value})}
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase">Production Output Verification</Label>
                  <div className="bg-white border-2 rounded-2xl p-4 max-h-[250px] overflow-y-auto industrial-scroll space-y-2">
                    {activeJob.child_rolls?.map((code: string) => {
                      const roll = allRolls?.find(r => r.rollNo === code);
                      const isJobDest = !!roll?.jobNo;
                      return (
                        <div key={code} className="p-3 border rounded-xl flex items-center justify-between">
                          <div className="flex flex-col">
                            <span className="text-xs font-black">{code}</span>
                            <span className="text-[9px] font-bold text-slate-400 uppercase">{roll?.widthMm}mm x {roll?.lengthMeters}m</span>
                          </div>
                          <Badge className={isJobDest ? "bg-blue-500" : "bg-emerald-500"}>
                            {isJobDest ? 'JOB' : 'STOCK'}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="space-y-8">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 border-b pb-2 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" /> Integrity Checklist
                </h3>
                <div className="space-y-4">
                  {[
                    "Confirm all slitted widths match job specs",
                    "Verify core tension for all child rolls",
                    "Affix technical thermal labels to each roll",
                    "Check for substrate defects during rewind"
                  ].map((task, i) => (
                    <div key={i} className="p-4 bg-white rounded-2xl border-2 border-slate-100 flex items-center gap-4">
                      <div className="h-6 w-6 rounded-lg border-2 border-slate-200 flex items-center justify-center bg-slate-50">
                        <CheckCircle2 className="h-4 w-4 text-slate-300" />
                      </div>
                      <span className="text-[11px] font-black uppercase text-slate-600">{task}</span>
                    </div>
                  ))}
                </div>
                
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase">Wastage & Run Notes</Label>
                  <Textarea 
                    placeholder="Describe any technical issues or substrate variations..."
                    className="min-h-[100px] rounded-2xl border-2 bg-white font-medium p-4"
                    value={formData.notes}
                    onChange={e => setFormData({...formData, notes: e.target.value})}
                  />
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="p-8 bg-white border-t flex gap-4">
            <Button variant="outline" className="flex-1 h-14 rounded-2xl font-black uppercase text-[11px] tracking-widest border-2" onClick={() => setActiveJob(null)}>Suspend Run</Button>
            <Button 
              onClick={handleCompleteJob} 
              disabled={isProcessing}
              className="flex-[2] h-14 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[11px] tracking-widest shadow-xl"
            >
              {isProcessing ? <Loader2 className="animate-spin h-5 w-5 mr-2" /> : <CheckCircle2 className="h-5 w-5 mr-2" />}
              Complete Shift & Release to Printing
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  )
}

function Timer({ className }: { className?: string }) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><line x1="10" x2="14" y1="2" y2="2"/><line x1="12" x2="15" y1="14" y2="11"/><circle cx="12" cy="14" r="8"/></svg>;
}
