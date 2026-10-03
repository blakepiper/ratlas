"""Fetch verified prebuilt tools into this checkout; never install globally."""
import base64
import fcntl
import hashlib
import json
import os
from pathlib import Path
import platform
import subprocess
import sys
import tarfile
import tempfile

root = Path(__file__).resolve().parent.parent
if sys.version_info < (3, 12):
    raise SystemExit('Python 3.12 or newer is required for safe archive extraction.')
config = json.loads((root / 'toolchain.json').read_text())
if platform.system() != 'Linux' or platform.machine() != 'x86_64':
    raise SystemExit('The pinned prebuilt toolchain supports Linux x86_64.')
tools = root / '.ratlas/toolchain'
tools.mkdir(parents=True, exist_ok=True, mode=0o700)
lock = (tools / 'bootstrap.lock').open('a')
fcntl.flock(lock, fcntl.LOCK_EX)

for name in ('node', 'pnpm'):
    package = config[name]
    destination = tools / f'{name}-{package["version"]}'
    entry = destination / ('bin/node' if name == 'node' else 'bin/pnpm.cjs')
    if entry.is_file():
        continue
    if destination.exists():
        raise SystemExit(f'Incomplete toolchain at {destination}; preserve or remove only that generated directory.')
    archive = tools / f'{name}-{package["version"]}.tar'
    algorithm = 'sha256' if name == 'node' else 'sha512'
    expected = (bytes.fromhex(package[algorithm]) if name == 'node'
                else base64.b64decode(package[algorithm], validate=True))
    if not archive.exists():
        with tempfile.TemporaryDirectory(dir=tools) as download_dir:
            download = Path(download_dir) / 'archive'
            print(f'Downloading prebuilt {name} {package["version"]}…', flush=True)
            subprocess.run(['curl', '--fail', '--location', '--proto', '=https',
                            '--proto-redir', '=https', '--max-time', '180',
                            '--silent', '--show-error', package['url'],
                            '--output', str(download)], check=True)
            with download.open('rb') as content:
                if hashlib.file_digest(content, algorithm).digest() != expected:
                    raise SystemExit(f'{name} archive checksum mismatch')
            os.replace(download, archive)
    with archive.open('rb') as content:
        if hashlib.file_digest(content, algorithm).digest() != expected:
            raise SystemExit(f'{name} archive checksum mismatch: {archive}')
    with tempfile.TemporaryDirectory(dir=tools) as staging:
        with tarfile.open(archive) as contents:
            contents.extractall(staging, filter='data')
        extracted = list(Path(staging).iterdir())
        if len(extracted) != 1 or not extracted[0].is_dir():
            raise SystemExit(f'Unexpected {name} archive layout')
        os.rename(extracted[0], destination)

bin_dir = tools / 'bin'
bin_dir.mkdir(exist_ok=True)
node = tools / f'node-{config["node"]["version"]}' / 'bin/node'
wrapper = bin_dir / 'pnpm'
# Relative lookup keeps the checkout relocatable. pnpm reserves its own doctor.
wrapper_text = '''#!/usr/bin/env bash
set -euo pipefail
toolchain_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
if [[ ${1:-} == doctor ]]; then
  shift
  set -- run doctor "$@"
fi
exec "$toolchain_dir/node-''' + config['node']['version'] + '''/bin/node" "$toolchain_dir/pnpm-''' + config['pnpm']['version'] + '''/bin/pnpm.cjs" "$@"
'''
if not wrapper.exists() or wrapper.read_text() != wrapper_text:
    with tempfile.TemporaryDirectory(dir=bin_dir) as staging:
        staged_wrapper = Path(staging) / 'pnpm'
        staged_wrapper.write_text(wrapper_text)
        staged_wrapper.chmod(0o755)
        os.replace(staged_wrapper, wrapper)
if subprocess.check_output([node, '--version'], text=True).strip() != 'v' + config['node']['version']:
    raise SystemExit('Project-local Node version mismatch')
