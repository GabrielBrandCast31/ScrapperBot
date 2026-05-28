"""Importador de exports .txt do WhatsApp para o banco de mensagens.

WhatsApp permite "Exportar conversa" (.txt). Esse modulo parseia o formato
e popula a tabela `messages` reusando Database.save_message.

Formato esperado (iOS PT-BR):
    [DD/MM/YYYY, HH:MM:SS] Sender Nome: mensagem
    continuacao opcional em linhas seguintes (sem timestamp)

Quirks tratados:
- mojibake (UTF-8 lido como Latin-1) -> recupera para Unicode real
- caracteres LRM/RLM/BIDI antes do "[" -> strip
- mensagens de sistema (criou grupo, adicionou, mudou nome) -> ignora
- midia omitida (imagem/video/audio/documento) -> guarda marcador
"""

import os
import re
import hashlib
from datetime import datetime

from services.database import Database


# Equipe BrandCast: qualquer sender contendo um desses tokens vira from_me=True.
TEAM_TOKENS_DEFAULT = (
    'felipe campos', 'luan', 'nicolas', 'markin', 'pedro lucas',
    'mamãe linda', 'mamae linda', 'ana firsen', 'brandcast', 'vinicius',
)


# Linhas com esses padroes sao mensagens de sistema (nao guardamos).
SYSTEM_PATTERNS = (
    'criou o grupo',
    'adicionou',
    'removeu',
    'saiu',
    'mudou o nome do grupo',
    'mudou a imagem do grupo',
    'mudou o icone do grupo',
    'adicionou você',
    'adicionou voce',
    'as mensagens e ligações',
    'as mensagens e ligacoes',
)


# Marcadores de midia -> body substituto.
MEDIA_MARKERS = (
    ('imagem ocultada', '[imagem]'),
    ('imagem omitida', '[imagem]'),
    ('video omitido', '[video]'),
    ('vídeo omitido', '[video]'),
    ('audio omitido', '[audio]'),
    ('áudio omitido', '[audio]'),
    ('documento omitido', '[documento]'),
    ('figurinha omitida', '[figurinha]'),
    ('sticker omitido', '[figurinha]'),
    ('cartão do contato omitido', '[contato]'),
    ('cartao do contato omitido', '[contato]'),
    ('gif omitido', '[gif]'),
)


# Regex tolerante a chars invisiveis no comeco da linha (LRM, RLM, BOM, ZWJ).
_LINE = re.compile(
    r'^[\s‎‏‪-‮﻿]*'
    r'\[(\d{2})/(\d{2})/(\d{4}),\s*(\d{1,2}):(\d{2}):(\d{2})\]\s+'
    r'(.+?):\s?(.*)$'
)


def _fix_mojibake(text):
    """Recupera UTF-8 que foi lido/exibido como Latin-1 (caso comum em export iOS)."""
    if 'Ã' not in text and 'Â' not in text:
        return text
    try:
        return text.encode('latin-1', errors='strict').decode('utf-8', errors='strict')
    except (UnicodeEncodeError, UnicodeDecodeError):
        try:
            return text.encode('latin-1', errors='replace').decode('utf-8', errors='replace')
        except Exception:
            return text


def _is_team(sender, team_tokens):
    s = sender.lower()
    return any(token in s for token in team_tokens)


def _clean_sender(raw):
    """Remove '~', caracteres invisiveis e espacos extras do nome."""
    s = raw.strip()
    # remove LRM/RLM/BIDI no inicio/meio
    s = re.sub(r'[‎‏‪-‮﻿]', '', s)
    # remove tilde do whatsapp (~) e o NBSP que vem junto
    s = s.lstrip('~').strip()
    s = s.replace(' ', ' ')
    return s.strip()


def _normalize_body(body):
    body = re.sub(r'[‎‏‪-‮﻿]', '', body).strip()
    if not body:
        return ''
    low = body.lower()
    for needle, marker in MEDIA_MARKERS:
        if needle in low:
            return marker
    return body


def _is_system_line(body):
    low = body.lower()
    return any(p in low for p in SYSTEM_PATTERNS)


def parse_export(text):
    """Parseia o texto do export. Retorna lista de dicts (timestamp, sender, body, from_me)."""
    text = _fix_mojibake(text)
    msgs = []
    current = None
    for raw_line in text.splitlines():
        m = _LINE.match(raw_line)
        if not m:
            # continuacao de mensagem multi-linha
            if current is not None and raw_line.strip():
                current['body'] += '\n' + raw_line.strip()
            continue
        if current is not None:
            msgs.append(current)
        d, mo, y, hh, mm, ss, sender, body = m.groups()
        try:
            ts = int(datetime(int(y), int(mo), int(d), int(hh), int(mm), int(ss)).timestamp())
        except ValueError:
            current = None
            continue
        current = {
            'timestamp': ts,
            'sender_raw': sender,
            'body': body,
        }
    if current is not None:
        msgs.append(current)
    return msgs


def importar_arquivo(caminho, chat_id, chat_name, team_tokens=None):
    """Importa um arquivo .txt do WhatsApp para o banco.

    Retorna dict com 'total_linhas', 'salvas', 'puladas_sistema', 'puladas_vazias'.
    INSERT OR IGNORE evita duplicar se rodar 2x.
    """
    if not os.path.exists(caminho):
        return {'erro': f'arquivo nao encontrado: {caminho}'}

    team_tokens = tuple(t.lower() for t in (team_tokens or TEAM_TOKENS_DEFAULT))

    # Le como bytes e tenta decodificar utf-8; se falhar, latin-1
    with open(caminho, 'rb') as f:
        data = f.read()
    try:
        text = data.decode('utf-8')
    except UnicodeDecodeError:
        text = data.decode('latin-1')

    parsed = parse_export(text)
    db = Database()

    salvas = puladas_sistema = puladas_vazias = 0
    for msg in parsed:
        if _is_system_line(msg['body']):
            puladas_sistema += 1
            continue
        body = _normalize_body(msg['body'])
        if not body:
            puladas_vazias += 1
            continue

        sender = _clean_sender(msg['sender_raw'])
        from_me = _is_team(sender, team_tokens)
        # message_id estavel: dedupe se reimportar o mesmo arquivo
        chave = f"{chat_id}|{msg['timestamp']}|{sender}|{body}"
        h = hashlib.md5(chave.encode('utf-8')).hexdigest()[:12]
        message_id = f"wpp_export:{h}"

        if db.save_message(
            message_id=message_id,
            chat_id=chat_id,
            chat_name=chat_name,
            sender_id=None,
            sender_name=sender or ('Equipe' if from_me else 'Desconhecido'),
            sender_phone=None,  # exports .txt nao incluem numero
            body=body,
            from_me=from_me,
            msg_type='chat',
            timestamp=msg['timestamp'],
        ):
            salvas += 1

    print(
        f'[WPP-IMPORT] {chat_name}: {salvas} novas | '
        f'{puladas_sistema} sistema | {puladas_vazias} vazias',
        flush=True,
    )
    return {
        'total_linhas': len(parsed),
        'salvas': salvas,
        'puladas_sistema': puladas_sistema,
        'puladas_vazias': puladas_vazias,
    }
