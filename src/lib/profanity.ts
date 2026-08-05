// Shared profanity filter — used by comments create (route.ts) and comments
// edit (`[id]/route.ts`). Previously duplicated verbatim in both files; kept
// here so a change (adding a word, tuning normalize()) only has to happen once.

// ─── Normalize text before checking ──────────────────────────────────────────
// Collapses repeated chars, maps common leetspeak substitutions to base letters
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/(.)\1+/g, '$1')   // dedupe repeated chars (aaaa → a)
    .replace(/@/g,  'a')
    .replace(/0/g,  'o')
    .replace(/1/g,  'i')
    .replace(/3/g,  'e')
    .replace(/4/g,  'a')
    .replace(/5/g,  's')
    .replace(/\$/g, 's')
    .replace(/!/g,  'i')
    .replace(/\*/g, '')
    .replace(/\+/g, 't')
}

// ─── Hard block list (English only) ──────────────────────────────────────────
// All entries are already in their normalized form (post-leetspeak substitution).
// normalize() is applied to both the input AND each word before matching,
// so you don't need to add leetspeak variants here.
const HARD_BLOCK: string[] = [
  // Racial slurs
  'nigger', 'nigga', 'niggah', 'niga', 'nigah', 'niger','negro',
  'ngga', 'ngger', 'kneegga', 'negga',
  'chink', 'gook', 'spic', 'wetback',
  'beaner', 'kike', 'cracker', 'honky', 'coon',
  'porch monkey', 'jungle bunny', 'tar baby',
  'zipperhead', 'slant', 'slope',
  'towelhead', 'raghead', 'sand nigger', 'camel jockey',
  'redskin', 'injun', 'prairie nigger', 'halfbreed',
  'mulatto', 'sambo', 'pickaninny',
  'wog', 'golliwog', 'dago', 'guinea', 'greaser',
  'paddy', 'mick', 'kraut', 'hymie', 'jap', 'nip',

  // Homophobic / transphobic slurs
  'faggot', 'fagot', 'fag',
  'dyke', 'tranny', 'shemale', 'heshe', 'sodomite',

  // Ableist slurs
  'retard', 'retarded',
  'spastic', 'spaz',
  'mongoloid', 'cripple',

  // Misogynistic / sexual slurs
  'whore', 'slut', 'cunt', 'bitch', 'skank', 'thot',

  // Filipino / Tagalog
  'gago', 'gaga', 'bobo', 'tanga', 'ulol',
  'hudas', 'lintik', 'siraulo', 'gunggong', 'engot', 'inutil',
  'paksyet', 'pekpek', 'titi', 'jakol', 'kantot', 'kantotin',
  'salsal', 'pepe', 'etits', 'bayag', 'puke',

  // Bisaya / Cebuano
  'yuta', 'buang', 'boang', 'atay', 'piste', 'pisti',
  'bilat', 'boto', 'pisot',

  // Self-harm / violent threats (multi-word — matched via .includes())
  'kill yourself', 'kys', 'smd',
  'go kill yourself', 'kill urself',
  'go die', 'die already',
  'i will kill you', 'i will hurt you',
  'you should die', 'hope you die',
  'end your life', 'neck yourself',
  'rope yourself', 'drink bleach',
  'go hang yourself', 'slit your wrists',
]

// ─── Core check ───────────────────────────────────────────────────────────────
// Normalize both the input AND each blocked word before comparing.
// This catches all leetspeak / repeated-char bypasses in one pass.
export function isProfane(text: string): boolean {
  const normalizedInput = normalize(text)
  return HARD_BLOCK.some(word => normalizedInput.includes(normalize(word)))
}