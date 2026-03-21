
"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { 
  Building2, 
  Image as ImageIcon, 
  Save, 
  Upload, 
  Loader2, 
  Trash2, 
  Copy, 
  Download, 
  Plus, 
  CheckCircle2, 
  Globe, 
  Mail, 
  Phone, 
  MapPin, 
  FileText,
  Shield,
  Tag,
  Filter,
  AlertTriangle,
  Smartphone,
  Maximize,
  Wallpaper
} from "lucide-react"
import { useFirestore, useUser, useDoc, useMemoFirebase, useCollection } from "@/firebase"
import { doc, setDoc, serverTimestamp, collection, deleteDoc, getDocs, query, where } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"

const ASSET_TAGS = [
  { id: 'logo', label: 'Company Logo' },
  { id: 'template', label: 'Label Asset' },
  { id: 'background', label: 'Background' },
  { id: 'qr', label: 'QR/Identity' },
  { id: 'other', label: 'Misc' },
];

export default function SettingsPage() {
  const { toast } = useToast()
  const { user } = useUser()
  const firestore = useFirestore()
  const [isMounted, setIsMounted] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [activeTagFilter, setActiveTagFilter] = useState("all")
  const [uploadTag, setUploadTag] = useState("template")

  useEffect(() => { setIsMounted(true) }, [])

  // 1. Company Settings Subscription
  const companyDocRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'company_settings', 'global');
  }, [firestore]);
  const { data: companySettings } = useDoc(companyDocRef);

  // 2. Image Library Subscription
  const libraryQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'image_library');
  }, [firestore]);
  const { data: libraryImages, isLoading: libraryLoading } = useCollection(libraryQuery);

  // 3. Templates for usage check
  const templatesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'print_templates');
  }, [firestore]);
  const { data: allTemplates } = useCollection(templatesQuery);

  const [companyForm, setCompanyForm] = useState({
    name: "",
    description: "",
    address: "",
    gst: "",
    contact: "",
    email: "",
    website: "",
    logo: "",
    loginBackground: "",
    pwaIcon192: "",
    pwaIcon512: "",
    favicon16: "",
    favicon32: "",
    appleTouchIcon: "",
    company_id: "default_company"
  })

  useEffect(() => {
    if (companySettings) {
      setCompanyForm({
        name: companySettings.name || "",
        description: companySettings.description || "",
        address: companySettings.address || "",
        gst: companySettings.gst || "",
        contact: companySettings.contact || "",
        email: companySettings.email || "",
        website: companySettings.website || "",
        logo: companySettings.logo || "",
        loginBackground: companySettings.loginBackground || "",
        pwaIcon192: companySettings.pwaIcon192 || "",
        pwaIcon512: companySettings.pwaIcon512 || "",
        favicon16: companySettings.favicon16 || "",
        favicon32: companySettings.favicon32 || "",
        appleTouchIcon: companySettings.appleTouchIcon || "",
        company_id: companySettings.company_id || "default_company"
      });
    }
  }, [companySettings]);

  /**
   * Industrial Image Processor: Format Normalization & Optimization
   */
  const processImage = (file: File, size: number, square: boolean = true): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (square) {
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d');
            if (!ctx) return reject("Canvas failure");
            const minDim = Math.min(img.width, img.height);
            const sx = (img.width - minDim) / 2;
            const sy = (img.height - minDim) / 2;
            ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);
            resolve(canvas.toDataURL('image/png'));
          } else {
            // For backgrounds, scale down if too large but maintain aspect ratio
            const scale = Math.min(size / width, 1);
            canvas.width = width * scale;
            canvas.height = height * scale;
            const ctx = canvas.getContext('2d');
            if (!ctx) return reject("Canvas failure");
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/jpeg', 0.8)); // JPEG for backgrounds
          }
        };
      };
      reader.onerror = reject;
    });
  };

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !user) return;
    setIsSaving(true);
    try {
      await setDoc(doc(firestore, 'company_settings', 'global'), {
        ...companyForm,
        updatedAt: serverTimestamp(),
        updatedBy: user.uid
      }, { merge: true });
      toast({ title: "Corporate Settings Saved", description: "Identity, branding, and PWA assets updated." });
    } catch (e) {
      toast({ variant: "destructive", title: "Save Failed" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({ variant: "destructive", title: "Invalid File", description: "Only image files are allowed." });
      return;
    }

    setIsUploading(true);
    toast({ title: "Optimizing Branding...", description: "Generating PWA iconset and favicons." });

    try {
      const mainLogo = await processImage(file, 512, true); 
      const icon192 = await processImage(file, 192, true);
      const icon512 = await processImage(file, 512, true);
      const fav16 = await processImage(file, 16, true);
      const fav32 = await processImage(file, 32, true);
      const appleIcon = await processImage(file, 180, true);

      setCompanyForm(prev => ({ 
        ...prev, 
        logo: mainLogo,
        pwaIcon192: icon192,
        pwaIcon512: icon512,
        favicon16: fav16,
        favicon32: fav32,
        appleTouchIcon: appleIcon
      }));
      
      toast({ title: "Branding Ready", description: "Logo optimized for web and app installation." });
    } catch (err) {
      toast({ variant: "destructive", title: "Processing Error", description: "Could not generate technical icon set." });
    } finally {
      setIsUploading(false);
    }
  };

  const handleBackgroundUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    toast({ title: "Processing Wallpaper...", description: "Optimizing resolution for login portal." });
    try {
      const base64 = await processImage(file, 1920, false);
      setCompanyForm(prev => ({ ...prev, loginBackground: base64 }));
      toast({ title: "Background Ready", description: "Wallpaper will be applied to the login page." });
    } catch (err) {
      toast({ variant: "destructive", title: "Error", description: "Could not process background image." });
    } finally {
      setIsUploading(false);
    }
  };

  const handleLibraryUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !firestore || !user) return;
    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const base64 = evt.target?.result as string;
        const id = crypto.randomUUID();
        await setDoc(doc(firestore, 'image_library', id), {
          id,
          name: file.name,
          url: base64,
          tag: uploadTag,
          company_id: "default_company",
          uploadedAt: serverTimestamp(),
          uploadedBy: user.uid,
          size: file.size,
          type: file.type
        });
        toast({ title: "Asset Added to Library" });
      } catch (err) {
        toast({ variant: "destructive", title: "Upload Failed" });
      } finally {
        setIsUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteAsset = async (asset: any) => {
    if (!firestore) return;

    // PROTECTION LOGIC
    const isUsedInLogo = companyForm.logo === asset.url;
    const isUsedInTemplate = allTemplates?.some(t => 
      t.elements?.some((el: any) => el.type === 'image' && el.content === asset.url) ||
      t.background?.image === asset.url
    );

    if (isUsedInLogo || isUsedInTemplate) {
      toast({ 
        variant: "destructive", 
        title: "Delete Blocked", 
        description: "This asset is currently in use by a template or company profile." 
      });
      return;
    }

    if (!confirm("Delete this asset permanently?")) return;
    
    try {
      await deleteDoc(doc(firestore, 'image_library', asset.id));
      toast({ title: "Asset Removed" });
    } catch (e) {
      toast({ variant: "destructive", title: "Error deleting" });
    }
  };

  const filteredAssets = libraryImages?.filter(img => 
    activeTagFilter === "all" || img.tag === activeTagFilter
  ) || [];

  if (!isMounted) return null;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 font-sans pb-20">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-3xl font-black text-primary uppercase tracking-tighter">System Settings</h2>
          <p className="text-muted-foreground font-medium text-xs tracking-widest uppercase">Global Branding & Asset Management</p>
        </div>
      </div>

      <Tabs defaultValue="company" className="w-full">
        <TabsList className="bg-slate-100 p-1 rounded-xl mb-8">
          <TabsTrigger value="company" className="px-8 font-black text-[10px] uppercase tracking-widest gap-2">
            <Building2 className="h-4 w-4" /> Company Profile
          </TabsTrigger>
          <TabsTrigger value="library" className="px-8 font-black text-[10px] uppercase tracking-widest gap-2">
            <ImageIcon className="h-4 w-4" /> Image Library
          </TabsTrigger>
        </TabsList>

        <TabsContent value="company">
          <Card className="border-none shadow-xl rounded-3xl overflow-hidden bg-white">
            <CardHeader className="bg-slate-900 text-white p-8">
              <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-3">
                <Building2 className="h-5 w-5 text-primary" /> Corporate Identity
              </CardTitle>
              <CardDescription className="text-slate-400 text-xs font-medium uppercase tracking-widest">Branding used for Invoices, Portals, and PWA App Icons</CardDescription>
            </CardHeader>
            <CardContent className="p-8">
              <form onSubmit={handleSaveCompany} className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                {/* Logo & Wallpaper Section */}
                <div className="space-y-8">
                  <div className="space-y-4">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Master Brand Logo</Label>
                    <div className="relative group aspect-square bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl overflow-hidden flex flex-col items-center justify-center gap-4 transition-all hover:border-primary/40 hover:bg-primary/5">
                      {companyForm.logo ? (
                        <>
                          <img src={companyForm.logo} alt="Logo" className="w-full h-full object-contain p-8" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                            <Label htmlFor="logo-upload" className="cursor-pointer bg-white text-black px-6 py-2 rounded-xl font-black text-[10px] uppercase shadow-xl text-center">Change Logo</Label>
                          </div>
                        </>
                      ) : (
                        <Label htmlFor="logo-upload" className="cursor-pointer flex flex-col items-center gap-2 group">
                          <Upload className="h-10 w-10 text-slate-300 group-hover:text-primary transition-colors" />
                          <span className="text-[10px] font-black uppercase text-slate-400">Upload Logo</span>
                        </Label>
                      )}
                      <input id="logo-upload" type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={isUploading} />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                      <Wallpaper className="h-3 w-3" /> Login Portal Wallpaper
                    </Label>
                    <div className="relative group aspect-video bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl overflow-hidden flex flex-col items-center justify-center gap-2 transition-all hover:border-primary/40 hover:bg-primary/5">
                      {companyForm.loginBackground ? (
                        <>
                          <img src={companyForm.loginBackground} alt="Wallpaper" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                            <Label htmlFor="bg-upload" className="cursor-pointer bg-white text-black px-4 py-1.5 rounded-lg font-black text-[9px] uppercase shadow-xl text-center">Update Wallpaper</Label>
                          </div>
                        </>
                      ) : (
                        <Label htmlFor="bg-upload" className="cursor-pointer flex flex-col items-center gap-1.5 group">
                          <ImageIcon className="h-6 w-6 text-slate-300 group-hover:text-primary" />
                          <span className="text-[9px] font-black uppercase text-slate-400">Add Background</span>
                        </Label>
                      )}
                      <input id="bg-upload" type="file" accept="image/*" className="hidden" onChange={handleBackgroundUpload} disabled={isUploading} />
                    </div>
                    <p className="text-[8px] text-muted-foreground font-medium text-center uppercase tracking-tighter">Recommended resolution: 1920x1080px</p>
                  </div>

                  {/* Icon & Favicon Previews */}
                  <div className="space-y-6 pt-4 border-t">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                      <Smartphone className="h-3 w-3" /> Technical Iconset
                    </Label>
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <div className="w-full aspect-square bg-slate-50 border rounded-xl overflow-hidden shadow-inner flex items-center justify-center">
                          {companyForm.pwaIcon192 ? (
                            <img src={companyForm.pwaIcon192} className="w-full h-full object-cover" alt="192" />
                          ) : (
                            <div className="opacity-20"><ImageIcon className="h-4 w-4" /></div>
                          )}
                        </div>
                        <p className="text-[8px] font-black text-center text-slate-400 uppercase">App Icon (192px)</p>
                      </div>
                      <div className="space-y-2">
                        <div className="w-full aspect-square bg-slate-50 border rounded-xl overflow-hidden shadow-inner flex items-center justify-center">
                          {companyForm.appleTouchIcon ? (
                            <img src={companyForm.appleTouchIcon} className="w-full h-full object-cover" alt="Apple" />
                          ) : (
                            <div className="opacity-20"><ImageIcon className="h-4 w-4" /></div>
                          )}
                        </div>
                        <p className="text-[8px] font-black text-center text-slate-400 uppercase">Apple Touch</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-xl border border-dashed">
                      <div className="w-8 h-8 bg-white border rounded shadow-sm flex items-center justify-center overflow-hidden">
                        {companyForm.favicon32 && <img src={companyForm.favicon32} className="w-full h-full" alt="Fav32" />}
                      </div>
                      <div className="flex-1">
                        <p className="text-[9px] font-black uppercase text-slate-600">Browser Tab Favicon</p>
                        <p className="text-[8px] font-bold text-slate-400 uppercase">Automatic generation active</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Details Section */}
                <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400">Company Name</Label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-3.5 h-4 w-4 text-slate-300" />
                      <Input value={companyForm.name} onChange={e => setCompanyForm({...companyForm, name: e.target.value})} className="h-12 pl-10 rounded-xl border-2 font-bold bg-slate-50" placeholder="e.g. Shree Label Creation" required />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400">GST Number</Label>
                    <div className="relative">
                      <Shield className="absolute left-3 top-3.5 h-4 w-4 text-slate-300" />
                      <Input value={companyForm.gst} onChange={e => setCompanyForm({...companyForm, gst: e.target.value})} className="h-12 pl-10 rounded-xl border-2 font-bold bg-slate-50" placeholder="18AABCU1234F1Z1" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400">Contact Number</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-3.5 h-4 w-4 text-slate-300" />
                      <Input value={companyForm.contact} onChange={e => setCompanyForm({...companyForm, contact: e.target.value})} className="h-12 pl-10 rounded-xl border-2 font-bold bg-slate-50" placeholder="+91 98765 43210" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400">Email Address</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3.5 h-4 w-4 text-slate-300" />
                      <Input value={companyForm.email} onChange={e => setCompanyForm({...companyForm, email: e.target.value})} className="h-12 pl-10 rounded-xl border-2 font-bold bg-slate-50" placeholder="accounts@shreelabel.com" />
                    </div>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400">Full Office Address</Label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-3.5 h-4 w-4 text-slate-300" />
                      <Textarea value={companyForm.address} onChange={e => setCompanyForm({...companyForm, address: e.target.value})} className="min-h-[100px] pl-10 rounded-xl border-2 font-bold bg-slate-50 p-4" placeholder="Enter physical location for invoices..." />
                    </div>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400">Company Description / Slogan</Label>
                    <Textarea value={companyForm.description} onChange={e => setCompanyForm({...companyForm, description: e.target.value})} className="min-h-[80px] rounded-xl border-2 font-bold bg-slate-50 p-4" placeholder="e.g. Leading narrow web flexo printer..." />
                  </div>
                  <div className="md:col-span-2 pt-4">
                    <Button type="submit" disabled={isSaving || isUploading} className="w-full h-14 rounded-2xl bg-primary hover:bg-primary/90 text-white font-black uppercase text-xs tracking-widest shadow-2xl">
                      {isSaving ? <Loader2 className="animate-spin h-5 w-5 mr-2" /> : <Save className="mr-2 h-5 w-5" />}
                      Update Corporate Identity
                    </Button>
                  </div>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="library">
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div className="space-y-1">
                <h3 className="text-xl font-black uppercase tracking-tight">Asset Repository</h3>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">Global library for branding and technical media</p>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
                  <Button variant={activeTagFilter === 'all' ? 'default' : 'ghost'} size="sm" onClick={() => setActiveTagFilter('all')} className="text-[9px] font-black uppercase h-8 px-4 rounded-lg">All</Button>
                  {ASSET_TAGS.map(t => (
                    <Button key={t.id} variant={activeTagFilter === t.id ? 'default' : 'ghost'} size="sm" onClick={() => setActiveTagFilter(t.id)} className="text-[9px] font-black uppercase h-8 px-4 rounded-lg">{t.label}</Button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <Select value={uploadTag} onValueChange={setUploadTag}>
                    <SelectTrigger className="h-12 w-40 rounded-xl border-2 font-bold text-[10px] uppercase">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      {ASSET_TAGS.map(t => <SelectItem key={t.id} value={t.id} className="text-[10px] font-bold uppercase">{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  
                  <Label htmlFor="library-upload" className="cursor-pointer h-12 px-8 rounded-xl bg-slate-900 hover:bg-black text-white font-black uppercase text-[10px] tracking-widest flex items-center justify-center shadow-xl transition-all active:scale-95">
                    {isUploading ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2 text-primary" />}
                    Upload Media
                    <input id="library-upload" type="file" accept="image/*" className="hidden" onChange={handleLibraryUpload} />
                  </Label>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
              {libraryLoading ? (
                <div className="col-span-full py-20 text-center"><Loader2 className="animate-spin h-10 w-10 mx-auto text-primary" /></div>
              ) : filteredAssets.length === 0 ? (
                <div className="col-span-full py-20 border-4 border-dashed rounded-3xl flex flex-col items-center justify-center opacity-30 gap-4">
                  <ImageIcon className="h-16 w-16" />
                  <p className="text-sm font-black uppercase tracking-widest">No assets found in this category</p>
                </div>
              ) : filteredAssets.map((asset) => (
                <Card key={asset.id} className="group border-none shadow-lg rounded-2xl overflow-hidden bg-white transition-all hover:scale-105">
                  <div className="aspect-square bg-slate-50 relative flex items-center justify-center p-4">
                    <img src={asset.url} alt={asset.name} className="w-full h-full object-contain" />
                    <div className="absolute top-2 left-2">
                      <Badge className="bg-slate-900/60 text-white text-[8px] font-black border-none uppercase backdrop-blur-md">{asset.tag}</Badge>
                    </div>
                    <div className="absolute inset-0 bg-slate-900/80 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-4">
                      <Button variant="ghost" size="sm" className="w-full text-white hover:bg-white/10 font-bold uppercase text-[9px]" onClick={() => { navigator.clipboard.writeText(asset.url); toast({ title: "URL Copied" }); }}>
                        <Copy className="h-3 w-3 mr-2" /> Copy URL
                      </Button>
                      <Button variant="ghost" size="sm" className="w-full text-white hover:bg-white/10 font-bold uppercase text-[9px]" asChild>
                        <a href={asset.url} download={asset.name}>
                          <Download className="h-3 w-3 mr-2" /> Export
                        </a>
                      </Button>
                      <Button variant="ghost" size="sm" className="w-full text-rose-400 hover:bg-rose-500 hover:text-white font-bold uppercase text-[9px]" onClick={() => handleDeleteAsset(asset)}>
                        <Trash2 className="h-3 w-3 mr-2" /> Delete
                      </Button>
                    </div>
                  </div>
                  <div className="p-3 border-t">
                    <p className="text-[10px] font-black uppercase truncate text-slate-600" title={asset.name}>{asset.name}</p>
                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">{Math.round(asset.size / 1024)} KB • {asset.type?.split('/')[1]}</p>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
