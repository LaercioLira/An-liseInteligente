
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { StudentRecord, DashboardData, RefresherRecord, TrainingType } from '../types';
import { geminiService } from '../services/geminiService';
import { parseFile, downloadTemplate, generateSampleData, generateRefresherSampleData } from '../utils/excelParser';
import { generatePPTX } from '../services/presentationService';
import { generatePDF } from '../services/pdfService';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Cell, Legend, ReferenceLine, ComposedChart, Line
} from 'recharts';

type AnalysisStep = 'upload' | 'selecting_type' | 'selecting_status' | 'analyzing' | 'viewing';

export const Dashboard: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [step, setStep] = useState<AnalysisStep>('upload');
  
  // Staging state
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingRecords, setPendingRecords] = useState<any[] | null>(null);
  const [pendingFileName, setPendingFileName] = useState('');
  const [trainingType, setTrainingType] = useState<TrainingType>('initial');
  
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [studentFilter, setStudentFilter] = useState<string>('all');
  const [instructorFilter, setInstructorFilter] = useState<string>('all');
  
  // Refresher Specific Filters
  const [selectedIndicator, setSelectedIndicator] = useState<string>('all');
  const [selectedOperator, setSelectedOperator] = useState<string>('all');
  const [selectedRefresherInstructor, setSelectedRefresherInstructor] = useState<string>('all');
  
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  
  // Feedback/Email Modal State
  const [feedbackStudent, setFeedbackStudent] = useState<StudentRecord | RefresherRecord | null>(null);
  const [aiFeedback, setAiFeedback] = useState<string>('');
  const [loadingFeedback, setLoadingFeedback] = useState(false);
  const [showEmailDraft, setShowEmailDraft] = useState(false);

  // KPI Modal State
  const [activeKpiModal, setActiveKpiModal] = useState<'absenteeism' | 'turnover' | 'active' | null>(null);

  // AI Presenter State
  const [presenterData, setPresenterData] = useState<{ 
    title: string; 
    concept: string; 
    insight: string; 
    type: 'success' | 'warning' | 'danger' | 'neutral';
    relatedListAction?: () => void;
  } | null>(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  const dashboardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setStudentFilter('all');
    setInstructorFilter('all');
    setSelectedIndicator('all');
    setSelectedOperator('all');
    setSelectedRefresherInstructor('all');
    setCurrentPage(1);
  }, [data?.className]);

  useEffect(() => {
    setCurrentPage(1);
  }, [studentFilter, instructorFilter, selectedIndicator, selectedOperator, selectedRefresherInstructor]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    setPendingFileName(file.name.replace(/\.[^/.]+$/, ""));
    setError(null);
    setStep('selecting_type');
    e.target.value = ''; 
  };

  const handleTypeSelection = async (type: TrainingType) => {
    setTrainingType(type);
    if (!pendingFile && type === 'initial') { 
        // Logic for sample data if no file
        return; 
    }
    
    if (pendingFile) {
        try {
            const records = await parseFile(pendingFile, type);
            setPendingRecords(records);
            if (type === 'initial') {
                setStep('selecting_status');
            } else {
                startRefresherAnalysis(records as RefresherRecord[]);
            }
        } catch (err: any) {
            setError(err.message || "Erro ao processar arquivo.");
            setStep('upload');
        }
    }
  };

  const startRefresherAnalysis = async (records: RefresherRecord[]) => {
      try {
        setStep('analyzing');
        const analysis = await geminiService.analyzeRefresherData(records);
        setData({
            className: pendingFileName,
            type: 'refresher',
            records: records,
            analysis,
            isInProgress: false
        });
        setStep('viewing');
      } catch (err: any) {
        setError(err.message);
        setStep('upload');
      }
  }

  const startInitialAnalysis = async (status: 'in_progress' | 'completed') => {
    if (!pendingRecords) return;
    try {
      setStep('analyzing');
      const analysis = await geminiService.analyzeTrainingData(pendingRecords as StudentRecord[], status);
      
      setData({
        className: pendingFileName,
        type: 'initial',
        records: pendingRecords as StudentRecord[],
        analysis,
        isInProgress: status === 'in_progress'
      });
      setStep('viewing');
    } catch (err: any) {
      console.error("Analysis failed", err);
      setError(err.message || "Erro na análise da IA.");
      setStep('upload');
      setPendingRecords(null);
    }
  };

  const handleSampleData = async () => {
    // Default sample is Initial
    try {
        setStep('analyzing');
        const records = generateSampleData();
        const analysis = await geminiService.analyzeTrainingData(records, 'in_progress');
        setData({
            className: "Turma Exemplo - Formação",
            type: 'initial',
            records,
            analysis,
            isInProgress: true
        });
        setStep('viewing');
    } catch (e) {}
  };

  // Helper function to detect inverse metrics (Lower is Better)
  const isInverseMetric = (indicatorName: string) => {
    const lowerIsBetterKeywords = ['tma', 'tme', 'tempo', 'time', 'absente', 'rechamada', 'erro', 'desvio', 'churn', 'cancelamento', 'reclama'];
    return lowerIsBetterKeywords.some(k => indicatorName.toLowerCase().includes(k));
  };

  // --- AI Presenter Logic ---
  const openPresenter = (metric: string, value: number, context: 'initial' | 'refresher', listAction?: () => void) => {
    let title = "";
    let concept = "";
    let insight = "";
    let type: 'success' | 'warning' | 'danger' | 'neutral' = 'neutral';

    if (context === 'initial') {
        switch(metric) {
            case 'grade':
                title = "Média Geral da Turma";
                concept = "A média aritmética de todas as notas aplicadas até o momento. Reflete a absorção técnica do conteúdo.";
                if (value >= 8) {
                    insight = `Excelente! A turma está com ${value.toFixed(1)}, acima da meta de 8.0. O conteúdo está sendo bem absorvido.`;
                    type = 'success';
                } else if (value >= 7) {
                    insight = `Atenção. A média de ${value.toFixed(1)} está próxima da meta (8.0), mas requer reforço em tópicos específicos.`;
                    type = 'warning';
                } else {
                    insight = `Crítico. A média ${value.toFixed(1)} indica dificuldades generalizadas. Revise a metodologia ou o ritmo das aulas.`;
                    type = 'danger';
                }
                break;
            case 'absenteeism':
                title = "Taxa de Absenteísmo";
                concept = "Porcentagem de faltas em relação ao total de dias letivos. O limite aceitável de mercado costuma ser 5%.";
                if (value <= 5) {
                    insight = "Engajamento alto! A presença em sala está consistente, o que favorece o aprendizado.";
                    type = 'success';
                } else if (value <= 10) {
                    insight = `Sinal amarelo. ${value.toFixed(1)}% de faltas começa a impactar a continuidade do conteúdo.`;
                    type = 'warning';
                } else {
                    insight = `Alerta Vermelho! ${value.toFixed(1)}% é um índice muito alto. Verifique motivos de saúde ou desmotivação.`;
                    type = 'danger';
                }
                break;
            case 'turnover':
                title = "Taxa de Turnover (Evasão)";
                concept = "Percentual de alunos que desistiram ou foram desligados durante o processo de formação.";
                if (value === 0) {
                    insight = "Retenção perfeita! Todos os alunos iniciados continuam ativos.";
                    type = 'success';
                } else if (value < 10) {
                    insight = "Turnover controlado. Algumas perdas são esperadas, mas monitore os motivos de saída.";
                    type = 'warning';
                } else {
                    insight = "Turnover elevado. Perder muitos alunos na formação custa caro para a operação. Investigue a seleção ou o clima.";
                    type = 'danger';
                }
                break;
            case 'active':
                title = "Alunos Ativos";
                concept = "Contagem absoluta de alunos aptos a continuar o treinamento ou seguir para a operação.";
                insight = `Atualmente temos ${value} alunos em sala. Certifique-se de ter posições de atendimento (PAs) suficientes para todos na graduação.`;
                type = 'neutral';
                break;
        }
    } else {
        // Refresher logic with Smart Context
        const currentInd = selectedIndicator === 'all' ? 'Média Geral' : selectedIndicator;
        const isInverse = isInverseMetric(currentInd);

        switch(metric) {
            case 'evolution':
                title = "Evolução no Período";
                concept = `Variação percentual entre o resultado Pré e Pós-Reciclagem para ${currentInd}.`;
                
                if (isInverse) {
                    // Logic for TMA, Time, etc. (Negative is Good)
                    if (value < 0) {
                        insight = `Excelente! O indicador "${currentInd}" teve uma REDUÇÃO de ${Math.abs(value).toFixed(1)}%, o que representa ganho de eficiência operacional.`;
                        type = 'success';
                    } else if (value === 0) {
                        insight = `Estável. O indicador manteve o mesmo patamar.`;
                        type = 'warning';
                    } else {
                        insight = `Atenção. O indicador AUMENTOU ${value.toFixed(1)}%. Para métricas como ${currentInd}, o objetivo é a redução.`;
                        type = 'danger';
                    }
                } else {
                    // Standard Logic (Positive is Good)
                    if (value > 10) {
                        insight = `Crescimento robusto! O indicador subiu ${value.toFixed(1)}%, mostrando forte impacto do treinamento.`;
                        type = 'success';
                    } else if (value > 0) {
                        insight = `Melhoria positiva de ${value.toFixed(1)}%. O resultado está na direção certa.`;
                        type = 'warning';
                    } else {
                        insight = `Alerta. O indicador caiu ou ficou estagnado (${value.toFixed(1)}%). O treinamento não surtiu o efeito esperado de aumento.`;
                        type = 'danger';
                    }
                }
                break;
            case 'passed':
                title = "Meta Atingida (Pós)";
                concept = "Quantidade de operadores que alcançaram a meta estipulada para o indicador após o treinamento.";
                insight = `Monitorar este número é crucial para ROI. ${value} operadores agora entregam o resultado esperado.`;
                type = 'neutral';
                break;
            case 'eval':
                title = "Média Avaliação (Sala)";
                concept = "Nota média obtida no teste de conhecimento (prova teórica) aplicada durante a reciclagem.";
                if (value >= 9) {
                    insight = "Domínio teórico excelente. A turma entendeu os conceitos passados em sala.";
                    type = 'success';
                } else {
                    insight = "Atenção à teoria. Notas baixas aqui indicam que a mensagem do instrutor não foi clara.";
                    type = 'warning';
                }
                break;
            case 'score':
                title = "Performance Score IA";
                concept = "Índice calculado pela IA (0-100) ponderando evolução, atingimento de meta e notas de prova.";
                insight = "Este score resume a eficácia geral da ação de treinamento em um único número para a gestão.";
                type = value > 70 ? 'success' : 'warning';
                break;
        }
    }

    setPresenterData({ title, concept, insight, type, relatedListAction: listAction });
  };

  // --- Render Helpers ---

  const handleGenerateFeedback = async (student: StudentRecord) => {
    setFeedbackStudent(student);
    setLoadingFeedback(true);
    setAiFeedback('');
    try {
      const feedback = await geminiService.generateStudentFeedback(student);
      setAiFeedback(feedback);
    } catch (e) {
      setAiFeedback("Erro ao gerar feedback.");
    } finally {
      setLoadingFeedback(false);
    }
  };

  const handleGenerateRefresherFeedback = async (record: RefresherRecord) => {
      // Must set the state to trigger modal visibility
      setFeedbackStudent(record);
      setLoadingFeedback(true);
      setAiFeedback('');
      try {
          const feedback = await geminiService.generateRefresherFeedback(record);
          setAiFeedback(feedback);
      } catch (e) {
          console.error(e);
          setAiFeedback("Erro ao gerar feedback da IA.");
      } finally {
          setLoadingFeedback(false);
      }
  }

  const handleExportPdf = async () => {
    if (!data) return;
    setIsGeneratingPdf(true);
    try {
      await generatePDF('pdf-report-container', `Relatorio_${data.type}_${data.className.replace(/\s/g, '_')}`);
    } catch (e) {
      alert("Erro ao gerar PDF.");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // --- Initial Dashboard Logic (Legacy) ---
  const initialRecords = data?.type === 'initial' ? data.records as StudentRecord[] : [];
  
  const filteredInitialRecords = useMemo(() => {
     if (data?.type !== 'initial') return [];
     return initialRecords.filter(r => {
        return (studentFilter === 'all' || r.name === studentFilter) &&
               (instructorFilter === 'all' || r.instructor === instructorFilter);
     });
  }, [data, studentFilter, instructorFilter]);

  const initialStats = useMemo(() => {
      if (data?.type !== 'initial') return { avgGrade: 0, absenteeismRate: 0, turnoverRate: 0, activeCount: 0, totalAbsences: 0, turnoverCount: 0 };
      const total = filteredInitialRecords.length;
      if (total === 0) return { avgGrade: 0, absenteeismRate: 0, turnoverRate: 0, activeCount: 0, totalAbsences: 0, turnoverCount: 0 };
      
      const currentDay = Math.max(...filteredInitialRecords.map(r => r.daysFilled), 1);
      const avgGrade = filteredInitialRecords.reduce((a, b) => a + b.grade, 0) / total;
      const totalAbsences = filteredInitialRecords.reduce((a, b) => a + b.absences, 0);
      const absenteeismRate = ((totalAbsences / (total * currentDay)) * 100);
      const turnoverCount = filteredInitialRecords.filter(r => r.status !== 'active').length;
      return { avgGrade, absenteeismRate, turnoverRate: (turnoverCount / total) * 100, turnoverCount, activeCount: total - turnoverCount, totalAbsences };
  }, [filteredInitialRecords]);

  const studentNames = useMemo(() => {
    return Array.from(new Set(initialRecords.map(r => r.name))).sort();
  }, [initialRecords]);

  const instructors = useMemo(() => {
    return Array.from(new Set(initialRecords.map(r => r.instructor))).sort();
  }, [initialRecords]);

  const chartData = useMemo(() => {
     return [...filteredInitialRecords]
      .sort((a, b) => b.grade - a.grade)
      .slice(0, 30)
      .map(r => ({ name: r.name.split(' ')[0], grade: r.grade, absences: r.absences }));
  }, [filteredInitialRecords]);

  const chartColors = {
      primary: '#4F46E5',
      danger: '#E11D48',
      success: '#10B981'
  };

  const kpiModalData = useMemo(() => {
      if (!activeKpiModal) return [];
      switch(activeKpiModal) {
        case 'absenteeism': return filteredInitialRecords.filter(r => r.absences > 0).sort((a,b) => b.absences - a.absences);
        case 'turnover': return filteredInitialRecords.filter(r => r.status !== 'active');
        case 'active': return filteredInitialRecords.filter(r => r.status === 'active');
        default: return [];
      }
  }, [activeKpiModal, filteredInitialRecords]);

  const totalPages = Math.ceil(filteredInitialRecords.length / itemsPerPage);
  
  const paginatedRecords = useMemo(() => {
      const start = (currentPage - 1) * itemsPerPage;
      return filteredInitialRecords.slice(start, start + itemsPerPage);
  }, [filteredInitialRecords, currentPage, itemsPerPage]);

  const closeFeedbackModal = () => {
    setFeedbackStudent(null);
    setAiFeedback('');
  };

  const CustomChartTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload;
      const isRisk = d.grade < 8 || d.absences >= 3;
      return (
        <div className={`p-4 border shadow-xl rounded-xl z-50 ${isRisk ? 'bg-rose-50 border-rose-100' : 'bg-white border-slate-100'}`}>
          <div className="flex justify-between items-center mb-2">
            <p className="font-bold text-slate-900 text-sm">{label}</p>
            {isRisk && <span className="text-[10px] font-black bg-rose-500 text-white px-2 py-0.5 rounded uppercase">Risco</span>}
          </div>
          <div className="space-y-1">
              <div className="flex items-center gap-2">
                 <div className={`w-2 h-2 rounded-full ${d.grade < 8 ? 'bg-rose-500' : 'bg-indigo-500'}`}></div>
                 <p className="text-xs text-slate-600 font-bold">Nota: <span className="text-slate-900">{d.grade.toFixed(1)}</span></p>
              </div>
              <div className="flex items-center gap-2">
                 <div className={`w-2 h-2 rounded-full ${d.absences >= 3 ? 'bg-rose-500' : 'bg-slate-400'}`}></div>
                 <p className="text-xs text-slate-600 font-bold">Faltas: <span className="text-slate-900">{d.absences}</span></p>
              </div>
          </div>
        </div>
      );
    }
    return null;
  };

  // --- Refresher Dashboard Logic ---
  const refresherRecords = data?.type === 'refresher' ? data.records as RefresherRecord[] : [];
  
  const refresherIndicators = useMemo(() => {
    return Array.from(new Set(refresherRecords.map(r => r.indicator))).sort();
  }, [refresherRecords]);

  const refresherOperators = useMemo(() => {
    return Array.from(new Set(refresherRecords.map(r => r.name))).sort();
  }, [refresherRecords]);

  const refresherInstructors = useMemo(() => {
    return Array.from(new Set(refresherRecords.map(r => r.instructor))).sort();
  }, [refresherRecords]);

  const filteredRefresherRecords = useMemo(() => {
     let recs = refresherRecords;
     if (selectedIndicator !== 'all') {
         recs = recs.filter(r => r.indicator === selectedIndicator);
     }
     if (selectedOperator !== 'all') {
         recs = recs.filter(r => r.name === selectedOperator);
     }
     if (selectedRefresherInstructor !== 'all') {
         recs = recs.filter(r => r.instructor === selectedRefresherInstructor);
     }
     return recs;
  }, [refresherRecords, selectedIndicator, selectedOperator, selectedRefresherInstructor]);

  // Enhanced Refresher Chart Data Logic
  const refresherChartData = useMemo(() => {
      // Case 1: Specific Operator selected (Compare their indicators)
      if (selectedOperator !== 'all') {
          return filteredRefresherRecords.map(r => ({
              name: r.indicator, // X-Axis becomes the Indicator Name
              preResult: r.preResult,
              postResult: r.postResult,
              target: r.target,
              isAggregate: false,
              fullName: r.name // For tooltip
          }));
      }

      // Case 2: All Operators, Specific Indicator (Compare operators on this indicator)
      if (selectedIndicator !== 'all') {
          // Show individual operators for the selected indicator
          return filteredRefresherRecords
            .sort((a,b) => (b.postResult - b.preResult) - (a.postResult - a.preResult))
            .slice(0, 30) // Limit to top 30 for clarity
            .map(r => ({
                name: r.name.split(' ')[0], // Short name
                fullName: r.name,
                preResult: r.preResult,
                postResult: r.postResult,
                target: r.target,
                isAggregate: false
            }));
      }

      // Case 3: All Operators, All Indicators (Aggregated View)
      // Aggregate by Indicator to show summarized impact
      const grouped: Record<string, { totalPre: number, totalPost: number, totalTarget: number, count: number }> = {};
      // Use filtered records so it respects the instructor filter if applied
      const baseRecords = filteredRefresherRecords; 
      
      baseRecords.forEach(r => {
          if (!grouped[r.indicator]) grouped[r.indicator] = { totalPre: 0, totalPost: 0, totalTarget: 0, count: 0 };
          grouped[r.indicator].totalPre += r.preResult;
          grouped[r.indicator].totalPost += r.postResult;
          grouped[r.indicator].totalTarget += r.target;
          grouped[r.indicator].count++;
      });
      
      return Object.keys(grouped).map(ind => ({
          name: ind,
          preResult: grouped[ind].totalPre / grouped[ind].count,
          postResult: grouped[ind].totalPost / grouped[ind].count,
          target: grouped[ind].totalTarget / grouped[ind].count,
          isAggregate: true
      }));

  }, [filteredRefresherRecords, selectedIndicator, selectedOperator]); // Removed refresherRecords from dep array as filtered handles it

  const refresherStats = useMemo(() => {
      const total = filteredRefresherRecords.length;
      if (total === 0) return { avgPre: 0, avgEval: 0, avgPost: 0, evolution: 0, passed: 0, avgTarget: 0 };

      const avgPre = filteredRefresherRecords.reduce((a, b) => a + b.preResult, 0) / total;
      const avgEval = filteredRefresherRecords.reduce((a, b) => a + b.evaluation, 0) / total;
      const avgPost = filteredRefresherRecords.reduce((a, b) => a + b.postResult, 0) / total;
      const avgTarget = filteredRefresherRecords.reduce((a, b) => a + b.target, 0) / total;
      
      const evolution = ((avgPost - avgPre) / (avgPre || 1)) * 100;
      
      // Fix passed logic based on inverse metrics
      const passed = filteredRefresherRecords.filter(r => {
          const isInverse = isInverseMetric(r.indicator);
          return isInverse ? r.postResult <= r.target : r.postResult >= r.target;
      }).length;
      
      return { avgPre, avgEval, avgPost, evolution, passed, avgTarget };
  }, [filteredRefresherRecords]);


  // --- Render Views ---

  if (step === 'upload' || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] text-center space-y-10 animate-slide-up">
        {step === 'selecting_type' && (
             <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[110] flex flex-col items-center justify-center p-8">
             <div className="bg-white p-10 rounded-[3rem] shadow-2xl flex flex-col items-center gap-8 text-center max-w-xl animate-in zoom-in duration-300">
                <div className="w-20 h-20 bg-indigo-100 text-indigo-600 rounded-3xl flex items-center justify-center text-3xl">
                   <i className="fas fa-layer-group"></i>
                </div>
                <div className="space-y-3">
                   <h3 className="text-3xl font-black text-slate-900 tracking-tight">Qual o tipo de treinamento?</h3>
                   <p className="text-slate-500 font-medium">Selecione para aplicar a regra de negócio correta.</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-4 w-full">
                   <button 
                     onClick={() => handleTypeSelection('initial')}
                     className="flex-1 bg-white border-2 border-slate-200 hover:border-indigo-500 hover:text-indigo-600 p-6 rounded-3xl transition-all group"
                   >
                     <i className="fas fa-seedling text-2xl mb-3 block text-slate-400 group-hover:text-indigo-500"></i>
                     <span className="block font-black text-sm uppercase">Formação Inicial</span>
                     <span className="text-[10px] text-slate-400 font-bold block mt-1">Onboarding e Primeiros Passos</span>
                   </button>
                   <button 
                     onClick={() => handleTypeSelection('refresher')}
                     className="flex-1 bg-white border-2 border-slate-200 hover:border-emerald-500 hover:text-emerald-600 p-6 rounded-3xl transition-all group"
                   >
                     <i className="fas fa-sync-alt text-2xl mb-3 block text-slate-400 group-hover:text-emerald-500"></i>
                     <span className="block font-black text-sm uppercase">Reciclagem Operacional</span>
                     <span className="text-[10px] text-slate-400 font-bold block mt-1">Indicadores Operacionais (KPIs)</span>
                   </button>
                </div>
                <button onClick={() => { setStep('upload'); setPendingFile(null); }} className="text-slate-400 text-xs font-bold hover:text-slate-600 underline">Cancelar</button>
             </div>
           </div>
        )}

        {step === 'selecting_status' && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[110] flex flex-col items-center justify-center p-8">
            <div className="bg-white p-10 rounded-[3rem] shadow-2xl flex flex-col items-center gap-8 text-center max-w-xl animate-in zoom-in duration-300">
               <div className="w-20 h-20 bg-indigo-100 text-indigo-600 rounded-3xl flex items-center justify-center text-3xl">
                  <i className="fas fa-question-circle"></i>
               </div>
               <div className="space-y-3">
                  <h3 className="text-3xl font-black text-slate-900 tracking-tight">Qual o status desta turma?</h3>
                  <p className="text-slate-500 font-medium">Isso altera a perspectiva da análise de IA.</p>
               </div>
               <div className="flex flex-col sm:flex-row gap-4 w-full">
                  <button onClick={() => startInitialAnalysis('in_progress')} className="flex-1 bg-white border-2 border-slate-200 hover:border-amber-500 hover:text-amber-600 p-6 rounded-3xl transition-all group">
                    <span className="block font-black text-sm uppercase">Em Andamento</span>
                  </button>
                  <button onClick={() => startInitialAnalysis('completed')} className="flex-1 bg-white border-2 border-slate-200 hover:border-indigo-600 hover:text-indigo-600 p-6 rounded-3xl transition-all group">
                    <span className="block font-black text-sm uppercase">Concluída</span>
                  </button>
               </div>
            </div>
          </div>
        )}

        <div className="relative">
          <div className="w-28 h-28 bg-gradient-to-tr from-indigo-600 to-violet-500 text-white rounded-[2rem] flex items-center justify-center text-5xl shadow-2xl shadow-indigo-200 rotate-3 hover:rotate-0 transition-transform duration-500">
            <i className="fas fa-file-excel"></i>
          </div>
          <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-emerald-500 rounded-full border-4 border-slate-50 flex items-center justify-center text-white text-xs">
            <i className="fas fa-plus"></i>
          </div>
        </div>
        
        <div className="max-w-lg">
          <h2 className="text-4xl font-black text-slate-900 mb-4 tracking-tight leading-tight">Métrica, Governança e <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">IA Generativa</span></h2>
          <p className="text-slate-500 font-medium text-lg px-4">Análise técnica avançada. Converta planilhas em diagnósticos estratégicos instantaneamente.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-5 w-full max-w-xl px-4">
          <label className="flex-1 cursor-pointer bg-indigo-600 hover:bg-indigo-700 hover:scale-[1.02] active:scale-95 text-white font-bold py-5 px-8 rounded-2xl transition-all shadow-xl shadow-indigo-100 flex items-center justify-center gap-3">
            <i className="fas fa-upload text-xl"></i>
            <span className="text-lg">Analisar Planilha</span>
            <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileSelect} />
          </label>
          <button onClick={handleSampleData} className="flex-1 bg-white border-2 border-slate-200 text-slate-700 hover:border-indigo-600 hover:text-indigo-600 font-bold py-5 px-8 rounded-2xl transition-all flex items-center justify-center gap-3 hover:shadow-lg">
            <i className="fas fa-magic text-xl"></i> Ver Exemplo
          </button>
        </div>

        <div className="flex flex-col items-center gap-4">
          <div className="flex gap-4">
             <button onClick={() => downloadTemplate('initial')} className="group flex items-center gap-2 text-indigo-600 hover:text-indigo-800 text-sm font-bold">
                <i className="fas fa-download"></i> Modelo Inicial
             </button>
             <button onClick={() => downloadTemplate('refresher')} className="group flex items-center gap-2 text-emerald-600 hover:text-emerald-800 text-sm font-bold">
                <i className="fas fa-download"></i> Modelo Reciclagem
             </button>
          </div>
        </div>

        {error && (
          <div className="bg-rose-50 text-rose-600 px-6 py-4 rounded-2xl text-sm font-bold border border-rose-100 animate-in fade-in slide-in-from-top-4">
            <i className="fas fa-exclamation-triangle mr-2"></i> {error}
          </div>
        )}
        
        {step === 'analyzing' && (
           <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[100] flex flex-col items-center justify-center p-8">
             <div className="bg-white p-12 rounded-[3rem] shadow-2xl flex flex-col items-center gap-6 text-center max-w-md">
               <div className="w-20 h-20 border-8 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
               <h3 className="text-2xl font-black text-slate-900">Análise Inteligente</h3>
               <p className="text-slate-500 font-medium">Processando dados e gerando insights...</p>
             </div>
           </div>
        )}
      </div>
    );
  }

  // --- RENDER REFRESHER DASHBOARD ---
  if (data.type === 'refresher') {
      const recs = filteredRefresherRecords;
      
      const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
          const isAgg = payload[0].payload.isAggregate;
          return (
            <div className="bg-white p-4 border border-slate-100 shadow-xl rounded-xl">
              <p className="font-bold text-slate-900 text-sm mb-2">{isAgg ? `Média: ${label}` : `Operador: ${payload[0].payload.fullName || label}`}</p>
              {payload.map((p: any, i: number) => (
                <div key={i} className="flex items-center gap-2 text-xs font-bold" style={{ color: p.color }}>
                  <span>{p.name}:</span>
                  <span>{Number(p.value).toFixed(1)}</span>
                </div>
              ))}
            </div>
          );
        }
        return null;
      };

      return (
        <div id="dashboard-content" className="max-w-[1600px] mx-auto space-y-8 animate-slide-up bg-[#f8fafc] p-4 sm:p-6" ref={dashboardRef}>
           {/* Email Modal */}
           {showEmailDraft && (
             <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
               <div className="bg-white w-full max-w-2xl rounded-[2rem] shadow-2xl p-8 max-h-[90vh] overflow-y-auto">
                 <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-slate-900"><i className="fas fa-envelope-open-text mr-2 text-indigo-600"></i> Proposta de E-mail Corporativo</h3>
                    <button onClick={() => setShowEmailDraft(false)} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200"><i className="fas fa-times"></i></button>
                 </div>
                 <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 whitespace-pre-wrap text-sm text-slate-700 font-medium leading-relaxed">
                    {data.analysis?.emailDraft || "E-mail não gerado."}
                 </div>
                 <button onClick={() => navigator.clipboard.writeText(data.analysis?.emailDraft || "")} className="mt-4 bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold text-sm w-full hover:bg-indigo-700">Copiar E-mail</button>
               </div>
             </div>
           )}

            <div id="pdf-report-container" className="fixed -left-[9999px] top-0 w-[210mm] min-h-[297mm] bg-white p-12 text-slate-900 font-sans">
                {/* PDF CONTENT (Kept clean for printing) */}
                <div className="border-b-2 border-emerald-600 pb-6 mb-8 flex justify-between items-end">
                  <div>
                    <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tight">Relatório Analítico de Reciclagem</h1>
                    <p className="text-sm text-slate-500 font-medium mt-1">Análise Operacional de Call Center (KPIs)</p>
                  </div>
                  <div className="text-right">
                     <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Turma</p>
                     <p className="text-sm font-bold text-slate-900">{data.className}</p>
                  </div>
                </div>
                <div className="mb-8 p-6 bg-slate-50 border-l-4 border-emerald-500 rounded-r-lg">
                  <h3 className="text-xs font-black text-emerald-800 uppercase tracking-widest mb-2">Análise de Impacto (IA)</h3>
                  <p className="text-sm text-slate-700 leading-relaxed text-justify">{data.analysis?.summary}</p>
                </div>
                {/* Basic table for PDF */}
                <table className="w-full text-left border-collapse text-[10px] mb-8">
                     <thead>
                       <tr className="bg-slate-100 text-slate-500 uppercase">
                         <th className="py-2 px-2">Operador</th>
                         <th className="py-2 px-2">Indicador</th>
                         <th className="py-2 px-2 text-center text-slate-900 font-bold">Meta</th>
                         <th className="py-2 px-2 text-center">Pré</th>
                         <th className="py-2 px-2 text-center font-bold text-indigo-700">Pós</th>
                       </tr>
                     </thead>
                     <tbody>
                       {refresherRecords.slice(0, 20).map((r, i) => (
                         <tr key={i} className="border-b border-slate-100">
                           <td className="py-2 px-2 font-bold">{r.name}</td>
                           <td className="py-2 px-2 text-slate-600">{r.indicator}</td>
                           <td className="py-2 px-2 text-center font-bold text-slate-900 bg-slate-50">{r.target}</td>
                           <td className="py-2 px-2 text-center text-slate-500">{r.preResult.toFixed(1)}</td>
                           <td className="py-2 px-2 text-center font-bold bg-indigo-50 text-indigo-800">{r.postResult.toFixed(1)}</td>
                         </tr>
                       ))}
                     </tbody>
                   </table>
            </div>

            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-200 no-pdf">
                <div className="flex items-center gap-4">
                    <button onClick={() => { setData(null); setStep('upload'); }} className="w-12 h-12 rounded-2xl bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 flex items-center justify-center transition-colors">
                        <i className="fas fa-arrow-left"></i>
                    </button>
                    <div>
                        <h2 className="text-3xl font-black text-slate-900 tracking-tight">{data.className}</h2>
                        <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 text-[10px] font-black px-2.5 py-1 rounded-md mt-1">
                            RECICLAGEM OPERACIONAL
                        </span>
                    </div>
                </div>
                <div className="flex gap-3 no-pdf">
                    <button onClick={() => setShowEmailDraft(true)} className="bg-white text-slate-700 px-5 py-3 rounded-xl font-bold text-sm flex items-center gap-2 border border-slate-200 hover:text-indigo-600 shadow-sm transition-all hover:shadow-md">
                        <i className="fas fa-envelope"></i> Ver E-mail
                    </button>
                    <button onClick={handleExportPdf} disabled={isGeneratingPdf} className="bg-white text-slate-700 px-5 py-3 rounded-xl font-bold text-sm flex items-center gap-2 border border-slate-200 shadow-sm transition-all hover:shadow-md hover:text-rose-600">
                        {isGeneratingPdf ? <i className="fas fa-spinner animate-spin"></i> : <i className="fas fa-file-pdf text-rose-500"></i>} PDF Analítico
                    </button>
                    <button onClick={() => generatePPTX(data)} className="bg-slate-900 text-white px-5 py-3 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-slate-800 transition-all shadow-lg shadow-slate-200" title="Arquivo compatível para importação no Canva">
                         <i className="fas fa-file-powerpoint text-orange-400"></i> 
                         <span className="hidden sm:inline">Apresentação (PPTX/Canva)</span>
                    </button>
                </div>
            </div>

            {/* CONTROL BAR */}
            <div className="bg-white p-2 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row gap-2 items-center no-pdf">
               <div className="flex items-center gap-3 bg-emerald-50 px-4 py-3 rounded-xl border border-emerald-100 flex-1 w-full md:max-w-md">
                  <i className="fas fa-chart-line text-emerald-600"></i>
                  <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Filtrar Indicador:</span>
                  <select 
                    className="bg-transparent border-none w-full text-sm font-bold outline-none focus:ring-0 cursor-pointer text-emerald-900"
                    value={selectedIndicator}
                    onChange={(e) => setSelectedIndicator(e.target.value)}
                  >
                    <option value="all">Todos os Indicadores (Média Agregada)</option>
                    {refresherIndicators.map(ind => (
                      <option key={ind} value={ind}>{ind}</option>
                    ))}
                  </select>
               </div>

               <div className="w-px h-8 bg-slate-200 hidden md:block"></div>

               <div className="flex items-center gap-3 bg-emerald-50 px-4 py-3 rounded-xl border border-emerald-100 flex-1 w-full md:max-w-md">
                  <i className="fas fa-chalkboard-teacher text-emerald-600"></i>
                  <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Instrutor:</span>
                  <select 
                    className="bg-transparent border-none w-full text-sm font-bold outline-none focus:ring-0 cursor-pointer text-emerald-900"
                    value={selectedRefresherInstructor}
                    onChange={(e) => setSelectedRefresherInstructor(e.target.value)}
                  >
                    <option value="all">Todos os Instrutores</option>
                    {refresherInstructors.map(inst => (
                      <option key={inst} value={inst}>{inst}</option>
                    ))}
                  </select>
               </div>

               <div className="w-px h-8 bg-slate-200 hidden md:block"></div>

               <div className="flex items-center gap-3 bg-emerald-50 px-4 py-3 rounded-xl border border-emerald-100 flex-1 w-full md:max-w-md">
                  <i className="fas fa-user text-emerald-600"></i>
                  <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Operador:</span>
                  <select 
                    className="bg-transparent border-none w-full text-sm font-bold outline-none focus:ring-0 cursor-pointer text-emerald-900"
                    value={selectedOperator}
                    onChange={(e) => setSelectedOperator(e.target.value)}
                  >
                    <option value="all">Todos os Operadores</option>
                    {refresherOperators.map(op => (
                      <option key={op} value={op}>{op}</option>
                    ))}
                  </select>
               </div>

               <div className="text-xs font-bold text-slate-400 px-4 whitespace-nowrap">
                  {recs.length} reg.
               </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div onClick={() => openPresenter('evolution', refresherStats.evolution, 'refresher')} className="bg-gradient-to-br from-emerald-600 to-teal-700 p-6 rounded-[2rem] shadow-xl text-white relative overflow-hidden group hover:scale-[1.02] transition-transform cursor-pointer">
                    <h3 className="text-emerald-100 text-[10px] font-black uppercase tracking-widest mb-2">Evolução no Período</h3>
                    <div className="flex items-baseline gap-1">
                        <span className="text-5xl font-black">{refresherStats.evolution > 0 ? '+' : ''}{refresherStats.evolution.toFixed(1)}%</span>
                    </div>
                    <div className="mt-4 text-[10px] font-bold text-white uppercase tracking-wider bg-white/10 px-3 py-1.5 rounded-lg inline-block">
                       {selectedIndicator === 'all' ? 'Média Agregada' : `Variação em ${selectedIndicator}`}
                    </div>
                </div>
                
                <div onClick={() => openPresenter('passed', refresherStats.passed, 'refresher')} className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 hover:border-emerald-200 transition-all cursor-pointer group hover:scale-[1.02] hover:shadow-md">
                    <h3 className="text-slate-400 text-[10px] font-black uppercase tracking-widest group-hover:text-emerald-600 transition-colors">Meta Atingida (Pós)</h3>
                    <div className="flex items-end gap-2 mt-2">
                       <p className="text-4xl font-black text-emerald-600">{refresherStats.passed}</p>
                       <p className="text-lg font-bold text-slate-300 mb-1">/ {recs.length}</p>
                    </div>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full mt-3 overflow-hidden">
                       <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${(refresherStats.passed / recs.length) * 100}%` }}></div>
                    </div>
                </div>

                <div onClick={() => openPresenter('eval', refresherStats.avgEval, 'refresher')} className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 hover:border-amber-200 transition-all cursor-pointer group hover:scale-[1.02] hover:shadow-md">
                    <h3 className="text-slate-400 text-[10px] font-black uppercase tracking-widest group-hover:text-amber-600 transition-colors">Média Avaliação (Sala)</h3>
                    <p className="text-4xl font-black text-slate-900 mt-2">{refresherStats.avgEval.toFixed(1)}</p>
                    <p className="text-[10px] text-slate-400 mt-1">Teste de Conhecimento (0-10)</p>
                </div>

                <div onClick={() => openPresenter('score', data.analysis?.performanceScore || 0, 'refresher')} className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 hover:border-indigo-200 transition-all cursor-pointer group hover:scale-[1.02] hover:shadow-md">
                    <h3 className="text-slate-400 text-[10px] font-black uppercase tracking-widest group-hover:text-indigo-600 transition-colors">Performance Score (IA)</h3>
                    <p className="text-4xl font-black text-indigo-600 mt-2">{data.analysis?.performanceScore || 0}</p>
                    <p className="text-[10px] text-slate-400 mt-1">Índice Geral de Eficácia</p>
                </div>
            </div>

            <div className="grid grid-cols-12 gap-6">
                <div className="col-span-12 lg:col-span-8 bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100">
                    <div className="flex justify-between items-center mb-6">
                       <div>
                          <h3 className="font-bold text-slate-900 text-lg">Análise de Impacto Operacional</h3>
                          <p className="text-xs text-slate-500 mt-1">
                             {selectedOperator !== 'all' 
                              ? `Performance Individual: ${selectedOperator}`
                              : (selectedIndicator === 'all' 
                                  ? 'Médias consolidadas por Tipo de Indicador' 
                                  : `Performance individual: ${selectedIndicator} (Top 30 Evolução)`
                                )
                             }
                          </p>
                       </div>
                    </div>
                    
                    <div className="h-[400px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={refresherChartData} margin={{top: 20, right: 30, left: 20, bottom: 5}}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#64748b'}} interval={0} angle={-45} textAnchor="end" height={80} />
                                <YAxis yAxisId="left" orientation="left" domain={['auto', 'auto']} axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#64748b'}} />
                                <Tooltip content={<CustomTooltip />} cursor={{fill: '#f8fafc'}} />
                                <Legend wrapperStyle={{paddingTop: '20px'}} />
                                <Bar yAxisId="left" dataKey="preResult" name="Pré" fill="#94a3b8" radius={[4, 4, 0, 0]} barSize={20} />
                                <Bar yAxisId="left" dataKey="postResult" name="Pós" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} />
                                <Line yAxisId="left" type="monotone" dataKey="target" name="Meta" stroke="#F59E0B" strokeWidth={3} dot={true} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="col-span-12 lg:col-span-4 bg-slate-900 p-8 rounded-[2rem] shadow-2xl text-white flex flex-col">
                    <h3 className="text-lg font-black mb-6 flex items-center gap-3">
                       <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                          <i className="fas fa-clipboard-list text-indigo-400"></i>
                       </div>
                       Plano de Ação Sugerido
                    </h3>
                    
                    <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-4">
                        {data.analysis?.recommendations?.map((rec, i) => (
                           <div key={i} className="flex gap-3 group">
                              <div className="mt-1 w-5 h-5 rounded-full border-2 border-slate-600 flex items-center justify-center shrink-0 group-hover:border-emerald-500 group-hover:bg-emerald-500/20 transition-colors cursor-pointer">
                                 <i className="fas fa-check text-[10px] text-transparent group-hover:text-emerald-500 transition-colors"></i>
                              </div>
                              <p className="text-sm text-slate-300 group-hover:text-white transition-colors leading-relaxed cursor-pointer select-none">{rec}</p>
                           </div>
                        ))}
                    </div>

                    <div className="mt-6 pt-6 border-t border-slate-800">
                       <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Correlações Identificadas</h4>
                       <div className="space-y-3">
                          {data.analysis?.keyInsights?.slice(0, 3).map((ins, i) => (
                             <div key={i} className="bg-slate-800/50 p-3 rounded-xl border border-slate-700/50 text-xs text-slate-300">
                                <i className="fas fa-lightbulb text-amber-400 mr-2"></i>
                                {ins}
                             </div>
                          ))}
                       </div>
                    </div>
                </div>

                <div className="col-span-12 bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
                    <div className="p-6 border-b border-slate-50 flex justify-between items-center">
                        <div>
                           <h3 className="font-bold text-slate-900">Detalhamento de Performance</h3>
                           <p className="text-xs text-slate-500">Visualização tabular dos resultados filtrados</p>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                            <thead className="bg-slate-50 text-slate-400 font-bold uppercase tracking-wider">
                                <tr>
                                    <th className="p-4">Operador</th>
                                    <th className="p-4">Indicador</th>
                                    <th className="p-4 text-center">Pré</th>
                                    <th className="p-4 w-32 text-center">Evolução Visual</th>
                                    <th className="p-4 text-center">Pós</th>
                                    <th className="p-4 text-center text-slate-700">Meta</th>
                                    <th className="p-4 text-center">Feedback IA</th>
                                    <th className="p-4 text-right">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {recs.map((r, i) => {
                                    const isInverse = isInverseMetric(r.indicator);
                                    const hitTarget = isInverse ? r.postResult <= r.target : r.postResult >= r.target;
                                    
                                    // Calculate simplistic progress percentage relative to target for visual bar
                                    // Cap at 100% for bar width
                                    const progress = Math.min(Math.max((r.postResult / (r.target || 1)) * 100, 0), 100);
                                    
                                    return (
                                        <tr key={i} className="hover:bg-slate-50 transition-colors group">
                                            <td className="p-4 font-bold text-slate-700">
                                               {r.name}
                                               <span className="block text-[10px] text-slate-400 font-normal">{r.id}</span>
                                            </td>
                                            <td className="p-4 font-bold text-indigo-600">{r.indicator}</td>
                                            <td className="p-4 text-center text-slate-400 font-bold">{r.preResult.toFixed(1)}</td>
                                            <td className="p-4">
                                               <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                                  <div 
                                                    className={`h-full rounded-full transition-all duration-500 ${hitTarget ? 'bg-emerald-500' : 'bg-amber-400'}`} 
                                                    style={{ width: `${progress}%` }}
                                                  ></div>
                                               </div>
                                            </td>
                                            <td className="p-4 text-center font-bold text-indigo-700 bg-indigo-50/30 rounded-lg">{r.postResult.toFixed(1)}</td>
                                            <td className="p-4 text-center font-black text-slate-800">{r.target}</td>
                                            <td className="p-4 text-center">
                                              <button 
                                                type="button"
                                                onClick={() => handleGenerateRefresherFeedback(r)}
                                                className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all shadow-sm hover:shadow-indigo-200 flex items-center justify-center mx-auto group/btn"
                                                title="Gerar Feedback de Reciclagem com IA"
                                              >
                                                 <i className="fas fa-wand-magic-sparkles text-xs group-hover/btn:animate-pulse"></i>
                                              </button>
                                            </td>
                                            <td className="p-4 text-right">
                                                {hitTarget ? 
                                                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-1 rounded uppercase tracking-wide">
                                                       <i className="fas fa-check mr-1"></i> Atingiu
                                                    </span> : 
                                                    <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-1 rounded uppercase tracking-wide">
                                                       <i className="fas fa-arrow-down mr-1"></i> Abaixo
                                                    </span>
                                                }
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            
            {/* AI Feedback Modal */}
            {feedbackStudent && (
              <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
                <div className="bg-white w-full max-w-2xl rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                  <div className="bg-slate-50 p-6 border-b border-slate-100 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                       {/* SAFE HEADER LOGIC */}
                       {(() => {
                          const isRefresher = 'indicator' in feedbackStudent;
                          const safeEval = isRefresher ? Number((feedbackStudent as any).evaluation || 0) : 0;
                          const safeGrade = !isRefresher ? Number((feedbackStudent as any).grade || 0) : 0;
                          
                          const isGood = isRefresher ? safeEval >= 9 : safeGrade >= 8;
                          const initials = feedbackStudent.name ? feedbackStudent.name.charAt(0).toUpperCase() : '?';
                          
                          return (
                              <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold ${
                                 isGood ? (isRefresher ? 'bg-emerald-100 text-emerald-600' : 'bg-indigo-100 text-indigo-600') : 
                                 (isRefresher ? 'bg-amber-100 text-amber-600' : 'bg-rose-100 text-rose-600')
                              }`}>
                                {initials}
                              </div>
                          );
                       })()}
                      
                      <div>
                         <h3 className="font-bold text-slate-900 text-lg">{feedbackStudent.name}</h3>
                         {'indicator' in feedbackStudent ? (
                            <div className="flex flex-wrap gap-3 text-xs font-bold text-slate-500">
                                <span><i className="fas fa-chart-line text-emerald-500 mr-1"></i> {(feedbackStudent as any).indicator || 'Geral'}</span>
                                <span><i className="fas fa-bullseye text-rose-400 mr-1"></i> Meta: {(feedbackStudent as any).target || 0}</span>
                                <span><i className="fas fa-graduation-cap text-indigo-400 mr-1"></i> Prova: {Number((feedbackStudent as any).evaluation || 0).toFixed(1)}</span>
                            </div>
                         ) : (
                            <div className="flex gap-3 text-xs font-bold text-slate-500">
                                <span><i className="fas fa-star text-amber-400 mr-1"></i> Nota: {Number((feedbackStudent as any).grade || 0).toFixed(1)}</span>
                                <span><i className="fas fa-user-clock text-indigo-400 mr-1"></i> Faltas: {(feedbackStudent as any).absences || 0}</span>
                            </div>
                         )}
                      </div>
                    </div>
                    <button onClick={closeFeedbackModal} className="w-10 h-10 rounded-full bg-white hover:bg-slate-100 flex items-center justify-center text-slate-400 transition-colors">
                      <i className="fas fa-times"></i>
                    </button>
                  </div>
                  
                  <div className="p-8 overflow-y-auto custom-scrollbar">
                    {loadingFeedback ? (
                      <div className="flex flex-col items-center justify-center py-12 space-y-4">
                        <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                        <p className="text-slate-500 font-medium animate-pulse">A IA está escrevendo o feedback...</p>
                      </div>
                    ) : (
                      <div className="space-y-6">
                         <div className="bg-indigo-50/50 p-6 rounded-2xl border border-indigo-100/50">
                            <h4 className="text-xs font-black text-indigo-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                              <i className="fas fa-robot"></i> Feedback Sugerido {'indicator' in feedbackStudent ? '(Diagnóstico & Ação)' : '(Método Sanduíche)'}
                            </h4>
                            <div className="prose prose-sm prose-slate max-w-none">
                               <div className="whitespace-pre-wrap text-slate-700 leading-relaxed font-medium">
                                 {aiFeedback}
                               </div>
                            </div>
                         </div>
                         <div className="flex justify-end gap-3">
                           <button 
                             onClick={() => {navigator.clipboard.writeText(aiFeedback); alert("Texto copiado!");}}
                             className="px-6 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold text-sm hover:border-indigo-300 hover:text-indigo-600 transition-all flex items-center gap-2"
                           >
                             <i className="fas fa-copy"></i> Copiar Texto
                           </button>
                         </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* AI Presenter Modal */}
            {presenterData && (
              <div className="fixed inset-0 z-[250] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
                <div className="bg-white w-full max-w-lg rounded-[2rem] shadow-2xl p-8 relative animate-in zoom-in-50 duration-300">
                   <button onClick={() => setPresenterData(null)} className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 transition-colors">
                      <i className="fas fa-times text-xl"></i>
                   </button>
                   
                   <div className="flex flex-col items-center text-center space-y-4">
                      <div className={`w-20 h-20 rounded-full flex items-center justify-center text-3xl shadow-lg mb-2 ${
                          presenterData.type === 'success' ? 'bg-emerald-100 text-emerald-600 shadow-emerald-200' :
                          presenterData.type === 'danger' ? 'bg-rose-100 text-rose-600 shadow-rose-200' :
                          presenterData.type === 'warning' ? 'bg-amber-100 text-amber-600 shadow-amber-200' :
                          'bg-indigo-100 text-indigo-600 shadow-indigo-200'
                      }`}>
                          <i className="fas fa-robot animate-bounce"></i>
                      </div>
                      
                      <h3 className="text-2xl font-black text-slate-900 tracking-tight">{presenterData.title}</h3>
                      
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 w-full text-left">
                         <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">O que é isso?</span>
                         <p className="text-sm text-slate-600 font-medium leading-relaxed">{presenterData.concept}</p>
                      </div>

                      <div className={`p-4 rounded-xl border w-full text-left ${
                          presenterData.type === 'success' ? 'bg-emerald-50 border-emerald-100' :
                          presenterData.type === 'danger' ? 'bg-rose-50 border-rose-100' :
                          presenterData.type === 'warning' ? 'bg-amber-50 border-amber-100' :
                          'bg-indigo-50 border-indigo-100'
                      }`}>
                         <span className={`text-[10px] font-bold uppercase tracking-widest block mb-2 ${
                             presenterData.type === 'success' ? 'text-emerald-600' :
                             presenterData.type === 'danger' ? 'text-rose-600' :
                             presenterData.type === 'warning' ? 'text-amber-600' :
                             'text-indigo-600'
                         }`}>Insight do Resultado</span>
                         <p className="text-sm text-slate-800 font-medium leading-relaxed">"{presenterData.insight}"</p>
                      </div>

                      {presenterData.relatedListAction && (
                          <button 
                            onClick={() => {
                                presenterData.relatedListAction?.();
                                setPresenterData(null);
                            }}
                            className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl hover:bg-slate-800 transition-all shadow-lg flex items-center justify-center gap-2"
                          >
                             Ver Lista Detalhada <i className="fas fa-arrow-right"></i>
                          </button>
                      )}
                   </div>
                </div>
              </div>
            )}
        </div>
      );
  }

  // --- RENDER INITIAL DASHBOARD (Existing) ---
  return (
    <div id="dashboard-content" className="max-w-[1600px] mx-auto space-y-8 animate-slide-up bg-[#f8fafc] p-4 sm:p-6" ref={dashboardRef}>
      
      {/* HIDDEN REPORT CONTAINER FOR PDF GENERATION */}
      <div id="pdf-report-container" className="fixed -left-[9999px] top-0 w-[210mm] min-h-[297mm] bg-white p-12 text-slate-900 font-sans">
        <div className="border-b-2 border-indigo-600 pb-6 mb-8 flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tight">Relatório de Performance</h1>
            <p className="text-sm text-slate-500 font-medium mt-1">Trainlytics AI • Análise Técnica de Capacitação</p>
          </div>
          <div className="text-right">
             <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Data de Emissão</p>
             <p className="text-sm font-bold text-slate-900">{new Date().toLocaleDateString()}</p>
          </div>
        </div>

        <div className="bg-slate-50 p-6 rounded-xl border border-slate-100 mb-8 grid grid-cols-2 lg:grid-cols-4 gap-6">
           <div>
             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Média Geral</p>
             <p className="text-2xl font-black text-slate-900">{initialStats.avgGrade.toFixed(2)}</p>
           </div>
           <div>
             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Taxa de Aprovação</p>
             <p className="text-2xl font-black text-slate-900">
               {((initialRecords.filter(r => r.grade >= 8).length / initialRecords.length) * 100).toFixed(0)}%
             </p>
           </div>
           <div>
             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Taxa de Absenteísmo</p>
             <p className={`text-2xl font-black ${initialStats.absenteeismRate > 15 ? 'text-rose-600' : 'text-slate-900'}`}>
               {initialStats.absenteeismRate.toFixed(1)}%
             </p>
           </div>
           <div>
             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total de Faltas</p>
             <p className="text-2xl font-black text-slate-900">{initialStats.totalAbsences}</p>
           </div>
        </div>

        <div className="mb-8">
           <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-4 border-l-4 border-indigo-500 pl-3">Parecer Executivo (IA)</h3>
           <p className="text-sm text-slate-600 leading-relaxed text-justify">{data.analysis?.summary}</p>
        </div>

        <div className="mb-8">
          <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-4 border-l-4 border-rose-500 pl-3">Alunos em Zona de Atenção (Nota {"<"} 8.0 ou Faltas {">="} 3)</h3>
          <table className="w-full text-left border-collapse text-[10px]">
            <thead>
              <tr className="bg-rose-50 text-rose-700 uppercase">
                <th className="py-2 px-3 border-b border-rose-100">Nome</th>
                <th className="py-2 px-3 border-b border-rose-100 text-center">Nota</th>
                <th className="py-2 px-3 border-b border-rose-100 text-center">Faltas</th>
                <th className="py-2 px-3 border-b border-rose-100">Motivo do Alerta</th>
              </tr>
            </thead>
            <tbody>
              {initialRecords.filter(r => r.grade < 8 || r.absences >= 3).map((rec, idx) => (
                <tr key={idx} className="border-b border-slate-100">
                  <td className="py-2 px-3 font-bold text-slate-800">{rec.name}</td>
                  <td className="py-2 px-3 text-center font-black text-rose-600">{rec.grade.toFixed(1)}</td>
                  <td className="py-2 px-3 text-center font-bold">{rec.absences}</td>
                  <td className="py-2 px-3 text-slate-500">
                    {rec.grade < 8 && rec.absences >= 3 ? "Nota Baixa e Absenteísmo" : rec.grade < 8 ? "Baixo Desempenho Técnico" : "Excesso de Faltas"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mb-8">
          <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-4 border-l-4 border-indigo-500 pl-3">Dados Completos da Turma</h3>
          <table className="w-full text-left border-collapse text-[10px]">
            <thead>
              <tr className="bg-slate-100 text-slate-500 uppercase">
                <th className="py-2 px-3 border-b border-slate-200">Aluno</th>
                <th className="py-2 px-3 border-b border-slate-200">Instrutor</th>
                <th className="py-2 px-3 border-b border-slate-200 text-center">Nota</th>
                <th className="py-2 px-3 border-b border-slate-200 text-center">Faltas</th>
                <th className="py-2 px-3 border-b border-slate-200 text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {initialRecords.map((rec, idx) => (
                <tr key={idx} className="border-b border-slate-100">
                  <td className="py-2 px-3 font-bold text-slate-800">{rec.name}</td>
                  <td className="py-2 px-3 text-slate-600">{rec.instructor}</td>
                  <td className="py-2 px-3 text-center font-bold">{rec.grade.toFixed(1)}</td>
                  <td className="py-2 px-3 text-center">{rec.absences}</td>
                  <td className="py-2 px-3 text-right">
                    {rec.grade >= 8 && rec.absences < 3 
                      ? <span className="text-emerald-600 font-bold">APROVADO</span>
                      : <span className="text-rose-600 font-bold">ATENÇÃO</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* KPI Detail Modal */}
      {activeKpiModal && (
        <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-3xl rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="bg-slate-50 p-6 border-b border-slate-100 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${
                  activeKpiModal === 'absenteeism' ? 'bg-indigo-100 text-indigo-600' :
                  activeKpiModal === 'turnover' ? 'bg-rose-100 text-rose-600' :
                  'bg-emerald-100 text-emerald-600'
                }`}>
                  <i className={`fas ${
                    activeKpiModal === 'absenteeism' ? 'fa-user-clock' :
                    activeKpiModal === 'turnover' ? 'fa-door-open' :
                    'fa-user-check'
                  }`}></i>
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-lg uppercase tracking-tight">
                    {activeKpiModal === 'absenteeism' ? 'Relatório de Faltas' : 
                     activeKpiModal === 'turnover' ? 'Alunos Desistentes/Demitidos' : 
                     'Alunos Ativos'}
                  </h3>
                  <p className="text-xs text-slate-500 font-bold">
                    {kpiModalData.length} registros encontrados
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setActiveKpiModal(null)}
                className="w-10 h-10 rounded-full bg-white hover:bg-slate-200 flex items-center justify-center text-slate-400 transition-colors"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            
            <div className="overflow-y-auto custom-scrollbar p-6">
              {kpiModalData.length > 0 ? (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                      <th className="py-3 px-2">Aluno</th>
                      <th className="py-3 px-2 text-center">
                        {activeKpiModal === 'absenteeism' ? 'Total Faltas' : 'Status Atual'}
                      </th>
                      <th className="py-3 px-2 text-center">Dias Preenchidos</th>
                      <th className="py-3 px-2 text-right">Instrutor</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {kpiModalData.map((student, i) => (
                      <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-2 font-bold text-slate-700">{student.name}</td>
                        <td className="py-3 px-2 text-center">
                           {activeKpiModal === 'absenteeism' ? (
                             <span className={`px-2 py-1 rounded-md font-bold text-xs ${student.absences >= 3 ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-600'}`}>
                               {student.absences} dias
                             </span>
                           ) : (
                             <span className={`px-2 py-1 rounded-md font-bold text-xs ${
                               student.status === 'active' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
                             }`}>
                               {student.status.toUpperCase()}
                             </span>
                           )}
                        </td>
                        <td className="py-3 px-2 text-center text-slate-500 font-medium">
                          Até Dia {student.daysFilled}
                        </td>
                        <td className="py-3 px-2 text-right text-slate-500">
                          {student.instructor}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="text-center py-12 text-slate-400">
                  <i className="fas fa-check-circle text-4xl mb-3 opacity-20"></i>
                  <p>Nenhum registro encontrado para esta categoria.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* AI Feedback Modal */}
      {feedbackStudent && (
        <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-2xl rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-slate-50 p-6 border-b border-slate-100 flex justify-between items-center">
              <div className="flex items-center gap-4">
                 {/* SAFE HEADER LOGIC */}
                 {(() => {
                    const isRefresher = 'indicator' in feedbackStudent;
                    const safeEval = isRefresher ? Number((feedbackStudent as any).evaluation || 0) : 0;
                    const safeGrade = !isRefresher ? Number((feedbackStudent as any).grade || 0) : 0;
                    
                    const isGood = isRefresher ? safeEval >= 9 : safeGrade >= 8;
                    const initials = feedbackStudent.name ? feedbackStudent.name.charAt(0).toUpperCase() : '?';
                    
                    return (
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold ${
                           isGood ? (isRefresher ? 'bg-emerald-100 text-emerald-600' : 'bg-indigo-100 text-indigo-600') : 
                           (isRefresher ? 'bg-amber-100 text-amber-600' : 'bg-rose-100 text-rose-600')
                        }`}>
                          {initials}
                        </div>
                    );
                 })()}
                
                <div>
                   <h3 className="font-bold text-slate-900 text-lg">{feedbackStudent.name}</h3>
                   {'indicator' in feedbackStudent ? (
                      <div className="flex flex-wrap gap-3 text-xs font-bold text-slate-500">
                          <span><i className="fas fa-chart-line text-emerald-500 mr-1"></i> {(feedbackStudent as any).indicator || 'Geral'}</span>
                          <span><i className="fas fa-bullseye text-rose-400 mr-1"></i> Meta: {(feedbackStudent as any).target || 0}</span>
                          <span><i className="fas fa-graduation-cap text-indigo-400 mr-1"></i> Prova: {Number((feedbackStudent as any).evaluation || 0).toFixed(1)}</span>
                      </div>
                   ) : (
                      <div className="flex gap-3 text-xs font-bold text-slate-500">
                          <span><i className="fas fa-star text-amber-400 mr-1"></i> Nota: {Number((feedbackStudent as any).grade || 0).toFixed(1)}</span>
                          <span><i className="fas fa-user-clock text-indigo-400 mr-1"></i> Faltas: {(feedbackStudent as any).absences || 0}</span>
                      </div>
                   )}
                </div>
              </div>
              <button onClick={closeFeedbackModal} className="w-10 h-10 rounded-full bg-white hover:bg-slate-100 flex items-center justify-center text-slate-400 transition-colors">
                <i className="fas fa-times"></i>
              </button>
            </div>
            
            <div className="p-8 overflow-y-auto custom-scrollbar">
              {loadingFeedback ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                  <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                  <p className="text-slate-500 font-medium animate-pulse">A IA está escrevendo o feedback...</p>
                </div>
              ) : (
                <div className="space-y-6">
                   <div className="bg-indigo-50/50 p-6 rounded-2xl border border-indigo-100/50">
                      <h4 className="text-xs font-black text-indigo-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <i className="fas fa-robot"></i> Feedback Sugerido {'indicator' in feedbackStudent ? '(Diagnóstico & Ação)' : '(Método Sanduíche)'}
                      </h4>
                      <div className="prose prose-sm prose-slate max-w-none">
                         <div className="whitespace-pre-wrap text-slate-700 leading-relaxed font-medium">
                           {aiFeedback}
                         </div>
                      </div>
                   </div>
                   <div className="flex justify-end gap-3">
                     <button 
                       onClick={() => {navigator.clipboard.writeText(aiFeedback); alert("Texto copiado!");}}
                       className="px-6 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold text-sm hover:border-indigo-300 hover:text-indigo-600 transition-all flex items-center gap-2"
                     >
                       <i className="fas fa-copy"></i> Copiar Texto
                     </button>
                   </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* AI Presenter Modal (Initial Dashboard) */}
      {presenterData && (
        <div className="fixed inset-0 z-[250] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-[2rem] shadow-2xl p-8 relative animate-in zoom-in-50 duration-300">
              <button onClick={() => setPresenterData(null)} className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 transition-colors">
                <i className="fas fa-times text-xl"></i>
              </button>
              
              <div className="flex flex-col items-center text-center space-y-4">
                <div className={`w-20 h-20 rounded-full flex items-center justify-center text-3xl shadow-lg mb-2 ${
                    presenterData.type === 'success' ? 'bg-emerald-100 text-emerald-600 shadow-emerald-200' :
                    presenterData.type === 'danger' ? 'bg-rose-100 text-rose-600 shadow-rose-200' :
                    presenterData.type === 'warning' ? 'bg-amber-100 text-amber-600 shadow-amber-200' :
                    'bg-indigo-100 text-indigo-600 shadow-indigo-200'
                }`}>
                    <i className="fas fa-robot animate-bounce"></i>
                </div>
                
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">{presenterData.title}</h3>
                
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 w-full text-left">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">O que é isso?</span>
                    <p className="text-sm text-slate-600 font-medium leading-relaxed">{presenterData.concept}</p>
                </div>

                <div className={`p-4 rounded-xl border w-full text-left ${
                    presenterData.type === 'success' ? 'bg-emerald-50 border-emerald-100' :
                    presenterData.type === 'danger' ? 'bg-rose-50 border-rose-100' :
                    presenterData.type === 'warning' ? 'bg-amber-50 border-amber-100' :
                    'bg-indigo-50 border-indigo-100'
                }`}>
                    <span className={`text-[10px] font-bold uppercase tracking-widest block mb-2 ${
                        presenterData.type === 'success' ? 'text-emerald-600' :
                        presenterData.type === 'danger' ? 'text-rose-600' :
                        presenterData.type === 'warning' ? 'text-amber-600' :
                        'text-indigo-600'
                    }`}>Insight do Resultado</span>
                    <p className="text-sm text-slate-800 font-medium leading-relaxed">"{presenterData.insight}"</p>
                </div>

                {presenterData.relatedListAction && (
                    <button 
                      onClick={() => {
                          presenterData.relatedListAction?.();
                          setPresenterData(null);
                      }}
                      className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl hover:bg-slate-800 transition-all shadow-lg flex items-center justify-center gap-2"
                    >
                        Ver Lista Detalhada <i className="fas fa-arrow-right"></i>
                    </button>
                )}
              </div>
          </div>
        </div>
      )}

      {/* 1. Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-200 no-pdf">
        <div className="space-y-3">
          <div className="flex items-center gap-4">
             <button onClick={() => { setData(null); setStep('upload'); }} className="w-12 h-12 rounded-2xl bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 hover:border-indigo-200 hover:shadow-md transition-all flex items-center justify-center group">
              <i className="fas fa-arrow-left group-hover:-translate-x-1 transition-transform"></i>
            </button>
            <div>
              <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">{data.className}</h2>
              <div className="flex items-center gap-3 mt-1">
                {data.isInProgress ? (
                  <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 text-[10px] font-black px-2.5 py-1 rounded-md ring-1 ring-amber-200/50">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                    EM ANDAMENTO (DIA {Math.max(...initialRecords.map(r => r.daysFilled), 0)}/21)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-700 text-[10px] font-black px-2.5 py-1 rounded-md ring-1 ring-indigo-200/50">
                    <i className="fas fa-check-circle text-xs"></i> CONCLUÍDA
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-600 text-[10px] font-black px-2.5 py-1 rounded-md">
                  <i className="fas fa-users text-slate-400"></i> {filteredInitialRecords.length} EXIBIDOS
                </span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex gap-3 no-pdf">
          <button 
            onClick={handleExportPdf} 
            disabled={isGeneratingPdf}
            className="bg-white text-slate-700 px-5 py-3 rounded-xl font-bold text-sm flex items-center gap-2 border border-slate-200 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 transition-all shadow-sm"
          >
            {isGeneratingPdf ? <i className="fas fa-spinner animate-spin"></i> : <i className="fas fa-file-pdf text-rose-500"></i>}
            <span className="hidden sm:inline">PDF Profissional</span>
          </button>
          <button onClick={() => generatePPTX(data)} className="bg-slate-900 text-white px-5 py-3 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-slate-800 transition-all shadow-lg shadow-slate-200" title="Arquivo compatível para importação no Canva">
            <i className="fas fa-file-powerpoint text-orange-400"></i>
            <span className="hidden sm:inline">Apresentação (PPTX/Canva)</span>
          </button>
        </div>
      </div>

      {/* 2. Control Toolbar */}
      <div className="bg-white p-2 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row gap-2 items-center no-pdf">
        <div className="flex items-center gap-3 bg-slate-50 px-4 py-3 rounded-xl border border-slate-200/60 flex-1 w-full">
          <i className="fas fa-user-graduate text-slate-400"></i>
          <select 
            className="bg-transparent border-none w-full text-sm font-bold outline-none focus:ring-0 cursor-pointer text-slate-700"
            value={studentFilter}
            onChange={(e) => setStudentFilter(e.target.value)}
          >
            <option value="all">Todos os Alunos (Visão Geral)</option>
            {studentNames.map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>
        <div className="w-px h-8 bg-slate-200 hidden md:block"></div>
        <div className="flex items-center gap-3 bg-slate-50 px-4 py-3 rounded-xl border border-slate-200/60 w-full md:w-auto md:min-w-[250px]">
          <i className="fas fa-chalkboard-teacher text-slate-400"></i>
          <select 
            className="bg-transparent border-none text-sm font-bold outline-none focus:ring-0 cursor-pointer text-slate-700 w-full"
            value={instructorFilter}
            onChange={(e) => setInstructorFilter(e.target.value)}
          >
            <option value="all">Todos Instrutores</option>
            {instructors.map(inst => (
              <option key={inst} value={inst}>{inst}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 3. KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Grade (Clickable for Presenter) */}
        <div 
          onClick={() => openPresenter('grade', initialStats.avgGrade, 'initial')}
          className="bg-gradient-to-br from-indigo-600 to-violet-700 p-6 rounded-[2rem] shadow-xl shadow-indigo-200 text-white relative overflow-hidden group cursor-pointer hover:scale-[1.02] transition-transform"
        >
          <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
            <i className="fas fa-graduation-cap text-8xl transform rotate-12"></i>
          </div>
          <h3 className="text-indigo-100 text-[10px] font-black uppercase tracking-widest mb-2">Média Geral</h3>
          <div className="flex items-baseline gap-1">
            <span className={`text-5xl lg:text-6xl font-black tracking-tighter ${initialStats.avgGrade < 8 ? 'text-rose-200' : 'text-white'}`}>
              {initialStats.avgGrade.toFixed(1)}
            </span>
            <span className="text-lg text-indigo-300 font-bold">/10</span>
          </div>
          <div className="mt-4 inline-flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-lg border border-white/10 backdrop-blur-sm">
            <i className={`fas ${initialStats.avgGrade < 8 ? 'fa-exclamation-circle text-rose-300' : 'fa-bullseye text-emerald-300'} text-xs`}></i>
            <span className="text-[10px] font-bold text-white uppercase tracking-wider">Meta: 8.0</span>
          </div>
        </div>

        {/* KPI 2: Absenteeism (Clickable for Presenter then List) */}
        <div 
          onClick={() => openPresenter('absenteeism', initialStats.absenteeismRate, 'initial', () => setActiveKpiModal('absenteeism'))}
          className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col justify-between group hover:border-indigo-100 transition-all cursor-pointer hover:shadow-md hover:scale-[1.02]"
        >
          <div>
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Absenteísmo</h3>
              <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-indigo-50 group-hover:text-indigo-500 transition-colors">
                <i className="fas fa-user-clock"></i>
              </div>
            </div>
            <p className={`text-4xl lg:text-5xl font-black tracking-tighter ${initialStats.absenteeismRate > 15 ? 'text-rose-600' : 'text-slate-900'}`}>
              {initialStats.absenteeismRate.toFixed(1)}%
            </p>
          </div>
          <p className="text-xs text-slate-400 font-medium mt-2 flex items-center gap-1 group-hover:text-indigo-500 transition-colors">
            <span>Ver detalhes</span> <i className="fas fa-arrow-right"></i>
          </p>
        </div>

        {/* KPI 3: Turnover (Clickable for Presenter then List) */}
        <div 
          onClick={() => openPresenter('turnover', initialStats.turnoverRate, 'initial', () => setActiveKpiModal('turnover'))}
          className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col justify-between group hover:border-rose-100 transition-all cursor-pointer hover:shadow-md hover:scale-[1.02]"
        >
           <div>
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Turnover</h3>
              <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-rose-50 group-hover:text-rose-500 transition-colors">
                <i className="fas fa-door-open"></i>
              </div>
            </div>
            <p className="text-4xl lg:text-5xl font-black tracking-tighter text-slate-900">
              {initialStats.turnoverRate.toFixed(1)}%
            </p>
          </div>
          <p className="text-xs text-slate-400 font-medium mt-2 flex items-center gap-1 group-hover:text-rose-500 transition-colors">
            <span>{initialStats.turnoverCount} desistentes - Ver detalhes</span> <i className="fas fa-arrow-right"></i>
          </p>
        </div>

        {/* KPI 4: Active (Clickable for Presenter then List) */}
        <div 
          onClick={() => openPresenter('active', initialStats.activeCount, 'initial', () => setActiveKpiModal('active'))}
          className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col justify-between group hover:border-emerald-100 transition-all cursor-pointer hover:shadow-md hover:scale-[1.02]"
        >
           <div>
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Ativos</h3>
              <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-emerald-50 group-hover:text-emerald-500 transition-colors">
                <i className="fas fa-user-check"></i>
              </div>
            </div>
            <p className="text-4xl lg:text-5xl font-black tracking-tighter text-slate-900">
              {initialStats.activeCount}
            </p>
          </div>
          <p className="text-xs text-slate-400 font-medium mt-2 flex items-center gap-1 group-hover:text-emerald-500 transition-colors">
            <span>Ver detalhes</span> <i className="fas fa-arrow-right"></i>
          </p>
        </div>
      </div>

      {/* 4. Main Grid Content */}
      <div className="grid grid-cols-12 gap-6">
        
        {/* Chart Section (Large) */}
        <div className="col-span-12 lg:col-span-8 bg-white p-6 sm:p-8 rounded-[2rem] shadow-sm border border-slate-100">
           <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
             <div>
               <h3 className="font-bold text-slate-900 text-lg">Performance da Turma</h3>
               <p className="text-xs text-slate-500 font-medium mt-1">Comparativo de notas ({studentFilter === 'all' ? 'Top 30 exibidos' : 'Visualização Individual'})</p>
             </div>
             <div className="flex gap-2 text-[10px] font-bold uppercase tracking-wider">
                <div className="flex items-center gap-1.5 bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg">
                  <div className="w-2 h-2 rounded-full bg-indigo-500"></div> Aprovado (≥8)
                </div>
                <div className="flex items-center gap-1.5 bg-rose-50 text-rose-700 px-3 py-1.5 rounded-lg">
                  <div className="w-2 h-2 rounded-full bg-rose-500"></div> Risco (Nota {"<"} 8 ou Faltas {">="} 3)
                </div>
             </div>
           </div>
           <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={chartData} margin={{top: 10, right: 10, left: -20, bottom: 0}}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 11, fontWeight: 600, fill: '#64748b'}} dy={10} />
                    <YAxis domain={[0, 10]} axisLine={false} tickLine={false} tick={{fontSize: 11, fontWeight: 600, fill: '#64748b'}} />
                    <Tooltip 
                      cursor={{fill: '#f8fafc'}}
                      content={<CustomChartTooltip />}
                    />
                    <Bar dataKey="grade" radius={[6, 6, 6, 6]} barSize={32}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={(entry.grade < 8 || entry.absences >= 3) ? chartColors.danger : chartColors.primary} />
                      ))}
                    </Bar>
                 </BarChart>
              </ResponsiveContainer>
           </div>
        </div>

        {/* AI Strategy Summary (Side Panel) */}
        <div className="col-span-12 lg:col-span-4 bg-slate-900 p-8 rounded-[2rem] shadow-2xl text-white flex flex-col">
          <h3 className="text-lg font-black mb-6 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center">
              <i className="fas fa-brain text-indigo-400"></i> 
            </div>
            Plano Estratégico
          </h3>
          
          <div className="flex-1 space-y-6 overflow-y-auto custom-scrollbar pr-2">
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Recomendações Prioritárias</p>
              <div className="space-y-4">
                {data.analysis?.recommendations?.slice(0, 3).map((rec, i) => (
                  <div key={i} className="flex gap-3">
                    <span className="text-indigo-400 font-bold text-sm mt-0.5">{i+1}.</span>
                    <p className="text-sm text-slate-300 leading-relaxed font-medium">{rec}</p>
                  </div>
                ))}
              </div>
            </div>

            {data.analysis?.keyInsights && data.analysis.keyInsights.length > 0 && (
                <div className="pt-6 border-t border-slate-800">
                    <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest mb-3">Análise de Correlação</p>
                    <ul className="space-y-3">
                        {data.analysis.keyInsights.slice(0, 3).map((insight, i) => (
                            <li key={i} className="text-xs text-slate-300 flex gap-2 leading-relaxed">
                                <span className="text-amber-500 font-bold">•</span> {insight}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            <div className="pt-6 border-t border-slate-800">
               <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Diagnóstico Rápido</p>
               <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700/50">
                  <p className="text-xs text-slate-400 italic">"{data.analysis?.summary}"</p>
               </div>
            </div>
          </div>
        </div>

        {/* Table Section (Full Width) */}
        <div className="col-span-12 bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden flex flex-col">
           <div className="p-6 border-b border-slate-50 flex justify-between items-center">
              <h3 className="font-bold text-slate-900">Lista de Participantes</h3>
              <div className="flex gap-2">
                 <button 
                   onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                   disabled={currentPage === 1}
                   className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 disabled:opacity-50 transition-all"
                 >
                   <i className="fas fa-chevron-left text-xs"></i>
                 </button>
                 <button 
                   onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                   disabled={currentPage === totalPages}
                   className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 disabled:opacity-50 transition-all"
                 >
                   <i className="fas fa-chevron-right text-xs"></i>
                 </button>
              </div>
           </div>
           
           <div className="overflow-x-auto">
             <table className="w-full text-left border-collapse">
               <thead>
                 <tr className="bg-slate-50/80 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                   <th className="py-4 px-6">Aluno</th>
                   <th className="py-4 px-4 text-center">Nota</th>
                   <th className="py-4 px-4 text-center">Faltas</th>
                   <th className="py-4 px-4">Observação</th>
                   <th className="py-4 px-6 text-center">Feedback IA</th>
                   <th className="py-4 px-6 text-right">Status</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-slate-50">
                 {paginatedRecords.map((record, i) => {
                     const isRisk = record.grade < 8 || record.absences >= 3;
                     return (
                     <tr key={i} className={`group transition-all ${isRisk ? 'bg-rose-50 border-l-4 border-l-rose-500' : 'hover:bg-slate-50/80 border-l-4 border-l-transparent'}`}>
                       <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                              record.grade >= 8 ? 'bg-indigo-50 text-indigo-600' : 'bg-rose-50 text-rose-600'
                            }`}>
                              {isRisk ? <i className="fas fa-exclamation-triangle text-rose-500"></i> : record.name.charAt(0)}
                            </div>
                            <div>
                              <p className={`text-sm font-bold ${isRisk ? 'text-rose-700' : 'text-slate-700'}`}>{record.name}</p>
                              <p className="text-[10px] font-medium text-slate-400">{record.instructor}</p>
                            </div>
                          </div>
                       </td>
                       <td className="py-4 px-4 text-center">
                          <span className={`inline-block px-2 py-1 rounded-md text-xs font-bold ${
                            record.grade >= 8 ? 'text-emerald-600 bg-emerald-50' : 'text-rose-600 bg-rose-50'
                          }`}>
                            {record.grade.toFixed(1)}
                          </span>
                       </td>
                       <td className="py-4 px-4 text-center">
                          <span className={`text-sm font-bold ${record.absences >= 3 ? 'text-rose-500' : 'text-slate-600'}`}>
                            {record.absences}
                          </span>
                       </td>
                       <td className="py-4 px-4 max-w-xs">
                          <p className="text-xs text-slate-500 truncate" title={record.observations}>{record.observations || '-'}</p>
                       </td>
                       <td className="py-4 px-6 text-center">
                          <button 
                            onClick={() => handleGenerateFeedback(record)}
                            className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all shadow-sm hover:shadow-indigo-200 flex items-center justify-center mx-auto group/btn"
                            title="Gerar Feedback Individual com IA"
                          >
                             <i className="fas fa-wand-magic-sparkles text-xs group-hover/btn:animate-pulse"></i>
                          </button>
                       </td>
                       <td className="py-4 px-6 text-right">
                          { isRisk ? 
                            <span className="text-[10px] font-bold text-rose-500 bg-rose-100 px-2 py-1 rounded-full uppercase tracking-wide border border-rose-200">
                               <i className="fas fa-times-circle mr-1"></i> Atenção
                            </span> : 
                            <span className="text-[10px] font-bold text-emerald-500 bg-emerald-50 px-2 py-1 rounded-full uppercase tracking-wide">
                               <i className="fas fa-check-circle mr-1"></i> Regular
                            </span> 
                          }
                       </td>
                     </tr>
                 )})}
               </tbody>
             </table>
           </div>
           
           <div className="p-4 bg-slate-50/50 border-t border-slate-100 text-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Página {currentPage} de {totalPages} • Total de {filteredInitialRecords.length} registros
              </span>
           </div>
        </div>

        {/* 5. Profiling & Insights Split */}
        <div className="col-span-12 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100">
             <div className="flex items-center gap-3 mb-6">
               <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center">
                 <i className="fas fa-search-dollar"></i>
               </div>
               <h3 className="font-bold text-slate-900">Profiling & Comportamento</h3>
             </div>
             <div className="space-y-4">
               {data.analysis?.profilingInsights?.slice(0, 3).map((profile, i) => (
                 <div key={i} className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="flex justify-between items-center mb-2">
                       <span className="font-bold text-slate-800 text-sm">{profile.studentName}</span>
                       <span className="text-[10px] font-black bg-white border border-slate-200 px-2 py-0.5 rounded text-slate-500">FIT: {profile.alignmentScore}%</span>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">{profile.observation}</p>
                 </div>
               ))}
               {!data.analysis?.profilingInsights?.length && <p className="text-sm text-slate-400 italic">Nenhum insight comportamental gerado.</p>}
             </div>
          </div>

          <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100">
             <div className="flex items-center gap-3 mb-6">
               <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                 <i className="fas fa-exclamation-triangle"></i>
               </div>
               <h3 className="font-bold text-slate-900">Pontos de Atenção Individual</h3>
             </div>
             <div className="space-y-3">
               {data.analysis?.individualInsights?.slice(0, 4).map((insight, i) => (
                 <div key={i} className="flex gap-3 items-start p-3 hover:bg-slate-50 rounded-xl transition-colors">
                    <i className="fas fa-chevron-right text-xs text-amber-500 mt-1"></i>
                    <div>
                      <span className="block text-xs font-bold text-slate-700 mb-0.5">{insight.studentName}</span>
                      <p className="text-xs text-slate-500">{insight.insight}</p>
                    </div>
                 </div>
               ))}
               {!data.analysis?.individualInsights?.length && <p className="text-sm text-slate-400 italic">Nenhum alerta crítico individual.</p>}
             </div>
          </div>
        </div>

      </div>
    </div>
  );
};
