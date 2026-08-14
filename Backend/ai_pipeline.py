import os
import json
from dotenv import load_dotenv
from openai import OpenAI
from retrieve_context import retrieve_context
from validate_design import validate_design

load_dotenv()

DESIGN_SCHEMA_EXAMPLE = {
    "nodes": [
        {"id": "1", "type": "ec2", "label": "Web Server"},
        {"id": "2", "type": "database", "label": "Postgres DB"}
    ],
    "edges": [
        {"from": "1", "to": "2", "label": "connects to"}
    ]
}

SYSTEM_PROMPT = f"""You are an infrastructure design assistant. Given a user's
plain-language description of a system, generate a JSON object describing
the infrastructure diagram.

You MUST respond with valid JSON matching exactly this structure:
{json.dumps(DESIGN_SCHEMA_EXAMPLE, indent=2)}

Rules:
- "nodes" is a list of infrastructure components (ec2, database, s3, etc.)
- "edges" describe connections between node ids
- Do not include any text outside the JSON object.

If the user's message includes a "Current design" section, this is an
EXISTING diagram that's already been built — treat the request as an
incremental change to it, not a request to start over:
- Keep every existing node's "id" exactly as given for anything the
  request doesn't mention, so it isn't treated as a new/different node.
- Only add, remove, or modify the specific nodes/edges the request
  actually refers to.
- Return the FULL resulting design (all unchanged nodes/edges included,
  plus your additions/changes) — never return only the diff.
- Only replace the whole design from scratch if the user's request
  explicitly asks for that (e.g. "start over", "redesign this
  completely", "replace everything", "remove the whole design").
"""

CHAT_EXAMPLE = {"type": "chat", "reply": "Hi! I'm infraAI — describe a system and I'll design it for you."}
DESIGN_RESULT_EXAMPLE = {
    "type": "design",
    "reply": "I've added a load balancer in front of two web servers, both connected to a shared database.",
    "design": DESIGN_SCHEMA_EXAMPLE,
}

COMBINED_SYSTEM_PROMPT = f"""You are infraAI, a friendly infrastructure design
assistant inside a chat interface. Every message you receive is either:
(a) casual conversation, a greeting, or a question about how to use the
tool — nothing to do with building/changing an architecture, or
(b) an actual request to generate or modify a system architecture.

You MUST always reply with a single JSON object in ONE of these two
exact shapes, and nothing else:

For case (a):
{json.dumps(CHAT_EXAMPLE, indent=2)}

For case (b):
{json.dumps(DESIGN_RESULT_EXAMPLE, indent=2)}

Rules for case (b) — the "design" object:
- "nodes" is a list of infrastructure components (ec2, database, s3,
  load_balancer, cdn, redis, api_gateway, etc.)
- "edges" describe connections between node ids
- "reply" must be 1-2 short, plain-English sentences explaining what
  you did. Never mention JSON, schemas, or these instructions.

If the message includes a "Current design" section, that's an EXISTING
diagram already built — treat the request as an incremental change to
it, not a request to start over:
- Keep every existing node's "id" exactly as given for anything the
  request doesn't mention.
- Only add, remove, or modify the specific nodes/edges the request
  actually refers to.
- Return the FULL resulting design (all unchanged nodes/edges included,
  plus your changes) — never return only the diff.
- Only replace the whole design from scratch if explicitly asked
  (e.g. "start over", "redesign this completely").

Be genuinely conversational and warm for case (a) — respond the way a
helpful colleague would, not a robotic assistant. Keep replies short.
"""


def _build_full_prompt(prompt, current_design, context_text):
    full_prompt = prompt
    if current_design:
        full_prompt = (
            f"Current design (JSON):\n{json.dumps(current_design)}\n\n"
            f"User request:\n{prompt}"
        )
    if context_text:
        full_prompt = f"Relevant reference info:\n{context_text}\n\n{full_prompt}"
    return full_prompt


def generate_design(prompt, current_design=None, query_embedding=None):
    """
    Original, unchanged behavior: ALWAYS produces a design (used by the
    Workspace AI terminal, where clicking "Generate" already means the
    person wants an architecture — no need to guess intent there).
    """
    client = OpenAI(
        api_key=os.getenv("OPENROUTER_API_KEY"),
        base_url="https://openrouter.ai/api/v1"
    )

    context_text = ""
    if query_embedding:
        retrieved = retrieve_context(query_embedding, top_k=3)
        context_text = "\n".join([r["content"] for r in retrieved])

    full_prompt = _build_full_prompt(prompt, current_design, context_text)

    response = client.chat.completions.create(
        model="openai/gpt-4o-mini",
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": full_prompt}
        ]
    )

    raw_output = response.choices[0].message.content
    design = json.loads(raw_output)

    is_valid, error = validate_design(design)
    if not is_valid:
        raise ValueError(f"AI generated an invalid design: {error}")

    return design


def generate_ai_response(prompt, current_design=None, query_embedding=None):
    """
    Used by the conversational AI Generator page. Decides for itself
    whether the message is casual chat or an actual design request, and
    returns one of:
        {"type": "chat", "reply": "..."}
        {"type": "design", "reply": "...", "design": {...}}
    Raises ValueError if the model doesn't follow the expected format,
    or if a "design" response fails schema validation.
    """
    client = OpenAI(
        api_key=os.getenv("OPENROUTER_API_KEY"),
        base_url="https://openrouter.ai/api/v1"
    )

    context_text = ""
    if query_embedding:
        retrieved = retrieve_context(query_embedding, top_k=3)
        context_text = "\n".join([r["content"] for r in retrieved])

    full_prompt = _build_full_prompt(prompt, current_design, context_text)

    response = client.chat.completions.create(
        model="openai/gpt-4o-mini",
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": COMBINED_SYSTEM_PROMPT},
            {"role": "user", "content": full_prompt}
        ]
    )

    raw_output = response.choices[0].message.content
    result = json.loads(raw_output)
    result_type = result.get("type")

    if result_type == "design":
        design = result.get("design")
        is_valid, error = validate_design(design)
        if not is_valid:
            raise ValueError(f"AI generated an invalid design: {error}")
        return {
            "type": "design",
            "reply": result.get("reply") or "Here's the updated design.",
            "design": design,
        }

    if result_type == "chat":
        return {
            "type": "chat",
            "reply": result.get("reply") or "I'm not sure how to respond to that — try describing a system you'd like me to design.",
        }

    raise ValueError("AI response didn't match the expected chat/design format")


if __name__ == "__main__":
    fake_api_response = json.dumps(DESIGN_SCHEMA_EXAMPLE)
    parsed = json.loads(fake_api_response)
    print("Parsed design:", parsed)
    assert "nodes" in parsed and "edges" in parsed
    print("Structure check passed.")

    print("\n(Skipping retrieve_context() check — Miranda's embeddings table isn't set up yet, and nothing in the app actually calls this path.)")

    print("\n--- Testing generate_design() (design-only, Workspace terminal) ---")
    real_design = generate_design("A simple web app with a database")
    print("AI-generated design:", json.dumps(real_design, indent=2))

    print("\n--- Testing generate_ai_response() with a greeting (should be chat) ---")
    chat_result = generate_ai_response("hello")
    print(json.dumps(chat_result, indent=2))
    assert chat_result["type"] == "chat"

    print("\n--- Testing generate_ai_response() with a design request ---")
    design_result = generate_ai_response("Design a simple blog with a database and a CDN")
    print(json.dumps(design_result, indent=2))
    assert design_result["type"] == "design"

    print("\nAll checks passed.")