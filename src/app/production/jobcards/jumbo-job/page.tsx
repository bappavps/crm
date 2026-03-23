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
  MessageSquare,
  CalendarDays,
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
  SelectValue 
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useFirestore, useUser, useCollection, useMemoFirebase, useDoc } from "@/firebase"
import { collection, doc, query, orderBy, serverTimestamp, setDoc, deleteDoc, where } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { QRCodeSVG } from 'qrcode.react'
import { TemplateRenderer } from "@/components/printing/template-renderer"
import { format } from "date-fns"

const MONTHS = [
  { value: "all", label: "All Months" },
  { value: "1", label: "January" },
  { value: "2", label: "February" },
  { value: "3", label: "March" },
  { value: "4", label: "April" },
  { value: "5", label: "May" },
  { value: "6", label: "June" },
  { value: "7", label: "July" },
  { value: "8", label: "August" },
  { value: "9", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

const YEARS = ["2024", "2025", "2026"];

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
  const [monthFilter, setMonthFilter] = useState("all")
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear().toString())
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

  // Corporate Settings - SINGLE FETCH Strategy
  const companySettingsRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'company_settings', 'global');
  }, [firestore]);
  const { data: companySettings } = useDoc(companySettingsRef);

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
      toast({ title: "Job Card Initialized" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Creation Failed", description: e.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExecutePrint = async (containerId: string, templateType: 'label' | 'report') => {
    const printContent = document.getElementById(containerId);
    if (!printContent) return;

    const html2canvas = (await import('html2canvas')).default;
    setIsProcessing(true);

    await document.fonts.ready;

    const template = templateType === 'label' ? (activeLabelTemplate || { paperWidth: 150, paperHeight: 100 }) : (activeJobTemplate || { paperWidth: 210, paperHeight: 297 });
    const paperW = template.paperWidth;
    const paperH = template.paperHeight;

    // Use absolute dimensions for capture to prevent clipping
    const captureWidth = paperW * 3.78;
    const captureHeight = printContent.scrollHeight;

    try {
      const canvas = await html2canvas(printContent, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: captureWidth,
        height: captureHeight,
        windowWidth: captureWidth
      });

      const imgData = canvas.toDataURL('image/png', 1.0);
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0'; iframe.style.bottom = '0';
      iframe.style.width = '0'; iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);

      const iframeDoc = iframe.contentWindow?.document || iframe.contentDocument;
      if (iframeDoc) {
        iframeDoc.write(`
          <html>
            <head>
              <title>Print Stream</title>
              <style>
                @page { size: ${paperW}mm ${paperH}mm; margin: 0; }
                body { margin: 0; padding: 0; display: flex; justify-content: center; }
                img { width: ${paperW}mm; image-rendering: -webkit-optimize-contrast; }
              </style>
            </head>
            <body><img src="${imgData}" /></body>
          </html>
        `);
        iframeDoc.close();

        setTimeout(() => {
          if (iframe.contentWindow) {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
          }
          setTimeout(() => { iframe.remove(); setIsProcessing(false); }, 1000);
        }, 500);
      }
    } catch (err) {
      toast({ variant: "destructive", title: "Render Error" });
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
    return jobs.filter(j => {
      const matchesSearch = j.job_card_no.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (j.parent_roll && j.parent_roll.toLowerCase().includes(searchQuery.toLowerCase()));
      
      if (!matchesSearch) return false;

      const jobDate = new Date(j.createdAt);
      const matchesYear = yearFilter === "all" || jobDate.getFullYear().toString() === yearFilter;
      const matchesMonth = monthFilter === "all" || (jobDate.getMonth() + 1).toString() === monthFilter;

      return matchesYear && matchesMonth;
    });
  }, [jobs, searchQuery, monthFilter, yearFilter]);

  const activeJobTemplate = jobTemplates?.find(t => t.id === selectedJobTemplateId);
  const activeLabelTemplate = labelTemplates?.find(t => t.id === selectedLabelTemplateId);

  const prepareJobData = (job: any) => {
    if (!job) return {};
    const parentRollsList = (job.parent_rolls || [job.parent_roll]).filter(Boolean);
    const rawSourceRolls = allRolls?.filter(r => parentRollsList.includes(r.rollNo)) || [];
    const children = allRolls?.filter(r => job.child_rolls?.includes(r.rollNo)) || [];
    
    return {
      job: {
        batchId: job.job_card_no || "",
        date: job.createdAt ? format(new Date(job.createdAt), 'dd/MM/yyyy') : "",
        paperType: job.paperType || rawSourceRolls[0]?.paperType || "SUBSTRATE",
        machineId: job.machine || "MANUAL",
        operator: job.operator || "UNASSIGNED",
        companyName: companySettings?.name || "Shree Label Creation",
        companyAddress: companySettings?.address || "",
        companyLogo: companySettings?.logo || "",
        remarks: job.notes || ""
      },
      sourceMaterials: rawSourceRolls.map(r => ({
        rollId: r.rollNo || "",
        company: r.paperCompany || "",
        type: r.paperType || "",
        dimension: `${r.widthMm}mm x ${r.lengthMeters}m`,
        gsm: r.gsm || 0,
        weight: r.weightKg || 0,
        sqm: r.sqm || 0,
        jobName: r.jobName || "—"
      })),
      slittingOutputs: children.map(r => ({
        childRollId: r.rollNo || "",
        parentRef: r.parentRollNo || job.parent_roll || "",
        width: r.widthMm || 0,
        length: r.lengthMeters || 0,
        gsm: r.gsm || 0,
        qty: 1, 
        wastage: r.wastage || 0,
        destination: r.jobNo ? (r.jobName || r.jobNo) : "STOCK",
        status: r.jobNo ? "Assigned" : "AVAILABLE STOCK"
      }))
    };
  };

  const jobData = useMemo(() => prepareJobData(selectedJob), [selectedJob, companySettings, allRolls]);

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

      <Tabs defaultValue="active" className="w-full">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-3xl shadow-sm border border-slate-100">
          <TabsList className="bg-slate-100 p-1 rounded-2xl h-11">
            <TabsTrigger value="active" className="px-8 font-bold uppercase text-[10px] tracking-widest gap-2">
              <Clock className="h-3.5 w-3.5" /> Active Pipeline
            </TabsTrigger>
            <TabsTrigger value="history" className="px-8 font-bold uppercase text-[10px] tracking-widest gap-2">
              <History className="h-3.5 w-3.5" /> History Archive
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-3">
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input 
                placeholder="Search Job ID / Roll..." 
                className="h-9 bg-slate-50 border-slate-200 rounded-xl pl-9 text-xs font-bold"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-slate-100" onClick={() => { setSearchQuery(""); setMonthFilter("all"); setYearFilter(new Date().getFullYear().toString()); }}>
              <FilterX className="h-4 w-4 text-slate-400" />
            </Button>
          </div>
        </div>

        <TabsContent value="active" className="mt-6">
          <Card className="border-none shadow-xl overflow-hidden rounded-3xl">
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
                  ) : filteredJobs.filter(j => j.status !== 'COMPLETED').length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-20 text-muted-foreground italic uppercase text-[10px] font-bold tracking-widest opacity-30">No active jobs found</TableCell></TableRow>
                  ) : filteredJobs.filter(j => j.status !== 'COMPLETED').map((j) => (
                    <TableRow key={j.id} className="hover:bg-slate-50 transition-colors group border-b last:border-0">
                      <TableCell className="font-black text-primary font-mono text-xs pl-8">{j.job_card_no}</TableCell>
                      <TableCell className="font-bold text-sm">{j.parent_roll || "MULTI"}</TableCell>
                      <TableCell className="text-[11px] font-bold uppercase text-slate-500">{j.operator || "UNASSIGNED"}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary" className="font-black text-[9px] h-5">{j.child_rolls?.length || 0} TOTAL</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={cn("text-[9px] font-black h-5", j.status === 'RUNNING' ? "bg-blue-500" : "bg-amber-500")}>
                          {j.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right pr-8">
                        <div className="flex justify-end gap-1.5">
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg bg-indigo-500 text-white hover:bg-indigo-600 shadow-sm" onClick={() => { setSelectedJob(j); setIsViewOpen(true); }}><Eye className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg bg-slate-700 text-white hover:bg-black shadow-sm" onClick={() => { setSelectedJob(j); setIsLabelOpen(true); }}><Printer className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white shadow-sm" onClick={() => handleDelete(j.id)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <Card className="border-none shadow-xl overflow-hidden rounded-3xl">
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="font-black text-[10px] uppercase pl-8">Job ID</TableHead>
                    <TableHead className="font-black text-[10px] uppercase">Completion Date</TableHead>
                    <TableHead className="font-black text-[10px] uppercase">Primary Roll</TableHead>
                    <TableHead className="font-black text-[10px] uppercase text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredJobs.filter(j => j.status === 'COMPLETED').map((j) => (
                    <TableRow key={j.id} className="hover:bg-slate-50 border-b last:border-0">
                      <TableCell className="font-black text-primary font-mono text-xs pl-8">{j.job_card_no}</TableCell>
                      <TableCell className="text-xs font-bold text-slate-500">{j.endTime ? format(new Date(j.endTime), 'dd MMM yyyy') : format(new Date(j.createdAt), 'dd MMM yyyy')}</TableCell>
                      <TableCell className="font-bold text-sm">{j.parent_roll || "MULTI"}</TableCell>
                      <TableCell className="text-right pr-8">
                        <div className="flex justify-end gap-1.5">
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg bg-indigo-500 text-white" onClick={() => { setSelectedJob(j); setIsViewOpen(true); }}><Eye className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg bg-rose-50 text-rose-600" onClick={() => handleDelete(j.id)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* CREATE DIALOG */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[800px] p-0 overflow-hidden rounded-3xl border-none shadow-3xl">
          <form onSubmit={handleCreateJob}>
            <div className="bg-slate-900 text-white p-6">
              <DialogTitle className="text-xl font-black uppercase tracking-tight flex items-center gap-3">
                <FileText className="h-5 w-5 text-primary" /> Create Jumbo Job Card
              </DialogTitle>
            </div>
            <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8 bg-slate-50">
              <div className="space-y-6">
                <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-50">Job ID</Label><Input value={formData.job_card_no} onChange={e => setFormData({...formData, job_card_no: e.target.value})} className="h-11 rounded-xl font-bold border-2" /></div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase opacity-50">Parent Jumbo Roll</Label>
                  <Select value={formData.parent_roll} onValueChange={v => setFormData({...formData, parent_roll: v})}>
                    <SelectTrigger className="h-11 rounded-xl border-2 font-bold"><SelectValue placeholder="Choose Roll" /></SelectTrigger>
                    <SelectContent className="z-[100]">{parentRolls.map(r => <SelectItem key={r.id} value={r.rollNo} className="font-bold">{r.rollNo} - {r.paperType}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-50">Machine</Label><Select value={formData.machine} onValueChange={v => setFormData({...formData, machine: v})}><SelectTrigger className="h-11 rounded-xl border-2 font-bold"><SelectValue /></SelectTrigger><SelectContent className="z-[100]">{machines?.map(m => <SelectItem key={m.id} value={m.machine_name}>{m.machine_name}</SelectItem>)}</SelectContent></Select></div>
                  <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-50">Operator</Label><Select value={formData.operator} onValueChange={v => setFormData({...formData, operator: v})}><SelectTrigger className="h-11 rounded-xl border-2 font-bold"><SelectValue /></SelectTrigger><SelectContent className="z-[100]">{operators.map(o => <SelectItem key={o.id} value={`${o.firstName} ${o.lastName}`}>{o.firstName} {o.lastName}</SelectItem>)}</SelectContent></Select></div>
                </div>
              </div>
              <div className="space-y-4">
                <Label className="text-[10px] font-black uppercase opacity-50">Units Assigned</Label>
                <div className="bg-white border-2 rounded-2xl p-4 h-[250px] overflow-y-auto industrial-scroll space-y-2">
                  {filteredChildRolls.map(r => (
                    <div key={r.id} className="p-2 border rounded-lg flex items-center justify-between">
                      <span className="text-xs font-bold">{r.rollNo}</span>
                      <Badge variant="outline" className="text-[8px]">{r.widthMm}mm</Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter className="p-6 bg-white border-t">
              <Button type="submit" disabled={isProcessing} className="w-full h-12 font-black uppercase bg-primary">Commit Job Card</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* VIEW / PRINT MODAL */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="sm:max-w-none w-fit p-0 overflow-hidden border-none shadow-none bg-slate-100/50">
          <div className="bg-slate-900 text-white p-4 flex items-center justify-between sticky top-0 z-50 no-print">
            <div className="flex items-center gap-4">
              <DialogTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" /> Technical Instruction Sheet
              </DialogTitle>
              <Select value={selectedJobTemplateId} onValueChange={setSelectedJobTemplateId}>
                <SelectTrigger className="h-8 w-[200px] bg-white/10 border-white/20 text-white text-[10px] font-bold uppercase rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[110]">
                  <SelectItem value="default" className="text-xs font-bold uppercase">Default Layout</SelectItem>
                  {jobTemplates?.map(t => <SelectItem key={t.id} value={t.id} className="text-xs font-bold uppercase">{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button disabled={isProcessing} variant="outline" className="bg-white/10 border-white/20 text-white h-9 px-4 font-black uppercase text-[10px] tracking-widest" onClick={() => handleExecutePrint('print-area', 'report')}>
                {isProcessing ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Printer className="h-4 w-4 mr-2" />}
                EXECUTE PRINT
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setIsViewOpen(false)} className="text-white hover:bg-white/10"><X className="h-4 w-4" /></Button>
            </div>
          </div>

          <div className="p-10 overflow-auto industrial-scroll max-h-[90vh]">
            <div id="print-area" className={cn(
              "bg-white shadow-2xl mx-auto p-8 font-sans transition-all duration-300",
              selectedJobTemplateId === 'default' ? "w-[210mm] min-h-[297mm]" : "w-fit min-h-fit"
            )}>
              {selectedJobTemplateId === 'default' ? (
                <div className="space-y-6">
                  {/* HEADER */}
                  <div className="flex justify-between items-end border-b-4 border-slate-900 pb-6 mb-6">
                    <div className="flex gap-6 items-center">
                      {jobData.job.companyLogo && <img src={jobData.job.companyLogo} className="h-16 w-auto object-contain" alt="Logo" />}
                      <div className="space-y-1">
                        <h1 className="text-3xl font-black tracking-tighter text-slate-900 uppercase">{jobData.job.companyName}</h1>
                        <p className="text-[9px] font-bold text-slate-500 uppercase max-w-sm leading-tight">{jobData.job.companyAddress}</p>
                      </div>
                    </div>
                    <div className="text-right space-y-1">
                      <Badge className="bg-slate-900 text-white px-4 py-1 rounded-md font-black text-lg tracking-tight border-none shadow-md">{jobData.job.batchId}</Badge>
                      <p className="text-[9px] font-black uppercase text-slate-400">GEN DATE: {jobData.job.date}</p>
                    </div>
                  </div>

                  {/* JOB INFO GRID */}
                  <div className="grid grid-cols-2 gap-10 mb-6">
                    <div className="space-y-4">
                      <h3 className="text-[10px] font-black uppercase text-slate-900 flex items-center gap-2 border-b-2 pb-1"><div className="w-1 h-3 bg-primary rounded-full" /> Execution Identity</h3>
                      <div className="grid grid-cols-2 gap-y-3 text-[11px] font-bold">
                        <span className="opacity-40 uppercase">Substrate:</span><span>{jobData.job.paperType}</span>
                        <span className="opacity-40 uppercase">Machine ID:</span><span>{jobData.job.machineId}</span>
                        <span className="opacity-40 uppercase">Operator:</span><span>{jobData.job.operator}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <div className="p-1 border-2 border-slate-200 rounded-xl"><QRCodeSVG value={siteOrigin ? `${siteOrigin}/roll/${selectedJob?.id}` : (selectedJob?.id || "")} size={80} /></div>
                      <p className="text-[8px] font-black uppercase text-slate-400">Technical Trace ID</p>
                    </div>
                  </div>

                  {/* SOURCE MATERIALS TABLE */}
                  <div className="space-y-2">
                    <h3 className="text-[10px] font-black uppercase text-slate-900 flex items-center gap-2"><div className="w-1 h-3 bg-primary rounded-full" /> Source Material Allocation</h3>
                    <div className="rounded-xl border-2 border-slate-900 overflow-hidden">
                      <Table className="text-center">
                        <TableHeader className="bg-slate-900">
                          <TableRow className="h-8 hover:bg-slate-900 border-none">
                            {["ROLL ID", "COMPANY", "TYPE", "DIMENSION", "GSM", "WEIGHT", "SQ. MTR", "JOB CONTEXT"].map(h => (
                              <TableHead key={h} className="text-white font-black text-[9px] uppercase border-r border-white/10 text-center">{h}</TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {jobData.sourceMaterials.map((r: any, idx: number) => (
                            <TableRow key={idx} className="h-8 border-b border-slate-200 last:border-0 even:bg-slate-50">
                              <TableCell className="font-black text-[11px] border-r border-slate-200">{r.rollId}</TableCell>
                              <TableCell className="text-[10px] border-r border-slate-200 truncate max-w-[80px]">{r.company}</TableCell>
                              <TableCell className="text-[10px] border-r border-slate-200">{r.type}</TableCell>
                              <TableCell className="text-[10px] border-r border-slate-200">{r.dimension}</TableCell>
                              <TableCell className="text-[10px] border-r border-slate-200 font-mono">{r.gsm}</TableCell>
                              <TableCell className="text-[10px] border-r border-slate-200 font-mono">{r.weight}kg</TableCell>
                              <TableCell className="text-[10px] border-r border-slate-200 font-black text-primary font-mono">{r.sqm}</TableCell>
                              <TableCell className="text-[9px] font-bold uppercase truncate max-w-[100px]">{r.jobName}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  {/* SLITTING OUTPUT TABLE */}
                  <div className="space-y-2">
                    <h3 className="text-[10px] font-black uppercase text-slate-900 flex items-center gap-2"><div className="w-1 h-3 bg-primary rounded-full" /> Slitting Unit Outputs (Lineage)</h3>
                    <div className="rounded-xl border-2 border-slate-900 overflow-hidden">
                      <Table className="text-center">
                        <TableHeader className="bg-slate-900">
                          <TableRow className="h-8 hover:bg-slate-900 border-none">
                            {["CHILD ROLL ID", "PARENT REF", "WIDTH", "LENGTH", "GSM", "QTY", "WASTAGE", "DESTINATION"].map(h => (
                              <TableHead key={h} className="text-white font-black text-[9px] uppercase border-r border-white/10 text-center">{h}</TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {jobData.slittingOutputs.map((r: any, idx: number) => (
                            <TableRow key={idx} className="h-8 border-b border-slate-200 last:border-0 even:bg-slate-50">
                              <TableCell className="font-black text-[11px] border-r border-slate-200 text-slate-900">{r.childRollId}</TableCell>
                              <TableCell className="text-[10px] border-r border-slate-200 font-mono">{r.parentRef}</TableCell>
                              <TableCell className="text-[10px] border-r border-slate-200">{r.width}mm</TableCell>
                              <TableCell className="text-[10px] border-r border-slate-200">{r.length}m</TableCell>
                              <TableCell className="text-[10px] border-r border-slate-200 font-mono">{r.gsm}</TableCell>
                              <TableCell className="text-[10px] border-r border-slate-200 font-mono">{r.qty}</TableCell>
                              <TableCell className="text-[10px] border-r border-slate-200 font-mono">{r.wastage}%</TableCell>
                              <TableCell className="px-2">
                                <span className={cn(
                                  "text-[9px] uppercase tracking-tighter",
                                  r.status === 'AVAILABLE STOCK' ? "font-black text-emerald-600" : "font-bold text-blue-600"
                                )}>{r.destination}</span>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  {/* FOOTER GRID */}
                  <div className="mt-8 grid grid-cols-3 gap-6">
                    <div className="border-2 border-slate-300 rounded-xl p-4 bg-slate-50 space-y-2">
                      <p className="text-[9px] font-black uppercase text-slate-400 border-b pb-1">Machine Run Log</p>
                      <div className="space-y-1.5 text-[10px] font-bold text-slate-600 uppercase">
                        <p className="flex justify-between">START: <span className="opacity-20">__:__</span></p>
                        <p className="flex justify-between">END: <span className="opacity-20">__:__</span></p>
                        <p className="flex justify-between text-primary">NET WASTE: <span className="opacity-20">__ KG</span></p>
                      </div>
                    </div>
                    <div className="border-2 border-slate-300 rounded-xl p-4 bg-slate-50 flex flex-col">
                      <p className="text-[9px] font-black uppercase text-slate-400 border-b pb-1 mb-2">Technical Remarks</p>
                      <p className="text-[10px] font-medium text-slate-700 italic flex-1">{jobData.job.remarks || "No specific floor deviations noted."}</p>
                    </div>
                    <div className="border-2 border-slate-300 rounded-xl p-4 bg-slate-50 flex flex-col justify-end">
                      <div className="text-center pt-2 border-t-2 border-slate-300 border-dashed">
                        <p className="text-[10px] font-black uppercase text-slate-900">QC Supervisor Sign</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <TemplateRenderer template={activeJobTemplate} data={jobData} />
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isLabelOpen} onOpenChange={setIsLabelOpen}>
        <DialogContent className="sm:max-w-[900px] max-h-[90vh] p-0 flex flex-col overflow-hidden rounded-3xl">
          <div className="bg-slate-900 text-white p-6 flex items-center justify-between no-print">
            <div className="flex items-center gap-4">
              <DialogTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2"><Printer className="h-4 w-4 text-primary" /> Thermal Label Spooler</DialogTitle>
              <Select value={selectedLabelTemplateId} onValueChange={setSelectedLabelTemplateId}>
                <SelectTrigger className="h-8 w-[250px] bg-white/10 border-white/20 text-white text-[10px] font-bold uppercase rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[110]">
                  <SelectItem value="default" className="text-xs font-bold uppercase">System Thermal (150x100)</SelectItem>
                  {labelTemplates?.map(t => <SelectItem key={t.id} value={t.id} className="text-xs font-bold uppercase">{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button disabled={isProcessing} variant="outline" className="bg-white/10 border-white/20 text-white h-9 px-4 font-black uppercase text-[10px] tracking-widest" onClick={() => handleExecutePrint('label-spool', 'label')}>
                {isProcessing ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Printer className="h-4 w-4 mr-2" />}
                PRINT LABELS
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setIsLabelOpen(false)} className="text-white hover:bg-white/10"><X className="h-4 w-4" /></Button>
            </div>
          </div>
          <div id="label-spool" className="flex-1 overflow-y-auto bg-slate-100 p-10 flex flex-col items-center gap-8 industrial-scroll">
            {selectedJob?.child_rolls?.map((code: string, idx: number) => {
              const roll = allRolls?.find(r => r.rollNo === code);
              return (
                <div key={idx}>
                  {selectedLabelTemplateId === 'default' ? (
                    <div className="label-print-item bg-white p-8 border-4 border-black relative" style={{ width: '150mm', height: '100mm', color: 'black' }}>
                      <div className="border-b-4 border-black pb-4 flex justify-between items-center"><span className="text-3xl font-black">SHREE LABEL</span><span className="text-xl font-bold">REEL ID</span></div>
                      <div className="mt-6 flex justify-between">
                        <div className="flex-1 space-y-4">
                          <div><p className="text-[10px] font-black uppercase opacity-50">Identity</p><p className="text-6xl font-black tracking-tighter">{code}</p></div>
                          <div><p className="text-[10px] font-black uppercase opacity-50">Item</p><p className="text-2xl font-bold">{roll?.paperType}</p></div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <QRCodeSVG value={siteOrigin ? `${siteOrigin}/roll/${roll?.id}` : (roll?.id || "")} size={100} />
                        </div>
                      </div>
                      <div className="mt-8 grid grid-cols-2 gap-8 border-t-4 border-black pt-6">
                        <div className="flex justify-between border-b-2 border-black pb-1"><span className="text-lg font-bold">W:</span><span className="text-xl font-black">{roll?.widthMm} MM</span></div>
                        <div className="flex justify-between border-b-2 border-black pb-1"><span className="text-lg font-bold">L:</span><span className="text-xl font-black">{roll?.lengthMeters} MTR</span></div>
                      </div>
                    </div>
                  ) : (
                    <TemplateRenderer template={activeLabelTemplate} data={prepareRollData(roll || { rollNo: code })} />
                  )}
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      <style jsx global>{`
        @media print {
          body * { visibility: hidden !important; }
          #print-area, #print-area * { visibility: visible !important; }
          #print-area { position: absolute !important; left: 0 !important; top: 0 !important; width: 210mm !important; display: block !important; margin: 0 !important; padding: 0 !important; }
          .no-print { display: none !important; }
          @page { size: A4; margin: 0; }
        }
        .industrial-scroll::-webkit-scrollbar { width: 6px; }
        .industrial-scroll::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
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
