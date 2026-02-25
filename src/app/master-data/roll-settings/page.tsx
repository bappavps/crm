
"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useFirestore, useUser, useDoc, useMemoFirebase } from "@/firebase"
import { doc } from "firebase/firestore"
import { setDocumentNonBlocking } from "@/firebase/non-blocking-updates"
import { useToast } from "@/hooks/use-toast"
import { Hash, Save, Loader2, ShieldAlert } from "lucide-react"

export default function RollSettingsPage() {
  const { toast } = useToast()
  const { user } = useUser()
  const firestore = useFirestore()

  // Authorization check
  const adminDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'adminUsers', user.uid);
  }, [firestore, user]);
  const { data: adminData, isLoading: authLoading } = useDoc(adminDocRef);

  // Settings Query
  const settingsDocRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'settings', 'roll-numbering');
  }, [firestore]);
  const { data: settings, isLoading: settingsLoading } = useDoc(settingsDocRef);

  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!firestore || !user || !adminData) return

    const formData = new FormData(e.currentTarget)
    const data = {
      parentRollPrefix: formData.get("parentRollPrefix") as string,
      rollStartNumber: Number(formData.get("rollStartNumber")),
      childRollPrefixType: formData.get("childRollPrefixType") as string,
      subChildPrefixType: formData.get("subChildPrefixType") as string,
      separator: formData.get("separator") as string,
      barcodePrefix: formData.get("barcodePrefix") as string,
      updatedAt: new Date().toISOString(),
      updatedById: user.uid
    }

    setDocumentNonBlocking(doc(firestore, 'settings', 'roll-numbering'), data, { merge: true })
    
    toast({
      title: "Settings Saved",
      description: "Roll numbering configuration has been updated across the system."
    })
  }

  if (authLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin mb-4 text-primary" />
        <p>Verifying access...</p>
      </div>
    )
  }

  if (!adminData) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
        <ShieldAlert className="h-16 w-16 text-destructive/20" />
        <div className="space-y-2">
          <h2 className="text-2xl font-bold">Admin Only</h2>
          <p className="text-muted-foreground max-w-md">Only system administrators can modify global roll numbering configurations.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-primary">Roll Numbering Settings</h2>
        <p className="text-muted-foreground">Configure global logic for Jumbo, Slitted, and Derivative rolls.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Hash className="h-5 w-5 text-primary" /> Configuration
            </CardTitle>
            <CardDescription>Define prefixes and sequences for inventory traceability.</CardDescription>
          </CardHeader>
          <CardContent>
            {settingsLoading ? (
              <div className="py-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : (
              <form onSubmit={handleSave} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="parentRollPrefix">Parent Roll Prefix</Label>
                    <Input id="parentRollPrefix" name="parentRollPrefix" defaultValue={settings?.parentRollPrefix || "TLC-"} placeholder="e.g. TLC-" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rollStartNumber">Roll Start Number</Label>
                    <Input id="rollStartNumber" name="rollStartNumber" type="number" defaultValue={settings?.rollStartNumber || 1000} required />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="childRollPrefixType">Child Roll Type</Label>
                    <Select name="childRollPrefixType" defaultValue={settings?.childRollPrefixType || "Alphabet"}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Alphabet">Alphabet (A, B, C...)</SelectItem>
                        <SelectItem value="Number">Number (1, 2, 3...)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="subChildPrefixType">Sub Child Type</Label>
                    <Select name="subChildPrefixType" defaultValue={settings?.subChildPrefixType || "Number"}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Number">Number (1, 2, 3...)</SelectItem>
                        <SelectItem value="Alphabet">Alphabet (A, B, C...)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="separator">Separator</Label>
                    <Input id="separator" name="separator" defaultValue={settings?.separator || "-"} placeholder="e.g. -" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="barcodePrefix">Barcode Prefix</Label>
                    <Input id="barcodePrefix" name="barcodePrefix" defaultValue={settings?.barcodePrefix || "BC-"} placeholder="e.g. BC-" />
                  </div>
                </div>

                <Button type="submit" className="w-full">
                  <Save className="mr-2 h-4 w-4" /> Save Configuration
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <Card className="bg-primary/5 border-primary/20">
          <CardHeader>
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-primary">Preview Generation Logic</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="p-4 bg-background rounded-lg border shadow-sm">
                <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Jumbo Roll (Parent)</p>
                <code className="text-xl font-black text-primary">
                  {settings?.parentRollPrefix || "TLC-"}{settings?.rollStartNumber ? Number(settings.rollStartNumber) + 1 : 1001}
                </code>
              </div>

              <div className="p-4 bg-background rounded-lg border shadow-sm">
                <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Slitted Roll (Child)</p>
                <code className="text-xl font-black text-foreground">
                  {settings?.parentRollPrefix || "TLC-"}{settings?.rollStartNumber ? Number(settings.rollStartNumber) + 1 : 1001}{settings?.separator || "-"}{settings?.childRollPrefixType === 'Alphabet' ? 'A' : '1'}
                </code>
              </div>

              <div className="p-4 bg-background rounded-lg border shadow-sm">
                <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Job FG (Sub Child)</p>
                <code className="text-xl font-black text-accent">
                  {settings?.parentRollPrefix || "TLC-"}{settings?.rollStartNumber ? Number(settings.rollStartNumber) + 1 : 1001}{settings?.separator || "-"}A{settings?.separator || "-"}{settings?.subChildPrefixType === 'Number' ? '1' : 'A'}
                </code>
              </div>
            </div>

            <div className="text-xs text-muted-foreground italic leading-relaxed">
              * The logic uses your configured starting sequence and automatically increments for each new entry in the registry. Traceability is maintained via hierarchical naming.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
