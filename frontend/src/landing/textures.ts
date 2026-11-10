import * as THREE from 'three';
import { rng } from './layout';

// Every texture is drawn on a 2D canvas: no font or image downloads, works offline.

export function canvasTexture(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext('2d')!);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

const FONT = '"Plus Jakarta Sans", "Segoe UI", system-ui, sans-serif';

export function labelTexture(
  title: string,
  { sub, bg = '#0b2b26', fg = '#ffffff', accent, width = 1024, height = 256 }: { sub?: string; bg?: string; fg?: string; accent?: string; width?: number; height?: number } = {},
) {
  return canvasTexture(width, height, (ctx) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);
    if (accent) {
      ctx.fillStyle = accent;
      ctx.fillRect(0, height - height * 0.08, width, height * 0.08);
    }
    ctx.fillStyle = fg;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const titleSize = Math.min(height * (sub ? 0.42 : 0.56), (width * 1.6) / Math.max(title.length, 4));
    ctx.font = `800 ${titleSize}px ${FONT}`;
    ctx.fillText(title, width / 2, sub ? height * 0.4 : height * 0.5);
    if (sub) {
      ctx.globalAlpha = 0.85;
      ctx.font = `600 ${Math.min(height * 0.2, (width * 1.7) / Math.max(sub.length, 4))}px ${FONT}`;
      ctx.fillText(sub, width / 2, height * 0.74);
    }
  });
}

/** Offroad dirt track: packed earth, two darker tyre ruts, grassy middle, pebbles. Repeats along the track. */
export function dirtTrackTexture() {
  const texture = canvasTexture(128, 512, (ctx) => {
    ctx.fillStyle = '#9b7a52';
    ctx.fillRect(0, 0, 128, 512);
    const random = rng(7);
    for (const x of [26, 86]) {
      ctx.fillStyle = 'rgba(92, 66, 40, 0.55)';
      ctx.fillRect(x, 0, 18, 512);
    }
    ctx.fillStyle = 'rgba(110, 140, 70, 0.45)';
    ctx.fillRect(54, 0, 22, 512);
    for (const x of [0, 116]) {
      ctx.fillStyle = 'rgba(110, 140, 70, 0.5)';
      ctx.fillRect(x, 0, 12, 512);
    }
    for (let i = 0; i < 2200; i++) {
      const v = random();
      ctx.fillStyle = v < 0.5 ? 'rgba(70,50,30,0.35)' : v < 0.8 ? 'rgba(200,180,150,0.45)' : 'rgba(120,150,80,0.5)';
      const size = 1 + random() * 2.5;
      ctx.fillRect(random() * 128, random() * 512, size, size);
    }
  });
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

export function plankTexture() {
  return canvasTexture(64, 64, (ctx) => {
    ctx.fillStyle = '#8b5a2b';
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = '#6b4220';
    for (let x = 0; x < 64; x += 16) ctx.fillRect(x, 0, 2, 64);
    ctx.fillStyle = 'rgba(255,220,170,0.12)';
    ctx.fillRect(4, 0, 6, 64);
    ctx.fillRect(36, 0, 6, 64);
  });
}

export function stripeTexture() {
  return canvasTexture(16, 64, (ctx) => {
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = i % 2 ? '#f8fafc' : '#f97316';
      ctx.fillRect(0, i * 16, 16, 16);
    }
  });
}

export function waterTexture() {
  const texture = canvasTexture(256, 256, (ctx) => {
    ctx.fillStyle = '#3d8fae';
    ctx.fillRect(0, 0, 256, 256);
    const random = rng(11);
    ctx.lineCap = 'round';
    for (let i = 0; i < 90; i++) {
      ctx.strokeStyle = `rgba(220,245,255,${0.08 + random() * 0.22})`;
      ctx.lineWidth = 1 + random() * 2.5;
      const x = random() * 256;
      const y = random() * 256;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + 10, y + 6 * (random() - 0.5), x + 18 + random() * 20, y);
      ctx.stroke();
    }
  });
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

export function facadeTexture({ wall, glass, cols, rows, frame = '#ffffff' }: { wall: string; glass: string; cols: number; rows: number; frame?: string }) {
  return canvasTexture(512, 256, (ctx) => {
    ctx.fillStyle = wall;
    ctx.fillRect(0, 0, 512, 256);
    const cw = 512 / cols;
    const rh = 256 / rows;
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        ctx.fillStyle = frame;
        ctx.fillRect(c * cw + cw * 0.18, r * rh + rh * 0.2, cw * 0.64, rh * 0.56);
        ctx.fillStyle = glass;
        ctx.fillRect(c * cw + cw * 0.22, r * rh + rh * 0.25, cw * 0.56, rh * 0.46);
      }
    }
  });
}

export function flagTexture() {
  return canvasTexture(64, 64, (ctx) => {
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(0, 0, 64, 32);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 32, 64, 32);
  });
}
