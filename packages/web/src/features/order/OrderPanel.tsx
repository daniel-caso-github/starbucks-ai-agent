import type { OrderStatus } from '@starbucks/shared';
import { useOrderStore } from '@/store/order-store';
import { useUiStore } from '@/store/ui-store';
import { useChatStore } from '@/store/chat-store';
import { cn } from '@/lib/utils';

const STATUS_META: Record<
  OrderStatus | 'empty',
  { label: string; color: string; bg: string }
> = {
  empty: { label: 'Vacía', color: '#90A099', bg: '#F0F4F2' },
  pending: { label: 'Pendiente', color: '#B8772A', bg: '#FBF1E3' },
  confirmed: { label: 'Confirmada', color: '#006241', bg: '#E4F2EB' },
  completed: { label: 'Completada', color: '#1E3932', bg: '#E4F2EB' },
  cancelled: { label: 'Cancelada', color: '#C0432F', bg: '#FBE9E6' },
};

function DrinkThumb({ temp, imageUrl }: { temp?: string; imageUrl?: string }): JSX.Element {
  const isHot = temp !== 'iced';
  const t1 = isHot ? '#B08968' : '#5B8A9E';
  const t2 = isHot ? '#9C7857' : '#4A778A';
  return (
    <div
      className="relative flex-none w-[46px] h-[46px] rounded-[11px] overflow-hidden"
      style={{
        background: `repeating-linear-gradient(135deg,${t1},${t1} 8px,${t2} 8px,${t2} 16px)`,
      }}
    >
      {imageUrl && (
        <img
          src={imageUrl}
          alt=""
          loading="lazy"
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}
    </div>
  );
}

export function OrderPanel(): JSX.Element {
  const { order, orderOpen, toggleOrder, setSuccessOpen } = useOrderStore();
  const { device, layout } = useUiStore();
  const sendMessage = useChatStore((s) => s.sendMessage);
  const reset = useChatStore((s) => s.reset);
  const typing = useChatStore((s) => s.typing);

  const isMobile = device === 'mobile';
  const isDrawer = layout === 'drawer';

  let wrapperClass = '';
  let wrapperStyle: React.CSSProperties = {};

  if (!isMobile && !isDrawer) {
    wrapperClass = 'relative w-[364px] flex-none flex flex-col bg-white border-l border-[#E7EEEA] h-full';
  } else if (!isMobile && isDrawer) {
    wrapperClass =
      'absolute top-0 right-0 bottom-0 w-[386px] flex flex-col bg-white border-l border-[#E7EEEA] z-40';
    wrapperStyle = {
      boxShadow: '-16px 0 50px rgba(20,40,30,.12)',
      transform: `translateX(${orderOpen ? '0' : '101%'})`,
      transition: 'transform .32s cubic-bezier(.4,0,.2,1)',
    };
  } else {
    wrapperClass =
      'absolute left-0 right-0 bottom-0 max-h-[80%] flex flex-col bg-white z-40 rounded-t-[22px]';
    wrapperStyle = {
      boxShadow: '0 -16px 50px rgba(20,40,30,.18)',
      transform: `translateY(${orderOpen ? '0' : '101%'})`,
      transition: 'transform .32s cubic-bezier(.4,0,.2,1)',
    };
  }

  const statusKey = (order?.status ?? 'empty') as OrderStatus | 'empty';
  const meta = STATUS_META[statusKey];

  return (
    <div className={wrapperClass} style={wrapperStyle} aria-label="Panel de tu orden">
      <div className="flex-none flex items-center justify-between px-[18px] py-[16px] pb-[13px] border-b border-[#EEF2F0]">
        <div className="flex items-center gap-[9px]">
          <span className="font-bold text-[15px] text-brand-700">Tu orden</span>
          <span
            className="font-semibold text-[10.5px] px-[9px] py-[3px] rounded-full"
            style={{ background: meta.bg, color: meta.color }}
          >
            {meta.label}
          </span>
        </div>
        {(isDrawer || isMobile) && (
          <button
            onClick={toggleOrder}
            className="border-none bg-[#F0F4F2] w-[28px] h-[28px] rounded-[8px] cursor-pointer text-muted-500 text-[15px] flex items-center justify-center"
            aria-label="Cerrar panel de orden"
          >
            ✕
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-[14px] min-h-0">
        {!order || order.items.length === 0 ? (
          <div className="h-full min-h-[220px] flex flex-col items-center justify-center text-center p-5">
            <div className="w-[66px] h-[66px] rounded-full bg-brand-50 flex items-center justify-center mb-[14px]">
              <div className="relative w-[26px] h-[22px]">
                <div className="absolute left-0 top-[2px] w-[20px] h-[17px] border-2 border-[#B7CCC1] rounded-[2px_2px_6px_6px]" />
                <div className="absolute right-0 top-[5px] w-[9px] h-[9px] border-2 border-[#B7CCC1] rounded-full" />
              </div>
            </div>
            <div className="font-semibold text-[14px] text-muted-600">Tu orden está vacía</div>
            <div className="text-[12.5px] text-muted-400 mt-[5px] leading-[1.5] max-w-[200px]">
              Pídele algo al barista y lo verás aparecer aquí en tiempo real.
            </div>
          </div>
        ) : (
          <div>
            {order.items.map((item, idx) => (
              <div
                key={idx}
                className="flex gap-[11px] py-3 border-b border-[#F1F5F3]"
              >
                <DrinkThumb temp={item.temp} imageUrl={item.imageUrl} />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between gap-2">
                    <span className="font-semibold text-[13.5px] text-[#1E2A26]">
                      {item.drinkName}
                    </span>
                    <span className="font-bold text-[13px] text-brand-700 whitespace-nowrap">
                      {item.price}
                    </span>
                  </div>
                  <div className="text-[11.5px] text-muted-400 mt-[2px]">
                    {[
                      item.size,
                      item.customizations.milk,
                      item.customizations.syrup,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center border border-[#E0E8E4] rounded-[9px] overflow-hidden">
                      <button
                        onClick={() => sendMessage(`quitar uno de ${item.drinkName}`)}
                        disabled={typing}
                        className="w-[26px] h-[26px] border-none bg-white cursor-pointer text-muted-600 text-[15px] disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        −
                      </button>
                      <span className="min-w-[24px] text-center font-semibold text-[12.5px] text-[#1E2A26]">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => sendMessage(`agregar otro ${item.drinkName}`)}
                        disabled={typing}
                        className="w-[26px] h-[26px] border-none bg-white cursor-pointer text-muted-600 text-[15px] disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        +
                      </button>
                    </div>
                    <button
                      onClick={() => sendMessage(`eliminar ${item.drinkName} de mi orden`)}
                      disabled={typing}
                      className="border-none bg-transparent text-danger-500 font-medium text-[12px] cursor-pointer px-[6px] py-1 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Quitar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {order && order.items.length > 0 && (
        <div className="flex-none border-t border-[#EEF2F0] px-4 pt-[14px] pb-4 bg-white">
          <div className="flex justify-between text-[12.5px] text-muted-400 mb-[5px]">
            <span>Subtotal · {order.itemCount} bebidas</span>
            <span>{order.totalPrice}</span>
          </div>
          <div className="flex justify-between items-baseline mb-[13px]">
            <span className="font-bold text-[15px] text-brand-700">Total</span>
            <span className="font-bold text-[19px] text-brand-500">{order.totalPrice}</span>
          </div>

          {order.status === 'pending' && order.canConfirm && (
            <button
              onClick={() => sendMessage('confirmar mi orden')}
              disabled={typing}
              className="w-full py-[13px] border-none rounded-xl bg-brand-500 text-white font-bold text-[14px] cursor-pointer hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Confirmar orden
            </button>
          )}
          {order.status === 'confirmed' && (
            <button
              onClick={() => sendMessage('proceder al pago')}
              disabled={typing}
              className="w-full py-[13px] border-none rounded-xl bg-brand-500 text-white font-bold text-[14px] cursor-pointer hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Pagar {order.totalPrice}
            </button>
          )}
          {(order.status === 'completed' || order.status === 'cancelled') && (
            <button
              onClick={reset}
              className="w-full py-[13px] border-none rounded-xl bg-brand-500 text-white font-bold text-[14px] cursor-pointer hover:bg-brand-700 transition-colors"
            >
              Nueva orden
            </button>
          )}
          {(order.status === 'pending' || order.status === 'confirmed') && (
            <button
              onClick={() => sendMessage('cancelar mi orden')}
              disabled={typing}
              className="w-full mt-2 py-[11px] border border-[#E6CFC9] rounded-xl bg-white text-danger-500 font-semibold text-[13px] cursor-pointer hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancelar orden
            </button>
          )}
        </div>
      )}
    </div>
  );
}
