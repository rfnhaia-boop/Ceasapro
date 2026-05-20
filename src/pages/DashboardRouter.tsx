import { Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { logout } from '../lib/firebase';
import { LogOut, LayoutDashboard, Package, Truck } from 'lucide-react';
import { cn } from '../lib/utils';
import AdminDashboard from './AdminDashboard';
import PickerDashboard from './PickerDashboard';
import BlockDetail from './BlockDetail';
import DriverDashboard from './DriverDashboard';
import DeliveryDetail from './DeliveryDetail';
import { PurchaseDetails } from './PurchaseDetails';

export default function DashboardRouter() {
  const { profile } = useAuthStore();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
  };

  const role = profile?.role || 'picker';

  const navItems = [
    ...(role === 'admin' ? [{ path: '/', icon: LayoutDashboard, label: 'Painel' }] : []),
    ...(role === 'picker' || role === 'admin' ? [{ path: '/picker', icon: Package, label: 'Coletas' }] : []),
    ...(role === 'driver' || role === 'admin' ? [{ path: '/deliveries', icon: Truck, label: 'Entregas' }] : []),
  ];

  return (
    <div className={cn("min-h-screen flex flex-col font-sans pb-safe", location.pathname === '/' ? 'bg-[#090b10]' : 'bg-[#fcfaf7] text-slate-800')}>
      {/* Top Navigation Bar */}
      <header className="bg-slate-950 border-b border-slate-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-3">
               <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white font-bold text-sm shadow-sm ring-1 ring-emerald-500/50">
                  CP
               </div>
               <span className="text-white font-bold text-xl tracking-tight hidden sm:block">Ceasa Pro</span>
            </div>

            {/* Center Tabs (Desktop) */}
            <div className="hidden md:flex bg-slate-900/80 p-1 rounded-xl ring-1 ring-slate-800/60 backdrop-blur-sm">
               {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={cn(
                        "flex items-center px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-200",
                        isActive ? "bg-slate-800 text-white shadow-sm ring-1 ring-slate-700/50" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                      )}
                    >
                      <Icon className="w-4 h-4 mr-2" />
                      {item.label}
                    </Link>
                  )
                })}
            </div>

            {/* Right Side (Search/User) */}
            <div className="flex items-center gap-4">
                <div className="hidden sm:flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-200">{profile?.name}</p>
                    <p className="text-[10px] uppercase tracking-widest text-slate-500">{profile?.role}</p>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center text-white font-bold ring-2 ring-slate-900 shadow-sm">
                     {profile?.name?.[0]?.toUpperCase()}
                  </div>
                </div>
                <button onClick={handleLogout} className="p-2 -mr-2 text-slate-400 hover:text-orange-400 transition-colors rounded-xl hover:bg-slate-800">
                   <LogOut className="w-5 h-5" />
                </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-6 lg:p-8 pb-20 md:pb-8">
        <Routes>
          {role === 'admin' && <Route path="/" element={<AdminDashboard />} />}
          {role === 'admin' && <Route path="/admin/purchases/:id" element={<PurchaseDetails />} />}
          <Route path="/picker" element={<PickerDashboard />} />
          <Route path="/picker/block/:blockId" element={<BlockDetail />} />
          <Route path="/deliveries" element={<DriverDashboard />} />
          <Route path="/deliveries/:orderId" element={<DeliveryDetail />} />
          <Route path="*" element={<DefaultRedirect role={role} />} />
        </Routes>
      </main>

      {/* Bottom Nav Mobile */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-slate-200 flex justify-around p-2 pb-safe shadow-[0_-4px_6px_-1px_rgb(0,0,0,0.05)] z-50">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex flex-col items-center p-2 min-w-[64px] rounded-xl text-[10px] font-bold uppercase tracking-widest transition-colors",
                isActive ? "text-emerald-700 bg-emerald-50/80" : "text-slate-400"
              )}
            >
              <Icon className={cn("w-6 h-6 mb-1", isActive ? "text-emerald-600" : "text-slate-400")} />
              {item.label}
            </Link>
          )
        })}
      </div>
    </div>
  );
}

function DefaultRedirect({ role }: { role: string }) {
  if (role === 'admin') return <Navigate to="/" replace />;
  if (role === 'picker') return <Navigate to="/picker" replace />;
  if (role === 'driver') return <Navigate to="/deliveries" replace />;
  return <Navigate to="/" replace />;
}
