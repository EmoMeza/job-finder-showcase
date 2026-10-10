import { Navigate, Outlet, useLocation } from 'react-router';
import { useSession } from '@/lib/auth';

/** Ruta padre que solo deja pasar con sesión; si no, redirige al login recordando a dónde iba. */
export function RequireAuth() {
  const session = useSession();
  const location = useLocation();

  if (session.isPending) {
    return <p className="p-6 text-muted-foreground">Cargando…</p>;
  }
  if (session.isError) {
    return <p className="p-6 text-destructive">No se pudo conectar con la API.</p>;
  }
  if (!session.data) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}
