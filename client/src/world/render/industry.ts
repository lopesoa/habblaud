import type { RoomInfo } from '../../../../shared/types';
import type { RoomTheme } from '../../art/api';
import type { Sector } from '../../../../shared/dashboard';

// Pixel-art scenery drawn natively: no external images, telemetry or generated work activity.
export function industryMotif(ctx: CanvasRenderingContext2D, sector: Sector, x: number, y: number, accent: string): void {
  const rect = (dx: number, dy: number, w: number, h: number, color: string) => { ctx.fillStyle = color; ctx.fillRect(x + dx, y + dy, w, h); };
  if (sector === 'construction') {
    rect(0, 37, 96, 4, '#404e4d'); rect(15, 3, 5, 36, accent); rect(9, 0, 65, 5, accent);
    rect(57, 5, 1, 20, '#d6e3d8'); rect(53, 24, 9, 3, '#364c50');
    for (let i = 0; i < 3; i++) for (let j = 0; j <= i; j++) rect(35 + j * 12, 33 - i * 6, 10, 5, '#c9976e');
    for (let i = 0; i < 4; i++) { rect(16, 6 + i * 7, 3, 2, '#6b713d'); }
    rect(0, 40, 100, 6, '#455157');
    for (let i = 0; i < 6; i++) rect(i * 18, 42, 9, 1, '#efdc93');
  } else if (sector === 'warehouse') {
    rect(0, 36, 100, 5, '#75634a');
    for (let i = 0; i < 3; i++) {
      rect(5 + i * 23, 9, 19, 27, '#c8c9b4'); rect(7 + i * 23, 5, 15, 5, accent);
      for (let j = 0; j < 4; j++) rect(5 + i * 23, 13 + j * 5, 19, 1, '#8e9a90');
    }
    rect(75, 26, 20, 9, accent); rect(78, 34, 5, 5, '#243d36'); rect(89, 34, 5, 5, '#243d36');
  } else if (sector === 'architecture') {
    rect(3, 36, 93, 5, '#687f78'); rect(39, 1, 34, 35, '#d6ddd5');
    for (let row = 0; row < 5; row++) for (let col = 0; col < 3; col++) rect(43 + col * 10, 5 + row * 6, 6, 4, accent);
    rect(4, 18, 30, 17, '#405e71');
    for (let i = 0; i < 4; i++) rect(7 + i * 6, 21, 1, 12, '#a3c7ca');
    rect(7, 25, 24, 1, '#a3c7ca');
  } else if (sector === 'port') {
    rect(0, 26, 100, 16, '#287c94'); rect(0, 37, 100, 2, '#50b3ca');
    rect(10, 29, 72, 8, '#233f5a'); rect(18, 22, 56, 8, '#edf1dc'); rect(55, 15, 13, 8, '#d7e2db');
    rect(20, 15, 14, 9, accent); rect(35, 15, 15, 9, '#c99a5c');
    rect(4, 2, 3, 23, '#d9b86a'); rect(4, 2, 42, 3, '#d9b86a'); rect(42, 5, 1, 10, '#dbe6e0');
  } else if (sector === 'food') {
    rect(0, 35, 98, 5, '#50645f'); rect(6, 8, 21, 26, accent); rect(10, 12, 13, 8, '#dde5cd');
    rect(30, 28, 62, 5, '#778e89');
    for (let i = 0; i < 5; i++) { rect(33 + i * 11, 31, 5, 4, '#273f39'); rect(34 + i * 11, 18, 8, 10, i % 2 ? '#ddc493' : '#e7e6cc'); rect(36 + i * 11, 21, 4, 2, accent); }
  } else if (sector === 'agro') {
    rect(0, 25, 99, 16, '#625a39');
    for (let row = 0; row < 3; row++) for (let col = 0; col < 8; col++) { rect(4 + col * 12, 27 + row * 5, 6, 2, '#8fb650'); rect(7 + col * 12, 26 + row * 5, 1, 5, '#b2d374'); if(col>4) rect(5+col*12,25+row*5,4,3,'#eee8d4'); }
    for (let i = 0; i < 4; i++) { rect(53 + i * 11, 10, 2, 14, '#60924d'); rect(51 + i * 11, 12, 5, 7, '#e4c56e'); }
    rect(10, 16, 31, 10, accent); rect(18, 6, 14, 12, '#638f66'); rect(21, 8, 9, 7, '#9ac4b2');
    rect(12, 23, 9, 9, '#273936'); rect(32, 24, 7, 7, '#273936');
  } else {
    rect(3, 35, 92, 5, '#546c6c'); rect(21, 1, 54, 34, '#334b68');
    for (let row = 0; row < 4; row++) for (let col = 0; col < 5; col++) rect(26 + col * 9, 5 + row * 7, 5, 4, (row + col) % 2 ? '#b9dbd3' : accent);
    rect(43, 29, 11, 7, '#adc6c1'); rect(14, 19, 7, 16, '#5f8f61'); rect(75, 19, 7, 16, '#5f8f61');
  }
}

export function drawIndustryRoom(ctx: CanvasRenderingContext2D, room: RoomInfo, box: { x: number; y: number; w: number; h: number }): void {
  if (!room.sector) return;
  const color = room.accent || '#77b69b';
  ctx.save();
  ctx.beginPath(); ctx.rect(box.x + 3, box.y + 3, box.w - 6, box.h - 6); ctx.clip();
  ctx.globalAlpha = 0.12; ctx.fillStyle = color; ctx.fillRect(box.x + 3, box.y + 3, box.w - 6, box.h - 6);
  ctx.globalAlpha = 1;
  // Dedicated enterprise display on the floor. Occupancy and paths are unaffected.
  const x = box.x + Math.max(5, box.w - 108), y = box.y + Math.max(5, box.h - 53);
  ctx.fillStyle = '#263e39'; ctx.fillRect(x - 3, y - 3, 105, 47);
  ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.strokeRect(x - 3, y - 3, 105, 47);
  industryMotif(ctx, room.sector, x, y, color);
  ctx.restore();
}

export function industryRoomTheme(info: RoomInfo, base: RoomTheme): RoomTheme {
  if (!info.sector) return base;
  const colors: Record<Sector, [string, string, string]> = {
    warehouse: ['#a89f81', '#968b6d', '#e9e4d6'], architecture: ['#a1b1ac', '#8f9f9a', '#e7eeea'],
    office: ['#8c9cae', '#8293a8', '#e5e9ef'], construction: ['#b6a17f', '#a68e6b', '#eee5d1'],
    port: ['#759ca5', '#618994', '#dce9e9'], food: ['#c5b18b', '#b6a17a', '#f0eada'], agro: ['#8da778', '#779264', '#e5ebd8'],
  };
  const [carpet, carpet2, wall] = colors[info.sector];
  return { ...base, carpet, carpet2, accent: info.accent || base.accent,
    wall: { ...base.wall, base: wall, trim: info.accent || base.wall.trim } };
}
