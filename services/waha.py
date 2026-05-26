import requests


class Waha:

    def __init__(self):
        self.__api_url = 'http://waha:3000'

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
