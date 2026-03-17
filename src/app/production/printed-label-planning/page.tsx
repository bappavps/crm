
"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

/**
 * REDIRECTOR: The planning board has been upgraded to a multi-departmental system.
 */
export default function LegacyPlanningPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/planning/label-printing')
  }, [router])

  return (
    <div className="flex h-[70vh] flex-col items-center justify-center gap-4">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Transitioning to Dynamic Board...</p>
    </div>
  )
}
