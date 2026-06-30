import { useOrderStore } from '@/store/order-store';
import { useChatStore } from '@/store/chat-store';

export function SuccessModal(): JSX.Element | null {
  const { order, successOpen } = useOrderStore();
  const reset = useChatStore((s) => s.reset);

  if (!successOpen || !order) return null;

  return (
    <div className="fixed inset-0 bg-brand-700/45 z-[95] flex items-center justify-center p-5">
      <div
        className="w-full max-w-[400px] bg-white rounded-[22px] overflow-hidden animate-slide_up"
        style={{ boxShadow: '0 24px 70px rgba(20,40,30,.3)' }}
      >
        <div className="bg-brand-500 px-6 pt-[30px] pb-[26px] text-center">
          <div className="w-[62px] h-[62px] rounded-full bg-white flex items-center justify-center mx-auto mb-[13px]">
            <span className="text-brand-500 text-[30px] font-bold">✓</span>
          </div>
          <div className="font-serif text-[24px] text-white">¡Pago confirmado!</div>
          <div className="text-[13px] text-[#BFE0D0] mt-1">
            Tu pedido está en preparación · ~6 min
          </div>
        </div>

        <div className="px-[22px] pt-[18px] pb-2">
          {order.items.map((it, idx) => (
            <div
              key={idx}
              className="flex justify-between gap-[10px] py-[7px] border-b border-[#F4F7F5]"
            >
              <span className="text-[13px] text-muted-600">
                {it.quantity}× {it.drinkName}{' '}
                {it.size && <span className="text-muted-400">· {it.size}</span>}
              </span>
              <span className="font-semibold text-[13px] text-brand-700">{it.price}</span>
            </div>
          ))}
          <div className="flex justify-between items-baseline py-[13px] pb-1">
            <span className="font-bold text-[15px] text-brand-700">Total pagado</span>
            <span className="font-bold text-[19px] text-brand-500">{order.totalPrice}</span>
          </div>
        </div>

        <div className="px-[22px] pb-[22px] pt-[6px]">
          <button
            onClick={reset}
            className="w-full py-[13px] border-none rounded-xl bg-brand-500 text-white font-bold text-[14px] cursor-pointer hover:bg-brand-700 transition-colors"
          >
            Hacer otro pedido
          </button>
        </div>
      </div>
    </div>
  );
}
