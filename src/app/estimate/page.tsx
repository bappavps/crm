"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { calculateFlexoLayout, EstimateInputs } from "@/lib/flexo-utils"
import { Save, Printer, Calculator as CalcIcon, Loader2, FileText, Send } from "lucide-react"
import { useFirestore, useUser, useCollection, useMemoFirebase, useDoc } from "@/firebase"
import { collection, doc, runTransaction } from "firebase/firestore"
import { addDocumentNonBlocking } from "@/firebase/non-blocking-updates"
import { useRouter } from "next/navigation"

export default function EstimatePage() {
  const { toast } = useToast()
  const { user } = useUser()
  const firestore = useFirestore()
  const router = useRouter()

  const adminDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'adminUsers', user.uid);
  }, [firestore, user]);
  const { isLoading: authLoading } = useDoc(adminDocRef);

  const customersQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, 'customers');
  }, [firestore, user])

  const materialsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, 'materials');
  }, [firestore, user])

  const machinesQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, 'machines');
  }, [firestore, user])

  const cylindersQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, 'cylinders');
  }, [firestore, user])

  const { data: customers } = useCollection(customersQuery)
  const { data: materials } = useCollection(materialsQuery)
  const { data: machines } = useCollection(machinesQuery)
  const { data: cylinders } = useCollection(cylindersQuery)

  const [inputs, setInputs] = useState<EstimateInputs>({
    labelLength: 50,
    labelWidth: 100,
    gap: 3,
    sideMargin: 5,
    repeatLength: 508,
    printingWidthLimit: 250,
    jumboWidth: 1020,
    orderQuantity: 10000,
    materialRate: 25,
    printingRate: 1.5,
    uvRate: 0.5,
    machineCostPerHour: 1500,
    laborCostPerHour: 500,
    machineSpeed: 60,
    wastagePercent: 5
  })

  const [metadata, setMetadata] = useState({
    customerId: "",
    productCode: "",
    materialId: "",
    machineId: "",
    cylinderId: ""
  })

  const results = useMemo(() => calculateFlexoLayout(inputs), [inputs])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setInputs(prev => ({
      ...prev,
      [name]: parseFloat(value) || 0
    }))
  }

  const handleSave = () => {
    if (!firestore || !user) return
    
    if (!metadata.customerId || !metadata.productCode) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Please select a Customer and enter a Product Code.",
      })
      return
    }

    const estimatesRef = collection(firestore, 'estimates')
    addDocumentNonBlocking(estimatesRef, {
      ...inputs,
      ...metadata,
      ...results,
      estimateNumber: `EST-${Date.now().toString().slice(-6)}`,
      customerName: customers?.find(c => c.id === metadata.customerId)?.name || "Unknown",
      status: "Approved",
      createdById: user.uid,
      createdAt: new Date().toISOString(),
      estimateDate: new Date().toISOString()
    })

    toast({
      title: "Estimate Saved",
      description: `Estimate for ${metadata.productCode} has been stored.`,
    })
  }

  const handleGenerateQuotation = () => {
    if (!firestore || !user) return
    if (!metadata.customerId || !metadata.productCode) {
      toast({ variant: "destructive", title: "Validation Error", description: "Customer and Product Code required for Quotation." })
      return
    }

    const customer = customers?.find(c => c.id === metadata.customerId)
    const year = new Date().getFullYear().toString()
    const quoteNum = `QT-${year}-${Math.floor(1000 + Math.random() * 9000)}`

    const quotationData = {
      quotationNumber: quoteNum,
      customerId: metadata.customerId,
      customerName: customer?.name || "Unknown Client",
      customerEmail: customer?.email || "",
      productCode: metadata.productCode,
      ...inputs,
      ...results,
      status: "Draft",
      quoteDate: new Date().toISOString(),
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      createdById: user.uid,
      createdAt: new Date().toISOString()
    }

    addDocumentNonBlocking(collection(firestore, 'quotations'), quotationData)
    
    toast({ title: "Quotation Generated", description: `${quoteNum} created in draft mode.` })
    router.push('/sales/quotations')
  }

  if (authLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin mb-4 text-primary" />
        <p>Syncing authorization...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">Estimate Module</h2>
          <p className="text-muted-foreground">Narrow Web Flexo Layout & Costing Calculator</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" /> Print PDF</Button>
          <Button onClick={handleSave} className="bg-primary hover:bg-primary/90"><Save className="mr-2 h-4 w-4" /> Save Estimate</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader className="bg-primary/5">
              <CardTitle className="text-lg flex items-center gap-2">
                <CalcIcon className="h-5 w-5 text-primary" /> Job Parameters
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="space-y-2">
                <Label>Customer</Label>
                <Select onValueChange={(val) => setMetadata(p => ({...p, customerId: val}))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Product Code</Label>
                <Input placeholder="e.g. LAB-101" onChange={(e) => setMetadata(p => ({...p, productCode: e.target.value}))} />
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="labelLength">Length (mm)</Label>
                  <Input id="labelLength" name="labelLength" type="number" value={inputs.labelLength} onChange={handleInputChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="labelWidth">Width (mm)</Label>
                  <Input id="labelWidth" name="labelWidth" type="number" value={inputs.labelWidth} onChange={handleInputChange} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="gap">Gap (mm)</Label>
                  <Input id="gap" name="gap" type="number" value={inputs.gap} onChange={handleInputChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sideMargin">Margin (mm)</Label>
                  <Input id="sideMargin" name="sideMargin" type="number" value={inputs.sideMargin} onChange={handleInputChange} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="orderQuantity">Order Quantity</Label>
                <Input id="orderQuantity" name="orderQuantity" type="number" value={inputs.orderQuantity} onChange={handleInputChange} />
              </div>
              <Separator />
              <div className="space-y-2">
                <Label>Machine & Cylinder</Label>
                <div className="grid grid-cols-2 gap-4">
                  <Select onValueChange={(val) => {
                    const cyl = cylinders?.find(c => c.id === val)
                    if (cyl) setInputs(p => ({...p, repeatLength: Number(cyl.repeatLengthMm)}))
                  }}>
                    <SelectTrigger><SelectValue placeholder="Cylinder" /></SelectTrigger>
                    <SelectContent>
                      {cylinders?.map(c => <SelectItem key={c.id} value={c.id}>{c.name} ({c.repeatLengthMm}mm)</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select onValueChange={(val) => {
                    const mach = machines?.find(m => m.id === val)
                    if (mach) setInputs(p => ({...p, printingWidthLimit: Number(mach.maxPrintingWidthMm), machineCostPerHour: Number(mach.costPerHour)}))
                  }}>
                    <SelectTrigger><SelectValue placeholder="Machine" /></SelectTrigger>
                    <SelectContent>
                      {machines?.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader><CardTitle className="text-primary text-base">Layout Calculation</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-y-3 text-sm">
                <div className="text-muted-foreground">Labels Across:</div>
                <div className="font-bold text-right">{results.labelAcross}</div>
                <div className="text-muted-foreground">Labels Around:</div>
                <div className="font-bold text-right">{results.labelAround}</div>
                <div className="text-muted-foreground">Running Meter:</div>
                <div className="font-bold text-right text-accent">{results.runningMeter.toFixed(2)} m</div>
                <div className="text-muted-foreground">Slitting Width:</div>
                <div className="font-bold text-right">{results.slittingSize} mm</div>
              </CardContent>
            </Card>

            <Card className="border-accent/20 bg-accent/5">
              <CardHeader><CardTitle className="text-accent text-base">Costing Breakdown</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-y-3 text-sm">
                <div className="text-muted-foreground">Material Cost:</div>
                <div className="font-bold text-right">₹{results.materialCost.toFixed(2)}</div>
                <div className="text-muted-foreground">Printing Cost:</div>
                <div className="font-bold text-right">₹{results.printingCost.toFixed(2)}</div>
                <Separator className="col-span-2" />
                <div className="text-lg font-bold text-accent">Total Cost:</div>
                <div className="text-lg font-bold text-right text-accent">₹{results.totalCost.toFixed(2)}</div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-primary shadow-lg overflow-hidden">
            <CardHeader className="bg-primary text-white py-4">
              <CardTitle className="flex items-center justify-between text-lg">
                <span>Final Quotation Summary</span>
                <Badge className="bg-white text-primary">QTY: {inputs.orderQuantity.toLocaleString()}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-8 flex flex-col items-center justify-center space-y-6">
              <div className="grid grid-cols-3 gap-8 w-full text-center">
                <div className="space-y-1">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Price / Label</p>
                  <p className="text-3xl font-black text-primary">₹{results.sellingPricePerLabel.toFixed(3)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Total Value</p>
                  <p className="text-3xl font-black text-foreground">₹{results.totalSellingPrice.toLocaleString(undefined, {maximumFractionDigits: 0})}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Net Profit</p>
                  <p className="text-3xl font-black text-emerald-600">₹{results.profit.toLocaleString(undefined, {maximumFractionDigits: 0})}</p>
                </div>
              </div>
            </CardContent>
            <CardFooter className="bg-muted/50 border-t p-4 flex justify-between">
              <Button size="sm" variant="outline" onClick={handleGenerateQuotation} className="gap-2">
                <FileText className="h-4 w-4" /> Generate Quotation
              </Button>
              <p className="text-[10px] italic text-muted-foreground">*Calculated at {inputs.machineSpeed}m/min with {inputs.wastagePercent}% wastage.</p>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  )
}
