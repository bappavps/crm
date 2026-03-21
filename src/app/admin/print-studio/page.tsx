
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
  Unlock,
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
  ChevronDown,
  Weight,
  X,
  FileUp,
  FileDown,
  LayoutTemplate,
  RotateCcw,
  Magnet,
  Maximize,
  ArrowUp,
  ArrowDown,
  MoveUp,
  MoveDown
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
import { useFirestore, useUser, useCollection, useMemoFirebase, errorEmitter, FirestorePermissionError } from "@/firebase"
import { collection, doc, serverTimestamp, setDoc, deleteDoc, query, orderBy, writeBatch, where } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { QRCodeSVG } from 'qrcode.react'
import Barcode from 'react-barcode'
import { ActionModal, ModalType } from "@/components/action-modal"
import { ScrollArea } from "@/components/ui/scroll-area"

/**
 * PRINT TEMPLATE STUDIO (V15.2)
 * Enhanced Job Card dynamic field directory.
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
  isLocked?: boolean;
  barcodeType?: 'CODE128' | 'CODE39' | 'EAN13' | 'UPC' | null;
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
  thumbnail?: string;
  company_id?: string;
}

const PAPER_SIZES = [
  { id: 'A4', name: 'A4 Paper', w: 210, h: 297 },
  { id: 'A5', name: 'A5 Paper', w: 148, h: 210 },
  { id: 'Thermal150x100', name: 'Label 150x100mm', w: 150, h: 100 },
  { id: 'Thermal100x50', name: 'Label 100x50mm', w: 100, h: 50 },
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
    { key: '{{current_date}}', label: 'Current Date', icon: CalendarDays, preview: 'DD/MM/YYYY' },
  ],
  INVENTORY: [
    { key: '{{parent_roll_no}}', label: 'Roll Number', icon: Box, preview: 'T-1038-A' },
    { key: '{{paper_type}}', label: 'Paper Type', icon: FileText, preview: 'Chromo' },
    { key: '{{width}}', label: 'Width (MM)', icon: Maximize2, preview: '1020' },
    { key: '{{length}}', label: 'Length (MTR)', icon: ArrowRightLeft, preview: '3000' },
    { key: '{{gsm}}', label: 'GSM', icon: Layers, preview: '80' },
    { key: '{{weight}}', label: 'Roll Weight (KG)', icon: Weight, preview: '245' },
    { key: '{{roll_url}}', label: 'Roll Profile URL', icon: QrCode, preview: 'https://erp.shreelabel.com/roll/T-1038-A' },
  ],
  PRODUCTION: [
    { key: '{{job_card_id}}', label: 'Job Card ID', icon: Hash, preview: 'JJC-T1001-001' },
    { key: '{{machine_name}}', label: 'Machine Name', icon: Wrench, preview: 'Jumbo Slitter A1' },
    { key: '{{operator_name}}', label: 'Operator', icon: User, preview: 'Mriganka Debnath' },
    { key: '{{parent_roll}}', label: 'Primary Parent ID', icon: Box, preview: 'T-1001' },
    { key: '{{sourceRolls}}', label: 'Source Material Grid', icon: Grid3X3, preview: 'TABLE_PREVIEW' },
    { key: '{{SLIT_ROLLS}}', label: 'Slitting Output Grid', icon: Grid3X3, preview: 'TABLE_PREVIEW' },
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
  const [isLibraryOpen, setIsLibraryOpen] = useState(false)
  const [libraryContext, setLibraryContext] = useState<'image' | 'background'>('image')
  
  const [currentTemplate, setCurrentTemplate] = useState<PrintTemplate | null>(null)
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [isSaving, setIsSaving] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [isPrinting, setIsPrinting] = useState(false)
  const [gridSnap, setGridSnap] = useState(5)
  const [showGuidelines, setShowGuidelines] = useState(true)
  const [activeCategory, setActiveCategory] = useState<string>("All")
  const [clientDate, setClientDate] = useState<string>("DD/MM/YYYY")

  const [modal, setModal] = useState<{
    isOpen: boolean;
    type: ModalType;
    title: string;
    description?: string;
    onConfirm?: () => void;
  }>({ isOpen: false, type: 'SUCCESS', title: '' });

  useEffect(() => { 
    setIsMounted(true);
    setClientDate(new Date().toLocaleDateString());
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedElementId && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName || "")) {
          const el = currentTemplate?.elements.find(e => e.id === selectedElementId);
          if (el && !el.isLocked) deleteElement(selectedElementId);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedElementId, currentTemplate]);

  const templatesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'print_templates'), orderBy('documentType'));
  }, [firestore]);
  const { data: templates, isLoading } = useCollection(templatesQuery);

  const libraryQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'image_library');
  }, [firestore]);
  const { data: libraryImages } = useCollection(libraryQuery);

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

  const selectedElement = useMemo(() => currentTemplate?.elements.find(el => el.id === selectedElementId), [currentTemplate, selectedElementId]);

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
    if (sizeId === 'Custom') { w = customWidth || 100; h = customHeight || 100; } 
    else { const size = PAPER_SIZES.find(s => s.id === sizeId) || PAPER_SIZES[0]; w = size.w; h = size.h; }
    const newTemplate: PrintTemplate = { 
      id: crypto.randomUUID(), name, documentType: type, paperWidth: w, paperHeight: h, elements: [], isDefault: false, 
      background: { image: "", opacity: 1, mode: 'fit', locked: true },
      company_id: "default_company"
    }
    try {
      const docRef = doc(firestore, 'print_templates', newTemplate.id);
      await setDoc(docRef, { ...newTemplate, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
      setCurrentTemplate(newTemplate); setIsNewDialogOpen(false); setIsEditorOpen(true); toast({ title: "Template Created" })
    } catch (e: any) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'print_templates', operation: 'create' }));
    }
  }

  const handleImportTemplate = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !firestore) return;

    if (file.size > 2 * 1024 * 1024) {
      toast({ variant: "destructive", title: "Template file too large", description: "Max limit is 2MB." });
      return;
    }

    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const json = JSON.parse(evt.target?.result as string);
        
        // VALIDATION
        const required = ['name', 'paperWidth', 'paperHeight', 'elements'];
        const missing = required.filter(k => !(k in json));
        
        if (missing.length > 0) {
          throw new Error(`Invalid template structure. Missing: ${missing.join(', ')}`);
        }

        const newId = crypto.randomUUID();
        const imported = { 
          ...json, 
          id: newId, 
          name: `${json.name} (Imported)`, 
          isSystemTemplate: false, 
          isDefault: false,
          company_id: "default_company",
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp()
        };

        await setDoc(doc(firestore, 'print_templates', newId), imported);
        toast({ title: "Template Imported Successfully" });
        
        // Auto-generate thumbnail in background
        setTimeout(() => handleSaveTemplate(imported), 1000);

      } catch (err: any) {
        toast({ variant: "destructive", title: "Import Failed", description: err.message || "Invalid JSON File" });
      } finally {
        setIsImporting(false);
        e.target.value = ""; // Reset file picker
      }
    };
    reader.readAsText(file);
  };

  const handleExportTemplate = (tpl?: PrintTemplate) => {
    const target = tpl || currentTemplate;
    if (!target) return;
    const blob = new Blob([JSON.stringify(target, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${target.name.replace(/\s+/g, '_')}_template.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Template JSON Exported" });
  };

  const handleSelectFromLibrary = (asset: any) => {
    if (!currentTemplate) return;
    if (libraryContext === 'background') {
      setCurrentTemplate(prev => prev ? { ...prev, background: { ...prev.background!, image: asset.url } } : null);
    } else {
      const selId = selectedElementId;
      const targetEl = currentTemplate.elements.find(el => el.id === selId && el.type === 'image');
      if (targetEl) {
        updateElement(selId!, { content: asset.url });
      } else {
        const id = crypto.randomUUID();
        const newEl: TemplateElement = { 
          id, type: 'image', x: 100, y: 100, width: 150, height: 150, rotate: 0, content: asset.url, placeholder: "", isLocked: false, 
          style: { fontSize: 14, fontWeight: 'normal', textAlign: 'left', color: '#000000', fontFamily: 'inter', borderRadius: 0, opacity: 1 } 
        };
        setCurrentTemplate(prev => prev ? { ...prev, elements: [...prev.elements, newEl] } : null);
        setSelectedElementId(id);
      }
    }
    setIsLibraryOpen(false);
    toast({ title: "Asset Applied" });
  };

  const handleSaveTemplate = async (templateToSave?: any) => {
    const target = templateToSave || currentTemplate;
    if (!firestore || !target) return
    if (target.isSystemTemplate) { toast({ variant: "destructive", title: "Read Only", description: "System templates cannot be modified." }); return; }
    setIsSaving(true)
    
    try {
      const canvasElement = document.getElementById('studio-canvas-print');
      let thumbnail = target.thumbnail || "";
      
      // SAFE THUMBNAIL GENERATION
      if (canvasElement) {
        try {
          const html2canvas = (await import('html2canvas')).default;
          const canvas = await html2canvas(canvasElement, {
            scale: 0.2,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff'
          });
          thumbnail = canvas.toDataURL('image/jpeg', 0.7);
        } catch (thumbErr) {
          console.warn("Thumbnail generation failed, skipping to preserve data.", thumbErr);
        }
      }

      const updated = { 
        ...target, 
        thumbnail,
        company_id: "default_company",
        updatedAt: serverTimestamp() 
      };
      
      const docRef = doc(firestore, 'print_templates', target.id);
      await setDoc(docRef, updated, { merge: true }); 
      if (!templateToSave) toast({ title: "Template Saved" }) 
    } catch (e: any) { 
      toast({ variant: "destructive", title: "Save Failed" }); 
    } finally { 
      setIsSaving(false) 
    }
  }

  const handleDeleteTemplate = (templateId: string) => {
    const tpl = templates?.find(t => t.id === templateId);
    if (tpl?.isSystemTemplate) { toast({ variant: "destructive", title: "Access Denied", description: "System templates are protected." }); return; }
    setModal({ isOpen: true, type: 'CONFIRMATION', title: 'Delete Template?', description: 'This action is permanent.', onConfirm: async () => {
      if (!firestore) return
      try { await deleteDoc(doc(firestore, 'print_templates', templateId)); toast({ title: "Template Deleted" }); if (currentTemplate?.id === templateId) { setIsEditorOpen(false); setCurrentTemplate(null); } setModal(p => ({ ...p, isOpen: false })) } 
      catch (e: any) { errorEmitter.emit('permission-error', new FirestorePermissionError({ path: `print_templates/${templateId}`, operation: 'delete' })); }
    } })
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
      company_id: "default_company",
      createdAt: serverTimestamp(), 
      updatedAt: serverTimestamp() 
    }
    try { await setDoc(doc(firestore, 'print_templates', newId), newTemplate); toast({ title: "Template Cloned" }) } 
    catch (e: any) { errorEmitter.emit('permission-error', new FirestorePermissionError({ path: `print_templates/${newId}`, operation: 'create' })); }
  }

  const handleExecutePrint = async () => {
    const canvasElement = document.getElementById('studio-canvas-print');
    if (!canvasElement || !currentTemplate) return;

    const html2canvas = (await import('html2canvas')).default;
    
    setIsPrinting(true);
    toast({ title: "Rendering Technical Snapshot" });

    try {
      const paperW = currentTemplate.paperWidth;
      const paperH = currentTemplate.paperHeight;

      const canvas = await html2canvas(canvasElement, {
        scale: 4, 
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: paperW * MM_TO_PX,
        height: paperH * MM_TO_PX
      });

      const imgData = canvas.toDataURL('image/png', 1.0);
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0'; iframe.style.bottom = '0';
      iframe.style.width = '0'; iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);

      const iframeDoc = iframe.contentWindow?.document || iframe.contentDocument;
      if (iframeDoc) {
        iframeDoc.write(`
          <html>
            <head>
              <title>Print Snapshot</title>
              <style>
                @page { size: ${paperW}mm ${paperH}mm; margin: 0; }
                body { margin: 0; padding: 0; display: flex; justify-content: center; align-items: center; }
                img { width: 100%; height: 100%; object-fit: contain; }
              </style>
            </head>
            <body><img src="${imgData}" /></body>
          </html>
        `);
        iframeDoc.close();
        setTimeout(() => {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          document.body.removeChild(iframe);
          setIsPrinting(false);
        }, 500);
      }
    } catch (err) {
      toast({ variant: "destructive", title: "Render Error" });
      setIsPrinting(false);
    }
  };

  const addElement = (type: ElementType, placeholder?: string, content?: string) => {
    const id = crypto.randomUUID()
    const newEl: TemplateElement = { id, type, x: 100, y: 100, width: type === 'qr' ? 80 : (type === 'barcode' ? 200 : (type === 'rectangle' || type === 'circle' ? 100 : (type === 'table' ? 600 : (type === 'line' ? 400 : 150)))), height: type === 'qr' ? 80 : (type === 'barcode' ? 60 : (type === 'rectangle' || type === 'circle' ? 100 : (type === 'table' ? 200 : (type === 'line' ? 2 : 30)))), rotate: 0, content: content || (placeholder ? "" : (type === 'text' || type === 'title' ? "New Element" : "")), placeholder: placeholder || "", isLocked: false, barcodeType: type === 'barcode' ? 'CODE128' : null, style: { fontSize: type === 'title' ? 24 : 14, fontWeight: type === 'title' ? 'bold' : 'normal', textAlign: 'left', color: '#000000', fontFamily: 'inter', backgroundColor: (type === 'rectangle' || type === 'circle') ? '#ffffff' : 'transparent', borderWidth: (type === 'rectangle' || type === 'circle' || type === 'line' || type === 'table') ? 2 : 0, borderColor: '#000000', borderRadius: 0, opacity: 1, lineStyle: 'solid' } }
    setCurrentTemplate(prev => prev ? { ...prev, elements: [...prev.elements, newEl] } : null); setSelectedElementId(id)
  }

  const updateElement = (id: string, updates: Partial<TemplateElement>) => { setCurrentTemplate(prev => prev ? { ...prev, elements: prev.elements.map(el => el.id === id ? { ...el, ...updates } : el) } : null); }
  const updateElementStyle = (id: string, styleUpdates: any) => { setCurrentTemplate(prev => prev ? { ...prev, elements: prev.elements.map(el => el.id === id ? { ...el, style: { ...el.style, ...styleUpdates } } : el) } : null); }
  const deleteElement = (id: string) => { setCurrentTemplate(prev => { if (!prev) return null; const el = prev.elements.find(e => e.id === id); if (el?.isLocked) { toast({ variant: "destructive", title: "Element Locked" }); return prev; } return { ...prev, elements: prev.elements.filter(el => el.id !== id) } }); setSelectedElementId(null) }
  const duplicateElement = (id: string) => { const newId = crypto.randomUUID(); setCurrentTemplate(prev => { if (!prev) return null; const el = prev.elements.find(e => e.id === id); if (!el) return prev; const newEl = { ...JSON.parse(JSON.stringify(el)), id: newId, x: el.x + 10, y: el.y + 10, isLocked: false }; return { ...prev, elements: [...prev.elements, newEl] } }); setSelectedElementId(newId); toast({ title: "Element Duplicated" }); }
  const toggleElementLock = (id: string) => { setCurrentTemplate(prev => { if (!prev) return null; const el = prev.elements.find(e => e.id === id); if (!el) return prev; const nextStatus = !el.isLocked; toast({ title: nextStatus ? "Element Locked" : "Element Unlocked" }); return { ...prev, elements: prev.elements.map(e => e.id === id ? { ...e, isLocked: nextStatus } : e) } }); }
  const moveElement = (direction: 'front' | 'back' | 'forward' | 'backward') => { if (!selectedElementId) return; setCurrentTemplate(prev => { if (!prev) return null; const elements = [...prev.elements]; const index = elements.findIndex(el => el.id === selectedElementId); if (index === -1) return prev; const el = elements.splice(index, 1)[0]; if (direction === 'front') elements.push(el); else if (direction === 'back') elements.unshift(el); else if (direction === 'forward') elements.splice(Math.min(elements.length, index + 1), 0, el); else elements.splice(Math.max(0, index - 1), 0, el); return { ...prev, elements }; }); };

  const previewData = useMemo(() => {
    const data: Record<string, any> = {};
    Object.values(PLACEHOLDERS).flat().forEach(p => {
      data[p.key.replace(/[{}]/g, '')] = p.key === '{{current_date}}' ? clientDate : p.preview;
    });
    return data;
  }, [clientDate]);

  if (!isMounted) return null;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 h-full flex flex-col">
      <ActionModal {...modal} onClose={() => setModal(p => ({ ...p, isOpen: false }))} />

      {!isEditorOpen ? (
        <>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h2 className="text-3xl font-black text-primary uppercase tracking-tighter">Print Template Studio</h2>
              <p className="text-muted-foreground font-medium text-sm">Industrial document & label designer.</p>
            </div>
            <div className="flex gap-2">
              <Label htmlFor="import-tpl" className={cn(
                "cursor-pointer h-12 px-6 rounded-xl border-2 border-slate-200 hover:bg-slate-50 text-slate-600 font-bold uppercase text-[10px] tracking-widest flex items-center shadow-sm transition-all",
                isImporting && "opacity-50 pointer-events-none"
              )}>
                {isImporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileUp className="h-4 w-4 mr-2" />}
                Import Template
                <Input id="import-tpl" type="file" accept=".json" className="hidden" onChange={handleImportTemplate} disabled={isImporting} />
              </Label>
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
                  {tpl.isSystemTemplate && <div className="absolute top-2 left-2 z-20"><Badge className="bg-slate-900 text-white border-none text-[8px] font-black uppercase py-0.5 px-2">SYSTEM DEFAULT</Badge></div>}
                  <div className="bg-slate-100 aspect-[3/4] p-4 relative flex items-center justify-center overflow-hidden">
                    {tpl.thumbnail ? (
                      <img src={tpl.thumbnail} className="w-full h-full object-contain shadow-md rounded" alt="Preview" />
                    ) : (
                      <div className="bg-white shadow-2xl w-full h-full rounded p-4 flex flex-col gap-2 overflow-hidden scale-90 opacity-80 group-hover:opacity-100 transition-all">
                        <div className="h-4 w-1/2 bg-slate-100 rounded" /><div className="h-2 w-full bg-slate-50 rounded" /><div className="h-2 w-full bg-slate-50 rounded" />
                        <div className="mt-auto h-10 w-full border-2 border-dashed border-slate-50 rounded flex items-center justify-center text-[8px] font-bold text-slate-200 uppercase">No Preview</div>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-primary/90 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3 p-6">
                      <Button variant="secondary" className="w-full font-black uppercase text-[10px] tracking-widest" onClick={() => { setCurrentTemplate(tpl); setIsEditorOpen(true); }}>
                        {tpl.isSystemTemplate ? <><Eye className="h-3 w-3 mr-2" /> View Layout</> : <><Paintbrush className="h-3 w-3 mr-2" /> Edit Layout</>}
                      </Button>
                      <div className="flex gap-2 w-full">
                        <Button variant="outline" size="icon" className="bg-white/10 border-white/20 text-white hover:bg-white/20 flex-1" onClick={() => handleDuplicateTemplate(tpl)}><Copy className="h-4 w-4" /></Button>
                        <Button variant="outline" size="icon" className="bg-white/10 border-white/20 text-white hover:bg-white/20 flex-1" onClick={() => handleExportTemplate(tpl)}><FileDown className="h-4 w-4" /></Button>
                        {!tpl.isSystemTemplate && <Button variant="destructive" size="icon" className="flex-1" onClick={() => handleDeleteTemplate(tpl.id)}><Trash2 className="h-4 w-4" /></Button>}
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
        <div className="fixed inset-0 z-40 bg-slate-100 flex flex-col font-sans print-studio-editor">
          <div className="h-16 border-b flex items-center justify-between px-6 shrink-0 bg-white shadow-sm z-50 print:hidden">
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => setIsEditorOpen(false)} className="font-bold"><Undo2 className="mr-2 h-4 w-4" /> Exit Studio</Button>
              <Separator orientation="vertical" className="h-6" />
              <div>
                <h3 className="text-sm font-black uppercase tracking-tight leading-none">
                  {currentTemplate?.name} {currentTemplate?.isSystemTemplate && <Badge variant="secondary" className="ml-2 h-4 text-[8px] border-none font-black bg-slate-100">LOCKED</Badge>}
                </h3>
                <p className="text-[10px] text-muted-foreground font-bold tracking-widest">{currentTemplate?.documentType} • {currentTemplate?.paperWidth}x{currentTemplate?.paperHeight}mm</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-slate-100 p-1 rounded-xl mr-4 gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoom(Math.max(0.2, zoom - 0.1))}><ChevronDown className="h-4 w-4" /></Button>
                <Button variant="ghost" className="h-8 px-2 text-[10px] font-black" onClick={() => setZoom(1)}>{Math.round(zoom * 100)}%</Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoom(Math.min(3, zoom + 0.1))}><ChevronUp className="h-4 w-4" /></Button>
                <Separator orientation="vertical" className="h-4 mx-1" />
                <Button variant={gridSnap > 0 ? "secondary" : "ghost"} size="icon" className={cn("h-8 w-8", gridSnap > 0 && "text-primary")} onClick={() => setGridSnap(gridSnap > 0 ? 0 : 5)}><Magnet className="h-4 w-4" /></Button>
                <Button variant={showGuidelines ? "secondary" : "ghost"} size="icon" className={cn("h-8 w-8", showGuidelines && "text-primary")} onClick={() => setShowGuidelines(!showGuidelines)}><LayoutGrid className="h-4 w-4" /></Button>
              </div>

              <Button variant="outline" size="sm" onClick={() => handleExportTemplate()} className="font-bold">
                <FileDown className="h-4 w-4 mr-2" /> Export JSON
              </Button>
              <Button disabled={isPrinting} variant="outline" size="sm" onClick={handleExecutePrint} className="font-bold">
                {isPrinting ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Printer className="h-4 w-4 mr-2" />} Test Print
              </Button>
              {!currentTemplate?.isSystemTemplate ? (
                <Button onClick={() => handleSaveTemplate()} disabled={isSaving} className="font-black h-10 px-8 bg-primary shadow-lg">
                  {isSaving ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Save className="h-4 w-4 mr-2" />} Save Layout
                </Button>
              ) : (
                <Button onClick={() => handleDuplicateTemplate(currentTemplate!)} className="font-black h-10 px-8 bg-slate-900 text-white shadow-lg"><Copy className="h-4 w-4 mr-2" /> Duplicate to Edit</Button>
              )}
            </div>
          </div>

          <div className="flex-1 flex overflow-hidden industrial-container">
            <div className="w-72 border-r flex flex-col overflow-y-auto bg-slate-50 shrink-0 print:hidden">
              <div className="p-6 space-y-10">
                <div className="space-y-4">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-primary">Core Components</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <ElementTool icon={Type} label="Label" onClick={() => addElement('text')} />
                    <ElementTool icon={ImageIcon} label="Asset" onClick={() => { setLibraryContext('image'); setIsLibraryOpen(true); }} />
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
                            <button key={p.key} onClick={() => p.preview === 'TABLE_PREVIEW' ? addElement('table', p.key.replace(/[{}]/g, '')) : addElement('text', undefined, p.key)} className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-primary/5 transition-all text-left group">
                              <p.icon className="h-3 w-3 text-slate-300 group-hover:text-primary" /><span className="text-[10px] font-black uppercase truncate text-slate-600 group-hover:text-primary">{p.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1 bg-slate-200 overflow-auto flex items-start justify-center p-20 relative studio-viewport print:p-0 print:bg-white print:overflow-visible" onClick={() => setSelectedElementId(null)}>
              <div id="studio-canvas-print" className="bg-white shadow-2xl relative overflow-hidden transition-all duration-200" 
                style={{ width: `${(currentTemplate?.paperWidth || 100) * MM_TO_PX}px`, height: `${(currentTemplate?.paperHeight || 100) * MM_TO_PX}px`, transform: `scale(${zoom})`, transformOrigin: 'top center', outline: '2px solid #fbbf24' }}>
                {currentTemplate?.background?.image && <div className="absolute inset-0 pointer-events-none z-0" style={{ opacity: currentTemplate.background.opacity }}><img src={currentTemplate.background.image} className="w-full h-full object-contain" alt="Background" /></div>}
                {showGuidelines && <div className="absolute inset-0 opacity-[0.05] pointer-events-none z-[5] guidelines-grid print:hidden" style={{ backgroundImage: 'linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)', backgroundSize: '20px 20px' }} />}
                <div className="relative z-10 w-full h-full">
                  {currentTemplate?.elements.map(el => (
                    <CanvasElement key={el.id} element={el} isSelected={selectedElementId === el.id} onSelect={(e) => { e.stopPropagation(); setSelectedElementId(el.id); }} onMove={(x, y) => !el.isLocked && updateElement(el.id, { x, y })} onResize={(width, height) => !el.isLocked && updateElement(el.id, { width, height })} gridSnap={gridSnap} previewData={previewData} />
                  ))}
                </div>
              </div>
            </div>

            <div className="w-80 border-l flex flex-col bg-white overflow-y-auto shrink-0 industrial-scroll print:hidden">
              {selectedElement ? (
                <div className="p-6 space-y-8 animate-in slide-in-from-right-4 duration-300">
                  <div className="flex justify-between items-center bg-slate-50 -m-6 p-6 mb-4 border-b">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2"><Settings2 className="h-4 w-4" /> Properties</h4>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10" title="Duplicate" onClick={() => duplicateElement(selectedElement.id)}><Copy className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className={cn("h-8 w-8 hover:bg-primary/10", selectedElement.isLocked && "text-primary")} title={selectedElement.isLocked ? "Unlock" : "Lock"} onClick={() => toggleElementLock(selectedElement.id)}>{selectedElement.isLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}</Button>
                      {!currentTemplate?.isSystemTemplate && <Button variant="ghost" size="icon" className="text-destructive h-8 w-8 hover:bg-destructive/10" disabled={selectedElement.isLocked} onClick={() => deleteElement(selectedElement.id)}><Trash2 className="h-4 w-4" /></Button>}
                    </div>
                  </div>

                  {/* POSITIONING PANEL */}
                  <div className="space-y-4">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block border-b pb-2">Layout & Position</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label className="text-[9px] uppercase font-bold">X (px)</Label>
                        <Input type="number" value={Math.round(selectedElement.x)} onChange={(e) => updateElement(selectedElement.id, { x: Number(e.target.value) })} className="h-8 text-xs font-mono" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[9px] uppercase font-bold">Y (px)</Label>
                        <Input type="number" value={Math.round(selectedElement.y)} onChange={(e) => updateElement(selectedElement.id, { y: Number(e.target.value) })} className="h-8 text-xs font-mono" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[9px] uppercase font-bold">Width</Label>
                        <Input type="number" value={Math.round(selectedElement.width)} onChange={(e) => updateElement(selectedElement.id, { width: Number(e.target.value) })} className="h-8 text-xs font-mono" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[9px] uppercase font-bold">Height</Label>
                        <Input type="number" value={Math.round(selectedElement.height)} onChange={(e) => updateElement(selectedElement.id, { height: Number(e.target.value) })} className="h-8 text-xs font-mono" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[9px] uppercase font-bold">Rotation: {selectedElement.rotate || 0}°</Label>
                      <Slider value={[selectedElement.rotate || 0]} onValueChange={([v]) => updateElement(selectedElement.id, { rotate: v })} min={0} max={360} step={1} />
                    </div>
                  </div>

                  {/* ELEMENT SPECIFIC PANELS */}
                  {selectedElement.type === 'image' && (
                    <div className="space-y-4">
                      <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block border-b pb-2">Image Source</Label>
                      <Tabs defaultValue="library" className="w-full">
                        <TabsList className="grid w-full grid-cols-2 h-8 bg-slate-100 rounded-lg p-1">
                          <TabsTrigger value="upload" className="text-[8px] font-black uppercase">Upload</TabsTrigger>
                          <TabsTrigger value="library" className="text-[8px] font-black uppercase">Library</TabsTrigger>
                        </TabsList>
                        <TabsContent value="upload" className="pt-3">
                          <div className="relative">
                            <Button variant="outline" size="sm" className="w-full text-[9px] font-black uppercase h-10 border-2 border-dashed">
                              <Upload className="h-3 w-3 mr-2" /> Upload
                            </Button>
                            <Input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => {
                              const file = e.target.files?.[0]; if (!file) return;
                              const reader = new FileReader(); reader.onload = (evt) => updateElement(selectedElement.id, { content: evt.target?.result as string });
                              reader.readAsDataURL(file);
                            }} />
                          </div>
                        </TabsContent>
                        <TabsContent value="library" className="pt-3">
                          <Button variant="outline" size="sm" className="w-full text-[9px] font-black uppercase" onClick={() => { setLibraryContext('image'); setIsLibraryOpen(true); }}>
                            Browse Library
                          </Button>
                        </TabsContent>
                      </Tabs>
                    </div>
                  )}

                  {['text', 'title', 'field'].includes(selectedElement.type) && (
                    <div className="space-y-4">
                      <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block border-b pb-2">Typography</Label>
                      <div className="grid gap-4">
                        <div className="space-y-1">
                          <Label className="text-[9px] uppercase font-bold">Font Family</Label>
                          <Select value={selectedElement.style.fontFamily} onValueChange={(val) => updateElementStyle(selectedElement.id, { fontFamily: val })}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent className="z-[150]">{FONT_FAMILIES.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <Label className="text-[9px] uppercase font-bold">Size (px)</Label>
                            <Input type="number" value={selectedElement.style.fontSize} onChange={(e) => updateElementStyle(selectedElement.id, { fontSize: Number(e.target.value) })} className="h-8 text-xs" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[9px] uppercase font-bold">Weight</Label>
                            <Select value={selectedElement.style.fontWeight} onValueChange={(val) => updateElementStyle(selectedElement.id, { fontWeight: val })}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent className="z-[150]">
                                <SelectItem value="normal">Normal</SelectItem>
                                <SelectItem value="bold">Bold</SelectItem>
                                <SelectItem value="black">Black</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2">
                          <Label className="text-[9px] uppercase font-bold">Color</Label>
                          <div className="flex gap-2">
                            <Input type="color" value={selectedElement.style.color} onChange={(e) => updateElementStyle(selectedElement.id, { color: e.target.value })} className="h-8 w-10 p-1" />
                            <Input value={selectedElement.style.color} onChange={(e) => updateElementStyle(selectedElement.id, { color: e.target.value })} className="h-8 flex-1 font-mono text-[10px]" />
                          </div>
                        </div>
                        <div className="flex flex-col gap-2">
                          <Label className="text-[9px] uppercase font-bold">Alignment</Label>
                          <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
                            <Button variant={selectedElement.style.textAlign === 'left' ? "secondary" : "ghost"} size="icon" className="h-7 w-7" onClick={() => updateElementStyle(selectedElement.id, { textAlign: 'left' })}><AlignLeft className="h-3 w-3" /></Button>
                            <Button variant={selectedElement.style.textAlign === 'center' ? "secondary" : "ghost"} size="icon" className="h-7 w-7" onClick={() => updateElementStyle(selectedElement.id, { textAlign: 'center' })}><AlignCenter className="h-3 w-3" /></Button>
                            <Button variant={selectedElement.style.textAlign === 'right' ? "secondary" : "ghost"} size="icon" className="h-7 w-7" onClick={() => updateElementStyle(selectedElement.id, { textAlign: 'right' })}><AlignRight className="h-3 w-3" /></Button>
                            <Button variant={selectedElement.style.textAlign === 'justify' ? "secondary" : "ghost"} size="icon" className="h-7 w-7" onClick={() => updateElementStyle(selectedElement.id, { textAlign: 'justify' })}><AlignJustify className="h-3 w-3" /></Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {['rectangle', 'circle', 'line'].includes(selectedElement.type) && (
                    <div className="space-y-4">
                      <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block border-b pb-2">Appearance</Label>
                      <div className="grid gap-4">
                        {selectedElement.type !== 'line' && (
                          <div className="space-y-1">
                            <Label className="text-[9px] uppercase font-bold">Fill Color</Label>
                            <div className="flex gap-2">
                              <Input type="color" value={selectedElement.style.backgroundColor} onChange={(e) => updateElementStyle(selectedElement.id, { backgroundColor: e.target.value })} className="h-8 w-10 p-1" />
                              <Input value={selectedElement.style.backgroundColor} onChange={(e) => updateElementStyle(selectedElement.id, { backgroundColor: e.target.value })} className="h-8 flex-1 font-mono text-[10px]" />
                            </div>
                          </div>
                        )}
                        <div className="space-y-1">
                          <Label className="text-[9px] uppercase font-bold">Stroke Color</Label>
                          <div className="flex gap-2">
                            <Input type="color" value={selectedElement.style.borderColor} onChange={(e) => updateElementStyle(selectedElement.id, { borderColor: e.target.value })} className="h-8 w-10 p-1" />
                            <Input value={selectedElement.style.borderColor} onChange={(e) => updateElementStyle(selectedElement.id, { borderColor: e.target.value })} className="h-8 flex-1 font-mono text-[10px]" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <Label className="text-[9px] uppercase font-bold">Stroke (px)</Label>
                            <Input type="number" value={selectedElement.style.borderWidth} onChange={(e) => updateElementStyle(selectedElement.id, { borderWidth: Number(e.target.value) })} className="h-8 text-xs" />
                          </div>
                          {selectedElement.type === 'rectangle' && (
                            <div className="space-y-1">
                              <Label className="text-[9px] uppercase font-bold">Radius</Label>
                              <Input type="number" value={selectedElement.style.borderRadius} onChange={(e) => updateElementStyle(selectedElement.id, { borderRadius: Number(e.target.value) })} className="h-8 text-xs" />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* EFFECTS PANEL */}
                  <div className="space-y-4">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block border-b pb-2">Effects</Label>
                    <div className="space-y-2">
                      <Label className="text-[9px] uppercase font-bold">Opacity: {Math.round((selectedElement.style.opacity || 1) * 100)}%</Label>
                      <Slider value={[(selectedElement.style.opacity || 1) * 100]} onValueChange={([v]) => updateElementStyle(selectedElement.id, { opacity: v / 100 })} max={100} step={1} />
                    </div>
                  </div>

                  {/* LAYERING PANEL */}
                  <div className="space-y-4">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block border-b pb-2">Arrangement</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="outline" size="sm" className="text-[9px] font-bold uppercase h-8" onClick={() => moveElement('front')}><MoveUp className="h-3 w-3 mr-1.5" /> To Front</Button>
                      <Button variant="outline" size="sm" className="text-[9px] font-bold uppercase h-8" onClick={() => moveElement('back')}><MoveDown className="h-3 w-3 mr-1.5" /> To Back</Button>
                      <Button variant="outline" size="sm" className="text-[9px] font-bold uppercase h-8" onClick={() => moveElement('forward')}><ChevronUp className="h-3 w-3 mr-1.5" /> Forward</Button>
                      <Button variant="outline" size="sm" className="text-[9px] font-bold uppercase h-8" onClick={() => moveElement('backward')}><ChevronDown className="h-3 w-3 mr-1.5" /> Backward</Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-6 space-y-10 animate-in slide-in-from-right-4 duration-300">
                  <div className="space-y-8">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2 border-b pb-4"><Wallpaper className="h-4 w-4" /> Canvas Setup</h4>
                    
                    <div className="space-y-6">
                      <Label className="text-[10px] font-black uppercase opacity-50">Background Layer</Label>
                      
                      <Tabs defaultValue="library" className="w-full">
                        <TabsList className="grid w-full grid-cols-2 h-9 bg-slate-100 rounded-lg">
                          <TabsTrigger value="upload" className="text-[9px] font-black uppercase">Direct Upload</TabsTrigger>
                          <TabsTrigger value="library" className="text-[9px] font-black uppercase">Global Library</TabsTrigger>
                        </TabsList>
                        
                        <TabsContent value="upload" className="pt-4">
                          <div className="relative">
                            <Button variant="outline" size="sm" className="w-full text-[9px] font-black uppercase h-14 border-2 border-dashed border-slate-200">
                              <Upload className="h-4 w-4 mr-2 text-primary" /> Choose Image
                            </Button>
                            <Input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => {
                              const file = e.target.files?.[0]; if (!file) return;
                              const reader = new FileReader(); reader.onload = (evt) => setCurrentTemplate(prev => prev ? { ...prev, background: { ...prev.background!, image: evt.target?.result as string } } : null);
                              reader.readAsDataURL(file);
                            }} />
                          </div>
                        </TabsContent>
                        
                        <TabsContent value="library" className="pt-4 space-y-4">
                          <div className="grid grid-cols-3 gap-2 max-h-[200px] overflow-y-auto industrial-scroll p-1">
                            {libraryImages?.filter(img => img.tag === 'background' || img.tag === 'template').map(asset => (
                              <button 
                                key={asset.id} 
                                onClick={() => setCurrentTemplate(prev => prev ? { ...prev, background: { ...prev.background!, image: asset.url } } : null)}
                                className={cn(
                                  "aspect-square rounded-lg border-2 overflow-hidden transition-all bg-slate-50",
                                  currentTemplate?.background?.image === asset.url ? "border-primary ring-2 ring-primary/20" : "border-transparent hover:border-slate-300"
                                )}
                              >
                                <img src={asset.url} className="w-full h-full object-contain" alt="Asset" />
                              </button>
                            ))}
                          </div>
                          <Button variant="outline" size="sm" className="w-full text-[9px] font-black uppercase" onClick={() => { setLibraryContext('background'); setIsLibraryOpen(true); }}>
                            Full Library Browser
                          </Button>
                        </TabsContent>
                      </Tabs>

                      {currentTemplate?.background?.image && (
                        <div className="space-y-4 pt-4 animate-in fade-in">
                          <div className="space-y-2">
                            <Label className="text-[9px] uppercase font-bold">Background Opacity</Label>
                            <Slider value={[(currentTemplate.background?.opacity || 1) * 100]} onValueChange={([v]) => setCurrentTemplate(prev => prev ? { ...prev, background: { ...prev.background!, opacity: v/100 } } : null)} max={100} step={1} />
                          </div>
                          <Button variant="ghost" className="w-full text-rose-500 font-black uppercase text-[9px] h-8" onClick={() => setCurrentTemplate(prev => prev ? { ...prev, background: { ...prev.background!, image: "" } } : null)}>
                            <Eraser className="h-3 w-3 mr-2" /> Remove Background
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* GLOBAL IMAGE LIBRARY DIALOG */}
      <Dialog open={isLibraryOpen} onOpenChange={setIsLibraryOpen}>
        <DialogContent className="sm:max-w-[900px] p-0 overflow-hidden rounded-[2.5rem] border-none shadow-3xl flex flex-col h-[80vh] z-[150]">
          <div className="bg-slate-900 text-white p-8 shrink-0">
            <div className="flex justify-between items-center">
              <div className="space-y-1">
                <DialogTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-3">
                  <ImageIcon className="h-5 w-5 text-primary" /> Global Image Library
                </DialogTitle>
                <DialogDescription className="text-slate-400 text-[10px] font-bold uppercase tracking-tighter">Choose an asset from your central registry</DialogDescription>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setIsLibraryOpen(false)} className="text-white hover:bg-white/10"><X className="h-5 w-5" /></Button>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-8 bg-slate-50">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
              {libraryImages?.map((asset) => (
                <Card key={asset.id} className="group cursor-pointer border-none shadow-lg rounded-2xl overflow-hidden bg-white transition-all hover:ring-4 hover:ring-primary/20" onClick={() => handleSelectFromLibrary(asset)}>
                  <div className="aspect-square relative flex items-center justify-center p-4 bg-white">
                    <img src={asset.url} alt={asset.name} className="w-full h-full object-contain" />
                    <div className="absolute top-2 left-2">
                      <Badge className="bg-slate-900 text-white text-[8px] font-black uppercase border-none">{asset.tag}</Badge>
                    </div>
                    <div className="absolute inset-0 bg-primary/90 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Button variant="secondary" className="font-black text-[9px] uppercase tracking-widest">Select Asset</Button>
                    </div>
                  </div>
                  <div className="p-3 border-t">
                    <p className="text-[10px] font-black uppercase truncate text-slate-600">{asset.name}</p>
                  </div>
                </Card>
              ))}
              {(!libraryImages || libraryImages.length === 0) && (
                <div className="col-span-full py-20 text-center opacity-30 flex flex-col items-center gap-4">
                  <ImageIcon className="h-12 w-12" />
                  <p className="font-black uppercase text-[10px] tracking-widest">Library is empty. Upload assets in System Settings.</p>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isNewDialogOpen} onOpenChange={setIsNewDialogOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-3xl z-[150]">
          <form onSubmit={handleCreateTemplate}>
            <DialogHeader><DialogTitle className="text-xl font-black uppercase flex items-center gap-2"><Plus className="h-5 w-5 text-primary" /> Create Design</DialogTitle></DialogHeader>
            <div className="grid gap-6 py-6">
              <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-50">Template Name</Label><Input name="name" placeholder="e.g. Industrial Label v1" required className="h-11 rounded-xl border-2 font-bold" /></div>
              <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-50">Document Category</Label><Select name="documentType" required><SelectTrigger className="h-11 rounded-xl border-2 font-bold"><SelectValue placeholder="Select Category" /></SelectTrigger><SelectContent className="z-[200]"><SelectItem value="Tax Invoice">Tax Invoice</SelectItem><SelectItem value="Technical Job Card">Technical Job Card</SelectItem><SelectItem value="Industrial Label">Industrial Label</SelectItem><SelectItem value="Delivery Challan">Delivery Challan</SelectItem><SelectItem value="Purchase Order">Purchase Order</SelectItem><SelectItem value="Proforma">Proforma Invoice</SelectItem><SelectItem value="Report">Report / Audit Sheet</SelectItem></SelectContent></Select></div>
              <div className="space-y-4"><Label className="text-[10px] font-black uppercase opacity-50">Paper Specification</Label><Select name="paperSize" defaultValue="A4"><SelectTrigger className="h-11 rounded-xl border-2 bg-white font-bold"><SelectValue /></SelectTrigger><SelectContent className="z-[200]">{PAPER_SIZES.map(s => <SelectItem key={s.id} value={s.id}>{s.name} {s.id !== 'Custom' && `(${s.w}x${s.h}mm)`}</SelectItem>)}</SelectContent></Select><div className="grid grid-cols-2 gap-4"><div className="space-y-1"><Label className="text-[9px] uppercase font-bold text-slate-400">Width (mm)</Label><Input name="customWidth" type="number" placeholder="100" className="h-10 font-bold" /></div><div className="space-y-1"><Label className="text-[9px] uppercase font-bold text-slate-400">Height (mm)</Label><Input name="customHeight" type="number" placeholder="100" className="h-10 font-bold" /></div></div></div>
            </div>
            <DialogFooter><Button type="submit" className="w-full h-14 font-black uppercase tracking-widest rounded-2xl shadow-xl">Start Designing</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ElementTool({ icon: Icon, label, onClick }: { icon: any, label: string, onClick: () => void }) {
  return (<button onClick={onClick} className="flex flex-col items-center justify-center gap-2 p-4 bg-white border-2 border-slate-100 rounded-xl hover:border-primary/40 hover:bg-primary/5 transition-all group active:scale-95 shadow-sm"><Icon className="h-5 w-5 text-slate-400 group-hover:text-primary" /><span className="text-[9px] font-black uppercase text-slate-500 group-hover:text-primary tracking-tighter">{label}</span></button>)
}

function CanvasElement({ element, isSelected, onSelect, onMove, onResize, gridSnap, previewData }: { element: TemplateElement, isSelected: boolean, onSelect: (e: any) => void, onMove: (x: number, y: number) => void, onResize: (w: number, h: number) => void, gridSnap: number, previewData: Record<string, any> }) {
  const isDragging = useRef(false); const isResizing = useRef(false); const startPos = useRef({ x: 0, y: 0, w: 0, h: 0 });
  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation(); onSelect(e); if (element.isLocked) return;
    isDragging.current = true; startPos.current = { x: e.clientX - element.x, y: e.clientY - element.y, w: 0, h: 0 };
    const move = (m: MouseEvent) => { if (isDragging.current) onMove(Math.round((m.clientX - startPos.current.x) / (gridSnap || 1)) * (gridSnap || 1), Math.round((m.clientY - startPos.current.y) / (gridSnap || 1)) * (gridSnap || 1)); }
    const up = () => { isDragging.current = false; window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); }
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
  }
  const handleResizeStart = (e: React.MouseEvent) => {
    e.stopPropagation(); if (element.isLocked) return;
    isResizing.current = true; startPos.current = { x: e.clientX, y: e.clientY, w: element.width, h: element.height };
    const move = (m: MouseEvent) => { if (isResizing.current) onResize(Math.max(10, Math.round((startPos.current.w + (m.clientX - startPos.current.x)) / (gridSnap || 1)) * (gridSnap || 1)), element.type === 'line' ? element.height : Math.max(10, Math.round((startPos.current.h + (m.clientY - startPos.current.y)) / (gridSnap || 1)) * (gridSnap || 1))); }
    const up = () => { isResizing.current = false; window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); }
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
  }
  const getFontFamilyValue = (id: string) => FONT_FAMILIES.find(f => f.id === id)?.value || 'sans-serif';
  const processText = (text: string) => text?.replace(/\{\{(.+?)\}\}/g, (match, key) => previewData[key.trim()] !== undefined ? String(previewData[key.trim()]) : match);
  const isValidURL = (str: string) => str.startsWith("http://") || str.startsWith("https://");
  const commonStyle = { width: '100%', height: '100%', backgroundColor: element.style.backgroundColor, border: element.style.borderWidth ? `${element.style.borderWidth}px ${element.style.lineStyle || 'solid'} ${element.style.borderColor}` : 'none', borderRadius: element.type === 'circle' ? '100%' : `${element.style.borderRadius || 0}px`, opacity: element.style.opacity, display: 'flex', alignItems: 'center', justifyContent: element.style.textAlign === 'center' ? 'center' : element.style.textAlign === 'right' ? 'flex-end' : 'flex-start', overflow: 'hidden' };
  const textStyle = { fontSize: `${element.style.fontSize}px`, fontFamily: getFontFamilyValue(element.style.fontFamily), fontWeight: element.style.fontWeight, color: element.style.color, width: '100%', textAlign: element.style.textAlign || 'left' as any };
  const renderContent = () => {
    switch (element.type) {
      case 'text': case 'title': return <div style={{ ...commonStyle, padding: '4px' }}><span style={textStyle}>{processText(element.content || "")}</span></div>;
      case 'field': return <div style={{ ...commonStyle, padding: '4px' }}><span style={textStyle}>{processText(element.placeholder || "")}</span></div>;
      case 'table': const isSourceGrid = element.placeholder === 'sourceRolls'; return <div style={{ ...commonStyle, flexDirection: 'column', padding: 0 }}><div className="w-full bg-slate-900 text-white p-2 text-[8px] font-black uppercase flex justify-between">{isSourceGrid ? <><span>ROLL ID</span><span>ITEM</span><span>DIM</span><span>CO</span></> : <><span>ROLL ID</span><span>WIDTH</span><span>DEST</span></>}</div>{Array.from({ length: 3 }).map((_, i) => <div key={i} className="w-full border-b p-2 text-[8px] font-bold flex justify-between uppercase opacity-50">{isSourceGrid ? <><span>T-100{i}</span><span>CHROMO</span><span>400x3k</span><span>Avery</span></> : <><span>T-1001-{ALPHABET[i]}</span><span>250MM</span><span>JOB</span></>}</div>)}</div>;
      case 'barcode': const bv = (element.barcodeType === 'EAN13' || element.barcodeType === 'UPC') ? "123456789012" : processText(element.placeholder || "PREVIEW"); return <div style={commonStyle}><div style={{ transform: `scale(${Math.min(1, element.width / 150)})`, transformOrigin: 'center' }}><Barcode format={element.barcodeType as any || 'CODE128'} value={bv} height={element.height - 20} width={1.5} fontSize={10} /></div></div>;
      case 'qr': const qv = processText(element.placeholder || "PREVIEW"); return <div style={{ ...commonStyle, cursor: isValidURL(qv) ? 'pointer' : 'default' }} onClick={(e) => { if (isValidURL(qv)) { e.stopPropagation(); window.open(qv, "_blank"); } }} title={isValidURL(qv) ? "Click to open link" : ""}><QRCodeSVG value={qv} size={Math.min(element.width, element.height) - 10} /></div>;
      case 'rectangle': case 'circle': return <div style={commonStyle} />;
      case 'line': return <div style={{ ...commonStyle, height: `${element.style.borderWidth || 2}px`, border: 'none', backgroundColor: element.style.borderColor }} />;
      case 'image': return element.content ? <img src={element.content} alt="Element" style={{ width: '100%', height: '100%', objectFit: 'contain', opacity: element.style.opacity, borderRadius: commonStyle.borderRadius }} /> : <div className="w-full h-full border-2 border-dashed flex items-center justify-center text-[8px] uppercase font-bold opacity-30">No Asset</div>;
      default: return null;
    }
  }
  return (<div className={cn("absolute select-none group flex items-center justify-center transition-shadow", !element.isLocked && "cursor-move", isSelected && "ring-2 ring-primary ring-offset-2 z-[60] shadow-2xl", !isSelected && "hover:ring-1 hover:ring-primary/30")} style={{ left: `${element.x}px`, top: `${element.y}px`, width: `${element.width}px`, height: `${element.height}px`, transform: `rotate(${element.rotate}deg)` }} onMouseDown={handleMouseDown} onClick={(e) => e.stopPropagation()}>{element.isLocked && <div className="absolute top-[-10px] right-[-10px] z-[70] bg-slate-900 text-white rounded-full p-1 shadow-md"><Lock className="h-2 w-2" /></div>}{renderContent()}{isSelected && !element.isLocked && <div className="absolute bottom-[-6px] right-[-6px] w-4 h-4 bg-primary cursor-nwse-resize rounded-full border-2 border-white shadow-lg z-[70] print:hidden" onMouseDown={handleResizeStart} />}</div>)
}

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
