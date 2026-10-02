export function readProfile(storage) {
  try {
    const value=JSON.parse(storage.getItem('sun-stone-profile-v1')||'{}');
    return {best:Math.max(0,Number(value.best)||0),wins:Math.max(0,Number(value.wins)||0),games:Math.max(0,Number(value.games)||0),style:value.style==='amber'?'amber':'jade'};
  } catch{return {best:0,wins:0,games:0,style:'jade'};}
}
export function saveProfile(storage,profile) {try{storage.setItem('sun-stone-profile-v1',JSON.stringify(profile));return true;}catch{return false;}}
