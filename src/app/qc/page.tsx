
"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ShieldCheck, FileCheck, Loader2, AlertCircle } from "lucide-react"
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

export default function QCPage() {
  const { toast } = useToast()
  const { user } = useUser()
  const firestore = useFirestore()
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  // Authorization check
  const adminDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'adminUsers', user.uid);
  }, [firestore, user]);
  const { data: adminData, isLoading: authLoading } = useDoc(adminDocRef);

  // Firestore Queries - Guarded by adminData
  const qcQuery = useMemoFirebase(() => {
    if (!firestore || !user || !adminData) return null;
    return collection(firestore, 'qualityChecks');
  }, [firestore, user, adminData])

  const jobCardsQuery = useMemoFirebase(() => {
    if (!firestore || !user || !adminData) return null;
    return collection(firestore, 'jobCards');
  }, [firestore, user, adminData])

  const { data: qualityChecks, isLoading: qcLoading } = useCollection(qcQuery)
  const { data: jobCards } = useCollection(jobCardsQuery)

  const handleCreateInspection = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!firestore || !user) return

    const formData = new FormData(e.currentTarget)
    const jobCardId = formData.get("jobCardId") as string
    const status = formData.get("status") as string
    
    const selectedJob = jobCards?.find(j => j.id === jobCardId)
    const passedQty = Number(formData.get("passedQuantity")) || 0

    const qcData = {
      jobCardId,
      jobCardNumber: selectedJob?.jobCardNumber || "Unknown",
      clientName: selectedJob?.client || "Unknown",
      inspectorId: user.uid,
      inspectorName: user.displayName || "Inspector",
      status, // Passed, Failed, Rework Required
      checkDate: new Date().toISOString(),
      checkedQuantity: Number(formData.get("checkedQuantity")) || 0,
      passedQuantity: passedQty,
      defectiveQuantity: Number(formData.get("defectiveQuantity")) || 0,
      notes: formData.get("notes") as string || "",
      createdAt: new Date().toISOString()
    }

    addDocumentNonBlocking(collection(firestore, 'qualityChecks'), qcData)

    // AUTOMATIC STOCK FLOW: If QC passes, move quantity to Finished Goods Inventory
    if (status === 'Passed' && passedQty > 0) {
      const fgData = {
        barcode: `FG-${selectedJob?.jobCardNumber || 'JOB'}-${Date.now().toString().slice(-4)}`,
        name: `Finished: ${selectedJob?.label || 'Labels'}`,
        itemType: "Finished Good",
        currentQuantity: passedQty,
        unitOfMeasure: "labels",
        location: "Finished Goods Store",
        status: "In Stock",
        jobCardId: jobCardId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdById: user.uid
      }
      addDocumentNonBlocking(collection(firestore, 'inventoryItems'), fgData)
      
      // Update Job status to completed
      updateDocumentNonBlocking(doc(firestore, 'jobCards', jobCardId), {
        status: 'Completed',
        progress: 100
      })
    }

    setIsDialogOpen(false)
    toast({
      title: "Inspection Recorded",
      description: status === 'Passed' ? `Job ${qcData.jobCardNumber} passed. FG stock automatically created.` : `Report for ${qcData.jobCardNumber} saved.`
    })
  }

  const passReports = qualityChecks?.filter(q => q.status === 'Passed') || []
  const ncrReports = qualityChecks?.filter(q => q.status === 'Failed' || q.status === 'Rework Required') || []

  if (authLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin mb-4 text-primary" />
        <p>Syncing quality records...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">Quality Control</h2>
          <p className="text-muted-foreground">In-process inspection. Passing a report automatically creates Finished Goods stock.</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)} className="bg-primary hover:bg-primary/90">
          <FileCheck className="mr-2 h-4 w-4" /> New Inspection
        </Button>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleCreateInspection}>
            <DialogHeader>
              <DialogTitle>New Quality Inspection</DialogTitle>
              <DialogDescription>Verify production quality. Passing creates FG inventory.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="jobCardId">Job Card Reference</Label>
                <Select name="jobCardId" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Running Job" />
                  </SelectTrigger>
                  <SelectContent>
                    {jobCards?.filter(j => j.status === 'Running').map((jc) => (
                      <SelectItem key={jc.id} value={jc.id}>
                        {jc.jobCardNumber} - {jc.label}
                      </SelectItem>
                    ))}
                    {(!jobCards || jobCards.filter(j => j.status === 'Running').length === 0) && (
                      <div className="p-2 text-xs text-muted-foreground text-center">No active job cards found</div>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="status">Inspection Result</Label>
                  <Select name="status" defaultValue="Passed">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Passed">Passed</SelectItem>
                      <SelectItem value="Failed">Failed (NCR)</SelectItem>
                      <SelectItem value="Rework Required">Rework Required</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="checkedQuantity">Sample Size</Label>
                  <Input id="checkedQuantity" name="checkedQuantity" type="number" placeholder="0" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="passedQuantity">Passed Qty</Label>
                  <Input id="passedQuantity" name="passedQuantity" type="number" placeholder="0" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="defectiveQuantity">Defects Found</Label>
                  <Input id="defectiveQuantity" name="defectiveQuantity" type="number" placeholder="0" />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="notes">Inspection Notes</Label>
                <Input id="notes" name="notes" placeholder="Color consistency, registration check..." />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit">Submit Report</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-emerald-100 shadow-sm">
          <CardHeader className="bg-emerald-50/50 pb-4">
            <CardTitle className="text-lg flex items-center gap-2 text-emerald-700">
              <ShieldCheck className="h-5 w-5" /> Recent Pass Reports
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job Card</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Qty Passed</TableHead>
                  <TableHead className="text-right">Result</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {qcLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-10">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                    </TableCell>
                  </TableRow>
                ) : passReports.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell className="font-bold">{report.jobCardNumber}</TableCell>
                    <TableCell className="text-xs">{new Date(report.checkDate).toLocaleDateString()}</TableCell>
                    <TableCell className="text-xs font-bold text-emerald-600">{report.passedQuantity?.toLocaleString()}</TableCell>
                    <TableCell className="text-right"><Badge className="bg-emerald-500">PASSED</Badge></TableCell>
                  </TableRow>
                ))}
                {passReports.length === 0 && !qcLoading && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-10 text-muted-foreground text-xs italic">
                      No passing reports recorded yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        
        <Card className="border-destructive/10 shadow-sm">
          <CardHeader className="bg-destructive/5 pb-4">
            <CardTitle className="text-lg flex items-center gap-2 text-accent">
              <AlertCircle className="h-5 w-5" /> Non-Conformance Reports
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job Card</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Reason/Status</TableHead>
                  <TableHead className="text-right">Outcome</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {qcLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-10">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                    </TableCell>
                  </TableRow>
                ) : ncrReports.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell className="font-bold">{report.jobCardNumber}</TableCell>
                    <TableCell className="text-xs">{new Date(report.checkDate).toLocaleDateString()}</TableCell>
                    <TableCell className="text-xs truncate max-w-[120px]">{report.notes || "No details"}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant="destructive">{report.status.toUpperCase()}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {ncrReports.length === 0 && !qcLoading && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-10 text-muted-foreground text-xs italic">
                      No non-conformance reports found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
