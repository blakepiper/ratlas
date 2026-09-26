import { existsSync } from 'node:fs';

// Keep EGL setup inside the isolated Firefox child. The Nix browser needs
// libglvnd's loader plus the host's matching NixOS graphics driver to render
// a real WebGL canvas; the development shell itself remains untouched.
export function firefoxLaunchEnvironment() {
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
