// Writes audio-manifest.json: every sound the game can ask for, as { id, text }.
// The mp3 for an entry belongs at public/audio/<id>.mp3.
// Run with: npm run audio:manifest
import { writeFileSync } from 'node:fs';
import { WORDS } from '../src/core/wordbank';

const entries: { id: string; text: string }[] = WORDS.map(w => ({ id: w.id, text: w.en }));

writeFileSync('audio-manifest.json', JSON.stringify(entries, null, 2) + '\n');
console.log(`audio-manifest.json: ${entries.length} entries`);
