
"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useFirestore, useUser, useDoc, useMemoFirebase } from "@/firebase"
import { doc } from "firebase/firestore"
import { setDocumentNonBlocking } from "@/firebase/non-blocking-updates"
import { useToast } from "@/hooks/use-toast"
import { Binary, Save, Loader2, ShieldAlert } from "lucide-react"

export default function JobSettingsPage() {
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
    return doc(firestore, 'job_settings', 'unique-id-config');
  }, [firestore]);
  const { data: settings, isLoading: settingsLoading } = useDoc(settingsDocRef);

  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!firestore || !user || !adminData) return

    const formData = new FormData(e.currentTarget)
    const data = {
      jobPrefix: formData.get("jobPrefix") as string,
      yearFormat: formData.get("yearFormat") as string,
      numberLength: Number(formData.get("numberLength")),
      separator: formData.get("separator") as string,
      updatedAt: new Date().toISOString(),
      updatedById: user.uid
    }

    setDocumentNonBlocking(doc(firestore, 'job_settings', 'unique-id-config'), data, { merge: true })
    
    toast({
      title: "Job Settings Saved",
      description: "Unique ID logic has been updated for all future jobs."
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
          <p className="text-muted-foreground max-w-md">Only administrators can modify unique job numbering configurations.</p>
        </div>
      </div>
    )
  }

  const currentYear = new Date().getFullYear().toString()
  const displayYear = settings?.yearFormat === 'YYYY' ? currentYear : currentYear.slice(-2)
  const previewNum = "1".padStart(settings?.numberLength || 4, "0")
  const previewId = `${settings?.jobPrefix || "JOB"}${settings?.separator || "-"}${displayYear}${settings?.separator || "-"}${previewNum}`

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-primary">Job Numbering Settings</h2>
        <p className="text-muted-foreground">Configure the logic for enterprise-wide unique Job IDs.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Binary className="h-5 w-5 text-primary" /> ID Configuration
            </CardTitle>
            <CardDescription>Define how Sales Job numbers are automatically generated.</CardDescription>
          </CardHeader>
          <CardContent>
            {settingsLoading ? (
              <div className="py-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : (
              <form onSubmit={handleSave} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="jobPrefix">Job Prefix</Label>
                    <Input id="jobPrefix" name="jobPrefix" defaultValue={settings?.jobPrefix || "JOB"} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="yearFormat">Year Format</Label>
                    <Select name="yearFormat" defaultValue={settings?.yearFormat || "YYYY"}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="YYYY">Full Year (2025)</SelectItem>
                        <SelectItem value="YY">Short Year (25)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="numberLength">Serial Length (Padded)</Label>
                    <Input id="numberLength" name="numberLength" type="number" defaultValue={settings?.numberLength || 4} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="separator">Separator</Label>
                    <Input id="separator" name="separator" defaultValue={settings?.separator || "-"} required />
                  </div>
                </div>

                <Button type="submit" className="w-full">
                  <Save className="mr-2 h-4 w-4" /> Save Job ID Logic
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <Card className="bg-primary/5 border-primary/20 flex flex-col justify-center">
          <CardHeader className="text-center">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">ID Preview Pattern</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 flex flex-col items-center">
            <div className="p-8 bg-background rounded-2xl border-2 border-dashed border-primary/30 shadow-inner">
              <code className="text-4xl font-black text-primary tracking-tighter">
                {previewId}
              </code>
            </div>
            <div className="text-xs text-center text-muted-foreground italic max-w-sm px-4">
              * This pattern will be automatically generated when a new job is created in the Sales module. The sequence is global and unique.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
