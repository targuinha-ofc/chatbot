# Relatório Técnico de Auditoria Cloud

## 1. Identificação

| Campo | Informação |
| --- | --- |
| Projeto | Campo Aberto |
| Responsável | **Preencher nome** |
| Repositório GitHub | **Preencher link** |
| Frontend/Backend em produção | **Preencher links** |
| Data da auditoria | 24/09/2026 |

## 2. Escopo

Esta auditoria revisou o backend Express, a autenticação JWT, a memória no MongoDB Atlas, o Function Calling de clima, o upload multimodal e o novo endpoint público de saúde.

## 3. Health Check

Foi criada a rota pública:

```http
GET /api/health
```

Resposta esperada:

```json
{
  "status": "ok",
  "servico": "campo-aberto",
  "timestamp": "..."
}
```

O endpoint foi validado localmente na porta 3001 e retornou HTTP 200. A rota não usa JWT, portanto pode ser cadastrada no UptimeRobot. O monitor externo ainda não foi configurado nesta máquina.

O frontend consulta `/api/health` ao carregar e mostra `Sistema operacional` ou `API offline` no indicador visual do chat.

## 4. Matriz de Testes

| Teste | Resultado | Evidência/observação |
| --- | --- | --- |
| Health check público | **PASSOU** | HTTP 200 com JSON `status: ok`. |
| Status existente | **PASSOU** | `GET /api/status` manteve HTTP 200. |
| Cadastro e login JWT | **PASSOU** | Cadastro HTTP 201 e login HTTP 200 com token. |
| Chat sem autorização | **PASSOU** | HTTP 401 com `Token de acesso ausente`. |
| Senha protegida | **PASSOU** | Hash bcrypt confirmado no MongoDB sem expor o valor. |
| Histórico autenticado | **PASSOU** | Endpoint retornou HTTP 200 para usuário autenticado. |
| Memória isolada por usuário | **PASSOU** | Consultas usam `usuarioId` do JWT. |
| Upload de PDF | **PASSOU** | Arquivo rejeitado com HTTP 400. |
| Upload de imagem para Cloudinary | **NÃO EXECUTADO** | Depende de imagem real e credenciais Cloudinary válidas no ambiente de teste. |
| Análise Gemini Vision | **NÃO EXECUTADO** | Depende de upload bem-sucedido e quota disponível do modelo. |
| Function Calling de clima | **PARCIAL** | Código e declaração testados estruturalmente; chamada externa depende de quota/chave OpenWeather. |
| Logout e `localStorage` | **IMPLEMENTADO** | Fluxo está no frontend; teste visual automático foi limitado pelo navegador integrado. |

## 5. Bugs Encontrados e Corrigidos

### Histórico incompatível com Gemini

O Gemini recusou o histórico porque documentos Mongoose carregavam `_id` dentro de `parts` e, em outro cenário, o primeiro item era `model` em vez de `user`. O controller passou a normalizar o histórico, remover IDs internos, descartar respostas iniciais e combinar papéis repetidos.

### Instância antiga na porta local

Durante a auditoria, uma instância antiga do `server.js` permaneceu ocupando a porta 3000 e não possuía as rotas novas. O processo foi encerrado e o backend atual foi validado em uma porta livre. Em produção, o deploy deve ser reiniciado após cada atualização.

### Quota do Gemini

O plano gratuito retornou HTTP 429 depois do limite de requisições. O backend passou a diferenciar 429 e 503 de erros internos, e o relatório registra a limitação em vez de mascará-la.

## 6. Segurança e Integridade

- `.env` e `node_modules` permanecem ignorados pelo Git.
- `.env.example` lista as variáveis sem valores reais.
- Chat, histórico, limpeza e visão exigem `Authorization: Bearer <TOKEN>`.
- Senhas são armazenadas com bcrypt.
- Conteúdo Markdown é sanitizado no frontend com DOMPurify.
- Upload aceita apenas imagens de até 5 MB.

## 7. Disponibilidade e Próximos Passos

1. Configurar um monitor HTTP no UptimeRobot para `/api/health` a cada 14 minutos.
2. Cadastrar no Render todas as variáveis de `.env.example`.
3. Preencher os links de GitHub, frontend e backend no cabeçalho.
4. Repetir os testes multimodais com uma imagem real e registrar um print do Cloudinary.
5. Gerar PDF deste relatório, se a entrega exigir o formato PDF.