import { useEffect, useState } from "react";
import { Loader2, Download, ExternalLink } from "lucide-react";
import {
  type DriveFile,
  isAudio,
  isHtml,
  isImage,
  isPdf,
  isText,
  isVideo,
  proxyUrl,
  streamUrl,
  fetchText,
} from "@/lib/drive";
import { Button } from "@/components/ui/button";

interface MediaViewerProps {
  file: DriveFile;
  className?: string;
}

export function MediaViewer({ file, className = "" }: MediaViewerProps) {
  const url = proxyUrl(file.id);

  if (isImage(file)) {
    return (
      <div className={`relative ${className}`}>
        <img
          src={url}
          alt={file.name}
          className="w-full h-full object-contain rounded-lg"
          loading="lazy"
          data-testid={`media-image-${file.id}`}
        />
      </div>
    );
  }

  if (isVideo(file)) {
    return (
      <video
        src={streamUrl(file.id)}
        controls
        playsInline
        preload="auto"
        className={`w-full max-h-[70vh] rounded-lg bg-black ${className}`}
        data-testid={`media-video-${file.id}`}
      />
    );
  }

  if (isAudio(file)) {
    return (
      <div className={`p-6 glass rounded-xl ${className}`}>
        <div className="text-sm font-medium text-foreground/85 mb-3">
          🎙️ {file.name}
        </div>
        <audio
          src={streamUrl(file.id)}
          controls
          preload="auto"
          className="w-full"
          data-testid={`media-audio-${file.id}`}
        />
      </div>
    );
  }

  if (isHtml(file)) return <HtmlViewer file={file} className={className} />;
  if (isText(file)) return <TextViewer file={file} className={className} />;
  if (isPdf(file)) {
    return (
      <iframe
        src={url}
        title={file.name}
        className={`w-full h-[80vh] rounded-lg bg-white ${className}`}
        data-testid={`media-pdf-${file.id}`}
      />
    );
  }

  return (
    <div className={`p-6 glass rounded-xl text-center ${className}`}>
      <p className="text-foreground/85 mb-3">{file.name}</p>
      <p className="text-xs text-muted-foreground mb-4">{file.mimeType}</p>
      <div className="flex gap-2 justify-center">
        <Button asChild size="sm" variant="outline">
          <a href={url} download>
            <Download className="w-4 h-4 mr-1" /> Download
          </a>
        </Button>
        {file.webViewLink && (
          <Button asChild size="sm" variant="outline">
            <a href={file.webViewLink} target="_blank" rel="noreferrer">
              <ExternalLink className="w-4 h-4 mr-1" /> Open in Drive
            </a>
          </Button>
        )}
      </div>
    </div>
  );
}

function TextViewer({ file, className }: { file: DriveFile; className: string }) {
  const [text, setText] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    fetchText(file.id).then(setText).catch((e) => setErr(String(e)));
  }, [file.id]);
  if (err) return <p className="text-destructive p-4">{err}</p>;
  if (text === null)
    return (
      <div className="p-4 flex items-center gap-2 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading...
      </div>
    );
  return (
    <pre
      className={`whitespace-pre-wrap break-words font-mono text-sm bg-card rounded-lg p-4 max-h-[70vh] overflow-auto scrollbar-thin ${className}`}
      data-testid={`media-text-${file.id}`}
    >
      {text}
    </pre>
  );
}

function HtmlViewer({ file, className }: { file: DriveFile; className: string }) {
  const [html, setHtml] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetchText(file.id).then(setHtml).catch((e) => setErr(String(e)));
  }, [file.id]);

  if (err) return <p className="text-destructive p-4">{err}</p>;
  if (html === null)
    return (
      <div className="p-4 flex items-center gap-2 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" /> Rendering...
      </div>
    );

  return (
    <iframe
      title={file.name}
      sandbox="allow-same-origin allow-popups allow-scripts allow-forms"
      srcDoc={html}
      className={`w-full h-[80vh] bg-white rounded-lg border border-border ${className}`}
      data-testid={`media-html-${file.id}`}
    />
  );
}
