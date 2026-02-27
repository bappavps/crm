"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ShoppingCart, Plus, Search, Loader2, Info, Calendar, User, Hash, Wallet, AlertTriangle } from "lucide-react"
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
import { useFirestore, useUser, useCollection, useMemoFirebase, useDoc } from "@/firebase"
import { collection, doc } from "firebase/firestore"
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
  
  // Selection state for validation
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("")

  // Authorization check
  const adminDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'adminUsers', user.uid);
  }, [firestore, user]);
  const { data: adminData, isLoading: authLoading } = useDoc(adminDocRef);

  // Fetching Data from Firestore - Guarded by adminData
  const ordersQuery = useMemoFirebase(() => {
    if (!firestore || !user || !adminData) return null;
    return collection(firestore, 'salesOrders');
  }, [firestore, user, adminData])

  const customersQuery = useMemoFirebase(() => {
    if (!firestore || !user || !adminData) return null;
    return collection(firestore, 'customers');
  }, [firestore, user, adminData])

  const estimatesQuery = useMemoFirebase(() => {
    if (!firestore || !user || !adminData) return null;
    return collection(firestore, 'estimates');
  }, [firestore, user, adminData])

  const { data: orders, isLoading: ordersLoading } = useCollection(ordersQuery)
  const { data: customers } = useCollection(customersQuery)
  const { data: estimates } = useCollection(estimatesQuery)

  const selectedCustomerData = useMemo(() => 
    customers?.find(c => c.id === selectedCustomerId), 
    [customers, selectedCustomerId]
  )

  const checkIsOverdue = (c: any) => {
    if (!c || !c.lastInvoiceDate || !c.creditDays) return false
    const lastInvoice = new Date(c.lastInvoiceDate)
    const dueDate = new Date(lastInvoice.getTime() + c.creditDays * 24 * 60 * 60 * 1000)
    return new Date() > dueDate
  }

  const isOverdue = useMemo(() => checkIsOverdue(selectedCustomerData), [selectedCustomerData])

  const handleCreateOrder = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!firestore || !user) return

    const formData = new FormData(e.currentTarget)
    const customerId = selectedCustomerId
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
      customerName: selectedCustomer?.companyName || "New Customer",
      estimateId: estimateId || "Direct Entry",
      productCode: selectedEstimate?.productCode || formData.get("productCode") || "Custom Label",
      poNumber: poNumber || "N/A",
      orderDate: new Date().toISOString(),
      deliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      status: "Confirmed",
      creditHoldWarning: isOverdue || !!selectedCustomer?.isCreditBlocked,
      totalAmount: selectedEstimate?.totalSellingPrice || Number(formData.get("totalAmount")) || 0,
      qty: selectedEstimate?.orderQuantity || Number(formData.get("qty")) || 0,
      createdById: user.uid,
      createdAt: new Date().toISOString()
    }

    addDocumentNonBlocking(collection(firestore, 'salesOrders'), orderData)

    setIsDialogOpen(false)
    setSelectedCustomerId("")
    toast({
      title: "Sales Order Created",
      description: orderData.creditHoldWarning 
        ? `Order ${orderData.orderNumber} created with CREDIT HOLD flag.`
        : `New order ${orderData.orderNumber} has been generated.`,
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

  if (authLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin mb-4 text-primary" />
        <p>Syncing order books...</p>
      </div>
    )
  }

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
        <DialogContent className="sm:max-w-[450px]">
          <form onSubmit={handleCreateOrder}>
            <DialogHeader>
              <DialogTitle>New Sales Order</DialogTitle>
              <DialogDescription>Link this order to a customer and optionally pull data from an estimate.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="customerId">Select Customer</Label>
                <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId} required>
                  <SelectTrigger className={isOverdue ? 'border-destructive' : ''}>
                    <SelectValue placeholder="Choose a Customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers?.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.companyName} {checkIsOverdue(c) ? '(OVERDUE)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {isOverdue && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md flex items-start gap-2 animate-in fade-in slide-in-from-top-1">
                  <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
                  <div className="text-xs text-destructive font-bold uppercase space-y-1">
                    <p>Credit Period Exceeded</p>
                    <p className="text-[9px] font-medium normal-case">Please inform Accounts/Admin. Order will be marked with a hold flag.</p>
                  </div>
                </div>
              )}

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
                <Label htmlFor="productCode">Manual Product Code (if no estimate)</Label>
                <Input id="productCode" name="productCode" placeholder="e.g. LAB-XYZ" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="poNumber">PO Number</Label>
                <Input id="poNumber" name="poNumber" placeholder="Customer PO reference" />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" className={isOverdue ? 'bg-destructive hover:bg-destructive/90' : ''}>
                Confirm Order {isOverdue && '(Hold Warning)'}
              </Button>
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
              <div className="flex flex-col items-end gap-1">
                <Badge className={selectedOrder?.status === 'Confirmed' ? 'bg-blue-500' : 'bg-primary'}>
                  {selectedOrder?.status}
                </Badge>
                {selectedOrder?.creditHoldWarning && (
                  <Badge variant="destructive" className="text-[8px] h-4">CREDIT HOLD</Badge>
                )}
              </div>
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
                <TableRow key={order.id} className={order.creditHoldWarning ? 'bg-destructive/5' : ''}>
                  <TableCell className="font-bold font-mono text-xs">
                    <div className="flex items-center gap-2">
                      {order.creditHoldWarning && <AlertTriangle className="h-3 w-3 text-destructive" />}
                      {order.orderNumber}
                    </div>
                  </TableCell>
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
