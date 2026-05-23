import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { createOrder } from '../lib/db';
import { ClipboardPaste, Loader2, Check, AlertCircle, X, PackageCheck } from 'lucide-react';
import { motion } from 'motion/react';

interface CreateOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: any;
  onSuccess?: () => void;
}

export default function CreateOrderModal({ isOpen, onClose, profile, onSuccess }: CreateOrderModalProps) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [parsedData, setParsedData] = useState<any | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [team, setTeam] = useState<any[]>([]);
  const [selectedPicker, setSelectedPicker] = useState<string>('');

  useEffect(() => {
    if (!isOpen || !profile?.companyId) return;

    // Fetch team members/collaborators
    const tq = query(collection(db, 'users'), where('companyId', '==', profile.companyId));
    const unsubTeam = onSnapshot(tq, (snap) => {
      setTeam(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => unsubTeam();
  }, [isOpen, profile?.companyId]);

  if (!isOpen) return null;

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
        throw new Error(errorData.details || 'Falha ao processar lista');
      }
      const data = await res.json();
      setParsedData(data);
      // Auto-assign to current user if they are a collaborator creating this order
      if (profile?.role === 'picker' || profile?.role === 'driver') {
        setSelectedPicker(profile.id);
      } else {
        setSelectedPicker('');
      }
    } catch (err: any) {
      setError(`Erro ao extrair dados: ${err.message}`);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrder = async () => {
    if (!parsedData || !profile?.companyId) return;
    setCreating(true);
    try {
      const blocksData = parsedData.blocks.map((b: any) => {
        const block: any = {
          supplierName: b.supplierName || 'Fornecedor Não Identificado',
          clientName: parsedData.clientName,
          items: b.items.map((item: any, i: number) => ({ id: `item_${i}`, ...item, isPicked: false }))
        };
        if (selectedPicker) {
          block.pickerId = selectedPicker;
        }
        return block;
      });

      await createOrder({
        companyId: profile.companyId,
        clientName: parsedData.clientName,
        originalText: text,
        createdBy: profile.id,
      }, blocksData);

      setParsedData(null);
      setText('');
      onClose();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(`Erro ao salvar pedido: ${err.message}`);
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#090b10]/90 backdrop-blur-md">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0, y: 20 }} 
        animate={{ scale: 1, opacity: 1, y: 0 }} 
        className="bg-[#13161c] rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-[0_0_50px_-12px_rgba(0,0,0,0.8)] border border-slate-800/80 overflow-hidden"
      >
        {!parsedData ? (
          <div className="flex flex-col h-full overflow-hidden">
            <div className="p-6 md:p-8 flex justify-between items-center border-b border-slate-800/50 bg-[#13161c]">
              <div>
                <h3 className="font-bold text-2xl text-white tracking-tight">Lançar Novo Pedido</h3>
                <p className="text-xs font-medium text-slate-400 mt-1">Cole ou digite os itens para separar.</p>
              </div>
              <button 
                onClick={() => { onClose(); setText(''); setError(null); }} 
                className="text-slate-400 hover:text-white bg-slate-800/55 hover:bg-slate-700/50 rounded-full p-2.5 transition-colors"
              >
                <X className="w-5 h-5"/>
              </button>
            </div>
            
            <div className="p-6 md:p-8 flex-1 overflow-y-auto flex flex-col">
              <textarea
                className="w-full h-64 md:h-80 p-5 rounded-2xl border border-slate-800 bg-[#090b10] flex-1 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-none font-mono text-sm text-slate-200 placeholder:text-slate-600 outline-none transition-shadow"
                placeholder="Exemplo de pedido escrito ou colado...&#10;&#10;CLIENTE: JOÃO&#15;&#10;FORNECEDOR A (Box 12)&#10;2x Maca&#10;3x Pera&#10;&#10;FORNECEDOR B (Box 44)&#10;1x Laranja"
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              {error && (
                <div className="mt-4 text-orange-400 font-bold text-xs md:text-sm bg-orange-950/30 p-4 rounded-xl border border-orange-900/50 flex items-start md:items-center">
                  <AlertCircle className="w-5 h-5 mr-3 shrink-0 text-orange-500"/> 
                  <span>{error}</span>
                </div>
              )}
            </div>
            
            <div className="p-6 md:p-8 border-t border-slate-800/50 bg-[#13161c] flex justify-end">
              <button
                onClick={handleParse}
                disabled={loading || !text.trim()}
                className="w-full md:w-auto flex items-center justify-center px-8 py-4 bg-emerald-600 text-white font-bold uppercase tracking-widest text-xs rounded-xl hover:bg-emerald-500 disabled:opacity-50 transition-colors shadow-lg shadow-emerald-950/20 active:scale-[0.98]"
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
                  <h2 className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1.5 font-sans">Análise Concluída - Cliente / Info:</h2>
                  <p className="text-white font-bold text-xl md:text-2xl truncate font-sans">{parsedData.clientName}</p>
                </div>
                <button 
                  onClick={() => setParsedData(null)} 
                  className="relative z-10 bg-slate-800 p-2.5 rounded-xl text-[10px] uppercase font-black text-slate-300 hover:text-white hover:bg-slate-700 transition-colors tracking-widest whitespace-nowrap border border-slate-700"
                >
                  Alterar
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {parsedData.blocks.map((block: any, i: number) => (
                  <div key={i} className="bg-[#1a1d24] rounded-2xl shadow-sm border border-slate-800 flex flex-col overflow-hidden">
                    <div className="bg-[#13161c] px-5 py-4 border-b border-indigo-950 flex items-center gap-3">
                      <div className="bg-emerald-950 rounded-lg p-1.5 border border-emerald-900/50">
                        <PackageCheck className="w-4 h-4 text-emerald-500" />
                      </div>
                      <div>
                        <h3 className="font-bold text-white text-sm tracking-wide font-sans">{block.supplierName || 'Fornecedor Não Identificado'}</h3>
                      </div>
                    </div>
                    <ul className="divide-y divide-slate-800/50 px-5 py-2 flex-1 bg-[#1a1d24]">
                      {block.items.map((item: any, j: number) => (
                        <li key={j} className="py-3 flex justify-between items-center text-sm">
                          <span className="text-slate-300 font-medium truncate pr-3 font-sans">{item.name}</span>
                          <span className="shrink-0 font-mono text-white bg-slate-800 px-3 py-1.5 rounded-md text-xs font-bold border border-slate-700 leading-none">{item.quantity}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-6 md:p-8 bg-[#13161c] border-t border-slate-800/50 shrink-0 flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="w-full md:w-1/2">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 font-sans">Atribuir Provisoriamente</label>
                <select 
                  value={selectedPicker}
                  onChange={(e) => setSelectedPicker(e.target.value)}
                  className="w-full bg-[#090b10] border border-slate-800 rounded-xl px-4 py-3 text-sm font-bold text-slate-200 focus:outline-none focus:border-emerald-500 transition-colors cursor-pointer appearance-none font-sans"
                >
                  <option value="" className="bg-[#090b10]">Deixar em aberto</option>
                  {team.map((member: any) => (
                    <option key={member.id} value={member.id} className="bg-[#090b10]">
                      {member.name} ({member.role === 'picker' ? 'Separador' : member.role === 'driver' ? 'Motorista' : 'Admin'})
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="flex gap-3 w-full md:w-auto">
                <button
                  onClick={() => onClose()}
                  className="flex-1 md:flex-none flex items-center justify-center px-6 py-4 bg-slate-800 text-white font-bold text-xs tracking-widest uppercase rounded-xl hover:bg-slate-700 transition-all border border-slate-700 font-sans"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCreateOrder}
                  disabled={creating}
                  className="flex-1 md:flex-none flex items-center justify-center px-8 py-4 bg-emerald-600 text-white font-bold text-xs tracking-widest uppercase rounded-xl hover:bg-emerald-500 disabled:opacity-50 transition-all shadow-[0_0_30px_-5px_rgba(5,150,105,0.4)] active:scale-[0.98] font-sans"
                >
                  {creating ? <Loader2 className="w-5 h-5 mr-3 animate-spin" /> : <Check className="w-5 h-5 mr-3" />}
                  Confirmar Pedido
                </button>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
