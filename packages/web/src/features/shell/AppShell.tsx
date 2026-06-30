import { useUiStore } from '@/store/ui-store';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps): JSX.Element {
  const { device } = useUiStore();

  if (device === 'mobile') {
    return (
      <div
        style={{
          width: 392,
          height: 792,
          borderRadius: 30,
          boxShadow: '0 30px 80px rgba(20,40,30,.22), 0 0 0 9px #1c2622',
        }}
        className="bg-white flex flex-col overflow-hidden relative"
      >
        {children}
      </div>
    );
  }

  return (
    <div
      className="w-full max-w-[1280px] bg-white flex flex-col overflow-hidden relative"
      style={{
        height: 768,
        borderRadius: 18,
        boxShadow: '0 24px 70px rgba(20,40,30,.16)',
      }}
    >
      {children}
    </div>
  );
}
