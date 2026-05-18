import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, updateDoc, serverTimestamp, onSnapshot, getDocs, collection, query, where } from 'firebase/firestore';
import { Order, OrderBlock } from '../lib/db';
import { db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/error';
import { useAuthStore } from '../store/useAuthStore';
import { Loader2, ArrowLeft, Check, Camera, Navigation, FileText, CheckCircle2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';

export default function DeliveryDetail() {
  const { orderId } = useParams<{ orderId: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [blocks, setBlocks] = useState<OrderBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const { profile } = useAuthStore();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [nfNumber, setNfNumber] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!orderId) return;
    
    const docRef = doc(db, 'orders', orderId);
    const unsubOrder = onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        const o = { id: snap.id, ...snap.data() } as Order;
        setOrder(o);
        setNfNumber(o.nfNumber || '');
        setNotes(o.deliveryNotes || '');
      } else {
        setOrder(null);
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `orders`);
      setLoading(false);
    });

    // Get the blocks sizes to show what was ordered
    const qb = query(collection(db, 'order_blocks'), where('orderId', '==', orderId));
    getDocs(qb).then(snap => {
       setBlocks(snap.docs.map(d => ({id: d.id, ...d.data()} as OrderBlock)));
    });

    return () => unsubOrder();
  }, [orderId]);

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
     if (!file || !order) return;
     setActionLoading(true);
     try {
       const base64 = await shrinkImageSequence(file);
       const docRef = doc(db, 'orders', order.id);
       await updateDoc(docRef, {
         deliveryPhotos: [...(order.deliveryPhotos || []), base64]
       });
     } catch (err) {
       handleFirestoreError(err, OperationType.UPDATE, 'orders');
     } finally {
       setActionLoading(false);
     }
  };

  const handleStartDelivery = async () => {
     if (!order || !profile) return;
     setActionLoading(true);
     try {
       await updateDoc(doc(db, 'orders', order.id), {
          driverId: profile.id,
          deliveryStartedAt: serverTimestamp()
       });
     } catch(e) {
        handleFirestoreError(e, OperationType.UPDATE, 'orders');
     } finally {
        setActionLoading(false);
     }
  }

  const handleFinishDelivery = async () => {
    if (!order) return;
    setActionLoading(true);
    try {
      const docRef = doc(db, 'orders', order.id);
      await updateDoc(docRef, {
        status: 'delivered',
        nfNumber,
        deliveryNotes: notes,
        deliveryCompletedAt: serverTimestamp()
      });
      navigate('/deliveries');
    } catch(e) {
      handleFirestoreError(e, OperationType.UPDATE, 'orders');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin w-8 h-8 text-emerald-600" /></div>;
  if (!order) return <div className="p-8 text-center text-slate-500 font-bold">Pedido não encontrado.</div>;

  return (
    <div className="max-w-3xl mx-auto pb-24 space-y-6">
      <button onClick={() => navigate('/deliveries')} className="flex items-center text-[10px] md:text-xs uppercase font-bold text-slate-400 hover:text-slate-800 transition-colors tracking-widest border-b border-slate-200 pb-4 w-full pt-2">
         <ArrowLeft className="w-5 h-5 mr-2" /> Voltar para o painel
      </button>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden flex flex-col mb-6">
         <header className="bg-slate-900 text-white p-6 md:p-8 flex flex-col gap-2 relative">
            <div className="absolute top-0 right-0 -mr-12 -mt-12 w-48 h-48 bg-emerald-600/20 rounded-full blur-3xl pointer-events-none"></div>
            <div className="flex items-center justify-between relative z-10 mb-2">
              <div className="flex items-center gap-3">
                 <span className={cn(
                    "text-[10px] font-bold px-3 py-1.5 rounded-md uppercase tracking-widest border",
                    order.status === 'delivered' ? "bg-slate-800 text-slate-300 border-slate-700" : "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                 )}>
                    {order.status === 'delivered' ? 'Finalizado' : order.status}
                 </span>
              </div>
              <p className="text-[10px] md:text-xs text-slate-400 font-mono uppercase tracking-widest opacity-80 text-right">Id: {order.id.slice(-6)}</p>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight relative z-10">{order.clientName}</h1>
         </header>
         
         <div className="p-6 md:p-8 border-b border-slate-100">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest pb-3 mb-4">Resumo da Carga (Boxes)</h3>
            {blocks.length === 0 ? <p className="text-slate-500 text-sm">Carregando...</p> : (
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {blocks.map(b => (
                     <div key={b.id} onClick={() => navigate(`/picker/block/${b.id}`)} className="bg-white border-2 border-slate-100 rounded-2xl p-4 flex justify-between items-center shadow-sm cursor-pointer hover:border-emerald-300 transition-all hover:shadow-md active:scale-[0.98]">
                        <span className="font-bold text-slate-800 text-base h-full truncate mr-3">{b.supplierName}</span>
                        <span className={cn(
                           "flex-shrink-0 px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest",
                           b.status === 'completed' ? "bg-emerald-100 text-emerald-700" : "bg-orange-100 text-orange-700"
                        )}>
                           {b.status === 'completed' ? 'Pronto' : 'Pendente'}
                        </span>
                     </div>
                  ))}
               </div>
            )}
         </div>

         {order.status === 'delivered' ? (
            <div className="p-12 md:p-16 text-center bg-[#fcfaf7] flex flex-col items-center">
               <div className="w-20 h-20 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mb-6 ring-4 ring-white shadow-sm">
                 <CheckCircle2 className="w-10 h-10" />
               </div>
               <h3 className="text-2xl font-bold text-slate-800 mb-2 tracking-tight">Entrega Realizada</h3>
               <p className="text-slate-500 text-sm mb-6 bg-white px-4 py-2 rounded-full border border-slate-200">NF: {order.nfNumber || 'N/A'}</p>
               <button onClick={() => navigate('/deliveries')} className="text-emerald-600 font-bold text-sm uppercase tracking-widest hover:text-emerald-700 transition-colors">Voltar à Fila</button>
            </div>
         ) : (
            <div className="p-6 md:p-8 bg-[#fcfaf7] space-y-8 rounded-b-3xl">
               <div className="space-y-6">
                 <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Sua Nota Fiscal / Documento</label>
                    <div className="relative group">
                      <FileText className="w-6 h-6 absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-emerald-500 transition-colors" />
                      <input 
                        type="text" 
                        className="w-full pl-12 pr-4 py-4 text-lg border-2 border-slate-200 rounded-2xl focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-800 outline-none transition-all shadow-sm" 
                        placeholder="Número da NF ou Romaneio"
                        value={nfNumber}
                        onChange={e => setNfNumber(e.target.value)}
                      />
                    </div>
                 </div>

                 <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Observações (Opcional)</label>
                    <textarea 
                      className="w-full p-4 text-base border-2 border-slate-200 rounded-2xl focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-800 outline-none transition-all shadow-sm min-h-[100px]" 
                      placeholder="Ex: Faltou 1 caixa de morango, cliente avisado."
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                    />
                 </div>
               </div>

               <div className="bg-slate-900 border-t-4 border-slate-800 text-white p-6 md:p-8 rounded-3xl flex flex-col gap-6 shadow-lg">
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400">Evidência de Carga ({order.deliveryPhotos?.length || 0})</h4>
                  </div>
                  <div className="flex flex-wrap gap-3">
                     {order.deliveryPhotos?.map((p, i) => (
                       <div key={i} className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-slate-700 relative">
                          <img src={p} className="w-full h-full object-cover" alt="entrega" />
                       </div>
                     ))}
                     {(order.deliveryPhotos?.length || 0) < 5 && (
                        <div className="flex gap-4 items-center flex-1 min-w-[200px]">
                          <button onClick={() => fileInputRef.current?.click()} className="w-24 h-24 bg-slate-800/80 rounded-2xl border-2 border-dashed border-slate-600 flex items-center justify-center opacity-70 hover:opacity-100 hover:bg-slate-800 hover:border-emerald-500/50 transition-all active:scale-95">
                             <Camera className="w-8 h-8 text-slate-400" />
                          </button>
                          <div className="flex flex-col justify-center">
                            <p className="text-sm font-bold text-slate-300 mb-1">Adicionar Foto</p>
                            <p className="text-xs uppercase tracking-widest text-slate-500 font-bold">OPCIONAL</p>
                          </div>
                        </div>
                     )}
                     <input type="file" accept="image/*" capture="environment" ref={fileInputRef} className="hidden" onChange={handlePhotoAdd}/>
                  </div>
               </div>

               <div className="pt-2 flex flex-col gap-4">
                  {!order.deliveryStartedAt && (
                    <button
                      onClick={handleStartDelivery}
                      disabled={actionLoading}
                      className="w-full flex justify-center items-center py-5 px-4 border-2 border-slate-900 shadow-md text-sm font-bold uppercase tracking-widest rounded-2xl text-slate-900 bg-white hover:bg-slate-50 active:scale-95 transition-all focus:ring-4 focus:ring-slate-900/20"
                    >
                      <Navigation className="w-5 h-5 mr-3" />
                      Iniciar Logística (Rota)
                    </button>
                  )}

                  <button
                    onClick={handleFinishDelivery}
                    disabled={actionLoading || !nfNumber}
                    className={cn(
                       "w-full flex justify-center items-center py-5 px-4 rounded-2xl shadow-xl text-sm font-bold uppercase tracking-widest transition-all focus:outline-none focus:ring-4 active:scale-95",
                       !nfNumber 
                         ? "bg-slate-200 text-slate-400 cursor-not-allowed" 
                         : "bg-emerald-500 text-emerald-950 hover:bg-emerald-400 focus:ring-emerald-500/30"
                    )}
                  >
                    {actionLoading ? <Loader2 className="w-6 h-6 mr-3 animate-spin" /> : <Check className="w-6 h-6 mr-3" />}
                    Confirmar Entrega
                  </button>
               </div>
               {!nfNumber && <p className="text-[10px] md:text-xs text-orange-500 text-center font-bold uppercase tracking-widest mt-2 bg-orange-50 py-2 rounded-lg">Insira Número do Documento para habilitar conclusão</p>}
            </div>
         )}
      </div>
    </div>
  );
}
