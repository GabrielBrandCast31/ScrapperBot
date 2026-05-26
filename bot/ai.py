# === ETAPA 3: assistente geral via OpenAI (sem RAG por enquanto) ===
# O RAG (busca em PDF) sera adicionado numa etapa futura, quando houver
# um PDF indexado em rag/data/ e chroma_data populado.

from dotenv import load_dotenv

from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from langchain_openai import ChatOpenAI


load_dotenv()


SYSTEM_PROMPT = '''Voce e um assistente virtual amigavel que conversa pelo WhatsApp.
Responda sempre em portugues do Brasil, de forma clara, educada e objetiva.
Mantenha as respostas curtas e adequadas para uma conversa de WhatsApp.'''


class AIBot:

    def __init__(self):
        self.__chat = ChatOpenAI(
            model='gpt-4o-mini',
            temperature=0.7,
        )

    def __build_messages(self, history_messages, question):
        messages = [SystemMessage(content=SYSTEM_PROMPT)]

        if isinstance(history_messages, list):
            ordered = sorted(history_messages, key=lambda m: m.get('timestamp', 0))
            for message in ordered:
                content = (message.get('body') or '').strip()
                # pula notificacoes de sistema (sem corpo) e a propria pergunta atual
                if not content or content == question.strip():
                    continue
                message_class = AIMessage if message.get('fromMe') else HumanMessage
                messages.append(message_class(content=content))

        messages.append(HumanMessage(content=question))
        return messages

    def invoke(self, history_messages, question):
        messages = self.__build_messages(history_messages, question)
        response = self.__chat.invoke(messages)
        return response.content
