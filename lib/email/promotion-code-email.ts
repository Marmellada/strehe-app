type PromotionCodeEmailInput = {
  to: string;
  name?: string | null;
  code: string;
  campaignName: string;
  discountLabel: string;
  expiresAt?: string | null;
};

type SendPromotionCodeEmailResult =
  | {
      ok: true;
      providerMessageId: string | null;
    }
  | {
      ok: false;
      error: string;
    };

function getAppUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://localhost:3000"
  );
}

function formatDate(value: string | null | undefined) {
  if (!value) return null;
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildPromotionCodeEmail(input: PromotionCodeEmailInput) {
  const name = input.name?.trim() || "there";
  const expiry = formatDate(input.expiresAt);
  const appUrl = getAppUrl();
  const subject = `Your STREHE discount code: ${input.code}`;

  const text = [
    `Hi ${name},`,
    "",
    "Thank you for your interest in STREHE.",
    `Your personal discount code is: ${input.code}`,
    "",
    `Campaign: ${input.campaignName}`,
    `Discount: ${input.discountLabel}`,
    expiry ? `Valid until: ${expiry}` : null,
    "",
    "If you decide to start apartment care with STREHE, share this code when we prepare your contract.",
    "",
    `Open STREHE: ${appUrl}`,
  ]
    .filter(Boolean)
    .join("\n");

  const html = `
    <div style="font-family: Arial, sans-serif; background: #f6f4ef; padding: 32px;">
      <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 8px; padding: 28px; color: #1f2933;">
        <p style="font-size: 16px; margin: 0 0 16px;">Hi ${escapeHtml(name)},</p>
        <p style="font-size: 16px; line-height: 1.6; margin: 0 0 16px;">
          Thank you for your interest in STREHE. Here is your personal discount code.
        </p>
        <div style="border: 1px solid #d8c7a3; background: #fbf8f0; border-radius: 8px; padding: 18px; margin: 22px 0;">
          <p style="font-size: 13px; text-transform: uppercase; letter-spacing: .08em; color: #6b5a37; margin: 0 0 8px;">Your code</p>
          <p style="font-size: 28px; font-weight: 700; letter-spacing: .08em; margin: 0; color: #111827;">${escapeHtml(input.code)}</p>
        </div>
        <p style="font-size: 15px; line-height: 1.6; margin: 0 0 8px;"><strong>Campaign:</strong> ${escapeHtml(input.campaignName)}</p>
        <p style="font-size: 15px; line-height: 1.6; margin: 0 0 8px;"><strong>Discount:</strong> ${escapeHtml(input.discountLabel)}</p>
        ${
          expiry
            ? `<p style="font-size: 15px; line-height: 1.6; margin: 0 0 8px;"><strong>Valid until:</strong> ${escapeHtml(expiry)}</p>`
            : ""
        }
        <p style="font-size: 15px; line-height: 1.6; margin: 18px 0 0;">
          If you decide to start apartment care with STREHE, share this code when we prepare your contract.
        </p>
        <p style="font-size: 14px; line-height: 1.6; color: #52616b; margin: 22px 0 0;">
          This discount applies to the STREHE service fee according to the agreed package.
        </p>
      </div>
    </div>
  `;

  return { subject, text, html };
}

export async function sendPromotionCodeEmail(
  input: PromotionCodeEmailInput
): Promise<SendPromotionCodeEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.PROMOTION_EMAIL_FROM || process.env.RESEND_FROM_EMAIL;

  if (!apiKey) {
    return {
      ok: false,
      error: "Missing RESEND_API_KEY. Code was created but email was not sent.",
    };
  }

  if (!from) {
    return {
      ok: false,
      error:
        "Missing PROMOTION_EMAIL_FROM or RESEND_FROM_EMAIL. Code was created but email was not sent.",
    };
  }

  const email = buildPromotionCodeEmail(input);

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: input.to,
      subject: email.subject,
      html: email.html,
      text: email.text,
    }),
  });

  const payload = (await response.json().catch(() => null)) as
    | { id?: string; message?: string; error?: string }
    | null;

  if (!response.ok) {
    return {
      ok: false,
      error:
        payload?.message ||
        payload?.error ||
        `Email provider returned ${response.status}.`,
    };
  }

  return {
    ok: true,
    providerMessageId: payload?.id || null,
  };
}
