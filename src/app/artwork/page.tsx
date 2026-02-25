
"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Palette, Upload, CheckCircle2, Clock, AlertCircle, Loader2 } from "lucide-react"
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

export default function ArtworkPage() {
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
      filePath: "https://picsum.photos/seed/artwork/600/400", // Simulated path
      status: "In Review",
      uploadDate: new Date().toISOString(),
      uploadedById: user.uid,
      description: formData.get("description") as string || ""
    }

    addDocumentNonBlocking(collection(firestore, 'artworks'), artworkData)

    setIsDialogOpen(false)
    toast({
      title: "Artwork Uploaded",
      description: `New version for ${name} has been queued for review.`
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">Artwork Management</h2>
          <p className="text-muted-foreground">Version control and approval workflow for label designs.</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}><Upload className="mr-2 h-4 w-4" /> Upload Artwork</Button>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleUploadArtwork}>
            <DialogHeader>
              <DialogTitle>Upload New Artwork</DialogTitle>
              <DialogDescription>Link the design file to an approved estimate for version tracking.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="estimateId">Linked Estimate</Label>
                <Select name="estimateId" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Job/Estimate" />
                  </SelectTrigger>
                  <SelectContent>
                    {estimates?.map((est) => (
                      <SelectItem key={est.id} value={est.id}>
                        {est.estimateNumber} - {est.productCode}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="name">Design Name</Label>
                <Input id="name" name="name" placeholder="e.g. Cough Syrup Front Label" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="version">Version</Label>
                  <Input id="version" name="version" placeholder="1.0" defaultValue="1.0" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="description">Notes</Label>
                  <Input id="description" name="description" placeholder="Color changes..." />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit">Submit for Review</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {artworksLoading ? (
          <div className="col-span-full flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin mb-4 text-primary" />
            <p>Fetching artwork library...</p>
          </div>
        ) : artworks?.map((art) => (
          <Card key={art.id} className="overflow-hidden group hover:border-primary transition-colors">
            <div className="aspect-video bg-muted flex items-center justify-center relative">
              <Palette className="h-12 w-12 text-muted-foreground/20" />
              <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Button variant="secondary" size="sm">Preview Design</Button>
              </div>
            </div>
            <CardHeader className="p-4">
              <div className="flex justify-between items-start mb-1">
                <span className="text-[10px] font-mono font-bold text-muted-foreground">VER-{art.id.slice(-6).toUpperCase()}</span>
                <Badge variant="outline" className="text-[10px] h-5">v{art.version}</Badge>
              </div>
              <CardTitle className="text-base truncate">{art.name}</CardTitle>
              <p className="text-xs text-primary font-medium">{art.clientName}</p>
            </CardHeader>
            <CardContent className="p-4 pt-0 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs">
                {art.status === 'Approved' ? <CheckCircle2 className="h-3 w-3 text-emerald-500" /> : 
                 art.status === 'In Review' ? <Clock className="h-3 w-3 text-amber-500" /> : 
                 <AlertCircle className="h-3 w-3 text-muted-foreground" />}
                <span className="text-muted-foreground">{art.status}</span>
              </div>
              <div className="text-[10px] text-muted-foreground italic">
                {new Date(art.uploadDate).toLocaleDateString()}
              </div>
            </CardContent>
          </Card>
        ))}
        {(!artworks || artworks.length === 0) && !artworksLoading && (
          <div className="col-span-full border-2 border-dashed rounded-xl py-20 text-center space-y-4">
            <Palette className="h-12 w-12 text-muted-foreground/20 mx-auto" />
            <div className="space-y-1">
              <p className="font-bold text-muted-foreground">No Artworks Found</p>
              <p className="text-sm text-muted-foreground/60">Upload designs to start the approval workflow.</p>
            </div>
            <Button variant="outline" onClick={() => setIsDialogOpen(true)}>Initialize Gallery</Button>
          </div>
        )}
      </div>
    </div>
  )
}
