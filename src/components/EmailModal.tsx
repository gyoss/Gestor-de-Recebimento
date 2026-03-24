import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Copy, Mail, Send, CheckCircle2 } from 'lucide-react';
import { Divergence } from '../types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface EmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  divergence: Divergence | null;
}

export const EmailModal: React.FC<EmailModalProps> = ({ isOpen, onClose, divergence }) => {
  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen && divergence) {
      setTo(`contato@${divergence.supplierName.toLowerCase().replace(/\s+/g, '')}.com.br`);
      setCc(`${(divergence.buyer || '').toLowerCase().replace(/\s+/g, '')}@suaempresa.com.br; compras@suaempresa.com.br`);
      
      const typeLabel = divergence.type.replace(/_/g, ' ');
      setSubject(`[Divergência de Recebimento] NF ${divergence.invoiceId} - ${divergence.supplierName}`);

      let message = `Olá Equipe ${divergence.supplierName},\n\n`;
      message += `Identificamos uma divergência no recebimento da Nota Fiscal ${divergence.invoiceId}, recebida em ${format(new Date(divergence.entryDate), 'dd/MM/yyyy')}.\n\n`;
      
      message += `Comprador Responsável: ${divergence.buyer || 'Não informado'}\n\n`;

      if (divergence.missingProducts && divergence.missingProducts.length > 0) {
        message += `Itens com Falta no Recebimento:\n`;
        divergence.missingProducts.forEach(p => {
          message += `- SKU ${p.sku} | ${p.description} | Qtd: ${p.qty}\n`;
        });
        message += `\n`;
      }

      if (divergence.invertedProducts && divergence.invertedProducts.length > 0) {
        message += `Mercadorias Afetadas / Trocadas no Recebimento:\n`;
        divergence.invertedProducts.forEach(p => {
          if (p.missing.sku) {
            message += `- Deveria Vir: SKU ${p.missing.sku} | ${p.missing.description} | Qtd: ${p.missing.qty}\n`;
          } else {
            message += `- Item Extra: (Não consta no pedido)\n`;
          }
          message += `  Veio no Lugar: SKU ${p.received.sku} | ${p.received.description} | Qtd: ${p.received.qty}\n`;
        });
        message += `\n`;
      }

      if (divergence.incorrectTaxes && divergence.incorrectTaxes.length > 0) {
        message += `Divergência de Impostos Identificada:\n`;
        divergence.incorrectTaxes.forEach(t => {
          if (t.sku) {
            message += `- SKU ${t.sku} | ${t.description} -> Imposto ${t.taxName}: diferença de R$ ${t.value.toFixed(2)}\n`;
          } else {
            message += `- Imposto ${t.taxName}: diferença no valor de R$ ${t.value.toFixed(2)}\n`;
          }
        });
        message += `\n`;
      }

      if (divergence.quantityDivergences && divergence.quantityDivergences.length > 0) {
        message += `Erro de Contagem / Quantidade Divergente:\n`;
        divergence.quantityDivergences.forEach(q => {
          message += `- SKU ${q.sku} | ${q.description}\n`;
          message += `  Faturado na NF: ${q.expectedQty} | Recebido Fisicamente: ${q.receivedQty} | Diferença: ${Math.abs(q.expectedQty - q.receivedQty)} un.\n`;
        });
        message += `\n`;
      }

      if (divergence.priceDivergences && divergence.priceDivergences.length > 0) {
        message += `Preço / Valor Unitário Incorreto na Nota:\n`;
        divergence.priceDivergences.forEach(p => {
          message += `- SKU ${p.sku} | ${p.description} (${p.qty} un)\n`;
          message += `  Valor Acordado (Pedido): R$ ${p.expectedPrice.toFixed(2)} | Valor Cobrado na NF: R$ ${p.invoicedPrice.toFixed(2)}\n`;
        });
        message += `\n`;
      }

      if (divergence.cnpjDivergence && divergence.cnpjDivergence.invoicedCnpj) {
        message += `Inconsistência de CNPJ Identificada:\n`;
        message += `- CNPJ Correto (Pedido/Destino): ${divergence.cnpjDivergence.expectedCnpj}\n`;
        message += `- CNPJ Incorreto (Emitido na NF): ${divergence.cnpjDivergence.invoicedCnpj}\n\n`;
      }

      message += `Valor Total da Divergência: ${divergence.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}\n\n`;

      if (divergence.description) {
        message += `Observações Adicionais:\n${divergence.description}\n\n`;
      }

      message += `Aguardamos retorno com as tratativas desejadas para a regularização desta ocorrência (Envio de nova mercadoria, carta de correção, autorização para devolução ou geração de crédito).\n\n`;
      message += `Atenciosamente,\nEquipe de Recebimento - Logistics`;

      setBody(message);
      setCopied(false);
    }
  }, [isOpen, divergence]);

  const handleCopy = () => {
    navigator.clipboard.writeText(`Para: ${to}\nCc: ${cc}\nAssunto: ${subject}\n\n${body}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  if (!isOpen || !divergence) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6"
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white rounded-2xl shadow-xl w-full max-w-3xl flex flex-col max-h-[90vh]"
        >
          <div className="flex items-center justify-between p-4 sm:p-6 border-b border-slate-100 shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl shadow-sm border border-indigo-100">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-800 tracking-tight">Gerador de E-mail de Notificação</h2>
                <p className="text-sm text-slate-500">Notifique fornecedores e compradores sobre a divergência</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-600 rounded-full transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-white custom-scrollbar">
            <div className="space-y-4 max-w-full">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider pl-1">Para (Fornecedor)</label>
                  <input type="text" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-200 transition-colors shadow-sm outline-none" value={to} onChange={e => setTo(e.target.value)} />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider pl-1">CC (Comprador / Time Interno)</label>
                  <input type="text" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-200 transition-colors shadow-sm outline-none" value={cc} onChange={e => setCc(e.target.value)} />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider pl-1">Assunto</label>
                <input type="text" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-200 transition-colors shadow-sm outline-none font-semibold text-slate-800" value={subject} onChange={e => setSubject(e.target.value)} />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider flex justify-between items-center pl-1">
                  <span>Mensagem Sugerida</span>
                  <span className="text-[10px] text-indigo-500 font-medium normal-case bg-indigo-50 px-2 py-0.5 rounded-full">Você pode editar este texto</span>
                </label>
                <textarea 
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-200 transition-colors outline-none shadow-sm font-sans leading-relaxed resize-y custom-scrollbar text-slate-700 min-h-[300px]" 
                  value={body} 
                  onChange={e => setBody(e.target.value)} 
                />
              </div>
            </div>
          </div>

          <div className="p-4 sm:p-6 border-t border-slate-100 shrink-0 bg-slate-50/80 flex flex-col sm:flex-row gap-3 justify-end items-center rounded-b-2xl">
            <button
              type="button"
              onClick={handleCopy}
              className={`w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm ${
                copied 
                ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' 
                : 'bg-white text-slate-700 border border-slate-200 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'E-mail Completo Copiado!' : 'Copiar para a Área de Transferência'}
            </button>
            
            <button
              type="button"
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl shadow-sm shadow-indigo-200 transition-colors hover:bg-indigo-700 focus:ring-4 focus:ring-indigo-100 font-bold text-sm cursor-not-allowed opacity-80"
              title="A integração transparente com disparo automático via SMTP ou Outlook será habilitada nesta ferramenta em breve"
            >
              <Send className="w-4 h-4" />
              Enviar E-mail Oficialmente
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
