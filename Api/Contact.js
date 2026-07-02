// Vercel Serverless Function — POST /api/contact
// Emails contact-form submissions to your inbox via Resend (https://resend.com).
// Zero npm dependencies: uses the global fetch available on Vercel's Node runtime.
//
// Required environment variable (set in Vercel → Project → Settings → Environment Variables):
//   RESEND_API_KEY   – your Resend API key (starts with "re_")
// Optional overrides:
//   CONTACT_TO       – recipient (default: smithturnerconstruction@gmail.com)
//   CONTACT_FROM     – verified sender (default: Resend's shared test sender)

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    var body = req.body;
    if (typeof body === "string") { try { body = JSON.parse(body || "{}"); } catch (e) { body = {}; } }
    body = body || {};

    var name = (body.name || "").toString().trim();
    var email = (body.email || "").toString().trim();
    var phone = (body.phone || "").toString().trim();
    var service = (body.service || "").toString().trim();
    var message = (body.message || "").toString().trim();

    if (!name || !email || !message) {
      return res.status(400).json({ ok: false, error: "Please complete the required fields." });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ ok: false, error: "Please provide a valid email address." });
    }

    var apiKey = process.env.RESEND_API_KEY;
    var TO = process.env.CONTACT_TO || "smithturnerconstruction@gmail.com";
    var FROM = process.env.CONTACT_FROM || "Smith & Turner Website <onboarding@resend.dev>";

    if (!apiKey) {
      // Not configured yet — tell the client so it can fall back to a mailto link.
      return res.status(500).json({ ok: false, error: "Email service not configured." });
    }

    var esc = function (s) {
      return String(s).replace(/[&<>"]/g, function (c) {
        return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c];
      });
    };

    var html =
      '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#16171a;line-height:1.6">' +
      '<h2 style="margin:0 0 16px">New website enquiry</h2>' +
      "<p><strong>Name:</strong> " + esc(name) + "</p>" +
      "<p><strong>Email:</strong> " + esc(email) + "</p>" +
      "<p><strong>Phone:</strong> " + (esc(phone) || "—") + "</p>" +
      "<p><strong>Project type:</strong> " + (esc(service) || "—") + "</p>" +
      '<p><strong>Requirements:</strong><br>' + esc(message).replace(/\n/g, "<br>") + "</p>" +
      "</div>";

    var resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": "Bearer " + apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM,
        to: [TO],
        reply_to: email,
        subject: "New enquiry — " + name,
        html: html
      })
    });

    if (!resp.ok) {
      var detail = await resp.text().catch(function () { return ""; });
      return res.status(502).json({ ok: false, error: "Email provider error", detail: detail });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ ok: false, error: "Server error" });
  }
};
