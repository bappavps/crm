"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { 
  ScanLine, 
  ChevronLeft, 
  CheckCircle2, 
  AlertTriangle, 
  Loader2, 
  Camera, 
  StopCircle,
  Package,
  History,
  Info,
  X
} from "lucide-react"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { useFirestore, useUser, useCollection, useMemoFirebase, useDoc } from "@/firebase"
import { collection, doc, query, orderBy, limit, setDoc, serverTimestamp } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { Html5QrcodeScanner } from "html5-qrcode"

/**
 * STANDALONE MOBILE SCAN TERMINAL
 * Designed for full-screen industrial floor use.
 */

export default function ScanTerminalPage() {
  const { toast } = useToast()
  const { user } = useUser()
  const firestore = useFirestore()
  const router = useRouter()
  
  const [scanInput, setScanInput] = useState("")
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [isCameraActive, setIsCameraActive] = useState(false)
  const [scanFeedback, setScanFeedback] = useState<'success' | 'error' | 'warning' | null>(null)
  const [isMounted, setIsMounted] = useState(false)
  
  const scanInputRef = useRef<HTMLInputElement>(null)
  const scannerInstance = useRef<Html5QrcodeScanner | null>(null)
  const lastSoundTime = useRef<number>(0)

  useEffect(() => {
    setIsMounted(true)
    if (scanInputRef.current) scanInputRef.current.focus()
  }, [])

  // Subscriptions
  const sessionsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'inventory_audits'), orderBy('createdAt', 'desc'), limit(50));
  }, [firestore]);
  const { data: sessions } = useCollection(sessionsQuery);

  const activeSessionRef = useMemoFirebase(() => {
    if (!firestore || !activeSessionId) return null;
    return doc(firestore, 'inventory_audits', activeSessionId);
  }, [firestore, activeSessionId]);
  const { data: sessionData } = useDoc(activeSessionRef);

  const erpRollsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'paper_stock'), limit(10000));
  }, [firestore]);
  const { data: erpRolls } = useCollection(erpRollsQuery);

  const scannedRolls = useMemo(() => sessionData?.scannedRolls || [], [sessionData]);

  // Audio Feedback
  const triggerFeedback = (type: 'success' | 'error' | 'warning') => {
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
        oscillator.start(); oscillator.stop(audioCtx.currentTime + 0.1);
      } else {
        oscillator.frequency.setValueAtTime(220, audioCtx.currentTime);
        oscillator.type = 'square';
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        oscillator.start(); oscillator.stop(audioCtx.currentTime + 0.3);
      }
    } catch (e) {}

    setScanFeedback(type);
    setTimeout(() => setScanFeedback(null), 800);
  };

  const processScan = async (rawValue: string) => {
    if (!rawValue || !activeSessionId || !firestore || !user) return;

    let rollNo = rawValue.trim().toUpperCase();
    if (rollNo.includes('/')) rollNo = rollNo.split('/').pop() || rollNo;

    if (scannedRolls.some((r: any) => r.rollNo === rollNo)) {
      triggerFeedback('warning');
      toast({ variant: "destructive", title: "Duplicate", description: `Roll ${rollNo} already scanned.` });
      return;
    }

    const erpMatch = erpRolls?.find(r => r.rollNo === rollNo);
    const newScan = {
      id: crypto.randomUUID(),
      rollNo,
      paperType: erpMatch?.paperType || "UNKNOWN",
      dimension: erpMatch ? `${erpMatch.widthMm}mm x ${erpMatch.lengthMeters}m` : "N/A",
      scanTime: new Date().toISOString(),
      status: erpMatch ? 'Matched' : 'Unknown'
    };

    try {
      await setDoc(doc(firestore, 'inventory_audits', activeSessionId), {
        scannedRolls: [...scannedRolls, newScan],
        updatedAt: serverTimestamp()
      }, { merge: true });

      triggerFeedback(erpMatch ? 'success' : 'warning');
      toast({ title: erpMatch ? "Accepted" : "Roll Not in ERP", description: rollNo });
    } catch (e) {
      toast({ variant: "destructive", title: "Sync Error" });
    }
    
    setScanInput("");
    if (scanInputRef.current) scanInputRef.current.focus();
  };

  const startCamera = () => {
    setIsCameraActive(true);
    setTimeout(() => {
      const scanner = new Html5QrcodeScanner("terminal-camera", { fps: 15, qrbox: { width: 250, height: 250 } }, false);
      scanner.render((text) => {
        processScan(text);
        if (scannerInstance.current) scannerInstance.current.clear().catch(console.error);
        setIsCameraActive(false);
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

  if (!isMounted) return null;

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-white overflow-hidden p-4">
      {/* TERMINAL HEADER */}
      <div className="flex items-center justify-between mb-6">
        <Button variant="ghost" className="text-white hover:bg-white/10" onClick={() => router.push('/inventory/physical-check')}>
          <ChevronLeft className="mr-2 h-5 w-5" /> Exit
        </Button>
        <div className="text-center">
          <h1 className="text-lg font-black uppercase tracking-widest flex items-center gap-2">
            <ScanLine className="h-5 w-5 text-primary" /> Scan Terminal
          </h1>
          <p className="text-[8px] font-bold text-slate-400 uppercase tracking-[0.3em]">Production Floor Mode</p>
        </div>
        <div className="w-20" />
      </div>

      {/* SESSION SELECTOR */}
      <div className="mb-6">
        <Select value={activeSessionId || ""} onValueChange={setActiveSessionId}>
          <SelectTrigger className="h-14 bg-white/5 border-white/10 rounded-2xl font-bold uppercase text-xs">
            <SelectValue placeholder="Select Audit Session" />
          </SelectTrigger>
          <SelectContent className="z-[100]">
            {sessions?.map(s => (
              <SelectItem key={s.id} value={s.id} disabled={s.status === 'Finalized'}>
                {s.sessionName} {s.status === 'Finalized' ? '(LOCKED)' : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!activeSessionId ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-10 opacity-30 gap-4">
          <Info className="h-16 w-16" />
          <p className="font-black uppercase tracking-widest">Select an active session to begin floor scanning</p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col gap-6 overflow-hidden">
          {/* CAMERA VIEWPORT */}
          {isCameraActive ? (
            <div className="relative flex-1 bg-black rounded-[2.5rem] overflow-hidden border-2 border-white/10 shadow-2xl animate-in zoom-in-95 duration-300">
              <div id="terminal-camera" className="w-full h-full" />
              <Button onClick={stopCamera} variant="destructive" className="absolute bottom-6 left-1/2 -translate-x-1/2 h-14 px-8 rounded-full font-black uppercase shadow-2xl">
                <StopCircle className="mr-2 h-5 w-5" /> Stop Camera
              </Button>
            </div>
          ) : (
            <div className="flex-1 flex flex-col gap-6 overflow-hidden">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/5 p-6 rounded-3xl border border-white/5 text-center">
                  <p className="text-[10px] font-black uppercase text-slate-500 mb-1">Captured</p>
                  <p className="text-4xl font-black">{scannedRolls.length}</p>
                </div>
                <div className="bg-white/5 p-6 rounded-3xl border border-white/5 text-center">
                  <p className="text-[10px] font-black uppercase text-slate-500 mb-1">Matched</p>
                  <p className="text-4xl font-black text-emerald-400">{scannedRolls.filter((r: any) => r.status === 'Matched').length}</p>
                </div>
              </div>

              <div className="flex-1 overflow-auto bg-black/20 rounded-3xl p-4 industrial-scroll border border-white/5">
                <div className="space-y-2">
                  {[...scannedRolls].reverse().slice(0, 20).map((r: any) => (
                    <div key={r.id} className="p-4 bg-white/5 rounded-2xl flex justify-between items-center animate-in slide-in-from-top-2">
                      <div className="flex flex-col">
                        <span className="font-black text-primary font-mono text-lg leading-none">{r.rollNo}</span>
                        <span className="text-[10px] font-bold text-slate-500 uppercase mt-1">{r.paperType} • {r.dimension}</span>
                      </div>
                      <Badge className={cn("text-[9px] font-black h-5", r.status === 'Matched' ? "bg-emerald-500" : "bg-amber-500")}>
                        {r.status}
                      </Badge>
                    </div>
                  ))}
                  {scannedRolls.length === 0 && (
                    <div className="py-20 text-center opacity-20 font-black uppercase text-[10px] tracking-widest">Awaiting scans...</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* INPUT BAR */}
          <div className={cn(
            "p-6 bg-slate-800 rounded-[2.5rem] shadow-2xl transition-all duration-300",
            scanFeedback === 'success' && "ring-8 ring-emerald-500/30",
            scanFeedback === 'warning' && "ring-8 ring-amber-500/30",
            scanFeedback === 'error' && "ring-8 ring-rose-500/30"
          )}>
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Input 
                  ref={scanInputRef}
                  placeholder="Type ID..." 
                  className="h-16 bg-white/5 border-white/10 rounded-2xl text-2xl font-black tracking-tighter pl-6"
                  value={scanInput}
                  onChange={e => setScanInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && processScan(scanInput)}
                />
                {scanInput && (
                  <button onClick={() => setScanInput("")} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"><X className="h-6 w-6" /></button>
                )}
              </div>
              <Button onClick={() => processScan(scanInput)} disabled={!scanInput.trim()} className="h-16 w-16 bg-primary rounded-2xl shadow-lg shrink-0 active:scale-95 transition-transform">
                <CheckCircle2 className="h-8 w-8" />
              </Button>
              {!isCameraActive && (
                <Button onClick={startCamera} className="h-16 w-16 bg-white rounded-2xl shadow-lg shrink-0 text-slate-900 active:scale-95 transition-transform">
                  <Camera className="h-8 w-8" />
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .industrial-scroll::-webkit-scrollbar { width: 4px; }
        .industrial-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
      `}</style>
    </div>
  )
}