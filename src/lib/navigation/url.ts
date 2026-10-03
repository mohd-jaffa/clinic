/**
 * Loads a screen afresh, as a new page: what signing in and signing out do
 * (plan §5.5). Nothing held in memory for one account — cached rows, screens'
 * state, the page's own first data — can outlive it into the next, and the
 * server draws the new account's screen with its data.
 */
export function loadPage(url: string) {
  window.location.replace(url);
}
