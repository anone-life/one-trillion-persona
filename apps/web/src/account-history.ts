import { mainSite, setAccountOwner, accountOwner } from './site-mode.ts';
import { saveCharacter, type SavedCharacter } from './store.ts';
import { RARE_NAMES } from './rare/names.ts';
import { lang } from './i18n.ts';
export const siteText = (zh: string, ja: string, en: string) => ({ zh, ja, en })[lang()];
const KEY = 'anone.encounter-return';
const TICKET = 'anone.encounter-transfer';
interface RemoteConversation { rareId: string; lang: 'en'|'zh'|'ja'; turns: SavedCharacter['chat']; version: number }

export async function loadAccountHistory(): Promise<void> {
  const res = await fetch('/v1/1t/rare/history', { cache: 'no-store' });
  if (res.status === 401) { sessionStorage.setItem(KEY, '/encounters' + location.search + location.hash); location.replace('/login'); throw new Error('sign_in_required'); }
  if (!res.ok) throw new Error('Could not load conversation history. Reload to retry.');
  const body = await res.json() as { accountId: string; conversations: RemoteConversation[] };
  if (accountOwner() && accountOwner() !== body.accountId) { location.reload(); throw new Error('sign_in_required'); }
  setAccountOwner(body.accountId);
  for (const c of body.conversations) {
    const name = RARE_NAMES[c.rareId]?.[c.lang] ?? c.rareId;
    saveCharacter({ id: `rare-${c.rareId}-${c.lang}`, rareId: c.rareId, lang: c.lang, name, tagline: '',
      age: 18, location: '', relationToUser: '', persona: '', schedule: {}, skeleton: null, createdAt: '', chat: c.turns, serverVersion: c.version });
  }
}

export async function initAccountHistory(): Promise<boolean> {
  if (!mainSite()) return true;
  document.getElementById('app')!.textContent = siteText('正在读取账号记录…','履歴を読み込んでいます…','Loading your conversations…');
  const query = new URLSearchParams(location.search);
  const fragment = new URLSearchParams(location.hash.slice(1));
  const ticket = fragment.get('transfer');
  if (ticket && /^[a-f0-9]{64}$/.test(ticket)) {
    sessionStorage.setItem(TICKET, ticket);
    history.replaceState(null, '', location.pathname + location.search);
  }
  try {
    // Authenticate before claiming; login redirects back here, including OAuth.
    await loadAccountHistory();
    const token = sessionStorage.getItem(TICKET);
    if (token) {
      const res = await fetch('/v1/1t/rare/claim', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token }) });
      if (!res.ok) {
        const b = await res.json();
        throw new Error(b.error === 'source_owned_by_another_account'
          ? siteText('这份记录已属于另一个账号。请切换到原账号后重试。', 'この履歴は別のアカウントに属しています。元のアカウントで再試行してください。', 'This history belongs to another account. Sign in to that account and retry.')
          : siteText('迁移未完成；本地原记录仍保留。请返回试用页重试。', '移行は未完了です。元の履歴は残っています。試用ページから再試行してください。', 'Transfer did not finish. Your original history is safe. Return to the trial and retry.'));
      }
      sessionStorage.removeItem(TICKET);
      await loadAccountHistory();
    }
    sessionStorage.removeItem(KEY);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') return;
      void fetch('/v1/1t/rare/history', { cache: 'no-store' }).then(async res => {
        if (res.status === 401 || (res.ok && (await res.json()).accountId !== accountOwner())) location.reload();
      }).catch(() => undefined);
    });
    const rare = query.get('rare');
    if (rare && /^\d{1,4}$/.test(rare) && !location.hash) history.replaceState(null, '', location.pathname + `#/open/${rare}`);
    return true;
  } catch (e) {
    if ((e as Error).message === 'sign_in_required') return false;
    const root = document.getElementById('app')!;
    const msg = document.createElement('p'); msg.textContent = (e as Error).message;
    const retry = document.createElement('button'); retry.textContent = siteText('重试','再試行','Retry'); retry.onclick = () => location.reload();
    const back = document.createElement('a'); back.href = '/?pick=1'; back.textContent = siteText('返回主站','メインに戻る','Main site');
    const login = document.createElement('a'); login.href = '/login'; login.textContent = siteText('切换账号','アカウントを切り替える','Switch account');
    root.replaceChildren(msg,retry,back,login); return false;
  }
}
