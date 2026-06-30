import { create } from 'zustand';

export type DeviceType = 'desktop' | 'mobile';
export type LayoutType = 'sidebar' | 'drawer';

interface UiStore {
  device: DeviceType;
  layout: LayoutType;
  setDevice: (device: DeviceType) => void;
  setLayout: (layout: LayoutType) => void;
}

export const useUiStore = create<UiStore>((set) => ({
  device: 'desktop',
  layout: 'sidebar',
  setDevice: (device) => set({ device }),
  setLayout: (layout) => set({ layout }),
}));
