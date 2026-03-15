"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { IdCard } from "lucide-react"

export default function FlatBedJobCardPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">Flat Bed Job Cards</h2>
          <p className="text-muted-foreground">Technical sheets for flat-bed die cutting and finishing.</p>
        </div>
      </div>
      <Card>
        <CardContent className="py-20 text-center text-muted-foreground italic">
          <IdCard className="h-12 w-12 mx-auto mb-4 opacity-20" />
          Configure flat-bed parameters for the current production run.
        </CardContent>
      </Card>
    </div>
  )
}