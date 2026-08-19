/**
 * Inkfield Menagerie: the white field is primary; controls and accounting
 * appear only on intent, letting animated kitty glyphs carry the portfolio.
 */

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
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
type SizeMetric = "invested" | "current" | "quantity";
type ColorMetric = "percent" | "absolute";
type TaxFilter = "all" | "highlight" | "isolate";

type SimNode = { x: number; y: number; vx: number; vy: number; phase: number };
type VisiblePoint = { point: PortfolioPoint; size: number; stroke: number; fill: { start: string; end: string; ink: string }; bobDuration: number };

const brandMark = "/manus-storage/ekitty-mark_0ac0c993.png";
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function hash(value: string) {
  return Array.from(value).reduce((result, character) => ((result << 5) - result + character.charCodeAt(0)) | 0, 0) >>> 0;
}

function scale(value: number, min: number, max: number, outputMin: number, outputMax: number) {
  if (max === min) return (outputMin + outputMax) / 2;
  return outputMin + ((value - min) / (max - min)) * (outputMax - outputMin);
}

function colorFor(point: PortfolioPoint, colorMetric: ColorMetric, maxMagnitude: number) {
  const signedValue = colorMetric === "percent" ? point.pnlPercent : point.pnl;
  const intensity = clamp(Math.abs(signedValue) / Math.max(maxMagnitude, 1), 0.16, 1);
  const gain = signedValue >= 0;
  const hue = gain ? 153 : 17;
  const ink = gain ? "hsl(151 58% 24%)" : "hsl(12 54% 32%)";
  return {
    start: `hsl(${hue} ${gain ? 52 : 62}% ${96 - intensity * 13}%)`,
    end: `hsl(${hue} ${gain ? 47 : 66}% ${82 - intensity * 28}%)`,
    ink,
  };
}

function CatGlyph({ point, size, stroke, fill, bobDuration, focused, frozen, onHover, onLeave, onClick }: VisiblePoint & { focused: boolean; frozen: boolean; onHover: () => void; onLeave: () => void; onClick: () => void }) {
  const id = `gradient-${point.id.replace(/[^a-zA-Z0-9]/g, "")}`;
  const medal = point.taxSensitive ? "#D8AE37" : "#B8BDC5";
  const profit = point.pnl >= 0;
  const variation = hash(point.id);
  const bodyLean = (variation % 7) - 3;
  const earTilt = ((variation >>> 4) % 9) - 4;
  const whiskerLift = ((variation >>> 8) % 7) - 3;
  const tailLift = ((variation >>> 12) % 13) - 6;
  const bobStyle = frozen
    ? undefined
    : {
        animation: `kitty-bob ${bobDuration}s cubic-bezier(.42,0,.3,1) infinite alternate`,
        animationDelay: `-${(hash(point.id) % 1000) / 1000}s`,
      };

  return (
    <button
      type="button"
      aria-label={`${point.company}: ${formatCurrency(point.pnl)} unrealized profit and loss`}
      className="group absolute z-10 block origin-center cursor-pointer border-0 bg-transparent p-0 outline-none focus-visible:z-30 focus-visible:outline-none"
      style={{ width: size, height: size, transform: "translate(-50%, -50%)" }}
      onMouseEnter={onHover}
      onFocus={onHover}
      onMouseLeave={onLeave}
      onBlur={onLeave}
      onClick={onClick}
    >
      <svg className="block overflow-visible transition-transform duration-200 ease-out group-hover:scale-[1.06] group-focus-visible:scale-[1.06]" viewBox="0 0 160 160" width={size} height={size} aria-hidden="true">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={fill.start} />
            <stop offset="100%" stopColor={fill.end} />
          </linearGradient>
          <filter id={`${id}-shadow`} x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="5" stdDeviation="4" floodColor={fill.ink} floodOpacity="0.15" />
          </filter>
        </defs>
        {focused && <circle cx="80" cy="80" r="73" fill="none" stroke="#D8AE37" strokeWidth="2.4" strokeDasharray="4 5" />}
        <g style={bobStyle} filter={`url(#${id}-shadow)`} transform={`rotate(${bodyLean} 80 80)`}>
          <path d={`M46 83 C21 79 18 ${113 + tailLift} 38 121 C48 125 55 117 55 110`} fill="none" stroke={fill.ink} strokeWidth={stroke} strokeLinecap="round" />
          <path d={`M114 88 C142 92 145 ${66 + tailLift} 133 ${50 + tailLift} C130 47 133 43 138 45`} fill="none" stroke={fill.ink} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" />
          <g transform={`rotate(${earTilt} 80 48)`}><path d="M45 58 L52 26 L73 48 C78 46 82 46 87 48 L108 26 L115 58" fill={`url(#${id})`} stroke={fill.ink} strokeWidth={stroke} strokeLinejoin="round" /></g>
          <path d={`M42 72 C42 52 55 42 ${80 + bodyLean} 42 C105 42 118 52 118 72 L118 106 C118 125 ${101 - bodyLean} 136 80 136 C59 136 42 125 42 106 Z`} fill={`url(#${id})`} stroke={fill.ink} strokeWidth={stroke} strokeLinejoin="round" />
          <path d={`M62 48 L${53 + earTilt / 3} 33 L68 51 M98 51 L${107 - earTilt / 3} 33 L96 48`} fill="none" stroke={fill.ink} strokeWidth={Math.max(1.6, stroke - 1)} strokeLinecap="round" opacity="0.42" />
          <path d="M55 83 C55 68 65 58 80 58 C95 58 105 68 105 83 C105 98 96 108 80 108 C64 108 55 98 55 83 Z" fill="hsl(0 0% 100% / .42)" stroke={fill.ink} strokeWidth={Math.max(1.2, stroke - 1.2)} />
          <ellipse cx="69" cy="80" rx="3.4" ry="4.2" fill={fill.ink} />
          <ellipse cx="91" cy="80" rx="3.4" ry="4.2" fill={fill.ink} />
          <path d="M77 89 Q80 92 83 89" fill="none" stroke={fill.ink} strokeWidth={Math.max(1.3, stroke - 1.1)} strokeLinecap="round" />
          <path d="M70 95 Q80 102 90 95" fill="none" stroke={fill.ink} strokeWidth={Math.max(1.3, stroke - 1.1)} strokeLinecap="round" />
          <path d={`M57 91 L34 ${87 + whiskerLift} M57 96 L33 ${99 - whiskerLift} M103 91 L126 ${87 - whiskerLift} M103 96 L127 ${99 + whiskerLift}`} fill="none" stroke={fill.ink} strokeWidth={Math.max(1.15, stroke - 1.45)} strokeLinecap="round" />
          <path d="M58 113 C66 118 94 118 102 113" fill="none" stroke={fill.ink} strokeWidth={Math.max(1.3, stroke - 1.15)} strokeLinecap="round" opacity="0.78" />
          {point.taxSensitive && <circle cx="80" cy="119" r="10.1" fill="none" stroke="#D8AE37" strokeWidth="1.15" strokeDasharray="1.5 2.5" />}
          <circle cx="80" cy="119" r="7.2" fill={medal} stroke={fill.ink} strokeWidth={Math.max(1.25, stroke - 1.1)} />
          <circle cx="80" cy="119" r="2" fill={profit ? "#fff4bf" : "#F2F4F5"} />
        </g>
      </svg>
    </button>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-baseline justify-between gap-3 py-1.5 text-[11px]"><span className="text-stone-500">{label}</span><span className="font-mono tabular-nums text-stone-800">{value}</span></div>;
}

export default function Home() {
  const [records, setRecords] = useState<PortfolioLot[]>(defaultPortfolio);
  const [viewMode, setViewMode] = useState<ViewMode>("holdings");
  const [sizeMetric, setSizeMetric] = useState<SizeMetric>("invested");
  const [colorMetric, setColorMetric] = useState<ColorMetric>("percent");
  const [taxFilter, setTaxFilter] = useState<TaxFilter>("all");
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

  const points = useMemo(() => viewMode === "holdings" ? asHoldingPoints(records) : asTransactionPoints(records), [records, viewMode]);
  const filteredPoints = useMemo(() => {
    if (taxFilter === "isolate") return points.filter((point) => point.taxSensitive);
    return points;
  }, [points, taxFilter]);

  const visiblePoints = useMemo<VisiblePoint[]>(() => {
    const metric = (point: PortfolioPoint) => sizeMetric === "invested" ? point.investedValue : sizeMetric === "current" ? point.currentValue : point.qty;
    const values = filteredPoints.map(metric);
    const min = Math.min(...values, 0);
    const max = Math.max(...values, 1);
    const maxMagnitude = Math.max(...filteredPoints.map((point) => Math.abs(colorMetric === "percent" ? point.pnlPercent : point.pnl)), 1);
    const maxQty = Math.max(...filteredPoints.map((point) => point.qty), 1);
    const compactField = sceneSize.width < 640;
    const minSize = compactField ? (viewMode === "transactions" ? 22 : 30) : (viewMode === "transactions" ? 34 : 52);
    const maxSize = compactField ? (viewMode === "transactions" ? 58 : 78) : (viewMode === "transactions" ? 94 : 158);

    return filteredPoints.map((point) => ({
      point,
      size: scale(metric(point), min, max, minSize, maxSize),
      stroke: scale(point.qty, 0, maxQty, 1.7, 4.7),
      fill: colorFor(point, colorMetric, maxMagnitude),
      bobDuration: clamp(3.6 - Math.min(1.75, Math.abs(point.pnlPercent) / 35), 1.7, 3.6),
    }));
  }, [colorMetric, filteredPoints, sceneSize.width, sizeMetric, viewMode]);

  const selected = visiblePoints.find((entry) => entry.point.id === selectedId)?.point ?? null;
  const hovered = visiblePoints.find((entry) => entry.point.id === hoveredId)?.point ?? null;

  useEffect(() => {
    const updateSize = () => setSceneSize({ width: window.innerWidth, height: window.innerHeight });
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  useEffect(() => {
    const nextNodes: Record<string, SimNode> = {};
    visiblePoints.forEach(({ point }, index) => {
      const existing = nodes.current[point.id];
      const random = hash(point.id);
      const padding = 86;
      nextNodes[point.id] = existing ?? {
        x: padding + (random % Math.max(120, sceneSize.width - padding * 2)),
        y: padding + ((random >>> 8) % Math.max(120, sceneSize.height - padding * 2)),
        vx: ((index % 3) - 1) * 0.2,
        vy: (((index + 1) % 3) - 1) * 0.2,
        phase: (random % 628) / 100,
      };
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
          const anchorSeed = hash(point.id);
          const fraction = (index + 0.75) / Math.max(nodeList.length, 1);
          const theta = index * 2.39996 + (anchorSeed % 29) / 18;
          const radius = (0.13 + Math.sqrt(fraction) * 0.39) * Math.min(sceneSize.width, sceneSize.height);
          const anchorX = sceneSize.width * 0.47 + Math.cos(theta) * radius * 1.38;
          const anchorY = sceneSize.height * 0.49 + Math.sin(theta) * radius * 0.83;
          node.vx += (anchorX - node.x) * 0.00048 * delta;
          node.vy += (anchorY - node.y) * 0.00048 * delta;
          if (point.id === selectedId) {
            node.vx += (sceneSize.width * 0.5 - node.x) * 0.0028 * delta;
            node.vy += (sceneSize.height * 0.5 - node.y) * 0.0028 * delta;
          }
        });
        for (let left = 0; left < nodeList.length; left += 1) {
          for (let right = left + 1; right < nodeList.length; right += 1) {
            const a = nodeList[left];
            const b = nodeList[right];
            const dx = b.node.x - a.node.x;
            const dy = b.node.y - a.node.y;
            const distance = Math.max(Math.hypot(dx, dy), 0.01);
            const desired = (a.size + b.size) * 0.43 + 18;
            if (distance < desired) {
              const force = ((desired - distance) / desired) * 0.88 * repulsion * delta;
              const nx = dx / distance;
              const ny = dy / distance;
              a.node.vx -= nx * force;
              a.node.vy -= ny * force;
              b.node.vx += nx * force;
              b.node.vy += ny * force;
            }
          }
        }
        nodeList.forEach(({ node, size }) => {
          const margin = Math.max(38, size * 0.38);
          node.vx += (node.x < margin ? margin - node.x : node.x > sceneSize.width - margin ? sceneSize.width - margin - node.x : 0) * 0.006;
          node.vy += (node.y < margin ? margin - node.y : node.y > sceneSize.height - margin ? sceneSize.height - margin - node.y : 0) * 0.006;
          node.vx *= 0.91;
          node.vy *= 0.91;
          node.x += node.vx * delta;
          node.y += node.vy * delta;
        });
        repaint((value) => (value + 1) % 10_000);
      }
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => { if (frame.current) cancelAnimationFrame(frame.current); };
  }, [frozen, repulsion, sceneSize, selectedId, visiblePoints]);

  const importFile = useCallback((file?: File) => {
    if (!file) return;
    file.text().then((text) => {
      const parsed = parsePortfolioCsv(text);
      if (parsed.error) {
        setUploadNotice({ kind: "error", message: parsed.error });
        return;
      }
      setRecords(parsed.records);
      setUploadNotice({ kind: "success", message: `${parsed.records.length} lots loaded into the field.` });
      setSelectedId(null);
      setHoveredId(null);
      setTaxFilter("all");
    });
  }, []);

  const tooltipNode = hovered ? nodes.current[hovered.id] : null;
  const focusNode = selected ? nodes.current[selected.id] : null;
  const focusOnRight = (focusNode?.x ?? 0) < sceneSize.width * 0.55;

  return (
    <main className="relative h-[100dvh] w-screen overflow-hidden bg-white text-stone-900">
      <section aria-label="Portfolio kitty field" className="absolute inset-0">
        {visiblePoints.map((entry) => {
          const node = nodes.current[entry.point.id];
          if (!node) return null;
          const muted = taxFilter === "highlight" && !entry.point.taxSensitive;
          return (
            <div key={entry.point.id} className={muted ? "opacity-25 grayscale-[.32] transition-opacity duration-300" : "transition-opacity duration-300"} style={{ position: "absolute", left: node.x, top: node.y }}>
              <CatGlyph
                {...entry}
                focused={selectedId === entry.point.id}
                frozen={frozen}
                onHover={() => setHoveredId(entry.point.id)}
                onLeave={() => setHoveredId((current) => current === entry.point.id ? null : current)}
                onClick={() => { setSelectedId(entry.point.id); setHoveredId(null); }}
              />
            </div>
          );
        })}
      </section>

      <AnimatePresence>
        {hovered && tooltipNode && !selected && (
          <motion.aside
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.16 }}
            className="pointer-events-none fixed z-30 w-60 rounded-xl border border-stone-200/90 bg-white/95 px-4 py-3 shadow-[0_16px_45px_-20px_rgba(41,37,36,.42)] backdrop-blur"
            style={{ left: clamp(tooltipNode.x + 34, 12, sceneSize.width - 258), top: clamp(tooltipNode.y - 28, 12, sceneSize.height - 168) }}
          >
            <div className="mb-2 flex items-start justify-between gap-2"><p className="font-serif text-[15px] leading-4 text-stone-900">{hovered.company}</p><span className={hovered.pnl >= 0 ? "font-mono text-[10px] text-emerald-700" : "font-mono text-[10px] text-rose-700"}>{hovered.pnl >= 0 ? "+" : ""}{hovered.pnlPercent.toFixed(1)}%</span></div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[10px] tabular-nums"><span className="text-stone-400">Qty</span><span className="text-right">{hovered.qty}</span><span className="text-stone-400">Invested</span><span className="text-right">{formatCurrency(hovered.investedValue, true)}</span><span className="text-stone-400">Value</span><span className="text-right">{formatCurrency(hovered.currentValue, true)}</span><span className="text-stone-400">P&amp;L</span><span className={hovered.pnl >= 0 ? "text-right text-emerald-700" : "text-right text-rose-700"}>{formatCurrency(hovered.pnl, true)}</span></div>
          </motion.aside>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selected && focusNode && (
          <motion.aside
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
            className="fixed z-40 w-[min(336px,calc(100vw-28px))] overflow-hidden rounded-2xl border border-stone-200 bg-white/98 shadow-[0_22px_62px_-24px_rgba(41,37,36,.5)] backdrop-blur"
            style={{ left: clamp(focusOnRight ? focusNode.x + 76 : focusNode.x - 412, 14, sceneSize.width - 350), top: clamp(focusNode.y - 132, 14, sceneSize.height - 494) }}
          >
            <div className="flex items-start justify-between border-b border-stone-100 px-5 py-4"><div><p className="font-serif text-[19px] leading-5 text-stone-900">{selected.company}</p><p className="mt-1 font-mono text-[9px] uppercase tracking-[.17em] text-stone-400">{selected.lots.length === 1 ? "Transaction lot" : `${selected.lots.length} transaction lots`}</p></div><button type="button" onClick={() => setSelectedId(null)} aria-label="Close details" className="rounded-full p-1 text-stone-500 transition hover:bg-stone-100 hover:text-stone-900"><X size={16} /></button></div>
            <div className="grid grid-cols-2 gap-x-5 border-b border-stone-100 px-5 py-3"><MetricRow label="Quantity" value={selected.qty.toLocaleString("en-IN")} /><MetricRow label="Avg. buy" value={formatPrice(selected.avgPrice)} /><MetricRow label="Current" value={formatPrice(selected.currentPrice)} /><MetricRow label="Unrealized P&L" value={`${selected.pnl >= 0 ? "+" : ""}${formatCurrency(selected.pnl)}`} /></div>
            <div className="max-h-48 overflow-y-auto px-5 py-3"><p className="mb-2 font-mono text-[9px] uppercase tracking-[.18em] text-stone-400">Lot breakdown</p>{selected.lots.map((lot) => { const lotPnl = lot.buy_qty * (lot.current_price - lot.avg_price); const days = ageInDays(lot.buy_date); return <div key={lot.id} className="grid grid-cols-[1fr_auto] gap-2 border-t border-stone-100 py-2 first:border-t-0"><div><p className="font-mono text-[10px] text-stone-700">{lot.buy_qty} × {formatPrice(lot.avg_price)}</p><p className="font-mono text-[9px] text-stone-400">{lot.buy_date ? new Date(lot.buy_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "Date unavailable"}{days ? ` · ${days}d` : ""}</p></div><span className={lotPnl >= 0 ? "self-center font-mono text-[10px] text-emerald-700" : "self-center font-mono text-[10px] text-rose-700"}>{lotPnl >= 0 ? "+" : ""}{formatCurrency(lotPnl, true)}</span></div>; })}</div>
            {selected.taxSensitive && <div className="flex items-center gap-2 border-t border-amber-100 bg-amber-50 px-5 py-3 font-mono text-[10px] text-amber-800"><Sparkles size={13} /> Loss lot near/over the 365-day threshold.</div>}
          </motion.aside>
        )}
      </AnimatePresence>

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetTrigger asChild>
          <button type="button" aria-label="Open portfolio controls" className="fixed right-5 top-5 z-50 grid h-12 w-12 place-items-center rounded-full border border-stone-200 bg-white shadow-[0_10px_30px_-16px_rgba(41,37,36,.45)] transition duration-200 hover:-translate-y-0.5 hover:border-stone-300 hover:shadow-[0_13px_33px_-15px_rgba(41,37,36,.5)] active:scale-95"><Menu size={20} strokeWidth={1.8} /></button>
        </SheetTrigger>
        <SheetContent side="right" className="w-[min(390px,94vw)] gap-0 overflow-y-auto border-l border-stone-200 bg-[#fcfcfb] p-0 shadow-[-20px_0_60px_-34px_rgba(41,37,36,.48)] sm:max-w-none">
          <SheetHeader className="border-b border-stone-200 px-6 pb-5 pt-6"><div className="flex items-center gap-3"><img src={brandMark} alt="" className="h-9 w-9 object-contain" /><div><SheetTitle className="font-serif text-[25px] font-medium tracking-tight">ekitty</SheetTitle><p className="mt-0.5 font-mono text-[9px] uppercase tracking-[.18em] text-stone-400">living portfolio field</p></div></div></SheetHeader>
          <div className="space-y-7 px-6 py-6">
            <section><p className="control-label">View field</p><div className="mt-3 grid grid-cols-2 rounded-xl border border-stone-200 bg-white p-1">{([ ["holdings", "Grouped holdings"], ["transactions", "Transactions"] ] as const).map(([mode, label]) => <button key={mode} type="button" onClick={() => { setViewMode(mode); setSelectedId(null); }} className={viewMode === mode ? "rounded-lg bg-stone-900 px-2 py-2.5 font-mono text-[10px] text-white shadow-sm" : "rounded-lg px-2 py-2.5 font-mono text-[10px] text-stone-500 transition hover:text-stone-900"}>{label}</button>)}</div></section>
            <section><p className="control-label">Visual mapping</p><label className="field-label mt-3" htmlFor="size-map">Kitty scale</label><div className="select-wrap"><select id="size-map" value={sizeMetric} onChange={(event) => setSizeMetric(event.target.value as SizeMetric)}><option value="invested">Total invested value</option><option value="current">Current position value</option><option value="quantity">Quantity</option></select><ChevronDown size={14} /></div><label className="field-label mt-4" htmlFor="color-map">Body pigment</label><div className="select-wrap"><select id="color-map" value={colorMetric} onChange={(event) => setColorMetric(event.target.value as ColorMetric)}><option value="percent">P&amp;L percentage</option><option value="absolute">Absolute P&amp;L</option></select><ChevronDown size={14} /></div></section>
            <section><p className="control-label">Tax-loss lens</p><div className="mt-3 grid grid-cols-3 gap-1 rounded-xl border border-stone-200 bg-white p-1">{([ ["all", "All"], ["highlight", "Mark"], ["isolate", "Only"] ] as const).map(([filter, label]) => <button key={filter} type="button" onClick={() => { setTaxFilter(filter); setSelectedId(null); }} className={taxFilter === filter ? "rounded-lg bg-[#D8AE37] px-1 py-2.5 font-mono text-[10px] text-stone-900 shadow-sm" : "rounded-lg px-1 py-2.5 font-mono text-[10px] text-stone-500 transition hover:text-stone-900"}>{label}</button>)}</div><p className="mt-2 font-mono text-[9px] leading-4 text-stone-400">Gold collars flag loss lots dated 330+ days ago.</p></section>
            <section><div className="flex items-center justify-between"><p className="control-label">Field motion</p><button type="button" onClick={() => setFrozen((current) => !current)} className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-2.5 py-1.5 font-mono text-[9px] uppercase tracking-[.11em] text-stone-600 transition hover:border-stone-400">{frozen ? <Play size={11} /> : <Pause size={11} />}{frozen ? "Resume" : "Freeze"}</button></div><div className="mt-4 flex items-center gap-3"><span className="font-mono text-[10px] text-stone-500">Soft</span><input aria-label="Repulsion strength" type="range" min="0.2" max="1" step="0.05" value={repulsion} onChange={(event) => setRepulsion(Number(event.target.value))} className="kitty-range flex-1" /><span className="font-mono text-[10px] text-stone-500">Spacious</span></div></section>
            <section><p className="control-label">Portfolio CSV</p><label className="mt-3 flex cursor-pointer items-center justify-between rounded-xl border border-dashed border-stone-300 bg-white px-4 py-4 transition hover:border-stone-500 hover:bg-stone-50" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); importFile(event.dataTransfer.files[0]); }}><span><span className="block font-mono text-[10px] uppercase tracking-[.12em] text-stone-700">Import or drop a file</span><span className="mt-1 block font-mono text-[9px] text-stone-400">company · buy_qty · avg_price · current_price</span></span><FileUp size={18} className="text-stone-500" /><input type="file" accept=".csv,text/csv" className="sr-only" onChange={(event) => importFile(event.target.files?.[0])} /></label>{uploadNotice && <p className={uploadNotice.kind === "error" ? "mt-2 font-mono text-[9px] leading-4 text-rose-700" : "mt-2 font-mono text-[9px] leading-4 text-emerald-700"}>{uploadNotice.message}</p>}<button type="button" onClick={() => { setRecords(defaultPortfolio); setUploadNotice(null); setSelectedId(null); setHoveredId(null); }} className="mt-3 inline-flex items-center gap-2 font-mono text-[10px] text-stone-500 transition hover:text-stone-900"><RotateCcw size={12} /> Restore included field</button></section>
            <section className="border-t border-stone-200 pt-5"><div className="flex items-center justify-between font-mono text-[10px]"><span className="text-stone-400">Showing</span><span className="text-stone-700">{visiblePoints.length} kitties · {records.length} lots</span></div><div className="mt-2 flex items-center gap-1.5 font-mono text-[9px] text-stone-400"><Eye size={11} /> Hover for a label. Click to inspect the lot story.</div></section>
          </div>
        </SheetContent>
      </Sheet>
    </main>
  );
}
