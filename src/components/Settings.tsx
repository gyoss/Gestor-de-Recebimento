import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { UserSettings, GlobalSettings, Divergence, User } from '../types';
import { Save, Download, UserPlus, Shield, Database, Settings as SettingsIcon } from 'lucide-react';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  alert(`Erro ao salvar configurações: ${errInfo.error}`);
}

export const Settings = ({ divergences }: { divergences: Divergence[] }) => {
  const [userSettings, setUserSettings] = useState<UserSettings>({ emailNotifications: false, systemNotifications: false });
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings>({ defaultDeadlineDays: 5, defaultIpi: 0, defaultIcmsSt: 0 });
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingUser, setSavingUser] = useState(false);
  const [savingGlobal, setSavingGlobal] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<'admin' | 'user'>('user');

  useEffect(() => {
    const loadSettings = async () => {
      if (!auth.currentUser) return;
      try {
        const userDoc = await getDoc(doc(db, 'userSettings', auth.currentUser.uid));
        if (userDoc.exists()) setUserSettings(userDoc.data() as UserSettings);
        
        const globalDoc = await getDoc(doc(db, 'globalSettings', 'config'));
        if (globalDoc.exists()) setGlobalSettings(globalDoc.data() as GlobalSettings);
        
        const usersSnapshot = await getDocs(collection(db, 'users'));
        setUsers(usersSnapshot.docs.map(doc => doc.data() as User));
      } catch (error) {
        console.error("Erro ao carregar configurações", error);
      } finally {
        setLoading(false);
      }
    };
    loadSettings();
  }, []);

  const saveUserSettings = async () => {
    if (!auth.currentUser) return;
    setSavingUser(true);
    try {
      await setDoc(doc(db, 'userSettings', auth.currentUser.uid), userSettings);
      alert('Configurações de usuário salvas com sucesso!');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'userSettings');
    } finally {
      setSavingUser(false);
    }
  };

  const saveGlobalSettings = async () => {
    setSavingGlobal(true);
    try {
      await setDoc(doc(db, 'globalSettings', 'config'), globalSettings);
      alert('Regras de negócio salvas com sucesso!');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'globalSettings');
    } finally {
      setSavingGlobal(false);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserEmail.trim()) return;
    
    try {
      // Create a temporary ID for the user until they log in
      // In a real app, you might want to use Firebase Admin SDK to create the user properly
      // or send an invitation email. Here we just pre-authorize their email.
      const tempId = `pending_${Date.now()}`;
      await setDoc(doc(db, 'users', tempId), {
        userId: tempId,
        email: newUserEmail.trim(),
        name: newUserEmail.split('@')[0], // Default name from email
        role: newUserRole
      });
      
      setNewUserEmail('');
      alert('Usuário pré-cadastrado com sucesso! Ele poderá acessar o sistema ao fazer login com este e-mail.');
      
      // Reload users
      const usersSnapshot = await getDocs(collection(db, 'users'));
      setUsers(usersSnapshot.docs.map(doc => doc.data() as User));
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'users');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Tem certeza que deseja remover este usuário?')) return;
    try {
      await setDoc(doc(db, 'users', userId), { deleted: true }, { merge: true }); // Soft delete or actual delete depending on rules
      // For this example, we'll just remove it from the UI to simulate deletion if rules don't allow hard delete
      setUsers(users.filter(u => u.userId !== userId));
      alert('Usuário removido com sucesso!');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${userId}`);
    }
  };

  const exportToCSV = () => {
    const csvContent = "data:text/csv;charset=utf-8," 
      + "ID,NF,Fornecedor,Valor,Status,Urgência,Tipo,Prazo\n"
      + divergences.map(d => `${d.id},${d.invoiceId},${d.supplierName},${d.value},${d.status},${d.urgency},${d.type},${d.deadline}`).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "divergencias.csv");
    document.body.appendChild(link);
    link.click();
  };

  if (loading) {
    return <div className="p-6 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
          <SettingsIcon className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Configurações</h1>
          <p className="text-sm text-slate-500">Gerencie suas preferências e regras do sistema</p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-indigo-600" />
            Notificações
          </h2>
          <div className="space-y-4">
            <label className="flex items-center gap-3 p-3 border border-slate-100 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors">
              <input 
                type="checkbox" 
                className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                checked={userSettings.emailNotifications}
                onChange={(e) => setUserSettings(prev => ({...prev, emailNotifications: e.target.checked}))}
              />
              <span className="text-sm font-medium text-slate-700">Receber notificações por E-mail</span>
            </label>
            <label className="flex items-center gap-3 p-3 border border-slate-100 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors">
              <input 
                type="checkbox" 
                className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                checked={userSettings.systemNotifications}
                onChange={(e) => setUserSettings(prev => ({...prev, systemNotifications: e.target.checked}))}
              />
              <span className="text-sm font-medium text-slate-700">Receber notificações no Sistema</span>
            </label>
            <button 
              onClick={saveUserSettings} 
              disabled={savingUser}
              className="mt-4 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 flex items-center gap-2 disabled:opacity-50 transition-colors"
            >
              <Save size={16} /> {savingUser ? 'Salvando...' : 'Salvar Preferências'}
            </button>
          </div>
        </section>

        <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Database className="w-5 h-5 text-indigo-600" />
            Regras de Negócio
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Prazo Padrão (dias)</label>
              <input 
                type="number"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                value={globalSettings.defaultDeadlineDays}
                onChange={(e) => setGlobalSettings(prev => ({...prev, defaultDeadlineDays: Number(e.target.value)}))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">IPI Padrão (%)</label>
                <input 
                  type="number"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                  value={globalSettings.defaultIpi}
                  onChange={(e) => setGlobalSettings(prev => ({...prev, defaultIpi: Number(e.target.value)}))}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">ICMS-ST Padrão (%)</label>
                <input 
                  type="number"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                  value={globalSettings.defaultIcmsSt}
                  onChange={(e) => setGlobalSettings(prev => ({...prev, defaultIcmsSt: Number(e.target.value)}))}
                />
              </div>
            </div>
            <button 
              onClick={saveGlobalSettings} 
              disabled={savingGlobal}
              className="mt-4 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 flex items-center gap-2 disabled:opacity-50 transition-colors"
            >
              <Save size={16} /> {savingGlobal ? 'Salvando...' : 'Salvar Regras'}
            </button>
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Download className="w-5 h-5 text-emerald-600" />
            Exportação de Dados
          </h2>
          <p className="text-sm text-slate-500 mb-4">Exporte todas as divergências cadastradas para uma planilha CSV.</p>
          <button onClick={exportToCSV} className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 flex items-center gap-2 transition-colors">
            <Download size={16} /> Exportar Divergências
          </button>
        </section>

        <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-indigo-600" />
            Gerenciamento de Usuários
          </h2>
          
          <form onSubmit={handleAddUser} className="mb-6 flex gap-3">
            <input 
              type="email" 
              placeholder="E-mail do usuário" 
              required
              className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none"
              value={newUserEmail}
              onChange={(e) => setNewUserEmail(e.target.value)}
            />
            <select 
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none bg-white"
              value={newUserRole}
              onChange={(e) => setNewUserRole(e.target.value as 'admin' | 'user')}
            >
              <option value="user">Usuário</option>
              <option value="admin">Administrador</option>
            </select>
            <button 
              type="submit"
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              Adicionar
            </button>
          </form>

          <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
            {users.map(u => (
              <div key={u.userId} className="flex justify-between items-center p-3 border border-slate-100 rounded-lg bg-slate-50">
                <div>
                  <span className="font-medium text-sm text-slate-700 block">{u.name}</span>
                  {(u as any).email && <span className="text-xs text-slate-500">{(u as any).email}</span>}
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-bold px-2 py-1 rounded-md uppercase tracking-wider ${u.role === 'admin' ? 'bg-rose-100 text-rose-700' : 'bg-indigo-100 text-indigo-700'}`}>
                    {u.role}
                  </span>
                  <button 
                    onClick={() => handleDeleteUser(u.userId)}
                    className="text-slate-400 hover:text-rose-500 transition-colors p-1"
                    title="Remover usuário"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                  </button>
                </div>
              </div>
            ))}
            {users.length === 0 && (
              <p className="text-sm text-slate-500 text-center py-4">Nenhum usuário cadastrado.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
