
"use client"

import { use, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/badge"
import { 
  Loader2, 
  Package, 
  Ruler, 
  ArrowRightLeft, 
  Layers, 
  Building2, 
  Hash, 
  History,
  AlertTriangle,
  ArrowLeft,
  Calendar,
  User,
  ShoppingBag
} from "lucide-react"
import { useFirestore, useDoc, useMemoFirebase } from "@/firebase"
import { doc } from "firebase/firestore"
import Link from "next/link"
import { cn } from "@/lib/utils"

export default function RollPublicPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const firestore = useFirestore();

  const rollRef = useMemoFirebase(() => {
    if (!firestore || !id) return null;
    return doc(firestore, 'paper_stock', id);
  }, [firestore, id]);

  const { data: roll, isLoading } = useDoc(rollRef);

  if (isLoading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-slate-50 gap-4">
        <div className="h-16 w-16 bg-white rounded-3xl shadow-xl flex items-center justify-center animate-bounce">
          <Package className="h-8 w-8 text-primary" />
        </div>
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Decoding Identity...</p>
      </div>
    );
  }

  if (!roll) {
    return (
      <div className="flex h-screen flex-col items-center justify-center p-8 bg-slate-50 text-center gap-6">
        <div className="h-20 w-20 bg-rose-50 rounded-full flex items-center justify-center">
          <AlertTriangle className="h-10 w-10 text-rose-500" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-black uppercase tracking-tighter">Roll Not Found</h1>
          <p className="text-sm text-muted-foreground font-medium">The QR identity scanned does not match any record in the Shree Label technical registry.</p>
        </div>
        <Link href="/">
          <Button className="h-12 px-8 rounded-xl bg-slate-900 text-white font-black uppercase text-[10px] tracking-widest">
            Back to Dashboard
          </Button>
        </Link>
      </div>
    );
  }

  const isChild = roll.rollNo.includes('-');

  return (
    <div className="min-h-screen bg-slate-100 font-sans p-4 md:p-10 pb-20">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-4 no-print">
          <Link href="/paper-stock" className="h-10 w-10 bg-white rounded-xl shadow-sm border flex items-center justify-center hover:bg-slate-50 transition-all">
            <ArrowLeft className="h-5 w-5 text-slate-400" />
          </Link>
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Inventory Explorer</span>
        </div>

        <Card className="border-none shadow-2xl rounded-[40px] overflow-hidden bg-white">
          <CardHeader className="bg-slate-900 text-white p-10 pb-12">
            <div className="flex justify-between items-start mb-6">
              <Badge className={cn(
                "px-4 py-1.5 rounded-full font-black text-[10px] tracking-[0.2em] uppercase shadow-lg border-none",
                roll.status === 'CONSUMED' ? "bg-rose-500" : "bg-emerald-500"
              )}>
                {roll.status}
              </Badge>
              <div className="h-12 w-12 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-sm border border-white/10">
                <Hash className="h-6 w-6 text-primary" />
              </div>
            </div>
            <h1 className="text-5xl font-black tracking-tighter leading-none break-all">{roll.rollNo}</h1>
            <p className="text-slate-400 font-bold uppercase text-xs mt-4 tracking-widest flex items-center gap-2">
              <Layers className="h-4 w-4" /> {roll.paperType} • {roll.gsm} GSM
            </p>
          </CardHeader>
          
          <CardContent className="p-10 -mt-8 bg-white rounded-[40px] relative z-10 space-y-10">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 flex flex-col items-center text-center gap-2 transition-transform active:scale-95">
                <Ruler className="h-5 w-5 text-primary" />
                <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Width</p>
                <p className="text-2xl font-black tabular-nums">{roll.widthMm} <small className="text-[10px]">MM</small></p>
              </div>
              <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 flex flex-col items-center text-center gap-2 transition-transform active:scale-95">
                <ArrowRightLeft className="h-5 w-5 text-primary" />
                <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Length</p>
                <p className="text-2xl font-black tabular-nums">{roll.lengthMeters} <small className="text-[10px]">MTR</small></p>
              </div>
            </div>

            <div className="space-y-6 pt-4">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                <History className="h-4 w-4" /> Technical Lineage
              </h3>
              
              <div className="space-y-3">
                <ProfileItem icon={Building2} label="Manufacturer" value={roll.paperCompany} />
                <ProfileItem icon={ShoppingBag} label="Job Assignment" value={roll.jobNo || "STOCK"} highlight={!!roll.jobNo} />
                {isChild && (
                  <ProfileItem icon={Layers} label="Source Parent" value={roll.parentRollNo || roll.rollNo.split('-')[0]} />
                )}
                <ProfileItem icon={Calendar} label="Intake Date" value={roll.receivedDate} />
                <ProfileItem icon={Hash} label="Lot / Batch No" value={roll.lotNo} />
              </div>
            </div>

            {roll.remarks && (
              <div className="p-6 bg-primary/5 rounded-3xl border-2 border-dashed border-primary/20">
                <p className="text-[9px] font-black text-primary uppercase mb-2">Technician Remarks</p>
                <p className="text-sm font-bold text-slate-700 italic">"{roll.remarks}"</p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="px-6 text-center text-slate-400 text-[10px] font-bold uppercase tracking-widest">
          ERP Technical ID • {new Date().getFullYear()} Shree Label Creation
        </div>
      </div>
    </div>
  );
}

function ProfileItem({ icon: Icon, label, value, highlight = false }: { icon: any, label: string, value: any, highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between p-4 rounded-2xl border border-slate-100 hover:bg-slate-50 transition-colors">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 bg-white rounded-lg border shadow-sm flex items-center justify-center">
          <Icon className="h-4 w-4 text-slate-400" />
        </div>
        <span className="text-[10px] font-black uppercase text-slate-400">{label}</span>
      </div>
      <span className={cn(
        "text-xs font-black uppercase tracking-tight",
        highlight ? "text-primary bg-primary/5 px-3 py-1 rounded-full border border-primary/10" : "text-slate-700"
      )}>{value || "—"}</span>
    </div>
  );
}
