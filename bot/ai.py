# =============================================================================
# Chat IA do painel.
#
# DataChatBot.ask(historia, chat_context=None) -> resposta textual
#  - history: lista [{role:'user'|'assistant', content:'...'}, ...]
#  - chat_context: texto da conversa em analise (quando o usuario abriu a
#    pagina via botao "Analisar com IA" de um cliente especifico).
#
# Tem ferramentas (function calling) para o caso geral (sem conversa
# especifica em contexto): busca textual em mensagens, listagem de clientes
# e panorama de volume.
# =============================================================================

import json
import os

import requests
from dotenv import load_dotenv
from openai import OpenAI

from services.database import Database


load_dotenv()


# --- Fallback Gemini (quando a OpenAI da auth/quota/rate error) ---

def _gemini_responder(system_prompt, history):
    """Chama o Gemini direto via REST. Retorna a resposta em texto, ou None se nao deu."""
    key = os.environ.get('GEMINI_API_KEY')
    if not key:
        return None

    contents = []
    for m in history:
        role = 'user' if m['role'] == 'user' else 'model'
        contents.append({'role': role, 'parts': [{'text': m['content']}]})

    body = {
        'contents': contents,
        'systemInstruction': {'parts': [{'text': system_prompt}]},
        'generationConfig': {'temperature': 0.2},
    }
    url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'

    # Tenta com API-key na query string; se nao, com Bearer (caso seja OAuth token).
    for tentativa in (
        {'url': f'{url}?key={key}', 'headers': {}},
        {'url': url, 'headers': {'Authorization': f'Bearer {key}'}},
    ):
        try:
            r = requests.post(tentativa['url'], json=body, headers=tentativa['headers'], timeout=60)
            if r.status_code == 200:
                data = r.json()
                cand = (data.get('candidates') or [{}])[0]
                parts = ((cand.get('content') or {}).get('parts') or [{}])
                texto = parts[0].get('text', '').strip()
                if texto:
                    return texto
            else:
                print(f'[Gemini fallback] HTTP {r.status_code}: {r.text[:200]}', flush=True)
        except Exception as exc:
            print(f'[Gemini fallback erro] {exc}', flush=True)
    return None


def _eh_erro_de_chave_openai(exc):
    msg = str(exc).lower()
    return any(k in msg for k in (
        'quota', 'rate', 'authenticat', 'insufficient',
        'expired', 'invalid_api_key', '401', '429',
    ))


CHAT_PROMPT_BASE = '''Voce e um assistente analitico da agencia BrandCast (marketing
digital). Voce ajuda o Gabriel a entender e responder perguntas sobre as
conversas dos clientes que estao armazenadas no banco.

Voce TEM ferramentas para buscar e listar dados. Use sempre que precisar de
numeros reais. Nao invente.

Quando o usuario te enviar UMA CONVERSA ESPECIFICA como contexto, foque a
analise nela: leia, resuma, encontre o que ele pediu, e cite trechos
quando ajudar. Voce nao precisa usar ferramentas se a resposta esta na
propria conversa.

Quando NAO ha conversa em contexto, voce pode usar as ferramentas pra
varrer todo o banco (todos os clientes).

Responda em portugues do Brasil, claro e direto, com bullets quando ajudar.'''


CHAT_TOOLS = [
    {
        'type': 'function',
        'function': {
            'name': 'panorama_geral',
            'description': 'Numeros gerais: total de mensagens, ultimas 24h, total de clientes/grupos monitorados.',
            'parameters': {'type': 'object', 'properties': {}},
        },
    },
    {
        'type': 'function',
        'function': {
            'name': 'listar_clientes',
            'description': 'Lista os grupos/clientes monitorados com contagem de mensagens e ultima atividade.',
            'parameters': {
                'type': 'object',
                'properties': {
                    'limite': {'type': 'integer', 'default': 30},
                },
            },
        },
    },
    {
        'type': 'function',
        'function': {
            'name': 'buscar_mensagens',
            'description': 'Busca por substring em mensagens. Filtra opcionalmente por nome de cliente/grupo.',
            'parameters': {
                'type': 'object',
                'properties': {
                    'termo': {'type': 'string'},
                    'cliente': {'type': 'string'},
                    'limite': {'type': 'integer', 'default': 20},
                },
                'required': ['termo'],
            },
        },
    },
]


def _tool_panorama_geral():
    db = Database()
    msgs = db.contagem_mensagens()
    grupos = [g for g in db.get_groups() if '@g.us' in g['chat_id'] or g['chat_id'].startswith('import:')]
    return {
        'mensagens_total': msgs['total'],
        'mensagens_ultimas_24h': msgs['ultimas_24h'],
        'clientes_monitorados': len(grupos),
    }


def _tool_listar_clientes(limite=30):
    db = Database()
    import time as _t
    now = int(_t.time())
    grupos = [g for g in db.get_groups() if '@g.us' in g['chat_id'] or g['chat_id'].startswith('import:')]
    grupos = grupos[:limite]
    out = []
    for g in grupos:
        ultima = g.get('last_ts')
        idade_dias = ((now - ultima) // 86400) if ultima else None
        out.append({
            'cliente': g['chat_name'] or g['chat_id'],
            'mensagens': g['total'],
            'dias_desde_ultima_msg': idade_dias,
        })
    return out


def _tool_buscar_mensagens(termo, cliente=None, limite=20):
    return Database().buscar_mensagens(termo, chat_name=cliente, limite=limite)


_TOOL_DISPATCH = {
    'panorama_geral': _tool_panorama_geral,
    'listar_clientes': _tool_listar_clientes,
    'buscar_mensagens': _tool_buscar_mensagens,
}


class DataChatBot:
    """Chat com function calling. Aceita opcionalmente uma conversa em contexto."""

    def __init__(self):
        self.__client = OpenAI()

    def ask(self, history, chat_context=None, chat_name=None):
        prompt = CHAT_PROMPT_BASE
        if chat_context:
            cabecalho = f'\n\n---\nCONVERSA EM ANALISE: {chat_name or "(sem nome)"}\n'
            cabecalho += 'Abaixo segue o transcript das mensagens dessa conversa, em ordem cronologica.\n\n'
            prompt = prompt + cabecalho + chat_context

        # 1) Tenta OpenAI com function calling (caminho principal)
        try:
            return self._ask_openai(prompt, history)
        except Exception as exc:
            if not _eh_erro_de_chave_openai(exc):
                raise
            print(f'[Chat IA] OpenAI falhou ({exc.__class__.__name__}); usando Gemini', flush=True)

        # 2) Fallback Gemini (sem ferramentas — so resposta em texto)
        resposta = _gemini_responder(prompt, history)
        if resposta:
            return f'_(via Gemini)_\n\n{resposta}'
        return 'OpenAI indisponivel e o fallback Gemini tambem nao respondeu. Verifique as chaves no .env.'

    def _ask_openai(self, prompt, history):
        messages = [{'role': 'system', 'content': prompt}]
        messages.extend(history)

        for _ in range(6):
            r = self.__client.chat.completions.create(
                model='gpt-4o-mini',
                messages=messages,
                tools=CHAT_TOOLS,
                temperature=0.2,
            )
            msg = r.choices[0].message
            if not msg.tool_calls:
                return msg.content or '(sem resposta)'

            messages.append({
                'role': 'assistant',
                'content': msg.content,
                'tool_calls': [
                    {
                        'id': tc.id,
                        'type': 'function',
                        'function': {'name': tc.function.name, 'arguments': tc.function.arguments},
                    }
                    for tc in msg.tool_calls
                ],
            })

            for tc in msg.tool_calls:
                fn = _TOOL_DISPATCH.get(tc.function.name)
                try:
                    args = json.loads(tc.function.arguments or '{}')
                    resultado = fn(**args) if fn else {'erro': 'ferramenta desconhecida'}
                except Exception as exc:
                    resultado = {'erro': str(exc)}
                messages.append({
                    'role': 'tool',
                    'tool_call_id': tc.id,
                    'content': json.dumps(resultado, ensure_ascii=False, default=str),
                })

        return 'Nao consegui concluir no limite de tentativas.'
