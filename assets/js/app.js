"use strict";

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.112.4/+esm";
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
  addEvent: document.querySelector("#add-event"),
  eventList: document.querySelector("#event-list"),
  eventCount: document.querySelector("#event-count"),
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
let operationalEvents = [];
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
    elements.downloadButton.textContent = isSent ? "Scarica copia inviata" : "Scarica bozza JSON";
  }
}

function resetOperationalState() {
  activeCampaign = null;
  unavailabilities = [];
  operationalEvents = [];
  sentPayload = null;
  isSubmitting = false;
  elements.responseForm?.reset();
  const eventBuffer = document.querySelector("#event-buffer");
  if (eventBuffer) eventBuffer.value = "20";
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

function optionalNumber(selector) {
  const raw = textValue(selector);
  return raw === "" ? null : Number(raw);
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

function checkedTurns(groupName) {
  return Array.from(document.querySelectorAll(`[data-turn-group="${groupName}"] input:checked`))
    .map((input) => Number(input.value));
}

function buildScadenze() {
  const values = {};
  document.querySelectorAll("[data-scadenza]").forEach((input) => {
    if (input.value) values[input.dataset.scadenza] = input.value;
  });
  return values;
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
  const periodoPreferito = datePair("#preferred-start", "#preferred-end", "il periodo preferito");
  const periodoDaEvitare = datePair("#avoid-start", "#avoid-end", "il periodo da evitare");

  const scheda = {
    matricola,
    nominativo: `${cognome} ${nome}`.trim(),
    cognome,
    nome,
    anno,
    esperienzaOfcn: optionalNumber("#esperienza-ofcn"),
    ruoloOfcn: textValue("#ruolo-ofcn", true),
    bufferGiorni: optionalNumber("#buffer-giorni"),
    scadenze: buildScadenze(),
    indisponibilita: unavailabilities.map((item) => ({ ...item })),
    eventiOperativi: operationalEvents.map((item) => ({ ...item })),
    preferenze: {
      turniPreferiti: checkedTurns("preferred"),
      turniDaEvitare: checkedTurns("avoid"),
      periodoPreferito,
      periodoDaEvitare,
      disponibilitaNatale: textValue("#christmas-availability", true),
      disponibilitaEstate: textValue("#summer-availability", true),
      note: textValue("#preference-notes"),
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

function downloadPayload(payload) {
  const year = payload.annoCorrente;
  const block = payload.schedeOperative[String(year)];
  const matricola = Object.keys(block)[0];
  const cognome = block[matricola]?.cognome || "OFCN";
  const filename = `scheda_ofcn_${year}_${safeFilenamePart(matricola)}_${safeFilenamePart(cognome)}.json`;
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function handleDownload() {
  setMessage(elements.responseMessage);
  try {
    const payload = sentPayload || buildPayload();
    downloadPayload(payload);
    setMessage(elements.responseMessage, sentPayload ? "Copia della risposta inviata scaricata." : "Bozza JSON scaricata.", "success");
  } catch (error) {
    setMessage(elements.responseMessage, error.message || "Impossibile creare il file JSON.", "error");
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
    setMessage(elements.responseMessage, "Scheda inviata correttamente. Puoi scaricare la copia esatta appena trasmessa.", "success");
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

function addOperationalEvent() {
  setMessage(elements.responseMessage);
  try {
    const period = datePair("#event-start", "#event-end", "l'attività");
    if (!period.dataInizio) throw new Error("Inserisci le date del corso o dell'esercitazione.");
    const bufferGiorni = optionalNumber("#event-buffer");
    if (bufferGiorni === null || bufferGiorni < 0 || bufferGiorni > 365) {
      throw new Error("Inserisci un buffer compreso tra 0 e 365 giorni.");
    }
    operationalEvents.push({
      tipo: textValue("#event-type", true),
      ...period,
      bufferGiorni,
      motivo: textValue("#event-reason"),
      note: textValue("#event-notes"),
    });
    ["#event-start", "#event-end", "#event-reason", "#event-notes"]
      .forEach((selector) => { document.querySelector(selector).value = ""; });
    document.querySelector("#event-buffer").value = "20";
    renderRecords();
  } catch (error) {
    setMessage(elements.responseMessage, error.message, "error");
  }
}

function appendRecord(container, text, detail, index, type) {
  const fragment = elements.recordTemplate.content.cloneNode(true);
  const card = fragment.querySelector(".record-card");
  const textBox = fragment.querySelector(".record-card__text");
  const main = document.createElement("strong");
  const small = document.createElement("small");
  main.textContent = text;
  small.textContent = detail;
  textBox.append(main, small);
  card.querySelector(".remove-record").addEventListener("click", () => {
    if (type === "unavailability") unavailabilities.splice(index, 1);
    if (type === "event") operationalEvents.splice(index, 1);
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
        "unavailability",
      );
    });
  }
  if (elements.eventList) {
    elements.eventList.replaceChildren();
    operationalEvents.forEach((item, index) => {
      appendRecord(
        elements.eventList,
        `${item.tipo}: ${item.dataInizio} → ${item.dataFine}`,
        `Buffer ${item.bufferGiorni} giorni${item.motivo ? ` · ${item.motivo}` : ""}`,
        index,
        "event",
      );
    });
  }
  if (elements.unavailabilityCount) elements.unavailabilityCount.textContent = `${unavailabilities.length} inserite`;
  if (elements.eventCount) elements.eventCount.textContent = `${operationalEvents.length} inseriti`;
}

function initializeTurnOptions() {
  document.querySelectorAll("[data-turn-group]").forEach((container) => {
    const group = container.dataset.turnGroup;
    for (let turn = 1; turn <= TURN_COUNT; turn += 1) {
      const label = document.createElement("label");
      label.className = "turn-option";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = String(turn);
      checkbox.name = `${group}-turn-${turn}`;
      const text = document.createElement("span");
      text.textContent = `Turno ${turn}`;
      label.append(checkbox, text);
      container.appendChild(label);
    }
  });
}

async function initialize() {
  if (elements.currentYear) elements.currentYear.textContent = String(new Date().getFullYear());
  initializeTurnOptions();
  renderRecords();
  elements.loginForm?.addEventListener("submit", handleLogin);
  elements.logoutButton?.addEventListener("click", handleLogout);
  elements.responseForm?.addEventListener("submit", handleSubmit);
  elements.downloadButton?.addEventListener("click", handleDownload);
  elements.addUnavailability?.addEventListener("click", addUnavailability);
  elements.addEvent?.addEventListener("click", addOperationalEvent);
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
