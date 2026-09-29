;; Enter with ./ratlas-guix; see docs/GUIX_DEVELOPMENT.md.
(use-modules (gnu packages)
             (gnu packages bash)
             (gnu packages node)
             (guix base16)
             (guix build-system copy)
             (guix download)
             (guix gexp)
             ((guix licenses) #:prefix license:)
             (guix packages)
             (guix profiles))

;; Keep package.json and pnpm-lock.yaml authoritative.  The channel's older
;; Node recipe supplies the Guix patches, shared libraries, headers and tests.
(define ratlas-node
  (package
    (inherit node)
    (version "24.21.0")
    (source
     (origin
       (inherit (package-source node))
       (uri (string-append "https://nodejs.org/dist/v" version
                           "/node-v" version ".tar.gz"))
       (sha256
        (base16-string->bytevector
         "622424efb5dc0c26c93fbb619ff10737ee289c605b837c88778e186925d82777"))))))

;; The upstream npm archive includes pnpm's JS dependency bundle.  It runs
;; with Guix Node, not a downloaded standalone executable or Corepack.
(define ratlas-pnpm
  (package
    (name "ratlas-pnpm")
    (version "10.34.0")
    (source
     (origin
       (method url-fetch)
       (uri (string-append "https://registry.npmjs.org/pnpm/-/pnpm-"
                           version ".tgz"))
       (sha256
        (base32 "13jrpr89pdlrb71a7fsxd9v4iv5bblh0c735kdc53pvii0jl7qaq"))))
    (build-system copy-build-system)
    (arguments
     (list
      #:install-plan #~'(("." "share/pnpm"))
      #:phases
      #~(modify-phases %standard-phases
          (add-after 'install 'create-command
            (lambda _
              (mkdir-p (string-append #$output "/bin"))
              (let ((command (string-append #$output "/bin/pnpm")))
                (call-with-output-file command
                  (lambda (port)
                    (format port "#!~a/bin/bash~%" #$bash-minimal)
                    ;; pnpm reserves doctor; retain the project's command.
                    (display "if [ \"${1-}\" = doctor ]; then\n  shift\n  set -- run doctor \"$@\"\nfi\n" port)
                    (format port "exec ~a/bin/node ~a/share/pnpm/bin/pnpm.cjs \"$@\"~%"
                            #$ratlas-node #$output)))
                (chmod command #o755)
                (invoke command "--version")))))))
    (home-page "https://pnpm.io/")
    (synopsis "Pinned pnpm for the ratlas workspace")
    (description "Project-local pnpm with the ratlas doctor command dispatcher.")
    (license license:expat)))

(packages->manifest
 (append (list ratlas-node ratlas-pnpm)
         (map specification->package
              '("bash" "coreutils" "git" "curl" "jq" "python"
                "gcc-toolchain@14" "make" "pkg-config" "sqlite"
                "nss-certs" "nixfmt"))))
