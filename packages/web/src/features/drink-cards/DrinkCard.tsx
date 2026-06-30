import { useState } from 'react';
import type { DrinkCardDto, DrinkSize } from '@starbucks/shared';
import { useChatStore } from '@/store/chat-store';
import { cn } from '@/lib/utils';

const MILK_LABELS: Record<string, string> = {
  Avena: 'Avena',
  Almendra: 'Almendra',
  Entera: 'Entera',
  '2%': '2%',
  Coco: 'Coco',
  Soya: 'Soya',
};

const SIZE_META: Record<DrinkSize, { label: string; oz: string }> = {
  tall: { label: 'Tall', oz: '12 oz' },
  grande: { label: 'Grande', oz: '16 oz' },
  venti: { label: 'Venti', oz: '20 oz' },
};

interface DrinkCardProps {
  card: DrinkCardDto;
}

export function DrinkCard({ card }: DrinkCardProps): JSX.Element {
  const sendMessage = useChatStore((s) => s.sendMessage);
  const typing = useChatStore((s) => s.typing);

  const defaultSize: DrinkSize =
    card.customizations.sizes.includes('grande') ? 'grande' : card.customizations.sizes[0];
  const [size, setSize] = useState<DrinkSize>(defaultSize);
  const [milk, setMilk] = useState<string | null>(null);
  const [syrup, setSyrup] = useState<string | null>(null);

  const patternColors = card.temp === 'hot'
    ? { t1: '#B08968', t2: '#9C7857' }
    : { t1: '#5B8A9E', t2: '#4A778A' };

  const handleAdd = (): void => {
    const parts = [`Quiero un ${card.name} tamaño ${SIZE_META[size].label.toLowerCase()}`];
    if (milk) parts.push(`con leche de ${milk.toLowerCase()}`);
    if (syrup) parts.push(`y jarabe de ${syrup.toLowerCase()}`);
    sendMessage(parts.join(' '));
  };

  return (
    <div data-testid="drink-card" className="flex-none w-[262px] h-full flex flex-col border border-[#E9EEEB] rounded-[18px] bg-white overflow-hidden shadow-[0_2px_10px_rgba(20,40,30,.05)]">
      <div
        className="h-[118px] relative overflow-hidden"
        style={{
          background: `repeating-linear-gradient(135deg,${patternColors.t1},${patternColors.t1} 8px,${patternColors.t2} 8px,${patternColors.t2} 16px)`,
        }}
      >
        {card.imageUrl && (
          <img
            src={card.imageUrl}
            alt={card.name}
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
        <span
          className={cn(
            'absolute top-[9px] left-[9px] z-10 font-semibold text-[10px] px-2 py-[3px] rounded-full',
            card.temp === 'hot'
              ? 'bg-hot-bg text-hot-500'
              : 'bg-cold-bg text-cold-500',
          )}
        >
          {card.temp === 'hot' ? 'Caliente' : 'Frío'}
        </span>
        {card.relevanceScore !== undefined && (
          <span className="absolute top-[9px] right-[9px] z-10 bg-white/90 text-brand-700 font-mono font-semibold text-[10.5px] px-[7px] py-[3px] rounded-full">
            match {Math.round(card.relevanceScore * 100)}%
          </span>
        )}
      </div>

      <div className="px-[13px] pt-3 pb-[14px] flex-1 flex flex-col">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-semibold text-[14.5px] text-[#1E2A26]">{card.name}</span>
          <span className="font-bold text-[14px] text-brand-500 whitespace-nowrap">
            ${card.price.toFixed(2)}
          </span>
        </div>
        <p className="text-[12px] leading-[1.45] text-muted-400 mt-[5px] min-h-[34px]">
          {card.description}
        </p>

        {card.customizations.sizes.length > 0 && (
          <>
            <div className="font-mono font-semibold text-[10.5px] text-muted-400 tracking-[.05em] mt-[11px] mb-[6px]">
              TAMAÑO
            </div>
            <div className="flex gap-[6px]">
              {card.customizations.sizes.map((s) => (
                <button
                  key={s}
                  onClick={() => setSize(s)}
                  className={cn(
                    'flex-1 py-[7px] px-1 rounded-[11px] flex flex-col items-center gap-[1px] cursor-pointer border transition-colors',
                    size === s
                      ? 'border-brand-500 bg-[#EAF3EE] text-brand-500'
                      : 'border-[#DCE7E1] bg-white text-muted-600',
                  )}
                >
                  <span className="font-semibold text-[12px]">{SIZE_META[s].label}</span>
                  <span className="font-mono text-[9.5px] opacity-75">{SIZE_META[s].oz}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {card.customizations.milks.length > 0 && (
          <>
            <div className="font-mono font-semibold text-[10.5px] text-muted-400 tracking-[.05em] mt-[11px] mb-[6px]">
              LECHE
            </div>
            <div className="flex gap-[6px] flex-wrap">
              {card.customizations.milks.map((m) => (
                <button
                  key={m}
                  onClick={() => setMilk(milk === m ? null : m)}
                  className={cn(
                    'px-[11px] py-[7px] rounded-full font-medium text-[12px] cursor-pointer border transition-colors whitespace-nowrap',
                    milk === m
                      ? 'border-brand-500 bg-brand-500 text-white'
                      : 'border-[#DCE7E1] bg-white text-muted-600',
                  )}
                >
                  {MILK_LABELS[m] ?? m}
                </button>
              ))}
            </div>
          </>
        )}

        {card.customizations.syrups.length > 0 && (
          <>
            <div className="font-mono font-semibold text-[10.5px] text-muted-400 tracking-[.05em] mt-[11px] mb-[6px]">
              JARABE
            </div>
            <div className="flex gap-[6px] flex-wrap">
              {card.customizations.syrups.map((sy) => (
                <button
                  key={sy}
                  onClick={() => setSyrup(syrup === sy ? null : sy)}
                  className={cn(
                    'px-[11px] py-[7px] rounded-full font-medium text-[12px] cursor-pointer border transition-colors whitespace-nowrap',
                    syrup === sy
                      ? 'border-brand-500 bg-brand-500 text-white'
                      : 'border-[#DCE7E1] bg-white text-muted-600',
                  )}
                >
                  {sy}
                </button>
              ))}
            </div>
          </>
        )}

        <button
          onClick={handleAdd}
          disabled={typing}
          className="mt-auto w-full py-[10px] border-none rounded-[11px] bg-brand-500 text-white font-semibold text-[13px] cursor-pointer flex items-center justify-center gap-[6px] hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Agregar a la orden
        </button>
      </div>
    </div>
  );
}
