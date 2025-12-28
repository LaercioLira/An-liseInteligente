
import { StudentRecord, RefresherRecord, TrainingType } from "../types";
import XLSX from 'xlsx';

// Helper to apply header styles
const styleSheet = (ws: any, headerColorRGB: string) => {
    if (!ws['!ref']) return;
    const range = XLSX.utils.decode_range(ws['!ref']);
    
    // Apply Header Style (Row 0)
    for (let C = range.s.c; C <= range.e.c; ++C) {
        const address = XLSX.utils.encode_cell({ r: 0, c: C });
        if (!ws[address]) continue;
        ws[address].s = {
            fill: { fgColor: { rgb: headerColorRGB } },
            font: { color: { rgb: "FFFFFF" }, bold: true, sz: 12, name: "Calibri" },
            alignment: { horizontal: "center", vertical: "center" },
            border: {
                bottom: { style: "medium", color: { rgb: "FFFFFF" } },
                right: { style: "thin", color: { rgb: "FFFFFF" } }
            }
        };
    }

    // Apply Data Style (Rows > 0)
    for (let R = range.s.r + 1; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
            const address = XLSX.utils.encode_cell({ r: R, c: C });
            if (!ws[address]) continue;
            
            // Alternating rows effect logic could go here, but keep it simple clean white/gray
            const isEven = R % 2 === 0;
            ws[address].s = {
                fill: { fgColor: { rgb: isEven ? "F8FAFC" : "FFFFFF" } }, // Slate-50 for even rows
                font: { color: { rgb: "334155" }, sz: 11, name: "Calibri" }, // Slate-700
                alignment: { vertical: "center", horizontal: "left" },
                border: {
                    bottom: { style: "thin", color: { rgb: "E2E8F0" } }, // Slate-200
                    right: { style: "dotted", color: { rgb: "E2E8F0" } }
                }
            };
            
            // Center align numbers
            if (typeof ws[address].v === 'number') {
                ws[address].s.alignment.horizontal = "center";
            }
        }
    }
};

const styleInstructions = (ws: any, brandColorRGB: string) => {
     if (!ws['!ref']) return;
     const range = XLSX.utils.decode_range(ws['!ref']);
     
     // Title Style (A1)
     const titleCell = ws[XLSX.utils.encode_cell({r:0, c:0})];
     if (titleCell) {
         titleCell.s = {
             font: { color: { rgb: brandColorRGB }, bold: true, sz: 18, name: "Calibri" },
             alignment: { horizontal: "left" }
         };
     }
     
     // Iterate to find Keys and Bold them
     for (let R = 0; R <= range.e.r; ++R) {
         const cellAddr = XLSX.utils.encode_cell({ r: R, c: 0 });
         if (ws[cellAddr] && typeof ws[cellAddr].v === 'string') {
             const val = ws[cellAddr].v;
             if (val.includes(":") || val.includes("OBJETIVO") || val.includes("REGRAS") || val.includes("DICIONÁRIO") || val.includes("DICA")) {
                 ws[cellAddr].s = {
                     font: { bold: true, color: { rgb: "1E293B" }, name: "Calibri" },
                     fill: { fgColor: { rgb: "F1F5F9" } }
                 };
             }
         }
     }
}

export const downloadTemplate = (type: TrainingType = 'initial') => {
  const wb = XLSX.utils.book_new();

  // Colors: Indigo 600 (4F46E5) for Initial, Emerald 600 (059669) for Refresher
  const BRAND_COLOR = type === 'refresher' ? "059669" : "4F46E5";

  if (type === 'refresher') {
    // --- INSTRUCTIONS SHEET (REFRESHER) ---
    const instructions = [
      ["GUIA DE PREENCHIMENTO - RECICLAGEM OPERACIONAL"],
      [""],
      ["OBJETIVO:"],
      ["Esta planilha alimenta a Inteligência Artificial para mensurar o ROI (Retorno sobre Investimento) do treinamento."],
      ["Preencha os dados com atenção para garantir a precisão da análise."],
      [""],
      ["DICIONÁRIO DE DADOS:"],
      ["1. Matrícula/ID", "Identificador único do colaborador no sistema de RH."],
      ["2. Indicador", "Nome da métrica operacional impactada (Ex: TMA, NPS, Conversão, Qualidade)."],
      ["3. Meta", "O objetivo numérico estipulado para aquele indicador."],
      ["4. Pré-Reciclagem", "Resultado médio do operador ANTES do treinamento."],
      ["5. Avaliação (Prova)", "Nota obtida na prova de conhecimento aplicada no treinamento (0 a 10)."],
      ["6. Pós-Reciclagem", "Resultado médio do operador APÓS o treinamento."],
      [""],
      ["DICA IMPORTANTE:"],
      ["Se um operador possui múltiplos indicadores (ex: TMA e Qualidade), insira duas linhas para o mesmo operador,"],
      ["alterando apenas a coluna 'Indicador' e seus respectivos valores."]
    ];
    
    const wsInst = XLSX.utils.aoa_to_sheet(instructions);
    wsInst['!cols'] = [{ wch: 30 }, { wch: 80 }];
    styleInstructions(wsInst, BRAND_COLOR);
    XLSX.utils.book_append_sheet(wb, wsInst, "Instruções de Uso");

    // --- DATA SHEET (REFRESHER) ---
    const headers = [
      "Matrícula", "Nome do Operador", "Supervisor", "Data", 
      "Tema do Treinamento", "Instrutor", 
      "Indicador (KPI)", "Meta", 
      "Resultado Pré", "Nota Prova (0-10)", "Resultado Pós", "Observações do Instrutor"
    ];
    
    const example1 = [
      "102030", "Carlos Lima", "Coord. Roberto", new Date().toLocaleDateString(), 
      "Técnicas de Atendimento", "Instrutor Silva", "TMA (seg)", 180, 240, 9.0, 190, "Melhorou a agilidade na navegação do sistema."
    ];
    const example2 = [
      "102030", "Carlos Lima", "Coord. Roberto", new Date().toLocaleDateString(), 
      "Técnicas de Atendimento", "Instrutor Silva", "NPS", 75, 60, 9.0, 80, "Demonstrou maior empatia nas simulações."
    ];
    
    const wsData = XLSX.utils.aoa_to_sheet([headers, example1, example2]);

    wsData['!cols'] = [
      { wch: 15 }, // Matrícula
      { wch: 30 }, // Nome
      { wch: 20 }, // Supervisor
      { wch: 15 }, // Data
      { wch: 25 }, // Tema
      { wch: 20 }, // Instrutor
      { wch: 15 }, // Indicador
      { wch: 10 }, // Meta
      { wch: 15 }, // Pré
      { wch: 18 }, // Nota Prova
      { wch: 15 }, // Pós
      { wch: 50 }  // Obs
    ];

    styleSheet(wsData, BRAND_COLOR);
    XLSX.utils.book_append_sheet(wb, wsData, "Dados para Importação");
    XLSX.writeFile(wb, "Modelo_Reciclagem_Padrao_Corp.xlsx");
    
  } else {
    // --- INSTRUCTIONS SHEET (INITIAL) ---
    const instructions = [
      ["GUIA DE PREENCHIMENTO - FORMAÇÃO INICIAL (ONBOARDING)"],
      [""],
      ["OBJETIVO:"],
      ["Acompanhar a curva de aprendizado, engajamento e assiduidade dos novos colaboradores durante os primeiros 21 dias."],
      [""],
      ["REGRAS DE VALIDAÇÃO:"],
      ["1. Status", "Preencha com: 'Ativo', 'Desistente' ou 'Demitido'."],
      ["2. Presença", "Para cada dia (1 a 21), informe: 'Presente', 'Falta', 'Atestado' ou deixe vazio (futuro)."],
      ["3. Avaliações", "Notas de provas teóricas ou práticas (0 a 10). A média esperada é 8.0."],
      ["4. Participação", "Avaliação qualitativa do instrutor: 'Alta', 'Média' ou 'Baixa'."]
    ];
    
    const wsInst = XLSX.utils.aoa_to_sheet(instructions);
    wsInst['!cols'] = [{ wch: 30 }, { wch: 80 }];
    styleInstructions(wsInst, BRAND_COLOR);
    XLSX.utils.book_append_sheet(wb, wsInst, "Instruções de Uso");

    // --- DATA SHEET (INITIAL) ---
    const headers = [
      "Nome Completo", "Instrutor", "Status Atual",
      "Nível Participação", "Observações Comportamentais",
      "Nota Av 1", "Nota Av 2", "Nota Av 3", "Nota Av 4", "Nota Av 5",
      ...Array.from({length: 21}, (_, i) => `Dia ${i + 1}`)
    ];
    
    const example = [
      "João Silva", "Ana Oliveira", "Ativo", 
      "Alta", "Perfil proativo, boa curva de aprendizado e ajuda os colegas.", 
      8.5, 9.0, 7.5, "", "", 
      "Presente", "Presente", "Falta", "Presente", "Presente", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""
    ];
    
    const wsData = XLSX.utils.aoa_to_sheet([headers, example]);

    const dailyCols = Array(21).fill({ wch: 8 });
    wsData['!cols'] = [
      { wch: 35 }, // Nome
      { wch: 20 }, // Instrutor
      { wch: 15 }, // Status
      { wch: 18 }, // Participação
      { wch: 50 }, // Obs
      { wch: 10 }, // Av 1
      { wch: 10 }, // Av 2
      { wch: 10 }, // Av 3
      { wch: 10 }, // Av 4
      { wch: 10 }, // Av 5
      ...dailyCols // Days 1-21
    ];

    styleSheet(wsData, BRAND_COLOR);
    XLSX.utils.book_append_sheet(wb, wsData, "Dados da Turma");
    XLSX.writeFile(wb, "Modelo_Formacao_Inicial_Corp.xlsx");
  }
};

export const parseFile = async (file: File, type: TrainingType): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        // Try to find a sheet with "Dados" in the name, otherwise use the last one (as templates now have Instructions first)
        // Actually best logic: Find sheet that contains "Dados" or just iterate to find headers.
        // Let's assume the user uses the template which puts "Dados" as the 2nd sheet.
        // Or the user might upload a file with only one sheet.
        // Robust strategy: Look for the sheet that seems to have data (headers).
        
        let targetSheetName = workbook.SheetNames.find(n => n.toLowerCase().includes("dados"));
        if (!targetSheetName) {
            // If no sheet named "Dados", try to find one that is NOT "Instruções"
            targetSheetName = workbook.SheetNames.find(n => !n.toLowerCase().includes("instru") && !n.toLowerCase().includes("guide"));
        }
        if (!targetSheetName) targetSheetName = workbook.SheetNames[0];

        const worksheet = workbook.Sheets[targetSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        
        if (jsonData.length === 0) throw new Error("A planilha está vazia.");

        let headerRowIndex = 0;
        
        if (type === 'refresher') {
           headerRowIndex = jsonData.findIndex(row => 
            row && row.some(cell => {
              const c = String(cell).toLowerCase();
              return c.includes("resultado") || c.includes("pré") || c.includes("tema") || c.includes("indicador");
            })
          );
          if (headerRowIndex === -1) headerRowIndex = 0;
          
          const headers = (jsonData[headerRowIndex] || []).map(h => String(h || "").toLowerCase().trim());
          const findIdx = (keywords: string[]) => headers.findIndex(h => keywords.some(k => h.includes(k)));

          const records: RefresherRecord[] = jsonData.slice(headerRowIndex + 1)
            .filter(row => row && row[findIdx(["nome", "operador"])] && String(row[findIdx(["nome", "operador"])]).trim() !== "")
            .map(row => ({
              id: String(row[findIdx(["matrícula", "matricula", "id"])] || "N/A"),
              name: String(row[findIdx(["nome", "operador"])] || "Desconhecido"),
              supervisor: String(row[findIdx(["supervisor"])] || "N/A"),
              date: String(row[findIdx(["data"])] || new Date().toLocaleDateString()),
              theme: String(row[findIdx(["tema"])] || "Reciclagem Padrão"),
              instructor: String(row[findIdx(["instrutor"])] || "Padrão"),
              indicator: String(row[findIdx(["indicador", "kpi", "métrica"])] || "Geral"),
              target: parseFloat(row[findIdx(["meta", "target", "alvo"])]) || 0,
              preResult: parseFloat(row[findIdx(["pré", "pre"])]) || 0,
              // Expanded keywords for evaluation to match new template headers
              evaluation: parseFloat(row[findIdx(["avaliação", "avaliacao", "teste", "prova", "nota"])]) || 0, 
              postResult: parseFloat(row[findIdx(["pós", "pos"])]) || 0,
              observations: String(row[findIdx(["observações", "obs"])] || "")
            }));
            
          resolve(records);

        } else {
          // INITIAL TRAINING PARSING
          headerRowIndex = jsonData.findIndex(row => 
            row && row.some(cell => {
              const c = String(cell).toLowerCase();
              return c.includes("nome") || c.includes("name") || c.includes("instrutor") || c.includes("participação");
            })
          );
          if (headerRowIndex === -1) headerRowIndex = 0;

          const headers = (jsonData[headerRowIndex] || []).map(h => String(h || "").toLowerCase().trim());
          const findIdx = (keywords: string[]) => headers.findIndex(h => keywords.some(k => h.includes(k)));

          const nameIdx = findIdx(["nome", "name"]);
          const instIdx = findIdx(["instrutor", "instructor"]);
          const statusIdx = findIdx(["status"]);
          const partIdx = findIdx(["participação", "participacao"]);
          const obsIdx = findIdx(["observação", "obs", "observações"]);

          const records: StudentRecord[] = jsonData.slice(headerRowIndex + 1)
            .filter(row => row && row[nameIdx] && String(row[nameIdx]).trim() !== "")
            .map(row => {
              let absences = 0;
              let daysFilled = 0;
              for (let i = 1; i <= 21; i++) {
                const idx = headers.findIndex(h => h === `dia ${i}` || h === `day ${i}`);
                if (idx !== -1 && row[idx] !== undefined && row[idx] !== null && row[idx] !== "") {
                  daysFilled = i;
                  const val = String(row[idx]).toLowerCase().trim();
                  if (val === 'ausente' || val === 'falta' || val === 'f' || val === 'absent' || val === 'a') absences++;
                }
              }

              const grades = [1,2,3,4,5]
                .map(n => {
                  const idx = headers.findIndex(h => h.includes(`av ${n}`) || h.includes(`nota ${n}`) || h.includes(`av. ${n}`));
                  return idx !== -1 ? parseFloat(row[idx]) : NaN;
                })
                .filter(n => !isNaN(n));

              const statusStr = String(row[statusIdx] || 'ativo').toLowerCase();

              // Correctly handle missing/empty participation values
              let participationVal = 'Não Informado';
              if (partIdx !== -1) {
                 const rawVal = row[partIdx];
                 if (rawVal !== undefined && rawVal !== null && String(rawVal).trim() !== '') {
                    participationVal = String(rawVal).trim();
                 }
              }

              let obsVal = '';
              if (obsIdx !== -1) {
                 const rawVal = row[obsIdx];
                 if (rawVal !== undefined && rawVal !== null && String(rawVal).trim() !== '') {
                    obsVal = String(rawVal).trim();
                 }
              }

              return {
                name: String(row[nameIdx]).trim(),
                instructor: instIdx !== -1 ? String(row[instIdx] || 'Padrão').trim() : 'Padrão',
                grade: grades.length > 0 ? grades.reduce((a,b)=>a+b,0)/grades.length : 0,
                absences,
                daysFilled,
                status: statusStr.includes('desist') || statusStr.includes('drop') ? 'dropped' : statusStr.includes('demit') || statusStr.includes('dismiss') ? 'dismissed' : 'active',
                participation: participationVal,
                observations: obsVal
              };
            });
            resolve(records);
        }
      } catch (err: any) { 
        reject(err.message || "Erro desconhecido ao ler o Excel."); 
      }
    };
    reader.onerror = () => reject("Erro ao ler o arquivo.");
    reader.readAsArrayBuffer(file);
  });
};

export const generateSampleData = (): StudentRecord[] => [
  { name: "Carlos Rocha", instructor: "Ana", grade: 7.5, absences: 2, status: 'active', participation: "Média", observations: "Mostra interesse, mas falta base técnica em Excel.", daysFilled: 12 },
  { name: "Juliana Lima", instructor: "Ana", grade: 9.5, absences: 0, status: 'active', participation: "Alta", observations: "Perfil de liderança excelente, ajuda os colegas.", daysFilled: 12 },
  { name: "Marcos Viana", instructor: "Ana", grade: 4.5, absences: 5, status: 'active', participation: "Baixa", observations: "Muitas distrações durante as aulas. Baixo rendimento nas provas.", daysFilled: 12 },
  { name: "Beatriz Souza", instructor: "Carlos", grade: 8.0, absences: 1, status: 'dropped', participation: "Média", observations: "Desistiu por motivos pessoais de saúde.", daysFilled: 5 },
];

export const generateRefresherSampleData = (): RefresherRecord[] => [
  { id: "1001", name: "Ricardo Alves", supervisor: "Roberto", date: "10/11/2023", theme: "Atendimento", instructor: "Silva", indicator: "TMA", target: 180, preResult: 220, evaluation: 9.0, postResult: 175, observations: "Reduziu o TMA drasticamente." },
  { id: "1001", name: "Ricardo Alves", supervisor: "Roberto", date: "10/11/2023", theme: "Atendimento", instructor: "Silva", indicator: "NPS", target: 75, preResult: 60, evaluation: 9.0, postResult: 80, observations: "Melhorou empatia." },
  { id: "1002", name: "Fernanda Costa", supervisor: "Roberto", date: "10/11/2023", theme: "Vendas", instructor: "Silva", indicator: "Conversão", target: 20, preResult: 15, evaluation: 9.5, postResult: 22, observations: "Ótima argumentação." },
];
