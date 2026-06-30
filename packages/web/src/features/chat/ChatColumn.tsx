import { useEffect, useRef } from 'react';
import { useChatStore } from '@/store/chat-store';
import { useOrderStore } from '@/store/order-store';
import { useUiStore } from '@/store/ui-store';
import { MessageBubble } from './MessageBubble';
import { TypingIndicator } from './TypingIndicator';
import { MessageInput } from './MessageInput';

export function ChatColumn(): JSX.Element {
  const messages = useChatStore((s) => s.messages);
  const typing = useChatStore((s) => s.typing);
  const { order, toggleOrder } = useOrderStore();
  const { device } = useUiStore();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  const showPeek = device === 'mobile' && order && order.itemCount > 0;

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#FBFDFC]">
      <div
        className="flex-1 overflow-y-auto px-6 py-[22px] min-h-0"
        aria-live="polite"
        aria-label="Conversación con el barista"
      >
        <div className="max-w-[720px]">
          {messages.map((m, idx) => (
            <div key={m.id} className="mb-4">
              <MessageBubble message={m} isLast={idx === messages.length - 1} />
            </div>
          ))}
          {typing && <TypingIndicator />}
          <div ref={bottomRef} />
        </div>
      </div>

      {showPeek && (
        <button
          onClick={toggleOrder}
          className="flex-none flex items-center justify-between gap-[10px] px-[18px] py-3 border-none border-t border-surface-200 bg-brand-50 cursor-pointer text-left"
        >
          <span className="flex items-center gap-[9px]">
            <span className="min-w-[22px] h-[22px] px-[6px] rounded-full bg-brand-500 text-white font-bold text-[11px] flex items-center justify-center">
              {order?.itemCount}
            </span>
            <span className="font-semibold text-[13px] text-brand-700">Ver tu orden</span>
          </span>
          <span className="flex items-center gap-2 font-bold text-[14px] text-brand-500">
            {order?.totalPrice}
            <span className="text-muted-400 text-[11px]">▲</span>
          </span>
        </button>
      )}

      <MessageInput />
    </div>
  );
}
