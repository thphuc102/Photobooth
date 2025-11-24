export type LocaleKey = 'en' | 'vi';

const dictionaries: Record<LocaleKey, Record<string,string>> = {
  en: {
    settings: 'Settings',
    customizeUi: 'Customize UI',
    close: 'Close',
    highContrast: 'High Contrast',
    generateSuggestions: 'Generate Suggestions',
    exportJson: 'Export JSON',
    importJson: 'Import JSON',
    layoutPresets: 'Layout Presets',
    revert: 'Revert',
    edit: 'Edit',
    updateCheck: 'Check Updates',
    plugins: 'Plugins',
    runPlugin: 'Run Plugin',
    diffLayouts: 'Diff Layouts',
    layoutPlugins: 'Layout Plugins',
    offlineNotice: 'Offline – limited functionality',
    openGuestWindow: 'Open Guest Window',
    closeGuestWindow: 'Close Guest Window',
    showQrCode: 'Show QR Code on Guest Screen',
    showPrinterQueue: 'Show Printer Queue',
    hidePrinterQueue: 'Hide Printer Queue',
    kioskLocked: 'Kiosk Locked',
    unlock: 'Unlock',
    clearPin: 'Clear',
    enablePlugin: 'Enable',
    disablePlugin: 'Disable',
    aiSuggestLayout: 'AI Suggest Layout',
  },
  vi: {
    settings: 'Cài đặt',
    customizeUi: 'Tùy chỉnh giao diện',
    close: 'Đóng',
    highContrast: 'Tương phản cao',
    generateSuggestions: 'Tạo gợi ý',
    exportJson: 'Xuất JSON',
    importJson: 'Nhập JSON',
    layoutPresets: 'Bố cục',
    revert: 'Hoàn tác',
    edit: 'Sửa',
    updateCheck: 'Kiểm tra cập nhật',
    plugins: 'Plugin',
    runPlugin: 'Chạy Plugin',
    diffLayouts: 'So sánh bố cục',
    layoutPlugins: 'Plugin Bố cục',
    offlineNotice: 'Ngoại tuyến – hạn chế chức năng',
    openGuestWindow: 'Mở cửa sổ khách',
    closeGuestWindow: 'Đóng cửa sổ khách',
    showQrCode: 'Hiển thị QR trên màn khách',
    showPrinterQueue: 'Hiển thị hàng in',
    hidePrinterQueue: 'Ẩn hàng in',
    kioskLocked: 'Chế độ kiosk bị khóa',
    unlock: 'Mở khóa',
    clearPin: 'Xóa',
    enablePlugin: 'Bật',
    disablePlugin: 'Tắt',
    aiSuggestLayout: 'Gợi ý bố cục AI',
  }
};

let currentLocale: LocaleKey = 'en';

export function setLocale(l: LocaleKey) { currentLocale = l; }
export function t(key: string) { return dictionaries[currentLocale][key] || key; }
export function getLocale() { return currentLocale; }
export function availableLocales() { return Object.keys(dictionaries) as LocaleKey[]; }
