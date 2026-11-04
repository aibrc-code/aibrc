# Documentation website

The AIBRC website is a directory-style view of this repository: the whitepaper, specification, proposals,
application guides and reference material share one source. MkDocs Material renders that source as a static
site, hosted on Cloudflare Pages.

## Build locally

Use Python 3.11 or newer and Node.js 20.19 or newer (with npm). From the repository root:

```sh
python3 -m venv .docs-venv
.docs-venv/bin/python -m pip install -r site/requirements.txt
.docs-venv/bin/python -m mkdocs build --strict -f site/mkdocs.yml
```

The generated output is `site-build/`. A local build writes static files; publishing is a separate action.
Follow [the Cloudflare setup](CLOUDFLARE_PAGES.md) to connect the public-source repository and protocol domain.

The MkDocs pre-build hook runs `npm ci --ignore-scripts` and `npm run build` first.
It copies the current protocol browser module into `/sign/` before rendering the
documentation, so the existing Cloudflare build command also refreshes that module.
Run `npm run test:sign` to check the static transfer page without using a real wallet.

## One source, two ways to read it

`mkdocs.yml` and `source_files.py` render the repository's existing files in memory. GitHub and the website
use the same source paths, so relative links resolve in both places. The hook includes the specification,
proposals, glossary and selected source references without creating another editable content tree.

The renderer uses system fonts and bundled theme/search assets. It adds no analytics, account login,
external search service, application server or platform credentials. Source-code links are readable downloads.

## Publishing model

Cloudflare's Git integration builds the site after a push to the configured branch. The website needs no
platform production server, custom upload workflow or stored deployment token in this repository. The
protocol domain, project settings and public launch timing are selected when the site is connected.

References: [MkDocs configuration](https://www.mkdocs.org/user-guide/configuration/),
[Material fonts](https://squidfunk.github.io/mkdocs-material/setup/changing-the-fonts/),
[Cloudflare MkDocs guide](https://developers.cloudflare.com/pages/framework-guides/deploy-an-mkdocs-site/).
