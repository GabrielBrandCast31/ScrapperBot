"""Classificacao em massa de SENTIMENTO nas mensagens de cliente.

Substitui o antigo classificador de demanda. Cada mensagem de cliente
(texto real, nao midia) ganha um sentiment (negative/neutral/positive/
frustrated) e um sentiment_score em [-1, +1].
"""

from concurrent.futures import ThreadPoolExecutor
from threading import Lock

from bot.ai import SentimentBot
from services.database import Database


def classify_sentiments_history(max_workers=8):
    """Analisa o sentimento de todas as mensagens de cliente ainda sem sentiment.

    Retorna {'mensagens': N, 'erros': N} ao final.
    """
    database = Database()
    bot = SentimentBot()  # OpenAI client e thread-safe (HTTP)

    pendentes = database.messages_pending_sentiment()
    total = len(pendentes)
    print(f'[SENT-BATCH] {total} mensagens a analisar', flush=True)
    if not total:
        return {'mensagens': 0, 'erros': 0}

    lock = Lock()
    contador = {'feitos': 0, 'erros': 0}

    def analisar(msg):
        try:
            r = bot.classify(msg['body'])
            database.update_sentiment(
                message_id=msg['message_id'],
                sentiment=r['sentiment'],
                score=r['score'],
            )
        except Exception as exc:
            print(f"[SENT-BATCH erro {msg.get('message_id')}] {exc}", flush=True)
            with lock:
                contador['erros'] += 1
        finally:
            with lock:
                contador['feitos'] += 1
                if contador['feitos'] % 50 == 0 or contador['feitos'] == total:
                    print(
                        f"[SENT-BATCH] progresso: {contador['feitos']}/{total} "
                        f"({contador['erros']} erros)",
                        flush=True,
                    )

    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        list(pool.map(analisar, pendentes))

    print(
        f"[SENT-BATCH] concluido: {contador['feitos']} analisadas, "
        f"{contador['erros']} erros",
        flush=True,
    )
    return {'mensagens': contador['feitos'], 'erros': contador['erros']}
