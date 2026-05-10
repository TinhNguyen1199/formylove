# build.ps1 — đóng gói site cho deploy production
# Yêu cầu cài 1 lần: npm install -g javascript-obfuscator

$ErrorActionPreference = 'Stop'

$src  = $PSScriptRoot
$dist = Join-Path $src 'dist'

Write-Host '==> Dọn dist cũ...' -ForegroundColor Cyan
if (Test-Path $dist) { Remove-Item -Recurse -Force $dist }
New-Item -ItemType Directory -Path $dist | Out-Null

Write-Host '==> Copy assets tĩnh (HTML, CSS, photos)...' -ForegroundColor Cyan
Copy-Item (Join-Path $src 'index.html') $dist
Copy-Item (Join-Path $src 'style.css')  $dist
$photosSrc = Join-Path $src  'photos'
$photosOut = Join-Path $dist 'photos'
if (Test-Path $photosSrc) {
  New-Item -ItemType Directory -Path $photosOut | Out-Null
  Get-ChildItem $photosSrc -File -Recurse |
    Where-Object { $_.Extension -notin '.md', '.txt' } |
    ForEach-Object {
      $rel = $_.FullName.Substring($photosSrc.Length).TrimStart('\','/')
      $tgt = Join-Path $photosOut $rel
      $tgtDir = Split-Path $tgt -Parent
      if (-not (Test-Path $tgtDir)) { New-Item -ItemType Directory -Path $tgtDir | Out-Null }
      Copy-Item $_.FullName $tgt
    }
}

# Kiểm tra obfuscator có cài chưa
$ob = Get-Command 'javascript-obfuscator' -ErrorAction SilentlyContinue
if (-not $ob) {
  Write-Host 'Lỗi: chưa cài javascript-obfuscator.' -ForegroundColor Red
  Write-Host 'Chạy: npm install -g javascript-obfuscator' -ForegroundColor Yellow
  exit 1
}

Write-Host '==> Obfuscate JavaScript...' -ForegroundColor Cyan
$jsIn  = Join-Path $src  'js'
$jsOut = Join-Path $dist 'js'

# Cấu hình bảo thủ vừa đủ cho ES modules — không phá import/export
javascript-obfuscator $jsIn `
  --output $jsOut `
  --compact true `
  --control-flow-flattening true `
  --control-flow-flattening-threshold 0.5 `
  --dead-code-injection true `
  --dead-code-injection-threshold 0.3 `
  --string-array true `
  --string-array-encoding base64 `
  --string-array-threshold 0.75 `
  --self-defending true `
  --disable-console-output true `
  --rename-globals false `
  --target browser

if ($LASTEXITCODE -ne 0) {
  Write-Host 'Obfuscation thất bại.' -ForegroundColor Red
  exit 1
}

# Tóm tắt kích thước
$srcSize  = (Get-ChildItem $jsIn  -Recurse -File | Measure-Object Length -Sum).Sum
$distSize = (Get-ChildItem $jsOut -Recurse -File | Measure-Object Length -Sum).Sum
$srcKB    = [math]::Round($srcSize  / 1KB, 1)
$distKB   = [math]::Round($distSize / 1KB, 1)

Write-Host ''
Write-Host "==> Xong. JS gốc $srcKB KB → obfuscated $distKB KB" -ForegroundColor Green
Write-Host "Output: $dist" -ForegroundColor Green
Write-Host ''
Write-Host 'Deploy:' -ForegroundColor Yellow
Write-Host '  netlify deploy --dir=dist --prod' -ForegroundColor Yellow
Write-Host '  (hoặc kéo thả thư mục dist vào https://app.netlify.com/drop)' -ForegroundColor Yellow
