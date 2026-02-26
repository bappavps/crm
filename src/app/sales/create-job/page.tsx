
"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Trash2, FilePlus, Loader2, Image as ImageIcon } from "lucide-react"
import { useFirestore, useUser, useDoc, useMemoFirebase } from "@/firebase"
import { collection, doc, runTransaction } from "firebase/firestore"
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
        const jobId = jobRef.id;

        // 1. Master Document (Lightweight)
        const masterData = {
          id: jobId,
          jobNumber,
          jobType,
          clientName,
          salesUserId: user.uid,
          salesUserName: user.displayName || user.email?.split('@')[0] || "Sales",
          status: "Pending Approval",
          adminApproved: false,
          currentStage: "Sales",
          itemNameSummary: items[0].itemName, // For quick listing
          createdAt: now.toISOString(),
          updatedAt: now.toISOString()
        };

        // 2. Technical Sub-doc
        const techRef = doc(firestore, `jobs/${jobId}/technical/details`);
        const techData = {
          items: items.map(i => ({
            itemName: i.itemName,
            material: i.material,
            widthMM: i.widthMM,
            heightMM: i.heightMM,
            quantity: i.quantity,
            core: i.core,
            rollDirection: i.rollDirection
          })),
          edit_lock_time: new Date(now.getTime() + 1000 * 60 * 60 * 24 * 365).toISOString() // Placeholder until approved
        };

        // 3. Financial Sub-doc
        const finRef = doc(firestore, `jobs/${jobId}/financial/summary`);
        const finData = {
          sqInchDivider: divider,
          totalJobValue: items.reduce((acc, i) => acc + i.totalJobValue, 0),
          itemPricing: items.map(i => ({
            itemName: i.itemName,
            pricePerSqInch: i.pricePerSqInch,
            totalJobValue: i.totalJobValue
          }))
        };

        // 4. File Sub-docs (for Artworks)
        items.forEach((item, idx) => {
          if (item.artworkUrl) {
            const fileRef = doc(collection(firestore, `jobs/${jobId}/files`));
            transaction.set(fileRef, {
              fileType: 'artwork',
              fileName: `Artwork - ${item.itemName}`,
              fileUrl: item.artworkUrl,
              uploadedBy: user.uid,
              uploadedAt: now.toISOString()
            });
          }
        });

        transaction.set(counterRef, { year, current_number: currentNumber }, { merge: true });
        transaction.set(jobRef, masterData);
        transaction.set(techRef, techData);
        transaction.set(finRef, finData);
      });

      toast({ title: "Job Posted", description: "Modular job structure initialized." })
      setItems([{ id: crypto.randomUUID(), material: "", brand: "", itemName: "", widthMM: 0, heightMM: 0, core: "3 Inch", od: "", rollDirection: "Head Out", quantity: 0, pricePerSqInch: 0, totalSqInch: 0, costPerLabel: 0, totalJobValue: 0, artworkUrl: "", remarks: "" }])
      setClientName("")
    } catch (error: any) {
      toast({ variant: "destructive", title: "Failed", description: error.message })
    } finally {
      setIsSubmitting(false)
    }
  }

  const simulateUpload = (id: string) => {
    const url = `https://picsum.photos/seed/${id}/400/400`
    updateItem(id, 'artworkUrl', url)
    toast({ title: "Artwork Linked", description: "File reference stored." })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">Post Sales Job (V2)</h2>
          <p className="text-muted-foreground">Modular document refactoring enabled.</p>
        </div>
        <Button onClick={handleCreateJob} disabled={isSubmitting} className="h-12 px-8 text-lg font-bold">
          {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <FilePlus className="mr-2 h-5 w-5" />}
          Initialize Modular Job
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm font-bold uppercase text-primary">Master Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Client Name</Label>
              <Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="e.g. Pharma Co" />
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
          </CardContent>
        </Card>

        <div className="lg:col-span-3 space-y-4">
          {items.map((item, index) => (
            <Card key={item.id} className="border-l-4 border-l-primary">
              <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-4">
                  <Label className="font-bold">Technical Specs</Label>
                  <Input placeholder="Item Name" value={item.itemName} onChange={(e) => updateItem(item.id, 'itemName', e.target.value)} />
                  <div className="grid grid-cols-2 gap-2">
                    <Input type="number" placeholder="Width" onChange={(e) => updateItem(item.id, 'widthMM', Number(e.target.value))} />
                    <Input type="number" placeholder="Height" onChange={(e) => updateItem(item.id, 'heightMM', Number(e.target.value))} />
                  </div>
                </div>
                <div className="space-y-4">
                  <Label className="font-bold">Costing</Label>
                  <Input type="number" step="0.001" placeholder="Rate/SqInch" onChange={(e) => updateItem(item.id, 'pricePerSqInch', Number(e.target.value))} />
                  <Input type="number" placeholder="Quantity" onChange={(e) => updateItem(item.id, 'quantity', Number(e.target.value))} />
                  <p className="text-xl font-black text-primary">₹{item.totalJobValue.toLocaleString()}</p>
                </div>
                <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-4">
                  {item.artworkUrl ? (
                    <Image src={item.artworkUrl} alt="Art" width={80} height={80} className="rounded mb-2" />
                  ) : (
                    <Button variant="ghost" onClick={() => simulateUpload(item.id)}><ImageIcon className="mr-2" /> Attach Artwork</Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          <Button variant="outline" className="w-full" onClick={addItem}><Plus className="mr-2" /> Add Item</Button>
        </div>
      </div>
    </div>
  )
}
