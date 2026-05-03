import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Budget, BudgetItem } from "@/hooks/useBudgets";
import { detectImageFormat } from "@/lib/imageToDataUrl";

interface ExportData {
  budget: Budget;
  items: BudgetItem[];
  clientName: string;
  clientLogoDataUrl?: string | null;
}

const fmt = (v: number) => `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString("pt-BR") : "—";

const statusLabels: Record<string, string> = {
  rascunho: "Rascunho",
  enviado: "Enviado",
  aprovado: "Aprovado",
  recusado: "Recusado",
};

export function exportBudgetPDF({ budget, items, clientName, clientLogoDataUrl }: ExportData) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 20;

  // Optional client logo (top-right)
  if (clientLogoDataUrl) {
    try {
      const fmt = detectImageFormat(clientLogoDataUrl);
      doc.addImage(clientLogoDataUrl, fmt, pageWidth - 44, 10, 30, 18, undefined, "FAST");
    } catch { /* ignore */ }
  }

  // Header
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("ORÇAMENTO", 14, y);
  
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text("DesignOS • Gestão Criativa", pageWidth - 14, y, { align: "right" });
  doc.text(`Gerado em ${new Date().toLocaleDateString("pt-BR")}`, pageWidth - 14, y + 5, { align: "right" });
  doc.setTextColor(0);

  y += 15;
  doc.setDrawColor(230);
  doc.line(14, y, pageWidth - 14, y);
  y += 10;

  // Budget info
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(budget.title, 14, y);
  y += 7;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  const infoLines = [
    `Cliente: ${clientName}`,
    `Status: ${statusLabels[budget.status] || budget.status}`,
    `Data: ${fmtDate(budget.created_at)}`,
    `Validade: ${fmtDate(budget.valid_until)}`,
  ];
  infoLines.forEach(line => {
    doc.text(line, 14, y);
    y += 5;
  });

  if (budget.description) {
    y += 3;
    doc.setFont("helvetica", "italic");
    const descLines = doc.splitTextToSize(budget.description, pageWidth - 28);
    doc.text(descLines, 14, y);
    y += descLines.length * 5 + 3;
  }

  y += 5;

  // Items table
  autoTable(doc, {
    startY: y,
    head: [["#", "Serviço", "Descrição", "Qtd", "Valor Unit.", "Subtotal"]],
    body: items.map((item, i) => [
      String(i + 1),
      item.title,
      item.description || "—",
      String(item.quantity),
      fmt(item.unit_price),
      fmt(item.subtotal),
    ]),
    foot: [["", "", "", "", "TOTAL", fmt(budget.total_amount)]],
    theme: "grid",
    headStyles: { fillColor: [99, 91, 255], textColor: 255, fontStyle: "bold", fontSize: 9 },
    footStyles: { fillColor: [240, 240, 255], textColor: [30, 30, 30], fontStyle: "bold", fontSize: 10 },
    bodyStyles: { fontSize: 8.5 },
    alternateRowStyles: { fillColor: [250, 250, 255] },
    margin: { left: 14, right: 14 },
    styles: { cellPadding: 3 },
  });

  // Notes
  const finalY = (doc as any).lastAutoTable?.finalY || y + 40;
  if (budget.notes) {
    let ny = finalY + 10;
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("Observações:", 14, ny);
    ny += 5;
    doc.setFont("helvetica", "normal");
    const noteLines = doc.splitTextToSize(budget.notes, pageWidth - 28);
    doc.text(noteLines, 14, ny);
  }

  // Footer
  const pageH = doc.internal.pageSize.getHeight();
  doc.setFontSize(7);
  doc.setTextColor(150);
  doc.text("Documento gerado automaticamente pelo DesignOS", pageWidth / 2, pageH - 10, { align: "center" });

  doc.save(`orcamento-${budget.title.toLowerCase().replace(/\s+/g, "-")}.pdf`);
}
