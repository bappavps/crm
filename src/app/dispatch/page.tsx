
"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Truck, Package, MapPin } from "lucide-react"

export default function DispatchPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">Dispatch & Logistics</h2>
          <p className="text-muted-foreground">Managing deliveries, packing lists, and transport tracking.</p>
        </div>
        <Button><Truck className="mr-2 h-4 w-4" /> Create Dispatch Note</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" /> Ready for Dispatch
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 border rounded-lg bg-muted/20 space-y-2">
              <div className="flex justify-between">
                <span className="font-bold">JC-4498 - AgriCorp Labels</span>
                <Badge>15,000 Pcs</Badge>
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" /> Hyderabad Hub</p>
              <Button size="sm" className="w-full mt-2">Generate Packing Slip</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Truck className="h-5 w-5 text-primary" /> In Transit
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center py-8">
            <Truck className="h-12 w-12 text-muted-foreground mx-auto mb-2 opacity-20" />
            <p className="text-sm text-muted-foreground">No active shipments currently in transit.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
