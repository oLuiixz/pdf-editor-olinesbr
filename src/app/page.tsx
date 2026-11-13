"use client";

import { ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  AlignCenter, AlignLeft, AlignRight, ArrowDownToLine, ArrowLeft, ChevronDown,
  ChevronLeft, ChevronRight, Cloud, FilePlus2, FileText, ImagePlus, Layers3,
  Minus, MousePointer2, Plus, Redo2, RotateCw, Save, Search, Settings2,
  Sparkles, Type, Upload, X, ZoomIn, ZoomOut
} from "lucide-react";

type TextBlock = {
  id: string; page: number; original: string; value: string;
  x: number; y: number; width: number; height: number; fontSize: number;
  baselineX: number; baselineY: number; isNew?: boolean;
  pdfFontSize: number; pdfWidth: number; pageScale: number; fontFamily: string;
  backgroundColor: string; textColor: string; textAlign?: "left" | "center" | "right";
};

function colorAt(canvas: HTMLCanvasElement, x: number, y: number): string {
  const ctx = canvas.getContext("2d");
  if (!ctx) return "#ffffff";
  const px = Math.max(0, Math.min(canvas.width - 1, Math.round(x)));
  const py = Math.max(0, Math.min(canvas.height - 1, Math.round(y)));
  const data = ctx.getImageData(px, py, 1, 1).data;
  return `#${[data[0], data[1], data[2]].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

function sampleTextColors(canvas: HTMLCanvasElement, x: number, y: number, width: number, height: number) {
  const bg = colorAt(canvas, x + Math.max(1, width * .12), Math.max(0, y - 2));
  const bgRgb = [parseInt(bg.slice(1,3),16), parseInt(bg.slice(3,5),16), parseInt(bg.slice(5,7),16)];
  const ctx = canvas.getContext("2d");
  if (!ctx) return { backgroundColor: bg, textColor: "#202124" };
  const left = Math.max(0, Math.floor(x));
  const top = Math.max(0, Math.floor(y));
  const right = Math.min(canvas.width, Math.ceil(x + Math.max(2, width)));
  const bottom = Math.min(canvas.height, Math.ceil(y + Math.max(2, height)));
  const pixels = ctx.getImageData(left, top, Math.max(1, right-left), Math.max(1, bottom-top)).data;
  const candidates: number[][] = [];
  for (let i = 0; i < pixels.length; i += 4) {
    const r=pixels[i], g=pixels[i+1], b=pixels[i+2];
    if (Math.abs(r-bgRgb[0])+Math.abs(g-bgRgb[1])+Math.abs(b-bgRgb[2]) > 70) candidates.push([r,g,b]);
  }
  if (!candidates.length) return { backgroundColor: bg, textColor: "#202124" };
  candidates.sort((a,b) => (a[0]+a[1]+a[2])-(b[0]+b[1]+b[2]));
  const dark = candidates[Math.floor(candidates.length * .35)];
  const hex = (v:number) => v.toString(16).padStart(2,"0");
  return { backgroundColor: bg, textColor: `#${hex(dark[0])}${hex(dark[1])}${hex(dark[2])}` };
}

function pdfColor(hex: string) {
  const value = hex.replace("#", "");
  return { r: parseInt(value.slice(0,2),16)/255, g: parseInt(value.slice(2,4),16)/255, b: parseInt(value.slice(4,6),16)/255 };
}

const fmtBytes = (n: number) => n < 1024 * 1024 ? `${(n / 1024).toFixed(0)} KB` : `${(n / (1024 * 1024)).toFixed(1)} MB`;

export default function Home() {
  const inputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [pdfBytes, setPdfBytes] = useState<ArrayBuffer | null>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [currentPageHeight, setCurrentPageHeight] = useState(792);
  const [zoom, setZoom] = useState(1);
  const [blocks, setBlocks] = useState<TextBlock[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [tool, setTool] = useState<"select" | "text">("select");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const selectedBlock = blocks.find((b) => b.id === selected) ?? null;
  const pageBlocks = blocks.filter((b) => b.page === page);

  const loadPdf = useCallback(async (picked: File) => {
    if (picked.type !== "application/pdf" && !picked.name.toLowerCase().endsWith(".pdf")) {
      setError("Selecione um arquivo PDF válido."); return;
    }
    setLoading(true); setError(""); setBlocks([]); setSelected(null);
    try {
      const bytes = await picked.arrayBuffer();
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${(pdfjs as any).version}/pdf.worker.min.mjs`;
      const doc = await (pdfjs as any).getDocument({ data: bytes.slice(0) }).promise;
      setFile(picked); setPdfBytes(bytes); setPdfDoc(doc); setPageCount(doc.numPages); setPage(1); setSaved(false);
    } catch (e) {
      setError("Não foi possível abrir este PDF. Verifique se o arquivo não está protegido ou corrompido.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function render() {
      if (!pdfDoc || !canvasRef.current) return;
      try {
        const pdfPage = await pdfDoc.getPage(page);
        const viewport = pdfPage.getViewport({ scale: 1.15 * zoom });
        setCurrentPageHeight(pdfPage.view[3] - pdfPage.view[1]);
        const canvas = canvasRef.current;
        const context = canvas?.getContext("2d");
        if (!canvas || !context) return;
        canvas.width = viewport.width; canvas.height = viewport.height;
        canvas.style.width = `${viewport.width}px`; canvas.style.height = `${viewport.height}px`;
        await pdfPage.render({ canvasContext: context, viewport }).promise;
        const textContent = await pdfPage.getTextContent();
        if (cancelled) return;
        const next: TextBlock[] = [];
        for (let i = 0; i < textContent.items.length; i++) {
          const item = textContent.items[i] as any;
          if (!item.str?.trim() || !item.transform) continue;
          const tx = item.transform;
          const point = viewport.convertToViewportPoint(tx[4], tx[5]);
          const pdfFontSize = Math.max(4, Math.hypot(tx[2], tx[3]));
          const fontSize = Math.max(7, pdfFontSize * viewport.scale);
          const width = Math.max(8, (item.width || item.str.length * pdfFontSize * .45) * viewport.scale);
          const height = Math.max(fontSize * 1.2, fontSize);
          const colors = sampleTextColors(canvas, point[0], point[1] - height, width, height);
          const style = (textContent.styles as any)[item.fontName] || {};
          next.push({
            id: `p${page}-t${i}`, page, original: item.str, value: item.str,
            x: point[0], y: point[1] - height, width, height, fontSize,
            baselineX: tx[4], baselineY: tx[5], pdfFontSize, pdfWidth: Math.max(2, item.width || item.str.length * pdfFontSize * .45), pageScale: viewport.scale,
            fontFamily: style.fontFamily || "Helvetica",
            backgroundColor: colors.backgroundColor, textColor: colors.textColor
          });
        }
        setBlocks((current) => {
          const previous = new Map(current.filter((b) => b.page === page).map((b) => [b.id, b]));
          const refreshed = next.map((b) => {
            const old = previous.get(b.id);
            return old ? { ...b, value: old.value } : b;
          });
          const newItems = current.filter((b) => b.page === page && b.isNew).map((b) => {
            const point = viewport.convertToViewportPoint(b.baselineX, b.baselineY);
            const height = Math.max(7, b.pdfFontSize * viewport.scale * 1.2);
            return { ...b, x: point[0], y: point[1] - height, width: b.pdfWidth * viewport.scale, fontSize: b.pdfFontSize * viewport.scale, height, pageScale: viewport.scale };
          });
          return [...current.filter((b) => b.page !== page), ...refreshed, ...newItems];
        });
      } catch { setError("Falha ao renderizar esta página."); }
    }
    render();
    return () => { cancelled = true; };
  }, [pdfDoc, page, zoom]);

  const updateSelected = (value: string) => {
    if (!selected) return;
    setBlocks((items) => items.map((b) => b.id === selected ? { ...b, value } : b));
    setSaved(false);
  };

  const updateSelectedStyle = (patch: Partial<TextBlock>) => {
    if (!selected) return;
    setBlocks((items) => items.map((b) => {
      if (b.id !== selected) return b;
      const next = { ...b, ...patch };
      if (patch.pdfFontSize !== undefined) next.fontSize = patch.pdfFontSize * (b.pageScale || 1);
      if (patch.fontSize !== undefined) next.pdfFontSize = patch.fontSize / (b.pageScale || 1);
      if (patch.pdfWidth !== undefined) next.width = patch.pdfWidth * (b.pageScale || 1);
      if (patch.width !== undefined) next.pdfWidth = patch.width / (b.pageScale || 1);
      return next;
    }));
    setSaved(false);
  };

  const addText = () => {
    const item: TextBlock = {
      id: `new-${Date.now()}`, page, original: "", value: "Novo texto",
      x: 90, y: 110, width: 180, height: 28, fontSize: 18,
      baselineX: 90 / (1.15 * zoom), baselineY: currentPageHeight - 138 / (1.15 * zoom), isNew: true,
      pdfFontSize: 14, pdfWidth: 150, pageScale: 1.15 * zoom, fontFamily: "Helvetica",
      backgroundColor: "#ffffff", textColor: "#202124"
    };
    setBlocks((items) => [...items, item]); setSelected(item.id); setTool("select"); setSaved(false);
  };

  const exportPdf = async () => {
    if (!pdfBytes) return;
    setLoading(true); setError("");
    try {
      const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
      const out = await PDFDocument.load(pdfBytes);
      const fontCache = new Map<string, any>();
      const getFont = async (family: string) => {
        const name = /courier|mono/i.test(family) ? StandardFonts.Courier :
          /times|serif/i.test(family) ? StandardFonts.TimesRoman : StandardFonts.Helvetica;
        if (!fontCache.has(name)) fontCache.set(name, await out.embedFont(name));
        return fontCache.get(name);
      };
      const pages = out.getPages();
      for (const block of blocks.filter((b) => b.isNew || b.value !== b.original)) {
        const targetPage = pages[block.page - 1];
        if (!targetPage) continue;
        const pageHeight = targetPage.getHeight();
        const x = block.baselineX;
        const y = block.baselineY - Math.max(1, block.pdfFontSize * .18);
        const scale = block.pageScale || 1.15;
        const boxWidth = Math.max(10, block.pdfWidth);
        const boxHeight = Math.max(8, block.height / scale);
        const bg = pdfColor(block.backgroundColor || "#ffffff");
        const ink = pdfColor(block.textColor || "#202124");
        const font = await getFont(block.fontFamily || "Helvetica");
        targetPage.drawRectangle({
          x: Math.max(0, x - 1), y: Math.max(0, y - block.pdfFontSize * .22),
          width: boxWidth + 3, height: boxHeight + block.pdfFontSize * .35,
          color: rgb(bg.r, bg.g, bg.b), opacity: 1
        });
        if (block.value.trim()) {
          const measured = font.widthOfTextAtSize(block.value, block.pdfFontSize);
          const fittedSize = measured > boxWidth ? block.pdfFontSize * (boxWidth / measured) : block.pdfFontSize;
          const fittedWidth = font.widthOfTextAtSize(block.value, fittedSize);
          const alignedX = block.textAlign === "center" ? x + (boxWidth - fittedWidth) / 2 :
            block.textAlign === "right" ? x + boxWidth - fittedWidth : x;
          targetPage.drawText(block.value, {
            x: Math.max(0, alignedX), y: Math.max(0, y), size: Math.max(4, fittedSize),
            font, color: rgb(ink.r, ink.g, ink.b)
          });
        }
      }
      const result = await out.save();
      const blob = new Blob([result as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url;
      a.download = `${file?.name.replace(/\.pdf$/i, "") || "documento"}-editado.pdf`;
      a.click(); URL.revokeObjectURL(url); setSaved(true);
    } catch { setError("Não foi possível exportar este documento."); }
    finally { setLoading(false); }
  };

  const onFile = (event: ChangeEvent<HTMLInputElement>) => {
    const picked = event.target.files?.[0]; if (picked) loadPdf(picked);
    event.target.value = "";
  };

  return (
    <main className="min-h-screen bg-ink text-zinc-100">
      <header className="h-[68px] border-b border-line bg-[#15171d] flex items-center justify-between px-5 md:px-7">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#a99cff] to-[#7463e8] grid place-items-center shadow-lg shadow-violet-950/40"><FileText size={19} className="text-white" /></div>
          <div><div className="font-semibold tracking-tight text-[15px]">forma<span className="text-violet-300">.</span></div><div className="text-[10px] text-zinc-500 tracking-[.16em] uppercase">PDF Studio</div></div>
          <div className="hidden sm:block h-7 w-px bg-line mx-3" />
          <div className="hidden sm:block text-sm text-zinc-400">{file ? file.name : "Editor de documentos"}</div>
          {file && <span className="hidden md:inline-flex rounded-full bg-emerald-400/10 text-emerald-300 px-2.5 py-1 text-[10px] font-medium">LOCAL • PRIVADO</span>}
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden md:flex items-center gap-1.5 text-xs text-zinc-500 mr-2"><Cloud size={14} /> {saved ? "Exportação concluída" : "Salvo localmente"}</span>
          <button onClick={() => inputRef.current?.click()} className="hidden sm:flex items-center gap-2 rounded-lg border border-line px-3.5 py-2 text-sm text-zinc-300 hover:bg-white/5"><FilePlus2 size={15} /> Abrir PDF</button>
          <button onClick={exportPdf} disabled={!file || loading} className="flex items-center gap-2 rounded-lg bg-violet-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-950/30 hover:bg-violet-400 disabled:opacity-40"><ArrowDownToLine size={16} /> <span className="hidden sm:inline">Exportar PDF</span><span className="sm:hidden">Exportar</span></button>
        </div>
      </header>

      {file ? (
        <div className="flex h-[calc(100vh-68px)] min-h-[620px] flex-col">
          <div className="h-[54px] shrink-0 border-b border-line bg-[#191c23] flex items-center justify-between px-4 md:px-6">
            <div className="flex items-center gap-1">
              <ToolButton active={tool === "select"} onClick={() => setTool("select")} title="Selecionar"><MousePointer2 size={17} /></ToolButton>
              <ToolButton active={tool === "text"} onClick={addText} title="Adicionar texto"><Type size={17} /></ToolButton>
              <div className="mx-2 h-6 w-px bg-line" />
              <ToolButton onClick={() => setZoom((z) => Math.max(.55, +(z - .1).toFixed(2)))} title="Diminuir zoom"><ZoomOut size={17} /></ToolButton>
              <span className="w-12 text-center text-xs text-zinc-400 tabular-nums">{Math.round(zoom * 100)}%</span>
              <ToolButton onClick={() => setZoom((z) => Math.min(1.8, +(z + .1).toFixed(2)))} title="Aumentar zoom"><ZoomIn size={17} /></ToolButton>
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden sm:inline text-xs text-zinc-500">{fmtBytes(file.size)}</span>
              <div className="flex items-center gap-1 rounded-lg border border-line p-1">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="p-1.5 rounded hover:bg-white/5 disabled:opacity-30"><ChevronLeft size={16}/></button>
                <span className="min-w-[64px] text-center text-xs text-zinc-300">{page} <span className="text-zinc-600">/</span> {pageCount}</span>
                <button onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={page >= pageCount} className="p-1.5 rounded hover:bg-white/5 disabled:opacity-30"><ChevronRight size={16}/></button>
              </div>
            </div>
          </div>

          <div className="flex min-h-0 flex-1">
            <aside className="hidden md:flex w-[68px] shrink-0 flex-col items-center gap-3 border-r border-line bg-[#171a20] py-4">
              <ToolButton active title="Editar conteúdo"><MousePointer2 size={18}/></ToolButton>
              <ToolButton title="Texto" onClick={addText}><Type size={18}/></ToolButton>
              <ToolButton title="Imagens (em breve)" disabled><ImagePlus size={18}/></ToolButton>
              <ToolButton title="Organizar páginas (em breve)" disabled><Layers3 size={18}/></ToolButton>
              <div className="mt-auto"><ToolButton title="Configurações"><Settings2 size={18}/></ToolButton></div>
            </aside>

            <section className="workspace-grid relative flex min-w-0 flex-1 items-start justify-center overflow-auto p-5 md:p-10 scrollbar-thin">
              <div className="relative mb-12">
                <div className="pdf-page" style={{ width: canvasRef.current?.style.width || "auto" }}>
                  <canvas ref={canvasRef} className="block max-w-none" />
                  {pageBlocks.map((block) => (
                    <button key={block.id} onClick={() => { setSelected(block.id); setTool("select"); }}
                      title={block.value}
                      aria-label={`Selecionar texto: ${block.original.slice(0, 80)}`}
                      className={`pdf-text-hit ${selected === block.id ? "selected" : ""}`}
                      style={{ left: block.x, top: block.y, width: Math.max(block.width, 10), height: Math.max(block.height, 12), fontSize: block.fontSize, color: "transparent", backgroundColor: "transparent", zIndex: selected === block.id ? 3 : 1 }}>
                    </button>
                  ))}
                  {pageBlocks.filter((block) => block.isNew || block.value !== block.original).map((block) => (
                    <div key={`preview-${block.id}`} className="pdf-live-preview"
                      aria-live={selected === block.id ? "polite" : "off"}
                      style={{
                        left: block.x, top: block.y, width: Math.max(block.width, 10), minHeight: Math.max(block.height, 12),
                        fontSize: block.fontSize, lineHeight: 1.15, fontFamily: block.fontFamily,
                        color: block.textColor, backgroundColor: block.backgroundColor, textAlign: block.textAlign || "left",
                        zIndex: selected === block.id ? 8 : 6
                      }}>
                      {block.value}
                    </div>
                  ))}
                  {selectedBlock && selectedBlock.page === page && (
                    <div className="absolute z-20" style={{ left: Math.max(0, selectedBlock.x), top: Math.max(0, selectedBlock.y - 38) }}>
                      <div className="flex items-center gap-1 rounded-lg border border-violet-300/50 bg-[#24212f] p-1 shadow-xl">
                        <span className="px-2 text-[10px] text-violet-200">Texto</span>
                        <button onClick={() => setSelected(null)} className="p-1 text-zinc-400 hover:text-white"><X size={13}/></button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              {error && <div className="fixed bottom-5 left-1/2 -translate-x-1/2 rounded-xl border border-red-400/30 bg-[#351f25] px-4 py-3 text-sm text-red-200 shadow-xl">{error}</div>}
            </section>

            <aside className="hidden lg:flex w-[292px] shrink-0 flex-col border-l border-line bg-[#191c23]">
              <div className="border-b border-line px-5 py-4"><div className="text-sm font-semibold">Propriedades</div><div className="mt-1 text-xs text-zinc-500">Edite o elemento selecionado</div></div>
              {selectedBlock ? (
                <div className="space-y-5 p-5">
                  <div><label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">Conteúdo do texto</label><textarea value={selectedBlock.value} onChange={(e) => updateSelected(e.target.value)} rows={4} className="w-full resize-y rounded-lg border border-line bg-[#111318] p-3 text-sm text-zinc-100 outline-none focus:border-violet-400" /></div>
                  <div>
                    <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">Fonte</label>
                    <select value={selectedBlock.fontFamily} onChange={(e) => updateSelectedStyle({ fontFamily: e.target.value })} className="w-full rounded-lg border border-line bg-[#111318] p-2.5 text-sm text-zinc-100 outline-none focus:border-violet-400">
                      <option value="Helvetica">Arial / Helvetica</option>
                      <option value="Times New Roman">Times New Roman</option>
                      <option value="Courier New">Courier New</option>
                      <option value="Georgia">Georgia</option>
                      <option value="Verdana">Verdana</option>
                    </select>
                    <p className="mt-1.5 text-[10px] leading-relaxed text-zinc-500">A fonte original é estimada. Escolha a substituta mais próxima.</p>
                  </div>
                  <div>
                    <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">Tamanho (pt)</label>
                    <input type="number" min="4" max="144" step="0.5" value={Number(selectedBlock.pdfFontSize.toFixed(1))} onChange={(e) => updateSelectedStyle({ pdfFontSize: Math.max(4, Math.min(144, Number(e.target.value) || 4)) })} className="w-full rounded-lg border border-line bg-[#111318] px-3 py-2.5 text-sm outline-none focus:border-violet-400"/>
                  </div>
                  <div>
                    <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">Largura do texto</label>
                    <input type="range" min="20" max="900" step="1" value={Math.round(selectedBlock.width)} onChange={(e) => updateSelectedStyle({ width: Number(e.target.value) })} className="w-full accent-violet-400"/>
                    <div className="text-right text-xs text-zinc-500">{Math.round(selectedBlock.width)} px na página</div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Cor do texto
                      <input type="color" value={selectedBlock.textColor} onChange={(e) => updateSelectedStyle({ textColor: e.target.value })} className="mt-2 h-10 w-full cursor-pointer rounded border border-line bg-[#111318] p-1"/>
                    </label>
                    <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Fundo
                      <input type="color" value={selectedBlock.backgroundColor} onChange={(e) => updateSelectedStyle({ backgroundColor: e.target.value })} className="mt-2 h-10 w-full cursor-pointer rounded border border-line bg-[#111318] p-1"/>
                    </label>
                  </div>
                  <div>
                    <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">Alinhamento</label>
                    <div className="grid grid-cols-3 gap-1">
                      {(["left", "center", "right"] as const).map((align) => <button key={align} onClick={() => updateSelectedStyle({ textAlign: align })} className={`rounded-lg border py-2 text-xs ${(selectedBlock.textAlign || "left") === align ? "border-violet-400 bg-violet-400/10 text-violet-200" : "border-line text-zinc-400"}`}>{align === "left" ? "Esquerda" : align === "center" ? "Centro" : "Direita"}</button>)}
                    </div>
                  </div>
                  <div className="rounded-lg bg-violet-400/10 p-3 text-xs leading-relaxed text-violet-200"><Sparkles size={14} className="mb-2"/> A edição visual recompõe o trecho selecionado na exportação. A fidelidade depende das fontes e da estrutura do PDF original.</div>
                  <button onClick={() => { setBlocks((items) => items.filter((b) => b.id !== selected)); setSelected(null); setSaved(false); }} className="w-full rounded-lg border border-red-400/20 py-2.5 text-sm text-red-300 hover:bg-red-400/10">Remover texto selecionado</button>
                </div>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center px-7 text-center"><div className="mb-3 grid h-11 w-11 place-items-center rounded-xl bg-white/5 text-zinc-400"><MousePointer2 size={19}/></div><div className="text-sm font-medium">Nenhum elemento selecionado</div><p className="mt-2 text-xs leading-relaxed text-zinc-500">Clique em um texto na página para editar seu conteúdo e valores.</p></div>
              )}
              <div className="border-t border-line p-4"><div className="flex items-center justify-between text-xs text-zinc-500"><span>Elementos nesta página</span><span>{pageBlocks.length}</span></div></div>
            </aside>
          </div>
        </div>
      ) : (
        <section className="relative flex min-h-[calc(100vh-68px)] items-center justify-center overflow-hidden px-5 py-14">
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-[560px] w-[760px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-500/[0.08] blur-[120px]" />
          <div className="relative mx-auto w-full max-w-[760px] text-center">
            <div className="mx-auto mb-7 flex h-16 w-16 items-center justify-center rounded-[22px] border border-violet-300/20 bg-gradient-to-br from-violet-400/20 to-violet-600/5 text-violet-200 shadow-soft"><FileText size={29}/></div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-violet-300/15 bg-violet-300/[0.07] px-3 py-1.5 text-[11px] font-medium tracking-wide text-violet-200"><Sparkles size={13}/> SEU ESPAÇO DE EDIÇÃO PDF</div>
            <h1 className="text-4xl font-semibold tracking-[-.045em] text-white sm:text-5xl">Seus documentos.<br/><span className="bg-gradient-to-r from-violet-300 to-indigo-200 bg-clip-text text-transparent">Do seu jeito.</span></h1>
            <p className="mx-auto mt-5 max-w-[510px] text-sm leading-7 text-zinc-400 sm:text-base">Edite textos, atualize valores e organize seus PDFs em um espaço de trabalho simples, preciso e privado.</p>
            <button onClick={() => inputRef.current?.click()} disabled={loading} className="mx-auto mt-9 flex min-w-[220px] items-center justify-center gap-3 rounded-xl bg-violet-500 px-6 py-4 text-sm font-semibold text-white shadow-xl shadow-violet-950/40 transition hover:-translate-y-0.5 hover:bg-violet-400 disabled:opacity-50"><Upload size={17}/>{loading ? "Abrindo documento..." : "Selecionar arquivo PDF"}</button>
            <div className="mt-4 text-xs text-zinc-600">PDF até o limite de memória do navegador • Seus arquivos permanecem no dispositivo</div>
            <div className="mx-auto mt-14 grid max-w-[620px] grid-cols-1 gap-3 text-left sm:grid-cols-3">
              <Feature icon={<Type size={17}/>} title="Editar textos" desc="Altere conteúdos e valores"/>
              <Feature icon={<Layers3 size={17}/>} title="Controle total" desc="Navegue entre as páginas"/>
              <Feature icon={<Save size={17}/>} title="Exportação" desc="Baixe seu PDF atualizado"/>
            </div>
            {error && <p className="mt-5 text-sm text-red-300">{error}</p>}
          </div>
        </section>
      )}
      <input ref={inputRef} type="file" accept="application/pdf,.pdf" onChange={onFile} className="hidden"/>
    </main>
  );
}

function ToolButton({ children, active, onClick, title, disabled }: { children: React.ReactNode; active?: boolean; onClick?: () => void; title: string; disabled?: boolean }) {
  return <button title={title} onClick={onClick} disabled={disabled} className={`grid h-9 w-9 place-items-center rounded-lg transition ${active ? "bg-violet-400/15 text-violet-200" : "text-zinc-500 hover:bg-white/5 hover:text-zinc-200"} disabled:cursor-not-allowed disabled:opacity-25`}>{children}</button>;
}
function Feature({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return <div className="rounded-xl border border-line/80 bg-[#191c23]/70 p-4"><div className="mb-3 text-violet-300">{icon}</div><div className="text-sm font-medium text-zinc-200">{title}</div><div className="mt-1 text-xs text-zinc-500">{desc}</div></div>;
}
