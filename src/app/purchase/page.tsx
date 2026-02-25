
"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ShoppingBag, Plus, Loader2, Calendar as CalIcon } from "lucide-react"
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

export default function PurchasePage() {
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
  const purchaseOrdersQuery = useMemoFirebase(() => {
    if (!firestore || !user || !adminData) return null;
    return collection(firestore, 'purchaseOrders');
  }, [firestore, user, adminData])

  const suppliersQuery = useMemoFirebase(() => {
    if (!firestore || !user || !adminData) return null;
    return collection(firestore, 'suppliers');
  }, [firestore, user, adminData])

  const materialsQuery = useMemoFirebase(() => {
    if (!firestore || !user || !adminData) return null;
    return collection(firestore, 'materials');
  }, [firestore, user, adminData])

  const { data: pos, isLoading: posLoading } = useCollection(purchaseOrdersQuery)
  const { data: suppliers } = useCollection(suppliersQuery)
  const { data: materials } = useCollection(materialsQuery)

  const handleCreatePO = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!firestore || !user) return

    const formData = new FormData(e.currentTarget)
    const supplierId = formData.get("supplierId") as string
    const materialId = formData.get("materialId") as string
    
    const selectedSupplier = suppliers?.find(s => s.id === supplierId)
    const selectedMaterial = materials?.find(m => m.id === materialId)

    if (!supplierId || !materialId) {
      toast({ variant: "destructive", title: "Error", description: "Supplier and Material are required." })
      return
    }

    const poData = {
      poNumber: `PO-${Date.now().toString().slice(-6)}`,
      supplierId,
      supplierName: selectedSupplier?.name || "Unknown Vendor",
      materialName: selectedMaterial?.name || "Raw Material",
      orderDate: new Date().toISOString(),
      requiredDate: formData.get("requiredDate") as string || new Date().toISOString(),
      status: "Ordered",
      totalAmount: Number(formData.get("totalAmount")) || 0,
      createdById: user.uid,
      createdAt: new Date().toISOString()
    }

    addDocumentNonBlocking(collection(firestore, 'purchaseOrders'), poData)

    setIsDialogOpen(false)
    toast({
      title: "Purchase Order Created",
      description: `${poData.poNumber} has been issued to ${poData.supplierName}.`
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">Purchase Management</h2>
          <p className="text-muted-foreground">Procurement of raw materials and consumables.</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)} className="bg-primary hover:bg-primary/90">
          <Plus className="mr-2 h-4 w-4" /> Create PO
        </Button>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleCreatePO}>
            <DialogHeader>
              <DialogTitle>New Purchase Order</DialogTitle>
              <DialogDescription>Select a vendor and material to issue a new procurement request.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="supplierId">Select Supplier</Label>
                <Select name="supplierId" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a Supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers?.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                    {(!suppliers || suppliers.length === 0) && (
                      <div className="p-2 text-xs text-muted-foreground text-center">No suppliers found in Master Data</div>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="materialId">Material Required</Label>
                <Select name="materialId" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose Material" />
                  </SelectTrigger>
                  <SelectContent>
                    {materials?.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                    ))}
                    {(!materials || materials.length === 0) && (
                      <div className="p-2 text-xs text-muted-foreground text-center">No materials found in Master Data</div>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="requiredDate">Required By</Label>
                  <Input id="requiredDate" name="requiredDate" type="date" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="totalAmount">Estimated Total (₹)</Label>
                  <Input id="totalAmount" name="totalAmount" type="number" placeholder="0.00" />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit">Issue Purchase Order</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-primary" /> Active Purchase Order Registry
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>PO Number</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Material</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {posLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                    <p className="text-xs text-muted-foreground mt-2">Syncing procurement records...</p>
                  </TableCell>
                </TableRow>
              ) : pos?.map((po) => (
                <TableRow key={po.id}>
                  <TableCell className="font-bold font-mono text-xs">{po.poNumber}</TableCell>
                  <TableCell className="font-medium">{po.supplierName}</TableCell>
                  <TableCell className="text-sm">{po.materialName}</TableCell>
                  <TableCell className="text-xs">{new Date(po.orderDate).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Badge variant={po.status === 'Received' ? 'default' : 'outline'} className={po.status === 'Received' ? 'bg-emerald-500' : ''}>
                      {po.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm">Details</Button>
                  </TableCell>
                </TableRow>
              ))}
              {(!pos || pos.length === 0) && !posLoading && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <ShoppingBag className="h-8 w-8 opacity-20" />
                      <p>No purchase orders found. Issue a PO to start procurement.</p>
                    </div>
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
