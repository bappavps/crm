"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ShoppingCart, Plus, Search, Loader2, Info, Calendar, User, Hash, Wallet } from "lucide-react"
import { Input } from "@/components/ui/input"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { useFirestore, useUser, useCollection, useMemoFirebase } from "@/firebase"
import { collection } from "firebase/firestore"
import { addDocumentNonBlocking } from "@/firebase/non-blocking-updates"
import { useToast } from "@/hooks/use-toast"

export default function SalesOrderPage() {
  const { toast } = useToast()
  const { user } = useUser()
  const firestore = useFirestore()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<any>(null)
  const [searchQuery, setSearchQuery] = useState("")

  // Fetching Data from Firestore
  const ordersQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, 'salesOrders');
  }, [firestore, user])

  const customersQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, 'customers');
  }, [firestore, user])

  const estimatesQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, 'estimates');
  }, [firestore, user])

  const { data: orders, isLoading: ordersLoading } = useCollection(ordersQuery)
  const { data: customers } = useCollection(customersQuery)
  const { data: estimates } = useCollection(estimatesQuery)

  const handleCreateOrder = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!firestore || !user) return

    const formData = new FormData(e.currentTarget)
    const customerId = formData.get("customerId") as string
    const estimateId = formData.get("estimateId") as string
    const poNumber = formData.get("poNumber") as string
    
    const selectedCustomer = customers?.find(c => c.id === customerId)
    const selectedEstimate = estimates?.find(e => e.id === estimateId)

    if (!customerId) {
      toast({ variant: "destructive", title: "Validation Error", description: "Customer is required." })
      return
    }

    const orderData = {
      orderNumber: `SO-${Date.now().toString().slice(-6)}`,
      customerId,
      customerName: selectedCustomer?.name || "New Customer",
      estimateId: estimateId || "Direct Entry",
      productCode: selectedEstimate?.productCode || "Custom Label",
      poNumber: poNumber || "N/A",
      orderDate: new Date().toISOString(),
      deliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      status: "Confirmed",
      totalAmount: selectedEstimate?.totalSellingPrice || 0,
      qty: selectedEstimate?.orderQuantity || 0,
      createdById: user.uid,
      createdAt: new Date().toISOString()
    }

    addDocumentNonBlocking(collection(firestore, 'salesOrders'), orderData)

    setIsDialogOpen(false)
    toast({
      title: "Sales Order Created",
      description: `New order ${orderData.orderNumber} has been generated.`,
    })
  }

  const openDetails = (order: any) => {
    setSelectedOrder(order)
    setIsDetailsOpen(true)
  }

  const filteredOrders = orders?.filter(order => 
    order.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
    order.customerName?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">Sales Orders</h2>
          <p className="text-muted-foreground">Manage customer orders and conversion from estimates.</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}><Plus className="mr-2 h-4 w-4" /> Create Sales Order</Button>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleCreateOrder}>
            <DialogHeader>
              <DialogTitle>New Sales Order</DialogTitle>
              <DialogDescription>Link this order to a customer and optionally pull data from an estimate.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="customerId">Select Customer</Label>
                <Select name="customerId" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a Customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers?.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="estimateId">Approved Estimate (Optional)</Label>
                <Select name="estimateId">
                  <SelectTrigger>
                    <SelectValue placeholder="Link an Estimate" />
                  </SelectTrigger>
                  <SelectContent>
                    {estimates?.filter(e => e.status === 'Draft' || e.status === 'Approved').map((e) => (
                      <SelectItem key={e.id} value={e.id}>{e.estimateNumber} - {e.productCode}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="poNumber">PO Number</Label>
                <Input id="poNumber" name="poNumber" placeholder="Customer PO reference" />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit">Confirm Order</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Info className="h-5 w-5 text-primary" /> Sales Order Details
            </DialogTitle>
            <DialogDescription>Full summary for Order {selectedOrder?.orderNumber}</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="flex justify-between items-center border-b pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary">
                  <User className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">Client</p>
                  <p className="font-bold text-base">{selectedOrder?.customerName}</p>
                </div>
              </div>
              <Badge className={selectedOrder?.status === 'Confirmed' ? 'bg-blue-500' : 'bg-primary'}>
                {selectedOrder?.status}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase">
                  <Calendar className="h-3 w-3" /> Order Date
                </div>
                <p className="text-sm font-semibold">{selectedOrder?.orderDate ? new Date(selectedOrder.orderDate).toLocaleDateString() : 'N/A'}</p>
              </div>
              <div className="space-y-1 text-right">
                <div className="flex items-center justify-end gap-1.5 text-[10px] font-bold text-muted-foreground uppercase">
                  <Calendar className="h-3 w-3" /> Delivery Due
                </div>
                <p className="text-sm font-semibold">{selectedOrder?.deliveryDate ? new Date(selectedOrder.deliveryDate).toLocaleDateString() : 'N/A'}</p>
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase">
                  <Hash className="h-3 w-3" /> PO Reference
                </div>
                <p className="text-sm font-mono font-bold text-primary">{selectedOrder?.poNumber || 'N/A'}</p>
              </div>
              <div className="space-y-1 text-right">
                <div className="flex items-center justify-end gap-1.5 text-[10px] font-bold text-muted-foreground uppercase">
                  <Wallet className="h-3 w-3" /> Order Quantity
                </div>
                <p className="text-sm font-black text-foreground">{selectedOrder?.qty?.toLocaleString()} <span className="text-[10px] font-normal text-muted-foreground">labels</span></p>
              </div>
            </div>

            <div className="bg-primary/5 p-4 rounded-lg flex justify-between items-center">
              <span className="text-xs font-bold text-primary uppercase">Total Order Value</span>
              <span className="text-2xl font-black text-primary">₹{selectedOrder?.totalAmount?.toLocaleString()}</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="w-full" onClick={() => setIsDetailsOpen(false)}>Close Summary</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-primary" /> Order History
          </CardTitle>
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search orders..." 
              className="pl-8" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order ID</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Total Value</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ordersLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                    <p className="text-xs text-muted-foreground mt-2">Syncing order data...</p>
                  </TableCell>
                </TableRow>
              ) : filteredOrders?.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-bold font-mono text-xs">{order.orderNumber}</TableCell>
                  <TableCell className="font-medium">{order.customerName}</TableCell>
                  <TableCell className="text-xs">{new Date(order.orderDate).toLocaleDateString()}</TableCell>
                  <TableCell>{order.qty?.toLocaleString()}</TableCell>
                  <TableCell className="font-semibold text-primary">₹{order.totalAmount?.toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge className={
                      order.status === 'Confirmed' ? 'bg-blue-500' : 
                      order.status === 'In Production' ? 'bg-primary' : 
                      'bg-amber-500'
                    }>
                      {order.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => openDetails(order)}>Details</Button>
                  </TableCell>
                </TableRow>
              ))}
              {(!filteredOrders || filteredOrders.length === 0) && !ordersLoading && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                    No active sales orders found. Use the "Create" button to add one.
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
