"use strict";

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.112.4/+esm";
import {
  LOGIN_ALIASES,
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_URL,
} from "./config.js";

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
};

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: "ofcn-auth-v1",
  },
});

function showView(viewName) {
  const views = {
    loading: elements.loadingView,
    login: elements.loginView,
    authenticated: elements.authenticatedView,
  };

  Object.entries(views).forEach(([name, element]) => {
    if (element) {
      element.hidden = name !== viewName;
    }
  });
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

function renderSession(session) {
  if (!session?.user) {
    if (elements.sessionLabel) {
      elements.sessionLabel.textContent = "Sessione protetta attiva.";
    }
    showView("login");
    return;
  }

  if (elements.sessionLabel) {
    elements.sessionLabel.textContent = "Sessione PLAN_OFCN attiva.";
  }

  if (elements.password) {
    elements.password.value = "";
  }

  setMessage(elements.loginMessage);
  showView("authenticated");
}

async function handleLogin(event) {
  event.preventDefault();
  setMessage(elements.loginMessage);

  const username = elements.username?.value.trim().toUpperCase() ?? "";
  const email = LOGIN_ALIASES[username];
  const password = elements.password?.value ?? "";

  if (!username || !email || !password) {
    setMessage(
      elements.loginMessage,
      "Nome utente o password non validi.",
      "error",
    );
    return;
  }

  setLoginPending(true);

  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data.session) {
      setMessage(
        elements.loginMessage,
        "Credenziali non valide oppure accesso non disponibile.",
        "error",
      );
      return;
    }

    renderSession(data.session);
  } catch {
    setMessage(
      elements.loginMessage,
      "Impossibile contattare il servizio. Controlla la connessione e riprova.",
      "error",
    );
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
      setMessage(
        elements.logoutMessage,
        "Non è stato possibile terminare la sessione. Riprova.",
        "error",
      );
      return;
    }

    showView("login");
    setMessage(elements.loginMessage, "Uscita effettuata da questo dispositivo.", "success");
  } catch {
    setMessage(
      elements.logoutMessage,
      "Impossibile contattare il servizio. Controlla la connessione e riprova.",
      "error",
    );
  } finally {
    elements.logoutButton.disabled = false;
    elements.logoutButton.textContent = "Esci da questo dispositivo";
  }
}

async function initialize() {
  if (elements.currentYear) {
    elements.currentYear.textContent = String(new Date().getFullYear());
  }

  elements.loginForm?.addEventListener("submit", handleLogin);
  elements.logoutButton?.addEventListener("click", handleLogout);

  supabase.auth.onAuthStateChange((_event, session) => {
    renderSession(session);
  });

  try {
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      setMessage(
        elements.loginMessage,
        "Impossibile verificare la sessione. Puoi provare ad accedere.",
        "error",
      );
      showView("login");
      return;
    }

    renderSession(data.session);
  } catch {
    setMessage(
      elements.loginMessage,
      "Servizio temporaneamente non raggiungibile.",
      "error",
    );
    showView("login");
  }
}

initialize();
