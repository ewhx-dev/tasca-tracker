"use strict";

const STORAGE_KEY = "tasca-transactions-v1";
const THEME_STORAGE_KEY = "tasca-theme-v1";
const currency = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
});
const dateFormatter = new Intl.DateTimeFormat("it-IT", {
  day: "numeric",
  month: "short",
  year: "numeric",
});
const icons = {
  Casa: "⌂",
  Cibo: "◒",
  Trasporti: "↗",
  Svago: "✳",
  Salute: "＋",
  Stipendio: "€",
  Altro: "◌",
};

const list = document.querySelector("#transaction-list");
const filter = document.querySelector("#type-filter");
const dialog = document.querySelector("#transaction-dialog");
const form = document.querySelector("#transaction-form");
const dateInput = form.elements.date;
const themeToggle = document.querySelector("#theme-toggle");
const themeIcon = document.querySelector("#theme-icon");
const themeLabel = document.querySelector("#theme-label");
const themeColorMeta = document.querySelector("#theme-color-meta");
let transactions = loadTransactions();

applyTheme(loadTheme());
themeToggle.addEventListener("click", () => {
  const nextTheme =
    document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  applyTheme(nextTheme);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  } catch (error) {
    console.error("Impossibile salvare la preferenza del tema.", error);
  }
});

document.querySelector("#today-label").textContent =
  new Intl.DateTimeFormat("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());
dateInput.value = toLocalDateInputValue(new Date());

document.querySelector("#open-form").addEventListener("click", () => {
  dialog.showModal();
  form.elements.description.focus();
});

document.querySelector("#close-form").addEventListener("click", closeDialog);
document.querySelector("#cancel-form").addEventListener("click", closeDialog);
dialog.addEventListener("click", (event) => {
  if (event.target === dialog) closeDialog();
});
filter.addEventListener("change", render);
document.querySelector("#export-csv").addEventListener("click", exportCsv);

form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;

  const data = new FormData(form);
  const amount = Number(data.get("amount"));
  if (!Number.isFinite(amount) || amount <= 0) {
    form.elements.amount.setCustomValidity("Inserisci un importo maggiore di zero.");
    form.elements.amount.reportValidity();
    return;
  }
  form.elements.amount.setCustomValidity("");

  transactions.push({
    id: createId(),
    type: data.get("type"),
    description: String(data.get("description")).trim(),
    amount: Math.round(amount * 100) / 100,
    category: data.get("category"),
    date: data.get("date"),
  });

  saveTransactions();
  form.reset();
  dateInput.value = toLocalDateInputValue(new Date());
  closeDialog();
  render();
});

function loadTransactions() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    if (!Array.isArray(stored)) return [];
    return stored.filter(isValidTransaction);
  } catch (error) {
    console.error("Impossibile leggere i movimenti salvati.", error);
    return [];
  }
}

function loadTheme() {
  try {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (savedTheme === "light" || savedTheme === "dark") return savedTheme;
  } catch (error) {
    console.error("Impossibile leggere la preferenza del tema.", error);
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyTheme(theme) {
  const isDark = theme === "dark";
  document.documentElement.dataset.theme = theme;
  themeToggle.setAttribute("aria-pressed", String(isDark));
  themeToggle.setAttribute(
    "aria-label",
    isDark ? "Passa al tema chiaro" : "Passa al tema scuro",
  );
  themeToggle.title = isDark ? "Passa al tema chiaro" : "Passa al tema scuro";
  themeIcon.textContent = isDark ? "☀" : "☾";
  themeLabel.textContent = isDark ? "Tema chiaro" : "Tema scuro";
  themeColorMeta.setAttribute("content", isDark ? "#0c1210" : "#f3f5f0");
}

function isValidTransaction(item) {
  return (
    item !== null &&
    typeof item === "object" &&
    typeof item.id === "string" &&
    (item.type === "income" || item.type === "expense") &&
    typeof item.description === "string" &&
    typeof item.amount === "number" &&
    Number.isFinite(item.amount) &&
    item.amount > 0 &&
    typeof item.category === "string" &&
    typeof item.date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(item.date)
  );
}

function saveTransactions() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
  } catch (error) {
    console.error("Impossibile salvare i movimenti nel browser.", error);
    window.alert("Non è stato possibile salvare i dati. Controlla lo spazio disponibile nel browser.");
  }
}

function render() {
  const now = new Date();
  const monthTransactions = transactions.filter((item) => {
    const date = new Date(`${item.date}T00:00:00`);
    return (
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth()
    );
  });

  const income = monthTransactions
    .filter((item) => item.type === "income")
    .reduce((sum, item) => sum + item.amount, 0);
  const expenses = monthTransactions
    .filter((item) => item.type === "expense")
    .reduce((sum, item) => sum + item.amount, 0);

  document.querySelector("#balance-total").textContent = currency.format(income - expenses);
  document.querySelector("#income-total").textContent = currency.format(income);
  document.querySelector("#expense-total").textContent = currency.format(expenses);

  const visible = transactions
    .filter((item) => filter.value === "all" || item.type === filter.value)
    .sort((a, b) => b.date.localeCompare(a.date));
  list.replaceChildren();

  if (visible.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.innerHTML =
      '<span aria-hidden="true">✳</span><strong>Il tuo taschino è ancora vuoto</strong><p>Aggiungi il primo movimento per iniziare a tenere tutto in ordine.</p>';
    list.append(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  visible.forEach((item) => fragment.append(createTransactionRow(item)));
  list.append(fragment);
}

function createTransactionRow(item) {
  const row = document.createElement("article");
  row.className = "transaction-row";

  const main = document.createElement("div");
  main.className = "transaction-main";
  const icon = document.createElement("span");
  icon.className = "category-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = icons[item.category] || icons.Altro;
  const details = document.createElement("div");
  const title = document.createElement("p");
  title.className = "transaction-name";
  title.textContent = item.description;
  const category = document.createElement("p");
  category.className = "transaction-category";
  category.textContent = item.category;
  details.append(title, category);
  main.append(icon, details);

  const date = document.createElement("time");
  date.className = "transaction-date";
  date.dateTime = item.date;
  date.textContent = dateFormatter.format(new Date(`${item.date}T00:00:00`));

  const amount = document.createElement("span");
  amount.className = `transaction-amount ${item.type}`;
  amount.textContent = `${item.type === "income" ? "+" : "−"}${currency.format(item.amount)}`;

  const remove = document.createElement("button");
  remove.className = "delete-button";
  remove.type = "button";
  remove.setAttribute("aria-label", `Elimina ${item.description}`);
  remove.title = "Elimina movimento";
  remove.textContent = "×";
  remove.addEventListener("click", () => {
    transactions = transactions.filter((transaction) => transaction.id !== item.id);
    saveTransactions();
    render();
  });

  row.append(main, date, amount, remove);
  return row;
}

function exportCsv() {
  if (transactions.length === 0) {
    window.alert("Non ci sono movimenti da esportare.");
    return;
  }

  const rows = [
    ["Data", "Tipo", "Descrizione", "Categoria", "Importo (EUR)"],
    ...transactions.map((item) => [
      item.date,
      item.type === "income" ? "Entrata" : "Uscita",
      item.description,
      item.category,
      item.amount.toFixed(2),
    ]),
  ];
  const csv = rows
    .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(";"))
    .join("\r\n");
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `tasca-movimenti-${toLocalDateInputValue(new Date())}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function closeDialog() {
  dialog.close();
}

function toLocalDateInputValue(date) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function createId() {
  return globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

render();
