// --- CONFIGURAÇÃO GOOGLE SHEETS ---
const GOOGLE_API_URL = "https://script.google.com/macros/s/AKfycbxSgnWz56Ys0oGyZF-JSuZFXn7RIOxQEA4Fer9kZRSavEpaB5G9hOwGrtPMvpAwugzXSA/exec";

function enviarParaGoogle(key) {
    const dados = JSON.parse(localStorage.getItem(key) || '[]');
    const nomeAmigavel = key === 'registros' ? 'Entrada/Saída e Registros' : 'Cadastro de Veículos';

    fetch(GOOGLE_API_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sheetName: key, data: dados })
    })
    .then(() => {
        console.log(`Dados de ${key} sincronizados.`);
        // alert(`✅ Sucesso!\nOs dados de "${nomeAmigavel}" foram enviados para a nuvem.`);
    })
    .catch(err => {
        console.error("Erro ao sincronizar:", err);
        alert(`❌ Erro de Conexão!\nVerifique sua internet.`);
    });
}

// --- inicio LOGIN  NOVO: GESTÃO DE USUÁRIOS E AUDITORIA ---

//inicio  LOGIN USUARIO ATIVO Dentro da sua função realizarLogin

 /*else { //para indiar usuario direto
        // Fallback: Caso a planilha falhe ou seja o admin padrão offline
        if (emailDigitado === "admin@sees.com" && senhaDigitada === "123456") {
            realizarLogin("admin@sees.com");
        } else {
            alert("Usuário não encontrado na planilha ou senha incorreta!");
        }
*/    
// --- 1. INICIALIZAÇÃO DO SISTEMA (PERSISTÊNCIA DE SESSÃO) ---
// --- 1. INICIALIZAÇÃO DO SISTEMA ---
// --- 1. INICIALIZAÇÃO E PERSISTÊNCIA (window.onload) ---
window.onload = async () => {
    console.log("Sincronizando sistema...");

    // Tenta recuperar a sessão salva no navegador
    const sessaoSalva = localStorage.getItem('sees_session');

    if (sessaoSalva) {
        try {
            const usuario = JSON.parse(sessaoSalva);
            console.log("Sessão restaurada para:", usuario.email);
            
            // Chama a função de interface passando o usuário recuperado
            liberarSistema(usuario);
        } catch (e) {
            console.error("Erro na sessão salva:", e);
            localStorage.removeItem('sees_session');
        }
    }

    // Carrega configurações de vagas
    const config = JSON.parse(localStorage.getItem('configVagas') || '{"carro":0, "moto":0}');
    if (document.getElementById('vCarro')) document.getElementById('vCarro').value = config.carro;
    if (document.getElementById('vMoto')) document.getElementById('vMoto').value = config.moto;

    // Sincroniza com a nuvem e atualiza interface geral
    await carregarDadosDaNuvem(); 
    atualizarTudo();
    atualizarTabelaLogs();
};

// --- 2. CONTROLE DE INTERFACE (Exibição do Nav e Conteúdo) ---
function liberarSistema(dadosUsuario) {
    const loginOverlay = document.getElementById('loginOverlay');
    const sistemaConteudo = document.getElementById('sistemaConteudo');
    const txtPerfil = document.getElementById('txtUserPerfil');

    // RESOLVE O PROBLEMA DO NAV: Preenche o span antes de mostrar o sistema
    if (txtPerfil && dadosUsuario) {
        txtPerfil.innerText = `${dadosUsuario.nome} | ${dadosUsuario.perfil}`;
    }

    // Esconde o login e mostra o sistema
    if (loginOverlay) loginOverlay.style.display = 'none';
    if (sistemaConteudo) sistemaConteudo.style.display = 'block';

    // Chama funções de atualização se existirem
    if (typeof atualizarGraficos === 'function') atualizarGraficos();
    
    console.log("Interface liberada para:", dadosUsuario.nome);
}

// --- 3. PROCESSO DE LOGIN ---
document.getElementById('formLogin').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const emailDigitado = document.getElementById('loginEmail').value; 
    const senhaDigitada = document.getElementById('loginSenha').value;
    const listaUsuariosRaw = localStorage.getItem('usuarios');

    if (!listaUsuariosRaw) {
        alert("Erro: Dados não carregados. Aguarde a sincronização ou recarregue (F5).");
        return;
    }
    
    const listaUsuarios = JSON.parse(listaUsuariosRaw);

    const usuarioValido = listaUsuarios.find(u => {
        const emailPlanilha = (u.Email || u.email || "").toString().trim();
        const senhaPlanilha = (u.Senha || u.senha || "").toString().trim();
        return emailPlanilha === emailDigitado.trim() && senhaPlanilha === senhaDigitada.trim();
    });

    if (usuarioValido) {
        const agora = new Date();
        
        // Criação do objeto de sessão com formatação PT-BR definitiva
        const dadosSession = {
            nome: (usuarioValido.Nome || usuarioValido.nome || "Usuário").toUpperCase(),
            // Captura o perfil da planilha (ADM, SUPORTE, PORTARIA, etc)
            perfil: (usuarioValido.Perfil || usuarioValido.perfil || "OPERADOR").toUpperCase(),
            email: emailDigitado.toLowerCase(),
            data: agora.toLocaleDateString('pt-BR'), 
            entrada: agora.toLocaleTimeString('pt-BR'),
            saida: "Sessão Ativa",
            navegador: navigator.userAgent.split(') ')[1] || "Browser"
        };

        // Salva nos logs locais para auditoria
        let logs = JSON.parse(localStorage.getItem('loginperfil') || '[]');
        logs.unshift(dadosSession);
        localStorage.setItem('loginperfil', JSON.stringify(logs));
        
        // Envia para o Google Sheets (Aba loginperfil)
        if (typeof enviarParaGoogle === 'function') enviarParaGoogle('loginperfil');

        // Salva a sessão ativa e libera a interface
        localStorage.setItem('sees_session', JSON.stringify(dadosSession));
        liberarSistema(dadosSession);
        atualizarTabelaLogs();
        
        setTimeout(() => alert(`Bem-vindo, ${dadosSession.nome}!`), 100);
    } else {
        alert("Acesso Negado: E-mail ou Senha incorretos.");
    }
});

// --- 4. LOGOUT UNIFICADO (Encerramento de Sessão) ---
function encerrarSessao() {
    if (!confirm("Deseja realmente sair do sistema?")) return;

    let logs = JSON.parse(localStorage.getItem('loginperfil') || '[]');
    
    // Atualiza o horário de saída no último log do usuário logado
    if (logs.length > 0 && logs[0].saida === "Sessão Ativa") {
        logs[0].saida = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        localStorage.setItem('loginperfil', JSON.stringify(logs));
        
        if (typeof enviarParaGoogle === 'function') enviarParaGoogle('loginperfil');
    }

    // Limpa o LocalStorage da sessão e recarrega
    localStorage.removeItem('sees_session');
    location.reload();
}

// --- 5. GESTÃO DA TABELA DE LOGS ---
// --- FUNÇÃO AUXILIAR (O Segredo para limpar a data da imagem) ---
function formatarDadoPlanilha(valor, tipo) {
    if (!valor) return "---";
    let texto = valor.toString();

    // Se o valor contiver o "T" (padrão ISO que vimos na sua imagem)
    if (texto.includes('T')) {
        const partes = texto.split('T');
        if (tipo === 'data') {
            // Transforma 2026-04-16 em 16/04/2026
            return partes[0].split('-').reverse().join('/');
        }
        if (tipo === 'hora') {
            // Pega apenas o 00:00:00 da string 1970-01-01T00:00:00
            return partes[1].substring(0, 8);
        }
    }

    // Caso especial para Saída: Sessão Ativa
    if (tipo === 'saida') {
        if (texto.toUpperCase().includes("SESS") || texto === "Sessão Ativa") {
            return '<span class="badge bg-success text-white">SESSÃO ATIVA</span>';
        }
    }

    return texto;
}

// --- ATUALIZAR TABELA (Com as correções de formato) ---
function atualizarTabelaLogs() {
    const logs = JSON.parse(localStorage.getItem('loginperfil') || '[]');
    const corpo = document.getElementById('tabelaLogsLogin');
    if (!corpo) return;

    corpo.innerHTML = logs.map(log => `
        <tr>
            <td>${formatarDadoPlanilha(log.data, 'data')}</td>
            <td><span class="badge ${log.perfil === 'ADMINISTRADOR' ? 'bg-danger' : 'bg-primary'}">${log.perfil}</span></td>
            <td class="fw-bold">${log.nome}</td>
            <td>${log.email}</td>
            <td>${formatarDadoPlanilha(log.entrada, 'hora')}</td>
            <td>${formatarDadoPlanilha(log.saida, 'saida')}</td>
            <td class="small text-muted" style="font-size: 0.7rem;">${log.navegador || '---'}</td>
        </tr>
    `).join('');
}

// --- FILTRAR TABELA (Mantendo a mesma lógica de limpeza) ---
function filtrarTabelaLogs() {
    const termo = document.getElementById('buscaLogs').value.toLowerCase();
    const logs = JSON.parse(localStorage.getItem('loginperfil') || '[]');
    const filtrados = logs.filter(log => 
        log.nome.toLowerCase().includes(termo) || 
        log.email.toLowerCase().includes(termo) || 
        log.perfil.toLowerCase().includes(termo) ||
        log.data.toString().includes(termo)
    );
    
    const corpo = document.getElementById('tabelaLogsLogin');
    if (!corpo) return;

    corpo.innerHTML = filtrados.map(log => `
        <tr>
            <td>${formatarDadoPlanilha(log.data, 'data')}</td>
            <td><span class="badge ${log.perfil === 'ADMINISTRADOR' ? 'bg-danger' : 'bg-primary'}">${log.perfil}</span></td>
            <td class="fw-bold">${log.nome}</td>
            <td>${log.email}</td>
            <td>${formatarDadoPlanilha(log.entrada, 'hora')}</td>
            <td>${formatarDadoPlanilha(log.saida, 'saida')}</td>
            <td class="small text-muted" style="font-size: 0.7rem;">${log.navegador || '---'}</td>
        </tr>
    `).join('');
}


function importarLogs(input) {
    if (!input.files[0]) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const json = JSON.parse(e.target.result);
            if (!Array.isArray(json)) throw new Error("Formato inválido");
            localStorage.setItem('loginperfil', JSON.stringify(json));
            atualizarTabelaLogs();
            if (typeof enviarParaGoogle === 'function') enviarParaGoogle('loginperfil');
            alert("✅ Logs importados e sincronizados!");
        } catch (err) { 
            alert("❌ Arquivo inválido!"); 
        }
        input.value = "";
    };
    reader.readAsText(input.files[0]);
}

function encerrarSessao() {
    if (!confirm("Deseja realmente sair do sistema?")) return;

    // 1. REGISTRO DE AUDITORIA (Carimba a hora de saída no log)
    let logs = JSON.parse(localStorage.getItem('loginperfil') || '[]');
    
    // Verifica se o último log é deste usuário e ainda está marcado como "Sessão Ativa"
    if (logs.length > 0 && logs[0].saida === "Sessão Ativa") {
        logs[0].saida = new Date().toLocaleTimeString('pt-BR');
        localStorage.setItem('loginperfil', JSON.stringify(logs));
        
        // Envia para a planilha o registro com o horário de saída preenchido
        if (typeof enviarParaGoogle === 'function') {
            enviarParaGoogle('loginperfil');
        }
    }

    // 2. LIMPEZA DE ACESSO
    // Remove a chave que mantém o usuário logado ao dar F5
    localStorage.removeItem('sees_session');

    // 3. RESET DO SISTEMA
    // Recarrega a página para voltar à tela de login
    location.reload();
}

// ---FIM LOGIN LÓGICA DE GRÁFICOS E PÁTIO (MANTIDA INTEGRALMENTE) ---
//inicio  LOGIN USUARIO ATIVO Dentro da sua função realizarLogin


let chartCarros = null;
let chartMotos = null;

// CONTROLE de data e hora
setInterval(() => {
    const el = document.getElementById('dataHora');
    if (el) el.innerText = new Date().toLocaleString('pt-BR');
}, 1000);



function salvarVagas() {
    const v = { 
        carro: parseInt(document.getElementById('vCarro').value) || 0, 
        moto: parseInt(document.getElementById('vMoto').value) || 0 
    };
    localStorage.setItem('configVagas', JSON.stringify(v));
    atualizarGraficos();
    alert("Vagas atualizadas!");
}

function atualizarGraficos() {
    const config = JSON.parse(localStorage.getItem('configVagas') || '{"carro":0, "moto":0}');
    const registros = JSON.parse(localStorage.getItem('registros') || '[]');
    
    const ocupCarros = registros.filter(r => !r.saida && (r.tipo || '').toLowerCase().includes('carro')).length;
    const ocupMotos = registros.filter(r => !r.saida && (r.tipo || '').toLowerCase().includes('moto')).length;
    
    const livreCarros = Math.max(0, config.carro - ocupCarros);
    const livreMotos = Math.max(0, config.moto - ocupMotos);

    const elC = document.getElementById('statusCarros');
    const elM = document.getElementById('statusMotos');
    
    if(elC) elC.innerHTML = `<span class="text-success">Livres: ${livreCarros}</span> | <span class="text-danger">Ocup: ${ocupCarros}</span>`;
    if(elM) elM.innerHTML = `<span class="text-success">Livres: ${livreMotos}</span> | <span class="text-danger">Ocup: ${ocupMotos}</span>`;

    chartCarros = renderDonut('graficoCarros', chartCarros, livreCarros, ocupCarros, '#007bff');
    chartMotos = renderDonut('graficoMotos', chartMotos, livreMotos, ocupMotos, '#ffc107');
}

function renderDonut(id, chart, livre, ocup, cor) {
    const canvas = document.getElementById(id);
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    if (chart) chart.destroy();
    return new Chart(ctx, {
        type: 'doughnut',
        data: { 
            labels: ['Livre', 'Ocupado'], 
            datasets: [{ data: [livre, ocup], backgroundColor: ['#28a745', cor] }] 
        },
        options: { responsive: true, plugins: { legend: { display: false } }, cutout: '70%' }
    });
}



function atualizarTudo() {
    atualizarTabelaCadastro();
    atualizarTabelaRegistros();
    atualizarGraficos();
    atualizarTabelaLogs(); // Incluído na atualização geral
}

// --- ABA ENTRADA/SAÍDA ---

function abrirHistorico() { 
    document.getElementById('modalHistorico').style.display = 'block'; 
    renderizarHistorico(); 
}

function fecharHistorico() { 
    document.getElementById('modalHistorico').style.display = 'none'; 
}

function renderizarHistorico() {
    const r = JSON.parse(localStorage.getItem('registros') || '[]');
    const f = (document.getElementById('filtroHistorico')?.value || "").toLowerCase();
    
    const filtrados = r.filter(x => 
        (x.motorista || "").toLowerCase().includes(f) || 
        (x.placa || "").toLowerCase().includes(f)
    );

    document.getElementById('corpoHistorico').innerHTML = filtrados.map(x => `
        <tr>
            <td>${x.entrada ? new Date(x.entrada).toLocaleDateString() : '---'}</td>
            <td>${x.motorista}</td>
            <td>${x.vinculo}</td>
            <td>${x.tipo}</td>
            <td><b>${x.placa}</b></td>
            <td>${x.marca}</td>
            <td>${x.modelo}</td>
            <td>${x.cor}</td>
            <td>${x.ano}</td>
            <td class="small">${x.entrada ? new Date(x.entrada).toLocaleTimeString() : '---'}</td>
            <td class="small">${x.saida ? new Date(x.saida).toLocaleTimeString() : '---'}</td>
            <td><b>${calcularPermanencia(x.entrada, x.saida)}</b></td>
        </tr>`).join('');
}

function filtrarMotoristasEntrada() {
    const t = document.getElementById('buscaEntrada').value.toLowerCase();
    const l = JSON.parse(localStorage.getItem('cadastroVeiculos') || '[]');
    const s = document.getElementById('selectMotorista');
    s.innerHTML = '<option value="">Selecione o Motorista...</option>';
    
    l.filter(v => v.motorista.toLowerCase().includes(t) || v.placa.toLowerCase().includes(t))
        .forEach(v => {
            let o = document.createElement('option');
            o.value = JSON.stringify(v); 
            o.textContent = `${v.motorista} - ${v.vinculo} / ${v.tipo}(${v.placa}) - ${v.modelo}/ ${v.cor}`;
            s.appendChild(o);
        });
}

function preencherCamposEntrada() {
    const val = document.getElementById('selectMotorista').value;
    if (!val) return;
    const v = JSON.parse(val);
    document.getElementById('eVinculo').value = v.vinculo || "";
    document.getElementById('ePlaca').value = v.placa || "";
    document.getElementById('eTipo').value = v.tipo || "";
    document.getElementById('eMarca').value = v.marca || "";
    document.getElementById('eModelo').value = v.modelo || "";
    document.getElementById('eCor').value = v.cor || "";
    document.getElementById('eAno').value = v.ano || "";
}

function registrarEntrada() {
    const s = document.getElementById('selectMotorista').value;
    if (!s) return alert("Selecione um motorista!");
    let r = JSON.parse(localStorage.getItem('registros') || '[]');
    const v = JSON.parse(s);
    
    if (r.find(x => x.placa === v.placa && !x.saida)) return alert("Este veículo já está no pátio!");
    
    const novoRegistro = { 
        ...v, 
        entrada: new Date().toISOString(), 
        saida: null,
        data: new Date().toLocaleDateString()
    };
    
    r.unshift(novoRegistro);
    localStorage.setItem('registros', JSON.stringify(r));
    atualizarTudo();
    enviarParaGoogle('registros');
}

function registrarSaida() {
    const s = document.getElementById('selectMotorista').value;
    if (!s) return alert("Selecione o motorista!");
    const v = JSON.parse(s);
    let r = JSON.parse(localStorage.getItem('registros') || '[]');
    let item = r.find(x => x.placa === v.placa && !x.saida);
    
    if (!item) return alert("Este veículo não consta como presente no pátio!");
    
    item.saida = new Date().toISOString();
    localStorage.setItem('registros', JSON.stringify(r));
    atualizarTudo();
    enviarParaGoogle('registros');
}

function abrirModalEntrada() {
    const modal = document.getElementById('modalAcesso');
    if (modal) {
        modal.style.display = 'block';
        // Limpa a busca ao abrir
        document.getElementById('buscaEntrada').value = '';
        filtrarMotoristasEntrada(); 
    }
}

function fecharModalEntrada() {
    const modal = document.getElementById('modalAcesso');
    if (modal) {
        modal.style.display = 'none';
    }
}

function removerItem(key, i) {
    if (confirm('Deseja realmente excluir este registro?')) {
        let l = JSON.parse(localStorage.getItem(key) || '[]');
        l.splice(i, 1);
        localStorage.setItem(key, JSON.stringify(l));
        atualizarTudo();
        enviarParaGoogle(key);
    }
}

// --- EXPORTAÇÃO E IMPORTAÇÃO ---

function calcularPermanencia(entrada, saida) {
    if (!entrada || !saida) return "---";
    const diff = new Date(saida) - new Date(entrada);
    if (diff < 0) return "---";
    const horas = Math.floor(diff / (1000 * 60 * 60));
    const minutos = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${horas}h ${minutos}min`;
}

function exportarJSON(key, f) {
    const data = localStorage.getItem(key) || '[]';
    const blob = new Blob([data], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${f}_${new Date().toLocaleDateString().replace(/\//g, '-')}.json`;
    a.click();
}

function exportarExcel(key, f) {
    const data = JSON.parse(localStorage.getItem(key) || '[]');
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Dados");
    XLSX.writeFile(wb, `${f}.xlsx`);
}

function exportarHistoricoExcel() {
    const dados = JSON.parse(localStorage.getItem('registros') || '[]');
    if (dados.length === 0) return alert("Não há registros para exportar.");

    const dadosFormatados = dados.map(reg => ({
        'Data': reg.data || new Date(reg.entrada).toLocaleDateString(),
        'Motorista': reg.motorista,
        'Vínculo': reg.vinculo || '---',
        'Tipo': reg.tipo,
        'Placa': reg.placa,
        'Veículo': `${reg.marca} ${reg.modelo}`,
        'Entrada': reg.entrada ? new Date(reg.entrada).toLocaleString() : '---',
        'Saída': reg.saida ? new Date(reg.saida).toLocaleString() : 'Ainda no Pátio',
        'Permanência': calcularPermanencia(reg.entrada, reg.saida)
    }));

    const ws = XLSX.utils.json_to_sheet(dadosFormatados);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Movimentação");
    XLSX.writeFile(wb, `Historico_SEES.xlsx`);
}

function exportarHistoricoPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('l', 'mm', 'a4');
    const dados = JSON.parse(localStorage.getItem('registros') || '[]');

    doc.text("Relatório Geral de Movimentação - SEES", 14, 15);

    const rows = dados.map(reg => [
        reg.data || new Date(reg.entrada).toLocaleDateString(),
        reg.motorista,
        reg.vinculo || '---',
        reg.placa,
        `${reg.marca} ${reg.modelo}`,
        reg.entrada ? new Date(reg.entrada).toLocaleTimeString() : '---',
        reg.saida ? new Date(reg.saida).toLocaleTimeString() : 'Pátio',
        calcularPermanencia(reg.entrada, reg.saida)
    ]);

    doc.autoTable({
        startY: 25,
        head: [['Data', 'Motorista', 'Vínculo', 'Placa', 'Veículo', 'Entrada', 'Saída', 'Permanência']],
        body: rows,
        styles: { fontSize: 8 }
    });

    doc.save("Relatorio_SEES.pdf");
}

function exportarPatioExcel() {
    const dados = JSON.parse(localStorage.getItem('registros') || '[]');
    const noPatio = dados.filter(reg => !reg.saida);
    const ws = XLSX.utils.json_to_sheet(noPatio);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pátio");
    XLSX.writeFile(wb, `Veiculos_No_Patio.xlsx`);
}

// --- ABA CADASTRO ---

function atualizarTabelaRegistros() {
    const r = JSON.parse(localStorage.getItem('registros') || '[]');
    const hoje = new Date().toLocaleDateString();
    // Filtra para mostrar quem está no pátio OU quem saiu hoje
    const filtrados = r.filter(x => !x.saida || new Date(x.entrada).toLocaleDateString() === hoje);

    document.getElementById('tabelaRegistros').innerHTML = filtrados.map((x, i) => `
        <tr>
            <td>${new Date(x.entrada).toLocaleDateString()}</td>
            <td>${x.motorista}</td>
            <td>${x.vinculo}</td>
            <td><span class="badge bg-light text-dark border">${x.tipo}</span></td>
            <td><code class="fw-bold text-primary">${x.placa}</code></td>
            <td>${x.marca}</td>
            <td>${x.modelo}</td>
            <td>${x.cor}</td>
            <td>${x.ano}</td>
            <td class="small">${new Date(x.entrada).toLocaleTimeString()}</td>
            <td class="small">${x.saida ? new Date(x.saida).toLocaleTimeString() : '<span class="badge bg-success">No Pátio</span>'}</td>
            <td>${calcularPermanencia(x.entrada, x.saida)}</td>
            <td><button class="btn btn-sm btn-outline-danger" onclick="removerItem('registros', ${i})">🗑️</button></td>
        </tr>`).join('');
}

function salvarCadastro() {
    const index = parseInt(document.getElementById('editIndex').value);
    const d = {
        motorista: document.getElementById('cNome').value.trim(),
        vinculo: document.getElementById('cVinculo').value,
        tipo: document.getElementById('cTipo').value,
        placa: document.getElementById('cPlaca').value.trim().toUpperCase(),
        marca: document.getElementById('cMarca').value.trim(),
        modelo: document.getElementById('cModelo').value.trim(),
        cor: document.getElementById('cCor').value.trim(),
        ano: document.getElementById('cAno').value.trim(),
        dataCadastro: new Date().toISOString()
    };

    if (!d.motorista || !d.placa || !d.vinculo) return alert("Preencha Nome, Placa e Vínculo!");
    
    let l = JSON.parse(localStorage.getItem('cadastroVeiculos') || '[]');
    if (index === -1) l.push(d); else l[index] = d;
    
    localStorage.setItem('cadastroVeiculos', JSON.stringify(l));
    limparFormularioCadastro();
    atualizarTudo();
    enviarParaGoogle('cadastroVeiculos');
}

function editarCadastro(i) {
    let l = JSON.parse(localStorage.getItem('cadastroVeiculos') || '[]');
    const v = l[i];
    document.getElementById('cNome').value = v.motorista;
    document.getElementById('cVinculo').value = v.vinculo || "";
    document.getElementById('cTipo').value = v.tipo;
    document.getElementById('cPlaca').value = v.placa;
    document.getElementById('cMarca').value = v.marca;
    document.getElementById('cModelo').value = v.modelo;
    document.getElementById('cCor').value = v.cor;
    document.getElementById('cAno').value = v.ano;
    document.getElementById('editIndex').value = i;
    document.getElementById('tituloCadastro').innerText = "📝 Editando Registro";
    document.getElementById('btnSalvar').innerText = "🔄 Atualizar";
    document.getElementById('btnCancelar').classList.remove('d-none');
}

function limparFormularioCadastro() {
    const campos = ['cNome', 'cVinculo', 'cPlaca', 'cMarca', 'cModelo', 'cCor', 'cAno'];
    campos.forEach(id => document.getElementById(id).value = "");
    document.getElementById('editIndex').value = "-1";
    document.getElementById('tituloCadastro').innerText = "Registrar Novo Veículo";
    document.getElementById('btnSalvar').innerText = "💾 Salvar";
    document.getElementById('btnCancelar').classList.add('d-none');
}

function atualizarTabelaCadastro() {
    let l = JSON.parse(localStorage.getItem('cadastroVeiculos') || '[]');
    const totalCarros = l.filter(v => (v.tipo || '').toLowerCase() === 'carro').length;
    const totalMotos = l.filter(v => (v.tipo || '').toLowerCase() === 'moto').length;
    
    const elVagas = document.getElementById('contadorCadastrosVagas');
    if (elVagas) elVagas.innerHTML = `Total Cadastrados: 🚗 ${totalCarros} | 🏍️ ${totalMotos}`;

    document.getElementById('tabelaCadastro').innerHTML = l.map((v, i) => `
        <tr>
            <td>${v.dataCadastro ? new Date(v.dataCadastro).toLocaleDateString() : '---'}</td>
            <td>${v.motorista}</td>
            <td><strong class="text-muted">${v.vinculo}</strong></td>
            <td>${v.tipo}</td>
            <td><code class="fw-bold text-primary">${v.placa}</code></td>
            <td>${v.marca}</td>
            <td>${v.modelo}</td>
            <td>${v.cor}</td>
            <td>${v.ano}</td>
            <td>
                <button class="btn btn-sm btn-warning" onclick="editarCadastro(${i})">✏️</button>
                <button class="btn btn-sm btn-danger" onclick="removerItem('cadastroVeiculos', ${i})">🗑️</button>
            </td>
        </tr>`).join('');
}

function filtrarTabelaCadastro() {
    const termo = document.getElementById('buscaCadastro').value.toLowerCase();
    const l = JSON.parse(localStorage.getItem('cadastroVeiculos') || '[]');
    const filtrados = l.filter(v => v.motorista.toLowerCase().includes(termo) || v.placa.toLowerCase().includes(termo));
    
    document.getElementById('tabelaCadastro').innerHTML = filtrados.map((v, i) => `
        <tr>
            <td>${v.dataCadastro ? new Date(v.dataCadastro).toLocaleDateString() : '---'}</td>
            <td>${v.motorista}</td><td>${v.vinculo}</td>
            <td>${v.tipo}</td><td><b>${v.placa}</b></td>
            <td>${v.marca}</td><td>${v.modelo}</td><td>${v.cor}</td><td>${v.ano}</td>
            <td>
                <button class="btn btn-sm btn-warning" onclick="editarCadastro(${i})">✏️</button>
                <button class="btn btn-sm btn-danger" onclick="removerItem('cadastroVeiculos', ${i})">🗑️</button>
            </td>
        </tr>`).join('');
}

// --- RELATÓRIOS ---

function exibirTotalPorMotorista() {
    const cadastros = JSON.parse(localStorage.getItem('cadastroVeiculos') || '[]');
    const corpoTabela = document.getElementById('corpoTotalMotorista');
    if (cadastros.length === 0) return alert("Nenhum veículo cadastrado.");

    corpoTabela.innerHTML = "";
    const agrupado = {};
    cadastros.forEach(v => {
        const chave = v.motorista.toUpperCase();
        if (!agrupado[chave]) agrupado[chave] = { vinculo: v.vinculo || '---', veiculos: [] };
        agrupado[chave].veiculos.push(`${v.tipo}: <strong>${v.modelo}</strong> (<strong>${v.placa}</strong>)`);
    });

    Object.entries(agrupado).sort((a, b) => b[1].veiculos.length - a[1].veiculos.length)
    .forEach(([nome, dados]) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td><strong>${nome}</strong><br><small>${dados.vinculo}</small></td>
                        <td>${dados.veiculos.join('<br>')}</td>
                        <td class="text-center fw-bold">${dados.veiculos.length}</td>`;
        corpoTabela.appendChild(tr);
    });
    document.getElementById('modalTotalMotorista').style.display = 'block';
}

function fecharModalMotorista() {
    document.getElementById('modalTotalMotorista').style.display = 'none';
}

function baixarRelatorioMotoristaExcel() {
    const cadastros = JSON.parse(localStorage.getItem('cadastroVeiculos') || '[]');
    const ws = XLSX.utils.json_to_sheet(cadastros);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Relatorio");
    XLSX.writeFile(wb, `Relatorio_Motoristas_SEES.xlsx`);
}

function baixarRelatorioMotoristaPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const cadastros = JSON.parse(localStorage.getItem('cadastroVeiculos') || '[]');
    const rows = cadastros.map(v => [v.motorista, v.vinculo, v.placa, v.tipo, v.modelo]);
    doc.autoTable({ head: [['Motorista', 'Vínculo', 'Placa', 'Tipo', 'Modelo']], body: rows });
    doc.save(`Relatorio_Motoristas.pdf`);
}

window.onclick = function(event) {
    const m1 = document.getElementById('modalHistorico');
    const m2 = document.getElementById('modalTotalMotorista');
    if (event.target == m1) m1.style.display = "none";
    if (event.target == m2) m2.style.display = "none";
}


function validarPelaPlanilha(emailDigitado, senhaDigitada) {
    // Puxa a lista de usuários que veio da planilha (ex: aba 'usuarios')
    const usuariosPermitidos = JSON.parse(localStorage.getItem('usuarios_nuvem') || '[]');

    const usuarioEncontrado = usuariosPermitidos.find(u => u.email === emailDigitado && u.senha === senhaDigitada);

    if (usuarioEncontrado) {
        realizarLogin(emailDigitado);
    } else {
        alert("Acesso negado: Usuário não consta na base de dados da Planilha.");
    }
}



async function carregarDadosDaNuvem() {
    try {
        const response = await fetch(GOOGLE_API_URL);
        const nuvem = await response.json();
        
        // Salva a aba de usuários (para validar login)
        if (nuvem.usuarios) {
            localStorage.setItem('usuarios', JSON.stringify(nuvem.usuarios));
        }
        
        // Salva a aba de histórico (para a aba de auditoria)
        if (nuvem.loginperfil) {
            localStorage.setItem('loginperfil', JSON.stringify(nuvem.loginperfil));
        }

        // Dados de veículos e registros
        if (nuvem.cadastroVeiculos) localStorage.setItem('cadastroVeiculos', JSON.stringify(nuvem.cadastroVeiculos));
        if (nuvem.registros) localStorage.setItem('registros', JSON.stringify(nuvem.registros));

        console.log("✅ Dados da nuvem carregados com sucesso!");
        return true; 
    } catch (err) {
        console.error("❌ Erro ao buscar dados da nuvem:", err);
        return false;
    }
}
/*async function carregarDadosDaNuvem() {
    try {
        const response = await fetch(GOOGLE_API_URL);
        const nuvem = await response.json();
        if (nuvem.cadastroVeiculos) localStorage.setItem('cadastroVeiculos', JSON.stringify(nuvem.cadastroVeiculos));
        if (nuvem.registros) localStorage.setItem('registros', JSON.stringify(nuvem.registros));
        if (nuvem.loginperfil) localStorage.setItem('loginperfil', JSON.stringify(nuvem.loginperfil)); // Sincroniza logsatualizarTudo();
        atualizarTudo();
    } catch (err) { console.error("Erro ao baixar dados:", err); }
}*/
