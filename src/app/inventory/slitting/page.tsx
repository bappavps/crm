
"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Scissors, Plus, Loader2, ArrowRightLeft, RefreshCw, Briefcase } from "lucide-react"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog"
import { useFirestore, useUser, useCollection, useMemoFirebase, useDoc } from "@/firebase"
import { collection, doc } from "firebase/firestore"
import { addDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase/non-blocking-updates"
import { useToast } from "@/hooks/use-toast"

export default function SlittingPage() {
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

  // Roll Settings
  const settingsDocRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'settings', 'roll-numbering');
  }, [firestore]);
  const { data: settings } = useDoc(settingsDocRef);

  // Firestore Queries
  const jumboQuery = useMemoFirebase(() => {
    if (!firestore || !user || !adminData) return null;
    return collection(firestore, 'jumbo_stock');
  }, [firestore, user, adminData])

  const slittedQuery = useMemoFirebase(() => {
    if (!firestore || !user || !adminData) return null;
    return collection(firestore, 'inventoryItems');
  }, [firestore, user, adminData])

  const jobsQuery = useMemoFirebase(() => {
    if (!firestore || !user || !adminData) return null;
    return collection(firestore, 'jobs');
  }, [firestore, user, adminData])

  const { data: jumbos, isLoading: jumbosLoading } = useCollection(jumboQuery)
  const { data: inventory, isLoading: itemsLoading } = useCollection(slittedQuery)
  const { data: jobs } = useCollection(jobsQuery)

  const activeJumbos = jumbos?.filter(j => j.status === 'In Stock') || []
  const slittedRolls = inventory?.filter(item => item.itemType === 'Slitted Roll') || []
  const readyJobs = jobs?.filter(job => job.status === 'READY FOR PRODUCTION') || []

  const handleSlittingConversion = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!firestore || !user) return

    const formData = new FormData(e.currentTarget)
    const jumboId = formData.get("jumboId") as string
    const jobId = formData.get("jobId") as string
    
    const selectedJumbo = activeJumbos.find(j => j.id === jumboId)
    const selectedJob = readyJobs.find(j => j.id === jobId)
    
    if (!selectedJumbo || !selectedJob) {
      toast({ variant: "destructive", title: "Error", description: "Jumbo Roll and Job selection required." })
      return
    }

    const slitWidth = Number(formData.get("slitWidth"))
    const numRolls = Number(formData.get("numRolls"))

    // 1. Mark Jumbo as "Consumed"
    updateDocumentNonBlocking(doc(firestore, 'jumbo_stock', jumboId), {
      status: "Consumed",
      updatedAt: new Date().toISOString()
    })

    // 2. Update Job status
    updateDocumentNonBlocking(doc(firestore, 'jobs', jobId), {
      status: "MATERIAL ASSIGNED",
      updatedAt: new Date().toISOString()
    })

    // 3. Create Slitted Rolls with Job Assignment
    const sep = settings?.separator || "-"
    const prefixType = settings?.childRollPrefixType || "Alphabet"

    for (let i = 0; i < numRolls; i++) {
      let childId = ""
      if (prefixType === "Alphabet") {
        childId = String.fromCharCode(65 + i)
      } else {
        childId = (i + 1).toString()
      }

      const generatedBarcode = `${selectedJumbo.rollNo}${sep}${childId}`

      const slitData = {
        barcode: generatedBarcode,
        name: `Slitted: ${selectedJumbo.paperType}`,
        parentJumboId: jumboId,
        parentRollNo: selectedJumbo.rollNo,
        itemType: "Slitted Roll",
        dimensions: `${slitWidth}mm x ${selectedJumbo.lengthMeters}m`,
        currentQuantity: 1,
        unitOfMeasure: "roll",
        location: "Production Ready",
        status: "ASSIGNED",
        assigned_job_id: selectedJob.jobId,
        assigned_job_name: selectedJob.jobName,
        assigned_date: new Date().toISOString(),
        assigned_user: user.displayName || user.email?.split('@')[0] || "Operator",
        createdAt: new Date().toISOString(),
        createdById: user.uid
      }
      addDocumentNonBlocking(collection(firestore, 'inventoryItems'), slitData)
    }

    setIsDialogOpen(false)
    toast({
      title: "Conversion Successful",
      description: `Material assigned to Job ${selectedJob.jobId}.`
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">Slitting (Job Assignment)</h2>
          <p className="text-muted-foreground">Production department converts Jumbo rolls using Design-released Job IDs.</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)} className="bg-primary hover:bg-primary/90">
          <Scissors className="mr-2 h-4 w-4" /> Start Slitting Run
        </Button>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleSlittingConversion}>
            <DialogHeader>
              <DialogTitle>Execute Slitting & Assign Job</DialogTitle>
              <DialogDescription>Production: Select an existing Job ID from the Design team.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="jobId">Select Design Job ID</Label>
                <Select name="jobId" required>
                  <SelectTrigger><SelectValue placeholder="Select Job Released by Design" /></SelectTrigger>
                  <SelectContent>
                    {readyJobs.map((j) => (
                      <SelectItem key={j.id} value={j.id}>{j.jobId} - {j.jobName}</SelectItem>
                    ))}
                    {readyJobs.length === 0 && <SelectItem value="none" disabled>No jobs released by Design</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="jumboId">Source Jumbo Roll</Label>
                <Select name="jumboId" required>
                  <SelectTrigger><SelectValue placeholder="Choose source roll" /></SelectTrigger>
                  <SelectContent>
                    {activeJumbos.map((j) => (
                      <SelectItem key={j.id} value={j.id}>{j.rollNo} - {j.paperType} ({j.widthMm}mm)</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="slitWidth">Slit Width (mm)</Label>
                  <Input id="slitWidth" name="slitWidth" type="number" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="numRolls">Roll Count</Label>
                  <Input id="numRolls" name="numRolls" type="number" defaultValue={1} required />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" className="w-full">Convert & Assign Material</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1 border-primary/20">
          <CardHeader><CardTitle className="text-sm font-bold flex items-center gap-2"><ArrowRightLeft className="h-4 w-4 text-primary" /> Assignment Rules</CardTitle></CardHeader>
          <CardContent className="text-xs space-y-4 text-muted-foreground leading-relaxed">
            <div className="p-3 bg-muted rounded-md border border-dashed">
              <p className="font-bold text-foreground mb-1">Production Controls:</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>Production **CANNOT** create Jobs.</li>
                <li>Production selects Jobs from Design dropdown.</li>
                <li>Slitting assigns material to the selected Job.</li>
                <li>Job status &rarr; MATERIAL ASSIGNED.</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader><CardTitle className="text-lg flex items-center gap-2"><RefreshCw className="h-5 w-5 text-primary" /> Assigned Slitted Roll Stock</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Roll ID</TableHead>
                  <TableHead>Assigned Job</TableHead>
                  <TableHead>Dimensions</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {itemsLoading ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-10"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></TableCell></TableRow>
                ) : slittedRolls.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-xs font-bold">{s.barcode}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-primary">{s.assigned_job_id || 'Unassigned'}</span>
                        <span className="text-[10px] text-muted-foreground">{s.assigned_job_name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs font-mono">{s.dimensions}</TableCell>
                    <TableCell><Badge variant={s.status === 'ASSIGNED' ? 'default' : 'secondary'}>{s.status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
