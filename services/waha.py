import requests


class Waha:

    # cache de nomes de grupo/chat (id -> nome), compartilhado entre instancias
    _chat_names = {}

    def __init__(self):
        self.__api_url = 'http://waha:3000'

    def get_session_status(self):
        """Retorna o status da sessao 'default', ou None se o WAHA nao respondeu."""
        try:
            url = f'{self.__api_url}/api/sessions/default'
            response = requests.get(
                url=url,
                headers={'X-Api-Key': 'minha-chave-secreta'},
                timeout=10,
            )
            if response.status_code == 200:
                return response.json().get('status')
        except Exception:
            pass
        return None

    def start_session(self):
        try:
            url = f'{self.__api_url}/api/sessions/default/start'
            requests.post(
                url=url,
                headers={'X-Api-Key': 'minha-chave-secreta'},
                timeout=20,
            )
        except Exception as exc:
            print(f'[WAHA start_session] erro: {exc}', flush=True)

    def ensure_session_started(self):
        """Se a sessao estiver parada/falha, inicia de novo (auth ja persistida no volume)."""
        status = self.get_session_status()
        if status in ('STOPPED', 'FAILED'):
            print(f'[WAHA] sessao {status} -> iniciando automaticamente', flush=True)
            self.start_session()
        return status

    def list_chats(self):
        """Lista todas as conversas (grupos e individuais) conhecidas pelo WAHA."""
        try:
            url = f'{self.__api_url}/api/default/chats?limit=500'
            response = requests.get(
                url=url,
                headers={'X-Api-Key': 'minha-chave-secreta'},
                timeout=30,
            )
            if response.status_code == 200:
                return response.json()
        except Exception as exc:
            print(f'[WAHA list_chats] erro: {exc}', flush=True)
        return []

    def get_chat_name(self, chat_id):
        # popula o cache uma unica vez buscando a lista de chats do WAHA
        if not Waha._chat_names:
            try:
                url = f'{self.__api_url}/api/default/chats?limit=500'
                headers = {'X-Api-Key': 'minha-chave-secreta'}
                response = requests.get(url=url, headers=headers, timeout=15)
                for chat in response.json():
                    cid = chat.get('id')
                    if isinstance(cid, dict):
                        cid = cid.get('_serialized')
                    if cid:
                        Waha._chat_names[cid] = chat.get('name')
            except Exception as exc:
                print(f'[WAHA get_chat_name] erro: {exc}', flush=True)

        return Waha._chat_names.get(chat_id) or chat_id

    def send_message(self, chat_id, message):
        url = f'{self.__api_url}/api/sendText'
        headers = {
            'Content-Type': 'application/json',
            'X-Api-Key': 'minha-chave-secreta',
        }
        payload = {
            'session': 'default',
            'chatId': chat_id,
            'text': message,
        }
        response = requests.post(
            url=url,
            json=payload,
            headers=headers,
        )
        print(f'[WAHA sendText] HTTP {response.status_code} -> {chat_id}', flush=True)
        return response

    def get_history_messages(self, chat_id, limit):
        url = f'{self.__api_url}/api/default/chats/{chat_id}/messages?limit={limit}&downloadMedia=false'
        headers = {
            'Content-Type': 'application/json',
            'X-Api-Key': 'minha-chave-secreta',
        }
        response = requests.get(
            url=url,
            headers=headers,
        )
        return response.json()

    def start_typing(self, chat_id):
        url = f'{self.__api_url}/api/startTyping'
        headers = {
            'Content-Type': 'application/json',
            'X-Api-Key': 'minha-chave-secreta',
        }
        payload = {
            'session': 'default',
            'chatId': chat_id,
        }
        requests.post(
            url=url,
            json=payload,
            headers=headers,
        )

    def stop_typing(self, chat_id):
        url = f'{self.__api_url}/api/stopTyping'
        headers = {
            'Content-Type': 'application/json',
            'X-Api-Key': 'minha-chave-secreta',
        }
        payload = {
            'session': 'default',
            'chatId': chat_id,
        }
        requests.post(
            url=url,
            json=payload,
            headers=headers,
        )
