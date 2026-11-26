/**
 * Hebrew interface text.
 *
 * The wording started from the table in Plan.md. On 26 November 2026 the owner
 * asked for text that suits girls and boys alike, so the lines that addressed
 * the player in the masculine were reworded here; Plan.md still shows the
 * original wording. Keep new text free of gendered verb forms.
 */
export const COPY = {
  whoTitle: 'מי משחק/ת?',
  newPlayer: 'פרופיל חדש',
  name: 'שם',
  grade: 'כיתה',
  grades: { 3: "ג'", 4: "ד'", 5: "ה'", 6: "ו'" },
  start: 'מתחילים!',
  games: {
    'letter-balloons': 'בלוני אותיות',
    'listen-catch': 'מקשיבים ותופסים',
    'word-object': 'מילה ואובייקט',
  },
  difficulty: { easy: 'קל', medium: 'בינוני', hard: 'קשה' },
  modeWordToPicture: 'מילה ← תמונה',
  modePictureToWord: 'תמונה ← מילה',
  summaryTitle: 'כל הכבוד!',
  practiseWords: 'מילים לתרגול',
  playAgain: 'עוד סבב',
  backHome: 'חזרה לאזור המשחקים',
  areaEnglish: 'אנגלית',
  areaMath: 'חשבון',
  knownWords: 'מילים שלמדתי',
} as const;
