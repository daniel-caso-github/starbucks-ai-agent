import { useChatStore } from '@/store/chat-store';

interface QuickRepliesProps {
  replies: string[];
}

export function QuickReplies({ replies }: QuickRepliesProps): JSX.Element | null {
  const sendMessage = useChatStore((s) => s.sendMessage);
  const typing = useChatStore((s) => s.typing);
  if (!replies.length) return null;
  return (
    <div className="flex gap-2 flex-wrap mt-[11px]">
      {replies.map((r) => (
        <button
          key={r}
          onClick={() => sendMessage(r)}
          disabled={typing}
          className="px-[14px] py-2 border border-[#CDE0D6] bg-white text-brand-500 rounded-full font-semibold text-[12.5px] cursor-pointer hover:bg-brand-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {r}
        </button>
      ))}
    </div>
  );
}
