"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { FileText, Loader2, Lock, Mail, ArrowRight, ShieldCheck } from "lucide-react"
import { useAuth, useUser, useFirestore, useDoc, useMemoFirebase, initiateEmailSignIn, initiateAnonymousSignIn, errorEmitter } from "@/firebase"
import { doc } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"

export default function LoginPage() {
  const router = useRouter()
  const auth = useAuth()
  const firestore = useFirestore()
  const { user, isUserLoading } = useUser()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [isGuestLoading, setIsGuestLoading] = useState(false)

  // Fetch dynamic branding for the login page
  const companyDocRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'company_settings', 'global');
  }, [firestore]);
  const { data: companySettings } = useDoc(companyDocRef);
  
  const companyName = companySettings?.name || "SHREE LABEL CREATION";
  const companyLogo = companySettings?.logo;

  // Listen for login errors
  useEffect(() => {
    const handleAuthError = (err: { title: string; message: string }) => {
      setIsLoading(false)
      setIsGuestLoading(false)
      toast({
        variant: "destructive",
        title: err.title,
        description: err.message
      })
    }
    errorEmitter.on('auth-error', handleAuthError)
    return () => errorEmitter.off('auth-error', handleAuthError)
  }, [toast])

  // Redirect if already logged in
  useEffect(() => {
    if (!isUserLoading && user) {
      router.push("/")
    }
  }, [user, isUserLoading, router])

  const handleLogin = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!auth) return

    setIsLoading(true)
    const formData = new FormData(e.currentTarget)
    const email = formData.get("email") as string
    const password = formData.get("password") as string

    // initiateEmailSignIn is non-blocking. Error handled via listener above.
    initiateEmailSignIn(auth, email, password)
  }

  const handleGuestLogin = () => {
    if (!auth) return
    setIsGuestLoading(true)
    initiateAnonymousSignIn(auth)
  }

  if (isUserLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-muted/30 p-4">
      {/* NEW PROFESSIONAL BRANDING HEADER */}
      <div className="mb-10 flex flex-col items-center gap-6 animate-in fade-in slide-in-from-top-4 duration-1000">
        <div className="w-20 h-20 bg-white rounded-[2rem] flex items-center justify-center shadow-2xl overflow-hidden border-2 border-slate-100 p-3">
          {companyLogo ? (
            <img src={companyLogo} alt="Logo" className="w-full h-full object-contain" />
          ) : (
            <ShieldCheck className="text-primary w-10 h-10" />
          )}
        </div>
        <div className="space-y-2 text-center">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-[0.15em] uppercase text-slate-900 leading-none">
            {companyName}
          </h1>
          <p className="text-xs md:text-sm text-slate-400 font-medium uppercase tracking-[0.1em]">
            Narrow Web Flexo Printing ERP
          </p>
        </div>
      </div>

      <Card className="w-full max-w-md shadow-2xl border-none rounded-3xl overflow-hidden bg-white">
        <CardHeader className="space-y-1 text-center bg-slate-900 text-white p-8">
          <CardTitle className="text-xl font-black uppercase tracking-widest">Operator Login</CardTitle>
          <CardDescription className="text-slate-400 font-medium uppercase text-[10px] tracking-widest">Enter credentials to access the system</CardDescription>
        </CardHeader>
        <CardContent className="p-8 space-y-6">
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-[10px] font-black uppercase text-slate-400">Identity Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3.5 h-4 w-4 text-slate-300" />
                <Input id="email" name="email" type="email" placeholder="name@shreelabel.com" className="pl-10 h-12 rounded-xl border-2 font-bold" defaultValue="gm.shreelabel@gmail.com" required />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-[10px] font-black uppercase text-slate-400">Secret Password</Label>
                <Button variant="link" size="sm" className="px-0 text-[10px] text-muted-foreground uppercase font-black" type="button">
                  Lost Password?
                </Button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-3.5 h-4 w-4 text-slate-300" />
                <Input id="password" name="password" type="password" className="pl-10 h-12 rounded-xl border-2 font-bold" defaultValue="admin@123" required />
              </div>
            </div>
            <Button className="w-full h-14 bg-primary hover:bg-primary/90 rounded-2xl shadow-xl font-black uppercase text-xs tracking-widest transition-all active:scale-95" type="submit" disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : "Authorize Entry"}
            </Button>
          </form>

          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase font-black">
              <span className="bg-white px-4 text-slate-300 tracking-widest">Secure Access Gateway</span>
            </div>
          </div>

          <Button variant="outline" className="w-full h-12 rounded-xl border-2 font-black uppercase text-[10px] tracking-widest group" onClick={handleGuestLogin} disabled={isGuestLoading}>
            {isGuestLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <>
                Initialize Guest Mode <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </>
            )}
          </Button>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4 p-8 pt-0 text-center">
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider bg-slate-50 p-4 rounded-xl border-2 border-dashed">
            NEW TECHNICIANS: Use corporate ID and <strong className="text-primary">admin@123</strong> to provision your node.
          </p>
        </CardFooter>
      </Card>
      
      <div className="mt-8 text-center">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] opacity-50">&copy; 2026 {companyName} • Master System v3.0</p>
      </div>
    </div>
  )
}
