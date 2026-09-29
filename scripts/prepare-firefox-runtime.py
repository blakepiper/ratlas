"""Prepare only the hash-pinned Firefox binary with prebuilt Guix libraries."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import zipfile

root = Path.cwd()
artifact = root / '.ratlas/firefox-artifact'
bundle = root / '.ratlas/firefox-runtime'
archive = artifact / 'firefox-1511.zip'
expected = 'cca34e60c472e94fc8f664cbaf8f286f62f78e9ca21ac2643cf95c932f099607'
if hashlib.sha256(archive.read_bytes()).hexdigest() != expected:
    raise SystemExit('Firefox artifact hash mismatch')
versions = json.loads((root / 'node_modules/.pnpm/playwright-core@1.59.1/node_modules/playwright-core/browsers.json').read_text())
firefox = next(b for b in versions['browsers'] if b['name'] == 'firefox')
if firefox['revision'] != '1511' or firefox['browserVersion'] != '148.0.2':
    raise SystemExit('Firefox revision does not match pinned Playwright')
roots = (artifact / 'lib-paths.txt').read_text().splitlines()
closure = subprocess.check_output(['guix', 'gc', '--requisites', *roots], text=True).splitlines()
all_libs = [p + '/lib' for p in closure if Path(p, 'lib').is_dir()]
node = Path(subprocess.check_output(['which', 'node'], text=True).strip()).resolve()
loader = subprocess.check_output(['readelf', '-l', str(node)], text=True).split('interpreter: ')[1].split(']')[0]
# Use direct runtime roots and the necessary GTK/graphics libraries. Adding
# every build dependency to LD_LIBRARY_PATH can load incompatible libraries.
direct = [p + '/lib' for p in roots if Path(p, 'lib').is_dir()]
names = ['-pango-', '-cairo-', '-gdk-pixbuf-', '-glib-', '-atk-', '-at-spi2-core-',
         '-fontconfig-', '-freetype-', '-dbus-', '-libglvnd-', 'gcc-14.3.0-lib']
libs = list(dict.fromkeys([str(Path(loader).parent)] + direct +
                         [p for p in all_libs if any(n in p for n in names)]))
base = bundle / 'firefox-1511/firefox'
if base.exists():
    raise SystemExit('Firefox runtime already exists; preserve it or remove only this generated bundle before preparing again')
with zipfile.ZipFile(archive) as contents:
    for entry in contents.infolist():
        target = (base.parent / entry.filename).resolve()
        if not target.is_relative_to(base.parent.resolve()):
            raise SystemExit('Unsafe archive path')
    contents.extractall(base.parent)
    for entry in contents.infolist():
        mode = entry.external_attr >> 16
        if mode:
            os.chmod(base.parent / entry.filename, mode)
patcher = next(p + '/bin/patchelf' for p in roots if Path(p, 'bin/patchelf').is_file())
for binary in base.iterdir():
    if not binary.is_file() or binary.open('rb').read(4) != b'\x7fELF':
        continue
    result = subprocess.run([patcher, '--print-interpreter', str(binary)], capture_output=True)
    if result.returncode == 0:
        subprocess.run([patcher, '--set-interpreter', loader, str(binary)], check=True)
mesa = next(p for p in roots if 'mesa-' in p and not p.endswith('-bin'))
metadata = {'archiveSha256': expected, 'playwrightVersion': '1.59.1',
            'revision': '1511', 'browserVersion': '148.0.2',
            'loader': loader, 'libraryPaths': libs, 'roots': roots, 'mesa': mesa}
(artifact / 'runtime.json').write_text(json.dumps(metadata, indent=2) + '\n')
print('Prepared project-local Firefox 148.0.2 (Playwright revision 1511) with prebuilt Guix libraries')
