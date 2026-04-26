export type Role = 'EMPLOYEE' | 'MASTER' | 'VIEWER' | null;

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

export type BackupTrigger =
  | 'manual'
  | 'auto-approve'
  | 'auto-reject'
  | 'auto-edit-historical'
  | 'auto-edit-total'
  | 'auto-delete'
  | 'auto-restore'
  | 'scheduled';

export interface BackupSnapshot {
  id: string;
  created_at: string;
  label: string | null;
  trigger_type: BackupTrigger;
  description: string | null;
  products_count: number | null;
  events_count: number | null;
  daily_logs_count: number | null;
  log_items_count: number | null;
  size_bytes: number | null;
  payload?: {
    fecha: string;
    products: Product[];
    events: EventType[];
    daily_logs: any[];
    log_items: any[];
  };
}
