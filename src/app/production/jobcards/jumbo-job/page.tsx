
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
  MoreHorizontal,
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
import { useFirestore, useUser, useCollection, useMemoFirebase } from "@/firebase"
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

  const handleExecutePrint = async (containerId: string, templateType: 'label' | 'report') => {
    const printContent = document.getElementById(containerId);
    if (!printContent) return;

    const html2canvas = (await import('html2canvas')).default;
    
    setIsProcessing(true);
    toast({ title: "Streamlining Print Pipeline", description: "Applying technical snapshot enhancements..." });

    await document.fonts.ready;

    const template = templateType === 'label' ? (activeLabelTemplate || { paperWidth: 150, paperHeight: 100 }) : (activeJobTemplate || { paperWidth: 210, paperHeight: 297 });
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
      toast({ variant: "destructive", title: "Print Optimization Error", description: "Technical hardware incompatibility detected." });
      setIsProcessing(false);
      return;
    }

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0'; iframe.style.bottom = '0';
    iframe.style.width = '0'; iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const renderedOutput = images.map(img => `
      <div class="print-page">
        <img src="${img}" />
      </div>
    `).join('');

    const iframeDoc = iframe.contentWindow?.document || iframe.contentDocument;
    if (iframeDoc) {
      iframeDoc.write(`
        <html>
          <head>
            <title>Shree Label Production</title>
            <style>
              @page { size: A4; margin: 10mm; }
              body { margin: 0; padding: 0; background: white; }
              .print-page { width: 100%; height: auto; page-break-after: always; break-inside: avoid; display: flex; justify-content: center; align-items: center; overflow: hidden; }
              img { width: 100%; max-width: 190mm; height: auto; object-fit: contain; image-rendering: -webkit-optimize-contrast; }
            </style>
          </head>
          <body>${renderedOutput}</body>
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
    const parentRollsList = (job?.parent_rolls || [job?.parent_roll]).filter(Boolean);
    const rawSourceRolls = allRolls?.filter(r => parentRollsList.includes(r.rollNo)) || [];
    const children = allRolls?.filter(r => job?.child_rolls?.includes(r.rollNo)) || [];
    
    return {
      ...job,
      job_card_id: job?.job_card_no || "",
      machine_name: job?.machine || "",
      operator_name: job?.operator || "",
      parent_roll: job?.parent_roll || "",
      sourceRolls: rawSourceRolls.map(r => ({
        rollId: r.rollNo || "",
        paperType: r.paperType || "",
        width: r.widthMm || 0,
        length: r.lengthMeters || 0,
        company: r.paperCompany || "",
        jobName: r.jobName || "—"
      })),
      SLIT_ROLLS: children,
      company_name: "Shree Label Creation",
      current_date: new Date().toLocaleDateString()
    };
  };

  const prepareRollData = (roll: any) => ({
    ...roll,
    roll_no: roll.rollNo || "",
    id: roll.id || "",
    parent_roll_no: roll.rollNo || "",
    paper_type: roll.paperType || "",
    width: roll.widthMm || 0,
    length: roll.lengthMeters || 0,
    gsm: roll.gsm || 0,
    weight: roll.weightKg || 0,
    company: roll.paperCompany || "",
    date: roll.receivedDate || "",
    company_name: roll.paperCompany || "",
    current_date: new Date().toLocaleDateString(),
    roll_url: siteOrigin ? `${siteOrigin}/roll/${roll.id}` : (roll.id || "")
  });

  const isValidURL = (str: string) => str.startsWith("http://") || str.startsWith("https://");

  const GROUP_COLORS = ['bg-blue-50/40', 'bg-slate-50/60'];

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

          <div className="flex items-center gap-3 flex-wrap md:flex-nowrap">
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input 
                placeholder="Search Job ID / Roll..." 
                className="h-9 bg-slate-50 border-slate-200 rounded-xl pl-9 text-xs font-bold"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            
            <Select value={monthFilter} onValueChange={setMonthFilter}>
              <SelectTrigger className="h-9 w-32 bg-slate-50 border-slate-200 rounded-xl text-[10px] font-bold uppercase">
                <SelectValue placeholder="Month" />
              </SelectTrigger>
              <SelectContent className="z-[100]">
                {MONTHS.map(m => <SelectItem key={m.value} value={m.value} className="text-xs font-bold uppercase">{m.label}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={yearFilter} onValueChange={setYearFilter}>
              <SelectTrigger className="h-9 w-24 bg-slate-50 border-slate-200 rounded-xl text-[10px] font-bold uppercase">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent className="z-[100]">
                <SelectItem value="all" className="text-xs font-bold uppercase">All Years</SelectItem>
                {YEARS.map(y => <SelectItem key={y} value={y} className="text-xs font-bold uppercase">{y}</SelectItem>)}
              </SelectContent>
            </Select>

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
                    <TableRow><TableCell colSpan={6} className="text-center py-20 text-muted-foreground italic uppercase text-[10px] font-bold tracking-widest opacity-30">No active jobs matching filters</TableCell></TableRow>
                  ) : filteredJobs.filter(j => j.status !== 'COMPLETED').map((j) => (
                    <TableRow key={j.id} className="hover:bg-slate-50 transition-colors group border-b last:border-0">
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
                          j.status === 'RUNNING' ? "bg-blue-500" : "bg-amber-500"
                        )}>
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
                    <TableHead className="font-black text-[10px] uppercase">Output Units</TableHead>
                    <TableHead className="font-black text-[10px] uppercase">Operator</TableHead>
                    <TableHead className="text-right font-black text-[10px] uppercase pr-8">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobsLoading ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-20"><Loader2 className="animate-spin h-8 w-8 mx-auto text-primary" /></TableCell></TableRow>
                  ) : filteredJobs.filter(j => j.status === 'COMPLETED').length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-20 text-muted-foreground italic uppercase text-[10px] font-bold tracking-widest opacity-30">No completed jobs found in archive</TableCell></TableRow>
                  ) : filteredJobs.filter(j => j.status === 'COMPLETED').map((j) => (
                    <TableRow key={j.id} className="hover:bg-slate-50 transition-colors group border-b last:border-0">
                      <TableCell className="font-black text-primary font-mono text-xs pl-8">{j.job_card_no}</TableCell>
                      <TableCell className="text-xs font-bold text-slate-500">{j.endTime ? format(new Date(j.endTime), 'dd MMM yyyy, HH:mm') : format(new Date(j.createdAt), 'dd MMM yyyy')}</TableCell>
                      <TableCell className="font-bold text-sm">{j.parent_roll || "MULTI"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-black text-[9px] h-5 border-slate-200">{j.child_rolls?.length || 0} SLITS</Badge>
                      </TableCell>
                      <TableCell className="text-[11px] font-bold uppercase text-slate-500">{j.operator}</TableCell>
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
      </Tabs>

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
              <Button disabled={isProcessing} variant="outline" className="bg-white/10 border-white/20 text-white h-9 px-4 font-black uppercase text-[10px] tracking-widest" onClick={() => handleExecutePrint('print-area', 'report')}>
                {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Printer className="h-4 w-4 mr-2" />}
                Execute Print Stream
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setIsViewOpen(false)} className="text-white hover:bg-white/10"><X className="h-4 w-4" /></Button>
            </div>
          </div>
          <div id="print-area" className="p-12 bg-white text-black min-h-[600px] font-sans overflow-y-auto max-h-[80vh] industrial-scroll">
            {selectedJobTemplateId === 'default' ? (
              <div className="label-print-item w-[210mm] mx-auto">
                <div className="flex justify-between items-end border-b-[6px] border-slate-900 pb-8 mb-10">
                  <div className="space-y-1">
                    <h1 className="text-5xl font-black tracking-tighter text-slate-900">SHREE LABEL CREATION</h1>
                    <p className="text-[11px] font-black uppercase tracking-[0.4em] text-primary">Technical Instruction Sheet: Jumbo Slitting</p>
                  </div>
                  <div className="text-right space-y-2">
                    <Badge className="bg-slate-900 text-white px-6 py-2 rounded-lg font-black text-xl shadow-lg border-none tracking-tight">{selectedJob?.job_card_no}</Badge>
                    <p className="text-[10px] font-black uppercase text-slate-400">GEN DATE: {selectedJob?.createdAt ? new Date(selectedJob.createdAt).toLocaleDateString() : '—'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-12 mb-12">
                  <div className="space-y-6">
                    <h3 className="text-xs font-black uppercase text-slate-900 flex items-center gap-2">
                      <div className="w-1.5 h-4 bg-primary rounded-full" /> Workflow Identity
                    </h3>
                    <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-xs">
                      <div className="flex flex-col"><span className="text-[9px] font-black text-slate-400 uppercase">Job Ref:</span><span className="font-bold text-slate-900">{selectedJob?.target_job_no || "—"}</span></div>
                      <div className="flex flex-col"><span className="text-[9px] font-black text-slate-400 uppercase">Production Job:</span><span className="font-bold text-primary truncate uppercase">{selectedJob?.target_job_name || "—"}</span></div>
                      <div className="flex flex-col"><span className="text-[9px] font-black text-slate-400 uppercase">Machine ID:</span><span className="font-bold text-slate-900">{selectedJob?.machine || "—"}</span></div>
                      <div className="flex flex-col"><span className="text-[9px] font-black text-slate-400 uppercase">Floor Operator:</span><span className="font-bold text-slate-900">{selectedJob?.operator || "—"}</span></div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-3">
                    <div className="p-2 bg-slate-50 border-2 border-slate-300 rounded-2xl shadow-inner">
                      <QRCodeSVG value={siteOrigin ? `${siteOrigin}/roll/${selectedJob?.id}` : (selectedJob?.id || "")} size={100} />
                    </div>
                    <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Technical Status QR</p>
                  </div>
                </div>

                <div className="space-y-12">
                  {/* SOURCE ROLLS SECTION */}
                  <div className="space-y-4">
                    <h3 className="text-[11px] font-black uppercase text-slate-900 flex items-center gap-2">
                      <div className="w-1.5 h-4 bg-primary rounded-full" /> Source Material Allocation
                    </h3>
                    <div className="rounded-2xl border-2 border-slate-800 overflow-hidden shadow-sm">
                      <Table>
                        <TableHeader className="bg-slate-900 border-none h-12">
                          <TableRow className="border-none hover:bg-slate-900">
                            <TableHead className="text-white font-black text-[10px] uppercase text-center border-r border-white/10">Roll ID</TableHead>
                            <TableHead className="text-white font-black text-[10px] uppercase text-center border-r border-white/10">Paper Type</TableHead>
                            <TableHead className="text-white font-black text-[10px] uppercase text-center border-r border-white/10">Dimension</TableHead>
                            <TableHead className="text-white font-black text-[10px] uppercase text-center">Job Context</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(selectedJob?.parent_rolls || [selectedJob?.parent_roll]).filter(Boolean).map((rollId: string, idx: number) => {
                            const roll = allRolls?.find(r => r.rollNo === rollId);
                            const groupColor = GROUP_COLORS[idx % GROUP_COLORS.length];
                            return (
                              <TableRow key={rollId} className={cn("border-b border-slate-300 h-12 text-center", groupColor)}>
                                <TableCell className="font-black border-r border-slate-300 text-[13px]">{rollId}</TableCell>
                                <TableCell className="border-r border-slate-300 font-bold uppercase text-[11px]">{roll?.paperType || "—"}</TableCell>
                                <TableCell className="border-r border-slate-300 font-bold">{roll?.widthMm}mm × {roll?.lengthMeters}m</TableCell>
                                <TableCell className="font-black text-primary text-[11px] uppercase truncate px-4">{roll?.jobName || "Allocated"}</TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  {/* CHILD ROLLS SECTION */}
                  <div className="space-y-4">
                    <h3 className="text-[11px] font-black uppercase text-slate-900 flex items-center gap-2">
                      <div className="w-1.5 h-4 bg-primary rounded-full" /> Slitting Unit Outputs (Lineage)
                    </h3>
                    <div className="rounded-2xl border-2 border-slate-800 overflow-hidden shadow-sm">
                      <Table>
                        <TableHeader className="bg-slate-900 border-none h-12">
                          <TableRow className="border-none hover:bg-slate-900">
                            <TableHead className="text-white font-black text-[10px] uppercase text-center border-r border-white/10">Child Roll ID</TableHead>
                            <TableHead className="text-white font-black text-[10px] uppercase text-center border-r border-white/10">Width</TableHead>
                            <TableHead className="text-white font-black text-[10px] uppercase text-center border-r border-white/10">Length</TableHead>
                            <TableHead className="text-white font-black text-[10px] uppercase text-center">Status / Dest</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(selectedJob?.parent_rolls || [selectedJob?.parent_roll]).filter(Boolean).map((pId: string, pIdx: number) => {
                            const groupColor = GROUP_COLORS[pIdx % GROUP_COLORS.length];
                            const children = selectedJob.child_rolls?.filter((cId: string) => cId.startsWith(pId + '-')) || [];
                            
                            return children.map((code: string) => {
                              const roll = allRolls?.find(r => r.rollNo === code);
                              const isStock = !roll?.jobNo;
                              return (
                                <TableRow key={code} className={cn("border-b border-slate-300 h-11 text-center", groupColor)}>
                                  <TableCell className="font-bold border-r border-slate-300 text-slate-900 font-mono text-[12px]">{code}</TableCell>
                                  <TableCell className="border-r border-slate-300 font-bold">{roll?.widthMm || "—"} mm</TableCell>
                                  <TableCell className="border-r border-slate-300 font-bold">{roll?.lengthMeters || "—"} mtr</TableCell>
                                  <TableCell className="px-4">
                                    <div className={cn(
                                      "inline-flex px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter",
                                      isStock ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"
                                    )}>
                                      {isStock ? "Available Stock" : (roll?.jobName || "Assigned Job")}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            });
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>

                <div className="mt-16 grid grid-cols-3 gap-8">
                  <div className="border-2 border-slate-300 rounded-2xl p-6 bg-slate-50 space-y-4">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-300 pb-2">Machine Run Log</p>
                    <div className="space-y-3 text-[11px] font-bold text-slate-600">
                      <p className="flex justify-between">START: <span className="opacity-30">____:____</span></p>
                      <p className="flex justify-between">END: <span className="opacity-30">____:____</span></p>
                      <p className="flex justify-between">WASTE: <span className="opacity-30">____ KG</span></p>
                    </div>
                  </div>
                  <div className="border-2 border-slate-300 rounded-2xl p-6 bg-slate-50 flex flex-col">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-300 pb-2 mb-2">Operator Notes</p>
                    <div className="flex-1 border-b border-slate-300 border-dashed" />
                    <div className="flex-1 border-b border-slate-300 border-dashed" />
                  </div>
                  <div className="border-2 border-slate-300 rounded-2xl p-6 bg-slate-50 flex flex-col justify-end">
                    <div className="text-center pt-4 border-t-2 border-slate-300">
                      <p className="text-[10px] font-black uppercase text-slate-900">QC Supervisor Sign</p>
                    </div>
                  </div>
                </div>
              </div>
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

      <style jsx global>{`
        @media print {
          body * { visibility: hidden !important; }
          #print-area, #print-area * { visibility: visible !important; }
          
          #print-area {
            position: absolute !important;
            left: 0 !important; top: 0 !important;
            width: 100% !important;
            display: block !important;
            background: white !important;
            padding: 0 !important;
            margin: 0 !important;
          }

          .label-print-item {
            page-break-after: always;
            margin: 0 auto !important;
            box-shadow: none !important;
            display: block !important;
            width: 100% !important;
            max-width: 190mm !important; /* A4 width minus 10mm margins */
          }

          .no-print { display: none !important; }
          @page { size: A4; margin: 10mm; }
        }
      `}</style>
    </div>
  )
}

export default function JumboJobCardPage() {
  return (
    <Suspense fallback={<div className="p-20 text-center"><Loader2 className="h-8 w-8 mx-auto text-primary" /></div>}>
      <JumboJobCardContent />
    </Suspense>
  )
}
