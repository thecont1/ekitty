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
import { gsap } from "gsap";
import { ChevronDown, Eye, FileUp, Maximize2, Menu, Minimize2, Pause, Play, RotateCcw, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type ViewMode = "holdings" | "transactions";
type ColorMetric = "percent" | "absolute";
type TaxFilter = "all" | "highlight" | "isolate";
type SimNode = { x: number; y: number; vx: number; vy: number };
type FillTreatment = { fill: string; ink: string; fillOpacity: number; segment: string; neutral: boolean };
type VisiblePoint = { point: PortfolioPoint; size: number; stroke: number; treatment: FillTreatment; bobDuration: number };
type Timeline = { months: number[]; indexFor: Record<string, number>; hasDates: boolean };
type TimelineGesture = "idle" | "pan";
type TimelineDrag = { startX: number; startY: number; startPanX: number; startPanY: number; pointerId: number; gesture: TimelineGesture };

const PORTFOLIO_CSV_URL = "/manus-storage/PortfolioHoldingsTransactions_a72d31dd.csv";
const LOSS_RED = "#ff3b3b";
const GAIN_GREEN = "#17885b";
const SHOCKING_PINK = "#ff1493";
const MOUSE_CURSOR = "none";
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
  if (Math.abs(point.pnl) < 50 || percentile < 2) return { fill: "transparent", ink: "#8da0a9", fillOpacity: 0, segment: "<p2", neutral: true };
  if (percentile <= 5) {
    const target = point.pnl >= 0 ? GAIN_GREEN : LOSS_RED;
    const pale = point.pnl >= 0 ? "#effaf4" : "#fff1f1";
    return { fill: mixHex(pale, target, 0.12), ink: mixHex("#8da0a9", target, 0.18), fillOpacity: 0.12, segment: "p5", neutral: false };
  }
  const stops = [5, 10, 25, 50, 75, 90, 95, 98];
  const stopIndex = stops.findIndex((stop) => percentile <= stop);
  const intensity = clamp((stopIndex + 2) / (stops.length + 1), 0.2, 1);
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

function formatTransactionDate(date?: string) {
  return date ? new Date(date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "Date unavailable";
}

function createTimeline(points: PortfolioPoint[]): Timeline {
  const dated = points.map((point) => serialFromDate(point.oldestDate)).filter((value): value is number => value !== undefined);
  const now = new Date();
  const fallbackEnd = now.getFullYear() * 12 + now.getMonth();
  const start = dated.length ? Math.min(...dated) - 1 : fallbackEnd - 11;
  const end = dated.length ? Math.max(...dated, fallbackEnd) + 1 : fallbackEnd;
  const span = clamp(end - start + 1, 6, 48);
  const months = Array.from({ length: span }, (_, index) => start + index);
  const indexFor: Record<string, number> = {};
  points.forEach((point) => {
    const serial = serialFromDate(point.oldestDate);
    indexFor[point.id] = serial === undefined ? hash(point.id) % months.length : clamp(serial - start, 0, months.length - 1);
  });
  return { months, indexFor, hasDates: dated.length > 0 };
}

function CatGlyph({ point, size, stroke, treatment, bobDuration, focused, frozen, onHover, onLeave, onClick }: VisiblePoint & { focused: boolean; frozen: boolean; onHover: () => void; onLeave: () => void; onClick: () => void }) {
  const variation = hash(point.id);
  const lean = (variation % 11) - 5;
  const widthScale = 0.93 + ((variation >>> 5) % 13) / 100;
  const skew = ((variation >>> 11) % 9) - 4;
  const heightScale = 0.94 + ((variation >>> 16) % 15) / 100;
  const tailArc = variation % 3 === 0 ? "M150 112 C174 104 176 82 162 72" : variation % 3 === 1 ? "M148 117 C172 118 181 97 166 83" : "M147 110 C171 95 166 77 157 67";
  const bobStyle = frozen ? undefined : { animationName: "kitty-bob", animationDuration: `${bobDuration}s`, animationTimingFunction: "cubic-bezier(.42,0,.3,1)", animationIterationCount: "infinite", animationDirection: "alternate", animationDelay: `-${(hash(point.id) % 1000) / 1000}s` };

  return (
    <button type="button" aria-label={`${point.company}: ${formatCurrency(point.pnl)} unrealized profit and loss`} className="group absolute z-10 block origin-center border-0 bg-transparent p-0 outline-none focus-visible:z-30 focus-visible:outline-none" style={{ width: size, height: size, transform: "translate(-50%, -50%)", cursor: MOUSE_CURSOR }} onPointerDown={(event) => event.stopPropagation()} onMouseEnter={onHover} onFocus={onHover} onMouseLeave={onLeave} onBlur={onLeave} onClick={onClick}>
      <span className="relative block h-full w-full transition-transform duration-200 ease-out group-hover:scale-[1.055] group-focus-visible:scale-[1.055]" style={{ transform: `rotate(${lean}deg) skewX(${skew}deg) scale(${widthScale}, ${heightScale})` }}>
        <span className="relative block h-full w-full" style={bobStyle}>
          {focused && <span className="absolute inset-[5%] rounded-full border-[1.5px] border-[#D8AE37]" />}
          <PortfolioKittySvg stroke={treatment.ink} fill={treatment.fill} fillOpacity={treatment.fillOpacity} strokeWidth={stroke} className="block h-full w-full overflow-visible" />
          <svg viewBox="0 0 192 192" className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" aria-hidden="true"><path d={tailArc} fill="none" stroke={treatment.ink} strokeWidth={Math.max(1.1, stroke * 0.68)} strokeLinecap="round" /></svg>
          {point.taxSensitive && <span className="absolute left-[42.8%] top-[53.2%] h-[10%] w-[10%] rounded-full border-[1.25px] border-black bg-[#D8AE37] shadow-[0_0_0_1px_rgba(255,255,255,.65)]" />}
          {point.isETF && <span className="absolute left-[54%] top-[60%] rounded-sm border border-[#9AA5AA] bg-white/95 px-[7%] py-[2%] font-mono text-[7px] font-semibold tracking-[.08em] text-stone-700 shadow-[0_1px_3px_rgba(41,37,36,.12)]">ETF</span>}
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
  const [viewMode, setViewMode] = useState<ViewMode>("holdings");
  const [colorMetric, setColorMetric] = useState<ColorMetric>("absolute");
  const [taxFilter, setTaxFilter] = useState<TaxFilter>("all");
  const [showEtfs, setShowEtfs] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [repulsion, setRepulsion] = useState(0.62);
  const [frozen, setFrozen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusedCompany, setFocusedCompany] = useState<string | null>(null);
  const [companyQuery, setCompanyQuery] = useState("");
  const [uploadNotice, setUploadNotice] = useState<{ kind: "error" | "success"; message: string } | null>(null);
  const [sceneSize, setSceneSize] = useState({ width: 1200, height: 800 });
  const [visibleMonthCount, setVisibleMonthCount] = useState(24);
  const [requestedMonthWindowStart, setRequestedMonthWindowStart] = useState(0);
  const [timelineGesture, setTimelineGesture] = useState<TimelineGesture>("idle");
  const [timelinePanOffset, setTimelinePanOffset] = useState(0);
  const [canvasPanY, setCanvasPanY] = useState(0);
  const [isWorldFit, setIsWorldFit] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0, visible: false });
  const [dataUpdatedAt, setDataUpdatedAt] = useState<string | null>(null);
  const [, repaint] = useState(0);
  const nodes = useRef<Record<string, SimNode>>({});
  const frame = useRef<number | null>(null);
  const timelineScroller = useRef<HTMLDivElement | null>(null);
  const horizontalDrag = useRef<TimelineDrag | null>(null);
  const camera = useRef({ x: 0, y: 0, scale: 1 });
  const gridWorld = useRef<HTMLDivElement | null>(null);
  const kittyWorld = useRef<HTMLElement | null>(null);
  const datelineWorld = useRef<HTMLDivElement | null>(null);
  const cameraTween = useRef<gsap.core.Tween | null>(null);
  const wheelZoomRemainder = useRef(0);
  const hasPositionedLatestWindow = useRef(false);

  const eligibleRecords = useMemo(() => showEtfs ? records : records.filter((record) => !record.isETF), [records, showEtfs]);
  const etfLotCount = useMemo(() => records.filter((record) => record.isETF).length, [records]);
  const transactionPoints = useMemo(() => asTransactionPoints(eligibleRecords), [eligibleRecords]);
  const points = useMemo(() => viewMode === "holdings" ? asHoldingPoints(eligibleRecords) : transactionPoints, [eligibleRecords, transactionPoints, viewMode]);
  const filteredPoints = useMemo(() => taxFilter === "isolate" ? points.filter((point) => point.taxSensitive) : points, [points, taxFilter]);
  const timeline = useMemo(() => createTimeline(transactionPoints), [transactionPoints]);
  const monthMinimum = Math.min(6, timeline.months.length);
  const monthMaximum = Math.min(24, timeline.months.length);
  const effectiveMonthCount = clamp(visibleMonthCount, monthMinimum, monthMaximum);
  const maxMonthWindowStart = Math.max(0, timeline.months.length - effectiveMonthCount);
  const monthWindowStart = clamp(requestedMonthWindowStart, 0, maxMonthWindowStart);
  const monthWindowEnd = monthWindowStart + effectiveMonthCount;
  const filteredTransactionPoints = useMemo(() => taxFilter === "isolate" ? transactionPoints.filter((point) => point.taxSensitive) : transactionPoints, [taxFilter, transactionPoints]);
  const transactionWindowPoints = filteredTransactionPoints;
  const fieldPoints = useMemo(() => viewMode === "transactions" ? transactionWindowPoints : filteredPoints, [filteredPoints, transactionWindowPoints, viewMode]);
  const transactionStripWidth = (sceneSize.width * 3) / Math.max(monthMaximum, 1);
  const virtualCanvasWidth = viewMode === "transactions" ? Math.max(sceneSize.width, timeline.months.length * transactionStripWidth) : Math.max(sceneSize.width * 1.4, 1_500);
  const virtualCanvasHeight = viewMode === "transactions" ? Math.max(1_560, sceneSize.height * 2.25) : Math.max(1_320, sceneSize.height * 1.85);
  const minCanvasPanX = Math.min(0, sceneSize.width - virtualCanvasWidth);
  const minCanvasPanY = Math.min(0, sceneSize.height - virtualCanvasHeight);
  const physicsWidth = virtualCanvasWidth;
  const transactionLayoutHeight = virtualCanvasHeight;
  const pnlScaleMargin = sceneSize.width < 640 ? 66 : 84;
  const topKittyMargin = 54;
  const pnlBound = useMemo(() => Math.max(5_000, Math.ceil(Math.max(1, ...fieldPoints.map((point) => Math.abs(point.pnl))) / 5_000) * 5_000), [fieldPoints]);
  const pnlTicks = useMemo(() => Array.from({ length: (pnlBound / 5_000) * 2 + 1 }, (_, index) => -pnlBound + index * 5_000), [pnlBound]);
  const pnlPosition = useMemo(() => {
    const sorted = [...fieldPoints].sort((left, right) => left.pnl - right.pnl);
    return Object.fromEntries(sorted.map((point, index) => [point.id, sorted.length <= 1 ? 0.5 : index / (sorted.length - 1)]));
  }, [fieldPoints]);
  const rankings = useMemo(() => percentileRanks(fieldPoints, colorMetric), [colorMetric, fieldPoints]);

  const setCameraTransform = useCallback((x: number, y: number, scale = 1) => {
    camera.current.x = x;
    camera.current.y = y;
    camera.current.scale = scale;
    if (gridWorld.current) gsap.set(gridWorld.current, { x, y, scale, transformOrigin: "left top", force3D: true });
    if (kittyWorld.current) gsap.set(kittyWorld.current, { x, y, scale, transformOrigin: "left top", force3D: true });
    if (datelineWorld.current) gsap.set(datelineWorld.current, { x, scale, transformOrigin: "left top", force3D: true });
  }, []);

  const settleCamera = useCallback((x: number, y: number, duration = 0.28, scale = 1) => {
    cameraTween.current?.kill();
    cameraTween.current = gsap.to(camera.current, {
      x,
      y,
      scale,
      duration,
      ease: "power4.out",
      overwrite: "auto",
      onUpdate: () => setCameraTransform(camera.current.x, camera.current.y, camera.current.scale),
      onComplete: () => {
        setTimelinePanOffset(x);
        setCanvasPanY(y);
        cameraTween.current = null;
      },
    });
  }, [setCameraTransform]);

  const visiblePoints = useMemo<VisiblePoint[]>(() => {
    const values = fieldPoints.map((point) => point.investedValue ** 1.14);
    const min = Math.min(...values, 0);
    const max = Math.max(...values, 1);
    const maxQty = Math.max(...fieldPoints.map((point) => point.qty), 1);
    const compactField = sceneSize.width < 640;
    const minSize = compactField ? (viewMode === "transactions" ? 28 : 38) : (viewMode === "transactions" ? 34 : 46);
    const maxSize = compactField ? (viewMode === "transactions" ? 140 : 212) : (viewMode === "transactions" ? 236 : 440);
    return fieldPoints.map((point) => ({ point, size: scale(point.investedValue ** 1.14, min, max, minSize, maxSize), stroke: scale(point.qty, 0, maxQty, 1.65, 4.5), treatment: treatmentFor(point, rankings[point.id] ?? 0), bobDuration: clamp(3.6 - Math.min(1.75, Math.abs(point.pnlPercent) / 35), 1.7, 3.6) }));
  }, [fieldPoints, rankings, sceneSize.width, viewMode]);

  const selected = visiblePoints.find((entry) => entry.point.id === selectedId)?.point ?? null;
  const hovered = visiblePoints.find((entry) => entry.point.id === hoveredId)?.point ?? null;
  const searchTerm = companyQuery.trim().toLocaleLowerCase();
  const elapsedYearGuides = useMemo(() => {
    const now = new Date();
    const currentSerial = now.getFullYear() * 12 + now.getMonth();
    return Array.from({ length: 12 }, (_, index) => index + 1).map((years) => ({ years, serial: currentSerial - years * 12 })).filter((guide) => {
      const monthIndex = timeline.months.indexOf(guide.serial);
      return monthIndex >= 0;
    });
  }, [timeline]);

  const resetViewport = useCallback(() => {
    horizontalDrag.current = null;
    setVisibleMonthCount(monthMaximum);
    setRequestedMonthWindowStart(Math.max(0, timeline.months.length - monthMaximum));
    setFocusedCompany(null);
    setCompanyQuery("");
    setTaxFilter("all");
    setHoveredId(null);
    setSelectedId(null);
    setFrozen(false);
    setTimelineGesture("idle");
    // The world origin for the default transaction view is the latest month at top-right.
    setIsWorldFit(false);
    settleCamera(minCanvasPanX, 0, 0.62, 1);
    Object.values(nodes.current).forEach((node) => { node.vx = 0; node.vy = 0; });
    repaint((value) => (value + 1) % 10_000);
  }, [minCanvasPanX, monthMaximum, settleCamera, timeline.months.length]);

  const toggleWorldFit = useCallback(() => {
    if (isWorldFit) {
      setIsWorldFit(false);
      settleCamera(minCanvasPanX, 0, 0.46, 1);
      return;
    }
    const availableWidth = Math.max(200, sceneSize.width - 28);
    const availableHeight = Math.max(200, sceneSize.height - 60);
    const scale = Math.min(1, availableWidth / virtualCanvasWidth, availableHeight / virtualCanvasHeight);
    setIsWorldFit(true);
    settleCamera((sceneSize.width - virtualCanvasWidth * scale) / 2, Math.max(42, (sceneSize.height - virtualCanvasHeight * scale) / 2), 0.54, scale);
  }, [isWorldFit, minCanvasPanX, sceneSize.height, sceneSize.width, settleCamera, virtualCanvasHeight, virtualCanvasWidth]);

  const beginTimelineDrag = useCallback((event: React.PointerEvent<HTMLElement>) => {
    if (isWorldFit) {
      setIsWorldFit(false);
      setCameraTransform(minCanvasPanX, 0);
    }
    cameraTween.current?.kill();
    horizontalDrag.current = { startX: event.clientX, startY: event.clientY, startPanX: camera.current.x, startPanY: camera.current.y, pointerId: event.pointerId, gesture: "idle" };
    event.currentTarget.setPointerCapture(event.pointerId);
  }, [isWorldFit, minCanvasPanX, setCameraTransform]);

  const moveTimelineDrag = useCallback((event: React.PointerEvent<HTMLElement>) => {
    const drag = horizontalDrag.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    if (drag.gesture === "idle" && Math.max(Math.abs(deltaX), Math.abs(deltaY)) < 12) return;
    if (drag.gesture === "idle") {
      drag.gesture = "pan";
      setTimelineGesture(drag.gesture);
    }
    setCameraTransform(clamp(drag.startPanX + deltaX, minCanvasPanX, 0), clamp(drag.startPanY + deltaY, minCanvasPanY, 0));
  }, [minCanvasPanX, minCanvasPanY, setCameraTransform]);

  const endTimelineDrag = useCallback((event: React.PointerEvent<HTMLElement>) => {
    const drag = horizontalDrag.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (drag.gesture !== "idle") { setTimelinePanOffset(camera.current.x); setCanvasPanY(camera.current.y); }
    setTimelineGesture("idle");
    horizontalDrag.current = null;
  }, []);

  const scrollTimeline = useCallback((event: React.WheelEvent<HTMLElement>) => {
    if (!event.deltaX && !event.deltaY) return;
    event.preventDefault();
    const nextX = clamp(camera.current.x - event.deltaX, minCanvasPanX, 0);
    const nextY = clamp(camera.current.y - event.deltaY, minCanvasPanY, 0);
    setCameraTransform(nextX, nextY);
    setTimelinePanOffset(nextX);
    setCanvasPanY(nextY);
  }, [minCanvasPanX, minCanvasPanY, setCameraTransform]);

  useEffect(() => {
    const updateSize = () => setSceneSize({ width: window.innerWidth, height: window.innerHeight });
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, [viewMode]);

  useEffect(() => {
    cameraTween.current?.kill();
    setCameraTransform(minCanvasPanX, 0);
    setTimelinePanOffset(minCanvasPanX);
    setCanvasPanY(0);
  }, [minCanvasPanX, setCameraTransform, viewMode]);

  useEffect(() => {
    setVisibleMonthCount((current) => clamp(current, monthMinimum, monthMaximum));
  }, [monthMaximum, monthMinimum, records]);

  useEffect(() => {
    if (!timeline.hasDates || hasPositionedLatestWindow.current) return;
    setRequestedMonthWindowStart(maxMonthWindowStart);
    hasPositionedLatestWindow.current = true;
  }, [maxMonthWindowStart, timeline.hasDates]);

  useEffect(() => {
    setRequestedMonthWindowStart((current) => clamp(current, 0, maxMonthWindowStart));
  }, [maxMonthWindowStart]);

  useEffect(() => {
    if (viewMode !== "transactions" || !focusedCompany || !timeline.months.length) return;
    const companyIndices = transactionPoints.filter((point) => point.company === focusedCompany).map((point) => timeline.indexFor[point.id]).filter((index): index is number => index !== undefined);
    if (!companyIndices.length) return;
    const focusX = (Math.min(...companyIndices) + 0.5) * transactionStripWidth;
    settleCamera(clamp(sceneSize.width * 0.5 - focusX, minCanvasPanX, 0), camera.current.y, 0.36);
  }, [focusedCompany, minCanvasPanX, sceneSize.width, settleCamera, timeline, transactionPoints, transactionStripWidth, viewMode]);

  useEffect(() => () => { cameraTween.current?.kill(); }, []);

  useEffect(() => {
    nodes.current = {};
    setHoveredId(null);
    setSelectedId(null);
    setFocusedCompany(null);
  }, [showEtfs, viewMode]);

  useEffect(() => {
    let mounted = true;
    fetch(PORTFOLIO_CSV_URL).then(async (response) => ({ text: await response.text(), lastModified: response.headers.get("last-modified") })).then(({ text, lastModified }) => {
      const parsed = parsePortfolioCsv(text);
      if (mounted && parsed.records.length) { setRecords(parsed.records); setDataUpdatedAt(lastModified ?? new Date().toISOString()); }
    }).catch(() => undefined);
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    const nextNodes: Record<string, SimNode> = {};
    visiblePoints.forEach(({ point }, index) => {
      const current = nodes.current[point.id];
      const seed = hash(point.id);
      const padding = 48;
      nextNodes[point.id] = current ?? { x: padding + (seed % Math.max(120, physicsWidth - padding * 2)), y: padding + ((seed >>> 8) % Math.max(120, sceneSize.height - padding * 2)), vx: ((index % 3) - 1) * 0.18, vy: (((index + 1) % 3) - 1) * 0.18 };
    });
    nodes.current = nextNodes;
  }, [physicsWidth, sceneSize, visiblePoints]);

  useEffect(() => {
    let last = performance.now();
    const tick = (time: number) => {
      const delta = Math.min(1.4, (time - last) / 16.67);
      last = time;
      if (!frozen && timelineGesture !== "pan") {
        const nodeList = visiblePoints.map(({ point, size }, index) => ({ node: nodes.current[point.id], point, size, index })).filter((entry) => entry.node);
        nodeList.forEach(({ node, point, index, size }) => {
          const seed = hash(point.id);
          let anchorX: number;
          let anchorY: number;
          let pull: number;
          if (viewMode === "transactions") {
            const stripWidth = transactionStripWidth;
            const monthIndex = timeline.indexFor[point.id] ?? seed % timeline.months.length;
            anchorX = (monthIndex + 0.5) * stripWidth + (((seed >>> 10) % 100) / 100 - 0.5) * stripWidth * 0.42;
            const verticalMargin = Math.max(pnlScaleMargin, Math.min(94, size * 0.4));
            const pnlRatio = pnlPosition[point.id] ?? 0.5;
            const laneJitter = (((seed >>> 18) % 100) / 100 - 0.5) * Math.min(12, stripWidth * 0.12);
            anchorY = Math.max(topKittyMargin + size * 0.62, verticalMargin + (1 - pnlRatio) * (transactionLayoutHeight - verticalMargin * 2) + laneJitter);
            pull = 0.0055;
          } else {
            anchorX = physicsWidth * (0.08 + ((seed % 840) / 1000));
            anchorY = topKittyMargin + size * 0.62 + (transactionLayoutHeight - topKittyMargin - size * 1.24) * (0.11 + (((seed >>> 9) % 710) / 1000));
            pull = 0.00048;
          }
          node.vx += (anchorX - node.x) * pull * delta;
          node.vy += (anchorY - node.y) * pull * delta;
          if (point.id === selectedId) { node.vx += (physicsWidth * 0.5 - node.x) * 0.0028 * delta; node.vy += (sceneSize.height * 0.5 - node.y) * 0.0028 * delta; }
        });
        for (let left = 0; left < nodeList.length; left += 1) for (let right = left + 1; right < nodeList.length; right += 1) {
          const a = nodeList[left]; const b = nodeList[right]; const dx = b.node.x - a.node.x; const dy = b.node.y - a.node.y; const distance = Math.max(Math.hypot(dx, dy), 0.01); const desired = (a.size + b.size) * 0.66 + 24;
          if (distance < desired) { const force = ((desired - distance) / desired) * 1.24 * repulsion * delta; const nx = dx / distance; const ny = dy / distance; a.node.vx -= nx * force; a.node.vy -= ny * force; b.node.vx += nx * force; b.node.vy += ny * force; }
        }
        nodeList.forEach(({ node, size, point }) => {
          const margin = Math.max(42, size * 0.62);
          node.vx += (node.x < margin ? margin - node.x : node.x > physicsWidth - margin ? physicsWidth - margin - node.x : 0) * 0.008;
          const topBoundary = Math.max(topKittyMargin + size * 0.62, margin);
          node.vy += (node.y < topBoundary ? topBoundary - node.y : node.y > transactionLayoutHeight - margin ? transactionLayoutHeight - margin - node.y : 0) * 0.008;
          node.vx *= 0.91; node.vy *= 0.91; node.x += node.vx * delta; node.y += node.vy * delta;
          if (viewMode === "transactions") {
            const stripWidth = transactionStripWidth;
            const monthIndex = timeline.indexFor[point.id] ?? 0;
            const edge = Math.min(Math.max(3, size * 0.08), stripWidth * 0.18);
            node.x = clamp(node.x, monthIndex * stripWidth + edge, (monthIndex + 1) * stripWidth - edge);
            if (monthIndex === 0) node.x = Math.max(node.x, size * 0.42);
            if (monthIndex === timeline.months.length - 1) node.x = Math.min(node.x, virtualCanvasWidth - size * 0.42);
            const verticalMargin = Math.max(pnlScaleMargin, Math.min(94, size * 0.4));
            const pnlRatio = pnlPosition[point.id] ?? 0.5;
            const laneY = verticalMargin + (1 - pnlRatio) * (transactionLayoutHeight - verticalMargin * 2);
            const laneFreedom = Math.max(68, Math.min(180, size * 0.78));
            node.y = clamp(node.y, Math.max(topKittyMargin + size * 0.62, laneY - laneFreedom), laneY + laneFreedom);
          }
        });
        repaint((value) => (value + 1) % 10_000);
      }
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => { if (frame.current) cancelAnimationFrame(frame.current); };
  }, [frozen, physicsWidth, pnlPosition, pnlScaleMargin, repulsion, sceneSize, selectedId, timeline, timelineGesture, topKittyMargin, transactionLayoutHeight, transactionStripWidth, viewMode, virtualCanvasWidth, visiblePoints]);

  const importFile = useCallback((file?: File) => {
    if (!file) return;
    file.text().then((text) => {
      const parsed = parsePortfolioCsv(text);
      if (parsed.error) { setUploadNotice({ kind: "error", message: parsed.error }); return; }
      setRecords(parsed.records); setDataUpdatedAt(new Date().toISOString()); setUploadNotice({ kind: "success", message: `${parsed.records.length} lots loaded into the field.` }); setSelectedId(null); setHoveredId(null); setTaxFilter("all");
    });
  }, []);

  const tooltipNode = hovered ? nodes.current[hovered.id] : null;
  const focusNode = selected ? nodes.current[selected.id] : null;
  const activeCanvasPanX = timelinePanOffset;
  const activeCanvasPanY = canvasPanY;
  const focusOnRight = (focusNode?.x ?? 0) + activeCanvasPanX < sceneSize.width * 0.55;
  const handleFieldPointerMove = useCallback((event: React.PointerEvent<HTMLElement>) => {
    const nextPosition = { x: event.clientX, y: event.clientY };
    setMousePosition({ ...nextPosition, visible: true });
    moveTimelineDrag(event);
  }, [moveTimelineDrag]);

  return (
    <main className={darkMode ? "dark relative h-[100dvh] w-screen overflow-hidden bg-[#101617] text-stone-100" : "relative h-[100dvh] w-screen overflow-hidden bg-white text-stone-900"}>
      {viewMode === "transactions" && <div ref={gridWorld} aria-hidden="true" className="pointer-events-none absolute left-0 top-0 z-0 overflow-hidden" style={{ width: virtualCanvasWidth, height: virtualCanvasHeight }}>{pnlTicks.map((tick) => { const ratio = (tick + pnlBound) / (pnlBound * 2); return <div key={`grid-${tick}`} className={darkMode ? "absolute left-0 right-0 border-t border-[#20353b]/28" : "absolute left-0 right-0 border-t border-[#dbeef8]/34"} style={{ top: pnlScaleMargin + (1 - ratio) * (transactionLayoutHeight - pnlScaleMargin * 2) }} />; })}{timeline.months.map((month, index) => <div key={month} className={darkMode ? "absolute bottom-0 top-0 border-l border-[#284149]/42" : "absolute bottom-0 top-0 border-l border-[#edf7ff]/46"} style={{ left: index * transactionStripWidth }} />)}{elapsedYearGuides.map((guide) => { const index = timeline.months.indexOf(guide.serial); return <div key={`year-${guide.years}`} className="absolute bottom-0 top-0 w-[3px] bg-[#70b9e8] shadow-[0_0_0_1px_rgba(112,185,232,.14)]" style={{ left: index * transactionStripWidth }} />; })}</div>}
      {viewMode === "transactions" && <div aria-hidden="true" className={darkMode ? "pointer-events-none fixed inset-x-0 top-0 z-20 h-10 overflow-hidden bg-[#101617]/88 backdrop-blur-[2px]" : "pointer-events-none fixed inset-x-0 top-0 z-20 h-10 overflow-hidden bg-white/88 backdrop-blur-[2px]"}><div ref={datelineWorld} className="relative h-full" style={{ width: virtualCanvasWidth }}>{timeline.months.map((month, index) => index % 3 === 0 && <span key={`label-${month}`} className={darkMode ? "absolute top-3 hidden font-mono text-[9px] font-medium tracking-[.12em] text-[#a6c2cc] md:block" : "absolute top-3 hidden font-mono text-[9px] font-medium tracking-[.12em] text-[#61869d] md:block"} style={{ left: index * transactionStripWidth + 4 }}>{labelMonth(month)}</span>)}{elapsedYearGuides.map((guide) => { const index = timeline.months.indexOf(guide.serial); return <span key={`year-label-${guide.years}`} className="absolute top-7 font-mono text-[8px] tracking-[.12em] text-[#4096cf]" style={{ left: index * transactionStripWidth + 5 }}>{guide.years}y</span>; })}</div></div>}
      <button type="button" aria-label="Reset portfolio field" onPointerDown={(event) => event.stopPropagation()} onClick={resetViewport} className={darkMode ? "fixed right-5 top-[8.5rem] z-40 grid h-12 w-12 place-items-center rounded-full border border-[#49636a] bg-[#142022] text-stone-300 shadow-[0_10px_30px_-16px_rgba(0,0,0,.72)] transition hover:-translate-y-0.5 hover:border-[#D8AE37] hover:text-[#D8AE37] active:scale-95" : "fixed right-5 top-[8.5rem] z-40 grid h-12 w-12 place-items-center rounded-full border border-stone-200 bg-white text-stone-500 shadow-[0_10px_30px_-16px_rgba(41,37,36,.45)] transition hover:-translate-y-0.5 hover:border-[#D8AE37] hover:text-[#a87c12] active:scale-95"}><RotateCcw size={17} /></button>
      <button type="button" aria-label={isWorldFit ? "Restore normal world view" : "Show all kitties"} onPointerDown={(event) => event.stopPropagation()} onClick={toggleWorldFit} className={darkMode ? "fixed right-5 top-[12.5rem] z-40 grid h-12 w-12 place-items-center rounded-full border border-[#49636a] bg-[#142022] text-stone-300 shadow-[0_10px_30px_-16px_rgba(0,0,0,.72)] transition hover:-translate-y-0.5 hover:border-[#D8AE37] hover:text-[#D8AE37] active:scale-95" : "fixed right-5 top-[12.5rem] z-40 grid h-12 w-12 place-items-center rounded-full border border-stone-200 bg-white text-stone-500 shadow-[0_10px_30px_-16px_rgba(41,37,36,.45)] transition hover:-translate-y-0.5 hover:border-[#D8AE37] hover:text-[#a87c12] active:scale-95"}>{isWorldFit ? <Minimize2 size={17} /> : <Maximize2 size={17} />}</button>
      <div className="fixed bottom-11 left-1/2 z-40 -translate-x-1/2"><input aria-label="Find a company" value={companyQuery} onChange={(event) => setCompanyQuery(event.target.value)} onPointerDown={(event) => event.stopPropagation()} className={darkMode ? "w-[min(348px,calc(100vw-32px))] rounded-full border border-[#49636a] bg-[#142022] px-4 py-1.5 font-mono text-[9px] text-stone-100 shadow-[0_6px_18px_-12px_rgba(0,0,0,.8)] outline-none placeholder:text-stone-400 focus:border-[#D8AE37]" : "w-[min(348px,calc(100vw-32px))] rounded-full border border-stone-300 bg-white px-4 py-1.5 font-mono text-[9px] text-stone-700 shadow-[0_6px_18px_-12px_rgba(41,37,36,.28)] outline-none placeholder:text-stone-500 focus:border-[#D8AE37]"} placeholder="look what the cat brought in" /></div>
      <section ref={kittyWorld} aria-label="Portfolio kitty field" className="absolute left-0 top-0 z-10 touch-none" style={{ width: virtualCanvasWidth, height: virtualCanvasHeight, cursor: MOUSE_CURSOR }} onWheel={scrollTimeline} onPointerDown={(event) => { const nextPosition = { x: event.clientX, y: event.clientY }; setMousePosition({ ...nextPosition, visible: true }); beginTimelineDrag(event); }} onPointerMove={handleFieldPointerMove} onPointerEnter={(event) => { const nextPosition = { x: event.clientX, y: event.clientY }; setMousePosition({ ...nextPosition, visible: true }); }} onPointerLeave={() => { setMousePosition((current) => ({ ...current, visible: false })); }} onPointerUp={endTimelineDrag} onPointerCancel={endTimelineDrag}>
        {visiblePoints.map((entry) => {
          const node = nodes.current[entry.point.id]; if (!node) return null;
          const searchMatch = !searchTerm || entry.point.company.toLocaleLowerCase().includes(searchTerm);
          const muted = (taxFilter === "highlight" && !entry.point.taxSensitive) || (viewMode === "transactions" && focusedCompany !== null && entry.point.company !== focusedCompany) || !searchMatch;
          return <div key={entry.point.id} className={muted ? "opacity-20 grayscale-[.32] transition-opacity duration-300" : "transition-opacity duration-300"} style={{ position: "absolute", left: node.x, top: node.y }}><CatGlyph {...entry} focused={viewMode === "transactions" ? focusedCompany === entry.point.company || Boolean(searchTerm && searchMatch) : selectedId === entry.point.id} frozen={frozen} onHover={() => setHoveredId(entry.point.id)} onLeave={() => setHoveredId((current) => current === entry.point.id ? null : current)} onClick={() => { if (viewMode === "transactions") { setFocusedCompany((current) => current === entry.point.company ? null : entry.point.company); setSelectedId(null); setHoveredId(null); } else { setSelectedId(entry.point.id); setHoveredId(null); } }} /></div>;
        })}
      </section>

      {mousePosition.visible && <>
        <div aria-hidden="true" className="pointer-events-none fixed z-[60] -translate-x-1/2 -translate-y-1/2" style={{ left: mousePosition.x, top: mousePosition.y, filter: `drop-shadow(0 0 4px ${SHOCKING_PINK})` }}><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={SHOCKING_PINK} strokeWidth="1.15" strokeLinecap="round" strokeLinejoin="round"><path d="M5.5 3a3.5 3.5 0 0 1 3.25 4.8a7.017 7.017 0 0 0 -2.424 2.1a3.5 3.5 0 1 1 -.826 -6.9z" /><path d="M18.5 3a3.5 3.5 0 1 1 -.826 6.902a7.013 7.013 0 0 0 -2.424 -2.103a3.5 3.5 0 0 1 3.25 -4.799z" /><path d="M12 14m-7 0a7 7 0 1 0 14 0a7 7 0 1 0 -14 0" /></svg></div>
      </>}
      <AnimatePresence>{hovered && tooltipNode && !selected && <motion.aside initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }} transition={{ duration: 0.16 }} className="pointer-events-none fixed z-30 w-64 rounded-xl border border-stone-200/90 bg-white/95 px-4 py-3 shadow-[0_16px_45px_-20px_rgba(41,37,36,.42)] backdrop-blur" style={{ left: clamp(tooltipNode.x + activeCanvasPanX + 34, 12, sceneSize.width - 274), top: clamp(tooltipNode.y + activeCanvasPanY - 28, 12, sceneSize.height - 184) }}><div className="mb-2 flex items-start justify-between gap-2"><p className="font-serif text-[15px] leading-4 text-stone-900">{hovered.company}</p><span className={hovered.pnl >= 0 ? "font-mono text-[10px] text-emerald-700" : "font-mono text-[10px] text-[#ff3b3b]"}>{hovered.pnl >= 0 ? "+" : ""}{hovered.pnlPercent.toFixed(1)}%</span></div><div className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[10px] tabular-nums">{viewMode === "transactions" && <><span className="text-stone-400">Date</span><span className="text-right">{formatTransactionDate(hovered.oldestDate)}</span></>}<span className="text-stone-400">Qty</span><span className="text-right">{hovered.qty}</span><span className="text-stone-400">Buy price</span><span className="text-right">{formatPrice(hovered.avgPrice)}</span><span className="text-stone-400">Current price</span><span className="text-right">{formatPrice(hovered.currentPrice)}</span><span className="text-stone-400">Invested</span><span className="text-right">{formatCurrency(hovered.investedValue)}</span><span className="text-stone-400">Value</span><span className="text-right">{formatCurrency(hovered.currentValue)}</span><span className="text-stone-400">P&amp;L</span><span className={hovered.pnl >= 0 ? "text-right text-emerald-700" : "text-right text-[#ff3b3b]"}>{formatCurrency(hovered.pnl)}</span></div></motion.aside>}</AnimatePresence>

      <AnimatePresence>{viewMode === "holdings" && selected && focusNode && <motion.aside initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.98 }} transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }} className="fixed z-40 w-[min(336px,calc(100vw-28px))] overflow-hidden rounded-2xl border border-stone-200 bg-white/98 shadow-[0_22px_62px_-24px_rgba(41,37,36,.5)] backdrop-blur" style={{ left: clamp(focusOnRight ? focusNode.x + 76 : focusNode.x - 412, 14, sceneSize.width - 350), top: clamp(focusNode.y - 132, 14, sceneSize.height - 494) }}><div className="flex items-start justify-between border-b border-stone-100 px-5 py-4"><div><p className="font-serif text-[19px] leading-5 text-stone-900">{selected.company}</p><p className="mt-1 font-mono text-[9px] uppercase tracking-[.17em] text-stone-400">{selected.lots.length === 1 ? "Transaction lot" : `${selected.lots.length} transaction lots`}</p></div><button type="button" onClick={() => setSelectedId(null)} aria-label="Close details" className="rounded-full p-1 text-stone-500 transition hover:bg-stone-100 hover:text-stone-900"><X size={16} /></button></div><div className="grid grid-cols-2 gap-x-5 border-b border-stone-100 px-5 py-3"><MetricRow label="Quantity" value={selected.qty.toLocaleString("en-IN")} /><MetricRow label="Avg. buy" value={formatPrice(selected.avgPrice)} /><MetricRow label="Current" value={formatPrice(selected.currentPrice)} /><MetricRow label="Unrealized P&L" value={`${selected.pnl >= 0 ? "+" : ""}${formatCurrency(selected.pnl)}`} /></div><div className="max-h-48 overflow-y-auto px-5 py-3"><p className="mb-2 font-mono text-[9px] uppercase tracking-[.18em] text-stone-400">Lot breakdown</p>{selected.lots.map((lot) => { const lotPnl = lot.buy_qty * (lot.current_price - lot.avg_price); const days = ageInDays(lot.buy_date); const completedYears = Math.floor((days ?? 0) / 365); return <div key={lot.id} className="grid grid-cols-[1fr_auto] gap-2 border-t border-stone-100 py-2 first:border-t-0"><div><p className="font-mono text-[10px] text-stone-700">{lot.buy_qty} × {formatPrice(lot.avg_price)}</p><p className="font-mono text-[9px] text-stone-400">{formatTransactionDate(lot.buy_date)}{days ? ` · ${days}d` : ""}{completedYears ? ` · ${completedYears}y complete` : ""}</p></div><span className={lotPnl >= 0 ? "self-center font-mono text-[10px] text-emerald-700" : "self-center font-mono text-[10px] text-[#ff3b3b]"}>{lotPnl >= 0 ? "+" : ""}{formatCurrency(lotPnl)}</span></div>; })}</div>{selected.taxSensitive && <div className="flex items-center gap-2 border-t border-amber-100 bg-amber-50 px-5 py-3 font-mono text-[10px] text-amber-800"><Sparkles size={13} /> Loss lot near/over the 365-day threshold.</div>}</motion.aside>}</AnimatePresence>

      <PortfolioDrawer open={drawerOpen} onOpenChange={setDrawerOpen} viewMode={viewMode} setViewMode={(mode) => { setViewMode(mode); setSelectedId(null); }} colorMetric={colorMetric} setColorMetric={setColorMetric} taxFilter={taxFilter} setTaxFilter={(filter) => { setTaxFilter(filter); setSelectedId(null); }} showEtfs={showEtfs} setShowEtfs={setShowEtfs} darkMode={darkMode} setDarkMode={setDarkMode} etfLotCount={etfLotCount} frozen={frozen} setFrozen={setFrozen} repulsion={repulsion} setRepulsion={setRepulsion} onImportFile={importFile} uploadNotice={uploadNotice} hasDates={timeline.hasDates} onRestore={() => { setRecords(defaultPortfolio); setUploadNotice(null); setSelectedId(null); setHoveredId(null); resetViewport(); }} visibleKittyCount={visiblePoints.length} loadedLotCount={eligibleRecords.length} />
      <div className={darkMode ? "fixed bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap font-mono text-[9px] tracking-[.08em] text-stone-500" : "fixed bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap font-mono text-[9px] tracking-[.08em] text-stone-400"}><span>Data updated {dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}</span><span aria-hidden="true">·</span><a href="https://thecontrarian.in" target="_blank" rel="noreferrer" className={darkMode ? "transition hover:text-stone-200" : "transition hover:text-stone-800"}>© 2026 Mahesh Shantaram / thecontrarian.in</a></div>
    </main>
  );
}
