/**
 * Inkfield Menagerie: the drawer is the only control surface; it stays quiet,
 * precise, and off-canvas until the visitor asks for the field’s accounting.
 */

import PortfolioKittySvg from "@/components/PortfolioKittySvg";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { ChevronDown, Eye, FileUp, Menu, Pause, Play, RotateCcw } from "lucide-react";

type ViewMode = "holdings" | "transactions";
type ColorMetric = "percent" | "absolute";
type TaxFilter = "all" | "highlight" | "isolate";

type PortfolioDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  colorMetric: ColorMetric;
  setColorMetric: (metric: ColorMetric) => void;
  taxFilter: TaxFilter;
  setTaxFilter: (filter: TaxFilter) => void;
  showEtfs: boolean;
  setShowEtfs: (value: boolean) => void;
  darkMode: boolean;
  setDarkMode: (value: boolean) => void;
  etfLotCount: number;
  frozen: boolean;
  setFrozen: (value: boolean | ((current: boolean) => boolean)) => void;
  repulsion: number;
  setRepulsion: (value: number) => void;
  onImportFile: (file?: File) => void;
  uploadNotice: { kind: "error" | "success"; message: string } | null;
  hasDates: boolean;
  onRestore: () => void;
  kittyCount: number;
  lotCount: number;
};

export default function PortfolioDrawer({
  open, onOpenChange, viewMode, setViewMode, colorMetric, setColorMetric, taxFilter,
  setTaxFilter, showEtfs, setShowEtfs, darkMode,
  setDarkMode, etfLotCount, frozen, setFrozen, repulsion, setRepulsion, onImportFile,
  uploadNotice, hasDates, onRestore, kittyCount, lotCount,
}: PortfolioDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <button type="button" aria-label="Open portfolio controls" className="ekitty-menu-trigger fixed right-5 z-50 grid h-12 w-12 place-items-center rounded-full border border-stone-200 bg-white shadow-[0_10px_30px_-16px_rgba(41,37,36,.45)] transition duration-200 hover:-translate-y-0.5 hover:border-stone-300 hover:shadow-[0_13px_33px_-15px_rgba(41,37,36,.5)] active:scale-95"><Menu size={20} strokeWidth={1.8} /></button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[min(390px,94vw)] gap-0 overflow-y-auto border-l border-stone-200 bg-[#fcfcfb] p-0 shadow-[-20px_0_60px_-34px_rgba(41,37,36,.48)] sm:max-w-none">
        <SheetHeader className="border-b border-stone-200 px-6 pb-5 pt-6">
          <div className="flex items-center gap-3"><PortfolioKittySvg stroke="#ff3b3b" fill="transparent" fillOpacity={0} strokeWidth={2} className="h-10 w-10" /><div><SheetTitle className="font-serif text-[25px] font-medium tracking-tight">ekitty</SheetTitle><p className="mt-0.5 font-mono text-[9px] uppercase tracking-[.18em] text-stone-400">shares &amp; ETFs, living field</p></div></div>
        </SheetHeader>
        <div className="space-y-7 px-6 py-6">
          <section><p className="control-label">View field</p><div className="mt-3 grid grid-cols-2 rounded-xl border border-stone-200 bg-white p-1">{([ ["holdings", "Grouped holdings"], ["transactions", "Transactions"] ] as const).map(([mode, label]) => <button key={mode} type="button" onClick={() => setViewMode(mode)} className={viewMode === mode ? "rounded-lg bg-stone-900 px-2 py-2.5 font-mono text-[10px] text-white shadow-sm" : "rounded-lg px-2 py-2.5 font-mono text-[10px] text-stone-500 transition hover:text-stone-900"}>{label}</button>)}</div></section>
          <section className="rounded-xl border border-stone-200 bg-white px-4 py-3">
            <div className="flex items-center justify-between gap-4"><div><p className="control-label text-stone-600">Instruments</p><label htmlFor="show-etfs" className="mt-1 block font-mono text-[10px] text-stone-700">Include ETFs</label><p className="mt-1 font-mono text-[9px] text-stone-400">{showEtfs ? `Shares + ${etfLotCount} ETF lots visible.` : `${etfLotCount} ETF lots hidden; field recomposed.`}</p></div><Switch id="show-etfs" checked={showEtfs} onCheckedChange={setShowEtfs} aria-label="Include ETFs in the portfolio field" /></div>
            <div className="mt-3 border-t border-stone-100 pt-3"><div className="flex items-center justify-between gap-4"><div><label htmlFor="dark-field" className="block font-mono text-[10px] text-stone-700">Dark field</label><p className="mt-1 font-mono text-[9px] text-stone-400">Reverse the canvas; preserve the data pigments.</p></div><Switch id="dark-field" checked={darkMode} onCheckedChange={setDarkMode} aria-label="Use a dark portfolio field" /></div></div>
          </section>
          <section><p className="control-label">Visual mapping</p><p className="field-label mt-3">Kitty scale</p><div className="mt-1 rounded-xl border border-stone-200 bg-white px-3 py-3 font-mono text-[10px] text-stone-700">Invested position value</div><label className="field-label mt-4" htmlFor="color-map">Body pigment</label><div className="select-wrap"><select id="color-map" value={colorMetric} onChange={(event) => setColorMetric(event.target.value as ColorMetric)}><option value="absolute">Absolute P&amp;L — percentile</option><option value="percent">P&amp;L percentage — percentile</option></select><ChevronDown size={14} /></div><p className="mt-2 font-mono text-[9px] leading-4 text-stone-400">Tiny P&amp;L remains neutral; profit intensifies red and loss intensifies green.</p></section>
          <section><p className="control-label">Tax-loss lens</p><div className="mt-3 grid grid-cols-3 rounded-xl border border-stone-200 bg-white p-1">{([ ["all", "All"], ["highlight", "Mark"], ["isolate", "Only"] ] as const).map(([filter, label]) => <button key={filter} type="button" onClick={() => setTaxFilter(filter)} className={taxFilter === filter ? "rounded-lg bg-[#D8AE37] px-1 py-2.5 font-mono text-[10px] text-stone-900 shadow-sm" : "rounded-lg px-1 py-2.5 font-mono text-[10px] text-stone-500 transition hover:text-stone-900"}>{label}</button>)}</div><p className="mt-2 font-mono text-[9px] leading-4 text-stone-400">Gold rings flag loss lots dated 330+ days ago.</p></section>
          <section><div className="flex items-center justify-between"><p className="control-label">Field motion</p><button type="button" onClick={() => setFrozen((current) => !current)} className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-2.5 py-1.5 font-mono text-[9px] uppercase tracking-[.11em] text-stone-600 transition hover:border-stone-400">{frozen ? <Play size={11} /> : <Pause size={11} />}{frozen ? "Resume" : "Freeze"}</button></div><div className="mt-4 flex items-center gap-3"><span className="font-mono text-[10px] text-stone-500">Soft</span><input aria-label="Repulsion strength" type="range" min="0.2" max="1" step="0.05" value={repulsion} onChange={(event) => setRepulsion(Number(event.target.value))} className="kitty-range flex-1" /><span className="font-mono text-[10px] text-stone-500">Spacious</span></div></section>
          <section><p className="control-label">Portfolio CSV</p><label className="mt-3 flex cursor-pointer items-center justify-between rounded-xl border border-dashed border-stone-300 bg-white px-4 py-4 transition hover:border-stone-500 hover:bg-stone-50" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); onImportFile(event.dataTransfer.files[0]); }}><span><span className="block font-mono text-[10px] uppercase tracking-[.12em] text-stone-700">Import or drop a file</span><span className="mt-1 block font-mono text-[9px] text-stone-400">company · buy_qty · avg_price · current_price · txn_date</span></span><FileUp size={18} className="text-stone-500" /><input type="file" accept=".csv,text/csv" className="sr-only" onChange={(event) => onImportFile(event.target.files?.[0])} /></label>{uploadNotice && <p className={uploadNotice.kind === "error" ? "mt-2 font-mono text-[9px] leading-4 text-[#ff3b3b]" : "mt-2 font-mono text-[9px] leading-4 text-emerald-700"}>{uploadNotice.message}</p>}{!hasDates && <p className="mt-2 font-mono text-[9px] leading-4 text-stone-400">Import dated lots to activate literal month placement and year badges.</p>}<button type="button" onClick={onRestore} className="mt-3 inline-flex items-center gap-2 font-mono text-[10px] text-stone-500 transition hover:text-stone-900"><RotateCcw size={12} /> Restore included field</button></section>
          <section className="border-t border-stone-200 pt-5"><div className="flex items-center justify-between font-mono text-[10px]"><span className="text-stone-400">Showing</span><span className="text-stone-700">{kittyCount} kitties · {lotCount} lots</span></div><div className="mt-2 flex items-center gap-1.5 font-mono text-[9px] text-stone-400"><Eye size={11} /> In Transactions, each vertical blue strip is one month.</div></section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
