{
  description = "ratlas development environment";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-26.05";

  outputs =
    { nixpkgs, ... }:
    let
      system = "x86_64-linux";
      pkgs = import nixpkgs { inherit system; };
      node = pkgs.nodejs_24;
      pnpm = pkgs.pnpm_10;
      browsers = pkgs.playwright-driver.browsers.override {
        withChromium = false;
        withChromiumHeadlessShell = false;
        withFfmpeg = false;
        withFirefox = true;
        withWebkit = false;
      };
    in
    {
      devShells.${system}.default = pkgs.mkShell {
        packages = [
          node
          pnpm
          pkgs.git
          pkgs.curl
          pkgs.jq
          pkgs.python3
          pkgs.gnumake
          pkgs.pkg-config
          pkgs.sqlite
          pkgs.nixfmt
        ];
        nativeBuildInputs = [ pkgs.stdenv.cc ];
        RATLAS_DEV_SHELL = "1";
        RATLAS_NODE_VERSION = node.version;
        RATLAS_PNPM_VERSION = pnpm.version;
        RATLAS_PLAYWRIGHT_VERSION = pkgs.playwright-driver.version;
        RATLAS_TEST_BROWSER = "firefox";
        PLAYWRIGHT_BROWSERS_PATH = "${browsers}";
        PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD = "1";
        PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS = "true";
        npm_config_build_from_source = "true";
        npm_config_nodedir = "${node}";
        npm_config_python = "${pkgs.python3}/bin/python3";
      };
      checks.${system}.toolchain =
        pkgs.runCommand "ratlas-toolchain-check"
          {
            nativeBuildInputs = [
              node
              pnpm
            ];
          }
          ''
            test "$(node -p 'process.versions.node.split(".")[0]')" = 24
            test "$(pnpm --version | cut -d. -f1)" = 10
            touch "$out"
          '';
      formatter.${system} = pkgs.nixfmt;
      packages.${system} = {
        node-runtime = node;
        test-browsers = browsers;
      };
    };
}
