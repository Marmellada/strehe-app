import { spawnSync } from "node:child_process";

// Windows credential handling for the agent Supabase password.
//
// Primary: Windows Credential Manager (OS-protected, user/machine-bound).
//   - store via `cmdkey /generic` (no plaintext on disk)
//   - retrieve via CredRead P/Invoke (no plaintext on disk)
// Fallback (approved): DPAPI CurrentUser (protect/unprotect round-trip).
//
// The agent password is NEVER written to a file, a repo, SQLite, a log, or an
// artifact. It lives only in the OS credential store and transient process memory.

function runPowershell(script, { timeoutMs = 30000 } = {}) {
  const result = spawnSync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", script],
    { encoding: "utf8", windowsHide: true, timeout: timeoutMs },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const message = (result.stderr || result.stdout || "").trim();
    throw new Error(message || `powershell exited ${result.status}`);
  }
  return (result.stdout || "").trim();
}

const CREDREAD_SCRIPT = `
$ErrorActionPreference = 'Stop'
$target = '__TARGET__'
if (-not ('StreheCred.Native' -as [type])) {
  Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
namespace StreheCred {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public struct CREDENTIAL {
    public int Flags;
    public int Type;
    public string TargetName;
    public string Comment;
    public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
    public int CredentialBlobSize;
    public IntPtr CredentialBlob;
    public int Persist;
    public int AttributeCount;
    public IntPtr Attributes;
    public string TargetAlias;
    public string UserName;
  }
  public static class Native {
    [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    public static extern bool CredRead(string target, int type, int reservedFlag, out IntPtr credentialPtr);
    [DllImport("advapi32.dll", SetLastError = true)]
    public static extern void CredFree(IntPtr cred);
  }
}
"@
}
$ptr = [IntPtr]::Zero
if (-not [StreheCred.Native]::CredRead($target, 1, 0, [ref]$ptr)) {
  throw "CredRead failed for target: $target"
}
try {
  $cred = [Runtime.InteropServices.Marshal]::PtrToStructure($ptr, [type][StreheCred.CREDENTIAL])
  if ($cred.CredentialBlobSize -le 0) { throw 'Empty credential blob' }
  $bytes = New-Object byte[] $cred.CredentialBlobSize
  [Runtime.InteropServices.Marshal]::Copy($cred.CredentialBlob, $bytes, 0, $cred.CredentialBlobSize)
  [Text.Encoding]::Unicode.GetString($bytes)
} finally {
  [StreheCred.Native]::CredFree($ptr)
}
`;

function runCmdkey(args) {
  const result = spawnSync("cmdkey.exe", args, {
    encoding: "utf8",
    windowsHide: true,
    timeout: 20000,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const message = (result.stderr || result.stdout || "").trim();
    throw new Error(message || `cmdkey exited ${result.status}`);
  }
  return (result.stdout || "").trim();
}

export function storeCredential(target, username, password) {
  runCmdkey([`/generic:${target}`, `/user:${username}`, `/pass:${password}`]);
  return { stored: true, target };
}

export function getCredential(target) {
  return runPowershell(CREDREAD_SCRIPT.replace("__TARGET__", target));
}

export function deleteCredential(target) {
  runCmdkey([`/delete:${target}`]);
  return { deleted: true, target };
}

// DPAPI CurrentUser fallback (approved if Credential Manager proves unusable).
export function dpapiProtect(secret) {
  const escaped = secret.replace(/'/g, "''");
  return runPowershell(
    `$s = ConvertTo-SecureString '${escaped}' -AsPlainText -Force; ConvertFrom-SecureString $s`,
  );
}

export function dpapiUnprotect(blob) {
  const escaped = blob.replace(/'/g, "''");
  return runPowershell(
    `$s = ConvertTo-SecureString '${escaped}'; [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s))`,
  );
}

// Prove the Credential Manager store/retrieve/delete path works end to end.
export function credentialSelfTest() {
  const target = "strehe-agent-self-test";
  const secret = "self-test-" + Math.random().toString(36).slice(2, 10);
  storeCredential(target, "self-test", secret);
  const retrieved = getCredential(target);
  deleteCredential(target);
  if (retrieved !== secret) {
    throw new Error("Credential Manager self-test mismatch (store/retrieve failed).");
  }
  return { ok: true, mechanism: "windows-credential-manager" };
}
