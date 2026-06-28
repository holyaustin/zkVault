import { NextRequest, NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const execFileAsync = promisify(execFile);

// This Next.js app lives at <repo>/frontend, so the workspace root (where
// the Cargo workspace's root Cargo.toml lives) is one level up. Override
// with WORKSPACE_ROOT if you've laid the repo out differently.
const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT ?? path.resolve(process.cwd(), "..");

/**
 * PRIVACY NOTE: this route runs the real RISC Zero prover (the
 * zkvault-host binary) on whatever machine is running this Next.js
 * server, which means it sees the plaintext balance for the duration of
 * the request.
 *
 * That's a non-issue for local development (`npm run dev` on your own
 * laptop -- balance never crosses a network boundary at all). It becomes
 * a real trust assumption the moment this app is deployed somewhere
 * public. For any deployment beyond your own machine, point people at the
 * "Upload sealed proof" tab instead, where they run the prover CLI
 * themselves and only the proof (never the balance) ever reaches this
 * server. Don't quietly turn this route on in a hosted deployment and
 * call the result "private" -- it wouldn't be.
 */
export async function POST(req: NextRequest) {
  let body: { balance?: unknown; threshold?: unknown; userSecret?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const { balance, threshold, userSecret } = body;

  if (!/^\d+$/.test(String(balance))) {
    return NextResponse.json({ error: "balance must be a non-negative integer" }, { status: 400 });
  }
  if (!/^\d+$/.test(String(threshold))) {
    return NextResponse.json({ error: "threshold must be a non-negative integer" }, { status: 400 });
  }
  if (typeof userSecret !== "string" || userSecret.length === 0 || userSecret.length > 256) {
    return NextResponse.json(
      { error: "userSecret is required (1-256 chars)" },
      { status: 400 }
    );
  }

  const dir = await mkdtemp(path.join(tmpdir(), "zkvault-proof-"));
  const outPath = path.join(dir, "proof.json");

  try {
    // execFile (not exec/shell) — arguments are passed as an array, never
    // interpolated into a shell string, so userSecret's contents can't
    // inject shell syntax regardless of what's in it.
    await execFileAsync(
      "cargo",
      [
        "run",
        "--release",
        "-p",
        "zkvault-host",
        "--",
        "--balance",
        String(balance),
        "--threshold",
        String(threshold),
        "--user-secret",
        userSecret,
        "--out",
        outPath,
      ],
      {
        cwd: WORKSPACE_ROOT,
        timeout: 10 * 60 * 1000, // proving can be slow on CPU-only machines
        maxBuffer: 1024 * 1024 * 16,
      }
    );

    const proofJson = await readFile(outPath, "utf-8");
    return NextResponse.json(JSON.parse(proofJson));
  } catch (err: any) {
    const detail = err?.stderr?.toString?.() ?? err?.message ?? String(err);
    return NextResponse.json({ error: `Proving failed: ${detail}` }, { status: 500 });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
