import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { loginWithGoogle } from '../lib/firebase';
import { getInviteByCode, joinCompany } from '../lib/db';
import { Package, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

type InviteState = 'loading' | 'found' | 'invalid' | 'used' | 'claiming' | 'done' | 'error';

export default function JoinPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { user, profile, refreshProfile, loading: authLoading } = useAuthStore();

  const [state, setState] = useState<InviteState>('loading');
  const [invite, setInvite] = useState<{ name: string; role: string; companyId: string; docId: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Busca o convite ao montar
  useEffect(() => {
    if (!code) { setState('invalid'); return; }

    getInviteByCode(code).then((inv) => {
      if (!inv) { setState('invalid'); return; }
      if (inv.used) { setState('used'); return; }
      setInvite({ name: inv.name, role: inv.role, companyId: inv.companyId, docId: inv.docId });
      setState('found');
    });
  }, [code]);

  // Se o usuário acabou de logar e o convite foi encontrado, reivindica automaticamente
  useEffect(() => {
    if (state !== 'found' || authLoading) return;
    if (!user || !invite) return;

    // Já tem companyId? Só redireciona (foi recarregado após claim)
    if (profile?.companyId) { navigate('/'); return; }

    setState('claiming');
    joinCompany(user.uid, code!).then(async (companyId) => {
      if (companyId) {
        // Atualiza o perfil na memória antes de redirecionar
        await refreshProfile();
        setState('done');
        setTimeout(() => navigate('/'), 1500);
      } else {
        setState('error');
        setErrorMsg('Não foi possível resgatar o convite. Pode já ter sido usado.');
      }
    }).catch((err) => {
      setState('error');
      setErrorMsg(err?.message || 'Erro ao resgatar convite.');
    });
  }, [user, authLoading, state, invite, profile]);

  const handleLogin = async () => {
    try {
      await loginWithGoogle();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erro ao fazer login.');
    }
  };

  const roleLabel = (r: string) => (r === 'picker' ? 'Separador' : r === 'driver' ? 'Motorista' : r);

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
        {/* Header */}
        <div className="bg-emerald-600 p-8 text-white text-center">
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Package className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Ceasa Pro</h1>
          <p className="text-emerald-100 text-sm mt-1">Você foi convidado</p>
        </div>

        <div className="p-8 text-center space-y-6">
          {/* Loading convite */}
          {(state === 'loading' || authLoading) && (
            <div className="flex flex-col items-center gap-3 text-slate-500">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
              <p className="text-sm font-medium">Verificando convite…</p>
            </div>
          )}

          {/* Convite inválido */}
          {state === 'invalid' && (
            <div className="flex flex-col items-center gap-3 text-red-600">
              <AlertCircle className="w-12 h-12" />
              <h2 className="text-lg font-bold">Convite Inválido</h2>
              <p className="text-slate-500 text-sm">Este link não é válido ou expirou.</p>
            </div>
          )}

          {/* Convite já usado */}
          {state === 'used' && (
            <div className="flex flex-col items-center gap-3 text-amber-600">
              <AlertCircle className="w-12 h-12" />
              <h2 className="text-lg font-bold">Convite Já Utilizado</h2>
              <p className="text-slate-500 text-sm">Este convite já foi resgatado por outra pessoa.</p>
            </div>
          )}

          {/* Convite encontrado — aguardando login */}
          {state === 'found' && !user && invite && (
            <div className="space-y-5">
              <div className="space-y-1">
                <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">Função</p>
                <p className="text-2xl font-bold text-slate-800">{roleLabel(invite.role)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">Identificação</p>
                <p className="text-base text-slate-600">{invite.name}</p>
              </div>
              <button
                onClick={handleLogin}
                className="w-full bg-slate-900 text-white font-bold text-sm py-4 rounded-2xl hover:bg-slate-800 transition-all active:scale-[0.98] shadow-md"
              >
                Entrar com Google
              </button>
              <p className="text-xs text-slate-400">Use a conta Google que você vai acessar o sistema diariamente.</p>
            </div>
          )}

          {/* Resgatando */}
          {(state === 'claiming') && (
            <div className="flex flex-col items-center gap-3 text-emerald-600">
              <Loader2 className="w-8 h-8 animate-spin" />
              <p className="text-sm font-medium text-slate-500">Ativando seu acesso…</p>
            </div>
          )}

          {/* Feito */}
          {state === 'done' && (
            <div className="flex flex-col items-center gap-3 text-emerald-600">
              <CheckCircle className="w-12 h-12" />
              <h2 className="text-lg font-bold">Acesso Ativado!</h2>
              <p className="text-slate-500 text-sm">Redirecionando para o sistema…</p>
            </div>
          )}

          {/* Erro */}
          {state === 'error' && (
            <div className="flex flex-col items-center gap-3 text-red-600">
              <AlertCircle className="w-12 h-12" />
              <h2 className="text-lg font-bold">Erro</h2>
              <p className="text-slate-500 text-sm">{errorMsg}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
