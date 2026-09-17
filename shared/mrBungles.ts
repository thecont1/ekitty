import { z } from "zod";

export const MR_BUNGLES_CACHE_MS = 60_000;
export const MR_BUNGLES_MAX_BYTES = 32_768;
const finite = z.number().finite();
const label = z.string().min(1).max(160).regex(/^[^\u0000-\u001f\u007f]+$/);
const id = z.string().min(1).max(320).regex(/^[^\u0000-\u001f\u007f]+$/);
const daySchema = z.object({
  change: finite,
  percent: finite,
  coveredLots: z.number().int().positive(),
  lotCount: z.number().int().positive(),
}).strict().refine(day => day.coveredLots === day.lotCount, "Partial day coverage is unavailable");
const targetSchema = z.object({
  id,
  company: label,
  invested: finite,
  current: finite,
  pnl: finite,
  pnlPercent: finite.optional(),
  lotCount: z.number().int().positive(),
  ageDays: z.number().int().nonnegative().optional(),
  purchaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  taxFlag: z.boolean(),
  etf: z.boolean(),
  sharePercent: finite.min(0).max(100).optional(),
  investedSharePercent: finite.min(0).max(100).optional(),
  day: daySchema.optional(),
}).strict().superRefine((target, ctx) => {
  if (target.pnl !== target.current - target.invested) ctx.addIssue({ code: "custom", message: "Inconsistent P&L" });
  if (target.invested <= 0 && target.pnlPercent !== undefined) ctx.addIssue({ code: "custom", message: "Return needs positive invested capital" });
  if (target.day && target.day.lotCount !== target.lotCount) ctx.addIssue({ code: "custom", message: "Incomplete target coverage" });
  if (target.taxFlag !== (target.pnl < 0 && (target.ageDays ?? 0) >= 330)) ctx.addIssue({ code: "custom", message: "Inconsistent tax-review flag" });
});
export const mrBunglesFactsSchema = z.object({
  version: z.literal(1),
  view: z.enum(["holdings", "transactions"]),
  lens: z.enum(["portfolio-impact", "trade-quality", "capital-at-risk"]),
  scope: z.object({ includesEtfs: z.boolean(), taxFilter: z.enum(["all", "highlight", "isolate"]), searchFiltered: z.boolean() }).strict(),
  population: z.number().int().nonnegative(),
  visibleCount: z.number().int().nonnegative(),
  quietTargetId: id.optional(),
  totals: z.object({ invested: finite, current: finite, pnl: finite, pnlPercent: finite.optional(), day: daySchema.optional() }).strict(),
  targets: z.array(targetSchema).max(13),
  leaders: z.object({ concentration: z.array(id).max(3), worstLosers: z.array(id).max(3), bestGainers: z.array(id).max(3), dayMovers: z.array(id).max(3) }).strict(),
}).strict();
export type MrBunglesFacts = z.infer<typeof mrBunglesFactsSchema>;
export type MrBunglesTarget = MrBunglesFacts["targets"][number];
export type MrBunglesDirective = { targetId: string; reason: "concentration" | "purchase-size" | "tax-review" | "return" | "day-move"; text: string };

function money(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(value);
}
function percent(value: number) {
  return `${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(value)}%`;
}

export function buildMrBunglesDirectives(facts: MrBunglesFacts): MrBunglesDirective[] {
  const directives: MrBunglesDirective[] = [];
  const noun = facts.view === 'holdings' ? 'holding' : 'purchase';
  for (const target of facts.targets) {
    const add = (reason: MrBunglesDirective['reason'], sentence: string) => {
      const text = `Regard ${target.company}. ${sentence}`;
      if (text.split(/\s+/).length <= 40) directives.push({ targetId: target.id, reason, text });
    };
    if (facts.quietTargetId === target.id) {
      add('return', `The field is tolerable. This ${noun}'s return is ${percent(target.pnlPercent!)}. Keep that quiet curiosity under observation.`);
    }
    if (facts.view === 'holdings' && target.sharePercent !== undefined && target.sharePercent >= 20) {
      add('concentration', `That kitty occupies ${percent(target.sharePercent)} of this portfolio's current value. Review its weight before adding more.`);
    }
    if (facts.view === 'transactions' && target.investedSharePercent !== undefined && target.investedSharePercent >= 10) {
      add('purchase-size', `This purchase accounts for ${percent(target.investedSharePercent)} of invested capital. Revisit the size of that decision.`);
    }
    if (target.taxFlag) {
      add('tax-review', `This ${noun} carries a ${money(Math.abs(target.pnl))} loss and an age-based tax flag. Check the lot dates and tax rules.`);
    } else if (target.pnl === 0) {
      add('return', `This ${noun} stands at break-even in the supplied marks. Inspect the capital tied up in it.`);
    } else {
      const amount = target.pnlPercent === undefined ? money(Math.abs(target.pnl)) : percent(Math.abs(target.pnlPercent));
      add('return', target.pnl < 0
        ? `This ${noun} has lost ${amount} against its cost. Revisit the premise for keeping that kitty.`
        : `This ${noun} has gained ${amount} against its cost. Inspect what that winner now occupies.`);
    }
    if (target.day && Math.abs(target.day.percent) >= 2) {
      add('day-move', `This ${noun} moved ${percent(target.day.percent)} against the supplied prior close. Inspect the move. Ignoring it changes nothing but who is surprised.`);
    }
  }
  return directives;
}

const directiveSchema = z.object({ targetId: id, reason: z.enum(["concentration", "purchase-size", "tax-review", "return", "day-move"]), text: z.string().min(1).max(800) }).strict();
export const mrBunglesDigestSchema = mrBunglesFactsSchema.extend({ directives: z.array(directiveSchema).max(52) }).superRefine((digest, ctx) => {
  const fail = (message: string) => ctx.addIssue({ code: "custom", message });
  const ids = new Set(digest.targets.map(target => target.id));
  if (ids.size !== digest.targets.length) fail("Duplicate targets");
  if (digest.visibleCount > digest.population || digest.targets.length > digest.visibleCount) fail("Inconsistent scope counts");
  if (digest.totals.pnl !== digest.totals.current - digest.totals.invested) fail("Inconsistent totals");
  if (digest.totals.day && digest.targets.some(target => !target.day)) fail("Incomplete portfolio day coverage");
  if (digest.quietTargetId && (!ids.has(digest.quietTargetId) || digest.targets.some(target => target.pnlPercent === undefined || Math.abs(target.pnlPercent) > 5 || target.taxFlag || (target.day && Math.abs(target.day.percent) >= 2) || (digest.view === "holdings" ? target.sharePercent === undefined || target.sharePercent >= 20 : target.investedSharePercent === undefined || target.investedSharePercent >= 10)))) fail("Invalid quiet curiosity");
  for (const target of digest.targets) {
    if (digest.view === "transactions" && (target.lotCount !== 1 || target.sharePercent !== undefined)) fail("Transaction scope mismatch");
    if (digest.view === "holdings" && (target.purchaseDate !== undefined || target.investedSharePercent !== undefined)) fail("Holding scope mismatch");
    if (!digest.scope.includesEtfs && target.etf) fail("Hidden ETF target");
    if (digest.scope.taxFilter === "isolate" && !target.taxFlag) fail("Hidden tax target");
  }
  for (const list of Object.values(digest.leaders)) {
    if (new Set(list).size !== list.length || list.some(targetId => !ids.has(targetId))) fail("Invalid leader reference");
  }
  for (const targetId of digest.leaders.dayMovers) {
    const target = digest.targets.find(item => item.id === targetId);
    if (!target?.day || Math.abs(target.day.percent) < 2) fail("Unavailable day mover");
  }
  if (JSON.stringify(digest.directives) !== JSON.stringify(buildMrBunglesDirectives(digest))) fail("Directives must quote only digest facts");
});
export type MrBunglesDigest = z.infer<typeof mrBunglesDigestSchema>;
export type MrBunglesReply = { targetId: string; utterance: string };

export function validateMrBunglesReply(value: unknown, digest: MrBunglesDigest): MrBunglesReply | null {
  const parsed = z.object({ targetId: id, utterance: z.string().max(800) }).strict().safeParse(value);
  if (!parsed.success) return null;
  return digest.directives.some(directive => directive.targetId === parsed.data.targetId && directive.text === parsed.data.utterance) ? parsed.data : null;
}
