#!/usr/bin/env python3
"""Regenerate MANIFEST.sha256 (size + SHA-256 of every file except the manifest itself).

Run LAST, after database/test_schema.py --report and scripts/validate_specs.py --write-report.
"""
import hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SKIP = {"MANIFEST.sha256"}
lines = ["# SHA-256 manifest; excludes this manifest. Sizes shown on preceding comment lines."]
for path in sorted(p for p in ROOT.rglob("*") if p.is_file()):
    rel = path.relative_to(ROOT).as_posix()
    if rel in SKIP or "__pycache__" in rel:
        continue
    data = path.read_bytes()
    lines.append(f"# {len(data)} bytes")
    lines.append(f"{hashlib.sha256(data).hexdigest()}  {rel}")
(ROOT / "MANIFEST.sha256").write_text("\n".join(lines) + "\n", encoding="utf-8", newline="\n")
print(f"{(len(lines) - 1) // 2} files")
