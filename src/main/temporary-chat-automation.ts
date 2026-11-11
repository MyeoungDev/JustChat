export const temporaryChatFallbackUrl = 'https://chatgpt.com/?temporary-chat=true'

export function shouldAttemptTemporaryChatUrlFallback(code: string | undefined, currentUrl: string) {
  if (code !== 'temporary-chat-control-unavailable'
    && code !== 'new-chat-control-unavailable'
    && code !== 'new-chat-transition-not-confirmed'
    && code !== 'temporary-chat-state-lost') return false
  try {
    const url = new URL(currentUrl)
    return url.hostname === 'chatgpt.com' && !/^\/g(?:\/|$)/i.test(url.pathname)
  } catch {
    return false
  }
}

export const temporaryChatFallbackVerificationScript = String.raw`(() => {
  const url = new URL(location.href);
  const composer = Array.from(document.querySelectorAll('#prompt-textarea, [data-testid="composer"] [contenteditable], [contenteditable]:not([contenteditable="false"]), [role="textbox"], textarea'))
    .find(element => element instanceof HTMLElement && element.getClientRects().length > 0);
  if (composer) composer.focus();
  const composerFocused = Boolean(composer && (document.activeElement === composer || composer.contains(document.activeElement)));
  const temporary = url.hostname === 'chatgpt.com' && url.searchParams.get('temporary-chat') === 'true';
  return {
    code: temporary && composerFocused ? 'temporary-chat-url-fallback' : 'temporary-chat-url-fallback-unconfirmed',
    chatMode: temporary,
    temporary,
    composerFocused,
    sidebarOpened: false
  };
})()`

export const temporaryChatAutomationScript = String.raw`(async () => {
  const labels = element => [
    element.getAttribute('aria-label'),
    element.getAttribute('title'),
    element.getAttribute('data-testid'),
    element.innerText,
    element.textContent
  ].filter(Boolean).map(value => String(value).replace(/\s+/g, ' ').trim());
  const isNamed = (element, name) => labels(element).some(value => value.toLowerCase() === name.toLowerCase());
  const allControls = () => Array.from(document.querySelectorAll('button, [role="button"], [role="tab"], [role="radio"], a'))
    .filter(element => element instanceof HTMLElement && element.isConnected);
  const visibleControls = () => allControls().filter(element => element.getClientRects().length > 0);
  const isSelected = element => {
    if (!element) return null;
    for (const attribute of ['aria-pressed', 'aria-selected', 'aria-checked', 'data-active', 'data-state']) {
      const value = element.getAttribute(attribute);
      if (value === 'true' || value === 'on' || value === 'active' || value === 'selected' || value === 'page') return true;
      if (value === 'false' || value === 'off' || value === 'inactive') return false;
    }
    const className = String(element.className || '');
    if (/(?:^|\s)(?:active|selected|checked)(?:\s|$)/i.test(className)) return true;
    return null;
  };
  const waitFor = async (find, timeout = 4000) => {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const value = find();
      if (value) return value;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return null;
  };
  const composer = () => Array.from(document.querySelectorAll('#prompt-textarea, [data-testid="composer"] [contenteditable], [contenteditable]:not([contenteditable="false"]), [role="textbox"], textarea'))
    .find(element => element instanceof HTMLElement && element.getClientRects().length > 0);
  const focusComposer = () => {
    const input = composer();
    if (!input) return false;
    input.focus();
    return document.activeElement === input || input.contains(document.activeElement);
  };
  let chatModeConfirmed = false;
  const finish = (code, temporary = false) => {
    const succeeded = code === 'temporary-chat-started' || code === 'new-temporary-chat';
    return {
      code,
      chatMode: chatModeConfirmed,
      temporary,
      composerFocused: succeeded ? focusComposer() : false,
      sidebarOpened: false
    };
  };
  const ensureChatMode = async () => {
    const modeControls = () => {
      const controls = visibleControls();
      return {
        chat: controls.find(element => isNamed(element, 'Chat')),
        work: controls.find(element => isNamed(element, 'Work'))
      };
    };
    let { chat, work } = modeControls();
    if (!work) {
      // A ChatGPT page without a Work mode switch is already in the regular Chat experience.
      chatModeConfirmed = true;
      return { ok: true, changed: false };
    }
    if (!chat) return { ok: false, changed: false };
    const chatSelected = isSelected(chat);
    const workSelected = isSelected(work);
    if (chatSelected === true && workSelected !== true) {
      chatModeConfirmed = true;
      return { ok: true, changed: false };
    }
    if (workSelected === false && chatSelected === null) {
      chatModeConfirmed = true;
      return { ok: true, changed: false };
    }
    chat.click();
    const selected = await waitFor(() => {
      ({ chat, work } = modeControls());
      if (!chat || !work) return null;
      const chatState = isSelected(chat);
      const workState = isSelected(work);
      return (chatState === true && workState !== true)
        || (chatState === null && workState === false) ? true : null;
    }, 4000);
    chatModeConfirmed = Boolean(selected);
    return { ok: chatModeConfirmed, changed: Boolean(selected) };
  };
  const temporaryToggle = () => visibleControls().find(element =>
    labels(element).some(label => /temporary[\s-]*chat|임시\s*채팅/i.test(label))
  );
  const isTemporaryActive = element => {
    if (!element) return false;
    const label = labels(element).join(' ').toLowerCase();
    if (label.includes('turn off temporary chat') || label.includes('turn off the temporary chat')
      || label.includes('disable temporary chat') || label.includes('임시 채팅 끄기')
      || label.includes('임시 채팅 종료') || label.includes('임시 채팅 비활성화')) return true;
    if (isSelected(element) === true) return true;
    const url = new URL(location.href);
    return url.searchParams.get('temporary-chat') === 'true' || /temporary[-_]?chat/i.test(url.pathname);
  };
  const ensureTemporaryMode = async () => {
    let toggle = await waitFor(temporaryToggle, 5000);
    if (!toggle) return false;
    if (isTemporaryActive(toggle)) return true;
    toggle.click();
    toggle = await waitFor(() => {
      const current = temporaryToggle();
      return isTemporaryActive(current) ? current : null;
    }, 5000);
    return Boolean(toggle);
  };
  const findNewChat = () => {
    const controls = allControls();
    const matches = controls.filter(element => {
      const label = labels(element).join(' ');
      return /(?:^|\b)new[\s-]*chat\b|새\s*채팅|새\s*대화|create[-_\s]*new[-_\s]*chat/i.test(label)
        && element.getAttribute('aria-disabled') !== 'true'
        && !element.disabled;
    });
    return matches.find(element => element.getClientRects().length > 0) ?? matches[0] ?? null;
  };
  const currentUserMessageCount = () => document.querySelectorAll('[data-message-author-role="user"]').length;

  try {
    const mode = await ensureChatMode();
    if (!mode.ok) return finish('chat-mode-unavailable');

    let toggle = await waitFor(temporaryToggle, 5000);
    if (!toggle) return finish('temporary-chat-control-unavailable');
    if (!isTemporaryActive(toggle)) {
      const active = await ensureTemporaryMode();
      return finish(active ? 'temporary-chat-started' : 'temporary-chat-not-confirmed', active);
    }

    const newChat = findNewChat();
    if (!newChat) return finish('new-chat-control-unavailable', true);
    const beforeUrl = location.href;
    const beforeMessages = currentUserMessageCount();
    newChat.click();
    if (beforeMessages > 0 || /\/c\/[^/?#]+/.test(new URL(beforeUrl).pathname)) {
      const changed = await waitFor(() => location.href !== beforeUrl || currentUserMessageCount() < beforeMessages, 5000);
      if (!changed) return finish('new-chat-transition-not-confirmed', true);
    } else {
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    const chatMode = await ensureChatMode();
    if (!chatMode.ok) return finish('chat-mode-lost', false);
    toggle = await waitFor(temporaryToggle, 5000);
    if (!toggle) return finish('temporary-chat-control-lost', false);
    if (!isTemporaryActive(toggle)) {
      const active = await ensureTemporaryMode();
      if (!active) return finish('temporary-chat-state-lost', false);
    }
    return finish('new-temporary-chat', true);
  } catch {
    return finish('automation-error');
  }
})()`
