/**
 * Helper functions for converting between HEX, RGB, and HSV color formats
 */

export interface RGB {
  r: number; // 0-255
  g: number; // 0-255
  b: number; // 0-255
}

export interface HSV {
  h: number; // 0-360
  s: number; // 0-100
  v: number; // 0-100
}

export function isValidHex(hex: string): boolean {
  return /^#?([0-9A-F]{3}){1,2}$/i.test(hex);
}

export function formatHex(hex: string): string {
  let cleaned = hex.trim().replace(/^#/, '');
  if (cleaned.length === 3) {
    cleaned = cleaned.split('').map(c => c + c).join('');
  }
  if (cleaned.length === 6) {
    return `#${cleaned.toUpperCase()}`;
  }
  return hex;
}

export function hexToRgb(hex: string): RGB {
  const formatted = formatHex(hex).replace('#', '');
  if (formatted.length !== 6) {
    return { r: 129, g: 140, b: 248 }; // Default fallback (#818CF8)
  }
  const num = parseInt(formatted, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  const hex = ((1 << 24) + (clamp(r) << 16) + (clamp(g) << 8) + clamp(b))
    .toString(16)
    .slice(1)
    .toUpperCase();
  return `#${hex}`;
}

export function rgbToHsv(r: number, g: number, b: number): HSV {
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;

  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  const delta = max - min;

  let h = 0;
  let s = max === 0 ? 0 : delta / max;
  let v = max;

  if (delta !== 0) {
    if (max === rNorm) {
      h = ((gNorm - bNorm) / delta) % 6;
    } else if (max === gNorm) {
      h = (bNorm - rNorm) / delta + 2;
    } else {
      h = (rNorm - gNorm) / delta + 4;
    }
    h = Math.round(h * 60);
    if (h < 0) h += 360;
  }

  return {
    h: Math.round(h),
    s: Math.round(s * 100),
    v: Math.round(v * 100)
  };
}

export function hsvToRgb(h: number, s: number, v: number): RGB {
  const sNorm = s / 100;
  const vNorm = v / 100;

  const c = vNorm * sNorm;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = vNorm - c;

  let rNorm = 0, gNorm = 0, bNorm = 0;

  if (h >= 0 && h < 60) {
    rNorm = c; gNorm = x; bNorm = 0;
  } else if (h >= 60 && h < 120) {
    rNorm = x; gNorm = c; bNorm = 0;
  } else if (h >= 120 && h < 180) {
    rNorm = 0; gNorm = c; bNorm = x;
  } else if (h >= 180 && h < 240) {
    rNorm = 0; gNorm = x; bNorm = c;
  } else if (h >= 240 && h < 300) {
    rNorm = x; gNorm = 0; bNorm = c;
  } else if (h >= 300 && h <= 360) {
    rNorm = c; gNorm = 0; bNorm = x;
  }

  return {
    r: Math.round((rNorm + m) * 255),
    g: Math.round((gNorm + m) * 255),
    b: Math.round((bNorm + m) * 255)
  };
}

export function hsvToHex(h: number, s: number, v: number): string {
  const rgb = hsvToRgb(h, s, v);
  return rgbToHex(rgb.r, rgb.g, rgb.b);
}

export function hexToHsv(hex: string): HSV {
  const rgb = hexToRgb(hex);
  return rgbToHsv(rgb.r, rgb.g, rgb.b);
}
