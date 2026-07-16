export type OrderStatus = 'pending' | 'confirmed' | 'packed' | 'shipped' | 'delivered' | 'cancelled';

export interface OrderItem {
  id: string | number;
  name: string;
  price: number;
  qty: number;
  image: string;
  specs?: string;
}

export interface Address {
  name: string;
  phone: string;
  tag?: string; // e.g., "Home", "Work"
  address: string;
}

export interface OrderSummary {
  subtotal: number;
  delivery: number;
  codFee?: number;
  coupon?: {
    code: string;
    discount: number;
  };
  total: number;
}

export interface OrderData {
  orderNumber: string;
  purchaseDate: string;
  expectedDate: string;
  paymentMethod: string;
  status: OrderStatus;
  items: OrderItem[];
  shippingAddress: Address;
  billingAddress: Address;
  summary: OrderSummary;
}