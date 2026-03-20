export type Role = 'EMPLOYEE' | 'MASTER' | null;

export interface Product {
  id: string;
  name: string;
  price: number; // Unit price
  category: string;
  stock: number; // Current available stock in warehouse
  reserved?: number; // Stock currently reserved in pending orders
}

export interface InventoryItem {
  product: Product;
  prepared: number;
  consumed: number;
}

export interface DailyLog {
  id: string;
  date: string; // ISO date string YYYY-MM-DD
  status: 'PENDING_PEDIDO' | 'OPEN' | 'CLOSED' | 'APPROVED' | 'REJECTED';
  items: InventoryItem[];
  eventTitle?: string;
}

export interface EventType {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  description?: string;
  type: 'EVENT' | 'ORDER';
}

export interface AppState {
  role: Role;
  products: Product[];
  categories?: string[];
  events?: EventType[];
  activeLogs: DailyLog[]; // Array mapping dates to their active logs (PENDING_PEDIDO, OPEN, CLOSED)
  historicalLogs: DailyLog[]; // Approved/Past logs for master dashboard
}
