param(
  [string]$DocumentPath = (Join-Path $PSScriptRoot '..\..\RPG SISTEMA.docx')
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression

function Import-DotEnv([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path)) { return }
  foreach ($line in Get-Content -LiteralPath $Path) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith('#')) { continue }
    $index = $trimmed.IndexOf('=')
    if ($index -lt 1) { continue }
    $name = $trimmed.Substring(0, $index).Trim()
    if (-not [Environment]::GetEnvironmentVariable($name)) {
      [Environment]::SetEnvironmentVariable($name, $trimmed.Substring($index + 1).Trim())
    }
  }
}

function Normalize-Name([string]$Value) {
  $normalized = $Value.Normalize([Text.NormalizationForm]::FormD)
  return (($normalized.ToCharArray() | Where-Object {
    [Globalization.CharUnicodeInfo]::GetUnicodeCategory($_) -ne [Globalization.UnicodeCategory]::NonSpacingMark
  }) -join '').ToLowerInvariant().Trim()
}

function Get-Paragraphs([string]$Path) {
  $resolved = (Resolve-Path -LiteralPath $Path).Path
  $stream = [IO.File]::Open($resolved, 'Open', 'Read', 'ReadWrite')
  try {
    $archive = [IO.Compression.ZipArchive]::new($stream, 'Read')
    $reader = [IO.StreamReader]::new($archive.GetEntry('word/document.xml').Open())
    try { [xml]$xml = $reader.ReadToEnd() } finally { $reader.Dispose() }
    $namespace = [Xml.XmlNamespaceManager]::new($xml.NameTable)
    $namespace.AddNamespace('w', 'http://schemas.openxmlformats.org/wordprocessingml/2006/main')
    $result = [Collections.Generic.List[string]]::new()
    foreach ($paragraph in $xml.SelectNodes('//w:body/w:p | //w:body/w:tbl/w:tr/w:tc/w:p', $namespace)) {
      $text = ($paragraph.SelectNodes('.//w:t', $namespace) | ForEach-Object { $_.InnerText }) -join ''
      if (-not [string]::IsNullOrWhiteSpace($text)) { $result.Add($text.Trim()) }
    }
    return $result.ToArray()
  } finally {
    if ($archive) { $archive.Dispose() }
    $stream.Dispose()
  }
}

function Find-Line([string[]]$Lines, [string]$Name, [int]$StartAt = 0) {
  $target = Normalize-Name $Name
  for ($index = $StartAt; $index -lt $Lines.Count; $index++) {
    if ((Normalize-Name $Lines[$index]) -eq $target) { return $index }
  }
  throw "Seção não encontrada no documento: $Name"
}

function Section-Description([string]$Name, [string[]]$Lines) {
  $body = ($Lines | Select-Object -Skip 1 | ForEach-Object { $_.Trim() } | Where-Object { $_ }) -join "`n"
  return "# $Name`n`n$body"
}

function Upsert-Entry([string]$Category, [string]$Name, [string]$Description) {
  $payload = @{
    category = $Category
    name = $Name
    description = $Description
    labels = @(@{
      id = "label_$((Normalize-Name $Category) -replace '[^a-z0-9]+', '_')"
      name = $Category
      color = if ($Category -eq 'Classes') { 'blue' } else { 'purple' }
    })
  } | ConvertTo-Json -Depth 20 -Compress
  $script = Join-Path $PSScriptRoot 'upsert-catalog-entry.js'
  $payload | & node $script
  if ($LASTEXITCODE -ne 0) { throw "Falha ao sincronizar $Name no Postgres." }
}

Import-DotEnv (Join-Path $PSScriptRoot '..\.env')
if (-not $env:DATABASE_URL -and -not $env:POSTGRES_URL) {
  throw 'DATABASE_URL precisa estar configurada.'
}

$lines = Get-Paragraphs $DocumentPath

$sections = @(
  @{ Source = 'Bárbaro'; Card = 'Bárbaro' },
  @{ Source = 'Mago'; Card = 'Mago' },
  @{ Source = 'Arqueiro Espectral (Subclasse de Ranger)'; Card = 'Arqueiro Espectral' },
  @{ Source = 'Maestro Tático (Subclasse de Bardo)'; Card = 'Maestro Tático' },
  @{ Source = 'CLÉRIGO'; Card = 'Clérigo' },
  @{ Source = 'PALADINO'; Card = 'Paladino' },
  @{ Source = 'LADINO'; Card = 'Ladino' },
  @{ Source = 'RANGER'; Card = 'Ranger' },
  @{ Source = 'BARDO'; Card = 'Bardo' },
  @{ Source = 'LUTADOR'; Card = 'Lutador' }
)

for ($index = 0; $index -lt $sections.Count; $index++) {
  $start = Find-Line $lines $sections[$index].Source
  $end = if ($index -lt $sections.Count - 1) { Find-Line $lines $sections[$index + 1].Source ($start + 1) } else { Find-Line $lines 'Raças' ($start + 1) }
  $slice = $lines[$start..($end - 1)]
  Upsert-Entry 'Classes' $sections[$index].Card (Section-Description $sections[$index].Card $slice)
}

$corruptionStart = Find-Line $lines 'MAGIA DEMONÍACA'
$corruptionEnd = Find-Line $lines 'Classes' ($corruptionStart + 1)
$corruptionLines = $lines[$corruptionStart..($corruptionEnd - 1)]
Upsert-Entry 'Sistema' 'Corrupção e Magia Demoníaca' (Section-Description 'Corrupção e Magia Demoníaca' $corruptionLines)

Write-Host 'Textos do documento sincronizados. Execute npm run sync:rules para publicar os metadados calculáveis.'
