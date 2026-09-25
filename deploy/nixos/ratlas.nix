{ config, lib, ... }:
let
  inherit (lib)
    mkEnableOption
    mkIf
    mkOption
    types
    ;
  cfg = config.services.ratlas;
  requiredPath = value: if value == null then "/missing-ratlas-path" else value;
  node = if cfg.nodeRuntime == null then "/missing-node-runtime" else "${cfg.nodeRuntime}/bin/node";
in
{
  options.services.ratlas = {
    enable = mkEnableOption "ratlas read-only API and separate collector";
    checkout = mkOption {
      type = types.nullOr types.str;
      default = null;
      description = "Absolute path to a built ratlas checkout, outside the Nix store.";
    };
    configFile = mkOption {
      type = types.nullOr types.str;
      default = null;
      description = "Absolute path to explicit live configuration.";
    };
    dataDir = mkOption {
      type = types.nullOr types.str;
      default = null;
      description = "Absolute writable application data and log directory.";
    };
    observerHome = mkOption {
      type = types.nullOr types.str;
      default = null;
      description = "Absolute home path of an existing dedicated public-only observer.";
    };
    observerSocket = mkOption {
      type = types.nullOr types.str;
      default = null;
      description = "Absolute control-socket path of that observer.";
    };
    nodeRuntime = mkOption {
      type = types.nullOr types.package;
      default = null;
      description = "ratlas flake packages.x86_64-linux.node-runtime export.";
    };
  };

  config = mkIf cfg.enable {
    assertions = [
      {
        assertion = lib.all (path: path != null && lib.hasPrefix "/" path) [
          cfg.checkout
          cfg.configFile
          cfg.dataDir
          cfg.observerHome
          cfg.observerSocket
        ];
        message = "ratlas requires explicit absolute checkout, config, data, observer-home, and observer-socket paths";
      }
      {
        assertion = cfg.nodeRuntime != null;
        message = "ratlas requires its explicit packages.x86_64-linux.node-runtime package";
      }
      {
        assertion = cfg.checkout == null || !lib.hasPrefix "/nix/store/" cfg.checkout;
        message = "ratlas checkout must be a writable, built checkout outside /nix/store";
      }
    ];

    users.groups.ratlas = { };
    users.users.ratlas = {
      isSystemUser = true;
      group = "ratlas";
      home = requiredPath cfg.dataDir;
    };

    systemd.services.ratlas-api = {
      description = "ratlas read-only API";
      wantedBy = [ "multi-user.target" ];
      after = [
        "network.target"
        "ratlas-collector.service"
      ];
      serviceConfig = {
        Type = "simple";
        User = "ratlas";
        Group = "ratlas";
        WorkingDirectory = requiredPath cfg.checkout;
        ExecStart = "${node} ${requiredPath cfg.checkout}/apps/service/dist/main-api.js --config ${requiredPath cfg.configFile}";
        Environment = "NODE_ENV=production";
        Restart = "on-failure";
        NoNewPrivileges = true;
        PrivateTmp = true;
        ProtectSystem = "strict";
        ProtectHome = true;
        ReadOnlyPaths = [ (requiredPath cfg.dataDir) ];
        InaccessiblePaths = [
          (requiredPath cfg.observerHome)
          (requiredPath cfg.observerSocket)
        ];
        RestrictAddressFamilies = [
          "AF_UNIX"
          "AF_INET"
          "AF_INET6"
        ];
      };
    };

    systemd.services.ratlas-collector = {
      description = "ratlas observation collector";
      wantedBy = [ "multi-user.target" ];
      after = [ "network.target" ];
      serviceConfig = {
        Type = "simple";
        User = "ratlas";
        Group = "ratlas";
        WorkingDirectory = requiredPath cfg.checkout;
        ExecStart = "${node} ${requiredPath cfg.checkout}/apps/service/dist/main-collector.js --config ${requiredPath cfg.configFile}";
        Environment = "NODE_ENV=production";
        Restart = "on-failure";
        NoNewPrivileges = true;
        PrivateTmp = true;
        ProtectSystem = "strict";
        ProtectHome = true;
        ReadWritePaths = [ (requiredPath cfg.dataDir) ];
        ReadOnlyPaths = [
          (requiredPath cfg.observerHome)
          (requiredPath cfg.observerSocket)
        ];
        RestrictAddressFamilies = [
          "AF_UNIX"
          "AF_INET"
          "AF_INET6"
        ];
      };
    };
  };
}
