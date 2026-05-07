"""
migrate.py — Run this ONCE to add the slow_video_url column to the courses table.

Place this file inside:  backend/backend/
Then run from that folder:  python migrate.py
"""

import sqlite3
import os

# Path to your SQLite database — adjust if yours is different
DB_PATH = os.path.join(os.path.dirname(__file__), 'instance', 'vedra.db')

def run():
    if not os.path.exists(DB_PATH):
        print(f"[ERROR] Database not found at: {DB_PATH}")
        print("Make sure you run this from the backend/backend/ folder.")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Check if slow_video_url column already exists
    cursor.execute("PRAGMA table_info(courses)")
    columns = [row[1] for row in cursor.fetchall()]

    if 'slow_video_url' in columns:
        print("[OK] slow_video_url column already exists. Nothing to do.")
    else:
        print("[INFO] Adding slow_video_url column to courses table...")
        cursor.execute("ALTER TABLE courses ADD COLUMN slow_video_url VARCHAR(300)")
        conn.commit()
        print("[DONE] slow_video_url column added successfully!")

    conn.close()
    print("\nYou can now restart your Flask server and everything should work.")

if __name__ == '__main__':
    run()