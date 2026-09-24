const tokenKey = 'token_saas';
const authScreen = document.getElementById('auth-screen');
const chatApp = document.getElementById('chat-app');
const authForm = document.getElementById('auth-form');
const authName = document.getElementById('auth-name');
const authEmail = document.getElementById('auth-email');
const authPassword = document.getElementById('auth-password');
const nameLabel = document.getElementById('name-label');
const authSubmit = document.getElementById('auth-submit');
const authStatus = document.getElementById('auth-status');
const loginTab = document.getElementById('login-tab');
const registerTab = document.getElementById('register-tab');
const logoutButton = document.getElementById('logout-button');
const form = document.getElementById('chat-form');
const questionInput = document.getElementById('question');
const conversation = document.getElementById('conversation');
const sendButton = document.getElementById('send-button');
const clearButton = document.getElementById('clear-button');
const statusLine = document.getElementById('status-line');
const imageInput = document.getElementById('image-upload');
const attachmentName = document.getElementById('attachment-name');
const healthIndicator = document.getElementById('health-indicator');
const healthLabel = document.getElementById('health-label');
let modoCadastro = false;

verificarSaude();

authForm.addEventListener('submit', autenticar);
loginTab.addEventListener('click', () => definirModoCadastro(false));
registerTab.addEventListener('click', () => definirModoCadastro(true));
logoutButton.addEventListener('click', sair);
form.addEventListener('submit', enviarPergunta);
clearButton.addEventListener('click', limparConversa);
imageInput.addEventListener('change', () => {
    const arquivo = imageInput.files[0];
    attachmentName.textContent = arquivo ? `Imagem anexada: ${arquivo.name}` : '';
    attachmentName.hidden = !arquivo;
});
questionInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        form.requestSubmit();
    }
});

if (localStorage.getItem(tokenKey)) {
    mostrarChat();
}

function definirModoCadastro(cadastro) {
    modoCadastro = cadastro;
    authName.hidden = !cadastro;
    nameLabel.hidden = !cadastro;
    authName.required = cadastro;
    authPassword.autocomplete = cadastro ? 'new-password' : 'current-password';
    authSubmit.textContent = cadastro ? 'Criar conta' : 'Entrar';
    loginTab.classList.toggle('active', !cadastro);
    registerTab.classList.toggle('active', cadastro);
    mostrarStatus('');
}

async function autenticar(event) {
    event.preventDefault();
    mostrarStatus('');
    authSubmit.disabled = true;

    try {
        const endpoint = modoCadastro ? '/api/auth/register' : '/api/auth/login';
        const body = { email: authEmail.value.trim(), senha: authPassword.value };

        if (modoCadastro) body.nome = authName.value.trim();

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const dados = await response.json();

        if (!response.ok) throw new Error(dados.erro || 'Não foi possível autenticar.');

        localStorage.setItem(tokenKey, dados.token);
        authForm.reset();
        mostrarChat();
    } catch (erro) {
        mostrarStatus(erro.message);
    } finally {
        authSubmit.disabled = false;
    }
}

function mostrarChat() {
    authScreen.hidden = true;
    chatApp.hidden = false;
    carregarHistorico();
}

function sair() {
    localStorage.removeItem(tokenKey);
    chatApp.hidden = true;
    authScreen.hidden = false;
    definirModoCadastro(false);
}

async function enviarPergunta(event) {
    event.preventDefault();
    const pergunta = questionInput.value.trim();
    const arquivo = imageInput.files[0];

    if (!pergunta && !arquivo) return;

    const texto = pergunta || 'Analise esta imagem.';
    if (!arquivo) adicionarMensagem('user', texto);
    questionInput.value = '';
    setLoading(true);

    try {
        const body = arquivo ? new FormData() : JSON.stringify({ pergunta: texto });
        if (arquivo) {
            body.append('prompt', texto);
            body.append('imagem', arquivo);
        }
        const response = await fetch(arquivo ? '/api/chat/vision' : '/api/chat', {
            method: 'POST',
            headers: headersAutenticados(!arquivo),
            body
        });
        const dados = await response.json();

        if (response.status === 401) return sair();
        if (!response.ok) throw new Error(dados.erro || 'Não foi possível enviar a pergunta.');

        if (arquivo) adicionarMensagem('user', texto, dados.imagemUrl);
        adicionarMensagem('bot', dados.resposta);
        imageInput.value = '';
        attachmentName.textContent = '';
        attachmentName.hidden = true;
        setStatus('Memória privada sincronizada');
    } catch (erro) {
        adicionarMensagem('bot', `**Erro:** ${erro.message}`);
        setStatus('Não foi possível sincronizar a conversa.', true);
    } finally {
        setLoading(false);
    }
}

async function limparConversa() {
    clearButton.disabled = true;

    try {
        const response = await fetch('/api/chat/limpar', {
            method: 'DELETE',
            headers: headersAutenticados()
        });
        const dados = await response.json();

        if (response.status === 401) return sair();
        if (!response.ok) throw new Error(dados.erro || 'Não foi possível limpar a conversa.');

        conversation.innerHTML = '<div class="welcome-message"><span class="welcome-mark" aria-hidden="true">+</span><h2>Campo limpo.</h2><p>Uma nova conversa pode começar agora.</p></div>';
        imageInput.value = '';
        attachmentName.textContent = '';
        attachmentName.hidden = true;
        setStatus('Memória apagada com sucesso.');
    } catch (erro) {
        setStatus(erro.message, true);
    } finally {
        clearButton.disabled = false;
    }
}

function headersAutenticados(comJson = true) {
    const headers = { Authorization: `Bearer ${localStorage.getItem(tokenKey)}` };
    if (comJson) headers['Content-Type'] = 'application/json';
    return headers;
}

async function carregarHistorico() {
    try {
        const response = await fetch('/api/chat/historico', { headers: headersAutenticados(false) });
        const dados = await response.json();

        if (response.status === 401) return sair();
        if (!response.ok) throw new Error(dados.erro || 'Não foi possível carregar o histórico.');
        if (!dados.mensagens.length) return;

        conversation.innerHTML = '';
        dados.mensagens.forEach((mensagem) => {
            const texto = (mensagem.parts || []).map((parte) => parte.text).join('\n');
            adicionarMensagem(mensagem.role === 'model' ? 'bot' : 'user', texto, mensagem.imagemUrl);
        });
    } catch (erro) {
        setStatus(erro.message, true);
    }
}

function adicionarMensagem(tipo, texto, imagemUrl = '') {
    const mensagem = document.createElement('div');
    mensagem.className = `message message-${tipo}`;
    const html = tipo === 'bot' ? marked.parse(texto) : escapeHtml(texto);
    if (imagemUrl) {
        const imagem = document.createElement('img');
        imagem.className = 'message-image';
        imagem.src = imagemUrl;
        imagem.alt = 'Imagem enviada para análise';
        imagem.loading = 'lazy';
        mensagem.appendChild(imagem);
    }
    const textoMensagem = document.createElement('div');
    textoMensagem.innerHTML = tipo === 'bot' ? DOMPurify.sanitize(html) : html;
    mensagem.appendChild(textoMensagem);
    conversation.appendChild(mensagem);
    conversation.scrollTop = conversation.scrollHeight;
}

function setLoading(loading) {
    sendButton.disabled = loading;
    sendButton.textContent = loading ? 'A pensar...' : 'Enviar ↗';
}

function setStatus(message, isError = false) {
    statusLine.textContent = message;
    statusLine.classList.toggle('status-error', isError);
}

function mostrarStatus(message) {
    authStatus.textContent = message;
    authStatus.hidden = !message;
}

function escapeHtml(text) {
    const element = document.createElement('div');
    element.textContent = text;
    return element.innerHTML;
}

async function verificarSaude() {
    try {
        const response = await fetch('/api/health');
        if (!response.ok) throw new Error('API offline');
        healthIndicator.className = 'health-indicator is-online';
        healthIndicator.title = 'API operacional';
        healthLabel.textContent = 'Sistema operacional';
    } catch (erro) {
        healthIndicator.className = 'health-indicator is-offline';
        healthIndicator.title = 'API offline';
        healthLabel.textContent = 'API offline';
    }
}