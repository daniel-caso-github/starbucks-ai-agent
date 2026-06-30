import { create } from 'zustand';
import type { DrinkCardDto, OrderSummaryDto } from '@starbucks/shared';
import { openMessageStream } from '@/lib/api/use-message-stream';
import { useOrderStore } from './order-store';

export type MessageRole = 'user' | 'bot';

export type MessageStatus = 'streaming' | 'done' | 'error';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  text: string;
  status: MessageStatus;
  suggestedReplies: string[];
  cards: DrinkCardDto[];
  timestamp: string;
}

function now(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

let _idCounter = 0;
function nextId(): string {
  return String(++_idCounter);
}

const GREETING_MESSAGE: ChatMessage = {
  id: nextId(),
  role: 'bot',
  text: '¡Hola! Soy tu barista en Verde. ¿Qué te preparo hoy?',
  status: 'done',
  suggestedReplies: ['Ver recomendaciones', 'Buscar una bebida', 'Ver menú completo'],
  cards: [],
  timestamp: now(),
};

interface ChatStore {
  messages: ChatMessage[];
  typing: boolean;
  input: string;
  conversationId: string | undefined;
  setInput: (v: string) => void;
  sendMessage: (text: string) => void;
  pushUserMessage: (text: string) => void;
  simulateError: () => void;
  reset: () => void;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  messages: [GREETING_MESSAGE],
  typing: false,
  input: '',
  conversationId: undefined,

  setInput: (input) => set({ input }),

  pushUserMessage: (text) => {
    const msg: ChatMessage = {
      id: nextId(),
      role: 'user',
      text,
      status: 'done',
      suggestedReplies: [],
      cards: [],
      timestamp: now(),
    };
    set((s) => ({ messages: [...s.messages, msg] }));
  },

  sendMessage: (text) => {
    if (!text.trim()) return;
    set({ input: '' });
    get().pushUserMessage(text);

    const botId = nextId();
    const botMsg: ChatMessage = {
      id: botId,
      role: 'bot',
      text: '',
      status: 'streaming',
      suggestedReplies: [],
      cards: [],
      timestamp: now(),
    };
    set((s) => ({ messages: [...s.messages, botMsg], typing: true }));

    let watchdogId: ReturnType<typeof setTimeout> | null = null;

    const closeStream = openMessageStream(
      text,
      get().conversationId,
      (event) => {
        if (event.type === 'text') {
          set((s) => ({
            messages: s.messages.map((m) =>
              m.id === botId ? { ...m, text: m.text + event.data } : m,
            ),
          }));
        } else if (event.type === 'complete') {
          if (watchdogId !== null) { clearTimeout(watchdogId); watchdogId = null; }
          const { conversationId, response, currentOrder, suggestedReplies, cards, openMenu } = event.data;
          set((s) => ({
            conversationId,
            typing: false,
            messages: s.messages.map((m) =>
              m.id === botId
                ? {
                    ...m,
                    status: 'done',
                    text: m.text || response || '',
                    suggestedReplies: suggestedReplies ?? [],
                    cards: cards ?? [],
                  }
                : m,
            ),
          }));
          useOrderStore.getState().setOrder(currentOrder as OrderSummaryDto | null);
          if ((currentOrder as OrderSummaryDto | null)?.status === 'completed') {
            useOrderStore.getState().setSuccessOpen(true);
          }
          if (openMenu) {
            useOrderStore.getState().setMenuOpen(true);
          }
        } else {
          if (watchdogId !== null) { clearTimeout(watchdogId); watchdogId = null; }
          set((s) => ({
            typing: false,
            messages: s.messages.map((m) =>
              m.id === botId ? { ...m, status: 'error', text: '' } : m,
            ),
          }));
        }
        if (event.type !== 'text') {
          closeStream();
        }
      },
    );

    watchdogId = setTimeout(() => {
      closeStream();
      set((s) => ({
        typing: false,
        messages: s.messages.map((m) =>
          m.id === botId ? { ...m, status: 'error', text: '' } : m,
        ),
      }));
    }, 30_000);
  },

  simulateError: () => {
    const msg: ChatMessage = {
      id: nextId(),
      role: 'bot',
      text: '',
      status: 'error',
      suggestedReplies: ['Reintentar'],
      cards: [],
      timestamp: now(),
    };
    set((s) => ({ messages: [...s.messages, msg] }));
  },

  reset: () => {
    set({ messages: [{ ...GREETING_MESSAGE, id: nextId(), timestamp: now() }], typing: false, input: '', conversationId: undefined });
    useOrderStore.getState().reset();
  },
}));
