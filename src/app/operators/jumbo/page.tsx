"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { UserCog } from "lucide-react"

export default function JumboOperatorPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">Jumbo Operator Console</h2>
          <p className="text-muted-foreground">Real-time control for heavy substrate processing.</p>
        </div>
      </div>
      <Card>
        <CardContent className="py-20 text-center text-muted-foreground italic">
          <UserCog className="h-12 w-12 mx-auto mb-4 opacity-20" />
          Waiting for active machine link.
        </CardContent>
      </Card>
    </div>
  )
}