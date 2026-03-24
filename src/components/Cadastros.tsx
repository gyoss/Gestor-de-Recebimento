import React, { useState, useEffect, useRef } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { Product, Supplier, Buyer } from '../types';
import { Plus, Trash2, Edit2, Upload, Database, Package, Users, Building2, Search, RefreshCw, ChevronUp, ChevronDown, ChevronsUpDown, FileSpreadsheet, AlertTriangle, Check, ShieldCheck, Zap } from 'lucide-react';
import * as XLSX from 'xlsx';
import { cn } from '../lib/utils';
import { DeleteDialog } from './DeleteDialog';

export const Cadastros = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<'products' | 'suppliers' | 'buyers'>('products');
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [loading, setLoading] = useState(true);

  const [newProduct, setNewProduct] = useState<Partial<Product>>({});
  const [newSupplier, setNewSupplier] = useState<Partial<Supplier>>({});
  const [newBuyer, setNewBuyer] = useState<Partial<Buyer>>({});
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);
  const [editingBuyerId, setEditingBuyerId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string, type: 'products' | 'suppliers' | 'buyers' } | null>(null);
  const [importing, setImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<{
    type: 'products' | 'suppliers' | 'buyers';
    data: any[];
    stats: {
      new: number;
      updates: number;
      conflicts: number;
    };
  } | null>(null);
  const [importMode, setImportMode] = useState<'all' | 'safe' | 'new_only'>('safe');

  const [productSearch, setProductSearch] = useState('');
  const [supplierSearch, setSupplierSearch] = useState('');
  const [buyerSearch, setBuyerSearch] = useState('');

  const [productSort, setProductSort] = useState<{ key: keyof Product; direction: 'asc' | 'desc' } | null>(null);
  const [supplierSort, setSupplierSort] = useState<{ key: keyof Supplier; direction: 'asc' | 'desc' } | null>(null);
  const [buyerSort, setBuyerSort] = useState<{ key: keyof Buyer; direction: 'asc' | 'desc' } | null>(null);

  const [productPage, setProductPage] = useState(1);
  const [supplierPage, setSupplierPage] = useState(1);
  const [buyerPage, setBuyerPage] = useState(1);
  const itemsPerPage = 50;

  const handleSort = <T,>(key: keyof T, currentSort: { key: keyof T; direction: 'asc' | 'desc' } | null, setSort: React.Dispatch<React.SetStateAction<{ key: keyof T; direction: 'asc' | 'desc' } | null>>) => {
    if (currentSort?.key === key) {
      if (currentSort.direction === 'asc') {
        setSort({ key, direction: 'desc' });
      } else {
        setSort(null);
      }
    } else {
      setSort({ key, direction: 'asc' });
    }
  };

  const SortIcon = ({ column, currentSort }: { column: string, currentSort: { key: string; direction: 'asc' | 'desc' } | null }) => {
    if (currentSort?.key !== column) return <ChevronsUpDown className="w-3 h-3 text-slate-300" />;
    return currentSort.direction === 'asc' ? <ChevronUp className="w-3 h-3 text-indigo-600" /> : <ChevronDown className="w-3 h-3 text-indigo-600" />;
  };

  const sortData = <T,>(data: T[], sort: { key: keyof T; direction: 'asc' | 'desc' } | null): T[] => {
    if (!sort) return data;
    const { key, direction } = sort;
    return [...data].sort((a, b) => {
      const aVal = String(a[key] || '').toLowerCase();
      const bVal = String(b[key] || '').toLowerCase();
      if (aVal < bVal) return direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return direction === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteDoc(doc(db, deleteTarget.type, deleteTarget.id));
      loadData();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, deleteTarget.type);
    } finally {
      setDeleteTarget(null);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [prodSnap, suppSnap, buySnap] = await Promise.all([
        getDocs(collection(db, 'products')),
        getDocs(collection(db, 'suppliers')),
        getDocs(collection(db, 'buyers'))
      ]);

      setProducts(prodSnap.docs.map(d => ({ id: d.id, ...d.data() } as Product)));
      setSuppliers(suppSnap.docs.map(d => ({ id: d.id, ...d.data() } as Supplier)));
      setBuyers(buySnap.docs.map(d => ({ id: d.id, ...d.data() } as Buyer)));
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'cadastros');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProduct.sku || !newProduct.description) return;
    
    let finalBuyerName = newProduct.buyerName || '';
    if (!finalBuyerName && newProduct.brand) {
      const brandLower = newProduct.brand.toLowerCase().trim();
      const matchedSupplier = suppliers.find(s => s.brand && s.brand.toLowerCase().trim() === brandLower);
      if (matchedSupplier && matchedSupplier.defaultBuyer) {
        finalBuyerName = matchedSupplier.defaultBuyer;
      }
    }
    
    const productToSave = { ...newProduct, buyerName: finalBuyerName };

    try {
      if (editingProductId) {
        await updateDoc(doc(db, 'products', editingProductId), productToSave);
        setEditingProductId(null);
      } else {
        await addDoc(collection(db, 'products'), productToSave);
      }
      setNewProduct({});
      loadData();
    } catch (error) {
      handleFirestoreError(error, editingProductId ? OperationType.UPDATE : OperationType.CREATE, 'products');
    }
  };

  const handleEditProduct = (p: Product) => {
    setNewProduct(p);
    setEditingProductId(p.id);
    containerRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleCancelEditProduct = () => {
    setNewProduct({});
    setEditingProductId(null);
  };

  const handleDeleteProduct = (id: string) => setDeleteTarget({ id, type: 'products' });

  const handleAddSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSupplier.name) return;
    try {
      if (editingSupplierId) {
        await updateDoc(doc(db, 'suppliers', editingSupplierId), newSupplier);
        setEditingSupplierId(null);
      } else {
        await addDoc(collection(db, 'suppliers'), newSupplier);
      }
      setNewSupplier({});
      loadData();
    } catch (error) {
      handleFirestoreError(error, editingSupplierId ? OperationType.UPDATE : OperationType.CREATE, 'suppliers');
    }
  };

  const handleEditSupplier = (s: Supplier) => {
    setNewSupplier(s);
    setEditingSupplierId(s.id);
    containerRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleCancelEditSupplier = () => {
    setNewSupplier({});
    setEditingSupplierId(null);
  };

  const handleDeleteSupplier = (id: string) => setDeleteTarget({ id, type: 'suppliers' });

  const handleAddBuyer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBuyer.name) return;
    try {
      if (editingBuyerId) {
        await updateDoc(doc(db, 'buyers', editingBuyerId), newBuyer);
        setEditingBuyerId(null);
      } else {
        await addDoc(collection(db, 'buyers'), newBuyer);
      }
      setNewBuyer({});
      loadData();
    } catch (error) {
      handleFirestoreError(error, editingBuyerId ? OperationType.UPDATE : OperationType.CREATE, 'buyers');
    }
  };

  const handleEditBuyer = (b: Buyer) => {
    setNewBuyer(b);
    setEditingBuyerId(b.id);
    containerRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleCancelEditBuyer = () => {
    setNewBuyer({});
    setEditingBuyerId(null);
  };

  const handleDeleteBuyer = (id: string) => setDeleteTarget({ id, type: 'buyers' });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'products' | 'suppliers' | 'buyers') => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportSuccess(null);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);

      let importCount = 0;
      try {
        const getVal = (row: any, ...keys: string[]) => {
          const rowKeys = Object.keys(row);
          for (const k of keys) {
            const found = rowKeys.find(rk => rk.toLowerCase().trim() === k.toLowerCase().trim());
            if (found) return row[found];
          }
          return '';
        };

        const stats = { new: 0, updates: 0, conflicts: 0 };
        const rows = data as any[];
        const processedRows: any[] = [];

        if (type === 'products') {
          const [existingSnap, suppliersSnap] = await Promise.all([
            getDocs(collection(db, 'products')),
            getDocs(collection(db, 'suppliers'))
          ]);
          const existingMap = new Map();
          existingSnap.docs.forEach(d => {
            if (d.data().sku) existingMap.set(String(d.data().sku).trim(), d.data());
          });
          const brandToBuyerMap = new Map();
          suppliersSnap.docs.forEach(d => {
            const s = d.data();
            if (s.brand && s.defaultBuyer) brandToBuyerMap.set(String(s.brand).toLowerCase().trim(), s.defaultBuyer);
          });

          for (const rawRow of rows) {
            const skuVal = String(getVal(rawRow, 'sku', 'SKU', 'Id Subproduto', 'idsubproduto', 'sku_venda', 'Código')).trim();
            const descVal = String(getVal(rawRow, 'description', 'descrição', 'descricaoproduto', 'produto', 'nome')).trim();
            if (skuVal && descVal) {
              const brandVal = String(getVal(rawRow, 'brand', 'marca', 'fabricante', 'fornecedor')).trim();
              let buyerVal = String(getVal(rawRow, 'buyerName', 'comprador', 'colaborador')).trim();
              if (!buyerVal && brandVal) {
                const mappedBuyer = brandToBuyerMap.get(brandVal.toLowerCase());
                if (mappedBuyer) buyerVal = mappedBuyer;
              }

              const incoming = { sku: skuVal, description: descVal, brand: brandVal, model: String(getVal(rawRow, 'model', 'modelo', 'modelo do produto')).trim(), buyerName: buyerVal };
              const existing = existingMap.get(skuVal);

              if (!existing) {
                stats.new++;
              } else {
                let conflict = false;
                // If brand/buyer/description differs and sheet has a value, mark as conflict
                if ((incoming.description && existing.description && incoming.description !== existing.description) ||
                    (incoming.brand && existing.brand && incoming.brand !== existing.brand) ||
                    (incoming.buyerName && existing.buyerName && incoming.buyerName !== existing.buyerName)) {
                  conflict = true;
                }
                if (conflict) stats.conflicts++;
                else stats.updates++;
              }
              processedRows.push(incoming);
            }
          }
        } else if (type === 'suppliers') {
          const existingSnap = await getDocs(collection(db, 'suppliers'));
          const existingMap = new Map();
          existingSnap.docs.forEach(d => {
            const s = d.data();
            if (s.name) existingMap.set('name_' + String(s.name).toLowerCase().trim(), s);
            if (s.cnpj) {
              const clean = String(s.cnpj).replace(/\D/g, '');
              if (clean) existingMap.set('cnpj_' + clean, s);
            }
            if (s.internalCode) existingMap.set('code_' + String(s.internalCode).trim(), s);
          });

          for (const rawRow of rows) {
            const supplierName = getVal(rawRow, 'name', 'nome', 'fornecedor', 'marca');
            if (supplierName) {
              const nameVal = String(supplierName).trim();
              const cnpjVal = String(getVal(rawRow, 'cnpj', 'CNPJ')).trim();
              const cleanCnpj = cnpjVal.replace(/\D/g, '');
              const codeVal = String(getVal(rawRow, 'internalCode', 'código interno', 'cód. forn', 'código')).trim();

              const incoming = {
                name: nameVal, cnpj: cnpjVal, internalCode: codeVal,
                brand: String(getVal(rawRow, 'brand', 'marca')).trim(),
                defaultBuyer: String(getVal(rawRow, 'defaultBuyer', 'comprador padrão', 'comprador')).trim(),
                representative: String(getVal(rawRow, 'representative', 'representante', 'contato')).trim(),
                email: String(getVal(rawRow, 'email', 'e-mail', 'email')).trim(),
                phone: String(getVal(rawRow, 'phone', 'telefone', 'tel')).trim(),
                whatsapp: String(getVal(rawRow, 'whatsapp', 'whats', 'wpp')).trim()
              };

              const nameKey = 'name_' + nameVal.toLowerCase();
              const cnpjKey = cleanCnpj ? 'cnpj_' + cleanCnpj : null;
              const codeKey = codeVal ? 'code_' + codeVal : null;
              const existing = existingMap.get(nameKey) || (cnpjKey && existingMap.get(cnpjKey)) || (codeKey && existingMap.get(codeKey));

              if (!existing) stats.new++;
              else {
                let conflict = false;
                if ((incoming.cnpj && existing.cnpj && incoming.cnpj !== existing.cnpj) ||
                    (incoming.brand && existing.brand && incoming.brand !== existing.brand)) {
                  conflict = true;
                }
                if (conflict) stats.conflicts++;
                else stats.updates++;
              }
              processedRows.push(incoming);
            }
          }
        } else if (type === 'buyers') {
          const existingSnap = await getDocs(collection(db, 'buyers'));
          const existingMap = new Map();
          existingSnap.docs.forEach(d => {
            if (d.data().name) existingMap.set(String(d.data().name).toLowerCase().trim(), d.data());
          });

          for (const rawRow of rows) {
            const nameValue = getVal(rawRow, 'name', 'nome', 'colaborador', 'comprador');
            if (nameValue) {
              const nameVal = String(nameValue).trim();
              const incoming = {
                name: nameVal,
                email: String(getVal(rawRow, 'email', 'e-mail', 'email')),
                department: String(getVal(rawRow, 'department', 'departamento', 'setor')),
                username: String(getVal(rawRow, 'username', 'usuário', 'login', 'user')),
                password: String(getVal(rawRow, 'password', 'senha', 'pass', 'password')),
                role: String(getVal(rawRow, 'role', 'perfil', 'cargo')).toLowerCase()
              };
              const existing = existingMap.get(nameVal.toLowerCase());
              if (!existing) stats.new++;
              else {
                if (incoming.department && existing.department && incoming.department !== existing.department) stats.conflicts++;
                else stats.updates++;
              }
              processedRows.push(incoming);
            }
          }
        }

        setImportPreview({ type, data: processedRows, stats });
      } catch (error) {
        console.error("Error analyzing data:", error);
        alert('Erro ao analisar dados. Verifique o console.');
      } finally {
        setImporting(false);
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = ''; // reset
  };

  const processImport = async (mode: 'all' | 'safe' | 'new_only') => {
    if (!importPreview) return;
    setImporting(true);
    const { type, data } = importPreview;
    let count = 0;
    
    try {
      const batchSize = 500;
      const snap = await getDocs(collection(db, type));
      const existingDocs = new Map();
      snap.docs.forEach(d => {
        const docData = d.data();
        const obj = { id: d.id, ...docData };
        if (type === 'products' && docData.sku) existingDocs.set(String(docData.sku).trim(), obj);
        else if (type === 'suppliers') {
            if (docData.name) existingDocs.set('name_' + String(docData.name).toLowerCase().trim(), obj);
            if (docData.cnpj) {
              const clean = String(docData.cnpj).replace(/\D/g, '');
              if (clean) existingDocs.set('cnpj_' + clean, obj);
            }
            if (docData.internalCode) existingDocs.set('code_' + String(docData.internalCode).trim(), obj);
        }
        else if (type === 'buyers' && docData.name) existingDocs.set(String(docData.name).toLowerCase().trim(), obj);
      });

      for (let i = 0; i < data.length; i += batchSize) {
        const chunk = data.slice(i, i + batchSize);
        const batch = writeBatch(db);

        for (const incoming of chunk) {
          let existing = null;
          if (type === 'products') existing = existingDocs.get(incoming.sku);
          else if (type === 'suppliers') {
             const cleanCnpj = incoming.cnpj ? incoming.cnpj.replace(/\D/g, '') : null;
             existing = existingDocs.get('name_' + incoming.name.toLowerCase()) || 
                        (cleanCnpj && existingDocs.get('cnpj_' + cleanCnpj)) ||
                        (incoming.internalCode && existingDocs.get('code_' + incoming.internalCode));
          } else {
             existing = existingDocs.get(incoming.name.toLowerCase());
          }

          if (existing) {
            if (mode === 'new_only') continue;
            
            let coreData = { ...incoming };
            if (mode === 'safe') {
              const updateData: any = {};
              let hasNewData = false;
              for (const key in incoming) {
                const existingVal = String(existing[key] || '').trim();
                // Consider empty if it's falsy, dash, or string 'undefined'
                if (!existingVal || existingVal === '-' || existingVal === 'undefined') {
                   updateData[key] = incoming[key];
                   if (incoming[key]) hasNewData = true;
                }
              }
              if (!hasNewData) continue;
              coreData = updateData;
            }
            batch.update(doc(db, type, existing.id), coreData);
          } else {
            batch.set(doc(collection(db, type)), incoming);
          }
          count++;
        }
        await batch.commit();
      }
      
      const modeText = mode === 'all' ? 'Sobrescrever Tudo' : mode === 'safe' ? 'Apenas Campos Vazios' : 'Apenas Novos';
      setImportSuccess(`${count} registros processados (${modeText})`);
      setImportPreview(null);
      loadData();
      setTimeout(() => setImportSuccess(null), 5000);
    } catch (error) {
      console.error("Error processing import:", error);
      alert("Erro ao processar importação.");
    } finally {
      setImporting(false);
    }
  };

  const Pagination = ({ 
    currentPage, 
    totalItems, 
    onPageChange 
  }: { 
    currentPage: number; 
    totalItems: number; 
    onPageChange: (page: number) => void 
  }) => {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    if (totalPages <= 1) return null;

    return (
      <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
        <div className="text-xs text-slate-500 font-medium">
          Mostrando <span className="text-slate-900">{((currentPage - 1) * itemsPerPage) + 1}</span> a <span className="text-slate-900">{Math.min(currentPage * itemsPerPage, totalItems)}</span> de <span className="text-slate-900">{totalItems}</span> resultados
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Anterior
          </button>
          <div className="px-3 py-1.5 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-lg">
            {currentPage} / {totalPages}
          </div>
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Próximo
          </button>
        </div>
      </div>
    );
  };

  const ImportPreviewModal = () => {
    if (!importPreview) return null;

    const { type, stats } = importPreview;
    const entityName = type === 'products' ? 'Produtos' : type === 'suppliers' ? 'Fornecedores' : 'Colaboradores';

    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 text-left">
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 relative">
          {importing && (
            <div className="absolute inset-0 bg-white/80 backdrop-blur-[2px] z-10 flex flex-col items-center justify-center gap-4">
              <RefreshCw className="w-10 h-10 text-indigo-600 animate-spin" />
              <div className="text-sm font-bold text-slate-700">Processando Importação...</div>
              <div className="text-xs text-slate-500">Isto pode levar alguns segundos para bases grandes.</div>
            </div>
          )}

          <div className="p-6 border-b border-slate-100 bg-slate-50">
            <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <FileSpreadsheet className="w-6 h-6 text-indigo-600" />
              Resumo da Importação
            </h3>
            <p className="text-sm text-slate-500 mt-1">Analisamos sua planilha de {entityName}.</p>
          </div>
          
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 gap-3">
              <div className="flex items-center justify-between p-3 bg-indigo-50 rounded-xl border border-indigo-100">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-600 text-white rounded-lg"><Plus className="w-4 h-4" /></div>
                  <span className="font-semibold text-slate-700">Novos Registros</span>
                </div>
                <span className="text-xl font-bold text-indigo-600">{stats.new}</span>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-600 text-white rounded-lg"><Check className="w-4 h-4" /></div>
                  <span className="font-semibold text-slate-700">Completar Dados</span>
                </div>
                <span className="text-xl font-bold text-emerald-600">{stats.updates}</span>
              </div>

              {stats.conflicts > 0 && (
                <div className="flex items-center justify-between p-3 bg-amber-50 rounded-xl border border-amber-100">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-500 text-white rounded-lg"><AlertTriangle className="w-4 h-4" /></div>
                    <span className="font-semibold text-slate-700">Conflitos Detectados</span>
                  </div>
                  <span className="text-xl font-bold text-amber-600">{stats.conflicts}</span>
                </div>
              )}
            </div>

            <div className="space-y-3 pt-2">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Escolha como importar:</p>
              
              <button 
                onClick={() => setImportMode('safe')}
                className={cn(
                  "w-full p-4 border-2 rounded-xl transition-all text-left flex items-start gap-3 group",
                  importMode === 'safe' ? "border-indigo-600 bg-indigo-50" : "border-slate-200 bg-white hover:border-indigo-600 hover:bg-slate-50"
                )}
              >
                <div className={cn("p-2 rounded-lg", importMode === 'safe' ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600")}>
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-slate-900">Modo Seguro (Recomendado)</div>
                  <div className="text-xs text-slate-500">Preenche apenas campos vazios no sistema. Não altera o que você já editou.</div>
                </div>
              </button>

              <button 
                onClick={() => setImportMode('all')}
                className={cn(
                  "w-full p-4 border-2 rounded-xl transition-all text-left flex items-start gap-3 group",
                  importMode === 'all' ? "border-rose-600 bg-rose-50" : "border-slate-200 bg-white hover:border-rose-600 hover:bg-slate-50"
                )}
              >
                <div className={cn("p-2 rounded-lg", importMode === 'all' ? "bg-rose-600 text-white" : "bg-slate-100 text-slate-600")}>
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-slate-900">Sobrescrever Tudo</div>
                  <div className="text-xs text-slate-500">A planilha manda em tudo. Substitui qualquer dado manual no sistema.</div>
                </div>
              </button>

              <button 
                onClick={() => setImportMode('new_only')}
                className={cn(
                  "w-full p-3 border rounded-xl transition-all font-medium text-sm flex items-center justify-center gap-2",
                  importMode === 'new_only' ? "bg-slate-900 text-white border-slate-900" : "bg-slate-100 text-slate-700 border-transparent hover:bg-slate-200"
                )}
              >
                Importar apenas novos itens ({stats.new})
              </button>
            </div>
          </div>
          
          <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
            <button 
              onClick={() => setImportPreview(null)}
              className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-700 transition-colors"
            >
              Cancelar
            </button>
            <button 
              onClick={() => processImport(importMode)}
              className="flex-1 px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2"
            >
              Confirmar Importação
            </button>
          </div>
        </div>
      </div>
    );
  };

  useEffect(() => {
    setProductPage(1);
  }, [productSearch]);

  useEffect(() => {
    setSupplierPage(1);
  }, [supplierSearch]);

  useEffect(() => {
    setBuyerPage(1);
  }, [buyerSearch]);

  const handleRefreshBuyerNames = async () => {
    setImporting(true);
    let updateCount = 0;
    try {
      const brandToBuyerMap = new Map();
      suppliers.forEach(s => {
        if (s.brand && s.defaultBuyer) {
          brandToBuyerMap.set(s.brand.toLowerCase().trim(), s.defaultBuyer);
        }
      });

      for (const p of products) {
        if (p.brand) {
          const brandLower = p.brand.toLowerCase().trim();
          const matchedBuyer = brandToBuyerMap.get(brandLower);
          if (matchedBuyer && p.buyerName !== matchedBuyer) {
            await updateDoc(doc(db, 'products', p.id), { buyerName: matchedBuyer });
            updateCount++;
          }
        }
      }
      setImportSuccess(`${updateCount} produtos atualizados com novos compradores!`);
      loadData();
      setTimeout(() => setImportSuccess(null), 5000);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'products_refresh');
    } finally {
      setImporting(false);
    }
  };

  const handleClearAll = async (collectionName: 'products' | 'suppliers' | 'buyers') => {
    if (!window.confirm(`Tem certeza absoluta que deseja excluir TODOS os ${collectionName === 'products' ? 'produtos' : collectionName === 'suppliers' ? 'fornecedores' : 'colaboradores'}? Esta ação não tem volta!`)) return;
    
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, collectionName));
      const deletePromises = snap.docs.map(d => deleteDoc(doc(db, collectionName, d.id)));
      await Promise.all(deletePromises);
      alert('Todos os registros foram excluídos com sucesso!');
      await loadData();
    } catch (error) {
      console.error("Error clearing all", error);
      alert('Erro ao limpar os dados.');
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts: Product[] = sortData<Product>(products.filter(p => 
    p.sku.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.description.toLowerCase().includes(productSearch.toLowerCase()) ||
    (p.brand && p.brand.toLowerCase().includes(productSearch.toLowerCase())) ||
    (p.buyerName && p.buyerName.toLowerCase().includes(productSearch.toLowerCase()))
  ), productSort);

  const filteredSuppliers: Supplier[] = sortData<Supplier>(suppliers.filter(s =>
    s.name.toLowerCase().includes(supplierSearch.toLowerCase()) ||
    (s.cnpj && s.cnpj.toLowerCase().includes(supplierSearch.toLowerCase())) ||
    (s.internalCode && s.internalCode.toLowerCase().includes(supplierSearch.toLowerCase())) ||
    (s.brand && s.brand.toLowerCase().includes(supplierSearch.toLowerCase()))
  ), supplierSort);

  const filteredBuyers: Buyer[] = sortData<Buyer>(buyers.filter(b =>
    b.name.toLowerCase().includes(buyerSearch.toLowerCase()) ||
    (b.department && b.department.toLowerCase().includes(buyerSearch.toLowerCase()))
  ), buyerSort);

  const paginatedProducts = filteredProducts.slice((productPage - 1) * itemsPerPage, productPage * itemsPerPage);
  const paginatedSuppliers = filteredSuppliers.slice((supplierPage - 1) * itemsPerPage, supplierPage * itemsPerPage);
  const paginatedBuyers = filteredBuyers.slice((buyerPage - 1) * itemsPerPage, buyerPage * itemsPerPage);

  if (loading) {
    return <div className="p-6 flex justify-center items-center h-[200px]"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>;
  }

  return (
    <div ref={containerRef} className="p-6 max-w-7xl mx-auto space-y-6 relative">
      {importing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/60 backdrop-blur-[2px]">
          <div className="bg-white p-6 rounded-2xl shadow-xl border border-slate-200 flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
            <p className="font-medium text-slate-700">Importando dados, por favor aguarde...</p>
          </div>
        </div>
      )}

      {importSuccess && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-5">
          <div className="bg-emerald-600 text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-3">
            <div className="bg-white/20 p-1 rounded-full">
              <Plus className="w-4 h-4" />
            </div>
            <span className="font-medium">{importSuccess}</span>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Base de Dados</h1>
            <p className="text-sm text-slate-500">Gerencie produtos, fornecedores e usuários do sistema</p>
          </div>
        </div>
      </div>

      <div className="flex gap-4 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('products')}
          className={cn("pb-3 px-2 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors", activeTab === 'products' ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-700")}
        >
          <Package className="w-4 h-4" /> Produtos
          <span className={cn(
            "ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold",
            activeTab === 'products' ? "bg-indigo-100 text-indigo-600" : "bg-slate-100 text-slate-500"
          )}>
            {products.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('suppliers')}
          className={cn("pb-3 px-2 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors", activeTab === 'suppliers' ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-700")}
        >
          <Building2 className="w-4 h-4" /> Fornecedores
          <span className={cn(
            "ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold",
            activeTab === 'suppliers' ? "bg-indigo-100 text-indigo-600" : "bg-slate-100 text-slate-500"
          )}>
            {suppliers.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('buyers')}
          className={cn("pb-3 px-2 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors", activeTab === 'buyers' ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-700")}
        >
          <Users className="w-4 h-4" /> Usuários / Colaboradores
          <span className={cn(
            "ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold",
            activeTab === 'buyers' ? "bg-indigo-100 text-indigo-600" : "bg-slate-100 text-slate-500"
          )}>
            {buyers.length}
          </span>
        </button>
      </div>

      {activeTab === 'products' && (
        <div className="space-y-6">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <h2 className="font-bold text-slate-700">Adicionar Produto</h2>
              <div className="flex items-center gap-2">
                <button onClick={handleRefreshBuyerNames} className="bg-amber-50 text-amber-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-100 flex items-center gap-2" title="Atualiza o comprador padrão dos produtos com base na marca cadastrada nos fornecedores">
                  <RefreshCw className="w-4 h-4" /> Atualizar Compradores
                </button>
                <button onClick={() => handleClearAll('products')} className="bg-rose-50 text-rose-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-rose-100 flex items-center gap-2">
                  <Trash2 className="w-4 h-4" /> Limpar Tudo
                </button>
                <label className="cursor-pointer bg-slate-100 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-200 flex items-center gap-2">
                  <Upload className="w-4 h-4" /> Importar Excel
                  <input type="file" accept=".xlsx, .xls, .csv" className="hidden" onChange={(e) => handleFileUpload(e, 'products')} />
                </label>
              </div>
            </div>
            <form onSubmit={handleAddProduct} className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              <input type="text" placeholder="SKU *" required className="px-3 py-2 border rounded-lg text-sm" value={newProduct.sku || ''} onChange={e => setNewProduct({...newProduct, sku: e.target.value})} />
              <input type="text" placeholder="Descrição *" required className="px-3 py-2 border rounded-lg text-sm lg:col-span-2" value={newProduct.description || ''} onChange={e => setNewProduct({...newProduct, description: e.target.value})} />
              <input type="text" placeholder="Marca" className="px-3 py-2 border rounded-lg text-sm" value={newProduct.brand || ''} onChange={e => setNewProduct({...newProduct, brand: e.target.value})} />
              <input type="text" placeholder="Modelo" className="px-3 py-2 border rounded-lg text-sm" value={newProduct.model || ''} onChange={e => setNewProduct({...newProduct, model: e.target.value})} />
              <input type="text" placeholder="Comprador" className="px-3 py-2 border rounded-lg text-sm" value={newProduct.buyerName || ''} onChange={e => setNewProduct({...newProduct, buyerName: e.target.value})} />
              <div className="lg:col-span-6 flex gap-2">
                <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 flex items-center justify-center gap-2 flex-1">
                  {editingProductId ? <><Edit2 className="w-4 h-4" /> Salvar Alterações</> : <><Plus className="w-4 h-4" /> Adicionar Produto</>}
                </button>
                {editingProductId && (
                  <button type="button" onClick={handleCancelEditProduct} className="bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-300">
                    Cancelar
                  </button>
                )}
              </div>
            </form>

            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Filtrar por SKU, Descrição, Marca ou Comprador..."
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-auto max-h-[60vh]">
              <table className="w-full text-sm text-left min-w-[800px]">
                <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="px-4 py-3 cursor-pointer hover:bg-slate-100 transition-colors group" onClick={() => handleSort<Product>('sku', productSort, setProductSort)}>
                    <div className="flex items-center gap-2">SKU <SortIcon column="sku" currentSort={productSort} /></div>
                  </th>
                  <th className="px-4 py-3 cursor-pointer hover:bg-slate-100 transition-colors group" onClick={() => handleSort<Product>('description', productSort, setProductSort)}>
                    <div className="flex items-center gap-2">Descrição <SortIcon column="description" currentSort={productSort} /></div>
                  </th>
                  <th className="px-4 py-3 cursor-pointer hover:bg-slate-100 transition-colors group" onClick={() => handleSort<Product>('brand', productSort, setProductSort)}>
                    <div className="flex items-center gap-2">Marca <SortIcon column="brand" currentSort={productSort} /></div>
                  </th>
                  <th className="px-4 py-3 cursor-pointer hover:bg-slate-100 transition-colors group" onClick={() => handleSort<Product>('model', productSort, setProductSort)}>
                    <div className="flex items-center gap-2">Modelo <SortIcon column="model" currentSort={productSort} /></div>
                  </th>
                  <th className="px-4 py-3 cursor-pointer hover:bg-slate-100 transition-colors group" onClick={() => handleSort<Product>('buyerName', productSort, setProductSort)}>
                    <div className="flex items-center gap-2">Comprador Padrão <SortIcon column="buyerName" currentSort={productSort} /></div>
                  </th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedProducts.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium">{p.sku}</td>
                    <td className="px-4 py-3">{p.description}</td>
                    <td className="px-4 py-3">{p.brand || '-'}</td>
                    <td className="px-4 py-3">{p.model || '-'}</td>
                    <td className="px-4 py-3">{p.buyerName || '-'}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => handleEditProduct(p)} className="text-indigo-600 hover:bg-indigo-50 p-1.5 rounded-lg transition-colors">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDeleteProduct(p.id)} className="text-rose-500 hover:bg-rose-50 p-1.5 rounded-lg transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {products.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">Nenhum produto encontrado.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination
            currentPage={productPage}
            totalItems={filteredProducts.length}
            onPageChange={setProductPage}
          />
          </div>
        </div>
      )}

      {activeTab === 'suppliers' && (
        <div className="space-y-6">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <h2 className="font-bold text-slate-700">Adicionar Fornecedor</h2>
              <div className="flex items-center gap-2">
                <button onClick={() => handleClearAll('suppliers')} className="bg-rose-50 text-rose-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-rose-100 flex items-center gap-2">
                  <Trash2 className="w-4 h-4" /> Limpar Tudo
                </button>
                <label className="cursor-pointer bg-slate-100 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-200 flex items-center gap-2">
                  <Upload className="w-4 h-4" /> Importar Excel
                  <input type="file" accept=".xlsx, .xls, .csv" className="hidden" onChange={(e) => handleFileUpload(e, 'suppliers')} />
                </label>
              </div>
            </div>
            <form onSubmit={handleAddSupplier} className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              <input type="text" placeholder="CNPJ" className="px-3 py-2 border rounded-lg text-sm" value={newSupplier.cnpj || ''} onChange={e => setNewSupplier({...newSupplier, cnpj: e.target.value})} />
              <input type="text" placeholder="Cód. Forn" className="px-3 py-2 border rounded-lg text-sm" value={newSupplier.internalCode || ''} onChange={e => setNewSupplier({...newSupplier, internalCode: e.target.value})} />
              <input type="text" placeholder="Nome do Fornecedor *" required className="px-3 py-2 border rounded-lg text-sm lg:col-span-2" value={newSupplier.name || ''} onChange={e => setNewSupplier({...newSupplier, name: e.target.value})} />
              <input type="text" placeholder="Marca" className="px-3 py-2 border rounded-lg text-sm" value={newSupplier.brand || ''} onChange={e => setNewSupplier({...newSupplier, brand: e.target.value})} />
              <input type="text" placeholder="Compra" className="px-3 py-2 border rounded-lg text-sm" value={newSupplier.purchase || ''} onChange={e => setNewSupplier({...newSupplier, purchase: e.target.value})} />
              <input type="text" placeholder="Representante / Contato" className="px-3 py-2 border rounded-lg text-sm" value={newSupplier.representative || ''} onChange={e => setNewSupplier({...newSupplier, representative: e.target.value})} />
              <input type="email" placeholder="E-mail Vendedor" className="px-3 py-2 border rounded-lg text-sm" value={newSupplier.email || ''} onChange={e => setNewSupplier({...newSupplier, email: e.target.value})} />
              <input type="text" placeholder="Telefone" className="px-3 py-2 border rounded-lg text-sm" value={newSupplier.phone || ''} onChange={e => setNewSupplier({...newSupplier, phone: e.target.value})} />
              <input type="text" placeholder="WhatsApp" className="px-3 py-2 border rounded-lg text-sm" value={newSupplier.whatsapp || ''} onChange={e => setNewSupplier({...newSupplier, whatsapp: e.target.value})} />
              <input type="text" placeholder="Comprador Padrão" className="px-3 py-2 border rounded-lg text-sm" value={newSupplier.defaultBuyer || ''} onChange={e => setNewSupplier({...newSupplier, defaultBuyer: e.target.value})} />
              <div className="lg:col-span-6 flex gap-2">
                <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 flex items-center justify-center gap-2 flex-1">
                  {editingSupplierId ? <><Edit2 className="w-4 h-4" /> Salvar Alterações</> : <><Plus className="w-4 h-4" /> Adicionar Fornecedor</>}
                </button>
                {editingSupplierId && (
                  <button type="button" onClick={handleCancelEditSupplier} className="bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-300">
                    Cancelar
                  </button>
                )}
              </div>
            </form>

            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Filtrar por Nome, CNPJ, Código Interno ou Marca..."
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={supplierSearch}
                onChange={(e) => setSupplierSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-auto max-h-[60vh]">
              <table className="w-full text-sm text-left min-w-[800px]">
                <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="px-4 py-3 cursor-pointer hover:bg-slate-100 transition-colors group" onClick={() => handleSort<Supplier>('internalCode', supplierSort, setSupplierSort)}>
                    <div className="flex items-center gap-2">Cód. Forn <SortIcon column="internalCode" currentSort={supplierSort} /></div>
                  </th>
                  <th className="px-4 py-3 cursor-pointer hover:bg-slate-100 transition-colors group" onClick={() => handleSort<Supplier>('cnpj', supplierSort, setSupplierSort)}>
                    <div className="flex items-center gap-2">CNPJ <SortIcon column="cnpj" currentSort={supplierSort} /></div>
                  </th>
                  <th className="px-4 py-3 cursor-pointer hover:bg-slate-100 transition-colors group" onClick={() => handleSort<Supplier>('name', supplierSort, setSupplierSort)}>
                    <div className="flex items-center gap-2">Nome <SortIcon column="name" currentSort={supplierSort} /></div>
                  </th>
                  <th className="px-4 py-3 cursor-pointer hover:bg-slate-100 transition-colors group" onClick={() => handleSort<Supplier>('brand', supplierSort, setSupplierSort)}>
                    <div className="flex items-center gap-2">Marca <SortIcon column="brand" currentSort={supplierSort} /></div>
                  </th>
                  <th className="px-4 py-3 cursor-pointer hover:bg-slate-100 transition-colors group" onClick={() => handleSort<Supplier>('defaultBuyer', supplierSort, setSupplierSort)}>
                    <div className="flex items-center gap-2">Comprador <SortIcon column="defaultBuyer" currentSort={supplierSort} /></div>
                  </th>
                  <th className="px-4 py-3">Contato</th>
                  <th className="px-4 py-3">Telefone/WhatsApp</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedSuppliers.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs">{s.internalCode || '-'}</td>
                    <td className="px-4 py-3 font-mono text-xs">{s.cnpj || '-'}</td>
                    <td className="px-4 py-3 font-medium">{s.name}</td>
                    <td className="px-4 py-3">{s.brand || '-'}</td>
                    <td className="px-4 py-3">{s.defaultBuyer || '-'}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span>{s.representative || '-'}</span>
                        {s.email && <span className="text-xs text-slate-500">{s.email}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        {s.phone && <span>Tel: {s.phone}</span>}
                        {s.whatsapp && <span className="text-xs text-emerald-600">Wpp: {s.whatsapp}</span>}
                        {!s.phone && !s.whatsapp && <span>-</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => handleEditSupplier(s)} className="text-indigo-600 hover:bg-indigo-50 p-1.5 rounded-lg transition-colors">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDeleteSupplier(s.id)} className="text-rose-500 hover:bg-rose-50 p-1.5 rounded-lg transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {suppliers.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">Nenhum fornecedor encontrado.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination
            currentPage={supplierPage}
            totalItems={filteredSuppliers.length}
            onPageChange={setSupplierPage}
          />
          </div>
        </div>
      )}

      {activeTab === 'buyers' && (
        <div className="space-y-6">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <h2 className="font-bold text-slate-700">Adicionar Usuário</h2>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => handleClearAll('buyers')} className="bg-rose-50 text-rose-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-rose-100 flex items-center gap-2">
                  <Trash2 className="w-4 h-4" /> Limpar Tudo
                </button>
                <label className="cursor-pointer bg-slate-100 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-200 flex items-center gap-2">
                  <Upload className="w-4 h-4" /> Importar Excel
                  <input type="file" accept=".xlsx, .xls, .csv" className="hidden" onChange={(e) => handleFileUpload(e, 'buyers')} />
                </label>
              </div>
            </div>
            <form onSubmit={handleAddBuyer} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
              <input type="text" placeholder="Nome Completo *" required className="px-3 py-2 border rounded-lg text-sm" value={newBuyer.name || ''} onChange={e => setNewBuyer({...newBuyer, name: e.target.value})} />
              <input type="text" placeholder="Usuário de Rede" className="px-3 py-2 border rounded-lg text-sm" value={newBuyer.username || ''} onChange={e => setNewBuyer({...newBuyer, username: e.target.value})} />
              <input type="password" placeholder="Senha *" required={!editingBuyerId} className="px-3 py-2 border rounded-lg text-sm" value={newBuyer.password || ''} onChange={e => setNewBuyer({...newBuyer, password: e.target.value})} />
              <select 
                required
                className="px-3 py-2 border rounded-lg text-sm bg-white"
                value={newBuyer.role || ''}
                onChange={e => setNewBuyer({...newBuyer, role: e.target.value as any})}
              >
                <option value="">Perfil *</option>
                <option value="comprador">Comprador</option>
                <option value="administrador">Administrador</option>
                <option value="logística">Logística</option>
              </select>
              <input type="email" placeholder="E-mail" className="px-3 py-2 border rounded-lg text-sm" value={newBuyer.email || ''} onChange={e => setNewBuyer({...newBuyer, email: e.target.value})} />
              <input type="text" placeholder="Departamento" className="px-3 py-2 border rounded-lg text-sm" value={newBuyer.department || ''} onChange={e => setNewBuyer({...newBuyer, department: e.target.value})} />
              
              <div className="lg:col-span-6 flex gap-2">
                <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 flex items-center justify-center gap-2 flex-1">
                  {editingBuyerId ? <><Edit2 className="w-4 h-4" /> Salvar Alterações</> : <><Plus className="w-4 h-4" /> Adicionar Usuário</>}
                </button>
                {editingBuyerId && (
                  <button type="button" onClick={handleCancelEditBuyer} className="bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-300">
                    Cancelar
                  </button>
                )}
              </div>
            </form>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Filtrar por Nome, Usuário, Perfil ou Departamento..."
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={buyerSearch}
              onChange={(e) => setBuyerSearch(e.target.value)}
            />
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-auto max-h-[60vh]">
              <table className="w-full text-sm text-left min-w-[800px]">
                <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="px-4 py-3 cursor-pointer hover:bg-slate-100 transition-colors group" onClick={() => handleSort<Buyer>('name', buyerSort, setBuyerSort)}>
                    <div className="flex items-center gap-2">Nome <SortIcon column="name" currentSort={buyerSort} /></div>
                  </th>
                  <th className="px-4 py-3 cursor-pointer hover:bg-slate-100 transition-colors group" onClick={() => handleSort<Buyer>('username', buyerSort, setBuyerSort)}>
                    <div className="flex items-center gap-2">Usuário <SortIcon column="username" currentSort={buyerSort} /></div>
                  </th>
                  <th className="px-4 py-3 cursor-pointer hover:bg-slate-100 transition-colors group" onClick={() => handleSort<Buyer>('password', buyerSort, setBuyerSort)}>
                    <div className="flex items-center gap-2">Senha <SortIcon column="password" currentSort={buyerSort} /></div>
                  </th>
                  <th className="px-4 py-3 cursor-pointer hover:bg-slate-100 transition-colors group" onClick={() => handleSort<Buyer>('role', buyerSort, setBuyerSort)}>
                    <div className="flex items-center gap-2">Perfil <SortIcon column="role" currentSort={buyerSort} /></div>
                  </th>
                  <th className="px-4 py-3 cursor-pointer hover:bg-slate-100 transition-colors group" onClick={() => handleSort<Buyer>('email', buyerSort, setBuyerSort)}>
                    <div className="flex items-center gap-2">E-mail <SortIcon column="email" currentSort={buyerSort} /></div>
                  </th>
                  <th className="px-4 py-3 cursor-pointer hover:bg-slate-100 transition-colors group" onClick={() => handleSort<Buyer>('department', buyerSort, setBuyerSort)}>
                    <div className="flex items-center gap-2">Departamento <SortIcon column="department" currentSort={buyerSort} /></div>
                  </th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedBuyers.map(b => (
                  <tr key={b.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium">{b.name}</td>
                    <td className="px-4 py-3 font-mono text-xs">{b.username || '-'}</td>
                    <td className="px-4 py-3 font-mono text-xs">{b.password ? '••••••••' : '-'}</td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                        b.role === 'administrador' ? "bg-rose-100 text-rose-600" :
                        b.role === 'comprador' ? "bg-indigo-100 text-indigo-600" :
                        "bg-slate-100 text-slate-600"
                      )}>
                        {b.role || 'Usuário'}
                      </span>
                    </td>
                    <td className="px-4 py-3">{b.email || '-'}</td>
                    <td className="px-4 py-3">{b.department || '-'}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => handleEditBuyer(b)} className="text-indigo-600 hover:bg-indigo-50 p-1.5 rounded-lg transition-colors">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDeleteBuyer(b.id)} className="text-rose-500 hover:bg-rose-50 p-1.5 rounded-lg transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {buyers.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">Nenhum usuário encontrado.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination
            currentPage={buyerPage}
            totalItems={filteredBuyers.length}
            onPageChange={setBuyerPage}
          />
          </div>
        </div>
      )}

      <ImportPreviewModal />
      <DeleteDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title={`Excluir ${deleteTarget?.type === 'products' ? 'Produto' : deleteTarget?.type === 'suppliers' ? 'Fornecedor' : 'Colaborador'}`}
        description="Tem certeza que deseja excluir este item? Esta ação não pode ser desfeita."
      />
    </div>
  );
};
