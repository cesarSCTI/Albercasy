(() => {
  const collection = document.querySelector('[data-native-collection]');


  if (!collection) return;

  const grid = collection.querySelector('.tt-product-listing');
  const announcement = collection.querySelector('[data-collection-announcement]');
  let activeRequest;
  let stopLoadMore;

  const drawer = collection.querySelector('[data-collection-drawer]');
  const drawerToggle = collection.querySelector('[data-collection-drawer-toggle]');
  const drawerClose = drawer?.querySelector('[data-collection-drawer-close]');
  const drawerTotal = drawer?.querySelector('[data-drawer-total]');
  const badge = drawerToggle?.querySelector('[data-filter-badge]');

  function updateDrawerCount(total) {
    if (!badge) return;
    const count = collection.querySelectorAll('.collection-native-active li').length;
    badge.textContent = count;
    badge.hidden = count === 0;
    if (total && drawerTotal) drawerTotal.textContent = `(${total})`;
  }

  if (drawer && drawerToggle && drawerClose) {
    const mobile = window.matchMedia('(max-width: 1024px)');
    const title = drawer.querySelector('.collection-native-drawer-title');
    let wasOpen = false;

    function syncDrawer() {
      const open = drawer.classList.contains('column-open');
      const offscreen = mobile.matches || drawer.classList.contains('desctop-no-sidebar');
      drawer.inert = offscreen && !open;
      drawerToggle.setAttribute('aria-expanded', String(open));

      if (open) {
        drawer.setAttribute('role', 'dialog');
        drawer.setAttribute('aria-modal', 'true');
        drawer.setAttribute('aria-label', title.textContent.trim());
        if (!wasOpen) drawerClose.focus({ preventScroll: true });
      } else {
        drawer.removeAttribute('role');
        drawer.removeAttribute('aria-modal');
        drawer.removeAttribute('aria-label');
        if (wasOpen && drawerToggle.getClientRects().length) drawerToggle.focus({ preventScroll: true });
      }
      wasOpen = open;
    }

    new MutationObserver(syncDrawer).observe(drawer, { attributes: true, attributeFilter: ['class'] });
    mobile.addEventListener('change', () => {
      if (drawer.classList.contains('column-open')) drawerClose.click();
      syncDrawer();
    });
    drawer.querySelector('[data-collection-drawer-results]')?.addEventListener('click', () => drawerClose.click());
    document.addEventListener('keydown', event => {
      if (!wasOpen) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        drawerClose.click();
      } else if (event.key === 'Tab') {
        const controls = Array.from(drawer.querySelectorAll('a[href], button, input, select, summary'))
          .filter(control => !control.disabled && control.tabIndex >= 0 && control.getClientRects().length);
        const boundary = event.shiftKey ? controls[0] : controls.at(-1);
        if (document.activeElement === boundary || !drawer.contains(document.activeElement)) {
          event.preventDefault();
          (event.shiftKey ? controls.at(-1) : controls[0])?.focus();
        }
      }
    });
    syncDrawer();
    updateDrawerCount(collection.querySelector('[data-result-count]')?.dataset.resultCount);
  }


  async function fetchCollection(url, signal) {
    const sectionUrl = new URL(url);
    sectionUrl.searchParams.set('section_id', collection.dataset.nativeCollection);
    const response = await fetch(sectionUrl, { signal });
    if (!response.ok) throw new Error('Could not load the collection section');
    const html = new DOMParser().parseFromString(await response.text(), 'text/html');
    const section = html.querySelector('[data-native-collection]');
    if (!section) throw new Error('Missing collection section');
    return section;
  }

  function refreshProducts() {
    if (!window.jQuery) return;
    window.jQuery('body').trigger('refreshCurrency').trigger('listingpageajax');
    window.ttProductSmall?.();
    window.countDown?.(true);
    window.initImagesSize?.();
    window.lazyload?.();
    if (window.ttReinitflowProduct) setTimeout(window.ttReinitflowProduct, 3000);
  }

  async function updateCollection(url, pushHistory = true) {
    activeRequest?.abort();
    const request = new AbortController();
    activeRequest = request;
    collection.setAttribute('aria-busy', 'true');

    try {
      const next = await fetchCollection(url, request.signal);
      if (request.signal.aborted) return;

      const nextGrid = next.querySelector('.tt-product-listing');
      if (!nextGrid) throw new Error('Missing product grid');

      const focused = document.activeElement;
      const drawerBody = drawer?.querySelector('.collection-native-drawer-body');
      const drawerScroll = drawerBody?.scrollTop;
      const groups = new Map(Array.from(collection.querySelectorAll('[data-filter-key]'), group => [
        group.dataset.filterKey,
        { open: group.open, query: group.querySelector('[data-filter-search]')?.value },
      ]));
      const focusedGroup = focused?.closest('[data-filter-key]')?.dataset.filterKey;
      const regions = ['[data-collection-facets]', '[data-collection-controls]', '[data-collection-pagination]', '.listing-total-js'];
      stopLoadMore?.();
      regions.forEach(selector => {
        const current = collection.querySelector(selector);
        const incoming = next.querySelector(selector);
        if (current && incoming) current.replaceChildren(...incoming.childNodes);
      });
      grid.classList.toggle('flex-center-message', nextGrid.classList.contains('flex-center-message'));
      grid.replaceChildren(...nextGrid.childNodes);

      collection.querySelectorAll('[data-filter-key]').forEach(group => {
        const previous = groups.get(group.dataset.filterKey);
        if (!previous) return;
        group.open = previous.open;
        const search = group.querySelector('[data-filter-search]');
        if (search && previous.query) search.value = previous.query;
      });

      if (drawerBody) drawerBody.scrollTop = drawerScroll;
      initializeControls();
      stopLoadMore = initializeLoadMore();

      if (focused && !focused.isConnected) {
        const group = focusedGroup && collection.querySelector(`[data-filter-key="${CSS.escape(focusedGroup)}"]`);
        const focusScope = group || collection;
        let replacement;
        if (focused.matches('input, select')) {
          replacement = Array.from(focusScope.querySelectorAll('input, select')).find(input =>
            input.name === focused.name && input.type === focused.type &&
            (input.type !== 'checkbox' || input.value === focused.value) &&
            (!focused.hasAttribute('data-range-min') || input.hasAttribute('data-range-min')) &&
            (!focused.hasAttribute('data-range-max') || input.hasAttribute('data-range-max'))
          );
        }
        (replacement || group?.querySelector('summary') || collection.querySelector('[data-collection-facets] summary') ||
          (drawer?.classList.contains('column-open') ? drawerClose : drawerToggle))?.focus({ preventScroll: true });
      }

      if (pushHistory && url.href !== window.location.href) {
        history.pushState(history.state, '', url);
      }
      const total = next.querySelector('[data-collection-total]');
      if (total) {
        announcement.textContent = total.dataset.collectionTotal;
        updateDrawerCount(total.dataset.resultCount);
      }
    } catch {
      if (!request.signal.aborted) {
        if (pushHistory) window.location.assign(url);
        else window.location.reload();
      }
      return;
    } finally {
      if (activeRequest === request) {
        activeRequest = undefined;
        collection.removeAttribute('aria-busy');
      }
    }

    refreshProducts();
    refreshCollectionSearch?.();
  }


  function normalizeLabel(value) {
    return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
  }

  function initializeCollectionSearch() {
    const search = collection.querySelector('[data-collection-search]');
    if (!search) return;

    const input = search.querySelector('[data-collection-search-input]');
    const clear = search.querySelector('[data-collection-search-clear]');
    const status = search.querySelector('[data-collection-search-status]');
    const results = search.querySelector('[data-collection-search-results]');
    const more = search.querySelector('[data-collection-search-more]');
    const formatter = new Intl.NumberFormat(document.documentElement.lang || undefined);
    const pageSize = 24;
    let index;
    let matches = [];
    let revision = 0;
    let timer;

    function getIndex() {
      const url = new URL(window.location.href);
      url.searchParams.delete('page');
      url.searchParams.delete('section_id');
      url.searchParams.set('view', 'catalog-search');
      if (index?.key === url.href) return index.promise;

      index?.controller.abort();
      const controller = new AbortController();
      const pending = { key: url.href, controller };
      index = pending;
      pending.promise = (async () => {
        const products = [];
        const visited = new Set();
        while (!visited.has(url.href)) {
          visited.add(url.href);
          const response = await fetch(url, { signal: controller.signal });
          if (!response.ok) throw new Error('Collection search unavailable');
          const page = await response.json();
          for (const product of page.products) {
            product.searchText = normalizeLabel([product.title, product.vendor, product.type].join(' '));
            products.push(product);
          }
          if (!page.next) break;
          const nextPage = new URL(page.next, url).searchParams.get('page');
          if (!nextPage) break;
          url.searchParams.set('page', nextPage);
        }
        return products;
      })().catch(error => {
        if (index === pending) index = undefined;
        throw error;
      });
      return pending.promise;
    }

    function showMore() {
      const start = results.children.length;
      for (const product of matches.slice(start, start + pageSize)) {
        const item = document.createElement('li');
        const link = document.createElement('a');
        const title = document.createElement('span');
        link.href = product.url;
        title.textContent = product.title;
        if (product.image) {
          const image = document.createElement('img');
          image.src = product.image;
          image.alt = '';
          image.loading = 'lazy';
          link.append(image);
        }
        link.append(title);
        item.append(link);
        results.append(item);
      }
      more.hidden = results.children.length >= matches.length;
      if (start > 0) results.children[start]?.querySelector('a')?.focus();
    }

    async function updateSearch() {
      clearTimeout(timer);
      const current = ++revision;
      const query = normalizeLabel(input.value);
      clear.hidden = !input.value;
      const pagination = collection.querySelector('[data-collection-pagination]');
      grid.hidden = Boolean(query);
      if (pagination) pagination.hidden = Boolean(query);
      more.hidden = true;
      results.replaceChildren();

      if (!query) {
        status.textContent = '';
        return;
      }

      status.textContent = status.dataset.loading;
      try {
        const products = await getIndex();
        if (current !== revision) return;
        const words = query.split(/\s+/);
        matches = products.filter(product => words.every(word => product.searchText.includes(word)));
        status.textContent = matches.length
          ? status.dataset.count.replace('999999', formatter.format(matches.length))
          : status.dataset.empty;
        showMore();
      } catch {
        if (current !== revision) return;
        status.textContent = status.dataset.error;
        grid.hidden = false;
        if (pagination) pagination.hidden = false;
      }
    }

    input.addEventListener('input', () => {
      revision++;
      clearTimeout(timer);
      if (!input.value.trim()) updateSearch();
      else timer = setTimeout(updateSearch, 250);
    });
    input.addEventListener('keydown', event => {
      if (event.key === 'Enter') updateSearch();
    });
    clear.addEventListener('click', () => {
      input.value = '';
      updateSearch();
      input.focus();
    });
    more.addEventListener('click', showMore);
    search.hidden = false;
    return updateSearch;
  }

  function initializeControls() {
    collection?.querySelectorAll('[data-filter-search]').forEach(search => {
      const group = search.closest('.collection-native-group');
      const options = Array.from(group.querySelectorAll('[data-filter-value]'), element => ({
        element,
        name: normalizeLabel(element.dataset.filterValue),
      }));
      const noMatch = group.querySelector('[data-filter-no-match]');
      function update() {
        const query = normalizeLabel(search.value);
        options.forEach(({ element, name }) => { element.hidden = !name.includes(query); });
        noMatch.hidden = options.some(({ element }) => !element.hidden);
      }
      search.hidden = false;
      search.addEventListener('input', update);
      search.addEventListener('keydown', event => {
        if (event.key === 'Enter') event.preventDefault();
      });
      update();
    });

    collection?.querySelectorAll('[data-price-group]').forEach(group => {
      const min = group.querySelector('[data-price-min]');
      const max = group.querySelector('[data-price-max]');
      const range = group.querySelector('[data-price-range]');
      const lower = range?.querySelector('[data-range-min]');
      const upper = range?.querySelector('[data-range-max]');
      const ceiling = Number(max.max);

      function sync() {
        const from = min.valueAsNumber;
        const to = max.valueAsNumber;
        max.setCustomValidity(to < from ? group.dataset.priceError : '');
        if (!range) return;

        lower.value = Number.isFinite(from) ? from : 0;
        upper.value = Number.isFinite(to) ? to : ceiling;
        const left = lower.valueAsNumber / ceiling * 100;
        const right = upper.valueAsNumber / ceiling * 100;
        range.style.setProperty('--range-start', Math.min(left, right) + '%');
        range.style.setProperty('--range-end', Math.max(left, right) + '%');
        range.classList.toggle('collection-native-range-at-end', left >= 99);
      }

      group.addEventListener('invalid', () => { group.closest('details').open = true; }, true);
      min.addEventListener('input', sync);
      max.addEventListener('input', sync);
      if (range) {
        lower.addEventListener('input', () => {
          min.value = Math.min(lower.valueAsNumber, upper.valueAsNumber);
          sync();
        });
        upper.addEventListener('input', () => {
          max.value = Math.max(upper.valueAsNumber, lower.valueAsNumber);
          sync();
        });
        range.hidden = false;
      }
      sync();
    });

    collection?.querySelectorAll('.collection-native-filters, .collection-native-toolbar').forEach(form => {
      let priceTimer;

      form.addEventListener('submit', event => {
        clearTimeout(priceTimer);
        const url = new URL(form.action);
        const params = new URLSearchParams();
        for (const [name, value] of new FormData(form)) {
          if (value || (name !== 'view' && !name.startsWith('filter.'))) params.append(name, value);
        }
        url.search = params;
        if (params.get('view') !== new URL(window.location.href).searchParams.get('view')) return;
        event.preventDefault();
        updateCollection(url);
      });
      form.addEventListener('change', event => {
        const control = event.target;
        if (control.matches('[data-price-min], [data-price-max]')) {
          clearTimeout(priceTimer);
          priceTimer = setTimeout(() => {
            if (form.isConnected) form.requestSubmit();
          }, 450);
        } else if (control.matches('input[type="checkbox"], select, [data-range-min], [data-range-max]')) {
          clearTimeout(priceTimer);
          form.requestSubmit();
        }
      });

      form.addEventListener('keydown', event => {
        if (event.key === 'Enter' && event.target.matches('[data-price-min], [data-price-max]')) {
          event.preventDefault();
          clearTimeout(priceTimer);
          form.requestSubmit();
        }
      });
    });

  }

  function initializeLoadMore() {
    const more = collection?.querySelector('[data-collection-more]');
    if (!more) return;

    const status = collection.querySelector('[data-collection-status]');
    let observer;
    let loading = false;
    const loadController = new AbortController();

    async function loadMore() {
      if (grid.hidden || activeRequest || loading || !more.hasAttribute('href')) return;

      loading = true;
      observer?.unobserve(more);
      grid.setAttribute('aria-busy', 'true');
      more.setAttribute('aria-disabled', 'true');
      status.textContent = '';

      try {
        const url = new URL(more.href);
        const nextCollection = await fetchCollection(url, loadController.signal);
        if (loadController.signal.aborted) return;
        const nextProducts = nextCollection?.querySelectorAll('.tt-product-listing > .tt-col-item');
        if (!nextProducts?.length) throw new Error('The collection section has no products');

        grid.append(...nextProducts);
        const next = nextCollection.querySelector('[data-collection-more]');
        if (next) {
          const nextUrl = new URL(next.getAttribute('href'), url);
          nextUrl.searchParams.delete('section_id');
          more.href = nextUrl.href;
          observer?.observe(more);
        } else {
          more.removeAttribute('href');
          more.textContent = more.dataset.endLabel;
        }
        status.textContent = status.dataset.success;
      } catch {
        if (loadController.signal.aborted) return;
        status.textContent = status.dataset.error;
        more.removeEventListener('click', onClick);
      } finally {
        loading = false;
        if (!loadController.signal.aborted) grid.removeAttribute('aria-busy');
        if (more.hasAttribute('href')) more.removeAttribute('aria-disabled');
      }

      if (status.textContent === status.dataset.success) refreshProducts();
    }

    function onClick(event) {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      loadMore();
    }

    more.addEventListener('click', onClick);
    if (more.hasAttribute('data-autoscroll') && 'IntersectionObserver' in window) {
      observer = new IntersectionObserver(entries => {
        if (entries.some(entry => entry.isIntersecting)) loadMore();
      });
      observer.observe(more);
    }
    return () => {
      loadController.abort();
      observer?.disconnect();
      grid.removeAttribute('aria-busy');
    };
  }

  const refreshCollectionSearch = initializeCollectionSearch();
  initializeControls();
  stopLoadMore = initializeLoadMore();
  let currentView = new URL(window.location.href).searchParams.get('view');

  collection.addEventListener('click', event => {
    const link = event.target.closest('[data-collection-remove]');
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey ||
        event.ctrlKey || event.shiftKey || event.altKey) return;
    const url = new URL(link.href);
    if (currentView) url.searchParams.set('view', currentView);
    event.preventDefault();
    updateCollection(url);
  });

  window.addEventListener('popstate', () => {
    const url = new URL(window.location.href);
    if (url.searchParams.get('view') !== currentView) {
      window.location.reload();
      return;
    }
    updateCollection(url, false);
  });
})();
