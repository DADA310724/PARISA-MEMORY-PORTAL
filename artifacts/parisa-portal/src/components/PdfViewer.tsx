import { useEffect, useRef, useState, useCallback } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { ArrowLeft, Search, X, ChevronLeft, ChevronRight } from "lucide-react";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

interface MatchItem { page: number; itemIdx: number; snippet: string; }

interface Props {
  url: string;
  title: string;
  onClose: () => void;
}

export function PdfViewer({ url, title, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null);

  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pageInput, setPageInput] = useState("1");

  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [matchIdx, setMatchIdx] = useState(0);
  const [noResults, setNoResults] = useState(false);

  /* ── Load PDF ── */
  useEffect(() => {
    setLoading(true);
    setError("");
    setPdfDoc(null);
    setCurrentPage(1);
    setTotalPages(0);
    setMatches([]);
    setMatchIdx(0);

    const task = pdfjsLib.getDocument({ url, withCredentials: false });
    task.promise
      .then((doc) => { setPdfDoc(doc); setTotalPages(doc.numPages); setLoading(false); })
      .catch((e) => { console.error("PDF load error", e); setError("PDF লোড হয়নি। আবার চেষ্টা করুন।"); setLoading(false); });
    return () => { task.destroy(); };
  }, [url]);

  /* ── Render page + text layer ── */
  const renderPage = useCallback(async (
    doc: pdfjsLib.PDFDocumentProxy,
    pageNum: number,
    query: string,
    activeMatchItems: MatchItem[],
    activeMatchIdx: number,
  ) => {
    if (!canvasRef.current || !containerRef.current) return;

    if (renderTaskRef.current) {
      try { renderTaskRef.current.cancel(); } catch {}
    }

    const page = await doc.getPage(pageNum);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const containerWidth = containerRef.current.clientWidth;
    const unscaled = page.getViewport({ scale: 1 });
    const dpr = window.devicePixelRatio || 1;
    const scale = (containerWidth / unscaled.width) * dpr;
    const viewport = page.getViewport({ scale });

    const logicalW = viewport.width / dpr;
    const logicalH = viewport.height / dpr;

    canvas.width = viewport.width;
    canvas.height = viewport.height;
    canvas.style.width = `${logicalW}px`;
    canvas.style.height = `${logicalH}px`;

    try {
      renderTaskRef.current = page.render({ canvasContext: ctx, viewport });
      await renderTaskRef.current.promise;
    } catch (e: unknown) {
      if ((e as { name?: string })?.name !== "RenderingCancelledException") console.error("Render error", e);
    }

    /* ── Text layer ── */
    if (!textLayerRef.current) return;
    const tlDiv = textLayerRef.current;
    tlDiv.innerHTML = "";
    tlDiv.style.width = `${logicalW}px`;
    tlDiv.style.height = `${logicalH}px`;

    if (!query.trim()) return;

    const qLower = query.trim().toLowerCase();
    const textContent = await page.getTextContent();
    const items = textContent.items as Array<{ str: string; transform: number[]; width: number; height: number }>;
    const pageMatchIndices = new Set<number>();
    if (activeMatchItems.length) {
      activeMatchItems.forEach((m, mi) => {
        if (m.page === pageNum) pageMatchIndices.add(m.itemIdx);
      });
    }

    items.forEach((item, idx) => {
      if (!item.str.trim()) return;
      const strLower = item.str.toLowerCase();
      const hasMatch = strLower.includes(qLower);
      const isActive = pageMatchIndices.has(idx) && activeMatchItems[activeMatchIdx]?.page === pageNum && activeMatchItems[activeMatchIdx]?.itemIdx === idx;

      const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
      const angle = Math.atan2(tx[1], tx[0]);
      const fontSize = Math.hypot(tx[0], tx[1]) / dpr;
      const left = tx[4] / dpr;
      const top = tx[5] / dpr - fontSize;

      const span = document.createElement("span");
      span.textContent = item.str;
      span.style.cssText = [
        "position:absolute",
        `left:${left}px`,
        `top:${top}px`,
        `font-size:${fontSize}px`,
        `transform:rotate(${angle}rad)`,
        "transform-origin:0 100%",
        "white-space:pre",
        "line-height:1",
        hasMatch
          ? isActive
            ? "background:rgba(255,140,0,0.6);color:transparent;border-radius:2px;"
            : "background:rgba(255,220,0,0.45);color:transparent;border-radius:2px;"
          : "color:transparent",
      ].join(";");

      tlDiv.appendChild(span);
    });
  }, []);

  useEffect(() => {
    if (!pdfDoc) return;
    setPageInput(String(currentPage));
    renderPage(pdfDoc, currentPage, searchQuery, matches, matchIdx);
  }, [pdfDoc, currentPage, renderPage, searchQuery, matches, matchIdx]);

  /* ── Search all pages ── */
  const handleSearch = useCallback(async () => {
    if (!pdfDoc || !searchQuery.trim()) return;
    setSearching(true);
    setNoResults(false);
    setMatches([]);
    const q = searchQuery.trim().toLowerCase();
    const found: MatchItem[] = [];

    for (let p = 1; p <= pdfDoc.numPages; p++) {
      const page = await pdfDoc.getPage(p);
      const content = await page.getTextContent();
      const items = content.items as Array<{ str: string }>;
      items.forEach((item, idx) => {
        if (item.str.toLowerCase().includes(q)) {
          const snippetStart = Math.max(0, item.str.toLowerCase().indexOf(q) - 20);
          found.push({ page: p, itemIdx: idx, snippet: item.str.substring(snippetStart, snippetStart + 60).trim() });
        }
      });
    }

    setSearching(false);
    if (found.length === 0) { setNoResults(true); return; }
    setMatches(found);
    setMatchIdx(0);
    setCurrentPage(found[0].page);
  }, [pdfDoc, searchQuery]);

  const goToMatch = (idx: number) => {
    if (idx < 0 || idx >= matches.length) return;
    setMatchIdx(idx);
    setCurrentPage(matches[idx].page);
  };

  const jumpToPage = () => {
    const n = parseInt(pageInput);
    if (n >= 1 && n <= totalPages) setCurrentPage(n);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "#1a1a2e" }}>

      {/* ── Header ── */}
      <div
        className="flex items-center gap-2 px-3 py-2 flex-shrink-0"
        style={{ background: "rgba(10,14,31,0.98)", borderBottom: "1px solid rgba(0,212,170,0.18)" }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-white/70 hover:text-white transition-colors flex-shrink-0"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <p className="flex-1 text-xs font-semibold truncate text-center" style={{ color: "#00e5ff", fontFamily: "'Exo 2',sans-serif" }}>
          {title}
        </p>

        {/* Page jump */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <input
            value={pageInput}
            onChange={(e) => setPageInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && jumpToPage()}
            onBlur={jumpToPage}
            className="w-10 text-center text-xs rounded-lg py-1 text-white font-mono focus:outline-none"
            style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)" }}
          />
          <span className="text-white/30 text-[10px]">/{totalPages || "—"}</span>
        </div>

        {/* Search toggle */}
        <button
          onClick={() => { setShowSearch((s) => !s); if (showSearch) { setMatches([]); setNoResults(false); } }}
          className="w-9 h-9 rounded-xl flex items-center justify-center transition-all flex-shrink-0"
          style={{
            background: showSearch ? "rgba(0,229,255,0.18)" : "rgba(255,255,255,0.06)",
            border: `1px solid ${showSearch ? "rgba(0,229,255,0.45)" : "rgba(255,255,255,0.1)"}`,
            color: showSearch ? "#00e5ff" : "rgba(255,255,255,0.6)",
          }}
        >
          <Search className="w-4 h-4" />
        </button>
      </div>

      {/* ── Search Panel ── */}
      {showSearch && (
        <div
          className="flex-shrink-0 px-3 py-2 space-y-1.5"
          style={{ background: "rgba(0,0,0,0.5)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}
        >
          <div className="flex gap-2 items-center">
            <input
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setNoResults(false); }}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="নম্বর বা টেক্সট লিখুন..."
              autoFocus
              className="flex-1 rounded-xl px-3 py-1.5 text-white text-sm focus:outline-none"
              style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(0,229,255,0.3)", fontFamily: "'Hind Siliguri',sans-serif" }}
            />
            {searchQuery && (
              <button onClick={() => { setSearchQuery(""); setMatches([]); setNoResults(false); }}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-white/40 hover:text-white/70 flex-shrink-0"
                style={{ background: "rgba(255,255,255,0.06)" }}>
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={handleSearch}
              disabled={searching || !searchQuery.trim()}
              className="px-3 py-1.5 rounded-xl text-xs font-bold flex-shrink-0 disabled:opacity-40"
              style={{ background: "rgba(0,229,255,0.15)", border: "1px solid rgba(0,229,255,0.4)", color: "#00e5ff" }}
            >
              {searching ? "..." : "খুঁজুন"}
            </button>
          </div>

          {noResults && (
            <p className="text-xs text-red-400/80 px-1" style={{ fontFamily: "'Hind Siliguri',sans-serif" }}>কিছু পাওয়া যায়নি।</p>
          )}

          {matches.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold flex-shrink-0" style={{ color: "#00d4aa" }}>{matches.length}টি</span>
              <button onClick={() => goToMatch(matchIdx - 1)} disabled={matchIdx === 0}
                className="w-6 h-6 rounded-lg flex items-center justify-center text-white/60 disabled:opacity-25 flex-shrink-0"
                style={{ background: "rgba(255,255,255,0.08)" }}>
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="text-xs text-white/40 flex-shrink-0">{matchIdx + 1}/{matches.length}</span>
              <button onClick={() => goToMatch(matchIdx + 1)} disabled={matchIdx === matches.length - 1}
                className="w-6 h-6 rounded-lg flex items-center justify-center text-white/60 disabled:opacity-25 flex-shrink-0"
                style={{ background: "rgba(255,255,255,0.08)" }}>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <span className="text-xs text-white/35 truncate flex-1">পেজ {matches[matchIdx]?.page} — …{matches[matchIdx]?.snippet}…</span>
            </div>
          )}
        </div>
      )}

      {/* ── Canvas Area ── */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto flex flex-col items-center py-3 gap-3"
        style={{ background: "#374151" }}
        onContextMenu={(e) => e.preventDefault()}
      >
        {loading && (
          <div className="flex items-center justify-center flex-1 min-h-48">
            <div className="text-center">
              <div className="w-10 h-10 border-2 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin mx-auto mb-3" />
              <p className="text-white/40 text-sm" style={{ fontFamily: "'Hind Siliguri',sans-serif" }}>PDF লোড হচ্ছে...</p>
            </div>
          </div>
        )}
        {error && (
          <div className="flex items-center justify-center flex-1 px-6">
            <div className="text-center space-y-3">
              <p className="text-4xl">📄</p>
              <p className="text-red-400 text-sm" style={{ fontFamily: "'Hind Siliguri',sans-serif" }}>{error}</p>
              <button onClick={() => window.location.reload()}
                className="px-4 py-2 rounded-xl text-xs font-bold"
                style={{ background: "rgba(0,229,255,0.12)", border: "1px solid rgba(0,229,255,0.3)", color: "#00e5ff" }}>
                আবার চেষ্টা করুন
              </button>
            </div>
          </div>
        )}
        {!loading && !error && (
          <div className="relative shadow-2xl rounded" style={{ background: "#ffffff" }}>
            <canvas ref={canvasRef} className="block" />
            <div
              ref={textLayerRef}
              className="absolute inset-0 overflow-hidden"
              style={{ userSelect: "none", pointerEvents: "none" }}
            />
          </div>
        )}
      </div>

      {/* ── Page navigation ── */}
      {!loading && !error && totalPages > 1 && (
        <div
          className="flex-shrink-0 flex items-center justify-center gap-4 py-2.5"
          style={{ background: "rgba(10,14,31,0.97)", borderTop: "1px solid rgba(255,255,255,0.07)" }}
        >
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white disabled:opacity-25"
            style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-white/50 text-sm min-w-[80px] text-center">{currentPage} / {totalPages}</span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white disabled:opacity-25"
            style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
}
