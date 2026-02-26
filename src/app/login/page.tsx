"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { FileText, Loader2, Lock, Mail, ArrowRight } from "lucide-react"
import { useAuth, useUser, initiateEmailSignIn, initiateAnonymousSignIn } from "@/firebase"
import { useToast } from "@/hooks/use-toast"

export default function LoginPage() {
  const router = useRouter()
  const auth = useAuth()
  const { user, isUserLoading } = useUser()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [isGuestLoading, setIsGuestLoading] = useState(false)

  // Redirect if already logged in
  useEffect(() => {
    if (!isUserLoading && user) {
      router.push("/")
    }
  }, [user, isUserLoading, router])

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!auth) return

    setIsLoading(true)
    const formData = new FormData(e.currentTarget)
    const email = formData.get("email") as string
    const password = formData.get("password") as string

    try {
      initiateEmailSignIn(auth, email, password)
      // Success is handled by onAuthStateChanged in AuthInitializer/FirebaseProvider
    } catch (error: any) {
      setIsLoading(false)
      toast({
        variant: "destructive",
        title: "Login Failed",
        description: "Invalid email or password. For this prototype, use Guest Access."
      })
    }
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
      <div className="mb-8 flex items-center gap-3">
        <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center shadow-lg">
          <FileText className="text-white w-7 h-7" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Shree Label CRM</h1>
          <p className="text-xs text-muted-foreground uppercase tracking-widest">Shree Label Creation</p>
        </div>
      </div>

      <Card className="w-full max-w-md shadow-2xl border-none">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-black">Sign in</CardTitle>
          <CardDescription>Enter your credentials to access the ERP dashboard</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input id="email" name="email" type="email" placeholder="name@shreelabel.com" className="pl-10" required />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Button variant="link" size="sm" className="px-0 text-xs text-muted-foreground" type="button">
                  Forgot password?
                </Button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input id="password" name="password" type="password" className="pl-10" defaultValue="admin@123" required />
              </div>
            </div>
            <Button className="w-full bg-primary hover:bg-primary/90" type="submit" disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Sign In"}
            </Button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
            </div>
          </div>

          <Button variant="outline" className="w-full group" onClick={handleGuestLogin} disabled={isGuestLoading}>
            {isGuestLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <>
                Initialize Guest Access <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </>
            )}
          </Button>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4 pt-0">
          <p className="text-center text-xs text-muted-foreground">
            Specialized ERP for Narrow Web Flexo Printing Operations.
          </p>
        </CardFooter>
      </Card>
      
      <div className="mt-8 text-center">
        <p className="text-xs text-muted-foreground">&copy; 2024 Shree Label Creation. All rights reserved.</p>
      </div>
    </div>
  )
}
