"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { Slider } from "@/components/ui/slider"
import { 
  Plus, 
  Save, 
  Trash2, 
  Copy, 
  Printer, 
  Type, 
  Image as ImageIcon, 
  QrCode, 
  Hash, 
  LayoutGrid, 
  Maximize2, 
  Settings2, 
  FileText, 
  Loader2, 
  Zap,
  Undo2,
  Box,
  Split,
  MousePointer2,
  CalendarDays,
  User,
  Building2,
  Layers,
  Sparkles,
  Search,
  AlignCenter,
  AlignLeft,
  AlignRight,
  RotateCw,
  Circle as CircleIcon,
  Upload,
  Grid3X3
} from "lucide-react"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useFirestore, useUser, useCollection, useMemoFirebase } from "@/firebase"
import { collection, doc, serverTimestamp, setDoc, deleteDoc, query, orderBy, writeBatch } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { QRCodeSVG } from 'qrcode.react'
import Barcode from 'react-barcode'

/**
 * PRINT TEMPLATE STUDIO (V3.1)
 * Professional Design Engine with Guidelines, TSC Print Optimization, and Fixed Uploads.
 */

type ElementType = 'text' | 'title' | 'image' | 'barcode' | 'qr' | 'line' | 'rectangle' | 'circle' | 'field' | 'table';

interface TemplateElement {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotate: number;
  content?: string;
  placeholder?: string;
  style: {
    fontSize: number;
    fontWeight: string;
    fontFamily: string;
    textAlign: 'left' | 'center' | 'right';
    color: string;
    backgroundColor?: string;
    borderWidth?: number;
    borderColor?: string;
    borderRadius?: number;
    opacity?: number;
  };
}

interface PrintTemplate {
  id: string;
  name: string;
  documentType: string;
  paperWidth: number; // mm
  paperHeight: number; // mm
  elements: TemplateElement[];
  isDefault: boolean;
}

const PAPER_SIZES = [
  { id: 'A4', name: 'A4 Paper', w: 210, h: 297 },
  { id: 'A5', name: 'A5 Paper', w: 148, h: 210 },
  { id: 'Thermal80', name: 'Thermal 80mm', w: 80, h: 200 },
  { id: 'Label150x100', name: 'Label 150x100mm', w: 150, h: 100 },
  { id: 'Custom', name: 'Custom Size', w: 100, h: 100 },
];

const FONT_FAMILIES = [
  { id: 'inter', name: 'Inter (Sans)', value: 'var(--font-inter), sans-serif' },
  { id: 'roboto', name: 'Roboto', value: "'Roboto', sans-serif" },
  { id: 'playfair', name: 'Playfair Display', value: "'Playfair Display', serif" },
  { id: 'montserrat', name: 'Montserrat', value: "'Montserrat', sans-serif" },
  { id: 'oswald', name: 'Oswald', value: "'Oswald', sans-serif" },
  { id: 'lato', name: 'Lato', value: "'Lato', sans-serif" },
  { id: 'poppins', name: 'Poppins', value: "'Poppins', sans-serif" },
  { id: 'merriweather', name: 'Merriweather', value: "'Merriweather', serif" },
  { id: 'mono', name: 'Monospace', value: "ui-monospace, SFMono-Regular, monospace" },
  { id: 'cursive', name: 'Script', value: "cursive" },
  { id: 'narrow', name: 'Arial Narrow', value: "Arial Narrow, sans-serif" },
];

const CRM_PLACEHOLDERS = [
  { key: '{{company_name}}', label: 'Company Name', icon: Building2 },
  { key: '{{invoice_no}}', label: 'Invoice Number', icon: Hash },
  { key: '{{date}}', label: 'Current Date', icon: CalendarDays },
  { key: '{{customer_name}}', label: 'Customer Name', icon: User },
  { key: '{{roll_number}}', label: 'Roll Number', icon: Box },
  { key: '{{paper_item}}', label: 'Paper Item/Type', icon: FileText },
  { key: '{{width}}', label: 'Width (MM)', icon: Maximize2 },
  { key: '{{length}}', label: 'Length (MTR)', icon: Layers },
  { key: '{{gsm}}', label: 'GSM', icon: Layers },
  { key: '{{weight}}', label: 'Weight (KG)', icon: LayoutGrid },
];

const MM_TO_PX = 3.78; 

export default function PrintTemplateStudio() {
  const { toast } = useToast()
  const { user } = useUser()
  const firestore = useFirestore()
  const [isMounted, setIsMounted] = useState(false)
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [isNewDialogOpen, setIsNewDialogOpen] = useState(false)
  
  // Studio State
  const [currentTemplate, setCurrentTemplate] = useState<PrintTemplate | null>(null)
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [isSaving, setIsSaving] = useState(false)
  const [isSeeding, setIsSeeding] = useState(false)
  const [gridSnap, setGridSnap] = useState(5)
  const [showGuidelines, setShowGuidelines] = useState(true)

  useEffect(() => { setIsMounted(true) }, [])

  // Firebase Queries
  const templatesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'print_templates'), orderBy('documentType'));
  }, [firestore]);
  const { data: templates, isLoading } = useCollection(templatesQuery);

  const selectedElement = useMemo(() => 
    currentTemplate?.elements.find(el => el.id === selectedElementId)
  , [currentTemplate, selectedElementId]);

  // Actions
  const handleCreateTemplate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!firestore) return
    
    const formData = new FormData(e.currentTarget)
    const name = formData.get("name") as string
    const type = formData.get("documentType") as string
    const sizeId = formData.get("paperSize") as string
    const size = PAPER_SIZES.find(s => s.id === sizeId) || PAPER_SIZES[0]

    const newTemplate: PrintTemplate = {
      id: crypto.randomUUID(),
      name,
      documentType: type,
      paperWidth: size.w,
      paperHeight: size.h,
      elements: [],
      isDefault: false
    }

    try {
      await setDoc(doc(firestore, 'print_templates', newTemplate.id), {
        ...newTemplate,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      })
      setCurrentTemplate(newTemplate)
      setIsNewDialogOpen(false)
      setIsEditorOpen(true)
      toast({ title: "Template Initialized", description: "Ready for visual design." })
    } catch (e) {
      toast({ variant: "destructive", title: "Creation Failed" })
    }
  }

  const handleDeleteTemplate = async (templateId: string) => {
    if (!firestore || !confirm("Permanently delete this template?")) return
    try {
      await deleteDoc(doc(firestore, 'print_templates', templateId))
      toast({ title: "Template Deleted" })
      if (currentTemplate?.id === templateId) {
        setIsEditorOpen(false)
        setCurrentTemplate(null)
      }
    } catch (e) {
      toast({ variant: "destructive", title: "Delete Failed" })
    }
  }

  const handleDuplicateTemplate = async (template: PrintTemplate) => {
    if (!firestore) return
    const newId = crypto.randomUUID()
    const newTemplate = {
      ...template,
      id: newId,
      name: `${template.name} (Copy)`,
      isDefault: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }
    try {
      await setDoc(doc(firestore, 'print_templates', newId), newTemplate)
      toast({ title: "Template Cloned" })
    } catch (e) {
      toast({ variant: "destructive", title: "Duplication Failed" })
    }
  }

  const handleSaveTemplate = async () => {
    if (!firestore || !currentTemplate) return
    setIsSaving(true)
    try {
      await setDoc(doc(firestore, 'print_templates', currentTemplate.id), {
        ...currentTemplate,
        updatedAt: serverTimestamp()
      }, { merge: true })
      toast({ title: "Studio Sync Complete", description: "Layout version saved successfully." })
    } catch (e) {
      toast({ variant: "destructive", title: "Save Error" })
    } finally {
      setIsSaving(false)
    }
  }

  const handleSeedSamples = async () => {
    if (!firestore) return
    setIsSeeding(true)
    const batch = writeBatch(firestore)
    
    const samples = [
      {
        id: 'sample-invoice-1',
        name: 'Standard Tax Invoice',
        documentType: 'Invoice',
        paperWidth: 210,
        paperHeight: 297,
        elements: [
          { id: 'e1', type: 'title', x: 20, y: 20, width: 300, height: 40, rotate: 0, content: 'TAX INVOICE', style: { fontSize: 24, fontWeight: 'bold', fontFamily: 'inter', textAlign: 'left', color: '#000000' } },
          { id: 'e2', type: 'field', x: 20, y: 70, width: 200, height: 20, rotate: 0, placeholder: '{{company_name}}', style: { fontSize: 14, fontWeight: 'bold', fontFamily: 'inter', textAlign: 'left', color: '#000000' } },
          { id: 'e3', type: 'field', x: 500, y: 20, width: 200, height: 20, rotate: 0, placeholder: 'INV: {{invoice_no}}', style: { fontSize: 12, fontWeight: 'normal', fontFamily: 'inter', textAlign: 'right', color: '#000000' } }
        ],
        isDefault: true
      },
      {
        id: 'sample-label-1',
        name: 'Industrial Roll Label (150x100)',
        documentType: 'Label',
        paperWidth: 150,
        paperHeight: 100,
        elements: [
          { id: 'l1', type: 'text', x: 10, y: 10, width: 300, height: 30, rotate: 0, content: 'SHREE LABEL CREATION', style: { fontSize: 18, fontWeight: 'bold', fontFamily: 'oswald', textAlign: 'left', color: '#000000' } },
          { id: 'l2', type: 'qr', x: 450, y: 10, width: 80, height: 80, rotate: 0, placeholder: '{{roll_number}}', style: { textAlign: 'center' } },
          { id: 'l3', type: 'barcode', x: 10, y: 300, width: 400, height: 60, rotate: 0, placeholder: '{{roll_number}}', style: { textAlign: 'center' } },
          { id: 'l4', type: 'field', x: 10, y: 150, width: 250, height: 40, rotate: 0, placeholder: 'ITEM: {{paper_item}}', style: { fontSize: 14, fontWeight: 'bold', fontFamily: 'inter', textAlign: 'left', color: '#000000' } }
        ],
        isDefault: true
      }
    ]

    try {
      for (const s of samples) {
        batch.set(doc(firestore, 'print_templates', s.id), { ...s, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
      }
      await batch.commit()
      toast({ title: "Samples Imported", description: "Default layouts added to your library." })
    } catch (e) {
      toast({ variant: "destructive", title: "Import Failed" })
    } finally {
      setIsSeeding(false)
    }
  }

  const addElement = (type: ElementType, placeholder?: string) => {
    if (!currentTemplate) return
    const id = crypto.randomUUID()
    const newEl: TemplateElement = {
      id,
      type,
      x: 40,
      y: 40,
      width: type === 'qr' ? 80 : (type === 'barcode' ? 200 : 150),
      height: type === 'qr' ? 80 : (type === 'barcode' ? 60 : 30),
      rotate: 0,
      content: placeholder ? "" : (type === 'text' || type === 'title' ? "Enter Text..." : ""),
      placeholder: placeholder || "",
      style: {
        fontSize: type === 'title' ? 24 : 14,
        fontWeight: type === 'title' ? 'bold' : 'normal',
        textAlign: 'left',
        color: '#000000',
        fontFamily: 'inter'
      }
    }
    setCurrentTemplate({
      ...currentTemplate,
      elements: [...currentTemplate.elements, newEl]
    })
    setSelectedElementId(id)
    toast({ title: "Element Added", description: `Added ${type} to canvas.` })
  }

  const updateElement = (id: string, updates: Partial<TemplateElement>) => {
    if (!currentTemplate) return
    setCurrentTemplate({
      ...currentTemplate,
      elements: currentTemplate.elements.map(el => el.id === id ? { ...el, ...updates } : el)
    })
  }

  const updateElementStyle = (id: string, styleUpdates: any) => {
    if (!currentTemplate) return
    setCurrentTemplate({
      ...currentTemplate,
      elements: currentTemplate.elements.map(el => 
        el.id === id ? { ...el, style: { ...el.style, ...styleUpdates } } : el
      )
    })
  }

  const deleteElement = (id: string) => {
    if (!currentTemplate) return
    setCurrentTemplate({
      ...currentTemplate,
      elements: currentTemplate.elements.filter(el => el.id !== id)
    })
    setSelectedElementId(null)
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selectedElement || selectedElement.type !== 'image') {
      toast({ variant: "destructive", title: "Select an image element on canvas first." });
      return;
    }

    const reader = new FileReader()
    reader.onload = (evt) => {
      const base64 = evt.target?.result as string
      updateElement(selectedElement.id, { content: base64 })
      toast({ title: "Image Imported" })
    }
    reader.readAsDataURL(file)
  }

  if (!isMounted) return null;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 h-full flex flex-col">
      {!isEditorOpen ? (
        <>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h2 className="text-3xl font-black text-primary uppercase tracking-tighter">Print Template Studio</h2>
              <p className="text-muted-foreground font-medium text-sm">Visual drag & drop designer for official ERP documents and labels.</p>
            </div>
            <div className="flex gap-2">
              {(templates?.length === 0) && (
                <Button variant="outline" onClick={handleSeedSamples} disabled={isSeeding} className="h-12 border-primary/20 hover:bg-primary/5">
                  {isSeeding ? <Loader2 className="animate-spin mr-2" /> : <Sparkles className="mr-2 h-5 w-5 text-primary" />}
                  Seed Samples
                </Button>
              )}
              <Button onClick={() => setIsNewDialogOpen(true)} className="h-12 px-8 font-black uppercase shadow-xl">
                <Plus className="mr-2 h-5 w-5" /> New Design
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {isLoading ? (
              <div className="col-span-full py-20 text-center"><Loader2 className="animate-spin h-10 w-10 mx-auto text-primary" /></div>
            ) : templates?.map(tpl => (
              <Card key={tpl.id} className="group hover:border-primary transition-all overflow-hidden border-none shadow-lg">
                <div className="bg-slate-900 aspect-[3/4] p-4 relative flex items-center justify-center">
                  <div className="bg-white shadow-2xl w-full h-full rounded p-4 flex flex-col gap-2 overflow-hidden scale-90 opacity-80 group-hover:opacity-100 transition-all">
                    <div className="h-4 w-1/2 bg-slate-100 rounded" />
                    <div className="h-2 w-full bg-slate-50 rounded" />
                    <div className="h-2 w-full bg-slate-50 rounded" />
                    <div className="mt-auto flex justify-between items-end">
                      <div className="h-10 w-10 bg-slate-100 rounded" />
                      <div className="h-4 w-1/3 bg-slate-100 rounded" />
                    </div>
                  </div>
                  <div className="absolute inset-0 bg-primary/90 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3 p-6">
                    <Button variant="secondary" className="w-full font-black uppercase text-[10px]" onClick={() => { setCurrentTemplate(tpl); setIsEditorOpen(true); }}>
                      Open Visual Editor
                    </Button>
                    <div className="flex gap-2 w-full">
                      <Button variant="outline" size="icon" className="bg-white/10 border-white/20 text-white hover:bg-white/20 flex-1" onClick={() => handleDuplicateTemplate(tpl)}>
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button variant="destructive" size="icon" className="flex-1" onClick={() => handleDeleteTemplate(tpl.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
                <CardHeader className="p-4 bg-white border-t">
                  <div className="flex justify-between items-start">
                    <div className="truncate flex-1 pr-2">
                      <CardTitle className="text-xs font-black uppercase truncate">{tpl.name}</CardTitle>
                      <CardDescription className="text-[9px] uppercase font-bold tracking-widest text-primary">{tpl.documentType}</CardDescription>
                    </div>
                    {tpl.isDefault && <Badge className="bg-emerald-500 text-[8px] h-4 px-1.5 font-black uppercase">DEF</Badge>}
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        </>
      ) : (
        /* --- THE STUDIO EDITOR --- */
        <div className="fixed inset-0 z-50 bg-slate-100 flex flex-col font-sans">
          {/* Editor Header */}
          <div className="h-16 border-b flex items-center justify-between px-6 shrink-0 bg-white shadow-sm z-50">
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => setIsEditorOpen(false)} className="font-bold hover:bg-slate-50">
                <Undo2 className="mr-2 h-4 w-4" /> Exit Studio
              </Button>
              <Separator orientation="vertical" className="h-6" />
              <div className="space-y-0.5">
                <h3 className="text-sm font-black uppercase tracking-tight leading-none">{currentTemplate?.name}</h3>
                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">{currentTemplate?.documentType} • {currentTemplate?.paperWidth}x{currentTemplate?.paperHeight}mm</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => window.print()} className="font-bold"><Printer className="h-4 w-4 mr-2" /> Quick Print</Button>
              <Button onClick={handleSaveTemplate} disabled={isSaving} className="font-black h-10 px-8 bg-primary shadow-lg">
                {isSaving ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Save Template
              </Button>
            </div>
          </div>

          <div className="flex-1 flex overflow-hidden">
            {/* LEFT PANEL - ELEMENTS */}
            <div className="w-72 border-r flex flex-col overflow-y-auto bg-slate-50 industrial-scroll shrink-0">
              <div className="p-6 space-y-10">
                <div className="space-y-4">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-primary">Geometric & Media</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <ElementTool icon={Type} label="Plain Text" onClick={() => addElement('text')} />
                    <ElementTool icon={Type} label="Headline" onClick={() => addElement('title')} />
                    <ElementTool icon={ImageIcon} label="Logo/Image" onClick={() => addElement('image')} />
                    <ElementTool icon={CircleIcon} label="Circle/Oval" onClick={() => addElement('circle')} />
                    <ElementTool icon={LayoutGrid} label="Box/Rect" onClick={() => addElement('rectangle')} />
                    <ElementTool icon={Split} label="Divider" onClick={() => addElement('line')} />
                    <ElementTool icon={Hash} label="Barcode" onClick={() => addElement('barcode')} />
                    <ElementTool icon={QrCode} label="QR Code" onClick={() => addElement('qr')} />
                  </div>
                </div>

                <div className="space-y-4">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-primary">ERP Data Fields</Label>
                  <div className="space-y-1 bg-white rounded-xl p-2 border shadow-inner">
                    {CRM_PLACEHOLDERS.map(p => (
                      <button 
                        key={p.key}
                        onClick={() => addElement('field', p.key)}
                        className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-primary/10 transition-all border border-transparent hover:border-primary/20 text-left group"
                      >
                        <p.icon className="h-3.5 w-3.5 text-slate-400 group-hover:text-primary transition-colors" />
                        <span className="text-[11px] font-bold uppercase truncate text-slate-600 group-hover:text-primary">{p.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* CENTER CANVAS */}
            <div className="flex-1 bg-slate-200 overflow-auto flex items-start justify-center p-20 relative industrial-scroll">
              {/* Rulers */}
              <div className="absolute top-0 left-0 right-0 h-8 bg-white border-b flex items-end px-20 z-10">
                {Array.from({ length: 20 }).map((_, i) => (
                  <div key={i} className="flex-1 border-l border-slate-300 h-2 text-[8px] text-slate-400 pl-1">{i * 50}</div>
                ))}
              </div>
              <div className="absolute top-0 left-0 bottom-0 w-8 bg-white border-r flex flex-col py-20 z-10">
                {Array.from({ length: 20 }).map((_, i) => (
                  <div key={i} className="flex-1 border-t border-slate-300 w-2 text-[8px] text-slate-400 pt-1 pl-1 rotate-90 origin-left">{i * 50}</div>
                ))}
              </div>

              <div 
                className="bg-white shadow-[0_30px_60px_rgba(0,0,0,0.2)] relative border border-slate-300 transition-all duration-300"
                style={{ 
                  width: `${(currentTemplate?.paperWidth || 100) * MM_TO_PX}px`, 
                  height: `${(currentTemplate?.paperHeight || 100) * MM_TO_PX}px`,
                  transform: `scale(${zoom})`,
                  transformOrigin: 'top center'
                }}
                onMouseDown={() => setSelectedElementId(null)}
              >
                {/* Visual Guidelines / Grid */}
                {showGuidelines && (
                  <div 
                    className="absolute inset-0 opacity-[0.08] pointer-events-none" 
                    style={{ 
                      backgroundImage: 'linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)', 
                      backgroundSize: '20px 20px' 
                    }} 
                  />
                )}

                {currentTemplate?.elements.map(el => (
                  <CanvasElement 
                    key={el.id} 
                    element={el} 
                    isSelected={selectedElementId === el.id} 
                    onSelect={(e) => { 
                      e.stopPropagation(); 
                      setSelectedElementId(el.id); 
                    }}
                    onMove={(x, y) => updateElement(el.id, { x, y })}
                    onResize={(width, height) => updateElement(el.id, { width, height })}
                    gridSnap={gridSnap}
                  />
                ))}
              </div>

              {/* Canvas Controls */}
              <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white p-2.5 rounded-2xl flex items-center gap-4 shadow-2xl border border-white/10 z-50">
                <div className="flex items-center gap-2 px-2">
                  <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-white/10" onClick={() => setZoom(z => Math.max(0.2, z - 0.1))}>-</Button>
                  <span className="text-[10px] font-black min-w-[45px] text-center">{Math.round(zoom * 100)}%</span>
                  <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-white/10" onClick={() => setZoom(z => Math.min(3, z + 0.1))}>+</Button>
                </div>
                <Separator orientation="vertical" className="h-6 bg-white/20" />
                <div className="flex items-center gap-2">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className={cn("h-8 w-8", showGuidelines ? "text-primary" : "text-white/40")}
                    onClick={() => setShowGuidelines(!showGuidelines)}
                  >
                    <Grid3X3 className="h-4 w-4" />
                  </Button>
                </div>
                <Separator orientation="vertical" className="h-6 bg-white/20" />
                <div className="flex items-center gap-2 pr-2">
                  <span className="text-[9px] font-black uppercase opacity-50">Snap:</span>
                  <Select value={gridSnap.toString()} onValueChange={v => setGridSnap(Number(v))}>
                    <SelectTrigger className="h-8 bg-white/5 border-none text-[10px] font-black w-16 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="z-[100]">
                      <SelectItem value="1">Off</SelectItem>
                      <SelectItem value="5">5px</SelectItem>
                      <SelectItem value="10">10px</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* RIGHT PANEL - SETTINGS */}
            <div className="w-80 border-l flex flex-col bg-white overflow-y-auto industrial-scroll shrink-0">
              {selectedElement ? (
                <div className="p-6 space-y-8 animate-in slide-in-from-right-4 duration-300">
                  <div className="flex justify-between items-center bg-slate-50 -m-6 p-6 mb-4 border-b">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                      <Settings2 className="h-4 w-4" /> Element Configuration
                    </h4>
                    <Button variant="ghost" size="icon" className="text-destructive h-8 w-8 hover:bg-destructive/10" onClick={() => deleteElement(selectedElement.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* GEOMETRY SECTION */}
                  <div className="space-y-6">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block border-b pb-2">Layout & Transformation</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-[9px] uppercase font-bold text-slate-500">X Position</Label>
                        <Input type="number" value={selectedElement.x} onChange={e => updateElement(selectedElement.id, { x: Number(e.target.value) })} className="h-9 text-xs font-black rounded-lg" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[9px] uppercase font-bold text-slate-500">Y Position</Label>
                        <Input type="number" value={selectedElement.y} onChange={e => updateElement(selectedElement.id, { y: Number(e.target.value) })} className="h-9 text-xs font-black rounded-lg" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[9px] uppercase font-bold text-slate-500">Width (PX)</Label>
                        <Input type="number" value={selectedElement.width} onChange={e => updateElement(selectedElement.id, { width: Number(e.target.value) })} className="h-9 text-xs font-black rounded-lg" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[9px] uppercase font-bold text-slate-500">Height (PX)</Label>
                        <Input type="number" value={selectedElement.height} onChange={e => updateElement(selectedElement.id, { height: Number(e.target.value) })} className="h-9 text-xs font-black rounded-lg" />
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <Label className="text-[9px] uppercase font-bold text-slate-500">Rotation (Deg)</Label>
                        <span className="text-[10px] font-black font-mono">{selectedElement.rotate}°</span>
                      </div>
                      <Slider value={[selectedElement.rotate]} min={0} max={360} step={1} onValueChange={(v) => updateElement(selectedElement.id, { rotate: v[0] })} />
                    </div>
                  </div>

                  {/* TYPOGRAPHY SECTION */}
                  {(['text', 'title', 'field'].includes(selectedElement.type)) && (
                    <div className="space-y-6 animate-in fade-in">
                      <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block border-b pb-2">Typography & Style</Label>
                      {selectedElement.type !== 'field' && (
                        <div className="space-y-1.5">
                          <Label className="text-[9px] uppercase font-bold text-slate-500">Static Content</Label>
                          <Input value={selectedElement.content} onChange={e => updateElement(selectedElement.id, { content: e.target.value })} className="h-10 text-xs font-bold rounded-lg" />
                        </div>
                      )}
                      <div className="space-y-1.5">
                        <Label className="text-[9px] uppercase font-bold text-slate-500">Font Family</Label>
                        <Select value={selectedElement.style.fontFamily} onValueChange={v => updateElementStyle(selectedElement.id, { fontFamily: v })}>
                          <SelectTrigger className="h-10 text-xs font-black rounded-lg"><SelectValue /></SelectTrigger>
                          <SelectContent className="z-[100]">
                            {FONT_FAMILIES.map(f => <SelectItem key={f.id} value={f.id} style={{ fontFamily: f.value }}>{f.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-[9px] uppercase font-bold text-slate-500">Font Size</Label>
                          <Input type="number" value={selectedElement.style.fontSize} onChange={e => updateElementStyle(selectedElement.id, { fontSize: Number(e.target.value) })} className="h-9 text-xs font-black rounded-lg" />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[9px] uppercase font-bold text-slate-500">Weight</Label>
                          <Select value={selectedElement.style.fontWeight} onValueChange={v => updateElementStyle(selectedElement.id, { fontWeight: v })}>
                            <SelectTrigger className="h-9 text-xs font-black rounded-lg"><SelectValue /></SelectTrigger>
                            <SelectContent className="z-[100]">
                              <SelectItem value="normal">Normal</SelectItem>
                              <SelectItem value="bold">Bold</SelectItem>
                              <SelectItem value="black">Heavy</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[9px] uppercase font-bold text-slate-500">Text Alignment</Label>
                        <div className="flex gap-1 bg-slate-50 p-1 rounded-lg border">
                          <Button variant={selectedElement.style.textAlign === 'left' ? 'secondary' : 'ghost'} size="sm" className="flex-1 h-8" onClick={() => updateElementStyle(selectedElement.id, { textAlign: 'left' })}><AlignLeft className="h-4 w-4" /></Button>
                          <Button variant={selectedElement.style.textAlign === 'center' ? 'secondary' : 'ghost'} size="sm" className="flex-1 h-8" onClick={() => updateElementStyle(selectedElement.id, { textAlign: 'center' })}><AlignCenter className="h-4 w-4" /></Button>
                          <Button variant={selectedElement.style.textAlign === 'right' ? 'secondary' : 'ghost'} size="sm" className="flex-1 h-8" onClick={() => updateElementStyle(selectedElement.id, { textAlign: 'right' })}><AlignRight className="h-4 w-4" /></Button>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[9px] uppercase font-bold text-slate-500">Color</Label>
                        <div className="flex gap-2">
                          <Input type="color" value={selectedElement.style.color} onChange={e => updateElementStyle(selectedElement.id, { color: e.target.value })} className="h-10 w-12 p-1 rounded-lg" />
                          <Input type="text" value={selectedElement.style.color} onChange={e => updateElementStyle(selectedElement.id, { color: e.target.value })} className="h-10 flex-1 text-xs font-mono font-bold rounded-lg uppercase" />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* MEDIA SECTION */}
                  {selectedElement.type === 'image' && (
                    <div className="space-y-6 animate-in fade-in">
                      <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block border-b pb-2">Image Source</Label>
                      <div className="space-y-4">
                        <div className="p-10 border-2 border-dashed rounded-xl text-center bg-slate-50 hover:bg-slate-100 transition-colors relative group">
                          <Upload className="h-8 w-8 mx-auto text-slate-300 group-hover:text-primary transition-colors" />
                          <p className="text-[10px] font-bold uppercase text-slate-400 mt-2">Upload Component</p>
                          <Input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleImageUpload} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[9px] uppercase font-bold text-slate-500">External URL</Label>
                          <Input value={selectedElement.content?.startsWith('data:') ? 'Local Image' : selectedElement.content} onChange={e => updateElement(selectedElement.id, { content: e.target.value })} className="h-9 text-xs font-medium" />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* CODE SECTION */}
                  {(['barcode', 'qr'].includes(selectedElement.type)) && (
                    <div className="space-y-6 animate-in fade-in">
                      <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block border-b pb-2">Dynamic Mapping</Label>
                      <div className="space-y-1.5">
                        <Label className="text-[9px] uppercase font-bold text-slate-500">Source ERP Field</Label>
                        <Select value={selectedElement.placeholder} onValueChange={v => updateElement(selectedElement.id, { placeholder: v })}>
                          <SelectTrigger className="h-10 text-xs font-black rounded-lg"><SelectValue /></SelectTrigger>
                          <SelectContent className="z-[100]">
                            {CRM_PLACEHOLDERS.map(p => <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-20 text-center text-muted-foreground flex flex-col items-center gap-6">
                  <div className="h-16 w-16 bg-slate-50 rounded-full flex items-center justify-center border-2 border-dashed border-slate-200">
                    <MousePointer2 className="h-6 w-6 opacity-20" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-widest">Workspace Idle</p>
                    <p className="text-[9px] font-medium opacity-50">Select an element on the canvas to configure properties.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* NEW TEMPLATE DIALOG */}
      <Dialog open={isNewDialogOpen} onOpenChange={setIsNewDialogOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-3xl border-none shadow-2xl">
          <form onSubmit={handleCreateTemplate}>
            <DialogHeader>
              <DialogTitle className="text-xl font-black uppercase flex items-center gap-2">
                <Plus className="h-5 w-5 text-primary" /> Initialize Design
              </DialogTitle>
              <DialogDescription className="font-medium text-xs">Define document category and physical paper dimensions.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-6 py-6 text-left">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-[10px] font-black uppercase opacity-50">Template Friendly Name</Label>
                <Input id="name" name="name" placeholder="e.g. Standard Invoice v2" required className="h-11 rounded-xl border-2 font-bold" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="documentType" className="text-[10px] font-black uppercase opacity-50">Document Type</Label>
                <Select name="documentType" required>
                  <SelectTrigger className="h-11 rounded-xl border-2 font-bold"><SelectValue placeholder="Select Category" /></SelectTrigger>
                  <SelectContent className="z-[100]">
                    <SelectItem value="Invoice" className="font-bold">Tax Invoice</SelectItem>
                    <SelectItem value="Label" className="font-bold">Thermal Roll Label</SelectItem>
                    <SelectItem value="Challan" className="font-bold">Delivery Challan</SelectItem>
                    <SelectItem value="PO" className="font-bold">Purchase Order</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="paperSize" className="text-[10px] font-black uppercase opacity-50">Paper Standard</Label>
                <Select name="paperSize" defaultValue="A4">
                  <SelectTrigger className="h-11 rounded-xl border-2 font-bold"><SelectValue /></SelectTrigger>
                  <SelectContent className="z-[100]">
                    {PAPER_SIZES.map(s => <SelectItem key={s.id} value={s.id} className="font-bold">{s.name} ({s.w}x{s.h}mm)</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" className="w-full h-14 font-black uppercase tracking-widest rounded-2xl shadow-xl">Start Design Session</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ElementTool({ icon: Icon, label, onClick }: { icon: any, label: string, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-2 p-4 bg-white border-2 border-slate-100 rounded-xl hover:border-primary/40 hover:bg-primary/5 transition-all group active:scale-95 shadow-sm"
    >
      <Icon className="h-5 w-5 text-slate-400 group-hover:text-primary transition-colors" />
      <span className="text-[9px] font-black uppercase text-slate-500 group-hover:text-primary tracking-tighter">{label}</span>
    </button>
  )
}

function CanvasElement({ element, isSelected, onSelect, onMove, onResize, gridSnap }: { 
  element: TemplateElement, 
  isSelected: boolean, 
  onSelect: (e: any) => void,
  onMove: (x: number, y: number) => void,
  onResize: (w: number, h: number) => void,
  gridSnap: number
}) {
  const isDragging = useRef(false)
  const isResizing = useRef(false)
  const startPos = useRef({ x: 0, y: 0, w: 0, h: 0 })

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation()
    onSelect(e)
    isDragging.current = true
    startPos.current = { x: e.clientX - element.x, y: e.clientY - element.y, w: 0, h: 0 }
    
    const move = (moveEvent: MouseEvent) => {
      if (isDragging.current) {
        const nx = moveEvent.clientX - startPos.current.x
        const ny = moveEvent.clientY - startPos.current.y
        onMove(Math.round(nx / gridSnap) * gridSnap, Math.round(ny / gridSnap) * gridSnap)
      }
    }
    const up = () => {
      isDragging.current = false
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  const handleResizeStart = (e: React.MouseEvent) => {
    e.stopPropagation()
    isResizing.current = true
    startPos.current = { x: e.clientX, y: e.clientY, w: element.width, h: element.height }

    const move = (moveEvent: MouseEvent) => {
      if (isResizing.current) {
        const dw = moveEvent.clientX - startPos.current.x
        const dh = moveEvent.clientY - startPos.current.y
        onResize(
          Math.max(10, Math.round((startPos.current.w + dw) / gridSnap) * gridSnap),
          Math.max(10, Math.round((startPos.current.h + dh) / gridSnap) * gridSnap)
        )
      }
    }
    const up = () => {
      isResizing.current = false
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  const getFontFamilyValue = (id: string) => FONT_FAMILIES.find(f => f.id === id)?.value || 'sans-serif';

  const renderContent = () => {
    switch (element.type) {
      case 'text': 
      case 'title':
        return <span style={{ textAlign: element.style.textAlign }}>{element.content}</span>;
      case 'field': 
        return <span className="text-primary bg-primary/5 rounded px-1 border border-primary/20 italic">{element.placeholder}</span>;
      case 'barcode': 
        return (
          <div className="pointer-events-none origin-left flex items-center justify-center w-full h-full" style={{ transform: `scale(${Math.min(1, element.width / 150)})` }}>
            <Barcode value="SAMPLE123" height={element.height - 20} width={1.5} fontSize={10} />
          </div>
        );
      case 'qr': 
        return <div className="pointer-events-none flex items-center justify-center w-full h-full"><QRCodeSVG value="SAMPLE" size={Math.min(element.width, element.height)} /></div>;
      case 'rectangle': 
        return <div className="w-full h-full border-2 border-black" />;
      case 'circle': 
        return <div className="w-full h-full border-2 border-black rounded-full" />;
      case 'line': 
        return <div className="w-full h-[2px] bg-black" />;
      case 'image':
        return element.content ? (
          <img src={element.content} alt="User element" className="w-full h-full object-contain pointer-events-none" />
        ) : (
          <div className="w-full h-full border-2 border-dashed border-slate-300 flex items-center justify-center text-[10px] uppercase font-bold text-slate-400">No Image</div>
        );
      default: return null;
    }
  }

  return (
    <div 
      className={cn(
        "absolute cursor-move select-none group flex transition-shadow",
        isSelected && "ring-2 ring-primary ring-offset-2 z-50 shadow-2xl",
        !isSelected && "hover:ring-1 hover:ring-primary/30"
      )}
      style={{ 
        left: `${element.x}px`, 
        top: `${element.y}px`, 
        width: `${element.width}px`, 
        height: `${element.height}px`,
        transform: `rotate(${element.rotate}deg)`,
        ...element.style,
        fontFamily: getFontFamilyValue(element.style.fontFamily),
        fontSize: `${element.style.fontSize}px`,
        justifyContent: element.style.textAlign === 'center' ? 'center' : element.style.textAlign === 'right' ? 'flex-end' : 'flex-start',
        alignItems: 'center',
      }}
      onMouseDown={handleMouseDown}
    >
      <div 
        className="w-full h-full flex items-center overflow-hidden"
        style={{
          justifyContent: element.style.textAlign === 'center' ? 'center' : element.style.textAlign === 'right' ? 'flex-end' : 'flex-start',
        }}
      >
        {renderContent()}
      </div>

      {isSelected && (
        <div 
          className="absolute bottom-[-4px] right-[-4px] w-4 h-4 bg-primary cursor-nwse-resize rounded-full border-2 border-white shadow-lg z-[60]" 
          onMouseDown={handleResizeStart} 
        />
      )}
    </div>
  )
}