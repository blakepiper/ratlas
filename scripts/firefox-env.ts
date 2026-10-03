import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export function firefoxUserPreferences() {
  return ['native', 'guix'].includes(process.env.RATLAS_DEV_PLATFORM ?? '')
    ? { 'webgl.force-enabled': true, 'gfx.webrender.all': true }
    : {};
}

// Keep EGL setup inside the isolated Firefox child. The Nix browser needs
// libglvnd's loader plus the host's matching NixOS graphics driver to render
// a real WebGL canvas; the development shell itself remains untouched.
export function firefoxLaunchEnvironment() {
  if (process.env.RATLAS_DEV_PLATFORM === 'native') {
    // Use the host's Mesa libraries only in the isolated automation process.
    const runtime = JSON.parse(readFileSync('.ratlas/firefox-artifact/runtime.json', 'utf8')) as {
      platform: string;
      revision: string;
      playwrightVersion: string;
    };
    if (
      runtime.platform !== 'native' ||
      runtime.revision !== '1511' ||
      runtime.playwrightVersion !== '1.59.1'
    )
      throw new Error('Prepare the matched native Firefox runtime; see docs/DEVELOPMENT.md');
    return {
      ...process.env,
      LD_LIBRARY_PATH: [
        resolve('.ratlas/firefox-runtime/firefox-1511/firefox'),
        process.env.LD_LIBRARY_PATH,
      ]
        .filter(Boolean)
        .join(':'),
      LIBGL_ALWAYS_SOFTWARE: '1',
      MOZ_X11_EGL: '1',
    };
  }
  if (process.env.RATLAS_DEV_PLATFORM === 'guix') {
    if (!existsSync('.ratlas/firefox-artifact/runtime.json')) return process.env;
    const runtime = JSON.parse(readFileSync('.ratlas/firefox-artifact/runtime.json', 'utf8')) as {
      libraryPaths: string[];
      mesa: string;
      revision: string;
      playwrightVersion: string;
    };
    if (
      runtime.revision !== '1511' ||
      runtime.playwrightVersion !== '1.59.1' ||
      !Array.isArray(runtime.libraryPaths) ||
      !runtime.libraryPaths.every((p) => typeof p === 'string' && p.startsWith('/gnu/store/')) ||
      !runtime.mesa.startsWith('/gnu/store/')
    )
      throw new Error('Invalid matched Guix Firefox runtime');
    return {
      ...process.env,
      LD_LIBRARY_PATH: [
        resolve('.ratlas/firefox-runtime/firefox-1511/firefox'),
        ...runtime.libraryPaths,
      ].join(':'),
      LIBGL_ALWAYS_SOFTWARE: '1',
      MOZ_X11_EGL: '1',
      LIBGL_DRIVERS_PATH: runtime.mesa + '/lib/dri',
    };
  }
  const loader = process.env.RATLAS_EGL_LIB_DIR;
  const driver = '/run/opengl-driver';
  if (
    !loader ||
    !existsSync(`${loader}/libEGL.so.1`) ||
    !existsSync(`${driver}/share/glvnd/egl_vendor.d/50_mesa.json`)
  )
    return process.env;
  return {
    ...process.env,
    LD_LIBRARY_PATH: [loader, `${driver}/lib`, process.env.LD_LIBRARY_PATH]
      .filter(Boolean)
      .join(':'),
    LIBGL_DRIVERS_PATH: `${driver}/lib/dri`,
    __EGL_VENDOR_LIBRARY_FILENAMES: `${driver}/share/glvnd/egl_vendor.d/50_mesa.json`,
  };
}
