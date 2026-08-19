/**
 * Inkfield Menagerie: a full-bleed white portfolio chart in which the supplied
 * ekitty line icon is the data mark; colour, scale, placement, and badges are data.
 */

import PortfolioKittySvg from "@/components/PortfolioKittySvg";
import PortfolioDrawer from "@/components/PortfolioDrawer";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import {
  ageInDays,
  asHoldingPoints,
  asTransactionPoints,
  defaultPortfolio,
  formatCurrency,
  formatPrice,
  parsePortfolioCsv,
  type PortfolioLot,
  type PortfolioPoint,
} from "@/lib/portfolio";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Eye, FileUp, Menu, Pause, Play, RotateCcw, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type ViewMode = "holdings" | "transactions";
type ColorMetric = "percent" | "absolute";
type TaxFilter = "all" | "highlight" | "isolate";
type SimNode = { x: number; y: number; vx: number; vy: number };
type FillTreatment = { fill: string; ink: string; fillOpacity: number; segment: string; neutral: boolean };
type VisiblePoint = { point: PortfolioPoint; size: number; stroke: number; treatment: FillTreatment; bobDuration: number };
type Timeline = { months: number[]; indexFor: Record<string, number>; hasDates: boolean };

const PORTFOLIO_CSV_URL = "/manus-storage/Portfolio Holdings Transactions_26d29a27.csv";
const LOSS_RED = "#ff3b3b";
const GAIN_GREEN = "#17885b";
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function hash(value: string) {
  return Array.from(value).reduce((result, character) => ((result << 5) - result + character.charCodeAt(0)) | 0, 0) >>> 0;
}

function scale(value: number, min: number, max: number, outputMin: number, outputMax: number) {
  if (max === min) return (outputMin + outputMax) / 2;
  return outputMin + ((value - min) / (max - min)) * (outputMax - outputMin);
}

function mixHex(start: string, end: string, amount: number) {
  const from = start.slice(1);
  const to = end.slice(1);
  const mixed = [0, 2, 4].map((offset) => Math.round(parseInt(from.slice(offset, offset + 2), 16) + (parseInt(to.slice(offset, offset + 2), 16) - parseInt(from.slice(offset, offset + 2), 16)) * amount).toString(16).padStart(2, "0"));
  return `#${mixed.join("")}`;
}

function percentileRanks(points: PortfolioPoint[], metric: ColorMetric) {
  const values = points.map((point) => Math.abs(metric === "absolute" ? point.pnl : point.pnlPercent)).sort((a, b) => a - b);
  return Object.fromEntries(points.map((point) => {
    const value = Math.abs(metric === "absolute" ? point.pnl : point.pnlPercent);
    const firstGreater = values.findIndex((candidate) => candidate > value);
    const rank = ((firstGreater === -1 ? values.length : firstGreater) / Math.max(values.length, 1)) * 100;
    return [point.id, rank];
  }));
}

function treatmentFor(point: PortfolioPoint, percentile: number): FillTreatment {
  if (percentile < 2) return { fill: "transparent", ink: "#8da0a9", fillOpacity: 0, segment: "<p2", neutral: true };
  const stops = [5, 10, 25, 50, 75, 90, 95, 98];
  const stopIndex = stops.findIndex((stop) => percentile <= stop);
  const intensity = clamp((stopIndex + 1) / stops.length, 0.14, 1);
  const positive = point.pnl >= 0;
  const target = positive ? GAIN_GREEN : LOSS_RED;
  const pale = positive ? "#effaf4" : "#fff1f1";
  return {
    fill: mixHex(pale, target, intensity),
    ink: mixHex("#87969b", target, 0.45 + intensity * 0.55),
    fillOpacity: 0.22 + intensity * 0.68,
    segment: percentile > 98 ? ">p98" : `p${stops[Math.max(stopIndex, 0)]}`,
    neutral: false,
  };
}

function serialFromDate(date?: string) {
  if (!date) return undefined;
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.getFullYear() * 12 + parsed.getMonth();
}

function labelMonth(serial: number) {
  const date = new Date(Math.floor(serial / 12), serial % 12, 1);
  return date.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
}

function createTimeline(points: PortfolioPoint[]): Timeline {
  const dated = points.map((point) => serialFromDate(point.oldestDate)).filter((value): value is number => value !== undefined);
  const now = new Date();
  const fallbackEnd = now.getFullYear() * 12 + now.getMonth();
  const start = dated.length ? Math.min(...dated) : fallbackEnd - 11;
  const end = dated.length ? Math.max(...dated, fallbackEnd) : fallbackEnd;
  const span = clamp(end - start + 1, 6, 48);
  const months = Array.from({ length: span }, (_, index) => start + index);
  const indexFor: Record<string, number> = {};
  points.forEach((point) => {
    const serial = serialFromDate(point.oldestDate);
    indexFor[point.id] = serial === undefined ? hash(point.id) % months.length : clamp(serial - start, 0, months.length - 1);
  });
  return { months, indexFor, hasDates: dated.length > 0 };
}

function CatGlyph({ point, size, stroke, treatment, bobDuration, focused, frozen, showAgeBadge, onHover, onLeave, onClick }: VisiblePoint & { focused: boolean; frozen: boolean; showAgeBadge: boolean; onHover: () => void; onLeave: () => void; onClick: () => void }) {
  const yearsHeld = Math.floor((point.ageDays ?? 0) / 365);
  const variation = hash(point.id);
  const lean = (variation % 11) - 5;
  const widthScale = 0.93 + ((variation >>> 5) % 13) / 100;
  const skew = ((variation >>> 11) % 9) - 4;
  const heightScale = 0.94 + ((variation >>> 16) % 15) / 100;
  const tailArc = variation % 3 === 0 ? "M150 112 C174 104 176 82 162 72" : variation % 3 === 1 ? "M148 117 C172 118 181 97 166 83" : "M147 110 C171 95 166 77 157 67";
  const bobStyle = frozen ? undefined : { animation: `kitty-bob ${bobDuration}s cubic-bezier(.42,0,.3,1) infinite alternate`, animationDelay: `-${(hash(point.id) % 1000) / 1000}s` };

  return (
    <button type="button" aria-label={`${point.company}: ${formatCurrency(point.pnl)} unrealized profit and loss`} className="group absolute z-10 block origin-center border-0 bg-transparent p-0 outline-none focus-visible:z-30 focus-visible:outline-none" style={{ width: size, height: size, transform: "translate(-50%, -50%)" }} onMouseEnter={onHover} onFocus={onHover} onMouseLeave={onLeave} onBlur={onLeave} onClick={onClick}>
      <span className="relative block h-full w-full transition-transform duration-200 ease-out group-hover:scale-[1.055] group-focus-visible:scale-[1.055]" style={{ transform: `rotate(${lean}deg) skewX(${skew}deg) scale(${widthScale}, ${heightScale})` }}>
        <span className="relative block h-full w-full" style={bobStyle}>
          {focused && <span className="absolute inset-[5%] rounded-full border-[1.5px] border-[#D8AE37]" />}
          <PortfolioKittySvg stroke={treatment.ink} fill={treatment.fill} fillOpacity={treatment.fillOpacity} strokeWidth={stroke} className="block h-full w-full overflow-visible" />
          <svg viewBox="0 0 192 192" className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" aria-hidden="true"><path d={tailArc} fill="none" stroke={treatment.ink} strokeWidth={Math.max(1.1, stroke * 0.68)} strokeLinecap="round" /></svg>
          {point.taxSensitive && <span className="absolute left-[42%] top-[53%] h-[16%] w-[16%] rounded-full border border-[#D8AE37]" />}
          {showAgeBadge && yearsHeld >= 1 && <span className="age-badge absolute right-[13%] top-[7%] grid h-[25%] min-h-4 w-[25%] min-w-4 place-items-center rounded-full border border-[#B8BDC5] bg-white/95 text-stone-700 shadow-[0_2px_8px_rgba(41,37,36,.10)]">{yearsHeld}</span>}
        </span>
      </span>
    </button>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-baseline justify-between gap-3 py-1.5 text-[11px]"><span className="text-stone-500">{label}</span><span className="font-mono tabular-nums text-stone-800">{value}</span></div>;
}

export default function Home() {
  const [records, setRecords] = useState<PortfolioLot[]>(defaultPortfolio);
  const [viewMode, setViewMode] = useState<ViewMode>("transactions");
  const [colorMetric, setColorMetric] = useState<ColorMetric>("absolute");
  const [taxFilter, setTaxFilter] = useState<TaxFilter>("all");
  const [showEtfs, setShowEtfs] = useState(true);
  const [showAgeBadges, setShowAgeBadges] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [repulsion, setRepulsion] = useState(0.62);
  const [frozen, setFrozen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [uploadNotice, setUploadNotice] = useState<{ kind: "error" | "success"; message: string } | null>(null);
  const [sceneSize, setSceneSize] = useState({ width: 1200, height: 800 });
  const [, repaint] = useState(0);
  const nodes = useRef<Record<string, SimNode>>({});
  const frame = useRef<number | null>(null);

  const eligibleRecords = useMemo(() => showEtfs ? records : records.filter((record) => !record.isETF), [records, showEtfs]);
  const etfLotCount = useMemo(() => records.filter((record) => record.isETF).length, [records]);
  const points = useMemo(() => viewMode === "holdings" ? asHoldingPoints(eligibleRecords) : asTransactionPoints(eligibleRecords), [eligibleRecords, viewMode]);
  const filteredPoints = useMemo(() => taxFilter === "isolate" ? points.filter((point) => point.taxSensitive) : points, [points, taxFilter]);
  const timeline = useMemo(() => createTimeline(asTransactionPoints(eligibleRecords)), [eligibleRecords]);
  const rankings = useMemo(() => percentileRanks(filteredPoints, colorMetric), [colorMetric, filteredPoints]);

  const visiblePoints = useMemo<VisiblePoint[]>(() => {
    const values = filteredPoints.map((point) => point.currentValue ** 1.18);
    const min = Math.min(...values, 0);
    const max = Math.max(...values, 1);
    const maxQty = Math.max(...filteredPoints.map((point) => point.qty), 1);
    const compactField = sceneSize.width < 640;
    const minSize = compactField ? (viewMode === "transactions" ? 17 : 24) : (viewMode === "transactions" ? 25 : 34);
    const maxSize = compactField ? (viewMode === "transactions" ? 70 : 106) : (viewMode === "transactions" ? 118 : 220);
    return filteredPoints.map((point) => ({ point, size: scale(point.currentValue ** 1.18, min, max, minSize, maxSize), stroke: scale(point.qty, 0, maxQty, 1.65, 4.5), treatment: treatmentFor(point, rankings[point.id] ?? 0), bobDuration: clamp(3.6 - Math.min(1.75, Math.abs(point.pnlPercent) / 35), 1.7, 3.6) }));
  }, [filteredPoints, rankings, sceneSize.width, viewMode]);

  const selected = visiblePoints.find((entry) => entry.point.id === selectedId)?.point ?? null;
  const hovered = visiblePoints.find((entry) => entry.point.id === hoveredId)?.point ?? null;

  useEffect(() => {
    const updateSize = () => setSceneSize({ width: window.innerWidth, height: window.innerHeight });
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  useEffect(() => {
    nodes.current = {};
    setHoveredId(null);
    setSelectedId(null);
  }, [showEtfs, viewMode]);

  useEffect(() => {
    let mounted = true;
    fetch(PORTFOLIO_CSV_URL).then((response) => response.text()).then((text) => {
      const parsed = parsePortfolioCsv(text);
      if (mounted && parsed.records.length) setRecords(parsed.records);
    }).catch(() => undefined);
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    const nextNodes: Record<string, SimNode> = {};
    visiblePoints.forEach(({ point }, index) => {
      const current = nodes.current[point.id];
      const seed = hash(point.id);
      const padding = 48;
      nextNodes[point.id] = current ?? { x: padding + (seed % Math.max(120, sceneSize.width - padding * 2)), y: padding + ((seed >>> 8) % Math.max(120, sceneSize.height - padding * 2)), vx: ((index % 3) - 1) * 0.18, vy: (((index + 1) % 3) - 1) * 0.18 };
    });
    nodes.current = nextNodes;
  }, [sceneSize, visiblePoints]);

  useEffect(() => {
    let last = performance.now();
    const tick = (time: number) => {
      const delta = Math.min(1.4, (time - last) / 16.67);
      last = time;
      if (!frozen) {
        const nodeList = visiblePoints.map(({ point, size }, index) => ({ node: nodes.current[point.id], point, size, index })).filter((entry) => entry.node);
        nodeList.forEach(({ node, point, index }) => {
          const seed = hash(point.id);
          let anchorX: number;
          let anchorY: number;
          let pull: number;
          if (viewMode === "transactions") {
            const stripWidth = sceneSize.width / timeline.months.length;
            const monthIndex = timeline.indexFor[point.id] ?? seed % timeline.months.length;
            anchorX = (monthIndex + 0.5) * stripWidth + (((seed >>> 10) % 100) / 100 - 0.5) * stripWidth * 0.42;
            anchorY = sceneSize.height * (0.17 + (((seed >>> 18) % 67) / 100));
            pull = 0.0034;
          } else {
            anchorX = sceneSize.width * (0.08 + ((seed % 840) / 1000));
            anchorY = sceneSize.height * (0.11 + (((seed >>> 9) % 710) / 1000));
            pull = 0.00048;
          }
          node.vx += (anchorX - node.x) * pull * delta;
          node.vy += (anchorY - node.y) * pull * delta;
          if (point.id === selectedId) { node.vx += (sceneSize.width * 0.5 - node.x) * 0.0028 * delta; node.vy += (sceneSize.height * 0.5 - node.y) * 0.0028 * delta; }
        });
        for (let left = 0; left < nodeList.length; left += 1) for (let right = left + 1; right < nodeList.length; right += 1) {
          const a = nodeList[left]; const b = nodeList[right]; const dx = b.node.x - a.node.x; const dy = b.node.y - a.node.y; const distance = Math.max(Math.hypot(dx, dy), 0.01); const desired = (a.size + b.size) * 0.43 + 14;
          if (distance < desired) { const force = ((desired - distance) / desired) * 0.88 * repulsion * delta; const nx = dx / distance; const ny = dy / distance; a.node.vx -= nx * force; a.node.vy -= ny * force; b.node.vx += nx * force; b.node.vy += ny * force; }
        }
        nodeList.forEach(({ node, size, point }) => {
          const margin = Math.max(42, size * 0.62);
          node.vx += (node.x < margin ? margin - node.x : node.x > sceneSize.width - margin ? sceneSize.width - margin - node.x : 0) * 0.008;
          node.vy += (node.y < margin ? margin - node.y : node.y > sceneSize.height - margin ? sceneSize.height - margin - node.y : 0) * 0.008;
          node.vx *= 0.91; node.vy *= 0.91; node.x += node.vx * delta; node.y += node.vy * delta;
          if (viewMode === "transactions") {
            const stripWidth = sceneSize.width / timeline.months.length;
            const monthIndex = timeline.indexFor[point.id] ?? 0;
            const edge = Math.min(Math.max(3, size * 0.08), stripWidth * 0.18);
            node.x = clamp(node.x, monthIndex * stripWidth + edge, (monthIndex + 1) * stripWidth - edge);
          }
        });
        repaint((value) => (value + 1) % 10_000);
      }
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => { if (frame.current) cancelAnimationFrame(frame.current); };
  }, [frozen, repulsion, sceneSize, selectedId, timeline, viewMode, visiblePoints]);

  const importFile = useCallback((file?: File) => {
    if (!file) return;
    file.text().then((text) => {
      const parsed = parsePortfolioCsv(text);
      if (parsed.error) { setUploadNotice({ kind: "error", message: parsed.error }); return; }
      setRecords(parsed.records); setUploadNotice({ kind: "success", message: `${parsed.records.length} lots loaded into the field.` }); setSelectedId(null); setHoveredId(null); setTaxFilter("all");
    });
  }, []);

  const tooltipNode = hovered ? nodes.current[hovered.id] : null;
  const focusNode = selected ? nodes.current[selected.id] : null;
  const focusOnRight = (focusNode?.x ?? 0) < sceneSize.width * 0.55;

  return (
    <main className={darkMode ? "dark relative h-[100dvh] w-screen overflow-hidden bg-[#101617] text-stone-100" : "relative h-[100dvh] w-screen overflow-hidden bg-white text-stone-900"}>
      {viewMode === "transactions" && <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 overflow-hidden">{timeline.months.map((month, index) => <div key={month} className={darkMode ? "absolute bottom-0 top-0 border-l border-[#284149]" : "absolute bottom-0 top-0 border-l border-[#edf7ff]"} style={{ left: `${(index / timeline.months.length) * 100}%` }}><span className={darkMode ? "absolute left-1 top-3 hidden font-mono text-[8px] tracking-[.12em] text-[#77949e] md:block" : "absolute left-1 top-3 hidden font-mono text-[8px] tracking-[.12em] text-[#c3dff5] md:block"}>{labelMonth(month)}</span></div>)}</div>}
      <section aria-label="Portfolio kitty field" className="absolute inset-0 z-10">
        {visiblePoints.map((entry) => {
          const node = nodes.current[entry.point.id]; if (!node) return null;
          const muted = taxFilter === "highlight" && !entry.point.taxSensitive;
          return <div key={entry.point.id} className={muted ? "opacity-25 grayscale-[.32] transition-opacity duration-300" : "transition-opacity duration-300"} style={{ position: "absolute", left: node.x, top: node.y }}><CatGlyph {...entry} focused={selectedId === entry.point.id} frozen={frozen} showAgeBadge={viewMode === "transactions" && showAgeBadges} onHover={() => setHoveredId(entry.point.id)} onLeave={() => setHoveredId((current) => current === entry.point.id ? null : current)} onClick={() => { setSelectedId(entry.point.id); setHoveredId(null); }} /></div>;
        })}
      </section>

      <AnimatePresence>{hovered && tooltipNode && !selected && <motion.aside initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }} transition={{ duration: 0.16 }} className="pointer-events-none fixed z-30 w-60 rounded-xl border border-stone-200/90 bg-white/95 px-4 py-3 shadow-[0_16px_45px_-20px_rgba(41,37,36,.42)] backdrop-blur" style={{ left: clamp(tooltipNode.x + 34, 12, sceneSize.width - 258), top: clamp(tooltipNode.y - 28, 12, sceneSize.height - 168) }}><div className="mb-2 flex items-start justify-between gap-2"><p className="font-serif text-[15px] leading-4 text-stone-900">{hovered.company}</p><span className={hovered.pnl >= 0 ? "font-mono text-[10px] text-emerald-700" : "font-mono text-[10px] text-[#ff3b3b]"}>{hovered.pnl >= 0 ? "+" : ""}{hovered.pnlPercent.toFixed(1)}%</span></div><div className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[10px] tabular-nums"><span className="text-stone-400">Qty</span><span className="text-right">{hovered.qty}</span><span className="text-stone-400">Invested</span><span className="text-right">{formatCurrency(hovered.investedValue, true)}</span><span className="text-stone-400">Value</span><span className="text-right">{formatCurrency(hovered.currentValue, true)}</span><span className="text-stone-400">P&amp;L</span><span className={hovered.pnl >= 0 ? "text-right text-emerald-700" : "text-right text-[#ff3b3b]"}>{formatCurrency(hovered.pnl, true)}</span></div></motion.aside>}</AnimatePresence>

      <AnimatePresence>{selected && focusNode && <motion.aside initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.98 }} transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }} className="fixed z-40 w-[min(336px,calc(100vw-28px))] overflow-hidden rounded-2xl border border-stone-200 bg-white/98 shadow-[0_22px_62px_-24px_rgba(41,37,36,.5)] backdrop-blur" style={{ left: clamp(focusOnRight ? focusNode.x + 76 : focusNode.x - 412, 14, sceneSize.width - 350), top: clamp(focusNode.y - 132, 14, sceneSize.height - 494) }}><div className="flex items-start justify-between border-b border-stone-100 px-5 py-4"><div><p className="font-serif text-[19px] leading-5 text-stone-900">{selected.company}</p><p className="mt-1 font-mono text-[9px] uppercase tracking-[.17em] text-stone-400">{selected.lots.length === 1 ? "Transaction lot" : `${selected.lots.length} transaction lots`}</p></div><button type="button" onClick={() => setSelectedId(null)} aria-label="Close details" className="rounded-full p-1 text-stone-500 transition hover:bg-stone-100 hover:text-stone-900"><X size={16} /></button></div><div className="grid grid-cols-2 gap-x-5 border-b border-stone-100 px-5 py-3"><MetricRow label="Quantity" value={selected.qty.toLocaleString("en-IN")} /><MetricRow label="Avg. buy" value={formatPrice(selected.avgPrice)} /><MetricRow label="Current" value={formatPrice(selected.currentPrice)} /><MetricRow label="Unrealized P&L" value={`${selected.pnl >= 0 ? "+" : ""}${formatCurrency(selected.pnl)}`} /></div><div className="max-h-48 overflow-y-auto px-5 py-3"><p className="mb-2 font-mono text-[9px] uppercase tracking-[.18em] text-stone-400">Lot breakdown</p>{selected.lots.map((lot) => { const lotPnl = lot.buy_qty * (lot.current_price - lot.avg_price); const days = ageInDays(lot.buy_date); const completedYears = Math.floor((days ?? 0) / 365); return <div key={lot.id} className="grid grid-cols-[1fr_auto] gap-2 border-t border-stone-100 py-2 first:border-t-0"><div><p className="font-mono text-[10px] text-stone-700">{lot.buy_qty} × {formatPrice(lot.avg_price)}</p><p className="font-mono text-[9px] text-stone-400">{lot.buy_date ? new Date(lot.buy_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "Date unavailable"}{days ? ` · ${days}d` : ""}{completedYears ? ` · ${completedYears}y complete` : ""}</p></div><span className={lotPnl >= 0 ? "self-center font-mono text-[10px] text-emerald-700" : "self-center font-mono text-[10px] text-[#ff3b3b]"}>{lotPnl >= 0 ? "+" : ""}{formatCurrency(lotPnl, true)}</span></div>; })}</div>{selected.taxSensitive && <div className="flex items-center gap-2 border-t border-amber-100 bg-amber-50 px-5 py-3 font-mono text-[10px] text-amber-800"><Sparkles size={13} /> Loss lot near/over the 365-day threshold.</div>}</motion.aside>}</AnimatePresence>

      <PortfolioDrawer open={drawerOpen} onOpenChange={setDrawerOpen} viewMode={viewMode} setViewMode={(mode) => { setViewMode(mode); setSelectedId(null); }} colorMetric={colorMetric} setColorMetric={setColorMetric} taxFilter={taxFilter} setTaxFilter={(filter) => { setTaxFilter(filter); setSelectedId(null); }} showEtfs={showEtfs} setShowEtfs={setShowEtfs} showAgeBadges={showAgeBadges} setShowAgeBadges={setShowAgeBadges} darkMode={darkMode} setDarkMode={setDarkMode} etfLotCount={etfLotCount} frozen={frozen} setFrozen={setFrozen} repulsion={repulsion} setRepulsion={setRepulsion} onImportFile={importFile} uploadNotice={uploadNotice} hasDates={timeline.hasDates} onRestore={() => { setRecords(defaultPortfolio); setUploadNotice(null); setSelectedId(null); setHoveredId(null); }} kittyCount={visiblePoints.length} lotCount={eligibleRecords.length} />
      <a href="https://thecontrarian.in" target="_blank" rel="noreferrer" className={darkMode ? "fixed bottom-4 right-5 z-40 font-mono text-[9px] tracking-[.08em] text-stone-500 transition hover:text-stone-200" : "fixed bottom-4 right-5 z-40 font-mono text-[9px] tracking-[.08em] text-stone-400 transition hover:text-stone-800"}>© 2026 Mahesh Shantaram / thecontrarian.in</a>
    </main>
  );
}
