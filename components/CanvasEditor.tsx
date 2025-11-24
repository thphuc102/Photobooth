
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Photo, Transform, StickerLayer, TextLayer, DrawingPath } from '../types';

interface CanvasEditorProps {
    frameSrc: string | null;
    photos: Photo[];
    stickers: StickerLayer[];
    textLayers: TextLayer[];
    drawings: DrawingPath[]; // New prop
    filter: string; // New prop
    canvasRef: React.RefObject<HTMLCanvasElement>;
    frameOpacity: number;
    selectedLayerType: 'photo' | 'sticker' | 'text' | 'drawing';
    selectedLayerIndex: number;
    onSelectLayer: (type: 'photo' | 'sticker' | 'text', index: number) => void;
    onPhotoUpdate: (index: number, updates: Partial<Photo>) => void;
    onStickerUpdate: (index: number, updates: Partial<StickerLayer>) => void;
    onTextUpdate: (index: number, updates: Partial<TextLayer>) => void;
    onReorderPhoto: (index: number, direction: 'forward' | 'backward') => void;
    // Drawing Callbacks
    onDrawStart?: () => void;
    onDrawPoint?: (point: { x: number, y: number }) => void;
    onDrawEnd?: () => void;
    isDrawingMode?: boolean;
    drawingColor?: string;
    drawingSize?: number;

    globalPhotoScale: number;
    aspectRatio?: string;
    activeGuestLayoutPlaceholders?: { id: number; x: number; y: number; width: number; height: number; }[];
    onMetrics?: (m: { fps: number; frameMs: number }) => void;
}

type InteractionMode = 'idle' | 'crop_panning' | 'rotating' | 'moving_layer' | 'scaling_layer' | 'drawing';
const ROTATION_HANDLE_OFFSET = 25;
const ROTATION_HANDLE_SIZE = 8;
const SCALE_HANDLE_SIZE = 8;

const CanvasEditor: React.FC<CanvasEditorProps> = ({
    frameSrc,
    photos,
    stickers,
    textLayers,
    drawings,
    filter,
    canvasRef,
    frameOpacity,
    selectedLayerType,
    selectedLayerIndex,
    onSelectLayer,
    onPhotoUpdate,
    onStickerUpdate,
    onTextUpdate,
    onReorderPhoto,
    onDrawStart,
    onDrawPoint,
    onDrawEnd,
    isDrawingMode,
    drawingColor = '#ff0000',
    drawingSize = 0.005,
    globalPhotoScale,
    aspectRatio = '2 / 3',
    activeGuestLayoutPlaceholders,
    onMetrics
}) => {
    const [loadedImages, setLoadedImages] = useState<Map<string, HTMLImageElement>>(new Map());
    const interaction = useRef({ mode: 'idle' as InteractionMode, startX: 0, startY: 0, startVal: null as any, startAngle: 0 });
    const containerRef = useRef<HTMLDivElement>(null);
    const [cursor, setCursor] = useState('default');
    const [frameImage, setFrameImage] = useState<HTMLImageElement | null>(null);

    const transientPhotos = useRef<Photo[]>(photos);
    const transientStickers = useRef<StickerLayer[]>(stickers);
    const transientText = useRef<TextLayer[]>(textLayers);
    // Drawing is handled via parent updates for now to keep sync simple, but could be optimized

    useEffect(() => { if (interaction.current.mode === 'idle') transientPhotos.current = photos; }, [photos, interaction.current.mode]);
    useEffect(() => { if (interaction.current.mode === 'idle') transientStickers.current = stickers; }, [stickers, interaction.current.mode]);
    useEffect(() => { if (interaction.current.mode === 'idle') transientText.current = textLayers; }, [textLayers, interaction.current.mode]);

    useEffect(() => {
        if (frameSrc) {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => setFrameImage(img);
            img.src = frameSrc;
        }
    }, [frameSrc]);

    useEffect(() => {
        // Load photos
        photos.forEach(p => {
            if (!p.src || loadedImages.has(p.src)) return;
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => setLoadedImages(prev => new Map([...prev, [p.src, img]]));
            img.src = p.src;
        });
        // Load stickers
        stickers.forEach(s => {
            if (!s.src || loadedImages.has(s.src)) return;
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => setLoadedImages(prev => new Map([...prev, [s.src, img]]));
            img.src = s.src;
        });
    }, [photos, stickers, loadedImages]);

    const toAbsolute = (transform: Transform, canvas: HTMLCanvasElement) => ({
        x: transform.x * canvas.width,
        y: transform.y * canvas.height,
        width: transform.width * canvas.width,
        height: transform.height * canvas.height,
    });

    const lastFrameTimeRef = useRef<number>(performance.now());
    const fpsAccumRef = useRef<{ frames: number; lastReport: number }>({ frames: 0, lastReport: performance.now() });

    const draw = useCallback(() => {
        const frameStart = performance.now();
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;

        const style = getComputedStyle(document.documentElement);
        const panelColor = style.getPropertyValue('--color-panel').trim();
        const primaryColor = style.getPropertyValue('--color-primary').trim();
        const primaryRgb = style.getPropertyValue('--color-primary-rgb').trim();

        ctx.fillStyle = panelColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Apply Global Filter
        if (filter) ctx.filter = filter;

        // 1. Draw Photos
        transientPhotos.current.forEach((photo) => {
            const img = loadedImages.get(photo.src);
            if (!img) return;

            const { x, y } = toAbsolute(photo.transform, canvas);
            let { width, height } = toAbsolute(photo.transform, canvas);
            width *= globalPhotoScale;
            height *= globalPhotoScale;

            const angle = photo.transform.rotation * Math.PI / 180;

            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(angle);
            ctx.beginPath();
            ctx.rect(-width / 2, -height / 2, width, height);
            ctx.clip();

            const { crop } = photo;
            const imgAspectRatio = photo.originalWidth / photo.originalHeight;
            let displayWidth = width, displayHeight = height;
            const fitMode = photo.fit || 'cover';

            if (fitMode === 'cover') {
                if (imgAspectRatio > width / height) { displayHeight = height; displayWidth = displayHeight * imgAspectRatio; }
                else { displayWidth = width; displayHeight = displayWidth / imgAspectRatio; }
            } else {
                if (imgAspectRatio > width / height) { displayWidth = width; displayHeight = displayWidth / imgAspectRatio; }
                else { displayHeight = height; displayWidth = displayHeight * imgAspectRatio; }
            }

            displayWidth *= crop.scale;
            displayHeight *= crop.scale;
            ctx.drawImage(img, -displayWidth / 2 + crop.x, -displayHeight / 2 + crop.y, displayWidth, displayHeight);
            ctx.restore();
        });

        // Reset filter for UI elements
        ctx.filter = 'none';

        // 2. Draw Frame
        if (frameImage) {
            ctx.globalAlpha = frameOpacity;
            ctx.drawImage(frameImage, 0, 0, canvas.width, canvas.height);
            ctx.globalAlpha = 1.0;
        }

        // 3. Draw Drawings
        drawings.forEach(d => {
            if (d.points.length < 2) return;
            ctx.beginPath();
            ctx.strokeStyle = d.color;
            ctx.lineWidth = d.width * canvas.height;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.moveTo(d.points[0].x * canvas.width, d.points[0].y * canvas.height);
            for (let i = 1; i < d.points.length; i++) {
                ctx.lineTo(d.points[i].x * canvas.width, d.points[i].y * canvas.height);
            }
            ctx.stroke();
        });

        // 4. Draw Stickers
        transientStickers.current.forEach(sticker => {
            const img = loadedImages.get(sticker.src);
            if (!img) return;
            const x = sticker.x * canvas.width;
            const y = sticker.y * canvas.height;
            const w = sticker.width * canvas.width;
            const h = sticker.height * canvas.height;

            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(sticker.rotation * Math.PI / 180);
            ctx.drawImage(img, -w / 2, -h / 2, w, h);
            ctx.restore();
        });

        // 5. Draw Text
        transientText.current.forEach(text => {
            const x = text.x * canvas.width;
            const y = text.y * canvas.height;
            const fontSize = text.fontSize * canvas.height;

            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(text.rotation * Math.PI / 180);
            ctx.font = `${text.fontWeight} ${fontSize}px ${text.fontFamily}`;
            ctx.fillStyle = text.color;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(text.text, 0, 0);
            ctx.restore();
        });

        // 6. Highlight Active Guest Layout placeholders (outline only)
        if (activeGuestLayoutPlaceholders && activeGuestLayoutPlaceholders.length > 0) {
            ctx.save();
            ctx.lineWidth = 2;
            ctx.strokeStyle = 'rgba(255,255,255,0.35)';
            activeGuestLayoutPlaceholders.forEach(p => {
                const x = p.x * canvas.width;
                const y = p.y * canvas.height;
                const w = p.width * canvas.width;
                const h = p.height * canvas.height;
                ctx.strokeRect(x, y, w, h);
            });
            ctx.restore();
        }

        // 7. Draw Selection Overlays (if not drawing)
        if (!isDrawingMode) {
            const dpr = window.devicePixelRatio || 1;

            // Photo Selection
            if (selectedLayerType === 'photo' && selectedLayerIndex !== -1 && transientPhotos.current[selectedLayerIndex]) {
                const photo = transientPhotos.current[selectedLayerIndex];
                const { x, y } = toAbsolute(photo.transform, canvas);
                let { width, height } = toAbsolute(photo.transform, canvas);
                width *= globalPhotoScale;
                height *= globalPhotoScale;
                const angle = photo.transform.rotation * Math.PI / 180;

                ctx.save();
                ctx.translate(x, y);
                ctx.rotate(angle);
                ctx.strokeStyle = `rgba(${primaryRgb}, 0.9)`;
                ctx.lineWidth = 2 * dpr;
                ctx.strokeRect(-width / 2, -height / 2, width, height);

                const handleY = -height / 2 - (ROTATION_HANDLE_OFFSET * dpr);
                ctx.beginPath();
                ctx.moveTo(0, -height / 2);
                ctx.lineTo(0, handleY);
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
                ctx.lineWidth = 1.5 * dpr;
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(0, handleY, ROTATION_HANDLE_SIZE * dpr, 0, Math.PI * 2);
                ctx.fillStyle = primaryColor;
                ctx.fill();
                ctx.restore();
            }

            // Sticker/Text Selection
            if (selectedLayerType !== 'photo' && selectedLayerIndex !== -1) {
                let x = 0, y = 0, w = 0, h = 0, rotation = 0;

                if (selectedLayerType === 'sticker' && transientStickers.current[selectedLayerIndex]) {
                    const s = transientStickers.current[selectedLayerIndex];
                    x = s.x * canvas.width;
                    y = s.y * canvas.height;
                    w = s.width * canvas.width;
                    h = s.height * canvas.height;
                    rotation = s.rotation;
                } else if (selectedLayerType === 'text' && transientText.current[selectedLayerIndex]) {
                    const t = transientText.current[selectedLayerIndex];
                    x = t.x * canvas.width;
                    y = t.y * canvas.height;
                    const fontSize = t.fontSize * canvas.height;
                    ctx.font = `${t.fontWeight} ${fontSize}px ${t.fontFamily}`;
                    const metrics = ctx.measureText(t.text);
                    w = metrics.width;
                    h = fontSize; // Approx height
                    rotation = t.rotation;
                }

                if (w > 0) {
                    ctx.save();
                    ctx.translate(x, y);
                    ctx.rotate(rotation * Math.PI / 180);
                    ctx.strokeStyle = `rgba(${primaryRgb}, 0.9)`;
                    ctx.lineWidth = 2 * dpr;
                    ctx.setLineDash([5, 5]);
                    ctx.strokeRect(-w / 2 - 5, -h / 2 - 5, w + 10, h + 10);
                    ctx.setLineDash([]);

                    const handleY = -h / 2 - 5 - (ROTATION_HANDLE_OFFSET * dpr);
                    ctx.beginPath();
                    ctx.moveTo(0, -h / 2 - 5);
                    ctx.lineTo(0, handleY);
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.arc(0, handleY, ROTATION_HANDLE_SIZE * dpr, 0, Math.PI * 2);
                    ctx.fillStyle = primaryColor;
                    ctx.fill();

                    if (selectedLayerType === 'sticker' || selectedLayerType === 'text') {
                        ctx.beginPath();
                        ctx.arc(w / 2 + 5, h / 2 + 5, SCALE_HANDLE_SIZE * dpr, 0, Math.PI * 2);
                        ctx.fillStyle = 'white';
                        ctx.strokeStyle = `rgba(${primaryRgb}, 1)`;
                        ctx.fill();
                        ctx.stroke();
                    }
                    ctx.restore();
                }
            }
        }

        const frameEnd = performance.now();
        const frameMs = frameEnd - frameStart;
        fpsAccumRef.current.frames++;
        const now = frameEnd;
        if (now - fpsAccumRef.current.lastReport >= 1000) {
            const fps = (fpsAccumRef.current.frames * 1000) / (now - fpsAccumRef.current.lastReport);
            if (onMetrics) onMetrics({ fps: Math.round(fps), frameMs: parseFloat(frameMs.toFixed(2)) });
            fpsAccumRef.current.frames = 0;
            fpsAccumRef.current.lastReport = now;
        } else if (onMetrics) {
            // lightweight update of frame time only
            onMetrics({ fps: 0, frameMs: parseFloat(frameMs.toFixed(2)) });
        }
    }, [loadedImages, selectedLayerType, selectedLayerIndex, frameImage, frameOpacity, photos.length, stickers.length, textLayers.length, drawings, filter, globalPhotoScale, isDrawingMode, activeGuestLayoutPlaceholders, onMetrics]);

    useEffect(() => {
        let animationFrameId: number;
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;

        const renderLoop = () => {
            const dpr = window.devicePixelRatio || 1;
            const { width: containerWidth, height: containerHeight } = container.getBoundingClientRect();

            let targetWidth = containerWidth;
            let targetHeight = containerHeight;

            if (aspectRatio) {
                const parts = aspectRatio.split('/').map(s => parseFloat(s.trim()));
                if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1]) && parts[1] !== 0) {
                    const ratio = parts[0] / parts[1];

                    if (containerWidth / containerHeight > ratio) {
                        // Container is wider than target ratio -> Height is the constraint
                        targetHeight = containerHeight;
                        targetWidth = targetHeight * ratio;
                    } else {
                        // Container is taller than target ratio -> Width is the constraint
                        targetWidth = containerWidth;
                        targetHeight = targetWidth / ratio;
                    }
                }
            }

            const newWidth = Math.round(targetWidth * dpr);
            const newHeight = Math.round(targetHeight * dpr);

            if (canvas.width !== newWidth || canvas.height !== newHeight) {
                canvas.width = newWidth;
                canvas.height = newHeight;
                canvas.style.width = `${targetWidth}px`;
                canvas.style.height = `${targetHeight}px`;
            }
            draw();
            animationFrameId = requestAnimationFrame(renderLoop);
        };
        renderLoop();
        return () => cancelAnimationFrame(animationFrameId);
    }, [draw, aspectRatio]);

    const getMousePos = (e: React.MouseEvent | React.WheelEvent | MouseEvent) => {
        const rect = canvasRef.current!.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        return { x: (e.clientX - rect.left) * dpr, y: (e.clientY - rect.top) * dpr };
    };

    const getTouchPos = (e: React.TouchEvent | TouchEvent) => {
        const rect = canvasRef.current!.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const touch = e.touches[0];
        return { x: (touch.clientX - rect.left) * dpr, y: (touch.clientY - rect.top) * dpr };
    };

    const getNormPos = (e: React.MouseEvent | React.TouchEvent) => {
        const rect = canvasRef.current!.getBoundingClientRect();
        const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
        return { x: (clientX - rect.left) / rect.width, y: (clientY - rect.top) / rect.height };
    };

    const getHit = useCallback((mouse: { x: number, y: number }) => {
        if (isDrawingMode) return null; // No hit testing in drawing mode
        const canvas = canvasRef.current;
        if (!canvas) return null;
        const dpr = window.devicePixelRatio || 1;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        // Check Text
        for (let i = transientText.current.length - 1; i >= 0; i--) {
            const t = transientText.current[i];
            const cx = t.x * canvas.width;
            const cy = t.y * canvas.height;
            const fontSize = t.fontSize * canvas.height;
            ctx.font = `${t.fontWeight} ${fontSize}px ${t.fontFamily}`;
            const metrics = ctx.measureText(t.text);
            const w = metrics.width + 10;
            const h = fontSize + 10;

            const angle = t.rotation * Math.PI / 180;
            const localX = (mouse.x - cx) * Math.cos(-angle) - (mouse.y - cy) * Math.sin(-angle);
            const localY = (mouse.x - cx) * Math.sin(-angle) + (mouse.y - cy) * Math.cos(-angle);

            if (selectedLayerType === 'text' && selectedLayerIndex === i) {
                const handleY = -h / 2 - (ROTATION_HANDLE_OFFSET * dpr);
                if (Math.hypot(localX, localY - handleY) < ROTATION_HANDLE_SIZE * dpr * 1.5) return { type: 'rotate', layerType: 'text', index: i };
                if (Math.hypot(localX - w / 2, localY - h / 2) < SCALE_HANDLE_SIZE * dpr * 2) return { type: 'scale', layerType: 'text', index: i };
            }
            if (Math.abs(localX) < w / 2 && Math.abs(localY) < h / 2) return { type: 'move', layerType: 'text', index: i };
        }

        // Check Stickers
        for (let i = transientStickers.current.length - 1; i >= 0; i--) {
            const s = transientStickers.current[i];
            const cx = s.x * canvas.width;
            const cy = s.y * canvas.height;
            const w = s.width * canvas.width;
            const h = s.height * canvas.height;

            const angle = s.rotation * Math.PI / 180;
            const localX = (mouse.x - cx) * Math.cos(-angle) - (mouse.y - cy) * Math.sin(-angle);
            const localY = (mouse.x - cx) * Math.sin(-angle) + (mouse.y - cy) * Math.cos(-angle);

            if (selectedLayerType === 'sticker' && selectedLayerIndex === i) {
                const handleY = -h / 2 - 5 - (ROTATION_HANDLE_OFFSET * dpr);
                if (Math.hypot(localX, localY - handleY) < ROTATION_HANDLE_SIZE * dpr * 1.5) return { type: 'rotate', layerType: 'sticker', index: i };
                if (Math.hypot(localX - w / 2 - 5, localY - h / 2 - 5) < SCALE_HANDLE_SIZE * dpr * 2) return { type: 'scale', layerType: 'sticker', index: i };
            }
            if (Math.abs(localX) < w / 2 && Math.abs(localY) < h / 2) return { type: 'move', layerType: 'sticker', index: i };
        }

        // Check Photos
        for (let i = transientPhotos.current.length - 1; i >= 0; i--) {
            const photo = transientPhotos.current[i];
            const { x, y } = toAbsolute(photo.transform, canvas);
            let { width, height } = toAbsolute(photo.transform, canvas);
            width *= globalPhotoScale;
            height *= globalPhotoScale;

            const angle = photo.transform.rotation * Math.PI / 180;
            const localX = (mouse.x - x) * Math.cos(-angle) - (mouse.y - y) * Math.sin(-angle);
            const localY = (mouse.x - x) * Math.sin(-angle) + (mouse.y - y) * Math.cos(-angle);

            if (selectedLayerType === 'photo' && selectedLayerIndex === i) {
                const handleCenterY = -height / 2 - (ROTATION_HANDLE_OFFSET * dpr);
                if (Math.hypot(localX, localY - handleCenterY) < ROTATION_HANDLE_SIZE * dpr * 1.5) return { type: 'rotate', layerType: 'photo', index: i };
            }
            if (Math.abs(localX) < width / 2 && Math.abs(localY) < height / 2) return { type: 'move', layerType: 'photo', index: i };
        }

        return null;
    }, [transientPhotos, transientStickers, transientText, selectedLayerType, selectedLayerIndex, globalPhotoScale, isDrawingMode]);

    const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        if (isDrawingMode && onDrawStart) {
            onDrawStart();
            interaction.current.mode = 'drawing';
            return;
        }

        const mouse = 'touches' in e ? getTouchPos(e) : getMousePos(e);
        const hit = getHit(mouse);
        interaction.current.startX = mouse.x;
        interaction.current.startY = mouse.y;

        if (hit) {
            onSelectLayer(hit.layerType as any, hit.index);

            let startObject: any;
            if (hit.layerType === 'photo') startObject = JSON.parse(JSON.stringify(transientPhotos.current[hit.index]));
            else if (hit.layerType === 'sticker') startObject = JSON.parse(JSON.stringify(transientStickers.current[hit.index]));
            else if (hit.layerType === 'text') startObject = JSON.parse(JSON.stringify(transientText.current[hit.index]));

            interaction.current.startVal = startObject;

            if (hit.type === 'rotate') {
                interaction.current.mode = 'rotating';
                let cx = 0, cy = 0, currentRot = 0;
                if (hit.layerType === 'photo') {
                    const t = toAbsolute(startObject.transform, canvasRef.current!);
                    cx = t.x; cy = t.y; currentRot = startObject.transform.rotation;
                } else {
                    cx = startObject.x * canvasRef.current!.width;
                    cy = startObject.y * canvasRef.current!.height;
                    currentRot = startObject.rotation;
                }
                const dx = mouse.x - cx;
                const dy = mouse.y - cy;
                interaction.current.startAngle = Math.atan2(dy, dx) - (currentRot * Math.PI / 180);

            } else if (hit.type === 'scale') {
                interaction.current.mode = 'scaling_layer';
                // Calculate initial distance for proportional scaling
                let cx = 0, cy = 0;
                if (hit.layerType === 'sticker') {
                    const s = startObject as StickerLayer;
                    cx = s.x * canvasRef.current!.width;
                    cy = s.y * canvasRef.current!.height;
                } else {
                    const t = startObject as TextLayer;
                    cx = t.x * canvasRef.current!.width;
                    cy = t.y * canvasRef.current!.height;
                }
                // @ts-ignore
                interaction.current.startDist = Math.hypot(mouse.x - cx, mouse.y - cy);

            } else if (hit.type === 'move') {
                if (hit.layerType === 'photo') interaction.current.mode = 'crop_panning';
                else interaction.current.mode = 'moving_layer';
            }
        } else {
            if (!isDrawingMode) onSelectLayer('photo', -1);
            interaction.current.mode = 'idle';
        }
    };

    const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        if (isDrawingMode && interaction.current.mode === 'drawing' && onDrawPoint) {
            const norm = getNormPos(e);
            onDrawPoint(norm);
            return;
        }

        if (isDrawingMode) {
            setCursor('crosshair');
            return;
        }

        const canvas = canvasRef.current;
        if (!canvas) return;
        const mouse = 'touches' in e ? getTouchPos(e) : getMousePos(e);

        if (interaction.current.mode === 'idle') {
            const hit = getHit(mouse);
            setCursor(hit ? (hit.type === 'rotate' ? 'grab' : hit.type === 'scale' ? 'nwse-resize' : 'move') : 'default');
        } else if (interaction.current.mode === 'crop_panning') {
            setCursor('grabbing');
            const start = interaction.current.startVal as Photo;

            const angle = start.transform.rotation * Math.PI / 180;
            const dx = mouse.x - interaction.current.startX;
            const dy = mouse.y - interaction.current.startY;

            // Rotate delta back to align with photo crop axes
            const localDx = dx * Math.cos(-angle) - dy * Math.sin(-angle);
            const localDy = dx * Math.sin(-angle) + dy * Math.cos(-angle);

            const scaleFactor = 1 / (globalPhotoScale * start.crop.scale);

            onPhotoUpdate(selectedLayerIndex, {
                crop: {
                    ...start.crop,
                    x: start.crop.x - localDx * scaleFactor,
                    y: start.crop.y - localDy * scaleFactor
                }
            });

        } else if (interaction.current.mode === 'rotating') {
            setCursor('grabbing');
            const startAngle = interaction.current.startAngle;
            let cx = 0, cy = 0;

            if (selectedLayerType === 'photo') {
                const t = toAbsolute((interaction.current.startVal as Photo).transform, canvas);
                cx = t.x; cy = t.y;
            } else if (selectedLayerType === 'sticker') {
                const s = interaction.current.startVal as StickerLayer;
                cx = s.x * canvas.width; cy = s.y * canvas.height;
            } else {
                const t = interaction.current.startVal as TextLayer;
                cx = t.x * canvas.width; cy = t.y * canvas.height;
            }

            const dx = mouse.x - cx;
            const dy = mouse.y - cy;
            const angle = Math.atan2(dy, dx) - startAngle;
            const deg = angle * 180 / Math.PI;

            if (selectedLayerType === 'photo') onPhotoUpdate(selectedLayerIndex, { transform: { ...transientPhotos.current[selectedLayerIndex].transform, rotation: deg } });
            else if (selectedLayerType === 'sticker') onStickerUpdate(selectedLayerIndex, { rotation: deg });
            else onTextUpdate(selectedLayerIndex, { rotation: deg });

        } else if (interaction.current.mode === 'moving_layer') {
            setCursor('move');
            const dx = (mouse.x - interaction.current.startX) / canvas.width;
            const dy = (mouse.y - interaction.current.startY) / canvas.height;

            if (selectedLayerType === 'sticker') {
                const start = interaction.current.startVal as StickerLayer;
                onStickerUpdate(selectedLayerIndex, { x: start.x + dx, y: start.y + dy });
            } else if (selectedLayerType === 'text') {
                const start = interaction.current.startVal as TextLayer;
                onTextUpdate(selectedLayerIndex, { x: start.x + dx, y: start.y + dy });
            }

        } else if (interaction.current.mode === 'scaling_layer') {
            // Distance based scaling
            let cx = 0, cy = 0;
            if (selectedLayerType === 'sticker') {
                const start = interaction.current.startVal as StickerLayer;
                cx = start.x * canvas.width;
                cy = start.y * canvas.height;
            } else {
                const start = interaction.current.startVal as TextLayer;
                cx = start.x * canvas.width;
                cy = start.y * canvas.height;
            }

            const currentDist = Math.hypot(mouse.x - cx, mouse.y - cy);
            // @ts-ignore
            const startDist = interaction.current.startDist || 1;
            const scaleFactor = currentDist / startDist;

            if (selectedLayerType === 'sticker') {
                const start = interaction.current.startVal as StickerLayer;
                const ratio = start.width / start.height;
                const newW = Math.max(0.02, start.width * scaleFactor);
                onStickerUpdate(selectedLayerIndex, { width: newW, height: newW / ratio });
            } else if (selectedLayerType === 'text') {
                const start = interaction.current.startVal as TextLayer;
                const newSize = Math.max(0.02, start.fontSize * scaleFactor);
                onTextUpdate(selectedLayerIndex, { fontSize: newSize });
            }
        }
    };

    const handleEnd = () => {
        if (isDrawingMode && interaction.current.mode === 'drawing' && onDrawEnd) {
            onDrawEnd();
        }
        interaction.current.mode = 'idle';
    };

    return (
        <div className="w-full h-full relative flex items-center justify-center" ref={containerRef}>
            <canvas
                ref={canvasRef}
                onMouseDown={handleStart}
                onMouseMove={handleMove}
                onMouseUp={handleEnd}
                onMouseLeave={handleEnd}
                onTouchStart={handleStart}
                onTouchMove={handleMove}
                onTouchEnd={handleEnd}
                className="block shadow-2xl touch-none" // touch-none to prevent scrolling while dragging
                style={{ cursor }}
            />
        </div>
    );
};

export default CanvasEditor;
