import { useOrderStore } from '@/store/order-store';
import { useUiStore } from '@/store/ui-store';

export function Scrim(): JSX.Element | null {
  const { orderOpen, toggleOrder } = useOrderStore();
  const { device, layout } = useUiStore();

  const show = orderOpen && (layout === 'drawer' || device === 'mobile');
  if (!show) return null;

  return (
    <div
      onClick={toggleOrder}
      className="absolute inset-0 bg-brand-700/30 z-30"
      aria-hidden="true"
    />
  );
}
