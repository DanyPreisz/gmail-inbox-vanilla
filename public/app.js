const list = document.querySelector("#list");
const read = document.querySelector("#read");
const q = document.querySelector("#q");
let current = null;

q.addEventListener("input", load);
list.addEventListener("click", async (event) => {
  const star = event.target.closest("[data-star]");
  if (star) {
    event.stopPropagation();
    await fetch(`/api/mail/${star.dataset.star}/star`, { method: "POST" });
    load();
    return;
  }
  const row = event.target.closest("[data-id]");
  if (!row) return;
  current = row.dataset.id;
  const mail = await (await fetch("/api/mail/" + current)).json();
  read.innerHTML = `<p class="muted">${escapeHtml(mail.from)}</p><h2>${escapeHtml(mail.subject)}</h2><p>${escapeHtml(mail.body)}</p><button class="del" data-del="${mail.id}">Eliminar</button>`;
  load();
});

read.addEventListener("click", async (event) => {
  const btn = event.target.closest("[data-del]");
  if (!btn) return;
  await fetch("/api/mail/" + btn.dataset.del, { method: "DELETE" });
  current = null;
  read.innerHTML = "<p>Elegí un correo.</p>";
  load();
});

async function load() {
  const rows = await (await fetch("/api/mail?q=" + encodeURIComponent(q.value))).json();
  list.innerHTML = rows
    .map(
      (m) => `
        <li data-id="${m.id}" class="${m.read ? "" : "unread"} ${m.id === current ? "is-on" : ""}">
          <button class="star ${m.star ? "on" : ""}" data-star="${m.id}">★</button>
          <span>${escapeHtml(m.from)}<br><small class="muted">${escapeHtml(m.subject)}</small></span>
        </li>
      `
    )
    .join("");
}

function escapeHtml(s) {
  return String(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;");
}

load();
