// Vercel Serverless Function — POST /api/estimate
// Emails "Request a call back" submissions from the /estimate page via Resend.
// Uses the same environment variables as the contact form (api/contact.js):
//   RESEND_API_KEY   – required. Your Resend API key (starts with "re_")
//   CONTACT_TO       – optional. Where requests go (default: info@smithandturnerconstruction.com.au)
//   CONTACT_FROM     – optional. Verified sender (default: Resend's shared test sender)
// Zero npm dependencies.

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    var body = req.body;
    if (typeof body === "string") { try { body = JSON.parse(body || "{}"); } catch (e) { body = {}; } }
    body = body || {};

    var clip = function (v, n) { return (v || "").toString().trim().slice(0, n); };
    var name = clip(body.name, 120);
    var phone = clip(body.phone, 40);
    var suburb = clip(body.suburb, 80);
    var code = clip(body.code, 40).toUpperCase();
    var project = clip(body.project, 60);
    var details = clip(body.details, 120);
    var extras = clip(body.extras, 200);
    var source = clip(body.source, 40);

    // Hidden "company" field is a spam trap: real visitors never fill it in.
    if (clip(body.company, 200)) return res.status(200).json({ ok: true });

    if (!name || !phone) {
      return res.status(400).json({ ok: false, error: "Please add your name and phone number." });
    }
    if (!/^[0-9+()\s-]{8,20}$/.test(phone)) {
      return res.status(400).json({ ok: false, error: "Please check your phone number." });
    }
    if (code && !/^[A-Z]{3}-[0-9A-Z]{1,3}-[BMP](-[LORDT]{1,5})?$/.test(code)) code = "";

    var apiKey = process.env.RESEND_API_KEY;
    var TO = process.env.CONTACT_TO || "info@smithandturnerconstruction.com.au";
    var FROM = process.env.CONTACT_FROM || "Smith & Turner Website <onboarding@resend.dev>";

    if (!apiKey) {
      // Not configured yet: the page falls back to opening a pre-filled email.
      return res.status(500).json({ ok: false, error: "Email service not configured." });
    }

    var esc = function (s) {
      return String(s).replace(/[&<>"]/g, function (c) {
        return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c];
      });
    };
    var row = function (k, v) { return "<p style=\"margin:0 0 8px\"><strong>" + k + ":</strong> " + (esc(v) || "—") + "</p>"; };

    var html =
      '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#15161A;line-height:1.6">' +
      '<h2 style="margin:0 0 4px">Call back request</h2>' +
      '<p style="margin:0 0 16px;color:#6E6E69">From the website estimator. Load the code into the Quick-Price sheet before you call.</p>' +
      '<p style="margin:0 0 16px;font-family:monospace;font-size:22px;letter-spacing:1px"><strong>' + (esc(code) || "No code") + "</strong></p>" +
      row("Name", name) +
      '<p style="margin:0 0 8px"><strong>Phone:</strong> <a href="tel:' + esc(phone.replace(/[^0-9+]/g, "")) + '">' + esc(phone) + "</a></p>" +
      row("Suburb", suburb) +
      row("Project", project + (details ? " · " + details : "")) +
      row("Extras", extras || "None") +
      row("Came from", source || "Website") +
      "</div>";

    var resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": "Bearer " + apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM,
        to: [TO],
        subject: "Call back · " + (project || "Project") + " · " + (code || name) + (suburb ? " · " + suburb : ""),
        html: html
      })
    });

    if (!resp.ok) {
      return res.status(502).json({ ok: false, error: "Email provider error" });
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ ok: false, error: "Server error" });
  }
};
