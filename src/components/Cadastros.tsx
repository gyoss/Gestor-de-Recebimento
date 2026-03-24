import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { Product, Supplier, Buyer } from '../types';
import { Plus, Trash2, Edit2, Upload, Database, Package, Users, Building2, Search, RefreshCw, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import * as XLSX from 'xlsx';
import { cn } from '../lib/utils';
import { DeleteDialog } from './DeleteDialog';

export const Cadastros = () => {
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

  const [productSearch, setProductSearch] = useState('');
  const [supplierSearch, setSupplierSearch] = useState('');
  const [buyerSearch, setBuyerSearch] = useState('');

  const [productSort, setProductSort] = useState<{ key: keyof Product; direction: 'asc' | 'desc' } | null>(null);
  const [supplierSort, setSupplierSort] = useState<{ key: keyof Supplier; direction: 'asc' | 'desc' } | null>(null);
  const [buyerSort, setBuyerSort] = useState<{ key: keyof Buyer; direction: 'asc' | 'desc' } | null>(null);

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
        if (type === 'products') {
          const [existingSnap, suppliersSnap] = await Promise.all([
            getDocs(collection(db, 'products')),
            getDocs(collection(db, 'suppliers'))
          ]);
          
          const existingMap = new Map();
          existingSnap.docs.forEach(d => {
            if (d.data().sku) existingMap.set(d.data().sku, d.id);
          });

          const brandToBuyerMap = new Map();
          suppliersSnap.docs.forEach(d => {
            const s = d.data();
            if (s.brand && s.defaultBuyer) {
              brandToBuyerMap.set(s.brand.toLowerCase().trim(), s.defaultBuyer);
            }
          });

          for (const rawRow of data as any[]) {
            const row: any = {};
            for (const key in rawRow) {
              row[key.trim()] = rawRow[key];
            }

            const rawSku = row.sku || row['SKU'] || row.idsubproduto || row['idsubproduto'] || row['IDSUBPRODUTO'] || row['Id Subproduto'];
            const rawDescription = row.description || row['Descrição'] || row['DESCRIÇÃO'] || row.descricaoproduto || row['descricaoproduto'] || row['DESCRICAOPRODUTO'];

            if (rawSku && rawDescription) {
              const skuVal = String(rawSku).trim();
              const brandVal = String(row.brand || row['Marca'] || row['MARCA'] || row.fabricante || row['fabricante'] || row['FABRICANTE'] || '').trim();
              let buyerVal = String(row.buyerName || row['Comprador'] || row['COMPRADOR'] || '').trim();

              if (!buyerVal && brandVal) {
                const mappedBuyer = brandToBuyerMap.get(brandVal.toLowerCase());
                if (mappedBuyer) buyerVal = mappedBuyer;
              }

              const docData = {
                sku: skuVal,
                description: String(rawDescription).trim(),
                model: String(row.model || row['Modelo'] || row['MODELO'] || row.modelo || row['modelo'] || '').trim(),
                brand: brandVal,
                buyerName: buyerVal,
                supplierName: String(row.supplierName || row['Fornecedor'] || row['FORNECEDOR'] || '').trim()
              };

              if (existingMap.has(skuVal)) {
                await updateDoc(doc(db, 'products', existingMap.get(skuVal)), docData);
              } else {
                const docRef = await addDoc(collection(db, 'products'), docData);
                existingMap.set(skuVal, docRef.id);
              }
              importCount++;
            }
          }
        } else if (type === 'suppliers') {
          const existingSnap = await getDocs(collection(db, 'suppliers'));
          const existingMap = new Map();
          existingSnap.docs.forEach(d => {
            const data = d.data();
            if (data.name) existingMap.set('name_' + data.name.toLowerCase().trim(), d.id);
            if (data.cnpj) {
              const cleanCnpj = data.cnpj.replace(/\D/g, '');
              if (cleanCnpj) existingMap.set('cnpj_' + cleanCnpj, d.id);
            }
            if (data.internalCode) existingMap.set('code_' + data.internalCode.trim(), d.id);
          });

          for (const rawRow of data as any[]) {
            try {
              const row: any = {};
              for (const key in rawRow) {
                row[key.trim()] = rawRow[key];
              }
              
              const supplierName = row.name || row['Nome do Fornecedor'] || row['NOME DO FORNECEDOR'] || row['Fornecedor'] || row['Marca'] || row['MARCA'] || row.fabricante || row['fabricante'] || row['FABRICANTE'];
              if (supplierName) {
                const nameVal = String(supplierName).trim();
                const cnpjVal = String(row.cnpj || row['CNPJ'] || '').trim();
                const cleanCnpj = cnpjVal.replace(/\D/g, '');
                const codeVal = String(row['Cód. Forn'] || row['CÓD. FORN'] || row['Cód Forn'] || row['Código'] || '').trim();

                const docData = {
                  name: nameVal,
                  cnpj: cnpjVal,
                  defaultBuyer: String(row.defaultBuyer || row['Comprador'] || row['COMPRADOR'] || '').trim(),
                  representative: String(row.representative || row['Nome do Contato'] || row['NOME DO CONTATO'] || row['Contato'] || '').trim(),
                  phone: String(row.phone || row['Telefone'] || row['TELEFONE'] || '').trim(),
                  email: String(row.email || row['E-mail Vendedor / Representante'] || row['E-mail'] || row['E-MAIL'] || row['Email'] || '').trim(),
                  sac: String(row.sac || row['SAC'] || '').trim(),
                  internalCode: codeVal,
                  brand: String(row['Marca'] || row['MARCA'] || '').trim(),
                  purchase: String(row['Compra'] || row['COMPRA'] || '').trim(),
                  whatsapp: String(row['WhatsApp'] || row['WHATSAPP'] || row['Whatsapp'] || row['WA'] || '').trim()
                };

                const nameKey = 'name_' + nameVal.toLowerCase();
                const cnpjKey = cleanCnpj ? 'cnpj_' + cleanCnpj : null;
                const codeKey = codeVal ? 'code_' + codeVal : null;

                let foundId = existingMap.get(nameKey) || (cnpjKey && existingMap.get(cnpjKey)) || (codeKey && existingMap.get(codeKey));

                if (foundId) {
                  await updateDoc(doc(db, 'suppliers', foundId), docData);
                  existingMap.set(nameKey, foundId);
                  if (cnpjKey) existingMap.set(cnpjKey, foundId);
                  if (codeKey) existingMap.set(codeKey, foundId);
                } else {
                  const docRef = await addDoc(collection(db, 'suppliers'), docData);
                  existingMap.set(nameKey, docRef.id);
                  if (cnpjKey) existingMap.set(cnpjKey, docRef.id);
                  if (codeKey) existingMap.set(codeKey, docRef.id);
                }
                importCount++;
              }
            } catch (err) {
              console.error("Row import error", err);
            }
          }
        } else if (type === 'buyers') {
          const existingSnap = await getDocs(collection(db, 'buyers'));
          const existingMap = new Map();
          existingSnap.docs.forEach(d => {
            if (d.data().name) existingMap.set(d.data().name.toLowerCase().trim(), d.id);
          });

          for (const rawRow of data as any[]) {
            const row: any = {};
            for (const key in rawRow) {
              row[key.trim()] = rawRow[key];
            }
            if (row.name) {
              const nameVal = String(row.name).trim();
              const docData = {
                name: nameVal,
                email: row.email ? String(row.email) : '',
                department: row.department ? String(row.department) : ''
              };

              const nameKey = nameVal.toLowerCase();
              if (existingMap.has(nameKey)) {
                await updateDoc(doc(db, 'buyers', existingMap.get(nameKey)), docData);
              } else {
                const docRef = await addDoc(collection(db, 'buyers'), docData);
                existingMap.set(nameKey, docRef.id);
              }
              importCount++;
            }
          }
        }
        const entityName = type === 'products' ? 'produtos' : type === 'suppliers' ? 'fornecedores' : 'colaboradores';
        setImportSuccess(`${importCount} ${entityName} processados com sucesso!`);
        loadData();
        setTimeout(() => setImportSuccess(null), 5000);
      } catch (error) {
        console.error("Error importing data:", error);
        alert('Erro ao importar dados. Verifique o console.');
      } finally {
        setImporting(false);
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = ''; // reset
  };

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

  if (loading) {
    return <div className="p-6 flex justify-center items-center h-[200px]"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 relative">
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
            <p className="text-sm text-slate-500">Gerencie produtos, fornecedores e colaboradores</p>
          </div>
        </div>
      </div>

      <div className="flex gap-4 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('products')}
          className={cn("pb-3 px-2 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors", activeTab === 'products' ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-700")}
        >
          <Package className="w-4 h-4" /> Produtos
        </button>
        <button
          onClick={() => setActiveTab('suppliers')}
          className={cn("pb-3 px-2 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors", activeTab === 'suppliers' ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-700")}
        >
          <Building2 className="w-4 h-4" /> Fornecedores
        </button>
        <button
          onClick={() => setActiveTab('buyers')}
          className={cn("pb-3 px-2 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors", activeTab === 'buyers' ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-700")}
        >
          <Users className="w-4 h-4" /> Colaboradores
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
                {filteredProducts.map(p => (
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
                {filteredSuppliers.map(s => (
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
          </div>
        </div>
      )}

      {activeTab === 'buyers' && (
        <div className="space-y-6">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between">
            <form onSubmit={handleAddBuyer} className="flex gap-3 flex-1">
              <input type="text" placeholder="Nome *" required className="px-3 py-2 border rounded-lg text-sm flex-1" value={newBuyer.name || ''} onChange={e => setNewBuyer({...newBuyer, name: e.target.value})} />
              <input type="email" placeholder="E-mail" className="px-3 py-2 border rounded-lg text-sm flex-1" value={newBuyer.email || ''} onChange={e => setNewBuyer({...newBuyer, email: e.target.value})} />
              <input type="text" placeholder="Departamento" className="px-3 py-2 border rounded-lg text-sm w-48" value={newBuyer.department || ''} onChange={e => setNewBuyer({...newBuyer, department: e.target.value})} />
              <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 flex items-center gap-2">
                {editingBuyerId ? <><Edit2 className="w-4 h-4" /> Salvar</> : <><Plus className="w-4 h-4" /> Adicionar</>}
              </button>
              {editingBuyerId && (
                <button type="button" onClick={handleCancelEditBuyer} className="bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-300">
                  Cancelar
                </button>
              )}
            </form>
            <div className="ml-4 pl-4 border-l border-slate-200 flex items-center gap-2">
              <button type="button" onClick={() => handleClearAll('buyers')} className="bg-rose-50 text-rose-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-rose-100 flex items-center gap-2">
                <Trash2 className="w-4 h-4" /> Limpar Tudo
              </button>
              <label className="cursor-pointer bg-slate-100 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-200 flex items-center gap-2">
                <Upload className="w-4 h-4" /> Importar Excel
                <input type="file" accept=".xlsx, .xls, .csv" className="hidden" onChange={(e) => handleFileUpload(e, 'buyers')} />
              </label>
            </div>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Filtrar por Nome ou Departamento..."
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
                {filteredBuyers.map(b => (
                  <tr key={b.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium">{b.name}</td>
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
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500">Nenhum colaborador encontrado.</td></tr>
                )}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      )}

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
