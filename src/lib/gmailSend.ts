const CLIENT_ID = '195570988913-afkc50b7gr3bss4qm3k37vggmhnvaaii.apps.googleusercontent.com';
const SCOPE = 'https://www.googleapis.com/auth/gmail.send';
const PRINTER_EMAIL = '11974454020@print.brother.com';

let tokenClient: any = null;
let accessToken: string | null = null;

const loadGIS = (): Promise<void> =>
    new Promise(resolve => {
        if ((window as any).google?.accounts) { resolve(); return; }
        const s = document.createElement('script');
        s.src = 'https://accounts.google.com/gsi/client';
        s.onload = () => resolve();
        document.head.appendChild(s);
    });

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

const htmlToPdf = (html: string): Promise<Blob> =>
    new Promise(async (resolve, reject) => {
        const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
            import('jspdf'),
            import('html2canvas'),
        ]);

        // iframe renderiza el HTML como documento completo (con <html>/<head>/<body>)
        // así los selectores CSS body{} y html{} funcionan correctamente
        const iframe = document.createElement('iframe');
        iframe.style.cssText = 'position:fixed;top:0;left:0;width:794px;height:1123px;border:none;z-index:-9999;pointer-events:none;';
        document.body.appendChild(iframe);

        const cleanup = () => { if (document.body.contains(iframe)) document.body.removeChild(iframe); };

        iframe.addEventListener('load', async () => {
            try {
                // Esperar a que el layout y las fuentes carguen tras el load
                await new Promise(r => setTimeout(r, 1000));

                const iBody = iframe.contentDocument!.body;
                iBody.style.margin = '0';
                iBody.style.padding = '0';

                const fullHeight = Math.max(iBody.scrollHeight, iBody.offsetHeight, 200);
                iframe.style.height = fullHeight + 'px';
                await new Promise(r => setTimeout(r, 300));

                const canvas = await html2canvas(iBody, {
                    scale: 2,
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

                cleanup();

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

                resolve(pdf.output('blob'));
            } catch (e) {
                cleanup();
                reject(e);
            }
        });

        // srcdoc preserva <html><head><style><body> completo
        iframe.srcdoc = html;
    });

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
        await loadGIS();

        const pdfFilename = filename.replace(/\.html$/, '.pdf');

        const sendWithToken = async (token: string) => {
            try {
                const pdfBlob = await htmlToPdf(html);
                // Descarga local del PDF
                const url = URL.createObjectURL(pdfBlob);
                const a = Object.assign(document.createElement('a'), { href: url, download: pdfFilename });
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                // Delay para que el browser complete el download antes de liberar la URL
                setTimeout(() => URL.revokeObjectURL(url), 10000);
                // Envío por Gmail
                await doSend(pdfBlob, pdfFilename, token);
                resolve();
            } catch (e) {
                reject(e);
            }
        };

        if (accessToken) {
            sendWithToken(accessToken);
            return;
        }

        if (!tokenClient) {
            tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
                client_id: CLIENT_ID,
                scope: SCOPE,
                callback: (response: any) => {
                    if (response.error) { reject(new Error(response.error)); return; }
                    accessToken = response.access_token;
                    sendWithToken(accessToken!);
                },
            });
        }

        tokenClient.requestAccessToken({ prompt: '' });
    });
