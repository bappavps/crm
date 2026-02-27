
"use client"

import { useState, useMemo, useRef, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { calculateFlexoLayout, EstimateInputs } from "@/lib/flexo-utils"
import { Save, Printer, Calculator as CalcIcon, Loader2, FileText, Send, UserPlus, Image as ImageIcon, Plus, Upload, X, History, Layers, Palette, AlertTriangle } from "lucide-react"
import { useFirestore, useUser, useCollection, useMemoFirebase, useDoc, errorEmitter, FirestorePermissionError } from "@/firebase"
import { collection, doc, query, where, getDocs, orderBy, limit, runTransaction, serverTimestamp } from "firebase/firestore"
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
  const { hasPermission, roles: userRoles } = usePermissions()

  const isAdmin = userRoles.includes('Admin')

  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isSaving, setIsSaving] = useState(false)

  // REPEAT JOB LOGIC STATE
  const [isRepeatJob, setIsRepeatJob] = useState(false)
  const [previousJobs, setPreviousJobs] = useState<any[]>([])
  const [selectedRepeatJobId, setSelectedRepeatJobId] = useState<string>("")

  // DESIGN GATE STATE
  const [selectedDesignId, setSelectedDesignId] = useState<string>("")

  // Current User Profile for Ownership Attribution
  const profileRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);
  const { data: profile } = useDoc(profileRef);

  const adminDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'adminUsers', user.uid);
  }, [firestore, user]);
  const { data: adminData, isLoading: authLoading } = useDoc(adminDocRef);

  const customersQuery = useMemoFirebase(() => {
    if (!firestore || !user || authLoading) return null;
    const base = collection(firestore, 'customers');
    if (!adminData) {
      return query(base, where("sales_owner_id", "==", user.uid));
    }
    return base;
  }, [firestore, user, adminData, authLoading])

  const artworksQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'artworks'), where("status", "==", "Approved"));
  }, [firestore, user])

  const { data: customers } = useCollection(customersQuery)
  const { data: approvedArtworks } = useCollection(artworksQuery)

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

  const handleSave = async () => {
    if (!firestore || !user) return
    
    const selectedCustomer = activeCustomers.find(c => c.id === metadata.customerId)
    if (!selectedCustomer) {
      toast({ variant: "destructive", title: "Validation Error", description: "Please select a Customer." })
      return
    }

    // DESIGN GATE ENFORCEMENT
    if (!isRepeatJob && !selectedDesignId) {
      toast({ 
        variant: "destructive", 
        title: "Design Approval Required", 
        description: "For new jobs, an approved design must be selected before estimation." 
      })
      return
    }

    setIsSaving(true)

    try {
      await runTransaction(firestore, async (transaction) => {
        const counterRef = doc(firestore, 'counters', 'estimate_counter');
        const counterSnap = await transaction.get(counterRef);
        const year = new Date().getFullYear().toString();
        let currentNumber = 1;

        if (counterSnap.exists()) {
          const data = counterSnap.data();
          if (data.year === year) {
            currentNumber = (data.current_number || 0) + 1;
          }
        }

        const formattedNum = currentNumber.toString().padStart(4, "0");
        const estimateNumber = `EST-${year}-${formattedNum}`;
        const newEstimateRef = doc(collection(firestore, 'estimates'));

        transaction.set(counterRef, { year, current_number: currentNumber }, { merge: true });
        
        const estimateData = {
          ...inputs,
          ...metadata,
          ...results,
          estimateNumber,
          productCode: metadata.productCode || "Manual Estimate",
          designId: selectedDesignId || null,
          isRepeatJob: !!isRepeatJob,
          sourceJobId: selectedRepeatJobId || null,
          customerName: selectedCustomer.companyName || "Unknown Client",
          sales_owner_id: selectedCustomer.sales_owner_id || user.uid,
          sales_owner_name: selectedCustomer.sales_owner_name || user.displayName || "Unknown",
          sales_owner_code: selectedCustomer.sales_owner_code || "N/A",
          status: "Draft",
          createdById: user.uid,
          createdAt: serverTimestamp(),
          estimateDate: new Date().toISOString()
        };

        transaction.set(newEstimateRef, estimateData);
      });

      toast({ title: "Estimate Created", description: `Record saved as Draft.` })
      router.push('/estimates')
    } catch (e: any) {
      toast({ variant: "destructive", title: "Save Failed", description: e.message })
    } finally {
      setIsSaving(false)
    }
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

  const filteredDesigns = useMemo(() => {
    if (!metadata.customerId) return []
    return approvedArtworks?.filter(a => a.estimateId === metadata.customerId || a.clientName === selectedCustomerData?.companyName) || []
  }, [approvedArtworks, metadata.customerId, selectedCustomerData])

  if (authLoading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin" /></div>

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black tracking-tight text-primary uppercase">Label Estimator</h2>
          <p className="text-muted-foreground font-medium">Precision calculation engine for flexo printing quotes.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" /> Print</Button>
          <Button onClick={handleSave} disabled={isSaving} className="bg-primary hover:bg-primary/90 font-bold uppercase tracking-widest px-8">
            {isSaving ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2 h-4 w-4" />}
            Save Estimate
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <Card className="border-none shadow-lg">
            <CardHeader className="bg-primary/5">
              <CardTitle className="text-sm font-black uppercase flex items-center gap-2 text-primary">
                <CalcIcon className="h-4 w-4" /> Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Switch checked={isRepeatJob} onCheckedChange={setIsRepeatJob} />
                  <Label className="text-[10px] font-black uppercase text-accent">Repeat Job</Label>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-end">
                  <Label className="text-[10px] font-black uppercase">Customer</Label>
                  {selectedCustomerData && (
                    <Badge className={cn("text-[8px] h-4 uppercase border-none text-white", isOverdue ? "bg-destructive" : "bg-emerald-500")}>
                      {isOverdue ? 'Overdue' : 'Credit OK'}
                    </Badge>
                  )}
                </div>
                <Select value={metadata.customerId} onValueChange={(val) => setMetadata(p => ({...p, customerId: val}))}>
                  <SelectTrigger className={isOverdue ? 'border-destructive' : 'bg-muted/20 border-none'}>
                    <SelectValue placeholder="Select Customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeCustomers?.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.companyName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {!isRepeatJob && metadata.customerId && (
                <div className="space-y-2 p-3 bg-primary/5 border border-primary/20 rounded-md animate-in slide-in-from-top-2">
                  <Label className="text-[9px] font-black uppercase text-primary flex items-center gap-1">
                    <Palette className="h-3 w-3" /> Approved Design
                  </Label>
                  <Select value={selectedDesignId} onValueChange={setSelectedDesignId}>
                    <SelectTrigger className="bg-background border-primary/30 h-8 text-xs font-bold">
                      <SelectValue placeholder="Select Artwork Master" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredDesigns.map(d => <SelectItem key={d.id} value={d.id}>{d.name} (v{d.version})</SelectItem>)}
                      {filteredDesigns.length === 0 && <SelectItem value="none" disabled>No Approved Designs Found</SelectItem>}
                    </SelectContent>
                  </Select>
                  {filteredDesigns.length === 0 && (
                    <p className="text-[8px] text-destructive font-bold uppercase mt-1">Design approval required before estimation.</p>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase">Product Code</Label>
                <Input 
                  value={metadata.productCode} 
                  onChange={(e) => setMetadata(p => ({...p, productCode: e.target.value}))}
                  placeholder="e.g. LAB-50100-CH"
                  className="bg-muted/20 border-none font-bold"
                />
              </div>

              <Separator className="my-4" />
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase">Length (mm)</Label>
                  <Input name="labelLength" type="number" value={inputs.labelLength} onChange={handleInputChange} className="font-mono font-bold" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase">Width (mm)</Label>
                  <Input name="labelWidth" type="number" value={inputs.labelWidth} onChange={handleInputChange} className="font-mono font-bold" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase">Order Quantity</Label>
                <Input name="orderQuantity" type="number" value={inputs.orderQuantity} onChange={handleInputChange} className="text-xl font-black text-primary" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border-none shadow-lg bg-zinc-900 text-white">
              <CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-zinc-400">Layout Metrics</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-y-4 text-sm font-bold">
                <div className="text-zinc-500">Labels Across:</div>
                <div className="text-right font-mono">{results.labelAcross}</div>
                <div className="text-zinc-500">Running Meter:</div>
                <div className="text-right text-primary font-mono">{results.runningMeter.toFixed(2)} m</div>
                <div className="text-zinc-500">Total SQM Req:</div>
                <div className="text-right font-mono">{results.totalMaterialRequiredSqM.toFixed(2)}</div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-lg bg-zinc-900 text-white">
              <CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-zinc-400">Cost Breakdown</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-y-4 text-sm font-bold">
                <div className="text-zinc-500">Production Cost:</div>
                <div className="text-right font-mono text-emerald-400">₹{results.totalCost.toFixed(2)}</div>
                <div className="text-xl font-black text-white">Grand Total:</div>
                <div className="text-2xl font-black text-right text-primary">₹{results.totalSellingPrice.toLocaleString(undefined, {maximumFractionDigits: 0})}</div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-none shadow-2xl overflow-hidden bg-primary">
            <CardHeader className="py-4 border-b border-white/10">
              <CardTitle className="flex items-center justify-between text-white font-black uppercase tracking-widest text-lg">
                <span>Contract Analysis</span>
                <Badge className="bg-white text-primary font-black">QTY: {inputs.orderQuantity.toLocaleString()}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-8 pb-12 flex flex-col items-center justify-center space-y-8 bg-white/5 backdrop-blur-sm">
              <div className="grid grid-cols-3 gap-12 w-full text-center text-white">
                <div className="space-y-1">
                  <p className="text-[9px] font-black uppercase opacity-70 tracking-widest">Price / Label</p>
                  <p className="text-4xl font-black tracking-tighter">₹{results.sellingPricePerLabel.toFixed(3)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[9px] font-black uppercase opacity-70 tracking-widest">Profit %</p>
                  <p className="text-4xl font-black tracking-tighter">{results.profitPercent.toFixed(1)}%</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[9px] font-black uppercase opacity-70 tracking-widest">Net Margin</p>
                  <p className="text-4xl font-black tracking-tighter">₹{results.profit.toLocaleString(undefined, {maximumFractionDigits: 0})}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
