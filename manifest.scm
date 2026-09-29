;; Enter with ./ratlas-guix; see docs/GUIX_DEVELOPMENT.md.
(use-modules (gnu packages)
             (gnu packages bash)
             (guix build-system copy)
             (guix download)
             (guix gexp)
             ((guix licenses) #:prefix license:)
             (guix packages)
             (guix profiles))

;; Use the channel's prebuilt runtime, not a custom Node source build.
(define ratlas-node (specification->package "node@24.18.0"))

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

;; The entry point checks these with --max-jobs=0 before constructing the
;; pnpm wrapper/profile, so unavailable substitutes cannot start a compiler.
(define ratlas-prebuilt-packages
  (cons ratlas-node
        (map specification->package
             '("bash" "coreutils" "git" "curl" "jq" "python"
               "gcc-toolchain@14" "make" "pkg-config" "sqlite"
               "nss-certs" "nixfmt"))))

(packages->manifest (cons ratlas-pnpm ratlas-prebuilt-packages))
