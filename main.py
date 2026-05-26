from flask import Flask, request, jsonify

# === ETAPA 4: captura/observa mensagens de GRUPOS e grava no banco ===
# Auto-reply DESLIGADO. A IA (classificacao de demandas) entra na Etapa 5.
# from bot.ai import AIBot
from services.waha import Waha
from services.database import Database


app = Flask(__name__)


@app.route('/chatbot/webhook/', methods=['POST'])
def webhook():
    data = request.json

    event = data.get('event')
    payload = data.get('payload', {})

    if event not in ('message', 'message.any'):
        return jsonify({'status': 'ignored', 'reason': f'evento {event}'}), 200

    chat_id = payload.get('from')
    is_group = bool(chat_id) and '@g.us' in chat_id

    # Captura apenas mensagens de GRUPOS (clientes da agencia)
    if not is_group:
        return jsonify({'status': 'ignored', 'reason': 'nao e grupo'}), 200

    inner = payload.get('_data') or {}
    msg_type = inner.get('type')

    # So mensagens de texto reais (ignora notificacoes de sistema)
    if msg_type != 'chat':
        return jsonify({'status': 'ignored', 'reason': f'tipo {msg_type}'}), 200

    from_me = bool(payload.get('fromMe'))
    author = inner.get('author') or {}
    sender_id = payload.get('participant') or author.get('_serialized')
    sender_name = inner.get('notifyName') or ('Equipe' if from_me else 'Desconhecido')
    body = payload.get('body') or ''
    timestamp = payload.get('timestamp')
    message_id = payload.get('id')

    waha = Waha()
    chat_name = waha.get_chat_name(chat_id)

    database = Database()
    database.save_message(
        message_id=message_id,
        chat_id=chat_id,
        chat_name=chat_name,
        sender_id=sender_id,
        sender_name=sender_name,
        body=body,
        from_me=from_me,
        msg_type=msg_type,
        timestamp=timestamp,
    )

    origem = 'equipe' if from_me else 'cliente'
    print(f'[GRAVADO] {chat_name} | {sender_name} ({origem}): {body[:60]}', flush=True)

    return jsonify({'status': 'success'}), 200


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
