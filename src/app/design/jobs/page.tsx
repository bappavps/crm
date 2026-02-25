
"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Briefcase, Plus, Loader2, Calendar, User, Search, FilterX } from "lucide-react"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useFirestore, useUser, useCollection, useMemoFirebase, useDoc } from "@/firebase"
import { collection, doc } from "firebase/firestore"
import { addDocumentNonBlocking } from "@/firebase/non-blocking-updates"
import { useToast } from "@/hooks/use-toast"

export default function JobsPage() {
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
  const jobsQuery = useMemoFirebase(() => {
    if (!firestore || !user || !adminData) return null;
    return collection(firestore, 'jobs');
  }, [firestore, user, adminData])

  const customersQuery = useMemoFirebase(() => {
    if (!firestore || !user || !adminData) return null;
    return collection(firestore, 'customers');
  }, [firestore, user, adminData])

  const { data: jobs, isLoading: jobsLoading } = useCollection(jobsQuery)
  const { data: customers } = useCollection(customersQuery)

  const handleCreateJob = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!firestore || !user) return

    const formData = new FormData(e.currentTarget)
    const customerId = formData.get("customerId") as string
    const selectedCustomer = customers?.find(c => c.id === customerId)

    const jobId = `JOB-${Date.now().toString().slice(-6)}`
    const jobData = {
      jobId,
      jobName: formData.get("jobName") as string,
      customerName: selectedCustomer?.name || "Manual Customer",
      labelWidth: Number(formData.get("labelWidth")),
      labelHeight: Number(formData.get("labelHeight")),
      requiredPaperWidth: Number(formData.get("requiredPaperWidth")),
      requiredPaperLength: Number(formData.get("requiredPaperLength")),
      materialType: formData.get("materialType") as string,
      status: "READY FOR PRODUCTION",
      createdById: user.uid,
      createdByName: user.displayName || user.email?.split('@')[0] || "Designer",
      createdAt: new Date().toISOString()
    }

    addDocumentNonBlocking(collection(firestore, 'jobs'), jobData)

    setIsDialogOpen(false)
    toast({
      title: "Job Created",
      description: `${jobId} is now READY FOR PRODUCTION.`
    })
  }

  const filteredJobs = jobs?.filter(job => 
    job.jobId.toLowerCase().includes(searchQuery.toLowerCase()) ||
    job.jobName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    job.customerName.toLowerCase().includes(searchQuery.toLowerCase())
  ) || []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">Job Planning (Design)</h2>
          <p className="text-muted-foreground">Define technical job parameters for production assignment.</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)} className="bg-primary hover:bg-primary/90">
          <Plus className="mr-2 h-4 w-4" /> Create New Job
        </Button>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleCreateJob}>
            <DialogHeader>
              <DialogTitle>Initialize New Production Job</DialogTitle>
              <DialogDescription>Set technical specifications for the floor team.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="customerId">Select Customer</Label>
                <Select name="customerId" required>
                  <SelectTrigger><SelectValue placeholder="Choose a Customer" /></SelectTrigger>
                  <SelectContent>
                    {customers?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="jobName">Job Name / Product</Label>
                <Input id="jobName" name="jobName" placeholder="e.g. Pharma Label 50ml" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="labelWidth">Label Width (mm)</Label>
                  <Input id="labelWidth" name="labelWidth" type="number" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="labelHeight">Label Height (mm)</Label>
                  <Input id="labelHeight" name="labelHeight" type="number" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="requiredPaperWidth">Paper Width (mm)</Label>
                  <Input id="requiredPaperWidth" name="requiredPaperWidth" type="number" placeholder="Slitting Size" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="requiredPaperLength">Paper Length (m)</Label>
                  <Input id="requiredPaperLength" name="requiredPaperLength" type="number" required />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="materialType">Substrate Type</Label>
                <Select name="materialType" defaultValue="Semi-Gloss Paper">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Semi-Gloss Paper">Semi-Gloss Paper</SelectItem>
                    <SelectItem value="PP Clear">PP Clear</SelectItem>
                    <SelectItem value="Silver Metallized">Silver Metallized</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" className="w-full">Release to Production</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-primary" /> Active Job Registry
          </CardTitle>
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search jobs..." 
              className="pl-8" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job ID</TableHead>
                <TableHead>Job Name</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Dimensions</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobsLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-10"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></TableCell></TableRow>
              ) : filteredJobs.map((j) => (
                <TableRow key={j.id}>
                  <TableCell className="font-bold text-primary">{j.jobId}</TableCell>
                  <TableCell className="font-medium">{j.jobName}</TableCell>
                  <TableCell>{j.customerName}</TableCell>
                  <TableCell className="text-xs">{j.labelWidth}x{j.labelHeight} mm • {j.requiredPaperWidth} mm width</TableCell>
                  <TableCell>
                    <Badge className={
                      j.status === 'READY FOR PRODUCTION' ? 'bg-emerald-500' : 
                      j.status === 'MATERIAL ASSIGNED' ? 'bg-primary' : 'bg-slate-500'
                    }>
                      {j.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    <div className="flex flex-col">
                      <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {new Date(j.createdAt).toLocaleDateString()}</span>
                      <span className="flex items-center gap-1"><User className="h-3 w-3" /> {j.createdByName}</span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredJobs.length === 0 && !jobsLoading && (
                <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground italic">No jobs found.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
