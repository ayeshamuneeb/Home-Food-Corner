import React, { useCallback, useEffect, useState } from 'react';
import { Check, ImagePlus, RefreshCw, Sparkles, Upload } from 'lucide-react';
import { Button, Surface } from './ui';

interface GeneratedBrandAssets {
  logoTransparent: string;
  pwa192: string;
  pwa512: string;
  pwaMaskable: string;
  appleTouchIcon: string;
  faviconIco: string;
  ogImage: string;
}

type BgRemovalMode = 'auto_corners' | 'white' | 'black' | 'none';

function dataUrlToUint8(dataUrl: string): Uint8Array {
  const b64 = dataUrl.split(',')[1] || '';
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes;
}

function uint8ToBase64(bytes: Uint8Array): string {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

// Build standard multi-resolution PNG-in-ICO file (16x16, 32x32, 48x48)
function buildIcoFromPngs(frames: { size: number; png: Uint8Array }[]): string {
  const headerSize = 6;
  const entrySize = 16;
  let offset = headerSize + entrySize * frames.length;
  const totalBytes = offset + frames.reduce((acc, f) => acc + f.png.length, 0);
  const buffer = new ArrayBuffer(totalBytes);
  const view = new DataView(buffer);
  const out = new Uint8Array(buffer);

  // ICONDIR header
  view.setUint16(0, 0, true); // reserved
  view.setUint16(2, 1, true); // type = 1 (icon)
  view.setUint16(4, frames.length, true);

  frames.forEach((frame, idx) => {
    const pos = headerSize + idx * entrySize;
    out[pos] = frame.size >= 256 ? 0 : frame.size;
    out[pos + 1] = frame.size >= 256 ? 0 : frame.size;
    out[pos + 2] = 0;
    out[pos + 3] = 0;
    view.setUint16(pos + 4, 1, true); // planes
    view.setUint16(pos + 6, 32, true); // bpp
    view.setUint32(pos + 8, frame.png.length, true);
    view.setUint32(pos + 12, offset, true);
    out.set(frame.png, offset);
    offset += frame.png.length;
  });

  return `data:image/x-icon;base64,${uint8ToBase64(out)}`;
}

// Flood-fill background transparency starting from outer perimeter so inner white/black lettering stays intact
function removeOuterBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  mode: BgRemovalMode,
  tolerance: number
) {
  if (mode === 'none') return;
  const img = ctx.getImageData(0, 0, width, height);
  const data = img.data;

  // Determine target reference RGB
  let refR = 255;
  let refG = 255;
  let refB = 255;

  if (mode === 'black') {
    refR = 0;
    refG = 0;
    refB = 0;
  } else if (mode === 'auto_corners') {
    const corners = [
      0,
      (width - 1) * 4,
      (height - 1) * width * 4,
      ((height - 1) * width + (width - 1)) * 4,
    ];
    let rSum = 0;
    let gSum = 0;
    let bSum = 0;
    let count = 0;
    for (const c of corners) {
      if (data[c + 3] > 200) {
        rSum += data[c];
        gSum += data[c + 1];
        bSum += data[c + 2];
        count += 1;
      }
    }
    if (count === 0) return; // Already transparent corners!
    refR = Math.round(rSum / count);
    refG = Math.round(gSum / count);
    refB = Math.round(bSum / count);
  }

  const maxDist = tolerance * 1.8;
  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;

  const isBg = (pixelIndex: number) => {
    const o = pixelIndex * 4;
    if (data[o + 3] < 20) return true;
    const dr = data[o] - refR;
    const dg = data[o + 1] - refG;
    const db = data[o + 2] - refB;
    return Math.sqrt(dr * dr + dg * dg + db * db) <= maxDist;
  };

  const pushIfBg = (x: number, y: number) => {
    const idx = y * width + x;
    if (visited[idx]) return;
    if (isBg(idx)) {
      visited[idx] = 1;
      queue[tail++] = idx;
    }
  };

  for (let x = 0; x < width; x++) {
    pushIfBg(x, 0);
    pushIfBg(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    pushIfBg(0, y);
    pushIfBg(width - 1, y);
  }

  while (head < tail) {
    const idx = queue[head++];
    const o = idx * 4;
    data[o + 3] = 0;

    const x = idx % width;
    const y = (idx - x) / width;

    if (x > 0) pushIfBg(x - 1, y);
    if (x < width - 1) pushIfBg(x + 1, y);
    if (y > 0) pushIfBg(x, y - 1);
    if (y < height - 1) pushIfBg(x, y + 1);
  }

  ctx.putImageData(img, 0, 0);
}

// Find tight bounding box of non-transparent pixels
function cropCanvasToContent(source: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = source.getContext('2d')!;
  const { width, height } = source;
  const { data } = ctx.getImageData(0, 0, width, height);

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha > 12) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < minX || maxY < minY) return source;

  const cropW = maxX - minX + 1;
  const cropH = maxY - minY + 1;
  const out = document.createElement('canvas');
  out.width = cropW;
  out.height = cropH;
  out.getContext('2d')!.drawImage(source, minX, minY, cropW, cropH, 0, 0, cropW, cropH);
  return out;
}

function renderSquared(
  logo: HTMLCanvasElement,
  size: number,
  options: { background: string | null; safeFillRatio: number; roundedBg?: boolean }
): string {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  if (options.background) {
    if (options.roundedBg) {
      const grad = ctx.createRadialGradient(size * 0.5, size * 0.25, size * 0.05, size * 0.5, size * 0.5, size * 0.72);
      grad.addColorStop(0, '#450A0A');
      grad.addColorStop(1, options.background);
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = options.background;
    }
    ctx.fillRect(0, 0, size, size);
  }

  const maxDim = size * options.safeFillRatio;
  const scale = Math.min(maxDim / logo.width, maxDim / logo.height);
  const drawW = logo.width * scale;
  const drawH = logo.height * scale;
  const dx = (size - drawW) / 2;
  const dy = (size - drawH) / 2;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(logo, dx, dy, drawW, drawH);

  return canvas.toDataURL('image/png');
}

function renderOgCard(
  logo: HTMLCanvasElement,
  brandName: string,
  colors: { green: string; yellow: string; red: string }
): string {
  const W = 1200;
  const H = 630;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // Background Black -> Deep Crimson gradient
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, '#0B0B0B');
  grad.addColorStop(0.6, '#1B0A0A');
  grad.addColorStop(1, '#7F1D1D');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Outer gold frame & left green stripe
  ctx.strokeStyle = colors.yellow;
  ctx.globalAlpha = 0.4;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(26, 26, W - 52, H - 52, 26);
  ctx.stroke();
  ctx.globalAlpha = 1;

  ctx.fillStyle = colors.green;
  ctx.beginPath();
  ctx.roundRect(62, 66, 12, H - 132, 6);
  ctx.fill();

  // Official cropped transparent logo on left
  const maxLogo = 300;
  const scale = Math.min(maxLogo / logo.width, maxLogo / logo.height);
  const dw = logo.width * scale;
  const dh = logo.height * scale;
  ctx.drawImage(logo, 108 + (maxLogo - dw) / 2, (H - dh) / 2, dw, dh);

  // Brand copy on right
  ctx.fillStyle = colors.yellow;
  ctx.font = '700 22px Figtree, system-ui, sans-serif';
  ctx.fillText('FRESH PAKISTANI STREET FOOD · KARACHI', 450, 195);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 62px Figtree, system-ui, sans-serif';
  ctx.fillText(brandName || 'Home Food Corner', 450, 272);

  ctx.fillStyle = '#E5E5E5';
  ctx.font = '500 26px Figtree, system-ui, sans-serif';
  ctx.fillText('Chicken Tikka · Loaded Drum · Pasta · Karak Chai', 450, 336);

  // Brand accent badges (Red, Green, Yellow)
  const badges = [
    { x: 450, w: 205, bg: colors.red, fg: '#FFFFFF', text: 'Order Live Now' },
    { x: 675, w: 215, bg: colors.green, fg: '#FFFFFF', text: 'Loyalty Rewards' },
    { x: 910, w: 205, bg: colors.yellow, fg: '#0B0B0B', text: 'Installable PWA' },
  ];
  for (const b of badges) {
    ctx.fillStyle = b.bg;
    ctx.beginPath();
    ctx.roundRect(b.x, 405, b.w, 56, 12);
    ctx.fill();
    ctx.fillStyle = b.fg;
    ctx.font = '700 20px Figtree, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(b.text, b.x + b.w / 2, 434);
  }

  return canvas.toDataURL('image/png');
}

export const BrandAssetStudio: React.FC<{
  brandName: string;
  primaryGreen: string;
  primaryYellow: string;
  accentRed: string;
  apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>;
  onApplied: () => Promise<void>;
}> = ({ brandName, primaryGreen, primaryYellow, accentRed, apiFetch, onApplied }) => {
  const [sourceUrl, setSourceUrl] = useState<string>('');
  const [bgMode, setBgMode] = useState<BgRemovalMode>('auto_corners');
  const [tolerance, setTolerance] = useState<number>(36);
  const [paddingPct, setPaddingPct] = useState<number>(8);
  const [assets, setAssets] = useState<GeneratedBrandAssets | null>(null);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const processLogo = useCallback(
    async (src: string, mode: BgRemovalMode, tol: number, pad: number) => {
      setErrorMsg('');
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Could not decode uploaded logo image.'));
        img.src = src;
      });

      const work = document.createElement('canvas');
      const maxWork = 640;
      const scale = Math.min(1, maxWork / Math.max(img.width, img.height));
      work.width = Math.max(64, Math.round(img.width * scale));
      work.height = Math.max(64, Math.round(img.height * scale));
      const wCtx = work.getContext('2d')!;
      wCtx.drawImage(img, 0, 0, work.width, work.height);

      removeOuterBackground(wCtx, work.width, work.height, mode, tol);
      const cropped = cropCanvasToContent(work);

      const safeRatio = Math.max(0.65, Math.min(0.98, 1 - (pad * 2) / 100));
      const logoTransparent = renderSquared(cropped, 512, { background: null, safeFillRatio: safeRatio });
      const pwa512 = renderSquared(cropped, 512, { background: null, safeFillRatio: safeRatio });
      const pwa192 = renderSquared(cropped, 192, { background: null, safeFillRatio: safeRatio });
      const pwaMaskable = renderSquared(cropped, 512, {
        background: '#0B0B0B',
        safeFillRatio: 0.7,
        roundedBg: true,
      });
      const appleTouchIcon = renderSquared(cropped, 180, {
        background: '#0B0B0B',
        safeFillRatio: 0.78,
        roundedBg: true,
      });

      const ico16 = dataUrlToUint8(renderSquared(cropped, 16, { background: null, safeFillRatio: 0.94 }));
      const ico32 = dataUrlToUint8(renderSquared(cropped, 32, { background: null, safeFillRatio: 0.94 }));
      const ico48 = dataUrlToUint8(renderSquared(cropped, 48, { background: null, safeFillRatio: 0.94 }));
      const faviconIco = buildIcoFromPngs([
        { size: 48, png: ico48 },
        { size: 32, png: ico32 },
        { size: 16, png: ico16 },
      ]);

      const ogImage = renderOgCard(cropped, brandName, {
        green: primaryGreen,
        yellow: primaryYellow,
        red: accentRed,
      });

      setAssets({
        logoTransparent,
        pwa192,
        pwa512,
        pwaMaskable,
        appleTouchIcon,
        faviconIco,
        ogImage,
      });
    },
    [brandName, primaryGreen, primaryYellow, accentRed]
  );

  useEffect(() => {
    if (!sourceUrl) return;
    void processLogo(sourceUrl, bgMode, tolerance, paddingPct).catch((err: unknown) => {
      setErrorMsg(err instanceof Error ? err.message : 'Logo processing error');
    });
  }, [sourceUrl, bgMode, tolerance, paddingPct, processLogo]);

  const handleFilePick = (file: File | undefined) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('Please upload a logo under 5 MB.');
      return;
    }
    setStatusMsg('');
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setSourceUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const applyBrandSuite = async () => {
    if (!assets) return;
    setSaving(true);
    setStatusMsg('');
    setErrorMsg('');
    try {
      await apiFetch('/api/admin/brand-assets', {
        method: 'POST',
        body: JSON.stringify(assets),
      });
      await onApplied();
      setStatusMsg('Official logo cropped & deployed to Header, Favicon, PWA Icons, Splash & OG Preview!');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to deploy brand assets');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Surface className="p-6 space-y-5 border-gold/30">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
            <Sparkles className="h-4 w-4 text-gold" />
            <span>Official Logo Crop, Transparent &amp; Multi-Size PWA Studio</span>
          </h2>
          <p className="mt-0.5 text-xs text-muted">
            Upload your official logo file (PNG, JPG, WebP, SVG). We auto-crop edges, strip solid background to transparent, and generate 192×192, 512×512, Maskable, Apple Touch Icon, favicon.ico &amp; 1200×630 OG Social Card.
          </p>
        </div>
        <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-control bg-gold px-4 text-xs font-semibold text-gold-foreground hover:brightness-95">
          <Upload className="h-4 w-4" />
          <span>Upload Official Logo</span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            onChange={(e) => handleFilePick(e.target.files?.[0])}
            className="sr-only"
          />
        </label>
      </div>

      {!sourceUrl ? (
        <div className="grid grid-cols-2 gap-3 rounded-card border border-dashed border-border bg-background/60 p-4 sm:grid-cols-5 items-center text-center text-xs text-muted">
          <div className="flex flex-col items-center gap-1.5">
            <img src="/logo-transparent.png" alt="Header logo preview" className="h-12 w-12 object-contain" />
            <span>Header Logo</span>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <img src="/favicon.ico" alt="Favicon preview" className="h-8 w-8 object-contain" />
            <span>favicon.ico</span>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <img src="/pwa-192x192.png" alt="192px icon preview" className="h-12 w-12 object-contain" />
            <span>192×192 PNG</span>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <img src="/apple-touch-icon.png" alt="Apple touch icon" className="h-12 w-12 rounded-xl object-contain" />
            <span>Apple Touch</span>
          </div>
          <div className="col-span-2 sm:col-span-1 flex flex-col items-center gap-1.5">
            <img src="/og-image.png" alt="Social sharing preview" className="h-12 w-24 rounded border border-border object-cover" />
            <span>OG Preview</span>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <label className="flex flex-col gap-1 text-xs font-medium text-foreground">
              <span>Background Removal Mode</span>
              <select
                value={bgMode}
                onChange={(e) => setBgMode(e.target.value as BgRemovalMode)}
                className="min-h-10 rounded-control border border-border bg-background px-3 text-xs text-foreground"
              >
                <option value="auto_corners">Auto-Detect Outer Background</option>
                <option value="white">Strip White Background</option>
                <option value="black">Strip Black Background</option>
                <option value="none">Keep Original Alpha (Crop Only)</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-foreground">
              <span>Edge Tolerance: {tolerance}</span>
              <input
                type="range"
                min={5}
                max={90}
                value={tolerance}
                onChange={(e) => setTolerance(Number(e.target.value))}
                className="accent-primary"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-foreground">
              <span>Crop Margin: {paddingPct}%</span>
              <input
                type="range"
                min={2}
                max={20}
                value={paddingPct}
                onChange={(e) => setPaddingPct(Number(e.target.value))}
                className="accent-primary"
              />
            </label>
          </div>

          {assets ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
                <div className="rounded-control border border-border bg-[repeating-conic-gradient(#1f1f1f_0%_25%,#141414_0%_50%)] bg-[length:14px_14px] p-3 text-center">
                  <img src={assets.logoTransparent} alt="Transparent logo" className="mx-auto h-14 w-14 object-contain" />
                  <p className="mt-1.5 text-[11px] text-foreground">Transparent</p>
                </div>
                <div className="rounded-control border border-border bg-background p-3 text-center">
                  <img src={assets.pwa192} alt="192x192" className="mx-auto h-14 w-14 object-contain" />
                  <p className="mt-1.5 text-[11px] text-muted">192×192</p>
                </div>
                <div className="rounded-control border border-border bg-background p-3 text-center">
                  <img src={assets.pwa512} alt="512x512" className="mx-auto h-14 w-14 object-contain" />
                  <p className="mt-1.5 text-[11px] text-muted">512×512</p>
                </div>
                <div className="rounded-control border border-border bg-background p-3 text-center">
                  <img src={assets.pwaMaskable} alt="Maskable" className="mx-auto h-14 w-14 rounded-full object-cover" />
                  <p className="mt-1.5 text-[11px] text-muted">Maskable</p>
                </div>
                <div className="rounded-control border border-border bg-background p-3 text-center">
                  <img src={assets.appleTouchIcon} alt="Apple icon" className="mx-auto h-14 w-14 rounded-xl object-cover" />
                  <p className="mt-1.5 text-[11px] text-muted">Apple 180px</p>
                </div>
                <div className="rounded-control border border-border bg-background p-3 text-center">
                  <img src={assets.faviconIco} alt="Favicon ICO" className="mx-auto h-10 w-10 mt-2 object-contain" />
                  <p className="mt-3 text-[11px] text-muted">favicon.ico</p>
                </div>
              </div>

              <div className="rounded-control border border-border bg-background p-3">
                <p className="mb-2 text-xs font-medium text-muted">Social Sharing Preview (og-image · 1200×630)</p>
                <img
                  src={assets.ogImage}
                  alt="Generated OG Social Card"
                  className="w-full max-w-lg rounded border border-border object-cover"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button tone="primary" disabled={saving} onClick={() => void applyBrandSuite()}>
                  {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  <span>{saving ? 'Deploying Brand Kit…' : 'Apply Official Logo Across App, PWA & SEO'}</span>
                </Button>
                <Button
                  tone="quiet"
                  onClick={() => {
                    setSourceUrl('');
                    setAssets(null);
                  }}
                >
                  <ImagePlus className="h-4 w-4" />
                  <span>Choose Different File</span>
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {errorMsg ? <p role="alert" className="text-xs font-medium text-spicy">{errorMsg}</p> : null}
      {statusMsg ? <p className="text-xs font-medium text-primary">{statusMsg}</p> : null}
    </Surface>
  );
};
