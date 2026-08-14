/* globals.d.ts - 全局接口声明
 * 供 tsc --noEmit (checkJs) 识别业务全局对象与测试钩子。
 * 新增全局或 store 方法时：先改这里，页面代码即获得类型检查。
 * 记录类型接口放在文件尾部（SonderStoreFactory 之前是契约测试的切片区）。 */

interface SonderStoreImpl {
  state: SonderState;
  _rev: number;
  storageUsage(): number;
  isNearQuota(): boolean;
  hasPersistIssue(): boolean;
  persistIssueDetail(): Error | null;
  save(): boolean;
  flushPersist(): void;
  clearAll(): void;
  /* ---------- 任务 ---------- */
  addTask(data: SonderTaskInput): SonderTask;
  updateTask(id: string | number, patch: Partial<SonderTask>): SonderTask | null;
  removeTask(id: string | number): void;
  reorderTask(id: string | number, to: number): void;
  /* ---------- 备忘 ---------- */
  addMemo(text: string): SonderMemo;
  updateMemo(id: string | number, patch: Partial<SonderMemo>): SonderMemo | null;
  removeMemo(id: string | number): void;
  /* ---------- 自媒体 ---------- */
  addPost(data: SonderPostInput): SonderPost;
  updatePost(id: string | number, patch: Partial<SonderPost>): SonderPost | null;
  removePost(id: string | number): void;
  /* ---------- 开发 ---------- */
  addDevProject(data: SonderDevProjectInput): SonderDevProject;
  updateDevProject(id: string | number, patch: Partial<SonderDevProject>): SonderDevProject | null;
  removeDevProject(id: string | number): void;
  addDevTask(projectId: string, data: SonderDevTaskInput): SonderDevTask | null;
  updateDevTask(projectId: string, taskId: string, patch: Partial<SonderDevTask>): SonderDevTask | null;
  removeDevTask(projectId: string, taskId: string): void;
  addDevNote(data: SonderDevNoteInput): SonderDevNote;
  updateDevNote(id: string | number, patch: Partial<SonderDevNote>): SonderDevNote | null;
  removeDevNote(id: string | number): void;
  addDevSnippet(data: SonderDevSnippetInput): SonderDevSnippet;
  updateDevSnippet(id: string | number, patch: Partial<SonderDevSnippet>): SonderDevSnippet | null;
  removeDevSnippet(id: string | number): void;
  /* ---------- 咨询 ---------- */
  addClient(data: SonderClientInput): SonderClient;
  updateClient(id: string | number, patch: Partial<SonderClient>): SonderClient | null;
  removeClient(id: string | number): void;
  addClientProject(clientId: string, data: SonderClientProjectInput): SonderClientProject | null;
  updateClientProject(clientId: string, projectId: string, patch: Partial<SonderClientProject>): SonderClientProject | null;
  removeClientProject(clientId: string, projectId: string): void;
  addClientFollowup(clientId: string, data: SonderClientFollowupInput): SonderClientFollowup | null;
  updateClientFollowup(clientId: string, followupId: string, patch: Partial<SonderClientFollowup>): SonderClientFollowup | null;
  removeClientFollowup(clientId: string, followupId: string): void;
  addClientIncome(clientId: string, data: SonderClientIncomeInput): SonderClientIncome | null;
  updateClientIncome(clientId: string, incomeId: string, patch: Partial<SonderClientIncome>): SonderClientIncome | null;
  removeClientIncome(clientId: string, incomeId: string): void;
  /* ---------- 阅读 ---------- */
  addBook(data: SonderBookInput): SonderBook;
  updateBook(id: string | number, patch: Partial<SonderBook>): SonderBook | null;
  removeBook(id: string | number): void;
  addBookNote(bookId: string, text: string): SonderBookNote | null;
  removeBookNote(bookId: string, noteId: string): void;
  addReadingSession(bookId: string, minutes: number): number | null;
  addExcerpt(data: SonderExcerptInput): SonderExcerpt | null;
  removeExcerpt(id: string | number): void;
  /* ---------- 新闻 ---------- */
  addNews(data: SonderNewsInput): SonderNews;
  updateNews(id: string | number, patch: Partial<SonderNews>): SonderNews | null;
  removeNews(id: string | number): void;
  /* ---------- 设计 ---------- */
  addDesign(data: SonderDesignInput): SonderDesign;
  updateDesign(id: string | number, patch: Partial<SonderDesign>): SonderDesign | null;
  removeDesign(id: string | number): void;
  /* ---------- 游戏 ---------- */
  addGameRecord(data: SonderGameRecordInput): SonderGameRecord;
  clearGameRecords(): void;
  getMiniRecord(kind: string): Record<string, unknown>;
  updateMiniRecord(kind: string, patch: Record<string, unknown>): Record<string, unknown>;
  /* ---------- 删除撤销（P4c） ---------- */
  undoRemove(): unknown;
  /* ---------- 设置 ---------- */
  setTheme(theme: string): void;
  setWallpaperOpacity(opacity: number): void;
  setCustomWallpaper(url: string): void;
  getCustomWallpaper(): string | null;
  clearCustomWallpaper(): void;
  setFrameRate(fps: number): string | number;
  setGameDifficulty(difficulty: string): string;
  setTaskReminder(on: boolean): boolean;
  setModuleEnabled(key: string, on: boolean): void;
  setQuotaNoticeDismissed(on: boolean): void;
  dismissQuotaNotice(): void;
  enableEncryption(password: string): Promise<boolean>;
  disableEncryption(): Promise<boolean>;
  encryptionMode(): string;
  needsUnlock(): boolean;
  unlock(password: string): Promise<boolean>;
  lock(): void;
  /* ---------- 备份 / 迁移 ---------- */
  readSnapshot(source?: string): Promise<SonderState | null>;
  exportBackup(): string | Promise<string>;
  importBackup(jsonStr: string, password?: string): Promise<{ ok: boolean; error?: string }>;
  migrateToIdb(): Promise<boolean>;
  loadIdb(): Promise<boolean>;
  /* ---------- 汇总 ---------- */
  summarize(): SonderSummarize;
  buildWeeklyReport(now?: number | string | Date): string;
}

interface SonderStoreFactory {
  createStore(): SonderStoreImpl;
  todayStr(date?: Date): string;
  booksByStatus(books: SonderBook[]): SonderStatusBuckets;
  readingStats(books: SonderBook[]): SonderReadingStats;
  /* ---------- 纯函数工具（页面层直接调用） ---------- */
  groupTasks(tasks: SonderTask[], today?: string): SonderTaskGroups;
  todayProgress(tasks: SonderTask[], today?: string): { done: number; total: number; pct: number };
  filterPosts(posts: SonderPost[], opts?: { tag?: string; status?: string }): SonderPost[];
  collectTags(posts: SonderPost[]): string[];
  publishedStats(posts: SonderPost[]): SonderPublishedStats;
  recentPublished(posts: SonderPost[], n?: number): Array<{ id: string; title: string; views: number; likes: number; publishDate: string; createdAt: string }>;
  toCSV(posts: SonderPost[]): string;
  devProgress(p: SonderDevProject): { total: number; done: number; percent: number };
  sortNotesByUpdate<T extends { updatedAt?: string; createdAt?: string }>(items: T[]): T[];
  excerptsByBook(excerpts: SonderExcerpt[]): Array<{ bookId: string; bookTitle: string; items: Array<{ id: string; text: string; page: number; time: string }> }>;
  dailyExcerpt(excerpts: SonderExcerpt[], dateStr?: string): { text: string; bookTitle: string; page: number } | null;
  moduleList: Array<{ key: string; label: string }>;
  /* ---------- 拆分扩展内部接口（store-tasks/content/media/settings 混入用） ---------- */
  Store: (this: any, storage?: any) => any;
  _h: SonderHelpers;
}

interface SonderTaskGroups {
  now: SonderTask[];
  overdue: SonderTask[];
  upcoming: SonderTask[];
  done: SonderTask[];
}

interface SonderPostStatFields { views: number; likes: number; comments: number; favorites: number; }
interface SonderPublishedStats {
  count: number;
  sums: SonderPostStatFields;
  max: SonderPostStatFields;
  posts: Array<{ id: string; title: string; views: number; likes: number; comments: number; favorites: number }>;
}

interface SonderHelpers {
  uid(): string;
  nowISO(): string;
  todayStr(): string;
  fmtDate(d?: Date): string;
  deepClone<T>(v: T): T;
  isPlainObject(v: unknown): boolean;
  find(arr: Array<{ id: string | number }>, id: string | number): any;
  idxOf(arr: Array<{ id: string | number }>, id: string | number): number;
  normalizePriority(p: string): string;
  clampOpacity(v: number): number;
  normalize(state: any): any;
  num0(v: any): number;
  STORAGE_WALLPAPER_KEY: string;
}

interface SonderPage {
  title: string;
  render(container: HTMLElement, ctx: SonderCtx): void;
  add?(ctx: SonderCtx): void;
}

interface SonderUI {
  esc(s: unknown): string;
  sanitize(s: unknown): string;
  sanitizeUrl(u: unknown): string;
  el(html: string): HTMLElement;
  toast(msg: string, type?: string, action?: { label: string; onClick: () => void }): void;
  confirmBox(message: string, okText?: string): Promise<boolean>;
  alertBox(message: string, confirmText?: string): void;
  formModal(opts: SonderFormOptions): HTMLElement;
  emptyState(text: string, actionLabel?: string, actionFn?: () => void): HTMLElement;
}

interface SonderCtx {
  store: SonderStoreImpl;
  UI: SonderUI;
  S: SonderStoreFactory;
  theme(): string;
  navigate(route: string): void;
}

interface SonderFormOptions {
  title: string;
  confirmText?: string;
  fields?: Array<{
    key: string;
    label?: string;
    type?: string;
    value?: string | number;
    required?: boolean;
    placeholder?: string;
    step?: number;
    options?: Array<string | { value: string; label: string }>;
  }>;
  onSubmit?: (values: Record<string, string>) => boolean | string | void;
}

interface SonderErrorEntry {
  time: string;
  type: string;
  message: string;
  stack: string | null;
}

/* ================= 领域记录类型 ================= */

interface SonderState {
  version: number;
  settings: SonderSettings;
  memos: SonderMemo[];
  tasks: SonderTask[];
  posts: SonderPost[];
  devProjects: SonderDevProject[];
  devNotes: SonderDevNote[];
  devSnippets: SonderDevSnippet[];
  clients: SonderClient[];
  books: SonderBook[];
  excerpts: SonderExcerpt[];
  news: SonderNews[];
  designs: SonderDesign[];
  gameRecords: SonderGameRecord[];
  /** 单人小游戏纪录（kind → { best, diff, right, wrong, ... }），P3e 并入统一 state */
  miniRecords: Record<string, Record<string, unknown>>;
}

interface SonderSettings {
  theme: string;
  wallpaperOpacity: number;
  gameDifficulty: string;
  frameRate: number;
  modules: Record<string, boolean>;
  quotaNoticeDismissed: boolean;
  taskReminder: boolean;
}

interface SonderTask {
  id: string;
  title: string;
  note: string;
  date: string;
  priority: 'p1' | 'p2' | 'p3' | 'p4';
  done: boolean;
  doneAt: string | null;
  order: number;
}
interface SonderTaskInput { title?: string; note?: string; date?: string; priority?: string; done?: boolean; doneAt?: string | null; order?: number; }

interface SonderMemo { id: string; text: string; time: string; archived: boolean; }

interface SonderPost {
  id: string;
  title: string;
  platform: string;
  account: string;
  note: string;
  tags: string[];
  status: string;
  publishDate: string | null;
  createdAt: string;
  views: number;
  likes: number;
  comments: number;
  favorites: number;
  progress: number;
}
interface SonderPostInput { title?: string; platform?: string; account?: string; note?: string; tags?: string[]; status?: string; publishDate?: string | null; views?: number; likes?: number; comments?: number; favorites?: number; progress?: number; }

interface SonderDevProject { id: string; name: string; note: string; tasks: SonderDevTask[]; createdAt: string; }
interface SonderDevProjectInput { name?: string; note?: string; }
interface SonderDevTask { id: string; title: string; note: string; done: boolean; }
interface SonderDevTaskInput { title?: string; note?: string; done?: boolean; }
interface SonderDevNote { id: string; title: string; content: string; createdAt: string; updatedAt: string; }
interface SonderDevNoteInput { title?: string; content?: string; }
interface SonderDevSnippet { id: string; title: string; code: string; createdAt: string; updatedAt: string; }
interface SonderDevSnippetInput { title?: string; code?: string; }

interface SonderClient {
  id: string;
  name: string;
  contact: string;
  note: string;
  projects: SonderClientProject[];
  followups: SonderClientFollowup[];
  income: SonderClientIncome[];
  createdAt: string;
}
interface SonderClientInput { name?: string; contact?: string; note?: string; }
interface SonderClientProject { id: string; name: string; stage: string; note: string; }
interface SonderClientProjectInput { name?: string; stage?: string; note?: string; }
interface SonderClientFollowup { id: string; date: string; note: string; done: boolean; }
interface SonderClientFollowupInput { date?: string; note?: string; done?: boolean; }
interface SonderClientIncome { id: string; date: string; amount: number; note: string; }
interface SonderClientIncomeInput { date?: string; amount?: number; note?: string; }

interface SonderBook {
  id: string;
  title: string;
  author: string;
  status: string;
  progress: number;
  notes: SonderBookNote[];
  readingMinutes: number;
  readingLog: Array<{ date: string; minutes: number }>;
  finishedAt: string | null;
  createdAt: string;
}
interface SonderBookInput { title?: string; author?: string; status?: string; progress?: number; }
interface SonderBookNote { id: string; time: string; text: string; }

interface SonderExcerpt {
  id: string;
  bookId: string;
  bookTitle: string;
  text: string;
  page: number;
  time: string;
}
interface SonderExcerptInput { bookId: string; text: string; bookTitle?: string; page?: number; }

interface SonderNews {
  id: string;
  title: string;
  url: string;
  source: string;
  tags: string[];
  status: string;
  note: string;
  time: string;
}
interface SonderNewsInput { title?: string; url?: string; source?: string; tags?: string[]; status?: string; note?: string; }

interface SonderDesign {
  id: string;
  type: 'idea' | 'project';
  title: string;
  link: string;
  category: string;
  note: string;
  stage: string;
  time: string;
}
interface SonderDesignInput { type?: string; title?: string; link?: string; category?: string; note?: string; stage?: string; }

interface SonderGameRecord {
  id: string;
  kind: string;
  mode: 'ai' | 'pvp' | 'solo';
  player: string;
  winner: string;
  difficulty: string;
  note: string | null;
  date: string;
  time: string;
}
interface SonderGameRecordInput { kind: string; winner: string; mode?: string; player?: string; difficulty?: string; note?: string | null; }

interface SonderSummarize {
  date: string;
  tasks: { total: number; doneToday: number; remaining: number; current: number; overdue: number };
  selfmedia: { total: number; pending: number };
  dev: { total: number; active: number };
  consulting: { total: number; followups: number };
  reading: { total: number; reading: number };
  news: { total: number; unread: number };
  design: { total: number; active: number };
  game: { total: number; wins: number; draws: number };
}

interface SonderStatusBuckets { '想读': SonderBook[]; '在读': SonderBook[]; '已读完': SonderBook[]; }
interface SonderReadingStats {
  total: number;
  want: number;
  reading: number;
  finished: number;
  avgReading: number;
  avgAll: number;
  byStatus: Array<{ label: string; count: number; color: string }>;
  buckets: Array<{ label: string; color: string; count: number }>;
}

interface Window {
  Pages: Record<string, SonderPage>;
  SonderStore: SonderStoreFactory;
  SonderMarkdown: { render(src: string): string; esc(s: unknown): string };
  SonderCrypto: SonderCryptoApi;
  SonderGames: SonderGamesApi;
  SonderQuotes: { quoteOfDay(dateStr: string): string; quotes: string[] };
  UI: SonderUI;
  __sonderHooks: SonderHooks;
  __SONDER_TEST__?: boolean;
  __sonderErrors: { list: SonderErrorEntry[]; readonly total: number; clear(): void; report(errOrMsg: string | Error, type?: string): void };
  __gamesDbg: any;
  __readingDbg: any;
  __todayDbg: any;
}

interface SonderCryptoApi {
  ALGO: { name: string; length: number };
  ITERATIONS: number;
  BUNDLE_V: string;
  saltBytes(): Uint8Array;
  ivBytes(): Uint8Array;
  deriveKey(password: string, salt: Uint8Array, iterations: number): Promise<CryptoKey>;
  encryptText(text: string, key: CryptoKey): Promise<any>;
  decryptBundle(bundle: any, key: CryptoKey): Promise<string>;
  selfTest(password: string, salt: Uint8Array): Promise<boolean>;
  bytesToB64(bytes: Uint8Array): string;
  b64ToBytes(b64: string): Uint8Array;
}

interface SonderGameState {
  kind: 'tictactoe' | 'gomoku';
  size: number;
  board: Array<Array<string | null>>;
  turn: string;
  moves: Array<{ r: number; c: number }>;
  winner: string | null;
  over: boolean;
  byResign: boolean;
  winLine: any;
}

interface SonderGamesApi {
  createGame(kind: string): SonderGameState;
  place(g: SonderGameState, r: number, c: number): { ok: boolean; winner?: string; draw?: boolean; error?: string };
  undo(g: SonderGameState): { ok: boolean; error?: string };
  resign(g: SonderGameState, player: string): { ok: boolean };
  tttAiMove(g: SonderGameState, player: string, difficulty: string): { r: number; c: number };
  gomokuAiMove(g: SonderGameState, player: string, difficulty: string): { r: number; c: number };
  guessNumStart(): any;
  guessNumTry(g: any, input: string): any;
  mineStart(rows: number, cols: number, mines: number): any;
  mineLay(g: any, r: number, c: number, n: number): any;
  mineReveal(g: any, r: number, c: number): any;
  mineToggleFlag(g: any, r: number, c: number): any;
  idiomStart(): any;
  idiomTry(g: any, input: string): any;
  IDIOM_POOL: string[];
  brainStart(): any;
  brainTry(g: any, input: string): any;
  BRAIN_POOL: string[];
}

interface SonderHooks {
  store: SonderStoreImpl;
  render(route: string): void;
  idbReady: Promise<boolean>;
  todayReminder?: () => void;
  lockNow?: () => void;
  unlockNow?: () => void;
  /* 测试专用钩子（__SONDER_TEST__ 门闩后注入，生产环境不存在） */
  ctx?: SonderCtx;
  Pages?: Record<string, SonderPage>;
  applyTheme?: () => void;
  applyWallpaper?: () => void;
  applyFrame?: () => void;
  todayLine?: () => void;
}

/* 部分代码直接裸用全局名（非 window. 前缀），声明为全局变量 */
declare var SonderStore: SonderStoreFactory;
