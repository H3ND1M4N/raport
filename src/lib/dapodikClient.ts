import {
  assertDapodikReadOnlyMethod,
  normalizeDapodikWebServiceUrl,
  parseDapodikWebServiceResponses,
  safeParseJsonResponse,
  type DapodikIncomingPayload,
} from './eraporCore';

export const LOCAL_RELAY_ORIGIN = 'http://127.0.0.1:5775';

export async function fetchDapodikFromLocalRelay(params: {
  npsn: string;
  fallbackSchoolName?: string;
}): Promise<{
  payload: DapodikIncomingPayload;
  detectedSchoolName: string;
  rombelCount: number;
  studentCount: number;
}> {
  const cleanNpsn = params.npsn.trim();
  const relayUrl = `${LOCAL_RELAY_ORIGIN}/sync?npsn=${encodeURIComponent(cleanNpsn)}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(relayUrl, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timer);

    const data = await safeParseJsonResponse<{
      ok?: boolean;
      error?: string;
      sourceHost?: string;
      sekolahRaw?: unknown;
      rombelRaw?: unknown;
      pesertaDidikRaw?: unknown;
      gtkRaw?: unknown;
    }>(res, 'dapodik');

    if (!res.ok || !data.ok) {
      throw new Error(
        data.error ||
          'Penyambung Lokal belum terhubung ke Dapodik. Pastikan Dapodik sudah terbuka dan Token WebService benar.'
      );
    }

    return parseDapodikWebServiceResponses({
      sourceHost: data.sourceHost || 'http://localhost:5774/WebService',
      npsn: cleanNpsn,
      sekolahRaw: data.sekolahRaw,
      rombelRaw: data.rombelRaw,
      pesertaDidikRaw: data.pesertaDidikRaw,
      gtkRaw: data.gtkRaw,
      fallbackSchoolName: params.fallbackSchoolName,
    });
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(
        'Waktu tunggu habis saat menghubungi Penyambung Lokal (127.0.0.1:5775).'
      );
    }
    throw err;
  }
}

export async function fetchDapodikFromBrowserDirect(params: {
  hostUrl: string;
  npsn: string;
  token?: string;
  fallbackSchoolName?: string;
}): Promise<{
  payload: DapodikIncomingPayload;
  detectedSchoolName: string;
  rombelCount: number;
  studentCount: number;
}> {
  const cleanBase = normalizeDapodikWebServiceUrl(params.hostUrl);
  const cleanNpsn = params.npsn.trim();
  const sekolahUrl = `${cleanBase}/getSekolah?npsn=${encodeURIComponent(cleanNpsn)}`;
  const rombelUrl = `${cleanBase}/getRombonganBelajar?npsn=${encodeURIComponent(cleanNpsn)}`;
  const pdUrl = `${cleanBase}/getPesertaDidik?npsn=${encodeURIComponent(cleanNpsn)}`;
  const gtkUrl = `${cleanBase}/getGtk?npsn=${encodeURIComponent(cleanNpsn)}`;

  assertDapodikReadOnlyMethod('GET', sekolahUrl);
  assertDapodikReadOnlyMethod('GET', rombelUrl);
  assertDapodikReadOnlyMethod('GET', pdUrl);
  assertDapodikReadOnlyMethod('GET', gtkUrl);

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (params.token?.trim()) {
    headers.Authorization = `Bearer ${params.token.trim()}`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3500);

  try {
    const [sekolahRes, rombelRes, pdRes, gtkRes] = await Promise.all([
      fetch(sekolahUrl, { method: 'GET', headers, signal: controller.signal }),
      fetch(rombelUrl, { method: 'GET', headers, signal: controller.signal }),
      fetch(pdUrl, { method: 'GET', headers, signal: controller.signal }),
      fetch(gtkUrl, { method: 'GET', headers, signal: controller.signal }).catch(() => null),
    ]);
    clearTimeout(timer);

    if (pdRes.status === 401 || pdRes.status === 403 || sekolahRes.status === 401) {
      throw new Error(
        `Token WebService Dapodik ditolak (HTTP ${pdRes.status}). Salin Token dari menu Dapodik -> Pengaturan -> WebService lalu tempel di sini.`
      );
    }
    if (!pdRes.ok) {
      throw new Error(`Dapodik WebService merespons HTTP ${pdRes.status}`);
    }

    const [sekolahRaw, rombelRaw, pesertaDidikRaw, gtkRaw] = await Promise.all([
      sekolahRes.ok
        ? safeParseJsonResponse(sekolahRes, 'dapodik').catch(() => undefined)
        : Promise.resolve(undefined),
      rombelRes.ok
        ? safeParseJsonResponse(rombelRes, 'dapodik').catch(() => undefined)
        : Promise.resolve(undefined),
      safeParseJsonResponse(pdRes, 'dapodik'),
      gtkRes && gtkRes.ok
        ? safeParseJsonResponse(gtkRes, 'dapodik').catch(() => undefined)
        : Promise.resolve(undefined),
    ]);

    return parseDapodikWebServiceResponses({
      sourceHost: cleanBase,
      npsn: cleanNpsn,
      sekolahRaw,
      rombelRaw,
      pesertaDidikRaw,
      gtkRaw,
      fallbackSchoolName: params.fallbackSchoolName,
    });
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

export function buildWindowsPowerShellBridgeScript(params: {
  appOrigin: string;
  npsn: string;
  namaSekolah: string;
  dapodikHost: string;
  dapodikToken: string;
  bridgeKey: string;
  intervalSec: number;
}): string {
  const safeHost = normalizeDapodikWebServiceUrl(params.dapodikHost);
  const safeApp = params.appOrigin.replace(/\/+$/, '');
  const safeNpsn = params.npsn.trim().replace(/'/g, "''");
  const safeSchool = params.namaSekolah.replace(/'/g, "''");
  const safeToken = params.dapodikToken.trim().replace(/'/g, "''");
  const safeBridgeKey = params.bridgeKey.replace(/'/g, "''");

  return [
    "$ErrorActionPreference = 'Continue'",
    'try {',
    '  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls11 -bor [Net.SecurityProtocolType]::Tls',
    '} catch {',
    '  try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch {}',
    '}',
    `$PrimaryHost = '${safeHost.replace(/'/g, "''")}'`,
    "$FallbackHost = $PrimaryHost -replace '://localhost(:|/)', '://127.0.0.1$1'",
    `$Npsn = '${safeNpsn}'`,
    `$SchoolName = '${safeSchool}'`,
    `$DapodikToken = '${safeToken}'`,
    `$AppUrl = '${safeApp.replace(/'/g, "''")}/api/dapodik/bridge-push'`,
    `$BridgeKey = '${safeBridgeKey}'`,
    "$DesktopDir = [Environment]::GetFolderPath('Desktop')",
    'if ([string]::IsNullOrWhiteSpace($DesktopDir)) { $DesktopDir = Join-Path $env:USERPROFILE "Desktop" }',
    '$DesktopFile = Join-Path $DesktopDir "Data-Dapodik-$Npsn.json"',
    '$RelayPort = 5775',
    '',
    'function Fetch-DapodikSnapshot {',
    "  $headers = @{ Accept = 'application/json' }",
    "  if ($DapodikToken -ne '') {",
    '    $headers[\'Authorization\'] = "Bearer $DapodikToken"',
    '  }',
    '',
    '  $ActiveHost = $PrimaryHost',
    '  try {',
    '    $pdRaw = Invoke-RestMethod -Method Get -Uri "$ActiveHost/getPesertaDidik?npsn=$Npsn" -Headers $headers -TimeoutSec 6 -ErrorAction Stop',
    '  } catch {',
    '    if ($FallbackHost -ne $PrimaryHost) {',
    '      $ActiveHost = $FallbackHost',
    '      $pdRaw = Invoke-RestMethod -Method Get -Uri "$ActiveHost/getPesertaDidik?npsn=$Npsn" -Headers $headers -TimeoutSec 6 -ErrorAction Stop',
    '    } else {',
    '      throw',
    '    }',
    '  }',
    '',
    '  $sekolahRaw = $null',
    '  $rombelRaw = $null',
    '  $gtkRaw = $null',
    '  try { $sekolahRaw = Invoke-RestMethod -Method Get -Uri "$ActiveHost/getSekolah?npsn=$Npsn" -Headers $headers -TimeoutSec 5 -ErrorAction Stop } catch {}',
    '  try { $rombelRaw  = Invoke-RestMethod -Method Get -Uri "$ActiveHost/getRombonganBelajar?npsn=$Npsn" -Headers $headers -TimeoutSec 5 -ErrorAction Stop } catch {}',
    '  try { $gtkRaw     = Invoke-RestMethod -Method Get -Uri "$ActiveHost/getGtk?npsn=$Npsn" -Headers $headers -TimeoutSec 5 -ErrorAction Stop } catch {}',
    '',
    '  return @{',
    '    ok = $true',
    '    npsn = $Npsn',
    '    sourceHost = $ActiveHost',
    '    sekolahRaw = $sekolahRaw',
    '    rombelRaw = $rombelRaw',
    '    pesertaDidikRaw = $pdRaw',
    '    gtkRaw = $gtkRaw',
    '  }',
    '}',
    '',
    'function Send-HttpResponse($client, $statusLine, $bodyText) {',
    '  $stream = $client.GetStream()',
    '  $bodyBytes = [System.Text.Encoding]::UTF8.GetBytes($bodyText)',
    '  $hdr = @(',
    '    "HTTP/1.1 $statusLine",',
    '    "Content-Type: application/json; charset=utf-8",',
    '    "Access-Control-Allow-Origin: *",',
    '    "Access-Control-Allow-Methods: GET, OPTIONS",',
    '    "Access-Control-Allow-Headers: *",',
    '    "Access-Control-Allow-Private-Network: true",',
    '    "Cache-Control: no-store",',
    '    "Content-Length: $($bodyBytes.Length)",',
    '    "Connection: close",',
    '    "",',
    '    ""',
    '  ) -join "`r`n"',
    '  $hdrBytes = [System.Text.Encoding]::ASCII.GetBytes($hdr)',
    '  $stream.Write($hdrBytes, 0, $hdrBytes.Length)',
    '  if ($bodyBytes.Length -gt 0) {',
    '    $stream.Write($bodyBytes, 0, $bodyBytes.Length)',
    '  }',
    '  $stream.Flush()',
    '}',
    '',
    'try { Clear-Host } catch {}',
    'Write-Host "=========================================================" -ForegroundColor Cyan',
    'Write-Host "  PENYAMBUNG OTOMATIS e-RAPOR <-> DAPODIK (AMAN READ-ONLY)" -ForegroundColor Cyan',
    'Write-Host "=========================================================" -ForegroundColor Cyan',
    `Write-Host " Sekolah : $SchoolName (NPSN $Npsn)"`,
    'Write-Host " Dapodik : $PrimaryHost"',
    'Write-Host " Relay   : http://127.0.0.1:$RelayPort (Tanpa hak Admin, anti-CORS)"',
    'Write-Host " Backup  : $DesktopFile"',
    'Write-Host "=========================================================" -ForegroundColor Cyan',
    'Write-Host ""',
    '',
    'try {',
    '  $listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, $RelayPort)',
    '  $listener.Start()',
    '} catch {',
    '  Write-Host "[PERINGATAN] Port $RelayPort tidak dapat dibuka: $($_.Exception.Message)" -ForegroundColor Yellow',
    '  Write-Host "Jika jendela Penyambung Lokal lain sudah berjalan, Anda tidak perlu membuka dua kali." -ForegroundColor Cyan',
    '  exit 1',
    '}',
    '',
    'Write-Host "[SIAP] Relay lokal berjalan di http://127.0.0.1:$RelayPort" -ForegroundColor Green',
    '',
    'try {',
    '  $snap = Fetch-DapodikSnapshot',
    '  $snapJson = $snap | ConvertTo-Json -Depth 12 -Compress',
    '  [System.IO.File]::WriteAllText($DesktopFile, $snapJson, (New-Object System.Text.UTF8Encoding($false)))',
    '  Write-Host "[OK] Dapodik terbaca! File cadangan disimpan di Desktop: Data-Dapodik-$Npsn.json" -ForegroundColor Green',
    '  try {',
    "    $pushHeaders = @{ 'x-bridge-key' = $BridgeKey }",
    '    $utf8Bytes = [System.Text.Encoding]::UTF8.GetBytes($snapJson)',
    "    $resp = Invoke-RestMethod -Method Post -Uri $AppUrl -Headers $pushHeaders -ContentType 'application/json; charset=utf-8' -Body $utf8Bytes -TimeoutSec 8 -ErrorAction Stop",
    '    if ($resp.ok) {',
    '      Write-Host "[CLOUD] Tersinkron otomatis! Siswa: $($resp.studentCount), Rombel: $($resp.rombelCount)" -ForegroundColor Green',
    '    }',
    '  } catch {',
    '    Write-Host "[INFO] Klik tombol \'2. Tarik dari Penyambung Lokal (127.0.0.1:5775)\' di browser e-Rapor Anda." -ForegroundColor Cyan',
    '  }',
    '} catch {',
    '  Write-Host "[PERINGATAN] Belum terhubung ke Dapodik ($PrimaryHost): $($_.Exception.Message)" -ForegroundColor Yellow',
    '  Write-Host "Pastikan aplikasi Dapodik sudah terbuka dan Token WebService sudah benar." -ForegroundColor Yellow',
    '}',
    '',
    'Write-Host ""',
    'Write-Host "Biarkan jendela CMD ini terbuka agar browser e-Rapor dapat menarik data real-time..." -ForegroundColor White',
    '',
    'try {',
    '  while ($true) {',
    '    if ($listener.Pending()) {',
    '      $client = $listener.AcceptTcpClient()',
    '      try {',
    '        $stream = $client.GetStream()',
    '        $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::ASCII, $false, 1024, $true)',
    '        $reqLine = $reader.ReadLine()',
    '        while ($true) {',
    '          $line = $reader.ReadLine()',
    '          if ([string]::IsNullOrEmpty($line)) { break }',
    '        }',
    '        if ($reqLine -and $reqLine.StartsWith("OPTIONS")) {',
    '          Send-HttpResponse $client "204 No Content" ""',
    '        } else {',
    '          try {',
    '            $fresh = Fetch-DapodikSnapshot',
    '            $json = $fresh | ConvertTo-Json -Depth 12 -Compress',
    '            [System.IO.File]::WriteAllText($DesktopFile, $json, (New-Object System.Text.UTF8Encoding($false)))',
    '            Send-HttpResponse $client "200 OK" $json',
    '            Write-Host "[$(Get-Date -Format \'HH:mm:ss\')] Data Dapodik dikirim ke browser e-Rapor!" -ForegroundColor Green',
    '          } catch {',
    '            $errObj = @{ ok = $false; error = $_.Exception.Message } | ConvertTo-Json -Compress',
    '            Send-HttpResponse $client "502 Bad Gateway" $errObj',
    '            Write-Host "[$(Get-Date -Format \'HH:mm:ss\')] Gagal membaca Dapodik: $($_.Exception.Message)" -ForegroundColor Yellow',
    '          }',
    '        }',
    '      } finally {',
    '        try { $client.Close() } catch {}',
    '      }',
    '    }',
    '    Start-Sleep -Milliseconds 120',
    '  }',
    '} finally {',
    '  try { $listener.Stop() } catch {}',
    '}',
  ].join('\r\n');
}

export function buildWindowsBridgeBatScript(params: {
  appOrigin: string;
  npsn: string;
  namaSekolah: string;
  dapodikHost: string;
  dapodikToken: string;
  bridgeKey: string;
  intervalSec: number;
}): string {
  const safeNpsn = params.npsn.trim().replace(/[^0-9]/g, '') || 'sekolah';
  const psScript = buildWindowsPowerShellBridgeScript(params);

  const batHeader = [
    '@echo off',
    'setlocal EnableExtensions',
    'chcp 65001 >nul 2>&1',
    `title Penyambung Lokal e-Rapor Dapodik (NPSN ${safeNpsn})`,
    'echo =========================================================',
    'echo   PENYAMBUNG LOKAL e-RAPOR DAPODIK (127.0.0.1:5775)',
    'echo =========================================================',
    'echo Menyiapkan PowerShell dan relay lokal...',
    'set "PS_EXE=powershell"',
    'if exist "%SystemRoot%\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" set "PS_EXE=%SystemRoot%\\System32\\WindowsPowerShell\\v1.0\\powershell.exe"',
    'set "BAT_SELF=%~f0"',
    `set "PS_FILE=%TEMP%\\erapor-bridge-${safeNpsn}.ps1"`,
    `"%PS_EXE%" -NoProfile -ExecutionPolicy Bypass -Command "$lines = @(Get-Content -LiteralPath $env:BAT_SELF -Encoding UTF8 -ErrorAction Stop); $idx = [Array]::IndexOf($lines, '#__ERAPOR_PS_START__'); if ($idx -lt 0) { exit 1 }; [System.IO.File]::WriteAllLines($env:PS_FILE, $lines[($idx + 1)..($lines.Length - 1)], (New-Object System.Text.UTF8Encoding($false)))"`,
    'if errorlevel 1 (',
    '  echo.',
    '  echo [GAGAL] Tidak dapat menyiapkan skrip PowerShell lokal.',
    '  echo Coba klik kanan file ini lalu pilih "Run as administrator", atau jalankan versi .ps1.',
    '  pause',
    '  exit /b 1',
    ')',
    '"%PS_EXE%" -NoProfile -ExecutionPolicy Bypass -File "%PS_FILE%"',
    'set "BRIDGE_ERR=%ERRORLEVEL%"',
    'echo.',
    'echo Penyambung Lokal berhenti (kode: %BRIDGE_ERR%).',
    'echo Tekan tombol apa saja untuk menutup jendela ini...',
    'pause >nul',
    'exit /b %BRIDGE_ERR%',
    '#__ERAPOR_PS_START__',
  ].join('\r\n');

  return `${batHeader}\r\n${psScript}\r\n`;
}

export function buildNodeBridgeScript(params: {
  appOrigin: string;
  npsn: string;
  namaSekolah: string;
  dapodikHost: string;
  dapodikToken: string;
  bridgeKey: string;
  intervalSec: number;
}): string {
  const safeHost = normalizeDapodikWebServiceUrl(params.dapodikHost);
  const safeApp = params.appOrigin.replace(/\/+$/, '');
  const intervalMs = Math.max(10, params.intervalSec || 20) * 1000;

  return `// e-Rapor Dapodik Real-Time Bridge & Local CORS Relay (Zero-Dependency Node 18+)
// Sekolah: ${params.namaSekolah} (NPSN ${params.npsn})
// Hanya memakai HTTP GET (Read-Only) ke Dapodik lokal sehingga database Dapodik tidak pernah berubah.

import crypto from 'node:crypto';
import http from 'node:http';

const DAPODIK_HOST = ${JSON.stringify(safeHost)};
const NPSN = ${JSON.stringify(params.npsn.trim())};
const DAPODIK_TOKEN = ${JSON.stringify(params.dapodikToken.trim())};
const APP_PUSH_URL = ${JSON.stringify(`${safeApp}/api/dapodik/bridge-push`)};
const BRIDGE_KEY = ${JSON.stringify(params.bridgeKey)};
const INTERVAL_MS = ${intervalMs};
const RELAY_PORT = 5775;

let lastHash = '';

async function parseSafeJson(res, label) {
  const text = await res.text();
  const trimmed = text.trim();
  if (!trimmed) throw new Error(\`\${label} mengembalikan respons kosong (HTTP \${res.status}).\`);
  if (trimmed.startsWith('<')) {
    throw new Error(\`\${label} mengembalikan halaman HTML bukan JSON (HTTP \${res.status}).\`);
  }
  return JSON.parse(trimmed);
}

async function getJson(url, headers) {
  const res = await fetch(url, { method: 'GET', headers });
  if (!res.ok) throw new Error(\`HTTP \${res.status} pada \${url}\`);
  return parseSafeJson(res, 'WebService Dapodik');
}

async function fetchSnapshot() {
  const headers = { Accept: 'application/json' };
  if (DAPODIK_TOKEN) headers.Authorization = \`Bearer \${DAPODIK_TOKEN}\`;

  const [sekolahRaw, rombelRaw, pdRaw, gtkRaw] = await Promise.all([
    getJson(\`\${DAPODIK_HOST}/getSekolah?npsn=\${NPSN}\`, headers).catch(() => undefined),
    getJson(\`\${DAPODIK_HOST}/getRombonganBelajar?npsn=\${NPSN}\`, headers).catch(() => undefined),
    getJson(\`\${DAPODIK_HOST}/getPesertaDidik?npsn=\${NPSN}\`, headers),
    getJson(\`\${DAPODIK_HOST}/getGtk?npsn=\${NPSN}\`, headers).catch(() => undefined),
  ]);

  return {
    ok: true,
    npsn: NPSN,
    sourceHost: DAPODIK_HOST,
    sekolahRaw,
    rombelRaw,
    pesertaDidikRaw: pdRaw,
    gtkRaw,
  };
}

// Local CORS Relay on 127.0.0.1:5775 (Works even when cloud app uses Google/IAP login)
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    const snapshot = await fetchSnapshot();
    res.writeHead(200);
    res.end(JSON.stringify(snapshot));
    console.log(\`[\${new Date().toLocaleTimeString()}] Data Dapodik dikirim ke browser e-Rapor via Relay.\`);
  } catch (err) {
    res.writeHead(502);
    res.end(JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }));
  }
});

server.listen(RELAY_PORT, '127.0.0.1', () => {
  console.log(\`[SIAP] Relay CORS Lokal aktif di http://127.0.0.1:\${RELAY_PORT}\`);
});

async function syncOnce() {
  const payload = await fetchSnapshot();
  const jsonStr = JSON.stringify(payload);
  const hash = crypto.createHash('sha256').update(jsonStr).digest('hex');
  if (hash === lastHash) return;

  const pushRes = await fetch(APP_PUSH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-bridge-key': BRIDGE_KEY },
    body: jsonStr,
  });
  const result = await parseSafeJson(pushRes, 'Server e-Rapor');
  if (pushRes.ok && result.ok) {
    lastHash = hash;
    console.log(\`[\${new Date().toLocaleTimeString()}] Sinkron cloud sukses! Siswa: \${result.studentCount}, Rombel: \${result.rombelCount}\`);
  }
}

console.log(\`Memulai Dapodik Real-Time Bridge untuk NPSN \${NPSN}...\`);
await syncOnce().catch(() => {
  console.log('Catatan: Gunakan tombol "Tarik dari Penyambung Lokal" di browser e-Rapor Anda.');
});
setInterval(() => {
  syncOnce().catch(() => undefined);
}, INTERVAL_MS);
`;
}

export function buildSampleDapodikCsv(): string {
  return [
    'NISN;NIPD;Nama Peserta Didik;L/P;Rombel;Nama Orang Tua',
    '0134567801;25001;I Putu Gede Pratama;L;Kelas 6A;I Made Pratama',
    '0134567802;25002;Ni Luh Ayu Permata;P;Kelas 6A;Ni Wayan Sari',
    '0134567803;25003;Kadek Bagus Mahendra;L;Kelas 6B;Komang Wijaya',
  ].join('\n');
}
