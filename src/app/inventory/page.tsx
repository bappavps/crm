"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, Plus, Filter, QrCode, Loader2, Package, Info, MapPin, Calendar, Boxes } from "lucide-react"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { useFirestore, useUser, useCollection, useMemoFirebase, useDoc } from "@/firebase"
import { collection, doc } from "firebase/firestore"
import { addDocumentNonBlocking } from "@/firebase/non-blocking-updates"
import { useToast } from "@/hooks/use-toast"

export default function InventoryPage() {
  const { toast } = useToast()
  const { user } = useUser()
  const firestore = useFirestore()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<any>(null)
  const [searchQuery, setSearchQuery] = useState("")

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

  const handleAddItem = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!firestore || !user) return

    const formData = new FormData(e.currentTarget)
    
    const itemData = {
      barcode: formData.get("barcode") as string,
      name: formData.get("name") as string,
      itemType: formData.get("itemType") as string,
      dimensions: formData.get("dimensions") as string,
      currentQuantity: Number(formData.get("quantity")),
      unitOfMeasure: "units",
      location: formData.get("location") as string || "Warehouse A",
      status: "In Stock",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdById: user.uid
    }

    addDocumentNonBlocking(collection(firestore, 'inventoryItems'), itemData)

    setIsDialogOpen(false)
    toast({
      title: "Item Added",
      description: `${itemData.name} has been added to the inventory registry.`
    })
  }

  const openDetails = (item: any) => {
    setSelectedItem(item)
    setIsDetailsOpen(true)
  }

  const filteredInventory = inventory?.filter(item => 
    item.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.barcode?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">Inventory Management</h2>
          <p className="text-muted-foreground">Track Jumbo Rolls, Slitted Rolls, and Finished Goods.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => toast({ title: "Scanner Active", description: "Ready to scan barcode..." })}><QrCode className="mr-2 h-4 w-4" /> Scan Barcode</Button>
          <Button onClick={() => setIsDialogOpen(true)}><Plus className="mr-2 h-4 w-4" /> Add Item</Button>
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleAddItem}>
            <DialogHeader>
              <DialogTitle>Add Inventory Item</DialogTitle>
              <DialogDescription>Enter the details for new stock material or finished goods.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="barcode">SKU / Barcode</Label>
                <Input id="barcode" name="barcode" placeholder="e.g. JMB-001" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="name">Material Name</Label>
                <Input id="name" name="name" placeholder="e.g. Semi-Gloss Paper" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="itemType">Category</Label>
                  <Select name="itemType" defaultValue="Jumbo Roll">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Jumbo Roll">Jumbo Roll</SelectItem>
                      <SelectItem value="Slitted Roll">Slitted Roll</SelectItem>
                      <SelectItem value="WIP">WIP</SelectItem>
                      <SelectItem value="Finished Good">Finished Good</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="quantity">Quantity</Label>
                  <Input id="quantity" name="quantity" type="number" defaultValue="1" required />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="dimensions">Dimensions (e.g. Width x Length)</Label>
                <Input id="dimensions" name="dimensions" placeholder="1020mm x 4000m" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="location">Warehouse Location</Label>
                <Input id="location" name="location" placeholder="e.g. Section B-12" />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit">Register Stock</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Info className="h-5 w-5 text-primary" /> Item Details
            </DialogTitle>
            <DialogDescription>Full stock tracking data for {selectedItem?.barcode}</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <h3 className="text-lg font-bold">{selectedItem?.name}</h3>
                <p className="text-xs text-muted-foreground font-mono">{selectedItem?.barcode}</p>
              </div>
              <Badge className={
                selectedItem?.status === 'In Stock' ? 'bg-emerald-500' : 
                selectedItem?.status === 'Low Stock' ? 'bg-amber-500' : 'bg-primary'
              }>
                {selectedItem?.status}
              </Badge>
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  <Boxes className="h-3 w-3" /> Quantity & Type
                </div>
                <div className="space-y-1">
                  <p className="text-2xl font-black">{selectedItem?.currentQuantity} <span className="text-sm font-normal text-muted-foreground">{selectedItem?.unitOfMeasure || 'units'}</span></p>
                  <Badge variant="outline" className="text-[10px]">{selectedItem?.itemType}</Badge>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  <MapPin className="h-3 w-3" /> Location
                </div>
                <div className="space-y-1">
                  <p className="font-semibold text-sm">{selectedItem?.location || 'Warehouse A'}</p>
                  <p className="text-[10px] text-muted-foreground italic">Ready for picking</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                <Calendar className="h-3 w-3" /> Tracking Info
              </div>
              <div className="grid grid-cols-2 gap-4 bg-muted/30 p-3 rounded-md text-[11px]">
                <div>
                  <span className="text-muted-foreground block">Created At</span>
                  <span className="font-medium">{selectedItem?.createdAt ? new Date(selectedItem.createdAt).toLocaleString() : 'N/A'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Dimensions</span>
                  <span className="font-medium">{selectedItem?.dimensions || 'N/A'}</span>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="w-full" onClick={() => setIsDetailsOpen(false)}>Close Record</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" /> Stock Registry
            </CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  type="search" 
                  placeholder="Search inventory..." 
                  className="pl-8 w-[250px]" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Button variant="outline" size="icon"><Filter className="h-4 w-4" /></Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU ID</TableHead>
                <TableHead>Material Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Dimensions</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                    <p className="text-xs text-muted-foreground mt-2">Loading inventory...</p>
                  </TableCell>
                </TableRow>
              ) : filteredInventory?.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono text-xs font-bold">{item.barcode}</TableCell>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{item.itemType}</Badge>
                  </TableCell>
                  <TableCell className="text-xs">{item.dimensions || "N/A"}</TableCell>
                  <TableCell>{item.currentQuantity}</TableCell>
                  <TableCell>
                    <Badge className={
                      item.status === 'In Stock' ? 'bg-emerald-500' : 
                      item.status === 'Low Stock' ? 'bg-amber-500' : 
                      item.status === 'Out of Stock' ? 'bg-destructive' : 'bg-primary'
                    }>
                      {item.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => openDetails(item)}>Details</Button>
                  </TableCell>
                </TableRow>
              ))}
              {(!filteredInventory || filteredInventory.length === 0) && !isLoading && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <Package className="h-8 w-8 opacity-20" />
                      <p>No inventory records found. Add items to begin tracking.</p>
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
