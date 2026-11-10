// export-csv.js — Exportação completa da esteira do Jantar para análise de Markov

import { getConcluidos } from "./storage.js";

/**
 * Converte os registros do jantar em string CSV com cabeçalho UTF-8 (BOM para Excel)
 */
export function gerarCsvString() {
  const registros = getConcluidos();

  if (registros.length === 0) {
    return null;
  }

  const cabecalhos = [
    "id",
    "numero_senha",
    "hora_chegada",
    "hora_inicio_catraca",
    "hora_passou_catraca",
    "hora_pegou_bandeja",
    "hora_saiu_comida",
    "espera_catraca_segundos",
    "servico_catraca_segundos",
    "espera_comida_segundos",
    "servico_comida_segundos",
    "tempo_total_segundos"
  ];

  const linhas = registros.map(r => {
    return [
      `"${r.id}"`,
      r.numero_senha,
      `"${r.ts_chegada || ''}"`,
      `"${r.ts_atend_catraca || ''}"`,
      `"${r.ts_fim_catraca || ''}"`,
      `"${r.ts_bandeja || ''}"`,
      `"${r.ts_saida || ''}"`,
      r.espera_catraca_seg !== null ? r.espera_catraca_seg : "",
      r.servico_catraca_seg !== null ? r.servico_catraca_seg : "",
      r.espera_comida_seg !== null ? r.espera_comida_seg : "",
      r.servico_comida_seg !== null ? r.servico_comida_seg : "",
      r.total_segundos !== null ? r.total_segundos : ""
    ].join(",");
  });

  return "\uFEFF" + [cabecalhos.join(","), ...linhas].join("\r\n");
}

/**
 * Dispara o download automático do CSV
 */
export function baixarCsv() {
  const csvContent = gerarCsvString();
  if (!csvContent) {
    alert("Nenhum registro concluído para exportar.");
    return false;
  }

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  const agora = new Date();
  const dataFormatada = agora.toISOString().slice(0, 10);

  link.setAttribute("href", url);
  link.setAttribute("download", `filas_ru_jantar_${dataFormatada}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return true;
}
