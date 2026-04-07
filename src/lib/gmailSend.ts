const CLIENT_ID = '195570988913-afkc50b7gr3bss4qm3k37vggmhnvaaii.apps.googleusercontent.com';
const SCOPE = 'https://www.googleapis.com/auth/gmail.send';
const PRINTER_EMAIL = '11974454020@print.brother.com';

let tokenClient: any = null;
let accessToken: string | null = null;
let gisReady = false;

const loadGIS = (): Promise<void> =>
    new Promise(resolve => {
        if ((window as any).google?.accounts) { gisReady = true; resolve(); return; }
        const s = document.createElement('script');
        s.src = 'https://accounts.google.com/gsi/client';
        s.onload = () => { gisReady = true; resolve(); };
        document.head.appendChild(s);
    });

// Pre-cargar GIS al importar el módulo para que esté listo
// cuando el usuario pulse el botón (evita romper la cadena de user-gesture en móvil)
loadGIS();

const toBase64Url = (str: string): string => {
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    bytes.forEach(b => (bin += String.fromCharCode(b)));
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

// Standard base64 for MIME attachment (NOT url-safe — MIME requires +, /, =)
const blobToBase64 = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const b64 = (reader.result as string).split(',')[1];
            // Add line breaks every 76 chars as required by RFC 2045
            resolve(b64.replace(/(.{76})/g, '$1\r\n'));
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });

const htmlToPdf = async (html: string): Promise<Blob> => {
    const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
        import('jspdf'),
        import('html2canvas'),
    ]);

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const styles = Array.from(doc.querySelectorAll('style')).map(s => s.textContent).join('\n');
    const bodyMatch = styles.match(/body\s*\{([^}]+)\}/);
    const bodyStyles = bodyMatch ? bodyMatch[1] : '';

    // Overlay blanco para que el usuario no vea contenido de la app detrás
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:#fff;z-index:99998;';

    const wrapper = document.createElement('div');
    // z-index:99999 = ENCIMA de todo → el navegador SIEMPRE lo renderiza (clave para móvil)
    wrapper.style.cssText = `position:fixed;top:0;left:0;width:794px;z-index:99999;background:#fff;overflow:hidden;${bodyStyles}`;

    const styleEl = document.createElement('style');
    styleEl.textContent = styles;
    wrapper.appendChild(styleEl);

    const content = document.createElement('div');
    content.innerHTML = doc.body.innerHTML;
    content.querySelectorAll('script').forEach(s => s.remove());
    wrapper.appendChild(content);

    document.body.appendChild(overlay);
    document.body.appendChild(wrapper);
    await new Promise(r => setTimeout(r, 800));

    const fullHeight = Math.max(wrapper.scrollHeight, 200);
    // scale:1 en móvil para evitar exceder límites de memoria del canvas
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth < 900;
    const scale = isMobile ? 1 : 2;

    let canvas: HTMLCanvasElement;
    try {
        canvas = await html2canvas(wrapper, {
            scale,
            useCORS: true,
            backgroundColor: '#ffffff',
            width: 794,
            height: fullHeight,
            windowWidth: 794,
            windowHeight: fullHeight,
            scrollX: 0,
            scrollY: 0,
            logging: false,
        });
    } finally {
        document.body.removeChild(wrapper);
        document.body.removeChild(overlay);
    }

    if (!canvas.width || !canvas.height) {
        throw new Error('Canvas vacío al generar PDF');
    }

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pdfW = pdf.internal.pageSize.getWidth();
    const pdfH = pdf.internal.pageSize.getHeight();
    const imgH = (canvas.height * pdfW) / canvas.width;
    const pageHeightPx = (pdfH / pdfW) * canvas.width;

    let offset = 0;
    let page = 0;
    while (offset < canvas.height) {
        if (page > 0) pdf.addPage();
        const sliceH = Math.min(pageHeightPx, canvas.height - offset);
        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = canvas.width;
        pageCanvas.height = Math.ceil(sliceH);
        const ctx = pageCanvas.getContext('2d')!;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
        ctx.drawImage(canvas, 0, Math.floor(offset), canvas.width, Math.ceil(sliceH), 0, 0, canvas.width, Math.ceil(sliceH));
        const sliceHmm = (sliceH / canvas.height) * imgH;
        pdf.addImage(pageCanvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, pdfW, Math.min(sliceHmm, pdfH));
        offset += pageHeightPx;
        page++;
    }

    return pdf.output('blob');
};

const doSend = async (pdfBlob: Blob, pdfFilename: string, token: string) => {
    const pdfB64 = await blobToBase64(pdfBlob);
    const boundary = 'macario_print_boundary';

    const mime = [
        'From: me',
        `To: ${PRINTER_EMAIL}`,
        `Subject: ${pdfFilename}`,
        'MIME-Version: 1.0',
        `Content-Type: multipart/mixed; boundary="${boundary}"`,
        '',
        `--${boundary}`,
        'Content-Type: text/plain; charset="UTF-8"',
        '',
        'Documento listo para imprimir.',
        '',
        `--${boundary}`,
        `Content-Type: application/pdf; name="${pdfFilename}"`,
        `Content-Disposition: attachment; filename="${pdfFilename}"`,
        'Content-Transfer-Encoding: base64',
        '',
        pdfB64,
        `--${boundary}--`,
    ].join('\r\n');

    const res = await fetch('https://www.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw: toBase64Url(mime) }),
    });

    if (!res.ok) {
        const err = await res.json();
        if (res.status === 401) accessToken = null;
        throw new Error(err.error?.message || 'Error al enviar por Gmail');
    }
};

export const sendViaGmail = (html: string, filename: string): Promise<void> =>
    new Promise(async (resolve, reject) => {
        // Esperar solo si GIS aún no se ha cargado (caso raro, primera carga muy rápida)
        if (!gisReady) await loadGIS();

        const pdfFilename = filename.replace(/\.html$/, '.pdf');

        // Timeout de seguridad: si no hay respuesta en 60s, cancelar
        const timeout = setTimeout(() => {
            reject(new Error('Tiempo de espera agotado. Inténtalo de nuevo.'));
        }, 60000);

        const done = (err?: Error) => {
            clearTimeout(timeout);
            if (err) reject(err); else resolve();
        };

        const sendWithToken = async (token: string) => {
            try {
                const pdfBlob = await htmlToPdf(html);
                // Envío por Gmail
                await doSend(pdfBlob, pdfFilename, token);
                done();
            } catch (e: any) {
                done(e);
            }
        };

        if (accessToken) {
            sendWithToken(accessToken);
            return;
        }

        // Crear tokenClient con error_callback para capturar popup bloqueado en móvil
        tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
            client_id: CLIENT_ID,
            scope: SCOPE,
            callback: (response: any) => {
                if (response.error) { done(new Error(response.error)); return; }
                accessToken = response.access_token;
                sendWithToken(accessToken!);
            },
            error_callback: (err: any) => {
                // Se llama cuando el popup se bloquea o el usuario lo cierra
                const msg = err?.type === 'popup_blocked'
                    ? 'Popup bloqueado. Permite ventanas emergentes para esta página en tu navegador.'
                    : err?.type === 'popup_closed'
                    ? 'Has cerrado la ventana de autenticación. Inténtalo de nuevo.'
                    : 'Error de autenticación. Inténtalo de nuevo.';
                done(new Error(msg));
            },
        });

        tokenClient.requestAccessToken({ prompt: '' });
    });
