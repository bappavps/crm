"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Palette, Upload, CheckCircle2, Clock, AlertCircle, Loader2, Download, ExternalLink, ZoomIn, Maximize2 } from "lucide-react"
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
import Image from "next/image"

export default function ArtworkPage() {
  const { toast } = useToast()
  const { user } = useUser()
  const firestore = useFirestore()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [selectedPreview, setSelectedPreview] = useState<any>(null)
  const [zoomLevel, setZoomLevel] = useState(1)

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

  const estimatesQuery = useMemoFirebase(() => {
    if (!firestore || !user || !adminData) return null;
    return collection(firestore, 'estimates');
  }, [firestore, user, adminData])

  const { data: artworks, isLoading: artworksLoading } = useCollection(artworksQuery)
  const { data: estimates } = useCollection(estimatesQuery)

  const handleUploadArtwork = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!firestore || !user) return

    const formData = new FormData(e.currentTarget)
    const estimateId = formData.get("estimateId") as string
    const name = formData.get("name") as string
    const version = formData.get("version") as string
    
    const selectedEstimate = estimates?.find(est => est.id === estimateId)

    const artworkData = {
      id: crypto.randomUUID(),
      name,
      estimateId,
      clientName: selectedEstimate?.customerName || "Unknown Client",
      version: version || "1.0",
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
    toast({
      title: "Artwork Uploaded",
      description: `New version for ${name} has been queued for review.`
    })
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
          <p className="text-muted-foreground">Pharma-grade versioning and design approval workflow.</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}><Upload className="mr-2 h-4 w-4" /> Upload Design</Button>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <form onSubmit={handleUploadArtwork}>
            <DialogHeader>
              <DialogTitle>New Technical Drawing</DialogTitle>
              <DialogDescription>Link design specs to an approved estimate.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="estimateId">Source Estimate</Label>
                <Select name="estimateId" required>
                  <SelectTrigger><SelectValue placeholder="Select Job" /></SelectTrigger>
                  <SelectContent>
                    {estimates?.map((est) => (
                      <SelectItem key={est.id} value={est.id}>{est.estimateNumber} - {est.productCode}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="name">Design Title</Label>
                <Input id="name" name="name" placeholder="e.g. Front Label - v1" required />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="width">Width (mm)</Label>
                  <Input id="width" name="width" type="number" defaultValue="50" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="height">Height (mm)</Label>
                  <Input id="height" name="height" type="number" defaultValue="100" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="version">Version</Label>
                  <Input id="version" name="version" placeholder="1.0" defaultValue="1.0" />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" className="w-full">Initialize Design Approval</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog with ZOOM */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="sm:max-w-[90vw] h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-6 border-b shrink-0">
            <div className="flex justify-between items-center pr-10">
              <div>
                <DialogTitle className="text-2xl font-black">{selectedPreview?.name}</DialogTitle>
                <DialogDescription>
                  VER {selectedPreview?.version} • {selectedPreview?.width}x{selectedPreview?.height}mm • {selectedPreview?.clientName}
                </DialogDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={() => setZoomLevel(prev => Math.max(0.5, prev - 0.5))}><X className="h-4 w-4" /></Button>
                <span className="text-xs font-bold w-12 text-center">{Math.round(zoomLevel * 100)}%</span>
                <Button variant="outline" size="icon" onClick={() => setZoomLevel(prev => Math.min(5, prev + 0.5))}><Plus className="h-4 w-4" /></Button>
                <Button variant="outline" onClick={() => setZoomLevel(1)}>Reset</Button>
              </div>
            </div>
          </DialogHeader>
          
          <div className="flex-1 bg-neutral-900 relative overflow-auto flex items-center justify-center p-10 cursor-grab active:cursor-grabbing">
            <div 
              className="relative transition-transform duration-200 shadow-2xl bg-white"
              style={{ 
                transform: `scale(${zoomLevel})`,
                width: '100%',
                maxWidth: '800px',
                aspectRatio: selectedPreview?.width / selectedPreview?.height || 1
              }}
            >
              {selectedPreview?.filePath && (
                <Image 
                  src={selectedPreview.filePath} 
                  alt="Artwork Master" 
                  fill 
                  className="object-contain"
                  data-ai-hint="label artwork"
                />
              )}
            </div>
          </div>

          <DialogFooter className="p-6 border-t shrink-0 bg-background">
            <div className="flex justify-between w-full items-center">
              <p className="text-xs text-muted-foreground italic max-w-md truncate">{selectedPreview?.description || "No technical flags for this version."}</p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => toast({ title: "Downloading High-Res...", description: "Master PDF queued." })}><Download className="mr-2 h-4 w-4" /> Download Master</Button>
                <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => toast({ title: "Approved", description: "Design released for production." })}><CheckCircle2 className="mr-2 h-4 w-4" /> Approve Design</Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {artworksLoading ? (
          <div className="col-span-full py-20 text-center"><Loader2 className="animate-spin mx-auto" /></div>
        ) : artworks?.map((art) => (
          <Card key={art.id} className="overflow-hidden group hover:border-primary transition-all shadow-md">
            <div className="aspect-square bg-muted flex items-center justify-center relative border-b">
              {art.thumbnailUrl ? (
                <Image 
                  src={art.thumbnailUrl} 
                  alt={art.name} 
                  fill 
                  className="object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                  data-ai-hint="artwork thumbnail"
                />
              ) : <Palette className="h-12 w-12 text-muted-foreground/20" />}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-sm">
                <Button variant="secondary" size="sm" onClick={() => handlePreview(art)}><ZoomIn className="h-4 w-4 mr-1" /> Inspect</Button>
              </div>
            </div>
            <CardHeader className="p-4">
              <div className="flex justify-between items-start mb-1">
                <span className="text-[10px] font-mono font-bold text-muted-foreground">V-{art.version}</span>
                <Badge variant="outline" className="text-[9px] uppercase">{art.status}</Badge>
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
