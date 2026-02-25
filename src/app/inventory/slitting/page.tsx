
"use client"

import { useState, useMemo } from "react"
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
import { useFirestore, useUser, useCollection, useMemoFirebase, useDoc } from "@/firebase"
import { collection, doc, query, where, getDocs, deleteDoc } from "firebase/firestore"
import { addDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase/non-blocking-updates"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

export default function SlittingPage() {
  const { toast } = useToast()
  const { user } = useUser()
  const firestore = useFirestore()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [selectedJumboId, setSelectedJumboId] = useState<string | null>(null)

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

  const planningQuery = useMemoFirebase(() => {
    if (!firestore || !user || !adminData) return null;
    return collection(firestore, 'job_planning');
  }, [firestore, user, adminData])

  const { data: jumbos, isLoading: jumbosLoading } = useCollection(jumboQuery)
  const { data: inventory, isLoading: itemsLoading } = useCollection(slittedQuery)
  const { data: jobs } = useCollection(planningQuery)

  const activeJumbos = jumbos?.filter(j => j.status === 'In Stock') || []
  const slittedRolls = inventory?.filter(item => item.itemType === 'Slitted Roll') || []
  const waitingJobs = jobs?.filter(job => job.status === 'WAITING FOR SLITTING') || []

  const selectedJobData = useMemo(() => 
    waitingJobs.find(j => j.id === selectedJobId), 
    [waitingJobs, selectedJobId]
  )

  // AUTO PAPER SUGGESTION LOGIC
  const suggestedRolls = useMemo(() => {
    if (!selectedJobData || !activeJumbos.length) return []

    const reqWidth = Number(selectedJobData.paper_width)
    const reqLength = Number(selectedJobData.allocate_meters)
    const reqMaterial = selectedJobData.material

    const matching = activeJumbos.filter(j => 
      j.paperType === reqMaterial &&
      j.widthMm >= reqWidth &&
      j.lengthMeters >= reqLength
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

  const handleSlittingConversion = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!firestore || !user || !selectedJobData || !selectedJumboId) return

    const formData = new FormData(e.currentTarget)
    const selectedJumbo = activeJumbos.find(j => j.id === selectedJumboId)
    
    if (!selectedJumbo) {
      toast({ variant: "destructive", title: "Error", description: "Jumbo Roll selection required." })
      return
    }

    const slitWidth = Number(formData.get("slitWidth"))
    const numRolls = Number(formData.get("numRolls"))

    // 1. Mark Jumbo as Consumed
    updateDocumentNonBlocking(doc(firestore, 'jumbo_stock', selectedJumboId), {
      status: "Consumed",
      updatedAt: new Date().toISOString()
    })

    // 2. Update Job Status to SLITTING DONE
    updateDocumentNonBlocking(doc(firestore, 'job_planning', selectedJobData.id), {
      status: "SLITTING DONE",
      updatedAt: new Date().toISOString()
    })

    // 3. Remove associated notification
    const nq = query(collection(firestore, 'notifications'), where("jobId", "==", selectedJobData.id))
    const nSnap = await getDocs(nq)
    nSnap.docs.forEach(d => deleteDoc(d.ref))

    // 4. Create Slitted Child Rolls
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
        parentJumboId: selectedJumboId,
        parentRollNo: selectedJumbo.rollNo,
        itemType: "Slitted Roll",
        dimensions: `${slitWidth}mm x ${selectedJumbo.lengthMeters}m`,
        currentQuantity: 1,
        unitOfMeasure: "roll",
        location: "Production Ready",
        status: "ASSIGNED",
        assigned_job_id: selectedJobData.plate_no || selectedJobData.id,
        assigned_job_name: selectedJobData.job_name,
        assigned_date: new Date().toISOString(),
        assigned_user: user.displayName || user.email?.split('@')[0] || "Operator",
        createdAt: new Date().toISOString(),
        createdById: user.uid
      }
      addDocumentNonBlocking(collection(firestore, 'inventoryItems'), slitData)
    }

    setIsDialogOpen(false)
    setSelectedJobId(null)
    setSelectedJumboId(null)
    toast({
      title: "Slitting Completed",
      description: `Material assigned to Job ${selectedJobData.job_name}. Notification cleared.`
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">Slitting (Conversion)</h2>
          <p className="text-muted-foreground">Process jobs released by Design and execute material conversion.</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)} className="bg-primary hover:bg-primary/90 shadow-lg">
          <Scissors className="mr-2 h-4 w-4" /> Start Slitting Run
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Waiting Jobs Dashboard Section */}
        <Card className="lg:col-span-1 border-amber-100 shadow-sm">
          <CardHeader className="bg-amber-50/50 pb-4">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-amber-700 uppercase tracking-wider">
              <Clock className="h-4 w-4" /> Jobs Waiting for Slitting
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 max-h-[600px] overflow-auto">
            {waitingJobs.length > 0 ? (
              <div className="divide-y">
                {waitingJobs.map((job) => (
                  <div key={job.id} className="p-4 hover:bg-muted/30 transition-colors group cursor-pointer" onClick={() => { setSelectedJobId(job.id); setIsDialogOpen(true); }}>
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-black text-primary text-xs tracking-tighter">{job.plate_no}</span>
                      <Badge variant="outline" className="text-[10px] px-1 h-4 bg-white">{job.material}</Badge>
                    </div>
                    <p className="text-sm font-bold truncate group-hover:text-primary transition-colors">{job.job_name}</p>
                    <div className="flex justify-between mt-2 text-[10px] text-muted-foreground font-medium">
                      <span>{job.paper_width}mm width</span>
                      <span>{job.allocate_meters}m required</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-10 text-center text-muted-foreground">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-20" />
                <p className="text-xs">No pending jobs in queue.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-lg flex items-center gap-2"><RefreshCw className="h-5 w-5 text-primary" /> Master Assigned Slitted Stock</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Roll ID</TableHead>
                  <TableHead>Assigned Master Plate</TableHead>
                  <TableHead>Dimensions</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {itemsLoading ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-10"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></TableCell></TableRow>
                ) : slittedRolls.slice(0, 15).map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-xs font-bold">{s.barcode}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-primary">{s.assigned_job_id || 'Unassigned'}</span>
                        <span className="text-[10px] text-muted-foreground line-clamp-1">{s.assigned_job_name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs font-mono">{s.dimensions}</TableCell>
                    <TableCell><Badge variant={s.status === 'ASSIGNED' ? 'default' : 'secondary'}>{s.status}</Badge></TableCell>
                  </TableRow>
                ))}
                {slittedRolls.length === 0 && !itemsLoading && (
                  <TableRow><TableCell colSpan={4} className="text-center py-10 text-muted-foreground">No slitted stock assigned to master plans.</TableCell></TableRow>
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
              <DialogTitle>Execute Slitting & Assign Plan</DialogTitle>
              <DialogDescription>Select a job from the slitting queue to see auto-paper suggestions.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-6 py-4">
              <div className="grid gap-2">
                <Label htmlFor="jobId">Select Job from Queue</Label>
                <Select value={selectedJobId || ""} onValueChange={handleJobSelect} required>
                  <SelectTrigger><SelectValue placeholder="Choose Job to Slit" /></SelectTrigger>
                  <SelectContent>
                    {waitingJobs.map((j) => (
                      <SelectItem key={j.id} value={j.id}>{j.plate_no} - {j.job_name}</SelectItem>
                    ))}
                    {waitingJobs.length === 0 && <SelectItem value="none" disabled>No jobs in waiting queue</SelectItem>}
                  </SelectContent>
                </Select>
              </div>

              {selectedJobData && (
                <div className="bg-primary/5 p-4 rounded-lg border border-primary/20 space-y-3">
                  <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase">
                    <ListTodo className="h-3 w-3" /> Technical Plan Parameters
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground uppercase">Material</Label>
                      <p className="font-bold">{selectedJobData.material}</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground uppercase">Req. Width</Label>
                      <p className="font-bold">{selectedJobData.paper_width} mm</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground uppercase">Req. Meter</Label>
                      <p className="font-bold text-accent">{selectedJobData.allocate_meters} m</p>
                    </div>
                  </div>
                </div>
              )}

              {selectedJobId && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2 text-sm font-bold">
                      <Sparkles className="h-4 w-4 text-primary" /> Intelligent Stock Matching
                    </Label>
                  </div>
                  
                  {suggestedRolls.length > 0 ? (
                    <div className="border rounded-md overflow-hidden shadow-inner bg-background">
                      <Table>
                        <TableHeader className="bg-muted/50">
                          <TableRow>
                            <TableHead className="w-[50px]"></TableHead>
                            <TableHead>Roll ID</TableHead>
                            <TableHead>Width</TableHead>
                            <TableHead>Length</TableHead>
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
                              <TableCell className="text-xs">{roll.lengthMeters} m</TableCell>
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
                      <p className="text-sm font-medium text-muted-foreground">No matching inventory found for the master plan specs.</p>
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
                    <Label htmlFor="numRolls">Total Rolls to Slit</Label>
                    <Input id="numRolls" name="numRolls" type="number" defaultValue={1} required />
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="submit" className="w-full h-12" disabled={!selectedJumboId}>
                Confirm Conversion & Complete Notification
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
