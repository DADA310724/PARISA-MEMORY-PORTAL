import { useRef, useState } from "react";
import { Loader2, Upload, X } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { uploadFiles, copyFromDrive } from "@/lib/drive";
import { api } from "@/lib/api";

interface UploadDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  folderId: string;
  onDone?: () => void;
}

export function UploadDialog({ open, onOpenChange, folderId, onDone }: UploadDialogProps) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [driveLink, setDriveLink] = useState("");
  const [busy, setBusy] = useState(false);

  function pick() { fileRef.current?.click(); }
  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const list = e.target.files;
    if (!list) return;
    setFiles((prev) => [...prev, ...Array.from(list)]);
  }
  function removeAt(i: number) {
    setFiles((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function ensureOAuth(): Promise<boolean> {
    const status = await api<{ connected: boolean }>("/oauth/status");
    if (status.connected) return true;
    const r = await api<{ url: string }>("/oauth/url");
    toast({ title: "Connect Google Drive", description: "একটি নতুন ট্যাবে Google sign-in খুলছি।" });
    window.open(r.url, "_blank", "width=520,height=620");
    return false;
  }

  async function doUpload() {
    if (files.length === 0) { toast({ title: "কোন ফাইল নেই", variant: "destructive" }); return; }
    setBusy(true);
    try {
      if (!(await ensureOAuth())) return;
      const r = await uploadFiles(folderId, files);
      const errors = (r.results as Array<{ error?: string }>).filter((x) => x.error);
      if (errors.length > 0) {
        toast({ title: "কিছু আপলোড ব্যর্থ", description: `${errors.length}/${r.results.length} failed`, variant: "destructive" });
      } else {
        toast({ title: "✅ আপলোড সম্পন্ন", description: `${r.results.length} ফাইল` });
      }
      setFiles([]);
      onDone?.();
      onOpenChange(false);
    } catch (e) {
      toast({ title: "Upload error", description: (e as Error).message, variant: "destructive" });
    } finally { setBusy(false); }
  }

  function extractDriveId(link: string): string | null {
    const m1 = link.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (m1) return m1[1]!;
    const m2 = link.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (m2) return m2[1]!;
    if (/^[a-zA-Z0-9_-]{20,}$/.test(link.trim())) return link.trim();
    return null;
  }

  async function doCopyDrive() {
    const id = extractDriveId(driveLink);
    if (!id) { toast({ title: "ভুল Drive লিংক", variant: "destructive" }); return; }
    setBusy(true);
    try {
      if (!(await ensureOAuth())) return;
      await copyFromDrive(id, folderId);
      toast({ title: "✅ Drive থেকে কপি সম্পন্ন" });
      setDriveLink("");
      onDone?.();
      onOpenChange(false);
    } catch (e) {
      toast({ title: "Copy error", description: (e as Error).message, variant: "destructive" });
    } finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload Files</DialogTitle>
          <DialogDescription>Local থেকে অথবা Google Drive লিংক দিয়ে এই folder এ যোগ করুন।</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Button variant="outline" className="w-full border-primary/40 text-primary" onClick={pick} data-testid="button-choose-files">
              <Upload className="w-4 h-4 mr-2" />ফাইল বাছাই করুন (multi)
            </Button>
            <input ref={fileRef} type="file" multiple hidden onChange={onPick} data-testid="input-files" />
            {files.length > 0 && (
              <ul className="mt-3 space-y-1.5 max-h-40 overflow-auto scrollbar-thin">
                {files.map((f, i) => (
                  <li key={i} className="flex items-center justify-between bg-muted/40 rounded-md px-2.5 py-1.5 text-xs">
                    <span className="truncate flex-1 mr-2">{f.name}</span>
                    <button onClick={() => removeAt(i)} className="text-muted-foreground hover:text-destructive">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="border-t border-border/40 pt-4">
            <label className="text-xs uppercase tracking-wider text-muted-foreground">অথবা Google Drive থেকে কপি</label>
            <div className="mt-2 flex gap-2">
              <Input placeholder="https://drive.google.com/file/d/..." value={driveLink}
                onChange={(e) => setDriveLink(e.target.value)} data-testid="input-drive-link" />
              <Button variant="secondary" onClick={doCopyDrive} disabled={busy} data-testid="button-copy-drive">Copy</Button>
            </div>
            <p className="mt-1.5 text-[11px] text-muted-foreground">এই Drive ফাইলটি public হতে হবে অথবা আপনার একই Google account এর হতে হবে।</p>
          </div>
          <p className="text-[11px] text-muted-foreground text-center">টার্গেট: {folderId.slice(0, 16)}...</p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={doUpload} disabled={busy || files.length === 0}
            className="bg-primary text-primary-foreground hover:bg-primary/90" data-testid="button-upload-confirm">
            {busy ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Uploading...</> : <>Upload {files.length || ""}</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
