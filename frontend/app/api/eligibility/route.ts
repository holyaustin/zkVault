import { NextRequest, NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

const execFileAsync = promisify(execFile);
const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT ?? path.resolve(process.cwd(), "..");

/**
 * Shells out to contract/src/bin/check_eligibility.rs, which makes a real
 * read-only call against the deployed ZkVault contract via Odra's livenet
 * HostRefLoader -- not a hand-rolled parse of Casper's global-state /
 * dictionary wire format. See that file's doc comment for the one Odra
 * API detail worth double-checking against your installed version.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userIdHash = searchParams.get("user_id_hash") ?? "";
  const contractAddr = searchParams.get("contract") || process.env.ZKVAULT_CONTRACT_HASH || "";

  if (!/^[0-9a-fA-F]{64}$/.test(userIdHash)) {
    return NextResponse.json(
      { error: "user_id_hash must be 64 hex characters (32 bytes)" },
      { status: 400 }
    );
  }
  if (!contractAddr) {
    return NextResponse.json(
      { error: "missing contract address — pass ?contract=hash-... or set ZKVAULT_CONTRACT_HASH" },
      { status: 400 }
    );
  }

  try {
    const { stdout } = await execFileAsync(
      "cargo",
      [
        "run",
        "--release",
        "-p",
        "zkvault-contract",
        "--features",
        "livenet",
        "--bin",
        "check_eligibility",
        "--",
        "--contract-addr",
        contractAddr,
        "--user-id-hash-hex",
        userIdHash,
      ],
      { cwd: WORKSPACE_ROOT, timeout: 60 * 1000 }
    );

    // cargo run can print build progress to stdout on first invocation;
    // the binary's own output is the last line, per its own doc comment.
    const lastLine = stdout.trim().split("\n").filter(Boolean).pop() ?? "{}";
    return NextResponse.json(JSON.parse(lastLine));
  } catch (err: any) {
    const detail = err?.stderr?.toString?.() ?? err?.message ?? String(err);
    return NextResponse.json({ error: `Status check failed: ${detail}` }, { status: 500 });
  }
}
