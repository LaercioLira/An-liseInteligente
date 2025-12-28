
import pptxgen from "pptxgenjs";
import { DashboardData, StudentRecord, RefresherRecord } from "../types";

export const generatePPTX = async (data: DashboardData) => {
  const pptx = new pptxgen();
  
  const THEME = {
    PRIMARY: "1E293B",
    SECONDARY: "334155",
    ACCENT: "4F46E5",
    ACCENT_LIGHT: "EEF2FF",
    BG: "F8FAFC",
    WHITE: "FFFFFF",
    SUCCESS: "10B981",
    WARNING: "F59E0B",
    DANGER: "EF4444",
    GRAY: "94A3B8",
    EVAL: "F59E0B"
  };

  pptx.layout = "LAYOUT_16x9";
  pptx.author = "Trainlytics AI";
  pptx.company = "Enterprise Training Solutions";
  pptx.subject = `Relatório: ${data.className}`;

  // Helper function to detect inverse metrics (Lower is Better)
  const isInverseMetric = (indicatorName: string) => {
    const lowerIsBetterKeywords = ['tma', 'tme', 'tempo', 'time', 'absente', 'rechamada', 'erro', 'desvio', 'churn', 'cancelamento', 'reclama'];
    return lowerIsBetterKeywords.some(k => indicatorName.toLowerCase().includes(k));
  };

  pptx.defineSlideMaster({
    title: "MASTER_COVER",
    background: { color: THEME.PRIMARY },
    objects: [
      { rect: { x: 0, y: 0, w: 0.4, h: "100%", fill: { color: THEME.ACCENT } } }
    ]
  });

  pptx.defineSlideMaster({
    title: "MASTER_CONTENT",
    background: { color: THEME.BG },
    objects: [
      { rect: { x: 0, y: 0, w: "100%", h: 0.8, fill: { color: THEME.WHITE } } },
      { line: { x: 0, y: 0.8, w: "100%", h: 0, line: { color: "E2E8F0", width: 1 } } },
      { text: { text: "Relatório Analítico de Reciclagem", options: { x: 0.5, y: 7.2, w: 4, fontSize: 8, color: THEME.GRAY } } },
      { text: { text: data.className, options: { x: 10, y: 7.2, w: 3, align: "right", fontSize: 8, color: THEME.GRAY } } }
    ],
    slideNumber: { x: 12.8, y: 7.2, w: 0.5, h: 0.3, align: "right", fontSize: 8, color: THEME.GRAY }
  });

  pptx.defineSlideMaster({
    title: "MASTER_SECTION",
    background: { color: THEME.WHITE },
    objects: [
      { rect: { x: 0, y: 3, w: "100%", h: 1.5, fill: { color: THEME.ACCENT_LIGHT } } },
      { line: { x: 0, y: 3, w: "100%", h: 0, line: { color: THEME.ACCENT, width: 2 } } }
    ]
  });

  const addTitle = (slide: pptxgen.Slide, title: string, subtitle?: string) => {
    slide.addText(title.toUpperCase(), { 
      x: 0.5, y: 0.25, w: 10, h: 0.5, 
      fontSize: 18, bold: true, color: THEME.PRIMARY, fontFace: "Helvetica" 
    });
    if (subtitle) {
      slide.addText(subtitle, { 
        x: 0.5, y: 0.55, w: 10, h: 0.3, 
        fontSize: 10, color: THEME.GRAY, italic: true 
      });
    }
  };

  const addAnalystNote = (slide: pptxgen.Slide, note: string) => {
    slide.addShape(pptx.ShapeType.rect, {
      x: 0.5, y: 5.8, w: 12.33, h: 1.0,
      fill: { color: "F1F5F9" }, line: { color: "CBD5E1", width: 1, dashType: "dash" }
    });
    slide.addText("INSIGHT DO ANALISTA:", {
      x: 0.7, y: 5.9, w: 3, fontSize: 9, bold: true, color: THEME.ACCENT
    });
    slide.addText(note, {
      x: 0.7, y: 6.15, w: 11.8, fontSize: 10, color: THEME.SECONDARY
    });
  };

  if (data.type === 'refresher') {
      const records = data.records as RefresherRecord[];
      
      // Calculate consolidated stats for cover
      const avgEval = records.reduce((a,b) => a + b.evaluation, 0) / (records.length || 1);
      
      // Fix passed logic based on inverse metrics
      const passedCount = records.filter(r => {
          const isInverse = isInverseMetric(r.indicator);
          return isInverse ? r.postResult <= r.target : r.postResult >= r.target;
      }).length;

      const passRate = (passedCount / records.length) * 100;
      
      const uniqueIndicators = Array.from(new Set(records.map(r => r.indicator)));

      // 1. CAPA
      const s1 = pptx.addSlide({ masterName: "MASTER_COVER" });
      s1.addText("RELATÓRIO DE IMPACTO\nRECICLAGEM OPERACIONAL", { 
        x: 1.0, y: 2.5, w: 8, fontSize: 32, bold: true, color: THEME.WHITE 
      });
      s1.addText(`TURMA: ${data.className.toUpperCase()}`, { 
        x: 1.0, y: 4.2, w: 8, fontSize: 14, color: THEME.WARNING, bold: true 
      });
      s1.addText(`DATA DE GERAÇÃO: ${new Date().toLocaleDateString()}`, { 
        x: 1.0, y: 4.6, w: 5, fontSize: 10, color: THEME.GRAY 
      });

      // 2. AGENDA
      const s2 = pptx.addSlide({ masterName: "MASTER_CONTENT" });
      addTitle(s2, "Roteiro da Análise");
      const agenda = [
          "01. Resumo Executivo (IA)",
          "02. Visão Global: Médias por Indicador",
          ...uniqueIndicators.map((ind, i) => `0${i+3}. Detalhamento: ${ind}`),
          `0${uniqueIndicators.length + 3}. Matriz de Eficácia (Teoria vs Prática)`,
          `0${uniqueIndicators.length + 4}. Plano de Ação Recomendado`
      ];
      
      s2.addText(agenda.join("\n\n"), { 
        x: 1.0, y: 1.5, w: 8, h: 5, fontSize: 14, color: THEME.SECONDARY, 
        bullet: { type: "number", color: THEME.ACCENT }, lineSpacing: 40 
      });

      // 3. EXECUTIVE SUMMARY
      const s3 = pptx.addSlide({ masterName: "MASTER_CONTENT" });
      addTitle(s3, "Diagnóstico Executivo");
      s3.addShape(pptx.ShapeType.rect, { x: 0.5, y: 1.2, w: 12.33, h: 4.5, fill: { color: THEME.WHITE }, line: { color: THEME.ACCENT, width: 2 } });
      s3.addText(data.analysis?.summary || "Processando análise...", {
        x: 1.0, y: 1.5, w: 11.33, h: 4, fontSize: 16, color: THEME.SECONDARY, align: "justify"
      });

      // 4. GLOBAL KPI OVERVIEW
      const s4 = pptx.addSlide({ masterName: "MASTER_CONTENT" });
      addTitle(s4, "Visão Global", "Média Agregada por Tipo de Indicador");
      
      // Calculate averages per KPI
      const kpiStats = uniqueIndicators.map(ind => {
         const rs = records.filter(r => r.indicator === ind);
         const pre = rs.reduce((a,b) => a+b.preResult,0)/rs.length;
         const post = rs.reduce((a,b) => a+b.postResult,0)/rs.length;
         const target = rs.reduce((a,b) => a+b.target,0)/rs.length;
         return { name: ind, pre, post, target };
      });

      // Create a summary table
      const kpiRows = kpiStats.map(k => {
          const isInverse = isInverseMetric(k.name);
          const hitTarget = isInverse ? k.post <= k.target : k.post >= k.target;
          return [
              k.name, 
              k.pre.toFixed(1), 
              k.post.toFixed(1), 
              k.target.toFixed(1), 
              hitTarget ? "SIM" : "NÃO"
          ];
      });
      
      s4.addTable([["Indicador", "Média Pré", "Média Pós", "Meta Média", "Atingiu?"]].concat(kpiRows), {
          x: 1.5, y: 1.5, w: 10, fontSize: 14, align: "center",
          headerFill: { color: THEME.ACCENT }, headerColor: "FFFFFF",
          border: { color: "E2E8F0" }
      });
      
      addAnalystNote(s4, "Esta visão consolida os resultados médios de toda a turma. Detalhamentos específicos por indicador seguem nos próximos slides.");

      // 5. PER INDICATOR DEEP DIVE (LOOP)
      uniqueIndicators.forEach(ind => {
          const indSlide = pptx.addSlide({ masterName: "MASTER_CONTENT" });
          addTitle(indSlide, `Detalhamento: ${ind}`, "Performance específica e ofensores");

          const indRecords = records.filter(r => r.indicator === ind);
          const sorted = [...indRecords].sort((a,b) => (b.postResult - b.preResult) - (a.postResult - a.preResult)); // Sort by Improvement
          
          const indAvgPre = indRecords.reduce((a,b) => a+b.preResult,0)/indRecords.length;
          const indAvgPost = indRecords.reduce((a,b) => a+b.postResult,0)/indRecords.length;
          
          // Chart: Pre vs Post avg for this indicator
          indSlide.addChart(pptx.ChartType.bar, [
              { name: "Pré", labels: ["Média da Turma"], values: [indAvgPre] },
              { name: "Pós", labels: ["Média da Turma"], values: [indAvgPost] }
          ], { 
              x: 0.5, y: 1.5, w: 5, h: 3.5, 
              chartColors: [THEME.GRAY, THEME.ACCENT], 
              barDir: "col", showValue: true, title: "Evolução Média"
          });

          // Table: Top 3 Gainers
          const top3 = sorted.slice(0, 3);
          const topRows = top3.map(r => [r.name, r.preResult.toFixed(1), r.postResult.toFixed(1)]);
          
          indSlide.addText("MAIORES EVOLUÇÕES", { x: 6, y: 1.3, fontSize: 10, bold: true, color: THEME.SUCCESS });
          indSlide.addTable([["Nome", "Pré", "Pós"]].concat(topRows), {
              x: 6, y: 1.5, w: 6.5, fontSize: 10, headerFill: { color: THEME.SUCCESS }, headerColor: "FFFFFF"
          });

          // Table: Bottom 3 (Negative or low gain)
          const bottom3 = [...sorted].reverse().slice(0, 3);
          const bottomRows = bottom3.map(r => [r.name, r.preResult.toFixed(1), r.postResult.toFixed(1)]);
          
          indSlide.addText("MENORES EVOLUÇÕES (ATENÇÃO)", { x: 6, y: 3.3, fontSize: 10, bold: true, color: THEME.DANGER });
          indSlide.addTable([["Nome", "Pré", "Pós"]].concat(bottomRows), {
              x: 6, y: 3.5, w: 6.5, fontSize: 10, headerFill: { color: THEME.DANGER }, headerColor: "FFFFFF"
          });
      });

      // 6. EFFICACY MATRIX
      const sMat = pptx.addSlide({ masterName: "MASTER_CONTENT" });
      addTitle(sMat, "Matriz de Eficácia", "Teoria (Sala) vs Prática (Campo)");
      
      // Scatter plot logic simulation (Scatter not perfectly supported in basic pptxgen, using Bar for grouping)
      // Group: High Grade/High Result, High Grade/Low Result, etc.
      
      const highGrade = 8.5;
      
      // Calculate quadrants considering Inverse Metrics
      const q1 = records.filter(r => {
          const isInverse = isInverseMetric(r.indicator);
          const hitTarget = isInverse ? r.postResult <= r.target : r.postResult >= r.target;
          return r.evaluation >= highGrade && hitTarget;
      }).length; // Stars

      const q2 = records.filter(r => {
          const isInverse = isInverseMetric(r.indicator);
          const hitTarget = isInverse ? r.postResult <= r.target : r.postResult >= r.target;
          return r.evaluation < highGrade && hitTarget;
      }).length; // Práticos

      const q3 = records.filter(r => {
          const isInverse = isInverseMetric(r.indicator);
          const hitTarget = isInverse ? r.postResult <= r.target : r.postResult >= r.target;
          return r.evaluation >= highGrade && !hitTarget;
      }).length; // Teóricos (Problem!)

      const q4 = records.filter(r => {
          const isInverse = isInverseMetric(r.indicator);
          const hitTarget = isInverse ? r.postResult <= r.target : r.postResult >= r.target;
          return r.evaluation < highGrade && !hitTarget;
      }).length; // Críticos
      
      sMat.addChart(pptx.ChartType.pie, [
          { name: "Perfil", labels: ["Estrelas (Teoria+Prática)", "Práticos (Só Resultado)", "Teóricos (Só Nota)", "Críticos (Nem Nota Nem Resultado)"], values: [q1, q2, q3, q4] }
      ], { x: 0.5, y: 1.5, w: 6, h: 4, showPercent: true, showLegend: true, legendPos: "b" });
      
      sMat.addText("ANÁLISE DOS QUADRANTES:", { x: 7, y: 1.5, fontSize: 12, bold: true, color: THEME.PRIMARY });
      sMat.addText([
          { text: "ESTRELAS: Dominam o conteúdo e entregam resultado. Podem ser padrinhos.", options: { color: THEME.SUCCESS, breakLine: true } },
          { text: "PRÁTICOS: Entregam resultado mas foram mal na prova. Revisar conceitos.", options: { color: THEME.ACCENT, breakLine: true } },
          { text: "TEÓRICOS: Foram bem na prova mas não entregam. Falta atitude ou confiança.", options: { color: THEME.WARNING, breakLine: true } },
          { text: "CRÍTICOS: Precisam de reciclagem urgente ou desligamento.", options: { color: THEME.DANGER, breakLine: true } }
      ], { x: 7, y: 2.0, w: 5.5, h: 4, fontSize: 11, lineSpacing: 24 });

      // 7. RECOMMENDATIONS
      const sRec = pptx.addSlide({ masterName: "MASTER_CONTENT" });
      addTitle(sRec, "Plano de Ação (IA)");
      const recs = (data.analysis?.recommendations || []).slice(0, 5);
      recs.forEach((rec, i) => {
        const y = 1.5 + (i * 0.9);
        sRec.addShape(pptx.ShapeType.roundRect, { x: 1.0, y: y, w: 11.33, h: 0.7, fill: { color: THEME.WHITE }, line: { color: THEME.ACCENT, width: 1 } });
        sRec.addText((i+1).toString(), { x: 0.6, y: y + 0.15, w: 0.4, align: "center", color: THEME.PRIMARY, bold: true });
        sRec.addText(rec, { x: 1.4, y: y + 0.1, w: 10.5, h: 0.5, fontSize: 11, color: THEME.SECONDARY });
      });

  } else {
      // INITIAL TRAINING LOGIC (Kept as is, just wrapped in else block logic structure same as before)
      const records = data.records as StudentRecord[];
      
      const totalStudents = records.length;
      const approved = records.filter(r => r.grade >= 8).length;
      const avgGrade = totalStudents > 0 ? records.reduce((a, b) => a + b.grade, 0) / totalStudents : 0;
      const totalAbsences = records.reduce((a, b) => a + b.absences, 0);
      const activeStudents = records.filter(r => r.status === 'active').length;
      
      const instructorStats: Record<string, { count: number, totalGrade: number, passed: number }> = {};
      records.forEach(r => {
        if (!instructorStats[r.instructor]) instructorStats[r.instructor] = { count: 0, totalGrade: 0, passed: 0 };
        instructorStats[r.instructor].count++;
        instructorStats[r.instructor].totalGrade += r.grade;
        if (r.grade >= 8) instructorStats[r.instructor].passed++;
      });

      const s1 = pptx.addSlide({ masterName: "MASTER_COVER" });
      s1.addText("RELATÓRIO DE\nPERFORMANCE & CAPACITAÇÃO", { 
        x: 1.0, y: 2.5, w: 8, fontSize: 32, bold: true, color: THEME.WHITE 
      });
      s1.addText(`TURMA: ${data.className.toUpperCase()}`, { 
        x: 1.0, y: 4.2, w: 8, fontSize: 14, color: THEME.WARNING, bold: true 
      });
      s1.addText(`DATA DE GERAÇÃO: ${new Date().toLocaleDateString()}`, { 
        x: 1.0, y: 4.6, w: 5, fontSize: 10, color: THEME.GRAY 
      });

      const s2 = pptx.addSlide({ masterName: "MASTER_CONTENT" });
      addTitle(s2, "Agenda Executiva");
      const agendaItems = [
        "01. Resumo Executivo & KPIs",
        "02. Análise Detalhada de Notas",
        "03. Gestão de Absenteísmo",
        "04. Comparativo de Instrutores",
        "05. Impacto do Absenteísmo na Performance",
        "06. Destaques & Pontos de Atenção",
        "07. Recomendações Estratégicas (IA)"
      ];
      s2.addText(agendaItems.join("\n\n"), { 
        x: 1.5, y: 1.5, w: 6, h: 5, fontSize: 14, color: THEME.SECONDARY, bullet: { type: "number", color: THEME.ACCENT } 
      });
      s2.addShape(pptx.ShapeType.rect, { x: 8, y: 1.5, w: 4, h: 4, fill: { color: THEME.ACCENT_LIGHT } });
      s2.addText("OBJETIVO DO RELATÓRIO", { x: 8.2, y: 1.7, fontSize: 10, bold: true, color: THEME.ACCENT });
      s2.addText("Fornecer uma visão baseada em dados sobre a eficácia do treinamento, identificando gargalos de aprendizado e sugerindo planos de ação.", { x: 8.2, y: 2.2, w: 3.6, fontSize: 11, color: THEME.SECONDARY, align: "justify" });

      const s3 = pptx.addSlide({ masterName: "MASTER_CONTENT" });
      addTitle(s3, "Resumo Executivo (IA Insight)");
      s3.addShape(pptx.ShapeType.rect, { x: 0.5, y: 1.2, w: 12.33, h: 4.5, fill: { color: THEME.WHITE }, line: { color: THEME.ACCENT, width: 2 } });
      s3.addText(data.analysis?.summary || "Análise em processamento...", {
        x: 1.0, y: 1.5, w: 11.33, h: 4, fontSize: 14, color: THEME.SECONDARY, align: "justify", lineSpacing: 24
      });

      const s4 = pptx.addSlide({ masterName: "MASTER_CONTENT" });
      addTitle(s4, "Indicadores Chave de Performance (KPIs)");
      const kpiBox = (x: number, label: string, value: string, sub: string, color: string) => {
        s4.addShape(pptx.ShapeType.rect, { x, y: 1.5, w: 2.8, h: 2.5, fill: { color: THEME.WHITE }, shadow: { type: "outer", opacity: 0.1 } });
        s4.addText(label, { x: x + 0.1, y: 1.7, w: 2.6, align: "center", fontSize: 10, bold: true, color: THEME.GRAY });
        s4.addText(value, { x: x + 0.1, y: 2.2, w: 2.6, align: "center", fontSize: 32, bold: true, color });
        s4.addText(sub, { x: x + 0.1, y: 3.2, w: 2.6, align: "center", fontSize: 9, color: THEME.SECONDARY });
      };
      kpiBox(0.5, "MÉDIA DA TURMA", avgGrade.toFixed(2), "Meta: 8.0", avgGrade >= 8 ? THEME.SUCCESS : THEME.DANGER);
      kpiBox(3.6, "APROVAÇÃO", `${((approved/totalStudents)*100).toFixed(0)}%`, `${approved} de ${totalStudents} alunos`, THEME.ACCENT);
      kpiBox(6.7, "TOTAL DE FALTAS", totalAbsences.toString(), `Média: ${(totalAbsences/totalStudents).toFixed(1)}/aluno`, totalAbsences === 0 ? THEME.SUCCESS : THEME.WARNING);
      kpiBox(9.8, "RETENÇÃO", `${((activeStudents/totalStudents)*100).toFixed(0)}%`, `${totalStudents - activeStudents} evasões`, THEME.SECONDARY);
      addAnalystNote(s4, `A turma apresenta uma média ${avgGrade >= 8 ? 'sólida' : 'abaixo do esperado'}.`);

      const s5 = pptx.addSlide({ masterName: "MASTER_CONTENT" });
      addTitle(s5, "Distribuição de Notas", "Histograma de Frequência");
      const buckets = { "0-5": 0, "5-7": 0, "7-8": 0, "8-10": 0 };
      records.forEach(r => {
        if (r.grade < 5) buckets["0-5"]++;
        else if (r.grade < 7) buckets["5-7"]++;
        else if (r.grade < 8) buckets["7-8"]++;
        else buckets["8-10"]++;
      });
      s5.addChart(pptx.ChartType.bar, [
        { name: "Alunos", labels: Object.keys(buckets), values: Object.values(buckets) }
      ], { x: 0.5, y: 1.2, w: 12, h: 4, chartColors: [THEME.DANGER, THEME.WARNING, THEME.ACCENT, THEME.SUCCESS], barDir: "col", showValue: true });

      const s6 = pptx.addSlide({ masterName: "MASTER_CONTENT" });
      addTitle(s6, "Share de Aprovação");
      s6.addChart(pptx.ChartType.doughnut, [
        { name: "Status", labels: ["Aprovados", "Risco"], values: [approved, totalStudents - approved] }
      ], { x: 3.5, y: 1.0, w: 6, h: 4.5, chartColors: [THEME.ACCENT, THEME.DANGER], showPercent: true, showLegend: true, legendPos: "b" });

      const s7 = pptx.addSlide({ masterName: "MASTER_SECTION" });
      s7.addText("ANÁLISE DE\nPRESENÇA & ENGAJAMENTO", { x: 0.5, y: 1.5, fontSize: 36, bold: true, color: THEME.PRIMARY });

      const s8 = pptx.addSlide({ masterName: "MASTER_CONTENT" });
      addTitle(s8, "Absenteísmo");
      const zeroAbs = records.filter(r => r.absences === 0).length;
      const critAbs = records.filter(r => r.absences > 3).length;
      const midAbs = totalStudents - zeroAbs - critAbs;
      s8.addChart(pptx.ChartType.pie, [
        { name: "Faltas", labels: ["0", "1-3", ">3"], values: [zeroAbs, midAbs, critAbs] }
      ], { x: 0.5, y: 1.2, w: 6, h: 4, chartColors: [THEME.SUCCESS, THEME.WARNING, THEME.DANGER], showPercent: true, showLegend: true, legendPos: "b" });

      const s9 = pptx.addSlide({ masterName: "MASTER_CONTENT" });
      addTitle(s9, "Performance por Nível de Presença", "Média de notas cruzada com absenteísmo");
      
      const perfectGroup = records.filter(r => r.absences === 0);
      const regularGroup = records.filter(r => r.absences >= 1 && r.absences <= 3);
      const criticalGroup = records.filter(r => r.absences > 3);

      const avgPerfect = perfectGroup.length > 0 ? Number((perfectGroup.reduce((a, b) => a + b.grade, 0) / perfectGroup.length).toFixed(2)) : 0;
      const avgRegular = regularGroup.length > 0 ? Number((regularGroup.reduce((a, b) => a + b.grade, 0) / regularGroup.length).toFixed(2)) : 0;
      const avgCritical = criticalGroup.length > 0 ? Number((criticalGroup.reduce((a, b) => a + b.grade, 0) / criticalGroup.length).toFixed(2)) : 0;

      s9.addChart(pptx.ChartType.bar, [
        { 
          name: "Média de Nota", 
          labels: ["Assiduidade 100%", "Faltas Pontuais (1-3)", "Faltas Críticas (>3)"], 
          values: [avgPerfect, avgRegular, avgCritical] 
        }
      ], { 
        x: 1.5, y: 1.5, w: 10, h: 4, 
        chartColors: [THEME.SUCCESS, THEME.WARNING, THEME.DANGER], 
        barDir: "col", 
        valAxisMaxVal: 10, 
        showValue: true 
      });

      addAnalystNote(s9, "Este gráfico valida o impacto direto da presença em sala no aprendizado. Alunos com faltas críticas tendem a apresentar defasagem técnica imediata.");

      const s11 = pptx.addSlide({ masterName: "MASTER_CONTENT" });
      addTitle(s11, "Performance por Instrutor");
      const insts = Object.keys(instructorStats);
      const instGrades = insts.map(i => Number((instructorStats[i].totalGrade / instructorStats[i].count).toFixed(2)));
      s11.addChart(pptx.ChartType.bar, [
        { name: "Média", labels: insts, values: instGrades }
      ], { x: 3, y: 1.5, w: 7, h: 4, chartColors: [THEME.ACCENT], barDir: "col", valAxisMaxVal: 10, showValue: true });

      const s13 = pptx.addSlide({ masterName: "MASTER_CONTENT" });
      addTitle(s13, "Top Performers");
      const topS = [...records].sort((a,b) => b.grade - a.grade).slice(0, 5);
      const topRows = topS.map((r, i) => [(i+1).toString(), r.name, r.grade.toFixed(1), r.absences.toString()]);
      s13.addTable([["#", "Nome", "Nota", "Faltas"]].concat(topRows), { x: 1.5, y: 1.5, w: 10, headerFill: { color: THEME.ACCENT }, headerColor: "FFFFFF", fontSize: 12, align: "center" });

      const s14 = pptx.addSlide({ masterName: "MASTER_CONTENT" });
      addTitle(s14, "Alunos em Atenção");
      const riskS = [...records].filter(r => r.grade < 8 || r.absences > 3).slice(0, 5);
      if (riskS.length > 0) {
        const riskRows = riskS.map((r) => [r.name, r.grade.toFixed(1), r.absences.toString()]);
        s14.addTable([["Nome", "Nota", "Faltas"]].concat(riskRows), { x: 1.5, y: 1.5, w: 10, headerFill: { color: THEME.DANGER }, headerColor: "FFFFFF", fontSize: 12, align: "center" });
      } else {
        s14.addText("Sem riscos detectados.", { x: 2, y: 3, w: 9, align: "center", fontSize: 18, color: THEME.SUCCESS });
      }

      const s15 = pptx.addSlide({ masterName: "MASTER_CONTENT" });
      addTitle(s15, "Recomendações (IA)");
      const recs = (data.analysis?.recommendations || []).slice(0, 4);
      recs.forEach((rec, i) => {
        const y = 1.5 + (i * 1.1);
        s15.addShape(pptx.ShapeType.roundRect, { x: 1.0, y: y, w: 11.33, h: 0.9, fill: { color: THEME.WHITE }, line: { color: THEME.ACCENT, width: 1 } });
        s15.addText((i+1).toString(), { x: 0.6, y: y + 0.25, w: 0.4, h: 0.4, align: "center", color: THEME.PRIMARY, bold: true });
        s15.addText(rec, { x: 1.4, y: y + 0.1, w: 10.5, h: 0.7, fontSize: 11, color: THEME.SECONDARY });
      });
  }

  const sLast = pptx.addSlide({ masterName: "MASTER_COVER" });
  sLast.addText("OBRIGADO", { x: 4, y: 3, w: 5.33, align: "center", fontSize: 48, bold: true, color: THEME.WHITE });

  const cleanName = data.className.replace(/[^a-zA-Z0-9-_ ]/g, "").replace(/\s+/g, "_");
  await pptx.writeFile({ fileName: `Relatorio_${cleanName}.pptx` });
};
