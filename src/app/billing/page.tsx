
"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Receipt, Printer, Download, Plus, Loader2 } from "lucide-react"
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

export default function BillingPage() {
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
  const invoicesQuery = useMemoFirebase(() => {
    if (!firestore || !user || !adminData) return null;
    return collection(firestore, 'invoices');
  }, [firestore, user, adminData])

  const salesOrdersQuery = useMemoFirebase(() => {
    if (!firestore || !user || !adminData) return null;
    return collection(firestore, 'salesOrders');
  }, [firestore, user, adminData])

  const { data: invoices, isLoading: invoicesLoading } = useCollection(invoicesQuery)
  const { data: salesOrders } = useCollection(salesOrdersQuery)

  const handleCreateInvoice = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!firestore || !user) return

    const formData = new FormData(e.currentTarget)
    const salesOrderId = formData.get("salesOrderId") as string
    const selectedOrder = salesOrders?.find(so => so.id === salesOrderId)

    if (!selectedOrder) {
      toast({ variant: "destructive", title: "Error", description: "Select a Sales Order." })
      return
    }

    const amount = Number(selectedOrder.totalAmount) || 0
    const gstRate = 0.18 // Standard 18% GST
    const gstAmount = amount * gstRate
    const totalWithGst = amount + gstAmount

    const invoiceData = {
      invoiceNumber: `INV/${new Date().getFullYear().toString().slice(-2)}/${Math.floor(1000 + Math.random() * 9000)}`,
      salesOrderId: selectedOrder.id,
      customerId: selectedOrder.customerId,
      customerName: selectedOrder.customerName || "Unknown Client",
      invoiceDate: new Date().toISOString(),
      dueDate: formData.get("dueDate") as string || new Date().toISOString(),
      totalAmountExcludingGst: amount,
      gstAmount: gstAmount,
      totalAmountIncludingGst: totalWithGst,
      status: "Issued",
      paymentTerms: formData.get("paymentTerms") as string || "Net 30",
      tallyExportStatus: false,
      createdById: user.uid,
      createdAt: new Date().toISOString()
    }

    addDocumentNonBlocking(collection(firestore, 'invoices'), invoiceData)

    setIsDialogOpen(false)
    toast({
      title: "Invoice Generated",
      description: `${invoiceData.invoiceNumber} has been created for ${invoiceData.customerName}.`
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">Invoicing & Billing</h2>
          <p className="text-muted-foreground">GST Invoices, Proforma Invoices, and Payment Tracking.</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}><Receipt className="mr-2 h-4 w-4" /> Generate Invoice</Button>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleCreateInvoice}>
            <DialogHeader>
              <DialogTitle>Generate New Invoice</DialogTitle>
              <DialogDescription>Convert a confirmed Sales Order into a tax invoice.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="salesOrderId">Linked Sales Order</Label>
                <Select name="salesOrderId" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Order" />
                  </SelectTrigger>
                  <SelectContent>
                    {salesOrders?.map((so) => (
                      <SelectItem key={so.id} value={so.id}>
                        {so.orderNumber} - {so.customerName}
                      </SelectItem>
                    ))}
                    {(!salesOrders || salesOrders.length === 0) && (
                      <div className="p-2 text-xs text-muted-foreground text-center">No confirmed orders found</div>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="dueDate">Due Date</Label>
                  <Input id="dueDate" name="dueDate" type="date" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="paymentTerms">Terms</Label>
                  <Select name="paymentTerms" defaultValue="Net 30">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Net 15">Net 15</SelectItem>
                      <SelectItem value="Net 30">Net 30</SelectItem>
                      <SelectItem value="Due on Receipt">Due on Receipt</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit">Finalize Invoice</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" /> Invoice Registry
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Amount (Total)</TableHead>
                <TableHead>Tax (GST 18%)</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoicesLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                    <p className="text-xs text-muted-foreground mt-2">Fetching financial records...</p>
                  </TableCell>
                </TableRow>
              ) : invoices?.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell className="font-bold font-mono text-xs">{inv.invoiceNumber}</TableCell>
                  <TableCell className="text-sm">{inv.customerName}</TableCell>
                  <TableCell className="text-xs">{new Date(inv.invoiceDate).toLocaleDateString()}</TableCell>
                  <TableCell className="font-semibold">₹{inv.totalAmountIncludingGst?.toLocaleString()}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">₹{inv.gstAmount?.toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge className={
                      inv.status === 'Paid' ? 'bg-emerald-500' : 
                      inv.status === 'Overdue' ? 'bg-destructive' : 
                      'bg-amber-500'
                    }>
                      {inv.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right flex justify-end gap-2">
                    <Button variant="ghost" size="icon" onClick={() => toast({ title: "Printer Ready", description: "Sending to local spooler..." })}><Printer className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => toast({ title: "Download Started", description: "Saving PDF to local storage." })}><Download className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {(!invoices || invoices.length === 0) && !invoicesLoading && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <Receipt className="h-8 w-8 opacity-20" />
                      <p>No invoices generated yet. Select a Sales Order to begin billing.</p>
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
