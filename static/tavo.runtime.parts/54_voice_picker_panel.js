// GPT-SoVITS Tavo runtime part: 54_voice_picker_panel.js
// Role: settings role rows, voice picker state, preview, paging, and picker guards.
// This fragment is concatenated by static/tavo.runtime.js; it is not a standalone script.
    var pickerState = { rowIdx: -1, tab: "", search: "", page: 1, pageSize: 12, returnPanel: false, panelScrollTop: 0 };
    var pickerPreviewAudio = null;
    var pickerPreviewVoice = "";
    function setLayerHidden(el, hidden) {
      if (!el) return;
      try {
        if (hidden) {
          el.setAttribute('aria-hidden', 'true');
          el.removeAttribute('data-open');
          el.removeAttribute('open');
        } else {
          el.removeAttribute('aria-hidden');
          el.setAttribute('data-open', '1');
          el.setAttribute('open', '');
        }
      } catch (_) {}
    }
    function setPickerHidden(hidden) { setLayerHidden(pickerEl, hidden); }
    function closeVoicePickerForPlayback() {
      stopPickerPreview();
      if (pickerEl) {
        closeDialog(pickerEl);
        setPickerHidden(true);
      }
      pickerState.rowIdx = -1;
      pickerState.returnPanel = false;
    }
    function closeIllegalVoicePicker() {
      if (!pickerEl || !isDialogOpen(pickerEl)) return;
      if (pickerState.returnPanel) return;
      if (isDialogOpen(panel)) return;
      closeVoicePickerForPlayback();
    }
    setPickerHidden(true);
    closeIllegalVoicePicker();
    [0, 80, 240, 700].forEach(function (delay) {
      setTimeout(closeIllegalVoicePicker, delay);
    });

    function renderRoleList() {
      if (!rolesListEl) return;
      // 始终确保前两行常驻槽存在(旁白/用户),即使旧数据丢失也补齐
      cfg.roleVoiceList = cfg.roleVoiceList || [];
      while (cfg.roleVoiceList.length < RESERVED_ROLES.length) {
        cfg.roleVoiceList.push({ role: RESERVED_ROLES[cfg.roleVoiceList.length] || "", voice: "" });
      }
      cfg.roleVoiceList = normalizeRoleVoiceList(cfg.roleVoiceList, cfg.currentCharacterName);
      var list = cfg.roleVoiceList;
      // 渲染前同步用户当前在输入框里的值,避免重渲染清空未保存输入
      var rows = $all(panel, '.idx-role-row');
      rows.forEach(function (row, i) {
        var nameEl = first(row, '.idx-role-name');
        if (nameEl && list[i]) list[i].role = String(nameEl.value || "").trim();
      });
      rolesListEl.innerHTML = renderRoleRowsHtml(list, RESERVED_ROLES);
      $all(rolesListEl, '.idx-role-row').forEach(function (row) {
        var idx = Number(row.dataset.rowIdx);
        var nameEl = first(row, '.idx-role-name');
        var voiceBtn = first(row, '.idx-voice-btn');
        var delBtn = first(row, '.idx-role-del');  // protected 行没有这个元素,first 返回 null,on 跳过
        on(nameEl, 'input', function () {
          if (!cfg.roleVoiceList[idx]) cfg.roleVoiceList[idx] = { role: "", voice: "" };
          cfg.roleVoiceList[idx].role = String(nameEl.value || "").trim();
        });
        on(nameEl, 'change', function () { saveConfig(cfg, characterId).catch(function(){}); });
        on(voiceBtn, 'click', function (e) { e.preventDefault(); e.stopPropagation(); openVoicePicker(idx).catch(function (err) { setError(err && err.message ? err.message : String(err)); }); });
        on(delBtn, 'click', function (e) {
          e.preventDefault(); e.stopPropagation();
          if (cfg.roleVoiceList && cfg.roleVoiceList[idx] !== undefined) {
            cfg.roleVoiceList.splice(idx, 1);
            renderRoleList();
          }
        });
      });
    }

    function nextNewRoleName() {
      var used = {};
      (cfg.roleVoiceList || []).forEach(function (r) {
        var role = String((r && r.role) || "").trim();
        if (role) used[role] = true;
      });
      var n = 1;
      while (used["新角色" + n]) n += 1;
      return "新角色" + n;
    }

    function focusLastEditableRole() {
      setTimeout(function () {
        var rows = $all(rolesListEl, '.idx-role-row');
        for (var i = rows.length - 1; i >= 0; i -= 1) {
          var nameEl = first(rows[i], '.idx-role-name');
          if (nameEl && !nameEl.readOnly) {
            nameEl.focus();
            try { nameEl.select(); } catch (_) {}
            return;
          }
        }
      }, 0);
    }

    function addRoleRow() {
      cfg.roleVoiceList = cfg.roleVoiceList || [];
      // 前两槽位是 reserved,addRoleRow 总是在末尾追加新可删行
      cfg.roleVoiceList.push({ role: nextNewRoleName(), voice: "" });
      renderRoleList();
      focusLastEditableRole();
    }

    function setRowVoice(idx, voiceName) {
      if (!cfg.roleVoiceList[idx]) cfg.roleVoiceList[idx] = { role: "", voice: "" };
      cfg.roleVoiceList[idx].voice = voiceName;
      renderRoleList();
    }

    async function openVoicePicker(rowIdx) {
      if (!pickerEl) return;
      if (!isDialogOpen(panel)) {
        closeVoicePickerForPlayback();
        try { console.warn("[GPT-SoVITS TAVO] blocked voice picker because settings panel is closed"); } catch (_) {}
        return;
      }
      pickerState.rowIdx = rowIdx;
      pickerState.tab = "";
      pickerState.search = "";
      pickerState.page = 1;
      pickerState.pageSize = (window.matchMedia && window.matchMedia("(max-width:520px)").matches) ? 8 : 12;
      pickerState.returnPanel = isDialogOpen(panel);
      pickerState.panelScrollTop = panel ? Number(panel.scrollTop || 0) : 0;
      if (pickerSearchEl) pickerSearchEl.value = "";
      if (pickerTabsEl) pickerTabsEl.innerHTML = "";
      if (pickerGridEl) pickerGridEl.innerHTML = renderPickerMessageHtml("正在读取音色…", "muted");
      if (pickerPageEl) pickerPageEl.textContent = "读取中";
      if (pickerState.returnPanel) closeDialog(panel);
      setPickerHidden(false);
      openDialog(pickerEl);
      try {
        await ensureVoicesLoaded();
      } catch (e) {
        if (pickerGridEl) pickerGridEl.innerHTML = renderPickerMessageHtml("音色列表读取失败", "error");
        setStatus("音色列表读取失败");
        setError(e && e.message ? e.message : String(e));
        return;
      }
      renderPickerTabs();
      renderPickerGrid();
    }
    function closeVoicePicker() {
      stopPickerPreview();
      if (pickerEl) {
        closeDialog(pickerEl);
        setPickerHidden(true);
      }
      if (pickerState.returnPanel) {
        openDialog(panel);
        setTimeout(function () {
          try { panel.scrollTop = pickerState.panelScrollTop || 0; } catch (_) {}
        }, 0);
      }
      pickerState.rowIdx = -1;
      pickerState.returnPanel = false;
    }
    function updatePickerPreviewClasses() {
      try {
        $all(pickerGridEl, '.idx-picker-item').forEach(function (item) {
          item.classList.toggle('is-playing', !!pickerPreviewVoice && item.dataset.voice === pickerPreviewVoice);
        });
      } catch (_) {}
    }
    function stopPickerPreview() {
      pickerPreviewVoice = "";
      if (pickerPreviewAudio) {
        try { pickerPreviewAudio.pause(); } catch (_) {}
        try { pickerPreviewAudio.removeAttribute("src"); pickerPreviewAudio.load(); } catch (_) {}
      }
      updatePickerPreviewClasses();
    }
    function previewPickerVoice(voiceName) {
      voiceName = String(voiceName || "").trim();
      if (!voiceName) return;
      if (!pickerPreviewAudio) {
        try {
          pickerPreviewAudio = document.createElement("audio");
          pickerPreviewAudio.preload = "none";
          pickerPreviewAudio.addEventListener("ended", function () { pickerPreviewVoice = ""; updatePickerPreviewClasses(); });
          pickerPreviewAudio.addEventListener("error", function () {
            debugLog("⚠️ 音色试听失败: " + voiceName, "#fc9");
            pickerPreviewVoice = "";
            updatePickerPreviewClasses();
          });
        } catch (e) {
          debugLog("⚠️ 当前 WebView 不支持音色试听 audio: " + (e && e.message ? e.message : e), "#fc9");
          return;
        }
      }
      if (pickerPreviewVoice === voiceName && !pickerPreviewAudio.paused) {
        stopPickerPreview();
        return;
      }
      pickerPreviewVoice = voiceName;
      updatePickerPreviewClasses();
      try {
        pickerPreviewAudio.pause();
        pickerPreviewAudio.src = cleanBase(cfg.apiBase) + "/voice_preview?name=" + encodeURIComponent(voiceName) + "&t=" + Date.now();
        pickerPreviewAudio.currentTime = 0;
        var p = pickerPreviewAudio.play();
        if (p && typeof p.catch === "function") {
          p.catch(function (e) {
            debugLog("⚠️ 音色试听 play() 失败: " + (e && e.message ? e.message : e), "#fc9");
            pickerPreviewVoice = "";
            updatePickerPreviewClasses();
          });
        }
        setStatus("试听音色：" + voiceName);
      } catch (e) {
        debugLog("⚠️ 音色试听失败: " + (e && e.message ? e.message : e), "#fc9");
        pickerPreviewVoice = "";
        updatePickerPreviewClasses();
      }
    }
    function pickerSubdirs() {
      var set = {};
      (availableVoices || []).forEach(function (v) { set[v.subdir || ""] = true; });
      return Object.keys(set).filter(function (s) { return !!s; }).sort(function (a, b) {
        var ra = voiceCategoryRank(a), rb = voiceCategoryRank(b);
        if (ra !== rb) return ra - rb;
        return a.localeCompare(b, "zh-Hans-CN");
      });
    }
    function renderPickerTabs() {
      if (!pickerTabsEl) return;
      var subs = pickerSubdirs();
      pickerTabsEl.innerHTML = renderPickerTabsHtml(pickerState.tab, subs);
      $all(pickerTabsEl, '.idx-picker-tab').forEach(function (btn) {
        on(btn, 'click', function () {
          pickerState.tab = btn.dataset.tab || "";
          pickerState.page = 1;
          renderPickerTabs();
          renderPickerGrid();
        });
      });
    }
    function pickerFiltered() {
      var q = String(pickerState.search || "").toLowerCase().trim();
      return (availableVoices || []).filter(function (v) {
        var sd = v.subdir || "";
        if (pickerState.tab === "__root__") { if (sd) return false; }
        else if (pickerState.tab && sd !== pickerState.tab) return false;
        if (q && v.name.toLowerCase().indexOf(q) < 0) return false;
        return true;
      });
    }
    function renderPickerGrid() {
      if (!pickerGridEl) return;
      var filtered = pickerFiltered();
      var totalPages = Math.max(1, Math.ceil(filtered.length / pickerState.pageSize));
      if (pickerState.page > totalPages) pickerState.page = totalPages;
      var start = (pickerState.page - 1) * pickerState.pageSize;
      var page = filtered.slice(start, start + pickerState.pageSize);
      var selectedVoice = "";
      if (pickerState.rowIdx === -2) selectedVoice = cfg.defaultVoice || "";
      else if (pickerState.rowIdx >= 0 && cfg.roleVoiceList && cfg.roleVoiceList[pickerState.rowIdx]) selectedVoice = cfg.roleVoiceList[pickerState.rowIdx].voice || "";
      pickerGridEl.innerHTML = renderPickerGridHtml(page, selectedVoice);
      $all(pickerGridEl, '.idx-picker-item').forEach(function (item) {
        var apply = first(item, '[data-action="apply"]');
        var voiceName = item.dataset.voice;
        function applyVoice() {
          if (pickerState.rowIdx === -2) {
            cfg.defaultVoice = voiceName;
            var defBtn = first(panel, '[data-role="default-voice-btn"]');
            if (defBtn) defBtn.textContent = voiceName;
            saveConfig(cfg, characterId).catch(function(){});
          } else if (pickerState.rowIdx >= 0) {
            setRowVoice(pickerState.rowIdx, voiceName);
            saveConfig(cfg, characterId).catch(function(){});
          }
          stopPickerPreview();
          closeVoicePicker();
        }
        // 点 item 主体 = 试听；只有点右侧 ✓ 才应用到默认音色/角色映射。
        on(item, 'click', function (e) {
          if (e.target && e.target.closest && e.target.closest('[data-action="apply"]')) return;
          e.preventDefault();
          previewPickerVoice(voiceName);
        });
        on(apply, 'click', function (e) { e.preventDefault(); e.stopPropagation(); applyVoice(); });
      });
      updatePickerPreviewClasses();
      if (pickerPageEl) pickerPageEl.textContent = filtered.length ? (pickerState.page + ' / ' + totalPages + ' · 共 ' + filtered.length + ' 条') : '无结果';
      if (pickerPrevEl) pickerPrevEl.disabled = pickerState.page <= 1;
      if (pickerNextEl) pickerNextEl.disabled = pickerState.page >= totalPages;
    }
    // 绑定 picker 的全局事件(close / search / pager)
    // 注意:picker 已经移到 panel 外、跟 panel 平级了,picker-close 在 picker 内,从 pickerEl 查找
    var pickerCloseBtn = first(pickerEl, '.idx-picker-close');
    function handlePickerClose(e) {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
      }
      closeVoicePicker();
    }
    ['pointerup', 'touchend', 'mouseup', 'click'].forEach(function (type) {
      if (pickerCloseBtn) pickerCloseBtn.addEventListener(type, handlePickerClose, true);
    });
    function pickerEventPoint(e) {
      var p = e;
      try {
        if (e && e.touches && e.touches.length) p = e.touches[0];
        else if (e && e.changedTouches && e.changedTouches.length) p = e.changedTouches[0];
      } catch (_) {}
      return { x: Number((p && p.clientX) || 0), y: Number((p && p.clientY) || 0) };
    }
    function stopPickerEvent(e) {
      if (!e) return;
      try { e.preventDefault(); } catch (_) {}
      try { e.stopPropagation(); } catch (_) {}
      try { if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation(); } catch (_) {}
    }
    function pointInPickerCloseHotspot(e) {
      if (!pickerEl || !isDialogOpen(pickerEl)) return false;
      try {
        var r = pickerEl.getBoundingClientRect();
        var p = pickerEventPoint(e);
        return p.x >= r.right - 84 && p.x <= r.right + 16 && p.y >= r.top - 16 && p.y <= r.top + 86;
      } catch (_) { return false; }
    }
    function installPickerDocumentGuard() {
      if (!pickerEl || pickerEl.__idxPickerDocumentGuardInstalled) return;
      pickerEl.__idxPickerDocumentGuardInstalled = true;
      ['pointerdown', 'touchstart', 'mousedown', 'click'].forEach(function (type) {
        document.addEventListener(type, function (e) {
          if (!pickerEl || !isDialogOpen(pickerEl)) return;
          var target = e && e.target;
          var insidePicker = !!(target && target.closest && target.closest('.idx-picker') === pickerEl);
          if (!pickerState.returnPanel && !isDialogOpen(panel)) {
            stopPickerEvent(e);
            closeVoicePickerForPlayback();
            try { console.warn('[GPT-SoVITS TAVO] closed illegal voice picker before event passthrough'); } catch (_) {}
            return;
          }
          if (pointInPickerCloseHotspot(e)) {
            stopPickerEvent(e);
            closeVoicePicker();
            return;
          }
          if (!insidePicker && pickerState.returnPanel) {
            stopPickerEvent(e);
            closeVoicePicker();
          }
        }, true);
      });
    }
    installPickerDocumentGuard();
    on(pickerSearchEl, 'input', function () { pickerState.search = pickerSearchEl.value || ""; pickerState.page = 1; renderPickerGrid(); });
    on(pickerPrevEl, 'click', function () { if (pickerState.page > 1) { pickerState.page--; renderPickerGrid(); } });
    on(pickerNextEl, 'click', function () { pickerState.page++; renderPickerGrid(); });
    // panel 内按钮统一用事件代理 —— 避免 dialog 内部事件路由怪问题 + renderRoleList 重渲染不丢绑定
    on(panel, 'click', function (e) {
      var t = e.target; if (!t || !t.closest) return;
      if (t.closest('[data-role="add-role"]')) { e.preventDefault(); addRoleRow(); return; }
      if (t.closest('[data-role="default-voice-btn"]')) { e.preventDefault(); openVoicePicker(-2).catch(function (err) { setError(err && err.message ? err.message : String(err)); }); return; }
      var roleRow = t.closest('.idx-role-row');
      if (roleRow) {
        var idx = Number(roleRow.dataset.rowIdx);
        if (t.closest('.idx-role-del')) { e.preventDefault(); if (cfg.roleVoiceList && cfg.roleVoiceList[idx] !== undefined) { cfg.roleVoiceList.splice(idx, 1); renderRoleList(); } return; }
        if (t.closest('.idx-voice-btn')) { e.preventDefault(); openVoicePicker(idx).catch(function (err) { setError(err && err.message ? err.message : String(err)); }); return; }
      }
    });
