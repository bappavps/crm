
"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  ScanLine, 
  Search, 
  Trash2, 
  CheckCircle2, 
  AlertTriangle, 
  History, 
  Save, 
  Loader2, 
  FileSpreadsheet, 
  ArrowRight,
  Database,
  Plus,
  RefreshCw,
  X,
  FileDown,
  Info,
  PackageCheck,
  Camera,
  StopCircle,
  ArrowUp
} from "lucide-react"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog"
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useFirestore, useUser, useCollection, useMemoFirebase, useDoc } from "@/firebase"
import { collection, doc, query, orderBy, limit, setDoc, serverTimestamp, deleteDoc, writeBatch } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import * as XLSX from 'xlsx'
import { format } from "date-fns"
import { Html5QrcodeScanner } from "html5-qrcode"

/**
 * PHYSICAL PAPER STOCK CHECK (V1.7)
 * Normalization: URL → Roll ID Display
 */

interface ScannedRoll {
  id: string;
  rollNo: string;
  paperType: string;
  dimension: string;
  scanTime: string;
  status: 'Matched' | 'Unknown' | 'Duplicate';
}

export default function PhysicalStockAuditPage() {
  const { toast } = useToast()
  const { user } = useUser()
  const firestore = useFirestore()
  const [isMounted, setIsMounted] = useState(false)
  
  const [scanInput, setScanInput] = useState("")
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [isNewSessionOpen, setIsNewSessionOpen] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isCameraActive, setIsCameraActive] = useState(false)
  
  // Feedback State
  const [scanFeedback, setScanFeedback] = useState<'success' | 'error' | 'warning' | null>(null)
  const [highlightedRowId, setHighlightedRowId] = useState<string | null>(null)
  const feedbackTimeout = useRef<NodeJS.Timeout | null>(null)
  const lastSoundTime = useRef<number>(0)
  
  const scanInputRef = useRef<HTMLInputElement>(null)
  const scannerInstance = useRef<Html5QrcodeScanner | null>(null)

  useEffect(() => { 
    setIsMounted(true);
    if (scanInputRef.current) scanInputRef.current.focus();
  }, [])

  // 1. Data Subscriptions
  const adminDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'adminUsers', user.uid);
  }, [firestore, user]);
  const { data: adminData } = useDoc(adminDocRef);
  const isAdmin = !!adminData;

  const sessionsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'inventory_audits'), orderBy('createdAt', 'desc'), limit(100));
  }, [firestore]);
  
  const { data: sessions, isLoading: sessionsLoading } = useCollection(sessionsQuery);

  const uniqueSessions = useMemo(() => {
    if (!sessions) return [];
    const seenIds = new Set();
    const seenNames = new Set();
    return sessions.filter(s => {
      const id = s.id;
      const name = s.sessionName;
      if (!id || seenIds.has(id) || (name && seenNames.has(name))) return false;
      seenIds.add(id);
      if (name) seenNames.add(name);
      return true;
    });
  }, [sessions]);

  const activeSessionRef = useMemoFirebase(() => {
    if (!firestore || !activeSessionId) return null;
    return doc(firestore, 'inventory_audits', activeSessionId);
  }, [firestore, activeSessionId]);
  const { data: sessionData } = useDoc(activeSessionRef);

  const erpRollsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'paper_stock'), limit(5000));
  }, [firestore]);
  const { data: erpRolls } = useCollection(erpRollsQuery);

  const scannedRolls: ScannedRoll[] = useMemo(() => sessionData?.scannedRolls || [], [sessionData]);

  /**
   * AUDIO FEEDBACK SYNTHESIZER
   */
  const triggerScanFeedback = (type: 'success' | 'error' | 'warning') => {
    const now = Date.now();
    if (now - lastSoundTime.current < 500) return; 
    lastSoundTime.current = now;

    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      if (type === 'success') {
        oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.1);
      } else if (type === 'warning') {
        oscillator.frequency.setValueAtTime(440, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.2);
      } else {
        oscillator.frequency.setValueAtTime(220, audioCtx.currentTime);
        oscillator.type = 'square';
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.3);
      }
    } catch (e) {}

    setScanFeedback(type);
    if (feedbackTimeout.current) clearTimeout(feedbackTimeout.current);
    feedbackTimeout.current = setTimeout(() => setScanFeedback(null), 800);
  };

  // 2. Reconciliation Logic
  const reconciliation = useMemo(() => {
    if (!erpRolls || !scannedRolls) return { matched: [], missing: [], extra: [], stats: { totalERP: 0, totalScanned: 0, matchedCount: 0, missingCount: 0, extraCount: 0 } };

    const erpMap = new Map(erpRolls.map(r => [r.rollNo, r]));
    const matched: any[] = [];
    const extra: any[] = [];
    
    scannedRolls.forEach(sr => {
      if (erpMap.has(sr.rollNo)) {
        matched.push(erpMap.get(sr.rollNo));
      } else {
        extra.push(sr);
      }
    });

    const scannedIds = new Set(scannedRolls.map(r => r.rollNo));
    const missing = erpRolls.filter(r => !scannedIds.has(r.rollNo) && r.status !== 'Consumed');

    return {
      matched,
      missing,
      extra,
      stats: {
        totalERP: erpRolls.filter(r => r.status !== 'Consumed').length,
        totalScanned: scannedRolls.length,
        matchedCount: matched.length,
        missingCount: missing.length,
        extraCount: extra.length
      }
    };
  }, [erpRolls, scannedRolls]);

  /**
   * CENTRAL SUBMIT LOGIC (Manual Flow)
   */
  const processSubmission = async () => {
    const rawValue = scanInput.trim();
    if (!rawValue || !activeSessionId || !firestore || !user) return;

    // Normalization: Extract Roll ID from URL if necessary
    let rollNo = rawValue;
    if (rollNo.includes('/')) {
      rollNo = rollNo.split('/').pop() || rollNo;
    }
    rollNo = rollNo.toUpperCase();

    // Duplicate Check
    if (scannedRolls.some(r => r.rollNo === rollNo)) {
      triggerScanFeedback('error');
      toast({ 
        variant: "destructive", 
        title: "Duplicate Roll", 
        description: `Roll ${rollNo} is already in the list.` 
      });
      return;
    }

    const erpMatch = erpRolls?.find(r => r.rollNo === rollNo);
    const newScanId = crypto.randomUUID();
    const newScan: ScannedRoll = {
      id: newScanId,
      rollNo,
      paperType: erpMatch?.paperType || "UNKNOWN",
      dimension: erpMatch ? `${erpMatch.widthMm}mm x ${erpMatch.lengthMeters}m` : "N/A",
      scanTime: new Date().toISOString(),
      status: erpMatch ? 'Matched' : 'Unknown'
    };

    const updatedScans = [...scannedRolls, newScan];
    
    try {
      await setDoc(doc(firestore, 'inventory_audits', activeSessionId), {
        scannedRolls: updatedScans,
        updatedAt: serverTimestamp()
      }, { merge: true });

      setHighlightedRowId(newScanId);
      setTimeout(() => setHighlightedRowId(null), 1000);

      if (erpMatch) {
        triggerScanFeedback('success');
        toast({ title: "Scan Added Successfully", description: `Roll ${rollNo} verified.` });
      } else {
        triggerScanFeedback('warning');
        toast({ variant: "destructive", title: "Unknown Roll Added", description: `Roll ${rollNo} not found in ERP.` });
      }
    } catch (e) {
      toast({ variant: "destructive", title: "Sync Error" });
    }
    
    // Clear and focus
    setScanInput("");
    if (scanInputRef.current) scanInputRef.current.focus();
  };

  const handleManualSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    processSubmission();
  };

  const handleDeleteScannedRow = async (id: string) => {
    if (!firestore || !activeSessionId || !isAdmin) return;
    
    const updatedScans = scannedRolls.filter(r => r.id !== id);
    await setDoc(doc(firestore, 'inventory_audits', activeSessionId), {
      scannedRolls: updatedScans,
      updatedAt: serverTimestamp()
    }, { merge: true });
    
    toast({ title: "Scan Removed", description: "Entry deleted from session." });
  };

  const startCamera = () => {
    setIsCameraActive(true);
    setTimeout(() => {
      const scanner = new Html5QrcodeScanner("camera-reader", { fps: 10, qrbox: { width: 250, height: 250 } }, false);
      scanner.render((decodedText) => {
        // Camera only populates input field with normalized value
        let normalized = decodedText;
        if (normalized.includes('/')) {
          normalized = normalized.split('/').pop() || normalized;
        }
        setScanInput(normalized);
        toast({ title: "Roll ID Scanned", description: "Click Submit to process." });
      }, () => {});
      scannerInstance.current = scanner;
    }, 100);
  };

  const stopCamera = () => {
    if (scannerInstance.current) {
      scannerInstance.current.clear().catch(console.error);
      scannerInstance.current = null;
    }
    setIsCameraActive(false);
  };

  const handleCreateSession = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firestore || !user) return;
    const fd = new FormData(e.currentTarget);
    const name = fd.get("sessionName") as string;
    
    const id = `AUDIT-${format(new Date(), 'yyyyMMdd')}-${Math.floor(1000 + Math.random() * 9000)}`;
    await setDoc(doc(firestore, 'inventory_audits', id), {
      id,
      sessionName: name,
      status: 'In Progress',
      scannedRolls: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdById: user.uid,
      createdByName: user.displayName || user.email
    });

    setActiveSessionId(id);
    setIsNewSessionOpen(false);
    toast({ title: "Audit Session Started" });
  }

  const handleFinalize = async () => {
    if (!firestore || !activeSessionId || !isAdmin) return;
    if (!confirm("Finalize audit? This will lock the records for this session.")) return;

    setIsProcessing(true);
    try {
      await setDoc(doc(firestore, 'inventory_audits', activeSessionId), {
        status: 'Finalized',
        finalStats: reconciliation.stats,
        finalizedAt: serverTimestamp(),
        finalizedById: user.uid
      }, { merge: true });
      toast({ title: "Audit Finalized & Locked" });
    } catch (e) {
      toast({ variant: "destructive", title: "Finalization Failed" });
    } finally {
      setIsProcessing(false);
    }
  }

  const handleExport = () => {
    const data = [
      { Category: 'SUMMARY', Metric: 'Total ERP Rolls', Value: reconciliation.stats.totalERP },
      { Category: 'SUMMARY', Metric: 'Total Scanned', Value: reconciliation.stats.totalScanned },
      { Category: 'SUMMARY', Metric: 'Matched', Value: reconciliation.stats.matchedCount },
      { Category: 'SUMMARY', Metric: 'Missing', Value: reconciliation.stats.missingCount },
      { Category: 'SUMMARY', Metric: 'Extra', Value: reconciliation.stats.extraCount },
      {},
      { Category: 'MISSING ROLLS', 'Roll ID': 'Description', Dimension: 'Status' },
      ...reconciliation.missing.map(r => ({ Category: 'MISSING', 'Roll ID': r.rollNo, Description: r.paperType, Dimension: `${r.widthMm}mm x ${r.lengthMeters}m` })),
      {},
      { Category: 'EXTRA ROLLS', 'Roll ID': 'Description', Dimension: 'Status' },
      ...reconciliation.extra.map(r => ({ Category: 'EXTRA', 'Roll ID': r.rollNo, Description: r.paperType, Dimension: r.dimension }))
    ];

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Audit Report");
    XLSX.writeFile(wb, `Stock_Audit_${sessionData?.sessionName || 'Report'}.xlsx`);
  }

  const handleRemoveMissing = async () => {
    if (!firestore || !isAdmin || reconciliation.missing.length === 0) return;
    if (!confirm(`Mark all ${reconciliation.missing.length} missing rolls as 'Consumed' in ERP?`)) return;

    setIsProcessing(true);
    try {
      const batch = writeBatch(firestore);
      reconciliation.missing.forEach(r => {
        batch.update(doc(firestore, 'paper_stock', r.id), {
          status: 'Consumed',
          remarks: `System deducted during audit: ${sessionData?.sessionName}`,
          dateOfUsed: new Date().toISOString().split('T')[0],
          updatedAt: serverTimestamp()
        });
      });
      await batch.commit();
      toast({ title: "Inventory Adjusted", description: "Missing rolls marked as consumed." });
    } catch (e) {
      toast({ variant: "destructive", title: "Batch Update Failed" });
    } finally {
      setIsProcessing(false);
    }
  }

  if (!isMounted) return null;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-[1600px] mx-auto pb-20 font-sans">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-3xl font-black text-primary uppercase tracking-tighter flex items-center gap-3">
            <ScanLine className="h-8 w-8" /> Physical Stock Check
          </h2>
          <p className="text-muted-foreground font-medium text-xs tracking-widest uppercase">Monthly Technical Substrate Verification Hub</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={activeSessionId || ""} onValueChange={setActiveSessionId}>
            <SelectTrigger className="w-[250px] h-11 bg-white border-2 rounded-xl font-bold uppercase text-[10px]">
              <SelectValue placeholder="Select Audit Session" />
            </SelectTrigger>
            <SelectContent className="z-[100]">
              {sessionsLoading ? (
                <div className="flex items-center justify-center py-4"><Loader2 className="h-4 w-4 animate-spin" /></div>
              ) : uniqueSessions.map(s => (
                <SelectItem key={s.id} value={s.id} className="font-bold text-[10px] uppercase">
                  {s.sessionName} ({s.status})
                </SelectItem>
              ))}
              {uniqueSessions.length === 0 && !sessionsLoading && <SelectItem value="none" disabled>No Sessions Found</SelectItem>}
            </SelectContent>
          </Select>
          <Button onClick={() => setIsNewSessionOpen(true)} className="h-11 px-6 bg-primary shadow-lg rounded-xl font-black uppercase text-[10px] tracking-widest">
            <Plus className="mr-2 h-4 w-4" /> Start New Session
          </Button>
        </div>
      </div>

      {!activeSessionId ? (
        <Card className="border-4 border-dashed rounded-[2.5rem] bg-slate-50/50">
          <CardContent className="p-24 text-center space-y-6">
            <div className="h-20 w-20 bg-white rounded-full flex items-center justify-center mx-auto shadow-xl">
              <History className="h-10 w-10 text-slate-300" />
            </div>
            <div className="space-y-2 max-w-sm mx-auto">
              <h3 className="text-xl font-black uppercase">No Active Audit</h3>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest leading-loose">
                Select an existing audit session from the dropdown or start a new monthly check to begin scanning rolls.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* SCAN TERMINAL */}
          <div className="lg:col-span-4 space-y-6">
            <Card className={cn(
              "border-none shadow-2xl rounded-3xl overflow-hidden transition-all duration-300",
              scanFeedback === 'success' ? "ring-8 ring-emerald-500/50 bg-emerald-950 scale-[1.02]" : 
              scanFeedback === 'error' ? "ring-8 ring-rose-500/50 bg-rose-950 scale-[1.02]" : 
              scanFeedback === 'warning' ? "ring-8 ring-amber-500/50 bg-amber-950 scale-[1.02]" : "bg-slate-900",
              "text-white"
            )}>
              <CardHeader className="bg-primary/10 border-b border-white/5 p-6">
                <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
                  <ScanLine className="h-4 w-4 text-primary" /> Scan Terminal
                </CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-6">
                <div className="space-y-4">
                  {isCameraActive ? (
                    <div className="space-y-4 animate-in zoom-in-95">
                      <div id="camera-reader" className="w-full overflow-hidden rounded-2xl bg-black aspect-square" />
                      <Button onClick={stopCamera} variant="destructive" className="w-full h-12 font-black uppercase text-[10px]">
                        <StopCircle className="mr-2 h-4 w-4" /> Close Camera
                      </Button>
                    </div>
                  ) : (
                    <Button 
                      onClick={startCamera} 
                      className="w-full h-16 bg-white/5 border-2 border-dashed border-white/20 hover:bg-white/10 text-white font-black uppercase text-xs tracking-widest rounded-2xl"
                      disabled={sessionData?.status === 'Finalized'}
                    >
                      <Camera className="mr-3 h-6 w-6 text-primary" /> Start Mobile Scan
                    </Button>
                  )}

                  <form onSubmit={handleManualSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase opacity-50">Roll ID Entry</Label>
                      <Input 
                        ref={scanInputRef}
                        placeholder="Scan or Type ID..."
                        className={cn(
                          "h-14 border-white/10 text-white text-xl font-black tracking-tighter placeholder:text-white/20 rounded-2xl focus-visible:ring-primary focus-visible:border-primary transition-colors",
                          scanFeedback === 'success' ? "bg-emerald-500/20" : 
                          scanFeedback === 'error' ? "bg-rose-500/20" : 
                          scanFeedback === 'warning' ? "bg-amber-500/20" : "bg-white/5"
                        )}
                        value={scanInput}
                        onChange={e => setScanInput(e.target.value)}
                        disabled={sessionData?.status === 'Finalized'}
                      />
                    </div>
                    <Button 
                      type="submit" 
                      className="w-full h-14 bg-primary text-white font-black uppercase text-xs tracking-widest rounded-2xl shadow-xl hover:bg-primary/90 transition-all active:scale-95"
                      disabled={sessionData?.status === 'Finalized' || !scanInput.trim()}
                    >
                      Commit Scan to List
                    </Button>
                  </form>
                </div>

                <div className="pt-6 border-t border-white/5 space-y-4">
                  <div className="flex justify-between items-center bg-white/5 p-4 rounded-2xl">
                    <div>
                      <p className="text-[10px] font-black uppercase opacity-50">Verified Progress</p>
                      <p className="text-2xl font-black tracking-tighter">{reconciliation.stats.matchedCount} / {reconciliation.stats.totalERP}</p>
                    </div>
                    <Badge className="bg-primary text-white font-black text-[10px]">
                      {Math.round((reconciliation.stats.matchedCount / reconciliation.stats.totalERP) * 100) || 0}%
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-xl rounded-3xl overflow-hidden">
              <CardHeader className="bg-slate-50 border-b p-6">
                <CardTitle className="text-xs font-black uppercase tracking-widest">Audit Session Summary</CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <SummaryRow label="Total ERP Registry" value={reconciliation.stats.totalERP} icon={Database} />
                <SummaryRow label="Physical Scanned" value={reconciliation.stats.totalScanned} icon={ScanLine} />
                <SummaryRow label="Verified Matches" value={reconciliation.stats.matchedCount} icon={CheckCircle2} color="text-emerald-600" />
                <SummaryRow label="Missing From Floor" value={reconciliation.stats.missingCount} icon={AlertTriangle} color="text-rose-600" />
                <SummaryRow label="Extra / Found Rolls" value={reconciliation.stats.extraCount} icon={Plus} color="text-amber-600" />
              </CardContent>
              <CardFooter className="bg-slate-50 p-6 border-t flex flex-col gap-3">
                <Button onClick={handleExport} variant="outline" className="w-full h-11 rounded-xl font-black uppercase text-[10px] tracking-widest border-2">
                  <FileDown className="mr-2 h-4 w-4" /> Export Report
                </Button>
                {isAdmin && sessionData?.status !== 'Finalized' && (
                  <>
                    <Button onClick={handleRemoveMissing} variant="outline" className="w-full h-11 rounded-xl font-black uppercase text-[10px] tracking-widest border-2 text-rose-600 border-rose-100 hover:bg-rose-50" disabled={reconciliation.missing.length === 0 || isProcessing}>
                      {isProcessing ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Trash2 className="mr-2 h-4 w-4" />}
                      Deduct Missing From Stock
                    </Button>
                    <Button onClick={handleFinalize} className="w-full h-14 rounded-xl font-black uppercase text-xs tracking-widest shadow-xl" disabled={isProcessing}>
                      {isProcessing ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                      Finalize Audit Session
                    </Button>
                  </>
                )}
                {sessionData?.status === 'Finalized' && (
                  <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl flex items-center gap-3 text-emerald-700">
                    <CheckCircle2 className="h-5 w-5 shrink-0" />
                    <span className="text-[10px] font-black uppercase leading-tight">Session Finalized & Immutable</span>
                  </div>
                )}
              </CardFooter>
            </Card>
          </div>

          {/* TABLES AREA */}
          <div className="lg:col-span-8 space-y-6">
            <Tabs defaultValue="scanned" className="w-full">
              <TabsList className="bg-slate-100 p-1 rounded-2xl h-12">
                <TabsTrigger value="scanned" className="px-10 font-black uppercase text-[10px] tracking-widest gap-2">
                  <ScanLine className="h-4 w-4" /> Scanned Log
                </TabsTrigger>
                <TabsTrigger value="missing" className="px-10 font-black uppercase text-[10px] tracking-widest gap-2">
                  <AlertTriangle className="h-4 w-4" /> Missing Items
                </TabsTrigger>
                <TabsTrigger value="extra" className="px-10 font-black uppercase text-[10px] tracking-widest gap-2">
                  <Plus className="h-4 w-4" /> Extra / Unknown
                </TabsTrigger>
              </TabsList>

              <TabsContent value="scanned" className="mt-6">
                <Card className="border-none shadow-xl rounded-3xl overflow-hidden">
                  <CardContent className="p-0">
                    <div className="max-h-[600px] overflow-auto industrial-scroll">
                      <Table>
                        <TableHeader className="bg-muted/30 sticky top-0 z-10">
                          <TableRow>
                            <TableHead className="font-black text-[10px] uppercase pl-8 py-4">Roll ID</TableHead>
                            <TableHead className="font-black text-[10px] uppercase py-4">Paper Type</TableHead>
                            <TableHead className="font-black text-[10px] uppercase py-4">Dimensions</TableHead>
                            <TableHead className="font-black text-[10px] uppercase py-4">Scan Time</TableHead>
                            <TableHead className="text-right font-black text-[10px] uppercase pr-8 py-4">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {scannedRolls.length === 0 ? (
                            <TableRow><TableCell colSpan={5} className="py-24 text-center opacity-30 uppercase font-black text-[10px] tracking-widest">Awaiting scanner input...</TableCell></TableRow>
                          ) : [...scannedRolls].reverse().map(r => (
                            <TableRow 
                              key={r.id} 
                              className={cn(
                                "h-14 transition-colors",
                                highlightedRowId === r.id ? "bg-emerald-50" : "hover:bg-slate-50"
                              )}
                            >
                              <TableCell className="pl-8">
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="font-black text-primary font-mono truncate max-w-[150px] block cursor-help">{r.rollNo}</span>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p className="text-[10px] font-bold uppercase">{r.rollNo}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </TableCell>
                              <TableCell className="text-xs font-bold text-slate-600">{r.paperType}</TableCell>
                              <TableCell className="text-xs font-medium text-slate-400">{r.dimension}</TableCell>
                              <TableCell className="text-[10px] font-bold text-slate-400">{format(new Date(r.scanTime), 'HH:mm:ss')}</TableCell>
                              <TableCell className="text-right pr-8">
                                <div className="flex justify-end items-center gap-3">
                                  <Badge className={cn(
                                    "text-[9px] font-black h-5 px-3 uppercase border-none",
                                    r.status === 'Matched' ? "bg-emerald-50 text-emerald-700" : "bg-amber-500 text-white"
                                  )}>
                                    {r.status}
                                  </Badge>
                                  {isAdmin && sessionData?.status !== 'Finalized' && (
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className="h-8 w-8 text-slate-300 hover:text-rose-500 transition-colors"
                                      onClick={() => handleDeleteScannedRow(r.id)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="missing" className="mt-6">
                <Card className="border-none shadow-xl rounded-3xl overflow-hidden border-rose-100">
                  <CardHeader className="bg-rose-50/50 p-6 border-b border-rose-100">
                    <CardTitle className="text-xs font-black uppercase text-rose-700 tracking-widest">Lost / Un-scanned Inventory</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="max-h-[600px] overflow-auto industrial-scroll">
                      <Table>
                        <TableHeader className="bg-muted/30 sticky top-0 z-10">
                          <TableRow>
                            <TableHead className="font-black text-[10px] uppercase pl-8 py-4">Roll ID</TableHead>
                            <TableHead className="font-black text-[10px] uppercase py-4">Supplier</TableHead>
                            <TableHead className="font-black text-[10px] uppercase py-4">Type</TableHead>
                            <TableHead className="font-black text-[10px] uppercase py-4">Width</TableHead>
                            <TableHead className="text-right font-black text-[10px] uppercase pr-8 py-4">Current Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {reconciliation.missing.map(r => (
                            <TableRow key={r.id} className="hover:bg-slate-50 transition-colors h-14">
                              <TableCell className="pl-8 font-black text-rose-600 font-mono">{r.rollNo}</TableCell>
                              <TableCell className="text-xs font-bold">{r.paperCompany}</TableCell>
                              <TableCell className="text-xs font-medium text-slate-500">{r.paperType}</TableCell>
                              <TableCell className="text-xs font-mono font-bold">{r.widthMm}mm</TableCell>
                              <TableCell className="text-right pr-8">
                                <Badge variant="outline" className="text-[9px] font-black uppercase">{r.status}</Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                          {reconciliation.missing.length === 0 && (
                            <TableRow><TableCell colSpan={5} className="py-24 text-center text-emerald-600 uppercase font-black text-[10px] tracking-widest">Inventory Fully Verified - No Missing Rolls</TableCell></TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="extra" className="mt-6">
                <Card className="border-none shadow-xl rounded-3xl overflow-hidden border-amber-100">
                  <CardHeader className="bg-amber-50/50 p-6 border-b border-amber-100">
                    <CardTitle className="text-xs font-black uppercase text-amber-700 tracking-widest">Found But Not in ERP</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="max-h-[600px] overflow-auto industrial-scroll">
                      <Table>
                        <TableHeader className="bg-muted/30 sticky top-0 z-10">
                          <TableRow>
                            <TableHead className="font-black text-[10px] uppercase pl-8 py-4">Scanned ID</TableHead>
                            <TableHead className="font-black text-[10px] uppercase py-4">Scan Context</TableHead>
                            <TableHead className="text-right font-black text-[10px] uppercase pr-8 py-4">Reconciliation</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {reconciliation.extra.map(r => (
                            <TableRow key={r.id} className="hover:bg-slate-50 transition-colors h-14">
                              <TableCell className="pl-8 font-black text-amber-600 font-mono">{r.rollNo}</TableCell>
                              <TableCell className="text-xs font-bold text-slate-400">Scanned at {format(new Date(r.scanTime), 'HH:mm:ss')}</TableCell>
                              <TableCell className="text-right pr-8">
                                <Button variant="ghost" size="sm" className="h-8 font-black uppercase text-[9px] tracking-widest text-primary hover:bg-primary/5">
                                  Register Roll
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                          {reconciliation.extra.length === 0 && (
                            <TableRow><TableCell colSpan={3} className="py-24 text-center opacity-30 uppercase font-black text-[10px] tracking-widest">No extra rolls found</TableCell></TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      )}

      {/* NEW SESSION DIALOG */}
      <Dialog open={isNewSessionOpen} onOpenChange={setIsNewSessionOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-[2rem] border-none shadow-3xl">
          <form onSubmit={handleCreateSession}>
            <DialogHeader>
              <DialogTitle className="text-xl font-black uppercase flex items-center gap-3">
                <Plus className="h-6 w-6 text-primary" /> Start New Audit
              </DialogTitle>
              <DialogDescription className="font-bold uppercase text-[10px] tracking-widest">
                Create a container for this month's physical verification.
              </DialogDescription>
            </DialogHeader>
            <div className="py-8 space-y-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase opacity-50">Audit Session Name</Label>
                <Input name="sessionName" placeholder="e.g. March 2026 Monthly Audit" required className="h-12 rounded-xl font-bold border-2" />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" className="w-full h-14 rounded-2xl bg-primary text-white font-black uppercase tracking-widest shadow-xl">
                Initialize Session
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function SummaryRow({ label, value, icon: Icon, color = "text-slate-900", bg = "bg-slate-50" }: any) {
  return (
    <div className={cn("p-4 rounded-2xl flex items-center justify-between transition-all hover:shadow-inner", bg)}>
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 bg-white rounded-lg shadow-sm border flex items-center justify-center">
          <Icon className={cn("h-4 w-4", color)} />
        </div>
        <span className="text-[10px] font-black uppercase text-slate-400 tracking-tight">{label}</span>
      </div>
      <span className={cn("text-lg font-black tracking-tight", color)}>{value}</span>
    </div>
  )
}
