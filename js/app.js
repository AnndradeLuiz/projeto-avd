// app.js — Controlador Principal da Esteira Unificada do Jantar (com Atendimento na Catraca)

import { 
  getFilaCatraca, 
  getServicoCatraca,
  getFilaComida, 
  getServicoComida, 
  getConcluidos, 
  getPendentesSync,
  registrarChegadaCatraca, 
  iniciarAtendimentoCatraca,
  concluirCatraca, 
  pegarBandeja, 
  concluirPrato, 
  cancelarPessoa,
  limparTodosOsDados,
  getMetricasAoVivo
} from "./storage.js";

import { sincronizarPendentes, limparBancoSupabase } from "./supabase-client.js";
import { baixarCsv } from "./export-csv.js";

let timerLoopId = null;

// ==============================================================
// NAVEGAÇÃO ENTRE OPERAÇÃO E ADMIN
// ==============================================================
function navegarPara(viewId) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  const destino = document.getElementById(viewId);
  if (destino) {
    destino.classList.add("active");
    window.scrollTo(0, 0);
  }

  if (viewId === "view-operacao") {
    renderizarOperacao();
  } else if (viewId === "view-admin") {
    renderizarAdmin();
  }
}

// ==============================================================
// FORMATADORES
// ==============================================================
function formatarHora(isoString) {
  if (!isoString) return "--:--:--";
  const d = new Date(isoString);
  const pad = n => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function formatarDuracao(segundos) {
  if (segundos === null || segundos === undefined || isNaN(segundos)) return "00:00";
  const m = Math.floor(segundos / 60);
  const s = Math.floor(segundos % 60);
  const pad = n => String(n).padStart(2, "0");
  return `${pad(m)}:${pad(s)}`;
}

function vibrarLeve() {
  if ("vibrate" in navigator) {
    try { navigator.vibrate(35); } catch (_) {}
  }
}

// ==============================================================
// SINCRONIZAÇÃO
// ==============================================================
function atualizarIndicadoresSync(info = null) {
  const pendentes = info ? info.pendentes : getPendentesSync().length;
  const pillOp = document.getElementById("sync-pill");
  const pillAdm = document.getElementById("admin-sync-pill");

  const texto = pendentes > 0 ? `${pendentes} pendente${pendentes > 1 ? "s" : ""}` : "Tudo salvo";
  const classe = pendentes > 0 ? "sync-pill pending" : "sync-pill synced";

  if (pillOp) { pillOp.textContent = texto; pillOp.className = classe; }
  if (pillAdm) { pillAdm.textContent = texto; pillAdm.className = classe; }
}

function dispararSincronizacao() {
  sincronizarPendentes((statusInfo) => {
    atualizarIndicadoresSync(statusInfo);
  });
}

// ==============================================================
// RENDERIZAÇÃO DA OPERAÇÃO (ESTEIRA DO JANTAR)
// ==============================================================
function renderizarOperacao() {
  const agora = Date.now();
  const metricas = getMetricasAoVivo();

  // 1. Atualizar métricas na faixa superior
  document.getElementById("stat-catraca-fila").textContent = metricas.catracaFila;
  document.getElementById("stat-catraca-atend").textContent = metricas.catracaAtend;
  document.getElementById("stat-fila-comida").textContent = metricas.filaComida;
  document.getElementById("stat-balcao").textContent = metricas.balcao;

  document.getElementById("count-catraca-total").textContent = `${metricas.catracaFila + metricas.catracaAtend} pessoas`;
  document.getElementById("count-comida").textContent = `${metricas.filaComida} aguardando`;
  document.getElementById("count-balcao").textContent = `${metricas.balcao} servindo`;

  // 2. ETAPA 1A: No Leitor / Validando agora
  const catracaAtendItens = getServicoCatraca();
  const elCatracaAtend = document.getElementById("lista-catraca-atend");
  if (catracaAtendItens.length === 0) {
    elCatracaAtend.innerHTML = `<div class="empty-state" style="padding:12px;">Ninguém no leitor no momento</div>`;
  } else {
    elCatracaAtend.innerHTML = catracaAtendItens.map(item => {
      const seg = Math.max(0, Math.floor((agora - new Date(item.ts_atend_catraca).getTime()) / 1000));
      return `
        <div class="person-row" style="background-color: #FFFDF9;">
          <div class="person-ticket">#${item.numero_senha}</div>
          <div class="person-info">
            <div class="person-time">Iniciou validação às ${formatarHora(item.ts_atend_catraca)}</div>
            <div class="person-waiting mono-num" data-ts-ref="${item.ts_atend_catraca}">
              validando há ${formatarDuracao(seg)}
            </div>
          </div>
          <div style="display:flex; align-items:center;">
            <button class="btn-advance catraca btn-concluir-catraca" data-id="${item.id}" type="button">
              Passou Catraca ›
            </button>
            <button class="btn-cancel btn-cancelar" data-etapa="catraca_atend" data-id="${item.id}" title="Cancelar" type="button">✕</button>
          </div>
        </div>
      `;
    }).join("");
  }

  // 3. ETAPA 1B: Fila da Catraca (Aguardando vez)
  const catracaFilaItens = getFilaCatraca();
  const elCatracaFila = document.getElementById("lista-catraca-fila");
  if (catracaFilaItens.length === 0) {
    elCatracaFila.innerHTML = `<div class="empty-state">Fila da catraca vazia</div>`;
  } else {
    elCatracaFila.innerHTML = catracaFilaItens.map(item => {
      const seg = Math.max(0, Math.floor((agora - new Date(item.ts_chegada).getTime()) / 1000));
      return `
        <div class="person-row">
          <div class="person-ticket">#${item.numero_senha}</div>
          <div class="person-info">
            <div class="person-time">Chegou às ${formatarHora(item.ts_chegada)}</div>
            <div class="person-waiting mono-num" data-ts-ref="${item.ts_chegada}">
              esperando ${formatarDuracao(seg)}
            </div>
          </div>
          <div style="display:flex; align-items:center;">
            <button class="btn-advance bandeja btn-iniciar-catraca" data-id="${item.id}" type="button">
              No Leitor ›
            </button>
            <button class="btn-cancel btn-cancelar" data-etapa="catraca_fila" data-id="${item.id}" title="Cancelar" type="button">✕</button>
          </div>
        </div>
      `;
    }).join("");
  }

  // 4. ETAPA 2: Fila da Comida (Espera interna)
  const comidaItens = getFilaComida();
  const elComida = document.getElementById("lista-comida");
  if (comidaItens.length === 0) {
    elComida.innerHTML = `<div class="empty-state">Ninguém aguardando a comida</div>`;
  } else {
    elComida.innerHTML = comidaItens.map(item => {
      const seg = Math.max(0, Math.floor((agora - new Date(item.ts_fim_catraca).getTime()) / 1000));
      return `
        <div class="person-row">
          <div class="person-ticket">#${item.numero_senha}</div>
          <div class="person-info">
            <div class="person-time">Passou catraca às ${formatarHora(item.ts_fim_catraca)}</div>
            <div class="person-waiting mono-num" data-ts-ref="${item.ts_fim_catraca}">
              na fila interna ${formatarDuracao(seg)}
            </div>
          </div>
          <div style="display:flex; align-items:center;">
            <button class="btn-advance bandeja btn-pegar-bandeja" data-id="${item.id}" type="button">
              Pegou Bandeja ›
            </button>
            <button class="btn-cancel btn-cancelar" data-etapa="comida" data-id="${item.id}" title="Cancelar" type="button">✕</button>
          </div>
        </div>
      `;
    }).join("");
  }

  // 5. ETAPA 3: Balcão / Servindo
  const balcaoItens = getServicoComida();
  const elBalcao = document.getElementById("lista-balcao");
  if (balcaoItens.length === 0) {
    elBalcao.innerHTML = `<div class="empty-state">Ninguém pegando comida agora</div>`;
  } else {
    elBalcao.innerHTML = balcaoItens.map(item => {
      const seg = Math.max(0, Math.floor((agora - new Date(item.ts_bandeja).getTime()) / 1000));
      return `
        <div class="person-row">
          <div class="person-ticket">#${item.numero_senha}</div>
          <div class="person-info">
            <div class="person-time">Pegou bandeja às ${formatarHora(item.ts_bandeja)}</div>
            <div class="person-serving mono-num" data-ts-ref="${item.ts_bandeja}">
              se servindo há ${formatarDuracao(seg)}
            </div>
          </div>
          <div style="display:flex; align-items:center;">
            <button class="btn-advance concluir btn-concluir-prato" data-id="${item.id}" type="button">
              Saiu com o Prato ✓
            </button>
            <button class="btn-cancel btn-cancelar" data-etapa="servico" data-id="${item.id}" title="Cancelar" type="button">✕</button>
          </div>
        </div>
      `;
    }).join("");
  }

  // BIND DOS EVENTOS
  document.querySelectorAll(".btn-iniciar-catraca").forEach(btn => {
    btn.onclick = () => {
      vibrarLeve();
      iniciarAtendimentoCatraca(btn.dataset.id);
      renderizarOperacao();
    };
  });

  document.querySelectorAll(".btn-concluir-catraca").forEach(btn => {
    btn.onclick = () => {
      vibrarLeve();
      concluirCatraca(btn.dataset.id);
      renderizarOperacao();
    };
  });

  document.querySelectorAll(".btn-pegar-bandeja").forEach(btn => {
    btn.onclick = () => {
      vibrarLeve();
      pegarBandeja(btn.dataset.id);
      renderizarOperacao();
    };
  });

  document.querySelectorAll(".btn-concluir-prato").forEach(btn => {
    btn.onclick = () => {
      vibrarLeve();
      concluirPrato(btn.dataset.id);
      renderizarOperacao();
      dispararSincronizacao();
    };
  });

  document.querySelectorAll(".btn-cancelar").forEach(btn => {
    btn.onclick = () => {
      if (confirm("Deseja cancelar este registro inserido por engano?")) {
        cancelarPessoa(btn.dataset.etapa, btn.dataset.id);
        renderizarOperacao();
      }
    };
  });

  atualizarIndicadoresSync();
}

// ==============================================================
// RENDERIZAÇÃO DO PAINEL DE ADMINISTRAÇÃO
// ==============================================================
function renderizarAdmin() {
  const concluidos = getConcluidos();
  const total = concluidos.length;

  document.getElementById("admin-total-concluidos").textContent = total;

  if (total > 0) {
    const somaTotal = concluidos.reduce((acc, r) => acc + (r.total_segundos || 0), 0);
    const somaCatracaEspera = concluidos.reduce((acc, r) => acc + (r.espera_catraca_seg || 0), 0);
    const somaCatracaServico = concluidos.reduce((acc, r) => acc + (r.servico_catraca_seg || 0), 0);
    const somaComidaEspera = concluidos.reduce((acc, r) => acc + (r.espera_comida_seg || 0), 0);
    const somaComidaServico = concluidos.reduce((acc, r) => acc + (r.servico_comida_seg || 0), 0);

    document.getElementById("admin-media-total").textContent = formatarDuracao(Math.round(somaTotal / total));
    document.getElementById("admin-media-catraca-espera").textContent = formatarDuracao(Math.round(somaCatracaEspera / total));
    document.getElementById("admin-media-catraca-servico").textContent = formatarDuracao(Math.round(somaCatracaServico / total));
    document.getElementById("admin-media-comida-espera").textContent = formatarDuracao(Math.round(somaComidaEspera / total));
    document.getElementById("admin-media-comida-servico").textContent = formatarDuracao(Math.round(somaComidaServico / total));
  } else {
    document.getElementById("admin-media-total").textContent = "00:00";
    document.getElementById("admin-media-catraca-espera").textContent = "00:00";
    document.getElementById("admin-media-catraca-servico").textContent = "00:00";
    document.getElementById("admin-media-comida-espera").textContent = "00:00";
    document.getElementById("admin-media-comida-servico").textContent = "00:00";
  }

  // Tabela
  const tbody = document.getElementById("tabela-admin-body");
  if (total === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 20px; color: var(--text-muted); font-family: inherit;">
          Nenhum registro finalizado ainda.
        </td>
      </tr>
    `;
  } else {
    const amostra = concluidos.slice(0, 30);
    tbody.innerHTML = amostra.map(r => `
      <tr>
        <td style="font-weight: 700;">#${r.numero_senha}</td>
        <td>${formatarHora(r.ts_chegada)}</td>
        <td>${formatarHora(r.ts_atend_catraca)}</td>
        <td>${formatarHora(r.ts_fim_catraca)}</td>
        <td>${formatarHora(r.ts_bandeja)}</td>
        <td>${formatarHora(r.ts_saida)}</td>
        <td style="font-weight: 700; color: var(--accent);">${formatarDuracao(r.total_segundos)}</td>
      </tr>
    `).join("");
  }

  atualizarIndicadoresSync();
}

// ==============================================================
// LOOP CONTÍNUO DO CRONÔMETRO (A CADA SEGUNDO)
// ==============================================================
function iniciarLoopRelogio() {
  if (timerLoopId) clearInterval(timerLoopId);
  timerLoopId = setInterval(() => {
    const d = new Date();
    const pad = n => String(n).padStart(2, "0");
    const elRelogio = document.getElementById("relogio-atual");
    if (elRelogio) {
      elRelogio.textContent = `Jantar · Hoje ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    }

    const agora = Date.now();
    document.querySelectorAll("[data-ts-ref]").forEach(el => {
      const ts = el.dataset.tsRef;
      if (ts) {
        const seg = Math.max(0, Math.floor((agora - new Date(ts).getTime()) / 1000));
        let prefixo = "esperando";
        if (el.textContent.includes("validando")) prefixo = "validando há";
        else if (el.textContent.includes("interna")) prefixo = "na fila interna";
        else if (el.classList.contains("person-serving")) prefixo = "se servindo há";

        el.textContent = `${prefixo} ${formatarDuracao(seg)}`;
      }
    });
  }, 1000);
}

// ==============================================================
// INICIALIZAÇÃO
// ==============================================================
window.addEventListener("DOMContentLoaded", () => {
  // Botão fixo no polegar: + Chegou na Catraca
  document.getElementById("btn-chegou-catraca").addEventListener("click", () => {
    vibrarLeve();
    registrarChegadaCatraca();
    renderizarOperacao();
  });

  // Abertura e retorno do Admin
  document.getElementById("btn-abrir-admin").addEventListener("click", () => {
    navegarPara("view-admin");
  });
  document.getElementById("btn-voltar-operacao").addEventListener("click", () => {
    navegarPara("view-operacao");
  });

  // Exportar CSV
  document.getElementById("btn-exportar-csv").addEventListener("click", () => {
    baixarCsv();
  });

  // Limpeza de dados locais
  document.getElementById("btn-limpar-local").addEventListener("click", () => {
    if (confirm("Atenção: deseja realmente limpar TODOS os dados locais da esteira e zerar as filas?")) {
      limparTodosOsDados();
      renderizarOperacao();
      renderizarAdmin();
      alert("Esteira reiniciada e dados locais limpos!");
    }
  });

  // Limpeza no Supabase
  document.getElementById("btn-limpar-supabase").addEventListener("click", async () => {
    if (confirm("Atenção: deseja realmente APAGAR TODOS os registros do Supabase (Nuvem)?")) {
      const res = await limparBancoSupabase();
      if (res.success) {
        alert("Todos os registros foram apagados do Supabase com sucesso!");
        atualizarIndicadoresSync();
      } else {
        alert("Erro ao limpar Supabase: " + res.message);
      }
    }
  });

  // Iniciar relógio e renderizar tela inicial
  iniciarLoopRelogio();
  navegarPara("view-operacao");

  // Sincronização periódica
  setInterval(dispararSincronizacao, 30000);
  window.addEventListener("online", dispararSincronizacao);
});
