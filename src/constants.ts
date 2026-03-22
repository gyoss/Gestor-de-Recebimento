import { Divergence } from './types';
import { addDays, subDays, format } from 'date-fns';

export const MOCK_DIVERGENCES: Divergence[] = [
  {
    id: '1',
    invoiceId: 'NF-12345',
    supplierName: 'Tech Solutions Ltda',
    value: 1250.50,
    entryDate: subDays(new Date(), 5).toISOString(),
    deadline: addDays(new Date(), 2).toISOString(),
    status: 'TRIAGEM',
    urgency: 'ALTA',
    type: 'QUANTIDADE',
    description: 'Faltam 5 unidades do item X no recebimento físico.',
    buyer: 'Carlos Alberto',
    ownerId: 'mock-user'
  },
  {
    id: '2',
    invoiceId: 'NF-98765',
    supplierName: 'Global Logistics S.A.',
    value: 450.00,
    entryDate: subDays(new Date(), 3).toISOString(),
    deadline: addDays(new Date(), 1).toISOString(),
    status: 'ANALISE',
    urgency: 'MEDIA',
    type: 'PRECO',
    description: 'Preço unitário no XML diverge do pedido de compra.',
    buyer: 'Mariana Silva',
    ownerId: 'mock-user'
  },
  {
    id: '3',
    invoiceId: 'NF-55443',
    supplierName: 'Office Supplies Co.',
    value: 89.90,
    entryDate: subDays(new Date(), 10).toISOString(),
    deadline: subDays(new Date(), 2).toISOString(),
    status: 'CORRECAO',
    urgency: 'BAIXA',
    type: 'IMPOSTO',
    description: 'Alíquota de ICMS incorreta na nota fiscal.',
    buyer: 'Roberto Santos',
    ownerId: 'mock-user'
  },
  {
    id: '4',
    invoiceId: 'NF-11223',
    supplierName: 'Industrial Parts Inc.',
    value: 3200.00,
    entryDate: subDays(new Date(), 1).toISOString(),
    deadline: addDays(new Date(), 5).toISOString(),
    status: 'CONCLUIDO',
    urgency: 'MEDIA',
    type: 'QUANTIDADE',
    description: 'Divergência resolvida com envio de nota complementar.',
    buyer: 'Ana Paula',
    ownerId: 'mock-user'
  },
  {
    id: '5',
    invoiceId: 'NF-77889',
    supplierName: 'Tech Solutions Ltda',
    value: 600.00,
    entryDate: subDays(new Date(), 2).toISOString(),
    deadline: addDays(new Date(), 3).toISOString(),
    status: 'TRIAGEM',
    urgency: 'ALTA',
    type: 'PRECO',
    description: 'Desconto comercial não aplicado conforme contrato.',
    buyer: 'Carlos Alberto',
    ownerId: 'mock-user'
  }
];

export const COLUMNS = [
  { id: 'TRIAGEM', title: 'Triagem / Divergência Identificada', color: 'bg-slate-100' },
  { id: 'ANALISE', title: 'Em Análise / Contato Fornecedor', color: 'bg-blue-50' },
  { id: 'CORRECAO', title: 'Aguardando Correção / Reenvio', color: 'bg-amber-50' },
  { id: 'CONCLUIDO', title: 'Concluído / Divergência Sanada', color: 'bg-emerald-50' }
];
