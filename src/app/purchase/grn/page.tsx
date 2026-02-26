
"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Loader2, ClipboardCheck, Printer, Search, ArrowUpDown, FilterX, ArrowUp, ArrowDown, Settings2, Trash2 } from "lucide-react"
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

  // Roll Settings - Updated Path
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

    // Filter by search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(j => 
        (j.rollNo || "").toLowerCase().includes(q) || 
        (j.companyRollNo || "").toLowerCase().includes(q) ||
        (j.productName || "").toLowerCase().includes(q)
      );
    }

    // Filter by Company
    if (companyFilter !== "all") {
      result = result.filter(j => j.paperCompany === companyFilter);
    }

    // Filter by Type
    if (typeFilter !== "all") {
      result = result.filter(j => j.paperType === typeFilter);
    }

    // Sorting
    result.sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      // Handle nulls
      if (valA === undefined || valA === null) return 1;
      if (valB === undefined || valB === null) return -1;

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [jumbos, searchQuery, companyFilter, typeFilter, sortField, sortOrder]);

  // Derived filter options
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
    
    try {
      await runTransaction(firestore, async (transaction) => {
        // 1. Fetch numbering settings and counter
        const settingsRef = doc(firestore, 'roll_settings', 'global_config');
        const counterRef = doc(firestore, 'counters', 'jumbo_roll');
        
        const settingsSnap = await transaction.get(settingsRef);
        const counterSnap = await transaction.get(counterRef);

        const currentSettings = settingsSnap.exists() ? settingsSnap.data() : {
          parentPrefix: "TLC-",
          startNumber: 1000
        };

        let currentNumber = 1;
        const now = new Date();
        const currentYear = now.getFullYear().toString();

        if (counterSnap.exists()) {
          const counterData = counterSnap.data();
          if (counterData.year === currentYear) {
            currentNumber = counterData.current_number + 1;
          }
        }

        const prefix = currentSettings.parentPrefix || "TLC-";
        const startNum = Number(currentSettings.startNumber) || 1000;
        const generatedRollNo = `${prefix}${startNum + currentNumber}`;

        // 2. Uniqueness check
        const dupQuery = query(collection(firestore, 'jumbo_stock'), where("rollNo", "==", generatedRollNo));
        const dupSnap = await getDocs(dupQuery);
        if (!dupSnap.empty) {
          throw new Error(`Roll Number ${generatedRollNo} already exists in registry.`);
        }

        // 3. Prepare data
        const jumboRef = doc(collection(firestore, 'jumbo_stock'));
        const jumboData = {
          rollNo: generatedRollNo,
          barcode: generatedRollNo,
          companyRollNo: submissionData.get("companyRollNo") as string,
          paperCompany: submissionData.get("paperCompany") as string,
          paperType: submissionData.get("paperType") as string,
          widthMm: formData.widthMm,
          lengthMeters: formData.lengthMeters,
          sqm: formData.sqm,
          gsm: formData.gsm,
          weightKg: formData.weightKg,
          purchaseRate: Number(submissionData.get("purchaseRate")),
          wastage: 0,
          jobNo: submissionData.get("jobNo") as string || "",
          productName: submissionData.get("productName") as string || "",
          code: submissionData.get("code") as string || "",
          lotNumber: submissionData.get("lotNumber") as string,
          receivedDate: submissionData.get("receivedDate") as string || now.toISOString(),
          date: now.toISOString(),
          status: "In Stock",
          createdAt: now.toISOString(),
          createdById: user.uid
        };

        // 4. Update counter and save
        transaction.set(counterRef, {
          prefix: prefix,
          year: currentYear,
          current_number: currentNumber
        }, { merge: true });

        transaction.set(jumboRef, jumboData);
      });

      setIsDialogOpen(false);
      setFormData({ widthMm: 1020, weightKg: 0, gsm: 0, lengthMeters: 0, sqm: 0 });
      toast({
        title: "GRN Recorded",
        description: "Jumbo Roll has been registered with a unique transactional ID."
      });
    } catch (error: any) {
      console.error("GRN Transaction failed: ", error);
      toast({
        variant: "destructive",
        title: "Registration Failed",
        description: error.message || "Unique sequence error. Please try again."
      });
    } finally {
      setIsGenerating(false);
    }
  }

  const handleAddSupplier = () => {
    if (!firestore || !newSupplierName.trim()) return
    const id = crypto.randomUUID()
    addDocumentNonBlocking(collection(firestore, 'suppliers'), { 
      id, 
      name: newSupplierName.trim(),
      gstNumber: "N/A",
      email: "N/A",
      createdAt: new Date().toISOString()
    })
    setNewSupplierName("")
    toast({ title: "Supplier Added", description: `${newSupplierName} is now available in GRN.` })
  }

  const handleDeleteSupplier = (id: string, name: string) => {
    if (!firestore) return
    deleteDocumentNonBlocking(doc(firestore, 'suppliers', id))
    toast({ title: "Supplier Removed", description: `${name} deleted from master list.` })
  }

  const handleAddMaterial = () => {
    if (!firestore || !newMaterialName.trim()) return
    const id = crypto.randomUUID()
    addDocumentNonBlocking(collection(firestore, 'materials'), { 
      id, 
      name: newMaterialName.trim(), 
      gsm: Number(newMaterialGsm) || 0,
      ratePerSqMeter: 0,
      createdAt: new Date().toISOString()
    })
    setNewMaterialName("")
    setNewMaterialGsm("")
    toast({ title: "Substrate Added", description: `${newMaterialName} is now available in GRN.` })
  }

  const handleDeleteMaterial = (id: string, name: string) => {
    if (!firestore) return
    deleteDocumentNonBlocking(doc(firestore, 'materials', id))
    toast({ title: "Substrate Removed", description: `${name} deleted from master list.` })
  }

  const resetFilters = () => {
    setSearchQuery("")
    setCompanyFilter("all")
    setTypeFilter("all")
    setSortField('receivedDate')
    setSortOrder('desc')
    toast({ title: "Filters Reset", description: "Showing all raw material stock." })
  }

  const handlePrintBarcode = (jumbo: any) => {
    toast({
      title: "Printer Connection Established",
      description: `Generating 4x6 barcode label for ${jumbo.rollNo}...`
    })
    setTimeout(() => window.print(), 1000)
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

      {/* Filter Bar */}
      <Card className="border-primary/10 bg-muted/20">
        <CardContent className="pt-6 pb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase">Search Registry</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Roll No, Product..." 
                  className="pl-8 bg-background" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase">Paper Company</Label>
              <Select value={companyFilter} onValueChange={setCompanyFilter}>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="All Companies" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Companies</SelectItem>
                  {uniqueCompanies.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase">Paper Type</Label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {uniqueTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={resetFilters} title="Clear Filters">
                <FilterX className="mr-2 h-4 w-4" /> Clear
              </Button>
              <Button variant="secondary" className="flex-1" onClick={() => toast({ title: "Export", description: "CSV download starting..." })}>
                <Printer className="mr-2 h-4 w-4" /> Export
              </Button>
            </div>
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
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="paperCompany">Paper Company</Label>
                    <Button type="button" variant="ghost" size="icon" className="h-4 w-4 text-primary" onClick={() => setIsSupplierManageOpen(true)}>
                      <Settings2 className="h-3 w-3" />
                    </Button>
                  </div>
                  <Select name="paperCompany" required>
                    <SelectTrigger><SelectValue placeholder="Select Vendor" /></SelectTrigger>
                    <SelectContent>
                      {suppliers?.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
                      {(!suppliers || suppliers.length === 0) && <SelectItem value="Generic Supplier">Generic Supplier</SelectItem>}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="paperType">Paper Type</Label>
                    <Button type="button" variant="ghost" size="icon" className="h-4 w-4 text-primary" onClick={() => setIsMaterialManageOpen(true)}>
                      <Settings2 className="h-3 w-3" />
                    </Button>
                  </div>
                  <Select name="paperType" required>
                    <SelectTrigger><SelectValue placeholder="Select Substrate" /></SelectTrigger>
                    <SelectContent>
                      {materials?.map(m => <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>)}
                      {(!materials || materials.length === 0) && <SelectItem value="Generic Substrate">Generic Substrate</SelectItem>}
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
                  <Label className="text-[10px] uppercase font-bold text-primary">Auto-Calculated Length</Label>
                  <p className="text-xl font-black">{formData.lengthMeters} <span className="text-sm font-normal">meters</span></p>
                </div>
                <div className="space-y-1 text-right">
                  <Label className="text-[10px] uppercase font-bold text-primary">Total Area (SQM)</Label>
                  <p className="text-xl font-black">{formData.sqm} <span className="text-sm font-normal">sqm</span></p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="jobNo">Job No (Optional)</Label>
                  <Input id="jobNo" name="jobNo" placeholder="JC-12345" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="productName">Product Name</Label>
                  <Input id="productName" name="productName" placeholder="e.g. Pharma Label" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="companyRollNo">Company Roll No</Label>
                  <Input id="companyRollNo" name="companyRollNo" placeholder="MFR-9901" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="lotNumber">Lot / Batch No</Label>
                  <Input id="lotNumber" name="lotNumber" placeholder="LOT-XYZ" required />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="purchaseRate">Purchase Rate (per SQM)</Label>
                  <Input id="purchaseRate" name="purchaseRate" type="number" step="0.01" placeholder="₹ 25.00" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="receivedDate">Date of Received</Label>
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

      {/* Supplier Management Dialog */}
      <Dialog open={isSupplierManageOpen} onOpenChange={setIsSupplierManageOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Manage Paper Companies</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex gap-2">
              <Input placeholder="e.g. Avery Dennison" value={newSupplierName} onChange={(e) => setNewSupplierName(e.target.value)} />
              <Button onClick={handleAddSupplier} size="icon"><Plus className="h-4 w-4" /></Button>
            </div>
            <div className="border rounded-md max-h-[250px] overflow-y-auto">
              <Table>
                <TableBody>
                  {suppliers?.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium text-xs">{s.name}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" className="text-destructive h-8 w-8" onClick={() => handleDeleteSupplier(s.id, s.name)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setIsSupplierManageOpen(false)} className="w-full">Done</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Material Management Dialog */}
      <Dialog open={isMaterialManageOpen} onOpenChange={setIsMaterialManageOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Manage Substrates</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-2">
              <Input placeholder="Material Name (e.g. Chromo)" value={newMaterialName} onChange={(e) => setNewMaterialName(e.target.value)} />
              <div className="flex gap-2">
                <Input placeholder="GSM (e.g. 80)" type="number" value={newMaterialGsm} onChange={(e) => setNewMaterialGsm(e.target.value)} />
                <Button onClick={handleAddMaterial} size="icon" className="shrink-0"><Plus className="h-4 w-4" /></Button>
              </div>
            </div>
            <div className="border rounded-md max-h-[250px] overflow-y-auto">
              <Table>
                <TableBody>
                  {materials?.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium text-xs">{m.name} ({m.gsm} GSM)</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" className="text-destructive h-8 w-8" onClick={() => handleDeleteMaterial(m.id, m.name)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setIsMaterialManageOpen(false)} className="w-full">Done</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex justify-between items-center">
            <CardTitle className="text-lg flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-primary" /> Jumbo Roll Registry (Stock)
            </CardTitle>
            <Badge variant="outline" className="font-bold">
              {filteredAndSortedJumbos.length} Items Found
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="min-w-[2600px]">
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[80px] font-bold border-r text-center">ACTION</TableHead>
                  <TableHead className="w-[120px] font-bold border-r cursor-pointer hover:bg-muted transition-colors" onClick={() => toggleSort('rollNo')}>
                    <div className="flex items-center gap-1">ROLL NO {sortField === 'rollNo' ? (sortOrder === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-20" />}</div>
                  </TableHead>
                  <TableHead className="w-[180px] font-bold border-r cursor-pointer hover:bg-muted transition-colors" onClick={() => toggleSort('paperCompany')}>
                    <div className="flex items-center gap-1">PAPER COMPANY {sortField === 'paperCompany' ? (sortOrder === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-20" />}</div>
                  </TableHead>
                  <TableHead className="w-[180px] font-bold border-r cursor-pointer hover:bg-muted transition-colors" onClick={() => toggleSort('paperType')}>
                    <div className="flex items-center gap-1">PAPER TYPE {sortField === 'paperType' ? (sortOrder === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-20" />}</div>
                  </TableHead>
                  <TableHead className="w-[100px] font-bold border-r">WIDTH (MM)</TableHead>
                  <TableHead className="w-[120px] font-bold border-r">LENGTH (MTR)</TableHead>
                  <TableHead className="w-[100px] font-bold border-r cursor-pointer hover:bg-muted transition-colors" onClick={() => toggleSort('sqm')}>
                    <div className="flex items-center gap-1">SQM {sortField === 'sqm' ? (sortOrder === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-20" />}</div>
                  </TableHead>
                  <TableHead className="w-[80px] font-bold border-r">GSM</TableHead>
                  <TableHead className="w-[120px] font-bold border-r cursor-pointer hover:bg-muted transition-colors" onClick={() => toggleSort('weightKg')}>
                    <div className="flex items-center gap-1">WEIGHT (KG) {sortField === 'weightKg' ? (sortOrder === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-20" />}</div>
                  </TableHead>
                  <TableHead className="w-[120px] font-bold border-r">Purchase Rate</TableHead>
                  <TableHead className="w-[100px] font-bold border-r">WASTAGE</TableHead>
                  <TableHead className="w-[140px] font-bold border-r">DATE OF USE</TableHead>
                  <TableHead className="w-[160px] font-bold border-r cursor-pointer hover:bg-muted transition-colors" onClick={() => toggleSort('receivedDate')}>
                    <div className="flex items-center gap-1">DATE OF RECEIVED {sortField === 'receivedDate' ? (sortOrder === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-20" />}</div>
                  </TableHead>
                  <TableHead className="w-[120px] font-bold border-r">Job no</TableHead>
                  <TableHead className="w-[100px] font-bold border-r">SIZE</TableHead>
                  <TableHead className="w-[200px] font-bold border-r">PRODUCT NAME</TableHead>
                  <TableHead className="w-[120px] font-bold border-r">Code</TableHead>
                  <TableHead className="w-[180px] font-bold border-r">Lot no/BATCH NO</TableHead>
                  <TableHead className="w-[140px] font-bold border-r">Date</TableHead>
                  <TableHead className="w-[180px] font-bold">Company Roll no</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={20} className="text-center py-10"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></TableCell>
                  </TableRow>
                ) : filteredAndSortedJumbos.map((j) => (
                  <TableRow key={j.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="border-r text-center">
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-primary hover:text-primary hover:bg-primary/10" onClick={() => handlePrintBarcode(j)}>
                        <Printer className="h-4 w-4" />
                      </Button>
                    </TableCell>
                    <TableCell className="font-bold text-primary border-r">{j.rollNo}</TableCell>
                    <TableCell className="border-r">{j.paperCompany}</TableCell>
                    <TableCell className="border-r">{j.paperType}</TableCell>
                    <TableCell className="border-r">{j.widthMm} mm</TableCell>
                    <TableCell className="border-r font-mono">{j.lengthMeters} m</TableCell>
                    <TableCell className="border-r">{j.sqm}</TableCell>
                    <TableCell className="border-r">{j.gsm}</TableCell>
                    <TableCell className="border-r font-semibold">{j.weightKg} kg</TableCell>
                    <TableCell className="border-r">₹{j.purchaseRate?.toFixed(2)}</TableCell>
                    <TableCell className="border-r text-muted-foreground">{j.wastage || 0}</TableCell>
                    <TableCell className="border-r text-muted-foreground italic">{j.dateOfUse ? new Date(j.dateOfUse).toLocaleDateString() : 'N/A'}</TableCell>
                    <TableCell className="border-r">{new Date(j.receivedDate).toLocaleDateString()}</TableCell>
                    <TableCell className="border-r font-mono text-xs">{j.jobNo || '-'}</TableCell>
                    <TableCell className="border-r text-muted-foreground">{j.size || '-'}</TableCell>
                    <TableCell className="border-r truncate max-w-[200px]">{j.productName || '-'}</TableCell>
                    <TableCell className="border-r text-xs">{j.code || '-'}</TableCell>
                    <TableCell className="border-r font-mono text-xs">{j.lotNumber}</TableCell>
                    <TableCell className="border-r text-xs">{new Date(j.date || j.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell className="font-mono text-xs">{j.companyRollNo}</TableCell>
                  </TableRow>
                ))}
                {filteredAndSortedJumbos.length === 0 && !isLoading && (
                  <TableRow>
                    <TableCell colSpan={20} className="text-center py-20 text-muted-foreground italic">
                      No stock matching the selected filters.
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
