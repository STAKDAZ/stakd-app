type PrecastYardMarkProps = {
  compact?: boolean;
  className?: string;
};

export function PrecastYardMark({
  compact = false,
  className = "",
}: PrecastYardMarkProps) {
  return (
    <div
      className={`flex items-center gap-3 ${className}`}
      aria-label="Precast yard mark"
      title="Cast. Cure. Ship."
    >
      <div className="grid grid-cols-3 gap-1" aria-hidden="true">
        <span className="h-3 w-7 border border-cyan-800 bg-cyan-100" />
        <span className="h-3 w-7 border border-cyan-800 bg-cyan-50" />
        <span className="h-3 w-7 border border-cyan-800 bg-cyan-100" />
        <span className="col-start-2 h-3 w-7 border border-cyan-800 bg-cyan-200" />
        <span className="col-start-3 h-3 w-7 border border-cyan-800 bg-cyan-50" />
      </div>
      {!compact ? (
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-900">
            Yard 01
          </div>
          <div className="mt-1 text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500">
            Cast / Cure / Ship
          </div>
        </div>
      ) : null}
    </div>
  );
}
