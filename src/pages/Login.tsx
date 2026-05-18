import { loginWithGoogle } from '../lib/firebase';
import { motion } from 'motion/react';
import { Truck, Package, Leaf } from 'lucide-react';

export default function Login() {
  const handleLogin = async () => {
    try {
      await loginWithGoogle();
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="min-h-screen bg-[#fcfaf7] text-slate-800 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80')] bg-cover bg-center opacity-10"></div>
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="sm:mx-auto sm:w-full sm:max-w-md relative z-10"
      >
        <div className="flex justify-center text-emerald-700">
          <Truck className="h-16 w-16" />
        </div>
        <h2 className="mt-6 text-center text-4xl font-extrabold text-slate-800 tracking-tight">
          Ceasa Delivery Pro
        </h2>
        <p className="mt-2 text-center text-sm text-slate-500">
          Gestão de Compras e Logística do Ceasa
        </p>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
        className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10"
      >
        <div className="bg-white py-8 px-4 shadow-sm sm:rounded-2xl sm:px-10 border-2 border-slate-100">
          <div className="space-y-6">
            <button
              onClick={handleLogin}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-lg font-bold text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-colors"
            >
              Entrar com Google
            </button>
            <div className="grid grid-cols-2 gap-4 mt-8 pt-6 border-t border-slate-100">
               <div className="flex flex-col items-center p-3 bg-[#fcfaf7] rounded-xl border border-slate-100 text-slate-500">
                 <Package className="w-6 h-6 mb-2 text-orange-500"/>
                 <span className="text-xs font-bold text-center uppercase tracking-widest">Separação</span>
               </div>
               <div className="flex flex-col items-center p-3 bg-[#fcfaf7] rounded-xl border border-slate-100 text-slate-500">
                 <Leaf className="w-6 h-6 mb-2 text-emerald-500"/>
                 <span className="text-xs font-bold text-center uppercase tracking-widest">Entrega</span>
               </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
