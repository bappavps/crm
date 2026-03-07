
"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Scissors, Plus, Loader2, ArrowRightLeft, RefreshCw, ListTodo, CheckCircle2, AlertTriangle, Sparkles, Clock } from "lucide-react"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog"
import { useFirestore, useUser, useCollection, useMemoFirebase, useDoc, errorEmitter, FirestorePermissionError } from "@/firebase"
import { collection, doc, query, where, getDocs, runTransaction, serverTimestamp, limit, orderBy } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

export default function SlittingPage() {
  const { toast } = useToast()
  const { user } = useUser()
  const firestore = useFirestore()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [selectedJumboId, setSelectedJumboId] = useState<string | null>(null)
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => { setIsMounted(true) }, [])

  const adminDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'adminUsers', user.uid);
  }, [firestore, user]);
  const { data: adminData } = useDoc(adminDocRef);

  // Optimized Queries with strict limits to prevent Quota Exceeded
  const jumboQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    // Only fetch In Stock jumbos to slit
    return query(collection(firestore, 'paper_stock'), where('status', '==', 'Available'), limit(50));
  }, [firestore, user])

  const slittedQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'inventoryItems'), where("itemType", "==", "Slitted Roll"), limit(50));
  }, [firestore, user])

  const planningQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'jobs'), where("status", "==", "Approved"), limit(50));
  }, [firestore, user])

  const { data: jumbos, isLoading: jumbosLoading } = useCollection(jumboQuery)
  const { data: slittedRolls, isLoading: itemsLoading } = useCollection(slittedQuery)
  const { data: jobs } = useCollection(planningQuery)

  const activeJumbos = jumbos || []
  const waitingJobs = jobs || []

  const handleSlittingConversion = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!firestore || !user || !selectedJobId || !selectedJumboId) return

    setIsProcessing(true)
    const selectedJumbo = activeJumbos.find(j => j.id === selectedJumboId)
    const selectedJob = waitingJobs.find(j => j.id === selectedJobId)
    
    if (!selectedJumbo || !selectedJob) return;

    runTransaction(firestore, async (transaction) => {
      const jumboRef = doc(firestore, 'paper_stock', selectedJumboId)
      const jobRef = doc(firestore, 'jobs', selectedJobId)
      const slitRef = doc(collection(firestore, 'inventoryItems'))

      transaction.update(jumboRef, { status: "Used", updatedAt: serverTimestamp() })
      transaction.update(jobRef, { currentStage: "Production", status: "In Production", updatedAt: serverTimestamp() })
      
      transaction.set(slitRef, {
        barcode: `SLIT-${selectedJumbo.rollNo}`,
        itemType: "Slitted Roll",
        status: "ASSIGNED",
        assigned_job_id: selectedJob.jobNumber,
        createdAt: serverTimestamp(),
        createdById: user.uid
      })
    }).then(() => {
      setIsProcessing(false)
      toast({ title: "Conversion Complete" })
      setIsDialogOpen(false)
    }).catch(() => setIsProcessing(false))
  }

  if (!isMounted) return null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">Technical Slitting</h2>
          <p className="text-muted-foreground">Limited view to maintain free tier quotas.</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}><Scissors className="mr-2 h-4 w-4" /> Start Slitting</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card><CardHeader><CardTitle className="text-sm font-bold uppercase">Recent Assignments</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Barcode</TableHead><TableHead>Job</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {itemsLoading ? (
                  <TableRow><TableCell colSpan={3} className="text-center py-10"><Loader2 className="animate-spin" /></TableCell></TableRow>
                ) : slittedRolls?.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-xs">{s.barcode}</TableCell>
                    <TableCell className="text-xs font-bold">{s.assigned_job_id}</TableCell>
                    <TableCell><Badge variant="outline">{s.status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
      </div>
    </div>
  )
}
