import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const destination=new URL('../public/assets/characters/player.glb',import.meta.url);
const expected='45daed454a97e8207ad5f626c2204edd031fbdfa';
const blobHash=bytes=>createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex');
let existing;
try {existing=await readFile(destination);} catch {}
if(!existing || blobHash(existing)!==expected) {
  const response=await fetch('https://raw.githubusercontent.com/badbuny126-png/-poca-tok-2026/dec2736cf50d2dd8608ecca3a6d431b1b1d68f9d/public/models/player.glb',{signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw new Error('Character download failed: '+response.status);
  const bytes=Buffer.from(await response.arrayBuffer());
  if(blobHash(bytes)!==expected)throw new Error('Character asset integrity check failed');
  await mkdir(new URL('../public/assets/characters/',import.meta.url),{recursive:true});
  await writeFile(destination,bytes);
}
console.log('Character asset verified; served locally with the game.');
