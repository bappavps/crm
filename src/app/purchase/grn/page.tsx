
"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Loader2, ClipboardCheck, History, PackageOpen } from "lucide-react"
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
import { addDocumentNonBlocking } from "@/firebase/non-blocking-updates"
import { useToast } from "@/hooks/use-toast"

export default function GRNPage() {
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

  // Firestore Queries
  const jumboQuery = useMemoFirebase(() => {
    if (!firestore || !user || !adminData) return null;
    return collection(firestore, 'inventoryItems');
  }, [firestore, user, adminData])

  const materialsQuery = useMemoFirebase(() => {
    if (!firestore || !user || !adminData) return null;
    return collection(firestore, 'materials');
  }, [firestore, user, adminData])

  const { data: inventory, isLoading } = useCollection(jumboQuery)
  const { data: materials } = useCollection(materialsQuery)

  const jumbos = inventory?.filter(item => item.itemType === 'Jumbo Roll') || []

  const handleAddJumbo = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!firestore || !user) return

    const formData = new FormData(e.currentTarget)
    const materialId = formData.get("materialId") as string
    const selectedMaterial = materials?.find(m => m.id === materialId)
    
    const jumboData = {
      barcode: `JMB-${Date.now().toString().slice(-6)}`,
      name: selectedMaterial?.name || "Raw Material",
      materialId,
      itemType: "Jumbo Roll",
      dimensions: `${formData.get("width")}mm x ${formData.get("length")}m`,
      currentQuantity: 1,
      unitOfMeasure: "roll",
      location: formData.get("location") as string || "Raw Store",
      status: "In Stock",
      weightKg: Number(formData.get("weight")),
      batchNumber: formData.get("batch") as string,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdById: user.uid
    }

    addDocumentNonBlocking(collection(firestore, 'inventoryItems'), jumboData)

    setIsDialogOpen(false)
    toast({
      title: "GRN Recorded",
      description: `Jumbo Roll ${jumboData.barcode} entered into stock.`
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">GRN (Jumbo Roll Entry)</h2>
          <p className="text-muted-foreground">Log incoming raw material rolls from suppliers.</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}><Plus className="mr-2 h-4 w-4" /> New Jumbo Entry</Button>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleAddJumbo}>
            <DialogHeader>
              <DialogTitle>Jumbo Roll Intake (GRN)</DialogTitle>
              <DialogDescription>Record technical specs for incoming master rolls.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="materialId">Material Type</Label>
                <Select name="materialId" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select substrate" />
                  </SelectTrigger>
                  <SelectContent>
                    {materials?.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="width">Width (mm)</Label>
                  <Input id="width" name="width" type="number" defaultValue="1020" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="length">Length (m)</Label>
                  <Input id="length" name="length" type="number" defaultValue="4000" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="weight">Weight (Kg)</Label>
                  <Input id="weight" name="weight" type="number" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="batch">Batch / Lot No.</Label>
                  <Input id="batch" name="batch" placeholder="Lot-990" required />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="location">Store Location</Label>
                <Input id="location" name="location" placeholder="e.g. Rack A-1" />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit">Complete Entry</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-primary" /> Jumbo Roll Registry
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Jumbo ID</TableHead>
                <TableHead>Material</TableHead>
                <TableHead>Batch No.</TableHead>
                <TableHead>Dimensions</TableHead>
                <TableHead>Weight</TableHead>
                <TableHead>Location</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                  </TableCell>
                </TableRow>
              ) : jumbos.map((j) => (
                <TableRow key={j.id}>
                  <TableCell className="font-mono text-xs font-bold">{j.barcode}</TableCell>
                  <TableCell className="font-medium">{j.name}</TableCell>
                  <TableCell className="text-xs">{j.batchNumber || 'N/A'}</TableCell>
                  <TableCell className="text-xs">{j.dimensions}</TableCell>
                  <TableCell className="text-xs">{j.weightKg} kg</TableCell>
                  <TableCell><Badge variant="outline">{j.location}</Badge></TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon"><History className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {jumbos.length === 0 && !isLoading && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                    No Jumbo Rolls in stock. Enter a new GRN to begin.
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
