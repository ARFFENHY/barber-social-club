import { useState } from "react";
import { Clock, Star, Users, MapPin, Phone, Instagram, MessageCircle, Scissors, Calendar, Menu, X } from "lucide-react";
import NotificationBell from "@/components/NotificationBell";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useServices } from "@/hooks/useShopData";
import bscLogo from "@/assets/bsc-logo.jpeg";

const WHATSAPP_URL = "https://wa.me/5491170055858";
const INSTAGRAM_URL = "https://www.instagram.com/barber.social.club";

const galleryImages = [
  "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=400&h=400&fit=crop",
  "https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=400&h=400&fit=crop",
  "https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=400&h=400&fit=crop",
  "https://images.unsplash.com/photo-1622286342621-4bd786c2447c?w=400&h=400&fit=crop",
  "https://images.unsplash.com/photo-1585747860019-8c8a54e6a6d3?w=400&h=400&fit=crop",
  "https://images.unsplash.com/photo-1567894340315-735d7c361db0?w=400&h=400&fit=crop",
];

const NAV_LINKS = [
  { href: "#inicio", label: "Inicio" },
  { href: "#servicios", label: "Servicios" },
  { href: "#nosotros", label: "Nosotros" },
  { href: "#galeria", label: "Galería" },
  { href: "#contacto", label: "Contacto" },
];

export default function Index() {
  const { user, isAdmin, signOut } = useAuth();
  const { data: services } = useServices();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <nav className="fixed top-0 w-full z-50 bg-background/90 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src={bscLogo} alt="BSC Logo" className="w-8 h-8 rounded-full object-cover" />
            <span className="font-display text-xl font-bold text-gradient-gold">BSC</span>
          </Link>
          <div className="hidden md:flex items-center gap-6 text-sm">
            {NAV_LINKS.map((l) => (
              <a key={l.href} href={l.href} className="text-muted-foreground hover:text-foreground transition-colors">{l.label}</a>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {user ? (
              <>
                {isAdmin && (
                  <Link to="/admin" className="hidden sm:inline-flex">
                    <Button variant="outline" size="sm">Admin</Button>
                  </Link>
                )}
                <Link to="/mis-citas" className="hidden sm:inline-flex">
                  <Button variant="ghost" size="sm">Mis Citas</Button>
                </Link>
                <Button variant="ghost" size="sm" onClick={signOut} className="hidden sm:inline-flex">Salir</Button>
              </>
            ) : (
              <Link to="/auth" className="hidden sm:inline-flex">
                <Button size="sm">Iniciar Sesión</Button>
              </Link>
            )}
            <button
              className="md:hidden p-2 text-foreground"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Menú"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-border bg-background/95 backdrop-blur-md animate-fade-in">
            <div className="container mx-auto px-4 py-4 flex flex-col gap-3">
              {NAV_LINKS.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="py-2 text-foreground hover:text-primary transition-colors font-medium"
                >
                  {l.label}
                </a>
              ))}
              <div className="border-t border-border pt-3 flex flex-col gap-2">
                {user ? (
                  <>
                    {isAdmin && (
                      <Link to="/admin" onClick={() => setMobileMenuOpen(false)}>
                        <Button variant="outline" size="sm" className="w-full">Admin</Button>
                      </Link>
                    )}
                    <Link to="/mis-citas" onClick={() => setMobileMenuOpen(false)}>
                      <Button variant="ghost" size="sm" className="w-full">Mis Citas</Button>
                    </Link>
                    <Button variant="ghost" size="sm" className="w-full" onClick={() => { signOut(); setMobileMenuOpen(false); }}>Salir</Button>
                  </>
                ) : (
                  <Link to="/auth" onClick={() => setMobileMenuOpen(false)}>
                    <Button size="sm" className="w-full">Iniciar Sesión</Button>
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Hero */}
      <section id="inicio" className="relative pt-16 min-h-[85vh] flex items-center justify-center px-4">
        <div className="absolute inset-0 z-0 flex items-center justify-center bg-background">
          <img src={bscLogo} alt="BSC Background" className="w-[500px] md:w-[600px] h-auto object-contain opacity-40" />
          <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-transparent to-background/80" />
        </div>
        <div className="relative z-10 container mx-auto text-center max-w-3xl animate-fade-in">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
            <Scissors className="w-4 h-4" />
            Barbería Profesional
          </div>
          <h1 className="text-4xl md:text-6xl font-display font-bold mb-6 text-gradient-gold leading-tight">
            Tu Estilo, Nuestro Arte
          </h1>
          <p className="text-lg text-muted-foreground mb-4 max-w-xl mx-auto">
            Reservá tu turno en segundos. Cortes profesionales con Nacho y Nestor.
          </p>
          <p className="text-sm text-muted-foreground mb-8">
            <MapPin className="w-4 h-4 inline mr-1" />
            Buenos Aires 5075 entre Lavalle y General Paz
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to={user ? "/reservar" : "/auth"}>
              <Button size="lg" className="text-lg px-8 py-6 w-full sm:w-auto">
                <Calendar className="w-5 h-5 mr-2" />
                Reservar Turno
              </Button>
            </Link>
            <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
              <Button size="lg" variant="outline" className="text-lg px-8 py-6 w-full sm:w-auto">
                <MessageCircle className="w-5 h-5 mr-2" />
                WhatsApp
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 px-4 border-t border-border">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: Clock, title: "Reserva Rápida", desc: "Elegí barbero, servicio y horario en menos de 1 minuto." },
              { icon: Users, title: "Barberos Expertos", desc: "Nacho y Nestor, profesionales con años de experiencia." },
              { icon: Star, title: "Sin Esperas", desc: "Confirmación automática. Llegás y te atendemos." },
            ].map((f, i) => (
              <div key={i} className="p-6 rounded-xl bg-card border border-border hover:border-gold transition-colors animate-fade-in" style={{ animationDelay: `${i * 0.1}s` }}>
                <f.icon className="w-10 h-10 text-primary mb-4" />
                <h3 className="font-display text-lg font-semibold mb-2">{f.title}</h3>
                <p className="text-muted-foreground text-sm">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Services */}
      {services && services.length > 0 && (
        <section id="servicios" className="py-16 px-4 border-t border-border">
          <div className="container mx-auto">
            <h2 className="text-3xl font-display font-bold text-center mb-10 text-gradient-gold">Nuestros Servicios</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {services.map((service) => (
                <div key={service.id} className="p-6 rounded-xl bg-card border border-border hover:glow-gold transition-all">
                  <h3 className="font-display font-semibold text-lg mb-1">{service.name}</h3>
                  <p className="text-muted-foreground text-sm mb-3">{service.description}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-primary font-bold text-xl">${service.price.toLocaleString("es-AR")}</span>
                    <span className="text-muted-foreground text-xs">{service.duration_minutes} min</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="text-center mt-8">
              <Link to={user ? "/reservar" : "/auth"}>
                <Button size="lg">Reservar Turno</Button>
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* About */}
      <section id="nosotros" className="py-16 px-4 border-t border-border">
        <div className="container mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-display font-bold mb-6 text-gradient-gold">Sobre Nosotros</h2>
          <div className="flex justify-center mb-6">
            <img src={bscLogo} alt="BSC Logo" className="w-24 h-24 rounded-full object-cover border-2 border-primary" />
          </div>
          <p className="text-muted-foreground text-lg leading-relaxed mb-6">
            <strong className="text-foreground">Barber Social Club</strong> es un espacio moderno y profesional especializado en cortes masculinos y cuidado de la barba. Nuestro equipo, formado por Nacho y Nestor, combina técnica, estilo y atención personalizada para que cada cliente salga con el look que busca.
          </p>
          <div className="grid sm:grid-cols-2 gap-4 mt-8">
            <div className="p-4 rounded-xl bg-card border border-border">
              <h4 className="font-display font-semibold text-primary mb-2">Martes a Jueves</h4>
              <p className="text-muted-foreground text-sm">10:00 a 13:00 · 16:00 a 20:00</p>
              <p className="text-muted-foreground text-xs mt-1">Atiende: Nacho</p>
            </div>
            <div className="p-4 rounded-xl bg-card border border-border">
              <h4 className="font-display font-semibold text-primary mb-2">Viernes y Sábado</h4>
              <p className="text-muted-foreground text-sm">10:00 a 20:00</p>
              <p className="text-muted-foreground text-xs mt-1">Atienden: Nacho y Nestor</p>
            </div>
          </div>
        </div>
      </section>

      {/* Gallery */}
      <section id="galeria" className="py-16 px-4 border-t border-border">
        <div className="container mx-auto">
          <h2 className="text-3xl font-display font-bold text-center mb-4 text-gradient-gold">Galería</h2>
          <p className="text-center text-muted-foreground mb-8">
            Seguinos en{" "}
            <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              @barber.social.club
            </a>
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {galleryImages.map((img, i) => (
              <a
                key={i}
                href={INSTAGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="aspect-square rounded-lg overflow-hidden border border-border hover:glow-gold transition-all"
              >
                <img src={img} alt={`Trabajo de barbería ${i + 1}`} className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" loading="lazy" />
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contacto" className="py-16 px-4 border-t border-border">
        <div className="container mx-auto max-w-2xl">
          <h2 className="text-3xl font-display font-bold text-center mb-10 text-gradient-gold">Contacto</h2>
          <div className="grid gap-4">
            <div className="flex items-center gap-4 p-4 rounded-xl bg-card border border-border">
              <MapPin className="w-6 h-6 text-primary flex-shrink-0" />
              <div>
                <p className="font-medium">Dirección</p>
                <p className="text-muted-foreground text-sm">Buenos Aires 5075 entre Lavalle y General Paz</p>
              </div>
            </div>
            <a href="tel:+5491170055858" className="flex items-center gap-4 p-4 rounded-xl bg-card border border-border hover:border-gold transition-colors">
              <Phone className="w-6 h-6 text-primary flex-shrink-0" />
              <div>
                <p className="font-medium">Teléfono / WhatsApp</p>
                <p className="text-muted-foreground text-sm">11 7005-5858</p>
              </div>
            </a>
            <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 p-4 rounded-xl bg-card border border-border hover:border-gold transition-colors">
              <Instagram className="w-6 h-6 text-primary flex-shrink-0" />
              <div>
                <p className="font-medium">Instagram</p>
                <p className="text-muted-foreground text-sm">@barber.social.club</p>
              </div>
            </a>
          </div>
          <div className="text-center mt-8">
            <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
              <Button size="lg" className="text-lg px-8 py-6">
                <MessageCircle className="w-5 h-5 mr-2" />
                Escribinos por WhatsApp
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* WhatsApp floating button */}
      <a
        href={WHATSAPP_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-[#25D366] flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
        aria-label="Contactar por WhatsApp"
      >
        <MessageCircle className="w-7 h-7 text-white" />
      </a>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-border text-center text-muted-foreground text-sm">
        <div className="container mx-auto">
          <div className="flex items-center justify-center gap-2 mb-2">
            <img src={bscLogo} alt="BSC Logo" className="w-5 h-5 rounded-full object-cover" />
            <span className="font-display text-gradient-gold">Barber Social Club</span>
          </div>
          <p>Buenos Aires 5075 entre Lavalle y General Paz</p>
          <p className="mt-1">© {new Date().getFullYear()} Todos los derechos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
