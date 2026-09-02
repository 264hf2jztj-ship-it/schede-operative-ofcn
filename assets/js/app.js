"use strict";

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.112.4/+esm";
import { jsPDF } from "https://cdn.jsdelivr.net/npm/jspdf@4.2.0/+esm";
import { LOGIN_ALIASES, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./config.js";

const STORAGE_KEY = "aup_pianificazione_ofcn_scadenze_operative_v1";
const PDF_DRAFT_RECOVERY_KEY = "ofcn-pdf-draft-recovery-v1";
const TURN_COUNT = 6;
const PRIORITY_COUNT = 3;
const RECOMMENDED_UNAVAILABILITIES = 2;

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
  adminView: document.querySelector("#admin-view"),
  adminUnitLabel: document.querySelector("#admin-unit-label"),
  adminCount: document.querySelector("#admin-count"),
  adminSearch: document.querySelector("#admin-search"),
  adminStatusFilter: document.querySelector("#admin-status-filter"),
  adminSelectAll: document.querySelector("#admin-select-all"),
  adminDownloadSelected: document.querySelector("#admin-download-selected"),
  adminRefresh: document.querySelector("#admin-refresh"),
  adminMessage: document.querySelector("#admin-message"),
  adminLoading: document.querySelector("#admin-loading"),
  adminList: document.querySelector("#admin-list"),
  adminEmpty: document.querySelector("#admin-empty"),
  adminResponseTemplate: document.querySelector("#admin-response-template"),
  responseMessage: document.querySelector("#response-message"),
  submitButton: document.querySelector("#submit-button"),
  downloadButton: document.querySelector("#download-button"),
  draftStatus: document.querySelector("#draft-status"),
  addUnavailability: document.querySelector("#add-unavailability"),
  unavailabilityList: document.querySelector("#unavailability-list"),
  unavailabilityCount: document.querySelector("#unavailability-count"),
  unavailabilityWarning: document.querySelector("#unavailability-warning"),
  priorityGrid: document.querySelector("#priority-grid"),
  avoidGrid: document.querySelector("#avoid-grid"),
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
let pdfRecoveryCleanupTimer = null;
let currentAdminUnit = "";
let adminResponses = [];
let selectedAdminResponseIds = new Set();

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
  currentAdminUnit = "";
  adminResponses = [];
  selectedAdminResponseIds = new Set();
  elements.responseForm?.reset();
  if (elements.adminView) elements.adminView.hidden = true;
  if (elements.adminList) elements.adminList.replaceChildren();
  refreshTurnChoices();
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
    restorePendingPdfDraft();
  } catch {
    if (elements.campaignMessage) {
      elements.campaignMessage.textContent =
        "Non è stato possibile verificare la campagna. Controlla la connessione e riprova più tardi.";
    }
    showCampaignView("unavailable");
  }
}

async function renderSession(session) {
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
    currentUserId = session.user.id;

    try {
      const { data: adminRole, error } = await supabase
        .from("amministratori")
        .select("reparto")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (error) throw error;
      if (adminRole?.reparto) {
        currentAdminUnit = adminRole.reparto;
        if (elements.sessionLabel) {
          elements.sessionLabel.textContent = `Sessione amministrativa ${formatRecipientUnit(currentAdminUnit)} attiva.`;
        }
        showCampaignView("none");
        if (elements.adminView) elements.adminView.hidden = false;
        if (elements.adminUnitLabel) elements.adminUnitLabel.textContent = formatRecipientUnit(currentAdminUnit);
        await loadAdminResponses();
        return;
      }
    } catch {
      setMessage(
        elements.logoutMessage,
        "Non è stato possibile verificare il profilo amministrativo. Ricarica la pagina o riprova più tardi.",
        "error",
      );
      showCampaignView("none");
      return;
    }

    if (elements.sessionLabel) elements.sessionLabel.textContent = "Sessione PLAN_OFCN attiva.";
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
    await renderSession(data.session);
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
  if (new Set(order).size !== PRIORITY_COUNT) {
    throw new Error("I tre turni preferiti devono essere diversi tra loro.");
  }
  return order;
}

function getAvoidedTurns() {
  return Array.from(document.querySelectorAll("[data-avoid-turn]:checked"))
    .map((checkbox) => Number(checkbox.value))
    .filter((turn) => Number.isInteger(turn) && turn >= 1 && turn <= TURN_COUNT);
}

function buildPayload() {
  if (!activeCampaign) throw new Error("Nessuna campagna aperta.");
  if (!elements.responseForm?.reportValidity()) {
    throw new Error("Controlla i campi obbligatori evidenziati.");
  }
  const matricola = textValue("#matricola", true);
  const cognome = textValue("#cognome", true);
  const nome = textValue("#nome", true);
  const repartoDestinatario = document.querySelector('input[name="recipient-unit"]:checked')?.value ?? "";
  const anno = Number(activeCampaign.anno);
  const ordinePrioritaTurni = getPriorityOrder();
  const turniDaEvitare = getAvoidedTurns();
  const punteggiPrioritaTurni = Object.fromEntries(
    ordinePrioritaTurni.map((turno, index) => [`T${turno}`, PRIORITY_COUNT - index]),
  );

  if (turniDaEvitare.some((turno) => ordinePrioritaTurni.includes(turno))) {
    throw new Error("Un turno preferito non può essere indicato anche tra quelli da evitare.");
  }

  const scheda = {
    matricola,
    nominativo: `${cognome} ${nome}`.trim(),
    cognome,
    nome,
    anno,
    repartoDestinatario,
    corsiQualificheDesiderati: textValue("#desired-training"),
    esercitazioniDesiderate: textValue("#desired-exercises"),
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
      turniDaEvitare,
      periodoPreferito: { dataInizio: "", dataFine: "" },
      periodoDaEvitare: { dataInizio: "", dataFine: "" },
      disponibilitaNatale: textValue("#availability-christmas", true),
      disponibilitaEstate: textValue("#availability-summer", true),
      disponibilitaDoppioTurno: textValue("#availability-double-shift", true),
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
    repartoDestinatario,
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

function formatAvailabilityForPdf(value) {
  if (value === "DISPONIBILE") return "Sì, disponibile";
  if (value === "NON_DISPONIBILE") return "No, non disponibile";
  return "Non indicata";
}

function formatRecipientUnit(value) {
  if (value === "2_GRUPPO") return "2° Gruppo";
  if (value === "50_GRUPPO") return "50° Gruppo";
  return "Non indicato";
}

function formatAdminDateTime(value) {
  if (!value) return "Non disponibile";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function getResponseSheet(response) {
  const payload = response?.risposta_json;
  const yearKey = String(response?.anno ?? payload?.annoCorrente ?? "");
  const yearSheets = payload?.schedeOperative?.[yearKey];
  if (!yearSheets || typeof yearSheets !== "object") return null;
  return Object.values(yearSheets)[0] ?? null;
}

function getFilteredAdminResponses() {
  const search = elements.adminSearch?.value.trim().toLocaleUpperCase("it-IT") ?? "";
  const status = elements.adminStatusFilter?.value ?? "";
  return adminResponses.filter((response) => {
    const sheet = getResponseSheet(response);
    const haystack = [sheet?.matricola, sheet?.cognome, sheet?.nome, sheet?.nominativo]
      .filter(Boolean)
      .join(" ")
      .toLocaleUpperCase("it-IT");
    return (!search || haystack.includes(search)) && (!status || response.stato === status);
  });
}

function addAdminDetail(container, label, value, wide = false) {
  const row = document.createElement("div");
  const heading = document.createElement("strong");
  const content = document.createElement("span");
  row.className = `admin-detail-row${wide ? " admin-detail-row--wide" : ""}`;
  heading.textContent = label;
  content.textContent = value || "Non indicato";
  row.append(heading, content);
  container.appendChild(row);
}

function getResponseFilename(response) {
  const sheet = getResponseSheet(response);
  const unit = response.reparto_destinatario || currentAdminUnit;
  return [
    "scheda_ofcn",
    response.anno,
    safeFilenamePart(sheet?.matricola),
    safeFilenamePart(sheet?.cognome),
    safeFilenamePart(unit),
  ].join("_") + ".json";
}

function downloadJson(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  link.rel = "noopener";
  link.hidden = true;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
}

function updateAdminSelectionControls(filteredResponses = getFilteredAdminResponses()) {
  const filteredIds = filteredResponses.map((response) => response.id);
  const selectedFilteredCount = filteredIds.filter((id) => selectedAdminResponseIds.has(id)).length;
  if (elements.adminSelectAll) {
    elements.adminSelectAll.checked = filteredIds.length > 0 && selectedFilteredCount === filteredIds.length;
    elements.adminSelectAll.indeterminate = selectedFilteredCount > 0 && selectedFilteredCount < filteredIds.length;
  }
  if (elements.adminDownloadSelected) {
    elements.adminDownloadSelected.disabled = selectedAdminResponseIds.size === 0;
    elements.adminDownloadSelected.textContent = selectedAdminResponseIds.size
      ? `Scarica selezionate (${selectedAdminResponseIds.size})`
      : "Scarica selezionate";
  }
}

function renderAdminResponses() {
  if (!elements.adminList || !elements.adminResponseTemplate) return;
  const filteredResponses = getFilteredAdminResponses();
  elements.adminList.replaceChildren();

  filteredResponses.forEach((response) => {
    const fragment = elements.adminResponseTemplate.content.cloneNode(true);
    const card = fragment.querySelector(".admin-response-card");
    const checkbox = fragment.querySelector(".admin-response-select");
    const identity = fragment.querySelector(".admin-response-identity");
    const meta = fragment.querySelector(".admin-response-meta");
    const status = fragment.querySelector(".admin-response-status");
    const detail = fragment.querySelector(".admin-response-detail");
    const downloadButton = fragment.querySelector(".download-response");
    const deleteButton = fragment.querySelector(".delete-response");
    const stateSelect = fragment.querySelector(".admin-response-state");
    const sheet = getResponseSheet(response);
    const preferences = sheet?.preferenze ?? {};
    const priorityText = Array.isArray(preferences.ordinePrioritaTurni)
      ? preferences.ordinePrioritaTurni.map((turn, index) => `${index + 1}ª: turno ${turn}`).join(" · ")
      : "Non indicate";
    const avoidedText = Array.isArray(preferences.turniDaEvitare) && preferences.turniDaEvitare.length
      ? preferences.turniDaEvitare.map((turn) => `Turno ${turn}`).join(", ")
      : "Nessuno";
    const periods = Array.isArray(sheet?.indisponibilita) && sheet.indisponibilita.length
      ? sheet.indisponibilita.map((item) => {
        const range = `${formatDateForPdf(item.dataInizio)} – ${formatDateForPdf(item.dataFine)}`;
        return [range, item.motivo, item.note].filter(Boolean).join(" · ");
      }).join("\n")
      : "Nessuna";

    card.dataset.responseId = String(response.id);
    checkbox.checked = selectedAdminResponseIds.has(response.id);
    identity.textContent = [sheet?.cognome, sheet?.nome].filter(Boolean).join(" ") || "Nominativo non disponibile";
    meta.textContent = `${sheet?.matricola || "Matricola non disponibile"} · ${formatAdminDateTime(response.ricevuto_il)}`;
    status.textContent = response.stato;
    stateSelect.value = response.stato;

    addAdminDetail(detail, "Matricola", sheet?.matricola);
    addAdminDetail(detail, "Anno", String(response.anno));
    addAdminDetail(detail, "Priorità", priorityText, true);
    addAdminDetail(detail, "Turni da evitare", avoidedText, true);
    addAdminDetail(detail, "Natale", formatAvailabilityForPdf(preferences.disponibilitaNatale));
    addAdminDetail(detail, "Estate", formatAvailabilityForPdf(preferences.disponibilitaEstate));
    addAdminDetail(detail, "Doppio turno", formatAvailabilityForPdf(preferences.disponibilitaDoppioTurno), true);
    addAdminDetail(detail, "Indisponibilità", periods, true);
    addAdminDetail(detail, "Corsi e qualifiche desiderati", sheet?.corsiQualificheDesiderati, true);
    addAdminDetail(detail, "Esercitazioni desiderate", sheet?.esercitazioniDesiderate, true);
    addAdminDetail(detail, "Note", sheet?.note, true);

    checkbox.addEventListener("click", (event) => event.stopPropagation());
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) selectedAdminResponseIds.add(response.id);
      else selectedAdminResponseIds.delete(response.id);
      updateAdminSelectionControls();
    });
    downloadButton.addEventListener("click", () => {
      downloadJson(response.risposta_json, getResponseFilename(response));
      setMessage(elements.adminMessage, "JSON originale della scheda scaricato.", "success");
    });
    deleteButton.addEventListener("click", () => deleteAdminResponse(response, deleteButton));
    stateSelect.addEventListener("change", () => updateAdminResponseStatus(response, stateSelect));
    elements.adminList.appendChild(fragment);
  });

  if (elements.adminCount) {
    elements.adminCount.textContent = `${filteredResponses.length} ${filteredResponses.length === 1 ? "scheda" : "schede"}`;
  }
  if (elements.adminEmpty) elements.adminEmpty.hidden = filteredResponses.length > 0;
  updateAdminSelectionControls(filteredResponses);
}

async function loadAdminResponses() {
  if (!currentAdminUnit) return;
  if (elements.adminLoading) elements.adminLoading.hidden = false;
  if (elements.adminEmpty) elements.adminEmpty.hidden = true;
  if (elements.adminRefresh) elements.adminRefresh.disabled = true;
  setMessage(elements.adminMessage);

  try {
    const { data, error } = await supabase
      .from("risposte")
      .select("id, submission_id, anno, risposta_json, reparto_destinatario, stato, ricevuto_il, elaborato_il")
      .eq("reparto_destinatario", currentAdminUnit)
      .order("ricevuto_il", { ascending: false })
      .limit(1000);
    if (error) throw error;
    adminResponses = data ?? [];
    selectedAdminResponseIds = new Set(
      [...selectedAdminResponseIds].filter((id) => adminResponses.some((response) => response.id === id)),
    );
    renderAdminResponses();
  } catch {
    adminResponses = [];
    renderAdminResponses();
    setMessage(elements.adminMessage, "Impossibile caricare le schede del reparto. Riprova.", "error");
  } finally {
    if (elements.adminLoading) elements.adminLoading.hidden = true;
    if (elements.adminRefresh) elements.adminRefresh.disabled = false;
  }
}

async function updateAdminResponseStatus(response, select) {
  const previousStatus = response.stato;
  const nextStatus = select.value;
  select.disabled = true;
  setMessage(elements.adminMessage);

  try {
    const { data, error } = await supabase
      .from("risposte")
      .update({ stato: nextStatus })
      .eq("id", response.id)
      .eq("reparto_destinatario", currentAdminUnit)
      .select("id, stato, elaborato_il")
      .single();
    if (error) throw error;
    response.stato = data.stato;
    response.elaborato_il = data.elaborato_il;
    renderAdminResponses();
    setMessage(elements.adminMessage, "Stato della scheda aggiornato.", "success");
  } catch {
    select.value = previousStatus;
    setMessage(elements.adminMessage, "Aggiornamento non riuscito. La scheda non è stata modificata.", "error");
  } finally {
    select.disabled = false;
  }
}

async function deleteAdminResponse(response, button) {
  const sheet = getResponseSheet(response);
  const identity = [sheet?.matricola, sheet?.cognome, sheet?.nome].filter(Boolean).join(" · ");
  const confirmed = window.confirm(
    `Eliminare definitivamente la scheda${identity ? ` di ${identity}` : " selezionata"}?\n\n` +
    "Questa operazione non può essere annullata.",
  );
  if (!confirmed) return;

  button.disabled = true;
  button.textContent = "Eliminazione…";
  setMessage(elements.adminMessage);

  try {
    const { data, error } = await supabase
      .from("risposte")
      .delete()
      .eq("id", response.id)
      .eq("reparto_destinatario", currentAdminUnit)
      .select("id")
      .single();
    if (error || data?.id !== response.id) throw error || new Error("Scheda non eliminata");

    adminResponses = adminResponses.filter((item) => item.id !== response.id);
    selectedAdminResponseIds.delete(response.id);
    renderAdminResponses();
    setMessage(elements.adminMessage, "Scheda eliminata definitivamente.", "success");
  } catch {
    button.disabled = false;
    button.textContent = "Elimina scheda";
    setMessage(
      elements.adminMessage,
      "Eliminazione non riuscita. La scheda è ancora presente: aggiorna l'elenco e riprova.",
      "error",
    );
  }
}

function downloadSelectedAdminResponses() {
  const selected = adminResponses.filter((response) => selectedAdminResponseIds.has(response.id));
  if (!selected.length) {
    setMessage(elements.adminMessage, "Seleziona almeno una scheda da scaricare.", "error");
    return;
  }

  const exportPayload = {
    tipoFile: "raccolta_schede_operative_ofcn",
    versione: 1,
    repartoDestinatario: currentAdminUnit,
    esportatoIl: new Date().toISOString(),
    numeroSchede: selected.length,
    risposte: selected.map((response) => ({
      idRicezione: response.id,
      submissionId: response.submission_id,
      ricevutoIl: response.ricevuto_il,
      stato: response.stato,
      payload: response.risposta_json,
    })),
  };
  const datePart = new Date().toISOString().slice(0, 10);
  downloadJson(exportPayload, `raccolta_schede_ofcn_${safeFilenamePart(currentAdminUnit)}_${datePart}.json`);
  setMessage(elements.adminMessage, `Raccolta di ${selected.length} schede scaricata.`, "success");
}

function toggleAllFilteredAdminResponses() {
  const filtered = getFilteredAdminResponses();
  if (elements.adminSelectAll?.checked) {
    filtered.forEach((response) => selectedAdminResponseIds.add(response.id));
  } else {
    filtered.forEach((response) => selectedAdminResponseIds.delete(response.id));
  }
  renderAdminResponses();
}

function createDraftSnapshot() {
  return {
    savedAt: Date.now(),
    anno: Number(activeCampaign?.anno || 0),
    matricola: textValue("#matricola"),
    cognome: textValue("#cognome"),
    nome: textValue("#nome"),
    note: textValue("#general-notes"),
    recipientUnit: document.querySelector('input[name="recipient-unit"]:checked')?.value ?? "",
    desiredTraining: textValue("#desired-training"),
    desiredExercises: textValue("#desired-exercises"),
    priorityOrder: Array.from(document.querySelectorAll("[data-priority-position]"))
      .map((select) => select.value),
    avoidedTurns: getAvoidedTurns(),
    availabilityChristmas: textValue("#availability-christmas"),
    availabilitySummer: textValue("#availability-summer"),
    availabilityDoubleShift: textValue("#availability-double-shift"),
    unavailabilities: unavailabilities.map((item) => ({ ...item })),
  };
}

function applyDraftSnapshot(snapshot) {
  if (!snapshot || Number(snapshot.anno) !== Number(activeCampaign?.anno)) return false;

  const values = {
    "#matricola": snapshot.matricola,
    "#cognome": snapshot.cognome,
    "#nome": snapshot.nome,
    "#general-notes": snapshot.note,
    "#desired-training": snapshot.desiredTraining,
    "#desired-exercises": snapshot.desiredExercises,
  };
  Object.entries(values).forEach(([selector, value]) => {
    const field = document.querySelector(selector);
    if (field) field.value = String(value || "");
  });

  document.querySelectorAll('input[name="recipient-unit"]').forEach((radio) => {
    radio.checked = radio.value === snapshot.recipientUnit;
  });

  const selectors = Array.from(document.querySelectorAll("[data-priority-position]"));
  selectors.forEach((select, index) => {
    select.value = String(snapshot.priorityOrder?.[index] || "");
  });

  const avoidedTurns = new Set((snapshot.avoidedTurns || []).map(String));
  document.querySelectorAll("[data-avoid-turn]").forEach((checkbox) => {
    checkbox.checked = avoidedTurns.has(checkbox.value);
  });

  const christmas = document.querySelector("#availability-christmas");
  const summer = document.querySelector("#availability-summer");
  const doubleShift = document.querySelector("#availability-double-shift");
  if (christmas) christmas.value = String(snapshot.availabilityChristmas || "");
  if (summer) summer.value = String(snapshot.availabilitySummer || "");
  if (doubleShift) doubleShift.value = String(snapshot.availabilityDoubleShift || "");

  unavailabilities = Array.isArray(snapshot.unavailabilities)
    ? snapshot.unavailabilities.map((item) => ({ ...item }))
    : [];
  refreshTurnChoices();
  renderRecords();
  return true;
}

function clearPdfRecoveryStorage() {
  try {
    window.sessionStorage.removeItem(PDF_DRAFT_RECOVERY_KEY);
  } catch {
    // Nessuna azione necessaria: alcuni browser possono bloccare lo storage.
  }
}

function saveDraftForPdfRecovery(snapshot) {
  try {
    window.sessionStorage.setItem(PDF_DRAFT_RECOVERY_KEY, JSON.stringify(snapshot));
  } catch {
    // Il ripristino immediato resta disponibile anche se lo storage è bloccato.
  }

  if (pdfRecoveryCleanupTimer) window.clearTimeout(pdfRecoveryCleanupTimer);
  pdfRecoveryCleanupTimer = window.setTimeout(() => {
    clearPdfRecoveryStorage();
    pdfRecoveryCleanupTimer = null;
  }, 120000);
}

function restorePendingPdfDraft() {
  if (!activeCampaign) return;
  let snapshot = null;
  try {
    const stored = window.sessionStorage.getItem(PDF_DRAFT_RECOVERY_KEY);
    if (stored) snapshot = JSON.parse(stored);
    clearPdfRecoveryStorage();
  } catch {
    clearPdfRecoveryStorage();
    return;
  }

  if (!snapshot || Date.now() - Number(snapshot.savedAt || 0) > 120000) return;
  applyDraftSnapshot(snapshot);
}

async function downloadPayloadPdf(payload) {
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
  textRow("Reparto destinatario", formatRecipientUnit(payload.repartoDestinatario));

  sectionTitle("Ordine di priorità dei turni");
  const order = scheda.preferenze?.ordinePrioritaTurni || [];
  order.forEach((turn, index) => {
    const score = PRIORITY_COUNT - index;
    textRow(`${index + 1}a priorità`, `Turno ${turn} - ${score} ${score === 1 ? "punto" : "punti"}`);
  });

  sectionTitle("Turni da evitare preferibilmente");
  const avoidedTurns = scheda.preferenze?.turniDaEvitare || [];
  textRow(
    "Turni",
    avoidedTurns.length ? avoidedTurns.map((turn) => `Turno ${turn}`).join(", ") : "Nessuno",
  );
  textRow("Trattamento", "Vincolo debole: applica una penalità, non esclude la soluzione");

  sectionTitle("Disponibilità nei periodi");
  textRow("Natale", formatAvailabilityForPdf(scheda.preferenze?.disponibilitaNatale));
  textRow("Estate", formatAvailabilityForPdf(scheda.preferenze?.disponibilitaEstate));
  textRow("Doppio turno", formatAvailabilityForPdf(scheda.preferenze?.disponibilitaDoppioTurno));
  textRow("Effetto", "Se disponibile, penalità del doppio turno ridotta ma non annullata");

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

  sectionTitle("Formazione ed esercitazioni desiderate");
  textRow("Corsi ed estensioni di qualifica", scheda.corsiQualificheDesiderati || "Nessuna indicazione");
  textRow("Esercitazioni", scheda.esercitazioniDesiderate || "Nessuna indicazione");

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

  const pdfBlob = doc.output("blob");
  let pdfFile = null;
  let canShareFile = false;

  try {
    if (typeof File === "function") {
      pdfFile = new File([pdfBlob], filename, { type: "application/pdf" });
      canShareFile = typeof navigator.share === "function"
        && typeof navigator.canShare === "function"
        && navigator.canShare({ files: [pdfFile] });
    }
  } catch {
    canShareFile = false;
  }

  if (canShareFile) {
    await navigator.share({
      files: [pdfFile],
      title: `Scheda operativa OFCN ${year}`,
    });
    return "shared";
  }

  const objectUrl = URL.createObjectURL(pdfBlob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  link.rel = "noopener";
  link.hidden = true;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
  return "downloaded";
}

async function handleDownload(event) {
  event?.preventDefault();
  event?.stopPropagation();
  setMessage(elements.responseMessage);
  let draftSnapshot = null;

  try {
    const payload = sentPayload || buildPayload();
    draftSnapshot = createDraftSnapshot();
    saveDraftForPdfRecovery(draftSnapshot);
    elements.downloadButton.disabled = true;
    elements.downloadButton.textContent = "Preparazione PDF…";
    const deliveryMethod = await downloadPayloadPdf(payload);
    const successMessage = deliveryMethod === "shared"
      ? "PDF creato. Scegli dove salvarlo dal pannello del dispositivo."
      : sentPayload
        ? "Copia PDF della risposta inviata scaricata."
        : "Bozza PDF scaricata.";
    setMessage(elements.responseMessage, successMessage, "success");
  } catch (error) {
    if (error?.name === "AbortError") {
      setMessage(elements.responseMessage, "Salvataggio PDF annullato.");
    } else {
      setMessage(elements.responseMessage, error.message || "Impossibile creare il file PDF.", "error");
    }
  } finally {
    if (draftSnapshot) {
      applyDraftSnapshot(draftSnapshot);
      window.setTimeout(() => applyDraftSnapshot(draftSnapshot), 250);
    }
    elements.downloadButton.disabled = false;
    updateSentState(Boolean(sentPayload));
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
  if (elements.unavailabilityCount) {
    elements.unavailabilityCount.textContent = `${unavailabilities.length} inserite`;
  }
  if (elements.addUnavailability) {
    elements.addUnavailability.disabled = false;
    elements.addUnavailability.textContent = "Aggiungi periodo";
  }
  if (elements.unavailabilityWarning) {
    const recommendedMaximumReached =
      unavailabilities.length >= RECOMMENDED_UNAVAILABILITIES;
    elements.unavailabilityWarning.hidden = !recommendedMaximumReached;
    elements.unavailabilityWarning.textContent =
      unavailabilities.length === RECOMMENDED_UNAVAILABILITIES
        ? "Hai raggiunto i 2 periodi consigliati. Puoi comunque aggiungerne altri."
        : recommendedMaximumReached
          ? `Hai inserito ${unavailabilities.length} periodi, oltre i 2 consigliati. Saranno valutati dall'Ufficio Piani durante l'importazione.`
          : "";
  }
}

function refreshTurnChoices() {
  const selectors = Array.from(document.querySelectorAll("[data-priority-position]"));
  const selectedTurns = new Set(selectors.map((select) => select.value).filter(Boolean));
  const avoidedCheckboxes = Array.from(document.querySelectorAll("[data-avoid-turn]"));
  const avoidedTurns = new Set(
    avoidedCheckboxes.filter((checkbox) => checkbox.checked).map((checkbox) => checkbox.value),
  );

  selectors.forEach((select) => {
    Array.from(select.options).forEach((option) => {
      if (!option.value) return;
      option.disabled = option.value !== select.value
        && (selectedTurns.has(option.value) || avoidedTurns.has(option.value));
    });
  });

  avoidedCheckboxes.forEach((checkbox) => {
    const isPreferred = selectedTurns.has(checkbox.value);
    if (isPreferred) checkbox.checked = false;
    checkbox.disabled = isPreferred;
    checkbox.closest(".avoid-option")?.classList.toggle("avoid-option--disabled", isPreferred);
  });
}

function initializePrioritySelectors() {
  if (!elements.priorityGrid) return;
  elements.priorityGrid.replaceChildren();

  for (let position = 1; position <= PRIORITY_COUNT; position += 1) {
    const wrapper = document.createElement("div");
    wrapper.className = "field-group priority-field";

    const label = document.createElement("label");
    const select = document.createElement("select");
    const score = PRIORITY_COUNT - position + 1;
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

    select.addEventListener("change", refreshTurnChoices);
    wrapper.append(label, select);
    elements.priorityGrid.appendChild(wrapper);
  }
}

function initializeAvoidTurnOptions() {
  if (!elements.avoidGrid) return;
  elements.avoidGrid.replaceChildren();

  for (let turn = 1; turn <= TURN_COUNT; turn += 1) {
    const label = document.createElement("label");
    const checkbox = document.createElement("input");
    const text = document.createElement("span");

    label.className = "avoid-option";
    checkbox.type = "checkbox";
    checkbox.value = String(turn);
    checkbox.dataset.avoidTurn = String(turn);
    checkbox.addEventListener("change", refreshTurnChoices);
    text.textContent = `Turno ${turn}`;

    label.append(checkbox, text);
    elements.avoidGrid.appendChild(label);
  }
}

async function initialize() {
  if (elements.currentYear) elements.currentYear.textContent = String(new Date().getFullYear());
  initializePrioritySelectors();
  initializeAvoidTurnOptions();
  refreshTurnChoices();
  renderRecords();
  elements.loginForm?.addEventListener("submit", handleLogin);
  elements.logoutButton?.addEventListener("click", handleLogout);
  elements.responseForm?.addEventListener("submit", handleSubmit);
  elements.downloadButton?.addEventListener("click", handleDownload);
  elements.addUnavailability?.addEventListener("click", addUnavailability);
  elements.adminSearch?.addEventListener("input", renderAdminResponses);
  elements.adminStatusFilter?.addEventListener("change", renderAdminResponses);
  elements.adminSelectAll?.addEventListener("change", toggleAllFilteredAdminResponses);
  elements.adminDownloadSelected?.addEventListener("click", downloadSelectedAdminResponses);
  elements.adminRefresh?.addEventListener("click", loadAdminResponses);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") restorePendingPdfDraft();
  });
  supabase.auth.onAuthStateChange((_event, session) => {
    window.setTimeout(() => renderSession(session), 0);
  });

  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      setMessage(elements.loginMessage, "Impossibile verificare la sessione. Puoi provare ad accedere.", "error");
      showView("login");
      return;
    }
    await renderSession(data.session);
  } catch {
    setMessage(elements.loginMessage, "Servizio temporaneamente non raggiungibile.", "error");
    showView("login");
  }
}

initialize();
