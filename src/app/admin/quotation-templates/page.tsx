"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { 
  FileJson, 
  Plus, 
  Pencil, 
  Trash2, 
  Save, 
  Loader2, 
  CheckCircle2, 
  Code,
  Info
} from "lucide-react"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog"
import { useFirestore, useUser, useCollection, useMemoFirebase, useDoc } from "@/firebase"
import { collection, doc } from "firebase/firestore"
import { addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase/non-blocking-updates"
import { useToast } from "@/hooks/use-toast"
import { Switch } from "@/components/ui/switch"

export default function QuotationTemplatesPage() {
  const { toast } = useToast()
  const { user } = useUser()
  const firestore = useFirestore()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<any>(null)

  // Authorization check
  const adminDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'adminUsers', user.uid);
  }, [firestore, user]);
  const { data: adminData, isLoading: authLoading } = useDoc(adminDocRef);

  // Firestore Query
  const templatesQuery = useMemoFirebase(() => {
    if (!firestore || !user || !adminData) return null;
    return collection(firestore, 'quotation_templates');
  }, [firestore, user, adminData])

  const { data: templates, isLoading: templatesLoading } = useCollection(templatesQuery)

  const handleSaveTemplate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!firestore || !user) return

    const formData = new FormData(e.currentTarget)
    const data = {
      template_name: formData.get("template_name") as string,
      header_html: formData.get("header_html") as string,
      body_html: formData.get("body_html") as string,
      footer_html: formData.get("footer_html") as string,
      terms_conditions: formData.get("terms_conditions") as string,
      is_default: formData.get("is_default") === 'on',
      active: true,
      updatedAt: new Date().toISOString()
    }

    if (editingTemplate) {
      updateDocumentNonBlocking(doc(firestore, 'quotation_templates', editingTemplate.id), data)
      toast({ title: "Template Updated", description: "Changes saved successfully." })
    } else {
      addDocumentNonBlocking(collection(firestore, 'quotation_templates'), {
        ...data,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString()
      })
      toast({ title: "Template Created", description: "New quotation format is now live." })
    }

    setIsDialogOpen(false)
    setEditingTemplate(null)
  }

  const handleDelete = (id: string, name: string) => {
    if (!firestore) return
    if (confirm(`Delete template "${name}"?`)) {
      deleteDocumentNonBlocking(doc(firestore, 'quotation_templates', id))
      toast({ title: "Template Removed", description: "Format deleted from system." })
    }
  }

  if (authLoading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin" /></div>
  if (!adminData) return <div className="p-20 text-center">Access restricted to Administrators.</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">Quotation Templates</h2>
          <p className="text-muted-foreground">Manage official document layouts and brand identity.</p>
        </div>
        <Button onClick={() => { setEditingTemplate(null); setIsDialogOpen(true); }}><Plus className="mr-2 h-4 w-4" /> Create Template</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {templatesLoading ? (
          <div className="col-span-full py-20 text-center"><Loader2 className="animate-spin mx-auto" /></div>
        ) : templates?.map((tpl) => (
          <Card key={tpl.id} className="relative group hover:border-primary transition-all shadow-md">
            <CardHeader>
              <div className="flex justify-between items-start">
                <CardTitle className="text-lg font-black uppercase tracking-tight">{tpl.template_name}</CardTitle>
                {tpl.is_default && <Badge className="bg-emerald-500">DEFAULT</Badge>}
              </div>
              <CardDescription>Format used for official client proposals.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => { setEditingTemplate(tpl); setIsDialogOpen(true); }}><Pencil className="h-3 w-3 mr-1" /> Edit Design</Button>
                <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(tpl.id, tpl.template_name)}><Trash2 className="h-3 w-3" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[900px] max-h-[95vh] overflow-y-auto">
          <form onSubmit={handleSaveTemplate}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Code className="h-5 w-5 text-primary" /> Template Designer
              </DialogTitle>
              <DialogDescription>Use HTML or plain text with standard placeholders for dynamic data mapping.</DialogDescription>
            </DialogHeader>
            
            <div className="grid gap-6 py-4">
              <div className="flex justify-between items-end gap-4">
                <div className="space-y-2 flex-1">
                  <Label htmlFor="template_name">Template Friendly Name</Label>
                  <Input id="template_name" name="template_name" defaultValue={editingTemplate?.template_name} required />
                </div>
                <div className="flex items-center gap-2 pb-2">
                  <Label htmlFor="is_default">Set as Default</Label>
                  <Switch id="is_default" name="is_default" defaultChecked={editingTemplate?.is_default} />
                </div>
              </div>

              <div className="p-4 bg-muted/30 border rounded-lg space-y-3">
                <Label className="text-[10px] font-black uppercase text-primary flex items-center gap-1">
                  <Info className="h-3 w-3" /> Standard Data Placeholders
                </Label>
                <div className="flex flex-wrap gap-2">
                  {["{{client_name}}", "{{product_name}}", "{{size}}", "{{material}}", "{{qty}}", "{{rate}}", "{{total}}", "{{delivery_date}}"].map(p => (
                    <code key={p} className="text-[10px] bg-background border px-1.5 py-0.5 rounded font-mono font-bold text-muted-foreground">{p}</code>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase">Header HTML / Branding</Label>
                  <Textarea name="header_html" className="font-mono text-xs h-32" defaultValue={editingTemplate?.header_html} placeholder="<div style='font-weight: bold;'>SHREE LABEL CREATION</div>" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase">Body HTML / Item Table Container</Label>
                  <Textarea name="body_html" className="font-mono text-xs h-40" defaultValue={editingTemplate?.body_html} placeholder="<p>We are pleased to quote for: {{product_name}}</p>" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase">Terms & Conditions</Label>
                  <Textarea name="terms_conditions" className="text-xs h-24" defaultValue={editingTemplate?.terms_conditions} placeholder="1. Validity: 30 days..." />
                </div>
              </div>
            </div>

            <DialogFooter className="border-t pt-4">
              <Button type="submit" className="w-full h-12 font-black uppercase tracking-widest">
                <Save className="h-4 w-4 mr-2" /> Save Quotation Format
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
