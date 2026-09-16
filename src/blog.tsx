import { createContext, useContext, useState } from 'react';
import type { ReactNode, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import initialPosts from '../content/posts.json';

export type Post = typeof initialPosts[number];
const POSTS_KEY = 'corner.posts.v1';
const PASSWORD_KEY = 'corner.password.v1';
type PasswordRecord = { salt: number[]; hash: number[] };

function readPosts(): Post[] {
  const saved = localStorage.getItem(POSTS_KEY);
  if (!saved) return initialPosts;
  const posts: unknown = JSON.parse(saved);
  if (!Array.isArray(posts) || !posts.every(p => p && ['slug', 'title', 'date', 'summary', 'body'].every(k => typeof p[k] === 'string'))) {
    throw new Error('Saved stories could not be read. Your stored data has not been changed.');
  }
  return posts;
}

async function passwordHash(password: string, salt: Uint8Array<ArrayBuffer>) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  return Array.from(new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 210000, hash: 'SHA-256' }, key, 256)));
}

function loadState() {
  try {
    const posts = readPosts();
    const raw = localStorage.getItem(PASSWORD_KEY);
    const password: PasswordRecord | null = raw ? JSON.parse(raw) : null;
    if (password && (!Array.isArray(password.salt) || password.salt.length !== 16 || !Array.isArray(password.hash) || password.hash.length !== 32)) throw new Error('The saved password could not be read.');
    return { posts, password, error: '' };
  } catch (error) {
    return { posts: initialPosts, password: null, error: error instanceof Error ? error.message : 'Browser storage is unavailable.' };
  }
}

type BlogState = {
  posts: Post[];
  loggedIn: boolean;
  hasPassword: boolean;
  storageError: string;
  login: (password: string) => Promise<void>;
  logout: () => void;
  save: (post: Post, originalSlug?: string) => void;
  remove: (slug: string) => void;
};
const BlogContext = createContext<BlogState | null>(null);
export function useBlog() { return useContext(BlogContext)!; }

export function BlogProvider({ children }: { children: ReactNode }) {
  const [initial] = useState(loadState);
  const [posts, setPosts] = useState(initial.posts);
  const [passwordRecord, setPasswordRecord] = useState(initial.password);
  const [loggedIn, setLoggedIn] = useState(false);

  async function login(password: string) {
    if (initial.error) throw new Error(initial.error);
    if (!passwordRecord && password.length < 8) throw new Error('Choose a password with at least 8 characters.');
    const salt = passwordRecord ? new Uint8Array(passwordRecord.salt) : crypto.getRandomValues(new Uint8Array(16));
    const hash = await passwordHash(password, salt);
    if (passwordRecord) {
      if (hash.some((byte, i) => byte !== passwordRecord.hash[i])) throw new Error('That password didn’t match. Try again.');
    } else {
      const record = { salt: Array.from(salt), hash };
      localStorage.setItem(PASSWORD_KEY, JSON.stringify(record));
      setPasswordRecord(record);
    }
    setLoggedIn(true);
  }

  function persist(next: Post[]) {
    if (!loggedIn) throw new Error('Please log in to change stories.');
    if (initial.error) throw new Error(initial.error);
    localStorage.setItem(POSTS_KEY, JSON.stringify(next));
    setPosts(next);
  }

  function save(post: Post, originalSlug?: string) {
    if (![post.title, post.summary, post.body].every(value => value.trim())) throw new Error('Please fill in the title, summary, and story.');
    // Read current storage before writing so another tab's saved stories are preserved.
    const current = readPosts();
    if (originalSlug && !current.some(p => p.slug === originalSlug)) throw new Error('This story was removed in another tab. Reload before continuing.');
    const saved = { ...post, title: post.title.trim(), summary: post.summary.trim(), body: post.body.trim() };
    persist(originalSlug ? current.map(p => p.slug === originalSlug ? saved : p) : [saved, ...current]);
  }

  return <BlogContext.Provider value={{ posts, loggedIn, hasPassword: !!passwordRecord, storageError: initial.error, login, logout: () => setLoggedIn(false), save, remove: slug => persist(readPosts().filter(p => p.slug !== slug)) }}>{children}</BlogContext.Provider>;
}

const blankPost = (): Post => ({ slug: '', title: '', date: '', summary: '', body: '' });
export function Writer() {
  const blog = useBlog();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [draft, setDraft] = useState<Post | null>(null);
  const [originalSlug, setOriginalSlug] = useState<string>();
  const [deleteSlug, setDeleteSlug] = useState<string>();
  const [dirty, setDirty] = useState(false);

  async function signIn(event: FormEvent) {
    event.preventDefault(); setError(''); setBusy(true);
    try {
      if (!blog.hasPassword && password !== confirmation) throw new Error('The two passwords need to match.');
      await blog.login(password); setPassword(''); setConfirmation(''); setShowPassword(false);
    } catch (e) { setError(e instanceof Error ? e.message : 'Login is unavailable. Try again.'); }
    finally { setBusy(false); }
  }

  function edit(post?: Post) {
    if (dirty && !window.confirm('Discard the unsaved changes to this story?')) return;
    setDraft(post ? { ...post } : blankPost()); setOriginalSlug(post?.slug); setDirty(false); setError(''); setNotice(''); setDeleteSlug(undefined);
  }

  function publish(event: FormEvent) {
    event.preventDefault();
    if (!draft) return;
    try {
      const slug = originalSlug || `${draft.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'story'}-${crypto.randomUUID().slice(0, 8)}`;
      blog.save({ ...draft, slug, date: draft.date || new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) }, originalSlug);
      setDraft(null); setDirty(false); setError(''); setNotice(originalSlug ? 'Your story has been updated.' : 'Your new story is ready to read.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save. Your browser storage may be full.'); }
  }

  return <section className="writer single"><p className="eyebrow">THE WRITING CORNER</p><h1>{blog.loggedIn ? 'Make yourself at home.' : 'A little space to write.'}</h1>
    <p className="demo-note">Browser-only demo: your password and stories stay in this browser. Visitors on other devices see the sample stories. Clearing site data resets this demo.</p>
    {(error || blog.storageError) && <p className="form-error" role="alert">{error || blog.storageError}</p>}
    {notice && <p className="form-notice" role="status">{notice}</p>}
    {!blog.loggedIn ? <form className="editor" onSubmit={signIn}>
      <h2>{blog.hasPassword ? 'Welcome back' : 'Choose your writer password'}</h2>
      <label htmlFor="password">Password</label><div className="password-field">
        <input id="password" type={showPassword ? 'text' : 'password'} autoComplete={blog.hasPassword ? 'current-password' : 'new-password'} required minLength={blog.hasPassword ? undefined : 8} maxLength={256} value={password} onChange={e => setPassword(e.target.value)} />
        <button type="button" className="password-toggle" aria-label="Show password" aria-pressed={showPassword} title={showPassword ? 'Hide password' : 'Show password'} aria-controls="password" onClick={() => setShowPassword(visible => !visible)}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
            <circle cx="12" cy="12" r="3" />
            {showPassword && <path d="m3 3 18 18" />}
          </svg>
        </button>
      </div>
      {!blog.hasPassword && <><label htmlFor="confirm-password">Confirm password</label><input id="confirm-password" type="password" autoComplete="new-password" required minLength={8} maxLength={256} value={confirmation} onChange={e => setConfirmation(e.target.value)} /><p className="field-hint">Use at least 8 characters. This password is just for your demo on this browser.</p></>}
      <button className="button" disabled={busy || !!blog.storageError}>{busy ? 'One moment…' : blog.hasPassword ? 'Log in' : 'Set password & start writing'}</button>
    </form> : <>
      <div className="writer-actions"><button className="button" onClick={() => edit()}>Write a story</button><button className="quiet-button" onClick={() => { if (dirty && !window.confirm('Discard unsaved changes and log out?')) return; blog.logout(); setDraft(null); setDirty(false); setNotice(''); }}>Log out</button></div>
      {draft && <form className="editor" onSubmit={publish}>
        <h2>{originalSlug ? 'A little polishing' : 'A fresh page'}</h2>
        <label htmlFor="story-title">Title</label><input autoFocus id="story-title" required maxLength={160} value={draft.title} onChange={e => { setDraft({ ...draft, title: e.target.value }); setDirty(true); }} />
        <label htmlFor="story-summary">A short introduction</label><textarea id="story-summary" required maxLength={500} rows={3} value={draft.summary} onChange={e => { setDraft({ ...draft, summary: e.target.value }); setDirty(true); }} />
        <label htmlFor="story-body">Your story</label><textarea id="story-body" required maxLength={50000} rows={12} value={draft.body} onChange={e => { setDraft({ ...draft, body: e.target.value }); setDirty(true); }} /><p className="field-hint">Leave a blank line between paragraphs.</p>
        <div className="writer-actions"><button className="button">{originalSlug ? 'Save changes' : 'Publish story'}</button><button type="button" className="quiet-button" onClick={() => { if (!dirty || window.confirm('Discard this unsaved draft?')) { setDraft(null); setDirty(false); } }}>Cancel</button></div>
      </form>}
      <h2>Your stories</h2>{!blog.posts.length && <p>A fresh start. Your first story can be anything you like.</p>}
      <div className="writer-list">{blog.posts.map(post => <article className="post-card" key={post.slug}><p className="date">{post.date}</p><h2>{post.title}</h2><div className="writer-actions"><Link to={'/blog/' + post.slug}>Read</Link><button className="quiet-button" onClick={() => edit(post)}>Edit<span className="sr-only"> {post.title}</span></button><button className="quiet-button danger" onClick={() => setDeleteSlug(post.slug)}>Delete<span className="sr-only"> {post.title}</span></button></div>
        {deleteSlug === post.slug && <div className="delete-confirm"><p>Delete “{post.title}”? This can’t be undone.</p><div className="writer-actions"><button className="quiet-button danger" onClick={() => { try { blog.remove(post.slug); if (originalSlug === post.slug) { setDraft(null); setDirty(false); } setDeleteSlug(undefined); setError(''); setNotice('Story deleted.'); } catch { setError('Could not delete the story. Please check browser storage.'); } }}>Yes, delete story</button><button className="quiet-button" onClick={() => setDeleteSlug(undefined)}>Keep story</button></div></div>}
      </article>)}</div>
    </>}
  </section>;
}
