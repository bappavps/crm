"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { IdCard } from "lucide-react"

export default function LabelSlittingJobCardPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">Label Slitting Job Cards</h2>
          <p className="text-muted-foreground">Secondary slitting instructions for finished labels.</p>
        </div>
      </div>
      <Card>
        <CardContent className="py-20 text-center text-muted-foreground italic">
          <IdCard className="h-12 w-12 mx-auto mb-4 opacity-20" />
          Monitor slitting outputs and remaining waste metrics.
        </CardContent>
      </Card>
    </div>
  )
}