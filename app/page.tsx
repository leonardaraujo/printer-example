"use client";

import { useState } from "react";

type PrintStatus = "idle" | "printing" | "success" | "error";

export default function Home() {
  const [status, setStatus] = useState<PrintStatus>("idle");
  const [message, setMessage] = useState(
    "Listo para enviar el PDF de prueba al programa local.",
  );

  async function sendTestPdf() {
    setStatus("printing");
    setMessage("Enviando PDF al servidor local...");

    const pdfUrl = `${window.location.origin}/test-print.pdf`;

    try {
      const response = await fetch("http://localhost:5092/print-pdf", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          printerName: "Basic 200",
          fileName: "test-print.pdf",
          pdfBase64: null,
          pdfUrl,
          dpi: 1200,
          mode: "image",
        }),
      });

      const responseText = await response.text();

      if (!response.ok) {
        throw new Error(responseText || `Error HTTP ${response.status}`);
      }

      setStatus("success");
      setMessage(responseText || "PDF enviado correctamente para impresion.");
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "No se pudo conectar con el servidor local.",
      );
    }
  }

  const statusClassName = {
    idle: "border-zinc-200 bg-zinc-50 text-zinc-700",
    printing: "border-blue-200 bg-blue-50 text-blue-800",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    error: "border-red-200 bg-red-50 text-red-800",
  }[status];

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-12 text-slate-100">
      <section className="w-full max-w-2xl rounded-3xl border border-white/10 bg-white/[0.06] p-8 shadow-2xl shadow-black/40 backdrop-blur">
        <p className="mb-3 text-sm font-medium uppercase tracking-[0.3em] text-cyan-300">
          Prueba local
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">
          Enviar PDF a la impresora local
        </h1>
        <p className="mt-5 text-base leading-7 text-slate-300 sm:text-lg">
          Esta pagina llama desde el navegador a{" "}
          <code className="rounded bg-black/30 px-2 py-1 text-cyan-200">
            http://localhost:5092/print-pdf
          </code>{" "}
          y le envia un PDF de prueba guardado en la carpeta publica del
          proyecto.
        </p>

        <div className="mt-8 rounded-2xl border border-white/10 bg-black/20 p-5 text-sm text-slate-300">
          <p>
            <span className="font-semibold text-slate-100">Impresora:</span>{" "}
            Basic 200
          </p>
          <p className="mt-2">
            <span className="font-semibold text-slate-100">PDF:</span>{" "}
            <a className="text-cyan-300 underline" href="/test-print.pdf" target="_blank">
              /test-print.pdf
            </a>
          </p>
          <p className="mt-2">
            <span className="font-semibold text-slate-100">Modo:</span> image
          </p>
        </div>

        <button
          className="mt-8 inline-flex w-full items-center justify-center rounded-2xl bg-cyan-300 px-6 py-4 text-base font-bold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          disabled={status === "printing"}
          onClick={sendTestPdf}
          type="button"
        >
          {status === "printing" ? "Enviando..." : "Enviar PDF de prueba"}
        </button>

        <div className={`mt-6 rounded-2xl border p-4 text-sm ${statusClassName}`}>
          {message}
        </div>

        <p className="mt-6 text-sm leading-6 text-slate-400">
          Para que funcione, el programa local debe estar abierto en esta misma
          computadora y CORS debe estar habilitado en el servidor local.
        </p>
      </section>
    </main>
  );
}
