import { useCallback, useEffect, useMemo, useState } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { DrinkCardDto, DrinkTemp } from '@starbucks/shared';
import { cn } from '@/lib/utils';
import { DrinkCard } from './DrinkCard';

interface DrinkCardCarouselProps {
  cards: DrinkCardDto[];
}

const TEMP_CHIPS: { value: 'all' | DrinkTemp; label: string }[] = [
  { value: 'all', label: 'Todo' },
  { value: 'hot', label: 'Caliente' },
  { value: 'iced', label: 'Frío' },
];

export function DrinkCardCarousel({ cards }: DrinkCardCarouselProps): JSX.Element {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: 'start',
    containScroll: 'trimSnaps',
    dragFree: false,
    watchDrag: false,
  });
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);
  const [search, setSearch] = useState('');
  const [tempFilter, setTempFilter] = useState<'all' | DrinkTemp>('all');

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return cards.filter((c) => {
      if (tempFilter !== 'all' && c.temp !== tempFilter) return false;
      if (q && !c.name.toLowerCase().includes(q) && !c.description.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [cards, search, tempFilter]);

  const updateButtons = useCallback(() => {
    if (!emblaApi) return;
    setCanPrev(emblaApi.canScrollPrev());
    setCanNext(emblaApi.canScrollNext());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    updateButtons();
    emblaApi.on('select', updateButtons);
    emblaApi.on('reInit', updateButtons);
  }, [emblaApi, updateButtons]);

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.reInit();
    updateButtons();
  }, [filtered, emblaApi, updateButtons]);

  return (
    <div className="mt-[11px]">
      <div className="flex items-center gap-[8px] mb-[8px]">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar…"
          aria-label="Filtrar bebidas del carrusel"
          className="h-[30px] px-[10px] rounded-[8px] border border-[#DCE7E1] bg-[#F7FAF8] text-[12px] text-[#1E2A26] placeholder:text-muted-400 outline-none focus:border-brand-500 transition-colors w-[160px]"
        />
        <div className="flex gap-[5px]">
          {TEMP_CHIPS.map((chip) => (
            <button
              key={chip.value}
              type="button"
              onClick={() => setTempFilter(chip.value)}
              aria-pressed={tempFilter === chip.value}
              className={cn(
                'px-[10px] py-[4px] rounded-full font-semibold text-[11px] border cursor-pointer transition-colors',
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

      {filtered.length === 0 ? (
        <div className="text-[12px] text-muted-400 py-4">Sin coincidencias.</div>
      ) : (
        <div className="relative" aria-label="Carrusel de bebidas" role="region">
          <div className="overflow-hidden" ref={emblaRef}>
            <div className="flex gap-3 pb-2 px-[2px] items-stretch">
              {filtered.map((card) => (
                <div key={card.drinkId} className="flex-none">
                  <DrinkCard card={card} />
                </div>
              ))}
            </div>
          </div>
          <button
            type="button"
            aria-label="Bebida anterior"
            onClick={() => emblaApi?.scrollPrev()}
            disabled={!canPrev}
            className="hidden sm:flex absolute left-[-12px] top-1/2 -translate-y-1/2 w-9 h-9 items-center justify-center rounded-full bg-white shadow-md border border-[#E0E8E4] disabled:opacity-30 disabled:cursor-not-allowed z-10"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            aria-label="Siguiente bebida"
            onClick={() => emblaApi?.scrollNext()}
            disabled={!canNext}
            className="hidden sm:flex absolute right-[-12px] top-1/2 -translate-y-1/2 w-9 h-9 items-center justify-center rounded-full bg-white shadow-md border border-[#E0E8E4] disabled:opacity-30 disabled:cursor-not-allowed z-10"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}
    </div>
  );
}
