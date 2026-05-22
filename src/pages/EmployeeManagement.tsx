import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { listUsers, updateUserRole, createInvite, UserProfile, UserRole } from '../lib/db';
import { Users, Copy, Check, Plus, X, Link } from 'lucide-react';

type InviteForm = { name: string; role: 'picker' | 'driver' };

export default function EmployeeManagement() {
  const { profile } = useAuthStore();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<InviteForm>({ name: '', role: 'picker' });
  const [createdLink, setCreatedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    listUsers().then((u) => {
      setUsers(u);
      setLoading(false);
    });
  }, []);

  const handleRoleChange = async (userId: string, role: UserRole) => {
    await updateUserRole(userId, role);
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role } : u)));
  };

  const handleCreateInvite = async () => {
    if (!form.name.trim() || !profile?.companyId) return;
    setCreating(true);
    try {
      const code = await createInvite(profile.companyId, form.name.trim(), form.role);
      const link = `${window.location.origin}/join/${code}`;
      setCreatedLink(link);
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  const copyLink = () => {
    if (!createdLink) return;
    navigator.clipboard.writeText(createdLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const closeModal = () => {
    setShowModal(false);
    setCreatedLink(null);
    setForm({ name: '', role: 'picker' });
  };

  const roleLabel = (r: string) =>
    r === 'admin' ? 'Admin' : r === 'picker' ? 'Separador' : r === 'driver' ? 'Motorista' : r;

  const roleColor = (r: string) =>
    r === 'admin'
      ? 'bg-purple-100 text-purple-700 border-purple-200'
      : r === 'picker'
      ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
      : 'bg-blue-100 text-blue-700 border-blue-200';

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-200 pb-4 gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800 tracking-tight">Equipe</h1>
          <p className="text-slate-500 text-xs mt-1 uppercase tracking-widest font-bold">Gestão de funcionários e convites</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-emerald-600 text-white font-bold text-sm px-5 py-2.5 rounded-xl hover:bg-emerald-500 transition-all shadow-sm active:scale-95 whitespace-nowrap"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          Novo Convite
        </button>
      </div>

      {/* Lista de usuários */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-100 overflow-hidden">
          {users.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Nenhum usuário cadastrado</p>
            </div>
          ) : (
            users.map((u) => (
              <div key={u.id} className="flex items-center justify-between px-5 py-4 gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
                    {u.name?.[0]?.toUpperCase() ?? '?'}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800 truncate">{u.name}</p>
                    <p className="text-xs text-slate-400 truncate">{u.email}</p>
                  </div>
                </div>
                <div className="shrink-0">
                  {u.id === profile?.id ? (
                    <span className={`text-xs font-bold px-3 py-1 rounded-full border ${roleColor(u.role)}`}>
                      {roleLabel(u.role)} (você)
                    </span>
                  ) : (
                    <select
                      value={u.role}
                      onChange={(e) => handleRoleChange(u.id, e.target.value as UserRole)}
                      className="text-xs font-bold border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 cursor-pointer hover:border-slate-400 transition-colors"
                    >
                      <option value="admin">Admin</option>
                      <option value="picker">Separador</option>
                      <option value="driver">Motorista</option>
                    </select>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Modal novo convite */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-5">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold text-slate-800">Novo Convite</h2>
              <button onClick={closeModal} className="p-1 text-slate-400 hover:text-slate-700 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {!createdLink ? (
              <>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-widest text-slate-500 block mb-1.5">
                      Nome / Identificação
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: João Silva"
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-widest text-slate-500 block mb-1.5">
                      Função
                    </label>
                    <select
                      value={form.role}
                      onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as 'picker' | 'driver' }))}
                      className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                    >
                      <option value="picker">Separador</option>
                      <option value="driver">Motorista</option>
                    </select>
                  </div>
                </div>
                <button
                  onClick={handleCreateInvite}
                  disabled={!form.name.trim() || creating}
                  className="w-full bg-emerald-600 text-white font-bold text-sm py-3.5 rounded-2xl hover:bg-emerald-500 disabled:opacity-50 transition-all active:scale-[0.98] shadow-sm"
                >
                  {creating ? 'Gerando…' : 'Gerar Link de Convite'}
                </button>
              </>
            ) : (
              <div className="space-y-4 text-center">
                <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
                  <Link className="w-7 h-7 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-700 mb-3">Link gerado com sucesso!</p>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-mono text-slate-600 break-all text-left">
                    {createdLink}
                  </div>
                </div>
                <button
                  onClick={copyLink}
                  className="w-full flex items-center justify-center gap-2 bg-slate-900 text-white font-bold text-sm py-3.5 rounded-2xl hover:bg-slate-800 transition-all active:scale-[0.98]"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copiado!' : 'Copiar Link'}
                </button>
                <button
                  onClick={closeModal}
                  className="w-full text-sm text-slate-500 hover:text-slate-700 py-2 transition-colors"
                >
                  Fechar
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
