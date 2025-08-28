from typing import Any, Dict, List, Optional, Literal
from pydantic import BaseModel, Field
import json, re

class PromptIn(BaseModel):
    text: str
    current_json: Optional[Dict[str, Any]] = None
    revision_log: Optional[List[str]]      = None

class AIResponseOut(BaseModel):
    nodes: List[Any] = Field(..., description="Updated nodes array")
    edges: List[Any] = Field(..., description="Updated edges array")
    explanation: str
    status: Literal["not_generated", "partially_generated", "completely_generated"] = Field(
        ..., 
        description="Workflow generation status: not_generated (no nodes/edges), partially_generated (some nodes but incomplete), completely_generated (full workflow with nodes and edges)"
    )

def safe_json_loads(raw: str):
    txt = raw.strip()
    txt = re.sub(r"^```[a-zA-Z0-9]*\\s*|```$", "", txt, flags=re.MULTILINE).strip()
    return json.loads(txt)