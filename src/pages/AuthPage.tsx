import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Scissors } from "lucide-react";

// Deterministic password derived from email so the user only needs to type their email.
async function derivePassword(email: string): Promise<string> {
  const enc = new TextEncoder().encode(`bsc::${email.toLowerCase().trim()}::v1`);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return;

    if (!isLogin) {
      if (!fullName.trim()) {
        toast({ title: "Error", description: "Ingresá tu nombre completo", variant: "destructive" });
        return;
      }
      if (!phone.trim()) {
        toast({ title: "Error", description: "Ingresá tu teléfono", variant: "destructive" });
        return;
      }
    }

    setLoading(true);
    try {
      const password = await derivePassword(cleanEmail);

      if (isLogin) {
        // Try to sign in directly; if the account doesn't exist, create it on the fly.
        let { error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
        if (error) {
          const { error: signUpError } = await supabase.auth.signUp({
            email: cleanEmail,
            password,
            options: {
              emailRedirectTo: window.location.origin,
              data: { full_name: cleanEmail.split("@")[0], phone: "" },
            },
          });
          if (signUpError) throw signUpError;
          // Try sign in again after creating
          const retry = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
          if (retry.error) throw retry.error;
        }
        toast({ title: "¡Bienvenido!" });
        navigate("/");
      } else {
        const { error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName.trim(), phone: phone.trim() },
          },
        });
        if (error) throw error;
        const signIn = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
        if (signIn.error) throw signIn.error;
        toast({ title: "Cuenta creada" });
        navigate("/");
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <Card className="w-full max-w-md border-border glow-gold animate-fade-in">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
            <Scissors className="w-6 h-6 text-primary" />
          </div>
          <CardTitle className="text-2xl font-display">
            {isLogin ? "Iniciar Sesión" : "Crear Cuenta"}
          </CardTitle>
          <CardDescription>
            {isLogin ? "Ingresá tu email para acceder" : "Registrate para reservar tu turno"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre completo *</Label>
                  <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Tu nombre completo" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Teléfono *</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/[^0-9+\s\-()]/g, ""))}
                    placeholder="Ej: +54 11 7005 5858"
                    required
                    minLength={8}
                  />
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@email.com" required />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Cargando..." : isLogin ? "Iniciar Sesión" : "Crear Cuenta"}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <button
              type="button"
              className="text-sm text-muted-foreground hover:text-primary transition-colors"
              onClick={() => setIsLogin(!isLogin)}
            >
              {isLogin ? "¿No tenés cuenta? Registrate" : "¿Ya tenés cuenta? Iniciá sesión"}
            </button>
          </div>
          <div className="mt-2 text-center">
            <Link to="/" className="text-sm text-muted-foreground hover:text-primary transition-colors">
              ← Volver al inicio
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
