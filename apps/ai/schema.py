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
    txt = re.sub(r"^```[a-zA-Z0-9]*\s*|```$", "", txt, flags=re.MULTILINE).strip()
    return json.loads(txt)
