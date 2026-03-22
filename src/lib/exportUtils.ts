import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { Divergence, DashboardMetrics } from '../types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const exportDivergencesToPDF = (divergences: Divergence[]) => {
  try {
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text('Relatório de Divergências Fiscais', 14, 22);
    
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, 14, 30);
    
    const tableColumn = ["NF", "Fornecedor", "Comprador", "Valor", "Status", "Urgência", "Tipo", "Data Entrada", "Prazo"];
    const tableRows = divergences.map(d => [
      d.invoiceId,
      d.supplierName,
      d.buyer || '-',
      new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(d.value),
      d.status,
      d.urgency,
      d.type,
      format(new Date(d.entryDate), 'dd/MM/yyyy HH:mm'),
      format(new Date(d.deadline), 'dd/MM/yyyy HH:mm')
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 40,
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229] }, // Indigo-600
      styles: { fontSize: 8 }
    });

    doc.save(`divergencias_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  } catch (error) {
    console.error('Erro ao gerar PDF:', error);
    alert('Ocorreu um erro ao gerar o PDF. Por favor, tente novamente.');
  }
};

export const exportDivergencesToExcel = (divergences: Divergence[]) => {
  try {
    const data = divergences.map(d => ({
      'Nota Fiscal': d.invoiceId,
      'Fornecedor': d.supplierName,
      'Comprador': d.buyer || '-',
      'Valor': d.value,
      'Status': d.status,
      'Urgência': d.urgency,
      'Tipo': d.type,
      'Data Entrada': format(new Date(d.entryDate), 'dd/MM/yyyy HH:mm'),
      'Prazo': format(new Date(d.deadline), 'dd/MM/yyyy HH:mm'),
      'Descrição': d.description,
      'Produtos Faltantes': d.missingProducts ? d.missingProducts.map(p => `${p.sku} (${p.description})`).join(', ') : '-'
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Divergências");
    
    // Set column widths
    const wscols = [
      { wch: 15 }, // NF
      { wch: 30 }, // Fornecedor
      { wch: 25 }, // Comprador
      { wch: 15 }, // Valor
      { wch: 15 }, // Status
      { wch: 15 }, // Urgência
      { wch: 15 }, // Tipo
      { wch: 20 }, // Data Entrada
      { wch: 20 }, // Prazo
      { wch: 50 }, // Descrição
      { wch: 50 }, // Produtos Faltantes
    ];
    worksheet['!cols'] = wscols;

    XLSX.writeFile(workbook, `divergencias_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  } catch (error) {
    console.error('Erro ao gerar Excel:', error);
    alert('Ocorreu um erro ao gerar o arquivo Excel.');
  }
};

export const exportDashboardToExcel = (metrics: DashboardMetrics) => {
  try {
    const summaryData = [
      { Métrica: 'Valor Total em Divergência', Valor: metrics.totalValue },
      { Métrica: 'Total de Notas Fiscais', Valor: metrics.totalQuantity },
      { Métrica: 'Valor Recuperado', Valor: metrics.recoveredValue },
      { Métrica: 'Valor Pendente', Valor: metrics.pendingValue },
      { Métrica: 'Tempo Médio de Resolução (dias)', Valor: metrics.avgResolutionTime }
    ];

    const supplierData = metrics.topSuppliers.map(s => ({
      'Fornecedor': s.name,
      'Qtd. Divergências': s.count,
      'Valor Total': s.value
    }));

    const workbook = XLSX.utils.book_new();
    
    const summarySheet = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summarySheet, "Resumo");
    
    const supplierSheet = XLSX.utils.json_to_sheet(supplierData);
    XLSX.utils.book_append_sheet(workbook, supplierSheet, "Top Fornecedores");

    XLSX.writeFile(workbook, `dashboard_report_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  } catch (error) {
    console.error('Erro ao gerar Excel do Dashboard:', error);
    alert('Ocorreu um erro ao gerar o arquivo Excel do Dashboard.');
  }
};

export const exportDashboardToPDF = (metrics: DashboardMetrics) => {
  try {
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text('Relatório de Performance - DivergeFlow', 14, 22);
    
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, 14, 30);

    // Summary Cards
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text('Resumo Geral', 14, 45);
    
    const summaryData = [
      ['Métrica', 'Valor'],
      ['Valor Total em Divergência', new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(metrics.totalValue)],
      ['Total de Notas Fiscais', metrics.totalQuantity.toString()],
      ['Valor Recuperado', new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(metrics.recoveredValue)],
      ['Valor Pendente', new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(metrics.pendingValue)],
      ['Tempo Médio de Resolução', `${metrics.avgResolutionTime.toFixed(1)} dias`]
    ];

    autoTable(doc, {
      body: summaryData,
      startY: 50,
      theme: 'plain',
      styles: { fontSize: 10, cellPadding: 5 }
    });

    // Top Suppliers
    const finalY = (doc as any).lastAutoTable.finalY;
    doc.text('Top Fornecedores por Divergência', 14, finalY + 15);
    
    const supplierRows = metrics.topSuppliers.map(s => [
      s.name,
      s.count.toString(),
      new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(s.value)
    ]);

    autoTable(doc, {
      head: [['Fornecedor', 'Qtd. Divergências', 'Valor Total']],
      body: supplierRows,
      startY: finalY + 20,
      theme: 'striped',
      headStyles: { fillColor: [79, 70, 229] }
    });

    doc.save(`dashboard_report_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  } catch (error) {
    console.error('Erro ao gerar PDF do Dashboard:', error);
    alert('Ocorreu um erro ao gerar o PDF do Dashboard.');
  }
};
