
export type OrganizerSettings = {
  driveFolderId: string | null;
  driveFolderName: string;
  fileNameTemplate: string;
  hotFolderName: string;
  localDownloadPath?: string;
  autoResetTimer?: number;
  kioskMode?: boolean;
  kioskPin?: string; // PIN required to unlock when kiosk mode auto-locks
  userRole?: 'admin' | 'operator'; // role gating sensitive actions
  locale?: string; // current UI locale key
};

export interface Printer {
  id: string;
  name: string;
  status: 'idle' | 'printing' | 'offline';
  jobs: number;
}

export interface ProSettings {
  enableVending: boolean;
  pricePerPrint: number;
  currency: string;
  printerPool: Printer[];
  iccProfileName: string | null;
  enableSmartCrop: boolean;
  liveViewLut: string; // CSS filter string for cinematic effect
}

export enum AppStep {
  FRAME_UPLOAD = 1,
  TEMPLATE_DESIGN = 2,
  PHOTO_UPLOAD = 3,
  FINALIZE_AND_EXPORT = 4,
}

export enum GuestScreenMode {
  ATTRACT = 'ATTRACT',
  CONFIG_SELECTION = 'CONFIG_SELECTION', // New: User chooses layout
  FRAME_SELECTION = 'FRAME_SELECTION', // New: User chooses frame
  TETHER_PREVIEW = 'TETHER_PREVIEW',
  LIVE_PREVIEW = 'LIVE_PREVIEW',
  COUNTDOWN = 'COUNTDOWN',
  REVIEW = 'REVIEW',
  PAYMENT = 'PAYMENT', // New: Vending mode
  DELIVERY = 'DELIVERY',
}

export interface Placeholder {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  aspectRatio: string | null;
  fit?: 'cover' | 'contain';
}

export interface Transform {
  x: number; // center x relative to canvas
  y: number; // center y relative to canvas
  width: number; // width relative to canvas
  height: number; // height relative to canvas
  rotation: number; // degrees
}

export interface Crop {
  x: number; // pan x in pixels
  y: number; // pan y in pixels
  scale: number; // zoom level
}

export interface Photo {
  src: string;
  transform: Transform;
  crop: Crop;
  originalWidth: number;
  originalHeight: number;
  fit?: 'cover' | 'contain';
}

export interface StickerLayer {
  id: string;
  src: string;
  x: number; // relative 0-1
  y: number; // relative 0-1
  width: number; // relative 0-1 (based on aspect ratio)
  height: number; // relative 0-1
  rotation: number;
}

export interface TextLayer {
  id: string;
  text: string;
  x: number; // relative 0-1
  y: number; // relative 0-1
  fontSize: number; // relative to canvas height
  fontFamily: string;
  color: string;
  rotation: number;
  fontWeight: string;
}

export interface DrawingPath {
  id: string;
  points: { x: number, y: number }[]; // normalized 0-1 coordinates
  color: string;
  width: number; // relative stroke width
}

export interface LayoutOption {
  id: string;
  label: string;
  type: 'preset' | 'custom';
  placeholders: Placeholder[];
  isActive: boolean;
  iconType: 'single' | 'grid' | 'strip' | 'custom';
  versions?: { timestamp: number; placeholders: Placeholder[]; note?: string }[]; // History for versioning
}

// Experimental plugin API for layout generation & validation
export interface LayoutPluginResult {
  placeholders: Placeholder[];
  notes?: string[];
}

export interface LayoutValidationIssue {
  message: string;
  severity: 'info' | 'warning' | 'error';
}

export interface LayoutPluginContext {
  existingLayouts: LayoutOption[];
  canvasAspectRatio: string;
}

export interface LayoutPlugin {
  id: string;
  label: string;
  version: string;
  generate?: (ctx: LayoutPluginContext, options?: Record<string, any>) => LayoutPluginResult;
  validate?: (placeholders: Placeholder[], ctx: LayoutPluginContext) => LayoutValidationIssue[];
  author?: string;
  description?: string;
}

export type RegisteredLayoutPlugin = LayoutPlugin & { enabled: boolean };

// Worker compositor messaging types
export interface CompositorPhotoLayer {
  src: string;
  transform: Transform;
  crop: Crop;
  originalWidth: number;
  originalHeight: number;
  fit?: 'cover' | 'contain';
}

export interface CompositorStickerLayer { id: string; src: string; x: number; y: number; width: number; height: number; rotation: number; }
export interface CompositorTextLayer { id: string; text: string; x: number; y: number; fontSize: number; fontFamily: string; color: string; rotation: number; fontWeight: string; }
export interface CompositorDrawingPath { id: string; points: { x: number; y: number }[]; color: string; width: number; }

export interface CompositorRequest {
  type: 'COMPOSITE';
  width: number;
  height: number;
  photos: CompositorPhotoLayer[];
  stickers: CompositorStickerLayer[];
  textLayers: CompositorTextLayer[];
  drawings: CompositorDrawingPath[];
  frameSrc: string | null;
  frameOpacity: number;
  filter: string;
  globalPhotoScale: number;
}

export interface CompositorResponse {
  type: 'RESULT';
  dataUrl: string;
  renderMs: number;
}

export interface FrameLayout {
  layoutId: string; // e.g., 'strip-3', 'grid-2x2'
  placeholders: Placeholder[];
  overlaySrc?: string; // Specific overlay for this layout
}

export interface FrameConfig {
  id: string;
  name: string; // Display name for the frame group
  thumbnailSrc: string; // Representative image
  supportedLayouts: FrameLayout[];
  isVisible: boolean; // Toggle visibility
}

export interface GuestScreenState {
  mode: GuestScreenMode;
  frameSrc?: string | null;
  photos?: Photo[];
  stickers?: StickerLayer[];
  textLayers?: TextLayer[];
  drawings?: DrawingPath[]; // New
  filter?: string; // New: CSS filter string (e.g., 'grayscale(100%)')
  qrCodeValue?: string | null;
  countdown?: number;
  placeholders?: Placeholder[];
  aspectRatio?: string;
  isFlashActive?: boolean; // New: Trigger flash animation
  proSettings?: ProSettings; // Pass pro settings to guest
  layoutOptions?: LayoutOption[]; // New: Pass available layouts to guest
  availableFrames?: FrameConfig[]; // New: Pass available frames to guest
}

export type GuestAction =
  | { type: 'GUEST_START' }
  | { type: 'GUEST_SELECT_LAYOUT', layout: string }
  | { type: 'GUEST_SELECT_FRAME', frameSrc: string } // New
  | { type: 'GUEST_EMAIL', email: string }
  | { type: 'GUEST_PRINT' }
  | { type: 'GUEST_ADD_DRAWING', drawing: DrawingPath }
  | { type: 'GUEST_SET_FILTER', filter: string }
  | { type: 'GUEST_PAYMENT_COMPLETE' };

export type InterWindowMessage = {
  type: 'SET_STATE';
  payload: GuestScreenState;
} | {
  type: 'GET_STATE';
} | {
  type: 'GUEST_ACTION'; // New: Guest -> Host communication
  payload: GuestAction;
};

export type PhotoboothSession = {
  isActive: boolean;
  photos: Photo[];
  stickers: StickerLayer[];
  textLayers: TextLayer[];
  drawings: DrawingPath[]; // New
  filter: string; // New
  isPaid?: boolean;
};

export type AppSettings = {
  frameSrc: string | null; // Keep as default/fallback
  availableFrames: FrameConfig[]; // New: List of uploaded frames
  hotFolderHandle: FileSystemDirectoryHandle | null;
  outputDirectoryHandle: FileSystemDirectoryHandle | null;
  placeholders: Placeholder[];
  aspectRatio: string;
  pro: ProSettings;
  layoutOptions: LayoutOption[];
} & OrganizerSettings;

export interface UiConfig {
  title: string;
  description: string;
  footer: string;
  logoSrc: string | null;
  backgroundSrc: string | null;
  fontFamily: string;
  primaryColor: string;
  textColor: string;
  backgroundColor: string;
  panelColor: string;
  borderColor: string;
  highContrastMode?: boolean; // accessibility toggle
}

export interface AnalyticsData {
  totalSessions: number;
  totalPhotosTaken: number;
  totalPrints: number;
  emailsCollected: string[];
  totalRevenue: number;
}
