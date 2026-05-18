import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { OrderBlock } from '../lib/db';
import { handleFirestoreError, OperationType } from '../lib/error';
import { Link } from 'react-router-dom';
import { PackageOpen, CheckCircle2, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuthStore } from '../store/useAuthStore';

export default function PickerDashboard() {
  const [blocks, setBlocks] = useState<OrderBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const { profile } = useAuthStore();

  useEffect(() => {
    // We get blocks that are either pending, or are being picked by current user
    const q = query(
       collection(db, 'order_blocks'),
       where('status', 'in', ['pending', 'picking', 'completed']),
    );
    
    const unsub = onSnapshot(q, (snap) => {
      let data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as OrderBlock));
      
      data = data.filter(b => 
        b.status === 'pending' || 
        (b.status === 'picking' && b.pickerId === profile?.id)
      );

      data.sort((a, b) => {
         if (a.status === 'picking' && b.status === 'pending') return -1;
         if (a.status === 'pending' && b.status === 'picking') return 1;
         return 0;
      });

      setBlocks(data);
      setLoading(false);
    }, (err) => {
       handleFirestoreError(err, OperationType.LIST, 'order_blocks');
       setLoading(false);
    });

    return () => unsub();
  }, [profile?.id]);

  if (loading) return <div className="p-8 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
       <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-200 pb-4 gap-4 px-2 md:px-0">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-800 tracking-tight">Coletas Disponíveis</h1>
            <p className="text-slate-500 text-xs mt-1 uppercase tracking-widest font-bold">Selecione um bloco/box para iniciar</p>
          </div>
       </div>

       {blocks.length === 0 ? (
          <div className="bg-white rounded-3xl border border-dashed border-slate-200 p-12 text-center shadow-sm">
             <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <PackageOpen className="w-10 h-10 text-slate-300" />
             </div>
             <h3 className="text-slate-800 font-bold text-xl tracking-tight mb-2">Nenhuma coleta no momento</h3>
             <p className="text-slate-500 text-sm max-w-sm mx-auto">Não há blocos pendentes para separação. Relaxe um pouco!</p>
          </div>
       ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 px-2 md:px-0">
            {blocks.map(block => (
               <Link 
                 key={block.id} 
                 to={`/picker/block/${block.id}`}
                 className={cn(
                    "block rounded-2xl p-5 md:p-6 transition-all duration-300 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 active:scale-[0.98]",
                    block.status === 'picking' 
                      ? "bg-white border-2 border-orange-400 shadow-lg shadow-orange-500/10" 
                      : "bg-white border-2 border-emerald-600 shadow-md hover:shadow-xl hover:shadow-emerald-500/10 hover:-translate-y-1"
                 )}
               >
                 <div className="flex items-start justify-between gap-3 mb-6">
                    <div className="flex items-center gap-3">
                       <div className={cn("p-2.5 rounded-xl", block.status === 'picking' ? "bg-orange-100/50" : "bg-emerald-100/50")}>
                         <PackageOpen className={cn("w-6 h-6", block.status === 'picking' ? "text-orange-600" : "text-emerald-600")} />
                       </div>
                       <div>
                         <h3 className="font-bold text-lg leading-none text-slate-800">{block.supplierName}</h3>
                         <span className="text-[10px] text-slate-400 font-mono uppercase tracking-widest mt-1 block">HORTIFRUTI / BOX</span>
                       </div>
                    </div>
                 </div>
                 
                 <div className="mb-6">
                    <div className="flex items-center gap-2 mb-2">
                       <span className="bg-slate-100 text-slate-700 text-xs font-bold px-2 py-0.5 rounded-md">{block.items.length} itens</span>
                    </div>
                    <p className="text-sm text-slate-500 line-clamp-2 leading-relaxed">
                       {block.items.map(i => i.name).join(', ')}
                    </p>
                 </div>
                 
                 <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                    {block.status === 'picking' ? (
                       <span className="text-xs font-bold text-orange-600 uppercase tracking-widest flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4" /> Em Andamento
                       </span>
                    ) : (
                       <span className="text-xs font-bold text-emerald-600 uppercase tracking-widest flex items-center gap-1.5 opacity-80">
                         Pendente
                       </span>
                    )}
                    <div className={cn("w-8 h-8 rounded-full flex items-center justify-center transition-colors", block.status === 'picking' ? "bg-orange-50 text-orange-600" : "bg-emerald-50 text-emerald-600")}>
                       <ChevronRight className="w-5 h-5" />
                    </div>
                 </div>
               </Link>
            ))}
          </div>
       )}
    </div>
  );
}
