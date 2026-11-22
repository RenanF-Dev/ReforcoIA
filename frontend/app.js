/* ReforçoIA - Front-end
 * Conversa com o backend (FastAPI) pelas rotas /api.
 * O backend é quem decide o que mostrar em cada nível; aqui só desenhamos o que ele devolve.
 */

// ---------------------------------------------------------------------------
// Configuração: endereço do backend. Troque a porta se subir o servidor em outra.
// ---------------------------------------------------------------------------
const API_URL = "http://localhost:8000";

// ---------------------------------------------------------------------------
// Estado e elementos da tela
// ---------------------------------------------------------------------------
// previousId: última análise bem-sucedida. É enviada ao reanalisar, para a IA comparar as versões do código.
const state = { sessionId: null, previousId: null, level: 1, resolved: false, celebrating: false, busy: false };

const $ = (id) => document.getElementById(id);
const el = {
  codeEditor: $("codeEditor"),
  terminalInput: $("terminalInput"),
  analyzeBtn: $("analyzeBtn"),
  analyzeIcon: $("analyzeIcon"),
  spinner: $("spinner"),
  analyzeLabel: $("analyzeLabel"),
  clearCodeBtn: $("clearCodeBtn"),
  feedback: $("feedbackContent"),
  emptyState: $("emptyState"),
  errorBox: $("errorBox"),
  errorText: $("errorText"),
  cardCongrats: $("cardCongrats"),
  congratsText: $("congratsText"),
  cardQuestion: $("cardQuestion"),
  cardHint: $("cardHint"),
  cardConcept: $("cardConcept"),
  questionText: $("questionText"),
  hintText: $("hintText"),
  conceptText: $("conceptText"),
  lvlBtns: [1, 2, 3].map((n) => $("lvlBtn" + n)),
  levelIndicator: $("levelIndicator"),
  increaseBtn: $("increaseLevelBtn"),
  increaseLabel: $("increaseLabel"),
  resolveBtn: $("resolveBtn"),
  resolveLabel: $("resolveLabel"),
  badgeText: $("badgeText"),
  apiDot: $("apiDot"),
  apiText: $("apiText"),
};

const BTN_BASE = "py-2 px-2 text-xs font-medium rounded-lg border transition flex items-center justify-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed";
const BTN_ACTIVE = BTN_BASE + " border-indigo-500/50 bg-indigo-600/20 text-indigo-200 shadow-sm";
const BTN_INACTIVE = BTN_BASE + " border-slate-800 bg-slate-900 text-slate-400 hover:bg-slate-800 disabled:hover:bg-slate-900";

const CODE_CLASS = {
  indigo: "bg-slate-950 px-1.5 py-0.5 rounded text-indigo-300 font-mono text-xs border border-slate-800",
  emerald: "bg-slate-950 px-1.5 py-0.5 rounded text-emerald-300 font-mono text-xs border border-slate-800",
  amber: "bg-slate-950 px-1.5 py-0.5 rounded text-amber-300 font-mono text-xs border border-slate-800",
};

// ---------------------------------------------------------------------------
// Utilitários de texto
// ---------------------------------------------------------------------------
function escapeHtml(text) {
  return text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// A resposta da IA é texto puro: escapamos o HTML e só então trocamos `trecho` por um selo de código.
function formatCodeText(text, color) {
  return escapeHtml(text).replace(/`([^`]+)`/g, `<code class="${CODE_CLASS[color]}">$1</code>`);
}

// ---------------------------------------------------------------------------
// Comunicação com a API
// ---------------------------------------------------------------------------
function erroDaApi(status, data) {
  const detalhe = data && data.detail;
  if (status === 422) {
    return "Dados inválidos. Confira se o código não está vazio nem grande demais (máximo de 20.000 caracteres).";
  }
  if (typeof detalhe === "string") return detalhe;
  return `Erro inesperado do servidor (${status}).`;
}

async function api(path, options = {}) {
  let res;
  try {
    res = await fetch(API_URL + path, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
  } catch (_) {
    const err = new Error(`Não foi possível conectar ao servidor em ${API_URL}. Verifique se o backend está rodando.`);
    err.network = true;
    throw err;
  }
  let data = null;
  try {
    data = await res.json();
  } catch (_) {
    /* resposta sem JSON */
  }
  if (!res.ok) throw new Error(erroDaApi(res.status, data));
  return data;
}

// ---------------------------------------------------------------------------
// Renderização
// ---------------------------------------------------------------------------
function showError(message) {
  el.errorText.textContent = message;
  el.errorBox.classList.remove("hidden");
  el.feedback.scrollTop = 0; // o aviso fica no topo: garante que o aluno o veja
}

function hideError() {
  el.errorBox.classList.add("hidden");
}

function setCard(card, textEl, text, color) {
  const hasText = Boolean(text && text.trim());
  card.classList.toggle("hidden", !hasText);
  textEl.innerHTML = hasText ? formatCodeText(text, color) : "";
}

function renderSession(s) {
  state.sessionId = s.id_sessao;
  state.previousId = s.id_sessao;
  state.level = s.nivel_ajuda;
  state.resolved = s.bug_resolvido;

  el.emptyState.classList.add("hidden");
  // Bug resolvido pela IA: mostra só os parabéns (não há mais o que perguntar)
  const parabens = s.resposta_ia.codigo_correto ? s.resposta_ia.parabens : "";
  state.celebrating = Boolean(parabens);
  el.cardCongrats.classList.toggle("hidden", !parabens);
  el.congratsText.textContent = parabens;
  setCard(el.cardQuestion, el.questionText, parabens ? "" : s.resposta_ia.pergunta_socratica, "indigo");
  setCard(el.cardHint, el.hintText, parabens ? "" : s.resposta_ia.dica_conceitual, "emerald");
  setCard(el.cardConcept, el.conceptText, parabens ? "" : s.resposta_ia.aprofundamento, "amber");
  updateControls();
  el.feedback.scrollTop = 0;
}

function resetPanel() {
  state.sessionId = null;
  state.level = 1;
  state.resolved = false;
  state.celebrating = false;
  [el.cardCongrats, el.cardQuestion, el.cardHint, el.cardConcept].forEach((c) => c.classList.add("hidden"));
  el.emptyState.classList.remove("hidden");
  hideError();
  updateControls();
}

function updateControls() {
  const hasSession = state.sessionId !== null;
  const locked = !hasSession || state.busy || state.celebrating; // com os parabéns não há mais ajuda a liberar

  el.lvlBtns.forEach((btn, i) => {
    btn.className = hasSession && state.level === i + 1 ? BTN_ACTIVE : BTN_INACTIVE;
    btn.disabled = locked;
  });
  el.levelIndicator.textContent = hasSession ? `Nível ${state.level} de 3` : "Sem análise";

  const atMax = hasSession && state.level >= 3;
  el.increaseBtn.disabled = locked || atMax;
  el.increaseLabel.textContent = atMax ? "Nível máximo de ajuda liberado" : "▲ Aumentar Nível de Ajuda (Ainda com dúvidas)";

  el.resolveBtn.disabled = locked || state.resolved;
  el.resolveLabel.textContent = state.resolved ? "Bug resolvido ✓" : "Já resolvi o bug";
  el.badgeText.textContent = state.resolved ? "Bug Resolvido" : "Modo Socrático Ativo";
}

function setBusy(busy, analyzing = false) {
  state.busy = busy;
  el.analyzeBtn.disabled = busy;
  el.spinner.classList.toggle("hidden", !(busy && analyzing));
  el.analyzeIcon.classList.toggle("hidden", busy && analyzing);
  el.analyzeLabel.textContent = busy && analyzing ? "Analisando com IA..." : "Analisar Código";
  updateControls();
}

function setApiStatus(kind, text) {
  const dots = { ok: "bg-emerald-400", warn: "bg-amber-400", off: "bg-rose-400" };
  el.apiDot.className = "w-1.5 h-1.5 rounded-full " + (dots[kind] || "bg-slate-500");
  el.apiText.textContent = text;
}

// ---------------------------------------------------------------------------
// Ações
// ---------------------------------------------------------------------------
async function run(action, analyzing = false) {
  hideError();
  setBusy(true, analyzing);
  try {
    renderSession(await action());
  } catch (err) {
    // Uma análise nova que falha não deve deixar a resposta do código anterior na tela
    if (analyzing) resetPanel();
    showError(err.message);
    if (err.network) checkHealth();
  } finally {
    setBusy(false, analyzing);
  }
}

function analyze() {
  if (state.busy) return;
  const codigo = el.codeEditor.value;
  if (!codigo.trim()) {
    showError("Cole um código para analisar.");
    el.codeEditor.focus();
    return;
  }
  run(
    () =>
      api("/api/sessoes", {
        method: "POST",
        body: JSON.stringify({
          codigo,
          erro_terminal: el.terminalInput.value,
          linguagem: "auto",
          nivel_ajuda: 1, // o método socrático começa só com a pergunta
          id_sessao_anterior: state.previousId, // null na primeira análise
        }),
      }),
    true
  );
}

function selectLevel(level) {
  if (state.busy || state.sessionId === null || level === state.level) return;
  run(() =>
    api(`/api/sessoes/${state.sessionId}/nivel`, {
      method: "PUT",
      body: JSON.stringify({ nivel_ajuda: level }),
    })
  );
}

function increaseLevel() {
  if (state.busy || state.sessionId === null || state.level >= 3) return;
  run(() => api(`/api/sessoes/${state.sessionId}/aumentar-nivel`, { method: "POST" }));
}

function markResolved() {
  if (state.busy || state.sessionId === null || state.resolved) return;
  run(() => api(`/api/sessoes/${state.sessionId}/resolvido`, { method: "POST" }));
}

function clearAll() {
  el.codeEditor.value = "";
  el.terminalInput.value = "";
  state.previousId = null; // recomeço: a próxima análise não é comparada com nada
  resetPanel();
  el.codeEditor.focus();
}

async function checkHealth() {
  try {
    const res = await fetch(API_URL + "/api/saude");
    const data = await res.json();
    if (data.ia_configurada) setApiStatus("ok", `API online · ${data.modelo}`);
    else setApiStatus("warn", "API online · IA sem chave");
  } catch (_) {
    setApiStatus("off", "API offline");
  }
}

// ---------------------------------------------------------------------------
// Eventos e inicialização
// ---------------------------------------------------------------------------
el.analyzeBtn.addEventListener("click", analyze);
el.clearCodeBtn.addEventListener("click", clearAll);
el.increaseBtn.addEventListener("click", increaseLevel);
el.resolveBtn.addEventListener("click", markResolved);
el.lvlBtns.forEach((btn) => btn.addEventListener("click", () => selectLevel(Number(btn.dataset.level))));

[el.codeEditor, el.terminalInput].forEach((field) =>
  field.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      analyze();
    }
  })
);

if (window.lucide) lucide.createIcons();
resetPanel();
checkHealth();
