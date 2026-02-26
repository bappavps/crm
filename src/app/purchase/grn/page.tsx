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
import { Plus, Loader2, ClipboardCheck, Printer, Search, ArrowUpDown, FilterX, ArrowUp, ArrowDown, Settings2, Trash2, Hash } from "lucide-react"
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
import { addDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase/non-blocking-updates"
import { useToast } from "@/hooks/use-toast"

type SortField = 'rollNo' | 'receivedDate' | 'weightKg' | 'sqm' | 'paperCompany' | 'paperType';
type SortOrder = 'asc' | 'desc';

export default function GRNPage() {
  const { toast } = useToast()
  const { user } = useUser()
  const firestore = useFirestore()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isSupplierManageOpen, setIsSupplierManageOpen] = useState(false)
  const [isMaterialManageOpen, setIsMaterialManageOpen] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isManualId, setIsManualId] = useState(false)
  
  // Management States
  const [newSupplierName, setNewSupplierName] = useState("")
  const [newMaterialName, setNewMaterialName] = useState("")
  const [newMaterialGsm, setNewMaterialGsm] = useState("")

  // Filtering & Sorting State
  const [searchQuery, setSearchQuery] = useState("")
  const [companyFilter, setCompanyFilter] = useState("all")
  const [typeFilter, setTypeFilter] = useState("all")
  const [sortField, setSortField] = useState<SortField>('receivedDate')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')

  // State for calculations
  const [formData, setFormData] = useState({
    widthMm: 1020,
    weightKg: 0,
    gsm: 0,
    lengthMeters: 0,
    sqm: 0
  })

  // Authorization check
  const adminDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'adminUsers', user.uid);
  }, [firestore, user]);
  const { data: adminData } = useDoc(adminDocRef);

  // Roll Settings
  const settingsDocRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'roll_settings', 'global_config');
  }, [firestore]);
  const { data: settings } = useDoc(settingsDocRef);

  // Firestore Queries
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

  // Auto-calculation logic
  useEffect(() => {
    if (formData.weightKg > 0 && formData.gsm > 0 && formData.widthMm > 0) {
      const calculatedSqm = formData.weightKg / (formData.gsm / 1000)
      const calculatedLength = calculatedSqm / (formData.widthMm / 1000)
      
      setFormData(prev => ({
        ...prev,
        sqm: Number(calculatedSqm.toFixed(2)),
        lengthMeters: Number(calculatedLength.toFixed(2))
      }))
    }
  }, [formData.weightKg, formData.gsm, formData.widthMm])

  // Filter & Sort Logic
  const filteredAndSortedJumbos = useMemo(() => {
    if (!jumbos) return [];

    let result = jumbos.filter(j => j.status === 'In Stock');

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(j => 
        (j.rollNo || "").toLowerCase().includes(q) || 
        (j.companyRollNo || "").toLowerCase().includes(q) ||
        (j.productName || "").toLowerCase().includes(q)
      );
    }

    if (companyFilter !== "all") {
      result = result.filter(j => j.paperCompany === companyFilter);
    }

    if (typeFilter !== "all") {
      result = result.filter(j => j.paperType === typeFilter);
    }

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

  const uniqueCompanies = useMemo(() => {
    const companies = jumbos?.filter(j => j.status === 'In Stock').map(j => j.paperCompany) || [];
    return Array.from(new Set(companies)).filter(Boolean);
  }, [jumbos]);

  const uniqueTypes = useMemo(() => {
    const types = jumbos?.filter(j => j.status === 'In Stock').map(j => j.paperType) || [];
    return Array.from(new Set(types)).filter(Boolean);
  }, [jumbos]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: Number(value)
    }))
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
          if (!manualRollNo) throw new Error("Manual Roll Number is required.");
          finalRollNo = manualRollNo;
        } else {
          // Atomic Auto ID
          const settingsRef = doc(firestore, 'roll_settings', 'global_config');
          const counterRef = doc(firestore, 'counters', 'jumbo_roll');
          
          const settingsSnap = await transaction.get(settingsRef);
          const counterSnap = await transaction.get(counterRef);

          const currentSettings = settingsSnap.exists() ? settingsSnap.data() : { parentPrefix: "TLC-", startNumber: 1000 };
          let currentNumber = 1;
          const currentYear = new Date().getFullYear().toString();

          if (counterSnap.exists()) {
            const counterData = counterSnap.data();
            if (counterData.year === currentYear) {
              currentNumber = counterData.current_number + 1;
            }
          }

          const prefix = currentSettings.parentPrefix || "TLC-";
          const startNum = Number(currentSettings.startNumber) || 1000;
          finalRollNo = `${prefix}${startNum + currentNumber}`;

          // Update counter
          transaction.set(counterRef, {
            prefix: prefix,
            year: currentYear,
            current_number: currentNumber
          }, { merge: true });
        }

        // Uniqueness check
        const dupQuery = query(collection(firestore, 'jumbo_stock'), where("rollNo", "==", finalRollNo));
        const dupSnap = await getDocs(dupQuery);
        if (!dupSnap.empty) throw new Error(`Roll Number ${finalRollNo} already exists.`);

        const jumboRef = doc(collection(firestore, 'jumbo_stock'));
        transaction.set(jumboRef, {
          rollNo: finalRollNo,
          barcode: finalRollNo,
          companyRollNo: submissionData.get("companyRollNo") as string,
          paperCompany: submissionData.get("paperCompany") as string,
          paperType: submissionData.get("paperType") as string,
          widthMm: formData.widthMm,
          lengthMeters: formData.lengthMeters,
          sqm: formData.sqm,
          gsm: formData.gsm,
          weightKg: formData.weightKg,
          purchaseRate: Number(submissionData.get("purchaseRate")),
          receivedDate: submissionData.get("receivedDate") as string || new Date().toISOString(),
          status: "In Stock",
          createdAt: new Date().toISOString(),
          createdById: user.uid
        });
      });

      setIsDialogOpen(false);
      setFormData({ widthMm: 1020, weightKg: 0, gsm: 0, lengthMeters: 0, sqm: 0 });
      toast({ title: "GRN Recorded", description: "Jumbo Roll registered successfully." });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Registration Failed", description: error.message });
    } finally {
      setIsGenerating(false);
    }
  }

  const handleAddSupplier = () => {
    if (!firestore || !newSupplierName.trim()) return
    addDocumentNonBlocking(collection(firestore, 'suppliers'), { 
      id: crypto.randomUUID(), 
      name: newSupplierName.trim(),
      createdAt: new Date().toISOString()
    })
    setNewSupplierName("");
  }

  const handleAddMaterial = () => {
    if (!firestore || !newMaterialName.trim()) return
    addDocumentNonBlocking(collection(firestore, 'materials'), { 
      id: crypto.randomUUID(), 
      name: newMaterialName.trim(), 
      gsm: Number(newMaterialGsm) || 0,
      createdAt: new Date().toISOString()
    })
    setNewMaterialName("");
    setNewMaterialGsm("");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">GRN (Jumbo Entry)</h2>
          <p className="text-muted-foreground">Comprehensive raw material tracking and stock filters.</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}><Plus className="mr-2 h-4 w-4" /> New Jumbo Entry</Button>
      </div>

      <Card className="border-primary/10 bg-muted/20">
        <CardContent className="pt-6 pb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase">Search Registry</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Roll No, Product..." className="pl-8 bg-background" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase">Paper Company</Label>
              <Select value={companyFilter} onValueChange={setCompanyFilter}>
                <SelectTrigger className="bg-background"><SelectValue placeholder="All Companies" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Companies</SelectItem>
                  {uniqueCompanies.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase">Paper Type</Label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="bg-background"><SelectValue placeholder="All Types" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {uniqueTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
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
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleAddJumbo}>
            <DialogHeader>
              <DialogTitle>Jumbo Roll Inventory Intake</DialogTitle>
              <DialogDescription>Full technical entry for incoming substrate rolls.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-6 py-4">
              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-primary/10">
                <div className="space-y-0.5">
                  <Label className="text-sm font-bold flex items-center gap-2">
                    <Hash className="h-4 w-4 text-primary" /> Roll ID Logic
                  </Label>
                  <p className="text-[10px] text-muted-foreground">Toggle between Auto-Generated or Custom Roll ID.</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold ${!isManualId ? 'text-primary' : 'text-muted-foreground'}`}>AUTO</span>
                  <Switch checked={isManualId} onCheckedChange={setIsManualId} />
                  <span className={`text-[10px] font-bold ${isManualId ? 'text-primary' : 'text-muted-foreground'}`}>MANUAL</span>
                </div>
              </div>

              {isManualId ? (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                  <Label htmlFor="manualRollNo">Custom Roll Number</Label>
                  <Input id="manualRollNo" name="manualRollNo" placeholder="e.g. VEN-9901" required />
                </div>
              ) : (
                <div className="p-4 bg-primary/5 rounded-lg border border-primary/20 text-center">
                  <p className="text-[10px] text-primary font-bold uppercase mb-1">Assigned ID Pattern</p>
                  <p className="text-xl font-black text-primary tracking-tighter">
                    {settings?.parentPrefix || "TLC-"}1XXX
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="paperCompany">Paper Company</Label>
                    <Button type="button" variant="ghost" size="icon" className="h-4 w-4" onClick={() => setIsSupplierManageOpen(true)}><Settings2 className="h-3 w-3" /></Button>
                  </div>
                  <Select name="paperCompany" required>
                    <SelectTrigger><SelectValue placeholder="Select Vendor" /></SelectTrigger>
                    <SelectContent>
                      {suppliers?.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="paperType">Paper Type</Label>
                    <Button type="button" variant="ghost" size="icon" className="h-4 w-4" onClick={() => setIsMaterialManageOpen(true)}><Settings2 className="h-3 w-3" /></Button>
                  </div>
                  <Select name="paperType" required>
                    <SelectTrigger><SelectValue placeholder="Select Substrate" /></SelectTrigger>
                    <SelectContent>
                      {materials?.map(m => <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="widthMm">Width (mm)</Label>
                  <Input id="widthMm" name="widthMm" type="number" defaultValue={1020} onChange={handleInputChange} required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="gsm">GSM</Label>
                  <Input id="gsm" name="gsm" type="number" placeholder="80" onChange={handleInputChange} required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="weightKg">Weight (Kg)</Label>
                  <Input id="weightKg" name="weightKg" type="number" placeholder="500" onChange={handleInputChange} required />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 bg-primary/5 p-4 rounded-lg border border-primary/20">
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase font-bold text-primary">Length</Label>
                  <p className="text-xl font-black">{formData.lengthMeters} <span className="text-sm font-normal">m</span></p>
                </div>
                <div className="space-y-1 text-right">
                  <Label className="text-[10px] uppercase font-bold text-primary">Area (SQM)</Label>
                  <p className="text-xl font-black">{formData.sqm} <span className="text-sm font-normal">sqm</span></p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="companyRollNo">Company Roll No</Label>
                  <Input id="companyRollNo" name="companyRollNo" placeholder="MFR-9901" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="receivedDate">Date Received</Label>
                  <Input id="receivedDate" name="receivedDate" type="date" defaultValue={new Date().toISOString().split('T')[0]} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" className="w-full h-12 text-lg" disabled={isGenerating}>
                {isGenerating ? <Loader2 className="animate-spin mr-2" /> : "Save Jumbo Entry"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="min-w-[1200px]">
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[80px] text-center font-bold">ACTION</TableHead>
                  <TableHead className="cursor-pointer font-bold" onClick={() => toggleSort('rollNo')}>
                    <div className="flex items-center gap-1">ROLL NO {sortField === 'rollNo' ? (sortOrder === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-20" />}</div>
                  </TableHead>
                  <TableHead className="font-bold">COMPANY</TableHead>
                  <TableHead className="font-bold">TYPE</TableHead>
                  <TableHead className="font-bold">WIDTH</TableHead>
                  <TableHead className="font-bold">LENGTH</TableHead>
                  <TableHead className="font-bold">WEIGHT</TableHead>
                  <TableHead className="font-bold">DATE</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-10"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></TableCell></TableRow>
                ) : filteredAndSortedJumbos.map((j) => (
                  <TableRow key={j.id}>
                    <TableCell className="text-center">
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-primary" onClick={() => window.print()}><Printer className="h-4 w-4" /></Button>
                    </TableCell>
                    <TableCell className="font-bold text-primary">{j.rollNo}</TableCell>
                    <TableCell>{j.paperCompany}</TableCell>
                    <TableCell>{j.paperType}</TableCell>
                    <TableCell>{j.widthMm}mm</TableCell>
                    <TableCell>{j.lengthMeters}m</TableCell>
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
