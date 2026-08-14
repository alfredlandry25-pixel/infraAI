print("Step 1: starting script")

from app import app
print("Step 2: app imported successfully")

from Backend.models_auth import db
print("Step 3: db imported successfully")

with app.app_context():
    print("Step 4: inside app context, creating tables...")
    db.create_all()
    print("Step 5: Tables created successfully.")