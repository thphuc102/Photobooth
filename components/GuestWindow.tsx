
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { InterWindowMessage, GuestScreenState, GuestScreenMode, Placeholder, Photo, StickerLayer, TextLayer, GuestAction, DrawingPath, ProSettings } from '../types';
import { QRCodeCanvas } from 'qrcode.react';
import { CameraIcon, GridIcon, SingleIcon, StripIcon, EmailIcon, PrintIcon, PenIcon, FilterIcon, ChipIcon } from './icons';

// Simple Check Icon for filter selection
const CheckIcon: React.FC<{ className?: string }> = ({ className = "w-6 h-6" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
);

const AttractMode: React.FC<{ frameSrc: string | null, onStart: () => void }> = ({ frameSrc, onStart }) => (
    <div onClick={onStart} className="w-full h-full flex flex-col items-center justify-center text-center p-8 bg-black cursor-pointer relative overflow-hidden group">
        {frameSrc && frameSrc.match(/\.(mp4|webm)$/i) ? (
            <video src={frameSrc} autoPlay loop muted className="absolute inset-0 w-full h-full object-cover opacity-60"></video>
        ) : (
            frameSrc && <img src={frameSrc} alt="Photobooth Frame" className="absolute inset-0 w-full h-full object-cover opacity-40 blur-sm" />
        )}
        <div className="relative z-10 flex flex-col items-center">
            <h1 className="text-9xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400 mb-8 animate-pulse drop-shadow-[0_5px_5px_rgba(0,0,0,0.8)]">PHOTOBOOTH</h1>
            <p className="text-6xl font-semibold text-white mt-8 animate-bounce uppercase tracking-widest drop-shadow-md">Touch to Start</p>
        </div>
        <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors duration-300"></div>
        {/* Hidden admin trigger */}
        <div className="absolute top-0 left-0 w-24 h-24 z-50 cursor-default" onDoubleClick={() => console.log('Admin triggered (placeholder)')}></div>
    </div>
);

const ConfigSelectionMode: React.FC<{ layoutOptions: import('../types').LayoutOption[], onSelect: (layoutId: string) => void }> = ({ layoutOptions, onSelect }) => {
    // Filter active layouts
    const activeLayouts = layoutOptions?.filter(l => l.isActive) || [];

    return (
        <div className="w-full h-full bg-gray-900 text-white flex flex-col items-center justify-center p-8">
            <h2 className="text-5xl font-bold mb-12 uppercase tracking-wide">Choose Your Experience</h2>
            <div className="grid grid-cols-4 gap-8 w-full max-w-7xl">
                {activeLayouts.map(layout => (
                    <button key={layout.id} onClick={() => onSelect(layout.id)} className="bg-gray-800 rounded-2xl p-8 flex flex-col items-center justify-center gap-6 border-4 border-transparent hover:border-indigo-500 hover:bg-gray-750 transition-all transform hover:scale-105 group">
                        {layout.iconType === 'single' && <SingleIcon className="w-32 h-32 text-indigo-400 group-hover:text-white" />}
                        {layout.iconType === 'grid' && <GridIcon className="w-32 h-32 text-purple-400 group-hover:text-white" />}
                        {layout.iconType === 'strip' && <StripIcon className="w-32 h-32 text-pink-400 group-hover:text-white" />}
                        {layout.iconType === 'custom' && (
                            <div className="w-32 h-32 border-4 border-dashed border-yellow-400 group-hover:border-white rounded-lg flex items-center justify-center">
                                <span className="text-4xl font-bold text-yellow-400 group-hover:text-white">?</span>
                            </div>
                        )}
                        <span className="text-3xl font-bold">{layout.label}</span>
                    </button>
                ))}
            </div>
        </div>
    );
};

const FrameSelectionMode: React.FC<{ availableFrames: import('../types').FrameConfig[], onSelect: (frameSrc: string) => void }> = ({ availableFrames, onSelect }) => {
    return (
        <div className="w-full h-full bg-gray-900 text-white flex flex-col items-center justify-center p-8">
            <h2 className="text-5xl font-bold mb-12 uppercase tracking-wide">Choose Your Frame</h2>
            <div className="grid grid-cols-3 gap-8 w-full max-w-7xl">
                {availableFrames.map((frame, index) => (
                    <button key={index} onClick={() => onSelect(frame.src)} className="bg-gray-800 rounded-2xl p-4 flex flex-col items-center justify-center gap-6 border-4 border-transparent hover:border-indigo-500 hover:bg-gray-750 transition-all transform hover:scale-105 group aspect-[2/3]">
                        <img src={frame.src} alt={`Frame ${index + 1}`} className="w-full h-full object-contain" />
                    </button>
                ))}
            </div>
        </div>
    );
};

const TetherPreviewMode: React.FC<{ frameSrc: string | null; placeholders: Placeholder[]; aspectRatio?: string }> = ({ frameSrc, placeholders, aspectRatio }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = 1920;
        canvas.height = 1080;

        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Calculate area based on aspect ratio
            let renderW = canvas.width;
            let renderH = canvas.height;
            let offsetX = 0;
            let offsetY = 0;

            if (aspectRatio) {
                const [w, h] = aspectRatio.split('/').map(Number);
                const targetRatio = w / h;
                const screenRatio = canvas.width / canvas.height;

                if (targetRatio > screenRatio) {
                    renderW = canvas.width;
                    renderH = renderW / targetRatio;
                    offsetY = (canvas.height - renderH) / 2;
                } else {
                    renderH = canvas.height;
                    renderW = renderH * targetRatio;
                    offsetX = (canvas.width - renderW) / 2;
                }
            }

            // Draw layout outline
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.lineWidth = 2;
            ctx.strokeRect(offsetX, offsetY, renderW, renderH);

            if (placeholders && placeholders.length > 0) {
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
                ctx.lineWidth = 4;
                ctx.setLineDash([15, 10]);

                placeholders.forEach(p => {
                    ctx.strokeRect(
                        offsetX + p.x * renderW,
                        offsetY + p.y * renderH,
                        p.width * renderW,
                        p.height * renderH
                    );
                });
            }
        }
    }, [placeholders, aspectRatio]);

    return (
        <div className="relative w-full h-full bg-black flex items-center justify-center text-center text-white">
            <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full object-contain"></canvas>
            {frameSrc && <img src={frameSrc} alt="Overlay" className="absolute top-0 left-0 w-full h-full object-contain pointer-events-none opacity-50" />}
            <div className="relative z-10 p-8 bg-black/50 rounded-2xl backdrop-blur-sm border border-white/10">
                <h1 className="text-8xl font-bold">Look at the Camera!</h1>
                <p className="text-4xl mt-4 animate-pulse">Strike a Pose!</p>
            </div>
        </div>
    );
};

const LivePreviewMode: React.FC<{ frameSrc: string | null; placeholders: Placeholder[]; isFlashActive?: boolean, lut?: string }> = ({ frameSrc, placeholders, isFlashActive, lut }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let stream: MediaStream;
        const startCamera = async () => {
            try {
                stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1920, height: 1080 } });
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
            } catch (err) {
                console.error("Camera error:", err);
                setError("Camera not available. Please check permissions.");
            }
        };
        startCamera();
        return () => {
            stream?.getTracks().forEach(track => track.stop());
        };
    }, []);

    useEffect(() => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas) return;

        let animationFrameId: number;

        const renderLoop = () => {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                ctx.translate(canvas.width, 0);
                ctx.scale(-1, 1);

                // Apply LUT filter for cinematic preview
                if (lut) {
                    ctx.filter = lut;
                } else {
                    ctx.filter = 'none';
                }

                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                ctx.filter = 'none'; // Reset for overlay

                ctx.translate(canvas.width, 0);
                ctx.scale(-1, 1);

                if (placeholders && placeholders.length > 0) {
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
                    ctx.lineWidth = 4;
                    ctx.setLineDash([15, 10]);
                    placeholders.forEach(p => {
                        ctx.strokeRect(p.x * canvas.width, p.y * canvas.height, p.width * canvas.width, p.height * canvas.height);
                    });
                }
            }
            animationFrameId = requestAnimationFrame(renderLoop);
        };
        video.onplay = () => { renderLoop(); };
        return () => { cancelAnimationFrame(animationFrameId); }
    }, [placeholders, lut]);

    if (error) return <div className="w-full h-full flex items-center justify-center bg-black text-red-500 text-3xl">{error}</div>;

    return (
        <div className="relative w-full h-full bg-black flex items-center justify-center overflow-hidden">
            <video ref={videoRef} autoPlay muted playsInline className="absolute top-0 left-0 w-full h-full object-cover hidden"></video>
            <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full object-contain"></canvas>
            {frameSrc && <img src={frameSrc} alt="Overlay" className="absolute top-0 left-0 w-full h-full object-contain pointer-events-none" />}
            {/* Flash Effect */}
            <div className={`absolute inset-0 bg-white z-50 pointer-events-none transition-opacity duration-300 ${isFlashActive ? 'opacity-100' : 'opacity-0'}`}></div>
        </div>
    );
};

const CountdownMode: React.FC<{ count: number }> = ({ count }) => (
    <div className="w-full h-full flex items-center justify-center bg-black/90">
        <div className="text-white font-black text-[40rem] leading-none animate-ping drop-shadow-lg">{count}</div>
    </div>
);

interface ReviewModeProps {
    photos: Photo[];
    stickers?: StickerLayer[];
    textLayers?: TextLayer[];
    drawings?: DrawingPath[];
    filter?: string;
    frameSrc: string | null;
    aspectRatio?: string;
    onAddDrawing: (drawing: DrawingPath) => void;
    onSetFilter: (filter: string) => void;
}

const ReviewMode: React.FC<ReviewModeProps> = ({ photos, stickers = [], textLayers = [], drawings = [], filter = '', frameSrc, aspectRatio, onAddDrawing, onSetFilter }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const drawingCanvasRef = useRef<HTMLCanvasElement>(null);
    const [loadedImages, setLoadedImages] = useState<Map<string, HTMLImageElement>>(new Map());
    const [frameImage, setFrameImage] = useState<HTMLImageElement | null>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [currentPath, setCurrentPath] = useState<{ x: number, y: number }[]>([]);

    // UI toggle state
    const [activeTool, setActiveTool] = useState<'none' | 'drawing' | 'filter' | 'sticker' | 'text'>('none');
    const [selectedSticker, setSelectedSticker] = useState<string | null>(null);
    const [textInput, setTextInput] = useState('');

    const dataRef = useRef({ photos, stickers, textLayers, drawings, filter, frameImage, loadedImages, aspectRatio });

    useEffect(() => {
        dataRef.current = { photos, stickers, textLayers, drawings, filter, frameImage, loadedImages, aspectRatio };
    }, [photos, stickers, textLayers, drawings, filter, frameImage, loadedImages, aspectRatio]);

    useEffect(() => {
        if (frameSrc) {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.src = frameSrc;
            img.onload = () => setFrameImage(img);
        }
    }, [frameSrc]);

    useEffect(() => {
        const newImages = new Map(loadedImages);
        let changed = false;

        const loadImg = (src: string) => {
            if (!src || newImages.has(src)) return;
            changed = true;
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.src = src;
            img.onload = () => setLoadedImages(prev => new Map(prev).set(src, img));
        };

        photos.forEach(p => loadImg(p.src));
        stickers.forEach(s => loadImg(s.src));
    }, [photos, stickers, loadedImages]);

    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;

        const { photos, stickers, textLayers, drawings, filter, frameImage, loadedImages, aspectRatio } = dataRef.current;

        if (frameImage) {
            if (aspectRatio) {
                const [w, h] = aspectRatio.split('/').map(Number);
                const base = Math.max(frameImage.naturalWidth, frameImage.naturalHeight, 1920);
                if (w > h) {
                    canvas.width = base;
                    canvas.height = base * (h / w);
                } else {
                    canvas.height = base;
                    canvas.width = base * (w / h);
                }
            } else {
                canvas.width = frameImage.naturalWidth;
                canvas.height = frameImage.naturalHeight;
            }
        } else {
            canvas.width = 1080;
            canvas.height = 1920;
            if (aspectRatio) {
                const [w, h] = aspectRatio.split('/').map(Number);
                canvas.height = canvas.width * (h / w);
            }
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Apply Filters
        if (filter) {
            ctx.filter = filter;
        }

        // 1. Draw Photos
        photos.forEach((photo) => {
            const img = loadedImages.get(photo.src);
            if (!img) return;
            const transform = {
                x: photo.transform.x * canvas.width,
                y: photo.transform.y * canvas.height,
                width: photo.transform.width * canvas.width,
                height: photo.transform.height * canvas.height,
            };
            const angle = photo.transform.rotation * Math.PI / 180;
            ctx.save();
            ctx.translate(transform.x, transform.y);
            ctx.rotate(angle);
            ctx.beginPath();
            ctx.rect(-transform.width / 2, -transform.height / 2, transform.width, transform.height);
            ctx.clip();

            const { crop } = photo;
            const imgAspectRatio = img.width / img.height;
            let displayWidth = transform.width, displayHeight = transform.height;
            const fitMode = photo.fit || 'cover';

            if (fitMode === 'cover') {
                if (imgAspectRatio > transform.width / transform.height) { displayHeight = transform.height; displayWidth = displayHeight * imgAspectRatio; }
                else { displayWidth = transform.width; displayHeight = displayWidth / imgAspectRatio; }
            } else {
                if (imgAspectRatio > transform.width / transform.height) { displayWidth = transform.width; displayHeight = displayWidth / imgAspectRatio; }
                else { displayHeight = transform.height; displayWidth = displayHeight * imgAspectRatio; }
            }
            displayWidth *= crop.scale;
            displayHeight *= crop.scale;
            ctx.drawImage(img, -displayWidth / 2 + crop.x, -displayHeight / 2 + crop.y, displayWidth, displayHeight);
            ctx.restore();
        });

        // Reset filter for frame and overlays
        ctx.filter = 'none';

        // 2. Draw Frame
        if (frameImage) {
            ctx.drawImage(frameImage, 0, 0, canvas.width, canvas.height);
        }

        // 3. Draw Drawings (From Host)
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
        stickers.forEach(sticker => {
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
        textLayers.forEach(text => {
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

    }, []);

    useEffect(() => {
        let animId: number;
        const render = () => {
            draw();
            animId = requestAnimationFrame(render);
        }
        render();
        return () => cancelAnimationFrame(animId);
    }, [draw]);

    // --- Drawing Handling ---
    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        if (activeTool !== 'drawing') return;
        setIsDrawing(true);
        const pos = getPos(e);
        setCurrentPath([pos]);
    };

    const moveDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing) return;
        const pos = getPos(e);
        setCurrentPath(prev => [...prev, pos]);

        // Draw current path immediately on top (using temp canvas or main canvas overlay)
        const canvas = drawingCanvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                const w = canvas.width;
                const h = canvas.height;
                ctx.clearRect(0, 0, w, h);
                if (currentPath.length > 0) {
                    ctx.beginPath();
                    ctx.strokeStyle = '#ff0000'; // Default pen color
                    ctx.lineWidth = 5;
                    ctx.lineCap = 'round';
                    ctx.moveTo(currentPath[0].x * w, currentPath[0].y * h);
                    for (let i = 1; i < currentPath.length; i++) ctx.lineTo(currentPath[i].x * w, currentPath[i].y * h);
                    ctx.lineTo(pos.x * w, pos.y * h);
                    ctx.stroke();
                }
            }
        }
    };

    const endDrawing = () => {
        if (!isDrawing) return;
        setIsDrawing(false);
        // Send complete path to App
        if (currentPath.length > 1) {
            onAddDrawing({
                id: Date.now().toString(),
                points: currentPath,
                color: '#ff0000',
                width: 0.005
            });
        }
        setCurrentPath([]);
        const canvas = drawingCanvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx?.clearRect(0, 0, canvas.width, canvas.height);
        }
    };

    const getPos = (e: React.MouseEvent | React.TouchEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        let clientX, clientY;
        if ('touches' in e) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = (e as React.MouseEvent).clientX;
            clientY = (e as React.MouseEvent).clientY;
        }
        return {
            x: (clientX - rect.left) / rect.width,
            y: (clientY - rect.top) / rect.height
        };
    };

    return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-black p-8 relative">
            <div className="relative max-w-full max-h-[80vh] shadow-2xl">
                <canvas ref={canvasRef} className="max-w-full max-h-full object-contain" />
                <canvas
                    ref={drawingCanvasRef}
                    className={`absolute inset-0 w-full h-full object-contain ${activeTool === 'drawing' ? 'cursor-crosshair' : 'pointer-events-none'}`}
                    width={canvasRef.current?.width}
                    height={canvasRef.current?.height}
                    onMouseDown={startDrawing}
                    onMouseMove={moveDrawing}
                    onMouseUp={endDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={moveDrawing}
                    onTouchEnd={endDrawing}
                />
            </div>

            {/* Toolbar */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-6 bg-gray-900/90 p-4 rounded-2xl backdrop-blur-md border border-gray-700 shadow-2xl">
                <button
                    onClick={() => setActiveTool(activeTool === 'drawing' ? 'none' : 'drawing')}
                    className={`p-4 rounded-xl flex flex-col items-center gap-2 transition-all duration-200 ${activeTool === 'drawing' ? 'bg-indigo-600 text-white scale-110' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
                >
                    <PenIcon className="w-8 h-8" />
                    <span className="text-xs font-bold uppercase">Draw</span>
                </button>
                <button
                    onClick={() => setActiveTool(activeTool === 'filter' ? 'none' : 'filter')}
                    className={`p-4 rounded-xl flex flex-col items-center gap-2 transition-all duration-200 ${activeTool === 'filter' ? 'bg-pink-600 text-white scale-110' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
                >
                    <FilterIcon className="w-8 h-8" />
                    <span className="text-xs font-bold uppercase">Filter</span>
                </button>
                <button
                    onClick={() => setActiveTool(activeTool === 'sticker' ? 'none' : 'sticker')}
                    className={`p-4 rounded-xl flex flex-col items-center gap-2 transition-all duration-200 ${activeTool === 'sticker' ? 'bg-yellow-600 text-white scale-110' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
                >
                    <span className="text-3xl">😊</span>
                    <span className="text-xs font-bold uppercase">Emoji</span>
                </button>
                <button
                    onClick={() => setActiveTool(activeTool === 'text' ? 'none' : 'text')}
                    className={`p-4 rounded-xl flex flex-col items-center gap-2 transition-all duration-200 ${activeTool === 'text' ? 'bg-green-600 text-white scale-110' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
                >
                    <span className="text-2xl font-bold">Aa</span>
                    <span className="text-xs font-bold uppercase">Text</span>
                </button>
            </div>

            {/* Filter Selection Panel */}
            {activeTool === 'filter' && (
                <div className="absolute bottom-36 left-1/2 -translate-x-1/2 bg-gray-900/95 p-4 rounded-xl border border-gray-700 flex gap-4 overflow-x-auto max-w-[90vw]">
                    {[
                        { name: 'Normal', val: '' },
                        { name: 'B&W', val: 'grayscale(100%)' },
                        { name: 'Vintage', val: 'sepia(80%) contrast(120%)' },
                        { name: 'Glamour', val: 'brightness(110%) contrast(110%) saturate(120%) blur(0.5px)' },
                        { name: 'Dramatic', val: 'contrast(150%) saturate(0%)' }
                    ].map(f => (
                        <button
                            key={f.name}
                            onClick={() => onSetFilter(f.val)}
                            className={`flex flex-col items-center gap-2 p-3 rounded-lg min-w-[80px] ${filter === f.val ? 'bg-white text-black' : 'text-gray-400 hover:bg-white/10'}`}
                        >
                            <div className="w-16 h-16 rounded-full bg-gray-700 overflow-hidden border-2 border-current">
                                <div className="w-full h-full bg-gradient-to-tr from-blue-400 to-purple-500" style={{ filter: f.val }}></div>
                            </div>
                            <span className="text-xs font-bold">{f.name}</span>
                        </button>
                    ))}
                </div>
            )}

            {/* Sticker Selection Panel */}
            {activeTool === 'sticker' && (
                <div className="absolute bottom-36 left-1/2 -translate-x-1/2 bg-gray-900/95 p-6 rounded-xl border border-gray-700 flex flex-wrap gap-3 max-w-[90vw] animate-slide-up">
                    {['😀', '😂', '😍', '🥳', '😎', '🤩', '😘', '💖', '💯', '🔥', '⭐', '✨', '👍', '👏', '🎉', '🎊', '🎈', '🌟'].map(emoji => (
                        <button
                            key={emoji}
                            onClick={() => {
                                // Add sticker at center
                                const action: GuestAction = {
                                    type: 'GUEST_ADD_STICKER',
                                    sticker: { src: emoji, x: 0.5, y: 0.5, scale: 1 }
                                };
                                window.parent.postMessage({ type: 'GUEST_ACTION', payload: action }, '*');
                                setActiveTool('none');
                            }}
                            className="text-5xl p-3 rounded-lg hover:bg-white/20 transition-all hover:scale-110 active:scale-95"
                        >
                            {emoji}
                        </button>
                    ))}
                </div>
            )}

            {/* Text Input Panel */}
            {activeTool === 'text' && (
                <div className="absolute bottom-36 left-1/2 -translate-x-1/2 bg-gray-900/95 p-6 rounded-xl border border-gray-700 flex flex-col gap-4 min-w-[400px] animate-slide-up">
                    <input
                        type="text"
                        value={textInput}
                        onChange={(e) => setTextInput(e.target.value)}
                        placeholder="Enter your message..."
                        className="bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-white text-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                        autoFocus
                    />
                    <div className="flex gap-2">
                        <button
                            onClick={() => {
                                if (textInput.trim()) {
                                    const action: GuestAction = {
                                        type: 'GUEST_ADD_TEXT',
                                        text: { content: textInput, x: 0.5, y: 0.5, fontSize: 48, color: '#ffffff' }
                                    };
                                    window.parent.postMessage({ type: 'GUEST_ACTION', payload: action }, '*');
                                    setTextInput('');
                                    setActiveTool('none');
                                }
                            }}
                            className="flex-1 bg-green-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-green-700 transition-all hover:scale-105 active:scale-95"
                        >
                            Add Text
                        </button>
                        <button
                            onClick={() => setActiveTool('none')}
                            className="px-6 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-all"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* Top Action Bar */}
            <div className="absolute top-8 right-8 flex gap-3">
                <button
                    onClick={() => {
                        const action: GuestAction = { type: 'GUEST_UNDO' };
                        window.parent.postMessage({ type: 'GUEST_ACTION', payload: action }, '*');
                    }}
                    className="bg-gray-800/90 backdrop-blur-md text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-gray-700 transition-all hover:scale-105 active:scale-95 border border-gray-600"
                    title="Undo Last Action"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                    </svg>
                    <span className="font-bold">Undo</span>
                </button>
                <button
                    onClick={() => {
                        if (window.confirm('Start over with new photos?')) {
                            const action: GuestAction = { type: 'GUEST_RETAKE' };
                            window.parent.postMessage({ type: 'GUEST_ACTION', payload: action }, '*');
                        }
                    }}
                    className="bg-orange-600/90 backdrop-blur-md text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-orange-700 transition-all hover:scale-105 active:scale-95 border border-orange-500"
                    title="Retake Photos"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span className="font-bold">Retake</span>
                </button>
            </div>
        </div>
    );
};

const PaymentMode: React.FC<{ proSettings: ProSettings | undefined, onPaid: () => void }> = ({ proSettings, onPaid }) => {
    // Mock payment simulation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'p') {
                // Simulate Coin Drop
                onPaid();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onPaid]);

    return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-gray-900 text-white p-8">
            <h2 className="text-5xl font-bold mb-8 uppercase tracking-wide">Please Insert Payment</h2>
            <div className="w-full max-w-lg bg-gray-800 p-12 rounded-3xl border-4 border-yellow-500 shadow-2xl flex flex-col items-center gap-8 animate-pulse">
                <ChipIcon className="w-48 h-48 text-yellow-400" />
                <div className="text-6xl font-black text-yellow-300">
                    {proSettings?.currency || '$'}{proSettings?.pricePerPrint || 5.00}
                </div>
                <p className="text-xl text-gray-400">Insert Cash or Swipe Card</p>
                <div className="text-xs text-gray-600">(Press 'P' to simulate payment)</div>
            </div>
        </div>
    );
};

const DeliveryMode: React.FC<{ qrCodeValue: string, onEmail: (email: string) => void, onPrint: () => void }> = ({ qrCodeValue, onEmail, onPrint }) => {
    const [email, setEmail] = useState('');
    const [sent, setSent] = useState(false);

    const handleSend = (e: React.FormEvent) => {
        e.preventDefault();
        onEmail(email);
        setSent(true);
    };

    return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-white p-12 text-center">
            <h2 className="text-6xl font-bold text-black mb-4">Your Photo is Ready!</h2>
            <p className="text-2xl text-gray-500 mb-12">Scan, Email, or Print your keepsake.</p>

            <div className="flex gap-16 items-start">
                <div className="flex flex-col items-center gap-4">
                    <div className="bg-white p-6 rounded-lg shadow-2xl border-4 border-black">
                        <QRCodeCanvas value={qrCodeValue} size={300} level="L" />
                    </div>
                    <span className="font-bold text-lg">Scan QR Code</span>
                </div>

                <div className="flex flex-col gap-8 max-w-md text-left">
                    <div className="bg-gray-100 p-6 rounded-xl shadow-lg w-full">
                        <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><EmailIcon className="w-6 h-6" /> Email a Copy</h3>
                        {!sent ? (
                            <form onSubmit={handleSend} className="flex flex-col gap-3">
                                <input
                                    type="email"
                                    placeholder="your@email.com"
                                    className="p-4 rounded-lg border border-gray-300 text-lg w-full"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    required
                                />
                                <button type="submit" className="bg-black text-white p-4 rounded-lg font-bold text-lg hover:bg-gray-800 transition-colors">Send</button>
                            </form>
                        ) : (
                            <div className="p-4 bg-green-100 text-green-800 rounded-lg text-center font-bold">
                                Sent successfully!
                            </div>
                        )}
                    </div>

                    <button onClick={onPrint} className="bg-blue-600 text-white p-6 rounded-xl font-bold text-2xl shadow-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-3">
                        <PrintIcon className="w-8 h-8" /> Print Photo
                    </button>
                </div>
            </div>

            <button onClick={() => window.location.reload()} className="mt-16 text-gray-400 hover:text-black font-semibold text-lg">
                Done
            </button>
        </div>
    );
};

const GuestWindow: React.FC = () => {
    const [state, setState] = useState<GuestScreenState>({ mode: GuestScreenMode.ATTRACT });
    const channelRef = useRef<BroadcastChannel | null>(null);

    useEffect(() => {
        document.body.style.overflow = 'hidden';
        document.documentElement.style.cursor = 'default';
        const channel = new BroadcastChannel('photobooth_channel');
        channelRef.current = channel;
        const handleMessage = (event: MessageEvent<InterWindowMessage>) => {
            if (event.data.type === 'SET_STATE') setState(event.data.payload);
        };
        channel.addEventListener('message', handleMessage);
        return () => {
            channel.removeEventListener('message', handleMessage);
            channel.close();
        };
    }, []);

    const sendAction = (action: GuestAction) => {
        if (channelRef.current) {
            channelRef.current.postMessage({ type: 'GUEST_ACTION', payload: action });
        }
    };

    const renderContent = () => {
        switch (state.mode) {
            case GuestScreenMode.ATTRACT:
                return <AttractMode frameSrc={state.frameSrc || null} onStart={() => sendAction({ type: 'GUEST_START' })} />;
            case GuestScreenMode.CONFIG_SELECTION:
                return <ConfigSelectionMode layoutOptions={state.layoutOptions || []} onSelect={(layout) => sendAction({ type: 'GUEST_SELECT_LAYOUT', layout })} />;
            case GuestScreenMode.FRAME_SELECTION:
                return <FrameSelectionMode availableFrames={state.availableFrames || []} onSelect={(frameSrc) => sendAction({ type: 'GUEST_SELECT_FRAME', frameSrc })} />;
            case GuestScreenMode.TETHER_PREVIEW:
                return <TetherPreviewMode frameSrc={state.frameSrc || null} placeholders={state.placeholders || []} aspectRatio={state.aspectRatio} />;
            case GuestScreenMode.LIVE_PREVIEW:
                return <LivePreviewMode frameSrc={state.frameSrc || null} placeholders={state.placeholders || []} isFlashActive={state.isFlashActive} lut={state.proSettings?.liveViewLut} />;
            case GuestScreenMode.COUNTDOWN:
                return <CountdownMode count={state.countdown || 3} />;
            case GuestScreenMode.REVIEW:
                return <ReviewMode
                    photos={state.photos || []}
                    stickers={state.stickers || []}
                    textLayers={state.textLayers || []}
                    drawings={state.drawings || []}
                    filter={state.filter || ''}
                    frameSrc={state.frameSrc || null}
                    aspectRatio={state.aspectRatio}
                    onAddDrawing={(drawing) => sendAction({ type: 'GUEST_ADD_DRAWING', drawing })}
                    onSetFilter={(filter) => sendAction({ type: 'GUEST_SET_FILTER', filter })}
                />;
            case GuestScreenMode.PAYMENT:
                return <PaymentMode proSettings={state.proSettings} onPaid={() => sendAction({ type: 'GUEST_PAYMENT_COMPLETE' })} />;
            case GuestScreenMode.DELIVERY:
                return state.qrCodeValue ? <DeliveryMode qrCodeValue={state.qrCodeValue} onEmail={(email) => sendAction({ type: 'GUEST_EMAIL', email })} onPrint={() => sendAction({ type: 'GUEST_PRINT' })} /> : <AttractMode frameSrc={state.frameSrc || null} onStart={() => { }} />;
            default: return <AttractMode frameSrc={state.frameSrc || null} onStart={() => sendAction({ type: 'GUEST_START' })} />;
        }
    };

    return <div className="w-screen h-screen overflow-hidden bg-black">{renderContent()}</div>;
};

export default GuestWindow;
