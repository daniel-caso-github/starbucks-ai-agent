import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { DrinkTemp } from '@starbucks/shared';
import { useOrderStore } from '@/store/order-store';
import { useChatStore } from '@/store/chat-store';
import { getMenu } from '@/lib/api/drinks';
import { cn } from '@/lib/utils';

const TEMP_CHIPS: { value: 'all' | DrinkTemp; label: string }[] = [
  { value: 'all', label: 'Todo' },
  { value: 'hot', label: 'Caliente' },
  { value: 'iced', label: 'Frío' },
];

export function MenuModal(): JSX.Element | null {
  const { menuOpen, setMenuOpen } = useOrderStore();
  const sendMessage = useChatStore((s) => s.sendMessage);
  const typing = useChatStore((s) => s.typing);

  const [search, setSearch] = useState('');
  const [tempFilter, setTempFilter] = useState<'all' | DrinkTemp>('all');

  const { data } = useQuery({
    queryKey: ['drinks-menu'],
    queryFn: getMenu,
    enabled: menuOpen,
    staleTime: 5 * 60 * 1000,
  });

  const filtered = useMemo(() => {
    const drinks = data?.drinks ?? [];
    const q = search.toLowerCase().trim();
    return drinks.filter((d) => {
      if (tempFilter !== 'all' && d.temp !== tempFilter) return false;
      if (q && !d.name.toLowerCase().includes(q) && !d.description.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [data, search, tempFilter]);

  if (!menuOpen) return null;

  return (
    <div
      onClick={() => setMenuOpen(false)}
      className="fixed inset-0 bg-brand-700/40 z-[90] flex items-end justify-center"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[560px] max-h-[84vh] bg-white rounded-t-[22px] flex flex-col overflow-hidden"
        style={{ boxShadow: '0 -20px 60px rgba(20,40,30,.25)' }}
      >
        <div className="flex-none flex items-center justify-between px-5 pt-[18px] pb-[14px] border-b border-[#EEF2F0]">
          <div>
            <div className="font-serif text-[21px] text-brand-700">Menú completo</div>
            <div className="font-mono font-medium text-[11.5px] text-muted-400">
              {data?.total ?? '…'} bebidas
            </div>
          </div>
          <button
            onClick={() => setMenuOpen(false)}
            className="border-none bg-[#F0F4F2] w-8 h-8 rounded-[9px] cursor-pointer text-muted-500 text-[16px] flex items-center justify-center"
            aria-label="Cerrar menú"
          >
            ✕
          </button>
        </div>

        <div className="flex-none px-[14px] py-[10px] border-b border-[#EEF2F0] flex flex-col gap-[8px]">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar bebida…"
            aria-label="Buscar bebida"
            className="w-full h-[36px] px-[12px] rounded-[10px] border border-[#DCE7E1] bg-[#F7FAF8] text-[13px] text-[#1E2A26] placeholder:text-muted-400 outline-none focus:border-brand-500 transition-colors"
          />
          <div className="flex gap-[6px]">
            {TEMP_CHIPS.map((chip) => (
              <button
                key={chip.value}
                type="button"
                onClick={() => setTempFilter(chip.value)}
                aria-pressed={tempFilter === chip.value}
                data-testid={`menu-temp-filter-${chip.value}`}
                className={cn(
                  'px-[13px] py-[5px] rounded-full font-semibold text-[12px] border cursor-pointer transition-colors',
                  tempFilter === chip.value
                    ? 'border-brand-500 bg-brand-500 text-white'
                    : 'border-[#DCE7E1] bg-white text-muted-600',
                )}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-[14px] pt-2 pb-[18px]">
          {filtered.length === 0 ? (
            <div
              data-testid="menu-empty"
              className="text-center text-muted-400 text-[13px] py-10"
            >
              No encontramos bebidas con esos criterios.
            </div>
          ) : (
            filtered.map((d) => (
              <div
                key={d.id}
                data-testid="menu-item"
                className="flex gap-3 items-center py-[11px] px-[6px] border-b border-[#F4F7F5]"
              >
                <div
                  className="flex-none w-[50px] h-[50px] rounded-xl overflow-hidden"
                  style={{
                    background: d.temp === 'iced'
                      ? 'repeating-linear-gradient(135deg,#5B8A9E,#5B8A9E 8px,#4A778A 8px,#4A778A 16px)'
                      : 'repeating-linear-gradient(135deg,#B08968,#B08968 8px,#9C7857 8px,#9C7857 16px)',
                  }}
                >
                  {d.imageUrl && (
                    <img
                      src={d.imageUrl}
                      alt={d.name}
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[14px] text-[#1E2A26]">{d.name}</span>
                    <span
                      className={`text-[9.5px] font-semibold px-[7px] py-[2px] rounded-full ${
                        d.temp === 'iced'
                          ? 'bg-cold-bg text-cold-500'
                          : 'bg-hot-bg text-hot-500'
                      }`}
                    >
                      {d.temp === 'iced' ? 'Frío' : 'Caliente'}
                    </span>
                  </div>
                  <div className="text-[12px] text-muted-400 mt-[2px] truncate">{d.description}</div>
                </div>
                <div className="flex-none flex flex-col items-end gap-[6px]">
                  <span className="font-bold text-[13.5px] text-brand-500">
                    {d.basePrice}
                  </span>
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      sendMessage(`agregar un ${d.name} grande`);
                    }}
                    disabled={typing}
                    className="px-[13px] py-[6px] border border-[#CFE0D7] rounded-[9px] bg-brand-50 text-brand-500 font-semibold text-[12px] cursor-pointer hover:bg-brand-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Agregar
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
