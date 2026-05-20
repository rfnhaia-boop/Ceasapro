import { useState } from 'react';
import { motion } from 'motion/react';
import { Building2, UserPlus, LogOut, ArrowRight, Loader2 } from 'lucide-react';
import { createCompany, joinCompany } from '../lib/db';
import { useAuthStore } from '../store/useAuthStore';
import { logout } from '../lib/firebase';

export default function Onboarding() {
  const { user, refreshProfile } = useAuthStore();
  const searchParams = new URLSearchParams(window.location.search);
  const initialInvite = searchParams.get('invite');
  const [mode, setMode] = useState<'select' | 'create' | 'join'>(initialInvite ? 'join' : 'select');
  const [companyName, setCompanyName] = useState('');
  const [inviteCode, setInviteCode] = useState(initialInvite || '');
  const [role, setRole] = useState<'picker' | 'driver'>('picker');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    if (!companyName.trim()) return;
    setLoading(true);
    setError('');
    try {
      await createCompany(user!.uid, companyName);
      await refreshProfile();
    } catch (err: any) {
      setError(err.message || 'Erro ao criar empresa');
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!inviteCode.trim()) return;
    setLoading(true);
    setError('');
    try {
      const companyId = await joinCompany(user!.uid, inviteCode, role);
      if (!companyId) {
        setError('Código de convite inválido');
        setLoading(false);
      } else {
        await refreshProfile();
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao entrar na empresa');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fcfaf7] flex items-center justify-center p-4">
      <div className="absolute top-4 right-4">
        <button onClick={logout} className="flex items-center text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors uppercase tracking-widest bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-100">
          <LogOut className="w-4 h-4 mr-2" />
          Sair
        </button>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden"
      >
        <div className="p-8 text-center bg-slate-950 text-white relative overflow-hidden">
           <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-emerald-500/20 to-transparent pointer-events-none" />
           <div className="relative z-10">
              <h1 className="text-3xl font-bold mb-2">Bem-vindo(a)!</h1>
              <p className="text-slate-400 text-sm">Para começar, conecte-se a uma empresa ou crie a sua própria.</p>
           </div>
        </div>

        <div className="p-8">
          {mode === 'select' && (
            <div className="space-y-4">
              <button 
                onClick={() => setMode('create')}
                className="w-full flex items-center justify-between p-6 rounded-2xl border-2 border-slate-100 hover:border-emerald-500 hover:shadow-md transition-all group"
              >
                 <div className="flex items-center text-left">
                   <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mr-4 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                     <Building2 className="w-6 h-6" />
                   </div>
                   <div>
                     <h3 className="font-bold text-slate-800 text-lg">Sou Dono(a)</h3>
                     <p className="text-sm text-slate-500">Quero criar minha empresa</p>
                   </div>
                 </div>
                 <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-emerald-500 transition-colors" />
              </button>

              <button 
                onClick={() => setMode('join')}
                className="w-full flex items-center justify-between p-6 rounded-2xl border-2 border-slate-100 hover:border-indigo-500 hover:shadow-md transition-all group"
              >
                 <div className="flex items-center text-left">
                   <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mr-4 group-hover:bg-indigo-500 group-hover:text-white transition-colors">
                     <UserPlus className="w-6 h-6" />
                   </div>
                   <div>
                     <h3 className="font-bold text-slate-800 text-lg">Sou Colaborador</h3>
                     <p className="text-sm text-slate-500">Tenho um código de convite</p>
                   </div>
                 </div>
                 <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-500 transition-colors" />
              </button>
            </div>
          )}

          {mode === 'create' && (
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                <div>
                   <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Nome da sua Empresa</label>
                   <input 
                     type="text" 
                     autoFocus
                     value={companyName}
                     onChange={e => setCompanyName(e.target.value)}
                     className="w-full p-4 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-slate-800 text-lg outline-none transition-shadow"
                     placeholder="Ex: Hortifruti Silva"
                   />
                </div>
                {error && <p className="text-sm text-red-500 font-medium">{error}</p>}
                <div className="flex gap-3">
                   <button onClick={() => setMode('select')} className="px-6 py-4 rounded-xl text-slate-500 font-bold hover:bg-slate-50 transition-colors">Voltar</button>
                   <button 
                     onClick={handleCreate}
                     disabled={loading || !companyName.trim()}
                     className="flex-1 bg-emerald-600 text-white font-bold py-4 rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-colors flex items-center justify-center"
                   >
                     {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Criar Empresa'}
                   </button>
                </div>
             </motion.div>
          )}

          {mode === 'join' && (
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                <div>
                   <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Código de Convite</label>
                   <input 
                     type="text" 
                     autoFocus
                     value={inviteCode}
                     onChange={e => setInviteCode(e.target.value)}
                     className="w-full p-4 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 text-lg outline-none transition-shadow uppercase text-center font-mono tracking-widest"
                     placeholder="ABCDEF"
                     maxLength={6}
                   />
                </div>
                {!initialInvite && (
                  <div>
                     <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Sua Função</label>
                     <div className="flex gap-2">
                       <button onClick={() => setRole('picker')} className={`flex-1 py-3 rounded-xl border-2 font-bold text-sm ${role === 'picker' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-100 text-slate-500'}`}>Separador</button>
                       <button onClick={() => setRole('driver')} className={`flex-1 py-3 rounded-xl border-2 font-bold text-sm ${role === 'driver' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-100 text-slate-500'}`}>Entregador</button>
                     </div>
                  </div>
                )}
                {error && <p className="text-sm text-red-500 font-medium text-center">{error}</p>}
                <div className="flex gap-3 pt-2">
                   <button onClick={() => setMode('select')} className="px-6 py-4 rounded-xl text-slate-500 font-bold hover:bg-slate-50 transition-colors">Voltar</button>
                   <button 
                     onClick={handleJoin}
                     disabled={loading || inviteCode.length < 6}
                     className="flex-1 bg-indigo-600 text-white font-bold py-4 rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center justify-center"
                   >
                     {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Entrar'}
                   </button>
                </div>
             </motion.div>
          )}

        </div>
      </motion.div>
    </div>
  );
}
