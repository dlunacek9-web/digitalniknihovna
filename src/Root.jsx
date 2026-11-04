import React, { Suspense, lazy } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router';
import { AuthProvider, useAuth } from './lib/AuthContext';
import { NotConfigured, PageLoading } from './pages/PlainParts';

// Každá část je vlastní balík: knihovnická část a účet nenačítají Three.js.
const App = lazy(() => import('./App.jsx'));
const PublicLibraries = lazy(() => import('./reader/PublicLibraries.jsx'));
const StaffApp = lazy(() => import('./staff/StaffApp.jsx'));
const AuthPage = lazy(() => import('./pages/AuthPage.jsx'));
const AccountPage = lazy(() => import('./pages/AccountPage.jsx'));
const AdminPage = lazy(() => import('./pages/AdminPage.jsx'));
const NewPasswordPage = lazy(() => import('./pages/NewPasswordPage.jsx'));

// Po odkazu pro obnovu hesla je uživatel přihlášený, ale nejdřív si má nastavit nové heslo.
function AppRoutes() {
  const { passwordRecovery } = useAuth();
  if (passwordRecovery) return <NewPasswordPage />;
  return (
    <Routes>
      <Route path="/" element={<RequireAccount><App /></RequireAccount>} />
      <Route path="/knihovny" element={<PublicLibraries />} />
      <Route path="/prihlaseni" element={<AuthPage />} />
      <Route path="/ucet" element={<AccountPage />} />
      <Route path="/admin" element={<AdminPage />} />
      <Route path="/knihovnik/*" element={<StaffApp />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

// Bez účtu se do chaty nedostane nikdo: knihy patří k účtu.
function RequireAccount({ children }) {
  const { configured, loading, user, storeError, reloadStore } = useAuth();
  if (!configured) return <NotConfigured />;
  if (loading) return <PageLoading />;
  if (!user) return <Navigate to="/prihlaseni" replace />;
  if (storeError) {
    return (
      <main className="plain plain--center">
        <section className="plain-card plain-card--narrow">
          <p className="plain-error" role="alert">{storeError}</p>
          <button type="button" className="plain-btn" onClick={reloadStore}>Zkusit znovu</button>
        </section>
      </main>
    );
  }
  return children;
}

// HashRouter: GitHub Pages neumí přesměrovat neznámé cesty na index.html.
export default function Root() {
  return (
    <AuthProvider>
      <HashRouter>
        <Suspense fallback={<div className="route-loading">Načítám…</div>}>
          <AppRoutes />
        </Suspense>
      </HashRouter>
    </AuthProvider>
  );
}
