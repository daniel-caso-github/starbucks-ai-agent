import { useChatStore } from '@/store/chat-store';

export function MessageInput(): JSX.Element {
  const { input, typing, setInput, sendMessage } = useChatStore();

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <div className="flex-none border-t border-surface-200 bg-white px-[18px] py-[13px]">
      <div className="flex items-end gap-[9px] bg-[#F4F8F6] border border-[#E3ECE7] rounded-[14px] px-[15px] py-[7px]">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          disabled={typing}
          placeholder="Escríbele al barista…"
          className="flex-1 border-none bg-transparent outline-none font-normal text-[14px] text-[#1E2A26] py-[7px] disabled:opacity-50"
          aria-label="Mensaje al barista"
        />
        <button
          onClick={() => sendMessage(input)}
          disabled={typing || !input.trim()}
          className="flex-none w-[38px] h-[38px] rounded-[11px] border-none bg-brand-500 text-white cursor-pointer text-[17px] flex items-center justify-center hover:bg-brand-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Enviar mensaje"
        >
          ↑
        </button>
      </div>
    </div>
  );
}
