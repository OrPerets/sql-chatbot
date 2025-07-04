// Browser fingerprinting utility for exam security
export interface BrowserFingerprint {
  userAgent: string;
  screenResolution: string;
  timezone: string;
  language: string;
  platform: string;
  cookieEnabled: boolean;
  doNotTrack: string | null;
  timestamp: number;
}

export function generateBrowserFingerprint(): BrowserFingerprint {
  return {
    userAgent: navigator.userAgent,
    screenResolution: `${screen.width}x${screen.height}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    language: navigator.language,
    platform: navigator.platform,
    cookieEnabled: navigator.cookieEnabled,
    doNotTrack: navigator.doNotTrack,
    timestamp: Date.now()
  };
}

export function fingerprintMatches(fp1: BrowserFingerprint, fp2: BrowserFingerprint): boolean {
  // More lenient matching - only check critical fields
  return fp1.userAgent === fp2.userAgent &&
         fp1.screenResolution === fp2.screenResolution &&
         fp1.platform === fp2.platform;
}

export function fingerprintToString(fp: BrowserFingerprint): string {
  return `${fp.userAgent}_${fp.screenResolution}_${fp.platform}`;
} 