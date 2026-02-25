
"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, Filter, QrCode, Loader2, Package, Info, Boxes, FilterX, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useFirestore, useUser, useCollection, useMemoFirebase, useDoc } from "@/firebase"
import { collection, doc } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"

type SortField = 'barcode' | 'name' | 'itemType' | 'status';
type SortOrder = 'asc' | 'desc';

export default function InventoryPage() {
  const { toast } = useToast()
  const { user } = useUser()
  const firestore = useFirestore()
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<any>(null)
  
  // Filtering & Sorting State
  const [searchQuery, setSearchQuery] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [sortField, setSortField] = useState<SortField>('name')
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc')

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

  const jumboQuery = useMemoFirebase(() => {
    if (!firestore || !user || !adminData) return null;
    return collection(firestore, 'jumbo_stock');
  }, [firestore, user, adminData])

  const { data: inventory, isLoading: itemsLoading } = useCollection(inventoryQuery)
  const { data: jumbos, isLoading: jumbosLoading } = useCollection(jumboQuery)

  const openDetails = (item: any) => {
    setSelectedItem(item)
    setIsDetailsOpen(true)
  }

  const resetFilters = () => {
    setSearchQuery("")
    setCategoryFilter("all")
    toast({ title: "Filters Cleared", description: "Showing all current stock." })
  }

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Combine and format for display
  const combinedStock = useMemo(() => {
    const jumboItems = jumbos?.map(j => ({ 
      ...j, 
      name: j.paperType, 
      itemType: 'Jumbo Roll', 
      barcode: j.rollNo, 
      currentQuantity: 1, 
      dimensions: `${j.widthMm}mm x ${j.lengthMeters}m` 
    })) || [];
    
    let result = [...jumboItems, ...(inventory || [])];

    // Filter by search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(item => 
        item.name?.toLowerCase().includes(q) ||
        item.barcode?.toLowerCase().includes(q)
      );
    }

    // Filter by category
    if (categoryFilter !== "all") {
      result = result.filter(item => item.itemType === categoryFilter);
    }

    // Sorting
    result.sort((a, b) => {
      let valA = a[sortField]?.toString().toLowerCase() || "";
      let valB = b[sortField]?.toString().toLowerCase() || "";

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [jumbos, inventory, searchQuery, categoryFilter, sortField, sortOrder]);

  const isLoading = itemsLoading || jumbosLoading

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">Stock Registry</h2>
          <p className="text-muted-foreground">Unified view of Jumbo Rolls, Slitted Rolls, and Consumables.</p>
        </div>
        <Button variant="outline" onClick={() => toast({ title: "Scanner Active", description: "Ready to scan barcode..." })}>
          <QrCode className="mr-2 h-4 w-4" /> Scan Barcode
        </Button>
      </div>

      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Info className="h-5 w-5 text-primary" /> Stock Detail: {selectedItem?.barcode}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground font-medium">Material Name</span>
              <span className="font-bold">{selectedItem?.name}</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground font-medium">Category</span>
              <Badge variant="secondary">{selectedItem?.itemType}</Badge>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground font-medium">Dimensions</span>
              <span className="font-mono">{selectedItem?.dimensions || 'N/A'}</span>
            </div>
            {selectedItem?.itemType === 'Jumbo Roll' && (
              <>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-muted-foreground font-medium">Weight</span>
                  <span>{selectedItem?.weightKg} kg</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-muted-foreground font-medium">Lot No</span>
                  <span className="font-mono">{selectedItem?.lotNumber}</span>
                </div>
              </>
            )}
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground font-medium">Status</span>
              <Badge className={selectedItem?.status === 'In Stock' ? 'bg-emerald-500' : 'bg-primary'}>{selectedItem?.status}</Badge>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="w-full" onClick={() => setIsDetailsOpen(false)}>Close Record</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Boxes className="h-5 w-5 text-primary" /> Total Inventory Balance
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search stock..." 
                  className="pl-8 w-[200px] lg:w-[300px]" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Items</SelectItem>
                  <SelectItem value="Jumbo Roll">Jumbo Rolls</SelectItem>
                  <SelectItem value="Slitted Roll">Slitted Rolls</SelectItem>
                  <SelectItem value="Finished Good">Finished Goods</SelectItem>
                  <SelectItem value="Ink">Inks</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" onClick={resetFilters} title="Reset Filters">
                <FilterX className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => toggleSort('barcode')}>
                  <div className="flex items-center gap-1">Barcode {sortField === 'barcode' ? (sortOrder === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-20" />}</div>
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => toggleSort('name')}>
                  <div className="flex items-center gap-1">Material {sortField === 'name' ? (sortOrder === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-20" />}</div>
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => toggleSort('itemType')}>
                  <div className="flex items-center gap-1">Category {sortField === 'itemType' ? (sortOrder === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-20" />}</div>
                </TableHead>
                <TableHead>Dimensions</TableHead>
                <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => toggleSort('status')}>
                  <div className="flex items-center gap-1">Status {sortField === 'status' ? (sortOrder === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-20" />}</div>
                </TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></TableCell>
                </TableRow>
              ) : combinedStock.map((item) => (
                <TableRow key={item.id} className="group">
                  <TableCell className="font-mono text-xs font-bold">{item.barcode}</TableCell>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell><Badge variant="outline">{item.itemType}</Badge></TableCell>
                  <TableCell className="text-xs font-mono">{item.dimensions}</TableCell>
                  <TableCell>
                    <Badge className={item.status === 'In Stock' ? 'bg-emerald-500' : 'bg-primary'}>{item.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => openDetails(item)}>Details</Button>
                  </TableCell>
                </TableRow>
              ))}
              {combinedStock.length === 0 && !isLoading && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">No stock matching your search.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
