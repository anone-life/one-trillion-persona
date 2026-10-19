/** Main-site surface reuses this UI, but account transcripts never enter the anonymous library. */
export const mainSite = () => typeof location !== 'undefined' && location.pathname.replace(/\/$/, '') === '/encounters';

let owner = '';
export const accountOwner = () => owner;
export const setAccountOwner = (id: string) => { owner = id; };
