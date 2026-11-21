(() => {
  const collection = document.querySelector('[data-native-collection]');


  if (!collection) return;

  const grid = collection.querySelector('.tt-product-listing');
  const announcement = collection.querySelector('[data-collection-announcement]');
  let activeRequest;
  let stopLoadMore;

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
          collection.querySelector('.tt-btn-toggle a'))?.focus({ preventScroll: true });
      }

      if (pushHistory && url.href !== window.location.href) {
        history.pushState(history.state, '', url);
      }
      const total = next.querySelector('[data-collection-total]');
      if (total) announcement.textContent = total.dataset.collectionTotal;
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
  }

  function initializeControls() {
    function normalizeLabel(value) {
      return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
    }

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
      if (activeRequest || loading || !more.hasAttribute('href')) return;

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
