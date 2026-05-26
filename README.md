# WPP Bot IA

Este projeto implementa um chatbot inteligente para WhatsApp, utilizando Flask, LangChain, Groq, ChromaDB e Docker. O bot responde perguntas sobre o conteúdo do material "Aula 10 - Interface gráfica com Flet II", utilizando busca vetorial e IA generativa. que nada mais é do que um pdf para servir como fonte de conhecimento, você pode inserir qualquer pdf que sirva como base de conhecimento.

---

## Estrutura do Projeto

```
wpp_bot_ia/
├── bot/
│   └── ai.py
├── services/
│   └── waha.py
├── rag/
│   └── rag.py
├── chroma_data/
├── main.py
├── requirements.txt
├── Dockerfile.api
├── docker-compose.yml
└── .env
```

---

## Principais Componentes

- **Flask API**: Recebe webhooks do WhatsApp e responde usando IA.
- **AIBot**: Classe que integra LangChain, Groq e busca vetorial.
- **ChromaDB**: Banco de dados vetorial para busca de contexto.
- **RAG (Retrieval-Augmented Generation)**: Script para indexar o PDF do material.
- **Docker**: Orquestração dos serviços e ambiente isolado.

---

## Como Executar

1. **Clone o repositório**
   ```sh
   git clone https://github.com/GabrielSouto19/AgenteWPPAutomation.git
   cd wpp_bot_ia
   ```

2. **Adicione o PDF do material**
   - Coloque o arquivo `Aula 10 _ Interface gráfica com Flet II.pdf` em `rag/data/`.

3. **Configure variáveis de ambiente**
   - Crie um arquivo `.env` com suas chaves de API (Groq, etc).

4. **Construa e rode os containers**
   ```sh
   docker-compose up --build
   ```

5. **Indexe o material no banco vetorial**
   ```sh
   docker exec -it wpp_bot_api python rag/rag.py
   ```

6. **Envie mensagens para o bot**
   - O serviço Waha deve estar configurado para enviar webhooks para `http://api:5000/chatbot/webhook/`.

---

## Personalização

- **Modelo Groq**: Altere o modelo em `bot/ai.py` conforme disponibilidade.
- **Material de referência**: Substitua o PDF em `rag/data/` para treinar o bot com outros conteúdos.

---

## Requisitos

- Docker e Docker Compose
- Chaves de API para Groq e HuggingFace

---

## Observações

- O bot responde apenas perguntas baseadas no material indexado.
- Perguntas fora do escopo são rejeitadas conforme regras do sistema.

---

## Licença

Este projeto é apenas para fins