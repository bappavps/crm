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
    // If dynamic BOM selected, we might override materialRate logic here in future
    // For now, keep the core flexo calculation
    return calculateFlexoLayout(inputs)
  }, [inputs])

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
      toast({ variant: "destructive", title: "Validation Error", description: "Please select a Customer and enter a Product Code." })
      return
    }

    const estimatesRef = collection(firestore, 'estimates')
    addDocumentNonBlocking(estimatesRef, {
      ...inputs,
      ...metadata,
      ...results,
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

    toast({ title: "Estimate Saved", description: `Estimate for ${metadata.productCode} stored.` })
  }

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
                <Button variant="link" size="sm" className="h-auto p-0 text-xs gap-1" onClick={() => setIsQuickAddOpen(true)}><Plus className="h-3 w-3" /> Quick Client</Button>
              </div>

              <div className="space-y-2">
                <Label>Customer</Label>
                <Select value={metadata.customerId} onValueChange={(val) => setMetadata(p => ({...p, customerId: val}))}>
                  <SelectTrigger><SelectValue placeholder="Select Customer" /></SelectTrigger>
                  <SelectContent>
                    {activeCustomers?.map(c => <SelectItem key={c.id} value={c.id}>{c.companyName}</SelectItem>)}
                  </SelectContent>
                </Select>
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
        <DialogContent className="sm:max-w-[600px]">
          <form onSubmit={() => setIsQuickAddOpen(false)}>
            <DialogHeader><DialogTitle>Quick Client Registration</DialogTitle></DialogHeader>
            <div className="py-4 space-y-4">
              <Label>Redirecting to client master...</Label>
              <Button onClick={() => router.push('/master-data')}>Manage Master Data</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
