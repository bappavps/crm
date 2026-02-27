
"use client"

import { useState, useRef, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { FileText, Printer, Download, Plus, Loader2, CheckCircle2, XCircle, Send, ShoppingCart, Info, Lock, FileJson } from "lucide-react"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { useFirestore, useUser, useCollection, useMemoFirebase, useDoc } from "@/firebase"
import { collection, doc, updateDoc, query, where } from "firebase/firestore"
import { addDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase/non-blocking-updates"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

export default function QuotationRegistryPage() {
  const { toast } = useToast()
  const { user } = useUser()
  const firestore = useFirestore()
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [selectedQuote, setSelectedQuote] = useState<any>(null)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("")

  // Authorization check - wait for resolved state
  const adminDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'adminUsers', user.uid);
  }, [firestore, user]);
  const { data: adminData, isLoading: authLoading } = useDoc(adminDocRef);
  const isAdmin = !!adminData;

  const quotationsQuery = useMemoFirebase(() => {
    if (!firestore || !user || authLoading) return null;
    const base = collection(firestore, 'quotations');
    if (!isAdmin) {
      return query(base, where("sales_owner_id", "==", user.uid));
    }
    return base;
  }, [firestore, user, isAdmin, authLoading])

  const templatesQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, 'quotation_templates');
  }, [firestore, user])

  const { data: quotations, isLoading: quotesLoading } = useCollection(quotationsQuery)
  const { data: templates } = useCollection(templatesQuery)

  const activeTemplate = useMemo(() => {
    if (!selectedTemplateId) return templates?.find(t => t.is_default) || templates?.[0]
    return templates?.find(t => t.id === selectedTemplateId)
  }, [templates, selectedTemplateId])

  const renderTemplateContent = (html: string) => {
    if (!selectedQuote || !html) return ""
    let output = html;
    output = output.replace(/{{client_name}}/g, selectedQuote.customerName || "N/A");
    output = output.replace(/{{product_name}}/g, selectedQuote.productCode || "N/A");
    output = output.replace(/{{size}}/g, `${selectedQuote.labelWidth}x${selectedQuote.labelLength} mm` || "N/A");
    output = output.replace(/{{material}}/g, selectedQuote.material || "Standard");
    output = output.replace(/{{qty}}/g, selectedQuote.orderQuantity?.toLocaleString() || "0");
    output = output.replace(/{{rate}}/g, selectedQuote.sellingPricePerLabel?.toFixed(3) || "0");
    output = output.replace(/{{total}}/g, selectedQuote.totalSellingPrice?.toLocaleString() || "0");
    output = output.replace(/{{delivery_date}}/g, selectedQuote.quoteDate ? new Date(selectedQuote.quoteDate).toLocaleDateString() : "N/A");
    return output;
  }

  const handleStatusUpdate = (quoteId: string, newStatus: string) => {
    if (!firestore) return
    updateDocumentNonBlocking(doc(firestore, 'quotations', quoteId), {
      status: newStatus,
      updatedAt: new Date().toISOString()
    })
    toast({ title: "Status Updated", description: `Quotation is now ${newStatus}.` })
  }

  const isLoading = authLoading || quotesLoading;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black tracking-tight text-primary">Quotation Registry</h2>
          <p className="text-muted-foreground font-medium">Enterprise Template & Proposal Management.</p>
        </div>
      </div>

      <Card className="border-none shadow-xl">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" /> Proposal Pipeline
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="font-black text-[10px] uppercase">Quote #</TableHead>
                <TableHead className="font-black text-[10px] uppercase">Customer</TableHead>
                <TableHead className="font-black text-[10px] uppercase">Product</TableHead>
                <TableHead className="font-black text-[10px] uppercase">Total Value</TableHead>
                <TableHead className="font-black text-[10px] uppercase">Status</TableHead>
                <TableHead className="text-right font-black text-[10px] uppercase">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
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
                    <Button variant="ghost" size="icon" onClick={() => { setSelectedQuote(q); setIsPreviewOpen(true); }}><FileJson className="h-4 w-4" /></Button>
                    <Button variant="outline" size="sm" className="font-bold" onClick={() => { setSelectedQuote(q); setIsPreviewOpen(true); }}>Preview</Button>
                  </TableCell>
                </TableRow>
              ))}
              {(!quotations || quotations.length === 0) && !isLoading && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-20 text-muted-foreground italic">
                    No quotations found in your registry.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="sm:max-w-[850px] max-h-[90vh] overflow-y-auto">
          <DialogHeader className="print:hidden">
            <div className="flex justify-between items-center pr-10">
              <DialogTitle className="flex items-center gap-2">Official Document Preview</DialogTitle>
              <div className="flex items-center gap-2">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Switch Template:</Label>
                <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                  <SelectTrigger className="w-[200px] h-8 text-xs">
                    <SelectValue placeholder="Select Layout" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates?.map(t => <SelectItem key={t.id} value={t.id}>{t.template_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </DialogHeader>

          <div className="bg-white text-black p-10 border rounded shadow-inner min-h-[600px] font-sans">
            <div dangerouslySetInnerHTML={{ __html: renderTemplateContent(activeTemplate?.header_html) }} />
            <Separator className="my-6" />
            <div dangerouslySetInnerHTML={{ __html: renderTemplateContent(activeTemplate?.body_html) }} />
            <div className="mt-10 p-4 bg-muted/10 rounded border border-dashed">
              <h4 className="text-[10px] font-black uppercase mb-2">Terms & Conditions</h4>
              <p className="text-[10px] whitespace-pre-wrap">{activeTemplate?.terms_conditions}</p>
            </div>
            <Separator className="my-6" />
            <div dangerouslySetInnerHTML={{ __html: renderTemplateContent(activeTemplate?.footer_html) }} />
          </div>

          <DialogFooter className="print:hidden">
            <div className="flex justify-between w-full">
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => handleStatusUpdate(selectedQuote.id, 'Sent')} className="text-blue-600">Send to Client</Button>
                <Button variant="outline" size="sm" onClick={() => handleStatusUpdate(selectedQuote.id, 'Approved')} className="text-emerald-600">Mark Approved</Button>
              </div>
              <Button onClick={() => window.print()} className="gap-2"><Printer className="h-4 w-4" /> Print PDF</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
