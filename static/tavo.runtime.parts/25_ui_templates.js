// GPT-SoVITS Tavo runtime part: 25_ui_templates.js
// Role: behavior-equivalent DOM templates for player shell and runtime lazy shell.
// This fragment is concatenated by static/tavo.runtime.js; it is not a standalone script.

  function renderFullPlayerShell(root) {
    root.innerHTML = [
      '<div class="idx-card">',
      '  <button class="idx-gear" type="button" data-role="gear" aria-label="设置">' + gearIcon() + '</button>',
      '  <div class="idx-card-counter" data-role="counter">0/0</div>',
      '  <div class="idx-top"><div class="idx-cover" data-role="cover"></div><div class="idx-info"><div class="idx-title-row"><div class="idx-name" data-role="title"></div></div><div class="idx-status" data-role="status">选择音色后点播放</div></div></div>',
      '  <div class="idx-seek-wrap"><input class="idx-seek" data-role="seek" type="range" min="0" max="1000" value="0" disabled><div class="idx-time"><span data-role="current">00:00</span><span data-role="total">--:--</span></div></div>',
      '  <div class="idx-subtitle" data-role="subtitle"><div class="idx-sub-notice"><strong>准备生成语音</strong><span>点播放开始生成音频</span></div></div>',
      '  <div class="idx-controls"><button class="idx-ctrl idx-ctrl-sm" type="button" data-role="prev" aria-label="上一条历史音频" title="上一条历史音频"><svg viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6 8.5 6V6z"/></svg></button><button class="idx-ctrl idx-ctrl-main" type="button" data-role="play" data-state="idle" aria-label="播放">' + playIcon("idle") + '</button><button class="idx-ctrl idx-ctrl-sm" type="button" data-role="next" aria-label="下一条历史音频" title="下一条历史音频"><svg viewBox="0 0 24 24"><path d="M16 6h2v12h-2zm-10.5 0v12l8.5-6z"/></svg></button><button class="idx-ctrl idx-ctrl-add" type="button" data-role="add" aria-label="生成音频" title="生成音频"><svg viewBox="0 0 24 24"><path d="M12 3v9.55A4 4 0 1 0 14 16V7h4V3z"/></svg></button><button class="idx-ctrl idx-ctrl-delete" type="button" data-role="delete" aria-label="删除当前音频" title="删除当前音频"><svg viewBox="0 0 24 24"><path d="M9 3h6l1 2h4v2H4V5h4l1-2zm1 6h2v8h-2V9zm4 0h2v8h-2V9zM7 9h2v8H7V9zm1 11c-1.1 0-2-.9-2-2V8h12v10c0 1.1-.9 2-2 2H8z"/></svg></button><button class="idx-live-exit idx-hidden" type="button" data-role="live-exit">退出流式</button></div>',
      '  <dialog class="idx-panel" data-role="panel">'
        + '<div class="idx-panel-head"><div class="idx-panel-title">语音设置</div><button class="idx-close" type="button" data-role="close">×</button></div>'
        + '<div class="idx-section-title">播放模式</div>'
        + '<div class="idx-modes"><button class="idx-mode" data-mode="single" type="button"><strong>单音色</strong><span>整段用当前音色</span></button><button class="idx-mode" data-mode="ai8" type="button"><strong>多音色</strong><span>AI 拆旁白/人物</span></button></div>'
        + '<div class="idx-section-title">合成质量</div>'
        + '<div class="idx-grid">'
          + '<label class="idx-field"><span class="idx-label">合成档位</span><select class="idx-input" data-field="qualityMode"><option value="fast">极速/预览</option><option value="balanced">标准</option><option value="expressive">质量优先</option><option value="ultra">极限质量</option></select></label>'
          + '<label class="idx-field"><span class="idx-label">播放语速</span><input class="idx-input" type="number" min="0.85" max="1.25" step="0.01" data-field="speedFactor" placeholder="1.00"></label>'
        + '</div>'
        + '<div class="idx-section-title">播放缓存</div>'
        + '<label class="idx-check"><input type="checkbox" data-field="offlineAudioEnabled"><span><strong>保存到本机缓存</strong><span>已保存音频写入本机，下次优先读取本机缓存。</span></span></label>'
        // 单音色模式专属 —— mode==="single" 时显示
        + '<div class="idx-single-only"><div class="idx-section-title">音色选择</div><div class="idx-default-voice"><button class="idx-voice-btn" type="button" data-role="default-voice-btn">选择音色…</button></div></div>'
        // 多音色拆段专属 —— mode==="ai8" 时显示；切换不清空（输入值在 readFields 时已存入 cfg）
        + '<div class="idx-ai8-only">'
          + '<div class="idx-section-title">角色音色映射</div>'
          + '<div class="idx-roles" data-role="roles-list"></div>'
          + '<button class="idx-add-role" type="button" data-role="add-role">+ 添加角色</button>'
          + '<details class="idx-llm-details"><summary>LLM 配置</summary><div class="idx-grid">'
            + '<label class="idx-field idx-wide"><span class="idx-label">LLM 接口地址（写到 /v1 即可，会自动补全 /chat/completions）</span><input class="idx-input" data-field="llmEndpoint" placeholder="http://127.0.0.1:8317/v1"></label>'
            + '<label class="idx-field"><span class="idx-label">LLM 模型</span><input class="idx-input" data-field="llmModel" placeholder="渡鸦/grok-4.20-fast"></label>'
            + '<label class="idx-field"><span class="idx-label">LLM Key（留空则用后端本机配置）</span><input class="idx-input" type="password" data-field="llmApiKey" placeholder="sk-..."></label>'
          + '</div></details>'
          + '<label class="idx-check"><input type="checkbox" data-field="reuseLlmParse"><span><strong>复用 LLM 拆段</strong><span>同一消息只换音色或参数时，不重新请求 LLM。</span></span></label>'
        + '</div>'
        + '<div class="idx-actions"><button class="idx-btn" type="button" data-role="save">保存</button></div>'
        + '</dialog>'
        // 音色选择器:模态弹窗,走原生 dialog top-layer,跟设置面板同级
        + '<dialog class="idx-picker" data-role="voice-picker">'
          + '<div class="idx-picker-head"><div class="idx-picker-title">选择音色</div><button class="idx-picker-close" type="button">×</button></div>'
          + '<div class="idx-picker-tabs" data-role="picker-tabs"></div>'
          + '<input class="idx-input idx-picker-search" type="text" placeholder="搜索音色名…" data-role="picker-search">'
          + '<div class="idx-picker-grid" data-role="picker-grid"></div>'
          + '<div class="idx-picker-pager"><button type="button" data-role="picker-prev">‹</button><span data-role="picker-page">1 / 1</span><button type="button" data-role="picker-next">›</button></div>'
        + '</dialog>',
      '  <audio data-role="audio" preload="none"></audio><div class="idx-error idx-hidden" data-role="error"></div>',
      '</div>'
    ].join("");
  }

  function renderRuntimeLazyShell(root, characterName, latest, historyCount, resumeSec) {
    root.innerHTML = [
      '<div class="idx-lazy-card" data-role="lazy-card">',
      '  <button class="idx-lazy-play" type="button" data-role="lazy-play" aria-label="播放">' + playIcon("idle") + '</button>',
      '  <button class="idx-lazy-gear" type="button" data-role="lazy-gear" aria-label="设置">' + gearIcon() + '</button>',
      '  <div class="idx-lazy-main" data-role="lazy-open" role="button" tabindex="0">',
      '    <div class="idx-lazy-title">' + escapeHtml(characterName) + '</div>',
      '    <div class="idx-lazy-status">' + (latest ? ('历史音频 ' + historyCount + ' 条 · ' + formatTime(resumeSec)) : '历史音频 0 条 · 点开播放器') + '</div>',
      '    <div class="idx-lazy-progress"><span style="width:' + (latest && latest.duration_s ? Math.max(2, Math.min(100, resumeSec / Number(latest.duration_s || 1) * 100)) : 0) + '%"></span></div>',
      '  </div>',
      '</div>'
    ].join("");
  }

  function renderSubtitleNoticeHtml(titleText, detailText) {
    return '<div class="idx-sub-notice"><strong>' + escapeHtml(titleText || "") + '</strong>' + (detailText ? '<span>' + escapeHtml(detailText) + '</span>' : '') + '</div>';
  }

  function renderSubtitleRowsHtml(timeline, displayRoleNameFn) {
    return (timeline || []).map(function (row, idx) {
      var text = String(row.text || "");
      var roleName = displayRoleNameFn ? displayRoleNameFn(row.role || "旁白") : (row.role || "旁白");
      return '<div class="idx-sub-row" data-idx="' + idx + '" data-start="' + row.start.toFixed(3) + '" data-role-name="' + escapeHtml(roleName) + '" title="点击跳转到这一句">'
        + '<span class="idx-sub-text">' + escapeHtml(text) + '</span>'
        + '</div>';
    }).join("");
  }

  function renderRoleRowsHtml(list, reservedRoles) {
    var protectedCount = (reservedRoles || []).length;
    return (list || []).map(function (item, idx) {
      var role = String(item.role || "");
      var voice = String(item.voice || "");
      var protectedRow = idx < protectedCount;
      return ''
        + '<div class="idx-role-row' + (protectedRow ? ' idx-role-protected' : '') + '" data-row-idx="' + idx + '" data-voice="' + escapeHtml(voice) + '">'
        + '<input class="idx-role-name" type="text" placeholder="角色名" value="' + escapeHtml(role) + '"' + (protectedRow ? ' readonly' : '') + '>'
        + '<button class="idx-voice-btn" type="button">' + escapeHtml(voice || "选择音色…") + '</button>'
        + (protectedRow
            ? '<span class="idx-role-lock" title="常驻角色,不可删除">🔒</span>'
            : '<button class="idx-role-del" type="button" title="删除">×</button>')
        + '</div>';
    }).join("");
  }

  function renderPickerMessageHtml(text, tone) {
    var color = tone === "error" ? "rgba(255,213,221,.82)" : (tone === "empty" ? "rgba(238,231,244,.5)" : "rgba(238,231,244,.58)");
    return '<div style="grid-column:1/-1;padding:20px;text-align:center;color:' + color + ';font-size:12px">' + escapeHtml(text || "") + '</div>';
  }

  function renderPickerTabsHtml(activeTab, subs) {
    var tabs = ['<button class="idx-picker-tab' + (activeTab === "" ? " is-active" : "") + '" data-tab="">全部</button>'];
    (subs || []).forEach(function (s) {
      tabs.push('<button class="idx-picker-tab' + (activeTab === s ? " is-active" : "") + '" data-tab="' + escapeHtml(s) + '">' + escapeHtml(s) + '</button>');
    });
    tabs.push('<button class="idx-picker-tab' + (activeTab === "__root__" ? " is-active" : "") + '" data-tab="__root__">未分类</button>');
    return tabs.join("");
  }

  function renderPickerGridHtml(page, selectedVoice) {
    page = page || [];
    if (!page.length) return renderPickerMessageHtml("没有匹配的音色", "empty");
    return page.map(function (v) {
      var sd = v.subdir || "";
      var selected = v.name === selectedVoice;
      return '<div class="idx-picker-item' + (selected ? ' is-selected' : '') + '" data-voice="' + escapeHtml(v.name) + '" title="试听此音色">'
        + '<div class="idx-picker-item-info">'
          + '<span class="idx-picker-item-name">' + escapeHtml(v.name.split("/").pop()) + '</span>'
          + (sd ? '<span class="idx-picker-item-sub">' + escapeHtml(sd) + '</span>' : '')
        + '</div>'
        + '<span class="idx-picker-wave" aria-hidden="true"><i></i><i></i><i></i></span>'
        + '<span class="idx-picker-selected" aria-hidden="true">✓</span>'
        + '<button class="idx-picker-apply" type="button" data-action="apply" title="应用此音色" aria-label="应用">✓</button>'
        + '</div>';
    }).join("");
  }
