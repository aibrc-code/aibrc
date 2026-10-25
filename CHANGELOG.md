# Changelog

## v0.25.0 — source release, not published to npm

- Extract the pure codec, authorization-shape checks, canonical asset/account
  state and State Hash with Node/browser ESM and type declarations.
- Include fixed positive/negative vectors and a reproducible local package
  build, test and packing path.
- Provide the public specification, English whitepaper, glossary and indexer
  guide. Export the frozen R1 text and document X1 reference semantics.
- Keep seven AIPs and the Merkle reference Proposed; no current instruction or
  state-hash format is changed by those documents.
- Set code licensing to MIT and documentation to CC0-1.0; retain dependency terms.
- Keep the public starting height in one field: `genesisHeight` in
  [config/release.json](config/release.json), `null` until selected for publication.
  Documents reference that file; the site and checker read it. Name Policy V2
  activation derives from the same height. Activated release context remains pinned.
- Provide the directory-style MkDocs site and Cloudflare Pages Git-build instructions;
  the repository remains the only maintained content source.
- Use Covenant Inscription, Account Abstraction, Smart Covenant and Agent Key consistently
  across the whitepaper, application guides and glossary.

Numeric heights in vectors are synthetic test inputs. This preparation does not
announce activation, npm publication, a public remote, a deployed website or a
new production release.
