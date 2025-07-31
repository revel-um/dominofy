from typing import Any, Dict, List, Optional
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

def safe_json_loads(raw: str):
    txt = raw.strip()
    txt = re.sub(r"^```[a-zA-Z0-9]*\\s*|```$", "", txt, flags=re.MULTILINE).strip()
    return json.loads(txt)