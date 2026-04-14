
// --- CONFIGURAÇÃO GOOGLE SHEETS ---
const GOOGLE_API_URL = "https://script.google.com/macros/s/AKfycbxSgnWz56Ys0oGyZF-JSuZFXn7RIOxQEA4Fer9kZRSavEpaB5G9hOwGrtPMvpAwugzXSA/exec";

function enviarParaGoogle(key) {
    const dadosOriginais = JSON.parse(localStorage.getItem(key) || '[]');
    const nomeAmigavel = key === 'registros' ? 'Entrada/Saída e Registros' : 'Cadastro de Veículos';

    // --- AJUSTE AQUI ---
    // Criamos uma nova lista de dados para não modificar o que está salvo no navegador
    let dadosParaEnviar = dadosOriginais;

    if (key === 'registros') {
        dadosParaEnviar = dadosOriginais.map(item => {
            // Se o veículo já saiu, calcula a permanência real. 
            // Se ainda está no pátio, calcula a permanência até o momento atual (Agora).
            const dataFim = item.saida ? item.saida : new Date().toISOString();
            
            return {
                ...item, // Mantém todos os campos originais (nome, placa, entrada, etc)
                permanencia: calcularPermanencia(item.entrada, dataFim) // Acrescenta a nova coluna
            };
        });
    }

    fetch(GOOGLE_API_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sheetName: key, data: dadosParaEnviar }) // Enviamos os dados ajustados
    })
    .then(() => {
        console.log(`Dados de ${key} sincronizados com sucesso.`);
        alert(`✅ Sucesso!\nOs dados de "${nomeAmigavel}" foram enviados para a nuvem.`);
    })
    .catch(err => {
        console.error("Erro ao sincronizar:", err);
        alert(`❌ Erro de Conexão!\nVerifique sua internet.`);
    });
}


let chartCarros = null;
let chartMotos = null;

// CONTROLE de data e hora
setInterval(() => {
    const el = document.getElementById('dataHora');
    if (el) el.innerText = new Date().toLocaleString('pt-BR');
}, 1000);

/*INICIO CABECAÇHO COM GRÁFICOS TOTAL DE VAGAS PARA CARRO/MOTO*/
// UNIFICADO: Apenas um window.onload
window.onload = () => {
    const config = JSON.parse(localStorage.getItem('configVagas') || '{"carro":0, "moto":0}');
    const vCarro = document.getElementById('vCarro');
    const vMoto = document.getElementById('vMoto');
    
    if (vCarro) vCarro.value = config.carro;
    if (vMoto) vMoto.value = config.moto;
    
    atualizarTudo();
    carregarDadosDaNuvem(); 
};

function atualizarTudo() {
    atualizarTabelaCadastro();
    atualizarTabelaRegistros();
    atualizarGraficos();
}


function salvarVagas() {
    const v = { carro: parseInt(document.getElementById('vCarro').value) || 0, moto: parseInt(document.getElementById('vMoto').value) || 0 };
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

    document.getElementById('statusCarros').innerHTML = `<span class="verde">Livres: ${livreCarros}</span> | <span class="vermelho">Ocup: ${ocupCarros}</span>`;
    document.getElementById('statusMotos').innerHTML = `<span class="verde">Livres: ${livreMotos}</span> | <span class="vermelho">Ocup: ${ocupMotos}</span>`;

    chartCarros = renderDonut('graficoCarros', chartCarros, livreCarros, ocupCarros, '#007bff');
    chartMotos = renderDonut('graficoMotos', chartMotos, livreMotos, ocupMotos, '#ffc107');
}

function renderDonut(id, chart, livre, ocup, cor) {
    const ctx = document.getElementById(id).getContext('2d');
    if (chart) chart.destroy();
    return new Chart(ctx, {
        type: 'doughnut',
        data: { labels: ['Livre', 'Ocupado'], datasets: [{ data: [livre, ocup], backgroundColor: ['#28a745', cor] }] },
        options: { responsive: true, plugins: { legend: { display: false } }, cutout: '70%' }
    });
}
/*INICIO CABECAÇHO COM GRÁFICOS TOTAL DE VAGAS PARA CARRO/MOTO*/


/*INICIO ABA DADOS REF. ENTRADA/SAÍDA DE VEÍCULOS POR MOTORISTA*/

//INICIO ABA - ENTRADA/SAÍDA -- Funções auxiliares (Histórico, Exportação, Importação)...
function abrirHistorico() { document.getElementById('modalHistorico').style.display = 'block'; renderizarHistorico(); }
function fecharHistorico() { document.getElementById('modalHistorico').style.display = 'none'; }

function renderizarHistorico() {
    const r = JSON.parse(localStorage.getItem('registros') || '[]');
    const f = document.getElementById('filtroHistorico').value.toLowerCase();
    const filtrados = r.filter(x => x.motorista.toLowerCase().includes(f) || x.placa.toLowerCase().includes(f));
    
    document.getElementById('corpoHistorico').innerHTML = filtrados.map(x => {
        // CORREÇÃO: Calcular a permanência antes de retornar o HTML
        const permanencia = x.saida ? calcularPermanencia(x.entrada, x.saida) : '---';

        return `
            <tr>
                <td>${new Date(x.entrada).toLocaleDateString()}</td>
                <td>${x.motorista}</td><td>${x.vinculo}</td><td>${x.tipo}</td><td><b>${x.placa}</b></td>
                <td>${x.marca}</td><td>${x.modelo}</td><td>${x.cor}</td><td>${x.ano}</td>
                <td class="small">${new Date(x.entrada).toLocaleTimeString()}</td>
                <td class="small">${x.saida ? new Date(x.saida).toLocaleTimeString() : '---'}</td>
            <td class="text-center font-monospace small">${permanencia}</td>           
        </tr>`;
    }).join('');
}
/*
function filtrarMotoristasEntrada() {
    const t = document.getElementById('buscaEntrada').value.toLowerCase();
    const l = JSON.parse(localStorage.getItem('cadastroVeiculos') || '[]');
    const s = document.getElementById('selectMotorista');
    s.innerHTML = '<option value="">Selecione o Motorista...</option>';
    l.filter(v => v.motorista.toLowerCase().includes(t) || v.placa.toLowerCase().includes(t))
        .forEach(v => {
            let o = document.createElement('option');
            o.value = JSON.stringify(v); o.textContent = `${v.motorista} (${v.vinculo}) - <strong>${v.placa}</strong>  ${v.marca} / ${v.modelo}`;
            s.appendChild(o);
        });
}
*/
function filtrarMotoristasEntrada() {
    const t = document.getElementById('buscaEntrada').value.toLowerCase();
    const l = JSON.parse(localStorage.getItem('cadastroVeiculos') || '[]');
    const s = document.getElementById('selectMotorista');
    s.innerHTML = '<option value="">Selecione o Motorista...</option>';
    
    l.filter(v => v.motorista.toLowerCase().includes(t) || v.placa.toLowerCase().includes(t))
        .forEach(v => {
            let o = document.createElement('option');
            o.value = JSON.stringify(v);
            
            // Usamos .toUpperCase() para destacar a placa e hifens para separar
            const placaDestaque = v.placa.toUpperCase();
            o.textContent = `${v.motorista} (${v.vinculo}) | PLACA: ${placaDestaque} | ${v.marca} / ${v.modelo}`;
            
            s.appendChild(o);
        });
}

function preencherCamposEntrada() {
    const val = document.getElementById('selectMotorista').value;
    if (!val) return;
    const v = JSON.parse(val);
    document.getElementById('eVinculo').value = v.vinculo;
    document.getElementById('ePlaca').value = v.placa;
    document.getElementById('eTipo').value = v.tipo;
    document.getElementById('eMarca').value = v.marca;
    document.getElementById('eModelo').value = v.modelo;
    document.getElementById('eCor').value = v.cor;
    document.getElementById('eAno').value = v.ano;
}

function removerItem(key, i) {
    if (confirm('Excluir?')) {
        let l = JSON.parse(localStorage.getItem(key));
        l.splice(i, 1);
        localStorage.setItem(key, JSON.stringify(l));
        atualizarTudo();
        enviarParaGoogle(key);
    }
}


//parte da  ABA - ENTRADA/SAÍDA -- Funções auxiliares (Histórico, Exportação, Importação)...
/**validações para Entrada/saída: 
as funções precisam realizar uma conferencia se o tipo de veículo que está dando entrada/saída está 
no pátio e não dar entrada novamente sem um saída, também não pode deixar dar saída em veículo que não
esteja no pátio e muito menos da saída em que o veículo/placa seja diferente do que está no pátio. 
tanto na entrada, quanto na saída não pode realizar o procedimento para o mesmo veículo para motoristas
distintos, o veículo e placa para entrada/saída só pode estar associado a 1 motorista
*/
function registrarEntrada() {
    const s = document.getElementById('selectMotorista').value;
    if (!s) return alert("❌ Selecione um motorista!");

    const v = JSON.parse(s);
    let r = JSON.parse(localStorage.getItem('registros') || '[]');

    // BUSCA GLOBAL PELA PLACA: Não importa o motorista, se a placa está no pátio, bloqueia.
    const veiculoNoPatio = r.find(x => x.placa === v.placa && !x.saida);

    if (veiculoNoPatio) {
        // Se o motorista for diferente do que está tentando entrar agora
        if (veiculoNoPatio.motorista !== v.motorista) {
            return alert(`⚠️ BLOQUEIO: Este veículo (Placa ${v.placa}) já está no pátio com outro motorista: ${veiculoNoPatio.motorista}.`);
        }
   return alert(`⚠️ BLOQUEIO: Este veículo (Placa ${v.placa}) já está no pátio com outro motorista: ${veiculoNoPatio.motorista}.`);
    }

    r.unshift({ ...v, entrada: new Date().toISOString(), saida: null });
    localStorage.setItem('registros', JSON.stringify(r));
    atualizarTudo();
    enviarParaGoogle('registros');
    alert(`✅ Entrada liberada: ${v.motorista}`);
}

function registrarSaida() {
    const s = document.getElementById('selectMotorista').value;
    if (!s) return alert("❌ Selecione o motorista!");

    const v = JSON.parse(s);
    let r = JSON.parse(localStorage.getItem('registros') || '[]');

    // BUSCA PELA PLACA: Verifica quem entrou com este carro
    let itemNoPatio = r.find(x => x.placa === v.placa && !x.saida);

    if (!itemNoPatio) {
        return alert("❌ Erro: Este veículo não consta no pátio.");
    }

    // VALIDAÇÃO DE MOTORISTA: Impede que o Motorista B dê saída no carro que o Motorista A entrou
    if (itemNoPatio.motorista !== v.motorista) {
        return alert(`❌ OPERAÇÃO NEGADA: A saída deste veículo (Placa ${v.placa}) deve ser realizada pelo motorista que registrou a entrada: ${itemNoPatio.motorista}.`);
    }

    // Se for o motorista correto, registra a saída
    itemNoPatio.saida = new Date().toISOString();
    
    localStorage.setItem('registros', JSON.stringify(r));
    atualizarTudo();
    enviarParaGoogle('registros');
    alert(`✅ Saída confirmada para ${v.motorista}`);
}

//ABA - ENTRADA/SAÍDA --  Funções de Importação com verificação de erro aprimorada
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

function importarMovimentacao(input) {
    if (!input.files[0]) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const json = JSON.parse(e.target.result);
            if (!Array.isArray(json)) throw new Error("Formato inválido");
            localStorage.setItem('registros', JSON.stringify(json));
            atualizarTudo();
            enviarParaGoogle('registros');
            alert("✅ Importado e sincronizado!");
        } catch (err) { alert("❌ Arquivo inválido! Use um JSON gerado pelo sistema."); }
        input.value = "";
    };
    reader.readAsText(input.files[0]);
}

/*incio ABA ENTRADA/DAIDA -- parte que está export PDF/EXCEL quando abre o MODAL "historico" */
// Função Auxiliar para calcular permanência
function calcularPermanencia(entrada, saida) {
    if (!entrada || !saida) return "---";
    
    const diff = new Date(saida) - new Date(entrada);
    
    // Calcula horas, minutos e segundos totais
    const horas = Math.floor(diff / (1000 * 60 * 60));
    const minutos = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const segundos = Math.floor((diff % (1000 * 60)) / 1000); // Nova linha para segundos

    // Formata para garantir sempre 2 dígitos  HH:mm:ss
    const hFormatada = String(horas).padStart(2, '0');
    const mFormatada = String(minutos).padStart(2, '0');
    const sFormatada = String(segundos).padStart(2, '0');

    return `${hFormatada}:${mFormatada}:${sFormatada}`;
}

// --- EXPORTAR HISTÓRICO PARA EXCEL ---
function exportarHistoricoExcel() {
    const dados = JSON.parse(localStorage.getItem('registros') || '[]');
    if (dados.length === 0) return alert("Não há registros para exportar.");

    const dadosFormatados = dados.map(reg => ({
        'Motorista': reg.motorista,
        'Vínculo': reg.vinculo || '---',
        'Tipo': reg.tipo,
        'Placa': reg.placa,
        'Marca/Modelo': `${reg.marca} ${reg.modelo}`,
        'Cor': reg.cor,
        'Entrada': reg.entrada ? new Date(reg.entrada).toLocaleString() : '---',
        'Saída': reg.saida ? new Date(reg.saida).toLocaleString() : 'Ainda no Pátio',
        'Permanência': calcularPermanencia(reg.entrada, reg.saida)
    }));

    const ws = XLSX.utils.json_to_sheet(dadosFormatados);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Movimentação");
    XLSX.writeFile(wb, `Historico_Movimentacao_SEES.xlsx`);
}

// INICIO - ABA ENTRADA/SAÍDA--- EXPORTAR HISTÓRICO PARA PDF ---
function exportarHistoricoPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('l', 'mm', 'a4'); // Paisagem para caber todas as colunas
    const dados = JSON.parse(localStorage.getItem('registros') || '[]');

    doc.setFontSize(16);
    doc.text("Relatório Geral de Movimentação (Entradas e Saídas)", 14, 15);

    const rows = dados.map(reg => [
        reg.motorista,
        reg.vinculo || '---',
        reg.placa,
        `${reg.marca} ${reg.modelo}`,
        reg.entrada ? new Date(reg.entrada).toLocaleString('pt-BR', {hour:'2-digit', minute:'2-digit', day:'2-digit', month:'2-digit'}) : '---',
        reg.saida ? new Date(reg.saida).toLocaleString('pt-BR', {hour:'2-digit', minute:'2-digit', day:'2-digit', month:'2-digit'}) : 'Pátio',
        calcularPermanencia(reg.entrada, reg.saida)
    ]);

    doc.autoTable({
        startY: 25,
        head: [['Motorista', 'Vínculo', 'Placa', 'Marca/Modelo', 'Entrada', 'Saída', 'Permanência']],
        body: rows,
        theme: 'striped',
        styles: { fontSize: 8 },
        headStyles: { fillColor: [40, 40, 40] }
    });

    doc.save("Relatorio_Movimentacao_SEES.pdf");
}

// incio - ABA ENTRADA/SAÍDA----- EXPORTAR PÁTIO ATUAL (EXCEL) ---
function exportarPatioExcel() {
    const dados = JSON.parse(localStorage.getItem('registros') || '[]');
    const noPatio = dados.filter(reg => !reg.saida); // Apenas quem não saiu

    const dadosFormatados = noPatio.map(reg => ({
        'Motorista': reg.motorista,
        'Vínculo': reg.vinculo || '---',
        'Tipo': reg.tipo,
        'Placa': reg.placa,
        'Veículo': `${reg.marca} ${reg.modelo} (${reg.cor})`,
        'Hora Entrada': new Date(reg.entrada).toLocaleString()
    }));

    const ws = XLSX.utils.json_to_sheet(dadosFormatados);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pátio Atual");
    XLSX.writeFile(wb, `Veiculos_No_Patio_Agora.xlsx`);
}
// FIM - ABA ENTRADA/SAÍDA----- EXPORTAR PÁTIO ATUAL (EXCEL) ---
/*fim ABA ENTRADA/DAIDA -- parte que está export PDF/EXCEL quando abre o MODAL "historico" */

/*FIM ABA DADOS REF. ENTRADA/SAÍDA DE VEÍCULOS POR MOTORISTA*/



/*inicio ABA CADASTRO para registro de motorista e veículos*/
/**permanencia formata horário para HORA:MINUTOS:SEGUNDOS */
function atualizarTabelaRegistros() {
    const r = JSON.parse(localStorage.getItem('registros') || '[]');
    const corpo = document.getElementById('tabelaRegistros');
    if(!corpo) return;

    corpo.innerHTML = r.map((x, i) => {
        // AQUI ESTÁ O SEGREDO: Definir o tempo final para quem ainda não saiu
        const fim = x.saida ? x.saida : new Date().toISOString();
        
        // Chamar sua função e guardar o resultado numa variável
        const tempoPermanencia = calcularPermanencia(x.entrada, fim);

        return `
            <tr>
                <td>${x.motorista}</td>
                <td>${x.vinculo}</td>
                <td>${x.tipo}</td>
                <td><b>${x.placa}</b></td>
                <td>${x.marca}</td>
                <td>${x.modelo}</td>
                <td>${x.cor}</td>
                <td>${x.ano}</td>
                <td class="small">${new Date(x.entrada).toLocaleTimeString()}</td>
                <td class="small">${x.saida ? new Date(x.saida).toLocaleTimeString() : '<span class="badge bg-success">No Pátio</span>'}</td>
                <td class="fw-bold font-monospace text-center">${tempoPermanencia}</td>
                <td><button class="btn btn-sm btn-outline-danger" onclick="removerItem('registros', ${i})">🗑️</button></td>
            </tr>`;
    }).join('');
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
        ano: document.getElementById('cAno').value.trim()
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
    document.getElementById('tituloCadastro').innerText = "📝 Editando";
    document.getElementById('btnSalvar').innerText = "🔄 Atualizar";
    document.getElementById('btnCancelar').classList.remove('d-none');
}

function limparFormularioCadastro() {
    document.getElementById('cNome').value = ""; document.getElementById('cVinculo').value = "";
    document.getElementById('cPlaca').value = ""; document.getElementById('cMarca').value = ""; 
    document.getElementById('cModelo').value = ""; document.getElementById('cCor').value = ""; 
    document.getElementById('cAno').value = ""; document.getElementById('editIndex').value = "-1";
    document.getElementById('tituloCadastro').innerText = "Registrar Novo Veículo";
    document.getElementById('btnSalvar').innerText = "💾 Salvar";
    document.getElementById('btnCancelar').classList.add('d-none');
}

function atualizarTabelaCadastro() {
    let l = JSON.parse(localStorage.getItem('cadastroVeiculos') || '[]');
    const totalCarros = l.filter(v => (v.tipo || '').toLowerCase() === 'carro').length;
    const totalMotos = l.filter(v => (v.tipo || '').toLowerCase() === 'moto').length;
    
// Dentro da função atualizarTabelaCadastro
const elVagas = document.getElementById('contadorCadastrosVagas');
if (elVagas) {
    elVagas.innerHTML = `Total Cadastrados: <span class="fs-5">🚗</span> ${totalCarros} | <span class="fs-5">🏍️</span> ${totalMotos}`;
}
        
    document.getElementById('tabelaCadastro').innerHTML = l.map((v, i) => `
        <tr>
            <td>${v.motorista}</td><td><strong class="text-muted">${v.vinculo}</strong></td>
            <td>${v.tipo}</td><td><b>${v.placa}</b></td>
            <td>${v.marca}</td><td>${v.modelo}</td><td>${v.cor}</td><td>${v.ano}</td>
            <td>
                <button class="btn btn-sm btn-warning" onclick="editarCadastro(${i})">✏️</button>
                <button class="btn btn-sm btn-danger" onclick="removerItem('cadastroVeiculos', ${i})">🗑️</button>
            </td>
        </tr>`).join('');
}
/*inicio ABA CADASTRO para registro de motorista e veículos*/

/*inicio filtro ABA CADASTRO -- BUSCAR MOTORISTA/PLACA*/
function filtrarTabelaCadastro() {
    const termo = document.getElementById('buscaCadastro').value.toLowerCase();
    const l = JSON.parse(localStorage.getItem('cadastroVeiculos') || '[]');
    document.getElementById('tabelaCadastro').innerHTML = l.filter(v => v.motorista.toLowerCase().includes(termo) || v.placa.toLowerCase().includes(termo))
        .map((v, i) => `
            <tr>
                <td>${v.motorista}</td><td>${v.vinculo}</td>
                <td>${v.tipo}</td><td><b>${v.placa}</b></td>
                <td>${v.marca}</td><td>${v.modelo}</td><td>${v.cor}</td><td>${v.ano}</td>
                <td>
                    <button class="btn btn-sm btn-warning" onclick="editarCadastro(${i})">✏️</button>
                    <button class="btn btn-sm btn-danger" onclick="removerItem('cadastroVeiculos', ${i})">🗑️</button>
                </td>
            </tr>`).join('');
}

/*inicio função LIMPAR botão pesquisar motorista/placa*/
function limparBusca() {
    // 1. Localiza o campo de input
    const input = document.getElementById('buscaCadastro');
    
    // 2. Limpa o texto dentro dele
    input.value = "";
    
    // 3. Chama a função de filtrar (como o campo está vazio, ela mostrará todos os registros)
    filtrarTabelaCadastro();
    
    // 4. Coloca o foco de digitação de volta no campo (opcional, mas profissional)
    input.focus();
}
/*fim função LIMPAR botão pesquisar motorista/placa*/

/*fim filtro ABA CADASTRO -- BUSCAR MOTORISTA/PLACA*/


/*inicio ABA CADASTRO para RELATORIO dos registros de motorista e veículos*/
/*inicio relatorio de quantidade de veiculos por motorista*/
// Função para abrir o Modal de Total por Motorista
function exibirTotalPorMotorista() {
    const cadastros = JSON.parse(localStorage.getItem('cadastroVeiculos') || '[]');
    const corpoTabela = document.getElementById('corpoTotalMotorista');
    
    if (cadastros.length === 0) {
        return alert("Nenhum veículo cadastrado.");
    }

    // Limpar tabela antes de preencher
    corpoTabela.innerHTML = "";

    // 1. Agrupar os veículos por motorista
    const agrupado = {};
    cadastros.forEach(v => {
        const chave = v.motorista.toUpperCase();
        if (!agrupado[chave]) {
            agrupado[chave] = { 
                vinculo: v.vinculo || 'Não informado', 
                veiculos: [] 
            };
        }
        // Adiciona a descrição limpa do veículo
        // O jeito certo de "empurrar" o texto com as tags para a lista:
        agrupado[chave].veiculos.push(`${v.tipo}: <strong>${v.modelo}</strong> (<strong>${v.placa}</strong>) - <strong>${v.cor}</strong>`);
    });

    // 2. Transformar em lista e ordenar (quem tem mais veículos aparece primeiro)
    const listaOrdenada = Object.entries(agrupado).sort((a, b) => {
        return b[1].veiculos.length - a[1].veiculos.length;
    });

    // 3. Inserir as linhas na tabela do Modal
    listaOrdenada.forEach(([nome, dados]) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <strong>${nome}</strong><br>
                <small class="text-muted">${dados.vinculo}</small>
            </td>
            <td>
                ${dados.veiculos.join('<br>')}
            </td>
            <td class="text-center fw-bold">
                ${dados.veiculos.length}
            </td>
        `;
        corpoTabela.appendChild(tr);
    });

    // 4. Mostrar o Modal
    document.getElementById('modalTotalMotorista').style.display = 'block';
}

// Função para fechar o Modal
function fecharModalMotorista() {
    document.getElementById('modalTotalMotorista').style.display = 'none';
}

// Opcional: Fechar o modal se o usuário clicar fora da caixa branca
window.onclick = function(event) {
    const modalHist = document.getElementById('modalHistorico');
    const modalMot = document.getElementById('modalTotalMotorista');
    if (event.target == modalHist) modalHist.style.display = "none";
    if (event.target == modalMot) modalMot.style.display = "none";
}

/*INICIO EXPORT "PDV/EXCEL"relatorio de quantidade de veiculos por motorista*/
// Função auxiliar para preparar os dados (evita repetição de código)
function prepararDadosRelatorio() {
    const cadastros = JSON.parse(localStorage.getItem('cadastroVeiculos') || '[]');
    const agrupado = {};
    
    cadastros.forEach(v => {
        const chave = v.motorista.toUpperCase();
        if (!agrupado[chave]) {
            agrupado[chave] = { vinculo: v.vinculo || 'Não informado', veiculos: [] };
        }
        agrupado[chave].veiculos.push(`${v.tipo}: ${v.marca}, ${v.modelo} (${v.placa}) - ${v.cor}`);
    });

    return Object.entries(agrupado).sort((a, b) => b[1].veiculos.length - a[1].veiculos.length);
}

//ABA  CADASTRO  ---MODAL  EXPORTAR EXCEL ---
function baixarRelatorioMotoristaExcel() {
    const lista = prepararDadosRelatorio();
    const dadosExcel = lista.map(([nome, dados]) => ({
        'Motorista': nome,
        'Vínculo': dados.vinculo,
        'Veículos': dados.veiculos.join(' | '),
        'Total': dados.veiculos.length
    }));

    const ws = XLSX.utils.json_to_sheet(dadosExcel);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Relatorio");
    XLSX.writeFile(wb, `Relatorio_Veiculos_por_Motorista.xlsx`);
}

// ABA  CADASTRO  ---MODAL EXPORTAR PDF ---
function baixarRelatorioMotoristaPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const lista = prepararDadosRelatorio();

    //MODAL Título do PDF 
    doc.setFontSize(18);
    doc.text("Relatório: Veículos por Motorista", 14, 20);
    doc.setFontSize(10);
    doc.text(`Gerado em: ${new Date().toLocaleString()}`, 14, 28);

    // Formatar dados para a tabela do PDF
    const rows = lista.map(([nome, dados]) => [
        `${nome}\n(${dados.vinculo})`,
        dados.veiculos.join('\n'),
        dados.veiculos.length
    ]);

    doc.autoTable({
        startY: 35,
        head: [['Nome do Motorista', 'Veículos Cadastrados', 'Total']],
        body: rows,
        theme: 'grid',
        headStyles: { fillColor: [0, 123, 255] }, // Azul do sistema
        styles: { fontSize: 9, cellPadding: 3 },
        columnStyles: {
            2: { halign: 'center', fontStyle: 'bold' }
        }
    });

    doc.save(`Relatorio_Motoristas_SEES.pdf`);
}
/*fim relatorio de quantidade de veiculos por motorista*/

// ABA - CADASTRO -- 
function importarCadastros(input) {
    if (!input.files[0]) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const json = JSON.parse(e.target.result);
            if (!Array.isArray(json)) throw new Error("Formato inválido");
            localStorage.setItem('cadastroVeiculos', JSON.stringify(json));
            atualizarTudo();
            enviarParaGoogle('cadastroVeiculos');
            alert("✅ Importado e sincronizado!");
        } catch (err) { alert("❌ Arquivo inválido! Use um JSON gerado pelo sistema."); }
        input.value = "";
    };
    reader.readAsText(input.files[0]);
}


//CARREGAR DADOS DA PLANILHA PAR O navegador usando "GET" por padrão
async function carregarDadosDaNuvem() {
    console.log("Buscando dados na nuvem...");
    try {
        const response = await fetch(GOOGLE_API_URL);
        const nuvem = await response.json();

        // Verificação de segurança: só salva se houver dados na resposta
        if (nuvem.cadastroVeiculos && nuvem.cadastroVeiculos.length > 0) {
            localStorage.setItem('cadastroVeiculos', JSON.stringify(nuvem.cadastroVeiculos));
        }
        if (nuvem.registros && nuvem.registros.length > 0) {
            localStorage.setItem('registros', JSON.stringify(nuvem.registros));
        }
        
        atualizarTudo();
        console.log("Sincronização concluída!");
    } catch (err) {
        console.error("Erro ao baixar dados da nuvem (provavelmente vazia ou sem acesso GET):", err);
    }
}
