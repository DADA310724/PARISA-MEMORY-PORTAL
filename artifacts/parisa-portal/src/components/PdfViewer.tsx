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
  const containerRef = useRef<HTMLDivElement>(null);
  // Per-page refs — populated via callback refs in JSX (never reset manually)
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const textLayerRefs = useRef<(HTMLDivElement | null)[]>([]);
  const pageWrapperRefs = useRef<(HTMLDivElement | null)[]>([]);
  const renderTaskRefs = useRef<(pdfjsLib.RenderTask | null)[]>([]);

  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pageInput, setPageInput] = useState("1");
  const [rendered, setRendered] = useState(false);

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
    setRendered(false);
    // Clear old refs
    canvasRefs.current = [];
    textLayerRefs.current = [];
    pageWrapperRefs.current = [];
    renderTaskRefs.current = [];

    const task = pdfjsLib.getDocument({ url, withCredentials: false });
    task.promise
      .then((doc) => { setPdfDoc(doc); setTotalPages(doc.numPages); setLoading(false); })
      .catch((e) => { console.error("PDF load error", e); setError("PDF লোড হয়নি। আবার চেষ্টা করুন।"); setLoading(false); });
    return () => { task.destroy(); };
  }, [url]);

  /* ── Render one page onto its own canvas ── */
  const renderPageAt = useCallback(async (
    doc: pdfjsLib.PDFDocumentProxy,
    pageNum: number,
    query: string,
    activeMatchItems: MatchItem[],
    activeMatchIdx: number,
  ) => {
    const canvas = canvasRefs.current[pageNum - 1];
    const tlDiv = textLayerRefs.current[pageNum - 1];
    const wrapperDiv = pageWrapperRefs.current[pageNum - 1];
    if (!canvas || !wrapperDiv) return;

    // Cancel any previous render for this page
    if (renderTaskRefs.current[pageNum - 1]) {
      try { renderTaskRefs.current[pageNum - 1]!.cancel(); } catch {}
    }

    const page = await doc.getPage(pageNum);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const containerWidth = wrapperDiv.clientWidth || containerRef.current?.clientWidth || 360;
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
      renderTaskRefs.current[pageNum - 1] = page.render({ canvasContext: ctx, viewport, canvas });
      await renderTaskRefs.current[pageNum - 1]!.promise;
    } catch (e: unknown) {
      if ((e as { name?: string })?.name !== "RenderingCancelledException") console.error("Render error", e);
      return;
    }

    /* Text layer for search highlighting */
    if (!tlDiv) return;
    tlDiv.innerHTML = "";
    tlDiv.style.width = `${logicalW}px`;
    tlDiv.style.height = `${logicalH}px`;

    if (!query.trim()) return;

    const qLower = query.trim().toLowerCase();
    const textContent = await page.getTextContent();
    const items = textContent.items as Array<{ str: string; transform: number[]; width: number; height: number }>;
    const pageMatchIndices = new Set<number>();
    activeMatchItems.forEach((m) => { if (m.page === pageNum) pageMatchIndices.add(m.itemIdx); });

    items.forEach((item, idx) => {
      if (!item.str.trim()) return;
      const strLower = item.str.toLowerCase();
      const hasMatch = strLower.includes(qLower);
      const isActive =
        pageMatchIndices.has(idx) &&
        activeMatchItems[activeMatchIdx]?.page === pageNum &&
        activeMatchItems[activeMatchIdx]?.itemIdx === idx;

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

  /* ── After pages appear in DOM, render them all ── */
  useEffect(() => {
    if (!pdfDoc || totalPages === 0 || loading) return;

    const doRender = async () => {
      // Wait for React to commit the page DOM elements and populate refs
      await new Promise((r) => setTimeout(r, 80));
      for (let i = 1; i <= totalPages; i++) {
        await renderPageAt(pdfDoc, i, "", [], 0);
      }
      setRendered(true);
    };
    doRender();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfDoc, totalPages, loading]);

  /* ── Re-render pages that have search highlights ── */
  useEffect(() => {
    if (!pdfDoc || !rendered || matches.length === 0) return;
    const pagesToUpdate = new Set(matches.map((m) => m.page));
    pagesToUpdate.forEach(async (pageNum) => {
      await renderPageAt(pdfDoc, pageNum, searchQuery, matches, matchIdx);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches, matchIdx]);

  /* ── Track current page via IntersectionObserver ── */
  useEffect(() => {
    if (!rendered || totalPages === 0 || !containerRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        let maxRatio = 0;
        let visiblePage = -1;
        entries.forEach((entry) => {
          if (entry.intersectionRatio > maxRatio) {
            maxRatio = entry.intersectionRatio;
            const idx = pageWrapperRefs.current.indexOf(entry.target as HTMLDivElement);
            if (idx >= 0) visiblePage = idx + 1;
          }
        });
        if (visiblePage > 0) {
          setCurrentPage(visiblePage);
          setPageInput(String(visiblePage));
        }
      },
      { root: containerRef.current, threshold: [0.1, 0.3, 0.5, 1.0] },
    );
    pageWrapperRefs.current.forEach((el) => { if (el) observer.observe(el); });
    return () => observer.disconnect();
  }, [rendered, totalPages]);

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
    setTimeout(() => {
      pageWrapperRefs.current[found[0].page - 1]?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 200);
  }, [pdfDoc, searchQuery]);

  const goToMatch = (idx: number) => {
    if (idx < 0 || idx >= matches.length) return;
    setMatchIdx(idx);
    setTimeout(() => {
      pageWrapperRefs.current[matches[idx].page - 1]?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };

  const jumpToPage = () => {
    const n = parseInt(pageInput);
    if (n >= 1 && n <= totalPages) {
      setCurrentPage(n);
      pageWrapperRefs.current[n - 1]?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
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

        {/* Page counter + jump */}
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

      {/* ── Scrollable pages area ── */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto flex flex-col items-center py-3 gap-4"
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

        {/* All pages rendered vertically */}
        {!loading && !error && Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
          <div
            key={pageNum}
            ref={(el) => { pageWrapperRefs.current[pageNum - 1] = el; }}
            className="w-full max-w-3xl flex flex-col items-center px-2"
          >
            {/* Page label */}
            <div
              className="mb-1 self-end px-2 py-0.5 rounded text-[10px] font-mono"
              style={{ background: "rgba(0,0,0,0.35)", color: "rgba(255,255,255,0.3)" }}
            >
              {pageNum} / {totalPages}
            </div>
            {/* Canvas + text layer */}
            <div
              className="relative shadow-2xl w-full rounded"
              style={{ background: "#ffffff" }}
            >
              <canvas
                ref={(el) => { canvasRefs.current[pageNum - 1] = el; }}
                className="block w-full rounded"
              />
              <div
                ref={(el) => { textLayerRefs.current[pageNum - 1] = el; }}
                className="absolute inset-0 overflow-hidden rounded"
                style={{ userSelect: "none", pointerEvents: "none" }}
              />
            </div>
          </div>
        ))}

        {/* Loading spinner while pages are rendering */}
        {!loading && !error && !rendered && totalPages > 0 && (
          <div className="py-6 flex items-center gap-2">
            <div className="w-5 h-5 border-2 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin" />
            <p className="text-white/30 text-xs" style={{ fontFamily: "'Hind Siliguri',sans-serif" }}>
              পেজ রেন্ডার হচ্ছে...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
