import { Scissors, Clock, Star, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useServices } from "@/hooks/useShopData";

export default function Index() {
  const { user, isAdmin, signOut } = useAuth();
  const { data: services } = useServices();

  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <nav className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Scissors className="w-6 h-6 text-primary" />
            <span className="font-display text-xl font-bold text-gradient-gold">BarberShop</span>
          </Link>
          <div className="flex items-center gap-3">
            {user ? (
              <>
                {isAdmin && (
                  <Link to="/admin">
                    <Button variant="outline" size="sm">Panel Admin</Button>
                  </Link>
                )}
                <Link to="/mis-citas">
                  <Button variant="ghost" size="sm">Mis Citas</Button>
                </Link>
                <Button variant="ghost" size="sm" onClick={signOut}>Salir</Button>
              </>
            ) : (
              <Link to="/auth">
                <Button size="sm">Iniciar Sesión</Button>
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-4">
        <div className="container mx-auto text-center max-w-3xl animate-fade-in">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
            <Star className="w-4 h-4" />
            Barbería Profesional
          </div>
          <h1 className="text-4xl md:text-6xl font-display font-bold mb-6 text-gradient-gold leading-tight">
            Tu Estilo, Nuestro Arte
          </h1>
          <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto">
            Reserva tu turno en segundos. Cortes profesionales con Nestor y Nacho.
          </p>
          <Link to={user ? "/reservar" : "/auth"}>
            <Button size="lg" className="text-lg px-8 py-6">
              Reservar Turno
            </Button>
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 px-4 border-t border-border">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: Clock, title: "Reserva Rápida", desc: "Elige barbero, servicio y horario en menos de 1 minuto." },
              { icon: Users, title: "Barberos Expertos", desc: "Nestor y Nacho, profesionales con años de experiencia." },
              { icon: Star, title: "Sin Esperas", desc: "Sistema inteligente que evita reservas duplicadas." },
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
        <section className="py-16 px-4 border-t border-border">
          <div className="container mx-auto">
            <h2 className="text-3xl font-display font-bold text-center mb-10 text-gradient-gold">Nuestros Servicios</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {services.map((service) => (
                <div key={service.id} className="p-6 rounded-xl bg-card border border-border hover:glow-gold transition-all">
                  <h3 className="font-display font-semibold text-lg mb-1">{service.name}</h3>
                  <p className="text-muted-foreground text-sm mb-3">{service.description}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-primary font-bold text-xl">${service.price}</span>
                    <span className="text-muted-foreground text-xs">{service.duration_minutes} min</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-border text-center text-muted-foreground text-sm">
        <div className="container mx-auto">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Scissors className="w-4 h-4 text-primary" />
            <span className="font-display text-gradient-gold">BarberShop</span>
          </div>
          <p>© {new Date().getFullYear()} Todos los derechos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
