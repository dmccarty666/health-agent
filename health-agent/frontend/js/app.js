/**
 * Health Agent — App Shell JavaScript
 *
 * Provides: tab switching router, API client, theme toggle,
 * mobile sidebar control, and state management.
 */

(function () {
  'use strict';

  /* ================================================================
   * CONSTANTS
   * ================================================================ */

  var API_BASE_URL = 'http://localhost:8765';
  var THEME_KEY = 'health-agent-theme';

  /* Log API URL on load so user can debug connectivity issues */
  console.log('[health-agent] API_BASE_URL =', API_BASE_URL);
  console.log('[health-agent] If Trends tab fails to load, verify the API server is running at', API_BASE_URL);

  /* Tab definitions — order matches sidebar + mobile nav
   * disabled: true  → grayed-out, not clickable */
  var TABS = [
    { id: 'today',    label: 'Today',    icon: 'layout-dashboard',  section: 'Health',      disabled: false },
    { id: 'body',     label: 'Body',     icon: 'scale',             section: 'Health',      disabled: false },
    { id: 'labs',     label: 'Labs',     icon: 'flask-conical',     section: 'Health',      disabled: true  },
    { id: 'fuel',     label: 'Fuel',     icon: 'utensils',          section: 'Performance', disabled: true  },
    { id: 'training', label: 'Training', icon: 'dumbbell',          section: 'Performance', disabled: true  },
    { id: 'hermes',   label: 'Hermes',   icon: 'sparkles',          section: 'AI',          disabled: true  }
  ];

  /* Sub-tabs for the Body tab */
  var BODY_SUBTABS = [
    { id: 'body-overview', label: 'Overview' },
    { id: 'body-map',      label: 'Body Map' },
    { id: 'body-trends',   label: 'Trends' }
  ];

  /* ================================================================
   * STATE
   * ================================================================ */

  var state = {
    activeTab: 'body',
    activeSubtab: 'body-overview'
  };

  /* ================================================================
   * THEME
   * ================================================================ */

  /** Apply dark or light theme by toggling .dark/.light on <html> */
  function applyTheme(mode) {
    var html = document.documentElement;
    html.classList.remove('dark', 'light');
    if (mode === 'light') {
      html.classList.add('light');
    } else {
      html.classList.add('dark');
    }
    localStorage.setItem(THEME_KEY, mode);
  }

  /** Resolve initial theme: saved pref → system → dark fallback */
  function getInitialTheme() {
    var saved = localStorage.getItem(THEME_KEY);
    if (saved) return saved;
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
      return 'light';
    }
    return 'dark';
  }

  /** Toggle between dark and light */
  function toggleTheme() {
    var current = document.documentElement.classList.contains('light') ? 'light' : 'dark';
    applyTheme(current === 'dark' ? 'light' : 'dark');
    updateThemeIcons();
  }

  /** Show the correct sun/moon icon in the topbar AND sidebar */
  function updateThemeIcons() {
    var isLight = document.documentElement.classList.contains('light');

    /* Topbar icons */
    var sunIcon = document.getElementById('theme-icon-sun');
    var moonIcon = document.getElementById('theme-icon-moon');
    if (sunIcon) sunIcon.style.display = isLight ? 'none' : '';
    if (moonIcon) moonIcon.style.display = isLight ? '' : 'none';

    /* Sidebar icons */
    var sunSidebar = document.getElementById('theme-icon-sun-sidebar');
    var moonSidebar = document.getElementById('theme-icon-moon-sidebar');
    if (sunSidebar) sunSidebar.style.display = isLight ? 'none' : '';
    if (moonSidebar) moonSidebar.style.display = isLight ? '' : 'none';
  }

  /* ================================================================
   * TAB ROUTER
   * ================================================================ */

  /** Switch to a main tab */
  function switchTab(tabId) {
    var tab = TABS.find(function (t) { return t.id === tabId; });
    if (!tab || tab.disabled) return;

    state.activeTab = tabId;

    /* Update sidebar nav items */
    document.querySelectorAll('.sidebar-nav-item').forEach(function (el) {
      var dataTab = el.getAttribute('data-tab');
      if (dataTab === tabId) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    });

    /* Update mobile tabs */
    document.querySelectorAll('.mobile-tab').forEach(function (el) {
      var dataTab = el.getAttribute('data-tab');
      if (dataTab === tabId) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    });

    /* Show/hide tab content panels */
    document.querySelectorAll('.tab-content').forEach(function (el) {
      if (el.getAttribute('data-tab') === tabId) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    });

    /* Update topbar title */
    var titleEl = document.getElementById('topbar-title');
    if (titleEl) titleEl.textContent = tab.label;

    /* Show/hide sub-tab bar (only for Body tab) */
    var subtabBar = document.getElementById('subtab-bar');
    if (subtabBar) {
      subtabBar.style.display = tabId === 'body' ? 'flex' : 'none';
    }

    /* Re-trigger animations on the newly visible tab */
    var activeContent = document.querySelector('.tab-content.active');
    if (activeContent) {
      activeContent.style.animation = 'none';
      void activeContent.offsetHeight; /* force reflow */
      activeContent.style.animation = '';
    }

    /* If Body tab, also activate the first sub-tab */
    if (tabId === 'body') {
      switchSubtab(state.activeSubtab || 'body-overview');
    }
  }

  /** Switch to a sub-tab within the Body tab */
  function switchSubtab(subtabId) {
    state.activeSubtab = subtabId;

    /* Update sub-tab buttons */
    document.querySelectorAll('.subtab-btn').forEach(function (el) {
      if (el.getAttribute('data-subtab') === subtabId) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    });

    /* Show/hide sub-tab content */
    document.querySelectorAll('.subtab-content').forEach(function (el) {
      if (el.getAttribute('data-subtab') === subtabId) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    });

    /* Initialize deferred sub-tab modules */
    if (subtabId === 'body-overview' && window.HealthAgent.bodyOverview) {
      window.HealthAgent.bodyOverview.init();
    } else if (subtabId === 'body-map' && window.HealthAgent.bodyMap) {
      window.HealthAgent.bodyMap.init();
    } else if (subtabId === 'body-trends' && window.HealthAgent.bodyTrends) {
      window.HealthAgent.bodyTrends.init();
    }
  }

  /* ================================================================
   * API CLIENT
   * ================================================================ */

  /**
   * Thin wrapper around fetch() with base URL, JSON parsing,
   * and uniform error handling.
   *
   * @param {string} endpoint — path relative to API_BASE_URL (e.g. '/api/health')
   * @param {object} [options] — fetch options (method, headers, body, etc.)
   * @returns {Promise<object>} parsed JSON response body
   */
  function apiFetch(endpoint, options) {
    options = options || {};
    var url = API_BASE_URL + endpoint;
    var headers = options.headers || {};
    headers['Accept'] = 'application/json';

    if (options.body && typeof options.body === 'object') {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(options.body);
    }

    var fetchOpts = {
      method: options.method || 'GET',
      headers: headers
    };
    if (options.body) fetchOpts.body = options.body;
    if (options.signal) fetchOpts.signal = options.signal;

    return fetch(url, fetchOpts).then(function (response) {
      var contentType = response.headers.get('content-type') || '';
      var isJson = contentType.indexOf('application/json') !== -1;

      if (!response.ok) {
        if (isJson) {
          return response.json().then(function (errBody) {
            var err = new Error(errBody.message || 'API request failed');
            err.status = response.status;
            err.body = errBody;
            throw err;
          });
        }
        var err = new Error('API request failed: ' + response.status);
        err.status = response.status;
        throw err;
      }

      if (response.status === 204) return null;
      return isJson ? response.json() : null;
    });
  }

  /* Convenience methods */
  function apiGet(endpoint) {
    return apiFetch(endpoint, { method: 'GET' });
  }

  function apiPost(endpoint, body) {
    return apiFetch(endpoint, { method: 'POST', body: body });
  }

  /* ================================================================
   * DATA FRESHNESS BADGE
   *
   * Polls the latest Hume measurement and shows a topbar badge:
   *   - green  (< 7d)   → "Live"
   *   - amber  (7-30d)  → "Xd ago"
   *   - red    (> 30d)  → "Xd ago"
   *   - gray   (no data / error) → "no data"
   * ================================================================ */
  var FRESHNESS_REFRESH_MS = 5 * 60 * 1000; // refresh every 5 min
  var FRESHNESS_WARN_DAYS = 7;
  var FRESHNESS_BAD_DAYS = 30;

  function freshnessClass(daysOld) {
    if (daysOld == null) return 'badge-purple';     // unknown / no data
    if (daysOld < FRESHNESS_WARN_DAYS) return 'badge-green';
    if (daysOld < FRESHNESS_BAD_DAYS) return 'badge-amber';
    return 'badge-red';
  }

  function formatAge(daysOld) {
    if (daysOld == null) return 'no data';
    if (daysOld === 0) return 'Live';
    if (daysOld === 1) return '1 day ago';
    return daysOld + ' days ago';
  }

  function setFreshnessBadge(label, klass, tooltip) {
    var badge = document.getElementById('data-freshness-badge');
    var labelEl = document.getElementById('data-freshness-label');
    if (!badge || !labelEl) return;
    // strip any previous color class
    badge.classList.remove('badge-purple', 'badge-green', 'badge-amber', 'badge-red');
    badge.classList.add(klass);
    labelEl.textContent = label;
    if (tooltip != null) badge.setAttribute('title', tooltip);
  }

  function updateDataFreshness() {
    apiGet('/api/health/measurements/latest')
      .then(function (data) {
        if (!data || !data.measured_at) {
          setFreshnessBadge('no data', 'badge-purple', 'No Hume measurements found');
          return;
        }
        var measured = new Date(data.measured_at);
        if (isNaN(measured.getTime())) {
          setFreshnessBadge('no data', 'badge-purple', 'Invalid measured_at: ' + data.measured_at);
          return;
        }
        var now = new Date();
        var days = Math.floor((now - measured) / 86400000);
        var fullDate = measured.toLocaleDateString(undefined, {
          year: 'numeric', month: 'short', day: 'numeric'
        });
        setFreshnessBadge(
          formatAge(days),
          freshnessClass(days),
          'Last Hume weigh-in: ' + fullDate + ' (' + days + ' day' + (days === 1 ? '' : 's') + ' ago)'
        );
      })
      .catch(function (err) {
        console.warn('[health-agent] freshness check failed:', err);
        setFreshnessBadge('offline', 'badge-purple', 'API unreachable: ' + (err.message || err));
      });
  }

  /* ================================================================
   * TOAST / ERROR DISPLAY
   * ================================================================ */

  /**
   * Show a toast notification.
   * @param {string} message — text to display
   * @param {'error'|'info'|'success'} type — toast style
   */
  function showToast(message, type) {
    type = type || 'info';
    var container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    var toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    toast.innerHTML = '<span>' + escapeHtml(message) + '</span>';
    container.appendChild(toast);

    /* Auto-dismiss after 5 s */
    setTimeout(function () {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s';
      setTimeout(function () {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 300);
    }, 5000);
  }

  /** Simple HTML escaping utility */
  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  /* ================================================================
   * LOADING / EMPTY / ERROR STATE HELPERS
   * ================================================================ */

  /**
   * Show a loading spinner inside a target element.
   * @param {string|Element} target — selector or DOM element
   */
  function showLoading(target) {
    var el = resolveElement(target);
    if (!el) return;
    el.innerHTML =
      '<div class="loading-container">' +
      '<i data-lucide="loader-2" class="loading-spinner"></i>' +
      '</div>';
    refreshLucide();
  }

  /**
   * Show an empty state.
   * @param {string|Element} target
   * @param {object} opts — { icon, title, description, actionLabel, onAction }
   */
  function showEmptyState(target, opts) {
    var el = resolveElement(target);
    if (!el) return;
    opts = opts || {};
    var icon = opts.icon || 'inbox';
    var title = opts.title || 'Nothing here yet';
    var desc = opts.description || '';
    var action = opts.actionLabel
      ? '<button class="btn btn-primary" onclick="(' + opts.onAction.toString() + ')()">' +
        escapeHtml(opts.actionLabel) +
        '</button>'
      : '';

    el.innerHTML =
      '<div class="empty-state">' +
      '<div class="empty-state-icon">' +
      '<i data-lucide="' + icon + '" style="width:40px;height:40px;color:white"></i>' +
      '</div>' +
      '<h2 class="empty-state-title">' + escapeHtml(title) + '</h2>' +
      (desc ? '<p class="empty-state-desc">' + escapeHtml(desc) + '</p>' : '') +
      action +
      '</div>';
    refreshLucide();
  }

  /**
   * Show an error banner inside a target element.
   * @param {string|Element} target
   * @param {string} message
   */
  function showError(target, message) {
    var el = resolveElement(target);
    if (!el) return;
    el.innerHTML =
      '<div class="toast toast-error" style="margin:1rem">' +
      '<i data-lucide="alert-triangle" style="width:16px;height:16px;color:#ef4444;flex-shrink:0"></i>' +
      '<span>' + escapeHtml(message) + '</span>' +
      '</div>';
    refreshLucide();
  }

  /** Resolve a selector or element reference */
  function resolveElement(target) {
    if (typeof target === 'string') return document.querySelector(target);
    return target;
  }

  /* ================================================================
   * MOBILE SIDEBAR
   * ================================================================ */

  function openMobileSidebar() {
    var overlay = document.getElementById('mobile-sidebar-overlay');
    var panel = document.getElementById('mobile-sidebar-panel');
    if (overlay) overlay.classList.add('open');
    if (panel) panel.classList.add('open');
  }

  function closeMobileSidebar() {
    var overlay = document.getElementById('mobile-sidebar-overlay');
    var panel = document.getElementById('mobile-sidebar-panel');
    if (overlay) overlay.classList.remove('open');
    if (panel) panel.classList.remove('open');
  }

  /* ================================================================
   * LUCIDE REFRESH
   * ================================================================ */

  function refreshLucide() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  }

  /* ================================================================
   * INITIALIZATION
   * ================================================================ */

  /**
   * Initialize the application shell.
   * NOTE: init() exceeds 75 lines because it must wire up all UI event
   * listeners (sidebar, mobile tabs, sub-tabs, theme toggles, overlays,
   * hamburger menu) in a single deterministic bootstrap sequence before
   * switching to the default tab. Splitting would risk out-of-order
   * initialization and is not justified for this linear setup routine.
   */
  function init() {
    /* 1. Apply theme */
    applyTheme(getInitialTheme());

    /* 2. Wire up sidebar nav items */
    document.querySelectorAll('.sidebar-nav-item').forEach(function (el) {
      el.addEventListener('click', function () {
        var tabId = el.getAttribute('data-tab');
        if (tabId) switchTab(tabId);
        /* Close mobile sidebar after selection */
        closeMobileSidebar();
      });
    });

    /* 3. Wire up mobile tab buttons */
    document.querySelectorAll('.mobile-tab').forEach(function (el) {
      el.addEventListener('click', function () {
        var tabId = el.getAttribute('data-tab');
        if (tabId) switchTab(tabId);
      });
    });

    /* 4. Wire up sub-tab buttons */
    document.querySelectorAll('.subtab-btn').forEach(function (el) {
      el.addEventListener('click', function () {
        var subtabId = el.getAttribute('data-subtab');
        if (subtabId) switchSubtab(subtabId);
      });
    });

    /* 5. Theme toggle buttons */
    var themeToggleTopbar = document.getElementById('theme-toggle-topbar');
    if (themeToggleTopbar) {
      themeToggleTopbar.addEventListener('click', toggleTheme);
    }
    var themeToggleSidebar = document.getElementById('theme-toggle-sidebar');
    if (themeToggleSidebar) {
      themeToggleSidebar.addEventListener('click', toggleTheme);
    }

    /* 6. Mobile sidebar overlay click-to-close */
    var overlay = document.getElementById('mobile-sidebar-overlay');
    if (overlay) {
      overlay.addEventListener('click', closeMobileSidebar);
    }

    /* 7. Mobile sidebar close button */
    var closeBtn = document.getElementById('mobile-sidebar-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', closeMobileSidebar);
    }

    /* 8. Mobile hamburger */
    var hamburger = document.getElementById('mobile-hamburger');
    if (hamburger) {
      hamburger.addEventListener('click', openMobileSidebar);
    }

    /* 9. Activate default tab (Body) */
    switchTab('body');

    /* 10. Update theme icons */
    updateThemeIcons();

    /* 11. Refresh Lucide icons */
    refreshLucide();

    /* 12. Data freshness badge (Hume last sync) */
    updateDataFreshness();
    setInterval(updateDataFreshness, FRESHNESS_REFRESH_MS);
  }

  /* Run on DOMContentLoaded */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* ================================================================
   * PUBLIC API (exposed on window.HealthAgent)
   * ================================================================ */

  window.HealthAgent = {
    switchTab: switchTab,
    switchSubtab: switchSubtab,
    toggleTheme: toggleTheme,
    getActiveTab: function () { return state.activeTab; },
    getActiveSubtab: function () { return state.activeSubtab; },
    api: {
      fetch: apiFetch,
      get: apiGet,
      post: apiPost,
      baseUrl: API_BASE_URL
    },
    ui: {
      showLoading: showLoading,
      showEmptyState: showEmptyState,
      showError: showError,
      showToast: showToast
    }
  };

})();
