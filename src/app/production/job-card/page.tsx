
"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { FilePlus, Play, CheckCircle2, Loader2, Clock, Factory } from "lucide-react"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useFirestore, useUser, useCollection, useMemoFirebase, useDoc } from "@/firebase"
import { collection, doc } from "firebase/firestore"
import { addDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase/non-blocking-updates"
import { useToast } from "@/hooks/use-toast"

export default function ProductionJobCardPage() {
  const { toast } = useToast()
  const { user } = useUser()
  const firestore = useFirestore()
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  // Authorization check
  const adminDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'adminUsers', user.uid);
  }, [firestore, user]);
  const { data: adminData } = useDoc(adminDocRef);

  // Firestore Queries
  const jobCardsQuery = useMemoFirebase(() => {
    if (!firestore || !user || !adminData) return null;
    return collection(firestore, 'jobCards');
  }, [firestore, user, adminData])

  const salesOrdersQuery = useMemoFirebase(() => {
    if (!firestore || !user || !adminData) return null;
    return collection(firestore, 'salesOrders');
  }, [firestore, user, adminData])

  const inventoryQuery = useMemoFirebase(() => {
    if (!firestore || !user || !adminData) return null;
    return collection(firestore, 'inventoryItems');
  }, [firestore, user, adminData])

  const { data: jobCards, isLoading: jobsLoading } = useCollection(jobCardsQuery)
  const { data: salesOrders } = useCollection(salesOrdersQuery)
  const { data: inventory } = useCollection(inventoryQuery)

  const slittedRolls = inventory?.filter(item => item.itemType === 'Slitted Roll' && item.status === 'In Stock') || []

  const handleCreateJob = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!firestore || !user) return

    const formData = new FormData(e.currentTarget)
    const salesOrderId = formData.get("salesOrderId") as string
    const slittedRollId = formData.get("slittedRollId") as string
    const selectedOrder = salesOrders?.find(so => so.id === salesOrderId)

    if (!selectedOrder) {
      toast({ variant: "destructive", title: "Error", description: "Select a Sales Order." })
      return
    }

    const jobData = {
      jobCardNumber: `JC-${Date.now().toString().slice(-6)}`,
      salesOrderId: selectedOrder.id,
      estimateId: selectedOrder.estimateId || "",
      client: selectedOrder.customerName || "Internal",
      label: selectedOrder.productCode || "Custom Label",
      productionQuantity: selectedOrder.qty || 0,
      slittedRollId,
      startDate: formData.get("startDate") as string,
      dueDate: formData.get("dueDate") as string,
      status: "Setup",
      progress: 0,
      createdById: user.uid,
      createdAt: new Date().toISOString()
    }

    addDocumentNonBlocking(collection(firestore, 'jobCards'), jobData)

    setIsDialogOpen(false)
    toast({
      title: "Job Card Created",
      description: `New Job ${jobData.jobCardNumber} has been queued. Material roll assigned.`
    })
  }

  const handleStartShift = (job: any) => {
    if (!firestore) return

    // 1. Update Job Status
    updateDocumentNonBlocking(doc(firestore, 'jobCards', job.id), {
      status: 'Running',
      progress: 5
    })

    // 2. Automatically reduce/consume Slitted Stock
    if (job.slittedRollId) {
      updateDocumentNonBlocking(doc(firestore, 'inventoryItems', job.slittedRollId), {
        status: 'In Production',
        updatedAt: new Date().toISOString()
      })
    }

    toast({
      title: "Press Started",
      description: `Job ${job.jobCardNumber} is now running. Slitted roll consumed.`
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">Job Cards (Printing)</h2>
          <p className="text-muted-foreground">Manage printing press instructions and automated stock consumption.</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)} className="bg-primary hover:bg-primary/90">
          <FilePlus className="mr-2 h-4 w-4" /> Create New Job
        </Button>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleCreateJob}>
            <DialogHeader>
              <DialogTitle>Initialize Production Job</DialogTitle>
              <DialogDescription>Convert a sales order and assign a slitted roll.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="salesOrderId">Reference Sales Order</Label>
                <Select name="salesOrderId" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select confirmed order" />
                  </SelectTrigger>
                  <SelectContent>
                    {salesOrders?.map((so) => (
                      <SelectItem key={so.id} value={so.id}>
                        {so.orderNumber} - {so.customerName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="slittedRollId">Assign Slitted Roll</Label>
                <Select name="slittedRollId" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select material stock" />
                  </SelectTrigger>
                  <SelectContent>
                    {slittedRolls.map((roll) => (
                      <SelectItem key={roll.id} value={roll.id}>
                        {roll.barcode} ({roll.dimensions})
                      </SelectItem>
                    ))}
                    {slittedRolls.length === 0 && (
                      <SelectItem value="none" disabled>No slitted rolls in stock</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input id="startDate" name="startDate" type="date" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="dueDate">Due Date</Label>
                  <Input id="dueDate" name="dueDate" type="date" required />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit">Initialize press job</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {jobsLoading ? (
          <div className="col-span-full flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin mb-4 text-primary" />
            <p>Syncing press jobs...</p>
          </div>
        ) : jobCards?.map((job) => (
          <Card key={job.id} className="relative overflow-hidden group hover:shadow-lg transition-all border-l-4 border-l-primary">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-mono font-bold text-muted-foreground">{job.jobCardNumber}</span>
                <Badge className={
                  job.status === 'Running' ? 'bg-emerald-500' : 
                  job.status === 'Pending' ? 'bg-amber-500' : 
                  job.status === 'Setup' ? 'bg-primary' : 'bg-slate-500'
                }>{job.status}</Badge>
              </div>
              <CardTitle className="text-base pt-1 truncate">{job.label}</CardTitle>
              <p className="text-xs font-semibold text-primary truncate">{job.client}</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-[10px] uppercase font-bold text-muted-foreground">
                <div>Quantity:</div>
                <div className="text-right text-foreground">{job.productionQuantity?.toLocaleString()}</div>
                <div>Roll ID:</div>
                <div className="text-right text-primary truncate">{job.slittedRollId?.slice(-6) || 'None'}</div>
              </div>
              
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] font-bold uppercase">
                  <span>Progress</span>
                  <span>{job.progress || 0}%</span>
                </div>
                <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-500" 
                    style={{ width: `${job.progress || 0}%` }}
                  />
                </div>
              </div>
              
              <div className="pt-2">
                {job.status === 'Running' ? (
                  <Button variant="outline" size="sm" className="w-full text-accent border-accent hover:bg-accent hover:text-white h-8">Pause press</Button>
                ) : job.status === 'Completed' ? (
                  <Button variant="ghost" size="sm" className="w-full text-emerald-600 font-bold h-8"><CheckCircle2 className="mr-2 h-3 w-3" /> QA Report</Button>
                ) : (
                  <Button size="sm" className="w-full h-8" onClick={() => handleStartShift(job)}><Play className="mr-2 h-3 w-3" /> Start printing</Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        {(!jobCards || jobCards.length === 0) && !jobsLoading && (
          <div className="col-span-full border-2 border-dashed rounded-xl py-20 text-center space-y-4">
            <Factory className="h-12 w-12 text-muted-foreground/20 mx-auto" />
            <div className="space-y-1">
              <p className="font-bold text-muted-foreground">Press Idle</p>
              <p className="text-sm text-muted-foreground/60">Initialize a Job Card to start printing.</p>
            </div>
            <Button variant="outline" onClick={() => setIsDialogOpen(true)}>New Entry</Button>
          </div>
        )}
      </div>
    </div>
  )
}
