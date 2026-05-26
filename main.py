from flask import Flask, request, jsonify

# === ETAPA 3: backend responde com IA (OpenAI) ===
from bot.ai import AIBot
from services.waha import Waha


app = Flask(__name__)


@app.route('/chatbot/webhook/', methods=['POST'])
def webhook():
    data = request.json

    event = data.get('event')
    payload = data.get('payload', {})

    # So processa eventos do tipo "message"
    if event != 'message':
        return jsonify({'status': 'ignored', 'reason': 'evento != message'}), 200

    chat_id = payload.get('from')
    body = (payload.get('body') or '').strip()
    from_me = payload.get('fromMe', False)
    msg_type = (payload.get('_data') or {}).get('type')

    is_group = bool(chat_id) and '@g.us' in chat_id
    is_text = msg_type == 'chat'

    # Ignora: mensagens proprias, grupos, notificacoes de sistema e corpo vazio
    if from_me or is_group or not is_text or not body:
        print(
            f'[IGNORADO] from_me={from_me} group={is_group} '
            f'type={msg_type} body={body!r}',
            flush=True,
        )
        return jsonify({'status': 'ignored'}), 200

    print(f'[MENSAGEM] {chat_id}: {body}', flush=True)

    waha = Waha()
    ai_bot = AIBot()

    waha.start_typing(chat_id=chat_id)
    history_messages = waha.get_history_messages(
        chat_id=chat_id,
        limit=10,
    )
    response_message = ai_bot.invoke(
        history_messages=history_messages,
        question=body,
    )
    print(f'[IA] resposta: {response_message}', flush=True)
    waha.send_message(
        chat_id=chat_id,
        message=response_message,
    )
    waha.stop_typing(chat_id=chat_id)

    return jsonify({'status': 'success'}), 200


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
