
"use client"

import { use, useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { 
  Loader2, 
  ArrowLeft, 
  Printer, 
  Send, 
  CheckCircle2, 
  ShoppingCart, 
  FileText, 
  Calculator, 
  Info,
  DollarSign,
  TrendingUp,
  Box,
  Layers,
  Palette
} from "lucide-react"
import { useFirestore, useUser, useDoc, useMemoFirebase } from "@/firebase"
import { doc, updateDoc, collection, addDoc, serverTimestamp } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { format } from "date-fns"

export default function EstimateDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { toast } = useToast()
  const router = useRouter()
  const { user } = useUser()
  const firestore = useFirestore()
  const [isProcessing, setIsProcessing] = useState(false)

  const estimateRef = useMemoFirebase(() => id ? doc(firestore!, 'estimates', id) : null, [firestore, id])
  const { data: estimate, isLoading } = useDoc(estimateRef)

  const handleUpdateStatus = async (newStatus: string) => {
    if (!firestore || !id) return
    setIsProcessing(true)
    try {
      await updateDoc(doc(firestore, 'estimates', id), {
        status: newStatus,
        updatedAt: serverTimestamp()
      })
      toast({ title: `Status: ${newStatus}`, description: "Estimate record updated." })
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "Failed to update record." })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleConvertToQuotation = async () => {
    if (!firestore || !estimate) return
    setIsProcessing(true)
    try {
      const quoteData = {
        quotationNumber: `QUO-${format(new Date(), 'yyyy')}-${Math.floor(1000 + Math.random() * 9000)}`,
        estimateId: estimate.id,
        customerId: estimate.customerId,
        customerName: estimate.customerName,
        productCode: estimate.productCode,
        totalSellingPrice: estimate.totalSellingPrice,
        sellingPricePerLabel: estimate.sellingPricePerLabel,
        orderQuantity: estimate.orderQuantity,
        material: estimate.material || "Standard",
        labelWidth: estimate.labelWidth,
        labelLength: estimate.labelLength,
        quoteDate: new Date().toISOString(),
        status: "Draft",
        createdAt: serverTimestamp(),
        createdById: user?.uid
      }
      
      await addDoc(collection(firestore, 'quotations'), quoteData)
      await updateDoc(doc(firestore, 'estimates', estimate.id), { status: 'Converted' })
      
      toast({ title: "Converted to Quotation", description: "Navigating to registry..." })
      router.push('/sales/quotations')
    } catch (e) {
      toast({ variant: "destructive", title: "Conversion Failed", description: "Error during document creation." })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleConvertToOrder = async () => {
    if (!firestore || !estimate) return
    setIsProcessing(true)
    try {
      const orderData = {
        orderNumber: `SO-${format(new Date(), 'yyyy')}-${Math.floor(1000 + Math.random() * 9000)}`,
        estimateId: estimate.id,
        customerId: estimate.customerId,
        customerName: estimate.customerName,
        productCode: estimate.productCode,
        totalAmount: estimate.totalSellingPrice,
        qty: estimate.orderQuantity,
        orderDate: new Date().toISOString(),
        deliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        status: "Confirmed",
        createdAt: serverTimestamp(),
        createdById: user?.uid
      }
      
      await addDoc(collection(firestore, 'salesOrders'), orderData)
      await updateDoc(doc(firestore, 'estimates', estimate.id), { status: 'Converted' })
      
      toast({ title: "Converted to Sales Order", description: "Order is now in pipeline." })
      router.push('/sales-order')
    } catch (e) {
      toast({ variant: "destructive", title: "Order Creation Failed", description: "Check permissions or network." })
    } finally {
      setIsProcessing(false)
    }
  }

  if (isLoading) return <div className="flex h-[70vh] items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>
  if (!estimate) return <div className="p-20 text-center text-muted-foreground">Estimate record not found.</div>

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-40">
      <div className="flex items-center justify-between">
        <Button variant="ghost" asChild className="-ml-4 font-bold uppercase tracking-tighter">
          <Link href="/estimates"><ArrowLeft className="mr-2 h-4 w-4" /> Registry</Link>
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" /> Print PDF</Button>
          {estimate.status === 'Draft' && (
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => handleUpdateStatus('Sent')} disabled={isProcessing}>
              <Send className="mr-2 h-4 w-4" /> Send to Client
            </Button>
          )}
          {(estimate.status === 'Draft' || estimate.status === 'Sent') && (
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => handleUpdateStatus('Approved')} disabled={isProcessing}>
              <CheckCircle2 className="mr-2 h-4 w-4" /> Approve Estimate
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Header Card */}
          <Card className="border-none shadow-xl overflow-hidden">
            <div className="bg-primary p-6 text-white flex justify-between items-start">
              <div>
                <span className="text-[10px] font-black uppercase opacity-70 tracking-widest">Master ID</span>
                <h1 className="text-3xl font-black tracking-tighter">{estimate.estimateNumber}</h1>
                <p className="text-xs font-bold opacity-90 mt-1 uppercase">Generated on {estimate.createdAt?.toDate ? format(estimate.createdAt.toDate(), 'PPP p') : '-'}</p>
              </div>
              <Badge className="bg-white text-primary text-xs font-black px-4 py-1 uppercase">{estimate.status}</Badge>
            </div>
            <CardContent className="p-8 grid grid-cols-2 gap-8 bg-card">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg text-primary"><Box className="h-5 w-5" /></div>
                  <div>
                    <p className="text-[10px] font-black text-muted-foreground uppercase">Client Entity</p>
                    <p className="font-bold text-lg">{estimate.customerName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg text-primary"><Layers className="h-5 w-5" /></div>
                  <div>
                    <p className="text-[10px] font-black text-muted-foreground uppercase">Product Code</p>
                    <p className="font-mono font-bold">{estimate.productCode}</p>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg text-primary"><Palette className="h-5 w-5" /></div>
                  <div>
                    <p className="text-[10px] font-black text-muted-foreground uppercase">Material Spec</p>
                    <p className="font-bold text-sm">{estimate.material || 'Standard Substrate'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg text-primary"><Calculator className="h-5 w-5" /></div>
                  <div>
                    <p className="text-[10px] font-black text-muted-foreground uppercase">Target Quantity</p>
                    <p className="font-black text-lg">{estimate.orderQuantity?.toLocaleString()} <span className="text-xs font-normal text-muted-foreground italic">Labels</span></p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Technical Analysis */}
          <Card>
            <CardHeader className="bg-muted/30"><CardTitle className="text-sm font-black uppercase flex items-center gap-2"><Info className="h-4 w-4" /> Technical Execution Plan</CardTitle></CardHeader>
            <CardContent className="p-8 grid grid-cols-2 md:grid-cols-4 gap-6 text-sm">
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Label Size</p>
                <p className="font-mono font-bold">{estimate.labelWidth}x{estimate.labelLength} mm</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Layout (Across/Around)</p>
                <p className="font-mono font-bold">{estimate.labelAcross} / {estimate.labelAround}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Running Meter</p>
                <p className="font-mono font-bold text-primary">{estimate.runningMeter?.toFixed(2)} m</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Total SQM Required</p>
                <p className="font-mono font-bold">{estimate.totalMaterialRequiredSqM?.toFixed(2)}</p>
              </div>
            </CardContent>
          </Card>

          {/* Cost Breakdown Code View */}
          <Card className="border-none shadow-md overflow-hidden bg-zinc-900">
            <CardHeader className="bg-zinc-800 py-3">
              <CardTitle className="text-[10px] font-black uppercase text-zinc-400 flex items-center gap-2">
                <DollarSign className="h-3 w-3" /> Financial Schema / JSON Costing
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <pre className="text-[11px] font-mono text-emerald-400 overflow-x-auto">
                {JSON.stringify({
                  unit_economics: {
                    price_per_label: `₹${estimate.sellingPricePerLabel?.toFixed(3)}`,
                    cost_per_label: `₹${estimate.costPerLabel?.toFixed(3)}`,
                    margin_per_label: `₹${(estimate.sellingPricePerLabel - estimate.costPerLabel)?.toFixed(3)}`
                  },
                  total_projections: {
                    revenue: estimate.totalSellingPrice,
                    net_profit: estimate.profit,
                    profit_margin: `${estimate.profitPercent?.toFixed(1)}%`
                  },
                  resource_costs: {
                    material: estimate.materialCost,
                    printing: estimate.printingCost,
                    uv_varnish: estimate.uvCost,
                    machine_time: estimate.machineCostTotal,
                    labor: estimate.laborCostTotal
                  }
                }, null, 2)}
              </pre>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-8">
          {/* Conversion Actions */}
          <Card className="border-primary/20 shadow-lg">
            <CardHeader className="bg-primary/5"><CardTitle className="text-sm font-black uppercase">Document Conversion</CardTitle></CardHeader>
            <CardContent className="pt-6 space-y-4">
              <Button 
                variant="outline" 
                className="w-full h-12 font-black uppercase text-[11px] tracking-widest border-2 hover:bg-primary hover:text-white"
                onClick={handleConvertToQuotation}
                disabled={isProcessing || estimate.status === 'Converted'}
              >
                <FileText className="mr-2 h-4 w-4" /> Convert to Quotation
              </Button>
              <Button 
                className="w-full h-12 font-black uppercase text-[11px] tracking-widest shadow-lg"
                onClick={handleConvertToOrder}
                disabled={isProcessing || estimate.status === 'Converted'}
              >
                <ShoppingCart className="mr-2 h-4 w-4" /> Create Sales Order
              </Button>
              {estimate.status === 'Converted' && (
                <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg text-blue-800 text-[10px] font-bold text-center uppercase animate-in fade-in">
                  This estimate is already linked to a live workflow.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Margin Summary */}
          <Card className="bg-accent text-white border-none shadow-xl">
            <CardHeader><CardTitle className="text-sm font-black uppercase opacity-80 flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Profit Analysis</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <div>
                <p className="text-[10px] font-black uppercase opacity-70">Total Contract Value</p>
                <p className="text-4xl font-black tracking-tighter">₹{estimate.totalSellingPrice?.toLocaleString()}</p>
              </div>
              <Separator className="bg-white/20" />
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-[10px] font-black uppercase opacity-70">Projected Margin</p>
                  <p className="text-2xl font-black">₹{estimate.profit?.toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <Badge className="bg-white text-accent font-black text-lg">{estimate.profitPercent?.toFixed(1)}%</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
