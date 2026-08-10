/* Sonder 全局声明（仅供 tsc --noEmit 类型检查，不参与运行时） */

declare var SonderStore: any;
declare var SonderGames: any;
declare var SonderQuotes: any;

interface Window {
  SonderStore: any;
  SonderGames: any;
  SonderQuotes: any;
  Pages: any;
  UI: any;
  __sonderHooks: any;
  __gamesDbg: any;
}

/* 本项目按浏览器宽松语义直接操作 Element（手写 DOM 工程约定） */
interface Element {
  onclick: ((this: GlobalEventHandlers, ev: MouseEvent) => any) | null;
  value: string;
  focus: () => void;
  style: CSSStyleDeclaration;
  remove: () => void;
}