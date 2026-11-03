import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AccountsService } from './accounts/service';
import { DashboardStore } from './dashboard';
import { defaultDashboard } from '../shared/dashboard';
import { createApiHandler } from './http/app';
import { createRequestGuard } from './http/guard';
import { Hub } from './http/sse';
import { Office } from './model/office';
import { NameStore } from './model/names';

describe('API do escritório personalizado', () => {
  let server: http.Server, hub: Hub, office: Office, dashboard: DashboardStore, base: string;
  beforeEach(async () => {
    dashboard = new DashboardStore(null, () => office.markDirty());
    const accounts = new AccountsService({ dirs: [], home: '/tmp', env: {}, onChange: () => {} });
    office = new Office({ names: new NameStore(null), version: 'test', startedAt: 0, accounts: () => [], sources: () => [], accountName: () => undefined,
      projectSnapshot: s => dashboard.projectSnapshot(s) });
    office.addMain({ id: 'secret', account: '.codex', sessionId: 's', cwd: '/private/personal', role: 'Agente principal', startedAt: 1, status: 'working' });
    hub = new Hub(office); hub.start();
    const handler = createApiHandler({ office, hub, accounts, dashboard, terminal: true, version: 'test', sources: () => [], inDocker: false });
    const guard = createRequestGuard({ allowedHosts: new Set() });
    server = http.createServer((req, res) => { if (!guard(req, res)) handler(req, res, new URL(req.url!, base)); });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterEach(async () => { hub.stop(); server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); });
  it('nega detalhes e terminal de um agente de projeto oculto', async () => {
    expect((await fetch(base + '/api/agents/secret')).status).toBe(404);
    expect((await fetch(base + '/api/agents/secret/terminal')).status).toBe(404);
    expect((await (await fetch(base + '/api/snapshot')).json()).agents).toEqual([]);
  });
  it('aceita configuração local válida e torna a sala visível sem criar agentes', async () => {
    const c = defaultDashboard(); c.projects = [{ path: '/work/export', name: 'Exportação', visible: true, company: 'export', characters: [] }];
    const response = await fetch(base + '/api/dashboard', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(c) });
    expect(response.status).toBe(200);
    const snap = await (await fetch(base + '/api/snapshot')).json();
    expect(snap.rooms[0].name).toBe('Exportação'); expect(snap.agents).toEqual([]);
  });
  it('recusa corpo inválido sem sobrescrever a seleção anterior', async () => {
    const response = await fetch(base + '/api/dashboard', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ version: 1 }) });
    expect(response.status).toBe(400); expect(dashboard.get()).toEqual(defaultDashboard());
  });
  it('não aceita gravação enviada por formulário ou por outra origem', async () => {
    expect((await fetch(base + '/api/dashboard', { method: 'PUT', headers: { 'Content-Type': 'text/plain' }, body: '{}' })).status).toBe(415);
    expect((await fetch(base + '/api/dashboard', { method: 'PUT', headers: { 'Content-Type': 'application/json', Origin: 'https://other.example' }, body: '{}' })).status).toBe(403);
  });
  it('bloqueia registros agregados anteriores que poderiam revelar projetos pessoais', async () => {
    for (const route of ['/api/timeline/days', '/api/stats', '/api/deliveries']) expect((await fetch(base + route)).status).toBe(403);
  });
});
