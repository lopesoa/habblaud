import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { defaultDashboard, projectKey, SECTORS, type DashboardConfig, type Project } from '../shared/dashboard';
import { parseAppearanceParts, parseCharacterName, parseSeed } from '../shared/appearance';
import { hash32 } from '../shared/hash';
import type { AgentInfo, FeedItem, Notice, OfficeSnapshot, RoomInfo } from '../shared/types';
import { tr } from '../shared/i18n';

const ID = /^[a-zA-Z0-9_.-]{1,80}$/;
const ACCOUNT = /^\.codex(?:[-_.][a-zA-Z0-9_-]+)?$/;
function text(value: unknown, max = 240): value is string { return typeof value === 'string' && value.length > 0 && value.length <= max && !/[\x00-\x1f]/.test(value); }

export function validateDashboard(raw: unknown): DashboardConfig {
  const c = raw as DashboardConfig;
  if (!c || c.version !== 1 || !Array.isArray(c.projects) || !Array.isArray(c.characters) || !Array.isArray(c.companies) || !Array.isArray(c.accounts)
    || c.projects.length > 300 || c.characters.length > 200 || c.companies.length > 30 || c.accounts.length > 12) throw new Error(tr('Configuração do escritório inválida.'));
  const companies = new Set<string>();
  for (const a of c.companies) {
    if (!a || !ID.test(a.id) || companies.has(a.id) || !text(a.name, 80) || !SECTORS.includes(a.sector) || !/^#[0-9a-f]{6}$/i.test(a.color)) throw new Error(tr('Empresa inválida ou repetida.'));
    companies.add(a.id);
  }
  const characters = new Set<string>();
  for (const a of c.characters) {
    if (!a || !ID.test(a.id) || characters.has(a.id) || !parseCharacterName(a.name) || parseSeed(a.seed) === null || !['m', 'f'].includes(a.look) || !parseAppearanceParts(a.parts)) throw new Error(tr('Personagem inválido ou repetido.'));
    characters.add(a.id);
  }
  const paths = new Set<string>();
  for (const p of c.projects) {
    if (!p || !text(p.path, 1024) || !/^(?:[a-z]:[\\/]|\/)/i.test(p.path) || /(?:^|[\\/])\.\.(?:[\\/]|$)/.test(p.path)
      || !text(p.name, 100) || typeof p.visible !== 'boolean' || !companies.has(p.company) || !Array.isArray(p.characters)
      || p.characters.length > 50 || new Set(p.characters).size !== p.characters.length || p.characters.some(id => !characters.has(id)) || paths.has(projectKey(p.path))) throw new Error(tr('Projeto inválido ou repetido.'));
    paths.add(projectKey(p.path));
  }
  if (c.accounts.some(a => typeof a !== 'string' || !ACCOUNT.test(a)) || new Set(c.accounts).size !== c.accounts.length) throw new Error(tr('Conta do Codex inválida.'));
  // Copy only the supported properties; no extra fields or credentials persisted.
  return { version: 1, accounts: [...c.accounts], companies: c.companies.map(({ id, name, sector, color }) => ({ id, name, sector, color })),
    characters: c.characters.map(({ id, name, seed, look, parts }) => ({ id, name: name.trim(), seed, look, parts: parseAppearanceParts(parts)! })),
    projects: c.projects.map(({ path, name, visible, company, characters }) => ({ path, name, visible, company, characters: [...characters] })) };
}

export class DashboardStore {
  private config: DashboardConfig = defaultDashboard();
  private assignments = new Map<string, Map<string, number>>();
  constructor(private file: string | null, private changed: () => void = () => {}) {
    if (file && existsSync(file)) this.config = validateDashboard(JSON.parse(readFileSync(file, 'utf8')));
  }
  get(): DashboardConfig { return structuredClone(this.config); }
  save(raw: unknown): void {
    const next = validateDashboard(raw);
    if (this.file) {
      mkdirSync(dirname(this.file), { recursive: true });
      const temp = this.file + '.tmp';
      writeFileSync(temp, JSON.stringify(next, null, 2), { mode: 0o600 });
      renameSync(temp, this.file);
    }
    this.config = next;
    this.changed();
  }
  project(path: string): Project | undefined { return this.config.projects.find(p => projectKey(p.path) === projectKey(path)); }
  allowed(path: string, account?: string): boolean { return !!this.project(path)?.visible && (!account || this.config.accounts.includes(account)); }
  agentAllowed(a: AgentInfo | undefined): boolean { return !!a && this.allowed(a.roomId, a.account); }
  filterFeed(feed: FeedItem[]): FeedItem[] {
    return feed.filter(f => this.allowed(f.roomId, f.account)).map(f => {
      const p = this.project(f.roomId)!;
      const roster = p.characters.map(id => this.config.characters.find(c => c.id === id)).filter(Boolean);
      return { ...f, roomName: p.name, agentName: roster.length ? roster.map(c => c!.name).join(' · ') : tr('Agente sem personagem') };
    });
  }
  noticeAllowed(n: Notice): boolean { return !!n.roomId && this.allowed(n.roomId); }
  projectSnapshot(input: OfficeSnapshot): OfficeSnapshot {
    // The same selection applies even when server demonstration mode is toggled.
    const visible = this.config.projects.filter(p => p.visible);
    const rooms: RoomInfo[] = visible.map((p, slot) => {
      const live = input.rooms.find(r => projectKey(r.path) === projectKey(p.path));
      const company = this.config.companies.find(c => c.id === p.company)!;
      return { ...live, id: live?.id ?? p.path, path: p.path, name: p.name, slot, seed: hash32(projectKey(p.path)), createdAt: live?.createdAt ?? 0,
        company: company.name, sector: company.sector, accent: company.color, pinned: true };
    });
    const agents = input.agents.filter(a => this.agentAllowed(a)).map(a => {
      const p = this.project(a.roomId)!;
      const room = rooms.find(r => projectKey(r.path) === projectKey(p.path))!;
      const roster = p.characters.map(id => this.config.characters.find(c => c.id === id)).filter(Boolean);
      const key = projectKey(p.path);
      let assigned = this.assignments.get(key);
      if (!assigned) this.assignments.set(key, assigned = new Map());
      if (!assigned.has(a.id)) {
        const liveIds = new Set(input.agents.filter(x => projectKey(x.roomId) === key).map(x => x.id));
        for (const id of assigned.keys()) if (!liveIds.has(id)) assigned.delete(id);
        let position = 0;
        while ([...assigned.values()].includes(position)) position++;
        assigned.set(a.id, position);
      }
      const index = assigned.get(a.id)!;
      const character = roster[index % Math.max(roster.length, 1)];
      const copy: AgentInfo = { ...a, roomId: room.id, seed: character?.seed ?? 1, look: character?.look ?? 'm',
        name: character ? character.name + (index >= roster.length ? ` ${Math.floor(index / roster.length) + 1}` : '') : tr('Agente sem personagem'), parts: character?.parts ?? {} };
      return copy;
    });
    return { ...input, rooms, agents, accounts: input.accounts.filter(a => this.config.accounts.includes(a.id)).map(a => ({ ...a,
      name: a.id === '.codex' ? 'Codex X' : a.name, sessions: agents.filter(x => x.account === a.id && x.kind === 'main' && x.status !== 'offline').length })),
      ptys: input.ptys?.filter(p => agents.some(a => a.id === (p as { agentId?: string }).agentId)),
      meta: { ...input.meta, sources: input.meta.sources.filter(s => this.config.accounts.includes(s.label)), dashboard: true } };
  }
}
