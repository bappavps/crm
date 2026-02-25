
"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ListTodo, Plus, Loader2, Calendar, User, Search, FilterX, Download } from "lucide-react"
import { useFirestore, useUser, useCollection, useMemoFirebase, useDoc } from "@/firebase"
import { collection, doc } from "firebase/firestore"
import { addDocumentNonBlocking } from "@/firebase/non-blocking-updates"
import { useToast } from "@/hooks/use-toast"

export default function ProductionPlanningPage() {
  const { toast } = useToast()
  const { user } = useUser()
  const firestore = useFirestore()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  // Authorization check
  const adminDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'adminUsers', user.uid);
  }, [firestore, user]);
  const { data: adminData } = useDoc(adminDocRef);

  // Firestore Queries
  const planningQuery = useMemoFirebase(() => {
    if (!firestore || !user || !adminData) return null;
    return collection(firestore, 'production_jobs');
  }, [firestore, user, adminData])

  const { data: jobs, isLoading } = useCollection(planningQuery)

  const handleCreateJob = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!firestore || !user) return

    const formData = new FormData(e.currentTarget)
    
    const jobData = {
      orderDate: formData.get("orderDate") as string,
      plateNo: formData.get("plateNo") as string,
      jobName: formData.get("jobName") as string,
      labelSize: formData.get("labelSize") as string,
      repeatLength: Number(formData.get("repeatLength")),
      material: formData.get("material") as string,
      requiredPaperWidth: Number(formData.get("requiredPaperWidth")),
      requiredRunningMeter: Number(formData.get("requiredRunningMeter")),
      labelQuantity: Number(formData.get("labelQuantity")),
      coreSize: formData.get("coreSize") as string,
      qtyPerRoll: Number(formData.get("qtyPerRoll")),
      rollDirection: formData.get("rollDirection") as string,
      remarks: formData.get("remarks") as string,
      status: "READY FOR PRODUCTION",
      createdAt: new Date().toISOString(),
      createdById: user.uid,
      createdByName: user.displayName || user.email?.split('@')[0] || "Designer"
    }

    addDocumentNonBlocking(collection(firestore, 'production_jobs'), jobData)

    setIsDialogOpen(false)
    toast({
      title: "Job Planned",
      description: `${jobData.jobName} has been released to Production.`
    })
  }

  const filteredJobs = jobs?.filter(job => 
    job.jobName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    job.plateNo?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">Production Planning</h2>
          <p className="text-muted-foreground">Design Department: Define technical specifications for the shop floor.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => toast({ title: "Export", description: "Downloading Planning Sheet..." })}><Download className="mr-2 h-4 w-4" /> Export Excel</Button>
          <Button onClick={() => setIsDialogOpen(true)} className="bg-primary hover:bg-primary/90">
            <Plus className="mr-2 h-4 w-4" /> Create New Plan
          </Button>
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleCreateJob}>
            <DialogHeader>
              <DialogTitle>Job Planning Sheet</DialogTitle>
              <DialogDescription>Enter technical specifications for narrow web production.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-6 py-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="orderDate">Order Date</Label>
                  <Input id="orderDate" name="orderDate" type="date" required defaultValue={new Date().toISOString().split('T')[0]} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="plateNo">Plate No</Label>
                  <Input id="plateNo" name="plateNo" placeholder="e.g. PL-4501" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="jobName">Job Name</Label>
                  <Input id="jobName" name="jobName" placeholder="Product Title" required />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="labelSize">Label Size (mm)</Label>
                  <Input id="labelSize" name="labelSize" placeholder="50x100" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="repeatLength">Repeat (mm)</Label>
                  <Input id="repeatLength" name="repeatLength" type="number" placeholder="508" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="material">Substrate</Label>
                  <Input id="material" name="material" placeholder="Semi-Gloss / PP" required />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 bg-muted/20 p-4 rounded-lg border border-dashed">
                <div className="grid gap-2">
                  <Label htmlFor="requiredPaperWidth" className="text-primary font-bold">Paper Width (mm)</Label>
                  <Input id="requiredPaperWidth" name="requiredPaperWidth" type="number" placeholder="Slitting size" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="requiredRunningMeter" className="text-primary font-bold">Running Meter (m)</Label>
                  <Input id="requiredRunningMeter" name="requiredRunningMeter" type="number" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="labelQuantity">Total Label Qty</Label>
                  <Input id="labelQuantity" name="labelQuantity" type="number" required />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="coreSize">Core Size</Label>
                  <Select name="coreSize" defaultValue="3 Inch">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1 Inch">1 Inch</SelectItem>
                      <SelectItem value="3 Inch">3 Inch</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="qtyPerRoll">Qty Per Roll</Label>
                  <Input id="qtyPerRoll" name="qtyPerRoll" type="number" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="rollDirection">Roll Direction</Label>
                  <Select name="rollDirection" defaultValue="Head Out">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Head Out">Head Out</SelectItem>
                      <SelectItem value="Foot Out">Foot Out</SelectItem>
                      <SelectItem value="Left Out">Left Out</SelectItem>
                      <SelectItem value="Right Out">Right Out</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="remarks">Remarks / Special Instructions</Label>
                <Textarea id="remarks" name="remarks" placeholder="Color sequence, varnish type, etc." />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" className="w-full h-12 text-lg">Release Planning Sheet</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <ListTodo className="h-5 w-5 text-primary" /> Active Planning Registry
          </CardTitle>
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search by Job or Plate..." 
              className="pl-8" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="min-w-[1800px]">
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[120px]">Order Date</TableHead>
                  <TableHead className="w-[120px]">Plate No</TableHead>
                  <TableHead className="w-[200px]">Job Name</TableHead>
                  <TableHead className="w-[100px]">Size</TableHead>
                  <TableHead className="w-[100px]">Repeat</TableHead>
                  <TableHead className="w-[150px]">Material</TableHead>
                  <TableHead className="w-[120px]">Paper Width</TableHead>
                  <TableHead className="w-[120px]">Run Meter</TableHead>
                  <TableHead className="w-[120px]">Label Qty</TableHead>
                  <TableHead className="w-[100px]">Core</TableHead>
                  <TableHead className="w-[100px]">Qty/Roll</TableHead>
                  <TableHead className="w-[120px]">Direction</TableHead>
                  <TableHead className="w-[150px]">Status</TableHead>
                  <TableHead className="w-[150px]">Created By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={14} className="text-center py-10"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></TableCell></TableRow>
                ) : filteredJobs.map((j) => (
                  <TableRow key={j.id} className="hover:bg-muted/30">
                    <TableCell className="text-xs">{new Date(j.orderDate).toLocaleDateString()}</TableCell>
                    <TableCell className="font-bold text-primary">{j.plateNo}</TableCell>
                    <TableCell className="font-medium">{j.jobName}</TableCell>
                    <TableCell className="text-xs">{j.labelSize}</TableCell>
                    <TableCell className="text-xs font-mono">{j.repeatLength}mm</TableCell>
                    <TableCell className="text-xs">{j.material}</TableCell>
                    <TableCell className="text-xs font-bold">{j.requiredPaperWidth}mm</TableCell>
                    <TableCell className="text-xs font-bold text-accent">{j.requiredRunningMeter}m</TableCell>
                    <TableCell className="text-xs">{j.labelQuantity?.toLocaleString()}</TableCell>
                    <TableCell className="text-xs">{j.coreSize}</TableCell>
                    <TableCell className="text-xs">{j.qtyPerRoll}</TableCell>
                    <TableCell className="text-xs">{j.rollDirection}</TableCell>
                    <TableCell>
                      <Badge className={
                        j.status === 'READY FOR PRODUCTION' ? 'bg-emerald-500' : 
                        j.status === 'MATERIAL ASSIGNED' ? 'bg-primary' : 'bg-slate-500'
                      }>
                        {j.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{j.createdByName}</TableCell>
                  </TableRow>
                ))}
                {filteredJobs.length === 0 && !isLoading && (
                  <TableRow><TableCell colSpan={14} className="text-center py-20 text-muted-foreground italic">No production plans found.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
