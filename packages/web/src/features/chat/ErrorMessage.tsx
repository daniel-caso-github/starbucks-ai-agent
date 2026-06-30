import { useChatStore } from '@/store/chat-store';

interface ErrorMessageProps {
  onRetry: () => void;
  disabled?: boolean;
}

export function ErrorMessage({ onRetry, disabled }: ErrorMessageProps): JSX.Element {
  return (
    <div className="mt-2 flex items-center gap-[10px] bg-[#FBECE8] border border-[#F0D2CB] rounded-xl px-[13px] py-[11px] max-w-[420px]">
      <span className="flex-none w-[22px] h-[22px] rounded-full bg-danger-600 text-white font-bold text-[13px] flex items-center justify-center">
        !
      </span>
      <span className="text-[13px] text-[#8A3A29] leading-[1.4] flex-1">
        No pude conectar con la cocina. Revisa tu conexión e inténtalo de nuevo.
      </span>
      <button
        onClick={onRetry}
        disabled={disabled}
        className="flex-none text-[12px] font-semibold text-brand-500 cursor-pointer border-none bg-transparent disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Reintentar
      </button>
    </div>
  );
}

export function useRetry(text: string): () => void {
  const sendMessage = useChatStore((s) => s.sendMessage);
  return () => sendMessage(text);
}
