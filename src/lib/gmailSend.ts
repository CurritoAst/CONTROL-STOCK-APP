// gmailSend.ts
// NOTA: Este archivo ahora enruta TODO el envío a través de la Supabase Edge Function
// (send-print-email) que usa SMTP con App Password de Gmail desde el SERVIDOR.
// Esto significa que CUALQUIER dispositivo puede enviar sin necesitar Google OAuth.

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

/**
 * Envía un HTML ya generado directamente a la impresora Brother
 * pasando por la Edge Function del servidor (sin OAuth, sin popup).
 * Funciona desde cualquier dispositivo/cuenta.
 */
export const sendViaGmail = async (html: string, filename: string): Promise<void> => {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/send-print-email-raw`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ html, filename }),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || 'Error al enviar a la impresora');
    }
};
