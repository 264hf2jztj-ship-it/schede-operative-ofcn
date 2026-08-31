"use strict";

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.112.4/+esm";
import { jsPDF } from "https://cdn.jsdelivr.net/npm/jspdf@4.2.0/+esm";
import { LOGIN_ALIASES, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./config.js";

const STORAGE_KEY = "aup_pianificazione_ofcn_scadenze_operative_v1";
const TURN_COUNT = 6;

const elements = {
  currentYear: document.querySelector("#current-year"),
  loadingView: document.querySelector("#loading-view"),
  loginView: document.querySelector("#login-view"),
  authenticatedView: document.querySelector("#authenticated-view"),
  loginForm: document.querySelector("#login-form"),
  username: document.querySelector("#username"),
  password: document.querySelector("#password"),
  loginButton: document.querySelector("#login-button"),
  loginMessage: document.querySelector("#login-message"),
  sessionLabel: document.querySelector("#session-label"),
  logoutButton: document.querySelector("#logout-button"),
  logoutMessage: document.querySelector("#logout-message"),
  campaignLoading: document.querySelector("#campaign-loading"),
  campaignUnavailable: document.querySelector("#campaign-unavailable"),
  campaignMessage: document.querySelector("#campaign-message"),
  campaignYear: document.querySelector("#campaign-year"),
  responseForm: document.querySelector("#response-form"),
  responseMessage: document.querySelector("#response-message"),
  submitButton: document.querySelector("#submit-button"),
  downloadButton: document.querySelector("#download-button"),
  draftStatus: document.querySelector("#draft-status"),
  addUnavailability: document.querySelector("#add-unavailability"),
  unavailabilityList: document.querySelector("#unavailability-list"),
  unavailabilityCount: document.querySelector("#unavailability-count"),
  priorityGrid: document.querySelector("#priority-grid"),
  recordTemplate: document.querySelector("#record-template"),
};

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: "ofcn-auth-v1",
  },
});

let activeCampaign = null;
let currentUserId = "";
let unavailabilities = [];
let sentPayload = null;
let isSubmitting = false;

function showView(viewName) {
  const views = {
    loading: elements.loadingView,
    login: elements.loginView,
    authenticated: elements.authenticatedView,
  };
  Object.entries(views).forEach(([name, element]) => {
    if (element) element.hidden = name !== viewName;
  });
}

function showCampaignView(viewName) {
  if (elements.campaignLoading) elements.campaignLoading.hidden = viewName !== "loading";
  if (elements.campaignUnavailable) elements.campaignUnavailable.hidden = viewName !== "unavailable";
  if (elements.responseForm) elements.responseForm.hidden = viewName !== "form";
}

function setMessage(element, message = "", kind = "") {
  if (!element) return;
  element.textContent = message;
  element.classList.toggle("form-message--error", kind === "error");
  element.classList.toggle("form-message--success", kind === "success");
}

function setLoginPending(isPending) {
  if (!elements.loginButton || !elements.username || !elements.password) return;
  elements.loginButton.disabled = isPending;
  elements.username.disabled = isPending;
  elements.password.disabled = isPending;
  elements.loginButton.textContent = isPending ? "Accesso in corso…" : "Accedi";
}

function updateSentState(isSent) {
  if (elements.draftStatus) {
    elements.draftStatus.textContent = isSent ? "Ultimo invio completato" : "Bozza locale";
    elements.draftStatus.classList.toggle("status-pill--sent", isSent);
  }
  if (elements.downloadButton) {
    elements.downloadButton.textContent = isSent ? "Scarica copia inviata PDF" : "Scarica bozza PDF";
  }
}

function resetOperationalState() {
  activeCampaign = null;
  unavailabilities = [];
  sentPayload = null;
  isSubmitting = false;
  elements.responseForm?.reset();
  refreshPriorityOptions();
  renderRecords();
  updateSentState(false);
}

async function loadActiveCampaign() {
  showCampaignView("loading");
  setMessage(elements.responseMessage);

  try {
    const { data, error } = await supabase
      .from("campagne")
      .select("anno, versione_payload, chiusura_il")
      .eq("aperta", true)
      .order("anno", { ascending: false })
      .limit(1);

    if (error) throw error;
    const campaign = Array.isArray(data) ? data[0] : null;

    if (!campaign) {
      if (elements.campaignMessage) {
        elements.campaignMessage.textContent =
          "Al momento l'Ufficio Piani non ha aperto una campagna OFCN.";
      }
      showCampaignView("unavailable");
      return;
    }

    activeCampaign = campaign;
    if (elements.campaignYear) elements.campaignYear.textContent = String(campaign.anno);
    showCampaignView("form");
  } catch {
    if (elements.campaignMessage) {
      elements.campaignMessage.textContent =
        "Non è stato possibile verificare la campagna. Controlla la connessione e riprova più tardi.";
    }
    showCampaignView("unavailable");
  }
}

function renderSession(session) {
  if (!session?.user) {
    currentUserId = "";
    resetOperationalState();
    if (elements.sessionLabel) elements.sessionLabel.textContent = "Sessione protetta attiva.";
    showView("login");
    return;
  }

  if (elements.sessionLabel) elements.sessionLabel.textContent = "Sessione PLAN_OFCN attiva.";
  if (elements.password) elements.password.value = "";
  setMessage(elements.loginMessage);
  showView("authenticated");

  if (currentUserId !== session.user.id) {
    currentUserId = session.user.id;
    resetOperationalState();
    loadActiveCampaign();
  }
}

async function handleLogin(event) {
  event.preventDefault();
  setMessage(elements.loginMessage);
  const username = elements.username?.value.trim().toUpperCase() ?? "";
  const email = LOGIN_ALIASES[username];
  const password = elements.password?.value ?? "";

  if (!username || !email || !password) {
    setMessage(elements.loginMessage, "Nome utente o password non validi.", "error");
    return;
  }

  setLoginPending(true);
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.session) {
      setMessage(elements.loginMessage, "Credenziali non valide oppure accesso non disponibile.", "error");
      return;
    }
    renderSession(data.session);
  } catch {
    setMessage(elements.loginMessage, "Impossibile contattare il servizio. Controlla la connessione e riprova.", "error");
  } finally {
    setLoginPending(false);
  }
}

async function handleLogout() {
  if (!elements.logoutButton) return;
  elements.logoutButton.disabled = true;
  elements.logoutButton.textContent = "Uscita in corso…";
  setMessage(elements.logoutMessage);

  try {
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) {
      setMessage(elements.logoutMessage, "Non è stato possibile terminare la sessione. Riprova.", "error");
      return;
    }
    showView("login");
    setMessage(elements.loginMessage, "Uscita effettuata da questo dispositivo.", "success");
  } catch {
    setMessage(elements.logoutMessage, "Impossibile contattare il servizio. Controlla la connessione e riprova.", "error");
  } finally {
    elements.logoutButton.disabled = false;
    elements.logoutButton.textContent = "Esci da questo dispositivo";
  }
}

function textValue(selector, uppercase = false) {
  const value = document.querySelector(selector)?.value.trim() ?? "";
  return uppercase ? value.toUpperCase() : value;
}

function datePair(startSelector, endSelector, label) {
  const dataInizio = textValue(startSelector);
  const dataFine = textValue(endSelector);
  if ((dataInizio && !dataFine) || (!dataInizio && dataFine)) {
    throw new Error(`Completa entrambe le date per ${label}.`);
  }
  if (dataInizio && dataFine && dataFine < dataInizio) {
    throw new Error(`La data finale di ${label} precede la data iniziale.`);
  }
  return { dataInizio, dataFine };
}

function getPriorityOrder() {
  const selectors = Array.from(document.querySelectorAll("[data-priority-position]"));
  const order = selectors.map((select) => Number(select.value));
  if (order.some((turn) => !Number.isInteger(turn) || turn < 1 || turn > TURN_COUNT)) {
    throw new Error("Assegna un turno a ogni posizione di priorità.");
  }
  if (new Set(order).size !== TURN_COUNT) {
    throw new Error("Ogni turno deve comparire una sola volta nell'ordine di priorità.");
  }
  return order;
}

function buildPayload() {
  if (!activeCampaign) throw new Error("Nessuna campagna aperta.");
  if (!elements.responseForm?.reportValidity()) {
    throw new Error("Controlla i campi obbligatori evidenziati.");
  }

  const matricola = textValue("#matricola", true);
  const cognome = textValue("#cognome", true);
  const nome = textValue("#nome", true);
  const anno = Number(activeCampaign.anno);
  const ordinePrioritaTurni = getPriorityOrder();
  const punteggiPrioritaTurni = Object.fromEntries(
    ordinePrioritaTurni.map((turno, index) => [`T${turno}`, TURN_COUNT - index]),
  );

  const scheda = {
    matricola,
    nominativo: `${cognome} ${nome}`.trim(),
    cognome,
    nome,
    anno,
    esperienzaOfcn: null,
    ruoloOfcn: "",
    bufferGiorni: null,
    scadenze: {},
    indisponibilita: unavailabilities.map((item) => ({ ...item })),
    eventiOperativi: [],
    preferenze: {
      ordinePrioritaTurni,
      punteggiPrioritaTurni,
      turniPreferiti: ordinePrioritaTurni,
      turniDaEvitare: [],
      periodoPreferito: { dataInizio: "", dataFine: "" },
      periodoDaEvitare: { dataInizio: "", dataFine: "" },
      disponibilitaNatale: "",
      disponibilitaEstate: "",
      note: "",
    },
    lockManuali: [],
    note: textValue("#general-notes"),
  };

  return {
    tipoFile: "schede_operative_ofcn",
    versione: Number(activeCampaign.versione_payload || 1),
    esportatoIl: new Date().toISOString(),
    annoCorrente: anno,
    storageKey: STORAGE_KEY,
    schedeOperative: { [String(anno)]: { [matricola]: scheda } },
  };
}

function safeFilenamePart(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 50) || "SCHEDA";
}

function formatDateForPdf(value) {
  const [year, month, day] = String(value || "").split("-");
  return year && month && day ? `${day}/${month}/${year}` : String(value || "");
}

function downloadPayloadPdf(payload) {
  const year = payload.annoCorrente;
  const block = payload.schedeOperative[String(year)];
  const matricola = Object.keys(block)[0];
  const scheda = block[matricola];
  const cognome = scheda.cognome || "OFCN";
  const filename = `scheda_ofcn_${year}_${safeFilenamePart(matricola)}_${safeFilenamePart(cognome)}.pdf`;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const margin = 18;
  const contentWidth = 174;
  let y = 42;

  function ensureSpace(height) {
    if (y + height <= 278) return;
    doc.addPage();
    y = 22;
  }

  function sectionTitle(title) {
    ensureSpace(12);
    doc.setFillColor(232, 240, 248);
    doc.roundedRect(margin, y, contentWidth, 8, 1.5, 1.5, "F");
    doc.setTextColor(18, 53, 91);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(title, margin + 3, y + 5.4);
    y += 12;
  }

  function textRow(label, value) {
    const lines = doc.splitTextToSize(`${label}: ${value || "-"}`, contentWidth);
    ensureSpace(lines.length * 5 + 2);
    doc.setTextColor(23, 35, 52);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(lines, margin, y);
    y += lines.length * 5 + 2;
  }

  doc.setFillColor(18, 53, 91);
  doc.rect(0, 0, 210, 30, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Scheda operativa OFCN", margin, 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Campagna ${year} - copia per il compilatore`, margin, 22);

  sectionTitle("Dati personali");
  textRow("Matricola", scheda.matricola);
  textRow("Cognome", scheda.cognome);
  textRow("Nome", scheda.nome);

  sectionTitle("Ordine di priorità dei turni");
  const order = scheda.preferenze?.ordinePrioritaTurni || [];
  order.forEach((turn, index) => {
    const score = TURN_COUNT - index;
    textRow(`${index + 1}a priorità`, `Turno ${turn} - ${score} ${score === 1 ? "punto" : "punti"}`);
  });

  sectionTitle("Indisponibilità personali");
  if (!scheda.indisponibilita?.length) {
    textRow("Periodi", "Nessuna indisponibilità inserita");
  } else {
    scheda.indisponibilita.forEach((item, index) => {
      const periodo = `${formatDateForPdf(item.dataInizio)} - ${formatDateForPdf(item.dataFine)}`;
      const dettaglio = [item.motivo, item.note].filter(Boolean).join(" - ");
      textRow(`Periodo ${index + 1}`, dettaglio ? `${periodo} - ${dettaglio}` : periodo);
    });
  }

  sectionTitle("Note generali");
  textRow("Note", scheda.note || "Nessuna nota");

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(216, 225, 235);
    doc.line(margin, 286, 192, 286);
    doc.setTextColor(95, 111, 130);
    doc.setFontSize(8);
    doc.text(`Generato il ${new Date(payload.esportatoIl).toLocaleString("it-IT")}`, margin, 291);
    doc.text(`Pagina ${page} di ${pageCount}`, 192, 291, { align: "right" });
  }

  doc.save(filename);
}

function handleDownload() {
  setMessage(elements.responseMessage);
  try {
    const payload = sentPayload || buildPayload();
    downloadPayloadPdf(payload);
    setMessage(elements.responseMessage, sentPayload ? "Copia PDF della risposta inviata scaricata." : "Bozza PDF scaricata.", "success");
  } catch (error) {
    setMessage(elements.responseMessage, error.message || "Impossibile creare il file PDF.", "error");
  }
}

async function handleSubmit(event) {
  event.preventDefault();
  if (isSubmitting) return;
  setMessage(elements.responseMessage);

  let payload;
  try {
    payload = buildPayload();
  } catch (error) {
    setMessage(elements.responseMessage, error.message || "Controlla i dati inseriti.", "error");
    return;
  }

  isSubmitting = true;
  elements.submitButton.disabled = true;
  elements.submitButton.textContent = "Invio in corso…";

  try {
    const { error } = await supabase.from("risposte").insert({
      submission_id: crypto.randomUUID(),
      anno: Number(activeCampaign.anno),
      risposta_json: payload,
    });
    if (error) throw error;

    sentPayload = JSON.parse(JSON.stringify(payload));
    updateSentState(true);
    setMessage(elements.responseMessage, "Scheda inviata correttamente. Puoi scaricare una copia PDF dei contenuti trasmessi.", "success");
    elements.submitButton.textContent = "Invia una nuova versione";
  } catch (error) {
    const message = error?.code === "23505"
      ? "Questa richiesta risulta già ricevuta. Non inviarla nuovamente."
      : "Invio non riuscito. I dati sono ancora presenti nel modulo: controlla la connessione e riprova.";
    setMessage(elements.responseMessage, message, "error");
    elements.submitButton.textContent = "Invia scheda";
  } finally {
    isSubmitting = false;
    elements.submitButton.disabled = false;
  }
}

function addUnavailability() {
  setMessage(elements.responseMessage);
  try {
    const period = datePair("#unavailability-start", "#unavailability-end", "l'indisponibilità");
    if (!period.dataInizio) throw new Error("Inserisci le date dell'indisponibilità.");
    unavailabilities.push({
      ...period,
      motivo: textValue("#unavailability-reason"),
      note: textValue("#unavailability-notes"),
    });
    ["#unavailability-start", "#unavailability-end", "#unavailability-reason", "#unavailability-notes"]
      .forEach((selector) => { document.querySelector(selector).value = ""; });
    renderRecords();
  } catch (error) {
    setMessage(elements.responseMessage, error.message, "error");
  }
}

function appendRecord(container, text, detail, index) {
  const fragment = elements.recordTemplate.content.cloneNode(true);
  const card = fragment.querySelector(".record-card");
  const textBox = fragment.querySelector(".record-card__text");
  const main = document.createElement("strong");
  const small = document.createElement("small");
  main.textContent = text;
  small.textContent = detail;
  textBox.append(main, small);
  card.querySelector(".remove-record").addEventListener("click", () => {
    unavailabilities.splice(index, 1);
    renderRecords();
  });
  container.appendChild(fragment);
}

function renderRecords() {
  if (elements.unavailabilityList) {
    elements.unavailabilityList.replaceChildren();
    unavailabilities.forEach((item, index) => {
      appendRecord(
        elements.unavailabilityList,
        `${item.dataInizio} → ${item.dataFine}`,
        [item.motivo, item.note].filter(Boolean).join(" · ") || "Nessuna nota",
        index,
      );
    });
  }
  if (elements.unavailabilityCount) elements.unavailabilityCount.textContent = `${unavailabilities.length} inserite`;
}

function refreshPriorityOptions() {
  const selectors = Array.from(document.querySelectorAll("[data-priority-position]"));
  const selectedTurns = new Set(selectors.map((select) => select.value).filter(Boolean));

  selectors.forEach((select) => {
    Array.from(select.options).forEach((option) => {
      if (!option.value) return;
      option.disabled = option.value !== select.value && selectedTurns.has(option.value);
    });
  });
}

function initializePrioritySelectors() {
  if (!elements.priorityGrid) return;
  elements.priorityGrid.replaceChildren();

  for (let position = 1; position <= TURN_COUNT; position += 1) {
    const wrapper = document.createElement("div");
    wrapper.className = "field-group priority-field";

    const label = document.createElement("label");
    const select = document.createElement("select");
    const score = TURN_COUNT - position + 1;
    const selectId = `priority-${position}`;

    label.htmlFor = selectId;
    label.textContent = `${position}ª priorità · ${score} ${score === 1 ? "punto" : "punti"}`;
    select.id = selectId;
    select.name = selectId;
    select.dataset.priorityPosition = String(position);
    select.required = true;

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Seleziona un turno";
    select.appendChild(placeholder);

    for (let turn = 1; turn <= TURN_COUNT; turn += 1) {
      const option = document.createElement("option");
      option.value = String(turn);
      option.textContent = `Turno ${turn}`;
      select.appendChild(option);
    }

    select.addEventListener("change", refreshPriorityOptions);
    wrapper.append(label, select);
    elements.priorityGrid.appendChild(wrapper);
  }
}

async function initialize() {
  if (elements.currentYear) elements.currentYear.textContent = String(new Date().getFullYear());
  initializePrioritySelectors();
  renderRecords();
  elements.loginForm?.addEventListener("submit", handleLogin);
  elements.logoutButton?.addEventListener("click", handleLogout);
  elements.responseForm?.addEventListener("submit", handleSubmit);
  elements.downloadButton?.addEventListener("click", handleDownload);
  elements.addUnavailability?.addEventListener("click", addUnavailability);
  supabase.auth.onAuthStateChange((_event, session) => renderSession(session));

  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      setMessage(elements.loginMessage, "Impossibile verificare la sessione. Puoi provare ad accedere.", "error");
      showView("login");
      return;
    }
    renderSession(data.session);
  } catch {
    setMessage(elements.loginMessage, "Servizio temporaneamente non raggiungibile.", "error");
    showView("login");
  }
}

initialize();
