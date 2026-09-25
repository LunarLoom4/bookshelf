/**
 * RichTextEditor -- lightweight contenteditable-based rich text editor.
 * Supports: bold, italic, underline, ordered/unordered lists, hyperlinks,
 * inline images (base64). No external dependencies.
 */
import { useRef } from "react";
import {
  Bold, Italic, Underline, List, ListOrdered, Link2, ImagePlus,
} from "lucide-react";

interface Props {
  placeholder?: string;
  onHtmlChange: (html: string) => void;
  minHeight?: number;
}

const BTN = "p-1.5 rounded text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-ink-700 dark:hover:text-gray-100 transition-colors";

export function RichTextEditor({ placeholder = "Write your message here...", onHtmlChange, minHeight = 200 }: Props) {
  const editorRef = useRef<HTMLDivElement>(null);

  const exec = (cmd: string, value?: string) => {
    document.execCommand(cmd, false, value);
    editorRef.current?.focus();
    sync();
  };

  const sync = () => {
    onHtmlChange(editorRef.current?.innerHTML ?? "");
  };

  const insertLink = () => {
    const url = window.prompt("Enter URL (include https://):", "https://");
    if (url) exec("createLink", url);
  };

  const insertImage = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) {
        alert("Image must be under 2 MB");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        exec("insertImage", reader.result as string);
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  return (
    <div className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 flex-wrap">
        <button type="button" title="Bold (Ctrl+B)" onClick={() => exec("bold")} className={BTN}>
          <Bold className="w-3.5 h-3.5" />
        </button>
        <button type="button" title="Italic (Ctrl+I)" onClick={() => exec("italic")} className={BTN}>
          <Italic className="w-3.5 h-3.5" />
        </button>
        <button type="button" title="Underline (Ctrl+U)" onClick={() => exec("underline")} className={BTN}>
          <Underline className="w-3.5 h-3.5" />
        </button>
        <div className="w-px h-4 bg-gray-300 dark:bg-gray-600 mx-1" />
        <button type="button" title="Bullet list" onClick={() => exec("insertUnorderedList")} className={BTN}>
          <List className="w-3.5 h-3.5" />
        </button>
        <button type="button" title="Numbered list" onClick={() => exec("insertOrderedList")} className={BTN}>
          <ListOrdered className="w-3.5 h-3.5" />
        </button>
        <div className="w-px h-4 bg-gray-300 dark:bg-gray-600 mx-1" />
        <button type="button" title="Insert link" onClick={insertLink} className={BTN}>
          <Link2 className="w-3.5 h-3.5" />
        </button>
        <button type="button" title="Attach image (max 2 MB)" onClick={insertImage} className={BTN}>
          <ImagePlus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Editable area */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={sync}
        data-placeholder={placeholder}
        className="px-3 py-2.5 text-sm text-ink-900 dark:text-gray-100 outline-none overflow-y-auto
                   prose prose-sm dark:prose-invert max-w-none
                   empty:before:content-[attr(data-placeholder)]
                   empty:before:text-gray-400 dark:empty:before:text-gray-500
                   empty:before:pointer-events-none"
        style={{ minHeight }}
      />
    </div>
  );
}
