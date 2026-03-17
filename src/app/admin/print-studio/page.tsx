
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
  AlignJustify,
  RotateCw,
  Circle as CircleIcon,
  Upload,
  Grid3X3,
  Eraser,
  RefreshCw,
  Paintbrush,
  Lock,
  Wallpaper,
  MousePointerSquareDashed,
  Table as TableIcon,
  ChevronRight,
  ShieldCheck,
  Eye,
  Wrench,
  ArrowRightLeft,
  CornerUpLeft,
  ChevronUp,
  ChevronDown
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
import { ActionModal, ModalType } from "@/components/action-modal"

/**
 * PRINT TEMPLATE STUDIO (V8.0)
 * Industrial Designer with Layer Management, Rotation, and Custom Paper Sizes.
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
  barcodeType?: 'CODE128' | 'CODE39' | 'EAN13' | 'UPC';
  style: {
    fontSize: number;
    fontWeight: string;
    fontFamily: string;
    textAlign: 'left' | 'center' | 'right' | 'justify';
    color: string;
    backgroundColor?: string;
    borderWidth?: number;
    borderColor?: string;
    borderRadius?: number;
    opacity?: number;
    lineStyle?: 'solid' | 'dashed';
  };
}

interface BackgroundConfig {
  image: string;
  opacity: number;
  mode: 'fit' | 'stretch' | 'center';
  locked: boolean;
}

interface PrintTemplate {
  id: string;
  name: string;
  documentType: 'Tax Invoice' | 'Technical Job Card' | 'Industrial Label' | 'Delivery Challan' | 'Purchase Order' | 'Proforma' | 'Report';
  paperWidth: number; 
  paperHeight: number; 
  elements: TemplateElement[];
  isDefault: boolean;
  isSystemTemplate?: boolean;
  background?: BackgroundConfig;
}

const PAPER_SIZES = [
  { id: 'A4', name: 'A4 Paper', w: 210, h: 297 },
  { id: 'A5', name: 'A5 Paper', w: 148, h: 210 },
  { id: 'Thermal80', name: 'Thermal 80mm', w: 80, h: 200 },
  { id: 'Label150x100', name: 'Label 150x100mm', w: 150, h: 100 },
  { id: 'Label100x50', name: 'Label 100x50mm', w: 100, h: 50 },
  { id: 'Custom', name: 'Custom Label Size', w: 100, h: 100 },
];

const FONT_FAMILIES = [
  { id: 'inter', name: 'Inter (Sans)', value: 'var(--font-inter), sans-serif' },
  { id: 'roboto', name: 'Roboto', value: "'Roboto', sans-serif" },
  { id: 'montserrat', name: 'Montserrat', value: "'Montserrat', sans-serif" },
  { id: 'poppins', name: 'Poppins', value: "'Poppins', sans-serif" },
  { id: 'oswald', name: 'Oswald', value: "'Oswald', sans-serif" },
  { id: 'open-sans', name: 'Open Sans', value: "'Open Sans', sans-serif" },
  { id: 'arial', name: 'Arial', value: "Arial, sans-serif" },
  { id: 'helvetica', name: 'Helvetica', value: "Helvetica, sans-serif" },
  { id: 'mono', name: 'Monospace', value: "ui-monospace, SFMono-Regular, monospace" },
];

const PLACEHOLDERS = {
  GENERAL: [
    { key: '{{company_name}}', label: 'Company Name', icon: Building2, preview: 'Shree Label Creation' },
    { key: '{{date}}', label: 'Current Date', icon: CalendarDays, preview: new Date().toLocaleDateString() },
  ],
  PRODUCTION: [
    { key: '{{job_card_id}}', label: 'Job Card ID', icon: Hash, preview: 'JJC-T1001-001' },
    { key: '{{machine_name}}', label: 'Machine Name', icon: Wrench, preview: 'Jumbo Slitter A1' },
    { key: '{{operator_name}}', label: 'Operator', icon: User, preview: 'Rahul Sharma' },
    { key: '{{job_qr_code}}', label: 'Job QR Identity', icon: QrCode, preview: 'QR_DATA' },
  ],
  PARENT_ROLL: [
    { key: '{{parent_roll}}', label: 'Parent Roll No', icon: Box, preview: 'T-1001' },
    { key: '{{parent_width}}', label: 'Parent Width', icon: Maximize2, preview: '1020' },
    { key: '{{paper_type}}', label: 'Paper Type', icon: FileText, preview: 'Chromo' },
  ],
  INVENTORY: [
    { key: '{{roll_no}}', label: 'Roll Number', icon: Box, preview: 'T-1038-A' },
    { key: '{{width}}', label: 'Width (MM)', icon: Maximize2, preview: '1020' },
    { key: '{{gsm}}', label: 'GSM', icon: Layers, preview: '80' },
  ]
};

const MM_TO_PX = 3.78; 

export default function PrintTemplateStudio() {
  const { toast } = useToast()
  const { user } = useUser()
  const firestore = useFirestore()
  const [isMounted, setIsMounted] = useState(false)
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [isNewDialogOpen, setIsNewDialogOpen] = useState(false)
  
  const [currentTemplate, setCurrentTemplate] = useState<PrintTemplate | null>(null)
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [isSaving, setIsSaving] = useState(false)
  const [isSeeding, setIsSeeding] = useState(false)
  const [gridSnap, setGridSnap] = useState(5)
  const [showGuidelines, setShowGuidelines] = useState(true)
  const [activeCategory, setActiveCategory] = useState<string>("All")

  // Modal State for app-styled popups
  const [modal, setModal] = useState<{
    isOpen: boolean;
    type: ModalType;
    title: string;
    description?: string;
    onConfirm?: () => void;
  }>({ isOpen: false, type: 'SUCCESS', title: '' });

  useEffect(() => { 
    setIsMounted(true);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedElementId && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName || "")) {
          deleteElement(selectedElementId);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedElementId]);

  const templatesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'print_templates'), orderBy('documentType'));
  }, [firestore]);
  const { data: templates, isLoading } = useCollection(templatesQuery);

  const filteredTemplates = useMemo(() => {
    if (!templates) return [];
    if (activeCategory === "All") return templates;
    return templates.filter(t => {
      if (activeCategory === "Job Cards") return t.documentType === 'Technical Job Card';
      if (activeCategory === "Labels") return t.documentType === 'Industrial Label';
      if (activeCategory === "Reports") return t.documentType === 'Report';
      if (activeCategory === "Billing") return ['Tax Invoice', 'Proforma', 'Delivery Challan'].includes(t.documentType);
      return true;
    });
  }, [templates, activeCategory]);

  const selectedElement = useMemo(() => 
    currentTemplate?.elements.find(el => el.id === selectedElementId)
  , [currentTemplate, selectedElementId]);

  const handleCreateTemplate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!firestore) return
    
    const formData = new FormData(e.currentTarget)
    const name = formData.get("name") as string
    const type = formData.get("documentType") as any
    const sizeId = formData.get("paperSize") as string
    const customWidth = Number(formData.get("customWidth"))
    const customHeight = Number(formData.get("customHeight"))
    
    let w, h;
    if (sizeId === 'Custom') {
      w = customWidth || 100;
      h = customHeight || 100;
    } else {
      const size = PAPER_SIZES.find(s => s.id === sizeId) || PAPER_SIZES[0]
      w = size.w;
      h = size.h;
    }

    const newTemplate: PrintTemplate = {
      id: crypto.randomUUID(),
      name,
      documentType: type,
      paperWidth: w,
      paperHeight: h,
      elements: [],
      isDefault: false,
      background: {
        image: "",
        opacity: 1,
        mode: 'fit',
        locked: true
      }
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
      toast({ title: "Template Created", description: "Design canvas initialized." })
    } catch (e) {
      toast({ variant: "destructive", title: "Creation Failed" })
    }
  }

  const handleDeleteTemplate = (templateId: string) => {
    const tpl = templates?.find(t => t.id === templateId);
    if (tpl?.isSystemTemplate) {
      toast({ variant: "destructive", title: "Access Denied", description: "System default templates are protected." });
      return;
    }

    setModal({
      isOpen: true,
      type: 'CONFIRMATION',
      title: 'Delete Template?',
      description: 'This layout will be permanently removed from the studio gallery.',
      onConfirm: async () => {
        if (!firestore) return
        try {
          await deleteDoc(doc(firestore, 'print_templates', templateId))
          toast({ title: "Template Deleted" })
          if (currentTemplate?.id === templateId) {
            setIsEditorOpen(false)
            setCurrentTemplate(null)
          }
          setModal(p => ({ ...p, isOpen: false }))
        } catch (e) {
          toast({ variant: "destructive", title: "Delete Failed" })
        }
      }
    })
  }

  const handleDuplicateTemplate = async (template: PrintTemplate) => {
    if (!firestore) return
    const newId = crypto.randomUUID()
    const newTemplate = {
      ...template,
      id: newId,
      name: `${template.name} (Copy)`,
      isDefault: false,
      isSystemTemplate: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }
    try {
      await setDoc(doc(firestore, 'print_templates', newId), newTemplate)
      toast({ title: "Template Cloned", description: "Created editable copy of layout." })
    } catch (e) {
      toast({ variant: "destructive", title: "Duplication Failed" })
    }
  }

  const handleSaveTemplate = async () => {
    if (!firestore || !currentTemplate) return
    if (currentTemplate.isSystemTemplate) {
      toast({ variant: "destructive", title: "Read Only", description: "System templates cannot be modified. Please duplicate to edit." });
      return;
    }
    setIsSaving(true)
    try {
      await setDoc(doc(firestore, 'print_templates', currentTemplate.id), {
        ...currentTemplate,
        updatedAt: serverTimestamp()
      }, { merge: true })
      toast({ title: "Template Saved", description: "Changes synced to ERP registry." })
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
    
    const samples: PrintTemplate[] = [
      {
        id: 'system-jumbo-job-card',
        name: 'Jumbo Job Card - Technical Sheet',
        documentType: 'Technical Job Card',
        paperWidth: 210,
        paperHeight: 297,
        isDefault: true,
        isSystemTemplate: true,
        elements: [
          { id: 'title', type: 'title', x: 40, y: 40, width: 600, height: 50, rotate: 0, content: 'SHREE LABEL CREATION', style: { fontSize: 32, fontWeight: 'black', fontFamily: 'inter', textAlign: 'left', color: '#000000', borderRadius: 0, opacity: 1 } },
          { id: 'subtitle', type: 'text', x: 40, y: 90, width: 400, height: 30, rotate: 0, content: 'JUMBO SLITTING INSTRUCTION SHEET', style: { fontSize: 14, fontWeight: 'bold', fontFamily: 'inter', textAlign: 'left', color: '#666666', borderRadius: 0, opacity: 1 } },
          { id: 'jobid', type: 'field', x: 550, y: 40, width: 200, height: 40, rotate: 0, placeholder: '{{job_card_id}}', style: { fontSize: 18, fontWeight: 'bold', fontFamily: 'mono', textAlign: 'right', color: '#E4892B', borderRadius: 0, opacity: 1 } },
          { id: 'line1', type: 'line', x: 40, y: 130, width: 710, height: 2, rotate: 0, style: { fontSize: 12, fontWeight: 'normal', fontFamily: 'inter', textAlign: 'left', color: '#000000', borderWidth: 2, borderColor: '#000000', opacity: 1 } },
          { id: 'table_label', type: 'text', x: 40, y: 400, width: 300, height: 30, rotate: 0, content: 'SLITTING OUTPUT PLAN (DYNAMIC)', style: { fontSize: 12, fontWeight: 'black', fontFamily: 'inter', textAlign: 'left', color: '#000000', borderRadius: 0, opacity: 1 } },
          { id: 'output_table', type: 'table', x: 40, y: 440, width: 710, height: 300, rotate: 0, placeholder: 'SLIT_ROLLS', style: { fontSize: 12, fontWeight: 'normal', fontFamily: 'inter', textAlign: 'left', color: '#000000', borderWidth: 1, borderColor: '#ccc', opacity: 1 } }
        ]
      }
    ]

    try {
      for (const s of samples) {
        batch.set(doc(firestore, 'print_templates', s.id), { ...s, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
      }
      await batch.commit()
      toast({ title: "System Sync Complete", description: "Default layouts restored." })
    } catch (e) {
      toast({ variant: "destructive", title: "Import Failed" })
    } finally {
      setIsSeeding(false)
    }
  }

  const addElement = (type: ElementType, placeholder?: string, content?: string) => {
    if (!currentTemplate) return
    const id = crypto.randomUUID()
    const newEl: TemplateElement = {
      id,
      type,
      x: 100,
      y: 100,
      width: type === 'qr' ? 80 : (type === 'barcode' ? 200 : (type === 'rectangle' || type === 'circle' ? 100 : (type === 'table' ? 600 : 150))),
      height: type === 'qr' ? 80 : (type === 'barcode' ? 60 : (type === 'rectangle' || type === 'circle' ? 100 : (type === 'table' ? 200 : 30))),
      rotate: 0,
      content: content || (placeholder ? "" : (type === 'text' || type === 'title' ? "New Element" : "")),
      placeholder: placeholder || "",
      barcodeType: type === 'barcode' ? 'CODE128' : undefined,
      style: {
        fontSize: type === 'title' ? 24 : 14,
        fontWeight: type === 'title' ? 'bold' : 'normal',
        textAlign: 'left',
        color: '#000000',
        fontFamily: 'inter',
        backgroundColor: (type === 'rectangle' || type === 'circle') ? '#ffffff' : 'transparent',
        borderWidth: (type === 'rectangle' || type === 'circle' || type === 'line' || type === 'table') ? 2 : 0,
        borderColor: '#000000',
        borderRadius: 0,
        opacity: 1,
        lineStyle: 'solid'
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
    toast({ title: "Element Removed" })
  }

  const moveElement = (direction: 'front' | 'back' | 'forward' | 'backward') => {
    if (!currentTemplate || !selectedElementId) return;
    const elements = [...currentTemplate.elements];
    const index = elements.findIndex(el => el.id === selectedElementId);
    if (index === -1) return;

    const el = elements.splice(index, 1)[0];
    if (direction === 'front') {
      elements.push(el);
    } else if (direction === 'back') {
      elements.unshift(el);
    } else if (direction === 'forward') {
      elements.splice(Math.min(elements.length, index + 1), 0, el);
    } else {
      elements.splice(Math.max(0, index - 1), 0, el);
    }

    setCurrentTemplate({ ...currentTemplate, elements });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, isBackground = false) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (evt) => {
      const base64 = evt.target?.result as string
      if (isBackground && currentTemplate) {
        setCurrentTemplate({
          ...currentTemplate,
          background: {
            ...currentTemplate.background!,
            image: base64
          }
        })
        toast({ title: "Background Layer Set" })
      } else if (selectedElement && selectedElement.type === 'image') {
        updateElement(selectedElement.id, { content: base64 })
        toast({ title: "Asset Loaded" })
      } else {
        addElement('image', undefined, base64)
      }
    }
    reader.readAsDataURL(file)
  }

  if (!isMounted) return null;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 h-full flex flex-col">
      <ActionModal {...modal} onClose={() => setModal(p => ({ ...p, isOpen: false }))} />

      {!isEditorOpen ? (
        <>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h2 className="text-3xl font-black text-primary uppercase tracking-tighter">Print Template Studio</h2>
              <p className="text-muted-foreground font-medium text-sm">Industrial document & label designer for Shree Label ERP.</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleSeedSamples} disabled={isSeeding} className="h-12 border-primary/20 hover:bg-primary/5">
                {isSeeding ? <Loader2 className="animate-spin mr-2" /> : <Sparkles className="mr-2 h-5 w-5 text-primary" />}
                Sync Default Templates
              </Button>
              <Button onClick={() => setIsNewDialogOpen(true)} className="h-12 px-8 font-black uppercase shadow-xl">
                <Plus className="mr-2 h-5 w-5" /> Create Design
              </Button>
            </div>
          </div>

          <Tabs value={activeCategory} onValueChange={setActiveCategory} className="w-full">
            <TabsList className="bg-slate-100 p-1 rounded-xl mb-6">
              {["All", "Job Cards", "Labels", "Reports", "Billing"].map(cat => (
                <TabsTrigger key={cat} value={cat} className="px-8 font-bold text-xs uppercase tracking-widest">{cat}</TabsTrigger>
              ))}
            </TabsList>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {isLoading ? (
                <div className="col-span-full py-20 text-center"><Loader2 className="animate-spin h-10 w-10 mx-auto text-primary" /></div>
              ) : filteredTemplates.map(tpl => (
                <Card key={tpl.id} className="group hover:border-primary transition-all overflow-hidden border-none shadow-lg bg-white relative">
                  {tpl.isSystemTemplate && (
                    <div className="absolute top-2 left-2 z-20">
                      <Badge className="bg-slate-900 text-white border-none text-[8px] font-black uppercase py-0.5 px-2">SYSTEM DEFAULT</Badge>
                    </div>
                  )}
                  <div className="bg-slate-100 aspect-[3/4] p-4 relative flex items-center justify-center overflow-hidden">
                    <div className="bg-white shadow-2xl w-full h-full rounded p-4 flex flex-col gap-2 overflow-hidden scale-90 opacity-80 group-hover:opacity-100 transition-all">
                      <div className="h-4 w-1/2 bg-slate-100 rounded" />
                      <div className="h-2 w-full bg-slate-50 rounded" />
                      <div className="h-2 w-full bg-slate-50 rounded" />
                      <div className="mt-auto h-10 w-full border-2 border-dashed border-slate-50 rounded flex items-center justify-center text-[8px] font-bold text-slate-200 uppercase">Layout Preview</div>
                    </div>
                    <div className="absolute inset-0 bg-primary/90 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3 p-6">
                      <Button 
                        variant="secondary" 
                        className="w-full font-black uppercase text-[10px] tracking-widest" 
                        onClick={() => { setCurrentTemplate(tpl); setIsEditorOpen(true); }}
                      >
                        {tpl.isSystemTemplate ? <><Eye className="h-3 w-3 mr-2" /> View Layout</> : <><Paintbrush className="h-3 w-3 mr-2" /> Edit Layout</>}
                      </Button>
                      <div className="flex gap-2 w-full">
                        <Button variant="outline" size="icon" className="bg-white/10 border-white/20 text-white hover:bg-white/20 flex-1" onClick={() => handleDuplicateTemplate(tpl)}>
                          <Copy className="h-4 w-4" />
                        </Button>
                        {!tpl.isSystemTemplate && (
                          <Button variant="destructive" size="icon" className="flex-1" onClick={() => handleDeleteTemplate(tpl.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                  <CardHeader className="p-4 bg-white border-t">
                    <div className="flex justify-between items-start">
                      <div className="truncate flex-1">
                        <CardTitle className="text-xs font-black uppercase truncate">{tpl.name}</CardTitle>
                        <CardDescription className="text-[9px] uppercase font-bold text-primary">{tpl.documentType}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </Tabs>
        </>
      ) : (
        /* --- THE STUDIO EDITOR --- */
        <div className="fixed inset-0 z-[100] bg-slate-100 flex flex-col font-sans print-studio-editor">
          <div className="h-16 border-b flex items-center justify-between px-6 shrink-0 bg-white shadow-sm z-[110] print:hidden">
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => setIsEditorOpen(false)} className="font-bold">
                <Undo2 className="mr-2 h-4 w-4" /> Exit Studio
              </Button>
              <Separator orientation="vertical" className="h-6" />
              <div>
                <h3 className="text-sm font-black uppercase tracking-tight leading-none">
                  {currentTemplate?.name}
                  {currentTemplate?.isSystemTemplate && <Badge variant="secondary" className="ml-2 h-4 text-[8px] border-none font-black bg-slate-100">LOCKED</Badge>}
                </h3>
                <p className="text-[10px] text-muted-foreground font-bold tracking-widest">{currentTemplate?.documentType} • {currentTemplate?.paperWidth}x{currentTemplate?.paperHeight}mm</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => window.print()} className="font-bold"><Printer className="h-4 w-4 mr-2" /> Test Print</Button>
              {!currentTemplate?.isSystemTemplate ? (
                <Button onClick={handleSaveTemplate} disabled={isSaving} className="font-black h-10 px-8 bg-primary shadow-lg">
                  {isSaving ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  Save Layout
                </Button>
              ) : (
                <Button onClick={() => handleDuplicateTemplate(currentTemplate)} className="font-black h-10 px-8 bg-slate-900 text-white shadow-lg">
                  <Copy className="h-4 w-4 mr-2" /> Duplicate to Edit
                </Button>
              )}
            </div>
          </div>

          <div className="flex-1 flex overflow-hidden industrial-container">
            {/* LEFT PANEL */}
            <div className="w-72 border-r flex flex-col overflow-y-auto bg-slate-50 shrink-0 print:hidden">
              <div className="p-6 space-y-10">
                <div className="space-y-4">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-primary">Core Components</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <ElementTool icon={Type} label="Label" onClick={() => addElement('text')} />
                    <ElementTool icon={ImageIcon} label="Asset" onClick={() => addElement('image')} />
                    <ElementTool icon={LayoutGrid} label="Shape" onClick={() => addElement('rectangle')} />
                    <ElementTool icon={Split} label="Divider" onClick={() => addElement('line')} />
                    <ElementTool icon={Hash} label="Barcode" onClick={() => addElement('barcode')} />
                    <ElementTool icon={QrCode} label="Identity" onClick={() => addElement('qr')} />
                    <ElementTool icon={TableIcon} label="Grid" onClick={() => addElement('table', 'SLIT_ROLLS')} />
                  </div>
                </div>

                <div className="space-y-4">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-primary">ERP Field Directory</Label>
                  <div className="bg-white rounded-2xl border shadow-sm divide-y overflow-hidden">
                    {Object.entries(PLACEHOLDERS).map(([group, fields]) => (
                      <div key={group} className="p-2">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-2 mb-1">{group}</p>
                        <div className="space-y-0.5">
                          {fields.map(p => (
                            <button 
                              key={p.key}
                              onClick={() => addElement('field', p.key)}
                              className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-primary/5 transition-all text-left group"
                            >
                              <p.icon className="h-3 w-3 text-slate-300 group-hover:text-primary" />
                              <span className="text-[10px] font-black uppercase truncate text-slate-600 group-hover:text-primary">{p.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-primary">Layers</Label>
                  <div className="bg-white rounded-2xl border shadow-sm divide-y overflow-hidden">
                    {currentTemplate?.elements.slice().reverse().map((el, idx) => (
                      <div 
                        key={el.id} 
                        className={cn(
                          "flex items-center gap-3 p-3 cursor-pointer hover:bg-slate-50 transition-colors",
                          selectedElementId === el.id && "bg-primary/5"
                        )}
                        onClick={() => setSelectedElementId(el.id)}
                      >
                        <div className="h-6 w-6 bg-slate-100 rounded flex items-center justify-center text-[10px] font-bold">
                          {currentTemplate.elements.length - idx}
                        </div>
                        <span className="text-[10px] font-black uppercase flex-1 truncate">{el.type} {el.placeholder || el.content?.slice(0, 10)}</span>
                        {selectedElementId === el.id && (
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveElement('forward')}><ChevronUp className="h-3 w-3" /></Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveElement('backward')}><ChevronDown className="h-3 w-3" /></Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* CENTER CANVAS */}
            <div className="flex-1 bg-slate-200 overflow-auto flex items-start justify-center p-20 relative studio-viewport print:p-0 print:bg-white print:overflow-visible" 
                 onDragOver={(e) => e.preventDefault()}>
              <div className="absolute top-0 left-0 right-0 h-8 bg-white border-b flex items-end px-20 z-10 shadow-sm print:hidden">
                {Array.from({ length: 20 }).map((_, i) => (
                  <div key={i} className="flex-1 border-l border-slate-300 h-2 text-[8px] text-slate-400 pl-1">{i * 50}</div>
                ))}
              </div>

              <div 
                id="studio-canvas-print"
                className="bg-white shadow-2xl relative border border-slate-300 overflow-hidden canvas-surface print:border-none print:shadow-none"
                style={{ 
                  width: `${(currentTemplate?.paperWidth || 100) * MM_TO_PX}px`, 
                  height: `${(currentTemplate?.paperHeight || 100) * MM_TO_PX}px`,
                  transform: `scale(${zoom})`,
                  transformOrigin: 'top center'
                }}
                onMouseDown={() => setSelectedElementId(null)}
              >
                {/* BACKGROUND LAYER */}
                {currentTemplate?.background?.image && (
                  <div className="absolute inset-0 pointer-events-none z-0" style={{ opacity: currentTemplate.background.opacity }}>
                    <img src={currentTemplate.background.image} className="w-full h-full object-contain" alt="Background" />
                  </div>
                )}

                {showGuidelines && (
                  <div className="absolute inset-0 opacity-[0.05] pointer-events-none z-[5] guidelines-grid print:hidden" 
                       style={{ backgroundImage: 'linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
                )}

                <div className="relative z-10 w-full h-full">
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
              </div>

              <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white p-2 rounded-2xl flex items-center gap-4 shadow-2xl border border-white/10 z-[150] print:hidden">
                <div className="flex items-center gap-2 px-2">
                  <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-white/10" onClick={() => setZoom(z => Math.max(0.2, z - 0.1))}>-</Button>
                  <span className="text-[10px] font-black min-w-[45px] text-center">{Math.round(zoom * 100)}%</span>
                  <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-white/10" onClick={() => setZoom(z => Math.min(3, z + 0.1))}>+</Button>
                </div>
                <Separator orientation="vertical" className="h-6 bg-white/20" />
                <Button variant="ghost" size="icon" className={cn("h-8 w-8", showGuidelines ? "text-primary" : "text-white/40")} onClick={() => setShowGuidelines(!showGuidelines)}><Grid3X3 className="h-4 w-4" /></Button>
              </div>
            </div>

            {/* RIGHT PANEL */}
            <div className="w-80 border-l flex flex-col bg-white overflow-y-auto shrink-0 industrial-scroll print:hidden">
              {selectedElement ? (
                <div className="p-6 space-y-8 animate-in slide-in-from-right-4 duration-300">
                  <div className="flex justify-between items-center bg-slate-50 -m-6 p-6 mb-4 border-b">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                      <Settings2 className="h-4 w-4" /> Properties
                    </h4>
                    {!currentTemplate?.isSystemTemplate && (
                      <Button variant="ghost" size="icon" className="text-destructive h-8 w-8 hover:bg-destructive/10" onClick={() => deleteElement(selectedElement.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  <div className="space-y-6">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block border-b pb-2">Dimension</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5"><Label className="text-[9px] uppercase font-bold text-slate-400">X Position</Label><Input type="number" value={selectedElement.x} onChange={e => updateElement(selectedElement.id, { x: Number(e.target.value) })} className="h-9 text-xs font-black rounded-lg" disabled={currentTemplate?.isSystemTemplate} /></div>
                      <div className="space-y-1.5"><Label className="text-[9px] uppercase font-bold text-slate-400">Y Position</Label><Input type="number" value={selectedElement.y} onChange={e => updateElement(selectedElement.id, { y: Number(e.target.value) })} className="h-9 text-xs font-black rounded-lg" disabled={currentTemplate?.isSystemTemplate} /></div>
                      <div className="space-y-1.5"><Label className="text-[9px] uppercase font-bold text-slate-400">Width</Label><Input type="number" value={selectedElement.width} onChange={e => updateElement(selectedElement.id, { width: Number(e.target.value) })} className="h-9 text-xs font-black rounded-lg" disabled={currentTemplate?.isSystemTemplate} /></div>
                      <div className="space-y-1.5"><Label className="text-[9px] uppercase font-bold text-slate-400">Height</Label><Input type="number" value={selectedElement.height} onChange={e => updateElement(selectedElement.id, { height: Number(e.target.value) })} className="h-9 text-xs font-black rounded-lg" disabled={currentTemplate?.isSystemTemplate} /></div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <Label className="text-[10px] font-black uppercase opacity-50">Rotation</Label>
                        <span className="text-[9px] font-bold">{selectedElement.rotate}°</span>
                      </div>
                      <Slider 
                        value={[selectedElement.rotate]} 
                        min={0} max={360} step={1} 
                        onValueChange={v => updateElement(selectedElement.id, { rotate: v[0] })} 
                        disabled={currentTemplate?.isSystemTemplate}
                      />
                    </div>
                  </div>

                  {/* APPEARANCE SECTION */}
                  <div className="space-y-6">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block border-b pb-2">Appearance</Label>
                    
                    {['rectangle', 'circle', 'text', 'title', 'field', 'table', 'image'].includes(selectedElement.type) && (
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <Label className="text-[10px] font-black uppercase opacity-50">Opacity</Label>
                          <span className="text-[9px] font-bold">{Math.round((selectedElement.style.opacity || 1) * 100)}%</span>
                        </div>
                        <Slider 
                          value={[(selectedElement.style.opacity || 1) * 100]} 
                          min={0} max={100} step={1} 
                          onValueChange={v => updateElementStyle(selectedElement.id, { opacity: v[0] / 100 })} 
                          disabled={currentTemplate?.isSystemTemplate}
                        />
                      </div>
                    )}

                    {['rectangle', 'circle', 'text', 'title', 'field', 'table'].includes(selectedElement.type) && (
                      <div className="space-y-3">
                        <Label className="text-[9px] uppercase font-bold text-slate-400">Fill Color</Label>
                        <div className="flex gap-2">
                          <Input type="color" value={selectedElement.style.backgroundColor === 'transparent' ? '#ffffff' : selectedElement.style.backgroundColor} onChange={e => updateElementStyle(selectedElement.id, { backgroundColor: e.target.value })} className="h-9 w-12 p-1 rounded-lg" disabled={currentTemplate?.isSystemTemplate} />
                          <Button variant="outline" size="sm" className="h-9 text-[9px] uppercase font-black" onClick={() => updateElementStyle(selectedElement.id, { backgroundColor: 'transparent' })} disabled={currentTemplate?.isSystemTemplate}>Transparent</Button>
                        </div>
                      </div>
                    )}

                    {['rectangle', 'circle', 'line', 'table'].includes(selectedElement.type) && (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-[9px] uppercase font-bold text-slate-400">Stroke Color</Label>
                          <Input type="color" value={selectedElement.style.borderColor || '#000000'} onChange={e => updateElementStyle(selectedElement.id, { borderColor: e.target.value })} className="h-9 w-full p-1 rounded-lg" disabled={currentTemplate?.isSystemTemplate} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[9px] uppercase font-bold text-slate-400">Weight</Label>
                          <Input type="number" value={selectedElement.style.borderWidth || 0} onChange={e => updateElementStyle(selectedElement.id, { borderWidth: Number(e.target.value) })} className="h-9 font-bold" disabled={currentTemplate?.isSystemTemplate} />
                        </div>
                      </div>
                    )}

                    {selectedElement.type === 'rectangle' && (
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <Label className="text-[10px] font-black uppercase opacity-50">Corner Radius</Label>
                          <span className="text-[9px] font-bold">{selectedElement.style.borderRadius || 0}px</span>
                        </div>
                        <Slider 
                          value={[selectedElement.style.borderRadius || 0]} 
                          min={0} max={100} step={1} 
                          onValueChange={v => updateElementStyle(selectedElement.id, { borderRadius: v[0] })} 
                          disabled={currentTemplate?.isSystemTemplate}
                        />
                      </div>
                    )}
                  </div>

                  {/* TYPOGRAPHY SECTION */}
                  {(['text', 'title', 'field', 'table'].includes(selectedElement.type)) && (
                    <div className="space-y-6">
                      <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block border-b pb-2">Typography</Label>
                      {selectedElement.type !== 'field' && selectedElement.type !== 'table' && (
                        <div className="space-y-1.5">
                          <Label className="text-[9px] uppercase font-bold text-slate-400">Content</Label>
                          <Input value={selectedElement.content} onChange={e => updateElement(selectedElement.id, { content: e.target.value })} className="h-10 text-xs font-bold" disabled={currentTemplate?.isSystemTemplate} />
                        </div>
                      )}
                      <div className="space-y-1.5">
                        <Label className="text-[9px] uppercase font-bold text-slate-400">Font Family</Label>
                        <Select value={selectedElement.style.fontFamily} onValueChange={v => updateElementStyle(selectedElement.id, { fontFamily: v })} disabled={currentTemplate?.isSystemTemplate}>
                          <SelectTrigger className="h-10 text-xs font-black"><SelectValue /></SelectTrigger>
                          <SelectContent className="z-[200]">
                            {FONT_FAMILIES.map(f => <SelectItem key={f.id} value={f.id} style={{ fontFamily: f.value }}>{f.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-[9px] uppercase font-bold text-slate-400">Text Size</Label>
                          <Input type="number" value={selectedElement.style.fontSize} onChange={e => updateElementStyle(selectedElement.id, { fontSize: Number(e.target.value) })} className="h-9 text-xs" disabled={currentTemplate?.isSystemTemplate} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[9px] uppercase font-bold text-slate-400">Text Color</Label>
                          <Input type="color" value={selectedElement.style.color} onChange={e => updateElementStyle(selectedElement.id, { color: e.target.value })} className="h-9 w-full p-1" disabled={currentTemplate?.isSystemTemplate} />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[9px] uppercase font-bold text-slate-400">Alignment</Label>
                        <div className="flex bg-slate-100 p-1 rounded-lg gap-1">
                          <Button variant={selectedElement.style.textAlign === 'left' ? 'secondary' : 'ghost'} size="sm" className="flex-1 h-8" onClick={() => updateElementStyle(selectedElement.id, { textAlign: 'left' })} disabled={currentTemplate?.isSystemTemplate}><AlignLeft className="h-3 w-3" /></Button>
                          <Button variant={selectedElement.style.textAlign === 'center' ? 'secondary' : 'ghost'} size="sm" className="flex-1 h-8" onClick={() => updateElementStyle(selectedElement.id, { textAlign: 'center' })} disabled={currentTemplate?.isSystemTemplate}><AlignCenter className="h-3 w-3" /></Button>
                          <Button variant={selectedElement.style.textAlign === 'right' ? 'secondary' : 'ghost'} size="sm" className="flex-1 h-8" onClick={() => updateElementStyle(selectedElement.id, { textAlign: 'right' })} disabled={currentTemplate?.isSystemTemplate}><AlignRight className="h-3 w-3" /></Button>
                          <Button variant={selectedElement.style.textAlign === 'justify' ? 'secondary' : 'ghost'} size="sm" className="flex-1 h-8" onClick={() => updateElementStyle(selectedElement.id, { textAlign: 'justify' })} disabled={currentTemplate?.isSystemTemplate}><AlignJustify className="h-3 w-3" /></Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* IDENTIFICATION SECTION */}
                  {selectedElement.type === 'barcode' && (
                    <div className="space-y-6">
                      <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block border-b pb-2">Symbology</Label>
                      <div className="space-y-1.5">
                        <Label className="text-[9px] uppercase font-bold text-slate-400">Encoding Type</Label>
                        <Select value={selectedElement.barcodeType} onValueChange={(v: any) => updateElement(selectedElement.id, { barcodeType: v })} disabled={currentTemplate?.isSystemTemplate}>
                          <SelectTrigger className="h-10 font-bold"><SelectValue /></SelectTrigger>
                          <SelectContent className="z-[200]">
                            <SelectItem value="CODE128">Code 128 (Alpha-Numeric)</SelectItem>
                            <SelectItem value="CODE39">Code 39 (Standard)</SelectItem>
                            <SelectItem value="EAN13">EAN-13 (Product)</SelectItem>
                            <SelectItem value="UPC">UPC (Retail)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}

                  {selectedElement.type === 'image' && (
                    <div className="space-y-6">
                      <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block border-b pb-2">Image Source</Label>
                      <div className="p-8 border-2 border-dashed rounded-2xl text-center bg-slate-50 hover:bg-primary/5 hover:border-primary/20 relative group transition-all">
                        <Upload className="h-10 w-10 mx-auto text-slate-300 group-hover:text-primary mb-2" />
                        <p className="text-[10px] font-black uppercase text-slate-400 group-hover:text-primary">Change Asset</p>
                        <Input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleImageUpload} disabled={currentTemplate?.isSystemTemplate} />
                      </div>
                    </div>
                  )}

                  <Separator />
                  
                  <div className="space-y-4">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block border-b pb-2">Arrangement</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="outline" size="sm" className="text-[9px] font-black uppercase h-9" onClick={() => moveElement('front')}>Bring to Front</Button>
                      <Button variant="outline" size="sm" className="text-[9px] font-black uppercase h-9" onClick={() => moveElement('back')}>Send to Back</Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-6 space-y-10 animate-in slide-in-from-right-4 duration-300">
                  <div className="space-y-8">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2 border-b pb-4">
                      <Wallpaper className="h-4 w-4" /> Canvas Setup
                    </h4>
                    
                    <div className="space-y-6">
                      <Label className="text-[10px] font-black uppercase opacity-50">Background Layer</Label>
                      <div className="p-8 border-2 border-dashed rounded-2xl text-center bg-slate-50 hover:bg-primary/5 hover:border-primary/20 relative group transition-all">
                        <Upload className="h-10 w-10 mx-auto text-slate-300 group-hover:text-primary mb-2" />
                        <p className="text-[10px] font-black uppercase text-slate-400 group-hover:text-primary">Upload Form Overlay</p>
                        <Input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => handleImageUpload(e, true)} disabled={currentTemplate?.isSystemTemplate} />
                      </div>

                      {currentTemplate?.background?.image && (
                        <div className="space-y-6 animate-in fade-in">
                          <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase opacity-50">Layer Opacity</Label>
                            <Slider 
                              value={[(currentTemplate.background.opacity || 1) * 100]} 
                              min={0} max={100} step={1} 
                              onValueChange={(v) => setCurrentTemplate({
                                ...currentTemplate,
                                background: { ...currentTemplate.background!, opacity: v[0] / 100 }
                              })} 
                              disabled={currentTemplate?.isSystemTemplate}
                            />
                          </div>
                          <Button variant="ghost" size="sm" className="w-full text-destructive text-[10px] font-black uppercase" onClick={() => setCurrentTemplate({ ...currentTemplate, background: { ...currentTemplate.background!, image: "" } })} disabled={currentTemplate?.isSystemTemplate}><Eraser className="h-3 w-3 mr-2" /> Remove Overlay</Button>
                        </div>
                      )}
                    </div>
                  </div>

                  <Separator />

                  <div className="p-10 text-center text-muted-foreground flex flex-col items-center gap-6 bg-slate-50/50 rounded-3xl border border-dashed">
                    <div className="h-16 w-16 bg-white rounded-full flex items-center justify-center shadow-sm">
                      <MousePointerSquareDashed className="h-6 w-6 opacity-20" />
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-50">Select canvas element to configure specific properties</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* NEW TEMPLATE DIALOG */}
      <Dialog open={isNewDialogOpen} onOpenChange={setIsNewDialogOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-3xl">
          <form onSubmit={handleCreateTemplate}>
            <DialogHeader>
              <DialogTitle className="text-xl font-black uppercase flex items-center gap-2"><Plus className="h-5 w-5 text-primary" /> Create Design</DialogTitle>
            </DialogHeader>
            <div className="grid gap-6 py-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase opacity-50">Template Name</Label>
                <Input name="name" placeholder="e.g. Industrial Label v1" required className="h-11 rounded-xl border-2 font-bold" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase opacity-50">Document Category</Label>
                <Select name="documentType" required>
                  <SelectTrigger className="h-11 rounded-xl border-2 font-bold"><SelectValue placeholder="Select Category" /></SelectTrigger>
                  <SelectContent className="z-[200]">
                    <SelectItem value="Tax Invoice">Tax Invoice</SelectItem>
                    <SelectItem value="Technical Job Card">Technical Job Card</SelectItem>
                    <SelectItem value="Industrial Label">Industrial Label</SelectItem>
                    <SelectItem value="Delivery Challan">Delivery Challan</SelectItem>
                    <SelectItem value="Purchase Order">Purchase Order</SelectItem>
                    <SelectItem value="Proforma">Proforma Invoice</SelectItem>
                    <SelectItem value="Report">Report / Audit Sheet</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-4">
                <Label className="text-[10px] font-black uppercase opacity-50">Paper Specification</Label>
                <Select name="paperSize" defaultValue="A4" onValueChange={() => {}}>
                  <SelectTrigger className="h-11 rounded-xl border-2 font-bold"><SelectValue /></SelectTrigger>
                  <SelectContent className="z-[200]">
                    {PAPER_SIZES.map(s => <SelectItem key={s.id} value={s.id}>{s.name} {s.id !== 'Custom' && `(${s.w}x${s.h}mm)`}</SelectItem>)}
                  </SelectContent>
                </Select>
                
                {/* Manual W/H for Custom Labels */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1"><Label className="text-[9px] uppercase font-bold text-slate-400">Width (mm)</Label><Input name="customWidth" type="number" placeholder="100" className="h-10 font-bold" /></div>
                  <div className="space-y-1"><Label className="text-[9px] uppercase font-bold text-slate-400">Height (mm)</Label><Input name="customHeight" type="number" placeholder="100" className="h-10 font-bold" /></div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" className="w-full h-14 font-black uppercase tracking-widest rounded-2xl shadow-xl">Start Designing</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <style jsx global>{`
        @media print {
          @page { margin: 0; size: auto; }
          html, body { margin: 0 !important; padding: 0 !important; height: auto !important; background: white !important; overflow: visible !important; }
          body * { visibility: hidden !important; }
          #studio-canvas-print, #studio-canvas-print * { visibility: visible !important; }
          #studio-canvas-print { position: fixed !important; left: 0 !important; top: 0 !important; margin: 0 !important; padding: 0 !important; transform: none !important; transform-origin: top left !important; border: none !important; box-shadow: none !important; background: white !important; display: block !important; z-index: 2147483647 !important; }
          .guidelines-grid, .resize-handle, .print\:hidden, button, .fixed.bottom-10 { display: none !important; visibility: hidden !important; }
        }
      `}</style>
    </div>
  )
}

function ElementTool({ icon: Icon, label, onClick }: { icon: any, label: string, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-2 p-4 bg-white border-2 border-slate-100 rounded-xl hover:border-primary/40 hover:bg-primary/5 transition-all group active:scale-95 shadow-sm"
    >
      <Icon className="h-5 w-5 text-slate-400 group-hover:text-primary" />
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
    const commonStyle = {
      width: '100%',
      height: '100%',
      backgroundColor: element.style.backgroundColor,
      border: element.style.borderWidth ? `${element.style.borderWidth}px ${element.style.lineStyle || 'solid'} ${element.style.borderColor}` : 'none',
      borderRadius: element.type === 'circle' ? '100%' : `${element.style.borderRadius || 0}px`,
      opacity: element.style.opacity,
      display: 'flex',
      alignItems: 'center',
      justifyContent: element.style.textAlign === 'center' ? 'center' : element.style.textAlign === 'right' ? 'flex-end' : 'flex-start',
      overflow: 'hidden'
    };

    const textStyle = { 
      fontSize: `${element.style.fontSize}px`, 
      fontFamily: getFontFamilyValue(element.style.fontFamily), 
      fontWeight: element.style.fontWeight, 
      color: element.style.color, 
      width: '100%',
      textAlign: element.style.textAlign || 'left' as any
    };

    switch (element.type) {
      case 'text': 
      case 'title':
        return (
          <div style={{ ...commonStyle, padding: '4px' }}>
            <span style={textStyle}>{element.content}</span>
          </div>
        );
      case 'field': 
        const previewVal = Object.values(PLACEHOLDERS).flat().find(p => p.key === element.placeholder)?.preview || "VALUE";
        return (
          <div style={{ ...commonStyle, padding: '4px' }}>
            <span style={textStyle}>{previewVal}</span>
          </div>
        );
      case 'table':
        return (
          <div style={{ ...commonStyle, flexDirection: 'column', padding: 0 }}>
            <div className="w-full bg-slate-900 text-white p-2 text-[10px] font-black uppercase flex justify-between">
              <span>ROLL ID</span><span>WIDTH</span><span>DEST</span>
            </div>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="w-full border-b p-2 text-[9px] font-bold flex justify-between uppercase opacity-50">
                <span>T-1001-{ALPHABET[i]}</span><span>250MM</span><span>JOB</span>
              </div>
            ))}
          </div>
        );
      case 'barcode': 
        const barcodePreviewVal = (element.barcodeType === 'EAN13' || element.barcodeType === 'UPC') ? "123456789012" : "PREVIEW";
        return (
          <div style={commonStyle}>
            <div style={{ transform: `scale(${Math.min(1, element.width / 150)})`, transformOrigin: 'center' }}>
              <Barcode format={element.barcodeType as any || 'CODE128'} value={barcodePreviewVal} height={element.height - 20} width={1.5} fontSize={10} />
            </div>
          </div>
        );
      case 'qr': 
        return <div style={commonStyle}><QRCodeSVG value="PREVIEW" size={Math.min(element.width, element.height) - 10} /></div>;
      case 'rectangle': 
      case 'circle': 
        return <div style={commonStyle} />;
      case 'line': 
        return <div style={{ ...commonStyle, height: `${element.style.borderWidth || 2}px`, border: 'none', backgroundColor: element.style.borderColor }} />;
      case 'image':
        return element.content ? (
          <img src={element.content} alt="Element" style={{ width: '100%', height: '100%', objectFit: 'contain', opacity: element.style.opacity, borderRadius: commonStyle.borderRadius }} />
        ) : (
          <div className="w-full h-full border-2 border-dashed flex items-center justify-center text-[8px] uppercase font-bold opacity-30">No Image Asset</div>
        );
      default: return null;
    }
  }

  return (
    <div 
      className={cn(
        "absolute cursor-move select-none group flex items-center justify-center transition-shadow",
        isSelected && "ring-2 ring-primary ring-offset-2 z-[60] shadow-2xl",
        !isSelected && "hover:ring-1 hover:ring-primary/30"
      )}
      style={{ 
        left: `${element.x}px`, 
        top: `${element.y}px`, 
        width: `${element.width}px`, 
        height: `${element.height}px`,
        transform: `rotate(${element.rotate}deg)`,
      }}
      onMouseDown={handleMouseDown}
    >
      {renderContent()}

      {isSelected && (
        <div 
          className="absolute bottom-[-6px] right-[-6px] w-4 h-4 bg-primary cursor-nwse-resize rounded-full border-2 border-white shadow-lg z-[70] print:hidden" 
          onMouseDown={handleResizeStart} 
        />
      )}
    </div>
  )
}

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
