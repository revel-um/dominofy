from __future__ import annotations
"""prompt_template.py — builds prompts for Gemini 2.5 Flash
Two-stage:
  build_plan_prompt  → Stage 1: identify needed domino types (cheap, fast)
  build_prompt       → Stage 2: full workflow generation with enriched docs
Intent routing:
  build_intent_prompt → Classify user intent as workflow vs informational
  build_info_prompt   → Answer informational questions about Dominofy
"""
import json
from datetime import datetime, timezone
from typing import List

from schema import PromptIn

# ───────────────────────── 0. Dominofy platform knowledge ──────────────────
DOMINOFY_KNOWLEDGE = (
    "Dominofy is a visual workflow automation platform where users build automated pipelines "
    "by connecting 'dominos' (nodes) on a canvas.\n\n"
    "Core concepts:\n"
    "- Workflow: A directed graph of dominos connected by edges.\n"
    "- Domino: A single processing block with a type (e.g. slacktrigger, emailsender), "
    "configurable fields, and connection pins.\n"
    "- Triggers: Dominos that start a workflow (webhooks, schedules, Slack events, etc.).\n"
    "- Actions: Dominos that do work (send emails, HTTP requests, database writes, etc.).\n"
    "- Conditions/Logic: Dominos that branch or filter based on values.\n"
    "- Edges: 'execution' edges control the flow order; 'value' edges pass data between pins.\n"
    "- Fields: Each domino has configurable fields (heading + value pairs).\n"
    "- Pins: Input/output connection points (e.g. value_in_X for dynamic data inputs).\n\n"
    "How a workflow runs:\n"
    "1. A trigger domino fires when an event occurs.\n"
    "2. Execution flows through connected dominos in sequence.\n"
    "3. Data is passed between dominos via value edges and pin references.\n"
    "4. Condition dominos can branch the flow.\n\n"
    "The AI assistant can create new workflows, modify existing ones, explain any domino, "
    "and answer questions about how Dominofy works."
).strip()

# ───────────────────────── 1. Node JSON schema ──────────────────────────────
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

# ───────────────────────── 2. Few-shot example ──────────────────────────────
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
    "  \"explanation\": \"Slack trigger forwards to email sender.\",\n"
    "  \"status\": \"completely_generated\"\n"
    "}\n"
).strip()

# ───────────────────────── 3. System templates ──────────────────────────────
SYSTEM_TEMPLATE = (
    "You are Dominofy's workflow architect.\n"
    "Given:\n"
    "  1. DOMINO_DOCS (domino definitions)\n"
    "  2. NODE_SCHEMA (above)\n"
    "  3. CURRENT_WORKFLOW_JSON (may be empty)\n"
    "  4. REVISION_LOG (previous conversation and structured diffs showing exactly what changed)\n"
    "  5. CURRENT_UTC_TIMESTAMP (ISO suffix for new ids)\n"
    "  6. USER PROMPT\n\n"
    "Return **only** a JSON object:\n"
    "{ \"nodes\": [...], \"edges\": [...], \"explanation\": \"...\", \"status\": \"...\" }\n\n"
    "Status Rules:\n"
    "• \"not_generated\": Cannot create any workflow nodes/edges\n"
    "• \"partially_generated\": Some nodes created but workflow is incomplete\n"
    "• \"completely_generated\": Full, functional workflow with all nodes and connections\n\n"
    "Rules:\n"
    "• id for any new node = '<domino-id>-<CURRENT_UTC_TIMESTAMP>'.\n"
    "• type = domino-id exactly as it appears in DOMINO_DOCS.\n"
    "• Omit positions.\n"
    "• Edge types allowed: 'execution' | 'value'.\n"
    "• Pins may be dynamic (value_in_X, etc.).\n"
    "• Explanation must describe every node added, removed, or changed — use the human-readable label from DOMINO_DOCS (e.g. 'Slack Trigger', 'Email Action'), never the raw domino id or node id.\n"
    "• Use ONLY dominos present in DOMINO_DOCS — never invent new types.\n"
    "• If REVISION_DIFFS are provided, they show the exact JSON delta from prior edits — use them to understand what was previously added or removed before applying the new instruction.\n"
    "• Always include the 'status' field."
).strip()

PLAN_SYSTEM = (
    "You are a workflow planning assistant for Dominofy.\n"
    "Given a user prompt and available domino IDs, output ONLY a JSON array of domino IDs needed.\n"
    "Rules:\n"
    "• Only use IDs from AVAILABLE_DOMINO_IDS.\n"
    "• Include ALL domino types you expect to need for this request.\n"
    "• Do not include types already present in CURRENT_WORKFLOW_NODE_TYPES unless the user explicitly wants to add more.\n"
    "• Output only the JSON array, nothing else — no explanation, no markdown."
).strip()

# ───────────────────────── 4. Context helpers ───────────────────────────────

def prune_workflow_context(current_json: dict) -> dict:
    """Strip field values from nodes when workflow is large to save tokens."""
    nodes = current_json.get("nodes", [])
    if len(nodes) <= 25:
        return current_json
    pruned_nodes = [
        {"id": n.get("id"), "type": n.get("type"), "position": n.get("position")}
        for n in nodes
        if isinstance(n, dict)
    ]
    return {**current_json, "nodes": pruned_nodes, "_pruned": True}


def _format_revision_context(p: PromptIn) -> str:
    """Combine revision_log text + structured diffs into rich context."""
    parts: list[str] = []
    if p.revision_log:
        parts.append("CONVERSATION_HISTORY:\n" + json.dumps(p.revision_log[-6:]))
    if p.revision_diffs:
        parts.append(
            "REVISION_DIFFS (exact JSON deltas from previous edits):\n"
            + json.dumps(p.revision_diffs[-3:], separators=(",", ":"))
        )
    return "\n\n".join(parts) if parts else "[]"


# ───────────────────────── 5. Prompt builders ───────────────────────────────

# ───────────────────────── 5a. Intent classification ───────────────────────

INTENT_SYSTEM = (
    "Classify the user's intent as either \"workflow\" or \"informational\".\n\n"
    "\"workflow\": The user wants to create, modify, add, remove, update, or build a workflow or dominos.\n"
    "\"informational\": The user is asking a question, requesting an explanation, or seeking information "
    "without wanting to change the workflow (e.g. 'what is Dominofy?', 'how does X work?', "
    "'what dominos are available?', 'explain what you just built', 'what does this domino do?').\n\n"
    "Output only valid JSON: {\"intent\": \"workflow\"} or {\"intent\": \"informational\"}"
).strip()

INFO_SYSTEM = (
    "You are a helpful assistant for Dominofy, a visual workflow automation platform.\n"
    "Answer the user's question clearly and concisely using the DOMINO_DOCS, "
    "CURRENT_WORKFLOW_JSON, and CONVERSATION_HISTORY provided below.\n\n"
    + DOMINOFY_KNOWLEDGE + "\n\n"
    "Rules:\n"
    "• Do NOT generate workflow JSON, nodes, or edges.\n"
    "• Use the DOMINO_DOCS to answer questions about specific domino types.\n"
    "• Use the CURRENT_WORKFLOW_JSON to answer questions about the user's current workflow.\n"
    "• Use the CONVERSATION_HISTORY for context on what was previously discussed or built.\n"
    "• Return ONLY a JSON object: {\"explanation\": \"<your answer>\"}"
).strip()


def build_intent_prompt(p: PromptIn) -> str:
    """Lightweight prompt to classify user intent."""
    return INTENT_SYSTEM + "\n\nUSER PROMPT:\n" + p.text


def build_info_prompt(domino_docs: str, p: PromptIn) -> str:
    """Prompt for answering informational questions about Dominofy."""
    current_json = p.current_json or {}
    revision_ctx = _format_revision_context(p)
    parts: List[str] = [
        INFO_SYSTEM,
        "DOMINO_DOCS:\n" + domino_docs,
        "CURRENT_WORKFLOW_JSON:\n" + json.dumps(current_json, separators=(",", ":")),
        "CONVERSATION_HISTORY:\n" + revision_ctx,
        "USER PROMPT:\n" + p.text,
    ]
    return "\n\n".join(parts)


# ───────────────────────── 5b. Workflow prompt builders ─────────────────────

def build_plan_prompt(available_ids: List[str], p: PromptIn) -> str:
    """Stage-1 prompt: quickly identify needed domino types."""
    current_types = sorted({
        n.get("type", "")
        for n in (p.current_json or {}).get("nodes", [])
        if isinstance(n, dict) and n.get("type")
    })
    return "\n\n".join([
        PLAN_SYSTEM,
        "AVAILABLE_DOMINO_IDS:\n" + json.dumps(available_ids),
        "CURRENT_WORKFLOW_NODE_TYPES:\n" + json.dumps(current_types),
        "USER PROMPT:\n" + p.text,
    ])


def build_prompt(domino_docs: str, p: PromptIn) -> str:
    """Stage-2 prompt: full workflow generation with enriched context."""
    ts = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    current_json = prune_workflow_context(p.current_json or {})
    revision_ctx = _format_revision_context(p)
    parts: List[str] = [
        SYSTEM_TEMPLATE,
        "NODE_SCHEMA:\n" + NODE_SCHEMA,
        EXAMPLE_BLOCK,
        "DOMINO_DOCS:\n" + domino_docs,
        "CURRENT_WORKFLOW_JSON:\n" + json.dumps(current_json, separators=(",", ":")),
        "REVISION_LOG:\n" + revision_ctx,
        "CURRENT_UTC_TIMESTAMP:\n" + ts,
        "USER PROMPT:\n" + p.text,
    ]
    return "\n\n".join(parts)
