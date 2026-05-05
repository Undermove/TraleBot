#!/usr/bin/env python3
"""
One-shot reorganization of ROADMAP.md.

Goal:
- Move all [done]/[rejected] H3 entries to ROADMAP-archive.md as compact
  one-liners. Their full bodies leave the main file.
- Keep all stable prose sections (philosophy, design system, learning design,
  current state, etc.) untouched.
- Within each task-bearing H2 section, sort remaining H3 entries by priority:
  launch > dev > review > designing > designed > idea > blocked.
- Insert a "## Бэклог по приоритету" index near the top of ROADMAP.md
  (before any task-bearing section), listing every active H3 with its status
  and one-line scope.

Invocation: python3 scripts/reorganize-roadmap.py
"""

from __future__ import annotations

import re
from pathlib import Path
from datetime import date
from typing import List, Tuple

REPO_ROOT = Path(__file__).resolve().parent.parent
ROADMAP = REPO_ROOT / "ROADMAP.md"
ARCHIVE = REPO_ROOT / "ROADMAP-archive.md"

# Task-bearing H2 sections — only these are reorganized. Others stay verbatim.
TASK_SECTIONS = {
    "## Задачи запуска [launch] — P0 блокеры перед MiniAppEnabled=true",
    "## Ближайшая итерация",
    "## Пост-лонч · Контент P0",
    "## Среднесрочное (1-2 месяца)",
    "## Дальнеe (3+ месяцев, идеи)",
    "## Идеи в копилке (не приоритизировано)",
}

STATUS_PRIORITY = {
    "launch": 0,
    "dev": 1,
    "review": 2,
    "designing": 3,
    "designed": 4,
    "idea": 5,
    "blocked": 6,
    # done / rejected go to archive, not sorted
}

H2_RE = re.compile(r"^## ", flags=re.MULTILINE)
H3_TASK_RE = re.compile(
    r"^### (?P<title>.+?) `\[(?P<status>idea|designed|designing|dev|review|done|launch|rejected|blocked)\]`\s*$",
    flags=re.MULTILINE,
)


def split_h2_sections(text: str) -> List[Tuple[str, str]]:
    """Split into [(heading_line, body_text)] preserving order. body excludes
    the heading line itself."""
    pieces = re.split(r"(?m)(?=^## )", text)
    out: List[Tuple[str, str]] = []
    if pieces and not pieces[0].startswith("## "):
        # Preamble before any H2 (file header + intro)
        out.append(("", pieces[0]))
        pieces = pieces[1:]
    for chunk in pieces:
        if not chunk.strip():
            continue
        m = re.match(r"^(## .+?)\n", chunk)
        if not m:
            continue
        heading = m.group(1)
        body = chunk[m.end():]
        out.append((heading, body))
    return out


def split_h3_entries(body: str) -> Tuple[str, List[Tuple[str, str, str]]]:
    """Split a H2 section body into (prose_prefix, [(title, status, full_block)]).
    The prose prefix is everything before the first H3 entry. Each block
    includes its own H3 heading and runs until the next H3 or end-of-section."""
    matches = list(H3_TASK_RE.finditer(body))
    if not matches:
        return body, []
    prose = body[: matches[0].start()]
    blocks: List[Tuple[str, str, str]] = []
    for i, m in enumerate(matches):
        start = m.start()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(body)
        title = m.group("title").strip()
        status = m.group("status").strip()
        full = body[start:end]
        blocks.append((title, status, full))
    return prose, blocks


def first_paragraph(block: str) -> str:
    """Pull a one-line summary from the block body. Prefer the line after
    `**Зачем:**`, fall back to the first non-empty line after the heading."""
    lines = block.splitlines()
    # Skip the H3 heading
    body_lines = lines[1:] if lines else []
    for line in body_lines:
        m = re.match(r"\s*\*\*Зачем:\*\*\s*(.+)", line)
        if m:
            return m.group(1).strip()
    for line in body_lines:
        s = line.strip()
        if not s:
            continue
        if s.startswith("**") or s.startswith("- "):
            # Strip emphasis tokens
            s = re.sub(r"^\*\*[^*]+\*\*\s*:?\s*", "", s)
            s = re.sub(r"^-\s*", "", s)
            if s:
                return s
        else:
            return s
    return ""


def render_priority_index(active: List[Tuple[str, str, str]]) -> str:
    """Build the priority backlog index from a flat list of (title, status, _).
    Sorts by status priority, preserving original order within each status."""
    by_status: dict[str, list[str]] = {}
    for title, status, _ in active:
        by_status.setdefault(status, []).append(title)

    out: List[str] = []
    out.append("## Бэклог по приоритету")
    out.append("")
    out.append(
        "_Автогенерируемый индекс. Источник правды — детальные секции ниже. "
        f"Обновлён {date.today().isoformat()} скриптом scripts/reorganize-roadmap.py. "
        "[done] и [rejected] вынесены в ROADMAP-archive.md._"
    )
    out.append("")
    labels = {
        "launch": "🚀 Launch (P0 — блокеры запуска)",
        "dev": "🛠 В разработке",
        "review": "👁 На ревью",
        "designing": "✏️ Дизайн в процессе",
        "designed": "📐 Готово к разработке",
        "idea": "💡 Идеи (не приоритизировано)",
        "blocked": "⏸ Заблокировано",
    }
    for status in ("launch", "dev", "review", "designing", "designed", "idea", "blocked"):
        titles = by_status.get(status, [])
        if not titles:
            continue
        out.append(f"### {labels[status]}")
        out.append("")
        for t in titles:
            out.append(f"- {t}")
        out.append("")
    return "\n".join(out)


def render_archive(archived: List[Tuple[str, str, str]]) -> str:
    out: List[str] = []
    out.append("# ROADMAP — архив [done] / [rejected]")
    out.append("")
    out.append(
        "Свёрнутая история закрытых задач. Сюда попадают записи со статусом `[done]` "
        "или `[rejected]`, вынесенные из ROADMAP.md скриптом scripts/reorganize-roadmap.py."
    )
    out.append("")
    out.append(f"_Снапшот: {date.today().isoformat()}_")
    out.append("")
    by_status: dict[str, list[Tuple[str, str]]] = {"done": [], "rejected": []}
    for title, status, block in archived:
        if status not in by_status:
            continue
        summary = first_paragraph(block)
        # Trim to 200 chars
        if len(summary) > 200:
            summary = summary[:197].rstrip() + "…"
        by_status[status].append((title, summary))

    for status, label in (("done", "[done]"), ("rejected", "[rejected]")):
        items = by_status[status]
        if not items:
            continue
        out.append(f"## {label} ({len(items)})")
        out.append("")
        for title, summary in items:
            if summary:
                out.append(f"- **{title}** — {summary}")
            else:
                out.append(f"- **{title}**")
        out.append("")
    return "\n".join(out)


def reorganize() -> Tuple[str, str, dict]:
    text = ROADMAP.read_text()
    sections = split_h2_sections(text)

    # Pass 1: collect every active task across task-bearing sections (for the TOC).
    all_active: List[Tuple[str, str, str]] = []
    all_archived: List[Tuple[str, str, str]] = []
    section_data: List[dict] = []
    for heading, body in sections:
        if heading in TASK_SECTIONS:
            prose, blocks = split_h3_entries(body)
            active = [b for b in blocks if b[1] not in ("done", "rejected")]
            archived = [b for b in blocks if b[1] in ("done", "rejected")]
            # Sort active by status priority, stable within
            active_sorted = sorted(active, key=lambda b: STATUS_PRIORITY.get(b[1], 99))
            section_data.append(
                {"heading": heading, "prose": prose, "active": active_sorted, "archived": archived}
            )
            all_active.extend(active_sorted)
            all_archived.extend(archived)
        else:
            section_data.append({"heading": heading, "raw": body})

    # Build new ROADMAP.md
    out: List[str] = []

    # Locate the preamble block (heading="") and the first H2 section. Insert
    # the priority index AFTER stable prose blocks but BEFORE the first task
    # section. We treat sections before "## Задачи запуска" as stable prose.
    inserted = False
    priority_index = render_priority_index(all_active)

    for sec in section_data:
        if sec["heading"] in TASK_SECTIONS and not inserted:
            out.append(priority_index)
            out.append("")
            out.append("---")
            out.append("")
            inserted = True
        if sec["heading"] == "":
            out.append(sec["raw"].rstrip("\n"))
        elif "raw" in sec:
            out.append(sec["heading"])
            out.append("")
            out.append(sec["raw"].rstrip("\n"))
        else:
            # Task-bearing section — re-emit prose + active blocks only
            out.append(sec["heading"])
            out.append("")
            out.append(sec["prose"].rstrip("\n"))
            for _title, _status, block in sec["active"]:
                out.append(block.rstrip("\n"))
                out.append("")
        out.append("")

    new_roadmap = "\n".join(out).rstrip("\n") + "\n"
    archive = render_archive(all_archived).rstrip("\n") + "\n"

    stats = {
        "active_count": len(all_active),
        "archived_count": len(all_archived),
        "old_lines": text.count("\n") + 1,
        "new_lines": new_roadmap.count("\n") + 1,
        "archive_lines": archive.count("\n") + 1,
    }
    return new_roadmap, archive, stats


def main():
    new_roadmap, archive, stats = reorganize()
    ROADMAP.write_text(new_roadmap)
    ARCHIVE.write_text(archive)
    print(
        f"ROADMAP.md: {stats['old_lines']} → {stats['new_lines']} lines "
        f"(active tasks: {stats['active_count']})"
    )
    print(
        f"ROADMAP-archive.md: {stats['archive_lines']} lines "
        f"(archived: {stats['archived_count']})"
    )


if __name__ == "__main__":
    main()
