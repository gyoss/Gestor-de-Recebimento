import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Save, AlertCircle, PlusCircle, MessageSquare, Paperclip, Trash2, Loader2, Upload } from 'lucide-react';
import { DivergenceStatus, DivergenceType, Divergence, DivergenceUpdate, GlobalSettings } from '../types';
import { format, parse, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { db } from '../firebase';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { Product, Supplier, Buyer, InvertedProduct, InvertedProductItem, TaxDivergence, Attachment, QuantityDivergence, PriceDivergence, CnpjDivergence } from '../types';
import { compressImage } from '../utils/imageCompression';

interface DivergenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
  initialData?: Divergence | null;
  user: any;
  userRole: string | null;
}

const INITIAL_FORM_DATA = {
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
  missingProducts: [] as any[],
  invertedProducts: [] as InvertedProduct[],
  incorrectTaxes: [] as TaxDivergence[],
  quantityDivergences: [] as QuantityDivergence[],
  priceDivergences: [] as PriceDivergence[],
  cnpjDivergence: { expectedCnpj: '', invoicedCnpj: '' } as CnpjDivergence,
  attachments: [] as Attachment[],
  updates: [] as DivergenceUpdate[]
};

const INITIAL_ITEM_STATE = { sku: '', model: '', description: '', qty: '1', baseValue: '', ipi: '', ipiTax: '', icmsSt: '', freight: '' };
const INITIAL_TAX_STATE = { sku: '', description: '', taxName: '', value: '' };
const INITIAL_QTY_STATE = { sku: '', model: '', description: '', expectedQty: '', receivedQty: '', unitValue: '' };
const INITIAL_PRICE_STATE = { sku: '', model: '', description: '', qty: '', expectedPrice: '', invoicedPrice: '' };
const INITIAL_ATTACHMENT_STATE = { name: '', url: '' };

const ProductAutocomplete: React.FC<{
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: () => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  suggestions: Product[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  showSuggestionsInline?: boolean;
}> = ({ value, onChange, onBlur, onKeyDown, suggestions, placeholder = "SKU", disabled, className, showSuggestionsInline = true }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`relative w-full ${!showSuggestionsInline ? '' : ''}`} ref={containerRef}>
      <input
        type="text"
        disabled={disabled}
        placeholder={placeholder}
        className={className}
        value={value}
        onChange={(e) => {
          onChange(e);
          setIsOpen(true);
        }}
        onFocus={(e) => {
          e.target.select();
          setIsOpen(true);
        }}
        onClick={(e) => {
          (e.target as HTMLInputElement).select();
          setIsOpen(true);
        }}
        onBlur={() => {
          if (onBlur) onBlur();
          // Pequeno atraso para permitir o clique nas sugestões antes do fechamento
          setTimeout(() => setIsOpen(false), 200);
        }}
        onKeyDown={(e) => {
          if (onKeyDown) onKeyDown(e);
          if (e.key === 'Tab' || e.key === 'Escape') {
            setIsOpen(false);
          }
        }}
      />
      {showSuggestionsInline && isOpen && suggestions.length > 0 && (
        <div className="absolute z-[60] top-full left-0 w-full xl:w-[750px] max-w-[calc(100vw-4rem)] mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto custom-scrollbar">
          {suggestions.map((p, i) => (
            <div
              key={i}
              className="px-4 py-2 hover:bg-slate-50 cursor-pointer text-sm border-b border-slate-50 last:border-0"
              onClick={() => {
                const event = { target: { value: p.sku } } as React.ChangeEvent<HTMLInputElement>;
                onChange(event);
                setIsOpen(false);
              }}
            >
              <div className="font-bold text-slate-700">{p.sku}</div>
              <div className="text-xs text-slate-500 truncate">{p.description}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const DivergenceModal: React.FC<DivergenceModalProps> = ({ isOpen, onClose, onSave, initialData, user, userRole }) => {
  const isReadOnly = userRole !== 'administrador';
  const [formData, setFormData] = useState<Divergence>(initialData || INITIAL_FORM_DATA);
  const [visibleSections, setVisibleSections] = useState<DivergenceType[]>([]);

  useEffect(() => {
    if (initialData) {
      const sections = new Set<DivergenceType>();
      sections.add(initialData.type);
      if (initialData.missingProducts?.length) sections.add('FALTA_MERCADORIA');
      if (initialData.invertedProducts?.length) {
        sections.add('MERCADORIA_INVERTIDA');
        sections.add('MERCADORIA_INCORRETA');
        sections.add('MODELO_INCORRETO');
      }
      if (initialData.incorrectTaxes?.length) sections.add('IMPOSTO');
      if (initialData.quantityDivergences?.length) sections.add('QUANTIDADE');
      if (initialData.priceDivergences?.length) sections.add('PRECO');
      if (initialData.cnpjDivergence?.expectedCnpj) sections.add('CNPJ_INCORRETO');
      
      const sectionList = Array.from(sections) as DivergenceType[];
      setVisibleSections(sectionList.length > 0 ? sectionList : [initialData.type]);
    } else {
      setVisibleSections(['FALTA_MERCADORIA']);
    }
  }, [initialData]);

  const toggleSection = (type: DivergenceType) => {
    setVisibleSections(prev => 
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
    if (!formData.type || visibleSections.length === 0) {
      setFormData(prev => ({ ...prev, type }));
    }
  };
  const [newUpdate, setNewUpdate] = useState('');
  const [newProduct, setNewProduct] = useState(INITIAL_ITEM_STATE);
  const [newTax, setNewTax] = useState(INITIAL_TAX_STATE);
  const [newQuantity, setNewQuantity] = useState(INITIAL_QTY_STATE);
  const [newPrice, setNewPrice] = useState(INITIAL_PRICE_STATE);
  const isAutoCalculated = visibleSections.some(s => ['FALTA_MERCADORIA', 'MERCADORIA_INVERTIDA', 'MERCADORIA_INCORRETA', 'MODELO_INCORRETO', 'IMPOSTO', 'QUANTIDADE', 'PRECO'].includes(s));
  const [newAttachment, setNewAttachment] = useState(INITIAL_ATTACHMENT_STATE);
  const [newInvertedProduct, setNewInvertedProduct] = useState({ missing: { ...INITIAL_ITEM_STATE }, received: { ...INITIAL_ITEM_STATE } });

  useEffect(() => {
    if (!isAutoCalculated) return;

    let total = 0;
    
    // 1. Faltas
    formData.missingProducts.forEach(p => {
      total += (Number(p.baseValue) + Number(p.ipi || 0) + Number(p.icmsSt || 0) + Number(p.freight || 0)) * Number(p.qty);
    });

    // 2. Invertidos
    (formData.invertedProducts || []).forEach(p => {
      const mTotal = (Number(p.missing.baseValue) + Number(p.missing.ipi || 0) + Number(p.missing.icmsSt || 0) + Number(p.missing.freight || 0)) * Number(p.missing.qty);
      const rTotal = (Number(p.received.baseValue) + Number(p.received.ipi || 0) + Number(p.received.icmsSt || 0) + Number(p.received.freight || 0)) * Number(p.received.qty);
      total += Math.abs(mTotal - rTotal);
    });

    // 3. Impostos
    (formData.incorrectTaxes || []).forEach(t => {
      total += Number(t.value);
    });

    // 4. Quantidades
    (formData.quantityDivergences || []).forEach(q => {
      total += Math.abs((Number(q.expectedQty) - Number(q.receivedQty)) * Number(q.unitValue));
    });

    // 5. Preços
    (formData.priceDivergences || []).forEach(p => {
      total += Math.abs((Number(p.invoicedPrice) - Number(p.expectedPrice)) * Number(p.qty));
    });

    setFormData(prev => ({ ...prev, value: total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }));
  }, [
    formData.missingProducts, 
    formData.invertedProducts, 
    formData.incorrectTaxes, 
    formData.quantityDivergences, 
    formData.priceDivergences,
    isAutoCalculated
  ]);

  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [isPriceFocused, setIsPriceFocused] = useState(false);
  const [isQtyFocused, setIsQtyFocused] = useState(false);
  const [isTaxFocused, setIsTaxFocused] = useState(false);
  const [isInvMissingFocused, setIsInvMissingFocused] = useState(false);
  const [isInvReceivedFocused, setIsInvReceivedFocused] = useState(false);
  const [isMissingFocused, setIsMissingFocused] = useState(false);

  const renderSuggestions = (suggestions: Product[], onSelect: (p: Product) => void) => (
    <div className="absolute z-[60] top-full left-0 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto custom-scrollbar animate-in fade-in slide-in-from-top-2 duration-200">
      {suggestions.map((p, i) => (
        <div
          key={i}
          className="px-4 py-2 hover:bg-slate-50 cursor-pointer text-sm border-b border-slate-50 last:border-0"
          onMouseDown={(e) => {
            e.preventDefault();
            onSelect(p);
          }}
        >
          <div className="font-bold text-slate-700">{p.sku}</div>
          <div className="text-xs text-slate-500 truncate">{p.description}</div>
        </div>
      ))}
    </div>
  );

  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [buyers, setBuyers] = useState<Buyer[]>([]);

  const resetForm = () => {
    setFormData(INITIAL_FORM_DATA);
    setNewUpdate('');
    setNewProduct(INITIAL_ITEM_STATE);
    setNewTax(INITIAL_TAX_STATE);
    setNewQuantity(INITIAL_QTY_STATE);
    setNewPrice(INITIAL_PRICE_STATE);
    setNewAttachment(INITIAL_ATTACHMENT_STATE);
    setNewInvertedProduct({ missing: { ...INITIAL_ITEM_STATE }, received: { ...INITIAL_ITEM_STATE } });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const isDirty = React.useMemo(() => {
    if (initialData) return false; // For now, only track dirty state for new cards
    return (
      formData.invoiceId !== '' ||
      formData.supplierName !== '' ||
      formData.value !== '' ||
      formData.description !== '' ||
      formData.buyer !== '' ||
      formData.missingProducts.length > 0 ||
      formData.invertedProducts.length > 0 ||
      formData.incorrectTaxes.length > 0 ||
      formData.quantityDivergences.length > 0 ||
      formData.priceDivergences.length > 0 ||
      newProduct.sku !== '' ||
      newTax.sku !== '' ||
      newQuantity.sku !== '' ||
      newPrice.sku !== '' ||
      newUpdate !== ''
    );
  }, [formData, newProduct, newTax, newQuantity, newPrice, newUpdate, initialData]);

  const handleClose = () => {
    if (isDirty && !window.confirm('Existem alterações não salvas. Deseja realmente sair?')) {
      return;
    }
    resetForm();
    onClose();
  };

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
      resetForm();
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

  const productMap = React.useMemo(() => {
    const map = new Map<string, Product>();
    products.forEach(p => map.set(p.sku, p));
    return map;
  }, [products]);

  const filteredProductSuggestions = React.useMemo(() => {
    const query = newProduct.sku.toLowerCase();
    if (query.length < 1) return [];
    const isNumeric = /^\d+$/.test(query);
    return products
      .filter(p => {
        const skuMatch = p.sku.toLowerCase().includes(query);
        if (isNumeric && query.length >= 3) return skuMatch;
        return skuMatch || (p.description && p.description.toLowerCase().includes(query));
      })
      .slice(0, 20);
  }, [products, newProduct.sku]);

  const filteredInvMissingSuggestions = React.useMemo(() => {
    const query = newInvertedProduct.missing.sku.toLowerCase();
    if (query.length < 1) return [];
    const isNumeric = /^\d+$/.test(query);
    return products
      .filter(p => {
        const skuMatch = p.sku.toLowerCase().includes(query);
        if (isNumeric && query.length >= 3) return skuMatch;
        return skuMatch || (p.description && p.description.toLowerCase().includes(query));
      })
      .slice(0, 20);
  }, [products, newInvertedProduct.missing.sku]);

  const filteredInvReceivedSuggestions = React.useMemo(() => {
    const query = newInvertedProduct.received.sku.toLowerCase();
    if (query.length < 1) return [];
    const isNumeric = /^\d+$/.test(query);
    return products
      .filter(p => {
        const skuMatch = p.sku.toLowerCase().includes(query);
        if (isNumeric && query.length >= 3) return skuMatch;
        return skuMatch || (p.description && p.description.toLowerCase().includes(query));
      })
      .slice(0, 20);
  }, [products, newInvertedProduct.received.sku]);

  const filteredTaxSuggestions = React.useMemo(() => {
    const query = newTax.sku.toLowerCase();
    if (query.length < 1) return [];
    const isNumeric = /^\d+$/.test(query);
    return products
      .filter(p => {
        const skuMatch = p.sku.toLowerCase().includes(query);
        if (isNumeric && query.length >= 3) return skuMatch;
        return skuMatch || (p.description && p.description.toLowerCase().includes(query));
      })
      .slice(0, 20);
  }, [products, newTax.sku]);

  const filteredQtySuggestions = React.useMemo(() => {
    const query = newQuantity.sku.toLowerCase();
    if (query.length < 1) return [];
    const isNumeric = /^\d+$/.test(query);
    return products
      .filter(p => {
        const skuMatch = p.sku.toLowerCase().includes(query);
        if (isNumeric && query.length >= 3) return skuMatch;
        return skuMatch || (p.description && p.description.toLowerCase().includes(query));
      })
      .slice(0, 20);
  }, [products, newQuantity.sku]);

  const filteredPriceSuggestions = React.useMemo(() => {
    const query = newPrice.sku.toLowerCase();
    if (query.length < 1) return [];
    const isNumeric = /^\d+$/.test(query);
    return products
      .filter(p => {
        const skuMatch = p.sku.toLowerCase().includes(query);
        if (isNumeric && query.length >= 3) return skuMatch;
        return skuMatch || (p.description && p.description.toLowerCase().includes(query));
      })
      .slice(0, 20);
  }, [products, newPrice.sku]);

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

      if (!formData.invoiceId || !formData.supplierName || !formData.buyer) {
        const msg = `Campos obrigatórios faltando: ${[!formData.invoiceId && 'NF', !formData.supplierName && 'Fornecedor', !formData.buyer && 'Comprador'].filter(Boolean).join(', ')}`;
        console.error(msg);
        setError(msg);
        setIsSubmitting(false);
        return;
      }

      console.log('Dados a serem salvos (antes da limpeza):', formData);

      // --- 1. FALTA DE MERCADORIA ---
      const missingProducts = formData.missingProducts.map(p => ({
        ...p,
        qty: Number(p.qty) || 0,
        baseValue: Number(p.baseValue) || 0,
        ipi: p.ipi ? Number(p.ipi) : 0,
        icmsSt: p.icmsSt ? Number(p.icmsSt) : 0,
        freight: p.freight ? Number(p.freight) : 0
      })).filter(p => p.sku && p.qty > 0);

      // --- 2. MERCADORIA INVERTIDA / INCORRETA ---
      const invertedProducts = (formData.invertedProducts || []).map(p => ({
        ...p,
        missing: {
          ...p.missing,
          qty: Number(p.missing.qty) || 0,
          baseValue: Number(p.missing.baseValue) || 0,
          ipi: p.missing.ipi ? Number(p.missing.ipi) : 0,
          icmsSt: p.missing.icmsSt ? Number(p.missing.icmsSt) : 0,
          freight: p.missing.freight ? Number(p.missing.freight) : 0
        },
        received: {
          ...p.received,
          qty: Number(p.received.qty) || 0,
          baseValue: Number(p.received.baseValue) || 0,
          ipi: p.received.ipi ? Number(p.received.ipi) : 0,
          icmsSt: p.received.icmsSt ? Number(p.received.icmsSt) : 0,
          freight: p.received.freight ? Number(p.received.freight) : 0
        }
      })).filter(p => p.missing.sku || p.received.sku);

      // --- 3. IMPOSTO ---
      const incorrectTaxes = (formData.incorrectTaxes || []).map(t => ({
        ...t,
        value: Number(t.value) || 0
      })).filter(t => t.value !== 0);

      // --- 4. QUANTIDADE ---
      const quantityDivergences = (formData.quantityDivergences || []).map(q => ({
        ...q,
        unitValue: Number(q.unitValue) || 0,
        expectedQty: Number(q.expectedQty) || 0,
        receivedQty: Number(q.receivedQty) || 0
      })).filter(q => q.expectedQty !== q.receivedQty);

      // --- 5. PRECO ---
      const priceDivergences = (formData.priceDivergences || []).map(p => ({
        ...p,
        qty: Number(p.qty) || 0,
        expectedPrice: Number(p.expectedPrice) || 0,
        invoicedPrice: Number(p.invoicedPrice) || 0
      })).filter(p => p.expectedPrice !== p.invoicedPrice);

      // --- CALCULO DO VALOR TOTAL ---
      let totalValue = 0;
      totalValue += missingProducts.reduce((sum, p) => sum + (p.baseValue + p.ipi + p.icmsSt + p.freight) * p.qty, 0);
      totalValue += invertedProducts.reduce((sum, p) => {
        const mTotal = (p.missing.baseValue + p.missing.ipi + p.missing.icmsSt + p.missing.freight) * p.missing.qty;
        const rTotal = (p.received.baseValue + p.received.ipi + p.received.icmsSt + p.received.freight) * p.received.qty;
        return sum + Math.abs(mTotal - rTotal);
      }, 0);
      totalValue += incorrectTaxes.reduce((sum, t) => sum + t.value, 0);
      totalValue += quantityDivergences.reduce((sum, q) => sum + Math.abs((q.expectedQty - q.receivedQty) * q.unitValue), 0);
      totalValue += priceDivergences.reduce((sum, p) => sum + Math.abs((p.invoicedPrice - p.expectedPrice) * p.qty), 0);

      // Se não houver itens, usa o valor manual digitado (se houver)
      if (totalValue === 0 && formData.value) {
        totalValue = parseCurrency(formData.value);
      }

      const saveData: any = {
        ...formData,
        type: visibleSections[0] || formData.type || 'OUTROS',
        value: totalValue,
        missingProducts,
        invertedProducts,
        incorrectTaxes,
        quantityDivergences,
        priceDivergences,
        entryDate: initialData?.entryDate || new Date().toISOString(),
        deadline: deadlineDate.toISOString(),
      };

      // Add optional fields only if they have values
      if (formData.baseValue) saveData.baseValue = parseCurrency(formData.baseValue);
      if (formData.ipi) saveData.ipi = parseCurrency(formData.ipi);
      if (formData.icmsSt) saveData.icmsSt = parseCurrency(formData.icmsSt);
      if (formData.freight) saveData.freight = parseCurrency(formData.freight);
      
      if (visibleSections.includes('CNPJ_INCORRETO')) {
        saveData.cnpjDivergence = formData.cnpjDivergence;
      } else {
        delete saveData.cnpjDivergence;
      }

      // Final cleanup of undefined/null/empty values that might violate rules
      const requiredFields = ['invoiceId', 'supplierName', 'value', 'status', 'urgency', 'type', 'entryDate', 'deadline', 'ownerId', 'buyer'];
      Object.keys(saveData).forEach(key => {
        if (saveData[key] === undefined || saveData[key] === null || saveData[key] === '') {
          // Keep required fields even if empty (UI validation above should prevent this)
          if (!requiredFields.includes(key)) {
            delete saveData[key];
          }
        }
      });

      await onSave(saveData);
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
      // Update buyer if supplier is found and has a default buyer
      if (supplier && supplier.defaultBuyer) {
        newData.buyer = supplier.defaultBuyer;
      }
      return newData;
    });
  };

  const calculateIpi = (base: string, tax: string) => {
    const baseVal = parseCurrency(base);
    const taxVal = parseFloat(tax.replace(',', '.')) || 0;
    if (baseVal > 0 && taxVal > 0) {
      return formatCurrency(((baseVal * taxVal) / 100).toFixed(2));
    }
    return '';
  };

  const handleSkuChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setNewProduct(prev => ({ ...prev, sku: val }));
    
    const product = productMap.get(val);
    if (product) {
      setNewProduct(prev => ({
        ...prev,
        description: product.description || '',
        model: product.model || '-'
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
      model: newProduct.model || null,
      description: newProduct.description,
      qty: Number(newProduct.qty) || 1,
      baseValue: newProduct.baseValue ? parseCurrency(newProduct.baseValue) : 0,
      ipi: newProduct.ipi ? parseCurrency(newProduct.ipi) : null,
      ipiTax: newProduct.ipiTax ? parseFloat(newProduct.ipiTax) : null,
      icmsSt: newProduct.icmsSt ? parseCurrency(newProduct.icmsSt) : null,
      freight: newProduct.freight ? parseCurrency(newProduct.freight) : null,
    };
    setFormData(prev => ({ ...prev, missingProducts: [...prev.missingProducts, product] }));
    setNewProduct(INITIAL_ITEM_STATE);
  };

  const handleInvertedSkuChange = (type: 'missing' | 'received', e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setNewInvertedProduct(prev => ({ ...prev, [type]: { ...prev[type], sku: val } }));
    
    const product = productMap.get(val);
    if (product) {
      setNewInvertedProduct(prev => ({
        ...prev,
        [type]: { 
          ...prev[type], 
          description: product.description || '',
          model: product.model || '-'
        }
      }));
    }
  };

  const addInvertedProduct = () => {
    if (!newInvertedProduct.received.sku) return;
    const product: InvertedProduct = {
      id: Date.now().toString(),
      missing: {
        ...newInvertedProduct.missing,
        qty: Number(newInvertedProduct.missing.qty) || 1,
        baseValue: newInvertedProduct.missing.baseValue ? parseCurrency(newInvertedProduct.missing.baseValue) : 0,
        ipi: newInvertedProduct.missing.ipi ? parseCurrency(newInvertedProduct.missing.ipi) : null,
        ipiTax: newInvertedProduct.missing.ipiTax ? parseFloat(newInvertedProduct.missing.ipiTax) : null,
        icmsSt: newInvertedProduct.missing.icmsSt ? parseCurrency(newInvertedProduct.missing.icmsSt) : null,
        freight: newInvertedProduct.missing.freight ? parseCurrency(newInvertedProduct.missing.freight) : null,
      },
      received: {
        ...newInvertedProduct.received,
        qty: Number(newInvertedProduct.received.qty) || 1,
        baseValue: newInvertedProduct.received.baseValue ? parseCurrency(newInvertedProduct.received.baseValue) : 0,
        ipi: newInvertedProduct.received.ipi ? parseCurrency(newInvertedProduct.received.ipi) : null,
        ipiTax: newInvertedProduct.received.ipiTax ? parseFloat(newInvertedProduct.received.ipiTax) : null,
        icmsSt: newInvertedProduct.received.icmsSt ? parseCurrency(newInvertedProduct.received.icmsSt) : null,
        freight: newInvertedProduct.received.freight ? parseCurrency(newInvertedProduct.received.freight) : null,
      }
    };
    setFormData(prev => ({ ...prev, invertedProducts: [...(prev.invertedProducts || []), product] }));
    setNewInvertedProduct({ missing: { ...INITIAL_ITEM_STATE }, received: { ...INITIAL_ITEM_STATE } });
  };

  const handleTaxSkuChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setNewTax(prev => ({ ...prev, sku: val }));
    const product = productMap.get(val);
    if (product) {
      setNewTax(prev => ({ ...prev, description: product.description || '' }));
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
    const product = productMap.get(val);
    if (product) {
      setNewQuantity(prev => ({ 
        ...prev, 
        description: product.description || '',
        model: product.model || '-'
      }));
    }
  };

  const handlePriceSkuChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setNewPrice(prev => ({ ...prev, sku: val }));
    const product = productMap.get(val);
    if (product) {
      setNewPrice(prev => ({ 
        ...prev, 
        description: product.description || '',
        model: product.model || '-'
      }));
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

  const addAttachment = async () => {
    if (!newAttachment.name) {
      alert('Por favor, dê um nome ao anexo.');
      return;
    }

    const file = fileInputRef.current?.files?.[0];
    if (!file && !newAttachment.url) {
      alert('Por favor, selecione um arquivo ou insira um link.');
      return;
    }

    try {
      setIsUploading(true);
      console.log("[UPLOAD] Iniciando processo para:", file?.name || "link externo");
      let finalUrl = newAttachment.url;

      if (file) {
        let uploadData: Blob | File = file;
        
        if (file.type.startsWith('image/')) {
          console.log("[UPLOAD] Comprimindo imagem...");
          try {
            uploadData = await compressImage(file);
            console.log("[UPLOAD] Compressão concluída.");
          } catch (err) {
            console.warn('[UPLOAD] Falha na compressão, enviando original:', err);
          }
        }

        console.log("[UPLOAD] Enviando para o servidor local...");
        const formDataToUpload = new FormData();
        formDataToUpload.append('file', uploadData, file.name);

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formDataToUpload
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Falha no servidor ao processar upload');
        }

        const data = await response.json();
        finalUrl = data.url;
        console.log("[UPLOAD] Sucesso! URL local:", finalUrl);
      }

      const attachment: Attachment = {
        id: Math.random().toString(36).substr(2, 9),
        name: newAttachment.name,
        url: finalUrl
      };

      setFormData(prev => ({
        ...prev,
        attachments: [...(prev.attachments || []), attachment]
      }));
      
      setNewAttachment(INITIAL_ATTACHMENT_STATE);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (error) {
      console.error('[UPLOAD] Erro inesperado:', error);
      alert(error instanceof Error ? error.message : 'Erro ao fazer upload do arquivo.');
    } finally {
      setIsUploading(false);
    }
  };

  const deleteAttachmentFile = async (url: string) => {
    if (!url || !url.startsWith('/uploads/')) return;
    
    const filename = url.replace('/uploads/', '');
    if (!filename) return;

    try {
      await fetch(`/api/upload/${filename}`, {
        method: 'DELETE'
      });
    } catch (err) {
      console.error('[DELETE] Erro ao comunicar com servidor:', err);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
          onClick={handleClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            onClick={(e) => e.stopPropagation()}
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
                onClick={handleClose}
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
              <div className={`grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 ${isReadOnly ? 'opacity-75' : ''}`}>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1">Número da NF</label>
                  <input
                    required
                    disabled={isReadOnly}
                    type="text"
                    placeholder="Ex: NF-12345"
                    onFocus={(e) => e.target.select()}
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all outline-none text-slate-700 disabled:bg-slate-50 disabled:text-slate-500"
                    value={formData.invoiceId}
                    onChange={e => setFormData(prev => ({ ...prev, invoiceId: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1">Fornecedor</label>
                  <input
                    required
                    disabled={isReadOnly}
                    type="text"
                    list="suppliers-list"
                    placeholder="Nome da empresa"
                    onFocus={(e) => e.target.select()}
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all outline-none text-slate-700 disabled:bg-slate-50 disabled:text-slate-500"
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
                    disabled={userRole !== 'administrador' && userRole !== 'comprador'}
                    type="text"
                    list="buyers-list"
                    placeholder="Nome do comprador"
                    onFocus={(e) => e.target.select()}
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all outline-none text-slate-700 disabled:bg-slate-50 disabled:text-slate-500"
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
                    disabled={isReadOnly}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all outline-none text-slate-700 bg-white disabled:bg-slate-50 disabled:text-slate-500"
                    value={formData.status}
                    onChange={e => setFormData(prev => ({ ...prev, status: e.target.value as DivergenceStatus }))}
                  >
                    <option value="TRIAGEM">Triagem</option>
                    <option value="ANALISE">Em Análise</option>
                    <option value="CORRECAO">Aguardando Correção</option>
                    <option value="CONCLUIDO">Concluído</option>
                  </select>
                </div>

                <div className="md:col-span-2 xl:col-span-4 space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1">Tipos de Divergência Presentes (Selecione todos que se aplicam)</label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { id: 'FALTA_MERCADORIA', label: 'Falta de Mercadoria' },
                      { id: 'MERCADORIA_INVERTIDA', label: 'Mercadoria Invertida / Trocada' },
                      { id: 'MERCADORIA_INCORRETA', label: 'Mercadoria Incorreta no Pedido' },
                      { id: 'MODELO_INCORRETO', label: 'Modelo Incorreto' },
                      { id: 'QUANTIDADE', label: 'Quantidade Divergente' },
                      { id: 'PRECO', label: 'Preço / Valor Incorreto' },
                      { id: 'IMPOSTO', label: 'Diferença de Imposto' },
                      { id: 'CNPJ_INCORRETO', label: 'CNPJ Incorreto' },
                      { id: 'OUTROS', label: 'Outros' }
                    ].map(type => (
                      <button
                        key={type.id}
                        type="button"
                        disabled={isReadOnly}
                        onClick={() => toggleSection(type.id as DivergenceType)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                          visibleSections.includes(type.id as DivergenceType)
                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-200'
                            : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300 hover:bg-indigo-50'
                        }`}
                      >
                        {type.label}
                      </button>
                    ))}
                  </div>
                </div>

                {visibleSections.includes('OUTROS') && (
                  <div className="space-y-2 border-t border-slate-100 pt-4 md:col-span-2 xl:col-span-4">
                    <label className="text-sm font-bold text-slate-700 ml-1">Valor Total da Divergência (Manual)</label>
                    <input
                      required
                      type="text"
                      placeholder="R$ 0,00"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all outline-none text-slate-700"
                      value={formData.value}
                      onChange={handleValueChange}
                    />
                  </div>
                )}

                {visibleSections.includes('FALTA_MERCADORIA') && (
                  <div className="space-y-4 border-t border-slate-100 pt-4 md:col-span-2 xl:col-span-4">
                    <h3 className="text-sm font-bold text-slate-700">Produtos Faltantes</h3>
                    <div className="flex flex-col xl:flex-row gap-3 items-stretch xl:items-center">
                      <div 
                        className="flex flex-col xl:flex-row gap-3 flex-1 relative"
                        onFocus={() => setIsMissingFocused(true)}
                        onBlur={(e) => {
                          if (!e.currentTarget.contains(e.relatedTarget)) setIsMissingFocused(false);
                        }}
                      >
                        <div className="w-full xl:w-32 shrink-0">
                          <ProductAutocomplete 
                            value={newProduct.sku} 
                            onChange={handleSkuChange} 
                            onBlur={() => setTimeout(() => setIsMissingFocused(false), 200)}
                            onKeyDown={(e) => { if (e.key === 'Tab' || e.key === 'Escape') setIsMissingFocused(false); }}
                            suggestions={filteredProductSuggestions} 
                            className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm bg-white" 
                            disabled={isReadOnly}
                            showSuggestionsInline={false}
                          />
                        </div>
                        <div className="w-full xl:w-32 shrink-0">
                          <input type="text" placeholder="Modelo" title="Modelo do Produto" className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm bg-white" value={newProduct.model} onChange={e => setNewProduct(prev => ({ ...prev, model: e.target.value }))} />
                        </div>
                        <div className="w-full xl:flex-1 min-w-[200px]">
                          <input type="text" placeholder="Descrição" className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm bg-white" value={newProduct.description} onChange={e => setNewProduct(prev => ({ ...prev, description: e.target.value }))} />
                        </div>
                        <div className="w-full xl:w-20 shrink-0">
                          <input type="number" placeholder="Qtd" title="Quantidade Faltante" className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm bg-white" value={newProduct.qty} onChange={e => setNewProduct(prev => ({ ...prev, qty: e.target.value }))} min="1" />
                        </div>
                        
                        {isMissingFocused && filteredProductSuggestions.length > 0 && renderSuggestions(filteredProductSuggestions, (p) => {
                          const event = { target: { value: p.sku } } as React.ChangeEvent<HTMLInputElement>;
                          handleSkuChange(event);
                          setIsMissingFocused(false);
                        })}
                      </div>
                      <div className="w-full xl:w-32 shrink-0">
                        <input type="text" placeholder="V. Base" title="Valor Base" className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm bg-white" 
                          value={newProduct.baseValue} 
                          onChange={e => {
                            const val = formatCurrency(e.target.value);
                            setNewProduct(prev => ({ 
                              ...prev, 
                              baseValue: val,
                              ipi: calculateIpi(val, prev.ipiTax) || prev.ipi
                            }));
                          }} 
                        />
                      </div>
                      <div className="w-full xl:w-20 shrink-0 relative">
                        <input type="text" placeholder="% IPI" title="Alíquota IPI" className="w-full px-4 pr-7 py-2 rounded-xl border border-slate-200 text-sm bg-white" 
                          value={newProduct.ipiTax} 
                          onChange={e => {
                            const val = e.target.value.replace(/[^0-9,.]/g, '');
                            setNewProduct(prev => ({ 
                              ...prev, 
                              ipiTax: val,
                              ipi: calculateIpi(prev.baseValue, val) || prev.ipi
                            }));
                          }} 
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold pointer-events-none">%</span>
                      </div>
                      <div className="w-full xl:w-24 shrink-0">
                        <input type="text" placeholder="IPI" className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm bg-white" value={newProduct.ipi} onChange={e => setNewProduct(prev => ({ ...prev, ipi: formatCurrency(e.target.value) }))} />
                      </div>
                      <div className="w-full xl:w-32 shrink-0">
                        <input type="text" placeholder="ICMS-ST" className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm bg-white" value={newProduct.icmsSt} onChange={e => setNewProduct(prev => ({ ...prev, icmsSt: formatCurrency(e.target.value) }))} />
                      </div>
                      <div className="w-full xl:w-32 shrink-0">
                        <input type="text" placeholder="Frete" className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm bg-white" value={newProduct.freight} onChange={e => setNewProduct(prev => ({ ...prev, freight: formatCurrency(e.target.value) }))} />
                      </div>
                      {!isReadOnly && (
                        <button type="button" onClick={addProduct} className="w-full xl:w-auto shrink-0 flex items-center justify-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-colors text-sm font-bold h-[38px]">
                          <PlusCircle className="w-4 h-4" /> <span className="xl:hidden">Adicionar Produto</span>
                        </button>
                      )}
                    </div>
                    <div className="space-y-2">
                      {formData.missingProducts.map(p => {
                        const productTotal = p.baseValue + (p.ipi || 0) + (p.icmsSt || 0) + (p.freight || 0);
                        return (
                          <div key={p.id} className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex justify-between items-center text-xs">
                            <div className="flex flex-col gap-1">
                              <span className="font-bold">{p.qty}x {p.sku} {p.model ? `(${p.model})` : ''} - {p.description}</span>
                              <span className="text-slate-500">
                                Base: R$ {p.baseValue.toFixed(2)}
                                {p.ipi ? ` | IPI: R$ ${p.ipi.toFixed(2)}` : ''}
                                {p.icmsSt ? ` | ST: R$ ${p.icmsSt.toFixed(2)}` : ''}
                                {p.freight ? ` | Frete: R$ ${p.freight.toFixed(2)}` : ''}
                              </span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="font-bold text-sm text-indigo-700">R$ {productTotal.toFixed(2)}</span>
                               {!isReadOnly && (
                                 <button type="button" onClick={() => setFormData(prev => ({ ...prev, missingProducts: prev.missingProducts?.filter(x => x.id !== p.id) }))} className="text-slate-400 hover:text-rose-500 ml-1">
                                   <Trash2 className="w-4 h-4" />
                                 </button>
                               )}
                             </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {['MERCADORIA_INVERTIDA', 'MERCADORIA_INCORRETA', 'MODELO_INCORRETO'].some(t => visibleSections.includes(t as DivergenceType)) && (
                  <div className="space-y-4 border-t border-slate-100 pt-4 md:col-span-2 xl:col-span-4">
                    <h3 className="text-sm font-bold text-slate-700">Mercadorias Afetadas (O que era para vir vs O que de fato veio)</h3>
                    
                    <div className="flex flex-col gap-2">
                      {/* Linha Faltou */}
                      <div 
                        className="flex flex-col xl:flex-row gap-2 items-stretch xl:items-center bg-rose-50/50 p-3 rounded-xl border border-rose-100 overflow-x-auto custom-scrollbar relative"
                        onFocus={() => setIsInvMissingFocused(true)}
                        onBlur={(e) => {
                          if (!e.currentTarget.contains(e.relatedTarget)) setIsInvMissingFocused(false);
                        }}
                      >
                        <div className="flex items-center gap-2 shrink-0 pr-2 border-r border-rose-200">
                           <span className="font-bold text-rose-700 text-xs w-12 text-center">FALTOU / CORRETO</span>
                        </div>
                        <div className="w-full xl:w-28 shrink-0">
                          <ProductAutocomplete 
                            value={newInvertedProduct.missing.sku} 
                            onChange={e => handleInvertedSkuChange('missing', e)} 
                            onBlur={() => setTimeout(() => setIsInvMissingFocused(false), 200)}
                            onKeyDown={(e) => { if (e.key === 'Tab' || e.key === 'Escape') setIsInvMissingFocused(false); }}
                            suggestions={filteredInvMissingSuggestions} 
                            className="w-full px-3 py-2 rounded-xl border border-rose-200 bg-white text-sm" 
                            disabled={isReadOnly}
                            showSuggestionsInline={false}
                          />
                        </div>
                        <div className="w-full xl:w-28 shrink-0">
                          <input type="text" placeholder="Modelo" title="Modelo do Produto" className="w-full px-3 py-2 rounded-xl border border-rose-200 bg-white text-sm" value={newInvertedProduct.missing.model} onChange={e => setNewInvertedProduct(prev => ({ ...prev, missing: { ...prev.missing, model: e.target.value } }))} />
                        </div>
                        <div className="w-full xl:flex-1 min-w-[150px]">
                          <input type="text" placeholder="Descrição da Falta" className="w-full px-3 py-2 rounded-xl border border-rose-200 bg-white text-sm" value={newInvertedProduct.missing.description} onChange={e => setNewInvertedProduct(prev => ({ ...prev, missing: { ...prev.missing, description: e.target.value } }))} />
                        </div>
                        <div className="w-full xl:w-20 shrink-0">
                          <input type="number" placeholder="Qtd" title="Quantidade Trocada" className="w-full px-3 py-2 rounded-xl border border-rose-200 bg-white text-sm" value={newInvertedProduct.missing.qty} onChange={e => setNewInvertedProduct(prev => ({ ...prev, missing: { ...prev.missing, qty: e.target.value } }))} min="1" />
                        </div>
                        <div className="w-full xl:w-28 shrink-0">
                          <input type="text" placeholder="V. Base" className="w-full px-3 py-2 rounded-xl border border-rose-200 bg-white text-sm" 
                            value={newInvertedProduct.missing.baseValue} 
                            onChange={e => {
                              const val = formatCurrency(e.target.value);
                              setNewInvertedProduct(prev => ({ 
                                ...prev, 
                                missing: { 
                                  ...prev.missing, 
                                  baseValue: val,
                                  ipi: calculateIpi(val, prev.missing.ipiTax) || prev.missing.ipi
                                } 
                              }));
                            }} 
                          />
                        </div>
                        <div className="w-full xl:w-16 shrink-0 relative">
                          <input type="text" placeholder="% IPI" title="Alíquota IPI" className="w-full px-3 pr-6 py-2 rounded-xl border border-rose-200 bg-white text-sm" 
                            value={newInvertedProduct.missing.ipiTax} 
                            onChange={e => {
                              const val = e.target.value.replace(/[^0-9,.]/g, '');
                              setNewInvertedProduct(prev => ({ 
                                ...prev, 
                                missing: { 
                                  ...prev.missing, 
                                  ipiTax: val,
                                  ipi: calculateIpi(prev.missing.baseValue, val) || prev.missing.ipi
                                } 
                              }));
                            }} 
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-rose-400 text-[10px] font-bold pointer-events-none">%</span>
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

                        {isInvMissingFocused && filteredInvMissingSuggestions.length > 0 && renderSuggestions(filteredInvMissingSuggestions, (p) => {
                          const event = { target: { value: p.sku } } as React.ChangeEvent<HTMLInputElement>;
                          handleInvertedSkuChange('missing', event);
                          setIsInvMissingFocused(false);
                        })}
                      </div>
 
                      {/* Linha Veio */}
                      <div 
                        className="flex flex-col xl:flex-row gap-2 items-stretch xl:items-center bg-emerald-50/50 p-3 rounded-xl border border-emerald-100 overflow-x-auto custom-scrollbar relative"
                        onFocus={() => setIsInvReceivedFocused(true)}
                        onBlur={(e) => {
                          if (!e.currentTarget.contains(e.relatedTarget)) setIsInvReceivedFocused(false);
                        }}
                      >
                        <div className="flex items-center gap-2 shrink-0 pr-2 border-r border-emerald-200">
                           <span className="font-bold text-emerald-700 text-[10px] w-12 text-center">VEIO NO LUGAR</span>
                        </div>
                        <div className="w-full xl:w-28 shrink-0">
                          <ProductAutocomplete 
                            value={newInvertedProduct.received.sku} 
                            onChange={e => handleInvertedSkuChange('received', e)} 
                            onBlur={() => setTimeout(() => setIsInvReceivedFocused(false), 200)}
                            onKeyDown={(e) => { if (e.key === 'Tab' || e.key === 'Escape') setIsInvReceivedFocused(false); }}
                            suggestions={filteredInvReceivedSuggestions} 
                            className="w-full px-3 py-2 rounded-xl border border-emerald-200 bg-white text-sm" 
                            disabled={isReadOnly}
                            showSuggestionsInline={false}
                          />
                        </div>
                        <div className="w-full xl:w-28 shrink-0">
                          <input type="text" placeholder="Modelo" title="Modelo do Produto" className="w-full px-3 py-2 rounded-xl border border-emerald-200 bg-white text-sm" value={newInvertedProduct.received.model} onChange={e => setNewInvertedProduct(prev => ({ ...prev, received: { ...prev.received, model: e.target.value } }))} />
                        </div>
                        <div className="w-full xl:flex-1 min-w-[150px]">
                          <input type="text" placeholder="Descrição do que Veio" className="w-full px-3 py-2 rounded-xl border border-emerald-200 bg-white text-sm" value={newInvertedProduct.received.description} onChange={e => setNewInvertedProduct(prev => ({ ...prev, received: { ...prev.received, description: e.target.value } }))} />
                        </div>
                        <div className="w-full xl:w-20 shrink-0">
                          <input type="number" placeholder="Qtd" title="Quantidade Recebida" className="w-full px-3 py-2 rounded-xl border border-emerald-200 bg-white text-sm" value={newInvertedProduct.received.qty} onChange={e => setNewInvertedProduct(prev => ({ ...prev, received: { ...prev.received, qty: e.target.value } }))} min="1" />
                        </div>
                        <div className="w-full xl:w-28 shrink-0">
                          <input type="text" placeholder="V. Base" className="w-full px-3 py-2 rounded-xl border border-emerald-200 bg-white text-sm" 
                            value={newInvertedProduct.received.baseValue} 
                            onChange={e => {
                              const val = formatCurrency(e.target.value);
                              setNewInvertedProduct(prev => ({ 
                                ...prev, 
                                received: { 
                                  ...prev.received, 
                                  baseValue: val,
                                  ipi: calculateIpi(val, prev.received.ipiTax) || prev.received.ipi
                                } 
                              }));
                            }} 
                          />
                        </div>
                        <div className="w-full xl:w-16 shrink-0 relative">
                          <input type="text" placeholder="% IPI" title="Alíquota IPI" className="w-full px-3 pr-6 py-2 rounded-xl border border-emerald-200 bg-white text-sm" 
                            value={newInvertedProduct.received.ipiTax} 
                            onChange={e => {
                              const val = e.target.value.replace(/[^0-9,.]/g, '');
                              setNewInvertedProduct(prev => ({ 
                                ...prev, 
                                received: { 
                                  ...prev.received, 
                                  ipiTax: val,
                                  ipi: calculateIpi(prev.received.baseValue, val) || prev.received.ipi
                                } 
                              }));
                            }} 
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-emerald-400 text-[10px] font-bold pointer-events-none">%</span>
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

                        {isInvReceivedFocused && filteredInvReceivedSuggestions.length > 0 && renderSuggestions(filteredInvReceivedSuggestions, (p) => {
                          const event = { target: { value: p.sku } } as React.ChangeEvent<HTMLInputElement>;
                          handleInvertedSkuChange('received', event);
                          setIsInvReceivedFocused(false);
                        })}
                      </div>


                      {!isReadOnly && (
                        <div className="flex justify-end pt-2">
                          <button type="button" onClick={addInvertedProduct} className="flex items-center justify-center gap-2 px-6 py-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-colors text-sm font-bold">
                            <PlusCircle className="w-4 h-4" /> Adicionar Par de Troca
                          </button>
                        </div>
                      )}
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
                                <span className="text-[10px] font-bold text-rose-700 px-2 py-0.5 bg-rose-100 rounded">
                                  {p.missing.sku ? 'FALTOU' : 'PEDIDO'}
                                </span>
                                <p className="font-bold text-slate-800 flex justify-between">
                                  {p.missing.sku ? (
                                    <>
                                      <span>{p.missing.qty}x {p.missing.sku} {p.missing.model ? `(${p.missing.model})` : ''} - {p.missing.description}</span>
                                      <span className="text-rose-700 text-sm">R$ {mTotal.toFixed(2)}</span>
                                    </>
                                  ) : (
                                    <>
                                      <span className="text-slate-400 italic font-normal">Item não consta no pedido (Extra)</span>
                                      <span className="text-slate-400 text-sm font-normal">R$ 0.00</span>
                                    </>
                                  )}
                                </p>
                                {p.missing.sku && (
                                  <p className="text-[10px] text-slate-500">Base: R$ {p.missing.baseValue.toFixed(2)} | IPI: R$ {(p.missing.ipi || 0).toFixed(2)} | ST: R$ {(p.missing.icmsSt || 0).toFixed(2)} | Frete: R$ {(p.missing.freight || 0).toFixed(2)}</p>
                                )}
                              </div>
                              <div className="space-y-1">
                                <span className="text-[10px] font-bold text-emerald-700 px-2 py-0.5 bg-emerald-100 rounded">VEIO</span>
                                <p className="font-bold text-slate-800 flex justify-between">
                                  <span>{p.received.qty}x {p.received.sku} {p.received.model ? `(${p.received.model})` : ''} - {p.received.description}</span>
                                  <span className="text-emerald-700 text-sm">R$ {rTotal.toFixed(2)}</span>
                                </p>
                                <p className="text-[10px] text-slate-500">Base: R$ {p.received.baseValue.toFixed(2)} | IPI: R$ {(p.received.ipi || 0).toFixed(2)} | ST: R$ {(p.received.icmsSt || 0).toFixed(2)} | Frete: R$ {(p.received.freight || 0).toFixed(2)}</p>
                              </div>
                            </div>
                            <div className="mt-2 pt-3 border-t border-slate-200 flex justify-between items-center text-xs">
                              <span className="font-medium text-slate-600">Diferença de Valores:</span>
                              <div className="flex items-center gap-3">
                                <span className="font-bold text-indigo-700 text-sm">R$ {diff.toFixed(2)}</span>
                                  {!isReadOnly && (
                                    <button type="button" onClick={() => setFormData(prev => ({ ...prev, invertedProducts: prev.invertedProducts?.filter(x => x.id !== p.id) }))} className="text-slate-400 hover:text-rose-500 ml-1">
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {visibleSections.includes('IMPOSTO') && (
                  <div className="space-y-4 border-t border-slate-100 pt-4 md:col-span-2 xl:col-span-4">
                    <h3 className="text-sm font-bold text-slate-700">Diferença de Impostos</h3>
                    <div 
                      className="flex flex-col xl:flex-row gap-3 items-stretch xl:items-center bg-slate-50/50 p-3 rounded-xl border border-slate-100 relative"
                      onFocus={() => setIsTaxFocused(true)}
                      onBlur={(e) => {
                        if (!e.currentTarget.contains(e.relatedTarget)) setIsTaxFocused(false);
                      }}
                    >
                      <div className="w-full xl:w-32 shrink-0">
                        <ProductAutocomplete 
                          value={newTax.sku} 
                          onChange={handleTaxSkuChange} 
                          onBlur={() => setTimeout(() => setIsTaxFocused(false), 200)}
                          onKeyDown={(e) => { if (e.key === 'Tab' || e.key === 'Escape') setIsTaxFocused(false); }}
                          suggestions={filteredTaxSuggestions} 
                          placeholder="SKU (Opcional)" 
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm" 
                          disabled={isReadOnly}
                          showSuggestionsInline={false}
                        />
                      </div>
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
                      {!isReadOnly && (
                        <button type="button" onClick={addTax} className="w-full xl:w-auto shrink-0 flex items-center justify-center gap-2 px-6 py-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-colors text-sm font-bold">
                          <PlusCircle className="w-4 h-4" /> Adicionar
                        </button>
                      )}
                      {isTaxFocused && filteredTaxSuggestions.length > 0 && renderSuggestions(filteredTaxSuggestions, (p) => {
                        const event = { target: { value: p.sku } } as React.ChangeEvent<HTMLInputElement>;
                        handleTaxSkuChange(event);
                        setIsTaxFocused(false);
                      })}
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
                             <Trash2 className="w-4 h-4" />
                           </button>
                         </div>
                       ))}
                    </div>
                  </div>
                )}

                {visibleSections.includes('QUANTIDADE') && (
                  <div className="space-y-4 border-t border-slate-100 pt-4 md:col-span-2 xl:col-span-4">
                    <h3 className="text-sm font-bold text-slate-700">Quantidade Divergente</h3>
                    <div 
                      className="flex flex-col xl:flex-row gap-3 items-stretch xl:items-center bg-slate-50/50 p-3 rounded-xl border border-slate-100 relative"
                      onFocus={() => setIsQtyFocused(true)}
                      onBlur={(e) => {
                        if (!e.currentTarget.contains(e.relatedTarget)) setIsQtyFocused(false);
                      }}
                    >
                      <div className="w-full xl:w-32 shrink-0">
                        <ProductAutocomplete 
                          value={newQuantity.sku} 
                          onChange={handleQuantitySkuChange} 
                          onBlur={() => setTimeout(() => setIsQtyFocused(false), 200)}
                          onKeyDown={(e) => { if (e.key === 'Tab' || e.key === 'Escape') setIsQtyFocused(false); }}
                          suggestions={filteredQtySuggestions} 
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm" 
                          disabled={isReadOnly}
                          showSuggestionsInline={false}
                        />
                      </div>
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
                      {!isReadOnly && (
                        <button type="button" onClick={addQuantity} className="w-full xl:w-auto shrink-0 flex items-center justify-center gap-2 px-6 py-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-colors text-sm font-bold">
                          <PlusCircle className="w-4 h-4" /> Add
                        </button>
                      )}
                      {isQtyFocused && filteredQtySuggestions.length > 0 && renderSuggestions(filteredQtySuggestions, (p) => {
                        const event = { target: { value: p.sku } } as React.ChangeEvent<HTMLInputElement>;
                        handleQuantitySkuChange(event);
                        setIsQtyFocused(false);
                      })}
                    </div>

                    <div className="space-y-3 mt-4">
                      {(formData.quantityDivergences || []).map(q => {
                        const diffQty = q.expectedQty - q.receivedQty;
                        const diffVal = Math.abs(diffQty * q.unitValue);
                        return (
                          <div key={q.id} className="bg-white p-3 rounded-xl border border-slate-200 flex justify-between items-center text-xs shadow-sm">
                            <div className="flex flex-col gap-1">
                               <span className="font-bold">{q.sku} {q.model ? `(${q.model})` : ''} - {q.description}</span>
                              <span className="text-slate-500">
                                NF: {q.expectedQty} | Rec: {q.receivedQty} | Dif: {Math.abs(diffQty)} {diffQty > 0 ? '(Faltou)' : '(Sobrou)'} | V.Un: R$ {q.unitValue.toFixed(2)}
                              </span>
                            </div>
                            <span className="font-bold text-sm text-rose-600">R$ {diffVal.toFixed(2)}</span>
                            <button type="button" onClick={() => setFormData(prev => ({ ...prev, quantityDivergences: prev.quantityDivergences?.filter(x => x.id !== q.id) }))} className="text-slate-400 hover:text-rose-500 ml-2"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {visibleSections.includes('PRECO') && (
                  <div className="space-y-4 border-t border-slate-100 pt-4 md:col-span-2 xl:col-span-4">
                    <h3 className="text-sm font-bold text-slate-700">Preço / Valor Incorreto</h3>
                    <div 
                      className="flex flex-col xl:flex-row gap-3 items-stretch xl:items-center bg-slate-50/50 p-3 rounded-xl border border-slate-100 relative"
                      onFocus={() => setIsPriceFocused(true)}
                      onBlur={(e) => {
                        if (!e.currentTarget.contains(e.relatedTarget)) setIsPriceFocused(false);
                      }}
                    >
                      <div className="w-full xl:w-32 shrink-0">
                        <ProductAutocomplete 
                          value={newPrice.sku} 
                          onChange={handlePriceSkuChange} 
                          onBlur={() => setTimeout(() => setIsPriceFocused(false), 200)}
                          onKeyDown={(e) => { if (e.key === 'Tab' || e.key === 'Escape') setIsPriceFocused(false); }}
                          suggestions={filteredPriceSuggestions} 
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm" 
                          disabled={isReadOnly}
                          showSuggestionsInline={false}
                        />
                      </div>
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
                      {!isReadOnly && (
                        <button type="button" onClick={addPrice} className="w-full xl:w-auto shrink-0 flex items-center justify-center gap-2 px-6 py-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-colors text-sm font-bold">
                          <PlusCircle className="w-4 h-4" /> Add
                        </button>
                      )}
                      {isPriceFocused && filteredPriceSuggestions.length > 0 && renderSuggestions(filteredPriceSuggestions, (p) => {
                        const event = { target: { value: p.sku } } as React.ChangeEvent<HTMLInputElement>;
                        handlePriceSkuChange(event);
                        setIsPriceFocused(false);
                      })}
                    </div>

                    <div className="space-y-3 mt-4">
                      {(formData.priceDivergences || []).map(p => {
                        const diffVal = Math.abs((p.invoicedPrice - p.expectedPrice) * p.qty);
                        return (
                          <div key={p.id} className="bg-white p-3 rounded-xl border border-slate-200 flex justify-between items-center text-xs shadow-sm">
                            <div className="flex flex-col gap-1">
                               <span className="font-bold">{p.sku} {p.model ? `(${p.model})` : ''} - {p.description} <span className="text-slate-400 font-normal">({p.qty} un)</span></span>
                              <span className="text-slate-500">
                                Preço Pedido: R$ {p.expectedPrice.toFixed(2)} | Preço NF: R$ {p.invoicedPrice.toFixed(2)}
                              </span>
                            </div>
                            <span className="font-bold text-sm text-indigo-600">R$ {diffVal.toFixed(2)} (Diferença)</span>
                            <button type="button" onClick={() => setFormData(prev => ({ ...prev, priceDivergences: prev.priceDivergences?.filter(x => x.id !== p.id) }))} className="text-slate-400 hover:text-rose-500 ml-2"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {visibleSections.includes('CNPJ_INCORRETO') && (
                  <div className="space-y-4 border-t border-slate-100 pt-4 md:col-span-2 xl:col-span-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <h3 className="md:col-span-2 text-sm font-bold text-slate-700">CNPJ Incorreto na NF</h3>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">CNPJ Correto (Pedido / Destino)</label>
                      <input type="text" placeholder="Ex: 00.000.000/0001-00" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:ring-2 focus:ring-indigo-200 transition-colors" value={formData.cnpjDivergence?.expectedCnpj || ''} onChange={e => setFormData(prev => ({ ...prev, cnpjDivergence: { ...prev.cnpjDivergence, expectedCnpj: e.target.value } as CnpjDivergence }))} />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">CNPJ Incorreto (Emitido na NF)</label>
                      <input type="text" placeholder="Ex: 00.000.000/0002-11" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:ring-2 focus:ring-indigo-200 transition-colors" value={formData.cnpjDivergence?.invoicedCnpj || ''} onChange={e => setFormData(prev => ({ ...prev, cnpjDivergence: { ...prev.cnpjDivergence, invoicedCnpj: e.target.value } as CnpjDivergence }))} />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex items-center justify-between ml-1 h-6">
                    <label className="text-sm font-bold text-slate-700">Valor Total da Divergência</label>
                  </div>
                  <input
                    required
                    readOnly={isAutoCalculated}
                    type="text"
                    placeholder="R$ 0,00"
                    className={`w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all outline-none text-slate-700 ${isAutoCalculated ? 'bg-slate-50 cursor-not-allowed text-indigo-800 font-bold' : ''}`}
                    value={formData.value}
                    onChange={handleValueChange}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between ml-1 h-6">
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
                  disabled={isReadOnly}
                  placeholder="Descreva o que aconteceu..."
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all outline-none text-slate-700 resize-none disabled:bg-slate-50 disabled:text-slate-500"
                  value={formData.description}
                  onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>

                <div className="space-y-4 md:col-span-2 xl:col-span-4 border-t border-slate-100 pt-4">
                  <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <Paperclip className="w-4 h-4 text-indigo-500" /> Anexos do Card
                  </h3>
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center bg-slate-50/50 p-4 rounded-xl border border-slate-200">
                      <div className="flex-1 space-y-3">
                        <div className="flex flex-col sm:flex-row gap-3">
                          <input 
                            type="text" 
                            placeholder="Nome do Anexo (ex: NF, Foto...)" 
                            className="flex-1 px-4 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:ring-2 focus:ring-indigo-200 outline-none transition-all" 
                            value={newAttachment.name} 
                            onChange={e => setNewAttachment(prev => ({ ...prev, name: e.target.value }))} 
                          />
                          <div className="relative flex-1">
                            <input
                              type="file"
                              ref={fileInputRef}
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file && !newAttachment.name) {
                                  setNewAttachment(prev => ({ ...prev, name: file.name.split('.')[0] }));
                                }
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              className="w-full flex items-center justify-between px-4 py-2 rounded-xl border border-slate-200 text-sm bg-white hover:bg-slate-50 transition-colors text-slate-600 truncate"
                            >
                              <span className="truncate">{fileInputRef.current?.files?.[0]?.name || "Selecionar Arquivo..."}</span>
                              <Upload className="w-4 h-4 shrink-0 ml-2 text-indigo-500" />
                            </button>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 font-medium px-1">
                          <div className="h-px flex-1 bg-slate-200"></div>
                          <span>OU USE UM LINK EXTERNO</span>
                          <div className="h-px flex-1 bg-slate-200"></div>
                        </div>

                        <input 
                          type="url" 
                          placeholder="Link do Arquivo (Google Drive, OneDrive...)" 
                          className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:ring-2 focus:ring-indigo-200 outline-none transition-all" 
                          value={newAttachment.url} 
                          onChange={e => setNewAttachment(prev => ({ ...prev, url: e.target.value }))} 
                        />
                      </div>

                      {!isReadOnly && (
                        <button 
                          type="button" 
                          disabled={isUploading}
                          onClick={addAttachment} 
                          className="sm:self-end shrink-0 flex items-center justify-center gap-2 px-8 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:bg-indigo-300 transition-all text-sm font-bold shadow-lg shadow-indigo-100 min-w-[140px]"
                        >
                          {isUploading ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" /> Subindo...
                            </>
                          ) : (
                            <>
                              <PlusCircle className="w-4 h-4" /> Adicionar
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                     {(formData.attachments || []).map(a => (
                       <div key={a.id} className="bg-white pl-3 pr-1 py-1.5 rounded-xl border border-slate-200 flex items-center gap-2 shadow-sm group hover:border-indigo-200 transition-all">
                         <a href={a.url.startsWith('http') ? a.url : `https://${a.url}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-indigo-600 transition-colors">
                           <Paperclip className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600" />
                           <span className="font-bold text-slate-700 text-xs truncate max-w-[150px] group-hover:text-indigo-700">{a.name}</span>
                         </a>
                         {!isReadOnly && (
                           <button type="button" onClick={(e) => { e.preventDefault(); deleteAttachmentFile(a.url); setFormData(prev => ({ ...prev, attachments: (prev.attachments || []).filter(att => att.id !== a.id) })) }} className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-colors ml-1">
                             <Trash2 className="w-3.5 h-3.5" />
                           </button>
                         )}
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
