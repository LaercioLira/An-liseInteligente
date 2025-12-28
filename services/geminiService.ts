
import { GoogleGenAI, Type } from "@google/genai";
import { StudentRecord, TrainingAnalysis, RefresherRecord } from "../types";

export class GeminiService {
  async analyzeTrainingData(records: StudentRecord[], forcedStatus?: 'in_progress' | 'completed'): Promise<TrainingAnalysis> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const maxDays = Math.max(...records.map(r => r.daysFilled), 0);
    const isInProgress = forcedStatus === 'in_progress' || (forcedStatus === undefined && maxDays < 21);

    const simplifiedRecords = records.map(r => ({
      Nome: r.name,
      Nota: r.grade,
      Faltas: r.absences,
      Status: r.status,
      Participacao: r.participation,
      Obs: r.observations ? r.observations.substring(0, 100) : "N/A"
    }));

    const systemInstruction = `Você é um Analista de Treinamento Senior. 
Gere um JSON estrito para dashboard.
REGRA DE NEGÓCIO CRÍTICA:
1. APROVAÇÃO: Média >= 8.0. (Notas 7.9 ou menos são consideradas REPROVAÇÃO/RISCO).
2. FALTAS: 3 faltas ou mais é considerado ALTO RISCO. (Máximo aceitável é 2).
Seja EXTREMAMENTE conciso.
Limite todas as listas a no máximo 5 itens (Top 5).
Não invente dados.`;

    const prompt = `CONTEXTO: Turma ${isInProgress ? 'EM ANDAMENTO' : 'CONCLUÍDA'}.
    
    DADOS:
    ${JSON.stringify(simplifiedRecords)}
    
    OUTPUT JSON REQUERIDO:
    - summary: Resumo executivo focado na meta de 8.0 (max 1 parágrafo).
    - keyInsights: 3 Insights focados na CORRELAÇÃO entre FALTAS, PARTICIPAÇÃO e NOTAS (Ex: "Alunos com baixa participação tiveram queda de X% na nota").
    - recommendations: Top 5 ações corretivas práticas para quem está abaixo de 8.0.
    - profilingInsights: Top 5 observações de comportamento mais relevantes (analisando o campo Obs e Participação).
    - individualInsights: Top 5 alunos críticos (nota < 8.0 ou faltas >= 3).
    - performanceScore: 0-100 (Considerando a regra de 8.0).`;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-pro-preview", 
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING },
              keyInsights: { type: Type.ARRAY, items: { type: Type.STRING } },
              recommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
              performanceScore: { type: Type.NUMBER },
              profilingInsights: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    studentName: { type: Type.STRING },
                    alignmentScore: { type: Type.NUMBER },
                    observation: { type: Type.STRING }
                  }
                }
              },
              individualInsights: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    studentName: { type: Type.STRING },
                    insight: { type: Type.STRING }
                  }
                }
              }
            },
            required: ["summary", "keyInsights", "recommendations", "performanceScore"]
          }
        }
      });

      const text = response.text;
      if (!text) throw new Error("Resposta vazia da IA.");

      const cleanJson = text.replace(/```json/g, "").replace(/```/g, "").trim();
      const result = JSON.parse(cleanJson);
      
      return { ...result, isInProgress } as TrainingAnalysis;
    } catch (e: any) {
      console.error("Gemini analysis error:", e);
      let msg = e.message;
      if (msg.includes("SAFETY")) msg = "Conteúdo bloqueado por políticas de segurança.";
      if (msg.includes("429")) msg = "Limite de requisições atingido. Aguarde alguns instantes.";
      if (msg.includes("403")) msg = "Erro de permissão (403). Verifique se o modelo está disponível para sua chave.";
      throw new Error(msg || "Erro ao conectar com a IA.");
    }
  }

  async analyzeRefresherData(records: RefresherRecord[]): Promise<TrainingAnalysis> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // Group records by Operator ID (Matrícula) to consolidate KPIs per person
    const aggregatedOperators: Record<string, { name: string, metrics: any[] }> = {};
    
    records.forEach(r => {
        if (!aggregatedOperators[r.id]) {
            aggregatedOperators[r.id] = { name: r.name, metrics: [] };
        }
        aggregatedOperators[r.id].metrics.push({
            indicador: r.indicator,
            meta: r.target,
            pre_reciclagem: r.preResult,
            avaliacao_sala: r.evaluation,
            pos_reciclagem: r.postResult,
            obs: r.observations
        });
    });

    const operatorsList = Object.values(aggregatedOperators);

    const systemInstruction = `Você é um Analista de Performance Operacional de Call Center.
    Analise os resultados de uma RECICLAGEM TÉCNICA onde cada operador pode ter múltiplos indicadores (TMA, NPS, Qualidade, Conversão, etc.).
    
    IMPORTANTE SOBRE INDICADORES:
    - Indicadores de TEMPO (TMA, TME, Pausa) e ERROS (Rechamada, Reclamações, Churn) devem DIMINUIR. Uma porcentagem de evolução NEGATIVA nestes casos é POSITIVA/BOM.
    - Indicadores de QUALIDADE (NPS, CSAT, Nota, Conversão) devem AUMENTAR.
    
    DADOS DE ENTRADA:
    - Lista de operadores agrupados.
    - Cada operador tem uma lista de "metrics".
    - "pre_reciclagem" e "pos_reciclagem" são RESULTADOS OPERACIONAIS.
    - "meta" é o alvo operacional.
    - "avaliacao_sala" é a nota do teste de conhecimento (0-10) aplicado durante a reciclagem.

    OBJETIVO:
    Avaliar se a Reciclagem (avaliada pela nota de sala) gerou impacto real nos indicadores operacionais.
    Consolide a análise por operador se houver múltiplos indicadores.
    
    Gere uma minuta de e-mail corporativo formal para os supervisores.`;

    const prompt = `DADOS OPERACIONAIS DA RECICLAGEM (AGRUPADOS POR OPERADOR):
    ${JSON.stringify(operatorsList).substring(0, 30000)}

    OUTPUT JSON REQUERIDO:
    - summary: Análise executiva sobre o impacto da reciclagem nos KPIs operacionais da turma.
    - keyInsights: 3 insights de correlação (Ex: "Operadores com nota alta em sala reduziram o TMA em X%").
    - recommendations: 3 ações práticas de gestão baseadas nos desvios de meta.
    - emailDraft: Minuta de e-mail formal aos supervisores e coordenadores reportando a eficácia operacional do treinamento.
    - performanceScore: 0-100 (Score geral de sucesso da reciclagem baseado no atingimento de metas pós-treino).
    - individualInsights: Top 3 destaques (positivos ou negativos). Cite o nome e o indicador específico (Ex: "João melhorou 20% no TMA").`;

    try {
        const response = await ai.models.generateContent({
        model: "gemini-3-pro-preview", 
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING },
              recommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
              performanceScore: { type: Type.NUMBER },
              emailDraft: { type: Type.STRING },
              keyInsights: { type: Type.ARRAY, items: { type: Type.STRING } },
              individualInsights: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    studentName: { type: Type.STRING },
                    insight: { type: Type.STRING }
                  }
                }
              }
            },
            required: ["summary", "emailDraft", "performanceScore", "keyInsights"]
          }
        }
      });

      const text = response.text;
      if (!text) throw new Error("Resposta vazia da IA.");
      const cleanJson = text.replace(/```json/g, "").replace(/```/g, "").trim();
      const result = JSON.parse(cleanJson);

      return { ...result, knowledgeGain: 0, isInProgress: false } as TrainingAnalysis;
    } catch (e: any) {
      console.error("Gemini refresher analysis error:", e);
      throw new Error(e.message || "Erro na análise de reciclagem.");
    }
  }

  async generateStudentFeedback(student: StudentRecord): Promise<string> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const prompt = `Gere um feedback estruturado e profissional para o aluno abaixo.
    Use o método "Sanduíche" (Elogio sincero -> Ponto de atenção -> Motivação final).
    Use Markdown para formatação.
    
    DADOS DO ALUNO:
    - Nome: ${student.name}
    - Nota Atual: ${student.grade.toFixed(1)} (Meta de Aprovação: 8.0)
    - Faltas: ${student.absences} (Limite: 3)
    - Observações do Instrutor: ${student.observations || "Nenhuma observação registrada"}
    - Participação: ${student.participation}
    
    DIRETRIZES:
    1. Se a nota for < 8.0, o tom deve ser de ALERTA e suporte técnico.
    2. Se faltas >= 3, o tom deve ser de COBRANÇA sobre regras.
    3. Se nota > 9.0, parabenize pela excelência.
    4. Seja curto e direto (máximo 150 palavras).
    5. Fale diretamente com o aluno ("Olá ${student.name.split(' ')[0]}...").`;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-flash-latest",
        contents: prompt
      });
      return response.text || "Não foi possível gerar o feedback.";
    } catch (error) {
      console.error("Erro ao gerar feedback individual:", error);
      return "Erro ao conectar com a IA para gerar feedback.";
    }
  }

  async generateRefresherFeedback(record: RefresherRecord): Promise<string> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // SAFE HANDLING: Treat 0 as "No Data" if checking against certain indicators, unless specifically valid.
    // Generally in Excel parsing, empty cells become 0 or undefined.
    // Rule: If Post is 0, we treat it as missing data, focusing on Pre + Theory.
    
    const postRes = record.postResult !== undefined ? Number(record.postResult) : 0;
    const preRes = Number(record.preResult || 0);
    const evalGrade = Number(record.evaluation || 0);
    
    const hasPostData = postRes !== 0; // Assuming 0 means not yet measured for most KPIs (TMA, NPS, Sales).
    
    const prompt = `Você é um Supervisor de Qualidade e Treinamento.
    Gere um feedback estruturado para o operador de call center abaixo.
    
    CONTEXTO DO OPERADOR:
    - Nome: ${record.name}
    - Indicador (KPI): ${record.indicator}
    - Meta do KPI: ${record.target}
    - Resultado PRÉ-Reciclagem: ${preRes}
    - Nota da Prova Teórica (Sala): ${evalGrade.toFixed(1)} (Meta de sala: 9.0)
    - Resultado PÓS-Reciclagem: ${hasPostData ? postRes : "AINDA NÃO MENSURADO/DADOS INDISPONÍVEIS"}
    - Obs do Instrutor: ${record.observations || "Sem observações"}
    
    REGRA DE NEGÓCIO OBRIGATÓRIA (CENÁRIOS):
    
    CENÁRIO 1: SEM RESULTADO PÓS (Pós = 0 ou Não Mensurado)
    - O feedback DEVE focar EXCLUSIVAMENTE na nota da prova teórica e no histórico (Pré).
    - Se a nota da prova for baixa (<9), cobre estudo. Se for alta, parabenize e peça para aplicar esse conhecimento para melhorar o Pré.
    - Motive-o para quando os resultados novos chegarem.
    
    CENÁRIO 2: COM RESULTADO PÓS (Pós existe)
    - O feedback DEVE focar na EVOLUÇÃO (Diferença entre Pré e Pós).
    - Analise se ele atingiu a Meta no Pós.
    - Conecte a nota da prova com o resultado (Ex: "Você foi bem na prova e isso se refletiu no resultado" ou "Você foi bem na teoria, mas a prática ainda precisa de ajuste").
    
    ESTRUTURA DE RESPOSTA (Markdown):
    1. **Diagnóstico**: Análise da situação atual conforme o cenário detectado acima.
    2. **Plano de Ação**: 2 sugestões práticas (comportamentais ou técnicas) para o indicador ${record.indicator}.
    3. **Conclusão**: Frase motivacional curta.
    
    Tom: Profissional, Humano e Orientado a Resultados. Fale diretamente com o operador.
    Máximo 150 palavras.`;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview", 
        contents: prompt
      });
      return response.text || "Feedback não gerado.";
    } catch (error) {
      console.error("Erro feedback reciclagem:", error);
      return "Erro ao conectar com a IA. Tente novamente.";
    }
  }

  async editImage(base64Image: string, prompt: string): Promise<string | null> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    let data = base64Image;
    let mimeType = 'image/png';
    if (base64Image.startsWith('data:')) {
      const parts = base64Image.split(',');
      data = parts[1];
      const mimeMatch = parts[0].match(/:(.*?);/);
      if (mimeMatch) mimeType = mimeMatch[1];
    }

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            { inlineData: { data, mimeType } },
            { text: prompt }
          ]
        }
      });

      if (response.candidates && response.candidates[0].content.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
            return `data:image/png;base64,${part.inlineData.data}`;
          }
        }
      }
      return null;
    } catch (e) {
      console.error("Gemini image edit error:", e);
      return null;
    }
  }
}
export const geminiService = new GeminiService();
