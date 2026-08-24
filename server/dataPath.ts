import { constants, lstatSync } from "node:fs";
import { open } from "node:fs/promises";
import * as path from "node:path";

export type DataFileReadResult =
  | { status: "ok"; data: Buffer }
  | { status: "missing" }
  | { status: "invalid" };

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

/** Kept for callers that only need a synchronous classification check.
 * Serving code must use readDataFile so it validates the opened handle.
 */
export function isRegularDataFile(candidate: string): boolean {
  try {
    const stat = lstatSync(candidate);
    return stat.isFile() && !stat.isSymbolicLink();
  } catch {
    return false;
  }
}

export function hasExpectedByteLength(data: Buffer, expectedBytes: number): boolean {
  return data.byteLength === expectedBytes;
}

/** Open and fully read one non-symlink regular file before a success response.
 *
 * O_NOFOLLOW closes the check/open symlink race; fstat validates the opened
 * handle, and the byte-count check detects truncation while that handle is read.
 */
export async function readDataFile(candidate: string): Promise<DataFileReadResult> {
  let handle;
  try {
    handle = await open(candidate, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    const beforeRead = await handle.stat();
    if (!beforeRead.isFile()) return { status: "invalid" };
    const data = await handle.readFile();
    if (!hasExpectedByteLength(data, beforeRead.size)) return { status: "invalid" };
    return { status: "ok", data };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    return code === "ENOENT" ? { status: "missing" } : { status: "invalid" };
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

/** Compatibility wrapper for existing callers. */
export async function readRegularDataFile(candidate: string): Promise<Buffer | undefined> {
  const result = await readDataFile(candidate);
  return result.status === "ok" ? result.data : undefined;
}
