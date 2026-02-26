
"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Trash2, FilePlus, Loader2, Image as ImageIcon, Calculator, Briefcase } from "lucide-react"
import { useFirestore, useUser, useDoc, useCollection, useMemoFirebase } from "@/firebase"
import { collection, doc, runTransaction, query, where, getDocs } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import Image from "next/image"

interface JobItem {
  id: string;
  material: string;
  brand: string;
  itemName: string;
  widthMM: number;
  heightMM: number;
  core: string;
  od: string;
  rollDirection: string;
  quantity: number;
  pricePerSqInch: number;
  totalSqInch: number;
  costPerLabel: number;
  totalJobValue: number;
  artworkUrl: string;
  remarks: string;
}

export default function CreateJobPage() {
  const { toast } = useToast()
  const { user } = useUser()
  const firestore = useFirestore()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [jobType, setJobType] = useState<"New" | "Repeat">("New")
  const [clientName, setClientName] = useState("")
  
  // Pricing Config
  const pricingRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'system_settings', 'pricing_config');
  }, [firestore])
  const { data: pricingConfig } = useDoc(pricingRef)
  const divider = pricingConfig?.sqInchDivider || 625

  const [items, setItems] = useState<JobItem[]>([{
    id: crypto.randomUUID(),
    material: "",
    brand: "",
    itemName: "",
    widthMM: 0,
    heightMM: 0,
    core: "3 Inch",
    od: "",
    rollDirection: "Head Out",
    quantity: 0,
    pricePerSqInch: 0,
    totalSqInch: 0,
    costPerLabel: 0,
    totalJobValue: 0,
    artworkUrl: "",
    remarks: ""
  }])

  const calculateItem = (item: JobItem) => {
    const totalSqInch = (item.widthMM * item.heightMM) / divider
    const costPerLabel = totalSqInch * item.pricePerSqInch
    const totalJobValue = costPerLabel * item.quantity
    return {
      ...item,
      totalSqInch: Number(totalSqInch.toFixed(4)),
      costPerLabel: Number(costPerLabel.toFixed(4)),
      totalJobValue: Number(totalJobValue.toFixed(2))
    }
  }

  const updateItem = (id: string, field: keyof JobItem, value: any) => {
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value }
        return calculateItem(updated)
      }
      return item
    }))
  }

  const addItem = () => {
    setItems(prev => [...prev, {
      id: crypto.randomUUID(),
      material: "",
      brand: "",
      itemName: "",
      widthMM: 0,
      heightMM: 0,
      core: "3 Inch",
      od: "",
      rollDirection: "Head Out",
      quantity: 0,
      pricePerSqInch: 0,
      totalSqInch: 0,
      costPerLabel: 0,
      totalJobValue: 0,
      artworkUrl: "",
      remarks: ""
    }])
  }

  const removeItem = (id: string) => {
    if (items.length === 1) return
    setItems(prev => prev.filter(i => i.id !== id))
  }

  const handleCreateJob = async () => {
    if (!firestore || !user) return
    if (!clientName) {
      toast({ variant: "destructive", title: "Error", description: "Client Name is required." })
      return
    }

    const missingArtwork = items.find(i => !i.artworkUrl)
    if (missingArtwork) {
      toast({ variant: "destructive", title: "Error", description: "Artwork is mandatory for all items." })
      return
    }

    setIsSubmitting(true)

    try {
      await runTransaction(firestore, async (transaction) => {
        const counterRef = doc(firestore, 'counters', 'job_counter');
        const counterSnap = await transaction.get(counterRef);

        const now = new Date();
        const year = now.getFullYear().toString();
        
        let currentNumber = 1;
        if (counterSnap.exists()) {
          const data = counterSnap.data();
          if (data.year === year) {
            currentNumber = data.current_number + 1;
          }
        }

        const paddedNum = currentNumber.toString().padStart(4, "0");
        const jobNumber = `JOB-${year}-${paddedNum}`;

        const jobRef = doc(collection(firestore, 'jobs'));
        const jobData = {
          jobNumber,
          jobType,
          clientName,
          salesUserId: user.uid,
          salesUserName: user.displayName || user.email?.split('@')[0] || "Sales",
          jobDate: now.toISOString(),
          status: "Pending Approval",
          adminApproved: false,
          items: items.map(i => ({ ...i })),
          createdAt: now.toISOString(),
          updatedAt: now.toISOString()
        };

        transaction.set(counterRef, {
          prefix: "JOB-",
          year: year,
          current_number: currentNumber
        }, { merge: true });

        transaction.set(jobRef, jobData);
      });

      toast({ title: "Job Posted", description: "Job submitted for Admin Approval." })
      // Reset form
      setItems([{ id: crypto.randomUUID(), material: "", brand: "", itemName: "", widthMM: 0, heightMM: 0, core: "3 Inch", od: "", rollDirection: "Head Out", quantity: 0, pricePerSqInch: 0, totalSqInch: 0, costPerLabel: 0, totalJobValue: 0, artworkUrl: "", remarks: "" }])
      setClientName("")
    } catch (error: any) {
      toast({ variant: "destructive", title: "Failed", description: error.message })
    } finally {
      setIsSubmitting(false)
    }
  }

  const simulateUpload = (id: string) => {
    // In a real app, this would be a file upload to Storage. 
    // Here we simulate it by setting a unique picsum URL.
    const url = `https://picsum.photos/seed/${id}/400/400`
    updateItem(id, 'artworkUrl', url)
    toast({ title: "Artwork Attached", description: "Technical file verified." })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">Post Sales Job</h2>
          <p className="text-muted-foreground">Initialize new production orders with integrated pricing logic.</p>
        </div>
        <Button onClick={handleCreateJob} disabled={isSubmitting} className="h-12 px-8 text-lg font-bold">
          {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <FilePlus className="mr-2 h-5 w-5" />}
          Submit Job for Approval
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-primary">Master Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Client / Company Name</Label>
              <Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="e.g. Pharma Co Ltd" />
            </div>
            <div className="space-y-2">
              <Label>Job Type</Label>
              <Select value={jobType} onValueChange={(v: any) => setJobType(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="New">New Design</SelectItem>
                  <SelectItem value="Repeat">Repeat Order</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="p-4 bg-muted/30 rounded-lg border border-dashed">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                <span>Pricing Divider:</span>
                <span className="font-bold text-primary">{divider}</span>
              </div>
              <p className="text-[10px] text-muted-foreground italic">Cost logic is based on global system settings.</p>
            </div>
          </CardContent>
        </Card>

        <div className="lg:col-span-3 space-y-4">
          {items.map((item, index) => (
            <Card key={item.id} className="relative overflow-hidden border-l-4 border-l-primary">
              <CardHeader className="bg-muted/20 py-3 flex flex-row items-center justify-between">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="font-black">Item #{index + 1}</Badge>
                  <Input 
                    className="h-8 w-64 bg-transparent border-none font-bold" 
                    placeholder="Enter Item Description..." 
                    value={item.itemName}
                    onChange={(e) => updateItem(item.id, 'itemName', e.target.value)}
                  />
                </div>
                <Button variant="ghost" size="icon" className="text-destructive h-8 w-8" onClick={() => removeItem(item.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Material</Label>
                    <Input value={item.material} onChange={(e) => updateItem(item.id, 'material', e.target.value)} placeholder="Semi Gloss / PP" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Brand</Label>
                    <Input value={item.brand} onChange={(e) => updateItem(item.id, 'brand', e.target.value)} placeholder="Avery / UPM" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Width (MM)</Label>
                    <Input type="number" value={item.widthMM} onChange={(e) => updateItem(item.id, 'widthMM', Number(e.target.value))} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Height (MM)</Label>
                    <Input type="number" value={item.heightMM} onChange={(e) => updateItem(item.id, 'heightMM', Number(e.target.value))} />
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Core</Label>
                    <Select value={item.core} onValueChange={(v) => updateItem(item.id, 'core', v)}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1 Inch">1 Inch</SelectItem>
                        <SelectItem value="1.5 Inch">1.5 Inch</SelectItem>
                        <SelectItem value="3 Inch">3 Inch</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">OD (Max)</Label>
                    <Input value={item.od} onChange={(e) => updateItem(item.id, 'od', e.target.value)} placeholder="e.g. 200mm" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Roll Direction</Label>
                    <Select value={item.rollDirection} onValueChange={(v) => updateItem(item.id, 'rollDirection', v)}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Head Out">Head Out</SelectItem>
                        <SelectItem value="Foot Out">Foot Out</SelectItem>
                        <SelectItem value="Left Out">Left Out</SelectItem>
                        <SelectItem value="Right Out">Right Out</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Quantity</Label>
                    <Input type="number" value={item.quantity} onChange={(e) => updateItem(item.id, 'quantity', Number(e.target.value))} />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-primary/5 p-4 rounded-lg border border-primary/10">
                  <div className="space-y-2">
                    <Label className="text-primary font-bold">Rate (Per Sq Inch)</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-xs font-bold text-muted-foreground">₹</span>
                      <Input 
                        type="number" 
                        step="0.0001" 
                        className="pl-7 h-10 border-primary/30 font-black text-lg" 
                        value={item.pricePerSqInch} 
                        onChange={(e) => updateItem(item.id, 'pricePerSqInch', Number(e.target.value))} 
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Cost Per Label</Label>
                    <p className="text-2xl font-black text-accent">₹{item.costPerLabel}</p>
                    <p className="text-[10px] text-muted-foreground italic">Total SqInch: {item.totalSqInch}</p>
                  </div>
                  <div className="space-y-1 text-right">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Total Item Value</Label>
                    <p className="text-3xl font-black text-primary">₹{item.totalJobValue.toLocaleString()}</p>
                  </div>
                </div>

                <div className="flex gap-6 items-start">
                  <div className="flex-1 space-y-2">
                    <Label className="text-xs">Remarks / Special Instructions</Label>
                    <Input value={item.remarks} onChange={(e) => updateItem(item.id, 'remarks', e.target.value)} placeholder="Packing details, label finish, etc." />
                  </div>
                  <div className="shrink-0 space-y-2">
                    <Label className="text-xs">Artwork</Label>
                    {item.artworkUrl ? (
                      <div className="relative w-24 h-24 rounded-md overflow-hidden border group">
                        <Image src={item.artworkUrl} alt="artwork" fill className="object-cover" data-ai-hint="label artwork" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <Button variant="ghost" size="icon" className="text-white" onClick={() => updateItem(item.id, 'artworkUrl', '')}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button variant="outline" className="w-24 h-24 border-dashed flex flex-col gap-1" onClick={() => simulateUpload(item.id)}>
                        <ImageIcon className="h-6 w-6 opacity-40" />
                        <span className="text-[10px]">Attach File</span>
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          <Button variant="outline" className="w-full border-dashed h-12" onClick={addItem}>
            <Plus className="mr-2 h-4 w-4" /> Add Another Item Row
          </Button>
        </div>
      </div>
    </div>
  )
}
