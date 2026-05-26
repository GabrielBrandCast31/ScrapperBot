# === ETAPA 5: classificacao de demandas via OpenAI ===
# Para cada mensagem de cliente, decide se e uma DEMANDA (pedido que espera
# resposta/acao da equipe) e gera um resumo curto do que foi pedido.

import json

from dotenv import load_dotenv

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI


load_dotenv()


CLASSIFY_PROMPT = '''Voce analisa mensagens enviadas por CLIENTES em grupos de WhatsApp de uma agencia.

Sua tarefa: decidir se a mensagem e uma DEMANDA, ou seja, um pedido, solicitacao,
duvida ou cobranca que espera uma resposta ou acao da equipe da agencia.

NAO sao demandas: agradecimentos, "ok", "perfeito", saudacoes, elogios,
confirmacoes e conversa casual que nao exigem acao.

Responda SOMENTE em JSON, com exatamente estas chaves:
- "is_demand": true ou false
- "resumo": uma frase curta (em portugues) do que o cliente pediu; string vazia se nao for demanda
'''


class AIBot:

    def __init__(self):
        self.__chat = ChatOpenAI(
            model='gpt-4o-mini',
            temperature=0,
            model_kwargs={'response_format': {'type': 'json_object'}},
        )

    def classify_demand(self, message):
        messages = [
            SystemMessage(content=CLASSIFY_PROMPT),
            HumanMessage(content=message),
        ]
        try:
            response = self.__chat.invoke(messages)
            data = json.loads(response.content)
            return {
                'is_demand': bool(data.get('is_demand', False)),
                'summary': (data.get('resumo') or data.get('summary') or '').strip(),
            }
        except Exception as exc:
            print(f'[AIBot classify erro] {exc}', flush=True)
            return {'is_demand': False, 'summary': ''}
