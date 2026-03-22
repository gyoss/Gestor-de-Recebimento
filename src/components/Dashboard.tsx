import React, { useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line, Legend 
} from 'recharts';
import { TrendingUp, Clock, CheckCircle2, AlertTriangle, DollarSign } from 'lucide-react';
import { Divergence } from '../types';
import { format, parseISO, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DashboardProps {
  divergences: Divergence[];
}

const COLORS = ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899'];
const STATUS_COLORS = {
  RECUPERADO: '#10b981',
  PENDENTE: '#f59e0b'
};

export const Dashboard: React.FC<DashboardProps> = ({ divergences }) => {
  const stats = useMemo(() => {
    const totalValue = divergences.reduce((acc, d) => acc + d.value, 0);
    const recoveredValue = divergences
      .filter(d => d.status === 'CONCLUIDO')
      .reduce((acc, d) => acc + d.value, 0);
    
    const resolutionRate = divergences.length > 0 
      ? (divergences.filter(d => d.status === 'CONCLUIDO').length / divergences.length) * 100 
      : 0;

    const criticalCount = divergences.filter(d => d.urgency === 'ALTA' && d.status !== 'CONCLUIDO').length;

    // Monthly Trend (Last 6 months)
    const last6Months = eachMonthOfInterval({
      start: subMonths(new Date(), 5),
      end: new Date()
    });

    const monthlyData = last6Months.map(date => {
      const monthStr = format(date, 'MMM', { locale: ptBR });
      const monthStart = startOfMonth(date);
      const monthEnd = endOfMonth(date);

      const monthDivergences = divergences.filter(d => {
        const entryDate = parseISO(d.entryDate);
        return entryDate >= monthStart && entryDate <= monthEnd;
      });

      return {
        month: monthStr.charAt(0).toUpperCase() + monthStr.slice(1),
        quantity: monthDivergences.length,
        value: monthDivergences.reduce((acc, d) => acc + d.value, 0)
      };
    });

    // Top Suppliers
    const supplierMap = new Map<string, { count: number; value: number }>();
    divergences.forEach(d => {
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

    const financialStatus = [
      { name: 'Recuperado', value: recoveredValue },
      { name: 'Pendente', value: totalValue - recoveredValue },
    ];

    return {
      totalValue,
      recoveredValue,
      resolutionRate,
      criticalCount,
      monthlyData,
      topSuppliers,
      financialStatus
    };
  }, [divergences]);

  return (
    <div className="space-y-6 pb-8">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-emerald-50 rounded-lg">
              <DollarSign className="w-6 h-6 text-emerald-600" />
            </div>
          </div>
          <p className="text-sm font-medium text-slate-500">Recuperação Financeira</p>
          <h3 className="text-2xl font-bold text-slate-900 mt-1">
            {stats.recoveredValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </h3>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-indigo-50 rounded-lg">
              <CheckCircle2 className="w-6 h-6 text-indigo-600" />
            </div>
          </div>
          <p className="text-sm font-medium text-slate-500">Taxa de Resolução</p>
          <h3 className="text-2xl font-bold text-slate-900 mt-1">{stats.resolutionRate.toFixed(1)}%</h3>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-amber-50 rounded-lg">
              <Clock className="w-6 h-6 text-amber-600" />
            </div>
          </div>
          <p className="text-sm font-medium text-slate-500">Total de Divergências</p>
          <h3 className="text-2xl font-bold text-slate-900 mt-1">{divergences.length}</h3>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-rose-50 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-rose-600" />
            </div>
          </div>
          <p className="text-sm font-medium text-slate-500">Divergências Críticas</p>
          <h3 className="text-2xl font-bold text-slate-900 mt-1">{stats.criticalCount.toString().padStart(2, '0')}</h3>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Trend */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-800 mb-6">Volume Mensal de Divergências</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.monthlyData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  cursor={{ fill: '#f8fafc' }}
                />
                <Bar dataKey="quantity" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Suppliers */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-800 mb-6">Top 5 Fornecedores (Reincidência)</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.topSuppliers} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  axisLine={false} 
                  tickLine={false} 
                  width={120}
                  tick={{ fill: '#64748b', fontSize: 12 }} 
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Financial Status */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-800 mb-6">Status Financeiro (Recuperado vs Pendente)</h3>
          <div className="h-80 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.financialStatus}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={110}
                  paddingAngle={8}
                  dataKey="value"
                >
                  <Cell fill={STATUS_COLORS.RECUPERADO} />
                  <Cell fill={STATUS_COLORS.PENDENTE} />
                </Pie>
                <Tooltip formatter={(value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} />
                <Legend verticalAlign="bottom" height={36}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Value Trend */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-800 mb-6">Evolução de Valores em Divergência</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.monthlyData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                />
                <Line 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#6366f1" 
                  strokeWidth={3} 
                  dot={{ fill: '#6366f1', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
