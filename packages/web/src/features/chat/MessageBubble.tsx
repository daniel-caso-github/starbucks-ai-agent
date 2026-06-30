import type { ChatMessage } from '@/store/chat-store';
import { useChatStore } from '@/store/chat-store';
import { BaristaAvatarSm } from '@/features/shell/BaristaAvatar';
import { DrinkCardCarousel } from '@/features/drink-cards/DrinkCardCarousel';
import { SkeletonCards } from './SkeletonCards';
import { ErrorMessage } from './ErrorMessage';
import { QuickReplies } from './QuickReplies';

interface MessageBubbleProps {
  message: ChatMessage;
  isLast: boolean;
}

export function MessageBubble({ message, isLast }: MessageBubbleProps): JSX.Element {
  const typing = useChatStore((s) => s.typing);
  const lastUserText = useChatStore((s) => {
    const userMsgs = s.messages.filter((m) => m.role === 'user');
    return userMsgs[userMsgs.length - 1]?.text ?? '';
  });
  const sendMessage = useChatStore((s) => s.sendMessage);

  if (message.role === 'user') {
    return (
      <div className="flex flex-col items-end">
        <div className="bg-brand-500 text-white rounded-[16px_16px_4px_16px] px-[14px] py-[11px] text-[14px] leading-[1.5] max-w-[80%]">
          {message.text}
        </div>
        <div className="text-[11px] text-muted-400 mt-[5px]">{message.timestamp}</div>
      </div>
    );
  }

  return (
    <div className="flex gap-[10px] items-start">
      <div className="flex-none w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center mt-[2px]">
        <BaristaAvatarSm />
      </div>
      <div className="flex-1 min-w-0">
        {message.status === 'streaming' && !message.text && (
          <SkeletonCards />
        )}

        {message.text && (
          <div className="bg-white border border-[#E8EEEB] rounded-[4px_16px_16px_16px] px-[14px] py-[11px] text-[14px] leading-[1.55] text-[#26302C] max-w-[600px] shadow-[0_1px_2px_rgba(20,40,30,.04)] inline-block">
            {message.text}
          </div>
        )}

        {message.status === 'error' && (
          <ErrorMessage onRetry={() => sendMessage(lastUserText)} disabled={typing} />
        )}

        {message.cards.length > 0 && message.status === 'done' && (
          <DrinkCardCarousel cards={message.cards} />
        )}

        {isLast && !typing && message.status === 'done' && message.suggestedReplies.length > 0 && (
          <QuickReplies replies={message.suggestedReplies} />
        )}

        <div className="text-[11px] text-muted-400 mt-[6px]">{message.timestamp}</div>
      </div>
    </div>
  );
}
