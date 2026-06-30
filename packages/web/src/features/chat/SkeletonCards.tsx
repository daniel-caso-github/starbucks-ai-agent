function SkeletonCard(): JSX.Element {
  return (
    <div className="flex-none w-[240px] border border-[#EBF0ED] rounded-2xl p-3 bg-white">
      <div
        className="h-[110px] rounded-xl animate-shim"
        style={{
          background: 'linear-gradient(90deg,#EEF3F1 25%,#E1E9E5 50%,#EEF3F1 75%)',
          backgroundSize: '400px 100%',
        }}
      />
      <div
        className="h-[13px] w-[60%] mt-3 rounded-[5px] animate-shim"
        style={{
          background: 'linear-gradient(90deg,#EEF3F1 25%,#E1E9E5 50%,#EEF3F1 75%)',
          backgroundSize: '400px 100%',
        }}
      />
      <div
        className="h-[11px] w-[85%] mt-2 rounded-[5px] animate-shim"
        style={{
          background: 'linear-gradient(90deg,#EEF3F1 25%,#E1E9E5 50%,#EEF3F1 75%)',
          backgroundSize: '400px 100%',
        }}
      />
    </div>
  );
}

export function SkeletonCards(): JSX.Element {
  return (
    <div className="flex gap-3 mt-[10px] overflow-hidden">
      <SkeletonCard />
      <SkeletonCard />
    </div>
  );
}
