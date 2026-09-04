import sqlite3

# Connect to your database
conn = sqlite3.connect("users.db")
cursor = conn.cursor()

# Delete the last row (highest id)
cursor.execute("DELETE FROM workshops WHERE id = (SELECT MAX(id) FROM workshops)")

# Commit and close
conn.commit()
conn.close()

print("Last row deleted successfully!")
