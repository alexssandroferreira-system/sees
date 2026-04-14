// --- IMPORTAÇÕES DO FIREBASE (Certifique-se de carregar o Firebase no HTML antes deste script) ---
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyC_fyeWOZVJu0ENa5SUZiRabb3Y0Dnngtc",
  authDomain: "sees-ap.firebaseapp.com",
  projectId: "sees-ap",
  storageBucket: "sees-ap.firebasestorage.app",
  messagingSenderId: "963892404731",
  appId: "1:963892404731:web:4e9a0ab61de8c07ecbeb5e",
  measurementId: "G-Z21ENCCBTF"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);

  // Torna o 'db' acessível para suas funções globais
  window.db = db;

import { 
    getFirestore, collection, addDoc, getDocs, doc, setDoc, query, orderBy, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const db = getFirestore();

// --- FUNÇÃO SUBSTITUTA DO GOOGLE SHEETS PARA FIRESTORE ---
async function enviarParaFirebase(key) {
    const dados = JSON.parse(localStorage.getItem(key) || '[]');
    const nomeAmigavel = key === 'registros' ? 'Entrada/Saída' : 'Cadastro de Veículos';

    try {
        if (key === 'cadastroVeiculos') {
            // No cadastro, usamos a PLACA como ID único para evitar duplicidade
            for (const item of dados) {
                await setDoc(doc(db, "cadastroVeiculos", item.placa), item);
            }
        } else {
            // Nos registros (movimentação), adicionamos novos documentos
            // Nota: Para um sistema real, o ideal é salvar no Firestore no momento do clique.
            // Aqui estamos sincronizando o lote do localStorage.
            for (const item of dados) {
                // Criamos um ID baseado na placa + entrada para evitar duplicar o mesmo registro na nuvem
                const idRegistro = `${item.placa}_${item.entrada.replace(/[:.]/g, '-')}`;
                await setDoc(doc(db, "registros", idRegistro), item);
            }
        }
        console.log(`✅ Sincronizado com Firestore: ${key}`);
    } catch (err) {
        console.error("Erro ao sincronizar com Firestore:", err);
    }
}

// --- CARREGAR DADOS DO FIRESTORE ---
async function carregarDadosDaNuvem() {
    console.log("📡 Buscando dados no Firestore...");
    try {
        // Carregar Cadastros
        const snapCad = await getDocs(collection(db, "cadastroVeiculos"));
        const listaCad = snapCad.docs.map(doc => doc.data());
        if (listaCad.length > 0) localStorage.setItem('cadastroVeiculos', JSON.stringify(listaCad));

        // Carregar Registros
        const snapReg = await getDocs(collection(db, "registros"));
        const listaReg = snapReg.docs.map(doc => doc.data());
        if (listaReg.length > 0) {
            // Ordenar por data de entrada decrescente (mais recentes primeiro)
            listaReg.sort((a, b) => new Date(b.entrada) - new Date(a.entrada));
            localStorage.setItem('registros', JSON.stringify(listaReg));
        }
        
        atualizarTudo();
        console.log("✅ Dados da nuvem carregados com sucesso!");
    } catch (err) {
        console.error("Erro ao baixar dados do Firestore:", err);
    }
}

// --- AJUSTE NAS FUNÇÕES DE SALVAMENTO PARA CHAMAR O FIREBASE ---

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
    enviarParaFirebase('cadastroVeiculos'); // MUDOU AQUI
}

function registrarEntrada() {
    const s = document.getElementById('selectMotorista').value;
    if (!s) return alert("❌ Selecione um motorista!");

    const v = JSON.parse(s);
    let r = JSON.parse(localStorage.getItem('registros') || '[]');

    const veiculoNoPatio = r.find(x => x.placa === v.placa && !x.saida);
    if (veiculoNoPatio) {
        return alert(`⚠️ BLOQUEIO: Este veículo (Placa ${v.placa}) já está no pátio.`);
    }

    r.unshift({ ...v, entrada: new Date().toISOString(), saida: null });
    localStorage.setItem('registros', JSON.stringify(r));
    atualizarTudo();
    enviarParaFirebase('registros'); // MUDOU AQUI
    alert(`✅ Entrada liberada: ${v.motorista}`);
}

function registrarSaida() {
    const s = document.getElementById('selectMotorista').value;
    if (!s) return alert("❌ Selecione o motorista!");

    const v = JSON.parse(s);
    let r = JSON.parse(localStorage.getItem('registros') || '[]');

    let itemNoPatio = r.find(x => x.placa === v.placa && !x.saida);
    if (!itemNoPatio) return alert("❌ Erro: Veículo não está no pátio.");

    if (itemNoPatio.motorista !== v.motorista) {
        return alert(`❌ NEGADO: Saída deve ser feita por ${itemNoPatio.motorista}.`);
    }

    itemNoPatio.saida = new Date().toISOString();
    localStorage.setItem('registros', JSON.stringify(r));
    atualizarTudo();
    enviarParaFirebase('registros'); // MUDOU AQUI
    alert(`✅ Saída confirmada.`);
}

function removerItem(key, i) {
    if (confirm('Excluir permanentemente?')) {
        let l = JSON.parse(localStorage.getItem(key));
        l.splice(i, 1);
        localStorage.setItem(key, JSON.stringify(l));
        atualizarTudo();
        enviarParaFirebase(key); // Sincroniza a exclusão
    }
}

// --- MANUTENÇÃO DAS FUNÇÕES VISUAIS (GRÁFICOS, TABELAS, ETC) ---

let chartCarros = null;
let chartMotos = null;

setInterval(() => {
    const el = document.getElementById('dataHora');
    if (el) el.innerText = new Date().toLocaleString('pt-BR');
}, 1000);

window.onload = () => {
    const config = JSON.parse(localStorage.getItem('configVagas') || '{"carro":0, "moto":0}');
    if (document.getElementById('vCarro')) document.getElementById('vCarro').value = config.carro;
    if (document.getElementById('vMoto')) document.getElementById('vMoto').value = config.moto;
    
    atualizarTudo();
    carregarDadosDaNuvem(); 
};

function atualizarTudo() {
    atualizarTabelaCadastro();
    atualizarTabelaRegistros();
    atualizarGraficos();
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

// Funções de Tabela e Filtros permanecem iguais, apenas garantindo a leitura do localStorage atualizado
function atualizarTabelaRegistros() {
    const r = JSON.parse(localStorage.getItem('registros') || '[]');
    const corpo = document.getElementById('tabelaRegistros');
    if(!corpo) return;

    corpo.innerHTML = r.map((x, i) => {
        const fim = x.saida ? x.saida : new Date().toISOString();
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

function calcularPermanencia(entrada, saida) {
    if (!entrada || !saida) return "---";
    const diff = new Date(saida) - new Date(entrada);
    const horas = Math.floor(diff / (1000 * 60 * 60));
    const minutos = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const segundos = Math.floor((diff % (1000 * 60)) / 1000);
    return `${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}:${String(segundos).padStart(2, '0')}`;
}

// Torna as funções acessíveis globalmente já que usamos type="module"
window.removerItem = removerItem;
window.editarCadastro = editarCadastro;
window.registrarEntrada = registrarEntrada;
window.registrarSaida = registrarSaida;
window.salvarCadastro = salvarCadastro;
window.exibirTotalPorMotorista = exibirTotalPorMotorista;
window.limparBusca = () => { document.getElementById('buscaCadastro').value = ''; filtrarTabelaCadastro(); };
