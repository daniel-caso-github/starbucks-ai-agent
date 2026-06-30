import { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppShell } from '@/features/shell/AppShell';
import { DevToolbar } from '@/features/shell/DevToolbar';
import { Layout } from '@/features/shell/Layout';
import { MenuModal } from '@/features/menu/MenuModal';
import { SuccessModal } from '@/features/checkout/SuccessModal';
import { useChatStore } from '@/store/chat-store';

const queryClient = new QueryClient();

function BaristApp(): JSX.Element {
  const { messages, sendMessage } = useChatStore();

  useEffect(() => {
    if (messages.length === 0) {
      sendMessage('hola');
    }
  }, []);

  return (
    <div className="min-h-screen bg-surface-100 font-sans flex flex-col items-center px-4 py-[18px] pb-[30px]">
      {import.meta.env.DEV && <DevToolbar />}
      <AppShell>
        <Layout />
      </AppShell>
      <MenuModal />
      <SuccessModal />
    </div>
  );
}

export default function App(): JSX.Element {
  return (
    <QueryClientProvider client={queryClient}>
      <BaristApp />
    </QueryClientProvider>
  );
}
