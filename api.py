# =============================================================================
# Blueprint JSON puro para o frontend React.
#
# Roda em paralelo ao blueprint `dashboard` (templates Jinja em /painel/*).
# As rotas Jinja permanecem como fallback enquanto o React e wirado.
#
# Convencao:
#   - Rotas GET retornam {ok: true, data: ...} ou {ok: false, erro: '...'}.
#   - Rotas POST de acao retornam {ok: true} ou {ok: false, erro: '...'}.
#   - Sempre HTTP 200 quando "negocio" (erros de validacao viram body), HTTP
#     500 so em excecao real nao tratada.
# =============================================================================

import os
import time
import threading
from datetime import datetime

from flask import Blueprint, request, jsonify, Response

from services.database import Database
from services.waha import Waha
from services.importer import import_history
from services.whatsapp_import import importar_arquivo


api = Blueprint('api', __name__, url_prefix='/api')


# --------- helpers ----------

def _parse_periodo_args():
    """Le ?inicio=YYYY-MM-DD&fim=YYYY-MM-DD dos query params.

    Retorna (inicio_ts, fim_ts). Datas invalidas viram None.
    Fim inclusivo (vai ate o final do dia).
    """
    inicio_str = (request.args.get('inicio') or '').strip()
    fim_str = (request.args.get('fim') or '').strip()
    inicio_ts = None
    fim_ts = None
    if inicio_str:
        try:
            inicio_ts = int(datetime.strptime(inicio_str, '%Y-%m-%d').timestamp())
        except ValueError:
            pass
    if fim_str:
        try:
            fim_dt = datetime.strptime(fim_str, '%Y-%m-%d')
            fim_ts = int(fim_dt.timestamp()) + 86400
        except ValueError:
            pass
    return inicio_ts, fim_ts


def _fmt_abs(ts):
    return datetime.fromtimestamp(ts).strftime('%d/%m/%Y %H:%M') if ts else None


def _fmt_rel(ts, now=None):
    if not ts:
        return None
    now = now or int(time.time())
    secs = max(0, now - ts)
    h = secs // 3600
    m = (secs % 3600) // 60
    if h >= 24:
        return f'há {h // 24}d'
    if h >= 1:
        return f'há {h}h'
    return f'há {m}min'


def _is_grupo(chat_id):
    return ('@g.us' in (chat_id or '')) or (chat_id or '').startswith('import:')


# --------- Insights ----------

@api.route('/insights')
def insights():
    now = int(time.time())
    inicio_ts, fim_ts = _parse_periodo_args()
    db = Database()
    msgs = db.contagem_mensagens(inicio_ts=inicio_ts, fim_ts=fim_ts)
    grupos = [
        g for g in db.get_groups(inicio_ts=inicio_ts, fim_ts=fim_ts)
        if _is_grupo(g['chat_id'])
    ]
    top_volume = grupos[:10]
    for g in top_volume:
        g['ultima'] = _fmt_rel(g.get('last_ts'), now)
        g['last_ts_fmt'] = _fmt_abs(g.get('last_ts'))
    return jsonify({
        'ok': True,
        'data': {
            'mensagens_total': msgs['total'],
            'mensagens_24h': msgs['ultimas_24h'],
            'clientes_total': len(grupos),
            'top_conversas': top_volume,
            'periodo': {
                'ativo': bool(inicio_ts or fim_ts),
                'inicio': request.args.get('inicio'),
                'fim': request.args.get('fim'),
            },
        },
    })


# --------- Clientes (so grupos / imports) ----------

@api.route('/clientes')
def clientes():
    now = int(time.time())
    inicio_ts, fim_ts = _parse_periodo_args()
    db = Database()
    grupos = [
        g for g in db.get_groups(inicio_ts=inicio_ts, fim_ts=fim_ts)
        if _is_grupo(g['chat_id'])
    ]
    for g in grupos:
        g['ultima'] = _fmt_rel(g.get('last_ts'), now)
        g['last_ts_fmt'] = _fmt_abs(g.get('last_ts'))
        g['chat_name'] = g['chat_name'] or g['chat_id']
    return jsonify({'ok': True, 'data': {'clientes': grupos}})


# --------- Conversas (todos: grupos + pessoas) ----------

@api.route('/conversas')
def conversas():
    now = int(time.time())
    inicio_ts, fim_ts = _parse_periodo_args()
    grupos = Database().get_groups(inicio_ts=inicio_ts, fim_ts=fim_ts)
    for g in grupos:
        g['ultima'] = _fmt_rel(g.get('last_ts'), now)
        g['last_ts_fmt'] = _fmt_abs(g.get('last_ts'))
        g['tipo'] = 'grupo' if _is_grupo(g['chat_id']) else 'pessoa'
    return jsonify({'ok': True, 'data': {'conversas': grupos}})


@api.route('/conversas/<path:chat_id>')
def conversa_detalhe(chat_id):
    inicio_ts, fim_ts = _parse_periodo_args()
    try:
        limit = int(request.args.get('limit', 300))
    except ValueError:
        limit = 300
    mensagens = Database().get_messages(
        chat_id, limit=limit,
        inicio_ts=inicio_ts, fim_ts=fim_ts,
    )
    for m in mensagens:
        m['quando'] = _fmt_abs(m.get('timestamp'))
    nome = mensagens[0]['chat_name'] if mensagens else chat_id
    return jsonify({
        'ok': True,
        'data': {
            'chat_id': chat_id,
            'chat_name': nome,
            'mensagens': mensagens,
            'total': len(mensagens),
        },
    })


# --------- Auditoria IA ----------

@api.route('/auditoria')
def auditoria_listar():
    now = int(time.time())
    sumarios = Database().latest_summary_per_chat(limit=200)
    for s in sumarios:
        s['quando'] = _fmt_rel(s.get('fim_ts'), now)
        s['janela'] = (
            f'{_fmt_abs(s.get("inicio_ts"))} – {_fmt_abs(s.get("fim_ts"))}'
            if s.get('inicio_ts') and s.get('fim_ts') else None
        )
    return jsonify({'ok': True, 'data': {'sumarios': sumarios}})


@api.route('/auditoria/rodar', methods=['POST'])
def auditoria_rodar():
    from services.auditoria import gerar_auditoria as _gerar

    def _run():
        try:
            _gerar(periodo_horas=1)
        except Exception as exc:
            print(f'[api auditoria erro] {exc}', flush=True)

    threading.Thread(target=_run, daemon=True).start()
    return jsonify({'ok': True})


# --------- Chat IA ----------

@api.route('/chat-ia/perguntar', methods=['POST'])
def chat_ia_perguntar():
    from bot.ai import DataChatBot

    payload = request.get_json(silent=True) or {}
    historia = payload.get('historia') or []
    chat_id = (payload.get('chat_id') or '').strip()
    inicio_str = (payload.get('inicio') or '').strip()
    fim_str = (payload.get('fim') or '').strip()

    inicio_ts = None
    fim_ts = None
    if inicio_str:
        try:
            inicio_ts = int(datetime.strptime(inicio_str, '%Y-%m-%d').timestamp())
        except ValueError:
            pass
    if fim_str:
        try:
            fim_dt = datetime.strptime(fim_str, '%Y-%m-%d')
            fim_ts = int(fim_dt.timestamp()) + 86400
        except ValueError:
            pass

    historia_limpa = []
    for m in historia:
        role = m.get('role')
        conteudo = (m.get('content') or '').strip()
        if role in ('user', 'assistant') and conteudo:
            historia_limpa.append({'role': role, 'content': conteudo})
    if not historia_limpa:
        return jsonify({'ok': False, 'erro': 'pergunta vazia'}), 200

    chat_context = None
    chat_name = None
    if chat_id:
        msgs = Database().get_messages(
            chat_id, limit=1500,
            inicio_ts=inicio_ts, fim_ts=fim_ts,
        )
        if msgs:
            chat_name = msgs[0].get('chat_name') or chat_id
            msgs_asc = list(reversed(msgs))
            linhas = []
            for m in msgs_asc:
                quem = 'Equipe' if m.get('from_me') else (m.get('sender_name') or 'Cliente')
                when = _fmt_abs(m.get('timestamp'))
                body = (m.get('body') or '')
                if len(body) > 600:
                    body = body[:600] + '…'
                linhas.append(f'[{when}] {quem}: {body}')
            chat_context = '\n'.join(linhas)

    try:
        resposta = DataChatBot().ask(
            historia_limpa,
            chat_context=chat_context,
            chat_name=chat_name,
        )
        return jsonify({'ok': True, 'data': {'resposta': resposta}})
    except Exception as exc:
        print(f'[api chat-ia erro] {exc}', flush=True)
        return jsonify({'ok': False, 'erro': str(exc)}), 200


# --------- Conexao WhatsApp ----------

@api.route('/conexao/status')
def conexao_status():
    info = Waha().get_session_info() or {}
    return jsonify({
        'ok': True,
        'data': {
            'status': info.get('status'),
            'me': info.get('me'),
            'engine': info.get('engine'),
        },
    })


@api.route('/conexao/qr')
def conexao_qr():
    png = Waha().get_qr_image()
    if not png:
        return ('', 404)
    return Response(png, mimetype='image/png')


@api.route('/conexao/start', methods=['POST'])
def conexao_start():
    Waha().start_session()
    return jsonify({'ok': True})


@api.route('/conexao/stop', methods=['POST'])
def conexao_stop():
    Waha().stop_session()
    return jsonify({'ok': True})


@api.route('/conexao/restart', methods=['POST'])
def conexao_restart():
    Waha().restart_session()
    return jsonify({'ok': True})


@api.route('/conexao/logout', methods=['POST'])
def conexao_logout():
    Waha().logout_session()
    return jsonify({'ok': True})


@api.route('/conexao/reconectar', methods=['POST'])
def conexao_reconectar():
    threading.Thread(target=Waha().reconnect_session, daemon=True).start()
    return jsonify({'ok': True})


# --------- Sincronizar .txt em uma conversa ----------

UPLOAD_DIR = '/app/data/chat_exports'


@api.route('/conversas/<path:chat_id>/sincronizar', methods=['POST'])
def sincronizar_conversa_api(chat_id):
    """Recebe um .txt e adiciona apenas as mensagens novas (dedup via hash)."""
    arquivo = request.files.get('arquivo')
    if not arquivo:
        return jsonify({'ok': False, 'erro': 'arquivo faltando'}), 200
    if not (arquivo.filename or '').lower().endswith('.txt'):
        return jsonify({'ok': False, 'erro': 'precisa ser .txt'}), 200

    # Recupera o chat_name atual pra preservar consistencia
    chat_name = chat_id
    for g in Database().get_groups():
        if g['chat_id'] == chat_id:
            chat_name = g['chat_name'] or chat_id
            break

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    nome_seguro = ''.join(c for c in (arquivo.filename or 'chat.txt')
                          if c.isalnum() or c in '._-') or 'chat.txt'
    caminho = os.path.join(UPLOAD_DIR, f'sync_{int(time.time())}_{nome_seguro}')
    arquivo.save(caminho)

    try:
        resultado = importar_arquivo(caminho, chat_id=chat_id, chat_name=chat_name) or {}
        return jsonify({
            'ok': True,
            'data': {
                'chat_name': chat_name,
                'novas': resultado.get('salvas', 0),
                'total_linhas': resultado.get('total_linhas', 0),
                'puladas_sistema': resultado.get('puladas_sistema', 0),
                'puladas_vazias': resultado.get('puladas_vazias', 0),
            },
        })
    except Exception as exc:
        print(f'[api sincronizar erro] {exc}', flush=True)
        return jsonify({'ok': False, 'erro': str(exc)}), 200


# --------- Backfill via WAHA (igual /painel/importar) ----------

@api.route('/importar', methods=['POST'])
def importar():
    payload = request.get_json(silent=True) or {}
    days = int(payload.get('days', 30))
    threading.Thread(target=import_history, kwargs={'days': days}, daemon=True).start()
    return jsonify({'ok': True})


# --------- Importar .txt criando cliente novo (chat_id sintetico) ----------

def _slugify(s):
    """Slug simples ASCII pra usar em chat_id sintetico."""
    out = []
    for ch in (s or '').lower():
        if ch.isalnum():
            out.append(ch)
        elif ch in (' ', '-', '_'):
            out.append('_')
    slug = ''.join(out).strip('_') or 'novo'
    # comprime underscores duplicados
    while '__' in slug:
        slug = slug.replace('__', '_')
    return slug[:40]


@api.route('/importar-arquivo', methods=['POST'])
def importar_arquivo_api():
    """Importa um .txt do WhatsApp criando (ou atualizando) um chat.

    Aceita multipart: arquivo (file) + chat_name (str) + chat_id (opcional).
    Se chat_id nao vier, gera 'import:<slug(chat_name)>@g.us'. Dedup nativo via
    message_id hash + INSERT OR IGNORE.
    """
    arquivo = request.files.get('arquivo')
    chat_name = (request.form.get('chat_name') or '').strip()
    chat_id = (request.form.get('chat_id') or '').strip()

    if not arquivo:
        return jsonify({'ok': False, 'erro': 'arquivo faltando'}), 200
    if not (arquivo.filename or '').lower().endswith('.txt'):
        return jsonify({'ok': False, 'erro': 'precisa ser .txt'}), 200
    if not chat_name and not chat_id:
        return jsonify({'ok': False, 'erro': 'informe chat_name ou chat_id'}), 200

    if not chat_id:
        chat_id = f'import:{_slugify(chat_name)}@g.us'
    if not chat_name:
        chat_name = chat_id

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    nome_seguro = ''.join(c for c in (arquivo.filename or 'chat.txt')
                          if c.isalnum() or c in '._-') or 'chat.txt'
    caminho = os.path.join(UPLOAD_DIR, f'novo_{int(time.time())}_{nome_seguro}')
    arquivo.save(caminho)

    try:
        resultado = importar_arquivo(caminho, chat_id=chat_id, chat_name=chat_name) or {}
        return jsonify({
            'ok': True,
            'data': {
                'chat_id': chat_id,
                'chat_name': chat_name,
                'novas': resultado.get('salvas', 0),
                'total_linhas': resultado.get('total_linhas', 0),
                'puladas_sistema': resultado.get('puladas_sistema', 0),
                'puladas_vazias': resultado.get('puladas_vazias', 0),
            },
        })
    except Exception as exc:
        print(f'[api importar-arquivo erro] {exc}', flush=True)
        return jsonify({'ok': False, 'erro': str(exc)}), 200
