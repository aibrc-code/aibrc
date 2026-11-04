# Add the AIBRC Transfer reference page

Upload these files to the root of the protocol repository (aibrc-code/aibrc).
Do not upload a parent folder or the ZIP itself. Existing documentation, theme,
genesis settings and build files are deliberately not replaced by this ZIP.

The six files under tools/sign include the tested local browser module.
No private report, local test screenshot or platform code is included.

## Connect the existing documentation build

The page is not automatically published merely by uploading its source.
Apply the included narrow patch from a checkout of the protocol repository:

```sh
git apply --check SIGN_PAGE_BUILD_WIRING.patch
git apply SIGN_PAGE_BUILD_WIRING.patch
npm ci --ignore-scripts
npm run build
npm run test:sign
python3 -m mkdocs build --strict -f site/mkdocs.yml
```

The patch is based on the fixed c78ab92 protocol export. It changes only the
browser-module copy, test command, generated-file ignore, static-path hook and
/sign response headers. If the check fails because your repository has changed,
merge these small changes into the existing files; do not force the patch or
replace your current configuration with an old copy. Existing headers must be
merged, not discarded. Keep the current Cloudflare hosting configuration.

The build must contain site-build/sign/index.html, sign.js, sign.css, the local
aibrc-protocol.browser.js module and the root _headers file. The intended URL
is /sign/ on the protocol documentation domain. This ZIP does not deploy it.

Source: 8a099607f722bd79583143aa9cff90b2643b33eb (internal implementation exact).
Live-wallet memo encoding/output order and OKX in-app support remain untested.
No real transaction was signed or broadcast during development.
