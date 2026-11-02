const eventDialog = document.querySelector("#event-dialog");
const eventForm = document.querySelector("#event-form");
const eventGrid = document.querySelector("#event-grid");
const emptyState = document.querySelector("#empty-state");
const eventCount = document.querySelector("#event-count");
const chatForm = document.querySelector("#chat-form");
const chatInput = document.querySelector("#chat-input");
const chatHistory = document.querySelector("#chat-history");
const sendButton = chatForm.querySelector('button[type="submit"]');
const catIconTemplate = document.querySelector("#cat-icon-template");

const events = [];
let activeFilter = "todos";
let isReplyPending = false;

function addCatIcon(container) {
  container.append(catIconTemplate.content.cloneNode(true));
}

function openEventDialog() {
  eventDialog.showModal();
  document.querySelector("#event-title").focus();
}

function closeEventDialog() {
  eventForm.reset();
  eventDialog.close();
}

function formatDate(date) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}

function createEventCard(event) {
  const card = document.createElement("article");
  card.className = "event-card";
  card.dataset.category = event.category;

  const category = document.createElement("p");
  category.className = "event-category";

  const categoryDetails = {
    examen: { icon: "📝", label: "Examen" },
    aviso: { icon: "📣", label: "Aviso docente" },
    entrega: { icon: "📚", label: "Entrega / tarea" },
  };
  const categoryDetail = categoryDetails[event.category];
  const categoryIcon = document.createElement("span");
  categoryIcon.className = "event-category-icon";
  categoryIcon.setAttribute("aria-hidden", "true");
  categoryIcon.textContent = categoryDetail.icon;
  category.append(categoryIcon, document.createTextNode(categoryDetail.label));

  const title = document.createElement("h2");
  title.className = "event-title";
  title.textContent = event.title;

  const date = document.createElement("time");
  date.className = "event-date";
  date.dateTime = event.date;
  date.textContent = formatDate(event.date);

  card.append(category, title, date);

  if (event.description) {
    const description = document.createElement("p");
    description.className = "event-description";
    description.textContent = event.description;
    card.append(description);
  }

  return card;
}

function renderEvents() {
  const visibleEvents = activeFilter === "todos"
    ? events
    : events.filter((event) => event.category === activeFilter);

  eventGrid.replaceChildren();
  eventCount.textContent = `${visibleEvents.length} ${visibleEvents.length === 1 ? "evento" : "eventos"}`;

  if (events.length === 0) {
    eventGrid.append(emptyState);
    return;
  }

  if (visibleEvents.length === 0) {
    const message = document.createElement("p");
    message.className = "filtered-empty";
    message.textContent = "No hay eventos en esta categoría todavía.";
    eventGrid.append(message);
    return;
  }

  visibleEvents.forEach((event) => eventGrid.append(createEventCard(event)));
}

function setActiveFilter(filterButton) {
  activeFilter = filterButton.dataset.filter;

  document.querySelectorAll(".filter-button").forEach((button) => {
    const isActive = button === filterButton;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });

  renderEvents();
}

function formatTime(date) {
  return new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function addMessage(text, sender, time = new Date()) {
  const row = document.createElement("div");
  row.className = "message-row";

  if (sender === "bot") {
    const avatar = document.createElement("div");
    avatar.className = "message-avatar";
    avatar.setAttribute("aria-hidden", "true");
    addCatIcon(avatar);
    row.append(avatar);
  }

  const message = document.createElement("div");
  message.className = `message message-${sender}`;

  const content = document.createElement("p");
  content.textContent = text;

  const timestamp = document.createElement("time");
  timestamp.dateTime = time.toISOString();
  timestamp.textContent = formatTime(time);

  message.append(content, timestamp);
  row.append(message);
  chatHistory.append(row);
  chatHistory.scrollTop = chatHistory.scrollHeight;
}

function createChatReply(question) {
  const normalizedQuestion = question
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const isPendingQuestion = /\b(pendiente(?:s)?|por hacer|tengo que hacer|me falta(?:n)?|debo hacer|tareas?)\b/.test(normalizedQuestion);
  const today = new Date();
  const todayString = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");

  if (isPendingQuestion) {
    const pendingEvents = events
      .filter((event) => event.date >= todayString)
      .sort((first, second) => first.date.localeCompare(second.date));

    if (pendingEvents.length === 0) {
      return "no tenes nada pendiente!";
    }

    const details = pendingEvents
      .slice(0, 3)
      .map((event) => `${event.title}: ${formatDate(event.date)}`)
      .join(" · ");
    return `Tenés pendiente: ${details}.`;
  }

  const categoryIntent = /\b(examen(?:es)?|prueba(?:s)?|parcial(?:es)?|evaluacion(?:es)?)\b/.test(normalizedQuestion)
    ? "examen"
    : /\b(aviso(?:s)?|entrega(?:s)?|tarea(?:s)?)\b/.exec(normalizedQuestion)?.[0];
  const intentWords = new Set([
    "fecha", "fechas", "cuando", "dia", "dias", "examen", "examenes",
    "prueba", "pruebas", "parcial", "parciales", "evaluacion", "evaluaciones",
    "aviso", "avisos", "entrega", "entregas", "tarea", "tareas",
    "tengo", "tenes", "tienes", "tenemos", "hay", "algun", "alguna",
    "algunos", "algunas", "quiero", "saber", "curso", "clase",
  ]);
  const terms = normalizedQuestion
    .split(/\s+/)
    .map((word) => word.replace(/[¿?¡!,.:;]/g, ""))
    .filter((word) => word.length > 3 && !intentWords.has(word));

  let matchingEvents = events.filter((event) => {
    const searchableText = `${event.title} ${event.description}`
      .toLocaleLowerCase("es")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    return terms.some((word) => searchableText.includes(word));
  });

  if (matchingEvents.length === 0 && terms.length === 0 && categoryIntent) {
    const category = categoryIntent === "examen" ? "examen" : categoryIntent.startsWith("aviso") ? "aviso" : "entrega";
    matchingEvents = events.filter((event) => event.category === category);
  }

  if (matchingEvents.length > 0) {
    const details = matchingEvents
      .slice(0, 3)
      .map((event) => `${event.title}: ${formatDate(event.date)}`)
      .join(" · ");
    return `Encontré esto en la agenda: ${details}.`;
  }

  if (/\b(fecha|fechas|cuando|dia|dias|examen(?:es)?|prueba(?:s)?|parcial(?:es)?|evaluacion(?:es)?)\b/.test(normalizedQuestion)) {
    return "upsss eso no lo se....:(";
  }

  if (events.length === 0) {
    return "Todavía no hay eventos en la agenda. Cuando agreguen fechas, avisos o entregas, voy a poder ayudarte a encontrarlos.";
  }

  return "Por ahora puedo ayudarte a ubicar eventos por su título o descripción. También podés revisar los filtros de la agenda.";
}

document.querySelector("#open-event-dialog").addEventListener("click", openEventDialog);
document.querySelector("#empty-state-add").addEventListener("click", openEventDialog);
document.querySelector("#close-event-dialog").addEventListener("click", closeEventDialog);
document.querySelector("#cancel-event").addEventListener("click", closeEventDialog);

eventDialog.addEventListener("click", (event) => {
  if (event.target === eventDialog) {
    closeEventDialog();
  }
});

eventForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const formData = new FormData(eventForm);
  events.push({
    title: formData.get("title").trim(),
    category: formData.get("category"),
    date: formData.get("date"),
    description: formData.get("description").trim(),
  });

  const allFilter = document.querySelector('.filter-button[data-filter="todos"]');
  setActiveFilter(allFilter);
  eventForm.reset();
  eventDialog.close();
});

document.querySelectorAll(".filter-button").forEach((button) => {
  button.addEventListener("click", () => setActiveFilter(button));
});

chatForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const question = chatInput.value.trim();

  if (!question || isReplyPending) {
    return;
  }

  addMessage(question, "user");
  chatInput.value = "";
  isReplyPending = true;
  sendButton.disabled = true;
  chatInput.focus();

  window.setTimeout(() => {
    addMessage(createChatReply(question), "bot");
    isReplyPending = false;
    sendButton.disabled = false;
    chatInput.focus();
  }, 550);
});

addCatIcon(document.querySelector(".chat-avatar"));
addCatIcon(document.querySelector(".message-avatar"));
renderEvents();