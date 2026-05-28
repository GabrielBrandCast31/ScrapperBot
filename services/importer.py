import time

from services.waha import Waha
from services.database import Database
from services.messages import MEDIA_LABELS, extract_phone


def _chat_id(chat):
    cid = chat.get('id')
    if isinstance(cid, dict):
        return cid.get('_serialized')
    return cid


def import_history(days=30, limit_per_chat=1000):
    """Backfill: importa o historico recente dos GRUPOS para o banco.

    - Apenas grupos (@g.us).
    - Apenas armazenamento: NAO classifica demandas nem dispara alertas
      (mensagens antigas geram alertas falsos de 'atrasada').
    - save_message usa INSERT OR IGNORE, entao nao duplica o que ja foi capturado.
    """
    waha = Waha()
    database = Database()

    cutoff = int(time.time()) - days * 86400
    chats = waha.list_chats()
    grupos = [c for c in chats if '@g.us' in (_chat_id(c) or '')]

    print(f'[IMPORT] iniciando backfill de {len(grupos)} grupo(s), ultimos {days} dias', flush=True)

    total = 0
    for chat in grupos:
        chat_id = _chat_id(chat)
        chat_name = chat.get('name') or chat_id

        mensagens = waha.get_history_messages(chat_id, limit_per_chat)
        if not isinstance(mensagens, list):
            print(f'[IMPORT] {chat_name}: resposta inesperada, pulando', flush=True)
            continue

        salvas = 0
        for m in mensagens:
            ts = m.get('timestamp')
            if not ts or ts < cutoff:
                continue

            inner = m.get('_data') or {}
            msg_type = inner.get('type')
            body = m.get('body') or ''
            has_media = bool(m.get('hasMedia'))

            if not body and not has_media:
                continue  # notificacao de sistema
            if not body and has_media:
                body = MEDIA_LABELS.get(msg_type, f'[{msg_type}]')

            author = inner.get('author') or {}
            sender_id = m.get('participant') or author.get('_serialized') or m.get('from')
            sender_name = inner.get('notifyName') or ('Equipe' if m.get('fromMe') else 'Desconhecido')
            # Telefone real (so quando vem em @c.us / @s.whatsapp.net; @lid nao expoe)
            sender_phone = extract_phone(sender_id, author, m.get('from'))

            if database.save_message(
                message_id=m.get('id'),
                chat_id=chat_id,
                chat_name=chat_name,
                sender_id=sender_id,
                sender_name=sender_name,
                sender_phone=sender_phone,
                body=body,
                from_me=bool(m.get('fromMe')),
                msg_type=msg_type,
                timestamp=ts,
            ):
                salvas += 1

        total += salvas
        print(f'[IMPORT] {chat_name}: +{salvas} mensagens novas', flush=True)

    print(f'[IMPORT] concluido: {total} mensagens novas salvas no total', flush=True)
    return total
