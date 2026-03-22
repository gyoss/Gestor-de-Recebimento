import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Save, AlertCircle, PlusCircle, MessageSquare } from 'lucide-react';
import { DivergenceStatus, DivergenceType, Divergence, DivergenceUpdate, GlobalSettings } from '../types';
import { format, parse, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { db } from '../firebase';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { Product, Supplier, Buyer } from '../types';

interface DivergenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
  initialData?: Divergence | null;
  user: any;
}

export const DivergenceModal: React.FC<DivergenceModalProps> = ({ isOpen, onClose, onSave, initialData, user }) => {
  const [formData, setFormData] = useState({
    invoiceId: '',
    supplierName: '',
    value: '',
    status: 'TRIAGEM' as DivergenceStatus,
    urgency: 'MEDIA' as 'BAIXA' | 'MEDIA' | 'ALTA',
    type: 'IMPOSTO' as DivergenceType,
    deadline: '',
    description: '',
    buyer: '',
    sku: '',
    productDescription: '',
    baseValue: '',
    ipi: '',
    icmsSt: '',
    freight: '',
    missingProducts: [] as { id: string; sku: string; internalCode?: string; description: string; baseValue: number; ipi?: number; icmsSt?: number; freight?: number }[],
    updates: [] as DivergenceUpdate[]
  });
  const [newUpdate, setNewUpdate] = useState('');
  const [newProduct, setNewProduct] = useState({ sku: '', internalCode: '', description: '', baseValue: '', ipi: '', icmsSt: '', freight: '' });

  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [buyers, setBuyers] = useState<Buyer[]>([]);

  useEffect(() => {
    const loadMasterData = async () => {
      try {
        const [prodSnap, suppSnap, buySnap] = await Promise.all([
          getDocs(collection(db, 'products')),
          getDocs(collection(db, 'suppliers')),
          getDocs(collection(db, 'buyers'))
        ]);
        setProducts(prodSnap.docs.map(d => d.data() as Product));
        setSuppliers(suppSnap.docs.map(d => d.data() as Supplier));
        setBuyers(buySnap.docs.map(d => d.data() as Buyer));
      } catch (error) {
        console.error("Error loading master data:", error);
      }
    };
    if (isOpen) {
      loadMasterData();
    }
  }, [isOpen]);

  useEffect(() => {
    const loadSettingsAndSetData = async () => {
      if (initialData) {
        setFormData({
          invoiceId: initialData.invoiceId,
          supplierName: initialData.supplierName,
          value: formatCurrency((initialData.value * 100).toFixed(0)),
          status: initialData.status,
          urgency: initialData.urgency,
          type: initialData.type,
          deadline: format(new Date(initialData.deadline), "yyyy-MM-dd'T'HH:mm"),
          description: initialData.description || '',
          buyer: initialData.buyer || '',
          sku: '',
          productDescription: '',
          baseValue: '',
          ipi: '',
          icmsSt: '',
          freight: '',
          missingProducts: initialData.missingProducts || [],
          updates: initialData.updates || []
        });
      } else {
        let defaultDeadline = addDays(new Date(), 5);
        let defaultIpi = '';
        let defaultIcmsSt = '';

        try {
          const globalDoc = await getDoc(doc(db, 'globalSettings', 'config'));
          if (globalDoc.exists()) {
            const settings = globalDoc.data() as GlobalSettings;
            if (settings.defaultDeadlineDays) {
              defaultDeadline = addDays(new Date(), settings.defaultDeadlineDays);
            }
            if (settings.defaultIpi) defaultIpi = String(settings.defaultIpi);
            if (settings.defaultIcmsSt) defaultIcmsSt = String(settings.defaultIcmsSt);
          }
        } catch (error) {
          console.error("Error loading global settings:", error);
        }

        setFormData({
          invoiceId: '',
          supplierName: '',
          value: '',
          status: 'TRIAGEM',
          urgency: 'MEDIA',
          type: 'IMPOSTO',
          deadline: format(defaultDeadline, "yyyy-MM-dd'T'HH:mm"),
          description: '',
          buyer: '',
          sku: '',
          productDescription: '',
          baseValue: '',
          ipi: defaultIpi,
          icmsSt: defaultIcmsSt,
          freight: '',
          missingProducts: [],
          updates: []
        });
      }
    };

    if (isOpen) {
      loadSettingsAndSetData();
    }
  }, [initialData, isOpen]);

  const formatCurrency = (val: string) => {
    const numericValue = val.replace(/\D/g, '');
    if (!numericValue) return '';
    const numberValue = parseFloat(numericValue) / 100;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(numberValue);
  };

  const parseCurrency = (val: string) => {
    const numericValue = val.replace(/\D/g, '');
    return parseFloat(numericValue) / 100 || 0;
  };

  useEffect(() => {
    if (formData.type === 'FALTA_MERCADORIA') {
      const base = parseCurrency(formData.baseValue);
      const ipi = parseCurrency(formData.ipi);
      const st = parseCurrency(formData.icmsSt);
      const freight = parseCurrency(formData.freight);
      const total = base + ipi + st + freight;
      setFormData(prev => ({ ...prev, value: formatCurrency((total * 100).toFixed(0)) }));
    }
  }, [formData.baseValue, formData.ipi, formData.icmsSt, formData.freight, formData.type]);

  const formatDate = (val: string) => {
    const numericValue = val.replace(/\D/g, '').slice(0, 8);
    let formatted = '';
    if (numericValue.length > 0) {
      formatted += numericValue.slice(0, 2);
    }
    if (numericValue.length > 2) {
      formatted += '/' + numericValue.slice(2, 4);
    }
    if (numericValue.length > 4) {
      formatted += '/' + numericValue.slice(4, 8);
    }
    return formatted;
  };

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      let deadlineDate: Date;
      try {
        deadlineDate = new Date(formData.deadline);
        if (isNaN(deadlineDate.getTime())) throw new Error();
      } catch {
        setError('Data de prazo inválida.');
        setIsSubmitting(false);
        return;
      }

      const missingProducts = formData.type === 'FALTA_MERCADORIA' ? formData.missingProducts.map(p => {
        const product: any = {
          ...p,
          baseValue: Number(p.baseValue) || 0,
          ipi: p.ipi ? Number(p.ipi) : undefined,
          icmsSt: p.icmsSt ? Number(p.icmsSt) : undefined,
          freight: p.freight ? Number(p.freight) : undefined
        };
        if (!p.internalCode) {
          delete product.internalCode;
        }
        return product;
      }) : undefined;

      const totalValue = formData.type === 'FALTA_MERCADORIA' 
        ? missingProducts.reduce((sum: number, p: any) => sum + p.baseValue, 0)
        : parseCurrency(formData.value);

      await onSave({
        ...formData,
        value: totalValue,
        baseValue: formData.baseValue ? parseCurrency(formData.baseValue) : undefined,
        ipi: formData.ipi ? parseCurrency(formData.ipi) : undefined,
        icmsSt: formData.icmsSt ? parseCurrency(formData.icmsSt) : undefined,
        freight: formData.freight ? parseCurrency(formData.freight) : undefined,
        missingProducts: missingProducts,
        entryDate: initialData?.entryDate || new Date().toISOString(),
        deadline: deadlineDate.toISOString(),
        updates: formData.updates
      });
      onClose();
    } catch (err: any) {
      console.error('Error saving:', err);
      try {
        const errorInfo = JSON.parse(err.message);
        setError(`Erro ao salvar: ${errorInfo.error || 'Erro desconhecido'}`);
      } catch {
        setError('Erro ao salvar. Verifique os dados preenchidos.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setFormData(prev => ({ ...prev, value: formatCurrency(val) }));
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, deadline: e.target.value }));
  };

  const handleSupplierChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setFormData(prev => {
      const newData = { ...prev, supplierName: val };
      const supplier = suppliers.find(s => s.name.toLowerCase() === val.toLowerCase() || s.cnpj === val);
      if (supplier && supplier.defaultBuyer && !prev.buyer) {
        newData.buyer = supplier.defaultBuyer;
      }
      return newData;
    });
  };

  const handleSkuChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setNewProduct(prev => ({ ...prev, sku: val }));
    
    const product = products.find(p => p.sku === val);
    if (product) {
      setNewProduct(prev => ({
        ...prev,
        description: product.description || prev.description,
        internalCode: product.internalCode || prev.internalCode
      }));
      
      setFormData(prev => {
        const newData = { ...prev };
        if (product.buyerName && !prev.buyer) {
          newData.buyer = product.buyerName;
        }
        if (product.supplierName && !prev.supplierName) {
          newData.supplierName = product.supplierName;
        }
        return newData;
      });
    }
  };

  const addUpdate = () => {
    if (!newUpdate.trim()) return;
    const update: DivergenceUpdate = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      message: newUpdate,
      author: user?.displayName || user?.email || 'Usuário'
    };
    setFormData(prev => ({ ...prev, updates: [...prev.updates, update] }));
    setNewUpdate('');
  };

  const addProduct = () => {
    if (!newProduct.sku || !newProduct.description) return;
    const product = {
      id: Date.now().toString(),
      sku: newProduct.sku,
      internalCode: newProduct.internalCode || undefined,
      description: newProduct.description,
      baseValue: newProduct.baseValue ? parseCurrency(newProduct.baseValue) : 0,
      ipi: newProduct.ipi ? parseCurrency(newProduct.ipi) : undefined,
      icmsSt: newProduct.icmsSt ? parseCurrency(newProduct.icmsSt) : undefined,
      freight: newProduct.freight ? parseCurrency(newProduct.freight) : undefined,
    };
    setFormData(prev => ({ ...prev, missingProducts: [...prev.missingProducts, product] }));
    setNewProduct({ sku: '', internalCode: '', description: '', baseValue: '', ipi: '', icmsSt: '', freight: '' });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
          >
            <div className="px-6 sm:px-8 py-4 sm:py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-slate-900">
                  {initialData ? 'Editar Divergência' : 'Nova Divergência Fiscal'}
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 font-medium">
                  {initialData ? 'Atualize os dados da nota fiscal.' : 'Preencha os dados da nota fiscal com erro.'}
                </p>
              </div>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-slate-200 rounded-xl transition-colors text-slate-400"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
              <div className="p-6 sm:p-8 space-y-6 overflow-y-auto flex-1 custom-scrollbar">
                {error && (
                  <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-3 text-rose-700 text-sm font-medium">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    {error}
                  </div>
                )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1">Número da NF</label>
                  <input
                    required
                    type="text"
                    placeholder="Ex: NF-12345"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all outline-none text-slate-700"
                    value={formData.invoiceId}
                    onChange={e => setFormData(prev => ({ ...prev, invoiceId: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1">Fornecedor</label>
                  <input
                    required
                    type="text"
                    list="suppliers-list"
                    placeholder="Nome da empresa"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all outline-none text-slate-700"
                    value={formData.supplierName}
                    onChange={handleSupplierChange}
                  />
                  <datalist id="suppliers-list">
                    {suppliers.map((s, i) => <option key={i} value={s.name} />)}
                  </datalist>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1">Comprador Responsável</label>
                  <input
                    required
                    type="text"
                    list="buyers-list"
                    placeholder="Nome do comprador"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all outline-none text-slate-700"
                    value={formData.buyer}
                    onChange={e => setFormData(prev => ({ ...prev, buyer: e.target.value }))}
                  />
                  <datalist id="buyers-list">
                    {buyers.map((b, i) => <option key={i} value={b.name} />)}
                  </datalist>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1">Status</label>
                  <select
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all outline-none text-slate-700 bg-white"
                    value={formData.status}
                    onChange={e => setFormData(prev => ({ ...prev, status: e.target.value as DivergenceStatus }))}
                  >
                    <option value="TRIAGEM">Triagem</option>
                    <option value="ANALISE">Em Análise</option>
                    <option value="CORRECAO">Aguardando Correção</option>
                    <option value="CONCLUIDO">Concluído</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1">Tipo de Erro</label>
                  <select
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all outline-none text-slate-700 bg-white"
                    value={formData.type}
                    onChange={e => setFormData(prev => ({ ...prev, type: e.target.value as DivergenceType }))}
                  >
                    <option value="IMPOSTO">Diferença de Imposto</option>
                    <option value="QUANTIDADE">Quantidade Divergente</option>
                    <option value="PRECO">Preço Unitário Errado</option>
                    <option value="FALTA_MERCADORIA">Falta de Mercadoria</option>
                    <option value="OUTROS">Outros Motivos</option>
                  </select>
                </div>

                {formData.type === 'FALTA_MERCADORIA' && (
                  <div className="space-y-4 border-t border-slate-100 pt-4">
                    <h3 className="text-sm font-bold text-slate-700">Produtos Faltantes</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input type="text" list="products-list" placeholder="SKU" className="px-4 py-2 rounded-xl border border-slate-200 text-sm" value={newProduct.sku} onChange={handleSkuChange} />
                      <datalist id="products-list">
                        {products.map((p, i) => <option key={i} value={p.sku}>{p.description}</option>)}
                      </datalist>
                      <input type="text" placeholder="Cód. Interno Fornecedor" className="px-4 py-2 rounded-xl border border-slate-200 text-sm" value={newProduct.internalCode} onChange={e => setNewProduct(prev => ({ ...prev, internalCode: e.target.value }))} />
                      <input type="text" placeholder="Descrição" className="px-4 py-2 rounded-xl border border-slate-200 text-sm" value={newProduct.description} onChange={e => setNewProduct(prev => ({ ...prev, description: e.target.value }))} />
                      <input type="text" placeholder="Valor Base" className="px-4 py-2 rounded-xl border border-slate-200 text-sm" value={newProduct.baseValue} onChange={e => setNewProduct(prev => ({ ...prev, baseValue: formatCurrency(e.target.value) }))} />
                      <input type="text" placeholder="IPI" className="px-4 py-2 rounded-xl border border-slate-200 text-sm" value={newProduct.ipi} onChange={e => setNewProduct(prev => ({ ...prev, ipi: formatCurrency(e.target.value) }))} />
                      <input type="text" placeholder="ICMS-ST" className="px-4 py-2 rounded-xl border border-slate-200 text-sm" value={newProduct.icmsSt} onChange={e => setNewProduct(prev => ({ ...prev, icmsSt: formatCurrency(e.target.value) }))} />
                      <input type="text" placeholder="Frete" className="px-4 py-2 rounded-xl border border-slate-200 text-sm" value={newProduct.freight} onChange={e => setNewProduct(prev => ({ ...prev, freight: formatCurrency(e.target.value) }))} />
                      <button type="button" onClick={addProduct} className="col-span-1 sm:col-span-2 flex items-center justify-center gap-2 py-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-colors text-sm font-bold">
                        <PlusCircle className="w-4 h-4" /> Adicionar Produto
                      </button>
                    </div>
                    <div className="space-y-2">
                      {formData.missingProducts.map(p => (
                        <div key={p.id} className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex justify-between items-center text-xs">
                          <span>{p.sku} - {p.description}</span>
                          <span className="font-bold">R$ {p.baseValue.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1">Valor Total da Divergência</label>
                  <input
                    required
                    readOnly={formData.type === 'FALTA_MERCADORIA'}
                    type="text"
                    placeholder="R$ 0,00"
                    className={`w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all outline-none text-slate-700 ${formData.type === 'FALTA_MERCADORIA' ? 'bg-slate-50 cursor-not-allowed' : ''}`}
                    value={formData.value}
                    onChange={handleValueChange}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between ml-1">
                    <label className="text-sm font-bold text-slate-700">Prazo SLA</label>
                    <button 
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, deadline: format(new Date(), "yyyy-MM-dd'T'HH:mm") }))}
                      className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 uppercase tracking-wider"
                    >
                      Agora
                    </button>
                  </div>
                  <input
                    required
                    type="datetime-local"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all outline-none text-slate-700 bg-white"
                    value={formData.deadline}
                    onChange={handleDateChange}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1">Urgência</label>
                  <div className="flex gap-2">
                    {(['BAIXA', 'MEDIA', 'ALTA'] as const).map(level => (
                      <button
                        key={level}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, urgency: level }))}
                        className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                          formData.urgency === level 
                            ? level === 'ALTA' ? 'bg-rose-100 text-rose-700 border-rose-200' :
                              level === 'MEDIA' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                              'bg-emerald-100 text-emerald-700 border-emerald-200'
                            : 'bg-slate-50 text-slate-400 border-slate-100'
                        } border`}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 ml-1">Descrição Detalhada</label>
                <textarea
                  rows={3}
                  placeholder="Descreva o que aconteceu..."
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all outline-none text-slate-700 resize-none"
                  value={formData.description}
                  onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>

              <div className="space-y-4 pt-6 border-t border-slate-100">
                <label className="text-sm font-bold text-slate-700 ml-1 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  Atualizações
                </label>
                <div className="space-y-3 max-h-40 overflow-y-auto custom-scrollbar pr-2">
                  {formData.updates.map(update => (
                    <div key={update.id} className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-bold text-indigo-600">{update.author}</span>
                        <span className="text-[10px] text-slate-400">{format(new Date(update.timestamp), 'dd/MM HH:mm', { locale: ptBR })}</span>
                      </div>
                      <p className="text-xs text-slate-600">{update.message}</p>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Adicionar atualização..."
                    className="flex-1 px-4 py-2 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all outline-none text-slate-700 text-sm"
                    value={newUpdate}
                    onChange={e => setNewUpdate(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={addUpdate}
                    className="p-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-colors"
                  >
                    <PlusCircle className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            <div className="px-6 sm:px-8 py-4 sm:py-6 border-t border-slate-100 bg-slate-50/50 flex items-center gap-4 shrink-0">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 sm:px-6 py-3 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-all text-sm sm:text-base"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-4 sm:px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2 text-sm sm:text-base"
                >
                  {isSubmitting ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Save className="w-5 h-5" />
                      {initialData ? 'Atualizar Divergência' : 'Salvar Divergência'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
