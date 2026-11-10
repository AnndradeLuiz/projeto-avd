-- ==============================================================
-- SCHEMA DO BANCO DE DADOS SUPABASE — FILAS RU (UFOPA)
-- PIPELINE COMPLETO DO JANTAR COM ATENDIMENTO NA CATRACA
-- ==============================================================

CREATE TABLE IF NOT EXISTS public.registros_filas (
    id TEXT PRIMARY KEY,
    numero_senha INTEGER NOT NULL,
    ts_chegada TIMESTAMPTZ NOT NULL,
    ts_atend_catraca TIMESTAMPTZ,
    ts_fim_catraca TIMESTAMPTZ,
    ts_bandeja TIMESTAMPTZ,
    ts_saida TIMESTAMPTZ,
    espera_catraca_seg INTEGER,
    servico_catraca_seg INTEGER,
    espera_comida_seg INTEGER,
    servico_comida_seg INTEGER,
    total_segundos INTEGER,
    criado_em TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- Índices para buscas rápidas
CREATE INDEX IF NOT EXISTS idx_registros_jantar_ts_chegada ON public.registros_filas (ts_chegada DESC);

-- Habilitar RLS
ALTER TABLE public.registros_filas ENABLE ROW LEVEL SECURITY;

-- Política de acesso público
CREATE POLICY "Permitir operacoes publicas" 
ON public.registros_filas 
FOR ALL 
USING (true)
WITH CHECK (true);
