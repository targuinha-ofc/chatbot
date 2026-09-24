# Campo Aberto

Agente de IA com memória persistente usando Node.js, Express, Gemini e MongoDB Atlas.

## Configuração

1. Instale as dependências:

   ```bash
   npm install
   ```

2. Copie `.env.example` para `.env` e preencha `GEMINI_API_KEY` e `MONGO_URI`.

3. Inicie o servidor:

   ```bash
   npm start
   ```

Abra `http://localhost:3000` no navegador.

## Endpoints

- `GET /api/status`: verifica se o servidor está operacional.
- `POST /api/chat`: recebe `{ "pergunta": "..." }` e retorna uma resposta com contexto.
- `DELETE /api/chat/limpar`: apaga todo o histórico salvo no MongoDB.

O frontend renderiza as respostas Markdown com `marked.js` e sanitiza o HTML antes de exibi-lo.