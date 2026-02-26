
"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useFirestore, useUser, useDoc, useMemoFirebase } from "@/firebase"
import { doc } from "firebase/firestore"
import { setDocumentNonBlocking } from "@/firebase/non-blocking-updates"
import { useToast } from "@/hooks/use-toast"
import { Calculator, Save, Loader2, ShieldAlert } from "lucide-react"

export default function PricingSettingsPage() {
  const { toast } = useToast()
  const { user } = useUser()
  const firestore = useFirestore()

  // Authorization check
  const adminDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, '_system_roles/admins', user.uid);
  }, [firestore, user]);
  const { data: adminData, isLoading: authLoading } = useDoc(adminDocRef);

  // Settings Query
  const settingsDocRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'system_settings', 'pricing_config');
  }, [firestore]);
  const { data: settings, isLoading: settingsLoading } = useDoc(settingsDocRef);

  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!firestore || !user || !adminData) return

    const formData = new FormData(e.currentTarget)
    const divider = Number(formData.get("sqInchDivider"))

    setDocumentNonBlocking(doc(firestore, 'system_settings', 'pricing_config'), {
      sqInchDivider: divider,
      updatedAt: new Date().toISOString(),
      updatedById: user.uid
    }, { merge: true })
    
    toast({
      title: "Pricing Settings Saved",
      description: "Global calculation logic has been updated for all new Sales Job posts."
    })
  }

  if (authLoading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin" /></div>
  if (!adminData) return <div className="p-20 text-center text-muted-foreground">Admin Access Required.</div>

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-primary">System Pricing Logic</h2>
        <p className="text-muted-foreground">Configure global constants for automated cost calculations.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calculator className="h-5 w-5 text-primary" /> Costing Constants
            </CardTitle>
            <CardDescription>Define mathematical dividers used in Square Inch pricing.</CardDescription>
          </CardHeader>
          <CardContent>
            {settingsLoading ? (
              <div className="py-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : (
              <form onSubmit={handleSave} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="sqInchDivider">Square Inch Divider</Label>
                  <Input id="sqInchDivider" name="sqInchDivider" type="number" defaultValue={settings?.sqInchDivider || 625} required />
                  <p className="text-[10px] text-muted-foreground italic">
                    Formula: (Width * Height) / Divider. Standard value is usually 625.
                  </p>
                </div>

                <Button type="submit" className="w-full">
                  <Save className="mr-2 h-4 w-4" /> Update Pricing Logic
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <Card className="bg-primary/5 border-primary/20">
          <CardHeader>
            <CardTitle className="text-sm font-bold uppercase text-primary">Calculation Sample</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-background rounded-lg border">
              <p className="text-xs text-muted-foreground mb-4">Example: 50mm x 100mm label with divider {settings?.sqInchDivider || 625}</p>
              <div className="space-y-2 font-mono text-sm">
                <p>1. Total SqInch: (50 * 100) / {settings?.sqInchDivider || 625} = <span className="font-bold text-primary">{(5000 / (settings?.sqInchDivider || 625)).toFixed(4)}</span></p>
                <p>2. If Rate is ₹0.20/SqInch:</p>
                <p>3. Cost/Label: {(5000 / (settings?.sqInchDivider || 625)).toFixed(4)} * 0.20 = <span className="font-bold text-accent">₹{((5000 / (settings?.sqInchDivider || 625)) * 0.2).toFixed(4)}</span></p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
