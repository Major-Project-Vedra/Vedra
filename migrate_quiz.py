"""
migrate_quiz.py — Run ONCE to add image_url and question_type columns to the questions table.

Place this in:  backend/backend/
Run from that folder:  python migrate_quiz.py
"""

import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), 'instance', 'vedra.db')


def run():
    if not os.path.exists(DB_PATH):
        print(f"[ERROR] Database not found at: {DB_PATH}")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("PRAGMA table_info(questions)")
    columns = [row[1] for row in cursor.fetchall()]

    added = []

    if 'image_url' not in columns:
        cursor.execute("ALTER TABLE questions ADD COLUMN image_url VARCHAR(500) DEFAULT ''")
        added.append('image_url')

    if 'question_type' not in columns:
        cursor.execute("ALTER TABLE questions ADD COLUMN question_type VARCHAR(20) DEFAULT 'text'")
        added.append('question_type')

    if added:
        conn.commit()
        print(f"[DONE] Added columns: {', '.join(added)}")
    else:
        print("[OK] All columns already exist. Nothing to do.")

    conn.close()
    print("\nRestart your Flask server to apply changes.")


if __name__ == '__main__':
    run()