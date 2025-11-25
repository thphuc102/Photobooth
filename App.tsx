import React, { useState, useCallback, useEffect, useRef } from 'react';
import { AppSettings, PhotoboothSession, AppStep, Placeholder, Photo, Transform, Crop, UiConfig, GuestScreenMode, StickerLayer, TextLayer, AnalyticsData, GuestAction, InterWindowMessage, DrawingPath, Printer, LayoutOption, ProSettings, CompositorRequest, CompositorResponse } from './types';
import { t, setLocale } from './i18n/i18n';
import FrameUploader from './components/FrameUploader';
import TemplateDesigner from './components/TemplateDesigner';
import PhotoSelector from './components/PhotoSelector';
import FinalizeControls from './components/FinalizeControls';
import CanvasEditor from './components/CanvasEditor';
import StepIndicator from './components/StepIndicator';
import SettingsPanel from './components/SettingsPanel';
import UiCustomizationPanel from './components/UiCustomizationPanel';
import GuestLayoutStatus from './components/GuestLayoutStatus';
import PrinterQueuePanel, { PrintJob } from './components/PrinterQueuePanel';
import GuestLivePreview from './components/GuestLivePreview';
import { GoogleGenAI, Modality } from '@google/genai';

import { SettingsIcon, PaletteIcon } from './components/icons';
import { useGuestWindow } from './hooks/useGuestWindow';
import { useHotFolder } from './hooks/useHotFolder';
import PerformanceHud from './components/PerformanceHud';
import ErrorBoundary from './components/ErrorBoundary';
import ToastContainer, { useToast } from './components/Toast';
import LoadingSpinner from './components/LoadingSpinner';
import { persistSettings, loadLatestSettings, persistSession, loadLatestSession } from './storage';

// Initialize Gemini AI Client.
const apiKey = process.env.API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;
if (!apiKey) {
    console.warn("AI features are disabled: Gemini API key not found in environment variables (process.env.API_KEY).");
}

declare const google: any;
declare const gapi: any;

const createPhotoFromPlaceholder = (src: string, placeholder: Placeholder, canvasSize: { width: number, height: number }, imageSize: { width: number, height: number }): Photo => {
    return {
        src,
        originalWidth: imageSize.width,
        originalHeight: imageSize.height,
        transform: {
            x: placeholder.x + placeholder.width / 2,
            y: placeholder.y + placeholder.height / 2,
            width: placeholder.width,
            height: placeholder.height,
            rotation: 0,
        },
        crop: { x: 0, y: 0, scale: 1 },
        fit: placeholder.fit || 'cover',
    };
};

const hexToRgb = (hex: string): string => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)} ` : '255, 255, 255';
};

const FILTER_PRESETS = [
    { label: 'None', value: '' },
    { label: 'Grayscale', value: 'grayscale(100%)' },
    { label: 'Sepia', value: 'sepia(0.8)' },
    { label: 'Vintage', value: 'sepia(0.4) contrast(1.1) brightness(1.1)' },
    { label: 'High Contrast', value: 'contrast(1.5) saturate(1.3)' },
    { label: 'Noir', value: 'grayscale(1) contrast(1.3) brightness(0.9)' },
    { label: 'Warm', value: 'sepia(0.2) saturate(1.2) brightness(1.1)' },
    { label: 'Cool', value: 'hue-rotate(20deg) saturate(0.9)' },
    { label: 'Cyberpunk', value: 'saturate(1.6) hue-rotate(-10deg) contrast(1.2)' },
    { label: 'Faded', value: 'contrast(0.8) brightness(1.2) saturate(0.7)' }
];

const EXPORT_FORMATS = [
    { label: 'PNG (High Quality)', value: 'png', mimeType: 'image/png' },
    { label: 'JPEG (Best)', value: 'jpeg-100', mimeType: 'image/jpeg', quality: 1.0 },
    { label: 'JPEG (High)', value: 'jpeg-90', mimeType: 'image/jpeg', quality: 0.9 },
    { label: 'JPEG (Medium)', value: 'jpeg-80', mimeType: 'image/jpeg', quality: 0.8 },
];

const generateDefaultLayouts = (): LayoutOption[] => {
    const baseId = Date.now();
    const margin = 0.05;
    const gap = 0.03;
    const availW = 1 - (margin * 2);
    const availH = 1 - (margin * 2);

    // 1x1
    const single: Placeholder[] = [{ id: baseId, x: margin, y: margin, width: availW, height: availH, aspectRatio: null, fit: 'cover' }];

    // Grid 2x2 (Standard)
    const grid2x2: Placeholder[] = [];
    const w = (availW - gap) / 2;
    const h = (availH - gap) / 2;
    for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 2; c++) {
            grid2x2.push({ id: baseId + r * 2 + c, x: margin + c * (w + gap), y: margin + r * (h + gap), width: w, height: h, aspectRatio: null, fit: 'cover' });
        }
    }

    // Strip 3 (Vertical)
    const strip3: Placeholder[] = [];
    const sh3 = (availH - (gap * 2)) / 3;
    for (let i = 0; i < 3; i++) {
        strip3.push({ id: baseId + 10 + i, x: margin, y: margin + i * (sh3 + gap), width: availW, height: sh3, aspectRatio: null, fit: 'cover' });
    }

    // Strip 4 (Vertical)
    const strip4: Placeholder[] = [];
    const sh4 = (availH - (gap * 3)) / 4;
    for (let i = 0; i < 4; i++) {
        strip4.push({ id: baseId + 20 + i, x: margin, y: margin + i * (sh4 + gap), width: availW, height: sh4, aspectRatio: null, fit: 'cover' });
    }

    // Grid 2x2 Wide (Horizontal/Landscape orientation simulation on portrait canvas, or just wider aspect ratio slots)
    // Interpreting "2x2 horenzatation" as 2x2 grid where slots are wider (landscape aspect ratio)
    const grid2x2Wide: Placeholder[] = [];
    // Adjust margin/gap for wider look if needed, but standard 2x2 is already filling space.
    // Maybe this means the canvas is landscape? For now, let's just create a 2x2 grid that assumes landscape photos.
    // Actually, let's make it 2 rows, 2 columns, but with 'contain' fit to emphasize landscape nature?
    // Or maybe it's just a standard 2x2. Let's stick to standard 2x2 but label it distinctively.
    // User might mean "2x2 Horizontal" as in 2 rows of 2 landscape photos.
    // Let's create a layout that is optimized for landscape photos.
    const wWide = (availW - gap) / 2;
    const hWide = wWide * (2 / 3); // Force 3:2 aspect ratio slots
    const totalH = (hWide * 2) + gap;
    const startY = (1 - totalH) / 2;

    for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 2; c++) {
            grid2x2Wide.push({
                id: baseId + 30 + r * 2 + c,
                x: margin + c * (wWide + gap),
                y: startY + r * (hWide + gap),
                width: wWide,
                height: hWide,
                aspectRatio: '3/2',
                fit: 'cover'
            });
        }
    }

    // 2 Landscapes Horizontal (Stacked vertically)
    const landscape2: Placeholder[] = [];
    const lh = (availW) * (2 / 3); // Height for 3:2 landscape
    const totalLH = (lh * 2) + gap;
    const startLY = (1 - totalLH) / 2;

    landscape2.push({ id: baseId + 40, x: margin, y: startLY, width: availW, height: lh, aspectRatio: '3/2', fit: 'cover' });
    landscape2.push({ id: baseId + 41, x: margin, y: startLY + lh + gap, width: availW, height: lh, aspectRatio: '3/2', fit: 'cover' });


    return [
        { id: '1x1', label: 'Single Shot', type: 'preset', placeholders: single, isActive: true, iconType: 'single' },
        { id: 'strip-3', label: '3 Strips', type: 'preset', placeholders: strip3, isActive: true, iconType: 'strip' },
        { id: 'grid-2x2', label: '2x2 Grid', type: 'preset', placeholders: grid2x2, isActive: true, iconType: 'grid' },
        { id: 'strip-4', label: '4 Strips', type: 'preset', placeholders: strip4, isActive: true, iconType: 'strip' },
        { id: 'grid-2x2-wide', label: '2x2 Horizontal', type: 'preset', placeholders: grid2x2Wide, isActive: true, iconType: 'grid' },
        { id: 'landscape-2', label: '2 Landscapes', type: 'preset', placeholders: landscape2, isActive: true, iconType: 'custom' },
        { id: 'custom', label: 'Event Special', type: 'custom', placeholders: [], isActive: true, iconType: 'custom' }
    ];
};

const App: React.FC = () => {
    const [appStep, setAppStep] = useState<AppStep>(AppStep.FRAME_UPLOAD);
    const [settings, setSettings] = useState<AppSettings>({
        frameSrc: null,
        hotFolderHandle: null,
        outputDirectoryHandle: null,
        placeholders: [],
        hotFolderName: '',
        driveFolderId: null,
        driveFolderName: '',
        fileNameTemplate: 'photobooth-{timestamp}-{number}',
        aspectRatio: '2 / 3',
        kioskMode: false,
        locale: 'en',
        pro: {
            enableVending: false,
            pricePerPrint: 5.00,
            currency: '$',
            printerPool: [],
            iccProfileName: null,
            enableSmartCrop: false,
            liveViewLut: ''
        },
        layoutOptions: generateDefaultLayouts(),
        availableFrames: []
    });
    const [session, setSession] = useState<PhotoboothSession>({
        isActive: false,
        photos: [],
        stickers: [],
        textLayers: [],
        drawings: [],
        filter: '',
        isPaid: false
    });

    // Analytics State
    const [analytics, setAnalytics] = useState<AnalyticsData>({
        totalSessions: 0,
        totalPhotosTaken: 0,
        totalPrints: 0,
        emailsCollected: [],
        totalRevenue: 0
    });

    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isUiPanelOpen, setIsUiPanelOpen] = useState(false);

    const [selectedLayerType, setSelectedLayerType] = useState<'photo' | 'sticker' | 'text' | 'drawing'>('photo');
    const [selectedLayerIndex, setSelectedLayerIndex] = useState(-1);

    const [frameOpacity, setFrameOpacity] = useState(1);
    const [globalPhotoScale, setGlobalPhotoScale] = useState(1);
    const history = useRef<PhotoboothSession[]>([]);
    const historyIndex = useRef(0);
    const fileCounter = useRef(1);

    // AI Edit State
    const [aiPrompt, setAiPrompt] = useState('');
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [aiError, setAiError] = useState<string | null>(null);
    const [aiPreviewImage, setAiPreviewImage] = useState<string | null>(null);
    const [finalCompositeImage, setFinalCompositeImage] = useState<string | null>(null);
    const [workerRenderMs, setWorkerRenderMs] = useState<number>(0);
    const compositorWorkerRef = useRef<Worker | null>(null);
    const workerPendingRef = useRef<boolean>(false);
    const [useWorkerCompositor, setUseWorkerCompositor] = useState<boolean>(true); // future toggle
    const [perfFps, setPerfFps] = useState(0);
    const [perfFrameMs, setPerfFrameMs] = useState(0);
    const { toasts, addToast, removeToast } = useToast();
    const [isSaving, setIsSaving] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [exportFormat, setExportFormat] = useState('png');

    // AI Sticker State
    const [aiStickerPrompt, setAiStickerPrompt] = useState('');
    const [isAiStickerLoading, setIsAiStickerLoading] = useState(false);
    const [aiStickerError, setAiStickerError] = useState<string | null>(null);

    const [availableStickers, setAvailableStickers] = useState<string[]>([
        'https://cdn-icons-png.flaticon.com/512/763/763019.png',
        'https://cdn-icons-png.flaticon.com/512/1216/1216575.png',
        'https://cdn-icons-png.flaticon.com/512/7481/7481377.png',
        'https://cdn-icons-png.flaticon.com/512/2462/2462719.png',
    ]);

    const [gapiAuthInstance, setGapiAuthInstance] = useState<any>(null);
    const [isGapiReady, setIsGapiReady] = useState(false);
    const [isSignedIn, setIsSignedIn] = useState(false);
    const [pickerApiLoaded, setPickerApiLoaded] = useState(false);
    const tokenClientRef = useRef<any>(null);

    const { guestWindow, openGuestWindow, closeGuestWindow, sendMessage } = useGuestWindow();
    const finalCanvasRef = useRef<HTMLCanvasElement>(null);
    const channelRef = useRef<BroadcastChannel | null>(null);

    const [uiConfig, setUiConfig] = useState<UiConfig>({
        title: 'UIT Media FrameFusion Photobooth',
        description: 'An elegant photobooth experience for your special event.',
        footer: 'Powered by FrameFusion',
        logoSrc: null,
        backgroundSrc: null,
        fontFamily: "'Roboto', sans-serif",
        primaryColor: '#8b5cf6',
        textColor: '#e5e7eb',
        backgroundColor: '#111827',
        panelColor: '#1f2937',
        borderColor: '#374151',
        highContrastMode: false,
    });

    // Additional state that must be declared before useEffect hooks
    const [guestLayoutId, setGuestLayoutId] = useState<string | null>(null);
    const lastGuestBroadcastRef = useRef<number>(0);
    const BROADCAST_INTERVAL_MS = 300; // throttle interval
    const [printJobs, setPrintJobs] = useState<PrintJob[]>([]);
    const [showPrinterPanel, setShowPrinterPanel] = useState(false);
    const [isKioskLocked, setIsKioskLocked] = useState(false);
    const lastActivityRef = useRef<number>(Date.now());
    const [unlockAttemptPin, setUnlockAttemptPin] = useState('');
    const handleActivity = () => { lastActivityRef.current = Date.now(); if (isKioskLocked) return; };

    const [isInitializing, setIsInitializing] = useState(true);
    const persistSettingsRef = useRef<number | null>(null);
    const persistSessionRef = useRef<number | null>(null);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Only enable shortcuts in finalize step and when not locked
            if (appStep !== AppStep.FINALIZE_AND_EXPORT || isKioskLocked) return;
            
            // Prevent shortcuts when typing in inputs
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

            if (e.ctrlKey || e.metaKey) {
                switch (e.key.toLowerCase()) {
                    case 'z':
                        e.preventDefault();
                        if (historyIndex.current > 0) undo();
                        break;
                    case 'y':
                        e.preventDefault();
                        if (historyIndex.current < history.current.length - 1) redo();
                        break;
                    case 's':
                        e.preventDefault();
                        handleDownload();
                        addToast('Downloading...', 'info');
                        break;
                }
            } else {
                switch (e.key) {
                    case 'Escape':
                        if (isSettingsOpen) setIsSettingsOpen(false);
                        else if (isUiPanelOpen) setIsUiPanelOpen(false);
                        else if (showPrinterPanel) setShowPrinterPanel(false);
                        break;
                    case 'Delete':
                    case 'Backspace':
                        if (selectedLayerIndex >= 0) {
                            e.preventDefault();
                            handleDeleteLayer();
                        }
                        break;
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [appStep, isKioskLocked, isSettingsOpen, isUiPanelOpen, showPrinterPanel, selectedLayerIndex]);

    // Guest Communication Listener
    useEffect(() => {
        // Load persisted settings & session on boot
        (async () => {
            try {
                const persisted = await loadLatestSettings<AppSettings>();
                if (persisted) {
                    setSettings(prev => ({ ...persisted, pro: { ...prev.pro, ...persisted.pro } }));
                }
                const lastSession = await loadLatestSession<PhotoboothSession>();
                if (lastSession) {
                    setSession(lastSession);
                }
            } catch (error) {
                console.error('Failed to load persisted data:', error);
            } finally {
                setIsInitializing(false);
            }
        })();
        const channel = new BroadcastChannel('photobooth_channel');
        channelRef.current = channel;

        const validateInterWindowMessage = (msg: any): msg is InterWindowMessage => {
            if (!msg || typeof msg !== 'object') return false;
            if (msg.type === 'GUEST_ACTION') {
                const p = msg.payload;
                if (!p || typeof p !== 'object' || typeof p.type !== 'string') return false;
                const allowed = ['GUEST_START','GUEST_SELECT_LAYOUT','GUEST_SELECT_FRAME','GUEST_EMAIL','GUEST_PRINT','GUEST_ADD_DRAWING','GUEST_SET_FILTER','GUEST_PAYMENT_COMPLETE'];
                if (!allowed.includes(p.type)) return false;
                if (p.type === 'GUEST_EMAIL' && (typeof p.email !== 'string' || p.email.length > 200)) return false;
                if (p.type === 'GUEST_SELECT_LAYOUT' && typeof p.layout !== 'string') return false;
                if (p.type === 'GUEST_SELECT_FRAME' && typeof p.frameSrc !== 'string') return false;
            }
            return ['SET_STATE','GET_STATE','GUEST_ACTION'].includes(msg.type);
        };
        const handleGuestAction = (event: MessageEvent<InterWindowMessage>) => {
            if (!validateInterWindowMessage(event.data)) return; // silently ignore invalid
            if (event.data.type === 'GUEST_ACTION') {
                const action = event.data.payload;
                handleGuestActionDispatch(action);
            }
        };
        channel.addEventListener('message', handleGuestAction);

        return () => {
            channel.removeEventListener('message', handleGuestAction);
            channel.close();
        };
    }, [settings.placeholders, session, settings.layoutOptions]); // Dependency on settings/session for callbacks

    useEffect(() => {
        const events = ['pointermove', 'keydown', 'click'];
        events.forEach(ev => window.addEventListener(ev, handleActivity));
        return () => { events.forEach(ev => window.removeEventListener(ev, handleActivity)); };
    }, [isKioskLocked]);
    useEffect(() => {
        if (!settings.kioskMode || !settings.autoResetTimer) return;
        const interval = setInterval(() => {
            if (isSettingsOpen) return; // don't lock while actively editing settings
            const idleMs = Date.now() - lastActivityRef.current;
            if (!isKioskLocked && idleMs > settings.autoResetTimer * 1000) {
                setIsKioskLocked(true);
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [settings.kioskMode, settings.autoResetTimer, isSettingsOpen, isKioskLocked]);
    const attemptUnlock = () => {
        if (unlockAttemptPin === (settings.kioskPin || '')) {
            setIsKioskLocked(false);
            setUnlockAttemptPin('');
            lastActivityRef.current = Date.now();
            addToast('Unlocked successfully', 'success');
        } else {
            addToast('Incorrect PIN', 'error');
        }
    };

    const handleGuestActionDispatch = (action: GuestAction) => {
        switch (action.type) {
            case 'GUEST_START':
                // Reset session and move to Config
                setSession({ isActive: true, photos: [], stickers: [], textLayers: [], drawings: [], filter: '', isPaid: false });
                setAnalytics(prev => ({ ...prev, totalSessions: prev.totalSessions + 1 }));
                sendMessage({ mode: GuestScreenMode.CONFIG_SELECTION, layoutOptions: settings.layoutOptions });
                break;
            case 'GUEST_SELECT_LAYOUT':
                setGuestLayoutId(action.layout);
                if (action.layout !== 'custom') {
                    applyPresetLayout(action.layout);
                }

                // Filter frames that support this layout AND are visible
                const compatibleFrames = settings.availableFrames.filter(f =>
                    f.isVisible && f.supportedLayouts.some(sl => sl.layoutId === action.layout)
                );

                // Check if we have multiple frames to choose from
                if (compatibleFrames.length > 0) {
                    sendMessage({
                        mode: GuestScreenMode.FRAME_SELECTION,
                        availableFrames: compatibleFrames
                    });
                } else {
                    // If no frames explicitly support it, maybe show all? Or show none?
                    // For now, if no frames match, we might want to fallback to default or show error.
                    // But let's assume if no frames match, we just proceed with default frame (if any) or generic.
                    // Actually, if compatibleFrames is empty, it means no frame supports this layout.
                    // We should probably just proceed with the layout on a blank canvas or default frame if it supports it.
                    // Let's just proceed to photo upload with current frame if it matches, or just generic.

                    setAppStep(AppStep.PHOTO_UPLOAD);
                    sendMessage({
                        mode: GuestScreenMode.LIVE_PREVIEW,
                        frameSrc: settings.frameSrc,
                        placeholders: settings.placeholders,
                        aspectRatio: settings.aspectRatio,
                        proSettings: settings.pro
                    });
                }
                break;
            case 'GUEST_SELECT_FRAME':
                // Find the frame config
                const selectedFrame = settings.availableFrames.find(f => f.thumbnailSrc === action.frameSrc);

                if (selectedFrame) {
                    // Try to find the layout that matches the current one
                    // We need `currentLayoutId`. I will add it to AppSettings in a separate step or infer it.
                    // For now, let's just use the first supported layout as a fallback.
                    setSettings(prev => ({
                        ...prev,
                        frameSrc: selectedFrame.thumbnailSrc,
                        // placeholders: selectedFrame.supportedLayouts[0].placeholders // Placeholder logic needs refinement
                    }));
                } else {
                    setSettings(prev => ({ ...prev, frameSrc: action.frameSrc }));
                }

                setAppStep(AppStep.PHOTO_UPLOAD);
                sendMessage({
                    mode: GuestScreenMode.LIVE_PREVIEW,
                    frameSrc: action.frameSrc,
                    placeholders: settings.placeholders, // This needs to be updated based on frame + layout
                    aspectRatio: settings.aspectRatio,
                    proSettings: settings.pro
                });
                break;
            case 'GUEST_EMAIL':
                if (action.email && !analytics.emailsCollected.includes(action.email)) {
                    setAnalytics(prev => ({ ...prev, emailsCollected: [...prev.emailsCollected, action.email] }));
                }
                break;
            case 'GUEST_PRINT':
                handlePrint();
                break;
            case 'GUEST_ADD_DRAWING':
                const newDrawings = [...session.drawings, action.drawing];
                updateSessionWithHistory({ ...session, drawings: newDrawings });
                break;
            case 'GUEST_SET_FILTER':
                updateSessionWithHistory({ ...session, filter: action.filter });
                break;
            case 'GUEST_PAYMENT_COMPLETE':
                setSession(prev => ({ ...prev, isPaid: true }));
                setAnalytics(prev => ({ ...prev, totalRevenue: prev.totalRevenue + settings.pro.pricePerPrint }));
                handlePrintInternal(); // Proceed to print after payment
                break;
        }
    };

    const applyPresetLayout = (type: string) => {
        if (type === 'custom') return;

        const layout = settings.layoutOptions.find(l => l.id === type);
        if (layout) {
            setSettings(prev => ({ ...prev, placeholders: layout.placeholders }));
        }
    };

    // Broadcast placeholder changes to guest window when organizer edits active guest layout
    // Throttled broadcast of organizer edits to active guest layout
    useEffect(() => {
        if (!guestWindow || !guestLayoutId) return;
        const now = Date.now();
        if (now - lastGuestBroadcastRef.current < BROADCAST_INTERVAL_MS) return;
        lastGuestBroadcastRef.current = now;
        const activeLayout = settings.layoutOptions.find(l => l.id === guestLayoutId);
        if (!activeLayout) return;
        sendMessage({
            mode: GuestScreenMode.LIVE_PREVIEW,
            frameSrc: settings.frameSrc,
            placeholders: settings.placeholders,
            aspectRatio: settings.aspectRatio,
            proSettings: settings.pro
        });
    }, [settings.placeholders, guestLayoutId, guestWindow, settings.frameSrc, settings.aspectRatio, settings.pro, sendMessage, settings.layoutOptions]);

    // Persist settings and session (debounced)
    useEffect(() => {
        if (persistSettingsRef.current) clearTimeout(persistSettingsRef.current);
        setIsSaving(true);
        persistSettingsRef.current = window.setTimeout(() => { 
            persistSettings(settings).then(() => setIsSaving(false)).catch(() => setIsSaving(false)); 
        }, 800);
    }, [settings]);
    useEffect(() => {
        if (persistSessionRef.current) clearTimeout(persistSessionRef.current);
        setIsSaving(true);
        persistSessionRef.current = window.setTimeout(() => { 
            persistSession(session).then(() => setIsSaving(false)).catch(() => setIsSaving(false)); 
        }, 800);
    }, [session]);

    useEffect(() => {
        const gapiScript = document.querySelector<HTMLScriptElement>('script[src="https://apis.google.com/js/api.js"]');
        const gisScript = document.querySelector<HTMLScriptElement>('script[src="https://accounts.google.com/gsi/client"]');

        const gapiLoaded = () => {
            gapi.load('client:picker', () => {
                setPickerApiLoaded(true);
            });
        };

        const gisLoaded = () => {
            tokenClientRef.current = google.accounts.oauth2.initTokenClient({
                client_id: process.env.GOOGLE_CLIENT_ID,
                scope: 'https://www.googleapis.com/auth/drive.readonly',
                callback: (tokenResponse: any) => {
                    if (tokenResponse && tokenResponse.access_token) {
                        gapi.client.setToken(tokenResponse);
                        setIsSignedIn(true);
                        updateAuthInstance(tokenResponse.access_token);
                    }
                },
            });

            setGapiAuthInstance({
                signIn: () => tokenClientRef.current?.requestAccessToken({ prompt: '' }),
                signOut: () => { },
                currentUser: null,
                clientId: process.env.GOOGLE_CLIENT_ID,
            });

            setIsGapiReady(true);
        };

        const updateAuthInstance = async (accessToken: string) => {
            try {
                await gapi.client.load('drive', 'v3');
                const response = await gapi.client.drive.about.get({ fields: 'user' });
                const userEmail = response.result.user.emailAddress;

                setGapiAuthInstance((prev: any) => ({
                    ...prev,
                    signOut: () => {
                        google.accounts.oauth2.revoke(accessToken, () => {
                            gapi.client.setToken(null);
                            setIsSignedIn(false);
                            setGapiAuthInstance((p: any) => ({ ...p, currentUser: null }));
                        });
                    },
                    currentUser: {
                        get: () => ({
                            getBasicProfile: () => ({ getEmail: () => userEmail }),
                            getAuthResponse: () => ({ access_token: accessToken }),
                        }),
                    },
                }));

            } catch (e) {
                console.error("Error updating auth instance:", e);
            }
        };

        if (gapiScript) gapiScript.onload = gapiLoaded;
        if (gisScript) gisScript.onload = gisLoaded;

    }, []);

    useEffect(() => {
        const root = document.documentElement;
        root.style.setProperty('--color-primary', uiConfig.primaryColor);
        root.style.setProperty('--color-primary-rgb', hexToRgb(uiConfig.primaryColor));
        root.style.setProperty('--color-text-primary', uiConfig.textColor);
        root.style.setProperty('--color-background', uiConfig.backgroundColor);
        root.style.setProperty('--color-panel', uiConfig.panelColor);
        root.style.setProperty('--color-border', uiConfig.borderColor);
        root.style.fontFamily = uiConfig.fontFamily;
        if (uiConfig.highContrastMode) {
            root.style.setProperty('--color-background', '#000000');
            root.style.setProperty('--color-panel', '#000000');
            root.style.setProperty('--color-text-primary', '#ffffff');
            root.style.setProperty('--color-border', '#ffffff');
        }
        if (uiConfig.backgroundSrc) {
            root.style.setProperty('--background-image', `url(${uiConfig.backgroundSrc})`);
        } else {
            root.style.setProperty('--background-image', 'none');
        }
    }, [uiConfig]);

    // Apply locale changes to global i18n system
    useEffect(() => {
        if (settings.locale) {
            setLocale(settings.locale as any);
        }
    }, [settings.locale]);

    const invalidateAiImage = () => {
        if (finalCompositeImage) setFinalCompositeImage(null);
    };

    const handleNewPhotosFromHotFolder = useCallback(async (newPhotos: Map<string, string>) => {
        if (settings.placeholders.length === 0) return;

        const canvas = finalCanvasRef.current ?? document.createElement('canvas');
        const canvasSize = { width: canvas.width, height: canvas.height };

        const sortedFiles = Array.from(newPhotos.entries()).sort((a, b) => a[0].localeCompare(b[0]));

        const newPhotoObjects: Photo[] = [];
        const existingPhotoCount = session.photos.length;
        let placeholderIndex = existingPhotoCount;

        for (const [_, url] of sortedFiles) {
            if (placeholderIndex >= settings.placeholders.length) break;

            const image = new Image();
            image.src = url;
            await new Promise(resolve => image.onload = resolve);

            const placeholder = settings.placeholders[placeholderIndex];
            const newPhoto = createPhotoFromPlaceholder(url, placeholder, canvasSize, { width: image.width, height: image.height });
            newPhotoObjects.push(newPhoto);
            placeholderIndex++;
        }

        if (newPhotoObjects.length > 0) {
            setSession(prev => {
                const updatedPhotos = [...prev.photos, ...newPhotoObjects];

                const newSessionState = { ...prev, photos: updatedPhotos };
                const newHistory = history.current.slice(0, historyIndex.current + 1);
                newHistory.push(newSessionState);
                history.current = newHistory;
                historyIndex.current = newHistory.length - 1;

                setAnalytics(prev => ({ ...prev, totalPhotosTaken: prev.totalPhotosTaken + newPhotoObjects.length }));

                sendMessage({
                    mode: GuestScreenMode.REVIEW,
                    photos: updatedPhotos,
                    frameSrc: settings.frameSrc,
                    aspectRatio: settings.aspectRatio,
                    stickers: prev.stickers,
                    textLayers: prev.textLayers,
                    drawings: prev.drawings,
                    filter: prev.filter
                });
                return newSessionState;
            });
        }
    }, [session.photos.length, settings.frameSrc, settings.placeholders, settings.aspectRatio, sendMessage]);

    const { startPolling, stopPolling } = useHotFolder(settings.hotFolderHandle, handleNewPhotosFromHotFolder);

    const handleFrameSelect = (frameFile: File, selectedLayoutIds: string[]) => {
        const url = URL.createObjectURL(frameFile);

        // Create a new FrameConfig
        const newFrameConfig: import('./types').FrameConfig = {
            id: Date.now().toString(),
            name: frameFile.name.replace('.png', ''), // Default name from filename
            thumbnailSrc: url,
            isVisible: true, // Default to visible
            supportedLayouts: (settings.layoutOptions || [])
                .filter(l => selectedLayoutIds.includes(l.id))
                .map(l => ({
                    layoutId: l.id,
                    placeholders: l.placeholders,
                    overlaySrc: url // Default overlay is the uploaded file
                }))
        };

        setSettings(s => ({
            ...s,
            frameSrc: url,
            availableFrames: [...s.availableFrames, newFrameConfig]
        }));
        setAppStep(AppStep.TEMPLATE_DESIGN);
    };

    const handleTemplateConfirm = (placeholders: Placeholder[], aspectRatio: string, finalFrameSrc?: string) => {
        const currentFrameSrc = finalFrameSrc || settings.frameSrc;

        setSettings(s => {
            // Update the specific frame's layout in availableFrames
            const updatedFrames = s.availableFrames.map(f =>
                f.thumbnailSrc === currentFrameSrc ? { ...f, placeholders } : f
            );

            return {
                ...s,
                placeholders,
                aspectRatio,
                frameSrc: currentFrameSrc,
                availableFrames: updatedFrames
            };
        });
        setAppStep(AppStep.PHOTO_UPLOAD);
    };

    const handlePhotosSelected = async (photoData: { src: string; crop: Crop }[]) => {
        const canvas = finalCanvasRef.current ?? document.createElement('canvas');
        const canvasSize = { width: canvas.width, height: canvas.height };

        const newPhotoObjects: Photo[] = [];
        for (let i = 0; i < photoData.length; i++) {
            const data = photoData[i];
            const placeholder = settings.placeholders[i];
            if (!placeholder) continue;

            const image = new Image();
            image.src = data.src;
            await new Promise(resolve => { image.onload = resolve; });

            const newPhoto = createPhotoFromPlaceholder(data.src, placeholder, canvasSize, { width: image.width, height: image.height });
            newPhoto.crop = data.crop;
            newPhotoObjects.push(newPhoto);
        }

        const newSession: PhotoboothSession = { isActive: true, photos: newPhotoObjects, stickers: [], textLayers: [], drawings: [], filter: '', isPaid: false };
        setSession(newSession);
        history.current = [newSession];
        historyIndex.current = 0;
        setAppStep(AppStep.FINALIZE_AND_EXPORT);
        setAnalytics(prev => ({ ...prev, totalPhotosTaken: prev.totalPhotosTaken + newPhotoObjects.length }));

        // Explicitly send initial state to guest window
        sendMessage({
            mode: GuestScreenMode.REVIEW,
            photos: newPhotoObjects,
            frameSrc: settings.frameSrc,
            aspectRatio: settings.aspectRatio,
            stickers: [],
            textLayers: [],
            drawings: [],
            filter: ''
        });
    };

    const handleUseHotFolder = () => {
        if (!settings.hotFolderHandle) {
            addToast("Please select a hot folder in the settings first.", 'warning');
            setIsSettingsOpen(true);
            return;
        }
        const newSession: PhotoboothSession = { isActive: true, photos: [], stickers: [], textLayers: [], drawings: [], filter: '', isPaid: false };
        setSession(newSession);
        history.current = [newSession];
        historyIndex.current = 0;
        startPolling();
        setAppStep(AppStep.FINALIZE_AND_EXPORT);
        sendMessage({ mode: GuestScreenMode.TETHER_PREVIEW, frameSrc: settings.frameSrc, placeholders: settings.placeholders, aspectRatio: settings.aspectRatio });
    };

    const handleCreateNew = () => {
        stopPolling();
        setSession({ isActive: false, photos: [], stickers: [], textLayers: [], drawings: [], filter: '', isPaid: false });
        setSelectedLayerIndex(-1);
        setFinalCompositeImage(null);
        setAiPreviewImage(null);
        setAiError(null);
        setAiPrompt('');
        setAppStep(AppStep.PHOTO_UPLOAD);
        sendMessage({ mode: GuestScreenMode.ATTRACT, frameSrc: settings.frameSrc });
    };

    const handleResetApp = () => {
        stopPolling();
        setAppStep(AppStep.FRAME_UPLOAD);
        setSettings(s => ({
            ...s,
            frameSrc: null,
            hotFolderHandle: null,
            outputDirectoryHandle: null,
            placeholders: [],
            hotFolderName: '',
            driveFolderId: null,
            driveFolderName: '',
            aspectRatio: '2 / 3',
        }));
        setSession({ isActive: false, photos: [], stickers: [], textLayers: [], drawings: [], filter: '', isPaid: false });
        setSelectedLayerIndex(-1);
        setFinalCompositeImage(null);
    };

    const handleGenerateQRCode = async () => {
        const image = await getImageForExport();
        if (!image) {
            addToast("Could not generate final image.", 'error');
            return;
        }
        sendMessage({ mode: GuestScreenMode.DELIVERY, qrCodeValue: image, frameSrc: settings.frameSrc });
    };

    const getImageForExport = useCallback(async (): Promise<string | undefined> => {
        // Prefer worker-produced composite if available, but convert to correct format
        let sourceImage = finalCompositeImage;
        if (!sourceImage) {
            const canvas = finalCanvasRef.current;
            if (!canvas) return;
            sourceImage = canvas.toDataURL('image/png');
        }
        
        // Convert to selected format if needed
        const format = EXPORT_FORMATS.find(f => f.value === exportFormat);
        if (!format || exportFormat === 'png') return sourceImage;
        
        // Convert PNG to JPEG
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = img.width;
                tempCanvas.height = img.height;
                const ctx = tempCanvas.getContext('2d');
                if (!ctx) return resolve(sourceImage);
                ctx.fillStyle = '#FFFFFF'; // white background for JPEG
                ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
                ctx.drawImage(img, 0, 0);
                resolve(tempCanvas.toDataURL(format.mimeType, format.quality));
            };
            img.src = sourceImage!;
        });
    }, [finalCompositeImage, exportFormat]);

    // Initialize compositor worker
    useEffect(() => {
        if (!useWorkerCompositor) return;
        if (compositorWorkerRef.current) return;
        try {
            const w = new Worker(new URL('./workers/compositorWorker.ts', import.meta.url), { type: 'module' });
            w.onmessage = (ev: MessageEvent<CompositorResponse>) => {
                if (ev.data?.type === 'RESULT') {
                    setFinalCompositeImage(ev.data.dataUrl);
                    setWorkerRenderMs(ev.data.renderMs);
                    workerPendingRef.current = false;
                }
            };
            compositorWorkerRef.current = w;
        } catch (err) {
            console.warn('Worker compositor unavailable, falling back to main thread canvas.', err);
            setUseWorkerCompositor(false);
        }
    }, [useWorkerCompositor]);

    // Request worker composite when visual layers change (debounced)
    useEffect(() => {
        if (!useWorkerCompositor) return;
        const w = compositorWorkerRef.current;
        if (!w) return;
        const canvas = finalCanvasRef.current;
        if (!canvas) return;
        // Avoid overlapping renders
        if (workerPendingRef.current) return;
        workerPendingRef.current = true;
        const timeout = window.setTimeout(() => {
            const msg: CompositorRequest = {
                type: 'COMPOSITE',
                width: canvas.width,
                height: canvas.height,
                photos: session.photos.map(p => ({
                    src: p.src,
                    transform: p.transform,
                    crop: p.crop,
                    originalWidth: p.originalWidth,
                    originalHeight: p.originalHeight,
                    fit: p.fit
                })),
                stickers: session.stickers.map(s => ({ id: s.id, src: s.src, x: s.x, y: s.y, width: s.width, height: s.height, rotation: s.rotation })),
                textLayers: session.textLayers.map(t => ({ id: t.id, text: t.text, x: t.x, y: t.y, fontSize: t.fontSize, fontFamily: t.fontFamily, color: t.color, rotation: t.rotation, fontWeight: t.fontWeight })),
                drawings: session.drawings.map(d => ({ id: d.id, points: d.points, color: d.color, width: d.width })),
                frameSrc: settings.frameSrc,
                frameOpacity: frameOpacity,
                filter: session.filter,
                globalPhotoScale
            };
            try { w.postMessage(msg); } catch (err) { workerPendingRef.current = false; }
        }, 150); // small debounce to batch rapid edits
        return () => clearTimeout(timeout);
    }, [session.photos, session.stickers, session.textLayers, session.drawings, settings.frameSrc, frameOpacity, session.filter, globalPhotoScale, useWorkerCompositor]);


    const generateFilename = useCallback(() => {
        const now = new Date();
        const date = now.toISOString().split('T')[0];
        const time = now.toTimeString().split(' ')[0].replace(/:/g, '-');
        const timestamp = now.getTime();
        const number = String(fileCounter.current).padStart(4, '0');
        const ext = exportFormat.startsWith('jpeg') ? 'jpg' : 'png';

        const filename = settings.fileNameTemplate
            .replace('{date}', date)
            .replace('{time}', time)
            .replace('{timestamp}', String(timestamp))
            .replace('{number}', number);

        return `${filename}.${ext}`;
    }, [settings.fileNameTemplate, exportFormat]);

    const handleDownload = useCallback(async () => {
        try {
            setIsProcessing(true);
            const image = await getImageForExport();
            if (!image) {
                addToast("Could not generate final image for download.", 'error');
                return;
            }
            const filename = generateFilename();
            if (settings.outputDirectoryHandle) {
                try {
                    const res = await fetch(image);
                    const blob = await res.blob();
                    // @ts-ignore
                    const fileHandle = await settings.outputDirectoryHandle.getFileHandle(filename, { create: true });
                    // @ts-ignore
                    const writable = await fileHandle.createWritable();
                    await writable.write(blob);
                    await writable.close();
                    addToast(`✅ Saved: ${filename}`, 'success');
                } catch (error) {
                    console.error("Error saving to directory handle:", error);
                    addToast("Failed to save to folder. Downloading via browser...", 'warning');
                    const link = document.createElement('a');
                    link.href = image;
                    link.download = filename;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    addToast(`✅ Downloaded: ${filename}`, 'success');
                }
            } else {
                const link = document.createElement('a');
                link.href = image;
                link.download = filename;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                addToast(`✅ Downloaded: ${filename}`, 'success');
            }
        } catch (error) {
            console.error('Download failed:', error);
            addToast('❌ Download failed: ' + (error as Error).message, 'error');
        } finally {
            setIsProcessing(false);
        }
        fileCounter.current += 1;
    }, [getImageForExport, generateFilename, settings.outputDirectoryHandle, addToast]);

    // Handle Print Logic (Pooling + Vending)
    const handlePrint = useCallback(() => {
        if (settings.pro.enableVending && !session.isPaid) {
            // Trigger payment flow on guest screen
            sendMessage({ mode: GuestScreenMode.PAYMENT, proSettings: settings.pro });
        } else {
            handlePrintInternal();
        }
    }, [settings.pro, session.isPaid, sendMessage]);

    const handlePrintInternal = useCallback(async () => {
        const image = await getImageForExport();
        if (!image) return;
        setAnalytics(prev => ({ ...prev, totalPrints: prev.totalPrints + 1 }));

        // Printer Pooling Logic (Round Robin Mock)
        let printerName = "Default Printer";
        let selectedPrinter: Printer | null = null;
        if (settings.pro.printerPool.length > 0) {
            selectedPrinter = settings.pro.printerPool[analytics.totalPrints % settings.pro.printerPool.length];
            printerName = selectedPrinter.name;
            setSettings(prev => {
                const pool = [...prev.pro.printerPool];
                const pIndex = pool.findIndex(p => p.id === selectedPrinter!.id);
                if (pIndex > -1) pool[pIndex].jobs++;
                return { ...prev, pro: { ...prev.pro, printerPool: pool } };
            });
            console.log(`Printing to Pool: ${printerName}`);
        }

        // Queue job entry (pending -> printing -> done)
        const jobId = Date.now().toString();
        const filename = generateFilename();
        setPrintJobs(prev => [...prev, { id: jobId, printerId: selectedPrinter ? selectedPrinter.id : null, createdAt: Date.now(), status: 'printing', filename }]);

        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(`
    < html >
                    <head><title>Print Job - ${printerName}</title></head>
                    <body style="margin:0; display:flex; justify-content:center; align-items:center; height:100vh; background-color: #f0f0f0;">
                        <div style="text-align:center;">
                            <img src="${image}" style="max-width:80vw; max-height:80vh; object-fit: contain; box-shadow: 0 0 20px rgba(0,0,0,0.2);" onload="window.print(); window.close();" />
                            <p style="margin-top:20px; font-family:sans-serif; color:#555;">Sent to: <b>${printerName}</b></p>
                        </div>
                    </body>
                </html >
    `);
            printWindow.document.close();
        }

        // Simulate async completion
        setTimeout(() => {
            setPrintJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: 'done' } : j));
        }, 2000);

        if (settings.pro.enableVending) {
            handleGenerateQRCode();
        }

    }, [getImageForExport, settings.pro.printerPool, analytics.totalPrints, settings.pro.enableVending]);

    const handleSmartCrop = (index: number) => {
        // Heuristic Smart Crop (Center Weighted with mild zoom)
        // Since we can't reliably load face-api models without external assets, we use a robust heuristic.
        const photo = session.photos[index];
        if (!photo) return;

        invalidateAiImage();

        const newPhotos = [...session.photos];
        // Heuristic: Reset to center (0.5, 0.5) but zoom in slightly (1.2x) to frame "head and shoulders"
        // This assumes typical photobooth usage where subjects are central.
        newPhotos[index] = {
            ...photo,
            crop: {
                x: 0,
                y: 0,
                scale: 1.25 // "Smart" Zoom
            }
        };
        updateSessionWithHistory({ ...session, photos: newPhotos });
    };

    const updateSessionWithHistory = (newSession: PhotoboothSession) => {
        const newHistory = history.current.slice(0, historyIndex.current + 1);
        newHistory.push(newSession);
        history.current = newHistory;
        historyIndex.current = newHistory.length - 1;
        setSession(newSession);
        // Broadcast full state to guest window including stickers and text
        sendMessage({
            mode: GuestScreenMode.REVIEW,
            photos: newSession.photos,
            frameSrc: settings.frameSrc,
            aspectRatio: settings.aspectRatio,
            stickers: newSession.stickers,
            textLayers: newSession.textLayers,
            drawings: newSession.drawings,
            filter: newSession.filter
        });
    };

    const undo = useCallback(() => {
        if (historyIndex.current > 0) {
            invalidateAiImage();
            historyIndex.current--;
            const prevSession = history.current[historyIndex.current];
            setSession(prevSession);
            addToast('Undo', 'info');
            sendMessage({
                mode: GuestScreenMode.REVIEW,
                photos: prevSession.photos,
                frameSrc: settings.frameSrc,
                aspectRatio: settings.aspectRatio,
                stickers: prevSession.stickers,
                textLayers: prevSession.textLayers,
                drawings: prevSession.drawings,
                filter: prevSession.filter
            });
        }
    }, [settings.frameSrc, settings.aspectRatio, sendMessage, addToast]);

    const redo = useCallback(() => {
        if (historyIndex.current < history.current.length - 1) {
            invalidateAiImage();
            historyIndex.current++;
            const nextSession = history.current[historyIndex.current];
            setSession(nextSession);
            addToast('Redo', 'info');
            sendMessage({
                mode: GuestScreenMode.REVIEW,
                photos: nextSession.photos,
                frameSrc: settings.frameSrc,
                aspectRatio: settings.aspectRatio,
                stickers: nextSession.stickers,
                textLayers: nextSession.textLayers,
                drawings: nextSession.drawings,
                filter: nextSession.filter
            });
        }
    }, [settings.frameSrc, settings.aspectRatio, sendMessage, addToast]);

    const handleSelectLayer = (type: 'photo' | 'sticker' | 'text', index: number) => {
        setSelectedLayerType(type);
        setSelectedLayerIndex(index);
    };

    const onPhotoUpdate = (index: number, updates: Partial<Photo>) => {
        invalidateAiImage();
        const newPhotos = [...session.photos];
        newPhotos[index] = { ...newPhotos[index], ...updates };
        updateSessionWithHistory({ ...session, photos: newPhotos });
    };

    const onReorderPhoto = (index: number, direction: 'forward' | 'backward') => {
        invalidateAiImage();
        const newPhotos = [...session.photos];
        const photoToMove = newPhotos[index];
        newPhotos.splice(index, 1);
        const newIndex = direction === 'forward' ? index + 1 : index - 1;
        newPhotos.splice(newIndex, 0, photoToMove);
        if (selectedLayerType === 'photo' && selectedLayerIndex === index) {
            setSelectedLayerIndex(newIndex);
        }
        updateSessionWithHistory({ ...session, photos: newPhotos });
    };

    const handleAddSticker = (src: string) => {
        invalidateAiImage();
        const newSticker: StickerLayer = {
            id: Date.now().toString(),
            src,
            x: 0.5 + (Math.random() - 0.5) * 0.1,
            y: 0.5 + (Math.random() - 0.5) * 0.1,
            width: 0.2,
            height: 0.2,
            rotation: 0,
        };
        const newSession = { ...session, stickers: [...session.stickers, newSticker] };
        updateSessionWithHistory(newSession);
        handleSelectLayer('sticker', newSession.stickers.length - 1);
    };

    const handleUpdateSticker = (index: number, updates: Partial<StickerLayer>) => {
        invalidateAiImage();
        const newStickers = [...session.stickers];
        newStickers[index] = { ...newStickers[index], ...updates };
        updateSessionWithHistory({ ...session, stickers: newStickers });
    };

    const handleAddText = () => {
        invalidateAiImage();
        const newText: TextLayer = {
            id: Date.now().toString(),
            text: "Double Click to Edit",
            x: 0.5,
            y: 0.5,
            fontSize: 0.05,
            fontFamily: uiConfig.fontFamily || "Arial",
            color: uiConfig.primaryColor,
            rotation: 0,
            fontWeight: 'bold',
        };
        const newSession = { ...session, textLayers: [...session.textLayers, newText] };
        updateSessionWithHistory(newSession);
        handleSelectLayer('text', newSession.textLayers.length - 1);
    };

    const handleUpdateText = (index: number, updates: Partial<TextLayer>) => {
        invalidateAiImage();
        const newTexts = [...session.textLayers];
        const sanitize = (value: string): string => {
            const stripped = value.replace(/<[^>]*>/g, ''); // remove HTML tags
            return stripped.slice(0, 300); // limit length
        };
        const safeUpdates = { ...updates } as Partial<TextLayer>;
        if (typeof safeUpdates.text === 'string') safeUpdates.text = sanitize(safeUpdates.text);
        newTexts[index] = { ...newTexts[index], ...safeUpdates };
        updateSessionWithHistory({ ...session, textLayers: newTexts });
    };

    const handleDeleteLayer = () => {
        invalidateAiImage();
        if (selectedLayerType === 'sticker') {
            const newStickers = session.stickers.filter((_, i) => i !== selectedLayerIndex);
            updateSessionWithHistory({ ...session, stickers: newStickers });
        } else if (selectedLayerType === 'text') {
            const newTexts = session.textLayers.filter((_, i) => i !== selectedLayerIndex);
            updateSessionWithHistory({ ...session, textLayers: newTexts });
        }
        setSelectedLayerIndex(-1);
    };

    const handleOperatorImportSticker = (file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            if (e.target?.result) {
                setAvailableStickers(prev => [...prev, e.target!.result as string]);
            }
        };
        reader.readAsDataURL(file);
    };

    const handleOpacityChange = (opacity: number) => {
        invalidateAiImage();
        setFrameOpacity(opacity);
    };

    const handleGlobalScaleChange = (scale: number) => {
        invalidateAiImage();
        setGlobalPhotoScale(scale);
    };

    // AI Editing Generation
    const handleAiGenerate = async () => {
        if (!ai) {
            setAiError("AI features are disabled.");
            return;
        }
        if (!aiPrompt.trim()) {
            setAiError("Please enter a prompt to describe your edit.");
            return;
        }
        setAiError(null);
        setIsAiLoading(true);
        setAiPreviewImage(null);

        try {
            const imageForEdit = await getImageForExport();
            if (!imageForEdit) {
                throw new Error("Could not get the current image to edit.");
            }
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image',
                contents: {
                    parts: [
                        {
                            inlineData: {
                                data: imageForEdit.split(',')[1],
                                mimeType: 'image/png',
                            },
                        },
                        { text: aiPrompt },
                    ],
                },
                config: { responseModalities: [Modality.IMAGE] },
            });

            const firstPart = response.candidates?.[0]?.content?.parts?.[0];
            if (firstPart && firstPart.inlineData) {
                const resultBase64 = firstPart.inlineData.data;
                const resultUrl = `data: image / png; base64, ${resultBase64} `;
                setAiPreviewImage(resultUrl);
            } else {
                throw new Error("AI did not return an image. Please try again.");
            }
        } catch (err) {
            console.error("AI Generation Error:", err);
            setAiError((err as Error).message);
        } finally {
            setIsAiLoading(false);
        }
    };

    // AI Sticker Generation
    const handleAiGenerateSticker = async () => {
        if (!ai) {
            setAiStickerError("AI features are disabled.");
            return;
        }
        if (!aiStickerPrompt.trim()) {
            setAiStickerError("Please enter a prompt for your sticker.");
            return;
        }
        setAiStickerError(null);
        setIsAiStickerLoading(true);

        try {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image',
                contents: { parts: [{ text: aiStickerPrompt }] },
                config: { responseModalities: [Modality.IMAGE] },
            });

            // Iterate parts to find the image part per instructions
            let stickerUrl: string | null = null;
            if (response.candidates?.[0]?.content?.parts) {
                for (const part of response.candidates[0].content.parts) {
                    if (part.inlineData) {
                        const base64EncodeString = part.inlineData.data;
                        stickerUrl = `data: image / png; base64, ${base64EncodeString} `;
                        break;
                    }
                }
            }

            if (stickerUrl) {
                handleAddSticker(stickerUrl);
                setAiStickerPrompt('');
            } else {
                throw new Error("AI did not return a valid image.");
            }

        } catch (err) {
            console.error("AI Sticker Generation Error:", err);
            setAiStickerError((err as Error).message);
        } finally {
            setIsAiStickerLoading(false);
        }
    };


    const handleAiAccept = () => {
        if (aiPreviewImage) {
            setFinalCompositeImage(aiPreviewImage);
            setAiPreviewImage(null);
        }
    };

    const handleAiDiscard = () => {
        setAiPreviewImage(null);
    };

    const renderFinalizeStep = () => {
        return (
            <div className="min-h-screen p-8 flex flex-col items-center">
                <UiCustomizationPanel isOpen={isUiPanelOpen} onClose={() => setIsUiPanelOpen(false)} config={uiConfig} onConfigChange={setUiConfig} />
                <SettingsPanel isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} settings={settings} onSettingsChange={setSettings} analytics={analytics} currentGuestLayoutId={guestLayoutId} />

                <header className="w-full max-w-7xl flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-4xl font-bold text-[var(--color-primary)]">{uiConfig.title}</h1>
                        <p className="opacity-70">{uiConfig.description}</p>
                    </div>
                    <div className="flex items-center gap-4">
                        {/* Undo/Redo buttons */}
                        <div className="flex gap-2 mr-2">
                            <button
                                onClick={undo}
                                disabled={historyIndex.current === 0}
                                className={`p-2 rounded-lg transition-colors ${
                                    historyIndex.current === 0
                                        ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                        : 'bg-[var(--color-panel)] hover:bg-black/20 text-white'
                                }`}
                                title="Undo (Ctrl+Z)"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                                </svg>
                            </button>
                            <button
                                onClick={redo}
                                disabled={historyIndex.current >= history.current.length - 1}
                                className={`p-2 rounded-lg transition-colors ${
                                    historyIndex.current >= history.current.length - 1
                                        ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                        : 'bg-[var(--color-panel)] hover:bg-black/20 text-white'
                                }`}
                                title="Redo (Ctrl+Y)"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6" />
                                </svg>
                            </button>
                        </div>
                        <button onClick={() => setIsUiPanelOpen(true)} className="p-2 bg-[var(--color-panel)] rounded-lg hover:bg-black/20" title="Customize UI">
                            <PaletteIcon className="w-6 h-6" />
                        </button>
                        <button
                            onClick={() => { if (!isKioskLocked) setIsSettingsOpen(true); }}
                            disabled={isKioskLocked}
                            className={`p-2 rounded-lg transition-all ${
                                isKioskLocked 
                                    ? 'bg-gray-700 cursor-not-allowed opacity-50' 
                                    : 'bg-[var(--color-panel)] hover:bg-black/20 hover:scale-105'
                            }`}
                            title={isKioskLocked ? '🔒 Locked (Kiosk Mode)' : 'Settings'}
                        ><SettingsIcon /></button>
                        {guestWindow ? (
                            <button 
                                onClick={closeGuestWindow} 
                                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all hover:scale-105 shadow-lg"
                            >
                                <span className="flex items-center gap-2">
                                    <span>🖥️</span>
                                    {t('closeGuestWindow')}
                                </span>
                            </button>
                        ) : (
                            <button 
                                onClick={openGuestWindow} 
                                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all hover:scale-105 shadow-lg"
                            >
                                <span className="flex items-center gap-2">
                                    <span>🖥️</span>
                                    {t('openGuestWindow')}
                                </span>
                            </button>
                        )}
                    </div>
                </header>

                <main className="w-full max-w-7xl flex-grow flex flex-col lg:flex-row gap-8">
                    <div className="w-full lg:w-2/3 relative">
                        <CanvasEditor
                            canvasRef={finalCanvasRef}
                            frameSrc={settings.frameSrc}
                            photos={session.photos}
                            stickers={session.stickers}
                            textLayers={session.textLayers}
                            drawings={session.drawings}
                            filter={session.filter}
                            selectedLayerType={selectedLayerType}
                            selectedLayerIndex={selectedLayerIndex}
                            onSelectLayer={handleSelectLayer}
                            onPhotoUpdate={onPhotoUpdate}
                            onStickerUpdate={handleUpdateSticker}
                            onTextUpdate={handleUpdateText}
                            frameOpacity={frameOpacity}
                            onReorderPhoto={onReorderPhoto}
                            globalPhotoScale={globalPhotoScale}
                            aspectRatio={settings.aspectRatio}
                            activeGuestLayoutPlaceholders={guestLayoutId ? settings.layoutOptions.find(l => l.id === guestLayoutId)?.placeholders : undefined}
                            onMetrics={(m) => { if (m.fps) setPerfFps(m.fps); setPerfFrameMs(m.frameMs); }}
                        />
                        {finalCompositeImage && (
                            <div className="absolute inset-0 pointer-events-none">
                                <img src={finalCompositeImage} alt="Final Composite" className="w-full h-full object-contain" />
                            </div>
                        )}
                        {aiPreviewImage && (
                            <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-4 p-4 z-20">
                                <img src={aiPreviewImage} alt="AI Preview" className="max-w-full max-h-[70%] object-contain rounded-lg border-2 border-[var(--color-primary)]" />
                                <div className="flex gap-4">
                                    <button onClick={handleAiAccept} className="px-6 py-2 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700">Accept</button>
                                    <button onClick={handleAiDiscard} className="px-6 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700">Discard</button>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="w-full lg:w-1/3">
                        <div className="flex flex-col gap-4">
                            <FinalizeControls
                                onDownload={handleDownload}
                                onPrint={handlePrint}
                                onGetImageForExport={getImageForExport}
                                onReset={handleResetApp}
                                onCreateNew={handleCreateNew}
                                frameOpacity={frameOpacity}
                                onOpacityChange={handleOpacityChange}
                                photos={session.photos}
                                selectedLayerType={selectedLayerType}
                                selectedLayerIndex={selectedLayerIndex}
                                onSelectLayer={handleSelectLayer}
                                onPhotoUpdate={onPhotoUpdate}

                                stickers={session.stickers}
                                textLayers={session.textLayers}
                                availableStickers={availableStickers}
                                onAddSticker={handleAddSticker}
                                onAddText={handleAddText}
                                onUpdateSticker={handleUpdateSticker}
                                onUpdateText={handleUpdateText}
                                onDeleteLayer={handleDeleteLayer}
                                onImportSticker={handleOperatorImportSticker}

                                onResetPhotoAdjustments={() => { }}
                                undo={undo} redo={redo}
                                canUndo={historyIndex.current > 0} canRedo={historyIndex.current < history.current.length - 1}
                                isKioskMode={false}
                                globalPhotoScale={globalPhotoScale}
                                onGlobalPhotoScaleChange={handleGlobalScaleChange}

                                // AI Edit Props
                                aiPrompt={aiPrompt}
                                onAiPromptChange={setAiPrompt}
                                onAiGenerate={handleAiGenerate}
                                isAiLoading={isAiLoading}
                                aiError={aiError}

                                // AI Sticker Props
                                aiStickerPrompt={aiStickerPrompt}
                                onAiStickerPromptChange={setAiStickerPrompt}
                                onAiGenerateSticker={handleAiGenerateSticker}
                                isAiStickerLoading={isAiStickerLoading}
                                aiStickerError={aiStickerError}

                                // Pro Features
                                enableSmartCrop={settings.pro.enableSmartCrop}
                                onSmartCrop={handleSmartCrop}
                            />
                            <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-lg p-4 space-y-3">
                                <div>
                                    <label className="block text-xs font-medium text-gray-400 mb-2">Filter Preset</label>
                                    <select
                                        value={session.filter}
                                        onChange={(e) => updateSessionWithHistory({ ...session, filter: e.target.value })}
                                        className="w-full bg-[var(--color-background)] border border-[var(--color-border)] rounded px-3 py-2 text-sm"
                                    >
                                        {FILTER_PRESETS.map(f => (
                                            <option key={f.value} value={f.value}>{f.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-400 mb-2">Export Format</label>
                                    <select
                                        value={exportFormat}
                                        onChange={(e) => setExportFormat(e.target.value)}
                                        className="w-full bg-[var(--color-background)] border border-[var(--color-border)] rounded px-3 py-2 text-sm"
                                    >
                                        {EXPORT_FORMATS.map(f => (
                                            <option key={f.value} value={f.value}>{f.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <button onClick={handleGenerateQRCode} disabled={session.photos.length === 0} className="w-full py-3 bg-blue-500 text-white font-bold rounded-lg hover:bg-blue-600 disabled:bg-gray-600">
                                {t('showQrCode')}
                            </button>
                            <button onClick={() => setShowPrinterPanel(p => !p)} className="w-full py-3 bg-gray-700 text-white font-bold rounded-lg hover:bg-gray-600">
                                {showPrinterPanel ? t('hidePrinterQueue') : t('showPrinterQueue')}
                            </button>
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    const renderSetup = () => {
        const CurrentStepComponent = {
            [AppStep.FRAME_UPLOAD]: <FrameUploader
                onFrameSelect={handleFrameSelect}
                organizerSettings={settings}
                onSettingsChange={(newSettings) => setSettings(s => ({ ...s, ...newSettings }))}
                setDirectoryHandle={(action) => setSettings(s => {
                    const handle = typeof action === 'function'
                        ? (action as (prev: FileSystemDirectoryHandle | null) => FileSystemDirectoryHandle | null)(s.outputDirectoryHandle)
                        : action;
                    return {
                        ...s,
                        outputDirectoryHandle: handle,
                        localDownloadPath: handle?.name || ''
                    };
                })}
                gapiAuthInstance={gapiAuthInstance}
                isGapiReady={isGapiReady}
                isSignedIn={isSignedIn}
                pickerApiLoaded={pickerApiLoaded}
                availableLayouts={settings.layoutOptions || []}
            />,
            [AppStep.TEMPLATE_DESIGN]: <TemplateDesigner frameSrc={settings.frameSrc} onTemplateConfirm={handleTemplateConfirm} />,
            [AppStep.PHOTO_UPLOAD]: <PhotoSelector
                onPhotosSelect={handlePhotosSelected}
                onUseHotFolder={handleUseHotFolder}
                placeholders={settings.placeholders}
                frameSrc={settings.frameSrc}
                aspectRatio={settings.aspectRatio}
                sendMessage={sendMessage}
            />,
        }[appStep];

        return (
            <div className="min-h-screen flex flex-col items-center p-4">
                <UiCustomizationPanel isOpen={isUiPanelOpen} onClose={() => setIsUiPanelOpen(false)} config={uiConfig} onConfigChange={setUiConfig} />
                <header className="w-full flex justify-center items-center absolute top-8 px-8">
                    <div className="flex-1"></div>
                    <div className="flex-1 flex justify-center">
                        <StepIndicator currentStep={appStep} />
                    </div>
                    <div className="flex-1 flex justify-end gap-2">
                        <button onClick={() => setIsSettingsOpen(true)} className="p-2 bg-[var(--color-panel)] rounded-lg hover:bg-black/20" title="Settings">
                            <SettingsIcon className="w-6 h-6" />
                        </button>
                        <button onClick={() => setIsUiPanelOpen(true)} className="p-2 bg-[var(--color-panel)] rounded-lg hover:bg-black/20" title="Customize UI">
                            <PaletteIcon className="w-6 h-6" />
                        </button>
                    </div>
                </header>
                <div className="flex-grow flex items-center justify-center w-full">
                    {CurrentStepComponent}
                </div>
            </div>
        )
    };

    return (
        <ErrorBoundary onReset={() => setSession(s => ({ ...s }))}>
            {isInitializing ? (
                <div className="min-h-screen flex items-center justify-center bg-gray-900">
                    <LoadingSpinner size="lg" />
                </div>
            ) : (
                <div className={`min-h-screen antialiased relative bg-[var(--color-background)] text-[var(--color-text-primary)] ${uiConfig.highContrastMode ? 'high-contrast' : ''}`}>    
                    <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: uiConfig.backgroundSrc ? `url(${uiConfig.backgroundSrc})` : 'none', opacity: 0.1 }}></div>
                    <div className="relative z-10">
                        {appStep === AppStep.FINALIZE_AND_EXPORT ? renderFinalizeStep() : renderSetup()}
                    {(guestLayoutId || guestWindow) && (
                        <GuestLayoutStatus
                            guestLayoutId={guestLayoutId}
                            layouts={settings.layoutOptions}
                            photosCount={session.photos.length}
                            frameSrc={settings.frameSrc}
                            placeholders={guestLayoutId ? (settings.layoutOptions.find(l => l.id === guestLayoutId)?.placeholders.length || 0) : settings.placeholders.length}
                            onOpenSettings={() => setIsSettingsOpen(true)}
                        />
                    )}
                    {guestLayoutId && session.isActive && (
                        <GuestLivePreview
                            frameSrc={settings.frameSrc}
                            placeholders={settings.placeholders}
                            photos={session.photos}
                            aspectRatio={settings.aspectRatio}
                            layoutLabel={settings.layoutOptions.find(l => l.id === guestLayoutId)?.label}
                            onClick={() => setIsSettingsOpen(true)}
                        />
                    )}
                    {showPrinterPanel && (
                        <PrinterQueuePanel
                            printers={settings.pro.printerPool}
                            jobs={printJobs}
                            onPause={(id) => setPrintJobs(prev => prev.map(j => j.id === id ? { ...j, status: 'paused' } : j))}
                            onResume={(id) => setPrintJobs(prev => prev.map(j => j.id === id ? { ...j, status: 'printing' } : j))}
                            onRemove={(id) => setPrintJobs(prev => prev.filter(j => j.id !== id))}
                            onClearCompleted={() => setPrintJobs(prev => prev.filter(j => j.status !== 'done'))}
                            onClose={() => setShowPrinterPanel(false)}
                        />
                    )}
                    <PerformanceHud fps={perfFps} frameMs={perfFrameMs} broadcastIntervalMs={BROADCAST_INTERVAL_MS} />
                    {isSaving && (
                        <div className="fixed bottom-4 left-4 z-[90] bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 flex items-center gap-2 shadow-lg animate-pulse">
                            <LoadingSpinner size="sm" />
                            <span className="text-xs text-gray-300">💾 Auto-saving...</span>
                        </div>
                    )}
                    {isProcessing && (
                        <div className="fixed bottom-4 left-4 z-[90] bg-blue-800 border border-blue-700 rounded-lg px-4 py-2 flex items-center gap-2 shadow-lg animate-pulse">
                            <LoadingSpinner size="sm" />
                            <span className="text-xs text-white">⚙️ Processing...</span>
                        </div>
                    )}
                    <ToastContainer toasts={toasts} onRemove={removeToast} />
                    </div>
                    {!isKioskLocked && (
                        <SettingsPanel
                            isOpen={isSettingsOpen}
                            onClose={() => setIsSettingsOpen(false)}
                            settings={settings}
                            onSettingsChange={setSettings}
                            analytics={analytics}
                            currentGuestLayoutId={guestLayoutId}
                        />
                    )}
                    {isKioskLocked && settings.kioskMode && (
                        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80">
                            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 w-full max-w-sm flex flex-col gap-4">
                                <h3 className="text-lg font-semibold text-white flex items-center gap-2">{t('kioskLocked')}</h3>
                                <p className="text-xs text-gray-400">Inactive for {settings.autoResetTimer}s. Enter PIN to unlock.</p>
                                <input
                                    type="password"
                                    inputMode="numeric"
                                    maxLength={6}
                                    value={unlockAttemptPin}
                                    onChange={(e) => setUnlockAttemptPin(e.target.value.replace(/[^0-9]/g, ''))}
                                    placeholder="PIN"
                                    className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white tracking-widest"
                                />
                                <div className="flex gap-2">
                                    <button onClick={attemptUnlock} disabled={!unlockAttemptPin} className={`flex-1 py-2 rounded font-semibold ${unlockAttemptPin ? 'bg-indigo-600 hover:bg-indigo-500 text-white' : 'bg-gray-700 text-gray-400'}`}>{t('unlock')}</button>
                                    <button onClick={() => { setUnlockAttemptPin(''); }} className="px-4 py-2 rounded bg-gray-700 hover:bg-gray-600 text-white">{t('clearPin')}</button>
                                </div>
                                <p className="text-[10px] text-gray-500 text-center">Settings & layout editing disabled until unlocked.</p>
                            </div>
                        </div>
                    )}
                    <UiCustomizationPanel
                        isOpen={isUiPanelOpen}
                        onClose={() => setIsUiPanelOpen(false)}
                        config={uiConfig}
                        onConfigChange={setUiConfig}
                    />
                </div>
            )}
        </ErrorBoundary>
    );
};

export default App;
