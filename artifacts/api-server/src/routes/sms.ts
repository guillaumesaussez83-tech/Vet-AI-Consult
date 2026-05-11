import { Router } from "express";
import requireClinicId from "../middleware/requireClinicId";
import { requireAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();

// ââ Security: authentication + clinic isolation
router.use(requireAuth(), requireClinicId);

// Twilio via REST API (aucune dÃ©pendance SDK)
async function sendTwilioSMS(to: string, body: string): Promise<{ sid?: string; error?: string }> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    return { error: "Twilio non configurÃ© (env vars manquants)" };
  }

  const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
  try {
    const r = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: to, From: fromNumber, Body: body }).toString(),
      }
    );
    const data = await r.json() as any;
    if (data.sid) return { sid: data.sid };
    return { error: data.message || "Erreur Twilio" };
  } catch (e: any) {
    return { error: e.message };
  }
}

// POST /api/sms/send â envoi manuel
router.post("/send", async (req: any, res) => {
  try {
    const clinicId = (req as any).clinicId as string;
    const { phone, message, rdvId, ownerId, type = "CUSTOM" } = req.body;
    if (!phone || !message) return res.status(400).json({ success: false, error: "phone et message requis" });

    const result = await sendTwilioSMS(phone, message);
    const now = new Date().toISOString();

    await db.execute(sql`
      INSERT INTO sms_log (clinic_id, rdv_id, owner_id, phone, message, type, status, twilio_sid, error_message, sent_at, created_at)
      VALUES (${clinicId}, ${rdvId || null}, ${ownerId || null}, ${phone}, ${message}, ${type},
        ${result.error ? "FAILED" : "SENT"}, ${result.sid || null}, ${result.error || null},
        ${result.error ? null : now}, ${now})
    `);

    if (result.error) return res.status(500).json({ success: false, error: result.error });
    res.json({ success: true, sid: result.sid });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/sms/send-reminders â envoi automatique J-3 et J-1
router.post("/send-reminders", async (req: any, res) => {
  try {
    const now = new Date();
    const j3 = new Date(now);
    j3.setDate(j3.getDate() + 3);
    const j1 = new Date(now);
    j1.setDate(j1.getDate() + 1);

    const dateJ3 = j3.toISOString().slice(0, 10);
    const dateJ1 = j1.toISOString().slice(0, 10);

    // RÃ©cupÃ©rer les RDV J-3 non annulÃ©s avec tÃ©lÃ©phone
    const rdvJ3 = await db.execute(sql`
      SELECT r.*, r.proprietaire_telephone as phone
      FROM rendez_vous r
      WHERE DATE(r.date_heure) = ${dateJ3}
        AND r.statut NOT IN ('ANNULE', 'NO_SHOW')
        AND r.proprietaire_telephone IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM sms_log s WHERE s.rdv_id = r.id AND s.type = 'RAPPEL_J3' AND s.status = 'SENT'
        )
    `);

    const rdvJ1 = await db.execute(sql`
      SELECT r.*, r.proprietaire_telephone as phone
      FROM rendez_vous r
      WHERE DATE(r.date_heure) = ${dateJ1}
        AND r.statut NOT IN ('ANNULE', 'NO_SHOW')
        AND r.proprietaire_telephone IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM sms_log s WHERE s.rdv_id = r.id AND s.type = 'RAPPEL_J1' AND s.status = 'SENT'
        )
    `);

    const results = { j3: 0, j1: 0, errors: [] as string[] };

    const _j3sms = await Promise.allSettled((rdvJ3.rows as any[]).map(async (rdv) => {
      const dateStr = new Date(rdv.date_heure).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
      const heureStr = new Date(rdv.date_heure).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
      const msg = `Rappel: RDV vÃ©tÃ©rinaire le ${dateStr} Ã  ${heureStr} pour ${rdv.animal_nom}. RÃ©pondez STOP pour annuler.`;
      const r = await sendTwilioSMS(rdv.phone, msg);
      const ts = new Date().toISOString();
      await db.execute(sql`
        INSERT INTO sms_log (clinic_id, rdv_id, owner_id, phone, message, type, status, twilio_sid, error_message, sent_at, created_at)
        VALUES (${rdv.clinic_id}, ${rdv.id}, ${rdv.owner_id || null}, ${rdv.phone}, ${msg}, 'RAPPEL_J3',
          ${r.error ? "FAILED" : "SENT"}, ${r.sid || null}, ${r.error || null}, ${r.error ? null : ts}, ${ts})
      `);
      return { ok: !r.error, rdvId: rdv.id, err: r.error };
    }));
    for (const _sr of _j3sms) {
      if (_sr.status === 'fulfilled' && _sr.value.ok) results.j3++;
      else results.errors.push(_sr.status === 'rejected' ? String(_sr.reason) : `RDV ${_sr.value.rdvId}: ${_sr.value.err}`);
    }

    const _j1sms = await Promise.allSettled((rdvJ1.rows as any[]).map(async (rdv) => {
      const heureStr = new Date(rdv.date_heure).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
      const msg = `Rappel urgent: RDV vÃ©tÃ©rinaire DEMAIN Ã  ${heureStr} pour ${rdv.animal_nom}. En cas d'empÃªchement: appelez-nous.`;
      const r = await sendTwilioSMS(rdv.phone, msg);
      const ts = new Date().toISOString();
      await db.execute(sql`
        INSERT INTO sms_log (clinic_id, rdv_id, owner_id, phone, message, type, status, twilio_sid, error_message, sent_at, created_at)
        VALUES (${rdv.clinic_id}, ${rdv.id}, ${rdv.owner_id || null}, ${rdv.phone}, ${msg}, 'RAPPEL_J1',
          ${r.error ? "FAILED" : "SENT"}, ${r.sid || null}, ${r.error || null}, ${r.error ? null : ts}, ${ts})
      `);
      return { ok: !r.error, rdvId: rdv.id, err: r.error };
    }));
    for (const _sr of _j1sms) {
      if (_sr.status === 'fulfilled' && _sr.value.ok) results.j1++;
      else results.errors.push(_sr.status === 'rejected' ? String(_sr.reason) : `RDV ${_sr.value.rdvId}: ${_sr.value.err}`);
    }

    res.json({ success: true, data: results });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/sms/log â historique SMS
router.get("/log", async (req: any, res) => {
  try {
    const clinicId = (req as any).clinicId as string;
    const rows = await db.execute(sql`
      SELECT * FROM sms_log WHERE clinic_id = ${clinicId} ORDER BY created_at DESC LIMIT 100
    `);
    res.json({ success: true, data: rows.rows });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
