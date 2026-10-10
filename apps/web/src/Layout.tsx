import { LogOut } from 'lucide-react';
import { NavLink, Outlet } from 'react-router';
import { Button } from '@/components/ui/button';
import { useLogout, useSession } from '@/lib/auth';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { to: '/', label: 'Inicio' },
  { to: '/ofertas', label: 'Ofertas' },
  { to: '/busquedas', label: 'Búsquedas' },
  { to: '/perfil', label: 'Mi perfil' },
  { to: '/configuracion', label: 'Configuración' },
];

export function Layout() {
  const session = useSession();
  const logout = useLogout();

  return (
    <div className="min-h-screen">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-8 gap-y-2 px-4">
          <span className="py-3 text-lg font-bold tracking-tight text-primary">Job Finder</span>
          {/* En pantallas angostas el menú baja a su propia fila y se desliza hacia el lado. */}
          <nav
            aria-label="Principal"
            className="order-last flex w-full min-w-0 gap-1 overflow-x-auto md:order-none md:w-auto md:flex-1"
          >
            {NAV_ITEMS.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                end
                className={({ isActive }) =>
                  cn(
                    '-mb-px border-b-2 px-3 py-3.5 text-sm font-semibold whitespace-nowrap',
                    isActive
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:border-linea-suave hover:text-foreground',
                  )
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="text-muted-foreground">{session.data?.name}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => logout.mutate()}
              disabled={logout.isPending}
            >
              <LogOut />
              Cerrar sesión
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
