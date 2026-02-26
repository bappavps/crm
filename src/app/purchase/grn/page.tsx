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
import { Plus, Loader2, Printer, Search, ArrowUpDown, FilterX, ArrowUp, ArrowDown, Hash, Info, Calendar } from "lucide-react"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog"
import { useFirestore, useUser, useCollection, useMemoFirebase, useDoc } from "@/firebase"
import { collection, doc, runTransaction, query, where, getDocs } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"

type SortField = 'rollNo' | 'receivedDate' | 'weightKg' | 'sqm' | 'paperCompany' | 'paperType';
type SortOrder = 'asc' | 'desc';

export default function GRNPage() {
  const { toast } = useToast()
  const { user } = useUser()
  const firestore = useFirestore()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isManualId, setIsManualId] = useState(false)
  
  const [searchQuery, setSearchQuery] = useState("")
  const [companyFilter, setCompanyFilter] = useState("all")
  const [typeFilter, setTypeFilter] = useState("all")
  const [sortField, setSortField] = useState<SortField>('receivedDate')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')

  // Expanded State for all 19 Fields
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
    date: new Date().toISOString().split('T')[0]
  })

  const adminDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'adminUsers', user.uid);
  }, [firestore, user]);
  const { data: adminData } = useDoc(adminDocRef);

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
    let result = jumbos.filter(j => j.status === 'In Stock' || j.status === 'Available');
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(j => 
        (j.rollNo || "").toLowerCase().includes(q) || 
        (j.productName || "").toLowerCase().includes(q) ||
        (j.lotNo || "").toLowerCase().includes(q)
      );
    }
    if (companyFilter !== "all") result = result.filter(j => j.paperCompany === companyFilter);
    if (typeFilter !== "all") result = result.filter(j => j.paperType === typeFilter);

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
  }, [jumbos, searchQuery, companyFilter, typeFilter, sortField, sortOrder]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortOrder('asc'); }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: e.target.type === 'number' ? Number(value) : value }));
  }

  const handleAddJumbo = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!firestore || !user) return

    setIsGenerating(true)
    const submissionData = new FormData(e.currentTarget)
    const manualRollNo = submissionData.get("manualRollNo") as string;
    
    try {
      await runTransaction(firestore, async (transaction) => {
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
      });

      setIsDialogOpen(false);
      setFormData({ 
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
        date: new Date().toISOString().split('T')[0]
      });
      toast({ title: "GRN Recorded", description: "Technical stock entry successful." });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setIsGenerating(false);
    }
  }

  if (!adminData && !isLoading) {
    return <div className="p-20 text-center text-muted-foreground">Admin access required to view technical stock logs.</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">GRN (Jumbo Entry)</h2>
          <p className="text-muted-foreground">Comprehensive substrate intake with pharmaceutical traceability (Full ERP Schema).</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)} className="shadow-lg">
          <Plus className="mr-2 h-4 w-4" /> New Technical Entry
        </Button>
      </div>

      <Card className="border-primary/10 bg-muted/20">
        <CardContent className="pt-6 pb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase">Search Registry</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="RELL NO, Product, Lot..." className="pl-8 bg-background" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase">Paper Company</Label>
              <Select value={companyFilter} onValueChange={setCompanyFilter}>
                <SelectTrigger className="bg-background"><SelectValue placeholder="All Companies" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Companies</SelectItem>
                  {suppliers?.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" onClick={() => { setSearchQuery(""); setCompanyFilter("all"); setTypeFilter("all"); }}>
              <FilterX className="mr-2 h-4 w-4" /> Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[900px] max-h-[95vh] overflow-y-auto">
          <form onSubmit={handleAddJumbo}>
            <DialogHeader>
              <DialogTitle>Substrate Technical Intake (19 Columns)</DialogTitle>
              <DialogDescription>Enter full pharmaceutical parameters for incoming rolls to ensure supply chain integrity.</DialogDescription>
            </DialogHeader>
            
            <div className="grid gap-6 py-4">
              {/* ID SECTION */}
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

              {/* CORE DETAILS SECTION */}
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
                  <div className="relative">
                    <Calendar className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input name="receivedDate" type="date" className="pl-10" defaultValue={new Date().toISOString().split('T')[0]} required />
                  </div>
                </div>
              </div>

              <Separator />

              {/* PHARMA TRACEABILITY SECTION */}
              <div className="bg-muted/30 p-5 rounded-lg border border-border/50 space-y-5">
                <div className="flex items-center gap-2 text-xs font-black uppercase text-muted-foreground tracking-tighter">
                  <Info className="h-4 w-4" /> Traceability Mapping & Pharma Registry
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold uppercase">Lot no / BATCH NO</Label>
                    <Input name="lotNo" value={formData.lotNo} onChange={handleInputChange} placeholder="LOT-9988" className="bg-background h-9" required />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold uppercase">Company Roll no</Label>
                    <Input name="companyRollNo" value={formData.companyRollNo} onChange={handleInputChange} placeholder="MFR-001" className="bg-background h-9" required />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold uppercase">PRODUCT NAME</Label>
                    <Input name="productName" value={formData.productName} onChange={handleInputChange} placeholder="Fasson Chromo" className="bg-background h-9" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold uppercase">Code</Label>
                    <Input name="code" value={formData.code} onChange={handleInputChange} placeholder="AW0331" className="bg-background h-9" />
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold uppercase">Job no</Label>
                    <Input name="jobNo" value={formData.jobNo} onChange={handleInputChange} placeholder="Ref Job #" className="bg-background h-9" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold uppercase">SIZE (Label Size)</Label>
                    <Input name="size" value={formData.size} onChange={handleInputChange} placeholder="e.g. 50x100" className="bg-background h-9" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold uppercase">Date (In-File Date)</Label>
                    <Input name="date" type="date" value={formData.date} onChange={handleInputChange} className="bg-background h-9" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold uppercase">DATE OF USE</Label>
                    <Input name="dateOfUse" type="date" value={formData.dateOfUse} onChange={handleInputChange} className="bg-background h-9" />
                  </div>
                </div>
              </div>

              {/* PHYSICAL PARAMETERS SECTION */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold uppercase">WIDTH (MM)</Label>
                  <Input name="widthMm" type="number" value={formData.widthMm} onChange={handleInputChange} className="h-10 text-lg font-bold" required />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold uppercase">LENGTH (MTR)</Label>
                  <Input name="lengthMeters" type="number" value={formData.lengthMeters} onChange={handleInputChange} className="h-10 text-lg font-bold" required />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold uppercase text-primary">SQM (AUTO-CALC)</Label>
                  <div className="h-10 px-3 flex items-center bg-primary/5 border-2 border-primary/20 rounded-md font-black text-primary text-xl">
                    {formData.sqm}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold uppercase">GSM</Label>
                  <Input name="gsm" type="number" value={formData.gsm} onChange={handleInputChange} className="h-10" required />
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold uppercase">WEIGHT (KG)</Label>
                  <Input name="weightKg" type="number" value={formData.weightKg} onChange={handleInputChange} className="h-10" required />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold uppercase">Purchase Rate (₹ / Unit)</Label>
                  <Input name="purchaseRate" type="number" step="0.01" value={formData.purchaseRate} onChange={handleInputChange} className="h-10" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold uppercase">WASTAGE (%)</Label>
                  <Input name="wastage" type="number" value={formData.wastage} onChange={handleInputChange} className="h-10" />
                </div>
              </div>
            </div>

            <DialogFooter className="pt-4 border-t">
              <Button variant="ghost" type="button" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button type="submit" className="h-12 px-10 text-lg font-bold shadow-xl bg-primary hover:bg-primary/90" disabled={isGenerating}>
                {isGenerating ? <Loader2 className="animate-spin mr-2" /> : <Plus className="mr-2 h-5 w-5" />}
                Complete Technical GRN
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Card className="shadow-2xl border-none">
        <CardHeader className="border-b pb-4">
          <CardTitle className="text-xl flex items-center gap-2 text-primary">
            <Info className="h-6 w-6" /> Technical Stock Registry
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-primary/20">
            <Table className="min-w-[2400px]">
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="w-[80px] text-center font-black sticky left-0 bg-muted/50 border-r">PRINT</TableHead>
                  <TableHead className="cursor-pointer font-black text-primary sticky left-[80px] bg-muted/50 border-r z-10" onClick={() => toggleSort('rollNo')}>
                    <div className="flex items-center gap-1">RELL NO {sortField === 'rollNo' ? (sortOrder === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-20" />}</div>
                  </TableHead>
                  <TableHead className="font-black">PAPER COMPANY</TableHead>
                  <TableHead className="font-black">PAPER TYPE</TableHead>
                  <TableHead className="font-black">WIDTH (MM)</TableHead>
                  <TableHead className="font-black">LENGTH (MTR)</TableHead>
                  <TableHead className="font-black text-primary">SQM</TableHead>
                  <TableHead className="font-black">GSM</TableHead>
                  <TableHead className="font-black">WEIGHT(KG)</TableHead>
                  <TableHead className="font-black text-emerald-600">Purchase Rate</TableHead>
                  <TableHead className="font-black text-red-600">WASTAGE</TableHead>
                  <TableHead className="font-black">DATE OF USE</TableHead>
                  <TableHead className="font-black">DATE OF RECEIVED</TableHead>
                  <TableHead className="font-black">Job no</TableHead>
                  <TableHead className="font-black">SIZE</TableHead>
                  <TableHead className="font-black">PRODUCT NAME</TableHead>
                  <TableHead className="font-black">Code</TableHead>
                  <TableHead className="font-black">Lot no/BATCH NO</TableHead>
                  <TableHead className="font-black">Date</TableHead>
                  <TableHead className="font-black">Company Rell no</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={20} className="text-center py-20"><Loader2 className="h-10 w-10 animate-spin mx-auto text-primary" /></TableCell></TableRow>
                ) : filteredAndSortedJumbos.map((j) => (
                  <TableRow key={j.id} className="hover:bg-primary/5 transition-colors group">
                    <TableCell className="text-center sticky left-0 bg-background border-r z-10">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-primary group-hover:scale-110 transition-transform" onClick={() => window.print()}><Printer className="h-4 w-4" /></Button>
                    </TableCell>
                    <TableCell className="font-black text-primary sticky left-[80px] bg-background border-r z-10 font-mono">{j.rollNo}</TableCell>
                    <TableCell className="font-medium">{j.paperCompany}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-bold bg-white">{j.paperType}</Badge>
                    </TableCell>
                    <TableCell className="font-mono">{j.widthMm}mm</TableCell>
                    <TableCell className="font-mono">{j.lengthMeters}m</TableCell>
                    <TableCell className="font-black text-primary">{j.sqm}</TableCell>
                    <TableCell>{j.gsm}</TableCell>
                    <TableCell className="font-bold">{j.weightKg}kg</TableCell>
                    <TableCell className="text-emerald-700 font-bold">₹{j.purchaseRate?.toLocaleString() || '0'}</TableCell>
                    <TableCell className="text-red-600 font-bold">{j.wastage}%</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{j.dateOfUse || '-'}</TableCell>
                    <TableCell className="text-xs font-bold text-muted-foreground">{new Date(j.receivedDate).toLocaleDateString()}</TableCell>
                    <TableCell className="text-xs font-mono">{j.jobNo || '-'}</TableCell>
                    <TableCell className="text-xs">{j.size || '-'}</TableCell>
                    <TableCell className="text-xs truncate max-w-[150px]">{j.productName || '-'}</TableCell>
                    <TableCell className="text-xs font-mono">{j.code || '-'}</TableCell>
                    <TableCell className="text-xs font-black text-muted-foreground">{j.lotNo || '-'}</TableCell>
                    <TableCell className="text-xs">{j.date || '-'}</TableCell>
                    <TableCell className="text-xs font-bold text-primary">{j.companyRollNo || '-'}</TableCell>
                  </TableRow>
                ))}
                {filteredAndSortedJumbos.length === 0 && !isLoading && (
                  <TableRow>
                    <TableCell colSpan={20} className="text-center py-40 text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <Search className="h-12 w-12 opacity-10" />
                        <p className="font-black text-lg">No Technical Stock Found</p>
                        <p className="text-sm">Initialize a new GRN entry or adjust your filters.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
