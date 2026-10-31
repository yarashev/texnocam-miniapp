
(() => {
  const telegram = window.Telegram?.WebApp, stack = [];
  const sync = () => { if (!telegram?.BackButton) return; stack.length ? telegram.BackButton.show() : telegram.BackButton.hide(); };
  const push = (action, scope = '') => { if (typeof action === 'function') { stack.push({ action, scope }); sync(); } };
  const discard = (scope = '') => { const index = scope ? stack.map(item => item.scope).lastIndexOf(scope) : stack.length - 1; if (index >= 0) stack.splice(index, 1); sync(); };
  const clear = (scope = '') => { if (scope) { for (let i = stack.length - 1; i >= 0; i--) if (stack[i].scope === scope) stack.splice(i, 1); } else stack.length = 0; sync(); };
  const back = () => { const entry = stack.pop(); sync(); entry?.action?.(); };
  telegram?.BackButton?.onClick(back);
  window.UzCamTelegramBack = { push, discard, clear, back, get size() { return stack.length; } };
  sync();
})();
