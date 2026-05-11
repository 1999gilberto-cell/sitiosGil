// ===== GAMEZONE LIVE — Anthropic API + Web Search =====
// Conecta con la API de Claude (claude-sonnet-4-20250514) con web_search activado

const API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL   = 'claude-sonnet-4-20250514';

// ── Categorías predefinidas ──
const CATEGORIES = [
    { label: '🎮 Consolas',  query: 'últimas noticias y novedades consolas PlayStation Xbox Nintendo 2025 2026 precios ofertas' },
    { label: '💻 PC Gaming', query: 'novedades PC gaming GPUs procesadores hardware gaming 2025 2026 RTX ofertas' },
    { label: '📱 Móviles',   query: 'últimas noticias celulares smartphones gaming móvil 2025 2026 precios nuevos modelos' },
    { label: '🔥 Ofertas',   query: 'mejores ofertas descuentos videojuegos hardware gaming hoy 2026' },
    { label: '🚀 Próximos',  query: 'próximos lanzamientos videojuegos tecnología gaming 2025 2026 anuncios' },
    { label: '⚡ Hardware',  query: 'novedades hardware tecnología PC componentes tarjetas gráficas 2026' },
];

// ── State ──
let activeCategory = null;
let isLoading = false;

// ── DOM refs ──
const searchInput  = document.getElementById('search-input');
const searchBtn    = document.getElementById('search-btn');
const statusEl     = document.getElementById('results-status');
const gridEl       = document.getElementById('results-grid');
const chipsEl      = document.getElementById('category-chips');

// ── Build category chips ──
function buildChips() {
    if (!chipsEl) return;
    CATEGORIES.forEach((cat, i) => {
        const btn = document.createElement('button');
        btn.className = 'chip';
        btn.textContent = cat.label;
        btn.addEventListener('click', () => {
            document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            activeCategory = i;
            searchInput.value = '';
            fetchNews(cat.query, cat.label);
        });
        chipsEl.appendChild(btn);
    });
}

// ── Llamada a la API de Anthropic con web_search ──
async function fetchNews(query, label) {
    if (isLoading) return;
    isLoading = true;
    searchBtn.disabled = true;

    setStatus('loading', `Buscando en la web: "${label || query}"…`);
    gridEl.innerHTML = '';

    const systemPrompt = `Eres el editor de tecnología y gaming de GameZone, un portal latinoamericano de videojuegos y tecnología.
Tu trabajo es usar la herramienta de búsqueda web para encontrar información REAL y ACTUAL sobre el tema solicitado.
Después, responde ÚNICAMENTE con un JSON válido (sin markdown, sin backticks, sin texto extra) con este esquema exacto:

{
  "items": [
    {
      "title": "Título corto y llamativo (max 80 chars)",
      "category": "PC|Consola|Móvil|Hardware|Oferta|Lanzamiento|Noticia",
      "tag": "tag de una palabra",
      "summary": "Resumen de 2-3 oraciones con datos concretos y actuales.",
      "price": "precio si aplica, ej: $599 USD o vacío",
      "date": "fecha aproximada si se conoce, ej: Mayo 2026",
      "badge": "NEW|HOT|DEAL|TECH",
      "highlight": "dato clave muy breve, ej: 97/100 o -40% o 16GB RAM"
    }
  ]
}

Devuelve entre 6 y 9 items. Usa datos REALES de la búsqueda web. No inventes precios ni fechas.`;

    const userMsg = `Busca en la web información ACTUAL sobre: ${query}
Fecha de hoy: ${new Date().toLocaleDateString('es-CO', {year:'numeric',month:'long',day:'numeric'})}.
Enfócate en noticias y datos de los últimos 30-90 días. Incluye precios reales si los encuentras.`;

    try {
        const res = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: MODEL,
                max_tokens: 2000,
                system: systemPrompt,
                tools: [{ type: 'web_search_20250305', name: 'web_search' }],
                messages: [{ role: 'user', content: userMsg }]
            })
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error?.message || `HTTP ${res.status}`);
        }

        const data = await res.json();

        // Extraer texto de todos los bloques (ignorar tool_use / tool_result)
        const text = (data.content || [])
            .filter(b => b.type === 'text')
            .map(b => b.text)
            .join('');

        // Limpiar y parsear JSON
        const clean = text.replace(/```json|```/g, '').trim();
        const json  = JSON.parse(clean);

        if (!json.items || !json.items.length) throw new Error('Sin resultados');

        renderCards(json.items, label || query);
        setStatus('ok', `${json.items.length} resultados en tiempo real · ${new Date().toLocaleTimeString('es-CO')}`);

    } catch (e) {
        console.error('API Error:', e);
        setStatus('error', `Error: ${e.message} — Verifica tu API Key en config.js`);
        gridEl.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">⚠️</span>
                <p class="empty-msg">// ERROR DE CONEXIÓN — ${e.message}</p>
                <p class="empty-msg" style="margin-top:12px;color:var(--neon-cyan)">
                    Edita js/config.js y agrega tu API Key de Anthropic
                </p>
            </div>`;
    } finally {
        isLoading = false;
        searchBtn.disabled = false;
    }
}

// ── Render cards ──
function renderCards(items, queryLabel) {
    gridEl.innerHTML = '';
    items.forEach((item, i) => {
        const delay = i * 60;
        const badgeClass = {
            NEW: 'badge-new', HOT: 'badge-hot',
            DEAL: 'badge-deal', TECH: 'badge-tech'
        }[item.badge] || 'badge-new';

        const card = document.createElement('div');
        card.className = 'result-card';
        card.style.animationDelay = `${delay}ms`;
        card.innerHTML = `
            <div class="rc-tag">${item.tag || 'gaming'}</div>
            <div class="rc-cat">
                <span class="rc-badge ${badgeClass}">${item.badge || 'NEW'}</span>
                &nbsp;${item.category || 'Tecnología'}
            </div>
            <h3 class="rc-title">${escHtml(item.title)}</h3>
            <p class="rc-body">${escHtml(item.summary)}</p>
            <div class="rc-footer">
                ${item.price
                    ? `<span class="rc-price">${escHtml(item.price)}</span>`
                    : item.highlight
                    ? `<span class="rc-price" style="color:var(--neon-cyan)">${escHtml(item.highlight)}</span>`
                    : '<span></span>'
                }
                <span class="rc-date">${escHtml(item.date || '')}</span>
            </div>`;
        gridEl.appendChild(card);
    });
}

function setStatus(type, msg) {
    statusEl.className = 'results-status ' + type;
    statusEl.textContent = '// ' + msg;
}

function escHtml(str) {
    return String(str || '')
        .replace(/&/g,'&amp;').replace(/</g,'&lt;')
        .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Events ──
searchBtn.addEventListener('click', () => {
    const q = searchInput.value.trim();
    if (!q) return;
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    activeCategory = null;
    fetchNews(q, q);
});

searchInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') searchBtn.click();
});

// ── Scroll fade-in ──
const observer = new IntersectionObserver(entries => {
    entries.forEach((entry, i) => {
        if (entry.isIntersecting)
            setTimeout(() => entry.target.classList.add('visible'), i * 80);
    });
}, { threshold: 0.1 });
document.querySelectorAll('.fade-up').forEach(el => observer.observe(el));

// ── Navbar scroll ──
const navbar = document.querySelector('.navbar');
window.addEventListener('scroll', () => {
    navbar.style.background = window.scrollY > 40
        ? 'rgba(2,5,9,0.99)'
        : 'rgba(2,5,9,0.94)';
});

// ── Animated counters ──
const counterObs = new IntersectionObserver(entries => {
    entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const el  = entry.target;
        const tgt = parseInt(el.dataset.target);
        const sfx = el.dataset.suffix || '';
        let n = 0;
        const step = tgt / (1400 / 16);
        const timer = setInterval(() => {
            n += step;
            if (n >= tgt) { n = tgt; clearInterval(timer); }
            el.textContent = Math.floor(n).toLocaleString() + sfx;
        }, 16);
        counterObs.unobserve(el);
    });
});
document.querySelectorAll('.stat-n[data-target]').forEach(el => counterObs.observe(el));

// ── Date ──
const dateEl = document.getElementById('hero-date');
if (dateEl) {
    dateEl.textContent = new Date().toLocaleDateString('es-CO',
        {year:'numeric',month:'long',day:'numeric'}).toUpperCase();
}

// ── Init ──
document.addEventListener('DOMContentLoaded', () => {
    buildChips();
    setStatus('', 'Elige una categoría o escribe tu búsqueda para obtener noticias en tiempo real');

    console.log('%c GAMEZONE LIVE ', 'background:#00f5ff;color:#020509;font-family:monospace;font-size:18px;font-weight:bold;padding:8px;');
    console.log('%c Apache Tomcat 11 · Anthropic claude-sonnet-4 · Web Search ', 'color:#ff0080;font-family:monospace;font-size:11px;');
});
