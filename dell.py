import sqlite3
import random

# Path to your SQLite database
db_path = "users.db"

# Connect to the database
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# --- Step 1: Drop unwanted tables ---
tables_to_delete = ["agent_profiles", "feedback", "product_ratings"]
for table in tables_to_delete:
    cursor.execute(f"DROP TABLE IF EXISTS {table}")
    print(f"Table '{table}' deleted (if existed).")