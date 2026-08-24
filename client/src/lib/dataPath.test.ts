import { describe, expect, it } from "vitest";
import { chmodSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { hasExpectedByteLength, readDataFile, readRegularDataFile, resolveDataFile } from "../../../server/dataPath";

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

  it("reads regular files completely but rejects symlinks", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "ekitty-data-"));
    const regular = path.join(root, "portfolio.csv");
    const link = path.join(root, "linked.csv");
    writeFileSync(regular, "company,buy_qty\n");
    symlinkSync(regular, link);

    try {
      await expect(readRegularDataFile(regular)).resolves.toEqual(Buffer.from("company,buy_qty\n"));
      await expect(readRegularDataFile(link)).resolves.toBeUndefined();
      await expect(readDataFile(link)).resolves.toEqual({ status: "invalid" });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails closed when a regular file cannot be fully read", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "ekitty-data-"));
    const unreadable = path.join(root, "portfolio.csv");
    writeFileSync(unreadable, "company,buy_qty\n");
    chmodSync(unreadable, 0);

    try {
      if (process.getuid?.() === 0) return;
      await expect(readRegularDataFile(unreadable)).resolves.toBeUndefined();
    } finally {
      chmodSync(unreadable, 0o600);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("distinguishes missing files from local read failures for safe fallback", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "ekitty-data-"));
    try {
      await expect(readDataFile(path.join(root, "missing.csv"))).resolves.toEqual({ status: "missing" });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects a completed buffer whose byte count differs from the opened file size", () => {
    expect(hasExpectedByteLength(Buffer.from("partial"), 100)).toBe(false);
    expect(hasExpectedByteLength(Buffer.from("complete"), 8)).toBe(true);
  });
});
