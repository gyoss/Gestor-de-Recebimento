import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Save, AlertCircle, PlusCircle, MessageSquare, Paperclip } from 'lucide-react';
import { DivergenceStatus, DivergenceType, Divergence, DivergenceUpdate, GlobalSettings } from '../types';
import { format, parse, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { db } from '../firebase';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { Product, Supplier, Buyer, InvertedProduct, InvertedProductItem, TaxDivergence, Attachment, QuantityDivergence, PriceDivergence, CnpjDivergence } from '../types';

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
    invertedProducts: [] as InvertedProduct[],
    incorrectTaxes: [] as TaxDivergence[],
    quantityDivergences: [] as QuantityDivergence[],
    priceDivergences: [] as PriceDivergence[],
    cnpjDivergence: { expectedCnpj: '', invoicedCnpj: '' } as CnpjDivergence,
    attachments: [] as Attachment[],
    updates: [] as DivergenceUpdate[]
  });
  const [newUpdate, setNewUpdate] = useState('');
  const [newProduct, setNewProduct] = useState({ sku: '', internalCode: '', description: '', baseValue: '', ipi: '', icmsSt: '', freight: '' });
  const [newTax, setNewTax] = useState({ sku: '', description: '', taxName: '', value: '' });
  const [newQuantity, setNewQuantity] = useState({ sku: '', description: '', expectedQty: '', receivedQty: '', unitValue: '' });
  const [newPrice, setNewPrice] = useState({ sku: '', description: '', qty: '', expectedPrice: '', invoicedPrice: '' });
  const [newAttachment, setNewAttachment] = useState({ name: '', url: '' });
  const emptyInvertedItem = { sku: '', internalCode: '', description: '', baseValue: '', ipi: '', icmsSt: '', freight: '' };
  const [newInvertedProduct, setNewInvertedProduct] = useState({ missing: { ...emptyInvertedItem }, received: { ...emptyInvertedItem } });

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
          invertedProducts: initialData.invertedProducts || [],
          incorrectTaxes: initialData.incorrectTaxes || [],
          quantityDivergences: initialData.quantityDivergences || [],
          priceDivergences: initialData.priceDivergences || [],
          cnpjDivergence: initialData.cnpjDivergence || { expectedCnpj: '', invoicedCnpj: '' },
          attachments: initialData.attachments || [],
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
          invertedProducts: [],
          incorrectTaxes: [],
          quantityDivergences: [],
          priceDivergences: [],
          cnpjDivergence: { expectedCnpj: '', invoicedCnpj: '' },
          attachments: [],
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
      const total = formData.missingProducts.reduce((sum, p) => {
        return sum + (p.baseValue || 0) + (p.ipi || 0) + (p.icmsSt || 0) + (p.freight || 0);
      }, 0);
      setFormData(prev => ({ ...prev, value: formatCurrency((total * 100).toFixed(0)) }));
    } else if (['MERCADORIA_INVERTIDA', 'MERCADORIA_INCORRETA', 'MODELO_INCORRETO'].includes(formData.type)) {
      const total = (formData.invertedProducts || []).reduce((sum, p) => {
        const mTotal = (p.missing.baseValue || 0) + (p.missing.ipi || 0) + (p.missing.icmsSt || 0) + (p.missing.freight || 0);
        const rTotal = (p.received.baseValue || 0) + (p.received.ipi || 0) + (p.received.icmsSt || 0) + (p.received.freight || 0);
        return sum + Math.abs(mTotal - rTotal);
      }, 0);
      setFormData(prev => ({ ...prev, value: formatCurrency((total * 100).toFixed(0)) }));
    } else if (formData.type === 'IMPOSTO') {
      const total = (formData.incorrectTaxes || []).reduce((sum, t) => sum + (t.value || 0), 0);
      setFormData(prev => ({ ...prev, value: formatCurrency((total * 100).toFixed(0)) }));
    } else if (formData.type === 'QUANTIDADE') {
      const total = (formData.quantityDivergences || []).reduce((sum, q) => sum + Math.abs((Number(q.expectedQty) - Number(q.receivedQty)) * q.unitValue), 0);
      setFormData(prev => ({ ...prev, value: formatCurrency((total * 100).toFixed(0)) }));
    } else if (formData.type === 'PRECO') {
      const total = (formData.priceDivergences || []).reduce((sum, p) => sum + Math.abs((p.invoicedPrice - p.expectedPrice) * p.qty), 0);
      setFormData(prev => ({ ...prev, value: formatCurrency((total * 100).toFixed(0)) }));
    }
  }, [formData.missingProducts, formData.invertedProducts, formData.incorrectTaxes, formData.quantityDivergences, formData.priceDivergences, formData.type]);

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
        ? missingProducts.reduce((sum: number, p: any) => sum + p.baseValue + (p.ipi || 0) + (p.icmsSt || 0) + (p.freight || 0), 0)
        : ['MERCADORIA_INVERTIDA', 'MERCADORIA_INCORRETA', 'MODELO_INCORRETO'].includes(formData.type)
        ? (formData.invertedProducts || []).reduce((sum: number, p: any) => {
            const mTotal = (Number(p.missing.baseValue) || 0) + (Number(p.missing.ipi) || 0) + (Number(p.missing.icmsSt) || 0) + (Number(p.missing.freight) || 0);
            const rTotal = (Number(p.received.baseValue) || 0) + (Number(p.received.ipi) || 0) + (Number(p.received.icmsSt) || 0) + (Number(p.received.freight) || 0);
            return sum + Math.abs(mTotal - rTotal);
          }, 0)
        : formData.type === 'IMPOSTO'
        ? (formData.incorrectTaxes || []).reduce((sum: number, t: any) => sum + (Number(t.value) || 0), 0)
        : formData.type === 'QUANTIDADE'
        ? (formData.quantityDivergences || []).reduce((sum: number, q: any) => sum + Math.abs((Number(q.expectedQty) - Number(q.receivedQty)) * Number(q.unitValue)), 0)
        : formData.type === 'PRECO'
        ? (formData.priceDivergences || []).reduce((sum: number, p: any) => sum + Math.abs((Number(p.invoicedPrice) - Number(p.expectedPrice)) * Number(p.qty)), 0)
        : parseCurrency(formData.value);

      await onSave({
        ...formData,
        value: totalValue,
        baseValue: formData.baseValue ? parseCurrency(formData.baseValue) : undefined,
        ipi: formData.ipi ? parseCurrency(formData.ipi) : undefined,
        icmsSt: formData.icmsSt ? parseCurrency(formData.icmsSt) : undefined,
        freight: formData.freight ? parseCurrency(formData.freight) : undefined,
        missingProducts: missingProducts,
        invertedProducts: ['MERCADORIA_INVERTIDA', 'MERCADORIA_INCORRETA', 'MODELO_INCORRETO'].includes(formData.type) ? formData.invertedProducts.map(p => ({
          ...p,
          missing: {
            ...p.missing,
            baseValue: Number(p.missing.baseValue) || 0,
            ipi: p.missing.ipi ? Number(p.missing.ipi) : undefined,
            icmsSt: p.missing.icmsSt ? Number(p.missing.icmsSt) : undefined,
            freight: p.missing.freight ? Number(p.missing.freight) : undefined
          },
          received: {
            ...p.received,
            baseValue: Number(p.received.baseValue) || 0,
            ipi: p.received.ipi ? Number(p.received.ipi) : undefined,
            icmsSt: p.received.icmsSt ? Number(p.received.icmsSt) : undefined,
            freight: p.received.freight ? Number(p.received.freight) : undefined
          }
        })) : undefined,
        incorrectTaxes: formData.type === 'IMPOSTO' ? formData.incorrectTaxes?.map(t => ({
          ...t,
          value: Number(t.value) || 0
        })) : undefined,
        quantityDivergences: formData.type === 'QUANTIDADE' ? (formData.quantityDivergences || []).map(q => ({
          ...q,
          unitValue: Number(q.unitValue) || 0,
          expectedQty: Number(q.expectedQty) || 0,
          receivedQty: Number(q.receivedQty) || 0
        })) : undefined,
        priceDivergences: formData.type === 'PRECO' ? (formData.priceDivergences || []).map(p => ({
          ...p,
          qty: Number(p.qty) || 0,
          expectedPrice: Number(p.expectedPrice) || 0,
          invoicedPrice: Number(p.invoicedPrice) || 0
        })) : undefined,
        cnpjDivergence: formData.type === 'CNPJ_INCORRETO' ? formData.cnpjDivergence : undefined,
        attachments: formData.attachments || [],
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

  const handleInvertedSkuChange = (type: 'missing' | 'received', e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setNewInvertedProduct(prev => ({ ...prev, [type]: { ...prev[type], sku: val } }));
    
    const product = products.find(p => p.sku === val);
    if (product) {
      setNewInvertedProduct(prev => ({
        ...prev,
        [type]: { 
          ...prev[type], 
          description: product.description || prev[type].description,
          internalCode: product.internalCode || prev[type].internalCode
        }
      }));
    }
  };

  const addInvertedProduct = () => {
    if (!newInvertedProduct.missing.sku || !newInvertedProduct.received.sku) return;
    const product: InvertedProduct = {
      id: Date.now().toString(),
      missing: {
        ...newInvertedProduct.missing,
        baseValue: newInvertedProduct.missing.baseValue ? parseCurrency(newInvertedProduct.missing.baseValue) : 0,
        ipi: newInvertedProduct.missing.ipi ? parseCurrency(newInvertedProduct.missing.ipi) : undefined,
        icmsSt: newInvertedProduct.missing.icmsSt ? parseCurrency(newInvertedProduct.missing.icmsSt) : undefined,
        freight: newInvertedProduct.missing.freight ? parseCurrency(newInvertedProduct.missing.freight) : undefined,
      },
      received: {
        ...newInvertedProduct.received,
        baseValue: newInvertedProduct.received.baseValue ? parseCurrency(newInvertedProduct.received.baseValue) : 0,
        ipi: newInvertedProduct.received.ipi ? parseCurrency(newInvertedProduct.received.ipi) : undefined,
        icmsSt: newInvertedProduct.received.icmsSt ? parseCurrency(newInvertedProduct.received.icmsSt) : undefined,
        freight: newInvertedProduct.received.freight ? parseCurrency(newInvertedProduct.received.freight) : undefined,
      }
    };
    setFormData(prev => ({ ...prev, invertedProducts: [...(prev.invertedProducts || []), product] }));
    setNewInvertedProduct({ missing: { ...emptyInvertedItem }, received: { ...emptyInvertedItem } });
  };

  const handleTaxSkuChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setNewTax(prev => ({ ...prev, sku: val }));
    const product = products.find(p => p.sku === val);
    if (product) {
      setNewTax(prev => ({ ...prev, description: product.description || prev.description }));
    }
  };

  const addTax = () => {
    if (!newTax.taxName || !newTax.value) return;
    const tax: TaxDivergence = {
      id: Date.now().toString(),
      sku: newTax.sku,
      description: newTax.description,
      taxName: newTax.taxName,
      value: parseCurrency(newTax.value)
    };
    setFormData(prev => ({ ...prev, incorrectTaxes: [...(prev.incorrectTaxes || []), tax] }));
    setNewTax({ sku: '', description: '', taxName: '', value: '' });
  };

  const handleQuantitySkuChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setNewQuantity(prev => ({ ...prev, sku: val }));
    const product = products.find(p => p.sku === val);
    if (product) {
      setNewQuantity(prev => ({ ...prev, description: product.description || prev.description }));
    }
  };

  const handlePriceSkuChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setNewPrice(prev => ({ ...prev, sku: val }));
    const product = products.find(p => p.sku === val);
    if (product) {
      setNewPrice(prev => ({ ...prev, description: product.description || prev.description }));
    }
  };

  const addQuantity = () => {
    if (!newQuantity.sku || !newQuantity.expectedQty || !newQuantity.receivedQty) return;
    const item: QuantityDivergence = {
      id: Date.now().toString(),
      sku: newQuantity.sku,
      description: newQuantity.description,
      expectedQty: Number(newQuantity.expectedQty),
      receivedQty: Number(newQuantity.receivedQty),
      unitValue: parseCurrency(newQuantity.unitValue)
    };
    setFormData(prev => ({ ...prev, quantityDivergences: [...(prev.quantityDivergences || []), item] }));
    setNewQuantity({ sku: '', description: '', expectedQty: '', receivedQty: '', unitValue: '' });
  };

  const addPrice = () => {
    if (!newPrice.sku || !newPrice.qty || !newPrice.expectedPrice || !newPrice.invoicedPrice) return;
    const item: PriceDivergence = {
      id: Date.now().toString(),
      sku: newPrice.sku,
      description: newPrice.description,
      qty: Number(newPrice.qty),
      expectedPrice: parseCurrency(newPrice.expectedPrice),
      invoicedPrice: parseCurrency(newPrice.invoicedPrice)
    };
    setFormData(prev => ({ ...prev, priceDivergences: [...(prev.priceDivergences || []), item] }));
    setNewPrice({ sku: '', description: '', qty: '', expectedPrice: '', invoicedPrice: '' });
  };

  const addAttachment = () => {
    if (!newAttachment.name || !newAttachment.url) return;
    const attachment: Attachment = {
      id: Date.now().toString(),
      name: newAttachment.name,
      url: newAttachment.url
    };
    setFormData(prev => ({ ...prev, attachments: [...(prev.attachments || []), attachment] }));
    setNewAttachment({ name: '', url: '' });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-[95vw] xl:max-w-6xl max-h-[90vh] flex flex-col overflow-hidden"
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
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
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
                    <option value="PRECO">Preço / Valor Incorreto</option>
                    <option value="FALTA_MERCADORIA">Falta de Mercadoria</option>
                    <option value="MERCADORIA_INVERTIDA">Mercadoria Invertida / Trocada</option>
                    <option value="MERCADORIA_INCORRETA">Mercadoria Incorreta no Pedido</option>
                    <option value="MODELO_INCORRETO">Modelo Incorreto</option>
                    <option value="CNPJ_INCORRETO">CNPJ Incorreto na NF</option>
                    <option value="OUTROS">Outros Motivos</option>
                  </select>
                </div>

                {formData.type === 'FALTA_MERCADORIA' && (
                  <div className="space-y-4 border-t border-slate-100 pt-4 md:col-span-2 xl:col-span-4">
                    <h3 className="text-sm font-bold text-slate-700">Produtos Faltantes</h3>
                    <div className="flex flex-col xl:flex-row gap-3 items-stretch xl:items-center">
                      <div className="w-full xl:w-32 shrink-0">
                        <input type="text" list="products-list" placeholder="SKU" className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm bg-white" value={newProduct.sku} onChange={handleSkuChange} />
                        <datalist id="products-list">
                          {products.map((p, i) => <option key={i} value={p.sku}>{p.description}</option>)}
                        </datalist>
                      </div>
                      <div className="w-full xl:w-40 shrink-0">
                        <input type="text" placeholder="Cód. Int." title="Cód. Interno Fornecedor" className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm bg-white" value={newProduct.internalCode} onChange={e => setNewProduct(prev => ({ ...prev, internalCode: e.target.value }))} />
                      </div>
                      <div className="w-full xl:flex-1 min-w-[200px]">
                        <input type="text" placeholder="Descrição" className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm bg-white" value={newProduct.description} onChange={e => setNewProduct(prev => ({ ...prev, description: e.target.value }))} />
                      </div>
                      <div className="w-full xl:w-32 shrink-0">
                        <input type="text" placeholder="V. Base" title="Valor Base" className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm bg-white" value={newProduct.baseValue} onChange={e => setNewProduct(prev => ({ ...prev, baseValue: formatCurrency(e.target.value) }))} />
                      </div>
                      <div className="w-full xl:w-32 shrink-0">
                        <input type="text" placeholder="IPI" className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm bg-white" value={newProduct.ipi} onChange={e => setNewProduct(prev => ({ ...prev, ipi: formatCurrency(e.target.value) }))} />
                      </div>
                      <div className="w-full xl:w-32 shrink-0">
                        <input type="text" placeholder="ICMS-ST" className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm bg-white" value={newProduct.icmsSt} onChange={e => setNewProduct(prev => ({ ...prev, icmsSt: formatCurrency(e.target.value) }))} />
                      </div>
                      <div className="w-full xl:w-32 shrink-0">
                        <input type="text" placeholder="Frete" className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm bg-white" value={newProduct.freight} onChange={e => setNewProduct(prev => ({ ...prev, freight: formatCurrency(e.target.value) }))} />
                      </div>
                      <button type="button" onClick={addProduct} className="w-full xl:w-auto shrink-0 flex items-center justify-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-colors text-sm font-bold h-[38px]">
                        <PlusCircle className="w-4 h-4" /> <span className="xl:hidden">Adicionar Produto</span>
                      </button>
                    </div>
                    <div className="space-y-2">
                      {formData.missingProducts.map(p => {
                        const productTotal = p.baseValue + (p.ipi || 0) + (p.icmsSt || 0) + (p.freight || 0);
                        return (
                          <div key={p.id} className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex justify-between items-center text-xs">
                            <div className="flex flex-col gap-1">
                              <span className="font-bold">{p.sku} - {p.description}</span>
                              <span className="text-slate-500">
                                Base: R$ {p.baseValue.toFixed(2)}
                                {p.ipi ? ` | IPI: R$ ${p.ipi.toFixed(2)}` : ''}
                                {p.icmsSt ? ` | ST: R$ ${p.icmsSt.toFixed(2)}` : ''}
                                {p.freight ? ` | Frete: R$ ${p.freight.toFixed(2)}` : ''}
                              </span>
                            </div>
                            <span className="font-bold text-sm text-indigo-700">R$ {productTotal.toFixed(2)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {['MERCADORIA_INVERTIDA', 'MERCADORIA_INCORRETA', 'MODELO_INCORRETO'].includes(formData.type) && (
                  <div className="space-y-4 border-t border-slate-100 pt-4 md:col-span-2 xl:col-span-4">
                    <h3 className="text-sm font-bold text-slate-700">Mercadorias Afetadas (O que era para vir vs O que de fato veio)</h3>
                    
                    <div className="flex flex-col gap-2">
                      {/* Linha Faltou */}
                      <div className="flex flex-col xl:flex-row gap-2 items-stretch xl:items-center bg-rose-50/50 p-3 rounded-xl border border-rose-100 overflow-x-auto custom-scrollbar">
                        <div className="flex items-center gap-2 shrink-0 pr-2 border-r border-rose-200">
                           <span className="font-bold text-rose-700 text-xs w-12 text-center">FALTOU / CORRETO</span>
                        </div>
                        <div className="w-full xl:w-28 shrink-0">
                          <input type="text" list="products-list-inv" placeholder="SKU" className="w-full px-3 py-2 rounded-xl border border-rose-200 bg-white text-sm" value={newInvertedProduct.missing.sku} onChange={e => handleInvertedSkuChange('missing', e)} />
                        </div>
                        <div className="w-full xl:w-32 shrink-0">
                          <input type="text" placeholder="Cód. Int." title="Cód. Interno" className="w-full px-3 py-2 rounded-xl border border-rose-200 bg-white text-sm" value={newInvertedProduct.missing.internalCode} onChange={e => setNewInvertedProduct(prev => ({ ...prev, missing: { ...prev.missing, internalCode: e.target.value } }))} />
                        </div>
                        <div className="w-full xl:flex-1 min-w-[150px]">
                          <input type="text" placeholder="Descrição da Falta" className="w-full px-3 py-2 rounded-xl border border-rose-200 bg-white text-sm" value={newInvertedProduct.missing.description} onChange={e => setNewInvertedProduct(prev => ({ ...prev, missing: { ...prev.missing, description: e.target.value } }))} />
                        </div>
                        <div className="w-full xl:w-28 shrink-0">
                          <input type="text" placeholder="V. Base" className="w-full px-3 py-2 rounded-xl border border-rose-200 bg-white text-sm" value={newInvertedProduct.missing.baseValue} onChange={e => setNewInvertedProduct(prev => ({ ...prev, missing: { ...prev.missing, baseValue: formatCurrency(e.target.value) } }))} />
                        </div>
                        <div className="w-full xl:w-24 shrink-0">
                          <input type="text" placeholder="IPI" className="w-full px-3 py-2 rounded-xl border border-rose-200 bg-white text-sm" value={newInvertedProduct.missing.ipi} onChange={e => setNewInvertedProduct(prev => ({ ...prev, missing: { ...prev.missing, ipi: formatCurrency(e.target.value) } }))} />
                        </div>
                        <div className="w-full xl:w-24 shrink-0">
                          <input type="text" placeholder="ICMS-ST" className="w-full px-3 py-2 rounded-xl border border-rose-200 bg-white text-sm" value={newInvertedProduct.missing.icmsSt} onChange={e => setNewInvertedProduct(prev => ({ ...prev, missing: { ...prev.missing, icmsSt: formatCurrency(e.target.value) } }))} />
                        </div>
                        <div className="w-full xl:w-24 shrink-0">
                          <input type="text" placeholder="Frete" className="w-full px-3 py-2 rounded-xl border border-rose-200 bg-white text-sm" value={newInvertedProduct.missing.freight} onChange={e => setNewInvertedProduct(prev => ({ ...prev, missing: { ...prev.missing, freight: formatCurrency(e.target.value) } }))} />
                        </div>
                      </div>

                      {/* Linha Veio */}
                      <div className="flex flex-col xl:flex-row gap-2 items-stretch xl:items-center bg-emerald-50/50 p-3 rounded-xl border border-emerald-100 overflow-x-auto custom-scrollbar">
                        <div className="flex items-center gap-2 shrink-0 pr-2 border-r border-emerald-200">
                           <span className="font-bold text-emerald-700 text-[10px] w-12 text-center">VEIO NO LUGAR</span>
                        </div>
                        <div className="w-full xl:w-28 shrink-0">
                          <input type="text" list="products-list-inv" placeholder="SKU" className="w-full px-3 py-2 rounded-xl border border-emerald-200 bg-white text-sm" value={newInvertedProduct.received.sku} onChange={e => handleInvertedSkuChange('received', e)} />
                        </div>
                        <div className="w-full xl:w-32 shrink-0">
                          <input type="text" placeholder="Cód. Int." title="Cód. Interno" className="w-full px-3 py-2 rounded-xl border border-emerald-200 bg-white text-sm" value={newInvertedProduct.received.internalCode} onChange={e => setNewInvertedProduct(prev => ({ ...prev, received: { ...prev.received, internalCode: e.target.value } }))} />
                        </div>
                        <div className="w-full xl:flex-1 min-w-[150px]">
                          <input type="text" placeholder="Descrição do que Veio" className="w-full px-3 py-2 rounded-xl border border-emerald-200 bg-white text-sm" value={newInvertedProduct.received.description} onChange={e => setNewInvertedProduct(prev => ({ ...prev, received: { ...prev.received, description: e.target.value } }))} />
                        </div>
                        <div className="w-full xl:w-28 shrink-0">
                          <input type="text" placeholder="V. Base" className="w-full px-3 py-2 rounded-xl border border-emerald-200 bg-white text-sm" value={newInvertedProduct.received.baseValue} onChange={e => setNewInvertedProduct(prev => ({ ...prev, received: { ...prev.received, baseValue: formatCurrency(e.target.value) } }))} />
                        </div>
                        <div className="w-full xl:w-24 shrink-0">
                          <input type="text" placeholder="IPI" className="w-full px-3 py-2 rounded-xl border border-emerald-200 bg-white text-sm" value={newInvertedProduct.received.ipi} onChange={e => setNewInvertedProduct(prev => ({ ...prev, received: { ...prev.received, ipi: formatCurrency(e.target.value) } }))} />
                        </div>
                        <div className="w-full xl:w-24 shrink-0">
                          <input type="text" placeholder="ICMS-ST" className="w-full px-3 py-2 rounded-xl border border-emerald-200 bg-white text-sm" value={newInvertedProduct.received.icmsSt} onChange={e => setNewInvertedProduct(prev => ({ ...prev, received: { ...prev.received, icmsSt: formatCurrency(e.target.value) } }))} />
                        </div>
                        <div className="w-full xl:w-24 shrink-0">
                          <input type="text" placeholder="Frete" className="w-full px-3 py-2 rounded-xl border border-emerald-200 bg-white text-sm" value={newInvertedProduct.received.freight} onChange={e => setNewInvertedProduct(prev => ({ ...prev, received: { ...prev.received, freight: formatCurrency(e.target.value) } }))} />
                        </div>
                      </div>

                      <datalist id="products-list-inv">
                        {products.map((p, i) => <option key={`inv-opt-${i}`} value={p.sku}>{p.description}</option>)}
                      </datalist>

                      <div className="flex justify-end pt-2">
                        <button type="button" onClick={addInvertedProduct} className="flex items-center justify-center gap-2 px-6 py-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-colors text-sm font-bold">
                          <PlusCircle className="w-4 h-4" /> Adicionar Par de Troca
                        </button>
                      </div>
                    </div>

                    <div className="space-y-3 mt-4">
                      {(formData.invertedProducts || []).map(p => {
                        const mTotal = p.missing.baseValue + (p.missing.ipi || 0) + (p.missing.icmsSt || 0) + (p.missing.freight || 0);
                        const rTotal = p.received.baseValue + (p.received.ipi || 0) + (p.received.icmsSt || 0) + (p.received.freight || 0);
                        const diff = Math.abs(mTotal - rTotal);

                        return (
                          <div key={p.id} className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col gap-3">
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                              <div className="space-y-1">
                                <span className="text-[10px] font-bold text-rose-700 px-2 py-0.5 bg-rose-100 rounded">FALTOU</span>
                                <p className="font-bold text-slate-800 flex justify-between">
                                  <span>{p.missing.sku} - {p.missing.description}</span>
                                  <span className="text-rose-700 text-sm">R$ {mTotal.toFixed(2)}</span>
                                </p>
                                <p className="text-[10px] text-slate-500">Base: R$ {p.missing.baseValue.toFixed(2)} | IPI: R$ {(p.missing.ipi || 0).toFixed(2)} | ST: R$ {(p.missing.icmsSt || 0).toFixed(2)} | Frete: R$ {(p.missing.freight || 0).toFixed(2)}</p>
                              </div>
                              <div className="space-y-1">
                                <span className="text-[10px] font-bold text-emerald-700 px-2 py-0.5 bg-emerald-100 rounded">VEIO</span>
                                <p className="font-bold text-slate-800 flex justify-between">
                                  <span>{p.received.sku} - {p.received.description}</span>
                                  <span className="text-emerald-700 text-sm">R$ {rTotal.toFixed(2)}</span>
                                </p>
                                <p className="text-[10px] text-slate-500">Base: R$ {p.received.baseValue.toFixed(2)} | IPI: R$ {(p.received.ipi || 0).toFixed(2)} | ST: R$ {(p.received.icmsSt || 0).toFixed(2)} | Frete: R$ {(p.received.freight || 0).toFixed(2)}</p>
                              </div>
                            </div>
                            <div className="mt-2 pt-3 border-t border-slate-200 flex justify-between items-center text-xs">
                              <span className="font-medium text-slate-600">Diferença de Valores:</span>
                              <span className="font-bold text-indigo-700 text-sm">R$ {diff.toFixed(2)}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {formData.type === 'IMPOSTO' && (
                  <div className="space-y-4 border-t border-slate-100 pt-4 md:col-span-2 xl:col-span-4">
                    <h3 className="text-sm font-bold text-slate-700">Impostos Incorretos</h3>
                    <div className="flex flex-col xl:flex-row gap-3 items-stretch xl:items-center bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                      <div className="w-full xl:w-32 shrink-0">
                        <input type="text" list="products-list-tax" placeholder="SKU (Opcional)" className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm" value={newTax.sku} onChange={handleTaxSkuChange} />
                      </div>
                      <datalist id="products-list-tax">
                        {products.map((p, i) => <option key={`tax-${i}`} value={p.sku}>{p.description}</option>)}
                      </datalist>
                      <div className="w-full xl:flex-1 min-w-[150px]">
                        <input type="text" placeholder="Descrição do Produto" className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm" value={newTax.description} onChange={e => setNewTax(prev => ({ ...prev, description: e.target.value }))} />
                      </div>
                      <div className="w-full xl:w-48 shrink-0">
                        <input type="text" list="tax-list" placeholder="Imposto (ex: ICMS, IPI...)" className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none transition-all" value={newTax.taxName} onChange={e => setNewTax(prev => ({ ...prev, taxName: e.target.value.toUpperCase() }))} />
                        <datalist id="tax-list">
                          <option value="ICMS" />
                          <option value="ICMS-ST" />
                          <option value="IPI" />
                          <option value="PIS" />
                          <option value="COFINS" />
                          <option value="ISS" />
                          <option value="DIFAL" />
                        </datalist>
                      </div>
                      <div className="w-full xl:w-32 shrink-0">
                        <input type="text" placeholder="Diferença R$" className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none transition-all" value={newTax.value} onChange={e => setNewTax(prev => ({ ...prev, value: formatCurrency(e.target.value) }))} />
                      </div>
                      <button type="button" onClick={addTax} className="w-full xl:w-auto shrink-0 flex items-center justify-center gap-2 px-6 py-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-colors text-sm font-bold">
                        <PlusCircle className="w-4 h-4" /> Adicionar
                      </button>
                    </div>
                    <div className="flex flex-col gap-3 mt-4">
                       {(formData.incorrectTaxes || []).map(t => (
                         <div key={t.id} className="bg-white p-3 rounded-xl border border-slate-200 flex justify-between items-center text-xs shadow-sm">
                           <div className="flex flex-col gap-1">
                             <div className="flex items-center gap-2">
                               <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded text-[10px]">{t.taxName}</span>
                               {t.sku && <span className="font-bold text-slate-700">{t.sku} - {t.description}</span>}
                               {!t.sku && <span className="font-medium text-slate-500 italic">Aplicado ao total da nota</span>}
                             </div>
                           </div>
                           <span className="text-rose-600 text-sm font-bold">R$ {t.value.toFixed(2)}</span>
                           <button type="button" onClick={() => setFormData(prev => ({ ...prev, incorrectTaxes: prev.incorrectTaxes.filter(tx => tx.id !== t.id) }))} className="text-slate-400 hover:text-rose-500 transition-colors ml-2">
                             <X className="w-4 h-4" />
                           </button>
                         </div>
                       ))}
                    </div>
                  </div>
                )}

                {formData.type === 'QUANTIDADE' && (
                  <div className="space-y-4 border-t border-slate-100 pt-4 md:col-span-2 xl:col-span-4">
                    <h3 className="text-sm font-bold text-slate-700">Erro de Contagem / Quantidade Divergente (Por SKU)</h3>
                    <div className="flex flex-col xl:flex-row gap-3 items-stretch xl:items-center bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                      <div className="w-full xl:w-32 shrink-0">
                        <input type="text" list="products-list-qty" placeholder="SKU" className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm" value={newQuantity.sku} onChange={handleQuantitySkuChange} />
                      </div>
                      <datalist id="products-list-qty">
                        {products.map((p, i) => <option key={`qty-${i}`} value={p.sku}>{p.description}</option>)}
                      </datalist>
                      <div className="w-full xl:flex-1 min-w-[150px]">
                        <input type="text" placeholder="Descrição" className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm" value={newQuantity.description} onChange={e => setNewQuantity(prev => ({ ...prev, description: e.target.value }))} />
                      </div>
                      <div className="w-full xl:w-28 shrink-0">
                        <input type="number" placeholder="Qtd Nota" className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm" value={newQuantity.expectedQty} onChange={e => setNewQuantity(prev => ({ ...prev, expectedQty: e.target.value }))} />
                      </div>
                      <div className="w-full xl:w-28 shrink-0">
                        <input type="number" placeholder="Qtd Recebida" className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm" value={newQuantity.receivedQty} onChange={e => setNewQuantity(prev => ({ ...prev, receivedQty: e.target.value }))} />
                      </div>
                      <div className="w-full xl:w-32 shrink-0">
                        <input type="text" placeholder="V. Unitário" className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm" value={newQuantity.unitValue} onChange={e => setNewQuantity(prev => ({ ...prev, unitValue: formatCurrency(e.target.value) }))} />
                      </div>
                      <button type="button" onClick={addQuantity} className="w-full xl:w-auto shrink-0 flex items-center justify-center gap-2 px-6 py-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-colors text-sm font-bold">
                        <PlusCircle className="w-4 h-4" /> Add
                      </button>
                    </div>

                    <div className="space-y-3 mt-4">
                      {(formData.quantityDivergences || []).map(q => {
                        const diffQty = q.expectedQty - q.receivedQty;
                        const diffVal = Math.abs(diffQty * q.unitValue);
                        return (
                          <div key={q.id} className="bg-white p-3 rounded-xl border border-slate-200 flex justify-between items-center text-xs shadow-sm">
                            <div className="flex flex-col gap-1">
                              <span className="font-bold">{q.sku} - {q.description}</span>
                              <span className="text-slate-500">
                                NF: {q.expectedQty} | Rec: {q.receivedQty} | Dif: {Math.abs(diffQty)} {diffQty > 0 ? '(Faltou)' : '(Sobrou)'} | V.Un: R$ {q.unitValue.toFixed(2)}
                              </span>
                            </div>
                            <span className="font-bold text-sm text-rose-600">R$ {diffVal.toFixed(2)}</span>
                            <button type="button" onClick={() => setFormData(prev => ({ ...prev, quantityDivergences: prev.quantityDivergences?.filter(x => x.id !== q.id) }))} className="text-slate-400 hover:text-rose-500 ml-2"><X className="w-4 h-4" /></button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {formData.type === 'PRECO' && (
                  <div className="space-y-4 border-t border-slate-100 pt-4 md:col-span-2 xl:col-span-4">
                    <h3 className="text-sm font-bold text-slate-700">Preço / Valor Unitário Incorreto na Nota</h3>
                    <div className="flex flex-col xl:flex-row gap-3 items-stretch xl:items-center bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                      <div className="w-full xl:w-32 shrink-0">
                        <input type="text" list="products-list-prc" placeholder="SKU" className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm" value={newPrice.sku} onChange={handlePriceSkuChange} />
                      </div>
                      <datalist id="products-list-prc">
                        {products.map((p, i) => <option key={`prc-${i}`} value={p.sku}>{p.description}</option>)}
                      </datalist>
                      <div className="w-full xl:flex-1 min-w-[150px]">
                        <input type="text" placeholder="Descrição" className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm" value={newPrice.description} onChange={e => setNewPrice(prev => ({ ...prev, description: e.target.value }))} />
                      </div>
                      <div className="w-full xl:w-20 shrink-0">
                        <input type="number" placeholder="Qtd" className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm" value={newPrice.qty} onChange={e => setNewPrice(prev => ({ ...prev, qty: e.target.value }))} />
                      </div>
                      <div className="w-full xl:w-32 shrink-0">
                        <input type="text" placeholder="R$ Pedido" title="Preço do Pedido (Correto)" className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm" value={newPrice.expectedPrice} onChange={e => setNewPrice(prev => ({ ...prev, expectedPrice: formatCurrency(e.target.value) }))} />
                      </div>
                      <div className="w-full xl:w-32 shrink-0">
                        <input type="text" placeholder="R$ NF" title="Preço na Nota Fiscal (Incorreto)" className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm" value={newPrice.invoicedPrice} onChange={e => setNewPrice(prev => ({ ...prev, invoicedPrice: formatCurrency(e.target.value) }))} />
                      </div>
                      <button type="button" onClick={addPrice} className="w-full xl:w-auto shrink-0 flex items-center justify-center gap-2 px-6 py-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-colors text-sm font-bold">
                        <PlusCircle className="w-4 h-4" /> Add
                      </button>
                    </div>

                    <div className="space-y-3 mt-4">
                      {(formData.priceDivergences || []).map(p => {
                        const diffVal = Math.abs((p.invoicedPrice - p.expectedPrice) * p.qty);
                        return (
                          <div key={p.id} className="bg-white p-3 rounded-xl border border-slate-200 flex justify-between items-center text-xs shadow-sm">
                            <div className="flex flex-col gap-1">
                              <span className="font-bold">{p.sku} - {p.description} <span className="text-slate-400 font-normal">({p.qty} un)</span></span>
                              <span className="text-slate-500">
                                Preço Pedido: R$ {p.expectedPrice.toFixed(2)} | Preço NF: R$ {p.invoicedPrice.toFixed(2)}
                              </span>
                            </div>
                            <span className="font-bold text-sm text-indigo-600">R$ {diffVal.toFixed(2)} (Diferença)</span>
                            <button type="button" onClick={() => setFormData(prev => ({ ...prev, priceDivergences: prev.priceDivergences?.filter(x => x.id !== p.id) }))} className="text-slate-400 hover:text-rose-500 ml-2"><X className="w-4 h-4" /></button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {formData.type === 'CNPJ_INCORRETO' && (
                  <div className="space-y-4 border-t border-slate-100 pt-4 md:col-span-2 xl:col-span-4">
                    <h3 className="text-sm font-bold text-slate-700">Inconsistência de CNPJ</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">CNPJ Correto (Pedido / Destino)</label>
                        <input type="text" placeholder="Ex: 00.000.000/0001-00" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:ring-2 focus:ring-indigo-200 transition-colors" value={formData.cnpjDivergence?.expectedCnpj || ''} onChange={e => setFormData(prev => ({ ...prev, cnpjDivergence: { ...prev.cnpjDivergence, expectedCnpj: e.target.value } as CnpjDivergence }))} />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">CNPJ Incorreto (Emitido na NF)</label>
                        <input type="text" placeholder="Ex: 00.000.000/0002-11" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:ring-2 focus:ring-indigo-200 transition-colors" value={formData.cnpjDivergence?.invoicedCnpj || ''} onChange={e => setFormData(prev => ({ ...prev, cnpjDivergence: { ...prev.cnpjDivergence, invoicedCnpj: e.target.value } as CnpjDivergence }))} />
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1">Valor Total da Divergência</label>
                  <input
                    required
                    readOnly={['FALTA_MERCADORIA', 'MERCADORIA_INVERTIDA', 'MERCADORIA_INCORRETA', 'MODELO_INCORRETO', 'IMPOSTO', 'QUANTIDADE', 'PRECO'].includes(formData.type)}
                    type="text"
                    placeholder="R$ 0,00"
                    className={`w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all outline-none text-slate-700 ${['FALTA_MERCADORIA', 'MERCADORIA_INVERTIDA', 'MERCADORIA_INCORRETA', 'MODELO_INCORRETO', 'IMPOSTO', 'QUANTIDADE', 'PRECO'].includes(formData.type) ? 'bg-slate-50 cursor-not-allowed text-indigo-800 font-bold' : ''}`}
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

                <div className="space-y-4 md:col-span-2 xl:col-span-4 border-t border-slate-100 pt-4">
                  <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <Paperclip className="w-4 h-4 text-indigo-500" /> Anexos e Links
                  </h3>
                  <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                    <div className="w-full sm:w-64 shrink-0">
                      <input type="text" placeholder="Nome do Anexo (ex: NF, Foto...)" className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none transition-all" value={newAttachment.name} onChange={e => setNewAttachment(prev => ({ ...prev, name: e.target.value }))} />
                    </div>
                    <div className="w-full sm:flex-1">
                      <input type="url" placeholder="Link do Arquivo (Google Drive, OneDrive...)" className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none transition-all" value={newAttachment.url} onChange={e => setNewAttachment(prev => ({ ...prev, url: e.target.value }))} />
                    </div>
                    <button type="button" onClick={addAttachment} className="w-full sm:w-auto shrink-0 flex items-center justify-center gap-2 px-6 py-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-colors text-sm font-bold h-[38px]">
                      <PlusCircle className="w-4 h-4" /> Adicionar
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                     {(formData.attachments || []).map(a => (
                       <div key={a.id} className="bg-slate-50 pl-3 pr-1 py-1 rounded-xl border border-slate-200 flex items-center gap-2 shadow-sm group">
                         <a href={a.url.startsWith('http') ? a.url : `https://${a.url}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:text-indigo-600 transition-colors">
                           <Paperclip className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600" />
                           <span className="font-bold text-slate-700 text-xs truncate max-w-[150px] group-hover:text-indigo-700">{a.name}</span>
                         </a>
                         <button type="button" onClick={(e) => { e.preventDefault(); setFormData(prev => ({ ...prev, attachments: (prev.attachments || []).filter(att => att.id !== a.id) })) }} className="p-1 hover:bg-rose-100 text-slate-400 hover:text-rose-600 rounded-lg transition-colors ml-1">
                           <X className="w-3.5 h-3.5" />
                         </button>
                       </div>
                     ))}
                  </div>
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
