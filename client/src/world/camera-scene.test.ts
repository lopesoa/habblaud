import { describe, expect, it } from 'vitest';
import { Camera, officeSceneRect, overviewFrame } from './camera';

describe('enquadramento do cenário empresarial', () => {
  it.each([[1534,793,1], [1366,768,1.25], [1920,1080,1], [800,700,2]])('mostra navio e pátio em %sx%s (dpr %s)', (w,h,dpr) => {
    const scene = officeSceneRect({ x: 0, y: 0, w: 1024, h: 464 }, true);
    const camera = new Camera(); camera.setView(w,h,dpr);
    camera.insets = { top: 64, right: 0, bottom: 230, left: 312 };
    camera.bounds = { x: scene.x-112, y: scene.y-96, w: scene.w+224, h: scene.h+288 };
    const f = overviewFrame(scene,w,h,camera.insets);
    camera.minZoom = Math.min(1,Math.max(0.1,f.zoom));
    camera.zoom = Math.max(camera.minZoom,f.zoom);
    const center = camera.centerFor(f.cx,f.cy,camera.zoom);
    camera.x=center.x; camera.y=center.y-f.dy/camera.zoom; camera.clamp();
    expect(camera.minZoom).toBeLessThan(1);
    for (const [x,y] of [[512,-174],[512,664],[0,0],[1024,464]]) {
      const screen=camera.worldToScreen(x,y);
      expect(screen.x).toBeGreaterThanOrEqual(camera.insets.left-1);
      expect(screen.x).toBeLessThanOrEqual(w-camera.insets.right+1);
      expect(screen.y).toBeGreaterThanOrEqual(camera.insets.top-1);
      expect(screen.y).toBeLessThanOrEqual(h-camera.insets.bottom+1);
    }
  });
});
