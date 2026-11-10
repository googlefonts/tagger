// Sample text per script, keyed by the subset names in the family metadata.
// Pangrams where a well-known one exists, else the first line of the Universal
// Declaration of Human Rights in a language of that script.

export const LATIN_PANGRAM = "The quick brown fox jumps over the lazy dog.";

export const PANGRAMS: Record<string, string> = {
  latin: LATIN_PANGRAM,
  vietnamese: "Tôi có thể ăn thủy tinh mà không hại gì.",
  cyrillic: "Съешь же ещё этих мягких французских булок, да выпей чаю.",
  greek: "Ξεσκεπάζω την ψυχοφθόρα βδελυγμία.",
  armenian: "Բել դղյակի ձախ ժամն օֆ ազգությանը ցպահանջ չճշտած վնաս էր և փառք։",
  georgian: "ყველა ადამიანი იბადება თავისუფალი და თანასწორი თავისი ღირსებითა და უფლებებით.",
  hebrew: "דג סקרן שט בים מאוכזב ולפתע מצא חברה.",
  arabic: "نص حكيم له سر قاطع وذو شأن عظيم مكتوب على ثوب أخضر ومغلف بجلد أزرق.",
  syriac: "ܟܠ ܒܪܢܫܐ ܒܪܝܠܗ ܚܐܪܐ ܘܒܪܒܪ ܓܘ ܐܝܩܪܐ ܘܙܕܩ̈ܐ.",
  thaana: "ހުރިހާ އިންސާނުން ވެސް އުފަންވަނީ މިނިވަންކަމާއި ހަމަހަމަކަން ލިބިގެންވާ ބައެއްގެ ގޮތުގައެވެ.",
  ethiopic: "የሰው ልጅ ሁሉ ሲወለድ ነጻና በክብርና በመብትም እኩልነት ያለው ነው።",
  devanagari: "सभी मनुष्यों को गौरव और अधिकारों के मामले में जन्मजात स्वतन्त्रता और समानता प्राप्त है।",
  bengali: "সমস্ত মানুষ স্বাধীনভাবে সমান মর্যাদা এবং অধিকার নিয়ে জন্মগ্রহণ করে।",
  gurmukhi: "ਸਾਰਾ ਮਨੁੱਖੀ ਪਰਿਵਾਰ ਆਪਣੀ ਮਹਿਮਾ, ਸ਼ਾਨ ਅਤੇ ਹੱਕਾਂ ਦੇ ਪੱਖੋਂ ਜਨਮ ਤੋਂ ਹੀ ਆਜ਼ਾਦ ਹੈ।",
  gujarati: "પ્રતિષ્ઠા અને અધિકારોની દૃષ્ટિએ સર્વ માનવો જન્મથી સ્વતંત્ર અને સમાન હોય છે.",
  oriya: "ସବୁ ମଣିଷ ଜନ୍ମରୁ ସ୍ୱାଧୀନ ଓ ସମ୍ମାନ ଏବଂ ଅଧିକାରରେ ସମାନ।",
  tamil: "மனிதப் பிறவியினர் சகலரும் சுதந்திரமாகவே பிறக்கின்றனர்.",
  telugu: "ప్రతిపత్తిస్వత్వముల విషయమున మానవులెల్లరును జన్మతః స్వతంత్రులును సమానులును నగుదురు.",
  kannada: "ಎಲ್ಲಾ ಮಾನವರೂ ಸ್ವತಂತ್ರರಾಗಿಯೇ ಜನಿಸಿದ್ದಾರೆ, ಹಾಗೂ ಘನತೆ ಮತ್ತು ಹಕ್ಕುಗಳಲ್ಲಿ ಸಮಾನರಾಗಿದ್ದಾರೆ.",
  malayalam: "മനുഷ്യരെല്ലാവരും തുല്യാവകാശങ്ങളോടും അന്തസ്സോടും സ്വാതന്ത്ര്യത്തോടുംകൂടി ജനിച്ചവരാണ്.",
  sinhala: "සියලු මනුෂ්‍යයෝ නිදහස්ව උපත ලබා ඇත. ගරුත්වයෙන් හා අයිතිවාසිකම්වලින් සමාන වෙති.",
  thai: "มนุษย์ทั้งหลายเกิดมามีอิสระและเสมอภาคกันในเกียรติศักดิ์และสิทธิ",
  lao: "ມະນຸດທຸກຄົນເກີດມາມີສິດເສລີພາບ ແລະ ສະເໝີໜ້າກັນໃນທາງກຽດຕິສັກ ແລະ ທາງສິດດ້ວຍ",
  khmer: "មនុស្សទាំងអស់ កើតមកមានសេរីភាព និងសមភាព ក្នុងផ្នែកសេចក្ដីថ្លៃថ្នូរនិងសិទ្ធិ។",
  myanmar: "လူတိုင်းသည် တူညီ လွတ်လပ်သော ဂုဏ်သိက္ခာဖြင့် လည်းကောင်း၊ တူညီလွတ်လပ်သော အခွင့်အရေးများဖြင့် လည်းကောင်း မွေးဖွားလာသူများ ဖြစ်သည်။",
  tibetan: "འགྲོ་བ་མིའི་རིགས་རྒྱུད་ཡོངས་ལ་སྐྱེས་ཙམ་ཉིད་ནས་ཆེ་མཐོངས་དང་ཐོབ་ཐང་གི་རང་དབང་འདྲ་མཉམ་དུ་ཡོད།",
  japanese: "いろはにほへと ちりぬるを わかよたれそ つねならむ",
  korean: "키스의 고유조건은 입술끼리 만나야 하고 특별한 기술은 필요치 않다.",
  "chinese-simplified": "视野无限广，窗外有蓝天。",
  "chinese-traditional": "視野無限廣，窗外有藍天。",
  "chinese-hongkong": "視野無限廣，窗外有藍天。",
  cherokee: "ᏂᎦᏓ ᎠᏂᏴᏫ ᏂᎨᎫᏓᎸᎾ ᎠᎴ ᎤᏂᎶᏓ ᎤᏂᎸᏅᏓ.",
  "canadian-aboriginal": "ᐃᓄᒃᑎᑐᑦ ᑎᑎᕋᐅᓯᖅ",
};

export function hasPangram(script: string): boolean {
  return script in PANGRAMS;
}

// Latin first, then one sample per other script that has one. Scripts without a
// sample add nothing, so the result is never empty.
export function sampleTextFor(scripts: string[]): string {
  const parts = [LATIN_PANGRAM];
  for (const script of scripts) {
    if (script !== "latin" && hasPangram(script)) parts.push(PANGRAMS[script]);
  }
  return parts.join(" ");
}
