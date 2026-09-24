Add-Type -AssemblyName System.Drawing

function Generate-IconPng([int]$size, [string]$outputPath) {
    $bmp = New-Object System.Drawing.Bitmap $size, $size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)

    # Rounded rectangle background
    $padding = [float]($size * 0.04)
    $boxSize = [float]($size - $padding * 2)
    $radius = [float]($boxSize * 0.28)

    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddArc($padding, $padding, $radius * 2, $radius * 2, 180, 90)
    $path.AddArc($padding + $boxSize - $radius * 2, $padding, $radius * 2, $radius * 2, 270, 90)
    $path.AddArc($padding + $boxSize - $radius * 2, $padding + $boxSize - $radius * 2, $radius * 2, $radius * 2, 0, 90)
    $path.AddArc($padding, $padding + $boxSize - $radius * 2, $radius * 2, $radius * 2, 90, 90)
    $path.CloseFigure()

    $bgBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 0x1a, 0x68, 0xff))
    $g.FillPath($bgBrush, $path)

    # 8-pointed starburst / asterisk lines
    $pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::White), ([float]($size * 0.08))
    $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round

    $cx = [float]($size / 2)
    $cy = [float]($size / 2)
    $rayLen = [float]($boxSize * 0.27)

    for ($i = 0; $i -lt 4; $i++) {
        $angle = $i * ([Math]::PI / 4)
        $dx = [float]($rayLen * [Math]::Cos($angle))
        $dy = [float]($rayLen * [Math]::Sin($angle))
        $g.DrawLine($pen, $cx - $dx, $cy - $dy, $cx + $dx, $cy + $dy)
    }

    $g.Dispose()
    $pen.Dispose()
    $bgBrush.Dispose()
    $path.Dispose()

    $bmp.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    return $bmp
}

$buildDir = Join-Path $PSScriptRoot "..\build"
if (!(Test-Path $buildDir)) {
    New-Item -ItemType Directory -Path $buildDir | Out-Null
}

$icon512Path = Join-Path $buildDir "icon.png"
$bmp512 = Generate-IconPng 512 $icon512Path
Write-Output "Created $icon512Path"

# Now build multi-resolution .ico containing 16, 32, 48, 64, 128, 256
$sizes = @(16, 32, 48, 64, 128, 256)
$pngBytesList = @()

foreach ($s in $sizes) {
    $tempBmp = New-Object System.Drawing.Bitmap $s, $s, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($tempBmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.DrawImage($bmp512, 0, 0, $s, $s)
    $g.Dispose()

    $ms = New-Object System.IO.MemoryStream
    $tempBmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    $tempBmp.Dispose()
    $pngBytesList += ,$ms.ToArray()
    $ms.Dispose()
}

$bmp512.Dispose()

# Write ICO binary
$icoPath = Join-Path $buildDir "icon.ico"
$fs = [System.IO.File]::Create($icoPath)
$bw = New-Object System.IO.BinaryWriter $fs

# ICONDIR header: 2 bytes reserved (0), 2 bytes type (1 for ICO), 2 bytes count
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
    $bw.Write([byte]0) # colors
    $bw.Write([byte]0) # reserved
    $bw.Write([UInt16]1) # color planes
    $bw.Write([UInt16]32) # bits per pixel
    $bw.Write([UInt32]$bytes.Length) # image data size
    $bw.Write([UInt32]$offset) # image data offset
    $offset += $bytes.Length
}

for ($i = 0; $i -lt $sizes.Count; $i++) {
    $bw.Write($pngBytesList[$i])
}

$bw.Flush()
$bw.Close()
$fs.Close()
Write-Output "Created $icoPath"
