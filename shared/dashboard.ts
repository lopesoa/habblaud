import type { AppearanceParts } from '../shared/appearance';

export const SECTORS = ['office', 'construction', 'port', 'food', 'agro', 'warehouse', 'architecture'] as const;
export type Sector = (typeof SECTORS)[number];
export interface Company { id: string; name: string; sector: Sector; color: string }
export interface Character { id: string; name: string; look: 'f' | 'm'; seed: number; parts: AppearanceParts }
export interface Project { path: string; name: string; visible: boolean; company: string; characters: string[] }
export interface DashboardConfig { version: 1; projects: Project[]; characters: Character[]; companies: Company[]; accounts: string[] }

export function projectKey(path: string): string {
  let p = path.trim().replace(/\\/g, '/').replace(/\/+$/, '');
  p = p.replace(/^\/mnt\/([a-z])\//i, (_, drive: string) => `${drive}:/`);
  return /^[a-z]:/i.test(p) ? p.toLowerCase() : p;
}

export function defaultDashboard(): DashboardConfig {
  return { version: 1, projects: [], accounts: ['.codex'], characters: [], companies: [
    { id: 'construction', name: 'Cavalca Construções', sector: 'construction', color: '#ffcc43' },
    { id: 'export', name: 'Cavalca Trading', sector: 'port', color: '#b7d718' },
    { id: 'cimbessul', name: 'Cimbessul', sector: 'port', color: '#323e88' },
    { id: 'agro', name: 'AgroCavalca', sector: 'agro', color: '#a4c52d' },
    { id: 'holding', name: 'Cavalca Holding — CSC', sector: 'office', color: '#f9b334' },
    { id: 'company6', name: 'CAP — Administração Portuária', sector: 'port', color: '#12445e' },
    { id: 'company7', name: 'Planta Empreendimentos', sector: 'architecture', color: '#a6c455' },
    { id: 'sabor-sul', name: 'Sabor Sul', sector: 'food', color: '#c58d3a' },
    { id: 'cagell', name: 'Cagell', sector: 'warehouse', color: '#b49d64' },
  ] };
}
