"""Render the repository sources in memory; never create a second content copy."""
from pathlib import Path
from mkdocs.structure.files import File, Files

ROOT = Path(__file__).resolve().parent.parent
ROOT_PAGES = (
    "README.md", "TRUST_MODEL.md", "CONTRIBUTING.md", "CHANGELOG.md",
    "THIRD_PARTY_NOTICES.md", "LICENSE-CODE", "LICENSE-DOCS",
)
SOURCE_DIRS = ("docs", "spec", "proposals", "merkle", "vectors", "config")
SDK_FILES = ("packages/protocol/README.md", "packages/protocol/package.json")
SITE_FILES = ("site/README.md", "site/CLOUDFLARE_PAGES.md", "site/mkdocs.yml", "site/source_files.py", "site/requirements.txt")


def on_files(files, config):
    # src_uri mirrors GitHub paths, so relative links stay identical in both views.
    paths = [ROOT / name for name in ROOT_PAGES + SDK_FILES + SITE_FILES]
    for directory in SOURCE_DIRS:
        paths.extend(sorted((ROOT / directory).rglob("*")))
    paths.extend(sorted((ROOT / "packages/protocol/src").glob("*.ts")))
    rendered = Files([])
    for path in paths:
        if path.is_symlink():
            raise ValueError("Documentation source must not be a symlink")
        if not path.is_file():
            continue
        name = path.relative_to(ROOT).as_posix()
        uri = name
        rendered.append(File.generated(config, uri, abs_src_path=str(path)))
    return rendered
