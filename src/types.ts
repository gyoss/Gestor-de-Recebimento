export type DivergenceStatus = 'TRIAGEM' | 'ANALISE' | 'CORRECAO' | 'CONCLUIDO';

export type DivergenceType = 'IMPOSTO' | 'QUANTIDADE' | 'PRECO' | 'FALTA_MERCADORIA' | 'OUTROS';

export interface DivergenceUpdate {
  id: string;
  timestamp: string;
  message: string;
  author: string;
}

export interface MissingProduct {
  id: string;
  sku: string;
  internalCode?: string;
  description: string;
  baseValue: number;
  ipi?: number;
  icmsSt?: number;
  freight?: number;
}

export interface Divergence {
  id: string;
  ownerId: string;
  invoiceId: string;
  supplierName: string;
  value: number;
  entryDate: string;
  deadline: string;
  status: DivergenceStatus;
  urgency: 'BAIXA' | 'MEDIA' | 'ALTA';
  type: DivergenceType;
  description: string;
  buyer: string;
  missingProducts?: MissingProduct[];
  updates?: DivergenceUpdate[];
}

export interface DashboardMetrics {
  totalValue: number;
  totalQuantity: number;
  recoveredValue: number;
  pendingValue: number;
  avgResolutionTime: number; // in days
  monthlyData: {
    month: string;
    quantity: number;
    value: number;
  }[];
  topSuppliers: {
    name: string;
    count: number;
    value: number;
  }[];
}

export interface FilterOptions {
  urgency: string[];
  type: string[];
  status: string[];
  minValue: number | null;
  maxValue: number | null;
}

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'CREATE' | 'UPDATE' | 'DELETE' | 'MOVE';
  timestamp: string;
  read: boolean;
  divergenceId?: string;
}

export interface UserSettings {
  userId: string;
  emailNotifications: boolean;
  systemNotifications: boolean;
}

export interface User {
  userId: string;
  name: string;
  role: 'admin' | 'user';
}

export interface Product {
  id: string;
  sku: string;
  description: string;
  model?: string;
  brand?: string;
  internalCode?: string;
  buyerName?: string;
  supplierName?: string;
}

export interface Supplier {
  id: string;
  cnpj?: string;
  name: string;
  defaultBuyer?: string;
  representative?: string;
  phone?: string;
  email?: string;
  sac?: string;
}

export interface Buyer {
  id: string;
  name: string;
  email?: string;
  department?: string;
}

export interface GlobalSettings {
  defaultDeadlineDays: number;
  defaultIpi: number;
  defaultIcmsSt: number;
}
