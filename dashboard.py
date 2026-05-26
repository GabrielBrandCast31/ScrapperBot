import time
from datetime import datetime

from flask import Blueprint, render_template, request, redirect, url_for

from services.database import Database
from services.monitor import SLA_SECONDS


dashboard = Blueprint('dashboard', __name__)


def _fmt_abs(ts):
    if not ts:
        return '—'
    return datetime.fromtimestamp(ts).strftime('%d/%m/%Y %H:%M')


def _fmt_rel(ts, now):
    if not ts:
        return '—'
    secs = max(0, now - ts)
    horas = secs // 3600
    minutos = (secs % 3600) // 60
    if horas >= 24:
        return f'há {horas // 24}d'
    if horas >= 1:
        return f'há {horas}h'
    return f'há {minutos}min'


def _enrich_demands(demands, now):
    for d in demands:
        ts = d.get('timestamp')
        d['quando'] = _fmt_abs(ts)
        d['rel'] = _fmt_rel(ts, now)
        d['atrasada'] = bool(
            d.get('status') == 'open' and ts and (now - ts) >= SLA_SECONDS
        )
    return demands


@dashboard.route('/painel')
def painel():
    status = request.args.get('status', 'abertas')
    now = int(time.time())

    database = Database()
    todas = _enrich_demands(database.get_demands(), now)

    stats = {
        'abertas': sum(1 for d in todas if d['status'] == 'open'),
        'atrasadas': sum(1 for d in todas if d['atrasada']),
        'respondidas': sum(1 for d in todas if d['status'] == 'answered'),
        'total': len(todas),
    }

    if status == 'abertas':
        lista = [d for d in todas if d['status'] == 'open']
    elif status == 'atrasadas':
        lista = [d for d in todas if d['atrasada']]
    elif status == 'respondidas':
        lista = [d for d in todas if d['status'] == 'answered']
    else:
        status = 'todas'
        lista = todas

    grupos = database.get_groups()
    for g in grupos:
        g['ultima'] = _fmt_rel(g.get('last_ts'), now)

    return render_template(
        'painel.html',
        demandas=lista,
        stats=stats,
        status=status,
        grupos=grupos,
    )


@dashboard.route('/painel/grupo')
def grupo():
    chat_id = request.args.get('chat_id', '')
    now = int(time.time())

    database = Database()
    mensagens = database.get_messages(chat_id, limit=200)
    for m in mensagens:
        m['quando'] = _fmt_abs(m.get('timestamp'))

    nome = mensagens[0]['chat_name'] if mensagens else chat_id
    return render_template(
        'grupo.html',
        mensagens=mensagens,
        nome=nome,
        chat_id=chat_id,
    )


@dashboard.route('/painel/demanda/<int:demand_id>/resolver', methods=['POST'])
def resolver(demand_id):
    Database().resolve_demand(demand_id)
    return redirect(request.referrer or url_for('dashboard.painel'))
