"use client";

import { useEffect, useRef, useState } from "react";

type PrintStatus = "idle" | "working" | "success" | "error";
type TicketKind = "simple" | "sale" | "largeSale" | "tiny";

type Metrics = {
  fileName: string;
  generationMs: number;
  totalMs?: number;
  pdfKb: number;
  pdfHeightMm: number;
  pdfWidthMm: number;
  trimmedBottomPx: number;
  trimmedTopPx: number;
  method?: string;
  importMs?: number;
  drawMs?: number;
  serializeMs?: number;
};

const LOCAL_PRINT_ENDPOINT = "http://localhost:5092/print-pdf";
const PRINTER_NAME = "Basic 200";
const PDF_WIDTH_MM = 72;
const PDF_HEIGHT_MM = 297;
const TICKET_WIDTH_PX = 272;
const DIRECT_LARGE_PDF_HEIGHT_MM = 303;

const LARGE_SALE_ITEMS = [
  { name: "Arroz extra 1kg", qty: 2, total: 9.8 },
  { name: "Aceite vegetal", qty: 1, total: 8.9 },
  { name: "Azucar rubia 1kg", qty: 3, total: 12.6 },
  { name: "Leche evaporada", qty: 6, total: 24 },
  { name: "Pan molde integral", qty: 1, total: 7.5 },
  { name: "Queso fresco", qty: 1, total: 11.9 },
  { name: "Jamonada familiar", qty: 2, total: 13.8 },
  { name: "Cafe instantaneo", qty: 1, total: 15.5 },
  { name: "Chocolate taza", qty: 2, total: 10.4 },
  { name: "Fideos tallarin", qty: 4, total: 14 },
  { name: "Atun en lata", qty: 5, total: 32.5 },
  { name: "Gaseosa 1.5L", qty: 2, total: 16 },
  { name: "Agua mineral", qty: 6, total: 12 },
  { name: "Detergente 800g", qty: 1, total: 9.7 },
  { name: "Jabon liquido", qty: 2, total: 18.6 },
  { name: "Papel higienico", qty: 1, total: 21.9 },
  { name: "Yogurt familiar", qty: 2, total: 17.8 },
  { name: "Cereal chocolate", qty: 1, total: 13.4 },
  { name: "Mermelada fresa", qty: 1, total: 8.5 },
  { name: "Galletas surtidas", qty: 4, total: 18 },
];

const LARGE_SALE_DISCOUNT = 7.5;

export default function Home() {
  const simpleTicketRef = useRef<HTMLDivElement>(null);
  const saleTicketRef = useRef<HTMLDivElement>(null);
  const largeSaleTicketRef = useRef<HTMLDivElement>(null);
  const tinyTicketRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<PrintStatus>("idle");
  const [message, setMessage] = useState(
    "Listo para generar PDFs 72mm x 297mm desde HTML/CSS.",
  );
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  function updatePreviewUrl(blob: Blob) {
    const nextPreviewUrl = URL.createObjectURL(blob);

    setPreviewUrl((currentPreviewUrl) => {
      if (currentPreviewUrl) {
        URL.revokeObjectURL(currentPreviewUrl);
      }

      return nextPreviewUrl;
    });
  }

  async function generatePdf(kind: TicketKind) {
    const element = {
      largeSale: largeSaleTicketRef.current,
      sale: saleTicketRef.current,
      simple: simpleTicketRef.current,
      tiny: tinyTicketRef.current,
    }[kind];

    if (!element) {
      throw new Error("No se encontro el ticket para generar el PDF.");
    }

    const generationStart = performance.now();
    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
      import("html2canvas"),
      import("jspdf"),
    ]);

    const captureElement = element.cloneNode(true) as HTMLDivElement;

    captureElement.style.left = "0";
    captureElement.style.margin = "0";
    captureElement.style.position = "fixed";
    captureElement.style.top = "0";
    captureElement.style.transform = "none";
    captureElement.style.zIndex = "-1";

    document.body.appendChild(captureElement);
    await document.fonts.ready;

    const canvas = await html2canvas(captureElement, {
      backgroundColor: "#ffffff",
      scale: 2,
      scrollX: 0,
      scrollY: 0,
      useCORS: true,
      windowHeight: captureElement.scrollHeight,
      windowWidth: captureElement.scrollWidth,
    });

    captureElement.remove();

    const { canvas: trimmedCanvas, trimmedBottomPx, trimmedTopPx } =
      trimVerticalWhitespace(canvas, 4);
    const imageData = trimmedCanvas.toDataURL("image/png");
    const contentHeightMm = Math.ceil(
      (trimmedCanvas.height * PDF_WIDTH_MM) / trimmedCanvas.width,
    );
    const pdfHeightMm = Math.max(PDF_HEIGHT_MM, contentHeightMm);

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: [PDF_WIDTH_MM, pdfHeightMm],
      compress: true,
    });

    pdf.addImage(imageData, "PNG", 0, 0, PDF_WIDTH_MM, contentHeightMm);

    const pdfBlob = pdf.output("blob");
    const dataUri = pdf.output("datauristring");
    const pdfBase64 = dataUri.split(",")[1];
    const generationMs = performance.now() - generationStart;
    const fileName = {
      largeSale: `nota-venta-larga-${PDF_WIDTH_MM}mm.pdf`,
      sale: `nota-venta-${PDF_WIDTH_MM}mm.pdf`,
      simple: `ticket-simple-${PDF_WIDTH_MM}mm.pdf`,
      tiny: `impresion-prueba-${PDF_WIDTH_MM}mm.pdf`,
    }[kind];

    return {
      dataUri,
      fileName,
      pdfBlob,
      pdfBase64,
      metrics: {
        fileName,
        generationMs,
        pdfKb: Math.round((pdfBase64.length * 3) / 4 / 1024),
        pdfHeightMm,
        pdfWidthMm: PDF_WIDTH_MM,
        trimmedBottomPx,
        trimmedTopPx,
      },
    };
  }

  async function generateLargeSalePdfDirect() {
    const generationStart = performance.now();

    const importStart = performance.now();
    const { jsPDF } = await import("jspdf");
    const importMs = performance.now() - importStart;

    const drawStart = performance.now();

    // Esta prueba NO usa HTML, CSS, html2canvas, canvas ni PNG.
    // Usa Helvetica (similar visualmente a Arial) y tamaños reforzados para térmica 203 DPI.
    // El contenido se dibuja directamente como texto y vectores dentro del PDF.
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: [PDF_WIDTH_MM, DIRECT_LARGE_PDF_HEIGHT_MM],
      compress: true,
    });

    const left = 4;
    const right = PDF_WIDTH_MM - 4;
    const center = PDF_WIDTH_MM / 2;
    const qtyX = 49;
    const totalX = right;
    let y = 7;

    const line = () => {
      pdf.setLineDashPattern([1.1, 1.1], 0);
      pdf.line(left, y, right, y);
      pdf.setLineDashPattern([], 0);
      y += 4;
    };

    pdf.setFont("helvetica", "bold");
    pdf.setLineWidth(0.45);
    pdf.rect(center - 7, y, 14, 14);
    pdf.setFontSize(14);
    pdf.text("DM", center, y + 9, { align: "center" });
    y += 19;

    pdf.setFontSize(11.5);
    pdf.text("NOTA DE VENTA", center, y, { align: "center" });
    y += 5;

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8.4);
    pdf.text("Demo Market S.A.C.", center, y, { align: "center" });
    y += 4;
    pdf.text("RUC 20123456789", center, y, { align: "center" });
    y += 4;
    pdf.text("Av. Principal 123 - Lima", center, y, { align: "center" });
    y += 4;
    pdf.text("Telefono: 999 888 777", center, y, { align: "center" });
    y += 5;

    line();

    // Datos principales ligeramente más gruesos para impresión térmica.
    pdf.setFont("helvetica", "bold");
    pdf.text("Fecha: 04/09/2026 11:45", left, y);
    y += 4;
    pdf.text("Documento: NV-LARGA-000123", left, y);
    y += 4;
    pdf.text("Caja: 02", left, y);
    y += 4;
    pdf.text("Cliente: PUBLICO GENERAL", left, y);
    y += 4;
    pdf.text("Vendedor: LEONARDO", left, y);
    y += 5;

    line();

    pdf.setFont("helvetica", "bold");
    pdf.text("Producto", left, y);
    pdf.text("Cant", qtyX, y, { align: "right" });
    pdf.text("Total", totalX, y, { align: "right" });
    y += 4;

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8.2);
    for (const item of LARGE_SALE_ITEMS) {
      pdf.text(item.name, left, y);
      pdf.text(String(item.qty), qtyX, y, { align: "right" });
      pdf.text(`S/ ${item.total.toFixed(2)}`, totalX, y, { align: "right" });
      y += 4.6;
    }

    y += 1;
    line();

    const subtotal = LARGE_SALE_ITEMS.reduce((sum, item) => sum + item.total, 0);
    const total = subtotal - LARGE_SALE_DISCOUNT;

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8.4);
    pdf.text(`Items: ${LARGE_SALE_ITEMS.length}`, right, y, { align: "right" });
    y += 4;
    pdf.text(`Subtotal: S/ ${subtotal.toFixed(2)}`, right, y, { align: "right" });
    y += 4;
    pdf.text(`Descuento: -S/ ${LARGE_SALE_DISCOUNT.toFixed(2)}`, right, y, {
      align: "right",
    });
    y += 4;
    pdf.text("IGV: S/ 0.00", right, y, { align: "right" });
    y += 4;

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10.5);
    pdf.text(`TOTAL: S/ ${total.toFixed(2)}`, right, y, { align: "right" });
    y += 6;

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8.4);
    line();

    pdf.text("Pago: Yape", left, y);
    y += 4;
    pdf.text("Operacion: 987654321", left, y);
    y += 4;
    pdf.text("Autorizacion: OK", left, y);
    y += 5;

    line();

    // Codigo de barras visual simple usando solo vectores de jsPDF.
    const barcodeWidth = 43;
    const barcodeLeft = center - barcodeWidth / 2;
    const barcodeTop = y;
    const barcodeHeight = 11;
    let barcodeX = barcodeLeft;

    for (let index = 0; index < 34; index += 1) {
      const barWidth = index % 5 === 0 ? 0.8 : index % 3 === 0 ? 0.55 : 0.3;
      pdf.setLineWidth(barWidth);
      pdf.line(barcodeX, barcodeTop, barcodeX, barcodeTop + barcodeHeight);
      barcodeX += index % 4 === 0 ? 1.55 : 1.2;

      if (barcodeX >= barcodeLeft + barcodeWidth) {
        break;
      }
    }

    y += barcodeHeight + 6;
    pdf.setLineWidth(0.3);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8.4);
    pdf.text("Gracias por su compra", center, y, { align: "center" });
    y += 4;
    pdf.text("Conserve este comprobante", center, y, { align: "center" });

    const drawMs = performance.now() - drawStart;

    const serializeStart = performance.now();
    // Se serializa una sola vez. Del mismo ArrayBuffer salen Blob y Base64.
    const pdfArrayBuffer = pdf.output("arraybuffer");
    const pdfBlob = new Blob([pdfArrayBuffer], { type: "application/pdf" });
    const pdfBase64 = arrayBufferToBase64(pdfArrayBuffer);
    const serializeMs = performance.now() - serializeStart;

    const generationMs = performance.now() - generationStart;
    const fileName = `nota-venta-larga-jspdf-directo-${PDF_WIDTH_MM}mm.pdf`;

    return {
      fileName,
      pdfBlob,
      pdfBase64,
      metrics: {
        fileName,
        generationMs,
        pdfKb: Math.round(pdfArrayBuffer.byteLength / 1024),
        pdfHeightMm: DIRECT_LARGE_PDF_HEIGHT_MM,
        pdfWidthMm: PDF_WIDTH_MM,
        trimmedBottomPx: 0,
        trimmedTopPx: 0,
        method: "jsPDF directo",
        importMs,
        drawMs,
        serializeMs,
      } satisfies Metrics,
    };
  }

  async function handleGenerateLargeSaleDirect() {
    setStatus("working");
    setMessage("Generando nota larga con jsPDF directo, sin html2canvas...");

    try {
      const result = await generateLargeSalePdfDirect();

      updatePreviewUrl(result.pdfBlob);
      setMetrics(result.metrics);
      setStatus("success");
      setMessage(
        `Nota larga jsPDF directo generada en ${result.metrics.generationMs.toFixed(1)} ms.`,
      );
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "No se pudo generar la nota larga con jsPDF directo.",
      );
    }
  }

  async function handleGenerateAndPrintLargeSaleDirect() {
    const totalStart = performance.now();

    setStatus("working");
    setMessage(
      "Generando nota larga con jsPDF directo y enviandola a DriverPrinter...",
    );

    try {
      const result = await generateLargeSalePdfDirect();

      const response = await fetch(LOCAL_PRINT_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          printerName: PRINTER_NAME,
          fileName: result.fileName,
          pdfBase64: result.pdfBase64,
          pdfUrl: null,
          // DriverPrinter usa su configuracion local; este valor no decide el modo.
          mode: "pdfium",
        }),
      });

      const responseText = await response.text();

      if (!response.ok) {
        throw new Error(responseText || `Error HTTP ${response.status}`);
      }

      const totalMs = performance.now() - totalStart;

      updatePreviewUrl(result.pdfBlob);
      setMetrics({ ...result.metrics, totalMs });
      setStatus("success");
      setMessage(responseText || "Nota larga jsPDF directo enviada correctamente.");
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "No se pudo enviar la nota larga jsPDF directo.",
      );
    }
  }

  async function handleGenerate(kind: TicketKind) {
    setStatus("working");
    setMessage("Generando PDF en el navegador...");

    try {
      const result = await generatePdf(kind);

      updatePreviewUrl(result.pdfBlob);
      setMetrics(result.metrics);
      setStatus("success");
      setMessage("PDF generado correctamente. Puedes abrirlo o enviarlo a imprimir.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "No se pudo generar el PDF.");
    }
  }

  async function handleGenerateAndPrint(kind: TicketKind) {
    const totalStart = performance.now();

    setStatus("working");
    setMessage("Generando PDF y enviandolo al servidor local...");

    try {
      const result = await generatePdf(kind);

      const response = await fetch(LOCAL_PRINT_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          printerName: PRINTER_NAME,
          fileName: result.fileName,
          pdfBase64: result.pdfBase64,
          pdfUrl: null,
          mode: "image",
        }),
      });

      const responseText = await response.text();

      if (!response.ok) {
        throw new Error(responseText || `Error HTTP ${response.status}`);
      }

      const totalMs = performance.now() - totalStart;

      updatePreviewUrl(result.pdfBlob);
      setMetrics({ ...result.metrics, totalMs });
      setStatus("success");
      setMessage(responseText || "PDF enviado correctamente al servidor local.");
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "No se pudo conectar con el servidor local.",
      );
    }
  }

  async function handlePrintPublicTestPdf() {
    const totalStart = performance.now();
    const fileName = "test-print.pdf";
    const pdfUrl = `${window.location.origin}/${fileName}`;

    setStatus("working");
    setMessage("Enviando test-print.pdf al servidor local...");

    try {
      const response = await fetch(LOCAL_PRINT_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          printerName: PRINTER_NAME,
          fileName,
          pdfBase64: null,
          pdfUrl,
          mode: "image",
        }),
      });

      const responseText = await response.text();

      if (!response.ok) {
        throw new Error(responseText || `Error HTTP ${response.status}`);
      }

      setPreviewUrl(pdfUrl);
      setMetrics({
        fileName,
        generationMs: 0,
        pdfHeightMm: PDF_HEIGHT_MM,
        pdfKb: 0,
        pdfWidthMm: PDF_WIDTH_MM,
        totalMs: performance.now() - totalStart,
        trimmedBottomPx: 0,
        trimmedTopPx: 0,
      });
      setStatus("success");
      setMessage(responseText || "test-print.pdf enviado correctamente.");
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "No se pudo enviar test-print.pdf al servidor local.",
      );
    }
  }

  const statusClassName = {
    idle: "border-zinc-200 bg-zinc-50 text-zinc-700",
    working: "border-blue-200 bg-blue-50 text-blue-800",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    error: "border-red-200 bg-red-50 text-red-800",
  }[status];

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-8 text-slate-100 sm:px-8">
      <section className="mx-auto max-w-6xl">
        <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl shadow-black/40 backdrop-blur sm:p-8">
          <p className="mb-3 text-sm font-medium uppercase tracking-[0.3em] text-cyan-300">
            Prueba PDF 72mm
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">
            Generar ticket con HTML/CSS y enviarlo como Base64
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-slate-300 sm:text-lg">
            Esta prueba renderiza el ticket en pantalla, lo convierte a imagen
            con html2canvas, crea un PDF fijo de 72mm x 297mm con jsPDF y lo
            manda al programa C# local por <code>{LOCAL_PRINT_ENDPOINT}</code>.
          </p>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px_360px]">
          <section className="rounded-3xl border border-white/10 bg-white/[0.06] p-5">
            <h2 className="text-xl font-semibold">Acciones</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Primero puedes generar el PDF y verlo. Luego prueba generar e
              imprimir para medir el tiempo total hasta que responde tu servidor.
            </p>

            <div className="mt-6 rounded-2xl border border-white/10 bg-black/25 p-4">
              <p className="text-sm font-semibold text-slate-100">Configuracion fija</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                PDF generado en 72mm x 297mm, igual al papel detectado para
                Basic 200. El contenido se dibuja desde arriba sin escalarse al
                alto completo.
              </p>
            </div>

            <div className="mt-6 grid gap-3">
              <ActionButton
                disabled={status === "working"}
                onClick={() => handleGenerate("simple")}
              >
                Generar PDF simple
              </ActionButton>
              <ActionButton
                disabled={status === "working"}
                onClick={handlePrintPublicTestPdf}
              >
                Imprimir test-print.pdf
              </ActionButton>
              <ActionButton
                disabled={status === "working"}
                onClick={() => handleGenerate("tiny")}
              >
                Generar prueba chica
              </ActionButton>
              <ActionButton
                disabled={status === "working"}
                onClick={() => handleGenerateAndPrint("tiny")}
              >
                Generar e imprimir prueba chica
              </ActionButton>
              <ActionButton
                disabled={status === "working"}
                onClick={() => handleGenerateAndPrint("simple")}
              >
                Generar e imprimir simple
              </ActionButton>
              <ActionButton
                disabled={status === "working"}
                onClick={() => handleGenerate("sale")}
              >
                Generar nota de venta
              </ActionButton>
              <ActionButton
                disabled={status === "working"}
                onClick={() => handleGenerateAndPrint("sale")}
              >
                Generar e imprimir nota
              </ActionButton>
              <ActionButton
                disabled={status === "working"}
                onClick={() => handleGenerate("largeSale")}
              >
                Generar nota larga
              </ActionButton>
              <ActionButton
                disabled={status === "working"}
                onClick={() => handleGenerateAndPrint("largeSale")}
              >
                Generar e imprimir nota larga
              </ActionButton>

              <div className="mt-3 rounded-2xl border border-cyan-300/30 bg-cyan-300/10 p-4">
                <p className="text-sm font-bold text-cyan-200">
                  Prueba optimizada: jsPDF directo
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-300">
                  No usa HTML, CSS, html2canvas, canvas ni PNG. Dibuja la nota
                  larga directamente dentro del PDF para comparar tiempos.
                </p>
              </div>

              <ActionButton
                disabled={status === "working"}
                onClick={handleGenerateLargeSaleDirect}
              >
                Generar nota larga - jsPDF directo
              </ActionButton>
              <ActionButton
                disabled={status === "working"}
                onClick={handleGenerateAndPrintLargeSaleDirect}
              >
                Generar e imprimir nota larga - jsPDF directo
              </ActionButton>
            </div>

            <div className={`mt-6 rounded-2xl border p-4 text-sm ${statusClassName}`}>
              {message}
            </div>

            {metrics ? (
              <div className="mt-5 rounded-2xl border border-white/10 bg-black/25 p-4 text-sm text-slate-300">
                <p>
                  <span className="font-semibold text-slate-100">Archivo:</span>{" "}
                  {metrics.fileName}
                </p>
                <p className="mt-2">
                  <span className="font-semibold text-slate-100">Generacion:</span>{" "}
                  {metrics.generationMs.toFixed(1)} ms
                </p>
                {metrics.method ? (
                  <p className="mt-2">
                    <span className="font-semibold text-slate-100">Metodo:</span>{" "}
                    {metrics.method}
                  </p>
                ) : null}
                {typeof metrics.importMs === "number" ? (
                  <p className="mt-2 text-xs">
                    jsPDF import: {metrics.importMs.toFixed(1)} ms | dibujo:{" "}
                    {metrics.drawMs?.toFixed(1)} ms | serializacion/Base64:{" "}
                    {metrics.serializeMs?.toFixed(1)} ms
                  </p>
                ) : null}
                {typeof metrics.totalMs === "number" ? (
                  <p className="mt-2">
                    <span className="font-semibold text-slate-100">Total:</span>{" "}
                    {metrics.totalMs.toFixed(1)} ms
                  </p>
                ) : null}
                <p className="mt-2">
                  <span className="font-semibold text-slate-100">Peso:</span>{" "}
                  {metrics.pdfKb} KB
                </p>
                <p className="mt-2">
                  <span className="font-semibold text-slate-100">Tamano:</span>{" "}
                  {metrics.pdfWidthMm} x {metrics.pdfHeightMm} mm
                </p>
                {!metrics.method ? (
                  <p className="mt-2">
                    <span className="font-semibold text-slate-100">Recorte:</span>{" "}
                    arriba {metrics.trimmedTopPx}px, abajo {metrics.trimmedBottomPx}px
                  </p>
                ) : null}
              </div>
            ) : null}

            {previewUrl ? (
              <a
                className="mt-5 inline-flex rounded-2xl bg-white px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-slate-200"
                href={previewUrl}
                rel="noreferrer"
                target="_blank"
              >
                Abrir ultimo PDF generado
              </a>
            ) : null}
          </section>

          <TicketShell title="PDF simple">
            <SimpleTicket ref={simpleTicketRef} widthPx={TICKET_WIDTH_PX} />
          </TicketShell>

          <TicketShell title="Prueba chica">
            <TinyTicket ref={tinyTicketRef} widthPx={TICKET_WIDTH_PX} />
          </TicketShell>

          <TicketShell title="Nota de venta">
            <SaleTicket ref={saleTicketRef} widthPx={TICKET_WIDTH_PX} />
          </TicketShell>

          <TicketShell title="Nota larga">
            <LargeSaleTicket ref={largeSaleTicketRef} widthPx={TICKET_WIDTH_PX} />
          </TicketShell>
        </div>
      </section>
    </main>
  );
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length));
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

function trimVerticalWhitespace(sourceCanvas: HTMLCanvasElement, paddingPx: number) {
  const context = sourceCanvas.getContext("2d", { willReadFrequently: true });

  if (!context) {
    return {
      canvas: sourceCanvas,
      trimmedBottomPx: 0,
      trimmedTopPx: 0,
    };
  }

  const { data, height, width } = context.getImageData(
    0,
    0,
    sourceCanvas.width,
    sourceCanvas.height,
  );
  let top = 0;
  let bottom = height - 1;

  while (top < height && isWhiteRow(data, width, top)) {
    top += 1;
  }

  while (bottom > top && isWhiteRow(data, width, bottom)) {
    bottom -= 1;
  }

  const cropTop = Math.max(0, top - paddingPx);
  const cropBottom = Math.min(height - 1, bottom + paddingPx);
  const cropHeight = cropBottom - cropTop + 1;
  const trimmedCanvas = document.createElement("canvas");

  trimmedCanvas.width = width;
  trimmedCanvas.height = cropHeight;

  const trimmedContext = trimmedCanvas.getContext("2d");

  if (!trimmedContext) {
    return {
      canvas: sourceCanvas,
      trimmedBottomPx: 0,
      trimmedTopPx: 0,
    };
  }

  trimmedContext.drawImage(
    sourceCanvas,
    0,
    cropTop,
    width,
    cropHeight,
    0,
    0,
    width,
    cropHeight,
  );

  return {
    canvas: trimmedCanvas,
    trimmedBottomPx: height - cropBottom - 1,
    trimmedTopPx: cropTop,
  };
}

function isWhiteRow(data: Uint8ClampedArray, width: number, row: number) {
  const threshold = 245;
  const rowStart = row * width * 4;

  for (let x = 0; x < width; x += 1) {
    const index = rowStart + x * 4;
    const red = data[index];
    const green = data[index + 1];
    const blue = data[index + 2];
    const alpha = data[index + 3];

    if (alpha > 0 && (red < threshold || green < threshold || blue < threshold)) {
      return false;
    }
  }

  return true;
}

function ActionButton({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className="rounded-2xl bg-cyan-300 px-5 py-3 text-left text-sm font-bold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function TicketShell({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.06] p-5">
      <h2 className="mb-4 text-xl font-semibold">{title}</h2>
      <div className="overflow-x-auto rounded-2xl bg-slate-200 p-4">{children}</div>
    </section>
  );
}

function SimpleTicket({
  ref,
  widthPx,
}: {
  ref: React.Ref<HTMLDivElement>;
  widthPx: number;
}) {
  return (
    <div
      ref={ref}
      className="bg-white px-4 py-2 font-mono text-black"
      style={{ width: `${widthPx}px` }}
    >
      <h2 className="text-center text-lg font-bold">PDF DE PRUEBA</h2>
      <div className="my-4 border-t border-dashed border-black" />
      <p className="text-sm">Este es un PDF simple generado desde HTML y CSS.</p>
      <p className="mt-3 text-sm">Ancho: 80 mm</p>
      <p className="text-sm">Modo envio: Base64</p>
      <p className="text-sm">Destino: localhost:5092</p>
      <div className="my-4 border-t border-dashed border-black" />
      <p className="text-center text-xs">FIN DE PRUEBA</p>
    </div>
  );
}

function TinyTicket({
  ref,
  widthPx,
}: {
  ref: React.Ref<HTMLDivElement>;
  widthPx: number;
}) {
  return (
    <div
      ref={ref}
      className="bg-white px-4 py-2 font-mono text-black"
      style={{ width: `${widthPx}px` }}
    >
      <p className="text-center text-sm font-bold">Impresion de prueba</p>
    </div>
  );
}

function SaleTicket({
  ref,
  widthPx,
}: {
  ref: React.Ref<HTMLDivElement>;
  widthPx: number;
}) {
  const items = [
    { name: "Cafe americano", qty: 2, total: 12 },
    { name: "Sandwich mixto", qty: 1, total: 9.5 },
    { name: "Galleta artesanal", qty: 3, total: 7.5 },
  ];
  const total = items.reduce((sum, item) => sum + item.total, 0);

  return (
    <div
      ref={ref}
      className="bg-white px-4 py-2 font-mono text-[12px] text-black"
      style={{ width: `${widthPx}px` }}
    >
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-black text-lg font-black text-white">
        NV
      </div>
      <h2 className="mt-3 text-center text-base font-black">NOTA DE VENTA</h2>
      <p className="text-center text-[11px]">Demo Market S.A.C.</p>
      <p className="text-center text-[11px]">RUC 20123456789</p>
      <p className="text-center text-[11px]">Av. Principal 123 - Lima</p>

      <div className="my-3 border-t border-dashed border-black" />
      <div className="space-y-1">
        <p>Fecha: 04/09/2026 10:30</p>
        <p>Caja: 01</p>
        <p>Vendedor: LEONARDO</p>
      </div>
      <div className="my-3 border-t border-dashed border-black" />

      <div className="grid grid-cols-[1fr_28px_70px] gap-2 font-bold">
        <span>Producto</span>
        <span className="text-right">Cant</span>
        <span className="text-right">Total</span>
      </div>
      <div className="mt-2 space-y-2">
        {items.map((item) => (
          <div className="grid grid-cols-[1fr_28px_70px] gap-2" key={item.name}>
            <span>{item.name}</span>
            <span className="text-right">{item.qty}</span>
            <span className="whitespace-nowrap text-right">S/ {item.total.toFixed(2)}</span>
          </div>
        ))}
      </div>

      <div className="my-3 border-t border-dashed border-black" />
      <div className="space-y-1 text-right">
        <p>Subtotal: S/ {total.toFixed(2)}</p>
        <p>IGV: S/ 0.00</p>
        <p className="text-base font-black">TOTAL: S/ {total.toFixed(2)}</p>
      </div>
      <div className="my-3 border-t border-dashed border-black" />
      <div className="mx-auto h-12 w-44 bg-[repeating-linear-gradient(90deg,#000_0_2px,#fff_2px_4px,#000_4px_5px,#fff_5px_9px)]" />
      <p className="mt-3 text-center text-[11px]">Gracias por su compra</p>
    </div>
  );
}

function LargeSaleTicket({
  ref,
  widthPx,
}: {
  ref: React.Ref<HTMLDivElement>;
  widthPx: number;
}) {
  const items = LARGE_SALE_ITEMS;
  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const discount = LARGE_SALE_DISCOUNT;
  const total = subtotal - discount;

  return (
    <div
      ref={ref}
      className="bg-white px-4 py-2 font-mono text-[11px] text-black"
      style={{ width: `${widthPx}px` }}
    >
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl border-4 border-black text-lg font-black">
        DM
      </div>
      <h2 className="mt-3 text-center text-base font-black">NOTA DE VENTA</h2>
      <p className="text-center">Demo Market S.A.C.</p>
      <p className="text-center">RUC 20123456789</p>
      <p className="text-center">Av. Principal 123 - Lima</p>
      <p className="text-center">Telefono: 999 888 777</p>

      <div className="my-3 border-t border-dashed border-black" />
      <div className="space-y-1">
        <p>Fecha: 04/09/2026 11:45</p>
        <p>Documento: NV-LARGA-000123</p>
        <p>Caja: 02</p>
        <p>Cliente: PUBLICO GENERAL</p>
        <p>Vendedor: LEONARDO</p>
      </div>
      <div className="my-3 border-t border-dashed border-black" />

      <div className="grid grid-cols-[1fr_26px_66px] gap-2 font-bold">
        <span>Producto</span>
        <span className="text-right">Cant</span>
        <span className="text-right">Total</span>
      </div>
      <div className="mt-2 space-y-2">
        {items.map((item) => (
          <div className="grid grid-cols-[1fr_26px_66px] gap-2" key={item.name}>
            <span>{item.name}</span>
            <span className="text-right">{item.qty}</span>
            <span className="whitespace-nowrap text-right">S/ {item.total.toFixed(2)}</span>
          </div>
        ))}
      </div>

      <div className="my-3 border-t border-dashed border-black" />
      <div className="space-y-1 text-right">
        <p>Items: {items.length}</p>
        <p>Subtotal: S/ {subtotal.toFixed(2)}</p>
        <p>Descuento: -S/ {discount.toFixed(2)}</p>
        <p>IGV: S/ 0.00</p>
        <p className="text-base font-black">TOTAL: S/ {total.toFixed(2)}</p>
      </div>
      <div className="my-3 border-t border-dashed border-black" />
      <p>Pago: Yape</p>
      <p>Operacion: 987654321</p>
      <p>Autorizacion: OK</p>
      <div className="my-3 border-t border-dashed border-black" />
      <div className="mx-auto h-12 w-44 bg-[repeating-linear-gradient(90deg,#000_0_2px,#fff_2px_4px,#000_4px_5px,#fff_5px_9px)]" />
      <p className="mt-3 text-center">Gracias por su compra</p>
      <p className="text-center">Conserve este comprobante</p>
    </div>
  );
}
