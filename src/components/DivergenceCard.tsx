import React from 'react';
import { Divergence } from '../types';
import { format, differenceInHours, differenceInDays, isPast } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AlertCircle, Clock, FileText, User, DollarSign, Paperclip, ShieldCheck, Edit2, Trash2 } from 'lucide-react';
import { cn } from '../lib/utils';

interface DivergenceCardProps {
  divergence: Divergence;
  onEdit: (divergence: Divergence) => void;
  onDelete: (id: string) => void;
}

export const DivergenceCard: React.FC<DivergenceCardProps> = ({ divergence, onEdit, onDelete }) => {
  const deadlineDate = new Date(divergence.deadline);
  const hoursRemaining = differenceInHours(deadlineDate, new Date());
  const isOverdue = isPast(deadlineDate);

  const getSLAColor = () => {
    if (divergence.status === 'CONCLUIDO') return 'border-emerald-500 bg-emerald-50';
    if (isOverdue) return 'border-rose-500 bg-rose-50';
    if (hoursRemaining <= 48) return 'border-amber-500 bg-amber-50';
    return 'border-slate-200 bg-white';
  };

  const getUrgencyBadge = () => {
    switch (divergence.urgency) {
      case 'ALTA': return 'bg-rose-100 text-rose-700';
      case 'MEDIA': return 'bg-amber-100 text-amber-700';
      case 'BAIXA': return 'bg-emerald-100 text-emerald-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const getTypeBadge = () => {
    switch (divergence.type) {
      case 'IMPOSTO': return 'bg-indigo-100 text-indigo-700';
      case 'QUANTIDADE': return 'bg-cyan-100 text-cyan-700';
      case 'PRECO': return 'bg-violet-100 text-violet-700';
      case 'FALTA_MERCADORIA': return 'bg-rose-100 text-rose-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const getSLAText = () => {
    if (divergence.status === 'CONCLUIDO') return 'Concluído';
    
    if (isOverdue) {
      const days = differenceInDays(new Date(), deadlineDate);
      const hours = differenceInHours(new Date(), deadlineDate);
      if (days > 0) return `Atrasado há ${days} dia${days > 1 ? 's' : ''}`;
      if (hours > 0) return `Atrasado há ${hours} hora${hours > 1 ? 's' : ''}`;
      return 'Atrasado';
    }
    
    const days = differenceInDays(deadlineDate, new Date());
    if (days > 0) return `Faltam ${days} dia${days > 1 ? 's' : ''}`;
    
    const hours = differenceInHours(deadlineDate, new Date());
    if (hours > 0) return `Vence em ${hours} hora${hours > 1 ? 's' : ''}`;
    return 'Vence em menos de 1 hora';
  };

  const getSLABadgeColor = () => {
    if (isOverdue) return 'bg-rose-100 text-rose-700';
    if (hoursRemaining <= 48) return 'bg-amber-100 text-amber-700';
    return 'bg-emerald-100 text-emerald-700';
  };

  return (
    <div className={cn(
      "group relative flex flex-col gap-3 p-4 rounded-xl border-2 transition-all hover:shadow-md cursor-grab active:cursor-grabbing",
      getSLAColor()
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider", getUrgencyBadge())}>
            {divergence.urgency}
          </span>
          <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider", getTypeBadge())}>
            {divergence.type}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Paperclip className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-[10px] font-mono text-slate-400">#{divergence.id.slice(-4)}</span>
        </div>
      </div>

      <div className="absolute bottom-4 right-4 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button 
          onClick={(e) => { e.stopPropagation(); onEdit(divergence); }}
          className="p-1.5 bg-white shadow-sm border border-slate-100 rounded-lg text-slate-400 hover:text-indigo-600 hover:border-indigo-100 transition-all"
          title="Editar"
        >
          <Edit2 className="w-3.5 h-3.5" />
        </button>
        <button 
          onClick={(e) => { e.stopPropagation(); onDelete(divergence.id); }}
          className="p-1.5 bg-white shadow-sm border border-slate-100 rounded-lg text-slate-400 hover:text-rose-600 hover:border-rose-100 transition-all"
          title="Excluir"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="space-y-1">
        <h4 className="font-semibold text-slate-900 line-clamp-1 flex items-center gap-1.5">
          <FileText className="w-4 h-4 text-slate-400" />
          {divergence.invoiceId}
        </h4>
        <p className="text-xs text-slate-600 flex items-center gap-1.5">
          <User className="w-3.5 h-3.5 text-slate-400" />
          {divergence.supplierName}
        </p>
        <p className="text-[10px] text-slate-500 flex items-center gap-1.5">
          <span className="font-bold">Comprador:</span> {divergence.buyer}
        </p>
        {divergence.type === 'FALTA_MERCADORIA' && divergence.sku && (
          <div className="mt-1 p-2 bg-slate-100/50 rounded-lg border border-slate-200/50">
            <p className="text-[10px] text-slate-600 font-bold">FALTA DE MERCADORIA:</p>
            <p className="text-[10px] text-slate-500"><span className="font-medium">SKU:</span> {divergence.sku}</p>
            <p className="text-[10px] text-slate-500 line-clamp-1"><span className="font-medium">Item:</span> {divergence.productDescription}</p>
          </div>
        )}
        {divergence.description && (
          <p className="text-[11px] text-slate-400 line-clamp-2 mt-1 italic">
            "{divergence.description}"
          </p>
        )}
      </div>

      <div className="flex items-center justify-between mt-1">
        <div className="flex items-center gap-1 text-slate-900 font-bold">
          <DollarSign className="w-4 h-4 text-emerald-600" />
          <span>{divergence.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
        </div>
        
        {divergence.type === 'IMPOSTO' && (
          <div className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
            <ShieldCheck className="w-3 h-3" />
            AUDITORIA FISCAL
          </div>
        )}
      </div>

      <div className="pt-3 mt-1 border-t border-slate-100 flex items-center justify-between text-[11px]">
        <div className="flex items-center gap-1.5 text-slate-500">
          <Clock className="w-3.5 h-3.5" />
          <span>{format(new Date(divergence.entryDate), 'dd/MM/yy HH:mm')}</span>
        </div>
        
        <div className="flex flex-col items-end gap-1">
          <div className={cn(
            "flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
            getSLABadgeColor()
          )}>
            {isOverdue && divergence.status !== 'CONCLUIDO' && <AlertCircle className="w-3 h-3" />}
            <span>{getSLAText()}</span>
          </div>
          <span className="text-[9px] text-slate-400 font-medium">SLA: {format(deadlineDate, 'dd/MM/yy HH:mm')}</span>
        </div>
      </div>
    </div>
  );
};
