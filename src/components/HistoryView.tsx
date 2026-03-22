import React from 'react';
import { Divergence } from '../types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Search, Filter, Download, FileText, Table as TableIcon, Trash2, Eye } from 'lucide-react';

interface HistoryViewProps {
  divergences: Divergence[];
  onEdit: (divergence: Divergence) => void;
  onDelete: (id: string) => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({ 
  divergences, 
  onEdit, 
  onDelete
}) => {
  const [searchTerm, setSearchTerm] = React.useState('');
  const completedDivergences = divergences.filter(d => 
    d.status === 'CONCLUIDO' && 
    (d.invoiceId.toLowerCase().includes(searchTerm.toLowerCase()) || 
     d.supplierName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Histórico de Divergências</h2>
          <p className="text-slate-500">Visualize e gerencie todas as divergências concluídas.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar NF ou Fornecedor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all w-64"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-bottom border-slate-200">
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">NF</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Fornecedor</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tipo</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Valor</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Data Entrada</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Comprador</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {completedDivergences.length > 0 ? (
                completedDivergences.map((divergence) => (
                  <tr key={divergence.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <span className="font-medium text-slate-900">{divergence.invoiceId}</span>
                    </td>
                    <td className="px-6 py-4 text-slate-600">{divergence.supplierName}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        divergence.type === 'PRECO' ? 'bg-blue-100 text-blue-700' :
                        divergence.type === 'QUANTIDADE' ? 'bg-purple-100 text-purple-700' :
                        divergence.type === 'IMPOSTO' ? 'bg-amber-100 text-amber-700' :
                        'bg-emerald-100 text-emerald-700'
                      }`}>
                        {divergence.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-900 font-medium">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(divergence.value)}
                    </td>
                    <td className="px-6 py-4 text-slate-500">
                      {format(new Date(divergence.entryDate), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                    </td>
                    <td className="px-6 py-4 text-slate-600">{divergence.buyer}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => onEdit(divergence)}
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Ver detalhes"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onDelete(divergence.id)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Excluir"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                    Nenhuma divergência concluída encontrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
