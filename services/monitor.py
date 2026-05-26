import time

from services.waha import Waha
from services.database import Database


SLA_SECONDS = 4 * 3600                 # demanda vira "atrasada" apos 4h sem resposta
ALERT_CHAT_ID = '553131914514@c.us'    # numero que recebe os alertas


def scan_overdue_demands():
    """Varre demandas abertas ha mais de SLA_SECONDS e alerta o numero configurado.

    Retorna a quantidade de demandas alertadas nesta varredura.
    """
    database = Database()
    overdue = database.get_overdue_demands(SLA_SECONDS)

    if not overdue:
        print('[SCAN] nenhuma demanda atrasada', flush=True)
        return 0

    now = int(time.time())
    linhas = ['*Demandas atrasadas (mais de 4h sem resposta):*', '']
    for demand in overdue:
        horas = (now - (demand['timestamp'] or now)) // 3600
        linhas.append(
            f"- *{demand['chat_name']}* ({demand['sender_name']}): "
            f"{demand['summary']} ({horas}h sem resposta)"
        )
    mensagem = '\n'.join(linhas)

    waha = Waha()
    waha.send_message(chat_id=ALERT_CHAT_ID, message=mensagem)
    database.mark_demands_alerted([demand['id'] for demand in overdue])

    print(f'[SCAN] {len(overdue)} demanda(s) atrasada(s) alertada(s)', flush=True)
    return len(overdue)
