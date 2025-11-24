import { CompositorRequest, CompositorResponse, CompositorPhotoLayer, CompositorStickerLayer, CompositorTextLayer, CompositorDrawingPath } from '../types';

// Image cache inside worker
const imageCache = new Map<string, HTMLImageElement>();

function loadImage(src: string): Promise<HTMLImageElement> {
  if (imageCache.has(src)) return Promise.resolve(imageCache.get(src)!);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => { imageCache.set(src, img); resolve(img); };
    img.onerror = reject;
    img.src = src;
  });
}

async function renderComposite(msg: CompositorRequest): Promise<CompositorResponse> {
  const start = performance.now();
  // Use OffscreenCanvas if available else fallback
  const canvas: HTMLCanvasElement | OffscreenCanvas = ('OffscreenCanvas' in self)
    ? new OffscreenCanvas(msg.width, msg.height)
    : (() => { const c = (self as any).document?.createElement?.('canvas') || new HTMLCanvasElement(); c.width = msg.width; c.height = msg.height; return c; })();
  // @ts-ignore
  const ctx = canvas.getContext('2d');
  if (!ctx) return { type: 'RESULT', dataUrl: '', renderMs: 0 };

  ctx.clearRect(0, 0, msg.width, msg.height);
  ctx.fillStyle = '#111827';
  ctx.fillRect(0, 0, msg.width, msg.height);

  if (msg.filter) ctx.filter = msg.filter;

  // Photos
  for (const p of msg.photos) {
    try {
      const img = await loadImage(p.src);
      const x = p.transform.x * msg.width;
      const y = p.transform.y * msg.height;
      let w = p.transform.width * msg.width * msg.globalPhotoScale;
      let h = p.transform.height * msg.height * msg.globalPhotoScale;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(p.transform.rotation * Math.PI / 180);
      ctx.beginPath();
      ctx.rect(-w / 2, -h / 2, w, h);
      ctx.clip();

      const crop = p.crop;
      const aspect = p.originalWidth / p.originalHeight;
      let dw = w, dh = h;
      const fitMode = p.fit || 'cover';
      if (fitMode === 'cover') {
        if (aspect > w / h) { dh = h; dw = dh * aspect; } else { dw = w; dh = dw / aspect; }
      } else { // contain
        if (aspect > w / h) { dw = w; dh = dw / aspect; } else { dh = h; dw = dh * aspect; }
      }
      dw *= crop.scale; dh *= crop.scale;
      ctx.drawImage(img, -dw / 2 + crop.x, -dh / 2 + crop.y, dw, dh);
      ctx.restore();
    } catch { /* ignore individual photo errors */ }
  }

  ctx.filter = 'none';

  // Frame overlay
  if (msg.frameSrc) {
    try {
      const frameImg = await loadImage(msg.frameSrc);
      ctx.save();
      ctx.globalAlpha = msg.frameOpacity;
      ctx.drawImage(frameImg, 0, 0, msg.width, msg.height);
      ctx.restore();
    } catch { /* ignore */ }
  }

  // Drawings
  for (const d of msg.drawings) {
    if (d.points.length < 2) continue;
    ctx.beginPath();
    ctx.strokeStyle = d.color;
    ctx.lineWidth = d.width * msg.height;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.moveTo(d.points[0].x * msg.width, d.points[0].y * msg.height);
    for (let i = 1; i < d.points.length; i++) ctx.lineTo(d.points[i].x * msg.width, d.points[i].y * msg.height);
    ctx.stroke();
  }

  // Stickers
  for (const s of msg.stickers) {
    try {
      const img = await loadImage(s.src);
      const x = s.x * msg.width;
      const y = s.y * msg.height;
      const w = s.width * msg.width;
      const h = s.height * msg.height;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(s.rotation * Math.PI / 180);
      ctx.drawImage(img, -w / 2, -h / 2, w, h);
      ctx.restore();
    } catch { }
  }

  // Text layers
  for (const t of msg.textLayers) {
    const x = t.x * msg.width;
    const y = t.y * msg.height;
    const fontSize = t.fontSize * msg.height;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(t.rotation * Math.PI / 180);
    ctx.font = `${t.fontWeight} ${fontSize}px ${t.fontFamily}`;
    ctx.fillStyle = t.color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(t.text, 0, 0);
    ctx.restore();
  }

  let dataUrl = '';
  if ('convertToBlob' in canvas) {
    // OffscreenCanvas path
    // @ts-ignore
    const blob = await canvas.convertToBlob({ type: 'image/png' });
    dataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } else {
    dataUrl = (canvas as HTMLCanvasElement).toDataURL('image/png');
  }

  const end = performance.now();
  return { type: 'RESULT', dataUrl, renderMs: Math.round(end - start) };
}

self.addEventListener('message', async (ev: MessageEvent<CompositorRequest>) => {
  if (ev.data?.type === 'COMPOSITE') {
    const result = await renderComposite(ev.data);
    // Post back result (dataUrl)
    (self as any).postMessage(result);
  }
});
