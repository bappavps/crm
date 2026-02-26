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
import { Plus, Loader2, Printer, Search, ArrowUpDown, FilterX, ArrowUp, ArrowDown, Hash, Info } from "lucide-react"
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
    companyRollNo: ""
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
    let result = jumbos.filter(j => j.status === 'In Stock');
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
          receivedDate: submissionData.get("receivedDate") || new Date().toISOString(),
          status: "In Stock",
          createdAt: new Date().toISOString(),
          createdById: user.uid
        });
      });

      setIsDialogOpen(false);
      setFormData({ widthMm: 1020, lengthMeters: 0, sqm: 0, gsm: 0, weightKg: 0, purchaseRate: 0, wastage: 0, jobNo: "", size: "", productName: "", code: "", lotNo: "", companyRollNo: "" });
      toast({ title: "GRN Recorded", description: "Technical stock entry successful." });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">GRN (Jumbo Entry)</h2>
          <p className="text-muted-foreground">Comprehensive substrate intake with pharmaceutical traceability.</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}><Plus className="mr-2 h-4 w-4" /> New Technical Entry</Button>
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
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleAddJumbo}>
            <DialogHeader>
              <DialogTitle>Substrate Technical Intake</DialogTitle>
              <DialogDescription>Enter full pharmaceutical parameters for incoming rolls.</DialogDescription>
            </DialogHeader>
            
            <div className="grid gap-6 py-4">
              {/* ID SECTION */}
              <div className="flex items-center justify-between p-3 bg-primary/5 rounded-lg border border-primary/10">
                <div className="flex items-center gap-2">
                  <Hash className="h-4 w-4 text-primary" />
                  <Label className="font-bold">RELL NO Identification</Label>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold">AUTO</span>
                    <Switch checked={isManualId} onCheckedChange={setIsManualId} />
                    <span className="text-[10px] font-bold">MANUAL</span>
                  </div>
                  {isManualId ? (
                    <Input id="manualRollNo" name="manualRollNo" placeholder="VEN-001" className="w-32 h-8" required />
                  ) : (
                    <Badge className="bg-primary/20 text-primary border-primary/20">{settings?.parentPrefix || "TLC-"}1XXX</Badge>
                  )}
                </div>
              </div>

              {/* CORE DETAILS */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>PAPER COMPANY</Label>
                  <Select name="paperCompany" required>
                    <SelectTrigger><SelectValue placeholder="Select Vendor" /></SelectTrigger>
                    <SelectContent>
                      {suppliers?.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>PAPER TYPE</Label>
                  <Select name="paperType" required>
                    <SelectTrigger><SelectValue placeholder="Select Type" /></SelectTrigger>
                    <SelectContent>
                      {materials?.map(m => <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>DATE OF RECEIVED</Label>
                  <Input name="receivedDate" type="date" defaultValue={new Date().toISOString().split('T')[0]} required />
                </div>
              </div>

              <Separator />

              {/* PHARMA TRACEABILITY */}
              <div className="bg-muted/30 p-4 rounded-lg space-y-4">
                <div className="flex items-center gap-2 text-xs font-bold uppercase text-muted-foreground">
                  <Info className="h-3 w-3" /> Traceability Mapping
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <Label className="text-[10px]">Lot no/BATCH NO</Label>
                    <Input name="lotNo" value={formData.lotNo} onChange={handleInputChange} placeholder="LOT-XYZ" required />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px]">Company Rell no</Label>
                    <Input name="companyRollNo" value={formData.companyRollNo} onChange={handleInputChange} placeholder="MFR-ROLL" required />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px]">PRODUCT NAME</Label>
                    <Input name="productName" value={formData.productName} onChange={handleInputChange} placeholder="Fasson Chromo" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px]">Code</Label>
                    <Input name="code" value={formData.code} onChange={handleInputChange} placeholder="AW0331" />
                  </div>
                </div>
              </div>

              {/* PHYSICAL PARAMETERS */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <Label className="text-[10px]">WIDTH (MM)</Label>
                  <Input name="widthMm" type="number" value={formData.widthMm} onChange={handleInputChange} required />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]">LENGTH (MTR)</Label>
                  <Input name="lengthMeters" type="number" value={formData.lengthMeters} onChange={handleInputChange} required />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]">SQM (AUTO)</Label>
                  <Input name="sqm" type="number" value={formData.sqm} readOnly className="bg-muted" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]">GSM</Label>
                  <Input name="gsm" type="number" value={formData.gsm} onChange={handleInputChange} required />
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <Label className="text-[10px]">WEIGHT(KG)</Label>
                  <Input name="weightKg" type="number" value={formData.weightKg} onChange={handleInputChange} required />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]">Purchase Rate (₹)</Label>
                  <Input name="purchaseRate" type="number" value={formData.purchaseRate} onChange={handleInputChange} />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]">WASTAGE (%)</Label>
                  <Input name="wastage" type="number" value={formData.wastage} onChange={handleInputChange} />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]">Job no</Label>
                  <Input name="jobNo" value={formData.jobNo} onChange={handleInputChange} placeholder="Ref Job" />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="submit" className="w-full h-12 text-lg" disabled={isGenerating}>
                {isGenerating ? <Loader2 className="animate-spin mr-2" /> : "Complete Stock GRN"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="min-w-[1400px]">
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[80px] text-center font-bold">PRINT</TableHead>
                  <TableHead className="cursor-pointer font-bold" onClick={() => toggleSort('rollNo')}>
                    <div className="flex items-center gap-1">RELL NO {sortField === 'rollNo' ? (sortOrder === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-20" />}</div>
                  </TableHead>
                  <TableHead className="font-bold">LOT/BATCH</TableHead>
                  <TableHead className="font-bold">COMPANY</TableHead>
                  <TableHead className="font-bold">TYPE</TableHead>
                  <TableHead className="font-bold">WIDTH</TableHead>
                  <TableHead className="font-bold">LENGTH</TableHead>
                  <TableHead className="font-bold">SQM</TableHead>
                  <TableHead className="font-bold">WEIGHT</TableHead>
                  <TableHead className="font-bold">DATE</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={10} className="text-center py-10"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></TableCell></TableRow>
                ) : filteredAndSortedJumbos.map((j) => (
                  <TableRow key={j.id}>
                    <TableCell className="text-center">
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-primary" onClick={() => window.print()}><Printer className="h-4 w-4" /></Button>
                    </TableCell>
                    <TableCell className="font-bold text-primary">{j.rollNo}</TableCell>
                    <TableCell className="text-xs font-mono">{j.lotNo}</TableCell>
                    <TableCell>{j.paperCompany}</TableCell>
                    <TableCell>{j.paperType}</TableCell>
                    <TableCell>{j.widthMm}mm</TableCell>
                    <TableCell>{j.lengthMeters}m</TableCell>
                    <TableCell className="font-bold">{j.sqm}</TableCell>
                    <TableCell>{j.weightKg}kg</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(j.receivedDate).toLocaleDateString()}</TableCell>
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
