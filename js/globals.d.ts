/* globals.d.ts - 全局接口声明
 * 供 tsc --noEmit (checkJs) 识别业务全局对象与测试钩子。
 * 新增全局或 store 方法时：先改这里，页面代码即获得类型检查。 */

interface SonderStoreImpl {
  state: any;
  storageUsage(): number;
  isNearQuota(): boolean;
  save(): boolean;
  clearAll(): void;
  /* ---------- 任务 ---------- */
  addTask(t: any): any;
  updateTask(id: string | number, patch: any): any;
  removeTask(id: string | number): void;
  reorderTask(id: string | number, to: number): void;
  /* ---------- 备忘 ---------- */
  addMemo(text: string): any;
  updateMemo(id: string | number, patch: any): any;
  removeMemo(id: string | number): void;
  /* ---------- 自媒体 ---------- */
  addPost(p: any): any;
  updatePost(id: string | number, patch: any): any;
  removePost(id: string | number): void;
  /* ---------- 开发 ---------- */
  addDevProject(p: any): any;
  updateDevProject(id: string | number, patch: any): any;
  removeDevProject(id: string | number): void;
  addDevTask(p: any): any;
  updateDevTask(id: string | number, patch: any): any;
  removeDevTask(id: string | number): void;
  addDevNote(p: any): any;
  updateDevNote(id: string | number, patch: any): any;
  removeDevNote(id: string | number): void;
  addDevSnippet(p: any): any;
  updateDevSnippet(id: string | number, patch: any): any;
  removeDevSnippet(id: string | number): void;
  /* ---------- 咨询 ---------- */
  addClient(c: any): any;
  updateClient(id: string | number, patch: any): any;
  removeClient(id: string | number): void;
  addClientProject(p: any): any;
  updateClientProject(id: string | number, patch: any): any;
  removeClientProject(id: string | number): void;
  addClientFollowup(p: any): any;
  updateClientFollowup(id: string | number, patch: any): any;
  removeClientFollowup(id: string | number): void;
  addClientIncome(p: any): any;
  updateClientIncome(id: string | number, patch: any): any;
  removeClientIncome(id: string | number): void;
  /* ---------- 阅读 ---------- */
  addBook(b: any): any;
  updateBook(id: string | number, patch: any): any;
  removeBook(id: string | number): void;
  addBookNote(p: any): any;
  removeBookNote(id: string | number): void;
  addReadingSession(p: any): any;
  addExcerpt(p: any): any;
  removeExcerpt(id: string | number): void;
  /* ---------- 新闻 ---------- */
  addNews(n: any): any;
  updateNews(id: string | number, patch: any): any;
  removeNews(id: string | number): void;
  /* ---------- 设计 ---------- */
  addDesign(d: any): any;
  updateDesign(id: string | number, patch: any): any;
  removeDesign(id: string | number): void;
  /* ---------- 游戏 ---------- */
  addGameRecord(r: any): any;
  clearGameRecords(): void;
  /* ---------- 设置 ---------- */
  setTheme(t: string): void;
  setWallpaperOpacity(v: number): void;
  setCustomWallpaper(url: string): void;
  getCustomWallpaper(): string | null;
  clearCustomWallpaper(): void;
  setFrameRate(f: number): string | number;
  setGameDifficulty(d: string): string;
  setTaskReminder(on: boolean): boolean;
  setModuleEnabled(key: string, on: boolean): void;
  setQuotaNoticeDismissed(on: boolean): void;
  dismissQuotaNotice(): void;
  enableEncryption(pwd: string): Promise<any>;
  disableEncryption(): Promise<any>;
  encryptionEnabled(): boolean;
  encryptionMode(): string;
  needsUnlock(): boolean;
  unlock(pwd: string): Promise<boolean>;
  lock(): void;
  /* ---------- 备份 / 迁移 ---------- */
  readSnapshot(mode?: string): Promise<any>;
  exportBackup(): string | Promise<string> | Promise<never>;
  importBackup(jsonStr: string, password?: string): Promise<{ ok: boolean; error?: string }>;
  migrateToIdb(): Promise<boolean>;
  loadIdb(): Promise<boolean>;
  /* ---------- 汇总 ---------- */
  summarize(): any;
  buildWeeklyReport(now?: number | string | Date): string;
}

interface SonderStoreFactory {
  createStore(): SonderStoreImpl;
  todayStr(date?: Date): string;
  booksByStatus: any;
  readingStats: any;
  [key: string]: any;
}

interface SonderPage {
  title: string;
  render(container: HTMLElement, ctx: any): void;
  add?(ctx: any): void;
  [key: string]: any;
}

interface SonderUI {
  esc(s: any): string;
  sanitize(s: any): string;
  sanitizeUrl(u: any): string;
  el(html: string): HTMLElement;
  toast(msg: string, type?: string): void;
  confirmBox(message: string, okText?: string): Promise<boolean>;
  alertBox(message: string, confirmText?: string): void;
  formModal(opts: any): HTMLElement;
  emptyState(text: string, actionLabel?: string, actionFn?: () => void): HTMLElement;
}

interface Window {
  Pages: Record<string, SonderPage>;
  SonderStore: SonderStoreFactory;
  SonderMarkdown: any;
  SonderCrypto: any;
  SonderGames: any;
  SonderQuotes: any;
  UI: SonderUI;
  __sonderHooks: { [key: string]: any };
  __sonderErrors: { list: any[]; readonly total: number; clear(): void };
  __gamesDbg: any;
  __readingDbg: any;
  __todayDbg: any;
}

/* 部分代码直接裸用全局名（非 window. 前缀），声明为全局变量 */
declare var SonderStore: SonderStoreFactory;