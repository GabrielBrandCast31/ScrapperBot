import os
import sqlite3
from datetime import datetime


DB_PATH = os.environ.get('DB_PATH', '/app/data/messages.db')


class Database:

    def __init__(self):
        os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
        self.__create_tables()

    def __connect(self):
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        return conn

    def __create_tables(self):
        conn = self.__connect()
        try:
            conn.execute('''
                CREATE TABLE IF NOT EXISTS messages (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    message_id TEXT UNIQUE,
                    chat_id TEXT NOT NULL,
                    chat_name TEXT,
                    sender_id TEXT,
                    sender_name TEXT,
                    body TEXT,
                    from_me INTEGER NOT NULL,
                    msg_type TEXT,
                    timestamp INTEGER,
                    created_at TEXT
                )
            ''')
            conn.execute(
                'CREATE INDEX IF NOT EXISTS idx_messages_chat '
                'ON messages (chat_id, timestamp)'
            )
            conn.commit()
        finally:
            conn.close()

    def save_message(self, message_id, chat_id, chat_name, sender_id,
                     sender_name, body, from_me, msg_type, timestamp):
        conn = self.__connect()
        try:
            conn.execute('''
                INSERT OR IGNORE INTO messages
                (message_id, chat_id, chat_name, sender_id, sender_name,
                 body, from_me, msg_type, timestamp, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                message_id, chat_id, chat_name, sender_id, sender_name,
                body, int(bool(from_me)), msg_type, timestamp,
                datetime.now().isoformat(),
            ))
            conn.commit()
        finally:
            conn.close()
