# Especificação Técnica — Sistema de Coleta Filas RU (UFOPA)

**Projeto:** Mini-aplicação web para contagem e cronometragem de filas do Restaurante Universitário da UFOPA  
**Finalidade:** Obtenção de dados empíricos para modelagem e análise por Cadeias de Markov (Disciplina de Avaliação de Desempenho)  
**Data:** 10 de Novembro de 2026  
**Status:** Aprovado  

---

## 1. Contexto e Motivação

Para o estudo de processos estocásticos e redes de filas (Tandem Queues / Jackson Networks) aplicados ao Restaurante Universitário da UFOPA, o sistema registra os 5 marcos temporais de cada aluno:
1. $T_{\text{chegada}}$: Chegada na fila de fora da catraca.
2. $T_{\text{atend\_catraca}}$: Chegada ao leitor / início da tentativa de bipar QR Code ou assinar lista.
3. $T_{\text{fim\_catraca}}$: Liberação da catraca / entrada no refeitório ($T_{\text{fim\_catraca}} = T_{\text{entrada\_comida}}$).
4. $T_{\text{bandeja}}$: Retirada da bandeja / início do atendimento no balcão de refeições.
5. $T_{\text{saída}}$: Término de servir a refeição e saída em direção às mesas.

A partir dessas marcações, calcula-se com exatidão:
- **Espera na Catraca ($W_{q1}$):** $T_{\text{atend\_catraca}} - T_{\text{chegada}}$
- **Serviço da Catraca ($S_1$):** $T_{\text{fim\_catraca}} - T_{\text{atend\_catraca}}$ (mede falhas de leitor, assinatura de lista, etc.)
- **Espera na Fila da Comida ($W_{q2}$):** $T_{\text{bandeja}} - T_{\text{fim\_catraca}}$
- **Serviço da Comida ($S_2$):** $T_{\text{saída}} - T_{\text{bandeja}}$
- **Tempo Total no Sistema ($W$):** $T_{\text{saída}} - T_{\text{chegada}}$

---

## 2. Escopo e Esteira Unificada do Jantar

O sistema opera no modelo de **esteira contínua (pipeline tandem)** em uma única tela de rolagem para o Jantar:
1. **Etapa 1 — Fila da Catraca:** Fila externa de espera para passar na catraca de leitura do QR Code.
2. **Etapa 2 — Fila da Comida:** Fila interna do refeitório (quem passou na catraca e aguarda a vez de pegar a bandeja).
3. **Etapa 3 — Balcão (Servindo):** Momento em que a pessoa pega a bandeja, se serve e sai em direção às mesas.

---

## 3. Objetivos, Não-Objetivos e Anti-Objetivos

### Objetivos
- **Operação por um único observador:** Controle de todas as fases na mesma tela rolando a página.
- **Sem perfil de usuário:** Acesso direto à esteira sem etapa de identificação/login.
- **Painel de Administração separado:** Concentra exportação CSV, métricas consolidadas e opções de limpeza/reset.
- **Tolerância total a falhas de rede:** Arquitetura *offline-first* via `localStorage` com envio assíncrono ao Supabase.
- **Exportação limpa em formato `.csv`:** Contendo todos os 4 timestamps e durações de cada intervalo para Cadeias de Markov.

### Não-Objetivos
- Autenticação complexa com senha, recuperação de conta ou permissões RBAC.
- Rastreamento individual cruzado da mesma pessoa entre filas diferentes (as filas são tratadas como independentes para o escopo do trabalho).
- Recursos complexos de edição de histórico em tempo real além de cancelamento de registro errôneo.

### Anti-Objetivos
- Dependência estrita de internet ativa para registrar tempos (o app não pode travar ou perder dados se a rede oscilar).
- Interfaces sobrecarregadas com gráficos pesados ou elementos desnecessários durante a coleta.

---

## 4. Arquitetura e Stack Técnica

```
                    ┌───────────────────────────────────┐
                    │      Navegador (Celular/PC)       │
                    │   HTML5 / CSS3 Puro / Vanilla JS  │
                    └─────────────────┬─────────────────┘
                                      │
                         (1) Gravação imediata síncrona
                                      │
                                      ▼
                    ┌───────────────────────────────────┐
                    │           localStorage            │
                    │     (Resistente a reload/queda)   │
                    └─────────────────┬─────────────────┘
                                      │
                    (2) Sync assíncrono (quando online)
                                      ▼
                    ┌───────────────────────────────────┐
                    │         Supabase Cloud            │
                    │      (PostgreSQL Relacional)      │
                    └───────────────────────────────────┘
```

- **Frontend:** HTML5 semântico, CSS3 com variáveis nativas e Vanilla JS modular (sem necessidade de bundlers como Webpack/Vite para facilitar execução direta).
- **Armazenamento Local:** `localStorage` persistindo estado das filas, fila de sincronização (*sync queue*) e registros concluídos.
- **Backend / Nuvem:** Supabase JS SDK (carregado via CDN).
- **Compatibilidade:** Totalmente responsivo para navegadores mobile (Safari iOS, Chrome Android) e desktop.

---

## 5. Modelo de Dados

### Tabela / Estrutura do Registro (`registros_filas`)

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | String / UUID | Identificador único do registro (gerado localmente com prefixo ou UUID) |
| `numero_senha` | Integer | Número sequencial de identificação na sessão do observador (ex: 24, 25...) |
| `observador` | String | Nome do aluno que realizou a coleta |
| `fila` | String (`creditos` \| `catraca` \| `comida`) | Identificador da fila |
| `ts_entrada` | Timestamp ISO8601 | Data/Hora em que a pessoa entrou na fila |
| `ts_atendimento` | Timestamp ISO8601 | Data/Hora em que iniciou o atendimento |
| `ts_saida` | Timestamp ISO8601 | Data/Hora em que concluiu e saiu |
| `espera_segundos` | Integer | Tempo de espera na fila ($T_{\text{atend}} - T_{\text{entr}}$) |
| `servico_segundos` | Integer | Tempo de atendimento ($T_{\text{saida}} - T_{\text{atend}}$) |
| `total_segundos` | Integer | Tempo total ($T_{\text{saida}} - T_{\text{entr}}$) |
| `sincronizado` | Boolean | Flag local indicando se já foi persistido no Supabase |
| `criado_em` | Timestamp ISO8601 | Data/Hora de criação do registro |

---

## 6. Fluxos de Interface (Conforme Design Aprovado)

### 6.1. Tela 1 — Entrada / Perfil
- Campo simples: "Seu nome".
- Botão "Entrar".
- Persiste o nome na chave `filas_ru_user` do `localStorage`. Ao recarregar ou voltar, o nome já vem preenchido.

### 6.2. Tela 2 — Seleção de Fila
- Lista de 3 opções:
  1. *Recarga de créditos* (Caixa de recarga)
  2. *Jantar · Catraca* (Verificação de créditos)
  3. *Jantar · Comida* (Retirada da refeição)
- Indicador inferior de sincronização (`Tudo sincronizado` ou `X pendentes`).
- Botão/Link para a Tela de Registros/Exportação.

### 6.3. Tela 3 — Coleta em Tempo Real (Operação de Campo)
- Cabeçalho com fila ativa, data/hora e pill de sincronização.
- Faixa de métricas: `Na fila` (contagem), `Em atendimento` (contagem), `Concluídos` (contagem).
- **Área "Em atendimento":**
  - Exibe o indivíduo atendido no momento (`#ID`, horário de início e botão destacado **`Saiu`**).
- **Área "Na fila":**
  - Lista das pessoas aguardando, ordenadas por ordem de chegada (FIFO).
  - Cada item exibe `#ID`, horário de entrada, contador de espera progressivo (`02:45`) e botão **`Atender`**.
  - Opção discreta de remover/cancelar entrada em caso de toque acidental.
- **Botão Fixo Inferior (Polegar):**
  - Botão largo de alto contraste: **`+ Chegou alguém`**.

### 6.4. Tela 4 — Registros e Exportação CSV
- Alternador de abas entre as 3 filas.
- Métricas consolidadas: Total de concluídos e tempo médio de espera.
- Tabela com histórico das coletas da fila selecionada.
- Botão **`Exportar CSV`**:
  - Gera arquivo `.csv` baixável imediatamente no celular ou PC com cabeçalho formatado UTF-8 (BOM).

---

## 7. Estrutura de Arquivos Planejada

```
avd-filas/
├── index.html              # Ponto de entrada SPA (Single Page Application com rotas simples)
├── css/
│   └── style.css           # Estilos baseados na paleta e diretrizes do design aprovado
├── js/
│   ├── app.js              # Controlador principal e roteamento de telas
│   ├── storage.js          # Gerenciamento de localStorage e persistência offline
│   ├── supabase-client.js  # Integração e fila de sincronização com o Supabase
│   └── export-csv.js       # Utilitário de formatação e download do CSV
├── design/                 # Mockups de referência aprovados
│   ├── tela1-entrada.jpg
│   ├── tela2-filas.jpg
│   ├── tela3-coleta.jpg
│   └── tela4-registros.jpg
└── docs/
    └── specs/
        └── 2026-11-10-filas-ru-spec.md
```

---

## 8. Configuração do Supabase (Opcional / Plug-and-Play)

Caso as chaves do Supabase (`SUPABASE_URL` e `SUPABASE_ANON_KEY`) não sejam configuradas de imediato, o sistema funciona 100% no modo local via `localStorage`, permitindo a coleta e o download do `.csv` sem interrupções.
