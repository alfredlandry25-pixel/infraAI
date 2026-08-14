print("Step 1: starting")

from app import app
print("Step 2: app imported")

from models_auth import db, Role
print("Step 3: db, Role imported")

ROLES_TO_SEED = [
    ("admin", "System administrator"),
    ("user", "Default account role"),
    ("owner", "Project owner — full control"),
    ("editor", "Project editor — can modify designs"),
    ("viewer", "Project viewer — read-only access"),
]

with app.app_context():
    print("Step 4: inside app context")
    for name, description in ROLES_TO_SEED:
        existing = Role.query.filter_by(name=name).first()
        if not existing:
            role = Role(name=name, description=description)
            db.session.add(role)
            print(f"Created role: {name}")
        else:
            print(f"Role already exists: {name}")

    db.session.commit()
    print("Step 5: committed")
    print("\nAll roles seeded successfully.")