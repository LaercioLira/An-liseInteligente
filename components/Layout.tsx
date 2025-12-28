
import React from 'react';
import { AppTab } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 selection:bg-indigo-100">
      <nav className="glass-effect border-b border-slate-200 px-8 py-4 flex flex-wrap items-center justify-between sticky top-0 z-[100] gap-4 shadow-sm">
        <div className="flex items-center gap-4 group cursor-pointer">
          <div className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform duration-300">
            <i className="fas fa-brain text-indigo-400 text-xl"></i>
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tighter leading-none">Análise <span className="text-indigo-600">Inteligente</span></h1>
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mt-1">Desenvolvido por Laercio Lira</p>
          </div>
        </div>
      </nav>
      
      <main className="flex-1 w-full max-w-[1400px] mx-auto px-6 py-10">
        {children}
      </main>
      
      <footer className="py-12 bg-white border-t border-slate-100">
        <div className="max-w-[1400px] mx-auto px-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-3 grayscale opacity-50">
             <i className="fas fa-code text-slate-400"></i>
             <span className="text-xs font-black tracking-widest text-slate-400 uppercase">Powered by Gemini Systems v3.0</span>
          </div>
          <div className="text-xs font-bold text-slate-400">
            &copy; {new Date().getFullYear()} Análise Inteligente. Todos os direitos reservados.
          </div>
          <div className="flex gap-4">
             <i className="fab fa-github text-slate-300 hover:text-slate-900 cursor-pointer transition-colors"></i>
             <i className="fab fa-linkedin text-slate-300 hover:text-indigo-600 cursor-pointer transition-colors"></i>
          </div>
        </div>
      </footer>
    </div>
  );
};
