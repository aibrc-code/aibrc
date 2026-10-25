# Publish the protocol documentation on Cloudflare Pages

Cloudflare Pages builds the static site from GitHub. The repository holds the only maintained copy of the
whitepaper and documentation; the website renders it. This release prepares that build without creating a
Cloudflare project or publishing a domain.

## 1. Prepare the protocol repository

Initialize the dedicated protocol GitHub repository from the clean public-source export. It contains the
protocol's own root `package.json`, `site/` and `docs/`, without the private application's history. The
repository can remain private while the Owner prepares the launch; Cloudflare's GitHub integration can be
authorized to read it.

This is a source release. No npm publication is needed to build or host the site.

## 2. Connect GitHub to Pages

In Cloudflare, create a Pages project and connect the intended GitHub repository through its Git integration.
Select the branch whose commits should update the production site.

| Setting | Value for the standalone protocol repository |
| --- | --- |
| Framework preset | None |
| Root directory | Repository root; leave empty or select `/` |
| Build command | `pip install -r site/requirements.txt && mkdocs build --strict -f site/mkdocs.yml` |
| Build output directory | `site-build` |
| Build environment | `PYTHON_VERSION=3.11` |

Dependencies are pinned in `site/requirements.txt`. For this dedicated source export, the documentation
build uses Python and needs no private platform package installation. These settings assume the protocol
export is the repository root, not nested inside the private application repository.

Subsequent pushes to the configured production branch trigger builds. Preview-branch builds follow the
project's separate deployment settings. No upload workflow or deployment token is included here.

## 3. Control access before public launch

A private GitHub repository protects the source repository; it does **not** make a deployed website private.
A Pages URL can be reachable before a custom domain is attached.

For private review, use Cloudflare Access with an appropriate policy and verify it from a signed-out client.
Preview protection and production-host protection must each cover the host actually used. If private access
is not configured, keep the review local and do not publish sensitive or pre-release material to a reachable
Pages deployment. A domain name or `noindex` directive is not access control.

## 4. Bind the protocol domain at launch

In the Pages project, add the chosen protocol domain under Custom domains and follow Cloudflare's DNS setup.
Configure the zone or CNAME as appropriate to the hostname. Check HTTPS and an actual documentation page on
the domain before announcing it.

Set only `genesisHeight` in [config/release.json](../config/release.json) when the release boundary is selected.
The specification and other documents reference that file; the website and checker read it. Current
Name Policy V2 activation derives from the same height. Publish the resulting source and site as one release,
then configure the host indexer with that pinned context. Synthetic vector heights remain test data.

A documentation deployment does not activate protocol rules or reset an application's indexer. Those use the
separate versioned activation and operating procedures.

## 5. Maintain the site

Edit this repository, verify its relative links and local static build, then push to the configured branch.
Check Cloudflare's build result and the resulting site. Keep changes in the Git source rather than editing a
second website copy. Review Access policies explicitly when moving from private preparation to public access.

Official references:

- [MkDocs on Pages](https://developers.cloudflare.com/pages/framework-guides/deploy-an-mkdocs-site/)
- [Git integration](https://developers.cloudflare.com/pages/configuration/git-integration/)
- [Build environment](https://developers.cloudflare.com/pages/configuration/build-image/)
- [Preview deployments and access](https://developers.cloudflare.com/pages/configuration/preview-deployments/)
- [Custom domains](https://developers.cloudflare.com/pages/configuration/custom-domains/)
