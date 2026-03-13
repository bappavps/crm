
"use client"

import { useState, useEffect, useMemo } from "react"
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
  const [isMounted, setIsMounted] = useState(false)

  // Local state for instant preview updates
  const [formValues, setFormValues] = useState({
    parentPrefix: "TLC-",
    startNumber: 1000,
    childType: "alphabet",
    subChildType: "number",
    separator: "-",
    barcodePrefix: "BC-",
    trackingYear: 2026 // Static default to avoid hydration mismatch
  })

  useEffect(() => {
    setIsMounted(true)
    // Update tracking year to current once on client mount if not already loaded from settings
    setFormValues(prev => ({ ...prev, trackingYear: new Date().getFullYear() }))
  }, [])

  // Authorization check
  const adminDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'adminUsers', user.uid);
  }, [firestore, user]);
  const { data: adminData, isLoading: authLoading } = useDoc(adminDocRef);

  // Settings Query
  const settingsDocRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'roll_settings', 'global_config');
  }, [firestore]);
  const { data: settings, isLoading: settingsLoading } = useDoc(settingsDocRef);

  // Sync state with Firestore data when loaded
  useEffect(() => {
    if (settings) {
      setFormValues({
        parentPrefix: settings.parentPrefix || "TLC-",
        startNumber: Number(settings.startNumber) || 1000,
        childType: settings.childType || "alphabet",
        subChildType: settings.subChildType || "number",
        separator: settings.separator || "-",
        barcodePrefix: settings.barcodePrefix || "BC-",
        trackingYear: Number(settings.trackingYear) || new Date().getFullYear()
      })
    }
  }, [settings])

  // Counter Query for tracking status
  const counterDocRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'counters', 'jumbo_roll');
  }, [firestore]);
  const { data: counter } = useDoc(counterDocRef);

  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!firestore || !user || !adminData) return

    setDocumentNonBlocking(doc(firestore, 'roll_settings', 'global_config'), formValues, { merge: true })
    
    toast({
      title: "Settings Saved",
      description: "Roll numbering configuration has been updated across the system."
    })
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormValues(prev => ({
      ...prev,
      [name]: name === 'startNumber' || name === 'trackingYear' ? Number(value) : value
    }))
  }

  const handleSelectChange = (name: string, value: string) => {
    setFormValues(prev => ({
      ...prev,
      [name]: value
    }))
  }

  // Dynamic Preview Logic
  const previewData = useMemo(() => {
    const parentNumber = (formValues.startNumber || 1000) + 1
    const parentCode = `${formValues.parentPrefix}${parentNumber}`
    
    const childValue = formValues.childType === "alphabet" ? "A" : "1"
    const subChildValue = formValues.subChildType === "alphabet" ? "A" : "1"
    
    const parentPreview = parentCode
    const childPreview = `${parentCode}${formValues.separator}${childValue}`
    const subChildPreview = `${childPreview}${formValues.separator}${subChildValue}`

    return { parentPreview, childPreview, subChildPreview }
  }, [formValues])

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
            {settingsLoading || !isMounted ? (
              <div className="py-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : (
              <form onSubmit={handleSave} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="parentPrefix">Parent Roll Prefix</Label>
                    <Input id="parentPrefix" name="parentPrefix" value={formValues.parentPrefix} onChange={handleInputChange} placeholder="e.g. TLC-" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="startNumber">Roll Start Number</Label>
                    <Input id="startNumber" name="startNumber" type="number" value={formValues.startNumber} onChange={handleInputChange} required />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="childType">Child Roll Type</Label>
                    <Select value={formValues.childType} onValueChange={(val) => handleSelectChange('childType', val)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="alphabet">Alphabet (A, B, C...)</SelectItem>
                        <SelectItem value="number">Number (1, 2, 3...)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="subChildType">Sub Child Type</Label>
                    <Select value={formValues.subChildType} onValueChange={(val) => handleSelectChange('subChildType', val)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="alphabet">Alphabet (A, B, C...)</SelectItem>
                        <SelectItem value="number">Number (1, 2, 3...)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="separator">Separator</Label>
                    <Input id="separator" name="separator" value={formValues.separator} onChange={handleInputChange} placeholder="e.g. -" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="barcodePrefix">Barcode Prefix</Label>
                    <Input id="barcodePrefix" name="barcodePrefix" value={formValues.barcodePrefix} onChange={handleInputChange} placeholder="e.g. BC-" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="trackingYear">Current Tracking Year</Label>
                  <Input id="trackingYear" name="trackingYear" type="number" value={formValues.trackingYear} onChange={handleInputChange} required />
                </div>

                <Button type="submit" className="w-full">
                  <Save className="mr-2 h-4 w-4" /> Save Configuration
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="bg-primary/5 border-primary/20">
            <CardHeader>
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-primary">Dynamic Logic Preview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="p-4 bg-background rounded-lg border shadow-sm">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Jumbo Roll (Parent)</p>
                  <code className="text-xl font-black text-primary">
                    {previewData.parentPreview}
                  </code>
                </div>

                <div className="p-4 bg-background rounded-lg border shadow-sm">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Slitted Roll (Child)</p>
                  <code className="text-xl font-black text-foreground">
                    {previewData.childPreview}
                  </code>
                </div>

                <div className="p-4 bg-background rounded-lg border shadow-sm">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Job FG (Sub Child)</p>
                  <code className="text-xl font-black text-accent">
                    {previewData.subChildPreview}
                  </code>
                </div>
              </div>

              <div className="text-xs text-muted-foreground italic leading-relaxed">
                * Previews update instantly. The numbering system respects your start number ({formValues.startNumber}) and handles separators and prefix types dynamically.
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Hash className="h-4 w-4 text-primary" /> Database Sequence Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground font-medium">Last Sequence Used:</p>
                  <p className="text-lg font-bold">{counter?.current_number || 0}</p>
                </div>
                <div>
                  <p className="text-muted-foreground font-medium">Active Year:</p>
                  <p className="text-lg font-bold">{counter?.year || (isMounted ? new Date().getFullYear() : '...')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
