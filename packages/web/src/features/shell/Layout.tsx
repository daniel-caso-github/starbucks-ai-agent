import { Header } from './Header';
import { Scrim } from './Scrim';
import { ChatColumn } from '@/features/chat/ChatColumn';
import { OrderPanel } from '@/features/order/OrderPanel';

export function Layout(): JSX.Element {
  return (
    <>
      <Header />
      <div className="flex-1 flex relative overflow-hidden min-h-0">
        <ChatColumn />
        <Scrim />
        <OrderPanel />
      </div>
    </>
  );
}
