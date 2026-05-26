import os
import threading
import time

from flask import Flask, request, jsonify

# === ETAPA 6: captura/classifica demandas + alerta demandas atrasadas ===
# Auto-reply DESLIGADO (observe-only). A IA so CLASSIFICA, nao responde clientes.
from bot.ai import AIBot
from services.waha import Waha
from services.database import Database
from services.monitor import scan_overdue_demands


app = Flask(__name__)


SCAN_INTERVAL = 600  # varredura de demandas atrasadas a cada 10 minutos


def _scan_loop():
    while True:
        time.sleep(SCAN_INTERVAL)
        try:
            scan_overdue_demands()
        except Exception as exc:
            print(f'[SCAN erro] {exc}', flush=True)


# Inicia o agendador uma unica vez. Sob `flask run --debug` o reloader cria 2
# processos; WERKZEUG_RUN_MAIN=='true' so no processo que de fato atende.
if os.environ.get('WERKZEUG_RUN_MAIN') == 'true':
    threading.Thread(target=_scan_loop, daemon=True).start()
    print('[SCAN] agendador iniciado (a cada 10 min)', flush=True)


@app.route('/scan', methods=['GET', 'POST'])
def scan_endpoint():
    alertados = scan_overdue_demands()
    return jsonify({'status': 'ok', 'alertados': alertados}), 200


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
    is_new = database.save_message(
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

    # So processa demanda em mensagem nova (evita reprocessar retries do webhook)
    if is_new:
        if from_me:
            # Resposta da equipe: fecha demandas abertas do grupo
            fechadas = database.close_open_demands(
                chat_id=chat_id,
                answered_at=timestamp,
            )
            if fechadas:
                print(f'[RESPONDIDO] {chat_name}: {fechadas} demanda(s) fechada(s)', flush=True)
        else:
            # Cliente: classifica se a mensagem e uma demanda
            ai_bot = AIBot()
            result = ai_bot.classify_demand(body)
            if result['is_demand']:
                database.save_demand(
                    message_id=message_id,
                    chat_id=chat_id,
                    chat_name=chat_name,
                    sender_name=sender_name,
                    summary=result['summary'],
                    body=body,
                    timestamp=timestamp,
                )
                print(f'[DEMANDA] {chat_name} | {sender_name}: {result["summary"]}', flush=True)
            else:
                print(f'[NAO-DEMANDA] {chat_name}: {body[:40]}', flush=True)

    return jsonify({'status': 'success'}), 200


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
