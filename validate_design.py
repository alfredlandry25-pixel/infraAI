from jsonschema import validate, ValidationError


DESIGN_JSON_SCHEMA = {
    "type": "object",
    "required": ["nodes", "edges"],
    "properties": {
        "nodes": {
            "type": "array",
            "items": {
                "type": "object",
                "required": ["id", "type", "label"],
                "properties": {
                    "id": {"type": "string"},
                    "types": {"type": "string"},
                    "label": {"type": "string"}
                }
            }
        },
        "edges": {
            "type": "array",
            "items": {
                "type": "object",
                "required": ["from", "to"],
                "properties": {
                    "from": {"type": "string"},
                    "to": {"type": "string"},
                    "label": {"type": "string"}
                }
            }
        }
    }
}


def validate_design(design):
    """
    checks whether 'design' (a dist,typically parsed from an LLM's JSON response) matches the required design schema.
    

    Returns(True, None) if vlid.
    Returns(False, error_message) if invalid - the caller (generate_design, or whoever wraps it in a Celery
    task / API route) should use this to reject the design BEFORE it reaches the frontend or get saved.

    """

    try:
    
        validate(instance=design, schema=DESIGN_JSON_SCHEMA)
        return True, None
    except ValidationError as e:
        return False, str(e.message)


if __name__ == "__main__":
      valid_design = {
           "nodes": [
                {"id": "1", "type": "ec2", "label": "web Server"},
                {"id": "2", "type": "database", "label": "DB Server"}
           ],
           "edges": [
                {"from": "1", "to": "2", "label": "connects to"}
           ]
      }

      missing_edges = {
           "nodes": [
                {"id": "1", "type": "ec2", "label": "web Server"},
           ]
      }
      wrong_type = {
           "nodes": [
                {"id": "1", "type": "ec2", "label": "web Server"},
                {"id": 2, "type": "database", "label": "DB Server"}
           ],
           "edges": []
      }

      missing_node_field = {
           "nodes": [
                {"id": "1", "type": "ec2"}  
           ],
           "edges":[]
      }

      not_a_list = {
           "nodes": {"id": "1", "type": "ec2", "label": "web Server"},
           "edges": []
      }

      test_cases = [
            ("valid_design", valid_design, True),
            ("missing_edges", missing_edges, False),
            ("wrong_type", wrong_type, False),
            ("missing_node_field", missing_node_field, False),
            ("not_a_list", not_a_list, False),
      ]

      print("Running schema validation tests...\n")
      for name, design, expected_valid in test_cases:
           is_valid, error = validate_design(design)
           status = "PASS" if is_valid == expected_valid else "FAIL"
           print(f"[{status}] {name}: valid={is_valid}" + (f", error={error}" if error else""))

      print("\nAll tests completed.")
        