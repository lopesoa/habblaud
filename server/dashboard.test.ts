import { describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defaultDashboard, projectKey, type DashboardConfig } from '../shared/dashboard';
import type { AgentInfo, FeedItem, OfficeSnapshot } from '../shared/types';
import { DashboardStore, validateDashboard } from './dashboard';
import { Office } from './model/office';
import { NameStore } from './model/names';
import { Hub } from './http/sse';

const path = 'C:\\Projetos\\Porto';
function config(): DashboardConfig {
  const c = defaultDashboard();
  c.characters = [{ id: 'ana', name: 'Ana', look: 'f', seed: 7, parts: { top: '#ffcc22' } }, { id: 'rui', name: 'Rui', look: 'm', seed: 8, parts: {} }];
  c.projects = [{ path, name: 'Operação portuária', visible: true, company: 'export', characters: ['ana', 'rui'] },
    { path: 'C:\\Pessoal\\Privado', name: 'Privado', visible: false, company: 'holding', characters: ['ana'] }];
  return c;
}
function agent(id: string, roomId = path, account = '.codex'): AgentInfo {
  return { id, roomId, account, name: 'Nome aleatório', seed: 900, look: 'm', kind: 'main', provider: 'codex', role: 'Agente principal',
    sessionId: id, status: 'working', statusSince: 1, stats: { toolCalls: 0, tokensIn: 0, tokensOut: 0, linesAdded: 0, linesRemoved: 0, subagents: 0 }, recent: [], tasks: [], startedAt: 1, lastEventAt: 1 };
}
function snapshot(agents: AgentInfo[] = []): OfficeSnapshot {
  return { rev: 1, serverTime: 100, rooms: [], agents, accounts: [
    { id: '.codex', provider: 'codex', name: 'Codex', short: 'X', configDir: '/codex/.codex', color: '#ffffff', sessions: 3, usageStatus: 'ok' },
    { id: '.codex-cavalca', provider: 'codex', name: 'Codex C', short: 'C', configDir: '/codex/.codex-cavalca', color: '#ffffff', sessions: 2, usageStatus: 'ok' },
  ], meta: { demo: false, sources: [], version: '1', startedAt: 0 } };
}

describe('Escritório personalizado', () => {
  it('começa somente com Codex X, sete empresas e nenhum projeto publicado', () => {
    const store = new DashboardStore(null);
    expect(store.get().companies).toHaveLength(9);
    expect(store.projectSnapshot(snapshot([agent('a')])).agents).toEqual([]);
    expect(store.projectSnapshot(snapshot()).accounts.map(a => a.id)).toEqual(['.codex']);
  });
  it('normaliza caminhos Windows e WSL sem aproximar pastas diferentes', () => {
    expect(projectKey(path)).toBe(projectKey('/mnt/c/Projetos/Porto/'));
    expect(projectKey('c:/PROJETOS/porto')).toBe(projectKey(path));
    expect(projectKey(path + '-pessoal')).not.toBe(projectKey(path));
  });
  it('recusa caminhos duplicados e travessia de diretórios', () => {
    const c = config(); c.projects.push({ ...c.projects[0], path: '/mnt/c/Projetos/Porto' });
    expect(() => validateDashboard(c)).toThrow();
    c.projects.pop(); c.projects[0].path = 'C:\\Projetos\\..\\Privado';
    expect(() => validateDashboard(c)).toThrow();
  });
  it('recusa referências a personagens inexistentes e campos inválidos', () => {
    const c = config(); c.projects[0].characters = ['missing']; expect(() => validateDashboard(c)).toThrow();
    const d = config(); d.characters[0].parts = { top: 'javascript:alert(1)' }; expect(() => validateDashboard(d)).toThrow();
    const e = config(); e.accounts = ['../../auth']; expect(() => validateDashboard(e)).toThrow();
  });
  it('mantém a sala vazia sem inventar sessões ou personagens trabalhando', () => {
    const store = new DashboardStore(null); store.save(config());
    const s = store.projectSnapshot(snapshot());
    expect(s.rooms).toHaveLength(1); expect(s.rooms[0]).toMatchObject({ pinned: true, name: 'Operação portuária', sector: 'port', company: 'Cavalca Trading' });
    expect(s.agents).toEqual([]); expect(s.accounts[0].sessions).toBe(0);
  });
  it('oculta projetos em execução e contas desativadas', () => {
    const store = new DashboardStore(null); store.save(config());
    const s = store.projectSnapshot(snapshot([agent('ok'), agent('secret', 'C:\\Pessoal\\Privado'), agent('other-account', path, '.codex-cavalca')]));
    expect(s.agents.map(a => a.id)).toEqual(['ok']);
    expect(s.accounts.map(a => a.id)).toEqual(['.codex']); expect(s.accounts[0].sessions).toBe(1);
    expect(JSON.stringify(s)).not.toContain('Privado');
  });
  it('atribui personagens cadastrados mantendo a identidade entre atualizações', () => {
    const store = new DashboardStore(null); store.save(config());
    const first = store.projectSnapshot(snapshot([agent('a'), agent('b')]));
    const next = store.projectSnapshot(snapshot([agent('b'), agent('a')]));
    expect(first.agents.map(a => a.name)).toEqual(['Ana', 'Rui']);
    expect(next.agents.map(a => a.name)).toEqual(['Rui', 'Ana']);
    expect(first.agents[0]).toMatchObject({ seed: 7, look: 'f', parts: { top: '#ffcc22' } });
  });
  it('evita nomes aleatórios mesmo quando a sala ainda não tem elenco', () => {
    const c = config(); c.projects[0].characters = [];
    const store = new DashboardStore(null); store.save(c);
    expect(store.projectSnapshot(snapshot([agent('a')])).agents[0]).toMatchObject({ name: 'Agente sem personagem', seed: 1 });
  });
  it('salva elenco e projetos para a próxima inicialização', () => {
    const dir = mkdtempSync(join(tmpdir(), 'habblaud-dashboard-'));
    try { const file = join(dir, 'dashboard.json'); new DashboardStore(file).save(config()); expect(new DashboardStore(file).get()).toEqual(config()); }
    finally { rmSync(dir, { recursive: true, force: true }); }
  });
  it('não envia feed ou avisos de projetos ocultos', () => {
    const store = new DashboardStore(null); store.save(config());
    const feed = [{ id: 'private', agentId: 'x', roomId: 'C:\\Pessoal\\Privado', agentName: 'secret', roomName: 'Privado', account: '.codex', activity: {} },
      { id: 'ok', agentId: 'a', roomId: path, agentName: 'Nome aleatório', roomName: 'Porto', account: '.codex', activity: {} }] as FeedItem[];
    expect(store.filterFeed(feed).map(f => f.id)).toEqual(['ok']);
    expect(store.filterFeed(feed)[0].agentName).not.toContain('aleatório');
    expect(store.noticeAllowed({ id: '1', text: 'secret', level: 'info', at: 1, roomId: 'C:\\Pessoal\\Privado' })).toBe(false);
  });
  it('a alteração se reflete no snapshot transmitido pelo Hub', () => {
    let office: Office;
    const store = new DashboardStore(null, () => office.markDirty());
    office = new Office({ names: new NameStore(null), version: 'test', startedAt: 0, accounts: () => [], sources: () => [], accountName: () => undefined,
      projectSnapshot: s => store.projectSnapshot(s) });
    const hub = new Hub(office);
    office.addMain({ id: 'a', account: '.codex', sessionId: 's', cwd: path, role: 'Agente principal', startedAt: 1, status: 'working' });
    expect(hub.current().agents).toEqual([]);
    store.save(config()); expect(hub.current().agents[0].name).toBe('Ana');
    const c = config(); c.projects[0].visible = false; store.save(c);
    expect(hub.current().rooms).toEqual([]); expect(hub.current().agents).toEqual([]);
    expect(office.list()).toHaveLength(1); // hiding never ends or deletes the underlying session
  });
});
