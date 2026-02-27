
"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { ListTodo, Loader2, Lock, Pencil, Send, CheckCircle2, AlertTriangle } from "lucide-react"
import { useFirestore, useUser, useCollection, useMemoFirebase, useDoc } from "@/firebase"
import { collection, doc, query, where, getDoc, updateDoc, serverTimestamp } from "firebase/firestore"
import { updateDocumentNonBlocking } from "@/firebase/non-blocking-updates"
import { useToast } from "@/hooks/use-toast"

export default function JobPlanningPage() {
  const { toast } = useToast()
  const { user } = useUser()
  const firestore = useFirestore()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingJob, setEditingJob] = useState<any>(null)
  const [techDetails, setTechDetails] = useState<any>(null)
  const [isMounted, setIsMounted] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  useEffect(() => { setIsMounted(true) }, [])

  const adminDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'adminUsers', user.uid);
  }, [firestore, user]);
  const { data: adminData } = useDoc(adminDocRef);
  const isAdmin = !!adminData;

  const planningQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    // Process flow: Show only Confirmed jobs waiting for planning
    return query(collection(firestore, 'jobs'), where("status", "==", "Confirmed"));
  }, [firestore, user])

  const artworksQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'artworks'), where("status", "==", "Approved"));
  }, [firestore, user])

  const { data: jobs, isLoading } = useCollection(planningQuery)
  const { data: artworks } = useCollection(artworksQuery)

  const handleOpenEdit = async (job: any) => {
    if (!firestore) return
    setEditingJob(job)
    
    const techRef = doc(firestore, `jobs/${job.id}/technical/details`)
    const techSnap = await getDoc(techRef)
    setTechDetails(techSnap.exists() ? techSnap.data() : {})
    setIsDialogOpen(true)
  }

  const handleSaveJob = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!firestore || !user || !editingJob) return

    const formData = new FormData(e.currentTarget)
    const techUpdate = {
      plateNo: formData.get("plate_no") as string,
      repeat_length: Number(formData.get("repeat_length")),
      paper_width: Number(formData.get("paper_width")),
      artwork_id: formData.get("artwork_id") as string,
      planning_updated_at: new Date().toISOString()
    }

    updateDocumentNonBlocking(doc(firestore, 'jobs', editingJob.id), {
      plateNo: techUpdate.plateNo,
      planning_status: 'Planned'
    });

    updateDocumentNonBlocking(doc(firestore, `jobs/${editingJob.id}/technical/details`), techUpdate);
    
    toast({ title: "Plan Saved", description: "Technical specs updated." });
    setIsDialogOpen(false)
  }

  const handleSendToFloor = async (job: any) => {
    if (!firestore || !user) return
    
    // VALIDATION: Must have plate number and artwork linked
    if (!job.plateNo) {
      toast({ variant: "destructive", title: "Validation Error", description: "Plate ID must be assigned before sending to floor." })
      return
    }

    setIsProcessing(true)
    try {
      await updateDoc(doc(firestore, 'jobs', job.id), {
        status: "Sent to Floor",
        sent_to_floor_at: serverTimestamp(),
        sent_to_floor_by: user.uid,
        updatedAt: serverTimestamp()
      })
      toast({ title: "Released to Floor", description: `Job ${job.jobNumber || job.id} is now visible to Operators.` })
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "Failed to release job." })
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">Technical Planning Board</h2>
          <p className="text-muted-foreground">Release confirmed orders to the production floor.</p>
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <form onSubmit={handleSaveJob}>
            <DialogHeader><DialogTitle>Configure Technical Plan</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="artwork_id">Linked Artwork Master</Label>
                <Select name="artwork_id" defaultValue={techDetails?.artwork_id}>
                  <SelectTrigger><SelectValue placeholder="Select Approved Artwork" /></SelectTrigger>
                  <SelectContent>
                    {artworks?.filter(a => a.clientName === editingJob?.clientName).map(a => (
                      <SelectItem key={a.id} value={a.id}>{a.name} (v{a.version})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="plate_no">Internal Plate ID</Label>
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
            <DialogFooter><Button type="submit" className="w-full">Save Technical specs</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Card>
        <CardContent className="p-0 border-t">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px] text-center">ACTION</TableHead>
                <TableHead>ORDER REF</TableHead>
                <TableHead>CLIENT</TableHead>
                <TableHead>PLATE NO</TableHead>
                <TableHead>PLAN STATUS</TableHead>
                <TableHead className="text-right">RELEASE</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-10"><Loader2 className="animate-spin" /></TableCell></TableRow>
              ) : jobs?.map((j) => (
                <TableRow key={j.id}>
                  <TableCell className="text-center">
                    <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(j)}><Pencil className="h-4 w-4" /></Button>
                  </TableCell>
                  <TableCell className="font-mono text-xs font-bold text-primary">{j.orderNumber || 'SO-NEW'}</TableCell>
                  <TableCell className="font-bold">{j.clientName}</TableCell>
                  <TableCell className="font-mono text-xs">{j.plateNo || '-'}</TableCell>
                  <TableCell><Badge variant="secondary">{j.planning_status || 'Pending'}</Badge></TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => handleSendToFloor(j)} disabled={isProcessing}>
                      <Send className="mr-2 h-3 w-3" /> Send to Floor
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {jobs?.length === 0 && !isLoading && (
                <TableRow><TableCell colSpan={6} className="text-center py-20 text-muted-foreground italic">No confirmed orders waiting for planning.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
