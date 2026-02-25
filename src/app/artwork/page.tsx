
"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Palette, Upload, CheckCircle2, Clock, AlertCircle } from "lucide-react"

const artworks = [
  { id: 'ART-101', name: 'Cough Syrup Label v2', client: 'PharmaTech', status: 'Approved', version: '2.1' },
  { id: 'ART-102', name: 'Mineral Water Front v1', client: 'EcoDrinks', status: 'In Review', version: '1.0' },
  { id: 'ART-103', name: 'Face Wash Gold - New Design', client: 'BeautyLine', status: 'Pending Upload', version: '-' },
]

export default function ArtworkPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">Artwork Management</h2>
          <p className="text-muted-foreground">Version control and approval workflow for label designs.</p>
        </div>
        <Button><Upload className="mr-2 h-4 w-4" /> Upload Artwork</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {artworks.map((art) => (
          <Card key={art.id} className="overflow-hidden group hover:border-primary transition-colors">
            <div className="aspect-video bg-muted flex items-center justify-center relative">
              <Palette className="h-12 w-12 text-muted-foreground/20" />
              <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Button variant="secondary" size="sm">Preview Files</Button>
              </div>
            </div>
            <CardHeader className="p-4">
              <div className="flex justify-between items-start mb-1">
                <span className="text-[10px] font-mono font-bold text-muted-foreground">{art.id}</span>
                <Badge variant="outline" className="text-[10px] h-5">{art.version !== '-' ? `v${art.version}` : 'New'}</Badge>
              </div>
              <CardTitle className="text-base">{art.name}</CardTitle>
              <p className="text-xs text-primary font-medium">{art.client}</p>
            </CardHeader>
            <CardContent className="p-4 pt-0 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs">
                {art.status === 'Approved' ? <CheckCircle2 className="h-3 w-3 text-emerald-500" /> : 
                 art.status === 'In Review' ? <Clock className="h-3 w-3 text-amber-500" /> : 
                 <AlertCircle className="h-3 w-3 text-muted-foreground" />}
                <span className="text-muted-foreground">{art.status}</span>
              </div>
              <Button size="sm" variant="ghost">History</Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
