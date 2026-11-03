"""Local account launcher. Never reads or copies authentication files."""
from __future__ import annotations

import base64
import json
import os
import re
from pathlib import Path
import subprocess
import sys
import threading
import tkinter as tk
from tkinter import filedialog, messagebox, simpledialog
import webbrowser
from connect_habblaud import WSL_CONNECT

BG = '#10151f'
PANEL = '#192231'
LINE = '#334155'
TEXT = '#f1f5f9'
MUTED = '#a8b6c8'
ACCENT = '#63e6be'


def profiles(home: Path, extra: list | None = None) -> list[dict]:
    result = [
        {'id': 'principal', 'name': 'Principal', 'detail': 'Conta original · Codex X',
         'home': str(home / '.codex'), 'color': '#60a5fa'},
        {'id': 'cavalca', 'name': 'Cavalca', 'detail': 'Conta Cavalca · Codex C',
         'home': str(home / '.codex-cavalca'), 'color': ACCENT},
    ]
    for item in extra or []:
        if not isinstance(item, dict) or not re.fullmatch(r'[a-z][a-z0-9-]{0,39}', str(item.get('id', ''))):
            continue
        if item['id'] in {p['id'] for p in result}:
            continue
        result.append({'id': item['id'], 'name': str(item.get('name', item['id']))[:40],
                       'detail': 'Perfil independente', 'home': str(home / ('.codex-' + item['id'])), 'color': ACCENT})
    return result


def cli_path(profile: dict | None = None) -> Path:
    root = Path(os.environ['LOCALAPPDATA']) / 'Programs/OpenAI'
    if profile and profile['id'] == 'principal':
        return root / 'CodexPrincipal/bin/codex.exe'
    if profile and profile['id'] != 'cavalca':
        return root / ('CodexProfiles/' + profile['id'] + '/bin/codex.exe')
    return root / 'Codex/bin/codex.exe'


def has_package(profile: dict) -> bool:
    return (Path(profile['home']) / 'packages/standalone/current/bin/codex.exe').is_file()


def child_environment(profile: dict) -> dict:
    env = os.environ.copy()
    env['CODEX_HOME'] = profile['home']
    return env


def ps_literal(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def terminal_command(binary: Path, profile: dict, login: bool = False) -> list[str]:
    # User paths are PowerShell literals, never interpolated as executable code.
    script = ("$Host.UI.RawUI.WindowTitle = " + ps_literal('Codex · ' + profile['name'])
              + "\n& " + ps_literal(str(binary)) + (' login' if login else ''))
    encoded = base64.b64encode(script.encode('utf-16-le')).decode('ascii')
    shell = Path(os.environ['SystemRoot']) / 'System32/WindowsPowerShell/v1.0/powershell.exe'
    return [str(shell), '-NoLogo', '-NoProfile', '-NoExit', '-EncodedCommand', encoded]


def read_settings(path: Path) -> dict:
    try:
        value = json.loads(path.read_text(encoding='utf-8'))
        return value if isinstance(value, dict) else {}
    except (OSError, ValueError):
        return {}


def save_settings(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix('.tmp')
    temporary.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
    temporary.replace(path)


def project_folder(value: str) -> Path:
    if not value.strip():
        raise ValueError('Escolha a pasta do projeto antes de abrir o Codex.')
    folder = Path(value.strip()).expanduser()
    if not folder.is_absolute() or not folder.is_dir():
        raise ValueError('A pasta do projeto precisa existir e ter um caminho completo.')
    system = Path(os.environ['SystemRoot']).resolve()
    resolved = folder.resolve()
    if resolved == system or system in resolved.parents:
        raise ValueError('Escolha a pasta do seu projeto, fora da pasta Windows.')
    return folder


class App(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title('Codex Contas')
        self.geometry('850x650')
        self.minsize(800, 620)
        self.configure(bg=BG)
        self.option_add('*Font', ('Segoe UI', 10))
        self.option_add('*Background', BG)
        self.option_add('*Foreground', TEXT)
        self.home = Path.home()
        self.settings_path = Path(os.environ['LOCALAPPDATA']) / 'CodexContas/settings.json'
        self.settings = read_settings(self.settings_path)
        self.accounts = profiles(self.home, self.settings.get('accounts', []))
        self.account_id = self.settings.get('account', 'principal')
        if self.account_id not in {p['id'] for p in self.accounts}:
            self.account_id = 'principal'
        self.project = tk.StringVar()
        self.status = tk.StringVar(value='Verificando os logins salvos…')
        self.login_states = {}
        self.cards = {}
        self.status_labels = {}
        self.build()
        self.select(self.account_id)
        self.protocol('WM_DELETE_WINDOW', self.close)
        self.after(100, self.refresh)

    @property
    def account(self):
        return next(p for p in self.accounts if p['id'] == self.account_id)

    def label(self, parent, text, size=10, color=TEXT, bold=False, **kwargs):
        return tk.Label(parent, text=text, bg=parent.cget('bg'), fg=color,
                        font=('Segoe UI', size, 'bold' if bold else 'normal'), **kwargs)

    def build(self):
        outer = tk.Frame(self, bg=BG, padx=32, pady=25)
        outer.pack(fill='both', expand=True)
        self.label(outer, 'CODEX  /  CONTAS', 10, ACCENT, True).pack(anchor='w')
        self.label(outer, 'Seu projeto. A conta certa.', 25, bold=True).pack(anchor='w', pady=(8, 5))
        self.label(outer, 'Abra cada conta em uma janela própria, com o login que você já usa.',
                   color=MUTED).pack(anchor='w')
        self.label(outer, '1  ESCOLHA A CONTA', 10, MUTED, True).pack(anchor='w', pady=(25, 10))
        tk.Button(outer, text='+ Adicionar conta Codex', command=self.add_account, bg=BG, fg=ACCENT,
                  relief='flat', cursor='hand2').pack(anchor='e', pady=(0, 6))
        cards = tk.Frame(outer, bg=BG)
        cards.pack(fill='x')
        for i, profile in enumerate(self.accounts):
            card = tk.Frame(cards, bg=PANEL, padx=18, pady=13,
                            highlightthickness=2, highlightbackground=LINE, cursor='hand2')
            card.grid(row=i // 2, column=i % 2, sticky='nsew', padx=(0 if i % 2 == 0 else 7, 7 if i % 2 == 0 else 0), pady=4)
            cards.columnconfigure(i % 2, weight=1, uniform='account')
            self.label(card, profile['name'], 17, profile['color'], True).pack(anchor='w')
            self.label(card, profile['detail'], 10, MUTED).pack(anchor='w', pady=(3, 9))
            state = self.label(card, 'Verificando…', 10, MUTED)
            state.pack(anchor='w')
            self.cards[profile['id']] = card
            self.status_labels[profile['id']] = state
            for widget in [card, *card.winfo_children()]:
                widget.bind('<Button-1>', lambda event, key=profile['id']: self.select(key))
        self.label(outer, '2  ESCOLHA O PROJETO', 10, MUTED, True).pack(anchor='w', pady=(24, 9))
        row = tk.Frame(outer, bg=BG)
        row.pack(fill='x')
        entry = tk.Entry(row, textvariable=self.project, bg=PANEL, fg=TEXT,
                         insertbackground=TEXT, relief='flat', font=('Segoe UI', 11))
        entry.pack(side='left', fill='x', expand=True, ipady=11, padx=(0, 10))
        entry.bind('<Return>', lambda event: self.open_codex())
        tk.Button(row, text='Escolher pasta…', command=self.choose_folder, bg='#29374b',
                  fg=TEXT, relief='flat', padx=17, pady=11, cursor='hand2').pack(side='right')
        self.label(outer, 'A última pasta usada é lembrada separadamente para cada conta.',
                   9, MUTED).pack(anchor='w', pady=(8, 17))
        action = tk.Frame(outer, bg=BG)
        action.pack(fill='x')
        self.open_button = tk.Button(action, text='Abrir Codex', command=self.open_codex,
                                     bg=ACCENT, fg='#08251e', activebackground='#91f0d3',
                                     font=('Segoe UI', 12, 'bold'), relief='flat', padx=24,
                                     pady=12, cursor='hand2')
        self.open_button.pack(side='left')
        tk.Button(action, text='Entrar na conta', command=self.login, bg=PANEL, fg=TEXT,
                  relief='flat', padx=17, pady=14, cursor='hand2').pack(side='left', padx=10)
        tk.Button(action, text='Atualizar status', command=self.refresh, bg=BG, fg=MUTED,
                  relief='flat', pady=14, cursor='hand2').pack(side='right')
        tk.Button(outer, text='Conectar esta conta ao Habblaud', command=self.connect_habblaud,
                  bg=BG, fg=ACCENT, relief='flat', cursor='hand2').pack(anchor='w', pady=(10, 0))
        tk.Label(outer, textvariable=self.status, bg=BG, fg=MUTED, wraplength=760,
                 justify='left', anchor='w').pack(fill='x', pady=(15, 14))
        tk.Frame(outer, bg=LINE, height=1).pack(fill='x')
        self.label(outer, 'Você pode manter as duas contas abertas ao mesmo tempo.',
                   10, TEXT).pack(anchor='w', pady=(13, 4))
        self.label(outer, 'Para encerrar uma sessão, use /quit no terminal. O app guarda apenas contas e pastas.',
                   9, MUTED).pack(anchor='w')
        tk.Button(outer, text='Abrir Habblaud  ↗', command=lambda: webbrowser.open('https://habblaud.localhost'),
                  bg=BG, fg=ACCENT, relief='flat', cursor='hand2').pack(anchor='w', pady=(7, 0))

    def remember(self):
        last = self.settings.get('projects')
        if not isinstance(last, dict):
            last = {}
        self.settings['projects'] = last
        last[self.account_id] = self.project.get()
        self.settings['account'] = self.account_id

    def select(self, key):
        if getattr(self, '_selection_initialized', False):
            self.remember()
        self._selection_initialized = True
        self.account_id = key
        folders = self.settings.get('projects', {})
        self.project.set(folders.get(key, '') if isinstance(folders, dict) else '')
        for ident, card in self.cards.items():
            card.configure(highlightbackground=self.account['color'] if ident == key else LINE)
        self.open_button.configure(text='Abrir Codex · ' + self.account['name'])
        self.status.set('Selecionada: ' + self.account['name'] + '. Escolha a pasta e abra uma sessão.')

    def choose_folder(self):
        initial = self.project.get() if Path(self.project.get()).is_dir() else str(self.home / 'Documents')
        chosen = filedialog.askdirectory(title='Escolha a pasta do projeto', initialdir=initial)
        if chosen:
            self.project.set(os.path.normpath(chosen))
            self.persist()

    def persist(self):
        self.remember()
        try:
            save_settings(self.settings_path, self.settings)
        except OSError as exc:
            self.status.set('Não foi possível salvar a preferência: ' + str(exc))

    def refresh(self):
        def check():
            results = {}
            for profile in self.accounts:
                binary = cli_path(profile)
                if not binary.is_file() or not has_package(profile):
                    results[profile['id']] = ('CLI precisa ser preparada', '#fbbf24')
                    continue
                try:
                    run = subprocess.run([str(binary), 'login', 'status'], env=child_environment(profile),
                                         capture_output=True, text=True, timeout=15,
                                         creationflags=subprocess.CREATE_NO_WINDOW)
                    results[profile['id']] = (('Login salvo · pronta para abrir', ACCENT) if run.returncode == 0
                                              else ('Faça login nesta conta', '#fbbf24'))
                except (OSError, subprocess.TimeoutExpired):
                    results[profile['id']] = ('Não foi possível verificar agora', '#fbbf24')
            self.after(0, lambda: self.show_results(results))
        threading.Thread(target=check, daemon=True).start()

    def show_results(self, results):
        for ident, (text, color) in results.items():
            self.status_labels[ident].configure(text=text, fg=color)

    def launch(self, login=False):
        binary = cli_path(self.account)
        if not binary.is_file() or not has_package(self.account):
            messagebox.showerror('Preparação necessária', 'A CLI completa ainda não está instalada para esta conta.')
            return
        try:
            folder = Path(self.account['home']) if login else project_folder(self.project.get())
            folder.mkdir(parents=True, exist_ok=True) if login else None
            subprocess.Popen(terminal_command(binary, self.account, login), cwd=folder,
                             env=child_environment(self.account),
                             creationflags=subprocess.CREATE_NEW_CONSOLE)
            self.persist()
            self.status.set(('Login aberto' if login else 'Codex aberto') + ' na conta ' + self.account['name']
                            + '. A janela do terminal é independente deste aplicativo.')
        except (OSError, ValueError) as exc:
            messagebox.showerror('Não foi possível abrir', str(exc))

    def open_codex(self):
        self.launch()

    def login(self):
        if not cli_path(self.account).is_file() or not has_package(self.account):
            if not messagebox.askyesno('Preparar esta conta',
                'Vamos abrir o instalador oficial do Codex e depois o login no navegador. Continuar?'):
                return
            account = self.account
            destination = cli_path(account).parent
            # The installer comes directly from the official OpenAI URL. No credential copying.
            script = ("$ErrorActionPreference='Stop'\n"
                      + '$env:CODEX_INSTALL_DIR=' + ps_literal(str(destination)) + '\n'
                      + "$env:CODEX_NON_INTERACTIVE='true'\n"
                      + "$installer=Join-Path $env:TEMP ('codex-profile-'+[guid]::NewGuid()+'.ps1')\n"
                      + "Invoke-WebRequest -UseBasicParsing -Uri 'https://chatgpt.com/codex/install.ps1' -OutFile $installer\n"
                      + '& $installer\n' + 'if ($LASTEXITCODE -and $LASTEXITCODE -ne 0) { throw "A instalação não foi concluída." }\n'
                      + '& ' + ps_literal(str(cli_path(account))) + ' login\n')
            encoded = base64.b64encode(script.encode('utf-16-le')).decode('ascii')
            shell = str(Path(os.environ['SystemRoot']) / 'System32/WindowsPowerShell/v1.0/powershell.exe')
            try:
                Path(account['home']).mkdir(parents=True, exist_ok=True)
                subprocess.Popen([shell, '-NoLogo', '-NoProfile', '-NoExit', '-EncodedCommand', encoded],
                                 cwd=account['home'], env=child_environment(account), creationflags=subprocess.CREATE_NEW_CONSOLE)
                self.status.set('Preparação e login abertos. Depois de entrar, clique em Atualizar status.')
            except OSError as exc:
                messagebox.showerror('Não foi possível preparar', str(exc))
            return
        self.launch(login=True)

    def add_account(self):
        if len(self.accounts) >= 6:
            messagebox.showinfo('Contas', 'Este gerenciador permite até seis perfis locais.')
            return
        label = simpledialog.askstring('Adicionar conta', 'Nome da conta (por exemplo, Trabalho):', parent=self)
        if not label or not label.strip():
            return
        slug = simpledialog.askstring('Identificador', 'Identificador sem espaços ou acentos (exemplo: trabalho):', parent=self)
        if not slug:
            return
        slug = slug.strip().lower()
        if not re.fullmatch(r'[a-z][a-z0-9-]{0,39}', slug) or slug in {p['id'] for p in self.accounts}:
            messagebox.showerror('Identificador inválido', 'Use letras minúsculas, números e hífen. Escolha um identificador novo.')
            return
        self.remember()
        extra = self.settings.get('accounts', [])
        if not isinstance(extra, list):
            extra = []
        self.settings['accounts'] = extra + [{'id': slug, 'name': label.strip()[:40]}]
        self.accounts = profiles(self.home, self.settings['accounts'])
        for widget in self.winfo_children():
            widget.destroy()
        self.cards = {}
        self.status_labels = {}
        self.geometry('850x' + str(min(1000, 690 + ((len(self.accounts) - 1) // 2) * 105)))
        self.build()
        self.select(slug)
        self.persist()
        self.refresh()

    def connect_habblaud(self):
        account = dict(self.account)
        if not has_package(account):
            messagebox.showerror('Faça login primeiro', 'Prepare esta conta pelo botão Entrar na conta antes de conectá-la.')
            return
        if not messagebox.askyesno('Conectar ao Habblaud',
            'Conectar a conta ' + account['name'] + ' ao escritório? Os hooks serão instalados e o container será reiniciado. Depois você aprova os hooks em /hooks.'):
            return
        self.status.set('Conectando a conta ao Habblaud…')
        def connect():
            try:
                result = subprocess.run(['wsl.exe', '-d', 'Ubuntu', '--', 'python3', '-c', WSL_CONNECT, account['home']],
                    capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=180,
                    creationflags=subprocess.CREATE_NO_WINDOW)
                if result.returncode:
                    detail = (result.stderr or result.stdout).strip()[-1200:]
                    self.after(0, lambda: messagebox.showerror('Não foi possível conectar', detail))
                else:
                    self.after(0, lambda: messagebox.showinfo('Conta conectada', 'Abra o Codex desta conta e aprove os hooks em /hooks.'))
                self.after(0, lambda: self.status.set('Conexão concluída.' if result.returncode == 0 else 'A conexão precisa ser revisada.'))
            except (OSError, subprocess.TimeoutExpired) as exc:
                detail = str(exc)
                self.after(0, lambda: messagebox.showerror('Conexão', detail))
        threading.Thread(target=connect, daemon=True).start()

    def close(self):
        self.persist()
        self.destroy()


def main():
    try:
        import ctypes
        ctypes.windll.shcore.SetProcessDpiAwareness(1)
    except (AttributeError, OSError):
        pass
    App().mainloop()


if __name__ == '__main__':
    main()
