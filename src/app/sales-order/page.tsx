
"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ShoppingCart, Plus, Search, Loader2, Info, Calendar, User, Hash, Wallet, AlertTriangle, Factory, ArrowRight } from "lucide-react"
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
import { collection, doc, query, where, addDoc, serverTimestamp, updateDoc } from "firebase/firestore"
import { addDocumentNonBlocking } from "@/firebase/non-blocking-updates"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"

export default function SalesOrderPage() {
  const { toast } = useToast()
  const { user } = useUser()
  const router = useRouter()
  const firestore = useFirestore()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<any>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  
  // Selection state for validation
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("")

  // Authorization check
  const adminDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'adminUsers', user.uid);
  }, [firestore, user]);
  const { data: adminData, isLoading: authLoading } = useDoc(adminDocRef);
  const isAdmin = !!adminData;

  const prefixConfigRef = useMemoFirebase(() => firestore ? doc(firestore, 'system_settings', 'prefix_config') : null, [firestore]);
  const { data: prefixConfig } = useDoc(prefixConfigRef);

  const ordersQuery = useMemoFirebase(() => {
    if (!firestore || !user || authLoading) return null;
    const base = collection(firestore, 'salesOrders');
    if (!isAdmin) return query(base, where("sales_owner_id", "==", user.uid));
    return base;
  }, [firestore, user, isAdmin, authLoading])

  const customersQuery = useMemoFirebase(() => {
    if (!firestore || !user || authLoading) return null;
    const base = collection(firestore, 'customers');
    if (!isAdmin) return query(base, where("sales_owner_id", "==", user.uid));
    return base;
  }, [firestore, user, isAdmin, authLoading])

  const estimatesQuery = useMemoFirebase(() => {
    if (!firestore || !user || authLoading) return null;
    const base = collection(firestore, 'estimates');
    if (!isAdmin) return query(base, where("sales_owner_id", "==", user.uid));
    return base;
  }, [firestore, user, isAdmin, authLoading])

  const { data: orders, isLoading: ordersLoading } = useCollection(ordersQuery)
  const { data: customers } = useCollection(customersQuery)
  const { data: estimates } = useCollection(estimatesQuery)

  const handleCreateOrder = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!firestore || !user) return

    const formData = new FormData(e.currentTarget)
    const estimateId = formData.get("estimateId") as string
    const selectedCustomer = customers?.find(c => c.id === selectedCustomerId)
    const selectedEstimate = estimates?.find(e => e.id === estimateId)

    if (!selectedCustomer) return

    const prefix = prefixConfig?.jobPrefix || "SO";
    const year = new Date().getFullYear().toString();
    const format = prefixConfig?.format || "PREFIX-YYYY-###";
    const randomNum = Math.floor(1000 + Math.random() * 9000).toString();
    const orderNumber = format.replace("PREFIX", prefix).replace("YYYY", year).replace("YY", year.slice(-2)).replace("###", randomNum);

    const orderData = {
      orderNumber,
      customerId: selectedCustomerId,
      customerName: selectedCustomer.companyName,
      estimateId: estimateId || "Direct Entry",
      productCode: selectedEstimate?.productCode || formData.get("productCode") || "Custom Label",
      poNumber: formData.get("poNumber") || "N/A",
      orderDate: new Date().toISOString(),
      deliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      status: "Confirmed",
      totalAmount: selectedEstimate?.totalSellingPrice || Number(formData.get("totalAmount")) || 0,
      qty: selectedEstimate?.orderQuantity || Number(formData.get("qty")) || 0,
      sales_owner_id: selectedCustomer.sales_owner_id || user.uid,
      sales_owner_name: selectedCustomer.sales_owner_name || user.displayName || "Unknown",
      sales_owner_code: selectedCustomer.sales_owner_code || "N/A",
      createdById: user.uid,
      createdAt: new Date().toISOString()
    }

    addDocumentNonBlocking(collection(firestore, 'salesOrders'), orderData)
    setIsDialogOpen(false)
    toast({ title: "Sales Order Created", description: `Order ${orderData.orderNumber} is now active.` })
  }

  const handleStartProduction = async (order: any) => {
    if (!firestore || !user) return
    setIsProcessing(true)

    try {
      const jobData = {
        salesOrderId: order.id,
        orderNumber: order.orderNumber,
        clientName: order.customerName,
        itemNameSummary: order.productCode,
        status: "Confirmed", // Process flow: Starts as Confirmed in Planning
        currentStage: "Planning",
        priority: "Medium",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdById: user.uid,
        sales_owner_id: order.sales_owner_id
      }

      await addDoc(collection(firestore, 'jobs'), jobData)
      await updateDoc(doc(firestore, 'salesOrders', order.id), { status: 'In Production' })
      
      toast({ title: "Job Initialized", description: "Order converted to Job Planning board." })
      router.push('/design/production-planning')
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "Failed to initialize production job." })
    } finally {
      setIsProcessing(false)
    }
  }

  const filteredOrders = orders?.filter(order => 
    (order.orderNumber || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (order.customerName || "").toLowerCase().includes(searchQuery.toLowerCase())
  )

  const isLoading = authLoading || ordersLoading;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">Sales Order Registry</h2>
          <p className="text-muted-foreground">Manage confirmed orders and release them to Job Planning.</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}><Plus className="mr-2 h-4 w-4" /> Create Sales Order</Button>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <form onSubmit={handleCreateOrder}>
            <DialogHeader>
              <DialogTitle>New Sales Order</DialogTitle>
              <DialogDescription>Initialize a customer order to begin factory flow.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="customerId">Select Customer</Label>
                <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId} required>
                  <SelectTrigger><SelectValue placeholder="Choose a Customer" /></SelectTrigger>
                  <SelectContent>
                    {customers?.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.companyName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="estimateId">Linked Estimate (Optional)</Label>
                <Select name="estimateId">
                  <SelectTrigger><SelectValue placeholder="Select Estimate" /></SelectTrigger>
                  <SelectContent>
                    {estimates?.filter(e => e.status === 'Approved' || e.status === 'Draft').map((e) => (
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

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2"><ShoppingCart className="h-5 w-5 text-primary" /> Active Orders</CardTitle>
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search orders..." className="pl-8" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order ID</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Total Value</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Workflow</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-10"><Loader2 className="animate-spin mx-auto" /></TableCell></TableRow>
              ) : filteredOrders?.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-bold font-mono text-xs text-primary">{order.orderNumber}</TableCell>
                  <TableCell className="font-medium">{order.customerName}</TableCell>
                  <TableCell className="text-xs">{new Date(order.orderDate).toLocaleDateString()}</TableCell>
                  <TableCell className="font-semibold">₹{order.totalAmount?.toLocaleString()}</TableCell>
                  <TableCell><Badge variant="outline">{order.status}</Badge></TableCell>
                  <TableCell className="text-right">
                    {order.status === 'Confirmed' ? (
                      <Button variant="outline" size="sm" className="font-bold border-emerald-500 text-emerald-600 hover:bg-emerald-50" onClick={() => handleStartProduction(order)} disabled={isProcessing}>
                        <Factory className="mr-2 h-3 w-3" /> Convert to Job
                      </Button>
                    ) : (
                      <Badge className="bg-emerald-500">RELASED</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
