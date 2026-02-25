"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Layers, FileDown, Plus, Loader2, Info, Ruler, Zap, Box } from "lucide-react"
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
import { Separator } from "@/components/ui/separator"
import { useFirestore, useUser, useCollection, useMemoFirebase, useDoc } from "@/firebase"
import { collection, doc } from "firebase/firestore"
import { addDocumentNonBlocking } from "@/firebase/non-blocking-updates"
import { useToast } from "@/hooks/use-toast"

export default function BOMPage() {
  const { toast } = useToast()
  const { user } = useUser()
  const firestore = useFirestore()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [selectedBom, setSelectedBom] = useState<any>(null)

  // Authorization check
  const adminDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'adminUsers', user.uid);
  }, [firestore, user]);
  const { data: adminData } = useDoc(adminDocRef);

  // Firestore Queries
  const bomsQuery = useMemoFirebase(() => {
    if (!firestore || !user || !adminData) return null;
    return collection(firestore, 'boms');
  }, [firestore, user, adminData])

  const estimatesQuery = useMemoFirebase(() => {
    if (!firestore || !user || !adminData) return null;
    return collection(firestore, 'estimates');
  }, [firestore, user, adminData])

  const { data: boms, isLoading: bomsLoading } = useCollection(bomsQuery)
  const { data: estimates } = useCollection(estimatesQuery)

  const handleCreateBOM = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!firestore || !user) return

    const formData = new FormData(e.currentTarget)
    const estimateId = formData.get("estimateId") as string
    const selectedEstimate = estimates?.find(est => est.id === estimateId)

    if (!selectedEstimate) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select a valid estimate."
      })
      return
    }

    const bomData = {
      bomNumber: `BOM-${Date.now().toString().slice(-6)}`,
      estimateId: selectedEstimate.id,
      jobName: selectedEstimate.productCode || "Custom Label",
      description: formData.get("description") as string,
      status: "Approved",
      bomDate: new Date().toISOString(),
      createdById: user.uid,
      createdAt: new Date().toISOString()
    }

    addDocumentNonBlocking(collection(firestore, 'boms'), bomData)

    setIsDialogOpen(false)
    toast({
      title: "BOM Created",
      description: `New Bill of Materials ${bomData.bomNumber} has been generated.`
    })
  }

  const openDetails = (bom: any) => {
    setSelectedBom(bom)
    setIsDetailsOpen(true)
  }

  const linkedEstimate = selectedBom ? estimates?.find(e => e.id === selectedBom.estimateId) : null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">Bill of Materials (BOM)</h2>
          <p className="text-muted-foreground">Technical specifications and material requirements for approved estimates.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => toast({ title: "Export Started", description: "Generating BOM CSV report..." })}>
            <FileDown className="mr-2 h-4 w-4" /> Export All
          </Button>
          <Button onClick={() => setIsDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> New BOM
          </Button>
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleCreateBOM}>
            <DialogHeader>
              <DialogTitle>Create New BOM</DialogTitle>
              <DialogDescription>Link this BOM to an existing estimate to pull layout specs.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="estimateId">Select Estimate</Label>
                <Select name="estimateId" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose an Estimate" />
                  </SelectTrigger>
                  <SelectContent>
                    {estimates?.map((est) => (
                      <SelectItem key={est.id} value={est.id}>
                        {est.estimateNumber} - {est.productCode}
                      </SelectItem>
                    ))}
                    {(!estimates || estimates.length === 0) && (
                      <div className="p-2 text-xs text-muted-foreground text-center">No estimates found</div>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">BOM Description / Notes</Label>
                <Input id="description" name="description" placeholder="Technical notes for the operator..." />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit">Generate BOM</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex justify-between items-center pr-6">
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <Info className="h-5 w-5 text-primary" /> {selectedBom?.bomNumber}
              </DialogTitle>
              <Badge className={selectedBom?.status === 'Approved' ? 'bg-emerald-500' : 'bg-amber-500'}>
                {selectedBom?.status}
              </Badge>
            </div>
            <DialogDescription>Technical Specification Sheet for {selectedBom?.jobName}</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Linked Estimate</Label>
                <p className="text-sm font-mono font-bold">{linkedEstimate?.estimateNumber || 'N/A'}</p>
              </div>
              <div className="space-y-1 text-right">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">BOM Date</Label>
                <p className="text-sm">{selectedBom ? new Date(selectedBom.bomDate).toLocaleDateString() : 'N/A'}</p>
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2 text-primary">
                <Ruler className="h-3 w-3" /> Layout Parameters
              </h4>
              <div className="grid grid-cols-3 gap-4 bg-muted/30 p-4 rounded-lg">
                <div className="space-y-1">
                  <Label className="text-[9px] uppercase text-muted-foreground">Label Size</Label>
                  <p className="text-xs font-semibold">{linkedEstimate?.labelWidth}x{linkedEstimate?.labelLength} mm</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] uppercase text-muted-foreground">Across / Around</Label>
                  <p className="text-xs font-semibold">{linkedEstimate?.labelAcross} / {linkedEstimate?.labelAround}</p>
                </div>
                <div className="space-y-1 text-right">
                  <Label className="text-[9px] uppercase text-muted-foreground">Repeat Length</Label>
                  <p className="text-xs font-semibold">{linkedEstimate?.repeatLength} mm</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2 text-primary">
                <Zap className="h-3 w-3" /> Production Metrics
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="border rounded-md p-3">
                  <Label className="text-[9px] uppercase text-muted-foreground">Running Meter</Label>
                  <p className="text-base font-black text-accent">{linkedEstimate?.runningMeter?.toFixed(2)} m</p>
                </div>
                <div className="border rounded-md p-3">
                  <Label className="text-[9px] uppercase text-muted-foreground">Total Material (inc. waste)</Label>
                  <p className="text-base font-black text-foreground">{linkedEstimate?.totalMaterialRequiredSqM?.toFixed(2)} sqm</p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold flex items-center gap-2">
                <Box className="h-3 w-3" /> Technical Notes
              </Label>
              <div className="text-xs p-3 border rounded-md italic text-muted-foreground bg-amber-50/20">
                {selectedBom?.description || "No additional technical notes provided for this job."}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDetailsOpen(false)}>Close Sheet</Button>
            <Button onClick={() => toast({ title: "Printer Ready", description: "Generating floor copy..." })}>Print Floor Sheet</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" /> Active BOM Registry
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>BOM ID</TableHead>
                <TableHead>Job / Product</TableHead>
                <TableHead>Linked Estimate</TableHead>
                <TableHead>Created Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bomsLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                    <p className="text-xs text-muted-foreground mt-2">Loading BOM records...</p>
                  </TableCell>
                </TableRow>
              ) : boms?.map((bom) => (
                <TableRow key={bom.id}>
                  <TableCell className="font-mono text-xs font-bold">{bom.bomNumber}</TableCell>
                  <TableCell className="font-medium">{bom.jobName}</TableCell>
                  <TableCell className="text-muted-foreground font-mono text-xs">
                    {estimates?.find(e => e.id === bom.estimateId)?.estimateNumber || "N/A"}
                  </TableCell>
                  <TableCell className="text-xs">{new Date(bom.bomDate).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Badge className={bom.status === 'Approved' ? 'bg-emerald-500' : 'bg-amber-500'}>
                      {bom.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => openDetails(bom)}>
                      View Specs
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {(!boms || boms.length === 0) && !bomsLoading && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                    No BOM records found. Create one from an approved estimate.
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
