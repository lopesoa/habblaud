import { defaultDashboard, projectKey, type DashboardConfig, type Character, type Company, type Project, type Sector } from '../../../shared/dashboard';
import { tr } from '../../../shared/i18n';
import { h } from './dom';
import type { UiContext } from './context';
import { AppearanceFields } from './appearance-fields';
import { appearanceFromSeed } from '../art';
import { changedParts } from './character-model';
import { createAvatar } from './avatar';

const sectorNames: Record<Sector, string> = { office: tr('Escritório / holding'), construction: tr('Construtora'), port: tr('Porto e exportação de grãos'), food: tr('Produção e embalagem de alimentos'), agro: tr('Agro: soja, milho e algodão'), warehouse: tr('Armazém geral de grãos'), architecture: tr('Arquitetura e edifícios') };
const button = (text: string, fn: () => void) => h('button', { class: 'ui-btn', type: 'button', text, on: { click: fn } });
const input = (value = '', type = 'text') => h('input', { type, attrs: { value }, class: 'dash-input' });
function field(label: string, control: HTMLElement): HTMLElement { return h('label', { class: 'dash-field' }, h('span', { text: label }), control); }
function select(options: Array<[string, string]>, value: string, change: (value: string) => void): HTMLSelectElement {
  const el = h('select', { class: 'dash-input' }, ...options.map(([id, label]) => h('option', { attrs: { value: id }, text: label })));
  el.value = value; el.addEventListener('change', () => change(el.value)); return el;
}
async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } });
  const data = await res.json(); if (!res.ok) throw new Error(data.error || tr('Não foi possível salvar.')); return data as T;
}

export class DashboardPanel {
  readonly button: HTMLButtonElement;
  private dialog = h('dialog', { class: 'dash-dialog', attrs: { 'aria-label': tr('Meu escritório') } });
  private content = h('div', { class: 'dash-content' });
  private message = h('p', { class: 'dash-message', role: 'status' });
  private config: DashboardConfig = defaultDashboard();
  private candidates: Array<{ path: string; name: string }> = [];
  private page = 'projects';
  private dirty = false;
  constructor(private ctx: UiContext) {
    this.button = button(tr('Meu escritório'), () => void this.open());
    this.button.classList.add('dash-open');
    const close = button(tr('Fechar'), () => {
      if (!this.dirty || confirm(tr('Descartar as alterações que ainda não foram salvas?'))) this.dialog.close();
    });
    this.dialog.addEventListener('cancel', ev => { if (this.dirty && !confirm(tr('Descartar as alterações que ainda não foram salvas?'))) ev.preventDefault(); });
    const tabs = h('nav', { class: 'dash-tabs', attrs: { 'aria-label': tr('Seções do escritório') } });
    for (const [id, label] of [['projects', tr('Projetos')], ['characters', tr('Funcionários')], ['companies', tr('Empresas e temas')], ['accounts', tr('Contas')]]) {
      const tab = button(label, () => { this.page = id; this.render(); });
      tab.setAttribute('data-page', id); tabs.append(tab);
    }
    const save = button(tr('Salvar escritório'), () => void this.save()); save.classList.add('ui-btn--primary');
    this.dialog.append(h('header', { class: 'dash-head' }, h('div', {}, h('h2', { text: tr('Meu escritório') }), h('p', { text: tr('Projetos escolhidos, equipe fixa e identidade das empresas.') })), close),
      tabs, this.content, h('footer', { class: 'dash-footer' }, this.message, save));
    this.dialog.addEventListener('input', () => { this.dirty = true; });
    this.dialog.addEventListener('change', () => { this.dirty = true; });
    ctx.root.append(this.dialog);
  }
  private async open(): Promise<void> {
    this.message.textContent = tr('Carregando…');
    this.content.replaceChildren();
    const controls = this.dialog.querySelectorAll<HTMLButtonElement>('.dash-tabs button, .dash-footer button');
    controls.forEach(button => button.disabled = true);
    if (!this.dialog.open) this.dialog.showModal();
    try {
      const config = await api<DashboardConfig>('/api/dashboard');
      this.config = config; this.dirty = false; this.message.textContent = ''; if (!config.projects.length) this.page = 'projects'; this.render();
      // Discovering old sessions can take longer; it must not delay editing the saved team.
      void api<{ projects: Array<{ path: string; name: string }> }>('/api/dashboard/projects').then(data => {
        this.candidates = data.projects;
        if (this.dialog.open && this.page === 'projects' && !this.dirty) this.render();
      }).catch(() => {});
    } catch (err) { this.message.textContent = (err as Error).message; }
    finally { controls.forEach(button => button.disabled = false); }
  }
  private async save(): Promise<void> {
    this.message.textContent = tr('Salvando…');
    try { await api('/api/dashboard', { method: 'PUT', body: JSON.stringify(this.config) }); this.dirty = false; this.message.textContent = tr('Escritório salvo. As alterações já estão no mapa.'); }
    catch (err) { this.message.textContent = (err as Error).message; }
  }
  private render(): void {
    this.content.replaceChildren();
    for (const el of this.dialog.querySelectorAll<HTMLElement>('[data-page]')) el.setAttribute('aria-pressed', String(el.getAttribute('data-page') === this.page));
    if (this.page === 'projects') this.projects();
    else if (this.page === 'characters') this.characters();
    else if (this.page === 'companies') this.companies();
    else this.accounts();
  }
  private projects(): void {
    this.content.append(h('p', { class: 'dash-hint', text: tr('Marque somente o que pode aparecer. A sala escolhida permanece no mapa mesmo sem sessão; projetos desmarcados ficam ocultos mesmo em execução.') }));
    const name = input(), path = input(); path.placeholder = tr('Caminho completo da pasta');
    const add = () => {
      const value = path.value.trim(); if (!value) return;
      if (this.config.projects.some(p => projectKey(p.path) === projectKey(value))) { this.message.textContent = tr('Este projeto já está cadastrado.'); return; }
      this.config.projects.push({ path: value, name: name.value.trim() || value.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || value,
        visible: false, company: this.config.companies[0]?.id || '', characters: [] });
      this.dirty = true; this.render();
    };
    this.content.append(h('div', { class: 'dash-add' }, field(tr('Nome do projeto'), name), field(tr('Pasta do projeto'), path), button(tr('Cadastrar projeto'), add)));
    const choices = this.candidates.filter(c => !this.config.projects.some(p => projectKey(p.path) === projectKey(c.path)));
    if (choices.length) this.content.append(h('details', { class: 'dash-candidates' }, h('summary', { text: tr('Importar projetos encontrados neste computador') }),
      ...choices.map(c => button(c.name + ' · ' + c.path, () => { name.value = c.name; path.value = c.path; add(); }))));
    for (const project of this.config.projects) this.projectCard(project);
    if (!this.config.projects.length) this.content.append(h('p', { class: 'dash-empty', text: tr('Nenhum projeto escolhido. Cadastre uma pasta ou importe um projeto acima.') }));
  }
  private projectCard(p: Project): void {
    const visible = input('', 'checkbox'); visible.checked = p.visible; visible.addEventListener('change', () => p.visible = visible.checked);
    const name = input(p.name); name.addEventListener('input', () => p.name = name.value);
    const company = select(this.config.companies.map(c => [c.id, c.name]), p.company, id => p.company = id);
    const cast = h('div', { class: 'dash-roster' });
    for (const c of this.config.characters) {
      const check = input('', 'checkbox'); check.checked = p.characters.includes(c.id);
      check.addEventListener('change', () => { p.characters = check.checked ? [...p.characters, c.id] : p.characters.filter(id => id !== c.id); });
      cast.append(h('label', {}, check, createAvatar({ ...c, kind: 'main' }, 'xs'), h('span', { text: c.name })));
    }
    this.content.append(h('section', { class: 'dash-card' }, h('div', { class: 'dash-row' }, h('label', { class: 'dash-visible' }, visible, h('strong', { text: tr('Mostrar no escritório') })),
      button(tr('Remover cadastro'), () => { if (confirm(tr('Remover este cadastro? Os arquivos e as conversas do projeto não serão apagados.'))) { this.config.projects = this.config.projects.filter(x => x !== p); this.dirty = true; this.render(); } })),
      h('code', { text: p.path }), h('div', { class: 'dash-grid' }, field(tr('Nome da sala'), name), field(tr('Empresa / cenário'), company)),
      h('p', { text: tr('Funcionários desta sala (ordem de chegada das sessões):') }), cast,
      !this.config.characters.length ? h('p', { class: 'dash-hint', text: tr('Cadastre funcionários na aba Funcionários. Sem cadastro, a sessão usa um avatar neutro fixo.') }) : h('span')));
  }
  private characters(): void {
    this.content.append(h('p', { class: 'dash-hint', text: tr('Crie sua equipe antes de abrir as sessões. Nome e aparência permanecem iguais nos próximos acessos. Depois associe os funcionários aos projetos.') }),
      button(tr('Cadastrar funcionário'), () => {
        const c: Character = { id: crypto.randomUUID(), name: tr('Novo funcionário'), seed: 1, look: 'm', parts: {} };
        this.config.characters.push(c); this.dirty = true; this.editCharacter(c);
      }));
    for (const c of this.config.characters) this.content.append(h('div', { class: 'dash-card dash-row' }, createAvatar({ ...c, kind: 'main' }, 'md'), h('strong', { text: c.name }),
      button(tr('Editar aparência'), () => this.editCharacter(c)), button(tr('Remover'), () => {
        if (!confirm(tr('Remover este funcionário do cadastro e dos projetos?'))) return;
        this.config.characters = this.config.characters.filter(x => x.id !== c.id);
        for (const p of this.config.projects) p.characters = p.characters.filter(id => id !== c.id);
        this.dirty = true; this.render();
      })));
  }
  private editCharacter(c: Character): void {
    this.content.replaceChildren();
    const name = input(c.name); name.maxLength = 24;
    const look = select([['m', tr('Masculino')], ['f', tr('Feminino')]], c.look, value => {
      c.look = value as 'm' | 'f'; fields.set(appearanceFromSeed(c.seed, { look: c.look, parts: c.parts }));
    });
    const fields = new AppearanceFields(appearance => { c.parts = changedParts(appearanceFromSeed(c.seed, { look: c.look }), appearance); this.dirty = true; });
    fields.set(appearanceFromSeed(c.seed, { look: c.look, parts: c.parts }));
    name.addEventListener('input', () => c.name = name.value);
    this.content.append(h('div', { class: 'dash-grid' }, field(tr('Nome do funcionário'), name), field(tr('Aparência base'), look)), fields.preview, fields.groups,
      button(tr('Voltar para a equipe'), () => this.render()));
  }
  private companies(): void {
    this.content.append(h('p', { class: 'dash-hint', text: tr('As empresas podem compartilhar um ramo. Cada projeto usa o cenário e a cor da empresa escolhida.') }), h('p', { class: 'dash-hint', text: tr('Nesta versão, histórico agregado, Meu dia e entregas antigas ficam bloqueados para não revelar projetos desmarcados.') }));
    for (const company of this.config.companies) this.companyCard(company);
  }
  private companyCard(c: Company): void {
    const name = input(c.name); name.maxLength = 80; name.addEventListener('input', () => c.name = name.value);
    const color = input(c.color, 'color'); color.addEventListener('input', () => c.color = color.value);
    const sector = select(Object.entries(sectorNames), c.sector, value => c.sector = value as Sector);
    this.content.append(h('section', { class: 'dash-card dash-grid' }, field(tr('Empresa'), name), field(tr('Cenário'), sector), field(tr('Cor da empresa'), color)));
  }
  private accounts(): void {
    this.content.append(h('p', { class: 'dash-hint', text: tr('Somente as contas marcadas aparecem neste escritório. Desativar uma conta não apaga o login nem as conversas.') }));
    for (const [id, label] of [...new Set(['.codex', '.codex-cavalca', ...this.config.accounts])].map(id => [id, id === '.codex' ? 'Codex X' : id === '.codex-cavalca' ? 'Codex C (Cavalca)' : id.replace(/^\.codex[-_.]?/, '')])) {
      const active = input('', 'checkbox'); active.checked = this.config.accounts.includes(id);
      active.addEventListener('change', () => this.config.accounts = active.checked ? [...this.config.accounts, id] : this.config.accounts.filter(x => x !== id));
      this.content.append(h('label', { class: 'dash-card dash-row' }, active, h('strong', { text: label })));
    }
    this.content.append(h('a', { class: 'ui-btn', text: tr('Abrir gerenciador de contas no Windows'), attrs: { href: 'habblaud-contas://open' } }),
      h('p', { class: 'dash-hint', text: tr('No gerenciador, escolha a conta e clique em Entrar na conta para abrir o login oficial. O login é feito no navegador, sem compartilhar senha com o Habblaud.') }));
  }
}
