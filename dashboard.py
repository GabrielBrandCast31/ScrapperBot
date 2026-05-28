import os
import time
import threading
from datetime import datetime

from flask import Blueprint, render_template, request, redirect, url_for, jsonify

from services.database import Database
from services.importer import import_history
from services.whatsapp_import import importar_arquivo


# Painel local; sem autenticacao.
dashboard = Blueprint('dashboard', __name__)


# --------- helpers ----------

def _fmt_abs(ts):
    if not ts:
        return '—'
    return datetime.fromtimestamp(ts).strftime('%d/%m/%Y %H:%M')


def _fmt_rel(ts, now):
    if not ts:
        return '—'
    secs = max(0, now - ts)
    h = secs // 3600
    m = (secs % 3600) // 60
    if h >= 24:
        return f'há {h // 24}d'
    if h >= 1:
        return f'há {h}h'
    return f'há {m}min'


def _carregar_contexto_conversa(chat_id, limite_msgs=1500, limite_chars_por_msg=600):
    """Carrega ate `limite_msgs` mensagens em ordem cronologica, formatadas como texto.

    Retorna (chat_name, transcript_text). Truncado pra caber no contexto do
    gpt-4o-mini (128k tokens). 1500 msgs ~= 50-80k tokens — seguro.
    """
    msgs = Database().get_messages(chat_id, limit=limite_msgs)
    if not msgs:
        return chat_id, ''
    nome = msgs[0].get('chat_name') or chat_id
    msgs = list(reversed(msgs))  # get_messages devolve DESC; queremos ASC
    linhas = []
    for m in msgs:
        quem = 'Equipe' if m.get('from_me') else (m.get('sender_name') or 'Cliente')
        when = _fmt_abs(m.get('timestamp'))
        body = (m.get('body') or '')
        if len(body) > limite_chars_por_msg:
            body = body[:limite_chars_por_msg] + '…'
        linhas.append(f'[{when}] {quem}: {body}')
    return nome, '\n'.join(linhas)


# --------- Insights (landing) ----------

@dashboard.route('/painel')
def painel():
    now = int(time.time())
    db = Database()
    msgs = db.contagem_mensagens()
    grupos = [g for g in db.get_groups() if '@g.us' in g['chat_id'] or g['chat_id'].startswith('import:')]
    top_volume = grupos[:10]  # get_groups ja vem ordenado por last_ts DESC
    for g in top_volume:
        g['ultima'] = _fmt_rel(g.get('last_ts'), now)
    return render_template(
        'insights.html',
        active='insights',
        msgs=msgs,
        clientes_total=len(grupos),
        top_volume=top_volume,
    )


# --------- Conversas ----------

@dashboard.route('/painel/conversas')
def conversas():
    now = int(time.time())
    grupos = Database().get_groups()
    for g in grupos:
        g['ultima'] = _fmt_rel(g.get('last_ts'), now)
    return render_template('conversas.html', active='conversas', grupos=grupos)


# --------- Clientes ----------

@dashboard.route('/painel/clientes')
def clientes():
    now = int(time.time())
    db = Database()
    grupos = [
        g for g in db.get_groups()
        if '@g.us' in g['chat_id'] or g['chat_id'].startswith('import:')
    ]
    for g in grupos:
        g['ultima'] = _fmt_rel(g.get('last_ts'), now)
        g['chat_name'] = g['chat_name'] or g['chat_id']
    return render_template('clientes.html', active='clientes', clientes=grupos)


# --------- Chat IA (geral OU focado em uma conversa) ----------

@dashboard.route('/painel/chat')
def chat():
    chat_id = (request.args.get('chat_id') or '').strip()
    nome = ''
    if chat_id:
        msgs = Database().get_messages(chat_id, limit=1)
        nome = (msgs[0].get('chat_name') if msgs else chat_id) or chat_id
    return render_template('chat.html', active='chat', chat_id=chat_id, chat_name_focado=nome)


@dashboard.route('/painel/chat/perguntar', methods=['POST'])
def chat_perguntar():
    from bot.ai import DataChatBot

    payload = request.get_json(silent=True) or {}
    historia = payload.get('historia') or []
    chat_id = (payload.get('chat_id') or '').strip()

    historia_limpa = []
    for m in historia:
        role = m.get('role')
        conteudo = (m.get('content') or '').strip()
        if role in ('user', 'assistant') and conteudo:
            historia_limpa.append({'role': role, 'content': conteudo})
    if not historia_limpa:
        return jsonify({'erro': 'pergunta vazia'}), 400

    chat_context = None
    chat_name = None
    if chat_id:
        chat_name, chat_context = _carregar_contexto_conversa(chat_id)

    try:
        resposta = DataChatBot().ask(
            historia_limpa,
            chat_context=chat_context,
            chat_name=chat_name,
        )
        return jsonify({'resposta': resposta})
    except Exception as exc:
        print(f'[chat_perguntar erro] {exc}', flush=True)
        return jsonify({'erro': str(exc)}), 500


# --------- Mensagens de uma conversa (drill-down) ----------

@dashboard.route('/painel/grupo')
def grupo():
    chat_id = request.args.get('chat_id', '')
    db = Database()
    mensagens = db.get_messages(chat_id, limit=300)
    for m in mensagens:
        m['quando'] = _fmt_abs(m.get('timestamp'))
    nome = mensagens[0]['chat_name'] if mensagens else chat_id
    return render_template(
        'grupo.html', active='conversas',
        mensagens=mensagens, nome=nome, chat_id=chat_id,
    )


# --------- Acoes ----------

@dashboard.route('/painel/importar', methods=['POST'])
def importar():
    threading.Thread(target=import_history, kwargs={'days': 30}, daemon=True).start()
    return redirect(url_for('dashboard.clientes', importacao='1'))


UPLOAD_DIR = '/app/data/chat_exports'


@dashboard.route('/painel/importar-arquivo', methods=['GET'])
def importar_arquivo_form():
    grupos = [
        g for g in Database().get_groups()
        if '@g.us' in g['chat_id'] or g['chat_id'].startswith('import:')
    ]
    return render_template('importar_arquivo.html', active='clientes', grupos=grupos)


@dashboard.route('/painel/importar-arquivo', methods=['POST'])
def importar_arquivo_enviar():
    arquivo = request.files.get('arquivo')
    chat_id = (request.form.get('chat_id') or '').strip()
    chat_name_input = (request.form.get('chat_name') or '').strip()
    nomes_equipe = (request.form.get('nomes_equipe') or '').strip()

    if not arquivo or not chat_id:
        return redirect(url_for('dashboard.importar_arquivo_form', erro='arquivo-ou-grupo-faltando'))

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    nome_base = ''.join(c for c in (arquivo.filename or 'chat.txt') if c.isalnum() or c in '._-') or 'chat.txt'
    caminho = os.path.join(UPLOAD_DIR, nome_base)
    arquivo.save(caminho)

    chat_name = chat_name_input
    if not chat_name:
        for g in Database().get_groups():
            if g['chat_id'] == chat_id:
                chat_name = g['chat_name'] or chat_id
                break
        chat_name = chat_name or chat_id

    team_tokens = None
    if nomes_equipe:
        team_tokens = tuple(s.strip() for s in nomes_equipe.split(',') if s.strip())

    def _run():
        try:
            importar_arquivo(caminho, chat_id=chat_id, chat_name=chat_name, team_tokens=team_tokens)
        except Exception as exc:
            print(f'[importar_arquivo erro] {exc}', flush=True)

    threading.Thread(target=_run, daemon=True).start()
    return redirect(url_for('dashboard.clientes', importacao='1'))
