(function () {
  'use strict';

  const API_BASE = getApiBase();

  function getApiBase() {
    const configuredBase = window.DEWILLIAMS_API_BASE || 'https://toptowertechnologies.com/api/';
    return configuredBase.endsWith('/') ? configuredBase : configuredBase + '/';
  }

  function qs(selector, root = document) { return root.querySelector(selector); }
  function qsa(selector, root = document) { return Array.from(root.querySelectorAll(selector)); }

  function money(value) {
    return '₦' + Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function toQuery(params = {}) {
    const query = new URLSearchParams();
    Object.keys(params).forEach(key => {
      const value = params[key];
      if (value !== undefined && value !== null && String(value) !== '') query.append(key, value);
    });
    return query.toString();
  }

  async function apiRequest(endpoint, options = {}) {
    const hasBody = Object.prototype.hasOwnProperty.call(options, 'body');
    const requestOptions = Object.assign({
      headers: hasBody ? { 'Content-Type': 'application/json' } : {}
    }, options);

    let response;
    try {
      response = await fetch(API_BASE + endpoint, requestOptions);
    } catch (error) {
      throw new Error('Server connection failed. Please confirm the API is online at ' + API_BASE);
    }

    const rawText = await response.text();
    let result = {};
    try {
      result = rawText ? JSON.parse(rawText) : {};
    } catch (error) {
      console.error('Raw server response:', rawText);
      throw new Error('Invalid server response. Check your PHP server console for errors.');
    }

    if (!response.ok || result.success !== true) {
      throw new Error(result.message || 'Request failed.');
    }

    return result;
  }

  async function api(endpoint, options = {}) {
    const result = await apiRequest(endpoint, options);
    return result.data;
  }

  function getUser() {
    try { return JSON.parse(localStorage.getItem('dw_user') || 'null'); }
    catch (error) { return null; }
  }

  function setUser(user) { localStorage.setItem('dw_user', JSON.stringify(user)); }
  function user() { return getUser(); }

  function setFlash(message, title = 'Notice', type = 'info') {
    sessionStorage.setItem('dw_flash', JSON.stringify({ message, title, type }));
  }

  async function showFlashIfAny() {
    const raw = sessionStorage.getItem('dw_flash');
    if (!raw) return;
    sessionStorage.removeItem('dw_flash');
    try {
      const flash = JSON.parse(raw);
      await notify(flash.message, flash.title, flash.type);
    } catch (error) {}
  }

  function cleanStatus(status = '') {
    const labels = {
      pending_reservation: 'pending',
      partial_reservation: 'partial reservation',
      reserved: 'reserved',
      checked_in: 'checked in',
      checked_out: 'checked out',
      due_checkout: 'due checkout',
      expired: 'expired',
      out_of_service: 'out of service',
      vacant: 'vacant',
      super_admin: 'super admin',
      frontdesk: 'frontdesk',
      accountant: 'accountant'
    };
    return labels[status] || String(status || '').replace(/_/g, ' ');
  }

  function statusLabel(status = '') {
    return `<span class="status ${escapeHtml(status)}">${escapeHtml(cleanStatus(status))}</span>`;
  }

  function protect(allowedRoles = []) {
    const currentUser = getUser();
    if (!currentUser) {
      window.location.replace('login.html');
      return null;
    }
    if (allowedRoles.length && !allowedRoles.includes(currentUser.role)) {
      window.location.replace('dashboard.html');
      return null;
    }
    qsa('[data-user]').forEach(element => {
      element.textContent = `${currentUser.name} · ${cleanStatus(currentUser.role)}`;
    });
    applyRole(currentUser.role);
    return currentUser;
  }

  function applyRole(role) {
    if (role === 'accountant') {
      qsa('[data-no-accountant]').forEach(element => element.remove());
    }
  }

  function logout() {
    localStorage.removeItem('dw_user');
    window.location.replace('login.html');
  }

  function setActive() {
    qsa('.nav a').forEach(link => {
      const href = link.getAttribute('href');
      if (href && window.location.pathname.endsWith(href)) link.classList.add('active');
    });
  }

  async function loadSidebar(allowedRoles = []) {
    const sidebar = qs('#side');
    const currentUser = protect(allowedRoles);
    if (!currentUser) return null;

    if (!sidebar) return currentUser;

    try {
      const response = await fetch('_sidebar.html', { cache: 'no-store' });
      if (!response.ok) throw new Error('Sidebar failed to load');
      sidebar.innerHTML = await response.text();
      qsa('[data-user]').forEach(element => {
        element.textContent = `${currentUser.name} · ${cleanStatus(currentUser.role)}`;
      });
      applyRole(currentUser.role);
      setActive();
      return currentUser;
    } catch (error) {
      await notify('The admin sidebar could not load. Please open the project through php -S localhost:8000, not by double-clicking the HTML file.', 'Sidebar Error', 'error');
      return currentUser;
    }
  }

  function ensureModalHost() {
    let host = qs('#modalHost');
    if (!host) {
      host = document.createElement('div');
      host.id = 'modalHost';
      document.body.appendChild(host);
    }
    return host;
  }

  function showModal({ title = 'Notice', message = '', html = '', type = 'info', confirm = false, okText = '', cancelText = 'Cancel' } = {}) {
    return new Promise(resolve => {
      const host = ensureModalHost();
      host.innerHTML = '';

      const modal = document.createElement('div');
      modal.className = 'modal is-open';
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
      modal.innerHTML = `
        <div class="modal-content modal-${escapeHtml(type)}">
          <button class="modal-x" type="button" aria-label="Close">&times;</button>
          <h2>${escapeHtml(title)}</h2>
          <div class="modal-message">${html || `<p>${escapeHtml(message).replace(/\n/g, '<br>')}</p>`}</div>
          <div class="modal-actions">
            ${confirm ? `<button class="btn ghost" type="button" data-modal-cancel>${escapeHtml(cancelText)}</button>` : ''}
            <button class="btn gold" type="button" data-modal-ok>${escapeHtml(okText || (confirm ? 'Confirm' : 'OK'))}</button>
          </div>
        </div>`;
      host.appendChild(modal);

      const close = value => { host.innerHTML = ''; resolve(value); };
      qs('[data-modal-ok]', modal).addEventListener('click', () => close(true));
      qs('.modal-x', modal).addEventListener('click', () => close(false));
      const cancelBtn = qs('[data-modal-cancel]', modal);
      if (cancelBtn) cancelBtn.addEventListener('click', () => close(false));
      modal.addEventListener('click', event => { if (event.target === modal) close(false); });
    });
  }

  function notify(message, title = 'Notice', type = 'info') {
    return showModal({ title, message, type });
  }

  function askConfirm(message = 'Continue?', title = 'Confirm Action') {
    return showModal({ title, message, type: 'confirm', confirm: true });
  }

  function showFormModal({ title = 'Form', html = '', okText = 'Confirm' } = {}) {
    return new Promise(resolve => {
      const host = ensureModalHost();
      host.innerHTML = '';
      const modal = document.createElement('div');
      modal.className = 'modal is-open';
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
      modal.innerHTML = `
        <div class="modal-content modal-form">
          <button class="modal-x" type="button" aria-label="Close">&times;</button>
          <h2>${escapeHtml(title)}</h2>
          <div class="modal-message">${html}</div>
          <div class="modal-actions">
            <button class="btn ghost" type="button" data-modal-cancel>Cancel</button>
            <button class="btn gold" type="button" data-modal-submit>${escapeHtml(okText)}</button>
          </div>
        </div>`;
      host.appendChild(modal);

      const close = value => { host.innerHTML = ''; resolve(value); };
      qs('[data-modal-submit]', modal).addEventListener('click', () => {
        const values = {};
        qsa('input, select, textarea', modal).forEach(field => {
          values[field.name || field.id] = field.type === 'checkbox' ? field.checked : field.value;
        });
        close(values);
      });
      qs('[data-modal-cancel]', modal).addEventListener('click', () => close(null));
      qs('.modal-x', modal).addEventListener('click', () => close(null));
      modal.addEventListener('click', event => { if (event.target === modal) close(null); });
    });
  }

  function downloadReport() {
    const from = qs("#from")?.value || "";
    const to = qs("#to")?.value || "";
    const isRevenuePage = window.location.pathname.endsWith("revenue.html");

    window.location.href = API_BASE + "reports.php?" + toQuery({
      from,
      to,
      type: isRevenuePage ? "revenue" : "bookings"
    });
  }

  window.addEventListener('error', event => {
    console.error(event.error || event.message);
    if (document.body && typeof notify === 'function') notify(event.message || 'A page error occurred.', 'Page Error', 'error');
  });

  window.addEventListener('unhandledrejection', event => {
    console.error(event.reason);
    if (document.body && typeof notify === 'function') notify(event.reason?.message || 'A request error occurred.', 'Request Error', 'error');
  });

  window.alert = message => notify(message);

  window.DW = { qs, qsa, toQuery };
  window.api = api;
  window.apiRequest = apiRequest;
  window.money = money;
  window.user = user;
  window.getUser = getUser;
  window.setUser = setUser;
  window.setFlash = setFlash;
  window.showFlashIfAny = showFlashIfAny;
  window.protect = protect;
  window.applyRole = applyRole;
  window.logout = logout;
  window.loadSidebar = loadSidebar;
  window.setActive = setActive;
  window.cleanStatus = cleanStatus;
  window.statusLabel = statusLabel;
  window.downloadReport = downloadReport;
  window.escapeHtml = escapeHtml;
  window.showModal = showModal;
  window.notify = notify;
  window.askConfirm = askConfirm;
  window.showFormModal = showFormModal;
})();
