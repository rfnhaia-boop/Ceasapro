import { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { createOrder, Order, getCompany, Company, clearCompanyData, createInvite, createPurchase } from '../lib/db';
import { ClipboardPaste, Loader2, Check, AlertCircle, Eye, Building2, TrendingUp, BarChart3, Clock, PackageCheck, Trash2, Users, Plus, X, Truck, UserPlus, ShoppingCart } from 'lucide-react';
import { motion } from 'motion/react';
import { collection, query, orderBy, onSnapshot, limit, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/error';
import { Link } from 'react-router-dom';
import { cn } from '../lib/utils';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';

interface ParsedBlock {
  supplierName: string;
  items: { name: string; quantity: string }[];
}

interface ParsedList {
  clientName: string;
  blocks: ParsedBlock[];
}

export default function AdminDashboard() {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedList | null>(null);
  const [creating, setCreating] = useState(false);
  const { profile } = useAuthStore();
  const [error, setError] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [loadingPurchases, setLoadingPurchases] = useState(true);

  const [company, setCompany] = useState<Company | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'team' | 'purchases'>('dashboard');
  const [team, setTeam] = useState<any[]>([]);

  useEffect(() => {
    if (!profile?.companyId) return;

    // Fetch company info
    getCompany(profile.companyId).then(c => setCompany(c));

    // Fetch team
    const tq = query(collection(db, 'users'), where('companyId', '==', profile.companyId));
    const unsubTeam = onSnapshot(tq, (snap) => {
      setTeam(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const q = query(
      collection(db, 'orders'), 
      where('companyId', '==', profile.companyId),
      orderBy('createdAt', 'desc'), 
      limit(50) // Increased limit to have better charts
    );
    const unsub = onSnapshot(q, (snap) => {
      setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() } as Order)));
      setLoadingOrders(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'orders');
      setLoadingOrders(false);
    });
    
    // Purchases Query
    const pq = query(
      collection(db, 'purchases'),
      where('companyId', '==', profile.companyId)
    );
    const unsubPurchases = onSnapshot(pq, (snap) => {
      const dbPurchases = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Sort in memory to avoid requiring a composite index immediately
      dbPurchases.sort((a: any, b: any) => {
         const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
         const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
         return tB - tA;
      });
      setPurchases(dbPurchases);
      setLoadingPurchases(false);
    }, (err) => {
      console.error('Error fetching purchases:', err);
      setLoadingPurchases(false);
    });

    return () => { unsub(); unsubTeam(); unsubPurchases(); };
  }, [profile?.companyId]);

  const stats = useMemo(() => {
    const pending = orders.filter(o => o.status === 'pending').length;
    const picking = orders.filter(o => o.status === 'picking').length;
    const ready = orders.filter(o => o.status === 'ready').length;
    const delivered = orders.filter(o => o.status === 'delivered').length;
    
    return [
      { name: 'Pendente', value: pending, color: '#f97316' }, // orange-500
      { name: 'Separando', value: picking, color: '#3b82f6' }, // blue-500
      { name: 'Pronto', value: ready, color: '#eab308' }, // yellow-500
      { name: 'Entregue', value: delivered, color: '#10b981' }, // emerald-500
    ].filter(s => s.value > 0);
  }, [orders]);

  const totalActive = useMemo(() => orders.filter(o => o.status !== 'delivered').length, [orders]);

  const [selectedPicker, setSelectedPicker] = useState<string>('');

  const handleParse = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/parse-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.details || 'Failed to parse list');
      }
      const data = await res.json();
      setParsedData(data);
      setSelectedPicker(''); // Reset selection
    } catch (err: any) {
      setError(`Erro ao extrair dados: ${err.message}`);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const [clearing, setClearing] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false);
  
  // Purchase feature states
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [purchaseText, setPurchaseText] = useState('');
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [parsedPurchaseData, setParsedPurchaseData] = useState<any | null>(null);
  const [creatingPurchase, setCreatingPurchase] = useState(false);

  const handleParsePurchase = async () => {
    if (!purchaseText.trim()) return;
    setPurchaseLoading(true);
    setPurchaseError(null);
    try {
      const res = await fetch('/api/parse-purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: purchaseText })
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.details || 'Failed to parse list');
      }
      const data = await res.json();
      setParsedPurchaseData(data);
    } catch (err: any) {
      setPurchaseError(`Erro ao extrair dados: ${err.message}`);
      console.error(err);
    } finally {
      setPurchaseLoading(false);
    }
  };

  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState<'picker' | 'driver'>('picker');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [generatedInviteLink, setGeneratedInviteLink] = useState('');

  const handleGenerateInvite = async () => {
    if (!profile?.companyId || !inviteName.trim()) return;
    setInviteLoading(true);
    try {
       const code = await createInvite(profile.companyId, inviteName, inviteRole);
       setGeneratedInviteLink(`${window.location.origin}/?invite=${code}`);
    } catch (err) {
       console.error(err);
       alert('Erro ao gerar convite');
    } finally {
       setInviteLoading(false);
    }
  };

  const handleClearData = async () => {
    if (!profile?.companyId) return;
    const confirm = window.confirm('TEM CERTEZA? Isso vai apagar TODOS os pedidos e blocos de separação desta empresa. Esta ação é irreversível.');
    if (!confirm) return;
    setClearing(true);
    try {
      await clearCompanyData(profile.companyId);
      alert('Dados limpos com sucesso!');
    } catch (err) {
      alert('Erro ao limpar dados.');
      console.error(err);
    } finally {
      setClearing(false);
    }
  };

  const handleCreatePurchase = async () => {
    if (!parsedPurchaseData || !profile?.companyId) return;
    setCreatingPurchase(true);
    try {
      const purchaseId = await createPurchase({
        companyId: profile.companyId,
        originalText: purchaseText,
        destinations: parsedPurchaseData.destinations,
        createdBy: profile.id
      });
      setParsedPurchaseData(null);
      setPurchaseText('');
      setShowPurchaseModal(false);
      alert('Compra criada com sucesso!');
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar compra.');
    } finally {
      setCreatingPurchase(false);
    }
  };
  const handleCreateOrder = async () => {
    if (!parsedData || !profile) return;
    setCreating(true);
    try {
      const blocksData = parsedData.blocks.map(b => ({
        supplierName: b.supplierName,
        items: b.items.map((item, i) => ({ id: `item_${i}`, ...item, isPicked: false })),
        pickerId: selectedPicker || undefined,
      }));
      
      await createOrder({
        companyId: profile.companyId,
        clientName: parsedData.clientName,
        originalText: text,
        createdBy: profile.id,
      }, blocksData);

      setParsedData(null);
      setText('');
      setShowOrderModal(false);
      alert('Pedido criado com sucesso!');
    } catch (err) {
      console.error(err);
      alert('Erro ao criar pedido.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="w-full text-slate-100">
      <div className="max-w-4xl mx-auto space-y-8">
      {company && (
        <div className="bg-[#13161c] rounded-3xl p-6 md:p-8 border border-slate-800/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-[80px] pointer-events-none"></div>
          <div className="relative z-10 flex items-center gap-5">
             <div className="w-14 h-14 bg-slate-900 rounded-2xl flex items-center justify-center border border-slate-800 shadow-inner">
               <Building2 className="w-7 h-7 text-emerald-400" />
             </div>
             <div>
               <h1 className="text-2xl font-bold tracking-tight text-white">{company.name}</h1>
               <p className="text-sm font-medium text-slate-400 mt-0.5">Painel do Administrador</p>
             </div>
          </div>
          <div className="relative z-10 bg-[#090b10] p-4 rounded-2xl border border-slate-800/80 flex items-center gap-4 w-full md:w-auto shadow-inner">
             <div>
               <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">Link de Convite</p>
               <p className="font-mono text-base font-bold text-emerald-400 tracking-widest">{company.inviteCode}</p>
             </div>
             <button 
               onClick={() => {
                 const inviteUrl = `${window.location.origin}/?invite=${company.inviteCode}`;
                 navigator.clipboard.writeText(inviteUrl);
                 alert('Link copiado! Envie este link para sua equipe.');
               }}
               className="ml-auto bg-slate-800 p-2.5 rounded-xl hover:bg-slate-700 transition-colors text-white"
               title="Copiar Link de Convite"
             >
               <ClipboardPaste className="w-4 h-4 text-slate-300" />
             </button>
          </div>
        </div>
      )}

      {/* QUICK ACTIONS */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <button 
          onClick={() => setShowOrderModal(true)}
          className="relative overflow-hidden bg-[#13161c] p-5 rounded-3xl border border-slate-800/50 hover:bg-[#1a1d24] transition-all duration-300 flex flex-col items-start gap-4 group active:scale-[0.98] text-left"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-emerald-500/10 transition-colors"></div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-950/30 text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 relative z-10 shadow-sm border border-emerald-900/50">
            <Plus className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div className="relative z-10">
            <span className="font-bold text-base text-slate-200 block mb-1">Nova Venda</span>
            <span className="text-xs font-medium text-slate-500 line-clamp-2">Lançar um novo pedido para separação.</span>
          </div>
        </button>

        <button 
          onClick={() => setShowPurchaseModal(true)}
          className="relative overflow-hidden bg-[#13161c] p-5 rounded-3xl border border-slate-800/50 hover:bg-[#1a1d24] transition-all duration-300 flex flex-col items-start gap-4 group active:scale-[0.98] text-left"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-sky-500/10 transition-colors"></div>
          <div className="w-12 h-12 rounded-2xl bg-sky-950/30 text-sky-400 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 relative z-10 shadow-sm border border-sky-900/50">
            <ShoppingCart className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div className="relative z-10">
            <span className="font-bold text-base text-slate-200 block mb-1">Nova Compra</span>
            <span className="text-xs font-medium text-slate-500 line-clamp-2">Comprar mercadorias e unificar.</span>
          </div>
        </button>

        <button 
          onClick={() => setShowInviteModal(true)}
          className="relative overflow-hidden bg-[#13161c] p-5 rounded-3xl border border-slate-800/50 hover:bg-[#1a1d24] transition-all duration-300 flex flex-col items-start gap-4 group active:scale-[0.98] text-left"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-indigo-500/10 transition-colors"></div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-950/30 text-indigo-400 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 relative z-10 shadow-sm border border-indigo-900/50">
            <UserPlus className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div className="relative z-10">
            <span className="font-bold text-base text-slate-200 block mb-1">Novo Membro</span>
            <span className="text-xs font-medium text-slate-500 line-clamp-2">Acesso para sua equipe.</span>
          </div>
        </button>

        <button 
           onClick={handleClearData}
           disabled={clearing}
           className="relative overflow-hidden bg-[#13161c] p-5 rounded-3xl border border-slate-800/50 hover:bg-[#1a1d24] transition-all duration-300 flex flex-col items-start gap-4 group active:scale-[0.98] text-left disabled:opacity-70"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-red-500/10 transition-colors" style={{ display: clearing ? 'none' : 'block' }}></div>
          <div className="w-12 h-12 rounded-2xl bg-red-950/30 text-red-500 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 relative z-10 shadow-sm border border-red-900/50">
            {clearing ? <Loader2 className="w-6 h-6 stroke-[2.5] animate-spin" /> : <Trash2 className="w-6 h-6 stroke-[2.5]" />}
          </div>
          <div className="relative z-10">
            <span className="font-bold text-base text-slate-200 block mb-1">{clearing ? 'Limpando...' : 'Limpar Teste'}</span>
            <span className="text-xs font-medium text-slate-500 line-clamp-2">Apagar e reiniciar do zero.</span>
          </div>
        </button>
      </div>

      {/* TABS */}
      <div className="flex bg-[#13161c] p-1.5 rounded-2xl border border-slate-800/50">
        <button 
          onClick={() => setActiveTab('dashboard')} 
          className={cn("flex-1 py-3 px-4 font-bold text-sm tracking-wide rounded-xl transition-all shadow-sm", activeTab === 'dashboard' ? "bg-slate-800 text-white shadow-sm" : "bg-transparent text-slate-500 hover:text-slate-300 shadow-none hover:bg-slate-800/50")}
        >
          Pedidos (Vendas)
        </button>
        <button 
          onClick={() => setActiveTab('purchases')} 
          className={cn("flex-1 py-3 px-4 font-bold text-sm tracking-wide rounded-xl transition-all shadow-sm", activeTab === 'purchases' ? "bg-slate-800 text-white shadow-sm" : "bg-transparent text-slate-500 hover:text-slate-300 shadow-none hover:bg-slate-800/50")}
        >
          Compras & Recepção
        </button>
        <button 
          onClick={() => setActiveTab('team')} 
          className={cn("flex-1 py-3 px-4 font-bold text-sm tracking-wide rounded-xl transition-all shadow-sm", activeTab === 'team' ? "bg-slate-800 text-white shadow-sm" : "bg-transparent text-slate-500 hover:text-slate-300 shadow-none hover:bg-slate-800/50")}
        >
          Estatísticas da Equipe
        </button>
      </div>

      {activeTab === 'dashboard' ? (
        <div className="pt-2 space-y-6">
         {/* OVERVIEW STATS */}
         <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="col-span-1 md:col-span-2 bg-[#13161c] rounded-3xl shadow-sm border border-slate-800/50 p-6 md:p-8">
               <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-6">Status dos Pedidos (Hoje)</h2>
               <div className="flex flex-col sm:flex-row items-center justify-between gap-8 md:gap-12">
                 {stats.length > 0 ? (
                   <>
                     <div className="w-56 h-56 relative shrink-0">
                        <ResponsiveContainer width="100%" height="100%">
                           <PieChart>
                              <Pie
                                 data={stats}
                                 cx="50%"
                                 cy="50%"
                                 innerRadius={70}
                                 outerRadius={100}
                                 paddingAngle={4}
                                 dataKey="value"
                                 stroke="none"
                              >
                                 {stats.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                 ))}
                              </Pie>
                              <RechartsTooltip 
                                contentStyle={{ borderRadius: '16px', border: '1px solid rgba(30, 41, 59, 0.5)', backgroundColor: '#1e293b', color: '#f8fafc', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.5)' }}
                                itemStyle={{ color: '#f8fafc' }}
                              />
                           </PieChart>
                        </ResponsiveContainer>
                     </div>
                     <div className="flex-1 grid grid-cols-2 gap-4 w-full">
                       {stats.map((s) => (
                          <div key={s.name} className="flex flex-col border border-slate-800/50 p-4 rounded-2xl bg-[#090b10]/50 shadow-inner">
                            <div className="flex items-center gap-2 mb-2">
                               <div className="w-2.5 h-2.5 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.5)]" style={{ backgroundColor: s.color, boxShadow: `0 0 10px ${s.color}` }} />
                               <span className="text-[10.5px] uppercase font-bold text-slate-400 tracking-widest">{s.name}</span>
                            </div>
                            <span className="text-3xl font-black text-white leading-none tracking-tight">{s.value}</span>
                          </div>
                       ))}
                     </div>
                   </>
                 ) : (
                   <div className="h-56 w-full flex flex-col items-center justify-center text-slate-500 text-sm bg-[#090b10]/30 rounded-2xl border border-slate-800/30">
                     <PackageCheck className="w-10 h-10 mb-3 text-slate-700" />
                     <span className="font-medium">Nenhum pedido processado hoje.</span>
                   </div>
                 )}
               </div>
            </div>

            <div className="col-span-1 flex flex-col gap-4">
               <div className="bg-emerald-600 rounded-3xl shadow-[0_0_40px_-10px_rgba(5,150,105,0.3)] p-6 md:p-8 text-white flex-1 flex flex-col justify-center relative overflow-hidden group">
                 <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-400 rounded-full blur-[80px] -mr-16 -mt-16 pointer-events-none opacity-40 group-hover:opacity-60 transition-opacity duration-700"></div>
                 <h2 className="text-xs font-bold uppercase tracking-widest text-emerald-100 mb-3 relative z-10">Pedidos Ativos</h2>
                 <p className="text-6xl font-black tracking-tighter relative z-10">{totalActive}</p>
                 <div className="mt-6 flex items-center text-emerald-100/90 text-sm font-bold tracking-wide relative z-10 bg-emerald-700/30 self-start px-3 py-1.5 rounded-lg backdrop-blur-sm">
                   <TrendingUp className="w-4 h-4 mr-2" />
                   Aguardando conclusão
                 </div>
               </div>
            </div>
         </div>

         <div className="flex justify-between items-end border-b border-slate-800/80 pb-3 pt-6">
            <div>
               <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight">Lista de Pedidos</h2>
               <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mt-1">Acompanhamento em tempo real</p>
            </div>
         </div>

         {loadingOrders ? (
            <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-emerald-500" /></div>
         ) : orders.length === 0 ? (
            <div className="text-slate-400 text-sm text-center py-24 bg-[#13161c] rounded-3xl border border-dashed border-slate-800 flex flex-col items-center gap-4">
               <PackageCheck className="w-12 h-12 text-slate-700" />
               <p className="font-bold tracking-wide">Nenhum pedido lançado.</p>
            </div>
         ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               {orders.map(order => (
                 <Link key={order.id} to={`/deliveries/${order.id}`} className="bg-[#13161c] rounded-2xl shadow-sm border border-slate-800/50 p-6 hover:border-emerald-500/30 hover:bg-[#161a22] transition-all duration-300 flex justify-between items-center group active:scale-[0.99]">
                    <div className="flex-1 mr-4 overflow-hidden">
                      <p className="font-bold text-white text-lg truncate mb-1">{order.clientName}</p>
                      <p className="text-[10px] text-slate-500 uppercase tracking-widest font-mono">ID: {order.id.slice(-6)}</p>
                    </div>
                    <div className="flex items-center gap-4 shrink-0 bg-[#090b10] px-1.5 py-1.5 rounded-xl border border-slate-800">
                       <span className={cn(
                         "text-[10px] uppercase tracking-widest font-black px-3 py-1.5 rounded-lg",
                         order.status === 'delivered' ? "bg-slate-800 text-slate-400" :
                         order.status === 'pending' ? "bg-orange-500/10 text-orange-400" :
                         "bg-emerald-500/10 text-emerald-400"
                       )}>
                         {order.status}
                       </span>
                       <div className="w-8 h-8 bg-slate-800 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                         <Eye className="w-4 h-4 text-slate-300 group-hover:text-emerald-400 transition-colors" />
                       </div>
                    </div>
                 </Link>
               ))}
            </div>
         )}
      </div>
      ) : null}

      {activeTab === 'purchases' ? (
        <div className="space-y-6 pt-4">
           {loadingPurchases ? (
              <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-sky-500" /></div>
           ) : purchases.length === 0 ? (
              <div className="text-slate-400 text-sm text-center py-24 bg-[#13161c] rounded-3xl border border-dashed border-slate-800 flex flex-col items-center gap-4">
                 <ShoppingCart className="w-12 h-12 text-slate-700" />
                 <p className="font-bold tracking-wide">Nenhuma compra/recebimento registrado.</p>
              </div>
           ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {purchases.map(purchase => (
                   <div key={purchase.id} className="bg-[#13161c] rounded-2xl shadow-sm border border-slate-800/50 p-6 flex flex-col gap-4 relative overflow-hidden group">
                      <div className="absolute top-0 right-0 w-24 h-24 bg-sky-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>
                      <div className="flex justify-between items-start z-10">
                        <div>
                          <p className="font-bold text-white text-lg mb-1">{purchase.destinations?.length || 0} Destinos</p>
                          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-mono">ID: {purchase.id.slice(-6)}</p>
                        </div>
                        <span className={cn("text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border", 
                            purchase.status === 'completed' ? "bg-slate-500/10 text-slate-400 border-slate-700/50" :
                            purchase.status === 'separated' ? "bg-sky-500/10 text-sky-400 border-sky-900/50" :
                            purchase.status === 'arrived' ? "bg-emerald-500/10 text-emerald-400 border-emerald-900/50" :
                            "bg-orange-500/10 text-orange-400 border-orange-900/50"
                        )}>
                            {purchase.status === 'receiving' ? 'Aguard. Chegada' : purchase.status === 'arrived' ? 'No Pátio' : purchase.status === 'separated' ? 'Separado' : 'Concluído'}
                        </span>
                      </div>
                      
                      <div className="z-10 grid grid-cols-2 gap-2 mt-2">
                        <Link to={`/admin/purchases/${purchase.id}`} className="bg-sky-600/10 hover:bg-sky-600/20 text-sky-500 border border-sky-900/30 font-bold uppercase tracking-widest text-[10px] py-2.5 rounded-xl transition-colors flex justify-center items-center">
                          Ver Unificado
                        </Link>
                        {/* We could add logic to Separate here, or within the details page. We will do it inside the details. */}
                        <div className="bg-[#090b10] border border-slate-800 rounded-xl flex items-center justify-center p-2">
                           <Clock className="w-3.5 h-3.5 text-slate-500 mr-2" />
                           <span className="text-[10px] font-bold text-slate-400">{new Date(purchase.createdAt?.toDate()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        </div>
                      </div>
                   </div>
                 ))}
              </div>
           )}
        </div>
      ) : null}

      {activeTab === 'team' ? (
        <div className="space-y-6 pt-4">
           {/* TEAM STATS OVERVIEW */}
           <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="col-span-1 md:col-span-3 bg-[#13161c] rounded-3xl shadow-sm border border-slate-800/50 p-6 md:p-8 flex flex-col justify-center relative overflow-hidden group">
                 <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-[80px] pointer-events-none group-hover:bg-indigo-500/10 transition-colors"></div>
                 <div className="relative z-10 flex items-center justify-between">
                   <div>
                     <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Total de Membros</h2>
                     <p className="text-5xl font-black text-white">{team.length}</p>
                   </div>
                   <div className="w-16 h-16 bg-slate-800/50 rounded-2xl flex items-center justify-center border border-slate-700/50 hidden md:flex">
                     <Users className="w-8 h-8 text-slate-400" />
                   </div>
                 </div>
              </div>
           </div>

           {team.length === 0 ? (
             <div className="text-slate-400 text-sm text-center py-24 bg-[#13161c] rounded-3xl border border-dashed border-slate-800 flex flex-col items-center gap-4">
               <Users className="w-12 h-12 text-slate-700" />
               <p className="font-bold tracking-wide">Nenhum membro na equipe.</p>
             </div>
           ) : (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {team.map(member => (
                   <div key={member.id} className="bg-[#13161c] rounded-3xl shadow-sm border border-slate-800/50 flex flex-col overflow-hidden relative group hover:border-slate-700 transition-colors">
                      <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-slate-700 to-transparent group-hover:via-emerald-500/50 transition-colors"></div>
                      
                      <div className="p-6 flex-1 flex flex-col gap-6">
                          <div className="flex justify-between items-start">
                             <div className="flex gap-4 items-center">
                               <div className="w-14 h-14 rounded-full bg-[#090b10] border border-slate-800 flex items-center justify-center shadow-inner text-xl font-black text-slate-400">
                                 {member.name.charAt(0).toUpperCase()}
                               </div>
                               <div>
                                 <p className="font-bold text-white text-lg leading-tight mb-1">{member.name}</p>
                                 <p className="text-[10px] font-mono text-slate-500 line-clamp-1">{member.email}</p>
                               </div>
                             </div>
                          </div>
                          
                          <div className="flex">
                             <span className={cn("text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border", 
                                member.role === 'admin' ? "bg-emerald-500/10 text-emerald-400 border-emerald-900/50" :
                                member.role === 'picker' ? "bg-indigo-500/10 text-indigo-400 border-indigo-900/50" :
                                "bg-orange-500/10 text-orange-400 border-orange-900/50"
                             )}>
                                {member.role === 'admin' ? 'Administrador' : member.role === 'picker' ? 'Separador' : 'Entregador'}
                             </span>
                          </div>
                          
                          <div className="mt-auto">
                              {member.role === 'driver' && (
                                 <div className="bg-[#090b10] p-4 rounded-2xl border border-slate-800/80 flex flex-col items-center justify-center text-center gap-2">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Entregas Concluídas</span>
                                    <span className="text-3xl font-black text-white">{orders.filter(o => o.driverId === member.id && o.status === 'delivered').length}</span>
                                 </div>
                              )}
                              
                              {member.role === 'picker' && (
                                 <div className="bg-[#090b10] p-4 rounded-2xl border border-slate-800/80 flex items-center justify-center text-center gap-2">
                                    <div className="flex-1 flex flex-col items-center justify-center">
                                      <span className="block text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-1.5">Status</span>
                                      <span className="inline-block px-2.5 py-1 bg-emerald-500/10 text-emerald-400 font-black text-[10px] uppercase tracking-widest rounded-md border border-emerald-500/20">Ativo</span>
                                    </div>
                                    <div className="w-px h-8 bg-slate-800/80 mx-2"></div>
                                    <div className="flex-1 flex flex-col items-center justify-center">
                                      <span className="block text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-1">Ped. Aberto</span>
                                      <span className="block font-black text-slate-200 text-lg leading-none">{orders.filter(o => o.status === 'picking').length}</span>
                                    </div>
                                 </div>
                              )}
                              
                              {member.role === 'admin' && (
                                 <div className="bg-[#090b10] p-4 rounded-2xl border border-slate-800/80 flex flex-col items-center justify-center text-center gap-2">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Privilégio</span>
                                    <span className="text-xs font-bold text-emerald-500 flex items-center gap-1"><Check className="w-3 h-3" /> Acesso Total (Painel)</span>
                                 </div>
                              )}
                          </div>
                      </div>
                   </div>
                ))}
             </div>
           )}
        </div>
      ) : null}

      {/* PURCHASE MODAL */}
      {showPurchaseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#090b10]/80 backdrop-blur-md">
           <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} className="bg-[#13161c] rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-[0_0_50px_-12px_rgba(0,0,0,0.8)] border border-slate-800/80 overflow-hidden">
             
             {!parsedPurchaseData ? (
               <div className="flex flex-col h-full">
                 <div className="p-6 md:p-8 flex justify-between items-center border-b border-slate-800/50 bg-[#13161c]">
                   <div>
                     <h3 className="font-bold text-2xl text-white tracking-tight">Nova Compra / Recepção</h3>
                     <p className="text-xs font-medium text-slate-400 mt-1">Cole a lista de compras para unificar e separar.</p>
                   </div>
                   <button onClick={() => { setShowPurchaseModal(false); setPurchaseText(''); setPurchaseError(null); }} className="text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-700/50 rounded-full p-2.5 transition-colors"><X className="w-5 h-5"/></button>
                 </div>
                 
                 <div className="p-6 md:p-8 flex-1 overflow-y-auto">
                   <textarea
                     className="w-full h-64 md:h-80 p-5 rounded-2xl border border-slate-700 bg-[#090b10] flex-1 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 resize-none font-mono text-sm text-slate-200 placeholder:text-slate-600 outline-none transition-shadow"
                     placeholder="Exemplo...&#10;&#10;MORADA SP:&#10;1Cx Maça gala (MAURO)&#10;&#10;MORADA JUNDIAI:&#10;1/2Cx Abobrinha (MAURO)"
                     value={purchaseText}
                     onChange={(e) => setPurchaseText(e.target.value)}
                   />
                   {purchaseError && (
                      <div className="mt-4 text-orange-400 font-bold text-xs md:text-sm bg-orange-950/30 p-4 rounded-xl border border-orange-900/50 flex items-start md:items-center">
                        <AlertCircle className="w-5 h-5 mr-3 shrink-0 mt-0.5 md:mt-0 text-orange-500"/> 
                        <span>{purchaseError}</span>
                      </div>
                   )}
                 </div>
                 
                 <div className="p-6 md:p-8 border-t border-slate-800/50 bg-[#13161c] flex justify-end">
                   <button
                     onClick={handleParsePurchase}
                     disabled={purchaseLoading || !purchaseText.trim()}
                     className="w-full md:w-auto flex items-center justify-center px-8 py-4 bg-sky-600 text-white font-bold uppercase tracking-widest text-xs rounded-xl hover:bg-sky-500 disabled:opacity-50 transition-colors shadow-lg shadow-sky-900/20 active:scale-[0.98]"
                   >
                     {purchaseLoading ? <Loader2 className="w-5 h-5 mr-3 animate-spin" /> : <ClipboardPaste className="w-5 h-5 mr-3" />}
                     {purchaseLoading ? 'Analisando Estrutura...' : 'Avançar e Unificar'}
                   </button>
                 </div>
               </div>
             ) : (
               <div className="flex flex-col h-full overflow-hidden w-full">
                 <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
                   <div className="bg-[#090b10] p-6 rounded-2xl shadow-inner border border-slate-800/50 flex justify-between items-center relative overflow-hidden">
                      <div className="relative z-10 w-full pr-4">
                         <h2 className="text-[10px] font-black text-sky-500 uppercase tracking-widest mb-1.5">Lista de Compras Pronta</h2>
                         <p className="text-white font-bold text-xl md:text-2xl truncate">{parsedPurchaseData.destinations.length} Destino(s) Encontrado(s)</p>
                      </div>
                      <button onClick={() => setParsedPurchaseData(null)} className="relative z-10 bg-slate-800 p-2.5 rounded-xl text-[10px] uppercase font-black text-slate-300 hover:text-white hover:bg-slate-700 transition-colors tracking-widest whitespace-nowrap border border-slate-700">Alterar</button>
                   </div>

                   <div className="grid grid-cols-1 gap-4">
                     {parsedPurchaseData.destinations.map((dest: any, i: number) => (
                       <div key={i} className="bg-[#1a1d24] rounded-2xl shadow-sm border border-slate-800 flex flex-col overflow-hidden">
                         <div className="bg-[#13161c] px-5 py-4 border-b border-slate-800 flex items-center gap-3">
                           <div className="bg-sky-950 rounded-lg p-1.5 border border-sky-900/50">
                             <Truck className="w-4 h-4 text-sky-500" />
                           </div>
                           <div>
                             <h3 className="font-bold text-white text-sm tracking-wide">{dest.name}</h3>
                           </div>
                         </div>
                         <ul className="divide-y divide-slate-800/50 px-5 py-2 flex-1 bg-[#1a1d24]">
                           {dest.items.map((item: any, j: number) => (
                             <li key={j} className="py-3 flex justify-between items-center text-sm gap-2">
                               <div className="flex-1 truncate">
                                 <span className="text-slate-300 font-medium">{item.name}</span>
                                 <span className="text-[10px] uppercase text-slate-500 ml-2 font-black tracking-widest">({item.supplier})</span>
                               </div>
                               <span className="shrink-0 font-mono text-white bg-slate-800 px-3 py-1.5 rounded-md text-xs font-bold border border-slate-700 leading-none">{item.quantity}</span>
                             </li>
                           ))}
                         </ul>
                       </div>
                     ))}
                   </div>
                 </div>

                 <div className="p-6 md:p-8 bg-[#13161c] border-t border-slate-800/50 shrink-0 flex flex-col md:flex-row gap-4 items-center justify-end">
                   <div className="flex gap-3 w-full md:w-auto justify-end">
                     <button
                       onClick={() => setShowPurchaseModal(false)}
                       className="flex-1 md:flex-none flex items-center justify-center px-6 py-4 bg-slate-800 text-white font-bold text-xs tracking-widest uppercase rounded-xl hover:bg-slate-700 transition-all border border-slate-700"
                     >
                       Cancelar
                     </button>
                     <button
                       onClick={handleCreatePurchase}
                       disabled={creatingPurchase}
                       className="flex-1 md:flex-none flex items-center justify-center px-8 py-4 bg-sky-600 text-white font-bold text-xs tracking-widest uppercase rounded-xl hover:bg-sky-500 disabled:opacity-50 transition-all shadow-[0_0_30px_-5px_rgba(14,165,233,0.4)] active:scale-[0.98]"
                     >
                       {creatingPurchase ? <Loader2 className="w-5 h-5 mr-3 animate-spin" /> : <Check className="w-5 h-5 mr-3" />}
                       Salvar e Unificar
                     </button>
                   </div>
                 </div>
               </div>
             )}
           </motion.div>
        </div>
      )}

      {/* ORDER MODAL */}
      {showOrderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#090b10]/80 backdrop-blur-md">
           <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} className="bg-[#13161c] rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-[0_0_50px_-12px_rgba(0,0,0,0.8)] border border-slate-800/80 overflow-hidden">
             
             {!parsedData ? (
               <div className="flex flex-col h-full">
                 <div className="p-6 md:p-8 flex justify-between items-center border-b border-slate-800/50 bg-[#13161c]">
                   <div>
                     <h3 className="font-bold text-2xl text-white tracking-tight">Lançar Novo Pedido</h3>
                     <p className="text-xs font-medium text-slate-400 mt-1">Cole ou digite os itens para separar.</p>
                   </div>
                   <button onClick={() => { setShowOrderModal(false); setText(''); setError(null); }} className="text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-700/50 rounded-full p-2.5 transition-colors"><X className="w-5 h-5"/></button>
                 </div>
                 
                 <div className="p-6 md:p-8 flex-1 overflow-y-auto">
                   <textarea
                     className="w-full h-64 md:h-80 p-5 rounded-2xl border border-slate-700 bg-[#090b10] flex-1 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-none font-mono text-sm text-slate-200 placeholder:text-slate-600 outline-none transition-shadow"
                     placeholder="Exemplo de pedido escrito ou colado...&#10;&#10;CLIENTE: JOÃO&#10;FORNECEDOR A (Box 12)&#10;2x Maca&#10;3x Pera&#10;&#10;FORNECEDOR B (Box 44)&#10;1x Laranja"
                     value={text}
                     onChange={(e) => setText(e.target.value)}
                   />
                   {error && (
                      <div className="mt-4 text-orange-400 font-bold text-xs md:text-sm bg-orange-950/30 p-4 rounded-xl border border-orange-900/50 flex items-start md:items-center">
                        <AlertCircle className="w-5 h-5 mr-3 shrink-0 mt-0.5 md:mt-0 text-orange-500"/> 
                        <span>{error}</span>
                      </div>
                   )}
                 </div>
                 
                 <div className="p-6 md:p-8 border-t border-slate-800/50 bg-[#13161c] flex justify-end">
                   <button
                     onClick={handleParse}
                     disabled={loading || !text.trim()}
                     className="w-full md:w-auto flex items-center justify-center px-8 py-4 bg-emerald-600 text-white font-bold uppercase tracking-widest text-xs rounded-xl hover:bg-emerald-500 disabled:opacity-50 transition-colors shadow-lg shadow-emerald-900/20 active:scale-[0.98]"
                   >
                     {loading ? <Loader2 className="w-5 h-5 mr-3 animate-spin" /> : <ClipboardPaste className="w-5 h-5 mr-3" />}
                     {loading ? 'Analisando e Estruturando...' : 'Avançar'}
                   </button>
                 </div>
               </div>
             ) : (
               <div className="flex flex-col h-full overflow-hidden w-full">
                 <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
                   <div className="bg-[#090b10] p-6 rounded-2xl shadow-inner border border-slate-800/50 flex justify-between items-center relative overflow-hidden">
                      <div className="relative z-10 w-full pr-4">
                         <h2 className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1.5">Análise Concluída - Cliente / Info:</h2>
                         <p className="text-white font-bold text-xl md:text-2xl truncate">{parsedData.clientName}</p>
                      </div>
                      <button onClick={() => setParsedData(null)} className="relative z-10 bg-slate-800 p-2.5 rounded-xl text-[10px] uppercase font-black text-slate-300 hover:text-white hover:bg-slate-700 transition-colors tracking-widest whitespace-nowrap border border-slate-700">Alterar</button>
                   </div>

                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     {parsedData.blocks.map((block, i) => (
                       <div key={i} className="bg-[#1a1d24] rounded-2xl shadow-sm border border-slate-800 flex flex-col overflow-hidden">
                         <div className="bg-[#13161c] px-5 py-4 border-b border-slate-800 flex items-center gap-3">
                           <div className="bg-emerald-950 rounded-lg p-1.5 border border-emerald-900/50">
                             <PackageCheck className="w-4 h-4 text-emerald-500" />
                           </div>
                           <div>
                             <h3 className="font-bold text-white text-sm tracking-wide">{block.supplierName}</h3>
                           </div>
                         </div>
                         <ul className="divide-y divide-slate-800/50 px-5 py-2 flex-1 bg-[#1a1d24]">
                           {block.items.map((item, j) => (
                             <li key={j} className="py-3 flex justify-between items-center text-sm">
                               <span className="text-slate-300 font-medium truncate pr-3">{item.name}</span>
                               <span className="shrink-0 font-mono text-white bg-slate-800 px-3 py-1.5 rounded-md text-xs font-bold border border-slate-700 leading-none">{item.quantity}</span>
                             </li>
                           ))}
                         </ul>
                       </div>
                     ))}
                   </div>
                 </div>

                 <div className="p-6 md:p-8 bg-[#13161c] border-t border-slate-800/50 shrink-0 flex flex-col md:flex-row gap-4 items-center justify-between">
                   <div className="w-full md:w-1/3">
                     <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Atribuir a um Separador (Opcional)</label>
                     <select 
                       value={selectedPicker}
                       onChange={(e) => setSelectedPicker(e.target.value)}
                       className="w-full bg-[#090b10] border border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-slate-200 focus:outline-none focus:border-emerald-500 transition-colors cursor-pointer appearance-none"
                     >
                       <option value="" className="bg-[#090b10]">Deixar em aberto</option>
                       {team.filter(t => t.role === 'picker').map(p => (
                         <option key={p.id} value={p.id} className="bg-[#090b10]">{p.name}</option>
                       ))}
                     </select>
                   </div>
                   
                   <div className="flex gap-3 w-full md:w-auto">
                     <button
                       onClick={() => setShowOrderModal(false)}
                       className="flex-1 md:flex-none flex items-center justify-center px-6 py-4 bg-slate-800 text-white font-bold text-xs tracking-widest uppercase rounded-xl hover:bg-slate-700 transition-all border border-slate-700"
                     >
                       Cancelar
                     </button>
                     <button
                       onClick={handleCreateOrder}
                       disabled={creating}
                       className="flex-1 md:flex-none flex items-center justify-center px-8 py-4 bg-emerald-600 text-white font-bold text-xs tracking-widest uppercase rounded-xl hover:bg-emerald-500 disabled:opacity-50 transition-all shadow-[0_0_30px_-5px_rgba(5,150,105,0.4)] active:scale-[0.98]"
                     >
                       {creating ? <Loader2 className="w-5 h-5 mr-3 animate-spin" /> : <Check className="w-5 h-5 mr-3" />}
                       Salvar e Separar
                     </button>
                   </div>
                 </div>
               </div>
             )}
           </motion.div>
        </div>
      )}

      {/* INVITE MODAL */}
      {showInviteModal && company && (
         <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#090b10]/80 backdrop-blur-md">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-[#13161c] rounded-3xl max-w-sm w-full p-6 shadow-[0_0_50px_-12px_rgba(0,0,0,0.8)] border border-slate-800/80">
               <div className="flex justify-between items-center mb-6">
                  <h3 className="font-bold text-xl text-white">Novo Funcionário</h3>
                  <button onClick={() => { setShowInviteModal(false); setGeneratedInviteLink(''); setInviteName(''); }} className="text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-700/50 rounded-full p-2.5 transition-colors"><X className="w-5 h-5"/></button>
               </div>
               
               {!generatedInviteLink ? (
                 <>
                   <p className="text-sm text-slate-400 mb-6">Defina o nome e a função do novo funcionário para gerar o link de acesso exclusivo.</p>
                   
                   <div className="space-y-5 mb-6">
                     <div>
                       <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Nome do Funcionário</label>
                       <input 
                         type="text" 
                         value={inviteName}
                         onChange={(e) => setInviteName(e.target.value)}
                         placeholder="Ex: João Silva"
                         className="w-full bg-[#090b10] border border-slate-700 rounded-xl px-4 py-3 placeholder:text-slate-600 font-bold text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                       />
                     </div>
                     
                     <div>
                       <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Função</label>
                       <div className="flex bg-[#090b10] p-1 rounded-xl border border-slate-700">
                         <button 
                           onClick={() => setInviteRole('picker')} 
                           className={cn("flex-1 py-2.5 text-sm font-bold rounded-lg transition-all", inviteRole === 'picker' ? "bg-[#13161c] text-indigo-400 shadow-sm border border-slate-700/50" : "text-slate-500 hover:text-slate-400 border border-transparent")}
                         >
                           Separador
                         </button>
                         <button 
                           onClick={() => setInviteRole('driver')} 
                           className={cn("flex-1 py-2.5 text-sm font-bold rounded-lg transition-all", inviteRole === 'driver' ? "bg-[#13161c] text-orange-400 shadow-sm border border-slate-700/50" : "text-slate-500 hover:text-slate-400 border border-transparent")}
                         >
                           Entregador
                         </button>
                       </div>
                     </div>
                   </div>

                   <button 
                     onClick={handleGenerateInvite}
                     disabled={inviteLoading || !inviteName.trim()}
                     className="w-full bg-emerald-600 text-white font-bold py-4 text-xs uppercase tracking-widest rounded-xl hover:bg-emerald-500 transition-colors flex items-center justify-center disabled:opacity-50 shadow-[0_0_30px_-5px_rgba(5,150,105,0.4)]"
                   >
                     {inviteLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Criar Link de Acesso'}
                   </button>
                 </>
               ) : (
                 <>
                   <p className="text-sm text-slate-400 mb-6">Envie o link abaixo para <strong className="text-white">{inviteName}</strong>. A conta e a função do usuário serão configuradas automaticamente após o login.</p>
                   
                   <div className="bg-[#090b10] border border-slate-800 p-4 rounded-2xl mb-6 shadow-inner">
                       <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Link de Convite</p>
                       <p className="font-mono text-emerald-400 font-bold break-all text-sm">{generatedInviteLink}</p>
                   </div>

                   <button 
                     onClick={() => {
                       navigator.clipboard.writeText(generatedInviteLink);
                       alert('Link copiado!');
                       setShowInviteModal(false);
                       setGeneratedInviteLink('');
                       setInviteName('');
                     }}
                     className="w-full bg-slate-800 text-white font-bold py-4 text-xs uppercase tracking-widest rounded-xl hover:bg-slate-700 transition-colors flex items-center justify-center border border-slate-700"
                   >
                     <ClipboardPaste className="w-5 h-5 mr-2" />
                     Copiar Link
                   </button>
                 </>
               )}
            </motion.div>
         </div>
      )}
      </div>
    </div>
  );
}
