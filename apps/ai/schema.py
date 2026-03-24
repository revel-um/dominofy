from typing import Any, Dict, List, Optional, Literal
from pydantic import BaseModel, Field
import json, re

class PromptIn(BaseModel):
    text: str
    current_json: Optional[Dict[str, Any]] = None
    revision_log: Optional[List[str]]      = None
    revision_diffs: Optional[List[Any]]    = None  # structured jsondiffpatch diffs

class AIResponseOut(BaseModel):
    nodes: List[Any] = Field(..., description="Updated nodes array")
    edges: List[Any] = Field(..., description="Updated edges array")
    explanation: str
    status: Literal["not_generated", "partially_generated", "completely_generated"] = Field(
        ...,
        description="Workflow generation status"
    )
    thought_summaries: Optional[List[str]] = Field(
        default=None,
        description="Gemini thought summaries or synthesized fallback summaries for the generation"
    )
    chain_of_thought: Optional[List[str]] = Field(
        default=None,
        description="Deprecated alias for thought_summaries kept for backward compatibility"
    )

def safe_json_loads(raw: str):
    txt = raw.strip()
    # Strip markdown code fences
    txt = re.sub(r"^```[a-zA-Z0-9]*\s*", "", txt, flags=re.MULTILINE)
    txt = re.sub(r"^```\s*$", "", txt, flags=re.MULTILINE)
    txt = txt.strip()
    try:
        return json.loads(txt)
    except json.JSONDecodeError:
        pass
    # Last-resort: extract between the first { and the last }
    start = txt.find("{")
    end = txt.rfind("}")
    if start != -1 and end > start:
        return json.loads(txt[start : end + 1])
    raise json.JSONDecodeError("No JSON object found", txt, 0)
