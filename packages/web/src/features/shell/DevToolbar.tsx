import { useUiStore } from '@/store/ui-store';
import { useChatStore } from '@/store/chat-store';

function SegBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <button
      onClick={onClick}
      className={`px-[13px] py-[7px] border-none rounded-lg font-semibold text-[12px] cursor-pointer transition-colors ${
        active ? 'bg-brand-500 text-white' : 'bg-transparent text-muted-500'
      }`}
    >
      {children}
    </button>
  );
}

export function DevToolbar(): JSX.Element {
  const { device, layout, setDevice, setLayout } = useUiStore();
  const { simulateError, reset } = useChatStore();

  return (
    <div className="w-full max-w-[1280px] flex items-center justify-between gap-[14px] mb-[14px] flex-wrap">
      <div className="flex items-baseline gap-[9px]">
        <span className="font-serif text-[24px] text-brand-700 leading-[1]">Verde</span>
        <span className="font-mono font-medium text-[11px] text-muted-400 tracking-[0.04em]">
          BARISTA · PROTOTIPO
        </span>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <div className="inline-flex gap-[3px] bg-white border border-surface-300 rounded-[10px] p-[3px]">
          <SegBtn active={device === 'desktop'} onClick={() => setDevice('desktop')}>Desktop</SegBtn>
          <SegBtn active={device === 'mobile'} onClick={() => setDevice('mobile')}>Mobile</SegBtn>
        </div>
        <div className="inline-flex gap-[3px] bg-white border border-surface-300 rounded-[10px] p-[3px]">
          <SegBtn active={layout === 'sidebar'} onClick={() => setLayout('sidebar')}>Sidebar</SegBtn>
          <SegBtn active={layout === 'drawer'} onClick={() => setLayout('drawer')}>Drawer</SegBtn>
        </div>
        <button
          onClick={simulateError}
          className="px-3 py-2 border border-[#E6CFC9] rounded-[9px] bg-white text-danger-500 font-semibold text-[12px] cursor-pointer"
        >
          Simular error
        </button>
        <button
          onClick={reset}
          className="px-3 py-2 border border-surface-300 rounded-[9px] bg-white text-muted-500 font-semibold text-[12px] cursor-pointer"
        >
          Reiniciar
        </button>
      </div>
    </div>
  );
}
