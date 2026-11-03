import base64
import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('codex_contas', Path(__file__).with_name('codex_contas.py'))
app = importlib.util.module_from_spec(spec)
spec.loader.exec_module(app)


class LauncherTests(unittest.TestCase):
    def test_accounts_are_isolated_and_parent_environment_is_preserved(self):
        before = dict(os.environ)
        first, second = app.profiles(Path.home())
        a, b = app.child_environment(first), app.child_environment(second)
        self.assertNotEqual(a['CODEX_HOME'], b['CODEX_HOME'])
        self.assertEqual(a['CODEX_HOME'], str(Path.home() / '.codex'))
        self.assertEqual(b['CODEX_HOME'], str(Path.home() / '.codex-cavalca'))
        self.assertEqual(before, dict(os.environ))

    def test_terminal_preserves_metacharacters_as_literal_path(self):
        profile = {'name': "Cavalca'; exit #", 'home': str(Path.home() / '.codex-cavalca')}
        binary = Path("C:/tools/a'b $() & Codex/codex.exe")
        command = app.terminal_command(binary, profile)
        self.assertEqual(command[-2], '-EncodedCommand')
        decoded = base64.b64decode(command[-1]).decode('utf-16-le')
        self.assertIn("Cavalca''; exit #'", decoded)
        self.assertIn("a''b $() & Codex", decoded)
        self.assertEqual(decoded.count('\n'), 1)

    def test_preferences_roundtrip_and_corrupt_file(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'config/settings.json'
            value = {'account': 'cavalca', 'projects': {'cavalca': "C:/Projetos/Análise d'água"}}
            app.save_settings(path, value)
            self.assertEqual(app.read_settings(path), value)
            self.assertNotIn('auth', json.dumps(value))
            path.write_text('broken', encoding='utf-8')
            self.assertEqual(app.read_settings(path), {})

    def test_invalid_and_system_folders_are_rejected(self):
        for value in ['', 'relative/project', os.environ['SystemRoot']]:
            with self.subTest(value=value), self.assertRaises(ValueError):
                app.project_folder(value)
        with tempfile.TemporaryDirectory() as folder:
            self.assertEqual(app.project_folder(folder), Path(folder))

    def test_gui_retains_saved_folder_and_account_changes(self):
        with tempfile.TemporaryDirectory() as folder:
            settings = Path(folder) / 'settings.json'
            app.save_settings(settings, {'account': 'cavalca', 'projects': {'cavalca': folder}})
            real_read = app.read_settings
            with patch.object(app, 'read_settings', side_effect=lambda _: real_read(settings)):
                window = app.App()
            window.settings_path = settings
            window.withdraw()
            try:
                self.assertEqual(window.account_id, 'cavalca')
                self.assertEqual(window.project.get(), folder)
                window.select('principal')
                window.project.set(folder)
                window.select('cavalca')
                self.assertEqual(window.project.get(), folder)
                with patch.object(app.subprocess, 'Popen') as launch:
                    window.open_codex()
                    self.assertEqual(launch.call_args.kwargs['env']['CODEX_HOME'], window.account['home'])
                    self.assertEqual(launch.call_args.kwargs['cwd'], Path(folder))
                    self.assertEqual(launch.call_args.kwargs['creationflags'], app.subprocess.CREATE_NEW_CONSOLE)
            finally:
                window.destroy()


if __name__ == '__main__':
    unittest.main(verbosity=2)
