# Campo Aberto

Agente de IA com memória persistente usando Node.js, Express, Gemini e MongoDB Atlas.

## Estrutura

- `frontend/`: interface estática (`index.html`, `app.js` e `styles.css`).
- `backend/`: API Express, autenticação, chat, modelos e integração com MongoDB.

## Deploy separado

### Backend

Configure a raiz do serviço como `backend/`, instale as dependências e use `npm start`. Defina as variáveis de ambiente listadas abaixo. O backend não serve mais os arquivos estáticos do frontend.

### Frontend

Configure a raiz do projeto como `frontend/` em um serviço de hospedagem estática. O endereço da API é definido no início de `frontend/app.js` pela constante `apiBaseUrl`.

## Configuração

1. Entre na pasta do backend:

   ```bash
   cd backend
   ```

2. Instale as dependências:

   ```bash
   npm install
   ```

3. Copie `.env.example` para `.env` e preencha `GEMINI_API_KEY`, `MONGO_URI`, `WEATHER_API_KEY`, `JWT_SECRET` e as três variáveis do Cloudinary.

4. Inicie o servidor:

   ```bash
   npm start
   ```

Abra o frontend separadamente no navegador. A API ficará disponível em `http://localhost:3000`.

## Endpoints

- `GET /api/status`: verifica se o servidor está operacional.
- `GET /api/health`: health check público para Render, balanceadores e UptimeRobot.
- `POST /api/chat`: recebe `{ "pergunta": "..." }` e retorna uma resposta com contexto.
- `GET /api/chat/historico`: retorna o histórico autenticado, incluindo URLs das imagens.
- `POST /api/chat/vision`: recebe `multipart/form-data` com `imagem` e `prompt`.
- `DELETE /api/chat/limpar`: apaga todo o histórico salvo no MongoDB.

### Autenticação

- `POST /api/auth/register`: cria um usuário e armazena a senha com bcrypt.
- `POST /api/auth/login`: valida as credenciais e retorna um JWT válido por 7 dias.
- `POST /api/chat` e `DELETE /api/chat/limpar`: exigem `Authorization: Bearer <TOKEN>`.

O frontend renderiza as respostas Markdown com `marked.js` e sanitiza o HTML antes de exibi-lo.

## Function Calling

Quando a pergunta envolve tempo, temperatura ou chuva, o Gemini pode chamar automaticamente a ferramenta `buscarClimaTempoReal`. O backend consulta a OpenWeatherMap e devolve a temperatura, sensação térmica, descrição, umidade e vento para que o Gemini produza a resposta final.

Para ativar essa ferramenta, crie uma chave gratuita em [OpenWeatherMap](https://openweathermap.org/) e configure `WEATHER_API_KEY` no `.env` local e nas variáveis do Render.

## Imagens e Cloudinary

Imagens de até 5 MB são recebidas pelo Multer em memória, enviadas para o Cloudinary e analisadas pelo Gemini Vision. PDFs, arquivos não-imagem e arquivos acima do limite são rejeitados com HTTP 400. A URL segura retornada pelo Cloudinary é salva no histórico do usuário.