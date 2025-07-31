from __future__ import annotations
"""prompt_template.py — builds the full prompt for Gemini 2.5 Flash
Adds:
  • NODE_SCHEMA (strict)
  • EXAMPLE_BLOCK (few-shot)
  • CURRENT_UTC_TIMESTAMP so model can suffix new node ids
"""
import json
from datetime import datetime, timezone
from typing import List

from schema import PromptIn

# ───────────────────────── 1. Node JSON schema ─────────────────────────────────────────
NODE_SCHEMA = (
    "Each **new** node must follow this JSON shape (omit position):\n"
    "{\n"
    "  \"id\":   \"<domino-id>-<YYYYMMDDHHMMSS> — unique\",\n"
    "  \"type\": \"<domino-id>             — exactly as in DOMINO_DOCS\",\n"
    "  \"data\": {\n"
    "    \"details\": {\n"
    "      \"fields\": [\n"
    "        {\n"
    "          \"heading\": \"string\",\n"
    "          \"value\":   \"any\",\n"
    "          \"inPinId\": \"value_in_X\" | null,\n"
    "          \"connectedValue\": false\n"
    "        }\n"
    "      ]\n"
    "    }\n"
    "  }\n"
    "}\n"
).strip()

# ───────────────────────── 2. Few-shot example ─────────────────────────────────────────
EXAMPLE_BLOCK = (
    "Example (plain JSON):\n"
    "{\n"
    "  \"nodes\": [\n"
    "    {\n"
    "      \"id\": \"slacktrigger-20250729123010\",\n"
    "      \"type\": \"slacktrigger\",\n"
    "      \"data\": { \"details\": { \"fields\": [] } }\n"
    "    },\n"
    "    {\n"
    "      \"id\": \"emailsender-20250729123010\",\n"
    "      \"type\": \"emailsender\",\n"
    "      \"data\": { \"details\": { \"fields\": [] } }\n"
    "    }\n"
    "  ],\n"
    "  \"edges\": [\n"
    "    { \"source\": \"slacktrigger-20250729123010\", \"target\": \"emailsender-20250729123010\", \"type\": \"execution\" }\n"
    "  ],\n"
    "  \"explanation\": \"Slack trigger forwards to email sender.\"\n"
    "}\n"
).strip()

# ───────────────────────── 3. System template ───────────────────────────────────────────
SYSTEM_TEMPLATE = (
    "You are Dominofy's workflow architect.\n"
    "Given:\n"
    "  1. DOMINO_DOCS (domino definitions)\n"
    "  2. NODE_SCHEMA (above)\n"
    "  3. CURRENT_WORKFLOW_JSON (may be empty)\n"
    "  4. REVISION_LOG (previous explanations)\n"
    "  5. CURRENT_UTC_TIMESTAMP (ISO suffix for new ids)\n"
    "  6. USER PROMPT\n\n"
    "Return **only** JSON (no markdown fences):\n"
    "{ \"nodes\": [...], \"edges\": [...], \"explanation\": \"...\" }\n\n"
    "Rules:\n"
    "• id for any new node = '<domino-id>-<CURRENT_UTC_TIMESTAMP>'.\n"
    "• type = domino-id exactly.\n"
    "• Omit positions.\n"
    "• Edge types allowed: 'execution' | 'value'.\n"
    "• Pins may be dynamic (value_in_X, etc.).\n"
    "• Explanation must justify each change."
    "• You may use **only** the dominos present in DOMINO_DOCS."
    "If no suitable domino exists, reply with an explanation instead of inventing one."
    "• Create nodes **only** from the DOMINO_DOCS you see."
    "If you cannot satisfy USER PROMPT with those dominos, reply with an error message instead of inventing new types."
).strip()

# ───────────────────────── 4. Builder ───────────────────────────────────────────────────

def build_prompt(domino_docs: str, p: PromptIn) -> str:
    print(domino_docs)
    """Assemble final prompt text for Gemini Flash."""
    ts = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    parts: List[str] = [
        SYSTEM_TEMPLATE,
        "NODE_SCHEMA:\n" + NODE_SCHEMA,
        EXAMPLE_BLOCK,
        "DOMINO_DOCS:\n" + domino_docs,
        "CURRENT_WORKFLOW_JSON:\n" + json.dumps(p.current_json or {}, separators=(',', ':')),
        "REVISION_LOG:\n" + json.dumps(p.revision_log or []),
        "CURRENT_UTC_TIMESTAMP:\n" + ts,
        "USER PROMPT:\n" + p.text,
    ]
    return "\n\n".join(parts)