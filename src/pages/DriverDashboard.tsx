import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { Order } from '../lib/db';
import { db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/error';
import { Link } from 'react-router-dom';
import { Truck, MapPin, ChevronRight, CheckCircle2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuthStore } from '../store/useAuthStore';

export default function DriverDashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const { profile } = useAuthStore();

  useEffect(() => {
    if (!profile?.companyId) return;

    const q = query(
       collection(db, 'orders'),
       where('companyId', '==', profile.companyId),
       where('status', 'in', ['pending', 'picking', 'ready', 'delivered'])
    );
    const unsub = onSnapshot(q, (snap) => {
      let data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
      
      data = data.filter(o => o.status !== 'delivered' || o.driverId === profile?.id);
      
      setOrders(data);
      setLoading(false);
    }, (err) => {
       handleFirestoreError(err, OperationType.LIST, 'orders');
       setLoading(false);
    });

    return () => unsub();
  }, [profile?.id]);

  if (loading) return <div className="p-8 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
       <div className="flex justify-between items-end border-b border-slate-200 pb-4 px-2 md:px-0">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-800 tracking-tight">Painel de Entregas</h1>
            <p className="text-slate-500 text-xs mt-1 uppercase tracking-widest font-bold">Selecione um pedido para iniciar a rota</p>
          </div>
       </div>

       {orders.length === 0 ? (
          <div className="bg-white rounded-3xl border border-dashed border-slate-200 p-12 text-center shadow-sm">
             <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Truck className="w-10 h-10 text-slate-300" />
             </div>
             <h3 className="text-slate-800 font-bold text-xl tracking-tight mb-2">Nenhuma entrega no momento</h3>
             <p className="text-slate-500 text-sm max-w-sm mx-auto">Não há pedidos na fila de entrega no momento.</p>
          </div>
       ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 px-2 md:px-0">
            {orders.map(order => (
               <Link 
                 key={order.id} 
                 to={`/deliveries/${order.id}`}
                 className={cn(
                    "block rounded-2xl p-5 md:p-6 transition-all duration-300 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 active:scale-[0.98]",
                    order.status === 'ready' 
                       ? "bg-white border-2 border-emerald-500 shadow-lg shadow-emerald-500/10"
                       : order.status === 'delivered'
                         ? "bg-slate-50 border-2 border-slate-200 opacity-70 cursor-default"
                         : "bg-white border-2 border-slate-100 shadow-sm hover:border-emerald-300 hover:shadow-md hover:-translate-y-1"
                 )}
                 onClick={(e) => order.status === 'delivered' && e.preventDefault()}
               >
                 <div className="flex items-center gap-3 mb-5">
                    <div className={cn("p-2.5 rounded-xl", order.status === 'ready' ? "bg-emerald-100/50" : order.status === 'delivered' ? "bg-slate-200" : "bg-slate-100")}>
                      {order.status === 'delivered' ? <CheckCircle2 className="w-6 h-6 text-slate-500" /> : <Truck className={cn("w-6 h-6", order.status === 'ready' ? "text-emerald-600" : "text-slate-500")} />}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-lg leading-none text-slate-800 line-clamp-1">{order.clientName}</h3>
                      <span className="text-[10px] text-slate-400 font-mono uppercase tracking-widest mt-1 block">ROTA DE CLIENTE</span>
                    </div>
                 </div>
                 
                 <div className="flex-1 space-y-2 py-4 border-t border-slate-50">
                    <div className="flex items-center text-sm font-medium text-slate-600 bg-slate-50 px-3 py-2 rounded-lg">
                       <MapPin className="w-4 h-4 mr-2 text-slate-400" /> 
                       {order.status === 'delivered' ? 'Entregue com sucesso' : 'Rota a definir'}
                    </div>
                 </div>
                 
                 <div className="mt-2 pt-4 border-t border-slate-100 flex justify-between items-center">
                    <span className={cn("text-xs font-bold uppercase tracking-widest flex items-center gap-1.5", 
                       order.status === 'ready' ? "text-emerald-600" : 
                       order.status === 'delivered' ? "text-slate-500" : "text-orange-500")}>
                      {order.status === 'pending' ? 'Pendente Separação' : 
                       order.status === 'picking' ? 'Em Separação' : 
                       order.status === 'ready' ? 'Pronto p/ Entrega' : 'Entregue'}
                    </span>
                    {order.status !== 'delivered' && (
                       <div className={cn("w-8 h-8 rounded-full flex items-center justify-center transition-colors", order.status === 'ready' ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500")}>
                          <ChevronRight className="w-5 h-5" />
                       </div>
                    )}
                 </div>
               </Link>
            ))}
          </div>
       )}
    </div>
  );
}
