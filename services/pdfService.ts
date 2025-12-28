
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";

export const generatePDF = async (elementId: string, fileName: string) => {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`Element with id ${elementId} not found`);
    return;
  }

  try {
    // Aumentamos a escala para 3 para garantir nitidez em textos pequenos
    const canvas = await html2canvas(element, {
      scale: 3,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff', // Força fundo branco para impressão
      windowWidth: 210 * 3.78, // Simula largura A4 em pixels (aprox)
    });

    const imgData = canvas.toDataURL('image/png');
    
    // A4 Size: 210mm x 297mm
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    
    // Calcula proporção para caber na página
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;
    const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
    
    const imgScaledWidth = imgWidth * ratio;
    const imgScaledHeight = imgHeight * ratio;

    // Centraliza se for menor que a página
    const xOffset = (pdfWidth - imgScaledWidth) / 2;
    
    pdf.addImage(imgData, 'PNG', xOffset, 0, imgScaledWidth, imgScaledHeight);
    pdf.save(`${fileName}.pdf`);
  } catch (error) {
    console.error("PDF generation failed:", error);
  }
};
