type DbStorageType = 'json' | 'ldb';

interface AntiRecallConfig {
  mainColor: string;
  dbStorageType: DbStorageType;
  enableShadow: boolean;
  enableTip: boolean;
  isAntiRecallSelfMsg: boolean;
  enablePeriodicCleanup: boolean;
  maxMsgSaveLimit: number;
  deleteMsgCountPerTime: number;
  rkeyServerUrl: string;
}

const DEFAULT_CONFIG: AntiRecallConfig = {
  mainColor: '#ff6d6d',
  dbStorageType: 'json',
  enableShadow: true,
  enableTip: true,
  isAntiRecallSelfMsg: false,
  enablePeriodicCleanup: true,
  maxMsgSaveLimit: 10_000,
  deleteMsgCountPerTime: 500,
  rkeyServerUrl: 'https://llob.linyuchen.net/rkey',
};

let recalledIds: string[] = [];
let currentConfig: AntiRecallConfig = { ...DEFAULT_CONFIG };

function waitForHakoGlobals(): void {
  const hasRendererEvents = typeof (globalThis as any).RendererEvents !== 'undefined';
  const hasPluginSettings = typeof (globalThis as any).PluginSettings !== 'undefined';

  if (!hasRendererEvents || !hasPluginSettings) {
    setTimeout(waitForHakoGlobals, 100);
    return;
  }

  RendererEvents.onSettingsWindowCreated(() => {
    void registerSettingsPage();
  });
}

waitForHakoGlobals();
void setupMainWindowPatches();

async function getNowConfig(): Promise<AntiRecallConfig> {
  try {
    const cfg = await window.anti_recall?.getNowConfig<AntiRecallConfig>();
    return cfg ?? { ...DEFAULT_CONFIG };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

async function registerSettingsPage(): Promise<void> {
  try {
    const view = await PluginSettings.renderer.registerPluginSettings(__self.meta.packageJson);
    await renderSettings(view);
  } catch (e) {
    console.error('[Anti-Recall-Neo] 注册设置页失败:', e);
  }
}

function setSwitchActive(el: HTMLElement, active: boolean): void {
  // hako 的 setting-switch 通过 is-active 属性切换状态（:host([is-active])）
  el.toggleAttribute('is-active', active);
}

async function renderSettings(container: HTMLDivElement): Promise<void> {
  currentConfig = await getNowConfig();

  const html = `
    <plugin-menu>
      <setting-item class="config_view">
        <setting-section data-title="主配置">
          <setting-panel>
            <setting-list data-direction="column">
              <setting-item data-direction="row">
                <setting-text>消息管理</setting-text>
                <setting-button id="clearDb" data-type="secondary">清空已储存的撤回消息</setting-button>
              </setting-item>

              <setting-item data-direction="row">
                <div>
                  <setting-text>rkey 服务器地址</setting-text>
                  <span class="secondary-text">rKey 用于获取被撤回的消息图片，内置服务器失效时可填写自建或其它服务器。更改后可能需切换聊天窗口才可完全生效。</span>
                </div>
                <input id="rkeyServerUrl" class="text_color path-input rkey-input" type="text" value="${currentConfig.rkeyServerUrl ?? ''}"/>
              </setting-item>
            </setting-list>
          </setting-panel>
        </setting-section>

        <setting-section data-title="数据配置">
          <setting-panel>
            <setting-list data-direction="column">
              <setting-item id="dbStorageTypeRow" data-direction="row">
                <div>
                  <setting-text>存储格式</setting-text>
                  <span class="secondary-text">Json 方便阅读，LevelDB 性能更优。更改后需重启 QQ 生效。</span>
                </div>
                <setting-select id="dbStorageTypeSelect">
                  <setting-option data-value="json">Json</setting-option>
                  <setting-option data-value="ldb">LevelDB</setting-option>
                </setting-select>
              </setting-item>

              <setting-item data-direction="row">
                <div>
                  <setting-text>是否反撤回自己的消息</setting-text>
                  <span class="secondary-text">如果开启，则自己发送的消息也会被反撤回。开启后，从下一条消息开始起生效。</span>
                </div>
                <setting-switch id="switchAntiRecallSelf"></setting-switch>
              </setting-item>

              <setting-item data-direction="row">
                <div>
                  <setting-text>自动清理消息数据缓存</setting-text>
                  <span class="secondary-text">插件会缓存消息数据用于撤回恢复并持久化。关闭后，内存中的消息将永久缓存直至 QQ 重启，可能导致内存占用持续增长；但开启可能导致旧消息无法被反撤回。</span>
                </div>
                <setting-switch id="switchPeriodicCleanup"></setting-switch>
              </setting-item>

              <div id="periodicCleanupSub">
                <setting-item data-direction="row">
                  <div>
                    <setting-text>消息最多缓存条数</setting-text>
                    <span class="secondary-text">如果过少可能导致消息接收太多太快时来不及反撤回，如果过多可能导致内存占用过高。更改后立即生效。</span>
                  </div>
                  <div class="input-with-suffix">
                    <input id="maxMsgLimit" min="1" max="100000000" class="text_color path-input number-input" type="number" value="${currentConfig.maxMsgSaveLimit ?? 100000}"/>
                    <span>条</span>
                  </div>
                </setting-item>

                <setting-item data-direction="row">
                  <div>
                    <setting-text>清理缓存消息时一次性清理条数</setting-text>
                    <span class="secondary-text">当达到上一条配置的上限时将清理掉最旧消息数据（清理后将无法反撤回），一次性清理过多可能较多消息反撤回失败，过少可能会导致内存持续高占用。更改后立即生效。</span>
                  </div>
                  <div class="input-with-suffix">
                    <input id="deletePerTime" min="1" max="100000000" class="text_color path-input number-input" type="number" value="${currentConfig.deleteMsgCountPerTime ?? 5000}"/>
                    <span>条</span>
                  </div>
                </setting-item>
              </div>
            </setting-list>
          </setting-panel>
        </setting-section>

        <setting-section data-title="样式配置">
          <setting-panel>
            <setting-list data-direction="column">
              <setting-item data-direction="row">
                <div>
                  <setting-text>撤回主题色</setting-text>
                  <span class="secondary-text">将会同时影响阴影和“已撤回”提示的颜色。修改将立即生效。</span>
                </div>
                <input id="mainColor" type="color" class="pick-color" value="${currentConfig.mainColor}"/>
              </setting-item>

              <setting-item data-direction="row">
                <div>
                  <setting-text>撤回消息显示阴影</setting-text>
                  <span class="secondary-text">修改将立即生效。</span>
                </div>
                <setting-switch id="switchShadow"></setting-switch>
              </setting-item>

              <setting-item data-direction="row">
                <div>
                  <setting-text>撤回消息显示“已撤回”提示</setting-text>
                  <span class="secondary-text">修改将在重新滚动消息后生效。</span>
                </div>
                <setting-switch id="switchTip"></setting-switch>
              </setting-item>
            </setting-list>
          </setting-panel>
        </setting-section>

        <style>
          .config_view { margin: 20px; }
          .config_view .secondary-text { display: block; color: var(--text_secondary); font-size: min(var(--font_size_2), 16px); line-height: min(var(--line_height_2), 22px); margin-top: 4px; }
          .config_view .hidden { display: none !important; }
          .config_view #periodicCleanupSub.hidden { display: none !important; }
          .config_view .path-input { height: 24px; border-radius: 4px; padding: 0px 6px; background-color: var(--overlay_active); transition: background-color 100ms ease-out; }
          .config_view .path-input:hover { background-color: var(--overlay_hover); }
          .config_view .rkey-input { width: 300px; }
          .config_view .number-input { width: 88px; }
          .config_view .input-with-suffix { display: flex; align-items: center; gap: 6px; color: var(--text_secondary); }
          .config_view .pick-color { width: 62px; height: 24px; padding: 0px; border-radius: 4px; border: 1px solid var(--border_dark); background: transparent; cursor: pointer; }
          .config_view .pick-color::-webkit-color-swatch-wrapper { padding: 2px; }
          .config_view .pick-color::-webkit-color-swatch { border: none; border-radius: 2px; }
          .config_view #dbStorageTypeSelect::after {
            content: ''; position: absolute; right: 9px; top: 50%; transform: translateY(-50%);
            width: 16px; height: 16px; pointer-events: none; background-color: var(--icon_primary);
            -webkit-mask: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><path d='M12 6L8 10L4 6' stroke='black' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/></svg>") center / 16px no-repeat;
            mask: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><path d='M12 6L8 10L4 6' stroke='black' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/></svg>") center / 16px no-repeat;
          }
          @media (prefers-color-scheme: light) { .config_view .text_color { color: black; } }
          @media (prefers-color-scheme: dark) { .config_view .text_color { color: white; } }
        </style>
      </setting-item>
    </plugin-menu>
  `;

  const menu = new DOMParser().parseFromString(html, 'text/html').querySelector('plugin-menu');
  if (!menu) return;

  const clearBtn = menu.querySelector<HTMLElement>('#clearDb');
  clearBtn?.addEventListener('click', async () => {
    await window.anti_recall.clearDb();
  });

  const maxMsgLimit = menu.querySelector<HTMLInputElement>('#maxMsgLimit');
  maxMsgLimit?.addEventListener('blur', async () => {
    const v = Number.parseFloat(maxMsgLimit.value);
    if (v <= 0 || v > 99_999_999) {
      alert('你的数量输入有误！将不会保存，请重新输入');
      return;
    }
    currentConfig.maxMsgSaveLimit = v;
    await window.anti_recall.saveConfig(currentConfig);
  });

  const deletePerTime = menu.querySelector<HTMLInputElement>('#deletePerTime');
  deletePerTime?.addEventListener('blur', async () => {
    const v = Number.parseFloat(deletePerTime.value);
    if (v <= 0 || v > 99_999) {
      alert('你的数量输入有误！将不会保存，请重新输入');
      return;
    }
    currentConfig.deleteMsgCountPerTime = v;
    await window.anti_recall.saveConfig(currentConfig);
  });

  const colorInput = menu.querySelector<HTMLInputElement>('.pick-color');
  if (colorInput) {
    colorInput.value = currentConfig.mainColor;
    colorInput.addEventListener('change', async () => {
      currentConfig.mainColor = colorInput.value;
      await window.anti_recall.saveConfig(currentConfig);
    });
  }

  const storageSelect = menu.querySelector<HTMLElement>('#dbStorageTypeSelect');

  if (storageSelect) {
    // 注意：DOMParser 解析出的自定义元素在 appendChild 前不会升级，只能操作属性，不能调用组件方法
    const current = currentConfig.dbStorageType === 'ldb' ? 'ldb' : 'json';
    menu.querySelectorAll<HTMLElement>('#dbStorageTypeSelect setting-option').forEach(o => {
      o.toggleAttribute('is-selected', o.getAttribute('data-value') === current);
    });

    storageSelect.addEventListener('selected', async e => {
      const value = (e as CustomEvent<{ name: string; value: string }>).detail?.value;
      currentConfig.dbStorageType = value === 'ldb' ? 'ldb' : 'json';
      await window.anti_recall.saveConfig(currentConfig);
    });
  }

  const rkeyInput = menu.querySelector<HTMLInputElement>('#rkeyServerUrl');
  rkeyInput?.addEventListener('blur', async () => {
    const v = rkeyInput.value.trim();
    currentConfig.rkeyServerUrl = v || DEFAULT_CONFIG.rkeyServerUrl;
    rkeyInput.value = currentConfig.rkeyServerUrl;
    await window.anti_recall.saveConfig(currentConfig);
  });

  const switchPeriodic = menu.querySelector<HTMLElement>('#switchPeriodicCleanup');
  const periodicSub = menu.querySelector<HTMLElement>('#periodicCleanupSub');
  if (switchPeriodic && periodicSub) {
    setSwitchActive(switchPeriodic, currentConfig.enablePeriodicCleanup !== false);
    periodicSub.classList.toggle('hidden', currentConfig.enablePeriodicCleanup === false);
    switchPeriodic.addEventListener('click', async () => {
      const next = !switchPeriodic.hasAttribute('is-active');
      setSwitchActive(switchPeriodic, next);
      currentConfig.enablePeriodicCleanup = next;
      periodicSub.classList.toggle('hidden', !next);
      await window.anti_recall.saveConfig(currentConfig);
    });
  }

  const switchAntiSelf = menu.querySelector<HTMLElement>('#switchAntiRecallSelf');
  if (switchAntiSelf) {
    setSwitchActive(switchAntiSelf, currentConfig.isAntiRecallSelfMsg === true);
    switchAntiSelf.addEventListener('click', async () => {
      const next = !switchAntiSelf.hasAttribute('is-active');
      setSwitchActive(switchAntiSelf, next);
      currentConfig.isAntiRecallSelfMsg = next;
      await window.anti_recall.saveConfig(currentConfig);
    });
  }

  const switchShadow = menu.querySelector<HTMLElement>('#switchShadow');
  if (switchShadow) {
    setSwitchActive(switchShadow, currentConfig.enableShadow !== false);
    switchShadow.addEventListener('click', async () => {
      const next = !switchShadow.hasAttribute('is-active');
      setSwitchActive(switchShadow, next);
      currentConfig.enableShadow = next;
      await window.anti_recall.saveConfig(currentConfig);
    });
  }

  const switchTip = menu.querySelector<HTMLElement>('#switchTip');
  if (switchTip) {
    setSwitchActive(switchTip, currentConfig.enableTip !== false);
    switchTip.addEventListener('click', async () => {
      const next = !switchTip.hasAttribute('is-active');
      setSwitchActive(switchTip, next);
      currentConfig.enableTip = next;
      await window.anti_recall.saveConfig(currentConfig);
    });
  }

  container.appendChild(menu);
}

async function applyCssFromConfig(): Promise<void> {
  currentConfig = await getNowConfig();

  const old = document.querySelector<HTMLStyleElement>('#anti-recall-neo-css');
  old?.remove();

  const style = document.createElement('style');
  style.type = 'text/css';
  style.id = 'anti-recall-neo-css';

  let css = `
    .message-content__wrapper {
      color: var(--bubble_guest_text);
      display: flex;
      grid-row-start: content;
      grid-column-start: content;
      grid-row-end: content;
      grid-column-end: content;
      max-width: -webkit-fill-available;
      min-height: 38px;
      overflow: visible !important;
      border-radius: 10px;
    }

    .message-content__wrapper.message-content-recalled-parent { padding: 0px !important; }

    .message-content-recalled-parent {
      border-radius: 10px;
      position: relative;
      overflow: unset !important;
  `;

  if (currentConfig.enableShadow === true) {
    css += `
      margin-top: 3px;
      margin-left: 3px;
      margin-right: 3px;
      margin-bottom: 25px;
      box-shadow: 0px 0px 8px 5px ${currentConfig.mainColor} !important;
    `;
  } else {
    css += 'margin-bottom: 15px;';
  }

  css += `
    }

    .recalledNoMargin { margin-top: 0px !important; }

    .message-content-recalled {
      position: absolute;
      top: calc(100% + 6px);
      left: 0;
      font-size: 12px;
      white-space: nowrap;
      background-color: var(--background-color-05);
      backdrop-filter: blur(28px);
      padding: 4px 8px;
      margin-bottom: 2px;
      border-radius: 6px;
      box-shadow: var(--box-shadow);
      transition: 300ms;
      transform: translateX(-30%);
      opacity: 0;
      pointer-events: none;
      color: ${currentConfig.mainColor};
    }
  `;

  style.innerHTML = css;
  document.head.appendChild(style);
}

async function setupMainWindowPatches(): Promise<void> {
  if (!window.anti_recall) return;

  window.anti_recall.repatchCss(() => {
    void applyCssFromConfig();
  });

  window.anti_recall.recallTip((_evt, msgId) => {
    console.log('[Anti-Recall-Neo]', '尝试反撤回消息ID', msgId);
    void markRecalledById(String(msgId));
  });

  window.anti_recall.recallTipList((_evt, ids) => {
    recalledIds = (ids ?? []).map(String);
    void markRecalledInView();
  });

  await applyCssFromConfig();

  let throttled = false;
  const observer = new MutationObserver(muts => {
    for (const m of muts) {
      if (m.type !== 'childList') continue;
      const first = (m.addedNodes?.[0] as any) as HTMLElement | undefined;
      if (first?.classList?.contains('message-content-recalled')) continue;
      if (throttled) continue;
      throttled = true;
      setTimeout(() => {
        throttled = false;
        void markRecalledInView();
      }, 50);
    }
  });

  const timer = setInterval(() => {
    const msgList = document.querySelector('.ml-list.list');
    if (!msgList) return;
    clearInterval(timer);
    console.log('[Anti-Recall-Neo]', '检测到聊天区域，已在当前页面加载反撤回');
    observer.observe(msgList, { childList: true, subtree: true });
  }, 100);
}

async function markRecalledInView(): Promise<void> {
  const nodes = document.querySelector('.chat-msg-area__vlist')?.querySelectorAll<HTMLElement>('.ml-item');
  if (!nodes) return;

  currentConfig = await getNowConfig();

  for (const item of nodes) {
    const id = item.id;
    if (!id) continue;
    if (!recalledIds.some(x => x === id)) continue;

    try {
      const a = item.querySelector<HTMLElement>(`div[id='${id}-msgContainerMsgContent']`);
      const b = item.querySelector<HTMLElement>(`div[id='${id}-msgContent']`);
      const c = item.querySelector<HTMLElement>(`div[id='ml-${id}']`)?.querySelector<HTMLElement>('.msg-content-container');
      const d = item.querySelector<HTMLElement>(`div[id='ark-msg-content-container_${id}']`);

      if (a) {
        if (a.classList.contains('gray-tip-message')) continue;
        await markRecalled(a);
      } else if (b?.parentElement) {
        if (b.classList.contains('gray-tip-message')) continue;
        await markRecalled(b.parentElement);
      } else if (c?.parentElement) {
        if (c.classList.contains('gray-tip-message')) continue;
        await markRecalled(c.parentElement);
      } else if (d) {
        if (d.classList.contains('gray-tip-message')) continue;
        d.classList.add('recalledNoMargin');
        await markRecalled(d.parentElement ?? d);
      } else {
        let fallback = item.querySelector<HTMLElement>('.msg-content-container');
        if (!fallback) fallback = item.querySelector<HTMLElement>('.file-message--content');
        if (fallback) await markRecalled(fallback);
      }
    } catch (e) {
      console.log('[Anti-Recall-Neo]', '反撤回消息时出错', e);
    }
  }
}

async function markRecalledById(msgId: string): Promise<void> {
  const t = document.getElementById(`${msgId}-msgContainerMsgContent`);
  const p = document.getElementById(`${msgId}-msgContent`);
  const r = document.getElementById(`ml-${msgId}`)?.querySelector<HTMLElement>('.msg-content-container');
  const ark = document.getElementById(`ark-msg-content-container_${msgId}`);

  if (t) {
    if (t.classList.contains('gray-tip-message')) return;
    await markRecalled(t);
    return;
  }

  if (p?.parentElement) {
    if (p.classList.contains('gray-tip-message')) return;
    await markRecalled(p.parentElement);
    return;
  }

  if (r?.parentElement) {
    if (r.classList.contains('gray-tip-message')) return;
    await markRecalled(r.parentElement);
    return;
  }

  if (ark) {
    if (ark.classList.contains('gray-tip-message')) return;
    ark.classList.add('recalledNoMargin');
    await markRecalled(ark.parentElement ?? ark);
    return;
  }

  const bySelector = document.querySelector<HTMLElement>(`.ml-item[id='${msgId}'] .msg-content-container`);
  if (bySelector) await markRecalled(bySelector);
}

async function markRecalled(container: HTMLElement): Promise<void> {
  if (!container) return;

  const existing = container.querySelector('.message-content-recalled');
  if (existing) return;

  container.classList.add('message-content-recalled-parent');
  if (currentConfig.enableTip === true) {
    const tip = document.createElement('div');
    tip.innerText = '已撤回';
    tip.classList.add('message-content-recalled');
    container.appendChild(tip);
    setTimeout(() => {
      tip.style.transform = 'translateX(0)';
      tip.style.opacity = '1';
    }, 5);
  }
}