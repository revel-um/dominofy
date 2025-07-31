import re

def strip_markdown_json(txt: str) -> str:
    """Remove ```json fences if present."""
    match = re.search(r"```json(.*?)```", txt, re.S | re.I)
    return match.group(1).strip() if match else txt.strip()