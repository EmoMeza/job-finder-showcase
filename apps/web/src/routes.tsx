import { Navigate, type RouteObject } from 'react-router';
import { RequireAuth } from '@/components/RequireAuth';
import { Layout } from '@/Layout';
import { HomePage } from '@/pages/HomePage';
import { JobsPage } from '@/pages/JobsPage';
import { LoginPage } from '@/pages/LoginPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { SearchesPage } from '@/pages/SearchesPage';
import { SettingsPage } from '@/pages/SettingsPage';

export const routes: RouteObject[] = [
  { path: '/login', element: <LoginPage /> },
  {
    // Todo lo que está dentro requiere sesión.
    element: <RequireAuth />,
    children: [
      {
        element: <Layout />,
        children: [
          { index: true, element: <HomePage /> },
          { path: 'ofertas', element: <JobsPage /> },
          { path: 'busquedas', element: <SearchesPage /> },
          { path: 'perfil', element: <ProfilePage /> },
          { path: 'configuracion', element: <SettingsPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
];
