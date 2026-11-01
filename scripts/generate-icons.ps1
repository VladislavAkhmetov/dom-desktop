Add-Type -AssemblyName System.Drawing

$sourcePath = Join-Path $PSScriptRoot "..\assets\icon-source.png"
$buildDir = Join-Path $PSScriptRoot "..\build"
$publicDir = Join-Path $PSScriptRoot "..\public"

if (!(Test-Path $buildDir)) {
    New-Item -ItemType Directory -Path $buildDir | Out-Null
}

function Resize-Bitmap($source, [int]$w, [int]$h) {
    $dest = New-Object System.Drawing.Bitmap $w, $h, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($dest)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)
    $g.DrawImage($source, 0, 0, $w, $h)
    $g.Dispose()
    return $dest
}

function Write-IcoFile([string]$outPath, $sizes, $pngBytesList) {
    $fs = [System.IO.File]::Create($outPath)
    $bw = New-Object System.IO.BinaryWriter $fs

    $bw.Write([UInt16]0)
    $bw.Write([UInt16]1)
    $bw.Write([UInt16]$sizes.Count)

    $offset = 6 + ($sizes.Count * 16)

    for ($i = 0; $i -lt $sizes.Count; $i++) {
        $s = $sizes[$i]
        $w = if ($s -ge 256) { [byte]0 } else { [byte]$s }
        $h = if ($s -ge 256) { [byte]0 } else { [byte]$s }
        $bytes = $pngBytesList[$i]
        $bw.Write([byte]$w)
        $bw.Write([byte]$h)
        $bw.Write([byte]0)
        $bw.Write([byte]0)
        $bw.Write([UInt16]1)
        $bw.Write([UInt16]32)
        $bw.Write([UInt32]$bytes.Length)
        $bw.Write([UInt32]$offset)
        $offset += $bytes.Length
    }

    for ($i = 0; $i -lt $sizes.Count; $i++) {
        $bw.Write($pngBytesList[$i])
    }

    $bw.Flush()
    $bw.Close()
    $fs.Close()
}

if (Test-Path $sourcePath) {
    $srcImg = [System.Drawing.Image]::FromFile($sourcePath)

    # 512x512 for build and public
    $bmp512 = Resize-Bitmap $srcImg 512 512
    $icon512Path = Join-Path $buildDir "icon.png"
    $publicIconPath = Join-Path $publicDir "icon.png"
    $bmp512.Save($icon512Path, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp512.Save($publicIconPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp512.Dispose()

    # 64x64 tray icon
    $trayBmp = Resize-Bitmap $srcImg 64 64
    $trayBmp.Save((Join-Path $publicDir "tray.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    $trayBmp.Dispose()

    # Multi-resolution ICO
    $sizes = @(16, 32, 48, 64, 128, 256)
    $pngBytesList = @()

    foreach ($s in $sizes) {
        $tempBmp = Resize-Bitmap $srcImg $s $s
        $ms = New-Object System.IO.MemoryStream
        $tempBmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
        $tempBmp.Dispose()
        $pngBytesList += ,$ms.ToArray()
        $ms.Dispose()
    }

    $srcImg.Dispose()

    Write-IcoFile (Join-Path $buildDir "icon.ico") $sizes $pngBytesList
    Write-IcoFile (Join-Path $publicDir "icon.ico") $sizes $pngBytesList

    Write-Output "Generated icon.ico and icon.png from $sourcePath"
}
