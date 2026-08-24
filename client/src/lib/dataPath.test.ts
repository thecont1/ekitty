import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { isRegularDataFile, resolveDataFile } from "../../../server/dataPath";

const dataRoot = path.resolve("/tmp/ekitty/client/public/data");

describe("resolveDataFile", () => {
  it("resolves a direct data filename and ignores its query string", () => {
    expect(resolveDataFile(dataRoot, "/portfolio.csv?cache=1")).toBe(path.join(dataRoot, "portfolio.csv"));
  });

  it.each([
    "/../.env",
    "/../../../etc/passwd",
    "/%2e%2e/%2e%2e/.env",
    "/..%2f..%2f.env",
    "/nested/portfolio.csv",
    "/nested\\portfolio.csv",
  ])("rejects a path outside the flat data directory: %s", (requestUrl) => {
    expect(resolveDataFile(dataRoot, requestUrl)).toBeUndefined();
  });

  it("rejects missing and malformed request URLs", () => {
    expect(resolveDataFile(dataRoot, undefined)).toBeUndefined();
    expect(resolveDataFile(dataRoot, "/%E0%A4%A")).toBeUndefined();
  });

  it("accepts regular files but rejects symlinks", () => {
    const root = mkdtempSync(path.join(tmpdir(), "ekitty-data-"));
    const regular = path.join(root, "portfolio.csv");
    const link = path.join(root, "linked.csv");
    writeFileSync(regular, "company,buy_qty\n");
    symlinkSync(regular, link);

    try {
      expect(isRegularDataFile(regular)).toBe(true);
      expect(isRegularDataFile(link)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
