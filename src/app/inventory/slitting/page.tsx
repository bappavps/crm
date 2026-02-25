
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

  // Roll Settings
  const settingsDocRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'settings', 'roll-numbering');
  }, [firestore]);
  const { data: settings } = useDoc(settingsDocRef);

  // Firestore Queries - Fetch specifically from jumbo_stock
  const jumboQuery = useMemoFirebase(() => {
    if (!firestore || !user || !adminData) return null;
    return collection(firestore, 'jumbo_stock');
  }, [firestore, user, adminData])

  const slittedQuery = useMemoFirebase(() => {
    if (!firestore || !user || !adminData) return null;
    return collection(firestore, 'inventoryItems');
  }, [firestore, user, adminData])

  const { data: jumbos, isLoading: jumbosLoading } = useCollection(jumboQuery)
  const { data: inventory, isLoading: itemsLoading } = useCollection(slittedQuery)

  const activeJumbos = jumbos?.filter(j => j.status === 'In Stock') || []
  const slittedRolls = inventory?.filter(item => item.itemType === 'Slitted Roll') || []

  const handleSlittingConversion = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!firestore || !user) return

    const formData = new FormData(e.currentTarget)
    const jumboId = formData.get("jumboId") as string
    const selectedJumbo = activeJumbos.find(j => j.id === jumboId)
    
    if (!selectedJumbo) return

    const slitWidth = Number(formData.get("slitWidth"))
    const numRolls = Number(formData.get("numRolls"))

    // 1. Mark Jumbo as "Consumed" in jumbo_stock collection
    updateDocumentNonBlocking(doc(firestore, 'jumbo_stock', jumboId), {
      status: "Consumed",
      updatedAt: new Date().toISOString()
    })

    // 2. Create Slitted Rolls in inventoryItems using Global Settings
    const sep = settings?.separator || "-"
    const prefixType = settings?.childRollPrefixType || "Alphabet"

    for (let i = 0; i < numRolls; i++) {
      let childId = ""
      if (prefixType === "Alphabet") {
        childId = String.fromCharCode(65 + i) // A, B, C...
      } else {
        childId = (i + 1).toString() // 1, 2, 3...
      }

      const generatedBarcode = `${selectedJumbo.rollNo}${sep}${childId}`

      const slitData = {
        barcode: generatedBarcode,
        name: `Slitted: ${selectedJumbo.paperType}`,
        parentJumboId: jumboId,
        parentRollNo: selectedJumbo.rollNo,
        itemType: "Slitted Roll",
        dimensions: `${slitWidth}mm x ${selectedJumbo.lengthMeters}m`,
        currentQuantity: 1,
        unitOfMeasure: "roll",
        location: "Production Ready",
        status: "In Stock",
        createdAt: new Date().toISOString(),
        createdById: user.uid
      }
      addDocumentNonBlocking(collection(firestore, 'inventoryItems'), slitData)
    }

    setIsDialogOpen(false)
    toast({
      title: "Stock Converted",
      description: `Jumbo ${selectedJumbo.rollNo} converted into ${numRolls} rolls using ${prefixType} hierarchy.`
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">Slitting (Inventory Conversion)</h2>
          <p className="text-muted-foreground">Transform raw jumbo rolls into production-ready slit rolls.</p>
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
              <DialogDescription>Select a Jumbo Roll from the GRN stock to divide.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="jumboId">Select Jumbo Roll (In Stock)</Label>
                <Select name="jumboId" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose source roll" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeJumbos.map((j) => (
                      <SelectItem key={j.id} value={j.id}>
                        {j.rollNo} - {j.paperType} ({j.widthMm}mm)
                      </SelectItem>
                    ))}
                    {activeJumbos.length === 0 && <SelectItem value="none" disabled>No jumbo stock available</SelectItem>}
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
                  <Input id="numRolls" name="numRolls" type="number" defaultValue={1} required />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit">Execute Conversion</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1 border-primary/20">
          <CardHeader><CardTitle className="text-sm font-bold flex items-center gap-2"><ArrowRightLeft className="h-4 w-4 text-primary" /> Logic</CardTitle></CardHeader>
          <CardContent className="text-xs space-y-4 text-muted-foreground leading-relaxed">
            <p>Slitting marks a Jumbo Roll as **Consumed** and generates multiple production-ready **Slitted Rolls** inheriting the jumbo's length.</p>
            <div className="p-3 bg-muted rounded-md border border-dashed">
              <p className="font-bold text-foreground mb-1">Process Impact:</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>1 Jumbo Roll (Source)</li>
                <li>&rarr; Marked as Consumed</li>
                <li>&rarr; N Slitted Rolls (Inventory)</li>
                <li>&rarr; Hierarchical Numbering: {settings?.separator || "-"}</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader><CardTitle className="text-lg flex items-center gap-2"><RefreshCw className="h-5 w-5 text-primary" /> Active Slitted Roll Stock</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Slit ID</TableHead>
                  <TableHead>Dimensions</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {itemsLoading ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-10"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></TableCell></TableRow>
                ) : slittedRolls.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-xs font-bold">{s.barcode}</TableCell>
                    <TableCell className="text-xs font-mono">{s.dimensions}</TableCell>
                    <TableCell><Badge variant="secondary">{s.status}</Badge></TableCell>
                    <TableCell className="text-right"><Button variant="ghost" size="sm">Trace</Button></TableCell>
                  </TableRow>
                ))}
                {slittedRolls.length === 0 && !itemsLoading && (
                  <TableRow><TableCell colSpan={4} className="text-center py-10 text-muted-foreground italic">No conversion history found.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
