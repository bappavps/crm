
"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Loader2, ClipboardCheck, Printer } from "lucide-react"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog"
import { useFirestore, useUser, useCollection, useMemoFirebase, useDoc } from "@/firebase"
import { collection, doc } from "firebase/firestore"
import { addDocumentNonBlocking } from "@/firebase/non-blocking-updates"
import { useToast } from "@/hooks/use-toast"

export default function GRNPage() {
  const { toast } = useToast()
  const { user } = useUser()
  const firestore = useFirestore()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  
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
      // Area (sqm) = Weight (kg) / (GSM / 1000)
      const calculatedSqm = formData.weightKg / (formData.gsm / 1000)
      // Length (m) = Area (sqm) / (Width (mm) / 1000)
      const calculatedLength = calculatedSqm / (formData.widthMm / 1000)
      
      setFormData(prev => ({
        ...prev,
        sqm: Number(calculatedSqm.toFixed(2)),
        lengthMeters: Number(calculatedLength.toFixed(2))
      }))
    }
  }, [formData.weightKg, formData.gsm, formData.widthMm])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: Number(value)
    }))
  }

  const handleAddJumbo = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!firestore || !user) return

    const submissionData = new FormData(e.currentTarget)
    
    // Generate Roll No / Barcode
    const count = (jumbos?.length || 0) + 1
    const generatedRollNo = `JMB-${count.toString().padStart(5, '0')}`

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
      receivedDate: submissionData.get("receivedDate") as string || new Date().toISOString(),
      date: new Date().toISOString(),
      status: "In Stock",
      createdAt: new Date().toISOString(),
      createdById: user.uid
    }

    addDocumentNonBlocking(collection(firestore, 'jumbo_stock'), jumboData)

    setIsDialogOpen(false)
    setFormData({ widthMm: 1020, weightKg: 0, gsm: 0, lengthMeters: 0, sqm: 0 })
    toast({
      title: "GRN Recorded",
      description: `Jumbo Roll ${jumboData.rollNo} added to inventory.`
    })
  }

  const handlePrintBarcode = (jumbo: any) => {
    toast({
      title: "Barcode Printer",
      description: `Printing barcode label for ${jumbo.rollNo}...`
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">GRN (Jumbo Entry)</h2>
          <p className="text-muted-foreground">Comprehensive raw material tracking and auto-calculated metrics.</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}><Plus className="mr-2 h-4 w-4" /> New Jumbo Entry</Button>
      </div>

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
                  <Label htmlFor="paperCompany">Paper Company</Label>
                  <Select name="paperCompany" required>
                    <SelectTrigger><SelectValue placeholder="Select Vendor" /></SelectTrigger>
                    <SelectContent>
                      {suppliers?.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
                      <SelectItem value="Direct Import">Direct Import</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="paperType">Paper Type</Label>
                  <Select name="paperType" required>
                    <SelectTrigger><SelectValue placeholder="Select Substrate" /></SelectTrigger>
                    <SelectContent>
                      {materials?.map(m => <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>)}
                      <SelectItem value="Generic Semi-Gloss">Generic Semi-Gloss</SelectItem>
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
              <Button type="submit" className="w-full h-12 text-lg">Save Jumbo Entry</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-primary" /> Jumbo Roll Registry (Stock)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="min-w-[2400px]">
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[120px] font-bold border-r">ROLL NO</TableHead>
                  <TableHead className="w-[180px] font-bold border-r">PAPER COMPANY</TableHead>
                  <TableHead className="w-[180px] font-bold border-r">PAPER TYPE</TableHead>
                  <TableHead className="w-[100px] font-bold border-r">WIDTH (MM)</TableHead>
                  <TableHead className="w-[120px] font-bold border-r">LENGTH (MTR)</TableHead>
                  <TableHead className="w-[100px] font-bold border-r">SQM</TableHead>
                  <TableHead className="w-[80px] font-bold border-r">GSM</TableHead>
                  <TableHead className="w-[120px] font-bold border-r">WEIGHT (KG)</TableHead>
                  <TableHead className="w-[120px] font-bold border-r">Purchase Rate</TableHead>
                  <TableHead className="w-[100px] font-bold border-r">WASTAGE</TableHead>
                  <TableHead className="w-[140px] font-bold border-r">DATE OF USE</TableHead>
                  <TableHead className="w-[160px] font-bold border-r">DATE OF RECEIVED</TableHead>
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
                    <TableCell colSpan={19} className="text-center py-10"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></TableCell>
                  </TableRow>
                ) : jumbos?.filter(j => j.status === 'In Stock').map((j) => (
                  <TableRow key={j.id} className="hover:bg-muted/30 transition-colors">
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
                {(!jumbos || jumbos.filter(j => j.status === 'In Stock').length === 0) && !isLoading && (
                  <TableRow>
                    <TableCell colSpan={19} className="text-center py-20 text-muted-foreground italic">
                      No Jumbo Rolls currently in stock. Record a GRN to begin.
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
