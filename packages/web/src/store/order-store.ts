import { create } from 'zustand';
import type { OrderSummaryDto } from '@starbucks/shared';

interface OrderStore {
  order: OrderSummaryDto | null;
  orderOpen: boolean;
  successOpen: boolean;
  menuOpen: boolean;
  setOrder: (order: OrderSummaryDto | null) => void;
  toggleOrder: () => void;
  setOrderOpen: (open: boolean) => void;
  setSuccessOpen: (open: boolean) => void;
  setMenuOpen: (open: boolean) => void;
  reset: () => void;
}

export const useOrderStore = create<OrderStore>((set) => ({
  order: null,
  orderOpen: false,
  successOpen: false,
  menuOpen: false,
  setOrder: (order) => set({ order }),
  toggleOrder: () => set((s) => ({ orderOpen: !s.orderOpen })),
  setOrderOpen: (orderOpen) => set({ orderOpen }),
  setSuccessOpen: (successOpen) => set({ successOpen }),
  setMenuOpen: (menuOpen) => set({ menuOpen }),
  reset: () => set({ order: null, orderOpen: false, successOpen: false, menuOpen: false }),
}));
