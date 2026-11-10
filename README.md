# Filas RU · UFOPA 🍽️⏱️

Mini-aplicação web para contagem e cronometragem de filas do Restaurante Universitário da Universidade Federal do Oeste do Pará (UFOPA). Desenvolvida para coleta de dados de campo voltados à modelagem de filas por **Cadeias de Markov** na disciplina de **Avaliação de Desempenho**.

---

## 🚀 Como Executar Localmente

Como o projeto é construído em **HTML5, CSS3 e JavaScript modular nativo (ES Modules)**, ele não precisa de build ou compilação.

Para abrir no navegador de forma recomendada:

### Opção 1: Usando Python
Na pasta do projeto, execute no terminal:
```bash
python -m http.server 3000
```
E acesse `http://localhost:3000` (ou pelo IP da sua máquina no celular conectado na mesma rede Wi-Fi).

### Opção 2: Usando Node / NPX
```bash
npx serve .
```

### Opção 3: Extensão "Live Server" do VS Code
Basta clicar com o botão direito em `index.html` e selecionar **Open with Live Server**.

---

## 📱 Estrutura das 4 Telas

1. **Entrada:** Apenas digite seu nome (sem senha). Ele fica salvo no navegador (`localStorage`).
2. **Seleção de Fila:** Escolha qual fila monitorar:
   - *Recarga de créditos* (Caixa)
   - *Jantar · Catraca* (Verificação de créditos)
   - *Jantar · Comida* (Refeitório)
3. **Coleta em Tempo Real:**
   - Botão grande inferior no polegar: **`+ Chegou alguém`**
   - Na fila: cronômetro em tempo real do tempo de espera + botão **`Atender`**
   - Em atendimento: botão **`Saiu`** (conclui o ciclo e calcula os tempos)
4. **Registros e CSV:**
   - Visualização dos últimos registros e média de espera.
   - Botão **`Exportar CSV`** com codificação UTF-8 compatível com Excel, Pandas e R.

---

## ☁️ Conectando com o Supabase (Opcional)

O sistema funciona **100% no modo local sem internet**, mas você pode sincronizar os celulares com o Supabase:

1. Crie um projeto gratuito em [supabase.com](https://supabase.com).
2. Abra o **SQL Editor** do projeto e execute o conteúdo do arquivo [`supabase/schema.sql`](supabase/schema.sql).
3. Acesse **Project Settings > API**, copie a **Project URL** e a **anon public key**.
4. Cole esses valores no arquivo [`js/config.js`](js/config.js):
   ```javascript
   export const SUPABASE_CONFIG = {
     url: "https://seu-projeto.supabase.co",
     anonKey: "sua-chave-anon-aqui",
     tabela: "registros_filas"
   };
   ```
Pronto! Os registros serão salvos localmente e enviados automaticamente em segundo plano para o banco na nuvem.

---

## 📊 Formato dos Dados Exportados (.CSV)

| Coluna | Descrição |
|---|---|
| `id` | Identificador único do registro |
| `numero_senha` | Número da senha (#1, #2, ...) |
| `observador` | Nome do aluno que coletou |
| `fila` | Fila observada (`creditos`, `catraca`, `comida`) |
| `data_hora_entrada` | Instante de chegada (ISO 8601) |
| `data_hora_atendimento` | Instante que começou a ser atendido |
| `data_hora_saida` | Instante em que concluiu o atendimento |
| `espera_fila_segundos` | Tempo aguardando na fila ($W_q$) |
| `tempo_servico_segundos` | Tempo do atendimento ($S$) |
| `tempo_total_segundos` | Tempo total no sistema ($W$) |
