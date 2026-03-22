import React, { useState, useEffect, useRef } from 'react';
import { Sidebar, Header } from './components/Layout';
import { KanbanBoard } from './components/KanbanBoard';
import { Dashboard } from './components/Dashboard';
import { HistoryView } from './components/HistoryView';
import { DivergenceModal } from './components/DivergenceModal';
import { Settings } from './components/Settings';
import { Cadastros } from './components/Cadastros';
import { db, auth, googleProvider, OperationType, handleFirestoreError } from './firebase';
import { onAuthStateChanged, signInWithPopup, User as FirebaseUser } from 'firebase/auth';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { Divergence, AppNotification, FilterOptions, DashboardMetrics } from './types';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, LogIn, Bell, User as UserIcon, Download, FileText, Table } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { exportDivergencesToPDF, exportDivergencesToExcel, exportDashboardToPDF, exportDashboardToExcel } from './lib/exportUtils';
import { COLUMNS } from './constants';

export default function App() {
  const [activeTab, setActiveTab] = useState<'kanban' | 'dashboard' | 'history' | 'settings' | 'cadastros'>('kanban');
  const [githubUser, setGithubUser] = useState<any>(null);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [divergences, setDivergences] = useState<Divergence[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDivergence, setEditingDivergence] = useState<Divergence | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<FilterOptions>({
    urgency: [],
    type: [],
    status: [],
    minValue: null,
    maxValue: null
  });
  const [isExportOpen, setIsExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  const activeColumns = COLUMNS.filter(c => c.id !== 'CONCLUIDO');

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(event.target as Node)) {
        setIsExportOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const calculateMetrics = (data: Divergence[]): DashboardMetrics => {
    const totalValue = data.reduce((acc, d) => acc + d.value, 0);
    const recoveredValue = data
      .filter(d => d.status === 'CONCLUIDO')
      .reduce((acc, d) => acc + d.value, 0);
    
    const supplierMap = new Map<string, { count: number; value: number }>();
    data.forEach(d => {
      const current = supplierMap.get(d.supplierName) || { count: 0, value: 0 };
      supplierMap.set(d.supplierName, {
        count: current.count + 1,
        value: current.value + d.value
      });
    });

    const topSuppliers = Array.from(supplierMap.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalValue,
      totalQuantity: data.length,
      recoveredValue,
      pendingValue: totalValue - recoveredValue,
      avgResolutionTime: 0, // Simplified for now
      monthlyData: [], // Simplified for now
      topSuppliers
    };
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setDivergences([]);
      return;
    }

    const q = query(collection(db, 'divergences'), where('ownerId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Divergence[];
      setDivergences(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'divergences');
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }

    const q = query(
      collection(db, 'notifications'), 
      where('userId', '==', user.uid)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as AppNotification[];
      // Sort by timestamp descending
      setNotifications(data.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'notifications');
    });

    return () => unsubscribe();
  }, [user]);

  const createNotification = async (title: string, message: string, type: 'CREATE' | 'UPDATE' | 'DELETE' | 'MOVE', divergenceId?: string) => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'notifications'), {
        userId: user.uid,
        title,
        message,
        type,
        timestamp: new Date().toISOString(),
        read: false,
        divergenceId
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'notifications');
    }
  };

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  const handleSaveDivergence = async (data: any) => {
    if (!user) return;
    try {
      const divergenceId = data.id || editingDivergence?.id;
      
      if (divergenceId) {
        const docRef = doc(db, 'divergences', divergenceId);
        
        // Find changed fields
        const changes: string[] = [];
        const fieldLabels: Record<string, string> = {
          invoiceId: 'NF',
          supplierName: 'Fornecedor',
          value: 'Valor',
          urgency: 'Urgência',
          type: 'Tipo',
          deadline: 'Prazo',
          description: 'Descrição',
          status: 'Status'
        };

        const original = divergences.find(d => d.id === divergenceId);
        if (original) {
          Object.keys(data).forEach(key => {
            if (key !== 'id' && data[key] !== (original as any)[key]) {
              changes.push(fieldLabels[key] || key);
            }
          });
        }

        // Clean data: remove undefined values and the id itself
        const updateData: any = {};
        Object.keys(data).forEach(key => {
          if (data[key] !== undefined && key !== 'id') {
            updateData[key] = data[key];
          }
        });
        
        // Ensure missingProducts is handled correctly if present
        if (updateData.missingProducts) {
          updateData.missingProducts = updateData.missingProducts.map((p: any) => {
            const product: any = {
              id: p.id,
              sku: p.sku,
              description: p.description,
              baseValue: Number(p.baseValue) || 0,
              ipi: p.ipi ? Number(p.ipi) : undefined,
              icmsSt: p.icmsSt ? Number(p.icmsSt) : undefined,
              freight: p.freight ? Number(p.freight) : undefined
            };
            if (p.internalCode) {
              product.internalCode = p.internalCode;
            }
            return product;
          });
        }
        
        try {
          await updateDoc(docRef, updateData);
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `divergences/${divergenceId}`);
        }
        
        const message = changes.length > 0 
          ? `Campos alterados na NF ${updateData.invoiceId || (original as any)?.invoiceId}: ${changes.join(', ')}.`
          : `A NF ${updateData.invoiceId || (original as any)?.invoiceId} foi atualizada sem alterações nos campos principais.`;

        await createNotification(
          'Divergência Atualizada',
          message,
          'UPDATE',
          divergenceId
        );
      } else {
        // Clean data: remove undefined values and the id itself
        const cleanData: any = {};
        Object.keys(data).forEach(key => {
          if (data[key] !== undefined && key !== 'id') {
            cleanData[key] = data[key];
          }
        });

        // Ensure missingProducts is handled correctly if present
        if (cleanData.missingProducts) {
          cleanData.missingProducts = cleanData.missingProducts.map((p: any) => {
            const product: any = {
              id: p.id,
              sku: p.sku,
              description: p.description,
              baseValue: Number(p.baseValue) || 0,
              ipi: p.ipi ? Number(p.ipi) : undefined,
              icmsSt: p.icmsSt ? Number(p.icmsSt) : undefined,
              freight: p.freight ? Number(p.freight) : undefined
            };
            if (p.internalCode) {
              product.internalCode = p.internalCode;
            }
            return product;
          });
        }

        let docRef;
        try {
          docRef = await addDoc(collection(db, 'divergences'), {
            ...cleanData,
            ownerId: user.uid
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, 'divergences');
        }
        await createNotification(
          'Nova Divergência',
          `Uma nova divergência para a NF ${cleanData.invoiceId} foi criada.`,
          'CREATE',
          docRef.id
        );
      }
      setIsModalOpen(false);
      setEditingDivergence(null);
    } catch (error) {
      handleFirestoreError(error, (data.id || editingDivergence) ? OperationType.UPDATE : OperationType.CREATE, 'divergences');
    }
  };

  const handleEditDivergence = (divergence: Divergence) => {
    setEditingDivergence(divergence);
    setIsModalOpen(true);
  };

  const handleDeleteDivergence = async (id: string) => {
    const divergence = divergences.find(d => d.id === id);
    try {
      await deleteDoc(doc(db, 'divergences', id));
      if (divergence) {
        await createNotification(
          'Divergência Excluída',
          `A divergência da NF ${divergence.invoiceId} foi removida.`,
          'DELETE',
          id
        );
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'divergences');
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setGithubUser(null);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const markNotificationAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'notifications');
    }
  };

  const clearNotifications = async () => {
    try {
      const unread = notifications.filter(n => !n.read);
      await Promise.all(unread.map(n => updateDoc(doc(db, 'notifications', n.id), { read: true })));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'notifications');
    }
  };

  const filteredDivergences = divergences.filter(d => {
    const matchesSearch = 
      d.invoiceId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.supplierName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.id.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesUrgency = filters.urgency.length === 0 || filters.urgency.includes(d.urgency);
    const matchesType = filters.type.length === 0 || filters.type.includes(d.type);
    const matchesStatus = filters.status.length === 0 || filters.status.includes(d.status);
    const matchesMin = filters.minValue === null || d.value >= filters.minValue;
    const matchesMax = filters.maxValue === null || d.value <= filters.maxValue;

    return matchesSearch && matchesUrgency && matchesType && matchesStatus && matchesMin && matchesMax;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl mb-8">
          <Plus className="w-10 h-10 rotate-45" />
        </div>
        <h1 className="text-3xl font-bold text-slate-900 mb-2">DivergeFlow</h1>
        <p className="text-slate-500 mb-8 text-center max-w-sm">
          Gestão inteligente de divergências fiscais. Entre para gerenciar seu quadro.
        </p>
        <button 
          onClick={handleLogin}
          className="flex items-center gap-3 px-8 py-4 bg-white border border-slate-200 rounded-2xl font-bold text-slate-700 shadow-sm hover:shadow-md transition-all"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-6 h-6" alt="Google" />
          Entrar com Google
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        githubUser={githubUser}
        setGithubUser={setGithubUser}
        onLogout={handleLogout}
      />
      
      <main className="flex-1 flex flex-col min-w-0">
        <Header 
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          user={user}
          notifications={notifications}
          onMarkAsRead={markNotificationAsRead}
          onClearAll={clearNotifications}
          onProfileClick={() => alert(`Perfil: ${user.displayName || user.email}\nFunção: Auditor Sênior`)}
          filters={filters}
          setFilters={setFilters}
        />
        
        <div className="p-4 sm:p-8 flex-1 overflow-auto custom-scrollbar flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold text-slate-900 tracking-tight">
                {activeTab === 'kanban' ? 'Quadro de Divergências' : 
                 activeTab === 'dashboard' ? 'Dashboard de Resultados' : 
                 activeTab === 'settings' ? 'Configurações' : 'Divergências Concluídas'}
              </h2>
              <p className="text-slate-500 mt-1 font-medium">
                {activeTab === 'kanban' 
                  ? 'Gerencie e acompanhe o status das notas fiscais com divergência.' 
                  : activeTab === 'dashboard'
                  ? 'Análise mensal de performance e recuperação financeira.'
                  : activeTab === 'settings'
                  ? 'Gerencie suas preferências e regras de negócio.'
                  : 'Visualize todas as divergências que já foram concluídas.'}
              </p>
            </div>

            <div className="flex items-center gap-3">
              {activeTab !== 'settings' && (
                <div className="relative" ref={exportRef}>
                  <button 
                    onClick={() => setIsExportOpen(!isExportOpen)}
                    className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl font-bold text-sm shadow-sm transition-all"
                  >
                    <Download className="w-5 h-5" />
                    Exportar
                  </button>

                  <AnimatePresence>
                    {isExportOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden z-50 p-2"
                      >
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 py-2">Opções de Exportação</p>
                        
                        {activeTab === 'kanban' && (
                          <>
                            <button 
                              onClick={() => {
                                exportDivergencesToPDF(filteredDivergences);
                                setIsExportOpen(false);
                              }}
                              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 rounded-xl text-sm font-medium text-slate-700 transition-all"
                            >
                              <FileText className="w-4 h-4 text-rose-500" />
                              Quadro (PDF)
                            </button>
                            <button 
                              onClick={() => {
                                exportDivergencesToExcel(filteredDivergences);
                                setIsExportOpen(false);
                              }}
                              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 rounded-xl text-sm font-medium text-slate-700 transition-all"
                            >
                              <Table className="w-4 h-4 text-emerald-500" />
                              Quadro (Excel)
                            </button>
                          </>
                        )}

                        {activeTab === 'dashboard' && (
                          <>
                            <button 
                              onClick={() => {
                                exportDashboardToPDF(calculateMetrics(divergences));
                                setIsExportOpen(false);
                              }}
                              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 rounded-xl text-sm font-medium text-slate-700 transition-all"
                            >
                              <FileText className="w-4 h-4 text-indigo-500" />
                              Dashboard (PDF)
                            </button>
                            <button 
                              onClick={() => {
                                exportDashboardToExcel(calculateMetrics(divergences));
                                setIsExportOpen(false);
                              }}
                              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 rounded-xl text-sm font-medium text-slate-700 transition-all"
                            >
                              <Table className="w-4 h-4 text-emerald-500" />
                              Dashboard (Excel)
                            </button>
                          </>
                        )}

                        {activeTab === 'history' && (
                          <>
                            <button 
                              onClick={() => {
                                exportDivergencesToPDF(divergences.filter(d => d.status === 'CONCLUIDO'));
                                setIsExportOpen(false);
                              }}
                              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 rounded-xl text-sm font-medium text-slate-700 transition-all"
                            >
                              <FileText className="w-4 h-4 text-rose-500" />
                              Histórico (PDF)
                            </button>
                            <button 
                              onClick={() => {
                                exportDivergencesToExcel(divergences.filter(d => d.status === 'CONCLUIDO'));
                                setIsExportOpen(false);
                              }}
                              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 rounded-xl text-sm font-medium text-slate-700 transition-all"
                            >
                              <Table className="w-4 h-4 text-emerald-500" />
                              Histórico (Excel)
                            </button>
                          </>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {activeTab === 'kanban' && (
                <button 
                  onClick={() => setIsModalOpen(true)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm shadow-lg shadow-indigo-200 transition-all hover:-translate-y-0.5 active:translate-y-0"
                >
                  <Plus className="w-5 h-5" />
                  Nova Divergência
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 relative">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="h-full"
              >
                {activeTab === 'kanban' ? (
                  <KanbanBoard 
                    divergences={filteredDivergences} 
                    columns={activeColumns}
                    onAddCard={() => {
                      setEditingDivergence(null);
                      setIsModalOpen(true);
                    }} 
                    onEditCard={handleEditDivergence}
                    onDeleteCard={handleDeleteDivergence}
                    onMoveCard={async (id, status) => {
                      const div = divergences.find(d => d.id === id);
                      if (div) {
                        await createNotification(
                          'Status Alterado',
                          `NF ${div.invoiceId} movida para ${status}.`,
                          'MOVE',
                          id
                        );
                        await handleSaveDivergence({ ...div, status });
                      }
                    }}
                  />
                ) : activeTab === 'dashboard' ? (
                  <Dashboard divergences={divergences} />
                ) : activeTab === 'settings' ? (
                  <Settings divergences={divergences} />
                ) : activeTab === 'cadastros' ? (
                  <Cadastros />
                ) : (
                  <HistoryView 
                    divergences={divergences}
                    onEdit={handleEditDivergence}
                    onDelete={handleDeleteDivergence}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </main>

      <DivergenceModal 
        isOpen={isModalOpen} 
        onClose={() => {
          setIsModalOpen(false);
          setEditingDivergence(null);
        }} 
        onSave={handleSaveDivergence} 
        initialData={editingDivergence}
        user={user}
      />
    </div>
  );
}
