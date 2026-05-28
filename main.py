import os
import threading
import time

from dotenv import load_dotenv
from flask import Flask, request, jsonify

# Carrega .env (OPENAI_API_KEY, ...) antes de tudo
load_dotenv()

# === Objetivo atual: banco de conversas + Chat IA por conversa ===
# Observe-only. So armazena. Analise de qualquer coisa fica a cargo do
# usuario via Chat IA (botao "Analisar com IA" em cada conversa do painel).
from services.waha import Waha
from services.database import Database
from services.messages import MEDIA_LABELS, extract_phone
from dashboard import dashboard as dashboard_blueprint


app = Flask(__name__)
app.register_blueprint(dashboard_blueprint)


def _ensure_session_on_boot():
    """No boot do app, espera o WAHA subir e inicia a sessao salva (sem QR)."""
    waha = Waha()
    for _ in range(60):  # tenta por ~5 minutos
        status = waha.get_session_status()
        if status is None:
            time.sleep(5)
            continue
        if status in ('STOPPED', 'FAILED'):
            print('[BOOT] iniciando sessao WAHA salva...', flush=True)
            waha.start_session()
        else:
            print(f'[BOOT] sessao WAHA ja esta {status}', flush=True)
        return
    print('[BOOT] WAHA nao respondeu a tempo; sessao nao iniciada', flush=True)


def _session_healer_loop():
    """A cada 1h, religa a sessao se ela tiver caido (self-heal). Sem scan de demandas."""
    while True:
        time.sleep(3600)
        try:
            Waha().ensure_session_started()
        except Exception as exc:
            print(f'[HEAL erro] {exc}', flush=True)


# Threads de boot. Guarda com WERKZEUG_RUN_MAIN pra nao duplicar com o reloader do Flask.
if os.environ.get('WERKZEUG_RUN_MAIN') == 'true':
    threading.Thread(target=_ensure_session_on_boot, daemon=True).start()
    threading.Thread(target=_session_healer_loop, daemon=True).start()
    print('[BOOT] threads de sessao iniciadas (healer a cada 1h)', flush=True)


@app.route('/chatbot/webhook/', methods=['POST'])
def webhook():
    data = request.json

    event = data.get('event')
    payload = data.get('payload', {})

    if event not in ('message', 'message.any'):
        return jsonify({'status': 'ignored', 'reason': f'evento {event}'}), 200

    from_raw = payload.get('from')
    to_raw = payload.get('to')
    from_me = bool(payload.get('fromMe'))
    is_group = bool(from_raw) and '@g.us' in from_raw

    # Id da CONVERSA (mesma logica de antes)
    if is_group:
        chat_id = from_raw
    else:
        chat_id = to_raw if from_me else from_raw

    if not chat_id:
        return jsonify({'status': 'ignored', 'reason': 'sem chat_id'}), 200

    inner = payload.get('_data') or {}
    msg_type = inner.get('type')
    body = payload.get('body') or ''
    has_media = bool(payload.get('hasMedia'))

    # Ignora notificacoes de sistema (sem texto e sem midia)
    if not body and not has_media:
        return jsonify({'status': 'ignored', 'reason': f'sistema ({msg_type})'}), 200

    # Midia sem legenda -> marcador (e nao analisamos sentimento de marcador)
    is_media_only = False
    if not body and has_media:
        body = MEDIA_LABELS.get(msg_type, f'[{msg_type}]')
        is_media_only = True

    author = inner.get('author') or {}
    sender_id = payload.get('participant') or author.get('_serialized') or from_raw
    sender_name = inner.get('notifyName') or ('Equipe' if from_me else 'Desconhecido')
    timestamp = payload.get('timestamp')
    message_id = payload.get('id')

    # Telefone REAL do remetente (so quando vier em formato @c.us / @s.whatsapp.net)
    # Para individuais: from_me=False -> from = pessoa; from_me=True -> to = pessoa.
    # Para grupos: o sender e o participant/author.
    if is_group:
        sender_phone = extract_phone(sender_id, author)
    else:
        sender_phone = extract_phone(from_raw if not from_me else to_raw)

    waha = Waha()
    chat_name = waha.get_chat_name(chat_id)

    database = Database()
    is_new = database.save_message(
        message_id=message_id,
        chat_id=chat_id,
        chat_name=chat_name,
        sender_id=sender_id,
        sender_name=sender_name,
        sender_phone=sender_phone,
        body=body,
        from_me=from_me,
        msg_type=msg_type,
        timestamp=timestamp,
    )

    tipo_conversa = 'grupo' if is_group else 'pessoa'
    origem = 'equipe' if from_me else 'cliente'
    fone_label = sender_phone or '—'
    print(
        f'[GRAVADO/{tipo_conversa}] {chat_name} | {sender_name} ({fone_label}) '
        f'[{origem}]: {body[:60]}',
        flush=True,
    )

    # Observe-only: so armazena. Analise/perguntas vao para o Chat IA do painel.
    return jsonify({'status': 'success'}), 200


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
