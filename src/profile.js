export function readProfile(storage) {
  try {
    const value=JSON.parse(storage.getItem('sun-stone-profile-v1')||'{}');
    const count=number=>Number.isFinite(Number(number))?Math.max(0,Math.floor(Number(number))):0;
    return {best:count(value.best),wins:count(value.wins),games:count(value.games),style:value.style==='amber'?'amber':'jade'};
  } catch{return {best:0,wins:0,games:0,style:'jade'};}
}
export function saveProfile(storage,profile) {try{storage.setItem('sun-stone-profile-v1',JSON.stringify(profile));return true;}catch{return false;}}
