
import React, { useState, useRef } from 'react';
import { geminiService } from '../services/geminiService';

export const ImageEditor: React.FC = () => {
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [editedImage, setEditedImage] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setOriginalImage(reader.result as string);
        setEditedImage(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleEdit = async () => {
    if (!originalImage || !prompt) return;

    setIsProcessing(true);
    try {
      const result = await geminiService.editImage(originalImage, prompt);
      if (result) {
        setEditedImage(result);
      }
    } catch (error) {
      console.error(error);
      alert("Falha ao editar imagem. Verifique seu comando ou a qualidade da imagem.");
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadImage = () => {
    if (!editedImage) return;
    const link = document.createElement('a');
    link.href = editedImage;
    link.download = 'treinamento-editado-ia.png';
    link.click();
  };

  return (
    <div className="max-w-4xl mx-auto animate-in fade-in duration-500">
      <div className="mb-8 text-center md:text-left">
        <h2 className="text-3xl font-bold text-slate-900">IA de Mídia para Treinamento</h2>
        <p className="text-slate-500">Edite fotos de turmas, certificados ou materiais usando linguagem natural.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
              <i className="fas fa-image text-indigo-600"></i> Imagem Original
            </h3>
            
            <div 
              className={`aspect-video rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center overflow-hidden relative group transition-all cursor-pointer ${!originalImage ? 'bg-slate-50' : ''}`}
              onClick={() => !originalImage && fileInputRef.current?.click()}
            >
              {originalImage ? (
                <>
                  <img src={originalImage} className="w-full h-full object-cover" alt="Original" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button 
                      onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                      className="bg-white text-slate-900 px-4 py-2 rounded-lg font-bold text-sm shadow-xl"
                    >
                      Alterar Imagem
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-center p-6 pointer-events-none">
                  <i className="fas fa-cloud-upload-alt text-3xl text-slate-300 mb-3"></i>
                  <p className="text-sm font-semibold text-slate-500">Clique para enviar foto</p>
                </div>
              )}
            </div>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*" 
              onChange={handleImageUpload} 
            />
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
              <i className="fas fa-terminal text-indigo-600"></i> Comando IA
            </h3>
            <textarea 
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none min-h-[100px]"
              placeholder="Ex: 'Adicione um filtro profissional', 'Destaque o instrutor', 'Adicione o texto Parabéns Formandos'"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
            <button 
              onClick={handleEdit}
              disabled={!originalImage || !prompt || isProcessing}
              className={`w-full mt-4 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
                !originalImage || !prompt || isProcessing 
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed' 
                : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-100'
              }`}
            >
              {isProcessing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Processando...
                </>
              ) : (
                <>
                  <i className="fas fa-magic"></i> Aplicar Magia
                </>
              )}
            </button>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col h-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <i className="fas fa-wand-magic-sparkles text-indigo-600"></i> Resultado IA
              </h3>
              {editedImage && (
                <button 
                  onClick={downloadImage}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-800"
                >
                  <i className="fas fa-download mr-1"></i> Baixar Imagem
                </button>
              )}
            </div>

            <div className="flex-1 bg-slate-50 rounded-xl border border-slate-100 overflow-hidden min-h-[300px] flex items-center justify-center relative">
              {editedImage ? (
                <img src={editedImage} className="w-full h-full object-contain animate-in zoom-in duration-300" alt="Edited" />
              ) : isProcessing ? (
                <div className="text-center">
                  <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-slate-400 text-sm font-medium">Renderizando com Gemini...</p>
                </div>
              ) : (
                <div className="text-center text-slate-300 px-6">
                  <i className="fas fa-sparkles text-4xl mb-3 opacity-20"></i>
                  <p className="text-sm font-medium">A imagem editada aparecerá aqui</p>
                </div>
              )}
            </div>
            
            <div className="mt-4 p-4 bg-indigo-50 rounded-xl text-[10px] text-indigo-700 flex gap-3">
              <i className="fas fa-info-circle mt-0.5"></i>
              <p>O Gemini utiliza a imagem original como base. Seja específico nos comandos para obter melhores resultados visuais.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
