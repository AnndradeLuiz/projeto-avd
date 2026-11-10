// supabase-client.js — Sincronização em nuvem e painel de administração

import { SUPABASE_CONFIG } from "./config.js";
import { 
  getPendentesSync, 
  marcarRegistroComoSincronizado 
} from "./storage.js";

let client = null;
let estaSincronizando = false;

export function initSupabase() {
  if (!SUPABASE_CONFIG.url || !SUPABASE_CONFIG.anonKey) {
    return null;
  }
  if (window.supabase && !client) {
    try {
      client = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
    } catch (e) {
      console.warn("Falha ao inicializar Supabase:", e);
      client = null;
    }
  }
  return client;
}

export function isSupabaseConfigurado() {
  return Boolean(SUPABASE_CONFIG.url && SUPABASE_CONFIG.anonKey);
}

/**
 * Envia registros pendentes para o Supabase
 */
export async function sincronizarPendentes(onStatusChange = null) {
  if (estaSincronizando) return;
  if (!navigator.onLine) {
    if (onStatusChange) onStatusChange({ status: "offline", pendentes: getPendentesSync().length });
    return;
  }

  const supabase = initSupabase();
  if (!supabase) {
    if (onStatusChange) onStatusChange({ status: "local", pendentes: 0 });
    return;
  }

  const pendentes = getPendentesSync();
  if (pendentes.length === 0) {
    if (onStatusChange) onStatusChange({ status: "sincronizado", pendentes: 0 });
    return;
  }

  estaSincronizando = true;
  if (onStatusChange) onStatusChange({ status: "sincronizando", pendentes: pendentes.length });

  try {
    for (const item of pendentes) {
      const payload = {
        id: item.id,
        numero_senha: item.numero_senha,
        ts_chegada: item.ts_chegada,
        ts_atend_catraca: item.ts_atend_catraca,
        ts_fim_catraca: item.ts_fim_catraca,
        ts_bandeja: item.ts_bandeja,
        ts_saida: item.ts_saida,
        espera_catraca_seg: item.espera_catraca_seg,
        servico_catraca_seg: item.servico_catraca_seg,
        espera_comida_seg: item.espera_comida_seg,
        servico_comida_seg: item.servico_comida_seg,
        total_segundos: item.total_segundos,
        criado_em: item.criado_em
      };

      const { error } = await supabase
        .from(SUPABASE_CONFIG.tabela)
        .upsert([payload], { onConflict: "id" });

      if (error) {
        console.error("Erro no envio para Supabase:", error);
        break;
      } else {
        marcarRegistroComoSincronizado(item.id);
      }
    }
  } catch (err) {
    console.warn("Falha durante o sync:", err);
  } finally {
    estaSincronizando = false;
    const restantes = getPendentesSync().length;
    if (onStatusChange) {
      onStatusChange({
        status: restantes === 0 ? "sincronizado" : "pendente",
        pendentes: restantes
      });
    }
  }
}

/**
 * Ação de Admin: Limpa toda a tabela no Supabase
 */
export async function limparBancoSupabase() {
  const supabase = initSupabase();
  if (!supabase) {
    return { success: false, message: "Supabase não configurado." };
  }

  try {
    // Deleta todos os registros não nulos
    const { error } = await supabase
      .from(SUPABASE_CONFIG.tabela)
      .delete()
      .neq("id", "0");

    if (error) {
      return { success: false, message: error.message };
    }
    return { success: true };
  } catch (err) {
    return { success: false, message: err.message };
  }
}
