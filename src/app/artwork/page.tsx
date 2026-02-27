
"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Palette, Upload, CheckCircle2, Clock, AlertCircle, Loader2, Download, ExternalLink, ZoomIn, Maximize2, X, Plus, Minus } from "lucide-react"
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
import { collection, doc, updateDoc, serverTimestamp } from "firebase/firestore"
import { addDocumentNonBlocking } from "@/firebase/non-blocking-updates"
import { useToast } from "@/hooks/use-toast"
import Image from "next/image"

export default function ArtworkPage() {
  const { toast } = useToast()
  const { user } = useUser()
  const firestore = useFirestore()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [selectedPreview, setSelectedPreview] = useState<any>(null)
  const [zoomLevel, setZoomLevel] = useState(1)
  const [isProcessing, setIsProcessing] = useState(false)

  // Authorization check
  const adminDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'adminUsers', user.uid);
  }, [firestore, user]);
  const { data: adminData } = useDoc(adminDocRef);

  // Firestore Queries
  const artworksQuery = useMemoFirebase(() => {
    if (!firestore || !user || !adminData) return null;
    return collection(firestore, 'artworks');
  }, [firestore, user, adminData])

  const customersQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, 'customers');
  }, [firestore, user])

  const { data: artworks, isLoading: artworksLoading } = useCollection(artworksQuery)
  const { data: customers } = useCollection(customersQuery)

  const handleUploadArtwork = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!firestore || !user) return

    const formData = new FormData(e.currentTarget)
    const customerId = formData.get("customerId") as string
    const name = formData.get("name") as string
    
    const selectedCustomer = customers?.find(c => c.id === customerId)

    const artworkData = {
      id: crypto.randomUUID(),
      name,
      estimateId: customerId, // Using client reference for initial design phase
      clientName: selectedCustomer?.companyName || "Unknown Client",
      version: formData.get("version") || "1.0",
      filePath: `https://picsum.photos/seed/${Math.floor(Math.random() * 1000)}/1200/1200`,
      thumbnailUrl: `https://picsum.photos/seed/${Math.floor(Math.random() * 1000)}/300/300`,
      status: "In Review",
      uploadDate: new Date().toISOString(),
      uploadedById: user.uid,
      width: formData.get("width") || "50",
      height: formData.get("height") || "100",
      unit: "mm",
      description: formData.get("description") as string || ""
    }

    addDocumentNonBlocking(collection(firestore, 'artworks'), artworkData)
    setIsDialogOpen(false)
    toast({ title: "Artwork Submitted", description: `Design for ${name} uploaded for approval.` })
  }

  const handleApprove = async (art: any) => {
    if (!firestore) return
    setIsProcessing(true)
    try {
      await updateDoc(doc(firestore, 'artworks', art.id), { 
        status: "Approved",
        approvedAt: serverTimestamp(),
        approvedBy: user?.uid
      })
      toast({ title: "Design Released", description: "This artwork can now be used for estimation and production." })
      setIsPreviewOpen(false)
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "Approval failed." })
    } finally {
      setIsProcessing(false)
    }
  }

  const handlePreview = (art: any) => {
    setSelectedPreview(art)
    setZoomLevel(1)
    setIsPreviewOpen(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">Technical Artwork Control</h2>
          <p className="text-muted-foreground">Manage design approvals before estimation starts.</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}><Upload className="mr-2 h-4 w-4" /> Upload New Design</Button>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <form onSubmit={handleUploadArtwork}>
            <DialogHeader>
              <DialogTitle>New Prepress Entry</DialogTitle>
              <DialogDescription>Submit technical drawings for client approval.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="customerId">Client Entity</Label>
                <Select name="customerId" required>
                  <SelectTrigger><SelectValue placeholder="Select Client" /></SelectTrigger>
                  <SelectContent>
                    {customers?.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.companyName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="name">Job Name / Product</Label>
                <Input id="name" name="name" placeholder="e.g. Front Label - v1" required />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="grid gap-2"><Label>Width (mm)</Label><Input name="width" type="number" defaultValue="50" /></div>
                <div className="grid gap-2"><Label>Height (mm)</Label><Input name="height" type="number" defaultValue="100" /></div>
                <div className="grid gap-2"><Label>Version</Label><Input name="version" defaultValue="1.0" /></div>
              </div>
            </div>
            <DialogFooter><Button type="submit" className="w-full">Initiate Prepress Approval</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="sm:max-w-[90vw] h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-6 border-b shrink-0">
            <div className="flex justify-between items-center pr-10">
              <div>
                <DialogTitle className="text-2xl font-black">{selectedPreview?.name}</DialogTitle>
                <DialogDescription>VER {selectedPreview?.version} • {selectedPreview?.width}x{selectedPreview?.height}mm • {selectedPreview?.clientName}</DialogDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={() => setZoomLevel(prev => Math.max(0.5, prev - 0.5))}><Minus className="h-4 w-4" /></Button>
                <span className="text-xs font-bold w-12 text-center">{Math.round(zoomLevel * 100)}%</span>
                <Button variant="outline" size="icon" onClick={() => setZoomLevel(prev => Math.min(5, prev + 0.5))}><Plus className="h-4 w-4" /></Button>
                <Button variant="outline" onClick={() => setZoomLevel(1)}>Reset</Button>
              </div>
            </div>
          </DialogHeader>
          <div className="flex-1 bg-neutral-900 overflow-auto flex items-center justify-center p-10">
            <div className="relative transition-transform duration-200 shadow-2xl bg-white" style={{ transform: `scale(${zoomLevel})`, width: '100%', maxWidth: '800px', aspectRatio: selectedPreview?.width / selectedPreview?.height || 1 }}>
              {selectedPreview?.filePath && <Image src={selectedPreview.filePath} alt="Artwork Master" fill className="object-contain" data-ai-hint="label artwork" />}
            </div>
          </div>
          <DialogFooter className="p-6 border-t shrink-0 bg-background">
            <div className="flex justify-between w-full items-center">
              <p className="text-xs text-muted-foreground italic">{selectedPreview?.description || "No technical flags."}</p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => toast({ title: "Downloading..." })}><Download className="mr-2 h-4 w-4" /> Download PDF</Button>
                {selectedPreview?.status !== 'Approved' && (
                  <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => handleApprove(selectedPreview)} disabled={isProcessing}>
                    <CheckCircle2 className="mr-2 h-4 w-4" /> Approve Design
                  </Button>
                )}
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {artworksLoading ? (
          <div className="col-span-full py-20 text-center"><Loader2 className="animate-spin mx-auto" /></div>
        ) : artworks?.map((art) => (
          <Card key={art.id} className="overflow-hidden group hover:border-primary transition-all">
            <div className="aspect-square bg-muted flex items-center justify-center relative border-b">
              {art.thumbnailUrl ? <Image src={art.thumbnailUrl} alt={art.name} fill className="object-cover opacity-80 group-hover:opacity-100 transition-opacity" data-ai-hint="artwork thumbnail" /> : <Palette className="h-12 w-12 text-muted-foreground/20" />}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                <Button variant="secondary" size="sm" onClick={() => handlePreview(art)}><ZoomIn className="h-4 w-4 mr-1" /> Inspect</Button>
              </div>
            </div>
            <CardHeader className="p-4">
              <div className="flex justify-between items-start mb-1">
                <span className="text-[10px] font-mono font-bold text-muted-foreground">V-{art.version}</span>
                <Badge variant={art.status === 'Approved' ? 'default' : 'secondary'} className={art.status === 'Approved' ? 'bg-emerald-500' : ''}>{art.status}</Badge>
              </div>
              <CardTitle className="text-sm truncate font-black">{art.name}</CardTitle>
              <p className="text-[10px] text-primary font-bold">{art.clientName}</p>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  )
}
