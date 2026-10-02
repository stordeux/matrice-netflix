// URL de l'application Web Apps Script (Déployer > Gérer les déploiements > URL).
const API_URL = "COLLER_ICI_L_URL_https://script.google.com/macros/s/.../exec";

// Identifiant anonyme, créé une fois et conservé dans le navigateur.
function getUid() {
  let uid = null;
  try { uid = localStorage.getItem("netflix_uid"); } catch (e) {}
  if (!uid) {
    uid = "u_" + Array.from(crypto.getRandomValues(new Uint8Array(5)))
      .map(b => b.toString(36).padStart(2, "0")).join("").slice(0, 8);
    try { localStorage.setItem("netflix_uid", uid); } catch (e) {}
  }
  return uid;
}

async function apiGet(params) {
  const r = await fetch(API_URL + "?" + new URLSearchParams(params));
  return r.json();
}

// text/plain évite la requête CORS « preflight », que Apps Script ne gère pas.
async function apiPost(obj) {
  const r = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(obj),
  });
  return r.json();
}
