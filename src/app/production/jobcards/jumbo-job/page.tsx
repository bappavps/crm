
"use client"

import { useState, useMemo, useEffect, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { 
  Plus, 
  Loader2, 
  Printer, 
  Eye, 
  Trash2, 
  Search, 
  Scissors, 
  CheckCircle2, 
  Clock,
  History,
  FileText,
  User,
  Factory,
  QrCode,
  ArrowRight,
  X,
  Package,
  ArrowLeft,
  Save,
  MoreHorizontal
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu"
import { useFirestore, useUser, useCollection, useMemoFirebase } from "@/firebase"
import { collection, doc, query, orderBy, serverTimestamp, setDoc, deleteDoc, where } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { QRCodeSVG } from 'qrcode.react'
import { TemplateRenderer } from "@/components/printing/template-renderer"
import { format } from "date-fns"

function JumboJobCardContent() {
  const { toast } = useToast()
  const { user } = useUser()
  const firestore = useFirestore()
  const router = useRouter()
  const searchParams = useSearchParams()
  const urlParentRoll = searchParams.get('parentRoll')
  
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isViewOpen, setIsViewOpen] = useState(false)
  const [isLabelOpen, setIsLabelOpen] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  
  const [selectedJob, setSelectedJob] = useState<any>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [siteOrigin, setSiteOrigin] = useState("")

  // Template State
  const [selectedJobTemplateId, setSelectedJobTemplateId] = useState("default")
  const [selectedLabelTemplateId, setSelectedLabelTemplateId] = useState("default")
  
  // Create Form State
  const [formData, setFormData] = useState({
    job_card_no: "",
    parent_roll: "",
    machine: "",
    operator: "",
    child_rolls: [] as string[]
  })

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setSiteOrigin(window.location.origin);
    }
  }, []);

  // Data Subscriptions
  const jobsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'jumbo_job_cards'), orderBy('createdAt', 'desc'));
  }, [firestore]);

  const rollsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'paper_stock');
  }, [firestore]);

  const machinesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, 'machines'),
      where('section', '==', 'Jumbo'),
      where('status', '==', 'Active')
    );
  }, [firestore]);

  const usersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'users');
  }, [firestore]);

  // Template Queries
  const jobTemplatesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'print_templates'), where('documentType', '==', 'Technical Job Card'));
  }, [firestore]);

  const labelTemplatesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'print_templates'), where('documentType', '==', 'Industrial Label'));
  }, [firestore]);

  const { data: jobs, isLoading: jobsLoading } = useCollection(jobsQuery);
  const { data: allRolls } = useCollection(rollsQuery);
  const { data: machines } = useCollection(machinesQuery);
  const { data: users } = useCollection(usersQuery);
  const { data: jobTemplates } = useCollection(jobTemplatesQuery);
  const { data: labelTemplates } = useCollection(labelTemplatesQuery);

  const parentRolls = useMemo(() => allRolls?.filter(r => !r.rollNo.includes('-')) || [], [allRolls]);
  const operators = useMemo(() => users?.filter(u => u.roles?.includes('Operator') || u.roles?.includes('Admin')) || [], [users]);

  const filteredChildRolls = useMemo(() => {
    if (!formData.parent_roll) return [];
    return allRolls?.filter(r => r.rollNo.startsWith(formData.parent_roll + '-') && r.rollNo !== formData.parent_roll) || [];
  }, [allRolls, formData.parent_roll]);

  // Handle URL pre-fill
  useEffect(() => {
    if (urlParentRoll && allRolls) {
      const match = allRolls.find(r => r.rollNo === urlParentRoll);
      if (match) {
        const children = allRolls.filter(r => r.rollNo.startsWith(urlParentRoll + '-')).map(r => r.rollNo);
        setFormData({
          job_card_no: `JJC-${urlParentRoll}-${Date.now().toString().slice(-4)}`,
          parent_roll: urlParentRoll,
          machine: "",
          operator: "",
          child_rolls: children
        });
        setIsCreateOpen(true);
      }
    }
  }, [urlParentRoll, allRolls]);

  // Auto-select all children when parent changes
  useEffect(() => {
    if (formData.parent_roll && allRolls) {
      const children = allRolls.filter(r => r.rollNo.startsWith(formData.parent_roll + '-')).map(r => r.rollNo);
      setFormData(prev => ({ ...prev, child_rolls: children }));
    }
  }, [formData.parent_roll, allRolls]);

  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !user || isProcessing) return;
    
    setIsProcessing(true);
    const jobId = formData.job_card_no || `JJC-${Date.now().toString().slice(-6)}`;
    const jobRef = doc(firestore, 'jumbo_job_cards', jobId);

    try {
      await setDoc(jobRef, {
        ...formData,
        id: jobId,
        job_card_no: jobId,
        parent_rolls: [formData.parent_roll], 
        status: "PENDING",
        createdAt: new Date().toISOString(),
        createdById: user.uid,
        createdByName: user.displayName || user.email
      });
      setIsCreateOpen(false);
      toast({ title: "Job Card Initialized", description: "All slitting units have been logged." });
      if (urlParentRoll) router.replace('/production/jobcards/jumbo-job');
    } catch (e: any) {
      toast({ variant: "destructive", title: "Creation Failed", description: e.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!firestore || !confirm("Delete this Job Card?")) return;
    await deleteDoc(doc(firestore, 'jumbo_job_cards', id));
    toast({ title: "Job Card Removed" });
  };

  const filteredJobs = useMemo(() => {
    if (!jobs) return [];
    return jobs.filter(j => 
      j.job_card_no.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (j.parent_roll && j.parent_roll.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [jobs, searchQuery]);

  // Active Template Renderers
  const activeJobTemplate = jobTemplates?.find(t => t.id === selectedJobTemplateId);
  const activeLabelTemplate = labelTemplates?.find(t => t.id === selectedLabelTemplateId);

  const prepareJobData = (job: any) => {
    const parentRollsList = (job?.parent_rolls || [job?.parent_roll]).filter(Boolean);
    const rawSourceRolls = allRolls?.filter(r => parentRollsList.includes(r.rollNo)) || [];
    const children = allRolls?.filter(r => job?.child_rolls?.includes(r.rollNo)) || [];
    
    return {
      ...job,
      job_card_id: job?.job_card_no,
      machine_name: job?.machine,
      operator_name: job?.operator,
      parent_roll: job?.parent_roll,
      sourceRolls: rawSourceRolls.map(r => ({
        rollId: r.rollNo,
        paperType: r.paperType,
        width: r.widthMm,
        length: r.lengthMeters,
        company: r.paperCompany
      })),
      SLIT_ROLLS: children,
      // Generic mappings
      company_name: "Shree Label Creation",
      current_date: new Date().toLocaleDateString()
    };
  };

  const prepareRollData = (roll: any) => ({
    ...roll,
    roll_no: roll.rollNo,
    paper_type: roll.paperType,
    width: roll.widthMm,
    length: roll.lengthMeters,
    gsm: roll.gsm,
    company: roll.paperCompany,
    date: roll.receivedDate,
    company_name: roll.paperCompany,
    current_date: roll.receivedDate,
    parent_roll_no: roll.rollNo,
    lengthMtr: roll.lengthMeters
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-3xl font-black text-primary uppercase tracking-tighter">Jumbo Job Cards</h2>
          <p className="text-muted-foreground font-medium text-xs tracking-widest uppercase">Master Registry for Substrate Slitting Runs</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="h-11 px-6 font-black uppercase text-[10px] tracking-widest border-2 rounded-xl" onClick={() => router.push('/paper-stock')}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Stock
          </Button>
          <Button onClick={() => {
            setFormData({ job_card_no: "", parent_roll: "", machine: "", operator: "", child_rolls: [] });
            setIsCreateOpen(true);
          }} className="h-11 px-8 font-black uppercase text-[10px] tracking-widest rounded-xl shadow-lg bg-primary">
            <Plus className="h-4 w-4 mr-2" /> New Job Card
          </Button>
        </div>
      </div>

      <Card className="border-none shadow-xl overflow-hidden rounded-3xl">
        <CardHeader className="bg-slate-900 text-white p-6 px-8 flex flex-row items-center justify-between">
          <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-3">
            <Scissors className="h-5 w-5 text-primary" /> Slitting Pipeline
          </CardTitle>
          <div className="relative w-64">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
            <Input 
              placeholder="Search ID or Roll..." 
              className="h-9 bg-white/5 border-white/10 text-white rounded-xl pl-9 text-xs font-bold"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="font-black text-[10px] uppercase pl-8">Job ID</TableHead>
                <TableHead className="font-black text-[10px] uppercase">Primary Roll</TableHead>
                <TableHead className="font-black text-[10px] uppercase">Operator</TableHead>
                <TableHead className="font-black text-[10px] uppercase text-center">Output Content</TableHead>
                <TableHead className="font-black text-[10px] uppercase">Status</TableHead>
                <TableHead className="text-right font-black text-[10px] uppercase pr-8">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobsLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-20"><Loader2 className="animate-spin h-8 w-8 mx-auto text-primary" /></TableCell></TableRow>
              ) : filteredJobs.map((j) => (
                <TableRow key={j.id} className="hover:bg-slate-50 transition-colors group">
                  <TableCell className="font-black text-primary font-mono text-xs pl-8">{j.job_card_no}</TableCell>
                  <TableCell className="font-bold text-sm">{j.parent_roll || "MULTI"}</TableCell>
                  <TableCell className="text-[11px] font-bold uppercase text-slate-500">{j.operator || "UNASSIGNED"}</TableCell>
                  <TableCell className="text-center">
                    <div className="flex justify-center gap-2">
                      <Badge variant="secondary" className="font-black text-[9px] h-5">{j.child_rolls?.length || 0} TOTAL</Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={cn(
                      "text-[9px] font-black h-5 px-2",
                      j.status === 'COMPLETED' ? "bg-emerald-500" : 
                      j.status === 'RUNNING' ? "bg-blue-500" : "bg-amber-500"
                    )}>
                      {j.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right pr-8">
                    <div className="flex justify-end gap-1.5">
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg bg-indigo-500 text-white hover:bg-indigo-600" onClick={() => { setSelectedJob(j); setIsViewOpen(true); }}><Eye className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg bg-slate-700 text-white hover:bg-black" onClick={() => { setSelectedJob(j); setIsLabelOpen(true); }}><Printer className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg bg-rose-500 text-white hover:bg-rose-600" onClick={() => handleDelete(j.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* CREATE DIALOG */}
      <Dialog open={isCreateOpen} onOpenChange={(open) => { setIsCreateOpen(open); if(!open && urlParentRoll) router.replace('/production/jobcards/jumbo-job'); }}>
        <DialogContent className="sm:max-w-[800px] p-0 overflow-hidden rounded-3xl border-none shadow-3xl">
          <form onSubmit={handleCreateJob}>
            <div className="bg-slate-900 text-white p-6">
              <DialogTitle className="text-xl font-black uppercase tracking-tight flex items-center gap-3">
                <FileText className="h-5 w-5 text-primary" /> Create Jumbo Job Card
              </DialogTitle>
              <DialogDescription className="text-slate-400 font-bold uppercase text-[9px] tracking-widest mt-1">Include all output units for full production traceability</DialogDescription>
            </div>
            <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8 bg-slate-50 max-h-[70vh] overflow-y-auto industrial-scroll">
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase opacity-50">Job Card Reference (Auto-gen if empty)</Label>
                  <Input 
                    placeholder="e.g. SLIT-2024-001" 
                    className="h-11 rounded-xl font-bold border-2 bg-white"
                    value={formData.job_card_no}
                    onChange={e => setFormData({...formData, job_card_no: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase opacity-50">Select Parent Jumbo Roll *</Label>
                  <Select value={formData.parent_roll} onValueChange={v => setFormData({...formData, parent_roll: v})}>
                    <SelectTrigger className="h-11 rounded-xl border-2 bg-white font-bold"><SelectValue placeholder="Choose Parent Roll" /></SelectTrigger>
                    <SelectContent className="z-[100]">
                      {parentRolls.map(r => <SelectItem key={r.id} value={r.rollNo} className="font-bold">{r.rollNo} - {r.paperType}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase opacity-50">Slitting Machine</Label>
                    <Select value={formData.machine} onValueChange={v => setFormData({...formData, machine: v})}>
                      <SelectTrigger className="h-11 rounded-xl border-2 bg-white font-bold"><SelectValue placeholder="Machine" /></SelectTrigger>
                      <SelectContent className="z-[100]">
                        {machines?.map(m => (
                          <SelectItem key={m.id} value={m.machine_name}>{m.machine_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase opacity-50">Operator</Label>
                    <Select value={formData.operator} onValueChange={v => setFormData({...formData, operator: v})}>
                      <SelectTrigger className="h-11 rounded-xl border-2 bg-white font-bold"><SelectValue placeholder="Operator" /></SelectTrigger>
                      <SelectContent className="z-[100]">
                        {operators.map(o => <SelectItem key={o.id} value={`${o.firstName} ${o.lastName}`}>{o.firstName} {o.lastName}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <Label className="text-[10px] font-black uppercase opacity-50">Production Output Units</Label>
                  <Badge className="bg-primary text-white text-[9px]">{formData.child_rolls.length} SELECTED</Badge>
                </div>
                <div className="bg-white border-2 rounded-2xl p-4 h-[300px] overflow-y-auto industrial-scroll space-y-2">
                  {filteredChildRolls.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center opacity-30 gap-3">
                      <Package className="h-8 w-8" />
                      <p className="text-[10px] font-bold uppercase">Select parent roll to view outputs</p>
                    </div>
                  ) : filteredChildRolls.map(r => (
                    <div 
                      key={r.id} 
                      className={cn(
                        "p-3 rounded-xl border-2 transition-all cursor-pointer flex items-center justify-between",
                        formData.child_rolls.includes(r.rollNo) ? "border-primary bg-primary/5" : "border-slate-100 hover:border-primary/20"
                      )}
                      onClick={() => {
                        const next = formData.child_rolls.includes(r.rollNo)
                          ? formData.child_rolls.filter(id => id !== r.rollNo)
                          : [...formData.child_rolls, r.rollNo];
                        setFormData({...formData, child_rolls: next});
                      }}
                    >
                      <div className="flex flex-col">
                        <span className="text-xs font-black text-primary">{r.rollNo}</span>
                        <div className="flex gap-2">
                          <span className="text-[9px] font-bold text-slate-400 uppercase">{r.widthMm}mm x {r.lengthMeters}m</span>
                          <Badge variant="outline" className={cn("text-[8px] h-4", r.jobNo ? "text-blue-600 border-blue-200" : "text-emerald-600 border-emerald-200")}>
                            {r.jobNo ? 'JOB' : 'STOCK'}
                          </Badge>
                        </div>
                      </div>
                      {formData.child_rolls.includes(r.rollNo) && <CheckCircle2 className="h-4 w-4 text-primary" />}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter className="p-6 bg-white border-t">
              <Button type="button" variant="outline" className="h-12 px-8 rounded-xl font-black uppercase text-[10px] tracking-widest border-2" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={!formData.parent_roll || formData.child_rolls.length === 0 || isProcessing} className="h-12 px-12 rounded-xl bg-primary hover:bg-primary/90 text-white font-black uppercase text-[10px] tracking-widest shadow-xl">
                {isProcessing ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Register Job Card
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* VIEW / PRINT DIALOG */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="sm:max-w-[1000px] p-0 overflow-hidden rounded-3xl border-none shadow-3xl print:shadow-none">
          <div className="bg-slate-900 text-white p-6 flex items-center justify-between no-print">
            <div className="flex items-center gap-4">
              <DialogTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /> Technical Instruction Sheet</DialogTitle>
              <Select value={selectedJobTemplateId} onValueChange={setSelectedJobTemplateId}>
                <SelectTrigger className="h-8 w-[250px] bg-white/10 border-white/20 text-white text-[10px] font-bold uppercase rounded-lg">
                  <SelectValue placeholder="Select Template" />
                </SelectTrigger>
                <SelectContent className="z-[110]">
                  <SelectItem value="default" className="text-xs font-bold uppercase">Default System Template</SelectItem>
                  {jobTemplates?.map(t => (
                    <SelectItem key={t.id} value={t.id} className="text-xs font-bold uppercase">{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="bg-white/10 border-white/20 text-white h-9 px-4 font-black uppercase text-[10px] tracking-widest" onClick={() => window.print()}>
                <Printer className="h-4 w-4 mr-2" /> Print A4 Sheet
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setIsViewOpen(false)} className="text-white hover:bg-white/10"><X className="h-4 w-4" /></Button>
            </div>
          </div>
          <div id="print-area" className="p-12 bg-white text-black min-h-[600px] font-sans overflow-y-auto max-h-[80vh]">
            {selectedJobTemplateId === 'default' ? (
              <>
                <div className="flex justify-between items-end border-b-4 border-black pb-6">
                  <div>
                    <h1 className="text-4xl font-black tracking-tighter">SHREE LABEL CREATION</h1>
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-60">Production Floor: Jumbo Slitting</p>
                  </div>
                  <div className="text-right space-y-1">
                    <Badge className="bg-black text-white px-4 py-1.5 rounded-none font-black text-lg">{selectedJob?.job_card_no}</Badge>
                    <p className="text-[10px] font-bold uppercase pt-2">DATE: {selectedJob?.createdAt ? new Date(selectedJob.createdAt).toLocaleDateString() : '—'}</p>
                  </div>
                </div>

                <div className="mt-8 grid grid-cols-2 gap-12">
                  <div className="space-y-6">
                    <h3 className="text-xs font-black uppercase border-b-2 border-black pb-1">Job Information</h3>
                    <div className="grid grid-cols-2 gap-x-12 gap-y-3 text-xs font-bold">
                      <span className="opacity-50 uppercase">Job ID:</span><span className="font-mono">{selectedJob?.target_job_no || "—"}</span>
                      <span className="opacity-50 uppercase">Job Name:</span><span>{selectedJob?.target_job_name || "—"}</span>
                      <span className="opacity-50 uppercase">Material:</span><span className="text-primary font-black uppercase">{allRolls?.find(r => r.rollNo === selectedJob?.parent_roll)?.paperType || "—"}</span>
                      <span className="opacity-50 uppercase">Received At:</span><span className="font-mono">{selectedJob?.createdAt ? format(new Date(selectedJob.createdAt), 'dd-MM-yyyy hh:mm a') : '—'}</span>
                      <span className="opacity-50 uppercase">Machine:</span><span>{selectedJob?.machine || "—"}</span>
                      <span className="opacity-50 uppercase">Operator:</span><span>{selectedJob?.operator || "—"}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <div className="border-2 border-black p-1">
                      <QRCodeSVG value={siteOrigin ? `${siteOrigin}/roll/${selectedJob?.id}` : (selectedJob?.id || "")} size={80} />
                    </div>
                    <p className="text-[8px] font-black uppercase mt-1">Scan to Update Status</p>
                  </div>
                </div>

                <div className="mt-10">
                  <h3 className="text-xs font-black uppercase border-b-2 border-black pb-1 mb-4">Source Rolls Table</h3>
                  <Table className="border-2 border-black">
                    <TableHeader className="bg-slate-100">
                      <TableRow className="border-b-2 border-black h-10">
                        <TableHead className="font-black text-black text-[10px] uppercase border-r-2 border-black px-4 text-center">Roll ID</TableHead>
                        <TableHead className="font-black text-black text-[10px] uppercase border-r-2 border-black px-4 text-center">Paper Type</TableHead>
                        <TableHead className="font-black text-black text-[10px] uppercase border-r-2 border-black px-4 text-center">Dimension (Width × Length)</TableHead>
                        <TableHead className="font-black text-black text-[10px] uppercase px-4 text-center">Company</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(selectedJob?.parent_rolls || [selectedJob?.parent_roll]).filter(Boolean).map((rollId: string) => {
                        const roll = allRolls?.find(r => r.rollNo === rollId);
                        return (
                          <TableRow key={rollId} className="border-b-2 border-black last:border-b-0 h-10 text-center">
                            <TableCell className="font-bold border-r-2 border-black px-4 font-mono">{rollId}</TableCell>
                            <TableCell className="border-r-2 border-black px-4 font-bold uppercase">{roll?.paperType || "—"}</TableCell>
                            <TableCell className="border-r-2 border-black px-4">{roll?.widthMm}mm × {roll?.lengthMeters}m</TableCell>
                            <TableCell className="px-4 font-bold uppercase">{roll?.paperCompany || "—"}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                <div className="mt-10">
                  <h3 className="text-xs font-black uppercase border-b-2 border-black pb-1 mb-4">Child Rolls Generated</h3>
                  <Table className="border-2 border-black">
                    <TableHeader className="bg-slate-100">
                      <TableRow className="border-b-2 border-black h-10">
                        <TableHead className="font-black text-black text-[10px] uppercase border-r-2 border-black px-4 text-center">Child Roll ID</TableHead>
                        <TableHead className="font-black text-black text-[10px] uppercase border-r-2 border-black px-4 text-center">Width</TableHead>
                        <TableHead className="font-black text-black text-[10px] uppercase px-4 text-center">Length</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedJob?.child_rolls?.map((code: string) => {
                        const roll = allRolls?.find(r => r.rollNo === code);
                        return (
                          <TableRow key={code} className="border-b-2 border-black last:border-b-0 h-10 text-center">
                            <TableCell className="font-bold border-r-2 border-black px-4 font-mono">{code}</TableCell>
                            <TableCell className="border-r-2 border-black px-4">{roll?.widthMm || "—"} mm</TableCell>
                            <TableCell className="px-4 font-bold">{roll?.lengthMeters || "—"} mtr</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                <div className="mt-12 grid grid-cols-3 gap-8">
                  <div className="border-2 border-black p-4 space-y-4">
                    <p className="text-[10px] font-black uppercase underline">Machine Log</p>
                    <div className="space-y-2 text-[10px] font-bold">
                      <p>Start: _______________</p>
                      <p>End:   _______________</p>
                    </div>
                  </div>
                  <div className="border-2 border-black p-4">
                    <p className="text-[10px] font-black uppercase underline">Operator Notes</p>
                  </div>
                  <div className="border-2 border-black p-4 flex flex-col justify-end">
                    <div className="border-t-2 border-black text-center pt-2">
                      <p className="text-[9px] font-black uppercase">Supervisor Sign</p>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center">
                <TemplateRenderer 
                  template={activeJobTemplate} 
                  data={prepareJobData(selectedJob)} 
                />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* LABEL PRINT DIALOG */}
      <Dialog open={isLabelOpen} onOpenChange={setIsLabelOpen}>
        <DialogContent className="sm:max-w-[1000px] p-0 overflow-hidden bg-slate-50 border-none shadow-3xl">
          <div className="bg-slate-900 text-white p-6 flex justify-between items-center no-print">
            <div className="flex items-center gap-4">
              <DialogTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2"><Printer className="h-4 w-4 text-primary" /> Thermal Label Queue</DialogTitle>
              <Select value={selectedLabelTemplateId} onValueChange={setSelectedLabelTemplateId}>
                <SelectTrigger className="h-8 w-[250px] bg-white/10 border-white/20 text-white text-[10px] font-bold uppercase rounded-lg">
                  <SelectValue placeholder="Select Template" />
                </SelectTrigger>
                <SelectContent className="z-[110]">
                  <SelectItem value="default" className="text-xs font-bold uppercase">Default System Template</SelectItem>
                  {labelTemplates?.map(t => (
                    <SelectItem key={t.id} value={t.id} className="text-xs font-bold uppercase">{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button className="h-9 px-6 bg-primary font-black uppercase text-[10px] tracking-widest" onClick={() => window.print()}>Execute Print Batch</Button>
          </div>
          <div className="p-10 flex flex-col items-center gap-8 max-h-[70vh] overflow-y-auto industrial-scroll">
            <div id="label-batch" className="space-y-10">
              {selectedJob?.child_rolls?.map((code: string) => {
                const roll = allRolls?.find(r => r.rollNo === code);
                return (
                  <div key={code} className="flex flex-col items-center">
                    {selectedLabelTemplateId === 'default' ? (
                      <div className="bg-white p-8 border-4 border-black relative overflow-hidden label-print-item" style={{ width: '150mm', height: '100mm', fontFamily: 'monospace', color: 'black' }}>
                        <div className="border-b-4 border-black pb-4 flex justify-between items-center">
                          <span className="text-3xl font-black tracking-tighter">SHREE LABEL</span>
                          <span className="text-xl font-bold">REEL ID</span>
                        </div>
                        <div className="mt-6 flex justify-between gap-6">
                          <div className="flex-1 space-y-4">
                            <div><p className="text-[10px] font-black opacity-50 uppercase">Serial Number</p><p className="text-6xl font-black tracking-tighter leading-none">{code}</p></div>
                            <div><p className="text-[10px] font-black opacity-50 uppercase">Paper Item</p><p className="text-2xl font-bold truncate">{roll?.paperType || "SUBSTRATE"}</p></div>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <div className="border-2 border-black p-1"><QRCodeSVG value={siteOrigin ? `${siteOrigin}/roll/${roll?.id || code.replace(/\//g, '-')}` : (roll?.id || code.replace(/\//g, '-'))} size={120} /></div>
                            <p className="text-[8px] font-black uppercase">Scan for Full Specs</p>
                          </div>
                        </div>
                        <div className="mt-8 grid grid-cols-2 gap-8 border-t-4 border-black pt-6">
                          <div className="flex justify-between border-b-2 border-black pb-1"><span className="text-lg font-bold">W:</span><span className="text-xl font-black">{roll?.widthMm} MM</span></div>
                          <div className="flex justify-between border-b-2 border-black pb-1"><span className="text-lg font-bold">L:</span><span className="text-xl font-black">{roll?.lengthMeters} MTR</span></div>
                        </div>
                        <div className="mt-auto absolute bottom-6 left-8 right-8 flex justify-between text-[12px] font-black uppercase opacity-60">
                          <span>Dest: {roll?.jobNo ? 'JOB' : 'STOCK'}</span>
                          <span>Card: {selectedJob?.job_card_no}</span>
                        </div>
                      </div>
                    ) : (
                      <TemplateRenderer 
                        template={activeLabelTemplate} 
                        data={prepareRollData(roll)} 
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <style jsx global>{`
        @media print {
          body * { visibility: hidden !important; }
          #print-area, #print-area *, #label-batch, #label-batch * { visibility: visible !important; }
          
          #print-area {
            position: absolute !important;
            left: 0 !important; top: 0 !important;
            width: 210mm !important;
            display: block !important;
          }

          .label-print-item {
            page-break-after: always;
            margin: 0 !important;
            box-shadow: none !important;
            display: flex !important;
            justify-content: center !important;
            align-items: center !important;
          }

          .no-print { display: none !important; }
          @page { margin: 0; size: auto; }
        }
      `}</style>
    </div>
  )
}

export default function JumboJobCardPage() {
  return (
    <Suspense fallback={<div className="p-20 text-center"><Loader2 className="animate-spin h-8 w-8 mx-auto text-primary" /></div>}>
      <JumboJobCardContent />
    </Suspense>
  )
}
