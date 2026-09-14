/**
 * LanguagePicker — an elegant multi-select language picker popup.
 * Shows International / Indian / Custom tabs with search.
 */
import { useState, useRef, useEffect } from "react";
import { Search, X, Check, Globe, ChevronDown } from "lucide-react";

const INTERNATIONAL = [
  { code: "en", label: "English" },
  { code: "zh", label: "Chinese (中文)" },
  { code: "es", label: "Spanish (Español)" },
  { code: "ar", label: "Arabic (العربية)" },
  { code: "fr", label: "French (Français)" },
  { code: "pt", label: "Portuguese (Português)" },
  { code: "ru", label: "Russian (Русский)" },
  { code: "de", label: "German (Deutsch)" },
  { code: "ja", label: "Japanese (日本語)" },
  { code: "ko", label: "Korean (한국어)" },
  { code: "it", label: "Italian (Italiano)" },
  { code: "tr", label: "Turkish (Türkçe)" },
  { code: "fa", label: "Persian (فارسی)" },
  { code: "vi", label: "Vietnamese (Tiếng Việt)" },
  { code: "th", label: "Thai (ภาษาไทย)" },
  { code: "sw", label: "Swahili" },
  { code: "id", label: "Indonesian" },
  { code: "nl", label: "Dutch (Nederlands)" },
  { code: "pl", label: "Polish (Polski)" },
];

const INDIAN = [
  { code: "hi",  label: "Hindi (हिन्दी)" },
  { code: "bn",  label: "Bengali (বাংলা)" },
  { code: "te",  label: "Telugu (తెలుగు)" },
  { code: "mr",  label: "Marathi (मराठी)" },
  { code: "ta",  label: "Tamil (தமிழ்)" },
  { code: "ur",  label: "Urdu (اردو)" },
  { code: "gu",  label: "Gujarati (ગુજરાતી)" },
  { code: "kn",  label: "Kannada (ಕನ್ನಡ)" },
  { code: "ml",  label: "Malayalam (മലയാളം)" },
  { code: "pa",  label: "Punjabi (ਪੰਜਾਬੀ)" },
  { code: "or",  label: "Odia (ଓଡ଼ିଆ)" },
  { code: "as",  label: "Assamese (অসমীয়া)" },
  { code: "mai", label: "Maithili (मैथिली)" },
  { code: "sa",  label: "Sanskrit (संस्कृतम्)" },
  { code: "ks",  label: "Kashmiri" },
  { code: "ne",  label: "Nepali (नेपाली)" },
  { code: "sd",  label: "Sindhi" },
  { code: "kok", label: "Konkani (कोंकणी)" },
  { code: "mni", label: "Meitei / Manipuri" },
  { code: "sat", label: "Santali" },
  { code: "doi", label: "Dogri (डोगरी)" },
  { code: "brx", label: "Bodo" },
];

const ALL = [...INTERNATIONAL, ...INDIAN];

type Tab = "international" | "indian" | "custom";

interface Props {
  value: string;   // comma-separated codes, e.g. "en,hi"
  onChange: (value: string) => void;
}

export function LanguagePicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("international");
  const [search, setSearch] = useState("");
  const [customText, setCustomText] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const selected = value ? value.split(",").filter(Boolean) : [];

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggle = (code: string) => {
    const next = selected.includes(code)
      ? selected.filter(c => c !== code)
      : [...selected, code];
    onChange(next.join(","));
  };

  const addCustom = () => {
    const trimmed = customText.trim();
    if (!trimmed || selected.includes(trimmed)) return;
    onChange([...selected, trimmed].join(","));
    setCustomText("");
  };

  // Resolve display label for a code
  const labelFor = (code: string) =>
    ALL.find(l => l.code === code)?.label ?? code;

  // Filter list by search
  const filtered = (list: typeof INTERNATIONAL) =>
    search ? list.filter(l =>
      l.label.toLowerCase().includes(search.toLowerCase()) ||
      l.code.toLowerCase().includes(search.toLowerCase())
    ) : list;

  // Combined search across both lists
  const searchResults = search
    ? ALL.filter(l =>
        l.label.toLowerCase().includes(search.toLowerCase()) ||
        l.code.toLowerCase().includes(search.toLowerCase())
      )
    : null;

  const displayLabel = selected.length === 0
    ? "Select language(s)..."
    : selected.map(labelFor).join(", ");

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="input w-full flex items-center justify-between gap-2 text-left"
      >
        <span className={`flex-1 truncate ${selected.length === 0 ? "text-gray-400" : "text-ink-900"}`}>
          {displayLabel}
        </span>
        <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
      </button>

      {/* Popup */}
      {open && (
        <div className="absolute z-50 left-0 bottom-full mb-1 w-80 bg-white border border-paper-200 rounded-xl shadow-2xl overflow-hidden animate-in fade-in-0 slide-in-from-bottom-2 duration-150">
          {/* Search bar */}
          <div className="p-3 border-b border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-900">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              <input
                autoFocus
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search any language..."
                className="w-full pl-8 pr-8 py-1.5 text-sm border border-paper-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ink-300"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Tabs -- hidden during search */}
          {!search && (
            <div className="flex border-b border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-900">
              {(["international", "indian", "custom"] as Tab[]).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={`flex-1 py-2 text-xs font-medium capitalize transition-colors ${
                    tab === t
                      ? "text-ink-700 border-b-2 border-ink-600 bg-paper-50"
                      : "text-gray-400 hover:text-gray-600"
                  }`}
                >
                  {t === "international" ? "World" : t === "indian" ? "Indian" : "Custom"}
                </button>
              ))}
            </div>
          )}

          {/* Language list */}
          <div className="max-h-56 overflow-y-auto bg-white dark:bg-gray-900">
            {search ? (
              searchResults!.length === 0 ? (
                <p className="px-4 py-3 text-xs text-gray-400 text-center">No languages found for "{search}"</p>
              ) : (
                searchResults!.map(lang => (
                  <LanguageRow key={lang.code} lang={lang} selected={selected} onToggle={toggle} />
                ))
              )
            ) : tab === "international" ? (
              filtered(INTERNATIONAL).map(lang => (
                <LanguageRow key={lang.code} lang={lang} selected={selected} onToggle={toggle} />
              ))
            ) : tab === "indian" ? (
              filtered(INDIAN).map(lang => (
                <LanguageRow key={lang.code} lang={lang} selected={selected} onToggle={toggle} />
              ))
            ) : (
              <div className="p-3 flex gap-2">
                <input
                  type="text"
                  value={customText}
                  onChange={e => setCustomText(e.target.value.slice(0, 30))}
                  onKeyDown={e => e.key === "Enter" && addCustom()}
                  placeholder="Type language name..."
                  className="input flex-1 text-sm py-1"
                />
                <button
                  type="button"
                  onClick={addCustom}
                  className="btn-primary py-1 px-3 text-sm"
                >
                  Add
                </button>
              </div>
            )}
          </div>

          {/* Selected chips */}
          {selected.length > 0 && (
            <div className="p-3 border-t border-gray-100 dark:border-gray-700 flex flex-wrap gap-1.5 bg-white dark:bg-gray-900">
              {selected.map(code => (
                <span key={code} className="inline-flex items-center gap-1 px-2.5 py-1 bg-ink-100 dark:bg-ink-900/40 text-ink-700 dark:text-ink-300 text-xs font-medium rounded-full">
                  {labelFor(code)}
                  <button type="button" onClick={() => toggle(code)} className="hover:text-red-500">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Done button */}
          <div className="p-3 border-t border-gray-100 dark:border-gray-700 flex justify-end bg-white dark:bg-gray-900">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="btn-primary py-1 px-4 text-sm"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function LanguageRow({
  lang, selected, onToggle,
}: {
  lang: { code: string; label: string };
  selected: string[];
  onToggle: (code: string) => void;
}) {
  const isSelected = selected.includes(lang.code);
  return (
    <button
      type="button"
      onClick={() => onToggle(lang.code)}
      className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors ${
        isSelected
          ? "text-ink-700 dark:text-ink-300 font-medium bg-ink-50 dark:bg-ink-900/30"
          : "text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
      }`}
    >
      <span>{lang.label}</span>
      {isSelected && <Check className="w-4 h-4 text-ink-600 flex-shrink-0" />}
    </button>
  );
}
