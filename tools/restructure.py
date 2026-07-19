#!/usr/bin/env python3
"""Safely migrate Shape Slayer to its domain-oriented directory layout.

Dry-run is the default. Mutations require --apply. Every dry-run projects the
result in memory and validates paths/references before any git move is run.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from typing import Callable, Iterable


ROOT = Path(__file__).resolve().parents[1]
PHASES = ("client-assets", "rename-relay", "tools")
TEXT_SUFFIXES = {".css", ".html", ".js", ".json", ".md", ".py", ".sql", ".txt"}
SKIP_PARTS = {".git", "node_modules", "data", "logs"}


@dataclass(frozen=True)
class Move:
    source: str
    destination: str


@dataclass(frozen=True)
class Delete:
    path: str


@dataclass
class Projection:
    files: dict[str, bytes]

    @classmethod
    def load(cls) -> "Projection":
        files: dict[str, bytes] = {}
        for path in ROOT.rglob("*"):
            if not path.is_file():
                continue
            relative = path.relative_to(ROOT)
            if any(part in SKIP_PARTS for part in relative.parts):
                continue
            files[relative.as_posix()] = path.read_bytes()
        return cls(files)

    def has(self, path: str) -> bool:
        prefix = path.rstrip("/") + "/"
        return path in self.files or any(item.startswith(prefix) for item in self.files)

    def move(self, operation: Move) -> None:
        source = operation.source.rstrip("/")
        destination = operation.destination.rstrip("/")
        if source in self.files:
            self.files[destination] = self.files.pop(source)
            return

        prefix = source + "/"
        matches = [path for path in self.files if path.startswith(prefix)]
        if not matches:
            if self.has(destination):
                return
            raise ValueError(f"move source does not exist: {source}")
        for path in matches:
            suffix = path[len(prefix) :]
            self.files[f"{destination}/{suffix}"] = self.files.pop(path)

    def delete(self, operation: Delete) -> None:
        self.files.pop(operation.path, None)

    def text(self, path: str) -> str:
        return self.files[path].decode("utf-8")

    def rewrite(self, path: str, transform: Callable[[str], str]) -> bool:
        if path not in self.files:
            return False
        try:
            old = self.text(path)
        except UnicodeDecodeError:
            return False
        new = transform(old)
        if new == old:
            return False
        self.files[path] = new.encode("utf-8")
        return True


def run(command: list[str]) -> None:
    subprocess.run(command, cwd=ROOT, check=True)


def git_status() -> list[str]:
    result = subprocess.run(
        ["git", "status", "--porcelain"],
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=True,
    )
    return [line for line in result.stdout.splitlines() if line]


def path_exists(files: Iterable[str], path: str) -> bool:
    prefix = path.rstrip("/") + "/"
    return path in files or any(item.startswith(prefix) for item in files)


def add_move_if_present(
    projection: Projection, operations: list[Move], source: str, destination: str
) -> None:
    if projection.has(source) and not projection.has(destination):
        operation = Move(source, destination)
        operations.append(operation)
        projection.move(operation)


def client_asset_moves(projection: Projection) -> list[Move]:
    operations: list[Move] = []
    add_move_if_present(projection, operations, "js", "src/js")
    add_move_if_present(projection, operations, "ui", "src/ui")
    add_move_if_present(projection, operations, "css/ui", "src/css")
    add_move_if_present(projection, operations, "fonts", "assets/fonts")
    add_move_if_present(projection, operations, "icons", "assets/icons")

    runtime_audio = sorted(
        path
        for path in projection.files
        if path.startswith("audio/")
        and (
            PurePosixPath(path).suffix.lower() in {".mp3", ".ogg", ".wav"}
            or path == "audio/music-config.json"
        )
        and "/originals/" not in path
    )
    for source in runtime_audio:
        destination = source.replace("audio/", "assets/audio/", 1)
        operation = Move(source, destination)
        operations.append(operation)
        projection.move(operation)
    return operations


def relay_moves(projection: Projection) -> list[Move]:
    operations: list[Move] = []
    add_move_if_present(projection, operations, "server", "multiplayer")
    add_move_if_present(projection, operations, "server.js", "static-server.js")
    return operations


def tool_moves(projection: Projection) -> list[Move]:
    operations: list[Move] = []
    remaining_audio = sorted(path for path in projection.files if path.startswith("audio/"))
    for source in remaining_audio:
        destination = source.replace("audio/", "tools/audio/", 1)
        operation = Move(source, destination)
        operations.append(operation)
        projection.move(operation)

    add_move_if_present(
        projection,
        operations,
        "scripts/generate-pwa-icons.py",
        "tools/icons/generate-pwa-icons.py",
    )
    return operations


def replace_client_paths(text: str) -> str:
    replacements = (
        ("css/ui/", "src/css/"),
        ("./src/js/", "./src/game/"),
        ("./src/ui/", "./src/game/ui/"),
        ("./js/", "./src/game/"),
        ("./ui/", "./src/game/ui/"),
        ("./audio/", "./assets/audio/"),
        ("./icons/", "./assets/icons/"),
        ("./fonts/", "./assets/fonts/"),
        ('"src/js/', '"src/game/'),
        ("'src/js/", "'src/game/"),
        ('"src/ui/', '"src/game/ui/'),
        ("'src/ui/", "'src/game/ui/"),
        ('"js/', '"src/game/'),
        ("'js/", "'src/game/"),
        ('"ui/', '"src/game/ui/'),
        ("'ui/", "'src/game/ui/"),
        ('"audio/', '"assets/audio/'),
        ("'audio/", "'assets/audio/"),
        ('"icons/', '"assets/icons/'),
        ("'icons/", "'assets/icons/"),
        ('"fonts/', '"assets/fonts/'),
        ("'fonts/", "'assets/fonts/"),
        ("../src/js/", "../src/game/"),
        ("../src/ui/", "../src/game/ui/"),
        ("../js/", "../src/game/"),
        ("../ui/", "../src/game/ui/"),
    )
    for old, new in replacements:
        text = text.replace(old, new)
    return text


def replace_test_segments(text: str) -> str:
    text = replace_client_paths(text)
    text = re.sub(
        r"(?P<comma>,\s*)(?P<quote>['\"])js(?P=quote)(?=\s*,)",
        r"\g<comma>\g<quote>src\g<quote>, \g<quote>js\g<quote>",
        text,
    )
    text = text.replace("path.join(root, 'js')", "path.join(root, 'src', 'js')")
    text = text.replace(
        "path.join(root, 'js', 'main.js')",
        "path.join(root, 'src', 'js', 'main.js')",
    )
    text = text.replace(
        "allowedTopLevelDirectories: new Set(['js'])",
        "allowedTopLevelDirectories: new Set(['src'])",
    )
    text = text.replace("'/js/main.js'", "'/src/game/main.js'")
    text = text.replace("'/src/js/main.js'", "'/src/game/main.js'")
    text = text.replace("'/js/../../etc/passwd'", "'/src/game/../../etc/passwd'")
    text = text.replace("'/src/js/../../etc/passwd'", "'/src/game/../../etc/passwd'")
    return text


def bump_cache_version(text: str) -> str:
    match = re.search(r"(const CACHE_VERSION = ')(\d+(?:\.\d+)+)(';)", text)
    if not match:
        raise ValueError("sw.js CACHE_VERSION was not found")
    parts = match.group(2).split(".")
    parts[-1] = str(int(parts[-1]) + 1)
    return text[: match.start()] + match.group(1) + ".".join(parts) + match.group(3) + text[match.end() :]


def rewrite_client_assets(projection: Projection) -> list[str]:
    changed: list[str] = []

    explicit: dict[str, Callable[[str], str]] = {
        "index.html": replace_client_paths,
        "manifest.json": replace_client_paths,
        "sw.js": lambda text: bump_cache_version(replace_client_paths(text)),
        "src/game/main.js": replace_client_paths,
        "src/engine/music.js": replace_client_paths,
        "assets/audio/music-config.json": replace_client_paths,
        "src/css/base.css": lambda text: text.replace(
            "../../fonts/", "../../assets/fonts/"
        ),
        "server.js": lambda text: text.replace(
            "new Set(['css', 'js', 'ui', 'audio', 'icons', 'fonts'])",
            "new Set(['src', 'assets'])",
        ),
        "static-server.js": lambda text: text.replace(
            "new Set(['css', 'js', 'ui', 'audio', 'icons', 'fonts'])",
            "new Set(['src', 'assets'])",
        ),
    }
    for path, transform in explicit.items():
        if projection.rewrite(path, transform):
            changed.append(path)

    for path in sorted(projection.files):
        if path.startswith(("src/game/", "src/engine/")) and path.endswith(".js"):
            if projection.rewrite(path, replace_client_paths):
                changed.append(path)

    for path in sorted(projection.files):
        if path.startswith("tests/") and path.endswith(".js"):
            if projection.rewrite(path, replace_test_segments):
                changed.append(path)

    # Keep current source-path references in developer documentation.
    for path in ["README.md", *sorted(p for p in projection.files if p.startswith("docs/") and p.endswith(".md"))]:
        def docs_transform(text: str) -> str:
            text = text.replace("css/ui/", "src/css/")
            text = re.sub(r"(?<![\w/])js/", "src/game/", text)
            text = re.sub(r"(?<![\w/])ui/", "src/game/ui/", text)
            text = re.sub(r"(?<![\w/])icons/", "assets/icons/", text)
            text = re.sub(r"(?<![\w/])fonts/", "assets/fonts/", text)
            return text

        if projection.rewrite(path, docs_transform):
            changed.append(path)
    return sorted(set(changed))


def rewrite_relay(projection: Projection) -> list[str]:
    changed: list[str] = []
    transforms: dict[str, Callable[[str], str]] = {
        "package.json": lambda text: text.replace(
            '"main": "server.js"', '"main": "static-server.js"'
        ).replace('"start": "node server.js"', '"start": "node static-server.js"'),
        "harness/index.js": lambda text: text.replace(
            "path.resolve(harnessDir, '..', 'server')",
            "path.resolve(harnessDir, '..', 'multiplayer')",
        ),
        "tests/damage-numbers.test.js": lambda text: text.replace(
            "../server/mp-server.js", "../multiplayer/mp-server.js"
        ),
        "tests/mp-combat-relay.test.js": lambda text: text.replace(
            "'server', 'mp-server-worker.js'",
            "'multiplayer', 'mp-server-worker.js'",
        ),
        "tests/mp-host-migration.test.js": lambda text: text.replace(
            "'server', 'mp-server-worker.js'",
            "'multiplayer', 'mp-server-worker.js'",
        ),
        "README.md": lambda text: text.replace("node server.js", "node static-server.js")
        .replace("cd server", "cd multiplayer")
        .replace("├── server/                    # WebSocket", "├── multiplayer/               # WebSocket")
        .replace("├── server.js                  # Optional static", "├── static-server.js           # Optional static"),
        "docs/spec_sheet.md": lambda text: text.replace(
            "`server/config.js`", "`multiplayer/config.js`"
        ).replace("  server.js           // HTTP", "  static-server.js    // HTTP"),
        "docs/local-changes-summary.md": lambda text: text.replace(
            "(`server.js`)", "(`static-server.js`)"
        ),
        "multiplayer/README.md": lambda text: text.replace("cd server", "cd multiplayer")
        .replace("COPY server/", "COPY multiplayer/")
        .replace("COPY server", "COPY multiplayer"),
        "multiplayer/test-server.js": lambda text: text.replace(
            "cd server &&", "cd multiplayer &&"
        ),
    }
    for path, transform in transforms.items():
        if projection.rewrite(path, transform):
            changed.append(path)
    return changed


def projected_reference_errors(projection: Projection) -> list[str]:
    errors: list[str] = []
    files = set(projection.files)

    def require(reference: str, owner: str) -> None:
        clean = reference.split("?", 1)[0].split("#", 1)[0]
        if clean.startswith(("http://", "https://", "ws://", "wss://", "data:")):
            return
        clean = clean.removeprefix("./").lstrip("/")
        if clean and clean not in files:
            errors.append(f"{owner} references missing {clean}")

    index = projection.text("index.html")
    for reference in re.findall(r"(?:src|href)=[\"']([^\"']+)[\"']", index):
        require(reference, "index.html")

    sw = projection.text("sw.js")
    match = re.search(r"const PRECACHE_URLS\s*=\s*\[(.*?)\];", sw, re.S)
    if not match:
        errors.append("sw.js PRECACHE_URLS could not be parsed")
    else:
        for reference in re.findall(r"[\"'](\./[^\"']+)[\"']", match.group(1)):
            require(reference, "sw.js")

    manifest = json.loads(projection.text("manifest.json"))
    for icon in manifest.get("icons", []):
        require(icon["src"], "manifest.json")

    for path in ("src/css/base.css", "src/css/mobile-controls.css"):
        if path not in files:
            continue
        for reference in re.findall(r"url\([\"']?([^\"')]+)", projection.text(path)):
            if reference.startswith("data:"):
                continue
            resolved = (
                PurePosixPath(path).parent / PurePosixPath(reference)
            )
            normalized = os.path.normpath(resolved.as_posix()).replace("\\", "/")
            if normalized not in files:
                errors.append(f"{path} references missing {normalized}")
    return errors


def verify_projection(projection: Projection, completed_phases: set[str]) -> list[str]:
    errors: list[str] = []
    files = set(projection.files)

    always_required = {
        "index.html",
        "manifest.json",
        "sw.js",
        "metrics/server/index.js",
        "metrics/server/db.js",
        "metrics/gui/server.js",
        "metrics/gui/public/app.js",
        "harness/index.js",
    }
    for path in sorted(always_required):
        if path not in files:
            errors.append(f"required boundary file missing: {path}")

    gui_server = projection.text("metrics/gui/server.js")
    if "path.join(__dirname, '..', 'server', 'data', 'metrics.sqlite')" not in gui_server:
        errors.append("metrics GUI no longer points to metrics/server/data/metrics.sqlite")

    if "client-assets" in completed_phases:
        for old in ("js", "ui", "css", "fonts", "icons"):
            if path_exists(files, old):
                errors.append(f"old client path remains: {old}/")
        for required in (
            "src/game/main.js",
            "src/game/networking/telemetry.js",
            "src/engine/ui/bus.js",
            "src/game/ui/core/controllerNavigation.js",
            "src/css/base.css",
            "assets/audio/music-config.json",
            "assets/fonts/orbitron/Orbitron-VariableFont_wght.ttf",
            "assets/icons/icon-192.png",
        ):
            if required not in files:
                errors.append(f"migrated client file missing: {required}")
        for retired in ("src/js", "src/ui"):
            if path_exists(files, retired):
                errors.append(f"retired client path remains: {retired}/")

        static_path = "static-server.js" if "static-server.js" in files else "server.js"
        static_server = projection.text(static_path)
        if "new Set(['src', 'assets'])" not in static_server:
            errors.append(f"{static_path} does not allow only src/assets")
        if "new Set(['css', 'js', 'ui', 'audio', 'icons', 'fonts'])" in static_server:
            errors.append(f"{static_path} retains old static allowlist")
        errors.extend(projected_reference_errors(projection))

        stale_checks = {
            "index.html": r"(?:src|href)=[\"'](?:js|ui|css|audio|icons|fonts)/",
            "sw.js": r"[\"']\./(?:js|ui|css|audio|icons|fonts)/",
            "manifest.json": r"[\"']icons/",
            "src/game/main.js": r"[\"'](?:js|src/js)/",
            "src/engine/music.js": r"[\"']audio/",
            "assets/audio/music-config.json": r"[\"']audio/",
        }
        for path, pattern in stale_checks.items():
            if path in files and re.search(pattern, projection.text(path)):
                errors.append(f"stale runtime path remains in {path}: {pattern}")
        for path in files:
            if path.startswith(("src/game/", "src/engine/")) and path.endswith(".js"):
                if re.search(r"[\"'](?:js|ui|css|audio|icons|fonts|src/js|src/ui)/", projection.text(path)):
                    errors.append(f"stale client runtime path remains in {path}")
            if path.startswith("tests/") and path.endswith(".js"):
                if re.search(r"\.\./js/|src/js/|src/ui/|[\"']js/", projection.text(path)):
                    errors.append(f"stale client test path remains in {path}")

    if "rename-relay" in completed_phases:
        if path_exists(files, "server"):
            errors.append("root server/ remains after multiplayer rename")
        for required in (
            "multiplayer/mp-server.js",
            "multiplayer/mp-server-worker.js",
            "static-server.js",
        ):
            if required not in files:
                errors.append(f"renamed relay/static file missing: {required}")
        if "server.js" in files:
            errors.append("root server.js remains after static-server rename")

        harness = projection.text("harness/index.js")
        if "path.resolve(harnessDir, '..', 'multiplayer')" not in harness:
            errors.append("harness does not point to multiplayer/")
        if "path.resolve(harnessDir, '..', 'metrics', 'server')" not in harness:
            errors.append("harness metrics receiver path was crossed")
        if "path.resolve(harnessDir, '..', 'metrics', 'gui')" not in harness:
            errors.append("harness metrics GUI path was crossed")
        if any(
            token in harness
            for token in ("better-sqlite3", "new WebSocket.Server", "POST /ingest")
        ):
            errors.append("harness contains service implementation code")

        relay_text = "\n".join(
            projection.text(path)
            for path in files
            if path.startswith("multiplayer/") and path.endswith(".js")
        )
        if any(token in relay_text for token in ("better-sqlite3", "metrics/server", "POST /ingest")):
            errors.append("multiplayer relay is crossed with telemetry persistence")

        package = json.loads(projection.text("package.json"))
        if package.get("main") != "static-server.js":
            errors.append("root package main does not point to static-server.js")
        if package.get("scripts", {}).get("start") != "node static-server.js":
            errors.append("root npm start does not point to static-server.js")

    if "tools" in completed_phases:
        if path_exists(files, "audio"):
            errors.append("old mixed audio/ directory remains")
        if path_exists(files, "scripts"):
            errors.append("old scripts/ directory remains")
        for required in (
            "tools/restructure.py",
            "tools/audio/analyze_audio.py",
            "tools/audio/originals/against-villainous-robot-148967.mp3",
            "tools/icons/generate-pwa-icons.py",
        ):
            if required not in files:
                errors.append(f"tool file missing: {required}")
        if "src/js/boss-base.js" in files or "src/game/boss-base.js" in files:
            errors.append("unused duplicate boss-base.js remains outside entities/bosses/")
    return errors


def apply_moves(operations: list[Move]) -> None:
    for operation in operations:
        source = ROOT / operation.source
        destination = ROOT / operation.destination
        if not source.exists():
            if destination.exists():
                continue
            raise RuntimeError(f"missing move source: {operation.source}")
        destination.parent.mkdir(parents=True, exist_ok=True)
        run(["git", "mv", operation.source, operation.destination])


def apply_rewrites(projection: Projection, changed: list[str]) -> None:
    for path in changed:
        target = ROOT / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(projection.files[path])


def remove_empty_legacy_directories() -> None:
    for relative in (
        "audio/originals",
        "audio",
        "scripts",
        "css/ui",
        "css",
        "js",
        "ui",
        "fonts",
        "icons",
        "server",
    ):
        path = ROOT / relative
        if path.is_dir():
            try:
                path.rmdir()
            except OSError:
                pass


def final_path(path: str, moves: list[Move]) -> str:
    """Map an intermediate rewrite path through every planned move."""
    current = path
    for move in moves:
        source = move.source.rstrip("/")
        destination = move.destination.rstrip("/")
        if current == source:
            current = destination
        elif current.startswith(source + "/"):
            current = destination + current[len(source) :]
    return current


def print_plan(moves: list[Move], rewrites: list[str], deletes: list[Delete]) -> None:
    print("Planned git moves:")
    for move in moves:
        print(f"  {move.source} -> {move.destination}")
    if not moves:
        print("  (none)")
    print("Planned text rewrites:")
    for path in rewrites:
        print(f"  {path}")
    if not rewrites:
        print("  (none)")
    print("Planned deletes:")
    for deletion in deletes:
        print(f"  {deletion.path}")
    if not deletes:
        print("  (none)")


def completed_phases_from_tree(projection: Projection) -> set[str]:
    completed: set[str] = set()
    if (projection.has("src/game") or projection.has("src/js")) and projection.has("assets"):
        completed.add("client-assets")
    if projection.has("multiplayer") and projection.has("static-server.js"):
        completed.add("rename-relay")
    if projection.has("tools/audio") and projection.has("tools/icons"):
        completed.add("tools")
    return completed


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--phase", choices=(*PHASES, "all"))
    parser.add_argument("--apply", action="store_true", help="apply the planned migration")
    parser.add_argument("--dry-run", action="store_true", help="explicitly request dry-run")
    parser.add_argument("--verify", action="store_true", help="verify the current tree only")
    parser.add_argument(
        "--allow-dirty",
        action="store_true",
        help="allow apply on a dirty tree (required between migration phases)",
    )
    args = parser.parse_args()

    if args.apply and args.dry_run:
        parser.error("--apply and --dry-run are mutually exclusive")
    if not args.verify and not args.phase:
        parser.error("--phase is required unless --verify is used")

    projection = Projection.load()
    if args.verify and not args.phase:
        completed = completed_phases_from_tree(projection)
        errors = verify_projection(projection, completed)
        if errors:
            print("Verification failed:", file=sys.stderr)
            for error in errors:
                print(f"  - {error}", file=sys.stderr)
            return 1
        print(f"Verification passed for: {', '.join(sorted(completed)) or 'base boundaries'}")
        return 0

    requested = list(PHASES) if args.phase == "all" else [args.phase]
    all_moves: list[Move] = []
    all_rewrites: list[str] = []
    all_deletes: list[Delete] = []
    completed = completed_phases_from_tree(projection)

    for phase in requested:
        if phase in completed:
            continue
        if phase == "client-assets":
            moves = client_asset_moves(projection)
            rewrites = rewrite_client_assets(projection)
        elif phase == "rename-relay":
            moves = relay_moves(projection)
            rewrites = rewrite_relay(projection)
        else:
            moves = tool_moves(projection)
            rewrites = []
            for duplicate in ("src/js/boss-base.js", "src/game/boss-base.js"):
                if duplicate in projection.files:
                    # Runtime references use src/game/entities/bosses/boss-base.js.
                    deletion = Delete(duplicate)
                    all_deletes.append(deletion)
                    projection.delete(deletion)
        all_moves.extend(moves)
        all_rewrites.extend(rewrites)
        completed.add(phase)

    all_rewrites = [final_path(path, all_moves) for path in all_rewrites]
    errors = verify_projection(projection, completed)
    print_plan(all_moves, sorted(set(all_rewrites)), all_deletes)
    if errors:
        print("\nProjected verification FAILED:", file=sys.stderr)
        for error in errors:
            print(f"  - {error}", file=sys.stderr)
        return 1
    print("\nProjected verification PASSED.")
    print("All projected PWA, service-boundary, and local asset references resolve.")

    if not args.apply:
        print("Dry-run only; no files changed.")
        return 0

    status = git_status()
    # Git collapses a wholly untracked directory to one porcelain entry.
    allowed_status = {"?? tools/restructure.py", "?? tools/"}
    unexpected = [line for line in status if line not in allowed_status]
    if unexpected and not args.allow_dirty:
        print("Refusing to apply on a dirty tree:", file=sys.stderr)
        for line in unexpected:
            print(f"  {line}", file=sys.stderr)
        print("Re-run with --allow-dirty only after reviewing these paths.", file=sys.stderr)
        return 2

    # Apply the same operations whose projected result was just verified.
    apply_moves(all_moves)
    apply_rewrites(projection, sorted(set(all_rewrites)))
    for deletion in all_deletes:
        if (ROOT / deletion.path).exists():
            # A file moved earlier in the same run is staged as a rename, so
            # git requires -f to replace that staged rename with deletion.
            run(["git", "rm", "-f", deletion.path])
    remove_empty_legacy_directories()

    actual = Projection.load()
    actual_errors = verify_projection(actual, completed_phases_from_tree(actual))
    if actual_errors:
        print("Post-apply verification FAILED:", file=sys.stderr)
        for error in actual_errors:
            print(f"  - {error}", file=sys.stderr)
        return 1
    print("Post-apply verification PASSED.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
