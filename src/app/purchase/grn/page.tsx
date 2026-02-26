
"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { 
  Plus, 
  Loader2, 
  Printer, 
  Search, 
  ArrowUpDown, 
  FilterX, 
  ArrowUp, 
  ArrowDown, 
  Hash, 
  Info, 
  Calendar,
  Filter,
  ChevronDown,
  ChevronUp,
  Download
} from "lucide-react"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog"
import { useFirestore, useUser, useCollection, useMemoFirebase, useDoc, errorEmitter, FirestorePermissionError } from "@/firebase"
import { collection, doc, runTransaction, query, where, getDocs } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import * as XLSX from 'xlsx'

type SortField = 'rollNo' | 'receivedDate' | 'purchaseRate' | 'gsm' | 'sqm' | 'weightKg';
type SortOrder = 'asc' | 'desc';

export default function GRNPage() {
  const { toast } = useToast()
  const { user } = useUser()
  const firestore = useFirestore()
  const [isMounted, setIsMounted] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isManualId, setIsManualId] = useState(false)
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  
  // Sort State
  const [sortField, setSortField] = useState<SortField>('receivedDate')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')

  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Filter State
  const [filters, setFilters] = useState({
    rollNo: "",
    paperType: "all",
    lotNo: "",
    companyRollNo: "",
    jobNo: "",
    productName: "",
    receivedDateStart: "",
    receivedDateEnd: "",
    dateOfUseStart: "",
    dateOfUseEnd: "",
    gsmMin: "",
    gsmMax: "",
    widthMin: "",
    widthMax: "",
    rateMin: "",
    rateMax: "",
    status: "all"
  })

  // Form State
  const [formData, setFormData] = useState({
    widthMm: 1020,
    lengthMeters: 0,
    sqm: 0,
    gsm: 0,
    weightKg: 0,
    purchaseRate: 0,
    wastage: 0,
    jobNo: "",
    size: "",
    productName: "",
    code: "",
    lotNo: "",
    companyRollNo: "",
    dateOfUse: "",
    date: ""
  })

  // Set initial date on mount to avoid hydration mismatch
  useEffect(() => {
    if (isMounted) {
      setFormData(prev => ({ ...prev, date: new Date().toISOString().split('T')[0] }));
    }
  }, [isMounted])

  const adminDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'adminUsers', user.uid);
  }, [firestore, user]);
  const { data: adminData, isLoading: adminLoading } = useDoc(adminDocRef);

  const settingsDocRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'roll_settings', 'global_config');
  }, [firestore]);
  const { data: settings } = useDoc(settingsDocRef);

  const jumboQuery = useMemoFirebase(() => {
    if (!firestore || !user || !adminData) return null;
    return collection(firestore, 'jumbo_stock');
  }, [firestore, user, adminData])

  const suppliersQuery = useMemoFirebase(() => {
    if (!firestore || !user || !adminData) return null;
    return collection(firestore, 'suppliers');
  }, [firestore, user, adminData])

  const materialsQuery = useMemoFirebase(() => {
    if (!firestore || !user || !adminData) return null;
    return collection(firestore, 'materials');
  }, [firestore, user, adminData])

  const { data: jumbos, isLoading } = useCollection(jumboQuery)
  const { data: suppliers } = useCollection(suppliersQuery)
  const { data: materials } = useCollection(materialsQuery)

  // SQM Auto-Calculation
  useEffect(() => {
    if (formData.widthMm > 0 && formData.lengthMeters > 0) {
      setFormData(prev => ({
        ...prev,
        sqm: Number((prev.widthMm * prev.lengthMeters / 1000).toFixed(2))
      }))
    }
  }, [formData.widthMm, formData.lengthMeters])

  const filteredAndSortedJumbos = useMemo(() => {
    if (!jumbos) return [];
    
    let result = [...jumbos];

    // Apply Advanced Filters
    if (filters.rollNo) result = result.filter(j => (j.rollNo || "").toLowerCase().includes(filters.rollNo.toLowerCase()));
    if (filters.paperType !== "all") result = result.filter(j => j.paperType === filters.paperType);
    if (filters.lotNo) result = result.filter(j => (j.lotNo || "").toLowerCase().includes(filters.lotNo.toLowerCase()));
    if (filters.companyRollNo) result = result.filter(j => (j.companyRollNo || "").toLowerCase().includes(filters.companyRollNo.toLowerCase()));
    if (filters.jobNo) result = result.filter(j => (j.jobNo || "").toLowerCase().includes(filters.jobNo.toLowerCase()));
    if (filters.productName) result = result.filter(j => (j.productName || "").toLowerCase().includes(filters.productName.toLowerCase()));
    if (filters.status !== "all") result = result.filter(j => j.status === filters.status);

    // Range Filters
    if (filters.receivedDateStart) result = result.filter(j => j.receivedDate >= filters.receivedDateStart);
    if (filters.receivedDateEnd) result = result.filter(j => j.receivedDate <= filters.receivedDateEnd);
    if (filters.gsmMin) result = result.filter(j => (j.gsm || 0) >= Number(filters.gsmMin));
    if (filters.gsmMax) result = result.filter(j => (j.gsm || 0) <= Number(filters.gsmMax));
    if (filters.widthMin) result = result.filter(j => (j.widthMm || 0) >= Number(filters.widthMin));
    if (filters.widthMax) result = result.filter(j => (j.widthMm || 0) <= Number(filters.widthMax));
    if (filters.rateMin) result = result.filter(j => (j.purchaseRate || 0) >= Number(filters.rateMin));
    if (filters.rateMax) result = result.filter(j => (j.purchaseRate || 0) <= Number(filters.rateMax));

    // Sort Logic
    result.sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];
      if (valA === undefined || valA === null) return 1;
      if (valB === undefined || valB === null) return -1;
      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [jumbos, filters, sortField, sortOrder]);

  const stats = useMemo(() => {
    const totalSqm = filteredAndSortedJumbos.reduce((acc, j) => acc + (Number(j.sqm) || 0), 0)
    const totalWeight = filteredAndSortedJumbos.reduce((acc, j) => acc + (Number(j.weightKg) || 0), 0)
    const totalValue = filteredAndSortedJumbos.reduce((acc, j) => acc + ((Number(j.purchaseRate) || 0) * (Number(j.sqm) || 0)), 0)
    return { count: filteredAndSortedJumbos.length, totalSqm, totalWeight, totalValue }
  }, [filteredAndSortedJumbos])

  const handleExport = () => {
    const data = filteredAndSortedJumbos.map(j => ({
      "RELL NO": j.rollNo,
      "PAPER COMPANY": j.paperCompany,
      "PAPER TYPE": j.paperType,
      "WIDTH (MM)": j.widthMm,
      "LENGTH (MTR)": j.lengthMeters,
      "SQM": j.sqm,
      "GSM": j.gsm,
      "WEIGHT(KG)": j.weightKg,
      "Purchase Rate": j.purchaseRate,
      "WASTAGE": j.wastage,
      "DATE OF RECEIVED": j.receivedDate,
      "Lot no/BATCH NO": j.lotNo,
      "Company Rell no": j.companyRollNo,
      "Status": j.status
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "GRN Registry");
    XLSX.writeFile(wb, `GRN_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast({ title: "Export Complete", description: `Downloaded ${data.length} records.` });
  }

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortOrder('asc'); }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: e.target.type === 'number' ? Number(value) : value }));
  }

  const resetFilters = () => {
    setFilters({
      rollNo: "", paperType: "all", lotNo: "", companyRollNo: "", jobNo: "", productName: "",
      receivedDateStart: "", receivedDateEnd: "", dateOfUseStart: "", dateOfUseEnd: "",
      gsmMin: "", gsmMax: "", widthMin: "", widthMax: "", rateMin: "", rateMax: "", status: "all"
    })
  }

  const handleAddJumbo = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!firestore || !user) return

    setIsGenerating(true)
    const submissionData = new FormData(e.currentTarget)
    const manualRollNo = submissionData.get("manualRollNo") as string;
    
    runTransaction(firestore, async (transaction) => {
      let finalRollNo = "";
      if (isManualId) {
        if (!manualRollNo) throw new Error("RELL NO is required.");
        finalRollNo = manualRollNo;
      } else {
        const counterRef = doc(firestore, 'counters', 'jumbo_roll');
        const counterSnap = await transaction.get(counterRef);
        const currentYear = new Date().getFullYear().toString();
        let currentNumber = 1;
        if (counterSnap.exists()) {
          const data = counterSnap.data();
          if (data.year === currentYear) currentNumber = data.current_number + 1;
        }
        const prefix = settings?.parentPrefix || "TLC-";
        const startNum = Number(settings?.startNumber) || 1000;
        finalRollNo = `${prefix}${startNum + currentNumber}`;
        transaction.set(counterRef, { year: currentYear, current_number: currentNumber }, { merge: true });
      }

      const dupQuery = query(collection(firestore, 'jumbo_stock'), where("rollNo", "==", finalRollNo));
      const dupSnap = await getDocs(dupQuery);
      if (!dupSnap.empty) throw new Error(`RELL NO ${finalRollNo} already exists.`);

      const jumboRef = doc(collection(firestore, 'jumbo_stock'));
      transaction.set(jumboRef, {
        rollNo: finalRollNo,
        paperCompany: submissionData.get("paperCompany") as string,
        paperType: submissionData.get("paperType") as string,
        widthMm: formData.widthMm,
        lengthMeters: formData.lengthMeters,
        sqm: formData.sqm,
        gsm: formData.gsm,
        weightKg: formData.weightKg,
        purchaseRate: formData.purchaseRate,
        wastage: formData.wastage,
        jobNo: formData.jobNo,
        size: formData.size,
        productName: formData.productName,
        code: formData.code,
        lotNo: formData.lotNo,
        companyRollNo: formData.companyRollNo,
        dateOfUse: formData.dateOfUse,
        date: formData.date,
        receivedDate: submissionData.get("receivedDate") || new Date().toISOString(),
        status: "In Stock",
        createdAt: new Date().toISOString(),
        createdById: user.uid
      });
    }).then(() => {
      setIsGenerating(false);
      setIsDialogOpen(false);
      setFormData({ 
        widthMm: 1020, lengthMeters: 0, sqm: 0, gsm: 0, weightKg: 0, purchaseRate: 0, wastage: 0, 
        jobNo: "", size: "", productName: "", code: "", lotNo: "", companyRollNo: "",
        dateOfUse: "", date: new Date().toISOString().split('T')[0]
      });
      toast({ title: "GRN Recorded", description: "Technical stock entry successful." });
    }).catch(async (serverError) => {
      setIsGenerating(false);
      const permissionError = new FirestorePermissionError({
        path: 'jumbo_stock',
        operation: 'create',
      });
      errorEmitter.emit('permission-error', permissionError);
    })
  }

  if (!isMounted) {
    return (
      <div className="flex h-[calc(100vh-10rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!adminData && !adminLoading) {
    return <div className="p-20 text-center text-muted-foreground">Admin access required.</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">GRN (Jumbo Entry)</h2>
          <p className="text-muted-foreground">Pharmaceutical-grade substrate intake and registry.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport}><Download className="mr-2 h-4 w-4" /> Export Excel</Button>
          <Button onClick={() => setIsDialogOpen(true)} className="shadow-lg"><Plus className="mr-2 h-4 w-4" /> New Entry</Button>
        </div>
      </div>

      {/* Summary Stats Bar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-primary/5 border-primary/10">
          <CardContent className="p-4 flex flex-col">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total Rolls</span>
            <span className="text-2xl font-black text-primary">{stats.count}</span>
          </CardContent>
        </Card>
        <Card className="bg-primary/5 border-primary/10">
          <CardContent className="p-4 flex flex-col">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total SQM</span>
            <span className="text-2xl font-black text-primary">{stats.totalSqm.toLocaleString()}</span>
          </CardContent>
        </Card>
        <Card className="bg-primary/5 border-primary/10">
          <CardContent className="p-4 flex flex-col">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total Weight (KG)</span>
            <span className="text-2xl font-black text-primary">{stats.totalWeight.toLocaleString()}</span>
          </CardContent>
        <Card className="bg-primary/5 border-primary/10">
          <CardContent className="p-4 flex flex-col">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Inventory Value</span>
            <span className="text-2xl font-black text-emerald-600">₹{stats.totalValue.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
          </CardContent>
        </Card>
      </div>

      {/* Filter Section */}
      <Card className="border-primary/10 bg-muted/20">
        <CardHeader className="py-3 px-6 flex flex-row items-center justify-between cursor-pointer" onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}>
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Filter className="h-4 w-4 text-primary" /> Advanced Search & Filtering
          </CardTitle>
          {showAdvancedFilters ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </CardHeader>
        {showAdvancedFilters && (
          <CardContent className="px-6 pb-6 pt-0 space-y-6 animate-in fade-in slide-in-from-top-2">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-bold">Roll ID / RELL NO</Label>
                <Input value={filters.rollNo} onChange={e => setFilters({...filters, rollNo: e.target.value})} placeholder="Search ID..." />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-bold">Paper Type</Label>
                <Select value={filters.paperType} onValueChange={val => setFilters({...filters, paperType: val})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {materials?.map(m => <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-bold">Lot / Batch No</Label>
                <Input value={filters.lotNo} onChange={e => setFilters({...filters, lotNo: e.target.value})} placeholder="Search Lot..." />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-bold">Company Roll No</Label>
                <Input value={filters.companyRollNo} onChange={e => setFilters({...filters, companyRollNo: e.target.value})} placeholder="Search MFR Roll..." />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-bold">Received Date Range</Label>
                <div className="flex gap-2">
                  <Input type="date" value={filters.receivedDateStart} onChange={e => setFilters({...filters, receivedDateStart: e.target.value})} className="h-8 text-[10px]" />
                  <Input type="date" value={filters.receivedDateEnd} onChange={e => setFilters({...filters, receivedDateEnd: e.target.value})} className="h-8 text-[10px]" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-bold">GSM Range</Label>
                <div className="flex gap-2">
                  <Input placeholder="Min" value={filters.gsmMin} onChange={e => setFilters({...filters, gsmMin: e.target.value})} className="h-8 text-[10px]" />
                  <Input placeholder="Max" value={filters.gsmMax} onChange={e => setFilters({...filters, gsmMax: e.target.value})} className="h-8 text-[10px]" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-bold">Width (mm) Range</Label>
                <div className="flex gap-2">
                  <Input placeholder="Min" value={filters.widthMin} onChange={e => setFilters({...filters, widthMin: e.target.value})} className="h-8 text-[10px]" />
                  <Input placeholder="Max" value={filters.widthMax} onChange={e => setFilters({...filters, widthMax: e.target.value})} className="h-8 text-[10px]" />
                </div>
              </div>
              <div className="flex items-end gap-2">
                <Button variant="outline" onClick={resetFilters} className="w-full"><FilterX className="mr-2 h-4 w-4" /> Reset</Button>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[900px] max-h-[95vh] overflow-y-auto">
          <form onSubmit={handleAddJumbo}>
            <DialogHeader>
              <DialogTitle>Substrate Technical Intake (19 Columns)</DialogTitle>
              <DialogDescription>Full ERP technical entry for substrate rolls.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-6 py-4">
              <div className="flex items-center justify-between p-4 bg-primary/5 rounded-lg border border-primary/10">
                <div className="flex items-center gap-2">
                  <Hash className="h-5 w-5 text-primary" />
                  <div>
                    <Label className="font-bold text-base">RELL NO Identification</Label>
                    <p className="text-[10px] text-muted-foreground uppercase font-medium">Internal Master Serial</p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-muted-foreground">AUTO</span>
                    <Switch checked={isManualId} onCheckedChange={setIsManualId} />
                    <span className="text-[10px] font-bold text-primary">MANUAL</span>
                  </div>
                  {isManualId ? (
                    <Input id="manualRollNo" name="manualRollNo" placeholder="VEN-001" className="w-40 h-10 font-bold" required />
                  ) : (
                    <div className="px-4 py-2 bg-background border rounded-md font-mono font-bold text-primary shadow-inner">
                      {settings?.parentPrefix || "TLC-"}1XXX
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label className="text-[11px] font-bold text-primary">PAPER COMPANY</Label>
                  <Select name="paperCompany" required>
                    <SelectTrigger className="h-10"><SelectValue placeholder="Select Vendor" /></SelectTrigger>
                    <SelectContent>
                      {suppliers?.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[11px] font-bold text-primary">PAPER TYPE</Label>
                  <Select name="paperType" required>
                    <SelectTrigger className="h-10"><SelectValue placeholder="Select Type" /></SelectTrigger>
                    <SelectContent>
                      {materials?.map(m => <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[11px] font-bold text-primary">DATE OF RECEIVED</Label>
                  <Input name="receivedDate" type="date" defaultValue={new Date().toISOString().split('T')[0]} required />
                </div>
              </div>

              <div className="bg-muted/30 p-5 rounded-lg border border-border/50 space-y-5">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold uppercase">Lot no / BATCH NO</Label>
                    <Input name="lotNo" value={formData.lotNo} onChange={handleInputChange} required />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold uppercase">Company Roll no</Label>
                    <Input name="companyRollNo" value={formData.companyRollNo} onChange={handleInputChange} required />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold uppercase">PRODUCT NAME</Label>
                    <Input name="productName" value={formData.productName} onChange={handleInputChange} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold uppercase">Code</Label>
                    <Input name="code" value={formData.code} onChange={handleInputChange} />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold uppercase">WIDTH (MM)</Label>
                  <Input name="widthMm" type="number" value={formData.widthMm} onChange={handleInputChange} className="font-bold" required />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold uppercase">LENGTH (MTR)</Label>
                  <Input name="lengthMeters" type="number" value={formData.lengthMeters} onChange={handleInputChange} className="font-bold" required />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold uppercase text-primary">SQM (AUTO-CALC)</Label>
                  <div className="h-10 px-3 flex items-center bg-primary/5 border-2 border-primary/20 rounded-md font-black text-primary">
                    {formData.sqm}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold uppercase">GSM</Label>
                  <Input name="gsm" type="number" value={formData.gsm} onChange={handleInputChange} required />
                </div>
              </div>
            </div>
            <DialogFooter className="pt-4 border-t">
              <Button variant="ghost" type="button" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button type="submit" className="h-12 px-10 text-lg font-bold bg-primary" disabled={isGenerating}>Complete GRN</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Card className="shadow-2xl border-none">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="min-w-[2400px]">
              <TableHeader className="sticky top-0 bg-background z-20 shadow-sm">
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="w-[80px] text-center font-black sticky left-0 bg-muted/50 border-r">PRINT</TableHead>
                  <TableHead className="cursor-pointer font-black text-primary sticky left-[80px] bg-muted/50 border-r z-10" onClick={() => toggleSort('rollNo')}>
                    <div className="flex items-center gap-1">RELL NO {sortField === 'rollNo' ? (sortOrder === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-20" />}</div>
                  </TableHead>
                  <TableHead className="font-black">PAPER COMPANY</TableHead>
                  <TableHead className="font-black">PAPER TYPE</TableHead>
                  <TableHead className="font-black">WIDTH (MM)</TableHead>
                  <TableHead className="font-black">LENGTH (MTR)</TableHead>
                  <TableHead className="cursor-pointer font-black text-primary" onClick={() => toggleSort('sqm')}>
                    <div className="flex items-center gap-1">SQM {sortField === 'sqm' ? (sortOrder === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-20" />}</div>
                  </TableHead>
                  <TableHead className="cursor-pointer font-black text-primary" onClick={() => toggleSort('gsm')}>
                    <div className="flex items-center gap-1">GSM {sortField === 'gsm' ? (sortOrder === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-20" />}</div>
                  </TableHead>
                  <TableHead className="cursor-pointer font-black text-primary" onClick={() => toggleSort('weightKg')}>
                    <div className="flex items-center gap-1">WEIGHT(KG) {sortField === 'weightKg' ? (sortOrder === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-20" />}</div>
                  </TableHead>
                  <TableHead className="cursor-pointer font-black text-primary" onClick={() => toggleSort('purchaseRate')}>
                    <div className="flex items-center gap-1">Purchase Rate {sortField === 'purchaseRate' ? (sortOrder === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-20" />}</div>
                  </TableHead>
                  <TableHead className="font-black">WASTAGE</TableHead>
                  <TableHead className="cursor-pointer font-black text-primary" onClick={() => toggleSort('receivedDate')}>
                    <div className="flex items-center gap-1">RECEIVED {sortField === 'receivedDate' ? (sortOrder === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-20" />}</div>
                  </TableHead>
                  <TableHead className="font-black">LOT NO</TableHead>
                  <TableHead className="font-black">MFR ROLL NO</TableHead>
                  <TableHead className="font-black">STATUS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={15} className="text-center py-20"><Loader2 className="h-10 w-10 animate-spin mx-auto text-primary" /></TableCell></TableRow>
                ) : filteredAndSortedJumbos.map((j) => (
                  <TableRow key={j.id} className="hover:bg-primary/5 transition-colors group">
                    <TableCell className="text-center sticky left-0 bg-background border-r z-10"><Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => window.print()}><Printer className="h-4 w-4" /></Button></TableCell>
                    <TableCell className="font-black text-primary sticky left-[80px] bg-background border-r z-10 font-mono">{j.rollNo}</TableCell>
                    <TableCell>{j.paperCompany}</TableCell>
                    <TableCell><Badge variant="outline" className="font-bold bg-white">{j.paperType}</Badge></TableCell>
                    <TableCell className="font-mono">{j.widthMm}mm</TableCell>
                    <TableCell className="font-mono">{j.lengthMeters}m</TableCell>
                    <TableCell className="font-black text-primary">{j.sqm}</TableCell>
                    <TableCell>{j.gsm}</TableCell>
                    <TableCell className="font-bold">{j.weightKg}kg</TableCell>
                    <TableCell className="text-emerald-700 font-bold">₹{j.purchaseRate?.toLocaleString() || '0'}</TableCell>
                    <TableCell>{j.wastage}%</TableCell>
                    <TableCell className="text-xs font-bold text-muted-foreground">{new Date(j.receivedDate).toLocaleDateString()}</TableCell>
                    <TableCell className="text-xs">{j.lotNo || '-'}</TableCell>
                    <TableCell className="text-xs">{j.companyRollNo || '-'}</TableCell>
                    <TableCell><Badge className={j.status === 'In Stock' ? 'bg-emerald-500' : 'bg-amber-500'}>{j.status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
