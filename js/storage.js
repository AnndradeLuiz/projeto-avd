// storage.js — Persistência offline-first do pipeline unificado do Jantar

const KEYS = {
  QUEUE_CATRACA: "filas_ru_catraca",
  SERVICE_CATRACA: "filas_ru_servico_catraca",
  QUEUE_COMIDA: "filas_ru_comida",
  SERVICE_COMIDA: "filas_ru_servico_comida",
  COMPLETED: "filas_ru_concluidos_jantar",
  COUNTER: "filas_ru_contador_senha",
  SYNC_QUEUE: "filas_ru_sync_pendentes"
};

// --- Senha sequencial (#1, #2, ...) ---
export function getProximaSenha() {
  const atual = parseInt(localStorage.getItem(KEYS.COUNTER) || "0", 10);
  const proxima = atual + 1;
  localStorage.setItem(KEYS.COUNTER, proxima.toString());
  return proxima;
}

// --- Leitura e Escrita das Etapas ---
export function getFilaCatraca() {
  const raw = localStorage.getItem(KEYS.QUEUE_CATRACA);
  return raw ? JSON.parse(raw) : [];
}

function salvarFilaCatraca(itens) {
  localStorage.setItem(KEYS.QUEUE_CATRACA, JSON.stringify(itens));
}

export function getServicoCatraca() {
  const raw = localStorage.getItem(KEYS.SERVICE_CATRACA);
  return raw ? JSON.parse(raw) : [];
}

function salvarServicoCatraca(itens) {
  localStorage.setItem(KEYS.SERVICE_CATRACA, JSON.stringify(itens));
}

export function getFilaComida() {
  const raw = localStorage.getItem(KEYS.QUEUE_COMIDA);
  return raw ? JSON.parse(raw) : [];
}

function salvarFilaComida(itens) {
  localStorage.setItem(KEYS.QUEUE_COMIDA, JSON.stringify(itens));
}

export function getServicoComida() {
  const raw = localStorage.getItem(KEYS.SERVICE_COMIDA);
  return raw ? JSON.parse(raw) : [];
}

function salvarServicoComida(itens) {
  localStorage.setItem(KEYS.SERVICE_COMIDA, JSON.stringify(itens));
}

// --- Histórico de Concluídos ---
export function getConcluidos() {
  const raw = localStorage.getItem(KEYS.COMPLETED);
  return raw ? JSON.parse(raw) : [];
}

function salvarConcluido(registro) {
  const todos = getConcluidos();
  todos.unshift(registro);
  localStorage.setItem(KEYS.COMPLETED, JSON.stringify(todos));
  adicionarFilaSync(registro);
}

// --- Sincronização Pendente ---
export function getPendentesSync() {
  const raw = localStorage.getItem(KEYS.SYNC_QUEUE);
  return raw ? JSON.parse(raw) : [];
}

function adicionarFilaSync(registro) {
  const pendentes = getPendentesSync();
  if (!pendentes.some(p => p.id === registro.id)) {
    pendentes.push(registro);
    localStorage.setItem(KEYS.SYNC_QUEUE, JSON.stringify(pendentes));
  }
}

export function marcarRegistroComoSincronizado(id) {
  const todos = getConcluidos();
  const index = todos.findIndex(r => r.id === id);
  if (index !== -1) {
    todos[index].sincronizado = true;
    localStorage.setItem(KEYS.COMPLETED, JSON.stringify(todos));
  }
  const pendentes = getPendentesSync().filter(p => p.id !== id);
  localStorage.setItem(KEYS.SYNC_QUEUE, JSON.stringify(pendentes));
}

// ==============================================================
// OPERAÇÕES DO FLUXO (ESTEIRA DO JANTAR)
// ==============================================================

/**
 * 1. Chegada na fila da Catraca (+ Chegou na Fila)
 */
export function registrarChegadaCatraca() {
  const senha = getProximaSenha();
  const novo = {
    id: `jantar_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    numero_senha: senha,
    ts_chegada: new Date().toISOString(),
    ts_atend_catraca: null,
    ts_fim_catraca: null,
    ts_bandeja: null,
    ts_saida: null,
    espera_catraca_seg: null,
    servico_catraca_seg: null,
    espera_comida_seg: null,
    servico_comida_seg: null,
    total_segundos: null,
    sincronizado: false,
    criado_em: new Date().toISOString()
  };

  const fila = getFilaCatraca();
  fila.push(novo);
  salvarFilaCatraca(fila);
  return novo;
}

/**
 * 2. Chegou a vez na Catraca -> Inicia atendimento no leitor/assinatura
 */
export function iniciarAtendimentoCatraca(id) {
  const fila = getFilaCatraca();
  const index = fila.findIndex(p => p.id === id);
  if (index === -1) return null;

  const [pessoa] = fila.splice(index, 1);
  pessoa.ts_atend_catraca = new Date().toISOString();

  // Tempo de espera na fila até a catraca (T_atend_catraca - T_chegada)
  const msEspera = new Date(pessoa.ts_atend_catraca) - new Date(pessoa.ts_chegada);
  pessoa.espera_catraca_seg = Math.max(0, Math.round(msEspera / 1000));

  salvarFilaCatraca(fila);

  const servicoCatraca = getServicoCatraca();
  servicoCatraca.push(pessoa);
  salvarServicoCatraca(servicoCatraca);

  return pessoa;
}

/**
 * 3. Confirmou QR / Assinou -> Passou da catraca e entra na Fila da Comida
 */
export function concluirCatraca(id) {
  const servico = getServicoCatraca();
  const index = servico.findIndex(p => p.id === id);
  if (index === -1) return null;

  const [pessoa] = servico.splice(index, 1);
  pessoa.ts_fim_catraca = new Date().toISOString();

  // Tempo de atendimento na catraca (leitor QR / assinatura)
  const msServicoCatraca = new Date(pessoa.ts_fim_catraca) - new Date(pessoa.ts_atend_catraca);
  pessoa.servico_catraca_seg = Math.max(0, Math.round(msServicoCatraca / 1000));

  salvarServicoCatraca(servico);

  // Entra na fila interna da comida
  const comida = getFilaComida();
  comida.push(pessoa);
  salvarFilaComida(comida);

  return pessoa;
}

/**
 * 4. Pegou Bandeja -> Move da Fila da Comida para Atendimento no Balcão
 */
export function pegarBandeja(id) {
  const comida = getFilaComida();
  const index = comida.findIndex(p => p.id === id);
  if (index === -1) return null;

  const [pessoa] = comida.splice(index, 1);
  pessoa.ts_bandeja = new Date().toISOString();

  // Espera na fila interna da comida (T_bandeja - T_fim_catraca)
  const msComida = new Date(pessoa.ts_bandeja) - new Date(pessoa.ts_fim_catraca);
  pessoa.espera_comida_seg = Math.max(0, Math.round(msComida / 1000));

  salvarFilaComida(comida);

  const servicoComida = getServicoComida();
  servicoComida.push(pessoa);
  salvarServicoComida(servicoComida);

  return pessoa;
}

/**
 * 5. Saiu com o Prato -> Conclui atendimento e salva registro histórico
 */
export function concluirPrato(id) {
  const servico = getServicoComida();
  const index = servico.findIndex(p => p.id === id);
  if (index === -1) return null;

  const [pessoa] = servico.splice(index, 1);
  pessoa.ts_saida = new Date().toISOString();

  // Tempo de serviço no balcão (T_saida - T_bandeja)
  const msServico = new Date(pessoa.ts_saida) - new Date(pessoa.ts_bandeja);
  pessoa.servico_comida_seg = Math.max(0, Math.round(msServico / 1000));

  // Tempo total no sistema do RU (T_saida - T_chegada)
  const msTotal = new Date(pessoa.ts_saida) - new Date(pessoa.ts_chegada);
  pessoa.total_segundos = Math.max(0, Math.round(msTotal / 1000));

  salvarServicoComida(servico);
  salvarConcluido(pessoa);

  return pessoa;
}

/**
 * Cancelamento de toque acidental em qualquer etapa
 */
export function cancelarPessoa(etapa, id) {
  if (etapa === "catraca_fila") {
    salvarFilaCatraca(getFilaCatraca().filter(p => p.id !== id));
  } else if (etapa === "catraca_atend") {
    salvarServicoCatraca(getServicoCatraca().filter(p => p.id !== id));
  } else if (etapa === "comida") {
    salvarFilaComida(getFilaComida().filter(p => p.id !== id));
  } else if (etapa === "servico") {
    salvarServicoComida(getServicoComida().filter(p => p.id !== id));
  }
}

/**
 * Limpeza total dos dados locais
 */
export function limparTodosOsDados() {
  localStorage.removeItem(KEYS.QUEUE_CATRACA);
  localStorage.removeItem(KEYS.SERVICE_CATRACA);
  localStorage.removeItem(KEYS.QUEUE_COMIDA);
  localStorage.removeItem(KEYS.SERVICE_COMIDA);
  localStorage.removeItem(KEYS.COMPLETED);
  localStorage.removeItem(KEYS.COUNTER);
  localStorage.removeItem(KEYS.SYNC_QUEUE);
}

/**
 * Resumo dos números ao vivo
 */
export function getMetricasAoVivo() {
  return {
    catracaFila: getFilaCatraca().length,
    catracaAtend: getServicoCatraca().length,
    filaComida: getFilaComida().length,
    balcao: getServicoComida().length,
    concluidos: getConcluidos().length
  };
}
