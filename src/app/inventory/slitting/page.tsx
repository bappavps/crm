
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
import { collection, doc, query, where, getDocs, deleteDoc, runTransaction, serverTimestamp } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

/**
 * SLITTING (CONVERSION) MODULE V2
 * Uses Atomic Transactions to ensure Job, Jumbo, and Slitted items are updated together.
 */
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

  // Authorization check
  const adminDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'adminUsers', user.uid);
  }, [firestore, user]);
  const { data: adminData } = useDoc(adminDocRef);

  // Roll Settings
  const settingsDocRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'roll_settings', 'global_config');
  }, [firestore]);
  const { data: settings } = useDoc(settingsDocRef);

  // Firestore Queries - Synchronized with 'jobs' collection
  const jumboQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, 'jumbo_stock');
  }, [firestore, user])

  const slittedQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'inventoryItems'), where("itemType", "==", "Slitted Roll"));
  }, [firestore, user])

  const planningQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    // Jobs that are approved and released by planning but not yet slit
    return query(collection(firestore, 'jobs'), where("status", "==", "Approved"), where("planning_status", "==", "Released"));
  }, [firestore, user])

  const { data: jumbos, isLoading: jumbosLoading } = useCollection(jumboQuery)
  const { data: slittedRolls, isLoading: itemsLoading } = useCollection(slittedQuery)
  const { data: jobs } = useCollection(planningQuery)

  const activeJumbos = jumbos?.filter(j => j.status === 'In Stock') || []
  const waitingJobs = jobs || []

  const selectedJobData = useMemo(() => 
    waitingJobs.find(j => j.id === selectedJobId), 
    [waitingJobs, selectedJobId]
  )

  // INTELLIGENT STOCK MATCHING
  const suggestedRolls = useMemo(() => {
    if (!selectedJobData || !activeJumbos.length) return []

    const reqWidth = Number(selectedJobData.paper_width)
    const reqMaterial = selectedJobData.material

    const matching = activeJumbos.filter(j => 
      j.paperType === reqMaterial &&
      j.widthMm >= reqWidth
    )

    const sorted = [...matching].sort((a, b) => {
      const diffA = a.widthMm - reqWidth
      const diffB = b.widthMm - reqWidth
      return diffA - diffB
    })

    return sorted.map((roll, index) => ({
      ...roll,
      isBestMatch: index === 0,
      widthDiff: roll.widthMm - reqWidth
    }))
  }, [selectedJobData, activeJumbos])

  const handleJobSelect = (jobId: string) => {
    setSelectedJobId(jobId)
    setSelectedJumboId(null)
  }

  const handleSlittingConversion = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!firestore || !user || !selectedJobData || !selectedJumboId) return

    setIsProcessing(true)
    const formData = new FormData(e.currentTarget)
    const selectedJumbo = activeJumbos.find(j => j.id === selectedJumboId)
    
    if (!selectedJumbo) {
      toast({ variant: "destructive", title: "Error", description: "Jumbo Roll selection required." })
      setIsProcessing(false)
      return
    }

    const slitWidth = Number(formData.get("slitWidth"))
    const numRolls = Number(formData.get("numRolls"))

    runTransaction(firestore, async (transaction) => {
      const jumboRef = doc(firestore, 'jumbo_stock', selectedJumboId)
      const jobRef = doc(firestore, 'jobs', selectedJobData.id)
      
      // 1. Mark Jumbo as Consumed
      transaction.update(jumboRef, {
        status: "Consumed",
        consumedAt: new Date().toISOString(),
        consumedBy: user.uid,
        updatedAt: serverTimestamp()
      })

      // 2. Update Job Status
      transaction.update(jobRef, {
        planning_status: "Converted",
        currentStage: "Production",
        updatedAt: serverTimestamp()
      })

      // 3. Create Slitted Child Rolls
      const sep = settings?.separator || "-"
      const prefixType = settings?.childType || "alphabet"

      for (let i = 0; i < numRolls; i++) {
        let childId = ""
        if (prefixType === "alphabet") {
          childId = String.fromCharCode(65 + i)
        } else {
          childId = (i + 1).toString()
        }

        const generatedBarcode = `${selectedJumbo.rollNo}${sep}${childId}`
        const slitRef = doc(collection(firestore, 'inventoryItems'))

        transaction.set(slitRef, {
          barcode: generatedBarcode,
          name: `Slitted: ${selectedJumbo.paperType}`,
          parentJumboId: selectedJumboId,
          parentRollNo: selectedJumbo.rollNo,
          itemType: "Slitted Roll",
          dimensions: `${slitWidth}mm x ${selectedJumbo.lengthMeters}m`,
          currentQuantity: 1,
          unitOfMeasure: "roll",
          location: "Production Floor",
          status: "ASSIGNED",
          assigned_job_id: selectedJobData.jobNumber,
          assigned_job_internal_id: selectedJobData.id,
          assigned_date: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          createdById: user.uid
        })
      }

      // 4. Remove associated notifications if any
      const nq = query(collection(firestore, 'notifications'), where("jobId", "==", selectedJobData.id))
      const nSnap = await getDocs(nq)
      nSnap.docs.forEach(d => transaction.delete(d.ref))
    }).then(() => {
      setIsProcessing(false)
      toast({ title: "Slitting Completed", description: `Parent ${selectedJumbo.rollNo} converted to ${numRolls} rolls for ${selectedJobData.jobNumber}.` })
      setIsDialogOpen(false)
      setSelectedJobId(null)
      setSelectedJumboId(null)
    }).catch(async (serverError) => {
      setIsProcessing(false)
      const permissionError = new FirestorePermissionError({
        path: 'inventoryItems',
        operation: 'create',
      });
      errorEmitter.emit('permission-error', permissionError);
    })
  }

  if (!isMounted) return null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">Slitting (Conversion)</h2>
          <p className="text-muted-foreground">Process released technical plans and execute material conversion.</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)} className="bg-primary hover:bg-primary/90 shadow-lg">
          <Scissors className="mr-2 h-4 w-4" /> Execute Conversion Run
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 border-amber-100 shadow-sm">
          <CardHeader className="bg-amber-50/50 pb-4">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-amber-700 uppercase tracking-wider">
              <Clock className="h-4 w-4" /> Planning Release Queue
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 max-h-[600px] overflow-auto">
            {waitingJobs.length > 0 ? (
              <div className="divide-y">
                {waitingJobs.map((job) => (
                  <div key={job.id} className="p-4 hover:bg-muted/30 transition-colors group cursor-pointer" onClick={() => { setSelectedJobId(job.id); setIsDialogOpen(true); }}>
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-black text-primary text-xs tracking-tighter">{job.jobNumber}</span>
                      <Badge variant="outline" className="text-[10px] px-1 h-4 bg-white">{job.material || 'N/A'}</Badge>
                    </div>
                    <p className="text-sm font-bold truncate group-hover:text-primary transition-colors">{job.clientName}</p>
                    <div className="flex justify-between mt-2 text-[10px] text-muted-foreground font-medium">
                      <span>{job.paper_width || '0'}mm width</span>
                      <span>Ready for Conversion</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-10 text-center text-muted-foreground">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-20" />
                <p className="text-xs">No pending releases in queue.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-lg flex items-center gap-2"><RefreshCw className="h-5 w-5 text-primary" /> Active Conversion Registry</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Child Roll ID</TableHead>
                  <TableHead>Assigned Job</TableHead>
                  <TableHead>Dimensions</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {itemsLoading ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-10"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></TableCell></TableRow>
                ) : slittedRolls?.slice(0, 15).map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-xs font-bold">{s.barcode}</TableCell>
                    <TableCell>
                      <span className="text-xs font-bold text-primary">{s.assigned_job_id || 'Unassigned'}</span>
                    </TableCell>
                    <TableCell className="text-xs font-mono">{s.dimensions}</TableCell>
                    <TableCell><Badge variant={s.status === 'ASSIGNED' ? 'default' : 'secondary'}>{s.status}</Badge></TableCell>
                  </TableRow>
                ))}
                {slittedRolls?.length === 0 && !itemsLoading && (
                  <TableRow><TableCell colSpan={4} className="text-center py-10 text-muted-foreground">No slitted stock currently assigned.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleSlittingConversion}>
            <DialogHeader>
              <DialogTitle>Execute Atomic Conversion</DialogTitle>
              <DialogDescription>Convert a technical release into slitted rolls. This update is permanent and transactional.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-6 py-4">
              <div className="grid gap-2">
                <Label htmlFor="jobId">Select Released Job</Label>
                <Select value={selectedJobId || ""} onValueChange={handleJobSelect} required>
                  <SelectTrigger><SelectValue placeholder="Choose Job to Slit" /></SelectTrigger>
                  <SelectContent>
                    {waitingJobs.map((j) => (
                      <SelectItem key={j.id} value={j.id}>{j.jobNumber} - {j.clientName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedJobData && (
                <div className="bg-primary/5 p-4 rounded-lg border border-primary/20 space-y-3">
                  <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase">
                    <ListTodo className="h-3 w-3" /> Technical Specification
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground uppercase">Material</Label>
                      <p className="font-bold">{selectedJobData.material || 'N/A'}</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground uppercase">Planned Width</Label>
                      <p className="font-bold">{selectedJobData.paper_width || '0'} mm</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground uppercase">Plate ID</Label>
                      <p className="font-bold text-accent">{selectedJobData.plateNo || 'N/A'}</p>
                    </div>
                  </div>
                </div>
              )}

              {selectedJobId && (
                <div className="space-y-3">
                  <Label className="flex items-center gap-2 text-sm font-bold">
                    <Sparkles className="h-4 w-4 text-primary" /> Intelligent Stock Matching
                  </Label>
                  
                  {suggestedRolls.length > 0 ? (
                    <div className="border rounded-md overflow-hidden bg-background">
                      <Table>
                        <TableHeader className="bg-muted/50">
                          <TableRow>
                            <TableHead className="w-[50px]"></TableHead>
                            <TableHead>Roll ID</TableHead>
                            <TableHead>Width</TableHead>
                            <TableHead>Material</TableHead>
                            <TableHead className="text-right">Match</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {suggestedRolls.map((roll) => (
                            <TableRow 
                              key={roll.id} 
                              className={cn(
                                "cursor-pointer transition-colors",
                                roll.isBestMatch ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-muted/50",
                                selectedJumboId === roll.id && "bg-primary/20 hover:bg-primary/25 border-l-4 border-l-primary"
                              )}
                              onClick={() => setSelectedJumboId(roll.id)}
                            >
                              <TableCell>
                                <div className={cn(
                                  "w-4 h-4 rounded-full border flex items-center justify-center",
                                  selectedJumboId === roll.id ? "border-primary bg-primary text-white" : "border-muted-foreground"
                                )}>
                                  {selectedJumboId === roll.id && <CheckCircle2 className="h-3 w-3" />}
                                </div>
                              </TableCell>
                              <TableCell className="font-mono text-xs font-bold">{roll.rollNo}</TableCell>
                              <TableCell className="text-xs">{roll.widthMm} mm</TableCell>
                              <TableCell className="text-[10px]">{roll.paperType}</TableCell>
                              <TableCell className="text-right">
                                {roll.isBestMatch ? (
                                  <Badge className="bg-emerald-500 text-[9px] h-5">BEST MATCH</Badge>
                                ) : (
                                  <span className="text-[10px] text-muted-foreground">+{roll.widthDiff}mm waste</span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="p-10 text-center border-2 border-dashed rounded-lg space-y-2">
                      <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto opacity-50" />
                      <p className="text-sm font-medium text-muted-foreground">No matching inventory found for specifications.</p>
                    </div>
                  )}
                </div>
              )}

              {selectedJumboId && (
                <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                  <div className="grid gap-2">
                    <Label htmlFor="slitWidth">Output Slit Width (mm)</Label>
                    <Input 
                      id="slitWidth" 
                      name="slitWidth" 
                      type="number" 
                      defaultValue={selectedJobData?.paper_width || ""} 
                      required 
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="numRolls">Total Rolls to Generate</Label>
                    <Input id="numRolls" name="numRolls" type="number" defaultValue={1} required />
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="submit" className="w-full h-12" disabled={!selectedJumboId || isProcessing}>
                {isProcessing ? <Loader2 className="animate-spin mr-2" /> : "Finalize Transactional Conversion"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
