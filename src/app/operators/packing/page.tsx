"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { UserCog } from "lucide-react"

export default function PackingSectionPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">Packing Section</h2>
          <p className="text-muted-foreground">Packaging validation and dispatch preparation.</p>
        </div>
      </div>
      <Card>
        <CardContent className="py-20 text-center text-muted-foreground italic">
          <UserCog className="h-12 w-12 mx-auto mb-4 opacity-20" />
          Awaiting finished goods from production.
        </CardContent>
      </Card>
    </div>
  )
}