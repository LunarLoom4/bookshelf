/**
 * LANGUAGES - comprehensive list for the book language selector.
 * Order: International first, then Indian Languages, then Other.
 */
export interface Language {
  code: string;
  label: string;
}

export const LANGUAGES: Language[] = [
  { code: "__sep_intl",   label: "** International **" },
  { code: "en",    label: "English" },
  { code: "zh",    label: "Chinese (中文)" },
  { code: "es",    label: "Spanish (Español)" },
  { code: "ar",    label: "Arabic (العربية)" },
  { code: "fr",    label: "French (Français)" },
  { code: "pt",    label: "Portuguese (Português)" },
  { code: "ru",    label: "Russian (Русский)" },
  { code: "de",    label: "German (Deutsch)" },
  { code: "ja",    label: "Japanese (日本語)" },
  { code: "ko",    label: "Korean (한국어)" },
  { code: "it",    label: "Italian (Italiano)" },
  { code: "tr",    label: "Turkish (Türkçe)" },
  { code: "fa",    label: "Persian (فارسی)" },
  { code: "vi",    label: "Vietnamese (Tiếng Việt)" },
  { code: "th",    label: "Thai (ภาษาไทย)" },
  { code: "sw",    label: "Swahili (Kiswahili)" },
  { code: "id",    label: "Indonesian" },
  { code: "nl",    label: "Dutch (Nederlands)" },
  { code: "pl",    label: "Polish (Polski)" },
  { code: "__sep_indian", label: "** Indian Languages **" },
  { code: "hi",    label: "Hindi (हिन्दी)" },
  { code: "bn",    label: "Bengali (বাংলা)" },
  { code: "te",    label: "Telugu (తెలుగు)" },
  { code: "mr",    label: "Marathi (मराठी)" },
  { code: "ta",    label: "Tamil (தமிழ்)" },
  { code: "ur",    label: "Urdu (اردو)" },
  { code: "gu",    label: "Gujarati (ગુજરાતી)" },
  { code: "kn",    label: "Kannada (ಕನ್ನಡ)" },
  { code: "ml",    label: "Malayalam (മലയാളം)" },
  { code: "pa",    label: "Punjabi (ਪੰਜਾਬੀ)" },
  { code: "or",    label: "Odia (ଓଡ଼ିଆ)" },
  { code: "as",    label: "Assamese (অসমীয়া)" },
  { code: "mai",   label: "Maithili (मैथिली)" },
  { code: "sa",    label: "Sanskrit (संस्कृतम्)" },
  { code: "ks",    label: "Kashmiri" },
  { code: "ne",    label: "Nepali (नेपाली)" },
  { code: "sd",    label: "Sindhi (سنڌي)" },
  { code: "kok",   label: "Konkani (कोंकणी)" },
  { code: "mni",   label: "Meitei / Manipuri" },
  { code: "sat",   label: "Santali" },
  { code: "doi",   label: "Dogri (डोगरी)" },
  { code: "brx",   label: "Bodo" },
  { code: "__sep_other",  label: "---" },
  { code: "other",  label: "Other - type below" },
];

export const isSeparator = (code: string) => code.startsWith("__sep");
