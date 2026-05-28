import re

# Marcadores para mensagens de midia (nao baixamos o arquivo, so registramos no historico).
# Compartilhado entre o webhook (main.py) e o importador de historico (importer.py).

MEDIA_LABELS = {
    'image': '[imagem]',
    'video': '[video]',
    'audio': '[audio]',
    'ptt': '[audio]',
    'document': '[documento]',
    'sticker': '[figurinha]',
    'location': '[localizacao]',
    'vcard': '[contato]',
}


_PHONE_PAT = re.compile(r'^(\d{8,15})@(c\.us|s\.whatsapp\.net)$')


def extract_phone(*candidates):
    """Extrai um telefone real (so digitos, formato internacional) de algum candidato.

    Aceita varios formatos:
      - "5531999999999@c.us"            -> "5531999999999"
      - "5531999999999@s.whatsapp.net"  -> "5531999999999"
      - "59894057148418@lid"            -> None (LID e ID anonimo, nao expoe numero)
      - dict tipo {"user": "...", "server": "c.us"} -> idem
      - None / string vazia / outros    -> None

    Devolve o PRIMEIRO match valido nos candidatos, ou None.
    """
    for cand in candidates:
        if not cand:
            continue
        # Aceita dicts com '_serialized' (formato WAHA)
        if isinstance(cand, dict):
            cand = cand.get('_serialized') or (
                f"{cand.get('user','')}@{cand.get('server','')}"
                if cand.get('user') else None
            )
        if not isinstance(cand, str):
            continue
        m = _PHONE_PAT.match(cand)
        if m:
            return m.group(1)
    return None
