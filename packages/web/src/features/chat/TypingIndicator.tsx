import { BaristaAvatarSm } from '@/features/shell/BaristaAvatar';

export function TypingIndicator(): JSX.Element {
  return (
    <div className="flex gap-[10px] items-start mb-4">
      <div className="flex-none w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center mt-[2px]">
        <BaristaAvatarSm />
      </div>
      <div className="bg-white border border-[#E8EEEB] rounded-[4px_16px_16px_16px] px-[15px] py-[13px] flex gap-[5px] items-center">
        <span className="w-[7px] h-[7px] rounded-full bg-[#9DBBAD] animate-blink [animation-delay:0s]" />
        <span className="w-[7px] h-[7px] rounded-full bg-[#9DBBAD] animate-blink [animation-delay:.2s]" />
        <span className="w-[7px] h-[7px] rounded-full bg-[#9DBBAD] animate-blink [animation-delay:.4s]" />
      </div>
    </div>
  );
}
