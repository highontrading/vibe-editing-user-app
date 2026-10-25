"use client";
import * as React from "react";
import { Upload } from "lucide-react";
import { ACCEPTED_MEDIA, filesFromDrop } from "@/lib/upload";
import { cn } from "@/lib/utils";

/** Wraps children in a drag-and-drop target; calls onFiles with media files (folders are walked). */
export function Dropzone({ onFiles, children, className, activeClassName, disabled, overlay = true }: { onFiles: (files: File[]) => void; children: React.ReactNode; className?: string; activeClassName?: string; disabled?: boolean; overlay?: boolean }) {
  const [over, setOver] = React.useState(false);
  const depth = React.useRef(0);
  return (
    <div
      className={cn("relative", className, over && activeClassName)}
      onDragEnter={(e) => {
        if (disabled) return;
        e.preventDefault();
        depth.current++;
        setOver(true);
      }}
      onDragOver={(e) => {
        if (disabled) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      }}
      onDragLeave={(e) => {
        if (disabled) return;
        e.preventDefault();
        depth.current = Math.max(0, depth.current - 1);
        if (depth.current === 0) setOver(false);
      }}
      onDrop={async (e) => {
        if (disabled) return;
        e.preventDefault();
        depth.current = 0;
        setOver(false);
        const files = await filesFromDrop(e.dataTransfer);
        if (files.length) onFiles(files);
      }}
    >
      {children}
      {overlay && over && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-[inherit] border-2 border-dashed border-accent/70 bg-accent/10 backdrop-blur-[2px]">
          <div className="flex items-center gap-2 rounded-full bg-bg/90 px-4 py-2 text-sm font-medium">
            <Upload className="h-4 w-4 text-accent" /> Drop to upload
          </div>
        </div>
      )}
    </div>
  );
}

/** Hidden file input + trigger. */
export function FilePicker({ onFiles, children, multiple = true, accept = ACCEPTED_MEDIA, className, directory }: { onFiles: (files: File[]) => void; children: React.ReactNode; multiple?: boolean; accept?: string; className?: string; directory?: boolean }) {
  const ref = React.useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={ref}
        type="file"
        className="hidden"
        multiple={multiple}
        accept={accept}
        // @ts-expect-error non-standard attribute
        webkitdirectory={directory ? "" : undefined}
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length) onFiles(files);
          e.target.value = "";
        }}
      />
      <button type="button" className={className} onClick={() => ref.current?.click()}>
        {children}
      </button>
    </>
  );
}
