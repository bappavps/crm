
"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FilePlus, Search, Loader2, Calendar, User, Hash, Info, Briefcase } from "lucide-react"
import { useFirestore, useUser, useCollection, useMemoFirebase, useDoc } from "@/firebase"
import { collection, doc, query, where, getDocs } from "firebase/firestore"
import { addDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase/non-blocking-updates"
import { useToast } from "@/hooks/use-toast"

export default function CreateJobPage() {
  const { toast } = useToast()
  const { user } = useUser()
  const firestore = useFirestore()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)

  // Data Queries
  const jobsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'jobs');
  }, [firestore])

  const customersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'customers');
  }, [firestore])

  const settingsDocRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'job_settings', 'unique-id-config');
  }, [firestore]);

  const { data: jobs, isLoading: jobsLoading } = useCollection(jobsQuery)
  const { data: customers } = useCollection(customersQuery)
  const { data: settings } = useDoc(settingsDocRef)

  const handleCreateJob = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!firestore || !user || !settings) return

    setIsGenerating(true)
    const formData = new FormData(e.currentTarget)
    const customerId = formData.get("customerId") as string
    const product = formData.get("product") as string
    const selectedCustomer = customers?.find(c => c.id === customerId)

    // Sequence Management Logic
    const currentSeq = Number(settings.currentSequence || 0) + 1
    const year = new Date().getFullYear().toString()
    const displayYear = settings.yearFormat === 'YYYY' ? year : year.slice(-2)
    const paddedNum = currentSeq.toString().padStart(settings.numberLength || 4, "0")
    const sep = settings.separator || "-"
    const jobId = `${settings.jobPrefix || "JOB"}${sep}${displayYear}${sep}${paddedNum}`

    // Uniqueness Double Check (Server Side Search)
    const q = query(collection(firestore, 'jobs'), where("job_id", "==", jobId))
    const snap = await getDocs(q)
    
    if (!snap.empty) {
      toast({ variant: "destructive", title: "ID Collision", description: "This Job ID already exists. Retrying sequence..." })
      setIsGenerating(false)
      return
    }

    const jobData = {
      job_id: jobId,
      customer: selectedCustomer?.name || "Unknown",
      customerId: customerId,
      product,
      status: "READY FOR PRODUCTION",
      created_date: new Date().toISOString(),
      created_by: user.uid,
      created_by_name: user.displayName || user.email?.split('@')[0] || "Sales Executive"
    }

    // 1. Create the Job
    addDocumentNonBlocking(collection(firestore, 'jobs'), jobData)

    // 2. Update sequence in settings
    updateDocumentNonBlocking(settingsDocRef!, { currentSequence: currentSeq })

    setIsDialogOpen(false)
    setIsGenerating(false)
    toast({
      title: "Job Initialized",
      description: `New Job ${jobId} has been registered and released to Design.`
    })
  }

  const filteredJobs = jobs?.filter(job => 
    (job.job_id || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (job.customer || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (job.product || "").toLowerCase().includes(searchQuery.toLowerCase())
  ) || []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">Master Job Registry</h2>
          <p className="text-muted-foreground">Initialize new production jobs with unique enterprise IDs.</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)} className="bg-primary hover:bg-primary/90 shadow-lg">
          <FilePlus className="mr-2 h-4 w-4" /> Initialize New Job
        </Button>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleCreateJob}>
            <DialogHeader>
              <DialogTitle>New Job Entry</DialogTitle>
              <DialogDescription>ID will be auto-generated based on global numbering rules.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="customerId">Select Customer</Label>
                <Select name="customerId" required>
                  <SelectTrigger><SelectValue placeholder="Choose client" /></SelectTrigger>
                  <SelectContent>
                    {customers?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="product">Product Description</Label>
                <Input id="product" name="product" placeholder="e.g. 50ml Pharma Label" required />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" className="w-full h-12" disabled={isGenerating}>
                {isGenerating ? <Loader2 className="animate-spin mr-2" /> : "Confirm & Release ID"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Card className="border-primary/10">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-primary" /> Active Job Board
          </CardTitle>
          <div className="relative w-72">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search ID, Client or Product..." 
              className="pl-8" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="font-bold">JOB ID</TableHead>
                <TableHead className="font-bold">CUSTOMER</TableHead>
                <TableHead className="font-bold">PRODUCT</TableHead>
                <TableHead className="font-bold">STATUS</TableHead>
                <TableHead className="font-bold">INITIALIZED</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobsLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-10"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></TableCell></TableRow>
              ) : filteredJobs.map((j) => (
                <TableRow key={j.id} className="hover:bg-primary/5 transition-colors group">
                  <TableCell className="font-black text-primary tracking-tighter">{j.job_id}</TableCell>
                  <TableCell className="font-medium">{j.customer}</TableCell>
                  <TableCell className="text-sm">{j.product}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-[10px] uppercase font-bold px-2 h-5 bg-emerald-50 text-emerald-700 border-emerald-100">
                      {j.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-[10px] text-muted-foreground">
                    <div className="flex flex-col">
                      <span className="flex items-center gap-1 font-bold"><Calendar className="h-3 w-3" /> {new Date(j.created_date).toLocaleDateString()}</span>
                      <span className="flex items-center gap-1"><User className="h-3 w-3" /> {j.created_by_name}</span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredJobs.length === 0 && !jobsLoading && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-20 text-muted-foreground italic">
                    <Hash className="h-12 w-12 opacity-10 mx-auto mb-2" />
                    No jobs found in the registry.
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
