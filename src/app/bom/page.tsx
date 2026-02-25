
"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Layers, FileDown, Plus, Loader2 } from "lucide-react"
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
import { addDocumentNonBlocking } from "@/firebase/non-blocking-updates"
import { useToast } from "@/hooks/use-toast"

export default function BOMPage() {
  const { toast } = useToast()
  const { user } = useUser()
  const firestore = useFirestore()
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  // Authorization check - ensures rules are ready
  const adminDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'adminUsers', user.uid);
  }, [firestore, user]);
  const { data: adminData } = useDoc(adminDocRef);

  // Fetching Data from Firestore - Only when authorized
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
                    <Button variant="ghost" size="sm" onClick={() => toast({ title: "BOM Details", description: "Opening technical sheet..." })}>
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
