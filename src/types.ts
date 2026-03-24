export type DivergenceStatus = 'TRIAGEM' | 'ANALISE' | 'CORRECAO' | 'CONCLUIDO';

export type DivergenceType = 'IMPOSTO' | 'QUANTIDADE' | 'PRECO' | 'FALTA_MERCADORIA' | 'MERCADORIA_INVERTIDA' | 'MERCADORIA_INCORRETA' | 'MODELO_INCORRETO' | 'CNPJ_INCORRETO' | 'OUTROS';

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

export interface TaxDivergence {
  id: string;
  sku?: string;
  description?: string;
  taxName: string;
  value: number;
}

export interface QuantityDivergence {
  id: string;
  sku: string;
  description: string;
  unitValue: number;
  expectedQty: number;
  receivedQty: number;
}

export interface PriceDivergence {
  id: string;
  sku: string;
  description: string;
  qty: number;
  expectedPrice: number;
  invoicedPrice: number;
}

export interface CnpjDivergence {
  expectedCnpj: string;
  invoicedCnpj: string;
}

export interface Attachment {
  id: string;
  name: string;
  url: string;
}

export interface InvertedProductItem {
  sku: string;
  internalCode?: string;
  description: string;
  baseValue: number;
  ipi?: number;
  icmsSt?: number;
  freight?: number;
}

export interface InvertedProduct {
  id: string;
  missing: InvertedProductItem;
  received: InvertedProductItem;
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
  invertedProducts?: InvertedProduct[];
  incorrectTaxes?: TaxDivergence[];
  quantityDivergences?: QuantityDivergence[];
  priceDivergences?: PriceDivergence[];
  cnpjDivergence?: CnpjDivergence;
  attachments?: Attachment[];
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
  internalCode?: string;
  brand?: string;
  purchase?: string;
  whatsapp?: string;
}

export interface Buyer {
  id: string;
  name: string;
  email?: string;
  department?: string;
  username?: string;
  role?: 'comprador' | 'administrador' | 'logística' | string;
  password?: string;
}

export interface GlobalSettings {
  defaultDeadlineDays: number;
  defaultIpi: number;
  defaultIcmsSt: number;
}
