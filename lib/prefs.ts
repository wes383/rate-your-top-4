/**
 * Shared preference keys and types.
 *
 * Kept free of React so both the server layout (cookie reads) and the client
 * providers can import them.
 */

export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "top4-theme";
export const LANG_STORAGE_KEY = "top4-lang";

export const DEFAULT_THEME: Theme = "light";
export const DEFAULT_LANG = "zh";

/**
 * Runs before first paint to apply the stored theme class, preventing a flash
 * of the wrong theme. Inlined into <head> by the root layout.
 */
export const THEME_INIT_SCRIPT = `(function(){try{
var m=document.cookie.match(/(?:^|; )${THEME_STORAGE_KEY}=([^;]+)/);
var t=null;
try{t=window.localStorage.getItem("${THEME_STORAGE_KEY}")}catch(e){}
if(!t&&m){t=decodeURIComponent(m[1])}
var d=t==="dark";
document.documentElement.classList.toggle("dark",d);
}catch(e){}})();`;
