import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const destination=new URL('../public/assets/characters/player.glb',import.meta.url);
const expected='45daed454a97e8207ad5f626c2204edd031fbdfa';
const bytes=await readFile(destination).catch(()=>{throw new Error('Missing vendored character: restore public/assets/characters/player.glb from Git.');});
const actual=createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex');
if(actual!==expected)throw new Error('Character asset integrity check failed; update the documented provenance and hash for intentional asset changes.');
console.log('Vendored character asset verified; no network download required.');
