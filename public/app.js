const form = document.getElementById('chat-form');
const questionInput = document.getElementById('question');
const conversation = document.getElementById('conversation');
const sendButton = document.getElementById('send-button');
const clearButton = document.getElementById('clear-button');
const statusLine = document.getElementById('status-line');

form.addEventListener('submit', enviarPergunta);
clearButton.addEventListener('click', limparConversa);
questionInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        form.requestSubmit();
    }
});

async function enviarPergunta(event) {
    event.preventDefault();
    const pergunta = questionInput.value.trim();

    if (!pergunta) return;

    adicionarMensagem('user', pergunta);
    questionInput.value = '';
    setLoading(true);

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pergunta })
        });
        const dados = await response.json();

        if (!response.ok) throw new Error(dados.erro || 'Não foi possível enviar a pergunta.');

        adicionarMensagem('bot', dados.resposta);
        setStatus('Memória sincronizada com o MongoDB Atlas');
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
        const response = await fetch('/api/chat/limpar', { method: 'DELETE' });
        const dados = await response.json();

        if (!response.ok) throw new Error(dados.erro || 'Não foi possível limpar a conversa.');

        conversation.innerHTML = '<div class="welcome-message"><span class="welcome-mark" aria-hidden="true">+</span><h2>Campo limpo.</h2><p>Uma nova conversa pode começar agora.</p></div>';
        setStatus('Memória apagada com sucesso.');
    } catch (erro) {
        setStatus(erro.message, true);
    } finally {
        clearButton.disabled = false;
    }
}

function adicionarMensagem(tipo, texto) {
    const mensagem = document.createElement('div');
    mensagem.className = `message message-${tipo}`;
    const html = tipo === 'bot' ? marked.parse(texto) : escapeHtml(texto);
    mensagem.innerHTML = tipo === 'bot' ? DOMPurify.sanitize(html) : html;
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

function escapeHtml(text) {
    const element = document.createElement('div');
    element.textContent = text;
    return element.innerHTML;
}