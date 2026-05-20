import { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuthStore } from '../store/useAuthStore';
import { Purchase, createOrder } from '../lib/db';
import { ArrowLeft, Loader2, PackageCheck, Layers, ShoppingCart, Truck } from 'lucide-react';

export function PurchaseDetails() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuthStore();
  const navigate = useNavigate();
  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [loading, setLoading] = useState(true);
  const [separating, setSeparating] = useState(false);

  useEffect(() => {
    if (!id || !profile) return;
    const unsub = onSnapshot(doc(db, 'purchases', id), (docSnap) => {
      if (docSnap.exists()) {
        setPurchase({ id: docSnap.id, ...docSnap.data() } as Purchase);
      } else {
        setPurchase(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, [id, profile]);

  const unifiedList = useMemo(() => {
    if (!purchase) return [];
    const map = new Map<string, { supplier: string; name: string; quantities: string[] }>();
    
    purchase.destinations.forEach(dest => {
      dest.items.forEach(item => {
        const key = `${item.supplier}|${item.name}`;
        if (!map.has(key)) {
          map.set(key, { supplier: item.supplier, name: item.name, quantities: [] });
        }
        map.get(key)!.quantities.push(item.quantity);
      });
    });

    return Array.from(map.values()).sort((a, b) => a.supplier.localeCompare(b.supplier));
  }, [purchase]);

  const handleConfirmArrival = async () => {
    if (!purchase) return;
    try {
      const { updateDoc } = await import('firebase/firestore');
      await updateDoc(doc(db, 'purchases', purchase.id), { status: 'arrived' });
    } catch (err) {
      console.error(err);
      alert('Erro ao confirmar chegada.');
    }
  };

  const handleSeparate = async () => {
    if (!purchase || !profile?.companyId) return;
    if (purchase.status !== 'arrived') return;
    const confirm = window.confirm('Deseja iniciar a separação? Isso dividirá esta compra em pedidos (vendas) para cada destino.');
    if (!confirm) return;
    
    setSeparating(true);
    try {
      // For each destination, create an Order
      for (const dest of purchase.destinations) {
        if (!dest.items || dest.items.length === 0) continue;
        
        // Group items by supplier to create blocks
        const blocksMap = new Map<string, { name: string; quantity: string }[]>();
        dest.items.forEach(item => {
          const sup = item.supplier || 'Desconhecido';
          if (!blocksMap.has(sup)) blocksMap.set(sup, []);
          blocksMap.get(sup)!.push({ name: item.name, quantity: item.quantity });
        });

        const blocksData = Array.from(blocksMap.entries()).map(([supplierName, items]) => ({
          supplierName,
          items: items.map(it => ({ id: Math.random().toString(36).substring(7), name: it.name, quantity: it.quantity, isPicked: false }))
        }));
        
        if (blocksData.length === 0) continue;

        await createOrder({
          companyId: profile.companyId,
          clientName: dest.name,
          originalText: purchase.originalText,
          createdBy: profile.id
        }, blocksData);
      }

      // Update purchase status
      const { updateDoc } = await import('firebase/firestore');
      await updateDoc(doc(db, 'purchases', purchase.id), { status: 'separated' });
      alert('Vendas geradas com sucesso!');
      navigate('/');
    } catch (err) {
      console.error(err);
      alert('Erro ao realizar a separação.');
    } finally {
      setSeparating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#090b10] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-sky-500" />
      </div>
    );
  }

  if (!purchase) {
    return (
      <div className="min-h-screen bg-[#090b10] flex items-center justify-center text-slate-400">
        Compra não encontrada.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#090b10] font-sans pb-safe text-slate-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between mb-8">
          <Link to="/" className="flex items-center text-slate-400 hover:text-white transition-colors group">
            <div className="w-10 h-10 rounded-full bg-[#13161c] border border-slate-800 flex items-center justify-center mr-3 group-hover:bg-slate-800 transition-colors">
               <ArrowLeft className="w-5 h-5" />
            </div>
            <span className="font-bold text-sm tracking-wide uppercase">Voltar</span>
          </Link>
          <div className="bg-[#13161c] px-4 py-2 rounded-xl border border-slate-800 flex items-center shadow-inner">
             <div className={`w-2.5 h-2.5 rounded-full mr-2 ${purchase.status === 'receiving' ? 'bg-orange-500 animate-pulse' : purchase.status === 'arrived' ? 'bg-emerald-500' : 'bg-sky-500'}`}></div>
             <span className="font-bold text-xs uppercase tracking-widest text-slate-300">
               {purchase.status === 'receiving' ? 'Aguardando Chegada' : purchase.status === 'arrived' ? 'No Pátio' : 'Separado'}
             </span>
          </div>
        </div>

        <div className="bg-[#13161c] rounded-3xl p-6 md:p-8 border border-slate-800/50 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-sky-500/5 rounded-full blur-[80px]"></div>
          
          <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-xl bg-sky-950 border border-sky-900/50">
                  <ShoppingCart className="w-5 h-5 text-sky-400" />
                </div>
                <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">Recebimento Unificado</h1>
              </div>
              <p className="text-slate-400 font-medium text-sm ml-12">Total consolidado das compras por fornecedor e produto.</p>
            </div>
            
            {purchase.status === 'receiving' && (
              <button 
                onClick={handleConfirmArrival}
                className="flex items-center justify-center px-6 py-4 bg-emerald-600 text-white font-bold text-xs tracking-widest uppercase rounded-xl hover:bg-emerald-500 transition-all shadow-[0_0_30px_-5px_rgba(16,185,129,0.4)] active:scale-[0.98]"
              >
                <PackageCheck className="w-5 h-5 mr-3" />
                Confirmar Chegada
              </button>
            )}

            {purchase.status === 'arrived' && (
              <button 
                onClick={handleSeparate}
                disabled={separating}
                className="flex items-center justify-center px-6 py-4 bg-sky-600 text-white font-bold text-xs tracking-widest uppercase rounded-xl hover:bg-sky-500 disabled:opacity-50 transition-all shadow-[0_0_30px_-5px_rgba(14,165,233,0.4)] active:scale-[0.98]"
              >
                {separating ? <Loader2 className="w-5 h-5 mr-3 animate-spin"/> : <Layers className="w-5 h-5 mr-3" />}
                Separar Destinos
              </button>
            )}
          </div>

          <div className="space-y-6 relative z-10">
            {/* Unified list grouped by somewhat supplier/item logic, simplified as a flat list here */}
            <div className="bg-[#090b10] rounded-2xl border border-slate-800 overflow-hidden shadow-inner">
               <div className="p-4 bg-slate-900/50 border-b border-slate-800 flex justify-between items-center">
                 <h3 className="font-bold text-xs uppercase tracking-widest text-slate-400">Produtos para Receber</h3>
                 <span className="bg-slate-800 text-white font-black text-[10px] px-3 py-1 rounded-lg border border-slate-700">{unifiedList.length} Itens</span>
               </div>
               
               <ul className="divide-y divide-slate-800/50 p-2">
                 {unifiedList.map((item, idx) => (
                   <li key={idx} className="p-4 hover:bg-slate-900/30 transition-colors rounded-xl flex items-center justify-between gap-4">
                      <div>
                        <p className="font-bold text-slate-200 text-sm md:text-base leading-tight">
                           {item.name}
                        </p>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mt-1">
                           Forn: <span className="text-sky-400">{item.supplier}</span>
                        </p>
                      </div>
                      <div className="flex gap-1 flex-wrap justify-end max-w-[50%]">
                         {item.quantities.map((q, i) => (
                            <span key={i} className="inline-block bg-slate-800 border border-slate-700 text-slate-200 font-mono text-xs font-bold px-2 py-1 rounded-lg shadow-sm">
                              {q}
                            </span>
                         ))}
                      </div>
                   </li>
                 ))}
               </ul>
            </div>
            
            {/* Destinos summary */}
            <div className="pt-6 border-t border-slate-800/50">
               <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4 ml-2">Locais de Destino Previstos</h3>
               <div className="flex flex-wrap gap-3">
                  {purchase.destinations.map((d, i) => (
                     <div key={i} className="flex items-center gap-2 bg-[#090b10] border border-slate-800 px-4 py-2.5 rounded-xl">
                        <Truck className="w-4 h-4 text-slate-400" />
                        <span className="font-bold text-xs text-slate-300">{d.name} <span className="text-slate-600 font-mono ml-1">({d.items.length})</span></span>
                     </div>
                  ))}
               </div>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
