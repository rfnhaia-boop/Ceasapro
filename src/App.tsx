import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuthStore } from './store/useAuthStore';
import Login from './pages/Login';
import DashboardRouter from './pages/DashboardRouter';
import Onboarding from './pages/Onboarding';
import JoinPage from './pages/JoinPage';
import { AnimatePresence } from 'motion/react';

export default function App() {
  const { initializeAuthListener, loading, user, profile } = useAuthStore();

  useEffect(() => {
    initializeAuthListener();
  }, [initializeAuthListener]);

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  // Se logado mas sem companyId, renderizar apenas o Onboarding
  if (user && profile && !profile.companyId) {
    return <Onboarding />;
  }

  return (
    <Router>
      <AnimatePresence mode="wait">
        <Routes>
          {/* Rota pública de convite — sem necessidade de login */}
          <Route path="/join/:code" element={<JoinPage />} />
          <Route path="/login" element={user ? <Navigate to={"/" + window.location.search} /> : <Login />} />
          <Route path="/*" element={user ? <DashboardRouter /> : <Navigate to={"/login" + window.location.search} />} />
        </Routes>
      </AnimatePresence>
    </Router>
  );
}
