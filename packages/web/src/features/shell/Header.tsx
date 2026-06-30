import { useUiStore } from '@/store/ui-store';
import { useOrderStore } from '@/store/order-store';
import { BaristaAvatarMd } from './BaristaAvatar';

export function Header(): JSX.Element {
  const { device, layout } = useUiStore();
  const { order, toggleOrder } = useOrderStore();

  const showCartBtn = device === 'desktop' && layout === 'drawer';
  const itemCount = order?.itemCount ?? 0;

  return (
    <div className="flex items-center justify-between px-5 py-[13px] border-b border-surface-200 bg-white flex-none z-10">
      <div className="flex items-center gap-[11px]">
        <div className="w-[38px] h-[38px] rounded-full bg-brand-500 flex items-center justify-center">
          <BaristaAvatarMd />
        </div>
        <div>
          <div className="font-serif text-[19px] text-brand-700 leading-[1.05]">Verde</div>
          <div className="flex items-center gap-[5px] mt-[1px]">
            <span className="w-[6px] h-[6px] rounded-full bg-[#3BA776] animate-pulse_soft" />
            <span className="text-[11.5px] text-muted-400">Barista en línea</span>
          </div>
        </div>
      </div>

      {showCartBtn && itemCount > 0 && (
        <button
          onClick={toggleOrder}
          className="flex items-center gap-2 px-[14px] py-2 rounded-[10px] border border-[#CFE0D7] bg-brand-50 text-brand-500 font-semibold text-[13px] cursor-pointer"
        >
          <span>Tu orden</span>
          <span className="min-w-[20px] h-[20px] px-[6px] rounded-full bg-brand-500 text-white font-bold text-[11px] flex items-center justify-center">
            {itemCount}
          </span>
        </button>
      )}
    </div>
  );
}
