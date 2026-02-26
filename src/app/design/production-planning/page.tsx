
"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { ListTodo, Loader2, Lock, Pencil } from "lucide-react"
import { useFirestore, useUser, useCollection, useMemoFirebase, useDoc } from "@/firebase"
import { collection, doc, query, where, getDoc } from "firebase/firestore"
import { updateDocumentNonBlocking, addDocumentNonBlocking } from "@/firebase/non-blocking-updates"
import { useToast } from "@/hooks/use-toast"

export default function JobPlanningPage() {
  const { toast } = useToast()
  const { user } = useUser()
  const firestore = useFirestore()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingJob, setEditingJob] = useState<any>(null)
  const [techDetails, setTechDetails] = useState<any>(null)
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => { setIsMounted(true) }, [])

  const adminDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'adminUsers', user.uid);
  }, [firestore, user]);
  const { data: adminData } = useDoc(adminDocRef);
  const isAdmin = !!adminData;

  const planningQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'jobs'), where("status", "==", "Approved"));
  }, [firestore, user])

  const { data: jobs, isLoading } = useCollection(planningQuery)

  const handleOpenEdit = async (job: any) => {
    if (!firestore) return
    setEditingJob(job)
    
    // Fetch technical details from modular sub-collection
    const techRef = doc(firestore, `jobs/${job.id}/technical/details`)
    const techSnap = await getDoc(techRef)
    if (techSnap.exists()) {
      setTechDetails(techSnap.data())
      setIsDialogOpen(true)
    } else {
      toast({ variant: "destructive", title: "Error", description: "Technical record not found." })
    }
  }

  const handleSaveJob = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!firestore || !user || !editingJob) return

    const formData = new FormData(e.currentTarget)
    const techUpdate = {
      plateNo: formData.get("plate_no") as string,
      repeat_length: Number(formData.get("repeat_length")),
      paper_width: Number(formData.get("paper_width")),
      planning_updated_at: new Date().toISOString()
    }

    // Update Master Doc Summary
    updateDocumentNonBlocking(doc(firestore, 'jobs', editingJob.id), {
      plateNo: techUpdate.plateNo,
      planning_status: 'Released'
    });

    // Update Technical Sub-doc
    updateDocumentNonBlocking(doc(firestore, `jobs/${editingJob.id}/technical/details`), techUpdate);
    
    toast({ title: "Plan Saved", description: "Modular technical specs updated." });
    setIsDialogOpen(false)
  }

  const isJobLocked = (job: any) => {
    if (!isMounted) return true;
    if (isAdmin) return false;
    // Note: The actual lock time is stored in the tech sub-doc, 
    // but we check it here for UI disabling
    return false; // Implement refined check if needed
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">Technical Planning Board (V2)</h2>
          <p className="text-muted-foreground">Modular Sub-collection Data Sync Enabled.</p>
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <form onSubmit={handleSaveJob}>
            <DialogHeader>
              <DialogTitle>Edit Technical Details</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="plate_no">Plate Number</Label>
                <Input id="plate_no" name="plate_no" defaultValue={editingJob?.plateNo} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="repeat_length">Repeat Length (mm)</Label>
                  <Input id="repeat_length" name="repeat_length" type="number" defaultValue={techDetails?.repeat_length} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="paper_width">Paper Width (mm)</Label>
                  <Input id="paper_width" name="paper_width" type="number" defaultValue={techDetails?.paper_width} />
                </div>
              </div>
            </div>
            <DialogFooter><Button type="submit" className="w-full">Save Modular Plan</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Card>
        <CardContent className="p-0 border-t">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px] text-center">ACTION</TableHead>
                <TableHead>JOB ID</TableHead>
                <TableHead>CLIENT</TableHead>
                <TableHead>JOB NAME</TableHead>
                <TableHead>PLATE NO</TableHead>
                <TableHead>PLAN STATUS</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-10"><Loader2 className="animate-spin" /></TableCell></TableRow>
              ) : jobs?.map((j) => (
                <TableRow key={j.id}>
                  <TableCell className="text-center">
                    <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(j)} disabled={isJobLocked(j)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                  <TableCell className="font-black text-primary">{j.jobNumber}</TableCell>
                  <TableCell className="font-bold">{j.clientName}</TableCell>
                  <TableCell className="text-xs">{j.itemNameSummary}</TableCell>
                  <TableCell className="font-mono text-xs">{j.plateNo || '-'}</TableCell>
                  <TableCell><Badge variant="secondary">{j.planning_status || 'Pending'}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
