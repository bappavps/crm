
"use client"

import { useState, useMemo, useEffect } from "react"
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
import { ListTodo, Loader2, Search, FilterX, Download, Settings2, Lock, Pencil, ShieldAlert, Trash2 } from "lucide-react"
import { useFirestore, useUser, useCollection, useMemoFirebase, useDoc } from "@/firebase"
import { collection, doc, query, where } from "firebase/firestore"
import { updateDocumentNonBlocking, addDocumentNonBlocking } from "@/firebase/non-blocking-updates"
import { useToast } from "@/hooks/use-toast"

export default function JobPlanningPage() {
  const { toast } = useToast()
  const { user } = useUser()
  const firestore = useFirestore()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isCoreManageOpen, setIsCoreManageOpen] = useState(false)
  const [editingJob, setEditingJob] = useState<any>(null)
  const [newCoreName, setNewCoreName] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Authorization check
  const adminDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'adminUsers', user.uid);
  }, [firestore, user]);
  const { data: adminData } = useDoc(adminDocRef);

  const isAdmin = !!adminData;

  // Query: ONLY Approved Jobs from 'jobs' collection
  const planningQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'jobs'), where("status", "==", "Approved"));
  }, [firestore, user])

  const coreSizesQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, 'core_sizes');
  }, [firestore, user])

  const { data: jobs, isLoading } = useCollection(planningQuery)
  const { data: coreSizes } = useCollection(coreSizesQuery)

  const handleSaveJob = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!firestore || !user || !editingJob) return

    const formData = new FormData(e.currentTarget)
    const now = new Date();
    
    // Technical parameters to be saved back to the 'jobs' document
    const technicalData: any = {
      serial_no: formData.get("serial_no") as string,
      order_date: formData.get("order_date") as string,
      planning_status: formData.get("planning_status") as string,
      plateNo: formData.get("plate_no") as string,
      repeat_length: Number(formData.get("repeat_length")),
      paper_width: Number(formData.get("paper_width")),
      die_type: formData.get("die_type") as string,
      allocate_meters: Number(formData.get("allocate_meters")),
      core_size: formData.get("core_size") as string,
      qty_per_roll: Number(formData.get("qty_per_roll")),
      remarks: formData.get("remarks") as string,
      technical_updated_at: now.toISOString(),
      technical_updated_by: user.uid,
      // If edit lock didn't exist, set it now (30 min window for Designer)
      edit_lock_time: editingJob.edit_lock_time || new Date(now.getTime() + 30 * 60000).toISOString()
    }

    // Logic for Audit Log
    const auditLogRef = collection(firestore, 'job_audit_log');
    Object.keys(technicalData).forEach(key => {
      if (technicalData[key] !== editingJob[key] && key !== 'technical_updated_at') {
        addDocumentNonBlocking(auditLogRef, {
          job_id: editingJob.id,
          edited_by: user.uid,
          edited_by_name: user.displayName || user.email,
          edited_date: now.toISOString(),
          field: key,
          old_value: editingJob[key] || "N/A",
          new_value: technicalData[key]
        });
      }
    });

    updateDocumentNonBlocking(doc(firestore, 'jobs', editingJob.id), technicalData);
    
    toast({ 
      title: "Technical Plan Saved", 
      description: "Specifications have been attached to the Master Job document." 
    });

    setIsDialogOpen(false)
    setEditingJob(null)
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
    updateDocumentNonBlocking(doc(firestore, 'core_sizes', id), { deleted: true }) // Soft delete or actual delete
    toast({ title: "Core Size Removed", description: `${name} has been deleted.` })
  }

  const isJobLocked = (job: any) => {
    if (!isMounted) return true;
    if (isAdmin) return false;
    if (!job.edit_lock_time) return false; // Not yet planned
    const now = new Date();
    const lockTime = new Date(job.edit_lock_time);
    return now > lockTime;
  }

  const filteredJobs = jobs?.filter(job => {
    const q = searchQuery.toLowerCase();
    const firstItemName = job.items?.[0]?.itemName || "";
    const matchesSearch = 
      (firstItemName).toLowerCase().includes(q) ||
      (job.plateNo || "").toLowerCase().includes(q) ||
      (job.jobNumber || "").toLowerCase().includes(q);
    
    const matchesStatus = statusFilter === "all" || job.planning_status === statusFilter;
    
    return matchesSearch && matchesStatus;
  }) || []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">Technical Planning Board</h2>
          <p className="text-muted-foreground">Master source for Approved Jobs. Populated directly from the Sales registry.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => toast({ title: "Export", description: "Downloading technical board..." })}><Download className="mr-2 h-4 w-4" /> Export Board</Button>
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if(!open) setEditingJob(null); }}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleSaveJob}>
            <DialogHeader>
              <DialogTitle>Edit Technical Specifications</DialogTitle>
              <DialogDescription>
                Updating technical parameters for Job: <span className="font-bold text-primary">{editingJob?.jobNumber}</span>
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label className="text-muted-foreground uppercase text-[10px] font-bold">Unique Job ID (Read Only)</Label>
                  <Input value={editingJob?.jobNumber} readOnly className="bg-muted" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="order_date">Order Date</Label>
                  <Input 
                    id="order_date" 
                    name="order_date" 
                    type="date" 
                    required 
                    defaultValue={editingJob?.order_date || (editingJob?.createdAt?.seconds ? new Date(editingJob.createdAt.seconds * 1000).toISOString().split('T')[0] : '')} 
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="serial_no">Serial No</Label>
                  <Input id="serial_no" name="serial_no" placeholder="e.g. 001" defaultValue={editingJob?.serial_no} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="plate_no">Plate No</Label>
                  <Input id="plate_no" name="plate_no" placeholder="PL-4501" required defaultValue={editingJob?.plateNo} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="planning_status">Plan Status</Label>
                  <Select name="planning_status" defaultValue={editingJob?.planning_status || "Pending"}>
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
                  <Label>Job Name (from Sales)</Label>
                  <Input value={editingJob?.items?.[0]?.itemName} readOnly className="bg-muted" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="material">Substrate</Label>
                  <Input id="material" name="material" value={editingJob?.items?.[0]?.material} readOnly className="bg-muted" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="grid gap-2">
                  <Label>Label Size (mm)</Label>
                  <Input value={`${editingJob?.items?.[0]?.widthMM}x${editingJob?.items?.[0]?.heightMM}`} readOnly className="bg-muted" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="repeat_length">Repeat Length (mm)</Label>
                  <Input id="repeat_length" name="repeat_length" type="number" step="0.01" placeholder="508" required defaultValue={editingJob?.repeat_length} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="die_type">Die Type</Label>
                  <Input id="die_type" name="die_type" placeholder="Rotary / Flatbed" defaultValue={editingJob?.die_type} />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 bg-primary/5 p-4 rounded-lg border border-dashed border-primary/30">
                <div className="grid gap-2">
                  <Label htmlFor="paper_width" className="text-primary font-bold">Paper Width (mm)</Label>
                  <Input id="paper_width" name="paper_width" type="number" required defaultValue={editingJob?.paper_width} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="allocate_meters" className="text-primary font-bold">Allocate Meters (m)</Label>
                  <Input id="allocate_meters" name="allocate_meters" type="number" required defaultValue={editingJob?.allocate_meters} />
                </div>
                <div className="grid gap-2">
                  <Label className="text-primary font-bold">Label Quantity</Label>
                  <Input value={editingJob?.items?.[0]?.quantity?.toLocaleString()} readOnly className="bg-muted" />
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
                  <Select name="core_size" defaultValue={editingJob?.core_size || editingJob?.items?.[0]?.core || "3 Inch"}>
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
                  <Input id="qty_per_roll" name="qty_per_roll" type="number" required defaultValue={editingJob?.qty_per_roll} />
                </div>
                <div className="grid gap-2">
                  <Label>Roll Direction</Label>
                  <Input value={editingJob?.items?.[0]?.rollDirection} readOnly className="bg-muted" />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="remarks">Remarks / Technical Instructions</Label>
                <Textarea id="remarks" name="remarks" placeholder="Technical varnish details, color shades..." defaultValue={editingJob?.remarks} />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" className="w-full h-12 text-lg">
                Update Technical Specifications
              </Button>
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
              <Button onClick={handleAddCoreSize} size="icon"><ListTodo className="h-4 w-4" /></Button>
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
            <ListTodo className="h-5 w-5 text-primary" /> Technical Registry (Synced with Approved Jobs)
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search Job ID, Plate or Name..." 
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
            <Button variant="outline" size="icon" onClick={() => setSearchQuery("")} title="Clear Filters"><FilterX className="h-4 w-4" /></Button>
          </div>
        </CardHeader>
        <CardContent className="p-0 border-t">
          <div className="overflow-x-auto">
            <Table className="min-w-[3200px]">
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[100px] text-[10px] font-black border-r text-center">ACTION</TableHead>
                  <TableHead className="w-[150px] text-[10px] font-black border-r">UNIQUE JOB ID</TableHead>
                  <TableHead className="w-[100px] text-[10px] font-bold border-r">SERIAL NO</TableHead>
                  <TableHead className="w-[120px] text-[10px] font-bold border-r">ORDER DATE</TableHead>
                  <TableHead className="w-[150px] text-[10px] font-bold border-r">PLAN STATUS</TableHead>
                  <TableHead className="w-[120px] text-[10px] font-bold border-r">PLATE NO</TableHead>
                  <TableHead className="w-[200px] text-[10px] font-bold border-r">JOB NAME</TableHead>
                  <TableHead className="w-[120px] text-[10px] font-bold border-r">LABEL SIZE</TableHead>
                  <TableHead className="w-[120px] text-[10px] font-bold border-r">REPEAT LENGTH</TableHead>
                  <TableHead className="w-[150px] text-[10px] font-bold border-r">MATERIAL</TableHead>
                  <TableHead className="w-[120px] text-[10px] font-bold border-r">PAPER WIDTH</TableHead>
                  <TableHead className="w-[120px] text-[10px] font-bold border-r">DIE TYPE</TableHead>
                  <TableHead className="w-[150px] text-[10px] font-bold border-r">ALLOCATE METERS</TableHead>
                  <TableHead className="w-[120px] text-[10px] font-bold border-r">LABEL QTY</TableHead>
                  <TableHead className="w-[100px] text-[10px] font-bold border-r">CORE SIZE</TableHead>
                  <TableHead className="w-[120px] text-[10px] font-bold border-r">QTY PER ROLL</TableHead>
                  <TableHead className="w-[150px] text-[10px] font-bold border-r">ROLL DIRECTION</TableHead>
                  <TableHead className="w-[250px] text-[10px] font-bold border-r">REMARKS</TableHead>
                  <TableHead className="w-[150px] text-[10px] font-bold border-r">STATUS</TableHead>
                  <TableHead className="w-[150px] text-[10px] font-bold border-r">CREATED DATE</TableHead>
                  <TableHead className="w-[150px] text-[10px] font-bold">CREATED BY</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={21} className="text-center py-10"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></TableCell></TableRow>
                ) : filteredJobs.map((j) => {
                  const locked = isJobLocked(j);
                  const firstItem = j.items?.[0] || {};
                  return (
                    <TableRow key={j.id} className="hover:bg-muted/30">
                      <TableCell className="border-r text-center">
                        <div className="flex items-center justify-center gap-1">
                          {locked ? (
                            <div className="flex items-center gap-1 text-[9px] text-muted-foreground bg-muted p-1 rounded border shadow-inner cursor-not-allowed group relative" title="Editing time expired. Contact Admin.">
                              <Lock className="h-3 w-3" />
                              <span className="hidden group-hover:block absolute bottom-full mb-2 bg-black text-white p-1 rounded whitespace-nowrap">Admin Only Override</span>
                            </div>
                          ) : (
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-primary" onClick={() => { setEditingJob(j); setIsDialogOpen(true); }}>
                                <Pencil className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs font-black text-primary border-r">{j.jobNumber}</TableCell>
                      <TableCell className="text-xs border-r">{j.serial_no || '-'}</TableCell>
                      <TableCell className="text-xs border-r">
                        {j.createdAt?.seconds ? new Date(j.createdAt.seconds * 1000).toLocaleDateString() : '-'}
                      </TableCell>
                      <TableCell className="border-r">
                        <Badge variant="secondary" className="text-[9px] px-1 h-5">{j.planning_status || 'Pending'}</Badge>
                      </TableCell>
                      <TableCell className="text-xs font-bold border-r">{j.plateNo || '-'}</TableCell>
                      <TableCell className="text-xs border-r">{firstItem.itemName || '-'}</TableCell>
                      <TableCell className="text-xs border-r">
                        {firstItem.widthMM ? `${firstItem.widthMM}x${firstItem.heightMM}` : '-'}
                      </TableCell>
                      <TableCell className="text-xs font-mono border-r">{j.repeat_length ? `${j.repeat_length}mm` : '-'}</TableCell>
                      <TableCell className="text-xs border-r">{firstItem.material || '-'}</TableCell>
                      <TableCell className="text-xs font-bold border-r">{j.paper_width ? `${j.paper_width}mm` : '-'}</TableCell>
                      <TableCell className="text-xs border-r">{j.die_type || '-'}</TableCell>
                      <TableCell className="text-xs font-bold text-accent border-r">{j.allocate_meters ? `${j.allocate_meters}m` : '-'}</TableCell>
                      <TableCell className="text-xs border-r">{firstItem.quantity?.toLocaleString() || '-'}</TableCell>
                      <TableCell className="text-xs border-r">{j.core_size || firstItem.core || '-'}</TableCell>
                      <TableCell className="text-xs border-r">{j.qty_per_roll || '-'}</TableCell>
                      <TableCell className="text-xs border-r">{firstItem.rollDirection || '-'}</TableCell>
                      <TableCell className="text-xs italic text-muted-foreground truncate max-w-[200px] border-r">{j.remarks || '-'}</TableCell>
                      <TableCell className="border-r">
                        <Badge className="bg-primary text-[9px]">{j.status}</Badge>
                      </TableCell>
                      <TableCell className="text-xs border-r">
                        {j.technical_updated_at ? new Date(j.technical_updated_at).toLocaleDateString() : '-'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{j.salesUserName || '-'}</TableCell>
                    </TableRow>
                  );
                })}
                {filteredJobs.length === 0 && !isLoading && (
                  <TableRow>
                    <TableCell colSpan={21} className="text-center py-20 text-muted-foreground italic">
                      No approved jobs found in the registry.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
