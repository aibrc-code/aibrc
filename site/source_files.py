"""Render the repository sources in memory; never create a second content copy."""
from pathlib import Path
import json
import subprocess
from mkdocs.structure.files import File, Files

ROOT = Path(__file__).resolve().parent.parent
ROOT_PAGES = (
    "README.md", "TRUST_MODEL.md", "CONTRIBUTING.md", "CHANGELOG.md",
    "THIRD_PARTY_NOTICES.md", "LICENSE-CODE", "LICENSE-DOCS",
)
SOURCE_DIRS = ("docs", "spec", "proposals", "merkle", "vectors", "config")
SDK_FILES = ("packages/protocol/README.md", "packages/protocol/package.json")
SITE_FILES = ("site/README.md", "site/CLOUDFLARE_PAGES.md", "site/mkdocs.yml", "site/source_files.py", "site/requirements.txt", "site/assets/stylesheets/aibrc-dark.css")


def on_config(config):
    # Pin one validated release snapshot for the entire documentation build.
    release = json.loads((ROOT / "config/release.json").read_text(encoding="utf-8"))
    expected = {
        "protocolVersion": "0.25",
        "bitcoinNetwork": "mainnet",
        "namePolicyVersion": 2,
        "inputAuthorizationRuleId": "aibrc-input-authorization/bip341-keypath-v1",
    }
    if not isinstance(release, dict) or set(release) != set(expected) | {"genesisHeight"}:
        raise ValueError("Unexpected release configuration fields")
    for key, value in expected.items():
        if release.get(key) != value:
            raise ValueError("Unexpected release context: " + key)
    if "genesisHeight" not in release:
        raise ValueError("Missing genesisHeight")
    height = release["genesisHeight"]
    if height is not None and (type(height) not in (int, float) or not 0 <= height <= 0xffffffff or int(height) != height):
        raise ValueError("genesisHeight must be null or an unsigned 32-bit integer")
    if height is not None:
        release["genesisHeight"] = int(height)
    reference = json.loads((ROOT / "config/network.example.json").read_text(encoding="utf-8"))
    if reference.get("releaseFile") != "./release.json" or "genesisHeight" in reference or "namePolicy" in reference:
        raise ValueError("Example must reference the single release source without duplicate heights")
    config.extra["aibrc_release_context"] = dict(release)
    return config


def on_page_markdown(markdown, page, config, files):
    marker = "<!-- AIBRC_RELEASE_CONTEXT -->"
    if marker not in markdown:
        return markdown
    release = config.extra["aibrc_release_context"]
    height = release["genesisHeight"]
    display = "Not selected (pre-release)" if height is None else str(height)
    table = (
        "| Release parameter | Published value |\n"
        "| --- | --- |\n"
        "| Network | mainnet |\n"
        "| Genesis height | " + display + " |\n"
        "| Name Policy V2 activation | " + display + " |\n"
    )
    return markdown.replace(marker, table)


def on_pre_build(config):
    # Also covers the existing Cloudflare command that invokes MkDocs directly.
    # Install only pinned protocol dependencies; no npm lifecycle install scripts.
    subprocess.run(["npm", "ci", "--ignore-scripts", "--no-audit", "--no-fund"], cwd=ROOT, check=True)
    subprocess.run(["npm", "run", "build"], cwd=ROOT, check=True)


def on_files(files, config):
    # src_uri mirrors GitHub paths, so relative links stay identical in both views.
    paths = [ROOT / name for name in ROOT_PAGES + SDK_FILES + SITE_FILES]
    for directory in SOURCE_DIRS:
        paths.extend(sorted((ROOT / directory).rglob("*")))
    paths.extend(sorted((ROOT / "packages/protocol/src").glob("*.ts")))
    # Keep theme/plugin CSS, JavaScript and search assets. Only replace the
    # document mapping; replacing the entire collection drops the theme assets.
    rendered = Files(file for file in files if not file.is_documentation_page())
    for path in paths:
        if path.is_symlink():
            raise ValueError("Documentation source must not be a symlink")
        if not path.is_file():
            continue
        name = path.relative_to(ROOT).as_posix()
        uri = name
        rendered.append(File.generated(config, uri, abs_src_path=str(path)))
        
    for name in ("index.html", "sign.js", "sign.css", "aibrc-protocol.browser.js"):
        path = ROOT / "tools/sign" / name
        if not path.is_file() or path.is_symlink():
            raise ValueError(f"Static sign asset missing: {name}; run npm run build first")
        rendered.append(File.generated(config, f"sign/{name}", abs_src_path=str(path)))
    rendered.append(File.generated(config, "_headers", abs_src_path=str(ROOT / "site/static/_headers")))
    return rendered
