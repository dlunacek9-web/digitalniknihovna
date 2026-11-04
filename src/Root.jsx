import React, { Suspense, lazy } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router';
import { AuthProvider } from './lib/AuthContext';

// Každá část je vlastní balík: knihovnická část a účet nenačítají Three.js.
const App = lazy(() => import('./App.jsx'));
const PublicLibraries = lazy(() => import('./reader/PublicLibraries.jsx'));
const StaffApp = lazy(() => import('./staff/StaffApp.jsx'));
const AuthPage = lazy(() => import('./pages/AuthPage.jsx'));
const AccountPage = lazy(() => import('./pages/AccountPage.jsx'));

// HashRouter: GitHub Pages neumí přesměrovat neznámé cesty na index.html.
export default function Root() {
  return (
    <AuthProvider>
      <HashRouter>
        <Suspense fallback={<div className="route-loading">Načítám…</div>}>
          <Routes>
            <Route path="/" element={<App />} />
            <Route path="/knihovny" element={<PublicLibraries />} />
            <Route path="/prihlaseni" element={<AuthPage />} />
            <Route path="/ucet" element={<AccountPage />} />
            <Route path="/knihovnik/*" element={<StaffApp />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </HashRouter>
    </AuthProvider>
  );
}
