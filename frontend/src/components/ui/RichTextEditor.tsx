/**
 * RichTextEditor -- contenteditable rich text editor.
 * Fixes over v1:
 *  - focus-before-command so lists actually render
 *  - inline link popup (no window.prompt) that doesn't close parent modal
 *  - images inserted as thumbnails (120x80 max) not full-size
 *  - vertically resizable editor area
 *  - imperative clear() via ref
 *  - Shift+Enter = <br> inside list items for soft-wrap
 */
import { useRef, useState, useImperativeHandle, forwardRef } from "react";
import {
  Bold, Italic, Underline, List, ListOrdered, Link2, ImagePlus, X, Check,
} from "lucide-react";

export interface RichTextEditorRef {
  clear: () => void;
}

interface Props {
  placeholder?: string;
  onHtmlChange: (html: string) => void;
  minHeight?: number;
  maxHeight?: number;
}

const BTN = "p-1.5 rounded text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-ink-700 dark:hover:text-gray-100 transition-colors";
const BTN_ACTIVE = "p-1.5 rounded bg-gray-200 dark:bg-gray-600 text-ink-700 dark:text-gray-100";

export const RichTextEditor = forwardRef<RichTextEditorRef, Props>(
  function RichTextEditor(
    { placeholder = "Write your message here...", onHtmlChange, minHeight = 180, maxHeight = 280 },
    ref,
  ) {
    const editorRef = useRef<HTMLDivElement>(null);
    const [linkOpen, setLinkOpen] = useState(false);
    const [linkText, setLinkText] = useState("");
    const [linkUrl, setLinkUrl] = useState("https://");
    const savedSelRef = useRef<Range | null>(null);

    useImperativeHandle(ref, () => ({
      clear() {
        if (editorRef.current) editorRef.current.innerHTML = "";
        onHtmlChange("");
      },
    }));

    const sync = () => onHtmlChange(editorRef.current?.innerHTML ?? "");

    const focusEditor = () => editorRef.current?.focus();

    // Focus first, then execCommand -- critical for list commands
    const exec = (cmd: string, value?: string) => {
      focusEditor();
      document.execCommand(cmd, false, value ?? undefined);
      sync();
    };

    const isActive = (cmd: string) => {
      try { return document.queryCommandState(cmd); } catch { return false; }
    };

    // Save selection before opening link popup (focus will move to input)
    const openLinkPopup = () => {
      focusEditor();
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        savedSelRef.current = sel.getRangeAt(0).cloneRange();
        // Pre-fill text from selection
        setLinkText(sel.toString());
      }
      setLinkUrl("https://");
      setLinkOpen(true);
    };

    const insertLink = () => {
      if (!linkUrl.trim() || linkUrl === "https://") return;
      focusEditor();
      // Restore saved selection
      const sel = window.getSelection();
      if (savedSelRef.current && sel) {
        sel.removeAllRanges();
        sel.addRange(savedSelRef.current);
      }
      // If there's selected text, wrap it; otherwise insert new text node
      if (linkText.trim() && sel && sel.toString() === "") {
        // No selection -- insert link with provided text
        const a = document.createElement("a");
        a.href = linkUrl;
        a.textContent = linkText || linkUrl;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.style.color = "#3b6ef4";
        if (savedSelRef.current) {
          savedSelRef.current.insertNode(a);
          savedSelRef.current.collapse(false);
          if (sel) { sel.removeAllRanges(); sel.addRange(savedSelRef.current); }
        }
      } else {
        // Selection exists -- wrap it
        document.execCommand("createLink", false, linkUrl);
        // Also set target=_blank on the newly created link
        const links = editorRef.current?.querySelectorAll("a") ?? [];
        links.forEach(a => { a.target = "_blank"; a.rel = "noopener noreferrer"; a.style.color = "#3b6ef4"; });
      }
      setLinkOpen(false);
      setLinkText("");
      setLinkUrl("https://");
      sync();
    };

    const insertImage = () => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.onchange = () => {
        const file = input.files?.[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) { alert("Image must be under 2 MB"); return; }
        const reader = new FileReader();
        reader.onload = () => {
          focusEditor();
          // Insert as a thumbnail img with constrained dimensions
          const img = document.createElement("img");
          img.src = reader.result as string;
          img.alt = file.name;
          img.style.cssText = "max-width:120px;max-height:80px;border-radius:4px;margin:2px 4px 2px 0;vertical-align:middle;cursor:pointer;";
          img.title = "Click to see full size";
          img.onclick = () => window.open(img.src, "_blank");
          const sel = window.getSelection();
          if (sel && sel.rangeCount > 0) {
            const range = sel.getRangeAt(0);
            range.deleteContents();
            range.insertNode(img);
            range.collapse(false);
          } else {
            editorRef.current?.appendChild(img);
          }
          sync();
        };
        reader.readAsDataURL(file);
      };
      input.click();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      // Shift+Enter inside a list = <br> soft wrap instead of new list item
      if (e.key === "Enter" && e.shiftKey) {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
          // Check if we're inside a list
          let node: Node | null = sel.getRangeAt(0).commonAncestorContainer;
          while (node && node !== editorRef.current) {
            if ((node as Element).tagName === "LI") {
              e.preventDefault();
              document.execCommand("insertHTML", false, "<br>");
              sync();
              return;
            }
            node = node.parentNode;
          }
        }
      }
    };

    return (
      <div className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 flex-wrap">
          <button type="button" title="Bold (Ctrl+B)" onClick={() => exec("bold")} className={isActive("bold") ? BTN_ACTIVE : BTN}>
            <Bold className="w-3.5 h-3.5" />
          </button>
          <button type="button" title="Italic (Ctrl+I)" onClick={() => exec("italic")} className={isActive("italic") ? BTN_ACTIVE : BTN}>
            <Italic className="w-3.5 h-3.5" />
          </button>
          <button type="button" title="Underline (Ctrl+U)" onClick={() => exec("underline")} className={isActive("underline") ? BTN_ACTIVE : BTN}>
            <Underline className="w-3.5 h-3.5" />
          </button>
          <div className="w-px h-4 bg-gray-300 dark:bg-gray-600 mx-1" />
          <button type="button" title="Bullet list" onClick={() => exec("insertUnorderedList")} className={isActive("insertUnorderedList") ? BTN_ACTIVE : BTN}>
            <List className="w-3.5 h-3.5" />
          </button>
          <button type="button" title="Numbered list" onClick={() => exec("insertOrderedList")} className={isActive("insertOrderedList") ? BTN_ACTIVE : BTN}>
            <ListOrdered className="w-3.5 h-3.5" />
          </button>
          <div className="w-px h-4 bg-gray-300 dark:bg-gray-600 mx-1" />
          <button type="button" title="Insert link" onClick={openLinkPopup} className={BTN}>
            <Link2 className="w-3.5 h-3.5" />
          </button>
          <button type="button" title="Attach image as thumbnail (max 2 MB)" onClick={insertImage} className={BTN}>
            <ImagePlus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Inline link popup -- renders inside the editor wrapper, stopPropagation so outer modal stays open */}
        {linkOpen && (
          <div
            className="border-b border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2.5 flex flex-col gap-2"
            onClick={e => e.stopPropagation()}
          >
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Insert Link</p>
            <input
              type="text"
              placeholder="Display text (optional)"
              value={linkText}
              onChange={e => setLinkText(e.target.value)}
              className="input text-sm py-1.5"
              autoFocus
            />
            <input
              type="url"
              placeholder="https://example.com"
              value={linkUrl}
              onChange={e => setLinkUrl(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); insertLink(); } }}
              className="input text-sm py-1.5"
            />
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => { setLinkOpen(false); setLinkText(""); setLinkUrl("https://"); }}
                className="flex items-center gap-1 px-2.5 py-1 text-xs rounded border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <X className="w-3 h-3" /> Cancel
              </button>
              <button
                type="button"
                onClick={insertLink}
                disabled={!linkUrl.trim() || linkUrl === "https://"}
                className="flex items-center gap-1 px-2.5 py-1 text-xs rounded bg-ink-700 dark:bg-indigo-600 text-white hover:bg-ink-800 dark:hover:bg-indigo-700 transition-colors disabled:opacity-40"
              >
                <Check className="w-3 h-3" /> Insert Link
              </button>
            </div>
          </div>
        )}

        {/* Editable area -- vertically resizable */}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={sync}
          onKeyDown={handleKeyDown}
          data-placeholder={placeholder}
          className="px-3 py-2.5 text-sm text-ink-900 dark:text-gray-100 outline-none overflow-y-auto
                     [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5
                     [&_a]:text-blue-600 [&_a]:underline
                     empty:before:content-[attr(data-placeholder)]
                     empty:before:text-gray-400 dark:empty:before:text-gray-500
                     empty:before:pointer-events-none"
          style={{ minHeight, maxHeight, resize: "vertical" }}
        />
      </div>
    );
  }
);
