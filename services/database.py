import os
import sqlite3
import time
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
            conn.execute('''
                CREATE TABLE IF NOT EXISTS demands (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    message_id TEXT UNIQUE,
                    chat_id TEXT NOT NULL,
                    chat_name TEXT,
                    sender_name TEXT,
                    summary TEXT,
                    body TEXT,
                    timestamp INTEGER,
                    status TEXT NOT NULL DEFAULT 'open',
                    answered_at INTEGER,
                    alerted_at TEXT,
                    created_at TEXT
                )
            ''')
            conn.execute(
                'CREATE INDEX IF NOT EXISTS idx_demands_status '
                'ON demands (status, chat_id)'
            )
            conn.commit()
        finally:
            conn.close()

    def save_message(self, message_id, chat_id, chat_name, sender_id,
                     sender_name, body, from_me, msg_type, timestamp):
        """Grava a mensagem. Retorna True se foi inserida (nova), False se ja existia."""
        conn = self.__connect()
        try:
            cursor = conn.execute('''
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
            return cursor.rowcount > 0
        finally:
            conn.close()

    def save_demand(self, message_id, chat_id, chat_name, sender_name,
                    summary, body, timestamp):
        conn = self.__connect()
        try:
            conn.execute('''
                INSERT OR IGNORE INTO demands
                (message_id, chat_id, chat_name, sender_name, summary,
                 body, timestamp, status, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?)
            ''', (
                message_id, chat_id, chat_name, sender_name, summary,
                body, timestamp, datetime.now().isoformat(),
            ))
            conn.commit()
        finally:
            conn.close()

    def close_open_demands(self, chat_id, answered_at):
        """Marca como respondidas as demandas abertas de um grupo (resposta da equipe)."""
        conn = self.__connect()
        try:
            cursor = conn.execute('''
                UPDATE demands SET status = 'answered', answered_at = ?
                WHERE chat_id = ? AND status = 'open'
            ''', (answered_at, chat_id))
            conn.commit()
            return cursor.rowcount
        finally:
            conn.close()

    def get_overdue_demands(self, sla_seconds):
        """Demandas abertas, ainda nao alertadas, criadas ha mais de sla_seconds."""
        cutoff = int(time.time()) - sla_seconds
        conn = self.__connect()
        try:
            rows = conn.execute('''
                SELECT * FROM demands
                WHERE status = 'open'
                  AND alerted_at IS NULL
                  AND timestamp IS NOT NULL
                  AND timestamp <= ?
                ORDER BY timestamp ASC
            ''', (cutoff,)).fetchall()
            return [dict(r) for r in rows]
        finally:
            conn.close()

    def mark_demands_alerted(self, demand_ids):
        if not demand_ids:
            return
        conn = self.__connect()
        try:
            now = datetime.now().isoformat()
            conn.executemany(
                'UPDATE demands SET alerted_at = ? WHERE id = ?',
                [(now, demand_id) for demand_id in demand_ids],
            )
            conn.commit()
        finally:
            conn.close()
