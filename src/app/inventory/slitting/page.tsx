
"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Scissors, Plus, Loader2, ArrowRightLeft, RefreshCw } from "lucide-react"
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

  // Firestore Queries
  const inventoryQuery = useMemoFirebase(() => {
    if (!firestore || !user || !adminData) return null;
    return collection(firestore, 'inventoryItems');
  }, [firestore, user, adminData])

  const { data: inventory, isLoading } = useCollection(inventoryQuery)

  const jumbos = inventory?.filter(item => item.itemType === 'Jumbo Roll' && item.status === 'In Stock') || []
  const slittedRolls = inventory?.filter(item => item.itemType === 'Slitted Roll') || []

  const handleSlittingConversion = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!firestore || !user) return

    const formData = new FormData(e.currentTarget)
    const jumboId = formData.get("jumboId") as string
    const selectedJumbo = jumbos.find(j => j.id === jumboId)
    
    if (!selectedJumbo) return

    const slitWidth = Number(formData.get("slitWidth"))
    const numRolls = Number(formData.get("numRolls"))

    // 1. Mark Jumbo as "Consumed" (or reduced quantity in a real system)
    updateDocumentNonBlocking(doc(firestore, 'inventoryItems', jumboId), {
      status: "Consumed",
      updatedAt: new Date().toISOString()
    })

    // 2. Create Slitted Rolls
    for (let i = 0; i < numRolls; i++) {
      const slitData = {
        barcode: `SLT-${Date.now().toString().slice(-6)}-${i+1}`,
        name: `Slitted: ${selectedJumbo.name}`,
        parentJumboId: jumboId,
        itemType: "Slitted Roll",
        dimensions: `${slitWidth}mm x ${selectedJumbo.dimensions.split('x')[1].trim()}`,
        currentQuantity: 1,
        unitOfMeasure: "roll",
        location: "Production Ready",
        status: "In Stock",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdById: user.uid
      }
      addDocumentNonBlocking(collection(firestore, 'inventoryItems'), slitData)
    }

    setIsDialogOpen(false)
    toast({
      title: "Conversion Complete",
      description: `Jumbo ${selectedJumbo.barcode} has been slitted into ${numRolls} rolls.`
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">Slitting (Inventory Conversion)</h2>
          <p className="text-muted-foreground">Convert master Jumbo Rolls into usable Slitted Rolls for production.</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)} className="bg-primary hover:bg-primary/90">
          <Scissors className="mr-2 h-4 w-4" /> Start Slitting Run
        </Button>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleSlittingConversion}>
            <DialogHeader>
              <DialogTitle>Slitting Work Order</DialogTitle>
              <DialogDescription>Select a Jumbo Roll to divide into smaller widths.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="jumboId">Select Jumbo Roll</Label>
                <Select name="jumboId" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose source roll" />
                  </SelectTrigger>
                  <SelectContent>
                    {jumbos.map((j) => (
                      <SelectItem key={j.id} value={j.id}>{j.barcode} - {j.name} ({j.dimensions})</SelectItem>
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
                  <Label htmlFor="numRolls">Number of Rolls</Label>
                  <Input id="numRolls" name="numRolls" type="number" defaultValue="1" required />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit">Convert Stock</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <ArrowRightLeft className="h-4 w-4 text-primary" /> Conversion Logic
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs space-y-4 text-muted-foreground leading-relaxed">
            <p>In Narrow Web Flexo, slitting is an **inventory conversion** step. It transforms raw master rolls (Jumbos) into production-ready rolls (Slitted).</p>
            <div className="p-3 bg-muted rounded-md border border-dashed">
              <p className="font-bold text-foreground mb-1">Stock Impact:</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>Consumes 1 Jumbo Roll.</li>
                <li>Generates N Slitted Rolls.</li>
                <li>Updates "Production Ready" inventory.</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-primary" /> Slitted Roll Stock
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Slit ID</TableHead>
                  <TableHead>Width x Length</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-10">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                    </TableCell>
                  </TableRow>
                ) : slittedRolls.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-xs font-bold">{s.barcode}</TableCell>
                    <TableCell className="text-xs">{s.dimensions}</TableCell>
                    <TableCell><Badge variant="secondary">{s.status}</Badge></TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">{new Date(s.createdAt).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
                {slittedRolls.length === 0 && !isLoading && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">
                      No conversion history found.
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
