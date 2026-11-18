// Sample text per script, keyed by the subset names in the family metadata.
// Two words at most per script, so Latin plus one script is four words at most.

export const LATIN_SAMPLE = "Hello world";

export const SAMPLES: Record<string, string> = {
  latin: LATIN_SAMPLE,
  vietnamese: "Xin chào",
  cyrillic: "Привет мир",
  greek: "Καλημέρα κόσμε",
  armenian: "Բարև աշխարհ",
  georgian: "გამარჯობა მსოფლიო",
  hebrew: "שלום עולם",
  arabic: "مرحبا بالعالم",
  syriac: "ܫܠܡܐ ܥܠܡܐ",
  ethiopic: "ሰላም ዓለም",
  devanagari: "नमस्ते दुनिया",
  bengali: "নমস্কার বিশ্ব",
  gurmukhi: "ਨਮਸਤੇ ਦੁਨੀਆ",
  gujarati: "નમસ્તે દુનિયા",
  oriya: "ନମସ୍କାର ଦୁନିଆ",
  tamil: "வணக்கம் உலகம்",
  telugu: "నమస్కారం ప్రపంచం",
  kannada: "ನಮಸ್ಕಾರ ಜಗತ್ತು",
  malayalam: "നമസ്കാരം ലോകം",
  sinhala: "ආයුබෝවන් ලෝකය",
  thai: "สวัสดี ชาวโลก",
  lao: "ສະບາຍດີ ໂລກ",
  khmer: "សួស្តី ពិភពលោក",
  myanmar: "မင်္ဂလာပါ ကမ္ဘာ",
  tibetan: "བཀྲ་ཤིས་བདེ་ལེགས།",
  japanese: "こんにちは 世界",
  korean: "안녕 세상",
  "chinese-simplified": "你好 世界",
  "chinese-traditional": "你好 世界",
  "chinese-hongkong": "你好 世界",
  cherokee: "ᎣᏏᏲ ᎡᎶᎯ",
  "canadian-aboriginal": "ᐊᐃ ᓄᓇ",
};

export function hasSample(script: string): boolean {
  return script in SAMPLES;
}

// Latin first, then the sample for each other script that has one. Scripts
// without a sample add nothing, so the result is never empty.
export function sampleTextFor(scripts: string[]): string {
  const parts = [LATIN_SAMPLE];
  for (const script of scripts) {
    if (script !== "latin" && hasSample(script)) parts.push(SAMPLES[script]);
  }
  return parts.join(" ");
}
