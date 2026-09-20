/**
 * Inkfield Menagerie: a full-bleed white portfolio chart in which the supplied
 * ekitty line icon is the data mark; colour, scale, placement, and badges are data.
 */

import PortfolioKittySvg from "@/components/PortfolioKittySvg";
import PortfolioDrawer from "@/components/PortfolioDrawer";
import PortfolioHeader from "@/components/PortfolioHeader";
import PortfolioLegend from "@/components/PortfolioLegend";
import { usePortfolioStats } from "@/hooks/usePortfolioStats";
import {
  ageInDays,
  asHoldingPoints,
  asTransactionPoints,
  formatCurrency,
  formatPrice,
  parsePortfolioCsv,
  type PortfolioLot,
  type PortfolioPoint,
} from "@/lib/portfolio";
import {
  deriveHoldingVisuals,
  getKittyEmphasis,
  getKittyPigment,
  getKittyRadius,
  MOVER_RING_COLOR_DARK,
  MOVER_RING_COLOR_LIGHT,
  type EmphasisStyle,
  type PigmentStyle,
  type VisualLens,
} from "@/lib/portfolioVisuals";
import { COSTUME_LEGEND, deriveCostumeStates, type CostumeId } from "@/lib/portfolioCostumes";
import { buildMrBunglesDigest } from "@/lib/mrBunglesDigest";
import { DEFAULT_MARKET_PROFILE, getMarketProfile, formatMarketDate, formatMarketMonth, formatMarketNumber, type MarketProfile, type MarketProfileId } from "@shared/marketProfiles";
import MrBungles from "@/components/MrBungles";
import { getPortfolioOverlayTheme, type PortfolioOverlayTheme } from "@/lib/portfolioOverlayTheme";
import { getPortfolioFooterClassName, PORTFOLIO_FOOTER_SEPARATOR_CLASS } from "@/lib/portfolioFooter";
import { FIELD_ICON_LANE_PX, ZONE_MARGIN_PX, advanceFieldRest, anchorOutsideZones, constrainFieldNodeX, desiredSeparation, fieldViewportWidth, gravityBandNorms, kittyCollisionRadius, projectOutsideZones, screenZoneToWorld, separatePairwise, settleFieldNodes, zoneRepulsion, type ExclusionZone, type FieldRestState } from "@/lib/kittyField";
import { parsePortfolioResponse } from "@/lib/portfolioLoader";
import { clampTimelinePan, legendShouldAutoOpen, writeLegendSeen } from "@/lib/uiState";
import { AnimatePresence, motion } from "framer-motion";
import { gsap } from "gsap";
import { ChevronLeft, ChevronRight, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";
import flagIcon from "@/assets/checkered-flag.svg";
import broomIcon from "@/assets/broom.svg";
import darkModeIcon from "@/assets/dark_and_cool.png";
import portfolioHelpIcon from "@/assets/portfolio-help.png";
import litterBoxIcon from "@/assets/cat-litter-box.svg";

type ViewMode = "holdings" | "transactions";
type TaxFilter = "all" | "highlight" | "isolate";
type SimNode = { x: number; y: number; vx: number; vy: number };
type VisiblePoint = { point: PortfolioPoint; size: number; stroke: number; pigment: PigmentStyle; emphasis: EmphasisStyle; bobDuration: number };
type Timeline = { months: number[]; indexFor: Record<string, number>; hasDates: boolean };
type TimelineGesture = "idle" | "pan";
type TimelineDrag = { startX: number; startY: number; startPanX: number; pointerId: number; gesture: TimelineGesture };

const PORTFOLIO_CSV_URL = "/data/portfolio.csv";
const PORTFOLIO_STORAGE_KEY = "ekitty-portfolio-csv";
const BADGES_STORAGE_KEY = "ekitty-show-pnl-badges-v1";
const HALOS_STORAGE_KEY = "ekitty-show-halos-v1";
const COSTUMES_STORAGE_KEY = "ekitty-show-costumes-v1";
const MARKET_STORAGE_KEY = "ekitty-market-v1";
const SHOCKING_PINK = "#ff1493";
/** Gravity toggle ease-in/out window — organic settle, no snapping. */
const GRAVITY_EASE_MS = 700;
/**
 * Mover ring feature flag.
 *
 * INVESTIGATION RESULT (2026-08): the data pipeline fully supports daily
 * movement — parsePortfolioCsv reads an optional prev_close_price column and
 * derives dayChange/dayChangePercent per lot and per holding — but the
 * shipped client/public/data/portfolio.csv has no such column, so
 * dayChangePercent is undefined for every point and the >=2% mover condition
 * can never fire. The restyle is done (dashed violet orbit at inset -4%,
 * outside every halo radius and palette family), so flipping this to true
 * once real day-change data flows is all that remains.
 */
// TODO(ekitty): enable when portfolio.csv gains prev_close_price data.
const MOVER_RING_ENABLED = false;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export type OverlayState = { drawerOpen: boolean; legendOpen: boolean; selectedId: string | null };
type OverlayClosers = { closeDrawer: () => void; closeLegend: () => void; closeSelected: () => void; markLegendSeen: () => void };
type PreventableEvent = { preventDefault: () => void };
type ReadonlyStorage = { getItem: (key: string) => string | null };
type WritableStorage = { setItem: (key: string, value: string) => void };

export function closeTopOverlay(state: OverlayState, closers: OverlayClosers, event: PreventableEvent) {
  if (state.drawerOpen) {
    closers.closeDrawer();
    event.preventDefault();
    return;
  }
  if (state.legendOpen) {
    closers.closeLegend();
    closers.markLegendSeen();
    event.preventDefault();
    return;
  }
  if (state.selectedId) {
    closers.closeSelected();
    event.preventDefault();
  }
}

export function readShowHalos(storage: ReadonlyStorage) {
  try {
    return storage.getItem(HALOS_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

// Symmetric with readShowHalos: both own HALOS_STORAGE_KEY and its "true"/"false"
// serialization in one place, so the write path can never drift from the read
// path. Storage-blocked (private mode, quota) is swallowed — the toggle still
// works for the session, it just won't persist.
export function writeShowHalos(storage: WritableStorage, value: boolean) {
  try {
    storage.setItem(HALOS_STORAGE_KEY, String(value));
  } catch {
    /* storage blocked */
  }
}

export function clampCardLeft(focusX: number, sceneWidth: number, onRight: boolean) {
  return clamp(onRight ? focusX + 76 : focusX - 412, 14, sceneWidth - 350 - 72);
}

function hash(value: string) {
  return Array.from(value).reduce((result, character) => ((result << 5) - result + character.charCodeAt(0)) | 0, 0) >>> 0;
}

function scale(value: number, min: number, max: number, outputMin: number, outputMax: number) {
  if (max === min) return (outputMin + outputMax) / 2;
  return outputMin + ((value - min) / (max - min)) * (outputMax - outputMin);
}

function serialFromDate(date?: string) {
  if (!date) return undefined;
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.getFullYear() * 12 + parsed.getMonth();
}

function labelMonth(serial: number, marketProfile: MarketProfile) {
  return formatMarketMonth(serial, marketProfile);
}

function formatTransactionDate(date: string | undefined, marketProfile: MarketProfile) {
  return date ? formatMarketDate(date, marketProfile) : "Date unavailable";
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

export function CatGlyph({ point, size, stroke, pigment, emphasis, bobDuration, visualLens, focused, frozen, searchHidden, searchTerm, searchMatch, showBadges, showHalos, darkMode, costumes = [], marketProfile = DEFAULT_MARKET_PROFILE, onHover, onLeave, onClick }: VisiblePoint & { visualLens: VisualLens; focused: boolean; frozen: boolean; searchHidden: boolean; searchTerm: string; searchMatch: boolean; showBadges: boolean; showHalos: boolean; darkMode: boolean; costumes?: readonly CostumeId[]; marketProfile?: MarketProfile; onHover: () => void; onLeave: () => void; onClick: () => void }) {
  const variation = hash(point.id);
  const lean = (variation % 11) - 5;
  // decorative only — not derived from portfolio data
  const widthScale = 0.93 + ((variation >>> 5) % 13) / 100;
  const skew = ((variation >>> 11) % 9) - 4;
  // decorative only — not derived from portfolio data
  const heightScale = 0.94 + ((variation >>> 16) % 15) / 100;
  const bobStyle = frozen ? undefined : { animationName: "kitty-bob", animationDuration: `${bobDuration}s`, animationTimingFunction: "cubic-bezier(.42,0,.3,1)", animationIterationCount: "infinite", animationDirection: "alternate", animationDelay: `-${(hash(point.id) % 3000) / 1000}s` };
  const isMover = MOVER_RING_ENABLED && point.dayChangePercent !== undefined && Math.abs(point.dayChangePercent) >= 2;
  const moverLabel = isMover
    ? `, ${(point.dayChangePercent as number) >= 0 ? "up" : "down"}${point.dayChange !== undefined ? ` ${formatCurrency(Math.abs(point.dayChange), marketProfile)}` : ""} ${Math.abs(point.dayChangePercent as number).toFixed(1)} percent today`
    : "";

  return (
    <button type="button" tabIndex={searchHidden ? -1 : 0} data-point-id={point.id} aria-label={`${point.company}: ${point.pnl >= 0 ? "profit" : "loss"} ${formatCurrency(Math.abs(point.pnl), marketProfile)}, ${Math.abs(point.pnlPercent).toFixed(1)} percent; active ${visualLens.replaceAll("-", " ")} lens${moverLabel}${point.isETF ? ", ETF" : ""}${point.taxSensitive ? ", loss-review flag" : ""}${costumes.length ? `; costumes: ${costumes.map((id) => COSTUME_LEGEND[id].label).join(", ")}` : ""}`} className="group absolute z-10 block origin-center border-0 bg-transparent p-0 outline-none focus-visible:z-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8AE37]" style={{ width: size, height: size, transform: "translate(-50%, -50%)" }} onPointerDown={(event) => event.stopPropagation()} onMouseEnter={onHover} onFocus={onHover} onMouseLeave={onLeave} onBlur={onLeave} onClick={onClick}>
      <span className="relative block h-full w-full transition-transform duration-200 ease-out group-hover:scale-[1.055] group-focus-visible:scale-[1.055]" style={{ transform: `rotate(${lean}deg) skewX(${skew}deg) scale(${widthScale}, ${heightScale})` }}>
        <span className="relative block h-full w-full" style={bobStyle}>
          {/* data-ring="…" attributes are stable test hooks (see kittyField.test.ts):
              emphasis = toggleable halo, focus = selection, search = query match,
              mover = daily-move ring. Don't strip them in an "unused attribute" pass. */}
          {showHalos && emphasis.haloOpacity > 0 && <span aria-hidden="true" data-ring="emphasis" className="absolute inset-[3%] rounded-full border-current" style={{ borderStyle: point.pnl < 0 ? "dashed" : "solid", borderWidth: emphasis.haloWidth, opacity: emphasis.haloOpacity, color: pigment.ink }} />}
          {focused && <span aria-hidden="true" data-ring="focus" className="absolute inset-[5%] rounded-full border-[1.5px] border-[#D8AE37]" style={{ borderStyle: "solid" }} />}
          {searchMatch && searchTerm && <span aria-hidden="true" data-ring="search" className="absolute inset-[2%] rounded-full border-2 border-[#D8AE37] opacity-90" style={{ borderStyle: "dotted" }} />}
          <PortfolioKittySvg stroke={pigment.ink} fill={pigment.fill} fillOpacity={pigment.fillOpacity} strokeWidth={stroke} costumes={costumes} darkMode={darkMode} className="block h-full w-full overflow-visible" />
          {showBadges && <span aria-hidden="true" className="absolute bottom-[14%] right-[16%] grid h-[12%] min-h-[13px] w-[12%] min-w-[13px] place-items-center rounded-full border border-current bg-white/90 font-mono text-[9px] font-bold leading-none text-stone-800">{emphasis.symbol}</span>}
          {/* The tax-loss coin occupies a fixed collar slot while the +/−
              badge owns the bottom-right. Their presence is independent. */}
          {point.taxSensitive && <span aria-label={`Loss-review flag (held ${marketProfile.taxReviewAgeDays ?? 0}+ days)`} className="absolute left-[calc(44%-8px)] top-[54%] h-[10%] min-h-[12px] w-[10%] min-w-[12px] rounded-full border-[1.25px] border-black bg-[#D8AE37] shadow-[0_0_0_1px_rgba(255,255,255,.65)]" />}
          {isMover && <span aria-hidden="true" data-ring="mover" className="kitty-mover-ring absolute inset-[-4%] rounded-full border-[2.5px]" style={{ borderStyle: "dashed", borderColor: darkMode ? MOVER_RING_COLOR_DARK : MOVER_RING_COLOR_LIGHT }} />}
          {point.isETF && !costumes.includes("basket") && <span aria-hidden="true" className="pointer-events-none absolute left-[60%] top-[76%] rounded-sm border border-[#9AA5AA] bg-white/95 px-[5%] py-[1.5%] font-mono text-[7px] font-semibold tracking-[.08em] text-stone-700 shadow-[0_1px_3px_rgba(41,37,36,.12)]">ETF</span>}
        </span>
      </span>
    </button>
  );
}

function MetricRow({ label, value, theme }: { label: string; value: string; theme: PortfolioOverlayTheme }) {
  return <div className="flex items-baseline justify-between gap-3 py-1.5 text-[11px]"><span className={theme.muted}>{label}</span><span className={`font-mono tabular-nums ${theme.value}`}>{value}</span></div>;
}

export default function Home() {
  const [records, setRecords] = useState<PortfolioLot[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("holdings");
  const [visualLens, setVisualLens] = useState<VisualLens>("portfolio-impact");
  const [taxFilter, setTaxFilter] = useState<TaxFilter>("all");
  const [showEtfs, setShowEtfs] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [repulsion, setRepulsion] = useState(0.62);
  const [frozen, setFrozen] = useState(false);
  const [gravityOn, setGravityOn] = useState(true);
  const [showPnlBadges, setShowPnlBadges] = useState(() => {
    // Explicit user choice wins over the prefers-contrast auto-enable, so a
    // manual off is never re-flipped on a future visit.
    try {
      const stored = window.localStorage.getItem(BADGES_STORAGE_KEY);
      if (stored !== null) return stored === "true";
    } catch { /* storage blocked — fall through to media query */ }
    try {
      return window.matchMedia("(prefers-contrast: more)").matches;
    } catch {
      return false;
    }
  });
  const [showHalos, setShowHalos] = useState(() => readShowHalos(window.localStorage));
  const [showCostumes, setShowCostumes] = useState(() => {
    try {
      return window.localStorage.getItem(COSTUMES_STORAGE_KEY) !== "false";
    } catch {
      return true;
    }
  });
  const [marketId, setMarketId] = useState<MarketProfileId>(() => {
    try {
      return getMarketProfile(window.localStorage.getItem(MARKET_STORAGE_KEY)).id;
    } catch {
      return "india";
    }
  });
  const marketProfile = getMarketProfile(marketId);
  const [showBadgesToast, setShowBadgesToast] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusedCompany, setFocusedCompany] = useState<string | null>(null);
  const [companyQuery, setCompanyQuery] = useState("");
  const [uploadNotice, setUploadNotice] = useState<{ kind: "error" | "success"; message: string } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [sceneSize, setSceneSize] = useState({ width: 1200, height: 800 });
  const [visibleMonthCount, setVisibleMonthCount] = useState(24);
  const [requestedMonthWindowStart, setRequestedMonthWindowStart] = useState(0);
  const [timelineGesture, setTimelineGesture] = useState<TimelineGesture>("idle");
  const [timelinePanOffset, setTimelinePanOffset] = useState(0);
  const [canvasPanY, setCanvasPanY] = useState(0);
  const [isWorldFit, setIsWorldFit] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0, visible: false });
  const [dataUpdatedAt, setDataUpdatedAt] = useState<string | null>(null);
  const [fieldAwake, setFieldAwake] = useState(true);
  const [, repaint] = useState(0);
  const nodes = useRef<Record<string, SimNode>>({});
  const frame = useRef<number | null>(null);
  const fieldRestRef = useRef<FieldRestState>({ elapsedMs: 0, quietMs: 0 });
  const lastPaintRef = useRef(0);
  const litterboxRef = useRef<HTMLButtonElement | null>(null);
  const gravityRampRef = useRef<{ start: number | null; value: number }>({ start: null, value: gravityOn && viewMode === "holdings" ? 1 : 0 });
  const timelineScroller = useRef<HTMLDivElement | null>(null);
  const horizontalDrag = useRef<TimelineDrag | null>(null);
  const camera = useRef({ x: 0, y: 0, scale: 1 });
  const gridWorld = useRef<HTMLDivElement | null>(null);
  const kittyWorld = useRef<HTMLElement | null>(null);
  const datelineWorld = useRef<HTMLDivElement | null>(null);
  const cameraTween = useRef<gsap.core.Tween | null>(null);
  const wheelZoomRemainder = useRef(0);
  const hasPositionedLatestWindow = useRef(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setPrefersReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const reducedMotion = Boolean(prefersReducedMotion);
  // Reduced motion pauses the field without touching the user's own Freeze choice,
  // so their intent is preserved when the OS preference is toggled back off.
  const effectiveFrozen = frozen || reducedMotion;
  const fieldIsMoving = fieldAwake && !effectiveFrozen && timelineGesture !== "pan";
  const wakeField = useCallback(() => {
    fieldRestRef.current = { elapsedMs: 0, quietMs: 0 };
    setFieldAwake(true);
  }, []);
  const overlayTheme = getPortfolioOverlayTheme(darkMode);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      closeTopOverlay(
        { drawerOpen, legendOpen, selectedId },
        {
          closeDrawer: () => setDrawerOpen(false),
          closeLegend: () => setLegendOpen(false),
          closeSelected: () => setSelectedId(null),
          markLegendSeen: () => writeLegendSeen(window.localStorage),
        },
        event,
      );
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen, legendOpen, selectedId]);

  const eligibleRecords = useMemo(() => showEtfs ? records : records.filter((record) => !record.isETF), [records, showEtfs]);
  const etfLotCount = useMemo(() => records.filter((record) => record.isETF).length, [records]);
  const portfolioStats = usePortfolioStats(eligibleRecords, marketProfile);
  const transactionPoints = useMemo(() => asTransactionPoints(eligibleRecords, marketProfile), [eligibleRecords, marketProfile]);
  const points = useMemo(() => viewMode === "holdings" ? asHoldingPoints(eligibleRecords, marketProfile) : transactionPoints, [eligibleRecords, transactionPoints, viewMode, marketProfile]);
  const costumeLayersById = useMemo(() => new Map(points.map((point): [string, CostumeId[]] => [point.id, deriveCostumeStates(point, viewMode, points).layers])), [points, viewMode]);
  const mrBunglesDigest = useMemo(() => buildMrBunglesDigest(points, viewMode, visualLens, { includesEtfs: showEtfs, taxFilter, query: companyQuery }, marketProfile), [points, viewMode, visualLens, showEtfs, taxFilter, companyQuery, marketProfile]);
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
  const fieldWidth = fieldViewportWidth(sceneSize.width);
  const transactionStripWidth = (fieldWidth * 3) / Math.max(monthMaximum, 1);
  // Group view must match the viewport exactly: it has no horizontal scroll or
  // pan affordance, so any wider centered world creates unreachable side strips.
  const virtualCanvasWidth = viewMode === "transactions" ? Math.max(fieldWidth, timeline.months.length * transactionStripWidth) : fieldWidth;
  const virtualCanvasHeight = viewMode === "transactions" ? Math.max(1_560, sceneSize.height * 2.25) : Math.max(1_320, sceneSize.height * 1.85);
  const minCanvasPanX = Math.min(0, fieldWidth - virtualCanvasWidth);
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
  const preparedFieldPoints = useMemo(() => deriveHoldingVisuals(fieldPoints, visualLens), [fieldPoints, visualLens]);
  const fieldPointsById = useMemo(() => new Map(preparedFieldPoints.map((point) => [point.id, point])), [preparedFieldPoints]);
  // Gravity bands: weight follows whatever raw metric drives the active lens
  // (invested value for portfolio-impact/trade-quality, |P&L| for capital-at-
  // risk). Log-mapped so whales don't compress everyone else into one strip.
  // Recomputed when the lens or ETF visibility changes the field composition.
  const gravityNorms = useMemo(() => {
    const norms = gravityBandNorms(fieldPoints.map((point) => fieldPointsById.get(point.id)?.visuals.sizeRaw ?? point.investedValue));
    return Object.fromEntries(fieldPoints.map((point, index) => [point.id, norms[index]] as const));
  }, [fieldPoints, fieldPointsById]);

  // Screen-space bounding boxes of the header bar and icon cluster, measured
  // from the live DOM (never hardcoded pixels) so the physics no-go zones
  // stay correct across resizes and content changes.
  const measuredZonesRef = useRef<{ header: ExclusionZone; icons: ExclusionZone } | null>(null);
  useEffect(() => {
    const measure = () => {
      const headerEl = document.getElementById("ekitty-header");
      const laneEl = document.getElementById("ekitty-icon-lane");
      if (!headerEl || !laneEl) return;
      const headerRect = headerEl.getBoundingClientRect();
      const laneRect = laneEl.getBoundingClientRect();
      measuredZonesRef.current = {
        header: { left: headerRect.left, top: headerRect.top, right: headerRect.right, bottom: headerRect.bottom },
        icons: { left: laneRect.left, top: 0, right: laneRect.right, bottom: window.innerHeight },
      };
      wakeField();
    };
    measure();
    const observer = new ResizeObserver(measure);
    const headerEl = document.getElementById("ekitty-header");
    const laneEl = document.getElementById("ekitty-icon-lane");
    if (headerEl) observer.observe(headerEl);
    if (laneEl) observer.observe(laneEl);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure);
    };
  }, [records.length, wakeField]);

  const setCameraTransform = useCallback((x: number, y: number, scale = 1) => {
    camera.current.x = x;
    camera.current.y = y;
    camera.current.scale = scale;
    if (gridWorld.current) gsap.set(gridWorld.current, { x, y, scale, transformOrigin: "left top", force3D: true });
    if (kittyWorld.current) gsap.set(kittyWorld.current, { x, y, scale, transformOrigin: "left top", force3D: true });
    if (datelineWorld.current) gsap.set(datelineWorld.current, { x, scale, transformOrigin: "left top", force3D: true });
  }, []);

  const settleCamera = useCallback((x: number, y: number, duration = 0.28, scale = 1) => {
    const effectiveDuration = prefersReducedMotion ? 0 : duration;
    cameraTween.current?.kill();
    cameraTween.current = gsap.to(camera.current, {
      x,
      y,
      scale,
      duration: effectiveDuration,
      ease: "power4.out",
      overwrite: "auto",
      onUpdate: () => setCameraTransform(camera.current.x, camera.current.y, camera.current.scale),
      onComplete: () => {
        setTimelinePanOffset(x);
        setCanvasPanY(y);
        cameraTween.current = null;
      },
    });
  }, [prefersReducedMotion, setCameraTransform]);

  const focusMrBunglesTarget = useCallback((id: string) => {
    const point = fieldPointsById.get(id);
    const node = nodes.current[id];
    if (!point || !node) return;
    setFocusedCompany(null);
    setSelectedId(id);
    setHoveredId(null);
    setLegendOpen(false);
    setIsWorldFit(false);
    const x = viewMode === "transactions" ? clamp(fieldWidth * 0.45 - node.x, minCanvasPanX, 0) : 0;
    const y = sceneSize.height * 0.42 + window.scrollY - node.y;
    settleCamera(x, y, 0.36, 1);
    const button = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-point-id]")).find(candidate => candidate.dataset.pointId === id);
    button?.focus({ preventScroll: true });
  }, [fieldPointsById, fieldWidth, viewMode, sceneSize.height, minCanvasPanX, settleCamera]);

  const panTimelinePage = useCallback((direction: "earlier" | "later") => {
    setIsWorldFit(false);
    const nextX = clampTimelinePan(camera.current.x, direction, fieldWidth * 0.88, minCanvasPanX);
    settleCamera(nextX, camera.current.y, prefersReducedMotion ? 0 : 0.28);
  }, [minCanvasPanX, prefersReducedMotion, fieldWidth, settleCamera]);

  const visiblePoints = useMemo<VisiblePoint[]>(() => {
    const maxQty = Math.max(...fieldPoints.map((point) => point.qty), 1);
    const compactField = sceneSize.width < 640;
    const minSize = compactField ? (viewMode === "transactions" ? 28 : 38) : (viewMode === "transactions" ? 34 : 46);
    const maxSize = Math.min(compactField ? (viewMode === "transactions" ? 140 : 212) : (viewMode === "transactions" ? 236 : 440), Math.max(minSize, fieldWidth / 1.3));
    return fieldPoints.map((point) => {
      const prepared = fieldPointsById.get(point.id);
      const visuals = prepared?.visuals ?? { sizeNorm: 0.5, colorNorm: 0, impactNorm: 0 };
      return {
        point,
        size: getKittyRadius(visuals.sizeNorm, minSize, maxSize),
        stroke: scale(point.qty, 0, maxQty, 1.65, 4.5),
        pigment: getKittyPigment(visuals.colorNorm, darkMode),
        emphasis: getKittyEmphasis(visuals.impactNorm, point.pnl),
        bobDuration: clamp(3.6 - Math.min(1.75, Math.abs(point.pnlPercent) / 35), 1.7, 3.6),
      };
    });
  }, [darkMode, fieldPoints, fieldPointsById, fieldWidth, sceneSize.width, viewMode]);

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
    wakeField();
    repaint((value) => (value + 1) % 10_000);
  }, [minCanvasPanX, monthMaximum, settleCamera, timeline.months.length, wakeField]);

  const toggleWorldFit = useCallback(() => {
    if (isWorldFit) {
      setIsWorldFit(false);
      settleCamera(minCanvasPanX, 0, 0.46, 1);
      return;
    }
    const availableWidth = Math.max(1, fieldWidth - 28);
    const availableHeight = Math.max(200, sceneSize.height - 60);
    const scale = Math.min(1, availableWidth / virtualCanvasWidth, availableHeight / virtualCanvasHeight);
    setIsWorldFit(true);
    settleCamera((fieldWidth - virtualCanvasWidth * scale) / 2, Math.max(42, (sceneSize.height - virtualCanvasHeight * scale) / 2), 0.54, scale);
  }, [isWorldFit, fieldWidth, minCanvasPanX, sceneSize.height, settleCamera, virtualCanvasHeight, virtualCanvasWidth]);

  const beginTimelineDrag = useCallback((event: React.PointerEvent<HTMLElement>) => {
    if (isWorldFit) {
      setIsWorldFit(false);
      setCameraTransform(minCanvasPanX, 0);
    }
    cameraTween.current?.kill();
    horizontalDrag.current = { startX: event.clientX, startY: event.clientY, startPanX: camera.current.x, pointerId: event.pointerId, gesture: "idle" };
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
    setCameraTransform(clamp(drag.startPanX + deltaX, minCanvasPanX, 0), camera.current.y);
  }, [minCanvasPanX, setCameraTransform]);

  const endTimelineDrag = useCallback((event: React.PointerEvent<HTMLElement>) => {
    const drag = horizontalDrag.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (drag.gesture !== "idle") { setTimelinePanOffset(camera.current.x); setCanvasPanY(camera.current.y); }
    setTimelineGesture("idle");
    horizontalDrag.current = null;
  }, []);

  const scrollTimeline = useCallback((event: React.WheelEvent<HTMLElement>) => {
    if (viewMode === "holdings" || Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
    event.preventDefault();
    const nextX = clamp(camera.current.x - event.deltaX, minCanvasPanX, 0);
    setCameraTransform(nextX, camera.current.y);
    setTimelinePanOffset(nextX);
  }, [minCanvasPanX, setCameraTransform, viewMode]);

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
    settleCamera(clamp(fieldWidth * 0.5 - focusX, minCanvasPanX, 0), camera.current.y, 0.36);
  }, [focusedCompany, fieldWidth, minCanvasPanX, settleCamera, timeline, transactionPoints, transactionStripWidth, viewMode]);

  useEffect(() => () => { cameraTween.current?.kill(); }, []);

  useEffect(() => {
    if (!reducedMotion) return;
    cameraTween.current?.kill();
    cameraTween.current = null;
    setCameraTransform(camera.current.x, camera.current.y, camera.current.scale);
    setTimelinePanOffset(camera.current.x);
    setCanvasPanY(camera.current.y);
  }, [reducedMotion, setCameraTransform]);

  useEffect(() => {
    nodes.current = {};
    setHoveredId(null);
    setSelectedId(null);
    setFocusedCompany(null);
  }, [showEtfs, viewMode]);

  const loadPortfolioCsv = useCallback(() => {
    const stored = localStorage.getItem(PORTFOLIO_STORAGE_KEY);
    if (stored) {
      const parsed = parsePortfolioCsv(stored);
      if (parsed.records.length) { setRecords(parsed.records); setDataUpdatedAt(new Date().toISOString()); return; }
    }
    fetch(PORTFOLIO_CSV_URL).then(parsePortfolioResponse).then(({ records: nextRecords, lastModified }) => {
      setRecords(nextRecords);
      setDataUpdatedAt(lastModified ?? new Date().toISOString());
      setUploadNotice(null);
    }).catch((error: unknown) => {
      setUploadNotice({ kind: "error", message: error instanceof Error ? error.message : "Portfolio download failed." });
    });
  }, []);

  useEffect(() => { loadPortfolioCsv(); }, [loadPortfolioCsv]);

  useEffect(() => {
    setLegendOpen(legendShouldAutoOpen(window.localStorage));
  }, []);

  useEffect(() => {
    // One-time toast when the OS contrast preference auto-enabled badges and
    // the user has not made an explicit choice yet. Declared before the
    // persistence effect below so it observes the pre-write storage state.
    try {
      if (window.localStorage.getItem(BADGES_STORAGE_KEY) !== null) return;
    } catch { return; }
    let matches = false;
    try { matches = window.matchMedia("(prefers-contrast: more)").matches; } catch { return; }
    if (!matches) return;
    const timer = window.setTimeout(() => toast("Turned on colour-blind-safe badges."), 900);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    try { window.localStorage.setItem(BADGES_STORAGE_KEY, String(showPnlBadges)); } catch { /* storage blocked */ }
  }, [showPnlBadges]);

  useEffect(() => {
    writeShowHalos(window.localStorage, showHalos);
  }, [showHalos]);

  useEffect(() => {
    try { window.localStorage.setItem(COSTUMES_STORAGE_KEY, String(showCostumes)); } catch {}
  }, [showCostumes]);

  useEffect(() => {
    try { window.localStorage.setItem(MARKET_STORAGE_KEY, marketId); } catch {}
  }, [marketId]);

  useEffect(() => {
    const nextNodes: Record<string, SimNode> = {};
    visiblePoints.forEach(({ point }, index) => {
      const current = nodes.current[point.id];
      const seed = hash(point.id);
      const padding = 48;
      nextNodes[point.id] = current ?? { x: padding + (seed % Math.max(120, physicsWidth - padding * 2)), y: padding + ((seed >>> 8) % Math.max(120, sceneSize.height - padding * 2)), vx: ((index % 3) - 1) * 0.04, vy: (((index + 1) % 3) - 1) * 0.04 };
    });
    if (viewMode === "holdings") {
      visiblePoints.forEach(({ point, size }) => {
        const node = nextNodes[point.id];
        if (node) constrainFieldNodeX(node, size * 0.65 + 4, fieldWidth);
      });
    }
    nodes.current = nextNodes;
    wakeField();
  }, [fieldWidth, physicsWidth, sceneSize, viewMode, visiblePoints, wakeField]);

  // Physics-affecting controls/layout changes start a bounded settling burst.
  // Once the burst sleeps, no RAF is scheduled until one of these changes or
  // the user interacts with the field again.
  useEffect(() => {
    wakeField();
  }, [drawerOpen, gravityOn, repulsion, selectedId, taxFilter, viewMode, visualLens, wakeField]);

  useEffect(() => {
    if (!effectiveFrozen) {
      wakeField();
      return;
    }
    const nodeList = visiblePoints
      .map(({ point, size }) => ({ node: nodes.current[point.id], size }))
      .filter((entry): entry is { node: SimNode; size: number } => Boolean(entry.node));
    settleFieldNodes(nodeList.map(({ node }) => node), {
      width: virtualCanvasWidth,
      height: virtualCanvasHeight,
      radiusFor: (_node, index) => kittyCollisionRadius(nodeList[index].size),
    });
    if (viewMode === "holdings") {
      nodeList.forEach(({ node, size }) => constrainFieldNodeX(node, size * 0.65 + 4, fieldWidth));
    }
    setFieldAwake(false);
    repaint((value) => (value + 1) % 10_000);
  }, [effectiveFrozen, fieldWidth, viewMode, virtualCanvasHeight, virtualCanvasWidth, visiblePoints, wakeField]);

  useEffect(() => {
    if (!fieldIsMoving) return;
    let last = performance.now();
    const tick = (time: number) => {
      const elapsedMs = Math.min(50, Math.max(0, time - last));
      const delta = Math.min(1.4, elapsedMs / 16.67);
      last = time;
      {
        const nodeList = visiblePoints.map(({ point, size }, index) => ({ node: nodes.current[point.id], point, size, index })).filter((entry) => entry.node);
        const previousPositions = nodeList.map(({ node }) => ({ x: node.x, y: node.y }));
        // Gravity (Group view only): heavier holdings settle toward lower
        // bands while smaller ones float just under the header no-go zone.
        // The band pull eases in over ~700ms via the gravityBlend ramp so
        // toggling never snaps the field.
        const zonesRaw = measuredZonesRef.current;
        // Zones are measured in screen space; the simulation lives in world
        // space behind the pan/zoom camera. Translate them into world coords
        // each frame so enforcement stays correct while panning or fitting.
        const zones = zonesRaw
          ? {
              header: screenZoneToWorld(zonesRaw.header, camera.current, window.scrollY),
              icons: screenZoneToWorld(zonesRaw.icons, camera.current, window.scrollY),
            }
          : null;
        if (gravityOn && viewMode === "holdings") {
          const target = performance.now();
          if (!gravityRampRef.current.start) gravityRampRef.current.start = target;
          gravityRampRef.current.value = Math.min(1, (target - gravityRampRef.current.start) / GRAVITY_EASE_MS);
        } else {
          gravityRampRef.current.start = null;
          gravityRampRef.current.value = Math.max(0, gravityRampRef.current.value - delta * (16.67 / GRAVITY_EASE_MS));
        }
        const gravityBlend = viewMode === "holdings" ? gravityRampRef.current.value ** 2 : 0;
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
            // Blend the random drift anchor with the gravity band anchor:
            // band top sits below the header zone; heavy kitties sink low.
            const driftY = topKittyMargin + size * 0.62 + (transactionLayoutHeight - topKittyMargin - size * 1.24) * (0.11 + (((seed >>> 9) % 710) / 1000));
            if (gravityBlend > 0 && zones) {
              const radius = kittyCollisionRadius(size);
              const headerFloor = zones.header.bottom + ZONE_MARGIN_PX;
              const usableHeight = Math.max(120, transactionLayoutHeight - headerFloor - 40);
              const bandNorm = gravityNorms[point.id] ?? 0.5;
              const jitter = ((seed >>> 13) % 140) / 1000;
              // Higher band norm (heavier) → larger offset → settles lower.
              const anchorBandY = headerFloor + radius * 0.6 + Math.max(0, bandNorm + jitter - 0.14) * usableHeight;
              anchorY = driftY + (anchorBandY - driftY) * gravityBlend;
            } else {
              anchorY = driftY;
            }
            pull = 0.00048 + gravityBlend * 0.0012;
            if (zones && viewMode === "holdings") {
              // Anchors must live outside the no-go zones — an anchor inside a
              // zone would fight the zone repulsion and leave residual
              // intrusion at steady state.
              [anchorX, anchorY] = anchorOutsideZones(anchorX, anchorY, kittyCollisionRadius(size), [zones.header, zones.icons]);
            }
          }
          node.vx += (anchorX - node.x) * pull * delta;
          node.vy += (anchorY - node.y) * pull * delta;
          if (point.id === selectedId) { node.vx += (physicsWidth * 0.5 - node.x) * 0.0028 * delta; node.vy += (sceneSize.height * 0.5 - node.y) * 0.0028 * delta; }
        });
        // Positional overlap resolution runs LAST (after zone projection) so
        // the pairwise solver has the final say each frame: several relaxation
        // sweeps with clearance proportional to combined kitty sizes keep
        // dense clusters of large holdings separating instead of freezing
        // early with residual overlap.
        nodeList.forEach(({ node, size, point }) => {
          const margin = Math.max(42, size * 0.62);
          node.vx += (node.x < margin ? margin - node.x : node.x > physicsWidth - margin ? physicsWidth - margin - node.x : 0) * 0.008;
          const topBoundary = Math.max(topKittyMargin + size * 0.62, margin);
          node.vy += (node.y < topBoundary ? topBoundary - node.y : node.y > transactionLayoutHeight - margin ? transactionLayoutHeight - margin - node.y : 0) * 0.008;
          if (zones && viewMode === "holdings") {
            const radius = kittyCollisionRadius(size);
            const [zx, zy] = zoneRepulsion(node.x, node.y, radius, zones.header);
            node.vx += zx;
            node.vy += zy;
            const [ix, iy] = zoneRepulsion(node.x, node.y, radius, zones.icons);
            node.vx += ix;
            node.vy += iy;
          }
          node.vx *= 0.91; node.vy *= 0.91; node.x += node.vx * delta; node.y += node.vy * delta;
          if (zones && viewMode === "holdings") {
            // Hard guarantee on top of the soft repulsion: a cat may drift near
            // a zone but never rest inside one.
            const radius = kittyCollisionRadius(size);
            const [px, py] = projectOutsideZones(node.x, node.y, radius, [zones.header, zones.icons]);
            node.x = px;
            node.y = py;
          }
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
        // Pairwise separation runs after integration + zone projection so it
        // has the final say on positions each frame, then a final projection
        // re-guarantees the no-go zones against any last shoving.
        separatePairwise(
          nodeList.map(({ node }) => node),
          nodeList.map(({ size }) => kittyCollisionRadius(size)),
          repulsion,
          Math.min(0.42, 0.16 + repulsion * 0.3),
          4,
        );
        if (zones && viewMode === "holdings") {
          nodeList.forEach(({ node, size }) => {
            const [px2, py2] = projectOutsideZones(node.x, node.y, kittyCollisionRadius(size), [zones.header, zones.icons]);
            node.x = px2;
            node.y = py2;
          });
        }
        if (viewMode === "holdings") {
          nodeList.forEach(({ node, size }) => constrainFieldNodeX(node, size * 0.65 + 4, fieldWidth));
        }
        const maximumStep = nodeList.reduce((maximum, { node }, index) => Math.max(maximum, Math.hypot(node.x - previousPositions[index].x, node.y - previousPositions[index].y)), 0);
        fieldRestRef.current = advanceFieldRest(fieldRestRef.current, elapsedMs, maximumStep);
        if (fieldRestRef.current.sleeping) {
          settleFieldNodes(nodeList.map(({ node }) => node), {
            width: virtualCanvasWidth,
            height: virtualCanvasHeight,
            radiusFor: (_node, index) => kittyCollisionRadius(nodeList[index].size),
          });
          if (viewMode === "holdings") {
            nodeList.forEach(({ node, size }) => constrainFieldNodeX(node, size * 0.65 + 4, fieldWidth));
          }
          repaint((value) => (value + 1) % 10_000);
          setFieldAwake(false);
          return;
        }
        // Render at 30fps while active. Physics can integrate at display rate,
        // but React should not reconcile 80 glyph trees 60 times per second.
        if (time - lastPaintRef.current >= 33) {
          lastPaintRef.current = time;
          repaint((value) => (value + 1) % 10_000);
        }
      }
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => { if (frame.current) cancelAnimationFrame(frame.current); };
  }, [fieldIsMoving, fieldWidth, gravityNorms, gravityOn, physicsWidth, pnlPosition, pnlScaleMargin, repulsion, sceneSize, selectedId, timeline, topKittyMargin, transactionLayoutHeight, transactionStripWidth, viewMode, virtualCanvasWidth, visiblePoints]);

  const importFile = useCallback((file?: File) => {
    if (!file) return;
    file.text().then((text) => {
      const parsed = parsePortfolioCsv(text);
      if (parsed.error) { setUploadNotice({ kind: "error", message: parsed.error }); return; }
      localStorage.setItem(PORTFOLIO_STORAGE_KEY, text);
      setRecords(parsed.records); setDataUpdatedAt(new Date().toISOString()); setUploadNotice({ kind: "success", message: `${parsed.records.length} lots loaded into the field.` }); setSelectedId(null); setHoveredId(null); setTaxFilter("all");
    }).catch(() => {
      setUploadNotice({ kind: "error", message: "The portfolio file could not be read." });
    });
  }, []);

  const tooltipNode = hovered ? nodes.current[hovered.id] : null;
  const focusNode = selected ? nodes.current[selected.id] : null;
  const activeCanvasPanX = timelinePanOffset;
  const activeCanvasPanY = canvasPanY;
  const focusOnRight = (focusNode?.x ?? 0) + activeCanvasPanX < sceneSize.width * 0.55;
  const mouseToyActive = mousePosition.visible && !reducedMotion && !drawerOpen;

  useEffect(() => {
    const onBlur = () => setMousePosition((current) => ({ ...current, visible: false }));
    window.addEventListener("blur", onBlur);
    return () => window.removeEventListener("blur", onBlur);
  }, []);

  return (
    <main data-mouse-cursor={mouseToyActive} onPointerMove={(event) => { if (event.pointerType === "mouse" && event.currentTarget.contains(event.target as Node)) setMousePosition({ x: event.clientX, y: event.clientY, visible: true }); else setMousePosition((current) => (current.visible ? { ...current, visible: false } : current)); }} onPointerDownCapture={(event) => { if (event.pointerType !== "mouse") setMousePosition((current) => (current.visible ? { ...current, visible: false } : current)); }} onPointerEnter={(event) => { if (event.pointerType === "mouse" && event.currentTarget.contains(event.target as Node)) setMousePosition({ x: event.clientX, y: event.clientY, visible: true }); }} onPointerLeave={() => setMousePosition((current) => ({ ...current, visible: false }))} className={darkMode ? "dark relative min-h-[100dvh] w-screen bg-[#101617] text-stone-100" : "relative min-h-[100dvh] w-screen bg-white text-stone-900"}>
      <PortfolioHeader stats={portfolioStats} hasPortfolio={records.length > 0} darkMode={darkMode} marketProfile={marketProfile} onOpenPortfolio={() => { setViewMode("holdings"); setDrawerOpen(true); }} />
      <div id="ekitty-icon-lane" aria-hidden="true" className={darkMode ? "pointer-events-none fixed inset-y-0 right-0 z-30 border-l border-[#25383d] bg-[#101617]" : "pointer-events-none fixed inset-y-0 right-0 z-30 border-l border-stone-200/70 bg-[#faf9f5]"} style={{ width: FIELD_ICON_LANE_PX }} />
      {/* One cohesive control stack, top-right: litterbox, flag, fit, dark
          mode, help. The help (?) sits at the bottom so its legend panel can
          open directly beneath the stack. Step 4's right no-go zone is
          measured from this element's live box. */}
      <div id="ekitty-icon-cluster" className="fixed right-3 top-3 z-50 flex w-[88px] flex-col items-center gap-3 rounded-xl p-1">
        <button ref={litterboxRef} type="button" aria-label={drawerOpen ? "Close portfolio controls" : "Open portfolio controls"} aria-expanded={drawerOpen} aria-controls="portfolio-controls-pane" onClick={() => setDrawerOpen((current) => !current)} className="grid min-h-14 min-w-14 shrink-0 place-items-center rounded-full transition hover:-translate-y-0.5 active:scale-95"><img src={litterBoxIcon} alt="" className={darkMode ? "h-[52.8px] w-[52.8px] invert" : "h-[52.8px] w-[52.8px]"} /></button>
        {/* Flag is 10px wider to the right (54×44 hit area, pinned left edge)
            so its glyph breathes without shifting the stack's rhythm. */}
        <button type="button" aria-label="Reset portfolio field" onPointerDown={(event) => event.stopPropagation()} onClick={resetViewport} className="relative grid min-h-14 min-w-14 w-[66px] shrink-0 place-items-center rounded-l-full transition hover:-translate-y-0.5 active:scale-95"><img src={flagIcon} alt="" className={darkMode ? "h-[33.6px] w-[33.6px] opacity-90 invert" : "h-[33.6px] w-[33.6px] opacity-90"} /></button>
        <button type="button" aria-label={isWorldFit ? "Restore normal world view" : "Show all kitties"} aria-pressed={isWorldFit} onPointerDown={(event) => event.stopPropagation()} onClick={toggleWorldFit} className="grid min-h-14 min-w-14 shrink-0 place-items-center rounded-full transition hover:-translate-y-0.5 active:scale-95"><img src={broomIcon} alt="" className={darkMode ? "h-[33.6px] w-[33.6px] opacity-90 invert" : "h-[33.6px] w-[33.6px] opacity-90"} /></button>
        <button type="button" aria-label="Toggle dark mode" aria-pressed={darkMode} onPointerDown={(event) => event.stopPropagation()} onClick={() => setDarkMode((current) => !current)} className="grid min-h-14 min-w-14 shrink-0 place-items-center rounded-full transition hover:-translate-y-0.5 active:scale-95"><img src={darkModeIcon} alt="" className={darkMode ? "h-[43.2px] w-[43.2px] invert" : "h-[43.2px] w-[43.2px]"} /></button>
        <button type="button" aria-label="Show portfolio legend" aria-expanded={legendOpen} onClick={() => { if (legendOpen) { setLegendOpen(false); writeLegendSeen(window.localStorage); } else { setSelectedId(null); setLegendOpen(true); } }} className="grid min-h-14 min-w-14 shrink-0 place-items-center rounded-full transition hover:-translate-y-0.5 active:scale-95"><img src={portfolioHelpIcon} alt="" className={darkMode ? "h-[43.2px] w-[43.2px] invert" : "h-[43.2px] w-[43.2px]"} /></button>
      </div>
      {legendOpen && <PortfolioLegend darkMode={darkMode} visualLens={visualLens} moverRingEnabled={MOVER_RING_ENABLED} viewMode={viewMode} showCostumes={showCostumes} onShowCostumesChange={setShowCostumes} marketProfile={marketProfile} onClose={() => { setLegendOpen(false); writeLegendSeen(window.localStorage); }} />}
      {records.length === 0 && <div className="fixed inset-0 z-[55] flex flex-col items-center justify-center" onDragOver={(event) => { event.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={(event) => { event.preventDefault(); setDragOver(false); importFile(event.dataTransfer.files[0]); }}><label className="flex cursor-pointer flex-col items-center gap-6" onDragOver={(event) => { event.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={(event) => { event.preventDefault(); setDragOver(false); importFile(event.dataTransfer.files[0]); }}><div className="transition-transform duration-200" style={{ transform: dragOver ? "scale(1.08)" : "scale(1)" }}><PortfolioKittySvg stroke={dragOver ? "#D8AE37" : darkMode ? "#a6c2cc" : "#ff3b3b"} fill={dragOver ? "#D8AE37" : "transparent"} fillOpacity={dragOver ? 0.08 : 0} strokeWidth={dragOver ? 3 : 2} className="h-48 w-48" /></div><div className="text-center"><p className={darkMode ? "font-serif text-2xl text-stone-100" : "font-serif text-2xl text-stone-900"}>{dragOver ? "Release to load your portfolio" : "Drop your portfolio.csv here"}</p><p className={darkMode ? "mt-2 font-mono text-[10px] tracking-[.12em] text-stone-400" : "mt-2 font-mono text-[10px] tracking-[.12em] text-stone-400"}>or click to browse · columns: company · buy_qty · avg_price · current_price · txn_date</p></div><input type="file" accept=".csv,text/csv" className="sr-only" onChange={(event) => importFile(event.target.files?.[0])} /></label>{uploadNotice && <p className={uploadNotice.kind === "error" ? darkMode ? "mt-6 font-mono text-[10px] text-[#ff6b6b]" : "mt-6 font-mono text-[10px] text-[#ff3b3b]" : darkMode ? "mt-6 font-mono text-[10px] text-[#4ade80]" : "mt-6 font-mono text-[10px] text-emerald-700"}>{uploadNotice.message}</p>}</div>}
      {viewMode === "transactions" && <div aria-hidden="true" className="pointer-events-none absolute left-0 top-0 z-0 overflow-clip" style={{ width: fieldWidth, height: virtualCanvasHeight }}><div ref={gridWorld} className="absolute left-0 top-0" style={{ width: virtualCanvasWidth, height: virtualCanvasHeight }}>{pnlTicks.map((tick) => { const ratio = (tick + pnlBound) / (pnlBound * 2); return <div key={`grid-${tick}`} className={darkMode ? "absolute left-0 right-0 border-t border-[#20353b]/28" : "absolute left-0 right-0 border-t border-[#dbeef8]/34"} style={{ top: pnlScaleMargin + (1 - ratio) * (transactionLayoutHeight - pnlScaleMargin * 2) }} />; })}{timeline.months.map((month, index) => <div key={month} className={darkMode ? "absolute bottom-0 top-0 border-l border-[#284149]/42" : "absolute bottom-0 top-0 border-l border-[#edf7ff]/46"} style={{ left: index * transactionStripWidth }} />)}{elapsedYearGuides.map((guide) => { const index = timeline.months.indexOf(guide.serial); return <div key={`year-${guide.years}`} className="absolute bottom-0 top-0 w-[3px] bg-[#70b9e8] shadow-[0_0_0_1px_rgba(112,185,232,.14)]" style={{ left: index * transactionStripWidth }} />; })}</div></div>}
      {viewMode === "transactions" && <div aria-hidden="true" className={darkMode ? "pointer-events-none fixed left-0 top-0 z-20 h-10 overflow-hidden bg-[#101617]/88 backdrop-blur-[2px]" : "pointer-events-none fixed left-0 top-0 z-20 h-10 overflow-hidden bg-white/88 backdrop-blur-[2px]"} style={{ right: FIELD_ICON_LANE_PX }}><div ref={datelineWorld} className="relative h-full" style={{ width: virtualCanvasWidth }}>{timeline.months.map((month, index) => index % 3 === 0 && <span key={`label-${month}`} className={darkMode ? "absolute top-3 hidden font-mono text-[9px] font-medium tracking-[.12em] text-[#a6c2cc] md:block" : "absolute top-3 hidden font-mono text-[9px] font-medium tracking-[.12em] text-[#61869d] md:block"} style={{ left: index * transactionStripWidth + 4 }}>{labelMonth(month, marketProfile)}</span>)}{elapsedYearGuides.map((guide) => { const index = timeline.months.indexOf(guide.serial); return <span key={`year-label-${guide.years}`} className="absolute top-7 font-mono text-[8px] tracking-[.12em] text-[#4096cf]" style={{ left: index * transactionStripWidth + 5 }}>{guide.years}y</span>; })}</div></div>}
      {viewMode === "transactions" && timelinePanOffset < -1 && <button type="button" title="Drag to see older transactions" aria-label="Earlier months. Drag to see older transactions." onClick={() => panTimelinePage("earlier")} className="fixed left-2 top-1/2 z-40 flex min-h-11 items-center gap-1 rounded-full bg-white/90 px-2 font-mono text-[9px] text-stone-700 opacity-60 shadow-sm transition hover:opacity-100"><ChevronLeft size={20} /> older</button>}
      {viewMode === "transactions" && timelinePanOffset > minCanvasPanX + 1 && <button type="button" title="Drag to see newer transactions" aria-label="Later months. Drag to see newer transactions." onClick={() => panTimelinePage("later")} className="fixed top-1/2 z-40 flex min-h-11 items-center gap-1 rounded-full bg-white/90 px-2 font-mono text-[9px] text-stone-700 opacity-60 shadow-sm transition hover:opacity-100" style={{ right: FIELD_ICON_LANE_PX + 8 }}>newer <ChevronRight size={20} /></button>}
      {records.length > 0 && <div className="fixed bottom-11 z-40 -translate-x-1/2" style={{ left: fieldWidth / 2 }}><input aria-label="Find a company" value={companyQuery} onChange={(event) => setCompanyQuery(event.target.value)} onPointerDown={(event) => event.stopPropagation()} className={darkMode ? "h-11 rounded-full border border-[#49636a] bg-[#142022] px-4 font-mono text-[10px] text-stone-100 shadow-[0_6px_18px_-12px_rgba(0,0,0,.8)] outline-none placeholder:text-stone-400 focus:border-[#D8AE37]" : "h-11 rounded-full border border-stone-400 bg-white px-4 font-mono text-[10px] text-stone-700 shadow-[0_6px_18px_-12px_rgba(41,37,36,.28)] outline-none placeholder:text-stone-500 focus:border-[#D8AE37]"} style={{ width: `min(348px, ${Math.max(1, fieldWidth - 24)}px)` }} placeholder="look what the cat brought in" /></div>}
      <div data-kitty-viewport className="relative overflow-clip" style={{ width: fieldWidth }}>
      <section ref={kittyWorld} aria-label="Portfolio kitty field" data-field-motion={fieldIsMoving ? "active" : "resting"} className={viewMode === "transactions" ? "relative left-0 top-0 z-10 mx-auto touch-none" : "relative left-0 top-0 z-10 mx-auto touch-pan-y"} style={{ width: virtualCanvasWidth, height: virtualCanvasHeight }} onWheel={scrollTimeline} onPointerDown={(event) => { wakeField(); beginTimelineDrag(event); }} onPointerMove={moveTimelineDrag} onPointerUp={endTimelineDrag} onPointerCancel={endTimelineDrag}>
        {visiblePoints.map((entry) => {
          const node = nodes.current[entry.point.id]; if (!node) return null;
          const searchMatch = !searchTerm || entry.point.company.toLocaleLowerCase().includes(searchTerm);
          const muted = (taxFilter === "highlight" && !entry.point.taxSensitive) || (viewMode === "transactions" && focusedCompany !== null && entry.point.company !== focusedCompany) || !searchMatch;
          return <div key={entry.point.id} aria-hidden={searchTerm && !searchMatch ? "true" : undefined} className={muted ? "opacity-20 grayscale-[.32] transition-opacity duration-300" : "transition-opacity duration-300"} style={{ position: "absolute", left: node.x, top: node.y }}><CatGlyph {...entry} visualLens={visualLens} searchHidden={Boolean(searchTerm && !searchMatch)} searchTerm={searchTerm} searchMatch={searchMatch} showBadges={showPnlBadges} showHalos={showHalos} darkMode={darkMode} costumes={showCostumes ? costumeLayersById.get(entry.point.id) ?? [] : []} marketProfile={marketProfile} focused={selectedId === entry.point.id || (viewMode === "transactions" && focusedCompany === entry.point.company)} frozen={!fieldIsMoving} onHover={() => setHoveredId(entry.point.id)} onLeave={() => setHoveredId((current) => current === entry.point.id ? null : current)} onClick={() => { wakeField(); if (viewMode === "transactions") { setFocusedCompany((current) => current === entry.point.company ? null : entry.point.company); setSelectedId(null); setHoveredId(null); } else { setSelectedId(entry.point.id); setHoveredId(null); } }} /></div>;
        })}
      </section>
      </div>

      {mouseToyActive && <>
        <div data-mouse-toy="true" aria-hidden="true" className="pointer-events-none fixed z-[60] -translate-x-1/2 -translate-y-1/2" style={{ left: mousePosition.x, top: mousePosition.y, filter: `drop-shadow(0 0 4px ${SHOCKING_PINK})` }}><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={SHOCKING_PINK} strokeWidth="1.15" strokeLinecap="round" strokeLinejoin="round"><path d="M5.5 3a3.5 3.5 0 0 1 3.25 4.8a7.017 7.017 0 0 0 -2.424 2.1a3.5 3.5 0 1 1 -.826 -6.9z" /><path d="M18.5 3a3.5 3.5 0 1 1 -.826 6.902a7.013 7.013 0 0 0 -2.424 -2.103a3.5 3.5 0 0 1 3.25 -4.799z" /><path d="M12 14m-7 0a7 7 0 1 0 14 0a7 7 0 1 0 -14 0" /></svg></div>
      </>}
      <AnimatePresence>{hovered && tooltipNode && !selected && <motion.aside initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }} transition={{ duration: 0.16 }} className={`pointer-events-none fixed z-30 w-64 rounded-xl border px-4 py-3 backdrop-blur ${overlayTheme.panel}`} style={{ left: clamp(tooltipNode.x + activeCanvasPanX + 34, 12, sceneSize.width - 274), top: clamp(tooltipNode.y + activeCanvasPanY - window.scrollY - 28, 12, sceneSize.height - 184) }}><div className="mb-2 flex items-start justify-between gap-2"><p className={`font-serif text-[15px] leading-4 ${overlayTheme.title}`}>{hovered.company}</p><span className={hovered.pnl >= 0 ? darkMode ? "font-mono text-[10px] text-[#4ade80]" : "font-mono text-[10px] text-emerald-700" : darkMode ? "font-mono text-[10px] text-[#ff6b6b]" : "font-mono text-[10px] text-[#ff3b3b]"}>{hovered.pnl >= 0 ? "+" : ""}{hovered.pnlPercent.toFixed(1)}%</span></div><div className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[10px] tabular-nums">{viewMode === "transactions" && <><span className="text-stone-400">Date</span><span className="text-right">{formatTransactionDate(hovered.oldestDate, marketProfile)}</span></>}<span className="text-stone-400">Qty</span><span className="text-right">{formatMarketNumber(hovered.qty, marketProfile)}</span><span className="text-stone-400">Buy price</span><span className="text-right">{formatPrice(hovered.avgPrice, marketProfile)}</span><span className="text-stone-400">Current price</span><span className="text-right">{formatPrice(hovered.currentPrice, marketProfile)}</span><span className="text-stone-400">Invested</span><span className="text-right">{formatCurrency(hovered.investedValue, marketProfile)}</span><span className="text-stone-400">Value</span><span className="text-right">{formatCurrency(hovered.currentValue, marketProfile)}</span><span className="text-stone-400">P&amp;L</span><span className={hovered.pnl >= 0 ? darkMode ? "text-right text-[#4ade80]" : "text-right text-emerald-700" : darkMode ? "text-right text-[#ff6b6b]" : "text-right text-[#ff3b3b]"}>{formatCurrency(hovered.pnl, marketProfile)}</span></div></motion.aside>}</AnimatePresence>

      <AnimatePresence>{viewMode === "holdings" && selected && focusNode && <motion.aside initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.98 }} transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }} className={`fixed z-40 w-[min(336px,calc(100vw-28px))] overflow-hidden rounded-2xl border backdrop-blur ${overlayTheme.panel}`} style={{ left: clampCardLeft(focusNode.x, sceneSize.width, focusOnRight), top: clamp(focusNode.y + activeCanvasPanY - window.scrollY - 132, 14, sceneSize.height - 494) }}><div className={`flex items-start justify-between border-b px-5 py-4 ${overlayTheme.divider}`}><div><p className={`font-serif text-[19px] leading-5 ${overlayTheme.title}`}>{selected.company}</p><p className="mt-1 font-mono text-[9px] uppercase tracking-[.17em] text-stone-400">{selected.lots.length === 1 ? "Transaction lot" : `${selected.lots.length} transaction lots`}</p></div><button type="button" onClick={() => setSelectedId(null)} aria-label="Close details" className={`rounded-full p-1 transition ${overlayTheme.closeButton}`}><X size={16} /></button></div><div className={`grid grid-cols-2 gap-x-5 border-b px-5 py-3 ${overlayTheme.divider}`}><MetricRow label="Quantity" value={formatMarketNumber(selected.qty, marketProfile)} theme={overlayTheme} /><MetricRow label="Avg. buy" value={formatPrice(selected.avgPrice, marketProfile)} theme={overlayTheme} /><MetricRow label="Current" value={formatPrice(selected.currentPrice, marketProfile)} theme={overlayTheme} /><MetricRow label="Unrealized P&L" value={`${selected.pnl >= 0 ? "+" : ""}${formatCurrency(selected.pnl, marketProfile)}`} theme={overlayTheme} /></div><div className="max-h-48 overflow-y-auto px-5 py-3"><p className={`mb-2 font-mono text-[9px] uppercase tracking-[.18em] ${overlayTheme.muted}`}>Lot breakdown</p>{selected.lots.map((lot) => { const lotPnl = lot.buy_qty * (lot.current_price - lot.avg_price); const days = ageInDays(lot.buy_date); const completedYears = Math.floor((days ?? 0) / 365); return <div key={lot.id} className={`grid grid-cols-[1fr_auto] gap-2 border-t py-2 first:border-t-0 ${overlayTheme.divider}`}><div><p className={`font-mono text-[10px] ${overlayTheme.lotText}`}>{lot.buy_qty} × {formatPrice(lot.avg_price, marketProfile)}</p><p className={`font-mono text-[9px] ${overlayTheme.muted}`}>{formatTransactionDate(lot.buy_date, marketProfile)}{days ? ` · ${days}d` : ""}{completedYears ? ` · ${completedYears}y complete` : ""}</p></div><span className={`self-center font-mono text-[10px] ${lotPnl >= 0 ? overlayTheme.profit : overlayTheme.loss}`}>{lotPnl >= 0 ? "+" : ""}{formatCurrency(lotPnl, marketProfile)}</span></div>; })}</div>{selected.taxSensitive && <div className={`flex items-center gap-2 border-t px-5 py-3 font-mono text-[10px] ${overlayTheme.taxNotice}`}><Sparkles size={13} /> {marketProfile.taxReviewAgeDays !== null ? `Loss lot near/over the ${marketProfile.taxReviewAgeDays}-day review threshold.` : "Loss lot flagged for review."}</div>}</motion.aside>}</AnimatePresence>

      <PortfolioDrawer open={drawerOpen} onOpenChange={setDrawerOpen} litterboxRef={litterboxRef} viewMode={viewMode} setViewMode={(mode) => { setViewMode(mode); setSelectedId(null); }} visualLens={visualLens} setVisualLens={setVisualLens} taxFilter={taxFilter} setTaxFilter={(filter) => { setTaxFilter(filter); setSelectedId(null); }} showEtfs={showEtfs} setShowEtfs={setShowEtfs} darkMode={darkMode} etfLotCount={etfLotCount} marketId={marketId} setMarketId={setMarketId} marketProfile={marketProfile} frozen={frozen} setFrozen={setFrozen} reducedMotion={reducedMotion} repulsion={repulsion} setRepulsion={setRepulsion} gravityOn={gravityOn} setGravityOn={setGravityOn} showPnlBadges={showPnlBadges} setShowPnlBadges={setShowPnlBadges} showHalos={showHalos} setShowHalos={setShowHalos} showCostumes={showCostumes} setShowCostumes={setShowCostumes} onImportFile={importFile} uploadNotice={uploadNotice} hasDates={timeline.hasDates} onRestore={() => { setUploadNotice(null); fetch(PORTFOLIO_CSV_URL).then(parsePortfolioResponse).then(({ records: nextRecords, lastModified }) => { localStorage.removeItem(PORTFOLIO_STORAGE_KEY); setRecords(nextRecords); setDataUpdatedAt(lastModified ?? new Date().toISOString()); setUploadNotice({ kind: "success", message: `${nextRecords.length} lots reloaded from portfolio.csv.` }); setSelectedId(null); setHoveredId(null); resetViewport(); }).catch((error: unknown) => { setUploadNotice({ kind: "error", message: error instanceof Error ? error.message : "Portfolio download failed." }); }); }} visibleKittyCount={visiblePoints.length} loadedLotCount={eligibleRecords.length} />
      <MrBungles key={`${JSON.stringify(mrBunglesDigest)}${viewMode}${visualLens}`} digest={mrBunglesDigest} viewMode={viewMode} darkMode={darkMode} frozen={effectiveFrozen} onShowMe={focusMrBunglesTarget} onSpeak={() => { setSelectedId(null); setHoveredId(null); setLegendOpen(false); }} />
      <div className={getPortfolioFooterClassName(darkMode)}><span>Data updated {dataUpdatedAt ? formatMarketDate(dataUpdatedAt, marketProfile) : "—"}</span><span aria-hidden="true" className={PORTFOLIO_FOOTER_SEPARATOR_CLASS}>·</span><Link href="/privacy" className={darkMode ? "transition hover:text-stone-200" : "transition hover:text-stone-800"}>Privacy</Link><span aria-hidden="true" className={PORTFOLIO_FOOTER_SEPARATOR_CLASS}>·</span><a href="https://thecontrarian.in" target="_blank" rel="noreferrer" className={darkMode ? "transition hover:text-stone-200" : "transition hover:text-stone-800"}>© 2026 Mahesh Shantaram / thecontrarian.in</a></div>
    </main>
  );
}
