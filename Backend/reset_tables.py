print("Step 1: starting")

from app import app
print("Step 2: app imported")

from models_auth import db
print("Step 3: db imported")

with app.app_context():
    print("Step 4: inside app context")
    print("Dropping all existing tables...")
    db.drop_all()
    print("Step 5: dropped")
    print("Creating tables fresh with the new schema...")
    db.create_all()
    print("Step 6: created")
    print("Done. Tables reset successfully.")