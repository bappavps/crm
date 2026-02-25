
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
import { ListTodo, Plus, Loader2, Calendar, User, Search, FilterX, Download, Settings2, Trash2, Briefcase } from "lucide-react"
import { useFirestore, useUser, useCollection, useMemoFirebase, useDoc } from "@/firebase"
import { collection, doc } from "firebase/firestore"
import { addDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase/non-blocking-updates"
import { useToast } from "@/hooks/use-toast"

export default function JobPlanningPage() {
  const { toast } = useToast()
  const { user } = useUser()
  const firestore = useFirestore()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isCoreManageOpen, setIsCoreManageOpen] = useState(false)
  const [newCoreName, setNewCoreName] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")

  // Authorization check
  const adminDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'adminUsers', user.uid);
  }, [firestore, user]);
  const { data: adminData } = useDoc(adminDocRef);

  // Firestore Queries
  const planningQuery = useMemoFirebase(() => {
    if (!firestore || !user || !adminData) return null;
    return collection(firestore, 'job_planning');
  }, [firestore, user, adminData])

  const coreSizesQuery = useMemoFirebase(() => {
    if (!firestore || !user || !adminData) return null;
    return collection(firestore, 'core_sizes');
  }, [firestore, user, adminData])

  const masterJobsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'jobs');
  }, [firestore])

  const { data: jobs, isLoading } = useCollection(planningQuery)
  const { data: coreSizes } = useCollection(coreSizesQuery)
  const { data: masterJobs } = useCollection(masterJobsQuery)

  const handleCreateJob = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!firestore || !user) return

    const formData = new FormData(e.currentTarget)
    const masterJobId = formData.get("master_job_id") as string
    const selectedMaster = masterJobs?.find(j => j.job_id === masterJobId)
    
    const jobData = {
      master_job_id: masterJobId,
      serial_no: formData.get("serial_no") as string,
      order_date: formData.get("order_date") as string,
      planning_status: formData.get("planning_status") as string,
      plate_no: formData.get("plate_no") as string,
      job_name: selectedMaster?.product || formData.get("job_name") as string,
      label_size: formData.get("label_size") as string,
      repeat_length: Number(formData.get("repeat_length")),
      material: formData.get("material") as string,
      paper_width: Number(formData.get("paper_width")),
      die_type: formData.get("die_type") as string,
      allocate_meters: Number(formData.get("allocate_meters")),
      label_qty: Number(formData.get("label_qty")),
      core_size: formData.get("core_size") as string,
      qty_per_roll: Number(formData.get("qty_per_roll")),
      roll_direction: formData.get("roll_direction") as string,
      remarks: formData.get("remarks") as string,
      status: "READY FOR PRODUCTION",
      created_date: new Date().toISOString(),
      created_by: user.uid,
      created_by_name: user.displayName || user.email?.split('@')[0] || "Designer"
    }

    addDocumentNonBlocking(collection(firestore, 'job_planning'), jobData)

    setIsDialogOpen(false)
    toast({
      title: "Job Planned",
      description: `${jobData.job_name} has been added to the master planning board.`
    })
  }

  const handleAddCoreSize = () => {
    if (!firestore || !newCoreName.trim()) return
    const id = crypto.randomUUID()
    addDocumentNonBlocking(collection(firestore, 'core_sizes'), { id, name: newCoreName.trim() })
    setNewCoreName("")
    toast({ title: "Core Size Added", description: `Added ${newCoreName} to the master list.` })
  }

  const handleDeleteCoreSize = (id: string, name: string) => {
    if (!firestore) return
    deleteDocumentNonBlocking(doc(firestore, 'core_sizes', id))
    toast({ title: "Core Size Removed", description: `${name} has been deleted.` })
  }

  const resetFilters = () => {
    setSearchQuery("")
    setStatusFilter("all")
    toast({ title: "Filters Reset", description: "Showing all job plans." })
  }

  const filteredJobs = jobs?.filter(job => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = 
      (job.job_name || "").toLowerCase().includes(q) ||
      (job.plate_no || "").toLowerCase().includes(q) ||
      (job.master_job_id || "").toLowerCase().includes(q) ||
      (job.serial_no || "").toLowerCase().includes(q);
    
    const matchesStatus = statusFilter === "all" || job.planning_status === statusFilter;
    
    return matchesSearch && matchesStatus;
  }) || []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">Job Planning Board</h2>
          <p className="text-muted-foreground">Technical master source linked to unique sales Job IDs.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => toast({ title: "Export", description: "Downloading master plan..." })}><Download className="mr-2 h-4 w-4" /> Export Board</Button>
          <Button onClick={() => setIsDialogOpen(true)} className="bg-primary hover:bg-primary/90">
            <Plus className="mr-2 h-4 w-4" /> New Plan Entry
          </Button>
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleCreateJob}>
            <DialogHeader>
              <DialogTitle>Create Master Job Plan</DialogTitle>
              <DialogDescription>Input technical parameters linked to a master Job ID.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="master_job_id" className="font-bold text-primary">Select Unique Job ID</Label>
                  <Select name="master_job_id" required>
                    <SelectTrigger><SelectValue placeholder="Choose Sales Job" /></SelectTrigger>
                    <SelectContent>
                      {masterJobs?.map(j => (
                        <SelectItem key={j.id} value={j.job_id}>{j.job_id} - {j.customer}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="order_date">Order Date</Label>
                  <Input id="order_date" name="order_date" type="date" required defaultValue={new Date().toISOString().split('T')[0]} />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="serial_no">Serial No</Label>
                  <Input id="serial_no" name="serial_no" placeholder="e.g. 001" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="plate_no">Plate No</Label>
                  <Input id="plate_no" name="plate_no" placeholder="PL-4501" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="planning_status">Planning Status</Label>
                  <Select name="planning_status" defaultValue="Pending">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Pending">Pending</SelectItem>
                      <SelectItem value="In Progress">In Progress</SelectItem>
                      <SelectItem value="Released">Released</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="job_name">Internal Job Name</Label>
                  <Input id="job_name" name="job_name" placeholder="Leave empty to use Sales product name" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="material">Substrate</Label>
                  <Input id="material" name="material" placeholder="Semi-Gloss / PP" required />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="label_size">Label Size (mm)</Label>
                  <Input id="label_size" name="label_size" placeholder="50x100" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="repeat_length">Repeat Length (mm)</Label>
                  <Input id="repeat_length" name="repeat_length" type="number" step="0.01" placeholder="508" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="die_type">Die Type</Label>
                  <Input id="die_type" name="die_type" placeholder="Rotary / Flatbed" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 bg-primary/5 p-4 rounded-lg border border-dashed border-primary/30">
                <div className="grid gap-2">
                  <Label htmlFor="paper_width" className="text-primary font-bold">Paper Width (mm)</Label>
                  <Input id="paper_width" name="paper_width" type="number" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="allocate_meters" className="text-primary font-bold">Allocate Meters (m)</Label>
                  <Input id="allocate_meters" name="allocate_meters" type="number" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="label_qty" className="text-primary font-bold">Label Quantity</Label>
                  <Input id="label_qty" name="label_qty" type="number" required />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="core_size">Core Size</Label>
                    <Button type="button" variant="ghost" size="icon" className="h-4 w-4 text-primary" onClick={() => setIsCoreManageOpen(true)}>
                      <Settings2 className="h-3 w-3" />
                    </Button>
                  </div>
                  <Select name="core_size" defaultValue="3 Inch">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {coreSizes?.map(core => (
                        <SelectItem key={core.id} value={core.name}>{core.name}</SelectItem>
                      ))}
                      {(!coreSizes || coreSizes.length === 0) && <SelectItem value="3 Inch">3 Inch</SelectItem>}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="qty_per_roll">Qty Per Roll</Label>
                  <Input id="qty_per_roll" name="qty_per_roll" type="number" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="roll_direction">Roll Direction</Label>
                  <Select name="roll_direction" defaultValue="Head Out">
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
                <Textarea id="remarks" name="remarks" placeholder="Color codes, varnish specifications, etc." />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" className="w-full h-12 text-lg">Release Master Plan</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Core Size Management Dialog */}
      <Dialog open={isCoreManageOpen} onOpenChange={setIsCoreManageOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Manage Core Sizes</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex gap-2">
              <Input placeholder="e.g. 1.5 Inch" value={newCoreName} onChange={(e) => setNewCoreName(e.target.value)} />
              <Button onClick={handleAddCoreSize} size="icon"><Plus className="h-4 w-4" /></Button>
            </div>
            <div className="border rounded-md max-h-[200px] overflow-y-auto">
              <Table>
                <TableBody>
                  {coreSizes?.map((core) => (
                    <TableRow key={core.id}>
                      <TableCell className="font-medium">{core.name}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" className="text-destructive h-8 w-8" onClick={() => handleDeleteCoreSize(core.id, core.name)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setIsCoreManageOpen(false)} className="w-full">Done</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <ListTodo className="h-5 w-5 text-primary" /> Technical Plan Registry
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search Job ID or Plate..." 
                className="pl-8 text-xs" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px] text-xs">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Plans</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="In Progress">In Progress</SelectItem>
                <SelectItem value="Released">Released</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={resetFilters} title="Clear Filters"><FilterX className="h-4 w-4" /></Button>
          </div>
        </CardHeader>
        <CardContent className="p-0 border-t">
          <div className="overflow-x-auto">
            <Table className="min-w-[2800px]">
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[150px] text-[10px] font-black border-r">UNIQUE JOB ID</TableHead>
                  <TableHead className="w-[100px] text-[10px] font-bold border-r">SERIAL NO</TableHead>
                  <TableHead className="w-[120px] text-[10px] font-bold border-r">ORDER DATE</TableHead>
                  <TableHead className="w-[150px] text-[10px] font-bold border-r">PLAN STATUS</TableHead>
                  <TableHead className="w-[120px] text-[10px] font-bold border-r">PLATE NO</TableHead>
                  <TableHead className="w-[200px] text-[10px] font-bold border-r">PRODUCT NAME</TableHead>
                  <TableHead className="w-[120px] text-[10px] font-bold border-r">SIZE</TableHead>
                  <TableHead className="w-[120px] text-[10px] font-bold border-r">REPEAT</TableHead>
                  <TableHead className="w-[150px] text-[10px] font-bold border-r">SUBSTRATE</TableHead>
                  <TableHead className="w-[120px] text-[10px] font-bold border-r">WIDTH (MM)</TableHead>
                  <TableHead className="w-[120px] text-[10px] font-bold border-r">DIE TYPE</TableHead>
                  <TableHead className="w-[150px] text-[10px] font-bold border-r">ALLOC. METERS</TableHead>
                  <TableHead className="w-[120px] text-[10px] font-bold border-r">LABEL QTY</TableHead>
                  <TableHead className="w-[100px] text-[10px] font-bold border-r">CORE</TableHead>
                  <TableHead className="w-[120px] text-[10px] font-bold border-r">QTY/ROLL</TableHead>
                  <TableHead className="w-[150px] text-[10px] font-bold border-r">DIRECTION</TableHead>
                  <TableHead className="w-[250px] text-[10px] font-bold border-r">REMARKS</TableHead>
                  <TableHead className="w-[150px] text-[10px] font-bold border-r">STATUS</TableHead>
                  <TableHead className="w-[150px] text-[10px] font-bold">CREATED BY</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={19} className="text-center py-10"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></TableCell></TableRow>
                ) : filteredJobs.map((j) => (
                  <TableRow key={j.id} className="hover:bg-muted/30">
                    <TableCell className="text-xs font-black text-primary border-r">{j.master_job_id}</TableCell>
                    <TableCell className="text-xs border-r">{j.serial_no}</TableCell>
                    <TableCell className="text-xs border-r">{j.order_date}</TableCell>
                    <TableCell className="border-r"><Badge variant="secondary" className="text-[9px] px-1 h-5">{j.planning_status}</Badge></TableCell>
                    <TableCell className="text-xs font-bold border-r">{j.plate_no}</TableCell>
                    <TableCell className="text-xs border-r">{j.job_name}</TableCell>
                    <TableCell className="text-xs border-r">{j.label_size}</TableCell>
                    <TableCell className="text-xs font-mono border-r">{j.repeat_length}mm</TableCell>
                    <TableCell className="text-xs border-r">{j.material}</TableCell>
                    <TableCell className="text-xs font-bold border-r">{j.paper_width}mm</TableCell>
                    <TableCell className="text-xs border-r">{j.die_type || '-'}</TableCell>
                    <TableCell className="text-xs font-bold text-accent border-r">{j.allocate_meters}m</TableCell>
                    <TableCell className="text-xs border-r">{j.label_qty?.toLocaleString()}</TableCell>
                    <TableCell className="text-xs border-r">{j.core_size}</TableCell>
                    <TableCell className="text-xs border-r">{j.qty_per_roll}</TableCell>
                    <TableCell className="text-xs border-r">{j.roll_direction}</TableCell>
                    <TableCell className="text-xs italic text-muted-foreground truncate max-w-[200px] border-r">{j.remarks || '-'}</TableCell>
                    <TableCell className="border-r">
                      <Badge className={j.status === 'READY FOR PRODUCTION' ? 'bg-emerald-500' : 'bg-primary'} style={{ fontSize: '9px' }}>
                        {j.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{j.created_by_name}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
