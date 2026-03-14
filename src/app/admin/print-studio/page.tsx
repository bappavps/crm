
"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
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
  ChevronRight, 
  Loader2, 
  Zap,
  Undo2,
  Redo2,
  Box,
  Split,
  MousePointer2,
  CalendarDays,
  User,
  Building2,
  Layers,
  ArrowRight
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
import { collection, doc, serverTimestamp, setDoc, deleteDoc, addDoc, query, orderBy } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { QRCodeSVG } from 'qrcode.react'
import Barcode from 'react-barcode'

/**
 * PRINT TEMPLATE STUDIO (V1)
 * Advanced Drag & Drop Visual Designer for ERP Documents.
 */

type ElementType = 'text' | 'title' | 'image' | 'barcode' | 'qr' | 'line' | 'rectangle' | 'field' | 'table';

interface TemplateElement {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  content?: string;
  placeholder?: string;
  style: any;
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

const CRM_PLACEHOLDERS = [
  { key: '{{company_name}}', label: 'Company Name', icon: Building2 },
  { key: '{{invoice_no}}', label: 'Invoice Number', icon: Hash },
  { key: '{{date}}', label: 'Current Date', icon: CalendarDays },
  { key: '{{customer_name}}', label: 'Customer Name', icon: User },
  { key: '{{roll_number}}', label: 'Roll Number', icon: Box },
  { key: '{{paper_item}}', label: 'Paper Item/Type', icon: FileText },
  { key: '{{width}}', label: 'Width (MM)', icon: Maximize2 },
  { key: '{{length}}', label: 'Length (MTR)', icon: Split },
  { key: '{{gsm}}', label: 'GSM', icon: Layers },
  { key: '{{weight}}', label: 'Weight (KG)', icon: LayoutGrid },
];

const MM_TO_PX = 3.78; // Standard conversion for screen simulation

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
  const [gridSnap, setGridSnap] = useState(5)

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

  const addElement = (type: ElementType, placeholder?: string) => {
    if (!currentTemplate) return
    const id = crypto.randomUUID()
    const newEl: TemplateElement = {
      id,
      type,
      x: 20,
      y: 20,
      width: type === 'qr' ? 40 : 150,
      height: type === 'qr' ? 40 : 20,
      content: placeholder ? "" : (type === 'text' ? "Enter Text..." : ""),
      placeholder: placeholder || "",
      style: {
        fontSize: 12,
        fontWeight: 'normal',
        textAlign: 'left',
        color: '#000000',
        fontFamily: 'monospace'
      }
    }
    setCurrentTemplate({
      ...currentTemplate,
      elements: [...currentTemplate.elements, newEl]
    })
    setSelectedElementId(id)
  }

  const updateElement = (id: string, updates: Partial<TemplateElement>) => {
    if (!currentTemplate) return
    setCurrentTemplate({
      ...currentTemplate,
      elements: currentTemplate.elements.map(el => el.id === id ? { ...el, ...updates } : el)
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
            <Button onClick={() => setIsNewDialogOpen(true)} className="h-12 px-8 font-black uppercase shadow-xl">
              <Plus className="mr-2 h-5 w-5" /> New Design
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {isLoading ? (
              <div className="col-span-full py-20 text-center"><Loader2 className="animate-spin h-10 w-10 mx-auto text-primary" /></div>
            ) : templates?.map(tpl => (
              <Card key={tpl.id} className="group hover:border-primary transition-all overflow-hidden border-none shadow-lg">
                <div className="bg-slate-900 aspect-[3/4] p-4 relative flex items-center justify-center">
                  <div className="bg-white shadow-2xl w-full h-full rounded p-2 flex flex-col gap-1 overflow-hidden scale-90">
                    <div className="h-4 w-1/2 bg-slate-100 rounded" />
                    <div className="h-2 w-full bg-slate-50 rounded" />
                    <div className="h-2 w-full bg-slate-50 rounded" />
                    <div className="mt-auto flex justify-between items-end">
                      <div className="h-8 w-8 bg-slate-100 rounded" />
                      <div className="h-4 w-1/3 bg-slate-100 rounded" />
                    </div>
                  </div>
                  <div className="absolute inset-0 bg-primary/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <Button variant="secondary" size="sm" className="font-bold" onClick={() => { setCurrentTemplate(tpl); setIsEditorOpen(true); }}>
                      Edit Layout
                    </Button>
                  </div>
                </div>
                <CardHeader className="p-4 bg-white">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-sm font-black uppercase truncate">{tpl.name}</CardTitle>
                      <CardDescription className="text-[10px] uppercase font-bold tracking-widest">{tpl.documentType}</CardDescription>
                    </div>
                    {tpl.isDefault && <Badge className="bg-emerald-500 text-[8px]">DEFAULT</Badge>}
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        </>
      ) : (
        /* --- THE STUDIO EDITOR --- */
        <div className="fixed inset-0 z-50 bg-background flex flex-col">
          {/* Editor Header */}
          <div className="h-16 border-b flex items-center justify-between px-6 shrink-0 bg-white">
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => setIsEditorOpen(false)}><Undo2 className="mr-2 h-4 w-4" /> Exit Studio</Button>
              <Separator orientation="vertical" className="h-6" />
              <div>
                <h3 className="text-sm font-black uppercase tracking-tight">{currentTemplate?.name}</h3>
                <p className="text-[10px] text-muted-foreground uppercase font-bold">{currentTemplate?.documentType} • {currentTemplate?.paperWidth}x{currentTemplate?.paperHeight}mm</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="h-4 w-4 mr-2" /> Test Print</Button>
              <Button onClick={handleSaveTemplate} disabled={isSaving} className="font-black h-9 px-6 bg-primary">
                {isSaving ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Save Design
              </Button>
            </div>
          </div>

          <div className="flex-1 flex overflow-hidden">
            {/* LEFT PANEL - ELEMENTS */}
            <div className="w-72 border-r flex flex-col overflow-y-auto bg-slate-50 industrial-scroll">
              <div className="p-6 space-y-8">
                <div className="space-y-4">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-primary">Static Elements</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <ElementTool icon={Type} label="Text" onClick={() => addElement('text')} />
                    <ElementTool icon={ImageIcon} label="Image" onClick={() => addElement('image')} />
                    <ElementTool icon={Hash} label="Barcode" onClick={() => addElement('barcode')} />
                    <ElementTool icon={QrCode} label="QR Code" onClick={() => addElement('qr')} />
                    <ElementTool icon={Split} label="Line" onClick={() => addElement('line')} />
                    <ElementTool icon={LayoutGrid} label="Rect" onClick={() => addElement('rectangle')} />
                  </div>
                </div>

                <div className="space-y-4">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-primary">ERP Data Fields</Label>
                  <div className="space-y-1">
                    {CRM_PLACEHOLDERS.map(p => (
                      <button 
                        key={p.key}
                        onClick={() => addElement('field', p.key)}
                        className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-primary/10 transition-colors border border-transparent hover:border-primary/20 text-left"
                      >
                        <p.icon className="h-4 w-4 text-primary" />
                        <span className="text-[11px] font-bold uppercase truncate">{p.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* CENTER CANVAS */}
            <div className="flex-1 bg-slate-200 overflow-auto flex items-start justify-center p-20 relative">
              <div 
                className="bg-white shadow-2xl relative border border-slate-300"
                style={{ 
                  width: `${(currentTemplate?.paperWidth || 100) * MM_TO_PX}px`, 
                  height: `${(currentTemplate?.paperHeight || 100) * MM_TO_PX}px`,
                  transform: `scale(${zoom})`,
                  transformOrigin: 'top center'
                }}
                onClick={() => setSelectedElementId(null)}
              >
                {/* Grid Overlay */}
                <div 
                  className="absolute inset-0 opacity-5 pointer-events-none" 
                  style={{ 
                    backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', 
                    backgroundSize: '10px 10px' 
                  }} 
                />

                {currentTemplate?.elements.map(el => (
                  <CanvasElement 
                    key={el.id} 
                    element={el} 
                    isSelected={selectedElementId === el.id} 
                    onSelect={(e) => { e.stopPropagation(); setSelectedElementId(el.id); }}
                    onMove={(x, y) => updateElement(el.id, { x, y })}
                    onResize={(width, height) => updateElement(el.id, { width, height })}
                    gridSnap={gridSnap}
                  />
                ))}
              </div>

              {/* Canvas Controls */}
              <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white p-2 rounded-2xl flex items-center gap-4 shadow-2xl border border-white/10">
                <div className="flex items-center gap-2 px-2">
                  <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-white/10" onClick={() => setZoom(z => Math.max(0.2, z - 0.1))}>-</Button>
                  <span className="text-xs font-black min-w-[40px] text-center">{Math.round(zoom * 100)}%</span>
                  <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-white/10" onClick={() => setZoom(z => Math.min(3, z + 0.1))}>+</Button>
                </div>
                <Separator orientation="vertical" className="h-6 bg-white/20" />
                <div className="flex items-center gap-2 pr-2">
                  <span className="text-[10px] font-black uppercase opacity-50">Snap:</span>
                  <Select value={gridSnap.toString()} onValueChange={v => setGridSnap(Number(v))}>
                    <SelectTrigger className="h-8 bg-white/5 border-none text-[10px] font-black w-16">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1px</SelectItem>
                      <SelectItem value="5">5px</SelectItem>
                      <SelectItem value="10">10px</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* RIGHT PANEL - SETTINGS */}
            <div className="w-80 border-l flex flex-col bg-white overflow-y-auto industrial-scroll">
              {selectedElement ? (
                <div className="p-6 space-y-8 animate-in slide-in-from-right-4">
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2">
                      <Settings2 className="h-4 w-4" /> Element Settings
                    </h4>
                    <Button variant="ghost" size="icon" className="text-destructive h-8 w-8" onClick={() => deleteElement(selectedElement.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="space-y-4">
                    <Label className="text-[10px] font-bold uppercase opacity-50">Position & Size</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label className="text-[9px] uppercase font-bold">X Pos</Label>
                        <Input type="number" value={selectedElement.x} onChange={e => updateElement(selectedElement.id, { x: Number(e.target.value) })} className="h-8 text-xs font-bold" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[9px] uppercase font-bold">Y Pos</Label>
                        <Input type="number" value={selectedElement.y} onChange={e => updateElement(selectedElement.id, { y: Number(e.target.value) })} className="h-8 text-xs font-bold" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[9px] uppercase font-bold">Width</Label>
                        <Input type="number" value={selectedElement.width} onChange={e => updateElement(selectedElement.id, { width: Number(e.target.value) })} className="h-8 text-xs font-bold" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[9px] uppercase font-bold">Height</Label>
                        <Input type="number" value={selectedElement.height} onChange={e => updateElement(selectedElement.id, { height: Number(e.target.value) })} className="h-8 text-xs font-bold" />
                      </div>
                    </div>
                  </div>

                  {/* Context Specific Settings */}
                  {(selectedElement.type === 'text' || selectedElement.type === 'field') && (
                    <div className="space-y-4">
                      <Label className="text-[10px] font-bold uppercase opacity-50">Typography</Label>
                      {selectedElement.type === 'text' && (
                        <div className="space-y-1">
                          <Label className="text-[9px] uppercase font-bold">Content</Label>
                          <Input value={selectedElement.content} onChange={e => updateElement(selectedElement.id, { content: e.target.value })} className="text-xs font-bold" />
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <Label className="text-[9px] uppercase font-bold">Font Size</Label>
                          <Input type="number" value={selectedElement.style.fontSize} onChange={e => updateElement(selectedElement.id, { style: { ...selectedElement.style, fontSize: Number(e.target.value) } })} className="h-8 text-xs font-bold" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[9px] uppercase font-bold">Font Family</Label>
                          <Select value={selectedElement.style.fontFamily} onValueChange={v => updateElement(selectedElement.id, { style: { ...selectedElement.style, fontFamily: v } })}>
                            <SelectTrigger className="h-8 text-[10px] font-bold"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="monospace">Mono</SelectItem>
                              <SelectItem value="sans-serif">Sans</SelectItem>
                              <SelectItem value="serif">Serif</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedElement.type === 'barcode' && (
                    <div className="space-y-4">
                      <Label className="text-[10px] font-bold uppercase opacity-50">Barcode Mapping</Label>
                      <div className="space-y-1">
                        <Label className="text-[9px] uppercase font-bold">Source Placeholder</Label>
                        <Select value={selectedElement.placeholder} onValueChange={v => updateElement(selectedElement.id, { placeholder: v })}>
                          <SelectTrigger className="h-8 text-[10px] font-bold"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {CRM_PLACEHOLDERS.map(p => <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-20 text-center text-muted-foreground flex flex-col items-center gap-4">
                  <MousePointer2 className="h-10 w-10 opacity-10" />
                  <p className="text-[10px] font-bold uppercase tracking-widest">Select element to configure</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* NEW TEMPLATE DIALOG */}
      <Dialog open={isNewDialogOpen} onOpenChange={setIsNewDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleCreateTemplate}>
            <DialogHeader>
              <DialogTitle className="text-xl font-black uppercase">Initialize Design</DialogTitle>
              <DialogDescription>Define document category and physical paper dimensions.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Template Friendly Name</Label>
                <Input id="name" name="name" placeholder="e.g. Standard Invoice v2" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="documentType">Document Type</Label>
                <Select name="documentType" required>
                  <SelectTrigger><SelectValue placeholder="Select Category" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Invoice">Tax Invoice</SelectItem>
                    <SelectItem value="Label">Thermal Roll Label</SelectItem>
                    <SelectItem value="Challan">Delivery Challan</SelectItem>
                    <SelectItem value="PO">Purchase Order</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="paperSize">Paper Standard</Label>
                <Select name="paperSize" defaultValue="A4">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAPER_SIZES.map(s => <SelectItem key={s.id} value={s.id}>{s.name} ({s.w}x{s.h}mm)</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" className="w-full h-12 font-black uppercase">Open Studio Editor</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <style jsx global>{`
        @media print {
          .studio-ui { display: none !important; }
          body { background: white; margin: 0; padding: 0; }
        }
      `}</style>
    </div>
  )
}

function ElementTool({ icon: Icon, label, onClick }: { icon: any, label: string, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-2 p-4 bg-white border-2 border-slate-100 rounded-xl hover:border-primary/40 hover:bg-primary/5 transition-all group"
    >
      <Icon className="h-5 w-5 text-slate-400 group-hover:text-primary transition-colors" />
      <span className="text-[10px] font-black uppercase text-slate-500 group-hover:text-primary">{label}</span>
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
  const startPos = useRef({ x: 0, y: 0 })

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    onSelect(e)
    isDragging.current = true
    startPos.current = { x: e.clientX - element.x, y: e.clientY - element.y }
    
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

  const renderContent = () => {
    switch (element.type) {
      case 'text': return <span>{element.content}</span>;
      case 'field': return <span className="text-primary bg-primary/5 rounded px-1 border border-primary/20 italic">{element.placeholder}</span>;
      case 'barcode': return <div className="pointer-events-none scale-[0.8] origin-left"><Barcode value="SAMPLE123" height={element.height - 20} width={1.5} fontSize={10} /></div>;
      case 'qr': return <div className="pointer-events-none"><QRCodeSVG value="SAMPLE" size={element.width} /></div>;
      case 'rectangle': return <div className="w-full h-full border-2 border-black" />;
      case 'line': return <div className="w-full h-[2px] bg-black" />;
      default: return null;
    }
  }

  return (
    <div 
      className={cn(
        "absolute cursor-move select-none group",
        isSelected && "ring-2 ring-primary ring-offset-2 z-50",
        !isSelected && "hover:ring-1 hover:ring-primary/30"
      )}
      style={{ 
        left: `${element.x}px`, 
        top: `${element.y}px`, 
        width: `${element.width}px`, 
        height: `${element.height}px`,
        ...element.style,
        fontSize: `${element.style.fontSize}px`
      }}
      onMouseDown={handleMouseDown}
    >
      <div className="w-full h-full flex items-center overflow-hidden">
        {renderContent()}
      </div>

      {isSelected && (
        <div 
          className="absolute bottom-0 right-0 w-3 h-3 bg-primary cursor-nwse-resize" 
          onMouseDown={handleResizeStart} 
        />
      )}
    </div>
  )
}
