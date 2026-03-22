import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { Product, Supplier, Buyer } from '../types';
import { Plus, Trash2, Edit2, Upload, Database, Package, Users, Building2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { cn } from '../lib/utils';

export const Cadastros = () => {
  const [activeTab, setActiveTab] = useState<'products' | 'suppliers' | 'buyers'>('products');
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [loading, setLoading] = useState(true);

  const [newProduct, setNewProduct] = useState<Partial<Product>>({});
  const [newSupplier, setNewSupplier] = useState<Partial<Supplier>>({});
  const [newBuyer, setNewBuyer] = useState<Partial<Buyer>>({});

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
    try {
      await addDoc(collection(db, 'products'), newProduct);
      setNewProduct({});
      loadData();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'products');
    }
  };

  const handleDeleteProduct = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'products', id));
      loadData();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'products');
    }
  };

  const handleAddSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSupplier.name) return;
    try {
      await addDoc(collection(db, 'suppliers'), newSupplier);
      setNewSupplier({});
      loadData();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'suppliers');
    }
  };

  const handleDeleteSupplier = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'suppliers', id));
      loadData();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'suppliers');
    }
  };

  const handleAddBuyer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBuyer.name) return;
    try {
      await addDoc(collection(db, 'buyers'), newBuyer);
      setNewBuyer({});
      loadData();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'buyers');
    }
  };

  const handleDeleteBuyer = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'buyers', id));
      loadData();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'buyers');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'products' | 'suppliers' | 'buyers') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);

      try {
        if (type === 'products') {
          for (const row of data as any[]) {
            if (row.sku && row.description) {
              await addDoc(collection(db, 'products'), {
                sku: String(row.sku),
                description: String(row.description),
                model: row.model ? String(row.model) : '',
                brand: row.brand ? String(row.brand) : '',
                internalCode: row.internalCode ? String(row.internalCode) : '',
                buyerName: row.buyerName ? String(row.buyerName) : '',
                supplierName: row.supplierName ? String(row.supplierName) : ''
              });
            }
          }
        } else if (type === 'suppliers') {
          for (const row of data as any[]) {
            if (row.name) {
              await addDoc(collection(db, 'suppliers'), {
                name: String(row.name),
                cnpj: row.cnpj ? String(row.cnpj) : '',
                defaultBuyer: row.defaultBuyer ? String(row.defaultBuyer) : '',
                representative: row.representative ? String(row.representative) : '',
                phone: row.phone ? String(row.phone) : '',
                email: row.email ? String(row.email) : '',
                sac: row.sac ? String(row.sac) : ''
              });
            }
          }
        } else if (type === 'buyers') {
          for (const row of data as any[]) {
            if (row.name) {
              await addDoc(collection(db, 'buyers'), {
                name: String(row.name),
                email: row.email ? String(row.email) : '',
                department: row.department ? String(row.department) : ''
              });
            }
          }
        }
        alert('Importação concluída com sucesso!');
        loadData();
      } catch (error) {
        console.error("Error importing data:", error);
        alert('Erro ao importar dados. Verifique o console.');
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = ''; // reset
  };

  if (loading) {
    return <div className="p-6 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
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
              <label className="cursor-pointer bg-slate-100 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-200 flex items-center gap-2">
                <Upload className="w-4 h-4" /> Importar Excel
                <input type="file" accept=".xlsx, .xls, .csv" className="hidden" onChange={(e) => handleFileUpload(e, 'products')} />
              </label>
            </div>
            <form onSubmit={handleAddProduct} className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
              <input type="text" placeholder="SKU *" required className="px-3 py-2 border rounded-lg text-sm" value={newProduct.sku || ''} onChange={e => setNewProduct({...newProduct, sku: e.target.value})} />
              <input type="text" placeholder="Cód. Fornecedor" className="px-3 py-2 border rounded-lg text-sm" value={newProduct.internalCode || ''} onChange={e => setNewProduct({...newProduct, internalCode: e.target.value})} />
              <input type="text" placeholder="Descrição *" required className="px-3 py-2 border rounded-lg text-sm lg:col-span-2" value={newProduct.description || ''} onChange={e => setNewProduct({...newProduct, description: e.target.value})} />
              <input type="text" placeholder="Marca" className="px-3 py-2 border rounded-lg text-sm" value={newProduct.brand || ''} onChange={e => setNewProduct({...newProduct, brand: e.target.value})} />
              <input type="text" placeholder="Modelo" className="px-3 py-2 border rounded-lg text-sm" value={newProduct.model || ''} onChange={e => setNewProduct({...newProduct, model: e.target.value})} />
              <input type="text" placeholder="Comprador" className="px-3 py-2 border rounded-lg text-sm" value={newProduct.buyerName || ''} onChange={e => setNewProduct({...newProduct, buyerName: e.target.value})} />
              <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 flex items-center justify-center gap-2 lg:col-span-7">
                <Plus className="w-4 h-4" /> Adicionar Produto
              </button>
            </form>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">SKU</th>
                  <th className="px-4 py-3">Cód. Fornecedor</th>
                  <th className="px-4 py-3">Descrição</th>
                  <th className="px-4 py-3">Marca</th>
                  <th className="px-4 py-3">Modelo</th>
                  <th className="px-4 py-3">Comprador Padrão</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium">{p.sku}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{p.internalCode || '-'}</td>
                    <td className="px-4 py-3">{p.description}</td>
                    <td className="px-4 py-3">{p.brand || '-'}</td>
                    <td className="px-4 py-3">{p.model || '-'}</td>
                    <td className="px-4 py-3">{p.buyerName || '-'}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => handleDeleteProduct(p.id)} className="text-rose-500 hover:bg-rose-50 p-1.5 rounded-lg transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {products.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">Nenhum produto cadastrado.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'suppliers' && (
        <div className="space-y-6">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <h2 className="font-bold text-slate-700">Adicionar Fornecedor</h2>
              <label className="cursor-pointer bg-slate-100 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-200 flex items-center gap-2">
                <Upload className="w-4 h-4" /> Importar Excel
                <input type="file" accept=".xlsx, .xls, .csv" className="hidden" onChange={(e) => handleFileUpload(e, 'suppliers')} />
              </label>
            </div>
            <form onSubmit={handleAddSupplier} className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
              <input type="text" placeholder="CNPJ" className="px-3 py-2 border rounded-lg text-sm" value={newSupplier.cnpj || ''} onChange={e => setNewSupplier({...newSupplier, cnpj: e.target.value})} />
              <input type="text" placeholder="Nome do Fornecedor *" required className="px-3 py-2 border rounded-lg text-sm lg:col-span-2" value={newSupplier.name || ''} onChange={e => setNewSupplier({...newSupplier, name: e.target.value})} />
              <input type="text" placeholder="Representante" className="px-3 py-2 border rounded-lg text-sm" value={newSupplier.representative || ''} onChange={e => setNewSupplier({...newSupplier, representative: e.target.value})} />
              <input type="text" placeholder="Telefone" className="px-3 py-2 border rounded-lg text-sm" value={newSupplier.phone || ''} onChange={e => setNewSupplier({...newSupplier, phone: e.target.value})} />
              <input type="email" placeholder="E-mail" className="px-3 py-2 border rounded-lg text-sm" value={newSupplier.email || ''} onChange={e => setNewSupplier({...newSupplier, email: e.target.value})} />
              <input type="text" placeholder="SAC" className="px-3 py-2 border rounded-lg text-sm" value={newSupplier.sac || ''} onChange={e => setNewSupplier({...newSupplier, sac: e.target.value})} />
              <input type="text" placeholder="Comprador Padrão" className="px-3 py-2 border rounded-lg text-sm" value={newSupplier.defaultBuyer || ''} onChange={e => setNewSupplier({...newSupplier, defaultBuyer: e.target.value})} />
              <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 flex items-center justify-center gap-2 lg:col-span-7">
                <Plus className="w-4 h-4" /> Adicionar Fornecedor
              </button>
            </form>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">CNPJ</th>
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">Representante</th>
                  <th className="px-4 py-3">Telefone</th>
                  <th className="px-4 py-3">E-mail</th>
                  <th className="px-4 py-3">SAC</th>
                  <th className="px-4 py-3">Comprador Padrão</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {suppliers.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs">{s.cnpj || '-'}</td>
                    <td className="px-4 py-3 font-medium">{s.name}</td>
                    <td className="px-4 py-3">{s.representative || '-'}</td>
                    <td className="px-4 py-3">{s.phone || '-'}</td>
                    <td className="px-4 py-3">{s.email || '-'}</td>
                    <td className="px-4 py-3">{s.sac || '-'}</td>
                    <td className="px-4 py-3">{s.defaultBuyer || '-'}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => handleDeleteSupplier(s.id)} className="text-rose-500 hover:bg-rose-50 p-1.5 rounded-lg transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {suppliers.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">Nenhum fornecedor cadastrado.</td></tr>
                )}
              </tbody>
            </table>
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
                <Plus className="w-4 h-4" /> Adicionar
              </button>
            </form>
            <div className="ml-4 pl-4 border-l border-slate-200">
              <label className="cursor-pointer bg-slate-100 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-200 flex items-center gap-2">
                <Upload className="w-4 h-4" /> Importar Excel
                <input type="file" accept=".xlsx, .xls, .csv" className="hidden" onChange={(e) => handleFileUpload(e, 'buyers')} />
              </label>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">E-mail</th>
                  <th className="px-4 py-3">Departamento</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {buyers.map(b => (
                  <tr key={b.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium">{b.name}</td>
                    <td className="px-4 py-3">{b.email || '-'}</td>
                    <td className="px-4 py-3">{b.department || '-'}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => handleDeleteBuyer(b.id)} className="text-rose-500 hover:bg-rose-50 p-1.5 rounded-lg transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {buyers.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500">Nenhum colaborador cadastrado.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
