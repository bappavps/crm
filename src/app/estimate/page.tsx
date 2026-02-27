"use client"

import { useState, useMemo, useRef, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { calculateFlexoLayout, EstimateInputs } from "@/lib/flexo-utils"
import { Save, Printer, Calculator as CalcIcon, Loader2, FileText, Send, UserPlus, Image as ImageIcon, Plus, Upload, X, History, Layers } from "lucide-react"
import { useFirestore, useUser, useCollection, useMemoFirebase, useDoc } from "@/firebase"
import { collection, doc, query, where, getDocs, orderBy, limit } from "firebase/firestore"
import { addDocumentNonBlocking } from "@/firebase/non-blocking-updates"
import { useRouter } from "next/navigation"
import { usePermissions } from "@/components/auth/permission-context"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import Image from "next/image"
import { cn } from "@/lib/utils"

export default function EstimatePage() {
  const { toast } = useToast()
  const { user } = useUser()
  const firestore = useFirestore()
  const router = useRouter()
  const { hasPermission } = usePermissions()

  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // REPEAT JOB LOGIC STATE
  const [isRepeatJob, setIsRepeatJob] = useState(false)
  const [previousJobs, setPreviousJobs] = useState<any[]>([])
  const [selectedRepeatJobId, setSelectedRepeatJobId] = useState<string>("")

  // DYNAMIC BOM LOGIC STATE
  const [selectedBomId, setSelectedBomId] = useState<string>("manual")

  const adminDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'adminUsers', user.uid);
  }, [firestore, user]);
  const { isLoading: authLoading } = useDoc(adminDocRef);

  const customersQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, 'customers');
  }, [firestore, user])

  const bomsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, 'boms');
  }, [firestore, user])

  const rawMaterialsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, 'raw_materials');
  }, [firestore, user])

  const { data: customers } = useCollection(customersQuery)
  const { data: boms } = useCollection(bomsQuery)
  const { data: rawMaterials } = useCollection(rawMaterialsQuery)

  const activeCustomers = customers?.filter(c => c.status === 'Active' || c.isActive !== false) || []

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

  // Load Previous Jobs for Repeat Logic
  useEffect(() => {
    if (metadata.customerId && isRepeatJob && firestore) {
      const q = query(
        collection(firestore, 'jobs'),
        where("customerId", "==", metadata.customerId),
        orderBy("createdAt", "desc"),
        limit(5)
      )
      getDocs(q).then(snap => {
        setPreviousJobs(snap.docs.map(d => ({ ...d.data(), id: d.id })))
      })
    }
  }, [metadata.customerId, isRepeatJob, firestore])

  // Handle Repeat Job Selection
  const handleRepeatJobSelect = (jobId: string) => {
    const job = previousJobs.find(j => j.id === jobId)
    if (job) {
      setSelectedRepeatJobId(jobId)
      setMetadata(p => ({ ...p, productCode: job.itemNameSummary || job.productCode }))
      setInputs(p => ({
        ...p,
        labelLength: job.heightMM || 50,
        labelWidth: job.widthMM || 100,
        repeatLength: job.repeatLength || 508
      }))
      toast({ title: "Job Details Loaded", description: "Previous specs and artwork linked." })
    }
  }

  const results = useMemo(() => {
    return calculateFlexoLayout(inputs)
  }, [inputs])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setInputs(prev => ({
      ...prev,
      [name]: parseFloat(value) || 0
    }))
  }

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => setPhotoPreview(reader.result as string)
      reader.readAsDataURL(file)
    }
  }

  const handleQuickClientSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!firestore || !user) return

    const formData = new FormData(e.currentTarget)
    const companyName = formData.get("companyName") as string
    const clientPersonName = formData.get("clientPersonName") as string
    const whatsapp = formData.get("whatsapp") as string
    const email = formData.get("email") as string
    const gstNumber = formData.get("gstNumber") as string
    const fullAddress = formData.get("fullAddress") as string
    const operationalNote = formData.get("operationalNote") as string

    const clientData = {
      companyName,
      clientPersonName,
      whatsapp,
      email,
      gstNumber,
      fullAddress,
      operationalNote,
      photoUrl: photoPreview || null,
      creditDays: 0,
      status: "Active",
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdById: user.uid,
      id: crypto.randomUUID()
    }

    try {
      const docRef = await addDocumentNonBlocking(collection(firestore, 'customers'), clientData)
      if (docRef) {
        setMetadata(prev => ({ ...prev, customerId: docRef.id }))
        toast({ title: "Client Added", description: `${companyName} has been registered and selected.` })
      }
      setIsQuickAddOpen(false)
      setPhotoPreview(null)
    } catch (err) {
      // Error emitted by utility
    }
  }

  const handleSave = () => {
    if (!firestore || !user) return
    
    const isManual = selectedBomId === "manual";
    
    if (!metadata.customerId) {
      toast({ variant: "destructive", title: "Validation Error", description: "Please select a Customer." })
      return
    }

    // Require Product Code if using BOM (Manual mode is optional)
    if (!isManual && !metadata.productCode) {
      toast({ variant: "destructive", title: "Validation Error", description: "Product Code is required for BOM-linked estimates." })
      return
    }

    const estimatesRef = collection(firestore, 'estimates')
    addDocumentNonBlocking(estimatesRef, {
      ...inputs,
      ...metadata,
      ...results,
      productCode: metadata.productCode || "Manual Estimate",
      bomId: selectedBomId,
      isRepeatJob,
      sourceJobId: selectedRepeatJobId || null,
      estimateNumber: `EST-${Date.now().toString().slice(-6)}`,
      customerName: activeCustomers?.find(c => c.id === metadata.customerId)?.companyName || "Unknown",
      status: "Approved",
      createdById: user.uid,
      createdAt: new Date().toISOString(),
      estimateDate: new Date().toISOString()
    })

    toast({ title: "Estimate Saved", description: `Estimate stored successfully.` })
  }

  const selectedCustomerData = useMemo(() => 
    activeCustomers?.find(c => c.id === metadata.customerId), 
    [activeCustomers, metadata.customerId]
  )

  const isOverdue = useMemo(() => {
    if (!selectedCustomerData?.lastInvoiceDate || !selectedCustomerData?.creditDays) return false
    const lastInvoice = new Date(selectedCustomerData.lastInvoiceDate)
    const dueDate = new Date(lastInvoice.getTime() + selectedCustomerData.creditDays * 24 * 60 * 60 * 1000)
    return new Date() > dueDate
  }, [selectedCustomerData])

  if (authLoading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin" /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">Label Estimator</h2>
          <p className="text-muted-foreground">Dynamic BOM & Repeat Job Integrated Flow</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" /> Print</Button>
          <Button onClick={handleSave} className="bg-primary hover:bg-primary/90"><Save className="mr-2 h-4 w-4" /> Save Estimate</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader className="bg-primary/5">
              <CardTitle className="text-lg flex items-center gap-2"><CalcIcon className="h-5 w-5 text-primary" /> Core Parameters</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Switch checked={isRepeatJob} onCheckedChange={setIsRepeatJob} />
                  <Label className="text-xs font-bold uppercase">Repeat Job</Label>
                </div>
                {hasPermission('client_add') && (
                  <Button variant="link" size="sm" className="h-auto p-0 text-xs gap-1" onClick={() => setIsQuickAddOpen(true)}>
                    <Plus className="h-3 w-3" /> Quick Add Client
                  </Button>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-end">
                  <Label>Customer</Label>
                  {selectedCustomerData && (
                    <Badge 
                      className={cn(
                        "text-[9px] h-5 uppercase border-none text-white",
                        isOverdue ? "bg-destructive hover:bg-destructive/90" : "bg-emerald-500 hover:bg-emerald-600"
                      )}
                    >
                      {isOverdue ? 'Overdue' : 'Credit OK'}
                    </Badge>
                  )}
                </div>
                <Select value={metadata.customerId} onValueChange={(val) => setMetadata(p => ({...p, customerId: val}))}>
                  <SelectTrigger className={isOverdue ? 'border-destructive' : ''}>
                    <SelectValue placeholder="Select Customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeCustomers?.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.companyName} {c.isCreditBlocked ? '(Blocked)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Product Code / Job Name</Label>
                <Input 
                  value={metadata.productCode} 
                  onChange={(e) => setMetadata(p => ({...p, productCode: e.target.value}))}
                  placeholder={selectedBomId === 'manual' ? 'Optional for Manual' : 'e.g. LAB-50100-CH'}
                />
              </div>

              {isRepeatJob && metadata.customerId && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                  <Label className="text-accent font-bold text-[10px] uppercase">Select Previous Reference</Label>
                  <Select value={selectedRepeatJobId} onValueChange={handleRepeatJobSelect}>
                    <SelectTrigger className="border-accent/30"><SelectValue placeholder="Choose past job" /></SelectTrigger>
                    <SelectContent>
                      {previousJobs.map(j => <SelectItem key={j.id} value={j.id}>{j.jobNumber} - {j.itemNameSummary}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label>BOM Calculation Type</Label>
                <Select value={selectedBomId} onValueChange={setSelectedBomId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual Rates (Legacy)</SelectItem>
                    {boms?.map(b => <SelectItem key={b.id} value={b.id}>BOM: {b.product_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <Separator />
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Length (mm)</Label>
                  <Input name="labelLength" type="number" value={inputs.labelLength} onChange={handleInputChange} />
                </div>
                <div className="space-y-2">
                  <Label>Width (mm)</Label>
                  <Input name="labelWidth" type="number" value={inputs.labelWidth} onChange={handleInputChange} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Order Quantity</Label>
                <Input name="orderQuantity" type="number" value={inputs.orderQuantity} onChange={handleInputChange} />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader><CardTitle className="text-primary text-base">Layout Execution</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-y-3 text-sm">
                <div className="text-muted-foreground">Labels Across:</div>
                <div className="font-bold text-right">{results.labelAcross}</div>
                <div className="text-muted-foreground">Running Meter:</div>
                <div className="font-bold text-right text-accent">{results.runningMeter.toFixed(2)} m</div>
                <div className="text-muted-foreground">Total SQM Req:</div>
                <div className="font-bold text-right">{results.totalMaterialRequiredSqM.toFixed(2)}</div>
              </CardContent>
            </Card>

            <Card className="border-accent/20 bg-accent/5">
              <CardHeader><CardTitle className="text-accent text-base">Costing Matrix</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-y-3 text-sm">
                <div className="text-muted-foreground">Estimated Cost:</div>
                <div className="font-bold text-right">₹{results.totalCost.toFixed(2)}</div>
                <div className="text-lg font-bold text-accent">Total Sales Value:</div>
                <div className="text-lg font-bold text-right text-accent">₹{results.totalSellingPrice.toLocaleString(undefined, {maximumFractionDigits: 0})}</div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-primary shadow-lg overflow-hidden">
            <CardHeader className="bg-primary text-white py-4">
              <CardTitle className="flex items-center justify-between text-lg">
                <span>Final Profit Analysis</span>
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
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Profit %</p>
                  <p className="text-3xl font-black text-emerald-600">{results.profitPercent.toFixed(1)}%</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Net Margin</p>
                  <p className="text-3xl font-black text-foreground">₹{results.profit.toLocaleString(undefined, {maximumFractionDigits: 0})}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={isQuickAddOpen} onOpenChange={setIsQuickAddOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleQuickClientSave}>
            <DialogHeader>
              <DialogTitle>Quick Client Registration</DialogTitle>
              <DialogDescription>Add a basic client profile. You can update financial terms in Master Data later.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="companyName">Company Name</Label>
                  <Input id="companyName" name="companyName" placeholder="e.g. Acme Labels Ltd" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clientPersonName">Contact Person</Label>
                  <Input id="clientPersonName" name="clientPersonName" placeholder="e.g. John Doe" required />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="whatsapp">WhatsApp / Phone</Label>
                  <Input id="whatsapp" name="whatsapp" placeholder="9876543210" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input id="email" name="email" type="email" placeholder="client@example.com" required />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="gstNumber">GST Number</Label>
                <Input id="gstNumber" name="gstNumber" placeholder="22AAAAA0000A1Z5" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="fullAddress">Company Address</Label>
                <Textarea id="fullAddress" name="fullAddress" placeholder="Full registered address..." className="h-20" required />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="operationalNote">Internal Notes</Label>
                  <Textarea id="operationalNote" name="operationalNote" placeholder="Special delivery instructions or technical preferences..." className="h-32" />
                </div>
                <div className="space-y-2">
                  <Label>Company Photo / Logo</Label>
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="flex flex-col items-center justify-center gap-2 p-4 border rounded-md bg-muted/20 border-dashed cursor-pointer hover:bg-muted/40 transition-colors relative h-32"
                  >
                    {photoPreview ? (
                      <div className="relative w-full h-full">
                        <Image src={photoPreview} alt="Logo Preview" fill className="object-contain" />
                        <Button 
                          type="button" 
                          variant="destructive" 
                          size="icon" 
                          className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                          onClick={(e) => { e.stopPropagation(); setPhotoPreview(null); }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <Upload className="h-6 w-6 text-muted-foreground" />
                        <span className="text-[10px] text-muted-foreground uppercase font-bold text-center">Upload Logo</span>
                      </>
                    )}
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handlePhotoSelect} />
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" className="w-full h-12 font-bold uppercase tracking-wider">
                Create & Select Client
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
