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

function Invoke-Trello([string]$Method, [string]$Path, [hashtable]$Body = @{}) {
  $uri = "https://api.trello.com$Path"
  $separator = if ($uri.Contains('?')) { '&' } else { '?' }
  $uri = "$uri${separator}key=$([Uri]::EscapeDataString($env:TRELLO_API_KEY))&token=$([Uri]::EscapeDataString($env:TRELLO_TOKEN))"
  if ($Method -eq 'GET') {
    if ($Body.Count) {
      $query = ($Body.GetEnumerator() | ForEach-Object {
        "$([Uri]::EscapeDataString($_.Key))=$([Uri]::EscapeDataString([string]$_.Value))"
      }) -join '&'
      $uri = "$uri&$query"
    }
    return Invoke-RestMethod -Method Get -Uri $uri
  }
  return Invoke-RestMethod -Method $Method -Uri $uri -ContentType 'application/json; charset=utf-8' -Body ($Body | ConvertTo-Json -Depth 30 -Compress)
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

function Upsert-Card($List, [string]$Name, [string]$Description) {
  if ($Description.Length -gt 16000) { throw "Descrição de $Name excede o limite seguro do Trello." }
  $cards = Invoke-Trello GET "/1/lists/$($List.id)/cards" @{ fields = 'name,desc,closed'; limit = 1000 }
  $card = $cards | Where-Object { -not $_.closed -and (Normalize-Name $_.name) -eq (Normalize-Name $Name) } | Select-Object -First 1
  $metadata = if ($card -and $card.desc -match '(?s)<!-- RPG_RULES_JSON_START -->.*?<!-- RPG_RULES_JSON_END -->') { $Matches[0] } else { '' }
  $complete = if ($metadata) { "$Description`n`n---`nMetadados usados automaticamente pelos aplicativos.`n$metadata" } else { $Description }
  if ($card) {
    Invoke-Trello PUT "/1/cards/$($card.id)" @{ name = $Name; desc = $complete } | Out-Null
    Write-Host "Atualizado: $Name"
  } else {
    Invoke-Trello POST '/1/cards' @{ idList = $List.id; name = $Name; desc = $complete } | Out-Null
    Write-Host "Criado: $Name"
  }
}

Import-DotEnv (Join-Path $PSScriptRoot '..\.env')
if (-not $env:TRELLO_API_KEY -or -not $env:TRELLO_TOKEN -or -not $env:TRELLO_BOARD_ID) {
  throw 'TRELLO_API_KEY, TRELLO_TOKEN e TRELLO_BOARD_ID precisam estar configurados.'
}

$lines = Get-Paragraphs $DocumentPath
$lists = Invoke-Trello GET "/1/boards/$($env:TRELLO_BOARD_ID)/lists" @{ fields = 'name,closed' }
$classList = $lists | Where-Object { -not $_.closed -and (Normalize-Name $_.name) -eq 'classes' } | Select-Object -First 1
$systemList = $lists | Where-Object { -not $_.closed -and (Normalize-Name $_.name) -eq 'sistema' } | Select-Object -First 1
if (-not $classList -or -not $systemList) { throw 'As listas Classes e Sistema precisam existir no quadro.' }

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
  Upsert-Card $classList $sections[$index].Card (Section-Description $sections[$index].Card $slice)
}

$corruptionStart = Find-Line $lines 'MAGIA DEMONÍACA'
$corruptionEnd = Find-Line $lines 'Classes' ($corruptionStart + 1)
$corruptionLines = $lines[$corruptionStart..($corruptionEnd - 1)]
Upsert-Card $systemList 'Corrupção e Magia Demoníaca' (Section-Description 'Corrupção e Magia Demoníaca' $corruptionLines)

Write-Host 'Textos do documento sincronizados. Execute npm run sync:rules para publicar os metadados calculáveis.'
