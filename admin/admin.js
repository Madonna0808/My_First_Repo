// Demo admin dashboard. All data is mock data kept in localStorage —
// replace the `store` helpers with real API calls when wiring up a backend.

const DEMO_USER = "admin";
const DEMO_PASS = "admin123";
const STORAGE_KEY = "agent-admin-data";

const names = ["Aisha Rahman", "Ben Carter", "Chen Wei", "Diana Lopez", "Ethan Brooks", "Fatimah Zahra",
    "George Kim", "Hana Sato", "Ivan Petrov", "Julia Rossi", "Kamal Hassan", "Lina Nguyen"];
const destinations = ["Bali", "Tokyo", "Paris", "Istanbul", "Dubai", "Kuala Lumpur", "London", "Seoul", "Bangkok", "Makkah"];
const statuses = ["Confirmed", "Pending", "Cancelled"];

function pick(arr, i) {
    return arr[i % arr.length];
}

function isoDaysAgo(days) {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().slice(0, 10);
}

function seedData() {
    const agents = names.slice(0, 8).map((name, i) => ({
        id: i + 1,
        name,
        email: name.toLowerCase().replace(/\s+/g, ".") + "@agency.com",
        region: pick(["Asia", "Europe", "Middle East", "Americas"], i),
        commission: 5 + (i % 4) * 2.5,
        status: i % 5 === 4 ? "Inactive" : "Active",
    }));

    const bookings = Array.from({ length: 30 }, (_, i) => ({
        id: 1001 + i,
        customer: pick(names, i * 7 + 3),
        destination: pick(destinations, i * 3),
        agent: agents[i % agents.length].name,
        date: isoDaysAgo(i * 2),
        amount: 400 + ((i * 397) % 3200),
        status: pick(statuses, (i * 5) % 7 === 0 ? 2 : i % 4 === 1 ? 1 : 0),
    }));

    const transactions = bookings.filter((b) => b.status !== "Cancelled").map((b, i) => ({
        id: "TX" + (5000 + i),
        booking: b.id,
        method: pick(["Card", "Bank transfer", "PayPal", "Cash"], i),
        date: b.date,
        amount: b.amount,
        status: b.status === "Confirmed" ? "Paid" : "Pending",
    }));

    const users = names.map((name, i) => ({
        id: i + 1,
        name,
        email: name.toLowerCase().replace(/\s+/g, "") + "@mail.com",
        role: i === 0 ? "Admin" : i < 3 ? "Editor" : "Customer",
        joined: isoDaysAgo(30 + i * 23),
    }));

    return {
        agents,
        bookings,
        transactions,
        users,
        settings: {
            siteName: "Agent Admin",
            supportEmail: "support@agency.com",
            commission: 7.5,
            currency: "USD",
            notifications: true,
        },
    };
}

const store = {
    load() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) return JSON.parse(raw);
        } catch (e) { /* fall through to seed */ }
        return seedData();
    },
    save(data) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch (e) { /* storage unavailable: keep in memory */ }
    },
};

let data = store.load();

// ---------- Formatting ----------

function money(n) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: data.settings.currency, maximumFractionDigits: 0 }).format(n);
}

function badge(value) {
    const color = { Confirmed: "green", Active: "green", Paid: "green", Pending: "amber", Cancelled: "red", Inactive: "red" }[value];
    return color ? `<span class="badge ${color}">${value}</span>` : escapeHtml(value);
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// ---------- Table definitions ----------

const tables = {
    agents: {
        columns: [
            { key: "name", label: "Name" },
            { key: "email", label: "Email" },
            { key: "region", label: "Region", options: ["Asia", "Europe", "Middle East", "Americas"] },
            { key: "commission", label: "Commission %", type: "number", format: (v) => v + "%" },
            { key: "status", label: "Status", options: ["Active", "Inactive"], format: badge },
        ],
        editable: true,
    },
    bookings: {
        columns: [
            { key: "id", label: "ID", format: (v) => "#" + v },
            { key: "customer", label: "Customer" },
            { key: "destination", label: "Destination" },
            { key: "agent", label: "Agent" },
            { key: "date", label: "Date" },
            { key: "amount", label: "Amount", format: money },
            { key: "status", label: "Status", format: badge },
        ],
        filter: () => document.getElementById("booking-filter").value,
    },
    transactions: {
        columns: [
            { key: "id", label: "Transaction" },
            { key: "booking", label: "Booking", format: (v) => "#" + v },
            { key: "method", label: "Method" },
            { key: "date", label: "Date" },
            { key: "amount", label: "Amount", format: money },
            { key: "status", label: "Status", format: badge },
        ],
    },
    users: {
        columns: [
            { key: "name", label: "Name" },
            { key: "email", label: "Email" },
            { key: "role", label: "Role", options: ["Admin", "Editor", "Customer"] },
            { key: "joined", label: "Joined", type: "date" },
        ],
        editable: true,
    },
};

const sortState = {};

function renderTable(name, rows, el, { limit } = {}) {
    const def = tables[name];
    const query = document.getElementById("global-search").value.trim().toLowerCase();
    const statusFilter = def.filter ? def.filter() : "";
    const sort = sortState[name];

    let list = rows.filter((r) =>
        (!statusFilter || r.status === statusFilter) &&
        (!query || Object.values(r).some((v) => String(v).toLowerCase().includes(query))));

    if (sort) {
        list = [...list].sort((a, b) => (a[sort.key] > b[sort.key] ? 1 : a[sort.key] < b[sort.key] ? -1 : 0) * sort.dir);
    }
    if (limit) list = list.slice(0, limit);

    const head = def.columns.map((c) => {
        const arrow = sort && sort.key === c.key ? (sort.dir > 0 ? " ▲" : " ▼") : "";
        return `<th data-sort="${c.key}">${c.label}${arrow}</th>`;
    }).join("") + (def.editable && !limit ? "<th></th>" : "");

    const body = list.map((r) => {
        const cells = def.columns.map((c) => `<td>${c.format ? c.format(r[c.key]) : escapeHtml(r[c.key])}</td>`).join("");
        const actions = def.editable && !limit
            ? `<td class="row-actions">
                   <button data-edit="${r.id}" aria-label="Edit"><i class="fa-solid fa-pen"></i></button>
                   <button data-delete="${r.id}" aria-label="Delete"><i class="fa-solid fa-trash"></i></button>
               </td>`
            : "";
        return `<tr>${cells}${actions}</tr>`;
    }).join("");

    const span = def.columns.length + (def.editable ? 1 : 0);
    el.innerHTML = `<thead><tr>${head}</tr></thead>
        <tbody>${body || `<tr><td colspan="${span}" class="empty">No records found.</td></tr>`}</tbody>`;

    if (!limit) {
        el.querySelectorAll("th[data-sort]").forEach((th) => th.addEventListener("click", () => {
            const key = th.dataset.sort;
            sortState[name] = { key, dir: sort && sort.key === key ? -sort.dir : 1 };
            renderTable(name, rows, el);
        }));
        el.querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", () => openModal(name, Number(b.dataset.edit))));
        el.querySelectorAll("[data-delete]").forEach((b) => b.addEventListener("click", () => {
            if (!confirm("Delete this record?")) return;
            data[name] = data[name].filter((r) => r.id !== Number(b.dataset.delete));
            store.save(data);
            render();
        }));
    }
}

// ---------- Dashboard ----------

function renderStats() {
    const confirmed = data.bookings.filter((b) => b.status === "Confirmed");
    const revenue = confirmed.reduce((s, b) => s + b.amount, 0);
    const cards = [
        { icon: "fa-sack-dollar", label: "Total revenue", value: money(revenue), delta: "+12.4%" },
        { icon: "fa-calendar-check", label: "Bookings", value: data.bookings.length, delta: "+8.1%" },
        { icon: "fa-user-tie", label: "Active agents", value: data.agents.filter((a) => a.status === "Active").length, delta: "+2" },
        { icon: "fa-users", label: "Users", value: data.users.length, delta: "-1.3%", down: true },
    ];
    document.getElementById("stats").innerHTML = cards.map((c) => `
        <div class="stat">
            <div class="stat-icon"><i class="fa-solid ${c.icon}"></i></div>
            <div>
                <div class="stat-label">${c.label}</div>
                <div class="stat-value">${c.value}</div>
                <div class="stat-delta ${c.down ? "down" : ""}">${c.delta} vs last month</div>
            </div>
        </div>`).join("");
}

function renderRevenueChart() {
    const months = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        // Deterministic mock series trending upward
        months.push({ label: d.toLocaleString("en-US", { month: "short" }), value: 8000 + (11 - i) * 900 + ((i * 1733) % 2500) });
    }
    const w = 600, h = 240, pad = { l: 44, r: 10, t: 10, b: 24 };
    const max = Math.ceil(Math.max(...months.map((m) => m.value)) / 5000) * 5000;
    const x = (i) => pad.l + (i * (w - pad.l - pad.r)) / (months.length - 1);
    const y = (v) => pad.t + (1 - v / max) * (h - pad.t - pad.b);
    const pts = months.map((m, i) => `${x(i)},${y(m.value)}`).join(" ");

    let grid = "";
    for (let v = 0; v <= max; v += max / 4) {
        grid += `<line class="grid" x1="${pad.l}" x2="${w - pad.r}" y1="${y(v)}" y2="${y(v)}"/>
                 <text class="axis" x="${pad.l - 6}" y="${y(v) + 4}" text-anchor="end">${v / 1000}k</text>`;
    }
    const labels = months.map((m, i) => `<text class="axis" x="${x(i)}" y="${h - 6}" text-anchor="middle">${m.label}</text>`).join("");
    const dots = months.map((m, i) => `<circle cx="${x(i)}" cy="${y(m.value)}" r="3" fill="var(--primary)"><title>${m.label}: ${money(m.value)}</title></circle>`).join("");

    document.getElementById("revenue-chart").innerHTML = `
        <svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
            ${grid}
            <polygon points="${x(0)},${y(0)} ${pts} ${x(months.length - 1)},${y(0)}" fill="var(--primary)" opacity="0.12"/>
            <polyline points="${pts}" fill="none" stroke="var(--primary)" stroke-width="2.5"/>
            ${dots}${labels}
        </svg>`;
}

function renderStatusChart() {
    const colors = { Confirmed: "var(--green)", Pending: "var(--amber)", Cancelled: "var(--red)" };
    const total = data.bookings.length || 1;
    document.getElementById("status-chart").innerHTML = statuses.map((s) => {
        const n = data.bookings.filter((b) => b.status === s).length;
        const pct = Math.round((n / total) * 100);
        return `<div class="bar-row">
            <div><span>${s}</span><span class="muted">${n} · ${pct}%</span></div>
            <div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${colors[s]}"></div></div>
        </div>`;
    }).join("");
}

// ---------- Modal (add / edit) ----------

let modalContext = null;

function openModal(name, id) {
    const def = tables[name];
    const record = id ? data[name].find((r) => r.id === id) : {};
    modalContext = { name, id };
    document.getElementById("modal-title").textContent = (id ? "Edit " : "Add ") + name.replace(/s$/, "");
    document.getElementById("modal-fields").innerHTML = def.columns.map((c) => {
        const val = escapeHtml(record[c.key] ?? "");
        if (c.options) {
            return `<label>${c.label}<select name="${c.key}">${c.options.map((o) =>
                `<option ${o === record[c.key] ? "selected" : ""}>${o}</option>`).join("")}</select></label>`;
        }
        const type = c.type || (c.key === "email" ? "email" : "text");
        return `<label>${c.label}<input name="${c.key}" type="${type}" value="${val}" required ${type === "number" ? 'step="0.5"' : ""}></label>`;
    }).join("");
    document.getElementById("modal").showModal();
}

document.getElementById("modal").addEventListener("close", (e) => {
    const modal = e.target;
    if (modal.returnValue !== "save" || !modalContext) return;
    const { name, id } = modalContext;
    const values = Object.fromEntries(new FormData(document.getElementById("modal-form")));
    tables[name].columns.forEach((c) => {
        if (c.type === "number") values[c.key] = Number(values[c.key]);
    });
    if (id) {
        Object.assign(data[name].find((r) => r.id === id), values);
    } else {
        const nextId = Math.max(0, ...data[name].map((r) => r.id)) + 1;
        if (name === "users" && !values.joined) values.joined = isoDaysAgo(0);
        data[name].unshift({ id: nextId, ...values });
    }
    store.save(data);
    render();
});

// ---------- Settings ----------

const settingsForm = document.getElementById("settings-form");

function fillSettings() {
    Object.entries(data.settings).forEach(([k, v]) => {
        const field = settingsForm.elements[k];
        if (!field) return;
        if (field.type === "checkbox") field.checked = v;
        else field.value = v;
    });
}

settingsForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const f = settingsForm.elements;
    data.settings = {
        siteName: f.siteName.value,
        supportEmail: f.supportEmail.value,
        commission: Number(f.commission.value),
        currency: f.currency.value,
        notifications: f.notifications.checked,
    };
    store.save(data);
    document.querySelectorAll(".brand span").forEach((s) => (s.textContent = data.settings.siteName));
    const saved = document.getElementById("settings-saved");
    saved.hidden = false;
    setTimeout(() => (saved.hidden = true), 2000);
    render();
});

// ---------- CSV export ----------

document.getElementById("export-csv").addEventListener("click", () => {
    const cols = tables.transactions.columns;
    const lines = [cols.map((c) => c.label).join(",")]
        .concat(data.transactions.map((r) => cols.map((c) => `"${String(r[c.key]).replace(/"/g, '""')}"`).join(",")));
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "transactions.csv";
    a.click();
    URL.revokeObjectURL(a.href);
});

// ---------- Routing ----------

const titles = { dashboard: "Dashboard", agents: "Agents", bookings: "Bookings", transactions: "Transactions", users: "Users", settings: "Settings" };

function currentView() {
    const v = location.hash.slice(1);
    return titles[v] ? v : "dashboard";
}

function render() {
    const view = currentView();
    document.getElementById("page-title").textContent = titles[view];
    document.querySelectorAll("[data-page]").forEach((s) => (s.hidden = s.dataset.page !== view));
    document.querySelectorAll(".sidebar a").forEach((a) => a.classList.toggle("active", a.dataset.view === view));

    if (view === "dashboard") {
        renderStats();
        renderRevenueChart();
        renderStatusChart();
        renderTable("bookings", data.bookings, document.getElementById("recent-table"), { limit: 6 });
    } else if (view === "settings") {
        fillSettings();
    } else {
        renderTable(view, data[view], document.getElementById(view + "-table"));
    }
}

window.addEventListener("hashchange", () => {
    document.getElementById("sidebar").classList.remove("open");
    render();
});
document.getElementById("global-search").addEventListener("input", render);
document.getElementById("booking-filter").addEventListener("change", render);
document.querySelectorAll("[data-add]").forEach((b) => b.addEventListener("click", () => openModal(b.dataset.add)));
document.getElementById("menu-toggle").addEventListener("click", () => document.getElementById("sidebar").classList.toggle("open"));

// ---------- Theme ----------

function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    document.querySelector("#theme-toggle i").className = theme === "dark" ? "fa-solid fa-sun" : "fa-solid fa-moon";
}

document.getElementById("theme-toggle").addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    applyTheme(next);
    try { localStorage.setItem("agent-admin-theme", next); } catch (e) { /* ignore */ }
});

try { applyTheme(localStorage.getItem("agent-admin-theme") || "light"); } catch (e) { applyTheme("light"); }

// ---------- Auth (demo only: client-side, not secure) ----------

function showApp(loggedIn) {
    document.getElementById("login-view").hidden = loggedIn;
    document.getElementById("app-view").hidden = !loggedIn;
    if (loggedIn) {
        document.querySelectorAll(".brand span").forEach((s) => (s.textContent = data.settings.siteName));
        render();
    }
}

document.getElementById("login-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const ok = document.getElementById("login-user").value === DEMO_USER &&
        document.getElementById("login-pass").value === DEMO_PASS;
    document.getElementById("login-error").hidden = ok;
    if (ok) {
        try { sessionStorage.setItem("agent-admin-auth", "1"); } catch (err) { /* ignore */ }
        showApp(true);
    }
});

document.getElementById("logout-btn").addEventListener("click", () => {
    try { sessionStorage.removeItem("agent-admin-auth"); } catch (err) { /* ignore */ }
    showApp(false);
});

let authed = false;
try { authed = sessionStorage.getItem("agent-admin-auth") === "1"; } catch (err) { /* ignore */ }
showApp(authed);
