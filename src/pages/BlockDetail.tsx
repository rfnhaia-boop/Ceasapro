import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, updateDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { OrderBlock, getUserProfile, UserProfile } from '../lib/db';
import { handleFirestoreError, OperationType } from '../lib/error';
import { useAuthStore } from '../store/useAuthStore';
import { Loader2, ArrowLeft, Play, CheckSquare, Square, Check, Camera, CheckCircle } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';

export default function BlockDetail() {
  const { blockId } = useParams<{ blockId: string }>();
  const [block, setBlock] = useState<OrderBlock | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [pickerInfo, setPickerInfo] = useState<UserProfile | null>(null);
  const { profile } = useAuthStore();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!blockId) return;
    const docRef = doc(db, 'order_blocks', blockId);
    const unsub = onSnapshot(docRef, async (snap) => {
      if (snap.exists()) {
        const data = { id: snap.id, ...snap.data() } as OrderBlock;
        setBlock(data);
        if (data.pickerId) {
           const pInfo = await getUserProfile(data.pickerId);
           setPickerInfo(pInfo);
        }
      } else {
        setBlock(null);
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `order_blocks/${blockId}`);
      setLoading(false);
    });
    return () => unsub();
  }, [blockId]);

  const handleStartPicking = async () => {
    if (!block || !profile) return;
    setActionLoading(true);
    try {
      const docRef = doc(db, 'order_blocks', block.id);
      await updateDoc(docRef, {
        status: 'picking',
        pickerId: profile.id,
        arrivedAt: serverTimestamp()
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `order_blocks`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleItem = async (index: number) => {
    if (!block || block.status !== 'picking') return;
    try {
      // Create a copy 
      const newItems = [...block.items];
      newItems[index] = { ...newItems[index], isPicked: !newItems[index].isPicked };
      
      const docRef = doc(db, 'order_blocks', block.id);
      await updateDoc(docRef, {
        items: newItems
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `order_blocks`);
    }
  };

  const shrinkImageSequence = (file: File): Promise<string> => {
     return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
           const img = new Image();
           img.onload = () => {
              const canvas = document.createElement('canvas');
              const MAX_WIDTH = 800; // Small size to avoid 1MB document limit
              const scaleSize = MAX_WIDTH / img.width;
              canvas.width = MAX_WIDTH;
              canvas.height = img.height * scaleSize;
              const ctx = canvas.getContext('2d');
              ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
              resolve(canvas.toDataURL('image/jpeg', 0.6));
           };
           img.src = e.target?.result as string;
        };
        reader.readAsDataURL(file);
     });
  };

  const handlePhotoAdd = async (e: React.ChangeEvent<HTMLInputElement>) => {
     const file = e.target.files?.[0];
     if (!file || !block) return;
     setActionLoading(true);
     try {
       const base64 = await shrinkImageSequence(file);
       const docRef = doc(db, 'order_blocks', block.id);
       await updateDoc(docRef, {
         photos: [...(block.photos || []), base64]
       });
     } catch (err) {
       handleFirestoreError(err, OperationType.UPDATE, 'order_blocks');
     } finally {
       setActionLoading(false);
     }
  };

  const handleFinish = async () => {
    if (!block) return;
    const allPicked = block.items.every(i => i.isPicked);
    if (!allPicked) {
      if (!window.confirm("Ainda há itens não marcados. Deseja finalizar com faltas?")) return;
    }
    
    setActionLoading(true);
    try {
      const docRef = doc(db, 'order_blocks', block.id);
      await updateDoc(docRef, {
        status: 'completed',
        completedAt: serverTimestamp()
      });
      // Optionally update the parent Order status checking if all blocks are completed... logic deferred or simple manual order completion.
      navigate('/picker');
    } catch(e) {
      handleFirestoreError(e, OperationType.UPDATE, 'order_blocks');
      setActionLoading(false);
    }
  };


  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin w-8 h-8 text-emerald-600" /></div>;
  if (!block) return <div className="p-8 text-center text-slate-500 font-bold">Bloco não encontrado.</div>;

  const progress = block.items.filter(i => i.isPicked).length / block.items.length * 100;

  return (
    <div className="max-w-3xl mx-auto pb-24 space-y-6">
      <button onClick={() => navigate('/picker')} className="flex items-center text-[10px] md:text-xs uppercase font-bold text-slate-400 hover:text-slate-800 transition-colors tracking-widest border-b border-slate-200 pb-4 w-full pt-2">
         <ArrowLeft className="w-5 h-5 mr-2" /> Voltar para Minhas Coletas
      </button>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden mb-6 flex flex-col">
         <header className="bg-emerald-900 text-white p-6 md:p-8 flex flex-col gap-2 relative">
            <div className="absolute top-0 right-0 -mr-12 -mt-12 w-48 h-48 bg-emerald-700 rounded-full blur-3xl opacity-30 pointer-events-none"></div>
            <div className="flex justify-between items-start relative z-10">
               <div>
                  <p className="text-[10px] md:text-xs text-emerald-200/80 uppercase tracking-widest mb-1.5 font-bold">Box / Fornecedor</p>
                  <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{block.supplierName}</h1>
               </div>
               {block.status === 'picking' && (
                  <div className="text-right bg-black/20 p-3 md:p-4 rounded-2xl backdrop-blur-sm border border-white/10">
                     <p className="text-[10px] md:text-xs uppercase font-bold tracking-widest text-emerald-300 mb-1">Separados</p>
                     <p className="text-2xl md:text-3xl font-bold text-white leading-none tracking-tighter">
                        {block.items.filter(i => i.isPicked).length} <span className="text-sm md:text-lg text-emerald-400 font-medium">/ {block.items.length}</span>
                     </p>
                  </div>
               )}
            </div>
         </header>

         {block.status === 'pending' && (
           <div className="p-8 md:p-12 text-center bg-[#fcfaf7]">
             <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner ring-1 ring-slate-200">
               <ArrowLeft className="w-8 h-8 text-slate-400 -rotate-90" />
             </div>
             <p className="text-slate-600 mb-8 font-medium text-lg max-w-sm mx-auto">Você chegou no local? Inicie a coleta para confirmar e registrar o tempo.</p>
             <button
               onClick={handleStartPicking}
               disabled={actionLoading}
               className="inline-flex items-center justify-center px-8 py-5 w-full md:w-auto text-sm font-bold uppercase tracking-widest rounded-2xl text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-xl shadow-emerald-600/20 active:scale-[0.98]"
             >
               {actionLoading ? <Loader2 className="w-6 h-6 mr-3 animate-spin"/> : <Play className="w-6 h-6 mr-3 fill-current" />}
               Iniciar Coleta
             </button>
           </div>
         )}

         {(block.status === 'picking' || block.status === 'completed') && (
           <div className="bg-[#fcfaf7]">
              <div className="h-1.5 bg-slate-100 w-full overflow-hidden">
                 <motion.div 
                   className="h-full bg-emerald-500" 
                   initial={{ width: 0 }}
                   animate={{ width: `${progress}%` }}
                 />
              </div>
              <ul className="divide-y divide-slate-100 bg-white shadow-inner">
                {block.items.map((item, idx) => (
                  <li 
                    key={idx} 
                    className={cn(
                       "px-4 md:px-8 py-5 md:py-6 flex items-center transition-colors group",
                       item.isPicked ? "bg-emerald-50/30" : "",
                       block.status === 'picking' ? "cursor-pointer hover:bg-slate-50 active:bg-slate-100" : ""
                    )}
                    onClick={() => block.status === 'picking' && handleToggleItem(idx)}
                  >
                    <div className={cn("mr-4 md:mr-6 transition-all duration-300", item.isPicked ? "text-emerald-500 scale-110" : "text-slate-300 group-hover:text-slate-400 group-active:scale-95")}>
                       {item.isPicked ? <CheckSquare className="w-8 h-8" /> : <Square className="w-8 h-8" />}
                    </div>
                    <div className={cn("flex-1 text-base md:text-lg font-medium transition-all", item.isPicked ? "text-slate-400 line-through decoration-slate-300" : "text-slate-800")}>
                      <span className="block">{item.name}</span>
                    </div>
                    <div className={cn("font-mono text-sm md:text-base font-bold px-3 py-1.5 rounded-lg border", item.isPicked ? "text-emerald-700 bg-emerald-100 border-emerald-200" : "bg-slate-100 border-slate-200 text-slate-600")}>
                      {item.quantity}
                    </div>
                  </li>
                ))}
              </ul>

              <div className="p-6 md:p-8 bg-slate-900 border-t-4 border-slate-800 text-white flex flex-col gap-6 rounded-b-3xl">
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400">Evidência ({block.photos?.length || 0})</h4>
                  </div>
                  <div className="flex flex-wrap gap-3">
                     {block.photos?.map((p, i) => (
                       <div key={i} className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-slate-700 relative group">
                          <img src={p} className="w-full h-full object-cover" alt="coleta" />
                       </div>
                     ))}
                     {block.status === 'picking' && (block.photos?.length || 0) < 5 && (
                        <div className="flex gap-4 items-center flex-1 min-w-[200px]">
                           <button onClick={() => fileInputRef.current?.click()} className="w-24 h-24 bg-slate-800/80 rounded-2xl border-2 border-dashed border-slate-600 flex items-center justify-center opacity-70 hover:opacity-100 hover:bg-slate-800 hover:border-emerald-500/50 transition-all active:scale-95">
                              <Camera className="w-8 h-8 text-slate-400" />
                           </button>
                           <div className="flex flex-col justify-center">
                             <p className="text-sm font-bold text-slate-300 mb-1">Adicionar foto da caixa</p>
                             <p className="text-xs uppercase tracking-widest text-slate-500 font-bold">OPCIONAL</p>
                           </div>
                        </div>
                     )}
                     <input type="file" accept="image/*" capture="environment" ref={fileInputRef} className="hidden" onChange={handlePhotoAdd}/>
                  </div>

                  {block.status === 'picking' && (
                    <div className="pt-6 mt-2 border-t border-slate-800/50">
                       <button
                         onClick={handleFinish}
                         disabled={actionLoading}
                         className="w-full flex justify-center py-5 px-4 rounded-2xl shadow-xl font-bold text-sm uppercase tracking-widest text-emerald-950 bg-emerald-400 hover:bg-emerald-300 focus:outline-none focus:ring-4 focus:ring-emerald-500/30 disabled:opacity-50 transition-all active:scale-[0.98]"
                       >
                         {actionLoading ? <Loader2 className="w-6 h-6 mr-3 animate-spin" /> : <Check className="w-6 h-6 mr-3" />}
                         Finalizar Bloco de Coleta
                       </button>
                    </div>
                  )}
              </div>
           </div>
         )}

         {block.status === 'completed' && (
            <div className="p-12 md:p-16 text-center bg-[#fcfaf7] flex flex-col items-center">
               <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-6 ring-4 ring-emerald-50">
                 <CheckCircle className="w-10 h-10" />
               </div>
               <h3 className="text-2xl font-bold text-slate-800 mb-3 tracking-tight">Coleta Concluída</h3>
               {pickerInfo && (
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-6 bg-white px-4 py-2 rounded-full border border-slate-200 shadow-sm">
                     Separado por: <span className="text-emerald-700">{pickerInfo.name}</span>
                  </p>
               )}
               <p className="text-slate-500 text-base mb-10 max-w-sm mx-auto leading-relaxed">Todos os itens deste fornecedor foram recolhidos com sucesso e lançados no sistema.</p>
               <button onClick={() => navigate('/picker')} className="inline-flex py-3 px-8 rounded-xl bg-slate-900 text-white font-bold text-sm uppercase tracking-widest hover:bg-slate-800 transition-all active:scale-95 shadow-md">Voltar à Lista</button>
            </div>
         )}
      </div>
    </div>
  );
}
