import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { createOrder, Order } from '../lib/db';
import { ClipboardPaste, Loader2, Check, AlertCircle, Eye } from 'lucide-react';
import { motion } from 'motion/react';
import { collection, query, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/error';
import { Link } from 'react-router-dom';
import { cn } from '../lib/utils';

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

  useEffect(() => {
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(15));
    const unsub = onSnapshot(q, (snap) => {
      setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() } as Order)));
      setLoadingOrders(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'orders');
      setLoadingOrders(false);
    });
    return () => unsub();
  }, []);

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
    } catch (err: any) {
      setError(`Erro ao extrair dados: ${err.message}`);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrder = async () => {
    if (!parsedData || !profile) return;
    setCreating(true);
    try {
      const blocksData = parsedData.blocks.map(b => ({
        supplierName: b.supplierName,
        items: b.items.map((item, i) => ({ id: `item_${i}`, ...item, isPicked: false })),
      }));
      
      await createOrder({
        clientName: parsedData.clientName,
        originalText: text,
        createdBy: profile.id,
      }, blocksData);

      setParsedData(null);
      setText('');
      alert('Pedido criado com sucesso!');
    } catch (err) {
      console.error(err);
      alert('Erro ao criar pedido.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Novo Pedido</h1>
      </div>
      
      {!parsedData ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-4">
          <label className="block text-[10px] md:text-sm font-bold text-slate-500 uppercase tracking-widest border-b border-slate-100 pb-2">Cole a lista do WhatsApp</label>
          <textarea
            className="w-full h-48 md:h-64 p-4 rounded-xl border-2 border-slate-100 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-none font-mono text-sm bg-[#fcfaf7] shadow-inner outline-none transition-shadow"
            placeholder="Exemplo:&#10;CAMPEÃO 28:&#10;(MAURO) 42Un&#10;(ZEQUINHA) 5Cx"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          {error && (
             <div className="text-orange-600 font-bold text-xs md:text-sm bg-orange-50 p-3 rounded-lg border border-orange-100 flex items-start md:items-center">
               <AlertCircle className="w-4 h-4 mr-2 shrink-0 mt-0.5 md:mt-0"/> 
               <span>{error}</span>
             </div>
          )}
          <div className="mt-2 text-right">
            <button
              onClick={handleParse}
              disabled={loading || !text.trim()}
              className="w-full md:w-auto flex items-center justify-center px-6 py-4 bg-emerald-600 text-white font-bold uppercase tracking-widest text-xs rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-lg shadow-emerald-500/20 active:scale-[0.98]"
            >
              {loading ? <Loader2 className="w-5 h-5 mr-3 animate-spin" /> : <ClipboardPaste className="w-5 h-5 mr-3" />}
              {loading ? 'Analisando...' : 'Analisar Lista'}
            </button>
          </div>
        </motion.div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center relative overflow-hidden">
             <div className="relative z-10">
                <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Cliente / Info:</h2>
                <p className="text-slate-800 font-bold text-lg md:text-xl">{parsedData.clientName}</p>
             </div>
             <button onClick={() => setParsedData(null)} className="relative z-10 bg-slate-100 p-2 rounded-lg text-[10px] uppercase font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-200 transition-colors tracking-wider whitespace-nowrap">Alterar Texto</button>
             <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none opacity-50"></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {parsedData.blocks.map((block, i) => (
              <div key={i} className="bg-white rounded-xl shadow-sm border-2 border-slate-100 hover:border-emerald-200 transition-colors overflow-hidden flex flex-col">
                <div className="bg-[#fcfaf7] px-4 py-3 border-b border-slate-100 flex items-center gap-3">
                  <div className="bg-emerald-100 p-1.5 rounded-lg">
                    <Check className="w-4 h-4 text-emerald-700" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 leading-none">{block.supplierName}</h3>
                  </div>
                </div>
                <ul className="divide-y divide-slate-50 px-4 py-2 flex-1">
                  {block.items.map((item, j) => (
                    <li key={j} className="py-2.5 flex justify-between items-center text-sm">
                      <span className="text-slate-700 font-medium truncate pr-2">{item.name}</span>
                      <span className="shrink-0 font-mono text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-md text-xs font-bold border border-emerald-100 leading-none">{item.quantity}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="pt-4 pb-12">
            <button
              onClick={handleCreateOrder}
              disabled={creating}
              className="w-full md:w-auto flex items-center justify-center md:float-right px-8 py-4 bg-slate-900 text-white font-bold text-xs tracking-widest uppercase rounded-xl hover:bg-slate-800 disabled:opacity-50 transition-all shadow-xl shadow-slate-900/20 active:scale-[0.98]"
            >
              {creating ? <Loader2 className="w-5 h-5 mr-3 animate-spin" /> : <Check className="w-5 h-5 mr-3" />}
              Confirmar e Separar Pedido
            </button>
          </div>
        </motion.div>
      )}

      {/* RECENT ORDERS */}
      {!parsedData && (
      <div className="pt-4 md:pt-8 space-y-4">
         <div className="flex justify-between items-end border-b border-slate-200 pb-2">
            <div>
               <h2 className="text-xl md:text-2xl font-bold text-slate-800 tracking-tight">Acompanhamento</h2>
               <p className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-slate-400 mt-0.5">Últimos Pedidos</p>
            </div>
         </div>

         {loadingOrders ? (
            <div className="py-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-emerald-600" /></div>
         ) : orders.length === 0 ? (
            <div className="text-slate-500 text-sm text-center py-12 bg-white rounded-2xl border border-dashed border-slate-200">
               <p className="font-bold">Nenhum pedido lançado.</p>
            </div>
         ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               {orders.map(order => (
                 <Link key={order.id} to={`/deliveries/${order.id}`} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 hover:border-emerald-300 hover:shadow-md transition-all flex justify-between items-center group active:scale-[0.99]">
                    <div className="flex-1 mr-4 overflow-hidden">
                      <p className="font-bold text-slate-800 truncate">{order.clientName}</p>
                      <p className="text-[10px] text-slate-400 uppercase tracking-widest font-mono mt-1">ID: {order.id.slice(-6)}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                       <span className={cn(
                         "text-[10px] uppercase font-bold px-2.5 py-1.5 rounded-lg border",
                         order.status === 'delivered' ? "bg-slate-50 text-slate-500 border-slate-200" :
                         order.status === 'pending' ? "bg-orange-50 text-orange-600 border-orange-100" :
                         "bg-emerald-50 text-emerald-700 border-emerald-100"
                       )}>
                         {order.status}
                       </span>
                       <Eye className="w-5 h-5 text-slate-300 group-hover:text-emerald-500 transition-colors hidden md:block" />
                    </div>
                 </Link>
               ))}
            </div>
         )}
      </div>
      )}
    </div>
  );
}
