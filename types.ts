
export interface StudentRecord {
  name: string;
  instructor: string;
  grade: number;
  absences: number;
  status: 'active' | 'dropped' | 'completed' | 'dismissed';
  participation: string;
  observations: string;
  daysFilled: number;
}

export interface RefresherRecord {
  id: string; // Matrícula
  name: string;
  supervisor: string;
  date: string;
  theme: string;
  instructor: string;
  indicator: string; // New: Ex: TMA, NPS
  target: number;    // New: Meta do indicador
  preResult: number; // Resultado Operacional Pré
  evaluation: number; // Nota do Teste em Sala (0-10)
  postResult: number; // Resultado Operacional Pós
  observations: string;
}

export type TrainingType = 'initial' | 'refresher';

export interface TrainingAnalysis {
  summary: string;
  keyInsights: string[];
  recommendations: string[];
  performanceScore: number;
  isInProgress?: boolean;
  profilingInsights?: { studentName: string; alignmentScore: number; observation: string }[];
  individualInsights?: { studentName: string; insight: string }[];
  // Refresher specific fields
  knowledgeGain?: number;
  emailDraft?: string;
}

export interface DashboardData {
  className: string;
  type: TrainingType;
  records: StudentRecord[] | RefresherRecord[];
  analysis?: TrainingAnalysis;
  isInProgress: boolean;
}

export enum AppTab {
  DASHBOARD = 'dashboard'
}

export interface FeedbackRecord {
  id: string;
  name: string;
  comment: string;
  date: string;
}
