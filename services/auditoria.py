# =============================================================================
# Auditoria IA horaria.
#
# A cada 1h, para cada chat que recebeu mensagem na ultima hora, monta um
# transcript curto, manda pro gpt-4o-mini e salva um resumo de 3-5 linhas
# em hourly_summaries. Usuario ve no painel /painel/auditoria.
# =============================================================================

import os
import time

from openai import OpenAI

from services.database import Database


AUDIT_PROMPT = '''Voce eh um analista da agencia BrandCast (marketing digital).
Recebe um trecho de conversa entre UM cliente e a equipe nas ultimas horas.

Sua tarefa: produzir um resumo curto e objetivo, em portugues do Brasil, com
3 a 5 linhas, cobrindo:
- o que o cliente pediu ou levantou
- o que a equipe respondeu / fez
- o que ficou em aberto (pedidos sem resposta, prazos prometidos, etc.)

Se nao houve troca relevante (so audio sem texto, so 'ok', figurinha, etc.),
escreva apenas: "Sem demanda relevante na janela." e cite brevemente o que rolou.

Nao invente. Nao use formatacao markdown pesada. Direto ao ponto.'''


def _transcript(mensagens, limite_chars_msg=300):
    """Monta transcript ASCII a partir das mensagens (ja em ordem ASC)."""
    linhas = []
    for m in mensagens:
        quem = 'Equipe' if m.get('from_me') else (m.get('sender_name') or 'Cliente')
        when = m.get('quando') or ''
        body = (m.get('body') or '').strip()
        if len(body) > limite_chars_msg:
            body = body[:limite_chars_msg] + '…'
        linhas.append(f'[{when}] {quem}: {body}')
    return '\n'.join(linhas)


def _resumir(client, chat_name, mensagens):
    transcript = _transcript(mensagens)
    r = client.chat.completions.create(
        model='gpt-4o-mini',
        messages=[
            {'role': 'system', 'content': AUDIT_PROMPT},
            {'role': 'user', 'content': f'Cliente: {chat_name}\n\nConversa:\n{transcript}'},
        ],
        temperature=0.3,
    )
    return (r.choices[0].message.content or '').strip()


def gerar_auditoria(periodo_horas=1, min_mensagens=2):
    """Gera resumo das ultimas `periodo_horas` para cada chat ativo.

    Retorna numero de resumos salvos.
    """
    db = Database()
    fim_ts = int(time.time())
    inicio_ts = fim_ts - int(periodo_horas * 3600)

    chats_ativos = db.chats_com_mensagens_recentes(inicio_ts)
    if not chats_ativos:
        print('[AUDIT] sem chats ativos na janela', flush=True)
        return 0

    if not os.environ.get('OPENAI_API_KEY'):
        print('[AUDIT] OPENAI_API_KEY ausente — auditoria pulada', flush=True)
        return 0

    client = OpenAI()
    salvos = 0
    for chat in chats_ativos:
        msgs = db.get_messages_no_periodo(chat['chat_id'], inicio_ts, fim_ts)
        if len(msgs) < min_mensagens:
            continue
        try:
            resumo = _resumir(client, chat['chat_name'] or chat['chat_id'], msgs)
        except Exception as exc:
            print(f'[AUDIT erro] {chat["chat_name"]}: {exc}', flush=True)
            continue
        if not resumo:
            continue
        db.save_hourly_summary(
            chat_id=chat['chat_id'],
            chat_name=chat['chat_name'],
            inicio_ts=inicio_ts,
            fim_ts=fim_ts,
            qtd_msgs=len(msgs),
            resumo=resumo,
        )
        salvos += 1
        print(f'[AUDIT] {chat["chat_name"]}: {len(msgs)} msgs -> resumo salvo', flush=True)

    print(f'[AUDIT] concluido: {salvos} resumos gerados', flush=True)
    return salvos
