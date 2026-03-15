"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { IdCard } from "lucide-react"

export default function RoteryDieJobCardPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">Rotery Die Job Cards</h2>
          <p className="text-muted-foreground">High-speed rotary die technical specifications.</p>
        </div>
      </div>
      <Card>
        <CardContent className="py-20 text-center text-muted-foreground italic">
          <IdCard className="h-12 w-12 mx-auto mb-4 opacity-20" />
          Assign rotary dies from the master tooling library.
        </CardContent>
      </Card>
    </div>
  )
}