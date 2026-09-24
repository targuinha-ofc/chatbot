const form = document.getElementById('cep-form');
const cepInput = document.getElementById('cep');
const resultArea = document.getElementById('resultado');
const errorMessage = document.getElementById('cep-error');
const searchButton = document.getElementById('search-button');

cepInput.addEventListener('input', () => {
    const numbers = cepInput.value.replace(/\D/g, '').slice(0, 8);
    cepInput.value = numbers.length > 5
        ? `${numbers.slice(0, 5)}-${numbers.slice(5)}`
        : numbers;
    errorMessage.hidden = true;
});

form.addEventListener('submit', buscarCEP);

async function buscarCEP(event) {
    event.preventDefault();
    const cep = cepInput.value.replace(/\D/g, '');

    if (cep.length !== 8) {
        showError('Digite um CEP válido com 8 números.');
        cepInput.focus();
        return;
    }

    setLoading(true);

    try {
        const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);

        if (!response.ok) {
            throw new Error(`Erro na requisição: ${response.status}`);
        }

        const data = await response.json();

        if (data.erro) {
            showError('CEP não encontrado. Confira os números e tente novamente.');
            resultArea.innerHTML = '';
            return;
        }

        showAddress(data);
    } catch (error) {
        showError('Não foi possível consultar o CEP agora. Tente novamente.');
        resultArea.innerHTML = '';
        console.error(error);
    } finally {
        setLoading(false);
    }
}

function showAddress(address) {
    resultArea.innerHTML = `
        <h2 class="result-heading">Endereço encontrado</h2>
        <dl class="address-grid">
            <div class="address-item"><dt>CEP</dt><dd>${escapeHtml(address.cep)}</dd></div>
            <div class="address-item"><dt>Estado</dt><dd>${escapeHtml(address.uf)} - ${escapeHtml(address.estado || '')}</dd></div>
            <div class="address-item"><dt>Logradouro</dt><dd>${escapeHtml(address.logradouro) || 'Não informado'}</dd></div>
            <div class="address-item"><dt>Bairro</dt><dd>${escapeHtml(address.bairro) || 'Não informado'}</dd></div>
            <div class="address-item"><dt>Cidade</dt><dd>${escapeHtml(address.localidade)}</dd></div>
            <div class="address-item"><dt>DDD</dt><dd>${escapeHtml(address.ddd) || 'Não informado'}</dd></div>
        </dl>
    `;
}

function showError(message) {
    errorMessage.textContent = message;
    errorMessage.hidden = false;
}

function setLoading(isLoading) {
    searchButton.disabled = isLoading;
    searchButton.querySelector('span').textContent = isLoading ? 'Consultando...' : 'Buscar CEP';
    resultArea.setAttribute('aria-busy', String(isLoading));
}

function escapeHtml(value = '') {
    const element = document.createElement('div');
    element.textContent = value;
    return element.innerHTML;
}