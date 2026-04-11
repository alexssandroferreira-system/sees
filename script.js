
    // --- CONFIGURAÇÃO GOOGLE SHEETS ---
    const GOOGLE_API_URL = "https://script.google.com/macros/s/AKfycbxSgnWz56Ys0oGyZF-JSuZFXn7RIOxQEA4Fer9kZRSavEpaB5G9hOwGrtPMvpAwugzXSA/exec";
    function enviarParaGoogle(key) {
        const dados = JSON.parse(localStorage.getItem(key) || '[]');
        
        // Envia via POST para o App Script
        fetch(GOOGLE_API_URL, {
            method: 'POST',
            mode: 'no-cors', // Importante para evitar erros de CORS do Google
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sheetName: key, // 'registros' ou 'cadastroVeiculos'
                data: dados
            })
        }).then(() => {
            console.log(`Dados de ${key} sincronizados com a nuvem.`);
        }).catch(err => console.error("Erro ao sincronizar:", err));
    }

    let chartCarros = null;
    let chartMotos = null;

    setInterval(() => document.getElementById('dataHora').innerText = new Date().toLocaleString('pt-BR'), 1000);

    window.onload = () => {
        const config = JSON.parse(localStorage.getItem('configVagas') || '{"carro":0, "moto":0}');
        document.getElementById('vCarro').value = config.carro;
        document.getElementById('vMoto').value = config.moto;
        atualizarTudo();
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

    function registrarEntrada() {
        const s = document.getElementById('selectMotorista').value;
        if (!s) return alert("Selecione um motorista!");
        let r = JSON.parse(localStorage.getItem('registros') || '[]');
        const v = JSON.parse(s);
        if (r.find(x => x.placa === v.placa && !x.saida)) return alert("Já está no pátio!");
        r.unshift({ ...v, entrada: new Date().toISOString(), saida: null });
        localStorage.setItem('registros', JSON.stringify(r));
        
        atualizarTudo();
        enviarParaGoogle('registros'); // SINCRONIZA
    }

    function registrarSaida() {
        const s = document.getElementById('selectMotorista').value;
        if (!s) return alert("Selecione o motorista!");
        const v = JSON.parse(s);
        let r = JSON.parse(localStorage.getItem('registros') || '[]');
        let item = r.find(x => x.placa === v.placa && !x.saida);
        if (!item) return alert("Não está no pátio!");
        item.saida = new Date().toISOString();
        localStorage.setItem('registros', JSON.stringify(r));
        
        atualizarTudo();
        enviarParaGoogle('registros'); // SINCRONIZA
    }

    function atualizarTabelaRegistros() {
        const r = JSON.parse(localStorage.getItem('registros') || '[]');
        const hoje = new Date().toLocaleDateString();
        const registrosFiltrados = r.filter(x => {
            const dataEntrada = new Date(x.entrada).toLocaleDateString();
            return !x.saida || dataEntrada === hoje;
        });

        document.getElementById('tabelaRegistros').innerHTML = registrosFiltrados.map((x, i) => `
            <tr>
                <td>${x.motorista}</td><td>${x.tipo}</td><td><b>${x.placa}</b></td>
                <td>${x.marca}</td><td>${x.modelo}</td><td>${x.cor}</td><td>${x.ano}</td>
                <td class="small">${new Date(x.entrada).toLocaleTimeString()}</td>
                <td class="small">${x.saida ? new Date(x.saida).toLocaleTimeString() : '<span class="badge-patio">No Pátio</span>'}</td>
                <td>${x.saida ? Math.round((new Date(x.saida) - new Date(x.entrada)) / 60000) + ' min' : '-'}</td>
                <td><button class="btn btn-sm btn-outline-danger" onclick="removerItem('registros', ${i})">🗑️</button></td>
            </tr>`).join('');
    }

    function salvarCadastro() {
        const index = parseInt(document.getElementById('editIndex').value);
        const d = {
            motorista: document.getElementById('cNome').value.trim(),
            tipo: document.getElementById('cTipo').value,
            placa: document.getElementById('cPlaca').value.trim().toUpperCase(),
            marca: document.getElementById('cMarca').value.trim(),
            modelo: document.getElementById('cModelo').value.trim(),
            cor: document.getElementById('cCor').value.trim(),
            ano: document.getElementById('cAno').value.trim()
        };
        if (!d.motorista || !d.placa) return alert("Preencha Nome e Placa!");
        let l = JSON.parse(localStorage.getItem('cadastroVeiculos') || '[]');
        if (index === -1) l.push(d); else l[index] = d;
        localStorage.setItem('cadastroVeiculos', JSON.stringify(l));
        
        limparFormularioCadastro();
        atualizarTudo();
        enviarParaGoogle('cadastroVeiculos'); // SINCRONIZA
    }

    function editarCadastro(i) {
        let l = JSON.parse(localStorage.getItem('cadastroVeiculos') || '[]');
        const v = l[i];
        document.getElementById('cNome').value = v.motorista;
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
        document.getElementById('cNome').value = ""; document.getElementById('cPlaca').value = "";
        document.getElementById('cMarca').value = ""; document.getElementById('cModelo').value = "";
        document.getElementById('cCor').value = ""; document.getElementById('cAno').value = "";
        document.getElementById('editIndex').value = "-1";
        document.getElementById('tituloCadastro').innerText = "Registrar Novo Veículo";
        document.getElementById('btnSalvar').innerText = "💾 Salvar";
        document.getElementById('btnCancelar').classList.add('d-none');
    }

    function atualizarTabelaCadastro() {
        let l = JSON.parse(localStorage.getItem('cadastroVeiculos') || '[]');
        document.getElementById('tabelaCadastro').innerHTML = l.map((v, i) => `
            <tr>
                <td>${v.motorista}</td><td>${v.tipo}</td><td><b>${v.placa}</b></td>
                <td>${v.marca}</td><td>${v.modelo}</td><td>${v.cor}</td><td>${v.ano}</td>
                <td>
                    <button class="btn btn-sm btn-warning" onclick="editarCadastro(${i})">✏️</button>
                    <button class="btn btn-sm btn-danger" onclick="removerItem('cadastroVeiculos', ${i})">🗑️</button>
                </td>
            </tr>`).join('');
    }

    function abrirHistorico() { document.getElementById('modalHistorico').style.display = 'block'; renderizarHistorico(); }
    function fecharHistorico() { document.getElementById('modalHistorico').style.display = 'none'; }
    
    function renderizarHistorico() {
        const r = JSON.parse(localStorage.getItem('registros') || '[]');
        const f = document.getElementById('filtroHistorico').value.toLowerCase();
        const hoje = new Date().toLocaleDateString();
        const historicoFiltrado = r.filter(x => {
            const dataEntrada = new Date(x.entrada).toLocaleDateString();
            const condicaoData = !x.saida || dataEntrada === hoje;
            const condicaoBusca = x.motorista.toLowerCase().includes(f) || x.placa.toLowerCase().includes(f);
            return condicaoData && condicaoBusca;
        });

        document.getElementById('corpoHistorico').innerHTML = historicoFiltrado.map(x => `
            <tr>
                <td>${new Date(x.entrada).toLocaleDateString()}</td>
                <td>${x.motorista}</td><td>${x.tipo}</td><td><b>${x.placa}</b></td>
                <td>${x.marca}</td><td>${x.modelo}</td><td>${x.cor}</td><td>${x.ano}</td>
                <td class="small">${new Date(x.entrada).toLocaleTimeString()}</td>
                <td class="small">${x.saida ? new Date(x.saida).toLocaleTimeString() : '---'}</td>
            </tr>`).join('');
    }

    function filtrarMotoristasEntrada() {
        const t = document.getElementById('buscaEntrada').value.toLowerCase();
        const l = JSON.parse(localStorage.getItem('cadastroVeiculos') || '[]');
        const s = document.getElementById('selectMotorista');
        s.innerHTML = '<option value="">Selecione...</option>';
        l.filter(v => v.motorista.toLowerCase().includes(t) || v.placa.toLowerCase().includes(t))
            .forEach(v => {
                let o = document.createElement('option');
                o.value = JSON.stringify(v); o.textContent = `${v.motorista} (${v.placa})`;
                s.appendChild(o);
            });
    }

    function preencherCamposEntrada() {
        const val = document.getElementById('selectMotorista').value;
        if (!val) return;
        const v = JSON.parse(val);
        document.getElementById('ePlaca').value = v.placa;
        document.getElementById('eTipo').value = v.tipo;
        document.getElementById('eMarca').value = v.marca;
        document.getElementById('eModelo').value = v.modelo;
        document.getElementById('eCor').value = v.cor;
        document.getElementById('eAno').value = v.ano;
    }

    function removerItem(key, i) {
        if (confirm('Excluir? Isso também atualizará a planilha após a próxima ação.')) {
            let l = JSON.parse(localStorage.getItem(key));
            l.splice(i, 1);
            localStorage.setItem(key, JSON.stringify(l));
            atualizarTudo();
            enviarParaGoogle(key); // SINCRONIZA A EXCLUSÃO
        }
    }

    function importarMovimentacao(input) {
        if (!input.files[0]) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const json = JSON.parse(e.target.result);
                localStorage.setItem('registros', JSON.stringify(json));
                atualizarTudo();
                enviarParaGoogle('registros');
                alert("✅ Importado e sincronizado!");
            } catch (err) { alert("❌ Erro no arquivo."); }
            input.value = "";
        };
        reader.readAsText(input.files[0]);
    }

    function importarCadastros(input) {
        if (!input.files[0]) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const json = JSON.parse(e.target.result);
                localStorage.setItem('cadastroVeiculos', JSON.stringify(json));
                atualizarTudo();
                enviarParaGoogle('cadastroVeiculos');
                alert("✅ Importado e sincronizado!");
            } catch (err) { alert("❌ Erro no arquivo."); }
            input.value = "";
        };
        reader.readAsText(input.files[0]);
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



async function carregarDadosDaNuvem() {
    console.log("Buscando dados na nuvem...");
    try {
        const response = await fetch(GOOGLE_API_URL); // O navegador faz um GET por padrão
        const nuvem = await response.json();

        if (nuvem.cadastroVeiculos) {
            localStorage.setItem('cadastroVeiculos', JSON.stringify(nuvem.cadastroVeiculos));
        }
        if (nuvem.registros) {
            localStorage.setItem('registros', JSON.stringify(nuvem.registros));
        }
        
        atualizarTudo();
        console.log("Sincronização concluída!");
    } catch (err) {
        console.error("Erro ao baixar dados:", err);
    }
}

// Altere o seu window.onload para incluir a busca
window.onload = () => {
    const config = JSON.parse(localStorage.getItem('configVagas') || '{"carro":0, "moto":0}');
    document.getElementById('vCarro').value = config.carro;
    document.getElementById('vMoto').value = config.moto;
    
    atualizarTudo();
    carregarDadosDaNuvem(); // Isso fará a mágica de puxar os dados do outro PC!
};
