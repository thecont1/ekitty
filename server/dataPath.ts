import { lstatSync } from "node:fs";
import * as path from "node:path";

/** Resolve one flat file inside the local data directory.
 *
 * Request URLs are untrusted: discard query strings, decode once, reject path
 * separators, and verify containment after normalization.
 */
export function resolveDataFile(dataRoot: string, requestUrl: string | undefined): string | undefined {
  if (!requestUrl) return undefined;

  try {
    const rawPath = requestUrl.split(/[?#]/, 1)[0] ?? "";
    const filename = decodeURIComponent(rawPath.replace(/^\/+/, ""));
    if (!filename || filename === "." || filename === ".." || filename.includes("/") || filename.includes("\\")) {
      return undefined;
    }

    const base = path.resolve(dataRoot);
    const candidate = path.resolve(base, filename);
    return candidate.startsWith(`${base}${path.sep}`) ? candidate : undefined;
  } catch {
    return undefined;
  }
}

export function isRegularDataFile(candidate: string): boolean {
  try {
    const stat = lstatSync(candidate);
    return stat.isFile() && !stat.isSymbolicLink();
  } catch {
    return false;
  }
}
