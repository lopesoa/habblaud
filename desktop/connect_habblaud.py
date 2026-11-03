"""Connect an explicitly selected local Codex profile; never read credential files."""
WSL_CONNECT = r'''
import json, os, pathlib, re, subprocess, sys, urllib.request
raw = sys.argv[1].replace('\\', '/')
match = re.fullmatch(r'([A-Za-z]):(/Users/[^/]+)/(\.codex(?:[-_.][A-Za-z0-9_-]+)?)', raw)
if not match: raise RuntimeError('Pasta de conta inválida.')
profile = pathlib.Path('/mnt/' + match[1].lower() + match[2] + '/' + match[3])
if not profile.is_dir(): raise RuntimeError('A conta ainda não foi preparada.')
home = pathlib.Path.home()
marker = home / '.config/habblaud/active-source'
root = pathlib.Path(marker.read_text().strip()) if marker.exists() else home / 'habblaud'
if not (root / 'package.json').is_file(): raise RuntimeError('Instalação do Habblaud não encontrada.')
envfile = home / '.config/habblaud/env'
text = envfile.read_text() if envfile.exists() else ''
entry = re.search(r'^(?:export )?HABBLAUD_CODEX_DIRS=(.*)$', text, re.M)
dirs = [d.strip() for d in entry[1].split(',') if d.strip()] if entry else []
if str(profile) not in dirs: dirs.append(str(profile))
joined = ','.join(dirs)
for file, prefix in [(envfile, 'export '), (root / '.env', ''), (home / '.config/systemd/user/habblaud-codex-bridge.service', 'Environment=')]:
    if not file.exists() and 'service' in file.name: continue
    old = file.read_text() if file.exists() else ''
    expression = r'^(?:export |Environment=)?HABBLAUD_CODEX_DIRS=.*$'
    new = re.sub(expression, lambda _: prefix + 'HABBLAUD_CODEX_DIRS=' + joined, old, flags=re.M)
    if new == old and not re.search(expression, old, re.M): new += '\n' + prefix + 'HABBLAUD_CODEX_DIRS=' + joined + '\n'
    file.parent.mkdir(parents=True, exist_ok=True)
    file.with_name(file.name + '.before-account-manager').write_text(old)
    file.write_text(new)
native = profile.parent / '.habblaud'
native.mkdir(exist_ok=True)
windows_dirs = [str(pathlib.Path(d)).replace('/mnt/' + match[1].lower(), match[1].upper() + ':').replace('/', '\\') for d in dirs]
(native / 'codex-profiles.json').write_text(json.dumps(windows_dirs))
env = dict(os.environ, HABBLAUD_CODEX_DIRS=joined)
subprocess.run(['npm', 'run', 'codex:install'], cwd=root, env=env, check=True)
subprocess.run(['npm', 'run', 'docker:up', '--', '--no-build'], cwd=root, env=env, check=True)
subprocess.run(['systemctl', '--user', 'daemon-reload'], check=True)
subprocess.run(['systemctl', '--user', 'restart', 'habblaud-codex-bridge'], check=True)
try:
    url = 'http://127.0.0.1:4747/api/dashboard'
    with urllib.request.urlopen(url, timeout=10) as response: config = json.load(response)
    if match[3] not in config['accounts']: config['accounts'].append(match[3])
    request = urllib.request.Request(url, json.dumps(config).encode(), headers={'Content-Type':'application/json'}, method='PUT')
    with urllib.request.urlopen(request, timeout=10) as response: response.read()
except urllib.error.HTTPError as error:
    if error.code != 404: raise
print('Conta conectada. Abra o Codex e aprove os hooks do Habblaud em /hooks.')
'''
