export function BaristaAvatarSm(): JSX.Element {
  return (
    <div className="relative w-[15px] h-[12px]">
      <div className="absolute left-0 top-[1px] w-[11px] h-[9px] border-[1.8px] border-brand-500 rounded-[1px_1px_3px_3px]" />
      <div className="absolute right-0 top-[2px] w-[5px] h-[5px] border-[1.8px] border-brand-500 rounded-full" />
      <div className="absolute -left-[1px] -bottom-[2px] w-[13px] h-[1.8px] bg-brand-500 rounded" />
    </div>
  );
}

export function BaristaAvatarMd(): JSX.Element {
  return (
    <div className="relative w-[17px] h-[14px]">
      <div className="absolute left-0 top-[1px] w-[13px] h-[11px] border-2 border-white rounded-[1px_1px_4px_4px]" />
      <div className="absolute right-0 top-[3px] w-[6px] h-[6px] border-2 border-white rounded-full" />
      <div className="absolute -left-[1px] -bottom-[3px] w-[15px] h-[2px] bg-white rounded" />
    </div>
  );
}
