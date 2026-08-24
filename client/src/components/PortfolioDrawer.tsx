/**
 * Inkfield Menagerie: the drawer is the only control surface; it stays quiet,
 * precise, and off-canvas until the visitor asks for the field’s accounting.
 */

import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { FileUp, Pause, Play } from "lucide-react";
import flagIcon from "@/assets/checkered-flag.svg";
import { VISUAL_LENS_COPY, type VisualLens } from "@/lib/portfolioVisuals";

type ViewMode = "holdings" | "transactions";
type TaxFilter = "all" | "highlight" | "isolate";

type PortfolioDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  visualLens: VisualLens;
  setVisualLens: (lens: VisualLens) => void;
  taxFilter: TaxFilter;
  setTaxFilter: (filter: TaxFilter) => void;
  showEtfs: boolean;
  setShowEtfs: (value: boolean) => void;
  darkMode: boolean;
  etfLotCount: number;
  frozen: boolean;
  setFrozen: (value: boolean | ((current: boolean) => boolean)) => void;
  reducedMotion: boolean;
  repulsion: number;
  setRepulsion: (value: number) => void;
  gravityOn: boolean;
  setGravityOn: (value: boolean | ((current: boolean) => boolean)) => void;
  showPnlBadges: boolean;
  setShowPnlBadges: (value: boolean) => void;
  /** Ref to the litterbox toggle rendered inside Home's icon cluster. */
  litterboxRef: React.RefObject<HTMLButtonElement | null>;
  onImportFile: (file?: File) => void;
  uploadNotice: { kind: "error" | "success"; message: string } | null;
  hasDates: boolean;
  onRestore: () => void;
  visibleKittyCount: number;
  loadedLotCount: number;
};

export default function PortfolioDrawer({
  open, onOpenChange, viewMode, setViewMode, visualLens, setVisualLens, taxFilter,
  setTaxFilter, showEtfs, setShowEtfs, darkMode, litterboxRef,
  etfLotCount, frozen, setFrozen, reducedMotion, repulsion, setRepulsion,
  gravityOn, setGravityOn, showPnlBadges, setShowPnlBadges, onImportFile,
  uploadNotice, hasDates, onRestore, visibleKittyCount, loadedLotCount,
}: PortfolioDrawerProps) {
  const setOpen = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) requestAnimationFrame(() => litterboxRef.current?.focus());
  };

  return (
    <Sheet modal={false} open={open} onOpenChange={setOpen}>
      {/* The litterbox toggle itself renders in Home's consolidated icon
          cluster; this sheet only hosts the controls pane. */}
      <SheetContent id="portfolio-controls-pane" side="right" aria-describedby={undefined} onPointerDownOutside={(event) => {
        if ((event.target as Element | null)?.closest?.('[aria-controls="portfolio-controls-pane"]')) event.preventDefault();
      }} className={darkMode ? "w-[min(468px,94vw)] gap-0 overflow-hidden border-l border-[#25383d] bg-[#101617] p-0 pt-[9rem] shadow-none sm:max-w-none [&>button]:right-3 [&>button]:top-3 [&>button]:grid [&>button]:h-11 [&>button]:w-11 [&>button]:place-items-center [&>button]:rounded-full [&>button]:opacity-100" : "w-[min(468px,94vw)] gap-0 overflow-hidden border-l border-stone-200 bg-[#faf9f5] p-0 pt-[9rem] shadow-none sm:max-w-none [&>button]:right-3 [&>button]:top-3 [&>button]:grid [&>button]:h-11 [&>button]:w-11 [&>button]:place-items-center [&>button]:rounded-full [&>button]:opacity-100"}>
        <SheetTitle className="sr-only">Portfolio controls</SheetTitle>
        <div className="space-y-7 overflow-y-auto px-6 pb-10 pt-6">
          <section><p className="control-label">Holdings</p><div className="mt-3 grid grid-cols-2 rounded-xl border border-stone-200 bg-white p-1">{([ ["holdings", "Group"], ["transactions", "Transactions"] ] as const).map(([mode, label]) => <button key={mode} type="button" onClick={() => setViewMode(mode)} className={viewMode === mode ? "min-h-11 rounded-lg bg-stone-900 px-2 py-2.5 font-mono text-[10px] text-white shadow-sm" : "min-h-11 rounded-lg px-2 py-2.5 font-mono text-[10px] text-stone-600 transition hover:text-stone-900"}>{label}</button>)}</div><div className="mt-3 flex items-center justify-between font-mono text-[10px]"><span className="text-stone-500">{visibleKittyCount} kitties · {loadedLotCount} total lots</span></div>{viewMode === "transactions" && <p className="mt-2 font-mono text-[9px] leading-4 text-stone-500">← older · drag the field · newer →</p>}</section>
          <section className="rounded-xl border border-stone-200 bg-white px-4 py-3">
            <div className="flex items-center justify-between gap-4"><div><p className="control-label text-stone-600">Instruments</p><label htmlFor="show-etfs" className="mt-1 block font-mono text-[10px] text-stone-700">Include ETFs</label><p className="mt-1 font-mono text-[9px] text-stone-400">{showEtfs ? `Shares + ${etfLotCount} ETF lots visible.` : `${etfLotCount} ETF lots hidden; field recomposed.`}</p></div><Switch id="show-etfs" checked={showEtfs} onCheckedChange={setShowEtfs} aria-label="Include ETFs in the portfolio field" /></div>
          </section>
          <section><p className="control-label">Visual lens</p><div className="mt-3 grid gap-2">{(Object.entries(VISUAL_LENS_COPY) as [VisualLens, (typeof VISUAL_LENS_COPY)[VisualLens]][]).map(([lens, copy]) => <button key={lens} type="button" aria-pressed={visualLens === lens} onClick={() => setVisualLens(lens)} className={visualLens === lens ? "min-h-11 rounded-xl bg-stone-900 px-3 py-2 text-left font-mono text-[10px] text-white shadow-sm" : "min-h-11 rounded-xl border border-stone-200 bg-white px-3 py-2 text-left font-mono text-[10px] text-stone-600 transition hover:border-stone-400 hover:text-stone-900"}><span className="block font-semibold">{copy.label}</span><span className={visualLens === lens ? "mt-1 block text-[9px] text-stone-300" : "mt-1 block text-[9px] text-stone-400"}>{copy.color}</span></button>)}</div><p className="mt-2 font-mono text-[9px] leading-4 text-stone-400">One lens controls size, pigment, and emphasis together. Portfolio impact is the default.</p></section>
          <section><p className="control-label">Tax-loss lens</p><div className="mt-3 grid grid-cols-3 rounded-xl border border-stone-200 bg-white p-1">{([ ["all", "All"], ["highlight", "Mark"], ["isolate", "Only"] ] as const).map(([filter, label]) => <button key={filter} type="button" onClick={() => setTaxFilter(filter)} className={taxFilter === filter ? "rounded-lg bg-[#D8AE37] px-1 py-2.5 font-mono text-[10px] text-stone-900 shadow-sm" : "rounded-lg px-1 py-2.5 font-mono text-[10px] text-stone-500 transition hover:text-stone-900"}>{label}</button>)}</div><p className="mt-2 font-mono text-[9px] leading-4 text-stone-400">Gold rings flag loss lots dated 330+ days ago.</p></section>
          <section><div className="flex items-center justify-between"><p className="control-label">Field motion</p><button type="button" onClick={() => setFrozen((current) => !current)} disabled={reducedMotion} aria-disabled={reducedMotion} title={reducedMotion ? "Paused by your system reduced-motion setting" : undefined} className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-2.5 py-1.5 font-mono text-[9px] uppercase tracking-[.11em] text-stone-600 transition hover:border-stone-400 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-stone-200">{reducedMotion ? <Pause size={11} /> : frozen ? <Play size={11} /> : <Pause size={11} />}{reducedMotion ? "Reduced motion" : frozen ? "Resume" : "Freeze"}</button></div>{reducedMotion && <p className="mt-2 font-mono text-[9px] leading-4 text-stone-400">Your system prefers reduced motion, so the field stays still. Turn that off in your OS settings to animate.</p>}<div className="mt-4 flex items-center gap-3"><span className="font-mono text-[10px] text-stone-500">Soft</span><input aria-label="Repulsion strength" type="range" min="0.2" max="2.6" step="0.05" value={repulsion} onChange={(event) => setRepulsion(Number(event.target.value))} className="kitty-range flex-1" /><span className="font-mono text-[10px] text-stone-500">Spacious</span></div></section>
          <section><div className="flex items-center justify-between gap-4"><div><p className="control-label">Layout</p><label htmlFor="gravity-toggle" className="mt-1 block font-mono text-[10px] text-stone-700">Gravity</label><p className="mt-1 font-mono text-[9px] leading-4 text-stone-400">Heavier holdings settle lower.</p></div><Switch id="gravity-toggle" checked={gravityOn} onCheckedChange={setGravityOn} disabled={viewMode !== "holdings"} aria-disabled={viewMode !== "holdings"} aria-label="Gravity layout for Group view" /></div>{viewMode !== "holdings" && <p className="mt-2 font-mono text-[9px] leading-4 text-stone-400">Group view only — Transactions keeps its timeline lanes.</p>}</section>
          <section><p className="control-label">Accessibility</p><div className="mt-1 flex items-center justify-between gap-4 rounded-xl border border-stone-200 bg-white px-4 py-3"><div><label htmlFor="show-pnl-badges" className="block font-mono text-[10px] text-stone-700">Show +/− badges</label><p className="mt-1 font-mono text-[9px] leading-4 text-stone-400">Marks profit/loss without relying on colour.</p></div><Switch id="show-pnl-badges" checked={showPnlBadges} onCheckedChange={setShowPnlBadges} aria-label="Show plus and minus badges on kitties" /></div></section>
          <section><p className="control-label">Portfolio CSV</p><label className="mt-3 flex cursor-pointer items-center justify-between rounded-xl border border-dashed border-stone-400 bg-white px-4 py-4 transition hover:border-stone-600 hover:bg-stone-50" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); onImportFile(event.dataTransfer.files[0]); }}><span><span className="block font-mono text-[10px] uppercase tracking-[.12em] text-stone-700">Import or drop a file</span><span className="mt-1 block font-mono text-[9px] text-stone-500">company · buy_qty · avg_price · current_price · optional prev_close_price · txn_date</span></span><FileUp size={18} className="text-stone-600" /><input type="file" accept=".csv,text/csv" className="sr-only" onChange={(event) => onImportFile(event.target.files?.[0])} /></label>{uploadNotice && <p className={uploadNotice.kind === "error" ? darkMode ? "mt-2 font-mono text-[9px] leading-4 text-[#ff6b6b]" : "mt-2 font-mono text-[9px] leading-4 text-[#ff3b3b]" : darkMode ? "mt-2 font-mono text-[9px] leading-4 text-[#4ade80]" : "mt-2 font-mono text-[9px] leading-4 text-emerald-700"}>{uploadNotice.message}</p>}{!hasDates && <p className="mt-2 font-mono text-[9px] leading-4 text-stone-400">Import dated lots to activate literal month placement and year badges.</p>}<button type="button" onClick={onRestore} className="mt-3 inline-flex items-center gap-2 font-mono text-[10px] text-stone-500 transition hover:text-stone-900"><img src={flagIcon} alt="" className="h-4 w-4" /> Reload portfolio.csv</button></section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
