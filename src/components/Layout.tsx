import React, { useState, useRef, useEffect } from 'react';
import { LayoutDashboard, Kanban, Settings, LogOut, Bell, Search, Plus, Filter, Github, Check, Trash2, CheckCircle2, Database } from 'lucide-react';
import { cn } from '../lib/utils';
import { AppNotification, FilterOptions } from '../types';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';

interface SidebarProps {
  activeTab: 'kanban' | 'dashboard' | 'history' | 'settings' | 'cadastros';
  setActiveTab: (tab: 'kanban' | 'dashboard' | 'history' | 'settings' | 'cadastros') => void;
  githubUser: any;
  setGithubUser: (user: any) => void;
  onLogout: () => void;
  userRole: string | null;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, githubUser, setGithubUser, onLogout, userRole }) => {
  const menuItems = [
    { id: 'kanban', label: 'Quadro Kanban', icon: Kanban },
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'history', label: 'Concluídas', icon: CheckCircle2 },
    { id: 'cadastros', label: 'Base de Dados', icon: Database },
  ];

  const handleGithubConnect = async () => {
    try {
      const response = await fetch('/api/auth/github/url');
      if (!response.ok) throw new Error('Failed to get auth URL');
      const { url } = await response.json();

      const authWindow = window.open(
        url,
        'github_oauth_popup',
        'width=600,height=700'
      );

      if (!authWindow) {
        alert('Por favor, permita popups para conectar com o GitHub.');
      }
    } catch (error) {
      console.error('OAuth error:', error);
    }
  };

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const origin = event.origin;
      if (!origin.endsWith('.run.app') && !origin.includes('localhost')) {
        return;
      }
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        setGithubUser(event.data.user);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [setGithubUser]);

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col h-screen sticky top-0">
      <div className="p-6">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
            <Kanban className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-slate-900 text-lg leading-tight">DivergeFlow</h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Gestão Fiscal</p>
          </div>
        </div>

        <nav className="space-y-1">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all",
                activeTab === item.id 
                  ? "bg-indigo-50 text-indigo-600 shadow-sm" 
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="mt-auto p-6 space-y-1">
        {!githubUser ? (
          <button 
            onClick={handleGithubConnect}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium bg-slate-900 text-white hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
          >
            <Github className="w-5 h-5" />
            Conectar GitHub
          </button>
        ) : (
          <div className="px-4 py-3 bg-indigo-50 rounded-xl flex items-center gap-3 border border-indigo-100">
            <img src={githubUser.avatar_url} className="w-6 h-6 rounded-full" alt="GitHub" />
            <span className="text-xs font-bold text-indigo-600 truncate">{githubUser.login}</span>
          </div>
        )}
        
        <button 
          onClick={() => setActiveTab('settings')}
          className={cn(
            "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all",
            activeTab === 'settings'
              ? "bg-indigo-50 text-indigo-600 shadow-sm"
              : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
          )}
        >
          <Settings className="w-5 h-5" />
          Configurações
        </button>
        <button 
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-rose-500 hover:bg-rose-50 transition-all"
        >
          <LogOut className="w-5 h-5" />
          Sair
        </button>
      </div>
    </aside>
  );
};

interface HeaderProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  user: any;
  notifications: AppNotification[];
  onMarkAsRead: (id: string) => void;
  onClearAll: () => void;
  onProfileClick: () => void;
  filters: FilterOptions;
  setFilters: (filters: FilterOptions) => void;
  userRole: string | null;
}

export const Header: React.FC<HeaderProps> = ({ 
  searchQuery, 
  setSearchQuery, 
  user, 
  notifications, 
  onMarkAsRead, 
  onClearAll, 
  onProfileClick,
  filters,
  setFilters,
  userRole
}) => {
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const unreadCount = notifications.filter(n => !n.read).length;
  const notifRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setIsNotifOpen(false);
      }
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setIsFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleFilter = (category: keyof FilterOptions, value: string) => {
    const current = filters[category] as string[];
    const updated = current.includes(value)
      ? current.filter(v => v !== value)
      : [...current, value];
    setFilters({ ...filters, [category]: updated });
  };

  const clearFilters = () => {
    setFilters({
      urgency: [],
      type: [],
      status: [],
      minValue: null,
      maxValue: null
    });
  };

  const activeFilterCount = filters.urgency.length + filters.type.length + filters.status.length + (filters.minValue !== null ? 1 : 0) + (filters.maxValue !== null ? 1 : 0);

  return (
    <header className="h-20 bg-white/80 backdrop-blur-md border-b border-slate-200 px-8 flex items-center justify-between sticky top-0 z-10">
      <div className="flex items-center gap-4 flex-1 max-w-xl">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Buscar por NF, fornecedor ou ID..." 
            className="w-full pl-10 pr-4 py-2.5 bg-slate-100 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-xl text-sm transition-all outline-none"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        <div className="relative" ref={filterRef}>
          <button 
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className={cn(
              "p-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all relative",
              isFilterOpen && "bg-indigo-50 text-indigo-600 ring-2 ring-indigo-500/20",
              activeFilterCount > 0 && "text-indigo-600"
            )}
          >
            <Filter className="w-5 h-5" />
            {activeFilterCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-indigo-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>

          <AnimatePresence>
            {isFilterOpen && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute left-0 mt-2 w-72 bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden z-50 p-4"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-slate-900 text-sm">Filtros Avançados</h3>
                  <button 
                    onClick={clearFilters}
                    className="text-[10px] font-bold text-rose-500 hover:text-rose-600 uppercase tracking-wider"
                  >
                    Limpar
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Urgência</p>
                    <div className="flex flex-wrap gap-2">
                      {['BAIXA', 'MEDIA', 'ALTA'].map(u => (
                        <button
                          key={u}
                          onClick={() => toggleFilter('urgency', u)}
                          className={cn(
                            "px-3 py-1 rounded-lg text-[10px] font-bold border transition-all",
                            filters.urgency.includes(u)
                              ? "bg-indigo-600 border-indigo-600 text-white shadow-sm"
                              : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
                          )}
                        >
                          {u}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Tipo</p>
                    <div className="flex flex-wrap gap-2">
                      {['IMPOSTO', 'QUANTIDADE', 'PRECO', 'OUTROS'].map(t => (
                        <button
                          key={t}
                          onClick={() => toggleFilter('type', t)}
                          className={cn(
                            "px-3 py-1 rounded-lg text-[10px] font-bold border transition-all",
                            filters.type.includes(t)
                              ? "bg-indigo-600 border-indigo-600 text-white shadow-sm"
                              : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
                          )}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Faixa de Valor</p>
                    <div className="grid grid-cols-2 gap-2">
                      <input 
                        type="number" 
                        placeholder="Min" 
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-500 transition-all"
                        value={filters.minValue || ''}
                        onChange={(e) => setFilters({ ...filters, minValue: e.target.value ? Number(e.target.value) : null })}
                      />
                      <input 
                        type="number" 
                        placeholder="Max" 
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-500 transition-all"
                        value={filters.maxValue || ''}
                        onChange={(e) => setFilters({ ...filters, maxValue: e.target.value ? Number(e.target.value) : null })}
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative" ref={notifRef}>
          <button 
            onClick={() => setIsNotifOpen(!isNotifOpen)}
            className={cn(
              "p-2.5 text-slate-500 hover:bg-slate-100 rounded-xl transition-colors relative",
              isNotifOpen && "bg-slate-100 text-indigo-600"
            )}
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-2.5 right-2.5 w-4 h-4 bg-rose-500 text-white text-[10px] font-bold rounded-full border-2 border-white flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          <AnimatePresence>
            {isNotifOpen && (
              <motion.div 
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden z-50"
              >
                <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <h3 className="font-bold text-slate-900">Notificações</h3>
                  {unreadCount > 0 && (
                    <button 
                      onClick={onClearAll}
                      className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 uppercase tracking-wider"
                    >
                      Marcar todas como lidas
                    </button>
                  )}
                </div>
                <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                  {notifications.length > 0 ? (
                    notifications.map((notif) => (
                      <div 
                        key={notif.id}
                        onMouseEnter={() => !notif.read && onMarkAsRead(notif.id)}
                        className={cn(
                          "p-4 border-b border-slate-50 hover:bg-slate-50 transition-colors relative group",
                          !notif.read && "bg-indigo-50/30"
                        )}
                      >
                        <div className="flex gap-3">
                          <div className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                            notif.type === 'CREATE' && "bg-emerald-100 text-emerald-600",
                            notif.type === 'UPDATE' && "bg-indigo-100 text-indigo-600",
                            notif.type === 'DELETE' && "bg-rose-100 text-rose-600",
                            notif.type === 'MOVE' && "bg-amber-100 text-amber-600"
                          )}>
                            {notif.type === 'CREATE' && <Plus className="w-4 h-4" />}
                            {notif.type === 'UPDATE' && <Check className="w-4 h-4" />}
                            {notif.type === 'DELETE' && <Trash2 className="w-4 h-4" />}
                            {notif.type === 'MOVE' && <Kanban className="w-4 h-4" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-slate-900 leading-tight">{notif.title}</p>
                            <p className="text-xs text-slate-500 mt-1 line-clamp-2">{notif.message}</p>
                            <p className="text-[10px] text-slate-400 mt-2 font-medium">
                              {formatDistanceToNow(new Date(notif.timestamp), { addSuffix: true, locale: ptBR })}
                            </p>
                          </div>
                        </div>
                        {!notif.read && (
                          <div className="absolute top-4 right-4 w-2 h-2 bg-indigo-600 rounded-full" />
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="p-8 text-center">
                      <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                        <Bell className="w-6 h-6 text-slate-400" />
                      </div>
                      <p className="text-sm font-medium text-slate-500">Nenhuma notificação por aqui.</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        
        <div className="h-8 w-[1px] bg-slate-200 mx-2"></div>

        <button 
          onClick={onProfileClick}
          className="flex items-center gap-3 pl-2 pr-4 py-1.5 hover:bg-slate-50 rounded-2xl transition-all"
        >
          <div className="w-9 h-9 bg-indigo-100 text-indigo-600 rounded-full overflow-hidden flex items-center justify-center font-bold">
            {user?.photoURL ? (
              <img src={user.photoURL} alt="Avatar" referrerPolicy="no-referrer" />
            ) : (
              <span>{user?.displayName?.[0] || user?.email?.[0] || 'U'}</span>
            )}
          </div>
          <div className="text-left hidden sm:block">
            <p className="text-sm font-bold text-slate-900 leading-none truncate max-w-[120px]">
              {user?.displayName || 'Usuário'}
            </p>
            <p className="text-[10px] text-slate-500 font-medium mt-1">
              {userRole === 'administrador' ? 'Administrador' : userRole === 'logística' ? 'Logística' : 'Comprador'}
            </p>
          </div>
        </button>
      </div>
    </header>
  );
};
