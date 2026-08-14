import os
import json
from datetime import datetime
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()


def _generate_ai_explanation(prompt: str, design: dict) -> dict:
    """
    Asks the AI for a structured, detailed explanation of the
    architecture: what type it is, why it fits the request overall, its
    trade-offs, AND — critically — a specific explanation for EVERY
    single node: why that component, why that type, and what role it
    plays. Returns a dict (not prose) so the caller can render each
    node's reasoning next to that node, rather than hoping a paragraph
    of free-form prose happens to mention everything.
    """
    client = OpenAI(
        api_key=os.getenv("OPENROUTER_API_KEY"),
        base_url="https://openrouter.ai/api/v1"
    )

    node_ids = [n["id"] for n in design.get("nodes", [])]

    schema_example = {
        "architecture_type": "Load-balanced multi-tier web architecture",
        "overall_rationale": "2-4 paragraphs explaining why THIS architecture (not a different one) best fits the user's request.",
        "trade_offs": "1-2 paragraphs being honest about limitations, costs, and what could break at scale.",
        "nodes": {
            "<node id, exactly as given>": "3-6 sentences: why THIS component, why THIS specific type was chosen over alternatives, and exactly what role it plays in this design."
        }
    }

    system_prompt = f"""You are a senior infrastructure architect writing a
detailed design-rationale document. Given a user's original request and the
resulting architecture (as JSON, with nodes and edges), you must explain
EVERY decision — someone reading this should understand exactly why each
component exists and why it's the right choice, not just what it is.

Respond with ONLY a JSON object matching exactly this shape:
{json.dumps(schema_example, indent=2)}

Rules:
- "nodes" MUST have exactly one entry per node id, using the exact ids given.
- Each node explanation must be SPECIFIC to that component's actual role in
  this design (what it connects to, what problem it solves here) — never
  generic boilerplate that could apply to any deployment of that component
  type. Mention at least one alternative that was NOT chosen and briefly why.
- "overall_rationale" must reference the actual components present, not
  generic architecture advice.
- "trade_offs" must be honest — real limitations, not just positives.
- Do not include any text outside the JSON object.
"""

    user_content = f"""User's original request:
{prompt}

Generated architecture (JSON):
{json.dumps(design, indent=2)}

Node ids that MUST each get an explanation: {json.dumps(node_ids)}"""

    response = client.chat.completions.create(
        model="openai/gpt-4o-mini",
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content}
        ]
    )

    result = json.loads(response.choices[0].message.content)

    result.setdefault("architecture_type", "Custom architecture")
    result.setdefault("overall_rationale", "")
    result.setdefault("trade_offs", "")
    result.setdefault("nodes", {})
    return result


def generate_design_doc(project_name: str, prompt: str, design: dict, version: int) -> str:
    """
    Turns a design dict ({"nodes": [...], "edges": [...]}) into a
    detailed, readable markdown document: an AI-written explanation of
    WHY this architecture fits the request (with a dedicated rationale
    for every single node), plus a reliable, deterministic list of the
    actual components and connections (so the facts are always accurate
    even though the reasoning above them is AI-generated).
    """
    nodes = design.get("nodes", [])
    edges = design.get("edges", [])
    node_labels = {n["id"]: n.get("label", n["id"]) for n in nodes}

    lines = []
    lines.append(f"# {project_name} — Architecture Documentation")
    lines.append("")
    lines.append(f"*Generated: {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')} · Design version {version}*")
    lines.append("")

    if prompt:
        lines.append("## Original Request")
        lines.append(f"> {prompt}")
        lines.append("")

    explanation = None
    explanation_error = None
    try:
        explanation = _generate_ai_explanation(prompt, design)
    except Exception as e:
        explanation_error = str(e)

    if explanation:
        lines.append(f"## Architecture Type: {explanation['architecture_type']}")
        lines.append("")

        lines.append("## Why This Architecture")
        lines.append("")
        lines.append(explanation["overall_rationale"])
        lines.append("")

        if explanation.get("trade_offs"):
            lines.append("## Trade-offs & Considerations")
            lines.append("")
            lines.append(explanation["trade_offs"])
            lines.append("")
    else:
        lines.append("## Architecture Explanation")
        lines.append("")
        lines.append(f"_Explanation could not be generated automatically: {explanation_error}_")
        lines.append("")

    lines.append("## Components")
    lines.append("")
    if not nodes:
        lines.append("_No components in this design._")
    node_explanations = explanation["nodes"] if explanation else {}
    for node in nodes:
        node_id = node["id"]
        label = node.get("label", node_id)
        node_type = node.get("type", "unknown")

        outgoing = [e for e in edges if e.get("from") == node_id]
        incoming = [e for e in edges if e.get("to") == node_id]

        lines.append(f"### {label} (`{node_type}`)")
        lines.append("")

        node_reason = node_explanations.get(node_id)
        if node_reason:
            lines.append(node_reason)
        else:
            lines.append(f"_No detailed rationale was generated for this component._")
        lines.append("")

        if outgoing or incoming:
            lines.append("**Connections:**")
            for e in outgoing:
                to_label = node_labels.get(e.get("to"), e.get("to"))
                lines.append(f"- {e.get('label', 'connects to')} **{to_label}**")
            for e in incoming:
                from_label = node_labels.get(e.get("from"), e.get("from"))
                lines.append(f"- receives from **{from_label}** ({e.get('label', 'connects to')})")
            lines.append("")

    lines.append("## Full Connection List")
    lines.append("")
    if not edges:
        lines.append("_No connections in this design._")
    for edge in edges:
        from_label = node_labels.get(edge.get("from"), edge.get("from"))
        to_label = node_labels.get(edge.get("to"), edge.get("to"))
        relationship = edge.get("label", "connects to")
        lines.append(f"- **{from_label}** {relationship} **{to_label}**")

    lines.append("")
    lines.append("---")
    lines.append("*This document was generated automatically by InfraAI and reflects the current design. It updates automatically whenever this project's architecture changes.*")

    return "\n".join(lines)


if __name__ == "__main__":
    fake_design = {
        "nodes": [
            {"id": "1", "type": "load_balancer", "label": "Load Balancer"},
            {"id": "2", "type": "ec2", "label": "Web Server 1"},
            {"id": "3", "type": "ec2", "label": "Web Server 2"},
            {"id": "4", "type": "database", "label": "Database"},
        ],
        "edges": [
            {"from": "1", "to": "2", "label": "routes traffic to"},
            {"from": "1", "to": "3", "label": "routes traffic to"},
            {"from": "2", "to": "4", "label": "connects to"},
            {"from": "3", "to": "4", "label": "connects to"},
        ]
    }

    print("--- Testing real AI explanation call ---\n")
    doc = generate_design_doc(
        "Test Project",
        "A simple web app with a load balancer, two web servers, and a database",
        fake_design,
        version=1
    )
    print(doc)
    assert "# Test Project" in doc
    assert "Why This Architecture" in doc
    print("\n\nStandalone test passed.")