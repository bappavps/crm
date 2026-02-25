
"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Truck, Package, MapPin, Plus, Loader2, FileText } from "lucide-react"
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
import { Textarea } from "@/components/ui/textarea"
import { useFirestore, useUser, useCollection, useMemoFirebase, useDoc } from "@/firebase"
import { collection, doc } from "firebase/firestore"
import { addDocumentNonBlocking } from "@/firebase/non-blocking-updates"
import { useToast } from "@/hooks/use-toast"

export default function DispatchPage() {
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
  const dispatchQuery = useMemoFirebase(() => {
    if (!firestore || !user || !adminData) return null;
    return collection(firestore, 'dispatchChallans');
  }, [firestore, user, adminData])

  const jobCardsQuery = useMemoFirebase(() => {
    if (!firestore || !user || !adminData) return null;
    return collection(firestore, 'jobCards');
  }, [firestore, user, adminData])

  const { data: dispatchChallans, isLoading: dispatchLoading } = useCollection(dispatchQuery)
  const { data: jobCards } = useCollection(jobCardsQuery)

  const handleCreateDispatch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!firestore || !user) return

    const formData = new FormData(e.currentTarget)
    const jobCardId = formData.get("jobCardId") as string
    const selectedJob = jobCards?.find(j => j.id === jobCardId)

    if (!selectedJob) {
      toast({ variant: "destructive", title: "Error", description: "Please select a valid Job Card." })
      return
    }

    const dispatchData = {
      challanNumber: `DC-${Date.now().toString().slice(-6)}`,
      salesOrderId: selectedJob.salesOrderId || "N/A",
      customerId: selectedJob.customerId || "N/A",
      customerName: selectedJob.client || "Unknown Customer",
      jobCardNumber: selectedJob.jobCardNumber,
      dispatchDate: formData.get("dispatchDate") as string || new Date().toISOString(),
      shippingAddress: formData.get("shippingAddress") as string,
      status: "Pending",
      notes: formData.get("notes") as string || "",
      createdById: user.uid,
      createdAt: new Date().toISOString()
    }

    addDocumentNonBlocking(collection(firestore, 'dispatchChallans'), dispatchData)

    setIsDialogOpen(false)
    toast({
      title: "Dispatch Created",
      description: `Note ${dispatchData.challanNumber} has been recorded for ${dispatchData.customerName}.`
    })
  }

  const readyForDispatch = dispatchChallans?.filter(d => d.status === 'Pending') || []
  const inTransit = dispatchChallans?.filter(d => d.status === 'Dispatched') || []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">Dispatch & Logistics</h2>
          <p className="text-muted-foreground">Managing deliveries, packing lists, and transport tracking.</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}><Truck className="mr-2 h-4 w-4" /> Create Dispatch Note</Button>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleCreateDispatch}>
            <DialogHeader>
              <DialogTitle>Create New Dispatch Note</DialogTitle>
              <DialogDescription>Link a finished Job Card to a delivery destination.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="jobCardId">Reference Job Card</Label>
                <Select name="jobCardId" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Finished Job" />
                  </SelectTrigger>
                  <SelectContent>
                    {jobCards?.map((jc) => (
                      <SelectItem key={jc.id} value={jc.id}>
                        {jc.jobCardNumber} - {jc.client}
                      </SelectItem>
                    ))}
                    {(!jobCards || jobCards.length === 0) && (
                      <div className="p-2 text-xs text-muted-foreground text-center">No active job cards found</div>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="dispatchDate">Dispatch Date</Label>
                <Input id="dispatchDate" name="dispatchDate" type="date" required defaultValue={new Date().toISOString().split('T')[0]} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="shippingAddress">Shipping Address</Label>
                <Textarea id="shippingAddress" name="shippingAddress" placeholder="Full delivery address..." required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="notes">Logistics Notes</Label>
                <Input id="notes" name="notes" placeholder="Vehicle number, courier ref, etc." />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit">Finalize Dispatch</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" /> Ready for Dispatch
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {dispatchLoading ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin mb-2" />
                <p className="text-xs">Loading manifest...</p>
              </div>
            ) : readyForDispatch.length > 0 ? (
              readyForDispatch.map((dispatch) => (
                <div key={dispatch.id} className="p-4 border rounded-lg bg-muted/20 space-y-2 group hover:border-primary transition-colors">
                  <div className="flex justify-between">
                    <span className="font-bold text-sm">{dispatch.challanNumber}</span>
                    <Badge variant="outline" className="text-[10px]">{dispatch.jobCardNumber}</Badge>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold">{dispatch.customerName}</p>
                    <p className="text-xs text-muted-foreground flex items-start gap-1">
                      <MapPin className="h-3 w-3 mt-0.5 shrink-0" /> 
                      <span className="line-clamp-2">{dispatch.shippingAddress}</span>
                    </p>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button size="sm" variant="outline" className="flex-1 text-[10px] h-7" onClick={() => toast({ title: "Print Queue", description: "Generating packing slip PDF..." })}>
                      <FileText className="h-3 w-3 mr-1" /> Slip
                    </Button>
                    <Button size="sm" className="flex-1 text-[10px] h-7" onClick={() => toast({ title: "Shipment Updated", description: "Status changed to In Transit." })}>
                      Confirm Dispatch
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-10 border-2 border-dashed rounded-lg">
                <Package className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">No pending dispatches.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Truck className="h-5 w-5 text-primary" /> In Transit
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {dispatchLoading ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin mb-2" />
              </div>
            ) : inTransit.length > 0 ? (
              inTransit.map((dispatch) => (
                <div key={dispatch.id} className="p-4 border rounded-lg bg-emerald-50/30 border-emerald-100 space-y-2">
                  <div className="flex justify-between">
                    <span className="font-bold text-sm">{dispatch.challanNumber}</span>
                    <Badge className="bg-emerald-500 text-[10px]">Shifting</Badge>
                  </div>
                  <p className="text-sm font-semibold">{dispatch.customerName}</p>
                  <p className="text-[10px] text-muted-foreground italic">Dispatched on {new Date(dispatch.dispatchDate).toLocaleDateString()}</p>
                  <Button variant="ghost" size="sm" className="w-full text-[10px] h-7 mt-2" onClick={() => toast({ title: "Track Logistics", description: "Connecting to GPS provider..." })}>Track Vehicle</Button>
                </div>
              ))
            ) : (
              <div className="text-center py-10 flex flex-col items-center justify-center">
                <Truck className="h-12 w-12 text-muted-foreground mx-auto mb-2 opacity-20" />
                <p className="text-sm text-muted-foreground">No active shipments currently in transit.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
