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
                    sender_phone TEXT,
                    body TEXT,
                    from_me INTEGER NOT NULL,
                    msg_type TEXT,
                    timestamp INTEGER,
                    sentiment TEXT,
                    sentiment_score REAL,
                    sentiment_at TEXT,
                    created_at TEXT
                )
            ''')
            conn.execute(
                'CREATE INDEX IF NOT EXISTS idx_messages_chat '
                'ON messages (chat_id, timestamp)'
            )
            # Migracoes idempotentes (precisam vir ANTES do indice que usa sentiment)
            for coluna, tipo in [
                ('sender_phone', 'TEXT'),
                ('sentiment', 'TEXT'),
                ('sentiment_score', 'REAL'),
                ('sentiment_at', 'TEXT'),
            ]:
                try:
                    conn.execute(f'ALTER TABLE messages ADD COLUMN {coluna} {tipo}')
                except sqlite3.OperationalError:
                    pass  # ja existe
            conn.execute(
                'CREATE INDEX IF NOT EXISTS idx_messages_sentiment '
                'ON messages (chat_id, sentiment) WHERE sentiment IS NOT NULL'
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
                    team_replied_at INTEGER,
                    created_at TEXT
                )
            ''')
            conn.execute(
                'CREATE INDEX IF NOT EXISTS idx_demands_status '
                'ON demands (status, chat_id)'
            )
            # Migracao idempotente: adiciona team_replied_at em bancos antigos.
            try:
                conn.execute('ALTER TABLE demands ADD COLUMN team_replied_at INTEGER')
            except sqlite3.OperationalError:
                pass  # coluna ja existe
            conn.execute('''
                CREATE TABLE IF NOT EXISTS hourly_summaries (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    chat_id TEXT NOT NULL,
                    chat_name TEXT,
                    inicio_ts INTEGER,
                    fim_ts INTEGER,
                    qtd_msgs INTEGER,
                    resumo TEXT,
                    created_at TEXT
                )
            ''')
            conn.execute(
                'CREATE INDEX IF NOT EXISTS idx_summaries_chat_fim '
                'ON hourly_summaries (chat_id, fim_ts DESC)'
            )
            conn.commit()
        finally:
            conn.close()

    def save_message(self, message_id, chat_id, chat_name, sender_id,
                     sender_name, body, from_me, msg_type, timestamp,
                     sender_phone=None):
        """Grava a mensagem. Retorna True se foi inserida (nova), False se ja existia."""
        conn = self.__connect()
        try:
            cursor = conn.execute('''
                INSERT OR IGNORE INTO messages
                (message_id, chat_id, chat_name, sender_id, sender_name,
                 sender_phone, body, from_me, msg_type, timestamp, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                message_id, chat_id, chat_name, sender_id, sender_name,
                sender_phone, body, int(bool(from_me)), msg_type, timestamp,
                datetime.now().isoformat(),
            ))
            conn.commit()
            return cursor.rowcount > 0
        finally:
            conn.close()

    def update_sentiment(self, message_id, sentiment, score):
        conn = self.__connect()
        try:
            conn.execute(
                'UPDATE messages SET sentiment = ?, sentiment_score = ?, '
                'sentiment_at = ? WHERE message_id = ?',
                (sentiment, score, datetime.now().isoformat(), message_id),
            )
            conn.commit()
        finally:
            conn.close()

    def messages_pending_sentiment(self, limit=None):
        """Mensagens de cliente (texto real) ainda sem sentiment."""
        conn = self.__connect()
        try:
            sql = '''
                SELECT message_id, chat_id, chat_name, sender_name, body, timestamp
                FROM messages
                WHERE from_me = 0
                  AND msg_type = 'chat'
                  AND body IS NOT NULL AND body != ''
                  AND body NOT LIKE '[%]'
                  AND sentiment IS NULL
                ORDER BY timestamp DESC
            '''
            if limit:
                sql += f' LIMIT {int(limit)}'
            rows = conn.execute(sql).fetchall()
            return [dict(r) for r in rows]
        finally:
            conn.close()

    def save_demand(self, message_id, chat_id, chat_name, sender_name,
                    summary, body, timestamp,
                    team_replied_at=None, alerted_at=None):
        conn = self.__connect()
        try:
            conn.execute('''
                INSERT OR IGNORE INTO demands
                (message_id, chat_id, chat_name, sender_name, summary,
                 body, timestamp, status, team_replied_at, alerted_at, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?)
            ''', (
                message_id, chat_id, chat_name, sender_name, summary,
                body, timestamp, team_replied_at, alerted_at,
                datetime.now().isoformat(),
            ))
            conn.commit()
        finally:
            conn.close()

    def get_unclassified_group_messages(self):
        """Mensagens de cliente (groups) com texto real que ainda nao geraram demanda."""
        conn = self.__connect()
        try:
            rows = conn.execute('''
                SELECT m.message_id, m.chat_id, m.chat_name, m.sender_name,
                       m.body, m.timestamp
                FROM messages m
                WHERE m.from_me = 0
                  AND m.msg_type = 'chat'
                  AND m.chat_id LIKE '%@g.us'
                  AND m.body IS NOT NULL AND m.body != ''
                  AND m.body NOT LIKE '[%]'
                  AND NOT EXISTS (
                      SELECT 1 FROM demands d WHERE d.message_id = m.message_id
                  )
                ORDER BY m.timestamp ASC
            ''').fetchall()
            return [dict(r) for r in rows]
        finally:
            conn.close()

    def find_first_team_reply_after(self, chat_id, after_ts):
        """Timestamp da primeira mensagem da equipe (fromMe=1) no grupo apos after_ts."""
        conn = self.__connect()
        try:
            row = conn.execute('''
                SELECT timestamp FROM messages
                WHERE chat_id = ? AND from_me = 1 AND timestamp > ?
                ORDER BY timestamp ASC LIMIT 1
            ''', (chat_id, after_ts)).fetchone()
            return row['timestamp'] if row else None
        finally:
            conn.close()

    def record_team_reply(self, chat_id, timestamp):
        """Registra que a equipe respondeu no grupo (so na PRIMEIRA resposta apos a demanda).
        NAO fecha a demanda: ela continua em 'open' ate ser resolvida manualmente.
        """
        conn = self.__connect()
        try:
            cursor = conn.execute('''
                UPDATE demands SET team_replied_at = ?
                WHERE chat_id = ?
                  AND status = 'open'
                  AND team_replied_at IS NULL
                  AND timestamp <= ?
            ''', (timestamp, chat_id, timestamp))
            conn.commit()
            return cursor.rowcount
        finally:
            conn.close()

    def get_overdue_demands(self, sla_seconds):
        """Demandas abertas, sem resposta da equipe, ha mais de sla_seconds e ainda nao alertadas."""
        cutoff = int(time.time()) - sla_seconds
        conn = self.__connect()
        try:
            rows = conn.execute('''
                SELECT * FROM demands
                WHERE status = 'open'
                  AND alerted_at IS NULL
                  AND team_replied_at IS NULL
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

    # ----- consultas usadas pelo painel -----

    def get_demands(self, status=None):
        conn = self.__connect()
        try:
            if status in ('open', 'answered'):
                rows = conn.execute(
                    'SELECT * FROM demands WHERE status = ? ORDER BY timestamp DESC',
                    (status,),
                ).fetchall()
            else:
                rows = conn.execute(
                    'SELECT * FROM demands ORDER BY timestamp DESC'
                ).fetchall()
            return [dict(r) for r in rows]
        finally:
            conn.close()

    def get_groups(self, inicio_ts=None, fim_ts=None):
        conn = self.__connect()
        try:
            sql = '''
                SELECT chat_id, chat_name,
                       COUNT(*) AS total,
                       MAX(timestamp) AS last_ts
                FROM messages
            '''
            extras = []
            params = []
            if inicio_ts is not None:
                extras.append('timestamp >= ?')
                params.append(int(inicio_ts))
            if fim_ts is not None:
                extras.append('timestamp < ?')
                params.append(int(fim_ts))
            if extras:
                sql += ' WHERE ' + ' AND '.join(extras)
            sql += ' GROUP BY chat_id ORDER BY last_ts DESC'
            rows = conn.execute(sql, tuple(params)).fetchall()
            return [dict(r) for r in rows]
        finally:
            conn.close()

    def get_messages(self, chat_id, limit=200, inicio_ts=None, fim_ts=None):
        conn = self.__connect()
        try:
            sql = 'SELECT * FROM messages WHERE chat_id = ?'
            params = [chat_id]
            if inicio_ts is not None:
                sql += ' AND timestamp >= ?'
                params.append(int(inicio_ts))
            if fim_ts is not None:
                sql += ' AND timestamp < ?'
                params.append(int(fim_ts))
            sql += ' ORDER BY timestamp DESC LIMIT ?'
            params.append(int(limit))
            rows = conn.execute(sql, tuple(params)).fetchall()
            return [dict(r) for r in rows]
        finally:
            conn.close()

    def resolve_demand(self, demand_id):
        conn = self.__connect()
        try:
            conn.execute(
                "UPDATE demands SET status = 'answered', answered_at = ? WHERE id = ?",
                (int(time.time()), demand_id),
            )
            conn.commit()
        finally:
            conn.close()

    # ----- consultas para Insights e para o Chat IA -----

    def top_clientes_por_demanda(self, status='open', limit=10):
        """Top grupos com mais demandas no status dado."""
        conn = self.__connect()
        try:
            rows = conn.execute('''
                SELECT chat_name, chat_id, COUNT(*) AS total
                FROM demands
                WHERE status = ? AND chat_id LIKE '%@g.us'
                GROUP BY chat_id
                ORDER BY total DESC
                LIMIT ?
            ''', (status, limit)).fetchall()
            return [dict(r) for r in rows]
        finally:
            conn.close()

    def top_clientes_atrasadas(self, sla_seconds, limit=10):
        cutoff = int(time.time()) - sla_seconds
        conn = self.__connect()
        try:
            rows = conn.execute('''
                SELECT chat_name, chat_id, COUNT(*) AS total
                FROM demands
                WHERE status = 'open'
                  AND team_replied_at IS NULL
                  AND timestamp <= ?
                  AND chat_id LIKE '%@g.us'
                GROUP BY chat_id
                ORDER BY total DESC
                LIMIT ?
            ''', (cutoff, limit)).fetchall()
            return [dict(r) for r in rows]
        finally:
            conn.close()

    def tempo_medio_resposta(self):
        """Tempo medio entre demanda criada e primeira resposta da equipe, em segundos."""
        conn = self.__connect()
        try:
            row = conn.execute('''
                SELECT AVG(team_replied_at - timestamp) AS media
                FROM demands
                WHERE team_replied_at IS NOT NULL AND timestamp IS NOT NULL
            ''').fetchone()
            return row['media'] if row and row['media'] is not None else None
        finally:
            conn.close()

    def contagem_mensagens(self, inicio_ts=None, fim_ts=None):
        """Total de mensagens (no periodo, se filtrado) + total nas ultimas 24h."""
        conn = self.__connect()
        try:
            agora = int(time.time())
            sql = 'SELECT COUNT(*) FROM messages'
            extras = []
            params = []
            if inicio_ts is not None:
                extras.append('timestamp >= ?')
                params.append(int(inicio_ts))
            if fim_ts is not None:
                extras.append('timestamp < ?')
                params.append(int(fim_ts))
            if extras:
                sql += ' WHERE ' + ' AND '.join(extras)
            total = conn.execute(sql, tuple(params)).fetchone()[0]
            ultimo_dia = conn.execute(
                'SELECT COUNT(*) FROM messages WHERE timestamp >= ?',
                (agora - 86400,),
            ).fetchone()[0]
            return {'total': total, 'ultimas_24h': ultimo_dia}
        finally:
            conn.close()

    def buscar_mensagens(self, termo, chat_name=None, limite=20):
        """Busca por substring em body. Opcionalmente filtra por nome de grupo."""
        conn = self.__connect()
        try:
            sql = '''
                SELECT chat_name, sender_name, body,
                       datetime(timestamp,'unixepoch') AS quando, from_me
                FROM messages
                WHERE body LIKE ?
            '''
            params = [f'%{termo}%']
            if chat_name:
                sql += ' AND chat_name LIKE ?'
                params.append(f'%{chat_name}%')
            sql += ' ORDER BY timestamp DESC LIMIT ?'
            params.append(limite)
            rows = conn.execute(sql, tuple(params)).fetchall()
            return [dict(r) for r in rows]
        finally:
            conn.close()

    # ----- consultas de SATISFACAO (novo foco) -----

    def clientes_satisfacao(self, limit=200, decay_dias=14):
        """Score de satisfacao por cliente (so grupos).

        Calculo: media ponderada de sentiment_score (-1 a +1) das mensagens do cliente,
        com peso decrescente por idade (meia-vida = `decay_dias`). Inclui contagem por
        sentimento (negative/neutral/positive/frustrated) e tamanho da amostra.
        """
        conn = self.__connect()
        try:
            agora = int(time.time())
            # 1 ponto a cada `decay_dias`: peso = 0.5 ** (idade_dias / decay_dias)
            rows = conn.execute('''
                SELECT
                    m.chat_id,
                    COALESCE(m.chat_name, m.chat_id) AS chat_name,
                    COUNT(*) AS amostra,
                    SUM(CASE WHEN m.sentiment = 'negative'   THEN 1 ELSE 0 END) AS neg,
                    SUM(CASE WHEN m.sentiment = 'neutral'    THEN 1 ELSE 0 END) AS neu,
                    SUM(CASE WHEN m.sentiment = 'positive'   THEN 1 ELSE 0 END) AS pos,
                    SUM(CASE WHEN m.sentiment = 'frustrated' THEN 1 ELSE 0 END) AS fru,
                    MAX(m.timestamp) AS ultima_msg,
                    -- soma ponderada e soma de pesos (decay exponencial)
                    SUM(m.sentiment_score * (POWER(0.5, (? - m.timestamp) / 86400.0 / ?))) AS soma_pond,
                    SUM(POWER(0.5, (? - m.timestamp) / 86400.0 / ?)) AS pesos
                FROM messages m
                WHERE m.from_me = 0
                  AND m.sentiment IS NOT NULL
                  AND m.chat_id LIKE '%@g.us'
                GROUP BY m.chat_id
                HAVING COUNT(*) > 0
                ORDER BY (soma_pond / pesos) ASC
                LIMIT ?
            ''', (agora, decay_dias, agora, decay_dias, limit)).fetchall()
            resultado = []
            for r in rows:
                d = dict(r)
                pesos = d.pop('pesos') or 0
                soma = d.pop('soma_pond') or 0
                d['score'] = (soma / pesos) if pesos else 0
                resultado.append(d)
            return resultado
        finally:
            conn.close()

    def contagem_sentimentos(self):
        """Quantas mensagens em cada sentimento (todas as conversas)."""
        conn = self.__connect()
        try:
            rows = conn.execute('''
                SELECT COALESCE(sentiment,'pendente') AS sentiment, COUNT(*) AS total
                FROM messages
                WHERE from_me = 0 AND msg_type = 'chat'
                  AND body IS NOT NULL AND body != ''
                  AND body NOT LIKE '[%]'
                GROUP BY COALESCE(sentiment,'pendente')
            ''').fetchall()
            return {r['sentiment']: r['total'] for r in rows}
        finally:
            conn.close()

    def mensagens_recentes_negativas(self, limite=20):
        conn = self.__connect()
        try:
            rows = conn.execute('''
                SELECT chat_name, sender_name, sender_phone, body,
                       sentiment, sentiment_score,
                       datetime(timestamp,'unixepoch') AS quando, timestamp
                FROM messages
                WHERE from_me = 0 AND sentiment IN ('negative','frustrated')
                  AND chat_id LIKE '%@g.us'
                ORDER BY timestamp DESC
                LIMIT ?
            ''', (limite,)).fetchall()
            return [dict(r) for r in rows]
        finally:
            conn.close()

    # ----- consultas de AUDITORIA HORARIA -----

    def chats_com_mensagens_recentes(self, since_ts):
        """Chats (so grupos/imports) que receberam mensagem >= since_ts."""
        conn = self.__connect()
        try:
            rows = conn.execute('''
                SELECT chat_id, MAX(chat_name) AS chat_name, COUNT(*) AS qtd,
                       MAX(timestamp) AS last_ts
                FROM messages
                WHERE timestamp >= ?
                  AND (chat_id LIKE '%@g.us' OR chat_id LIKE 'import:%')
                GROUP BY chat_id
                HAVING qtd >= 1
                ORDER BY last_ts DESC
            ''', (since_ts,)).fetchall()
            return [dict(r) for r in rows]
        finally:
            conn.close()

    def get_messages_no_periodo(self, chat_id, inicio_ts, fim_ts=None):
        """Mensagens de um chat em ordem cronologica ASC dentro do periodo."""
        conn = self.__connect()
        try:
            sql = '''
                SELECT chat_name, sender_name, body, timestamp, from_me,
                       datetime(timestamp,'unixepoch','localtime') AS quando
                FROM messages
                WHERE chat_id = ? AND timestamp >= ?
            '''
            params = [chat_id, int(inicio_ts)]
            if fim_ts is not None:
                sql += ' AND timestamp < ?'
                params.append(int(fim_ts))
            sql += ' ORDER BY timestamp ASC'
            rows = conn.execute(sql, tuple(params)).fetchall()
            return [dict(r) for r in rows]
        finally:
            conn.close()

    def save_hourly_summary(self, chat_id, chat_name, inicio_ts, fim_ts,
                            qtd_msgs, resumo):
        conn = self.__connect()
        try:
            conn.execute('''
                INSERT INTO hourly_summaries
                (chat_id, chat_name, inicio_ts, fim_ts, qtd_msgs, resumo, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (
                chat_id, chat_name, int(inicio_ts), int(fim_ts),
                int(qtd_msgs), resumo, datetime.now().isoformat(),
            ))
            conn.commit()
        finally:
            conn.close()

    def latest_summary_per_chat(self, limit=200):
        """Ultimo resumo de cada chat, mais recentes primeiro."""
        conn = self.__connect()
        try:
            rows = conn.execute('''
                SELECT s.* FROM hourly_summaries s
                INNER JOIN (
                    SELECT chat_id, MAX(fim_ts) AS max_fim
                    FROM hourly_summaries GROUP BY chat_id
                ) m ON s.chat_id = m.chat_id AND s.fim_ts = m.max_fim
                ORDER BY s.fim_ts DESC
                LIMIT ?
            ''', (int(limit),)).fetchall()
            return [dict(r) for r in rows]
        finally:
            conn.close()

    def listar_demandas_filtrado(self, status=None, chat_name=None, limite=30):
        """Variante mais flexivel pra uso no chat IA."""
        conn = self.__connect()
        try:
            sql = '''
                SELECT chat_name, sender_name, summary, status,
                       datetime(timestamp,'unixepoch') AS quando,
                       datetime(team_replied_at,'unixepoch') AS equipe_em
                FROM demands
                WHERE 1=1
            '''
            params = []
            if status in ('open', 'answered'):
                sql += ' AND status = ?'
                params.append(status)
            if chat_name:
                sql += ' AND chat_name LIKE ?'
                params.append(f'%{chat_name}%')
            sql += ' ORDER BY timestamp DESC LIMIT ?'
            params.append(limite)
            rows = conn.execute(sql, tuple(params)).fetchall()
            return [dict(r) for r in rows]
        finally:
            conn.close()
