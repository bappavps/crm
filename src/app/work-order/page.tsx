
"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ClipboardList, Plus, Loader2, Calendar as CalIcon } from "lucide-react"
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
import { addDocumentNonBlocking } from "@/firebase/non-blocking-updates"
import { useToast } from "@/hooks/use-toast"

export default function WorkOrderPage() {
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
  const workOrdersQuery = useMemoFirebase(() => {
    if (!firestore || !user || !adminData) return null;
    return collection(firestore, 'workOrders');
  }, [firestore, user, adminData])

  const jobCardsQuery = useMemoFirebase(() => {
    if (!firestore || !user || !adminData) return null;
    return collection(firestore, 'jobCards');
  }, [firestore, user, adminData])

  const machinesQuery = useMemoFirebase(() => {
    if (!firestore || !user || !adminData) return null;
    return collection(firestore, 'machines');
  }, [firestore, user, adminData])

  const { data: workOrders, isLoading: woLoading } = useCollection(workOrdersQuery)
  const { data: jobCards } = useCollection(jobCardsQuery)
  const { data: machines } = useCollection(machinesQuery)

  const handleCreateWorkOrder = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!firestore || !user) return

    const formData = new FormData(e.currentTarget)
    const jobCardId = formData.get("jobCardId") as string
    const machineId = formData.get("machineId") as string
    const type = formData.get("type") as string
    const priority = formData.get("priority") as string

    const selectedJob = jobCards?.find(jc => jc.id === jobCardId)
    const selectedMachine = machines?.find(m => m.id === machineId)

    const woData = {
      workOrderNumber: `WO-${Date.now().toString().slice(-6)}`,
      jobCardId,
      jobDescription: selectedJob?.label || "Unknown Job",
      client: selectedJob?.client || "Unknown Client",
      type,
      machine: selectedMachine?.name || "Unassigned",
      priority,
      status: "Scheduled",
      createdById: user.uid,
      createdAt: new Date().toISOString()
    }

    addDocumentNonBlocking(collection(firestore, 'workOrders'), woData)

    setIsDialogOpen(false)
    toast({
      title: "Work Order Created",
      description: `${woData.workOrderNumber} has been scheduled for ${woData.machine}.`
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">Work Orders</h2>
          <p className="text-muted-foreground">Planning and scheduling production tasks for the factory floor.</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)} className="bg-primary hover:bg-primary/90">
          <Plus className="mr-2 h-4 w-4" /> Create Work Order
        </Button>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleCreateWorkOrder}>
            <DialogHeader>
              <DialogTitle>New Production Work Order</DialogTitle>
              <DialogDescription>Assign a Job Card to a machine and set scheduling priority.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="jobCardId">Link Job Card</Label>
                <Select name="jobCardId" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Job" />
                  </SelectTrigger>
                  <SelectContent>
                    {jobCards?.map((jc) => (
                      <SelectItem key={jc.id} value={jc.id}>
                        {jc.jobCardNumber} - {jc.label}
                      </SelectItem>
                    ))}
                    {(!jobCards || jobCards.length === 0) && (
                      <div className="p-2 text-xs text-muted-foreground text-center">No active job cards found</div>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="machineId">Production Machine</Label>
                <Select name="machineId" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Machine" />
                  </SelectTrigger>
                  <SelectContent>
                    {machines?.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="type">Order Type</Label>
                  <Select name="type" defaultValue="New">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="New">New</SelectItem>
                      <SelectItem value="Reprint">Reprint</SelectItem>
                      <SelectItem value="Correction">Correction</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="priority">Priority</Label>
                  <Select name="priority" defaultValue="Medium">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="High">High</SelectItem>
                      <SelectItem value="Medium">Medium</SelectItem>
                      <SelectItem value="Low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit">Schedule Work Order</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" /> Active Work Order Registry
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>WO ID</TableHead>
                <TableHead>Job Description</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Machine</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {woLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                    <p className="text-xs text-muted-foreground mt-2">Fetching schedules...</p>
                  </TableCell>
                </TableRow>
              ) : workOrders?.map((wo) => (
                <TableRow key={wo.id}>
                  <TableCell className="font-bold font-mono text-xs">{wo.workOrderNumber}</TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium text-sm">{wo.jobDescription}</span>
                      <span className="text-[10px] text-muted-foreground uppercase">{wo.client}</span>
                    </div>
                  </TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px]">{wo.type}</Badge></TableCell>
                  <TableCell>
                    <span className={`text-xs font-bold ${
                      wo.priority === 'High' ? 'text-destructive' : 
                      wo.priority === 'Medium' ? 'text-primary' : 
                      'text-emerald-600'
                    }`}>
                      {wo.priority}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{wo.machine}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-[10px]">{wo.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm">Modify</Button>
                  </TableCell>
                </TableRow>
              ))}
              {(!workOrders || workOrders.length === 0) && !woLoading && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <CalIcon className="h-8 w-8 opacity-20" />
                      <p>No work orders scheduled. Create one to begin floor planning.</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
