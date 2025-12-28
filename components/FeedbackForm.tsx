
import React, { useState, useMemo } from 'react';
import { FeedbackRecord } from '../types';

interface FeedbackFormProps {
  onFeedbackAdded: (feedback: FeedbackRecord) => void;
  feedbacks: FeedbackRecord[];
}

export const FeedbackForm: React.FC<FeedbackFormProps> = ({ onFeedbackAdded, feedbacks }) => {
  const [name, setName] = useState('');
  const [comment, setComment] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !comment) return;

    const newFeedback: FeedbackRecord = {
      id: Date.now().toString(),
      name,
      comment,
      date: new Date().toLocaleDateString('pt-BR')
    };

    onFeedbackAdded(newFeedback);
    setName('');
    setComment('');
  };

  const filteredFeedbacks = useMemo(() => {
    if (!searchTerm.trim()) return feedbacks;
    const term = searchTerm.toLowerCase();
    return feedbacks.filter(f => 
      f.name.toLowerCase().includes(term) || 
      f.comment.toLowerCase().includes(term)
    );
  }, [feedbacks, searchTerm]);

  const clearSearch = () => {
    setSearchTerm('');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Enviar Feedback do Participante</h2>
        <p className="text-slate-500 mb-8">Sua opinião ajuda a melhorar nossos treinamentos futuros.</p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 gap-6">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Nome Completo</label>
              <input 
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                placeholder="Como você gostaria de ser identificado?"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Seu Comentário</label>
              <textarea 
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all min-h-[150px]"
                placeholder="O que você achou do conteúdo, instrutor e plataforma?"
                required
              />
            </div>
          </div>

          <button 
            type="submit"
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 px-8 rounded-2xl transition-all shadow-lg shadow-indigo-100 w-full sm:w-auto"
          >
            Enviar Feedback <i className="fas fa-paper-plane ml-2"></i>
          </button>
        </form>
      </div>

      <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2 shrink-0">
            <i className="fas fa-list-ul text-indigo-600"></i> Feedbacks Recebidos ({filteredFeedbacks.length})
          </h3>
          
          <div className="flex items-center gap-3 w-full md:max-w-xs">
            <div className="relative w-full">
              <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
              <input 
                type="text"
                placeholder="Buscar feedbacks..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-9 pr-3 text-xs focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              />
            </div>
            {searchTerm && (
              <button 
                onClick={clearSearch}
                className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 shrink-0 uppercase tracking-wider"
              >
                Limpar Filtros
              </button>
            )}
          </div>
        </div>
        
        <div className="space-y-4">
          {filteredFeedbacks.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <i className="fas fa-comment-slash text-4xl mb-3 opacity-20"></i>
              <p>{searchTerm ? 'Nenhum feedback encontrado para esta busca.' : 'Nenhum feedback enviado ainda para esta turma.'}</p>
            </div>
          ) : (
            filteredFeedbacks.map((f) => (
              <div key={f.id} className="p-6 rounded-2xl bg-slate-50 border border-slate-100 animate-in slide-in-from-bottom-2 duration-300">
                <div className="flex justify-between items-start mb-2">
                  <span className="font-bold text-slate-900">{f.name}</span>
                  <span className="text-xs text-slate-400 font-medium">{f.date}</span>
                </div>
                <p className="text-slate-600 text-sm italic">"{f.comment}"</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
