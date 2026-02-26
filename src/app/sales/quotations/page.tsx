"use client"

import { useState, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { FileText, Printer, Download, Plus, Loader2, CheckCircle2, XCircle, Send, ShoppingCart, Info, Lock } from "lucide-react"
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
import { collection, doc, updateDoc } from "firebase/firestore"
import { addDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase/non-blocking-updates"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

export default function QuotationRegistryPage() {
  const { toast } = useToast()
  const { user } = useUser()
  const firestore = useFirestore()
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [selectedQuote, setSelectedQuote] = useState<any>(null)
  const printRef = useRef<HTMLDivElement>(null)

  const adminDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'adminUsers', user.uid);
  }, [firestore, user]);
  const { data: adminData, isLoading: authLoading } = useDoc(adminDocRef);

  const quotationsQuery = useMemoFirebase(() => {
    if (!firestore || !user || !adminData) return null;
    return collection(firestore, 'quotations');
  }, [firestore, user, adminData])

  const { data: quotations, isLoading: quotesLoading } = useCollection(quotationsQuery)

  const handleStatusUpdate = (quoteId: string, newStatus: string) => {
    if (!firestore) return
    updateDocumentNonBlocking(doc(firestore, 'quotations', quoteId), {
      status: newStatus,
      updatedAt: new Date().toISOString()
    })
    toast({ title: "Status Updated", description: `Quotation is now ${newStatus}.` })
  }

  const handleConvertToSO = (quote: any) => {
    if (!firestore || !user) return
    
    const orderNumber = `SO-${Date.now().toString().slice(-6)}`;
    const orderData = {
      orderNumber,
      customerId: quote.customerId,
      customerName: quote.customerName,
      estimateId: quote.id,
      productCode: quote.productCode,
      poNumber: `QUOT-${quote.quotationNumber}`,
      orderDate: new Date().toISOString(),
      deliveryDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      status: "Confirmed",
      totalAmount: quote.totalSellingPrice,
      qty: quote.orderQuantity,
      createdById: user.uid,
      createdAt: new Date().toISOString()
    }

    addDocumentNonBlocking(collection(firestore, 'salesOrders'), orderData)
    
    // Also mark quote as converted
    updateDocumentNonBlocking(doc(firestore, 'quotations', quote.id), {
      status: 'Converted',
      convertedToOrder: orderNumber
    })

    toast({
      title: "Order Generated",
      description: `Sales Order ${orderNumber} created successfully.`,
    })
  }

  const handlePrint = () => {
    window.print()
  }

  if (authLoading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin" /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black tracking-tight text-primary">Quotation Registry</h2>
          <p className="text-muted-foreground font-medium">Manage official client quotes and approval workflows.</p>
        </div>
      </div>

      <Card className="border-none shadow-xl">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" /> Active Quotations
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="font-black text-[10px] uppercase">Quote #</TableHead>
                <TableHead className="font-black text-[10px] uppercase">Customer</TableHead>
                <TableHead className="font-black text-[10px] uppercase">Product</TableHead>
                <TableHead className="font-black text-[10px] uppercase">Value</TableHead>
                <TableHead className="font-black text-[10px] uppercase">Status</TableHead>
                <TableHead className="text-right font-black text-[10px] uppercase">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quotesLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-10"><Loader2 className="animate-spin mx-auto text-primary" /></TableCell></TableRow>
              ) : quotations?.map((q) => (
                <TableRow key={q.id}>
                  <TableCell className="font-black text-primary font-mono">{q.quotationNumber}</TableCell>
                  <TableCell className="font-bold">{q.customerName}</TableCell>
                  <TableCell className="text-xs">{q.productCode}</TableCell>
                  <TableCell className="font-black">₹{q.totalSellingPrice?.toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge className={cn(
                      q.status === 'Approved' ? 'bg-emerald-500' :
                      q.status === 'Sent' ? 'bg-blue-500' :
                      q.status === 'Rejected' ? 'bg-destructive' :
                      'bg-amber-500'
                    )}>
                      {q.status.toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right flex justify-end gap-2">
                    <Button variant="ghost" size="icon" onClick={() => { setSelectedQuote(q); setIsPreviewOpen(true); }}><Info className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => { setSelectedQuote(q); setIsPreviewOpen(true); }}><Download className="h-4 w-4" /></Button>
                    {q.status === 'Approved' && (
                      <Button variant="outline" size="sm" className="font-bold gap-1 text-emerald-600 border-emerald-200" onClick={() => handleConvertToSO(q)}>
                        <ShoppingCart className="h-3 w-3" /> Convert
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {quotations?.length === 0 && !quotesLoading && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-20 text-muted-foreground">
                    No quotations found. Generate one from the Estimate module.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Quotation Preview & PDF Modal */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
          <DialogHeader className="print:hidden">
            <DialogTitle className="flex items-center gap-2">
              <Printer className="h-5 w-5 text-primary" /> Official Quotation Document
            </DialogTitle>
            <DialogDescription>Review and download the final quotation for {selectedQuote?.customerName}.</DialogDescription>
          </DialogHeader>

          <div id="printable-quotation" className="p-8 bg-white text-black border rounded-lg space-y-8 font-sans">
            {/* Header */}
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <h1 className="text-2xl font-black text-primary uppercase">Shree Label Creation</h1>
                <p className="text-[10px] text-muted-foreground uppercase leading-tight">
                  Near XYZ Industrial Area, City, State, ZIP<br/>
                  GST: 12ABCDE3456F1Z1 | PH: +91 98765 43210
                </p>
              </div>
              <div className="text-right">
                <h2 className="text-xl font-bold uppercase tracking-widest text-muted-foreground">Quotation</h2>
                <p className="text-xs font-mono font-bold">{selectedQuote?.quotationNumber}</p>
                <p className="text-[10px] uppercase">Date: {selectedQuote ? new Date(selectedQuote.quoteDate).toLocaleDateString() : ''}</p>
              </div>
            </div>

            <Separator />

            {/* Bill To */}
            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-muted-foreground">Bill To:</Label>
                <div className="space-y-1">
                  <p className="text-sm font-black">{selectedQuote?.customerName}</p>
                  <p className="text-xs text-muted-foreground">{selectedQuote?.customerEmail}</p>
                </div>
              </div>
              <div className="space-y-2 text-right">
                <Label className="text-[10px] font-black uppercase text-muted-foreground">Product Reference:</Label>
                <p className="text-sm font-bold text-primary">{selectedQuote?.productCode}</p>
              </div>
            </div>

            {/* Technical Details */}
            <div className="bg-muted/30 p-4 rounded border border-border/50">
              <h3 className="text-[10px] font-black uppercase mb-3 text-primary">Technical Specification</h3>
              <div className="grid grid-cols-4 gap-4 text-[10px]">
                <div><span className="text-muted-foreground font-bold">Size:</span> {selectedQuote?.labelWidth} x {selectedQuote?.labelLength} mm</div>
                <div><span className="text-muted-foreground font-bold">Repeat:</span> {selectedQuote?.repeatLength} mm</div>
                <div><span className="text-muted-foreground font-bold">Labels/Repeat:</span> {selectedQuote?.labelsPerRepeat}</div>
                <div><span className="text-muted-foreground font-bold">Quantity:</span> {selectedQuote?.orderQuantity?.toLocaleString()}</div>
              </div>
            </div>

            {/* Financials Table */}
            <Table>
              <TableHeader className="bg-primary/5">
                <TableRow>
                  <TableHead className="text-black font-black text-[10px] uppercase">Description</TableHead>
                  <TableHead className="text-black font-black text-[10px] uppercase text-right">Unit Price</TableHead>
                  <TableHead className="text-black font-black text-[10px] uppercase text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="text-xs py-4">
                    <p className="font-bold">Pressure Sensitive Labels</p>
                    <p className="text-[9px] text-muted-foreground italic">Narrow Web Flexo Printed • {selectedQuote?.productCode}</p>
                  </TableCell>
                  <TableCell className="text-right text-xs font-bold">₹{selectedQuote?.sellingPricePerLabel?.toFixed(3)}</TableCell>
                  <TableCell className="text-right text-xs font-bold">₹{selectedQuote?.totalSellingPrice?.toLocaleString()}</TableCell>
                </TableRow>
              </TableBody>
            </Table>

            {/* Totals */}
            <div className="flex justify-end">
              <div className="w-64 space-y-2">
                <div className="flex justify-between text-xs font-medium">
                  <span>Subtotal</span>
                  <span>₹{selectedQuote?.totalSellingPrice?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs font-medium">
                  <span>GST (18%)</span>
                  <span>₹{(selectedQuote?.totalSellingPrice * 0.18)?.toLocaleString()}</span>
                </div>
                <Separator className="bg-black h-[2px]" />
                <div className="flex justify-between text-base font-black text-primary">
                  <span>Total Due</span>
                  <span>₹{(selectedQuote?.totalSellingPrice * 1.18)?.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Terms */}
            <div className="space-y-2 border-t pt-6">
              <h4 className="text-[10px] font-black uppercase text-muted-foreground">Terms & Conditions</h4>
              <ul className="text-[9px] text-muted-foreground list-disc pl-4 space-y-1">
                <li>Price validity: 30 days from the date of quotation.</li>
                <li>Delivery: Within 10-14 working days post artwork approval.</li>
                <li>Payment: 50% advance, balance against delivery.</li>
                <li>Standard 5% quantity variation is applicable.</li>
              </ul>
            </div>
          </div>

          <DialogFooter className="print:hidden border-t pt-4">
            <div className="flex justify-between w-full">
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => handleStatusUpdate(selectedQuote.id, 'Sent')} className="gap-1">
                  <Send className="h-3 w-3" /> Mark as Sent
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleStatusUpdate(selectedQuote.id, 'Approved')} className="gap-1 text-emerald-600">
                  <CheckCircle2 className="h-3 w-3" /> Customer Approve
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleStatusUpdate(selectedQuote.id, 'Rejected')} className="gap-1 text-destructive">
                  <XCircle className="h-3 w-3" /> Reject
                </Button>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setIsPreviewOpen(false)}>Close</Button>
                <Button size="sm" className="gap-2" onClick={handlePrint}><Printer className="h-4 w-4" /> Print Document</Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
