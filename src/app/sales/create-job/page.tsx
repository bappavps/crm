
"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FilePlus, Loader2, Factory, User, Calendar, AlertCircle, ShoppingCart, ArrowRight } from "lucide-react"
import { useFirestore, useUser, useCollection, useMemoFirebase, useDoc, errorEmitter, FirestorePermissionError } from "@/firebase"
import { collection, doc, runTransaction, query, where } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { Separator } from "@/components/ui/separator"

export default function CreateJobPage() {
  const { toast } = useToast()
  const { user } = useUser()
  const firestore = useFirestore()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedOrderId, setSelectedOrderId] = useState<string>("")

  // Production Scheduling State
  const [scheduling, setScheduling] = useState({
    machineId: "",
    operatorId: "",
    priority: "Medium",
    startDate: new Date().toISOString().split('T')[0],
    estimatedCompletion: ""
  })

  // 1. Data Queries
  const ordersQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'salesOrders'), where("status", "==", "Confirmed"));
  }, [firestore, user])

  const machinesQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, 'machines');
  }, [firestore, user])

  const usersQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, 'users');
  }, [firestore, user])

  const estimatesQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, 'estimates');
  }, [firestore, user])

  const jobsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, 'jobs');
  }, [firestore, user])

  const { data: salesOrders, isLoading: ordersLoading } = useCollection(ordersQuery)
  const { data: machines } = useCollection(machinesQuery)
  const { data: allUsers } = useCollection(usersQuery)
  const { data: estimates } = useCollection(estimatesQuery)
  const { data: existingJobs } = useCollection(jobsQuery)

  const operators = useMemo(() => 
    allUsers?.filter(u => u.roles?.includes('Operator') || u.roles?.includes('Admin')) || []
  , [allUsers])

  const selectedOrder = useMemo(() => 
    salesOrders?.find(o => o.id === selectedOrderId)
  , [salesOrders, selectedOrderId])

  const linkedEstimate = useMemo(() => {
    if (!selectedOrder?.estimateId) return null
    return estimates?.find(e => e.id === selectedOrder.estimateId)
  }, [selectedOrder, estimates])

  // Check if job already exists for this order
  const jobExists = useMemo(() => 
    existingJobs?.some(j => j.salesOrderId === selectedOrderId)
  , [existingJobs, selectedOrderId])

  const handleCreateJob = () => {
    if (!firestore || !user || !selectedOrder) return
    
    if (jobExists) {
      toast({ variant: "destructive", title: "Error", description: "A production job already exists for this Sales Order." })
      return
    }

    if (!scheduling.machineId || !scheduling.operatorId) {
      toast({ variant: "destructive", title: "Validation Error", description: "Machine and Operator are required for production setup." })
      return
    }

    setIsSubmitting(true)

    runTransaction(firestore, async (transaction) => {
      // 1. Sequence Counter
      const counterRef = doc(firestore, 'counters', 'job_counter');
      const counterSnap = await transaction.get(counterRef);
      const now = new Date();
      const year = now.getFullYear().toString();
      let currentNumber = 1;
      
      if (counterSnap.exists()) {
        const data = counterSnap.data();
        if (data.year === year) {
          currentNumber = data.current_number + 1;
        }
      }

      const paddedNum = currentNumber.toString().padStart(4, "0");
      const jobNumber = `JOB-${year}-${paddedNum}`;
      const jobRef = doc(collection(firestore, 'jobs'));
      const jobId = jobRef.id;

      // 2. Prepare Master Data
      const masterData = {
        id: jobId,
        jobNumber,
        salesOrderId: selectedOrderId,
        orderNumber: selectedOrder.orderNumber,
        clientName: selectedOrder.customerName,
        itemNameSummary: selectedOrder.productCode,
        status: "In Production",
        currentStage: "Production",
        priority: scheduling.priority,
        machineId: scheduling.machineId,
        machineName: machines?.find(m => m.id === scheduling.machineId)?.name || "N/A",
        operatorId: scheduling.operatorId,
        operatorName: operators?.find(o => o.id === scheduling.operatorId)?.firstName || "N/A",
        startDate: scheduling.startDate,
        estimatedCompletion: scheduling.estimatedCompletion,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        createdById: user.uid
      };

      // 3. Technical Sub-doc (Merge SO + Estimate data)
      const techRef = doc(firestore, `jobs/${jobId}/technical/details`);
      const techData = {
        items: [{
          itemName: selectedOrder.productCode,
          quantity: selectedOrder.qty,
          material: linkedEstimate?.material || "Standard",
          widthMM: linkedEstimate?.labelWidth || 0,
          heightMM: linkedEstimate?.labelLength || 0,
          repeatLength: linkedEstimate?.repeatLength || 0,
          across: linkedEstimate?.labelAcross || 0,
          around: linkedEstimate?.labelAround || 0
        }],
        machineId: scheduling.machineId,
        operatorId: scheduling.operatorId,
        planning_status: 'Released'
      };

      // 4. Update Sales Order Status
      const orderRef = doc(firestore, 'salesOrders', selectedOrderId);
      
      transaction.set(counterRef, { year, current_number: currentNumber }, { merge: true });
      transaction.set(jobRef, masterData);
      transaction.set(techRef, techData);
      transaction.update(orderRef, { status: "In Production", jobId: jobId });

    }).then(() => {
      setIsSubmitting(false)
      toast({ title: "Job Initialized", description: `Production JOB ${selectedOrder?.orderNumber} is now live on the floor.` })
      setSelectedOrderId("")
      setScheduling({
        machineId: "",
        operatorId: "",
        priority: "Medium",
        startDate: new Date().toISOString().split('T')[0],
        estimatedCompletion: ""
      })
    }).catch(async (serverError) => {
      setIsSubmitting(false)
      const permissionError = new FirestorePermissionError({
        path: 'jobs',
        operation: 'create',
      });
      errorEmitter.emit('permission-error', permissionError);
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">Initialize Production Job</h2>
          <p className="text-muted-foreground">Bridge confirmed Sales Orders to the production floor.</p>
        </div>
        <Button 
          onClick={handleCreateJob} 
          disabled={isSubmitting || !selectedOrderId || jobExists} 
          className="h-12 px-8 text-lg font-bold"
        >
          {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <FilePlus className="mr-2 h-5 w-5" />}
          Send to Floor
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Step 1: Order Selection */}
        <Card className="lg:col-span-1 border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-sm font-bold uppercase flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-primary" /> 1. Select Sales Order
            </CardTitle>
            <CardDescription>Only confirmed orders waiting for production are shown.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Source Sales Order</Label>
              <Select value={selectedOrderId} onValueChange={setSelectedOrderId}>
                <SelectTrigger className="h-12 border-primary/20 bg-background">
                  <SelectValue placeholder={ordersLoading ? "Loading Orders..." : "Choose Confirmed Order"} />
                </SelectTrigger>
                <SelectContent>
                  {salesOrders?.map(o => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.orderNumber} - {o.customerName}
                    </SelectItem>
                  ))}
                  {salesOrders?.length === 0 && (
                    <div className="p-2 text-xs text-muted-foreground text-center">No confirmed orders found.</div>
                  )}
                </SelectContent>
              </Select>
            </div>

            {jobExists && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md flex items-start gap-2 animate-in fade-in slide-in-from-top-1">
                <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
                <p className="text-[10px] text-destructive font-bold uppercase">This order is already being processed in a different job card.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Step 2: Auto-filled Details */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-bold uppercase flex items-center gap-2">
              <ArrowRight className="h-4 w-4 text-primary" /> 2. Order Specification (Read-Only)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedOrder ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Client Name</Label>
                    <p className="font-bold text-lg">{selectedOrder.customerName}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Product Code</Label>
                    <p className="font-mono text-primary font-black">{selectedOrder.productCode}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Material Specification</Label>
                    <Badge variant="outline" className="h-7 text-xs px-3 bg-muted/50">
                      {linkedEstimate?.material || "Not Specified in Estimate"}
                    </Badge>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Final Quantity</Label>
                    <p className="text-2xl font-black text-accent">{selectedOrder.qty?.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">Labels</span></p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Delivery Commitment</Label>
                    <div className="flex items-center gap-2 text-sm font-bold">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      {new Date(selectedOrder.deliveryDate).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-muted-foreground flex flex-col items-center gap-2">
                <ShoppingCart className="h-12 w-12 opacity-10" />
                <p className="text-sm italic">Select a Sales Order to view specifications.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Step 3: Production Scheduling */}
        <Card className={selectedOrderId ? "lg:col-span-3 border-emerald-500/20 shadow-lg" : "lg:col-span-3 opacity-50 grayscale pointer-events-none"}>
          <CardHeader className="bg-emerald-50/50">
            <CardTitle className="text-sm font-bold uppercase flex items-center gap-2 text-emerald-700">
              <Factory className="h-4 w-4" /> 3. Factory Floor Scheduling
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase">Assign Machine</Label>
                <Select value={scheduling.machineId} onValueChange={(val) => setScheduling({...scheduling, machineId: val})}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Select Production Line" />
                  </SelectTrigger>
                  <SelectContent>
                    {machines?.map(m => <SelectItem key={m.id} value={m.id}>{m.name} ({m.maxPrintingWidthMm}mm)</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase">Floor Operator</Label>
                <Select value={scheduling.operatorId} onValueChange={(val) => setScheduling({...scheduling, operatorId: val})}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Select Technician" />
                  </SelectTrigger>
                  <SelectContent>
                    {operators.map(o => <SelectItem key={o.id} value={o.id}>{o.firstName} {o.lastName}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase">Production Priority</Label>
                <Select value={scheduling.priority} onValueChange={(val) => setScheduling({...scheduling, priority: val})}>
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Critical">Critical (Immediate)</SelectItem>
                    <SelectItem value="High">High</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="Low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator className="my-6" />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase flex items-center gap-2">
                  <Calendar className="h-3 w-3" /> Job Start Date
                </Label>
                <Input type="date" value={scheduling.startDate} onChange={(e) => setScheduling({...scheduling, startDate: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase flex items-center gap-2">
                  <Calendar className="h-3 w-3 text-accent" /> Estimated Completion
                </Label>
                <Input type="date" value={scheduling.estimatedCompletion} onChange={(e) => setScheduling({...scheduling, estimatedCompletion: e.target.value})} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
