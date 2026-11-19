(() => {
  const collection = document.querySelector('[data-native-collection]');

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
    window.addEventListener('pageshow', sync);
    sync();
  });

  const more = collection?.querySelector('[data-collection-more]');
  if (!more) return;

  const grid = collection.querySelector('.tt-product-listing');
  const status = collection.querySelector('[data-collection-status]');
  let observer;
  let loading = false;

  async function loadMore() {
    if (loading || !more.hasAttribute('href')) return;

    loading = true;
    observer?.unobserve(more);
    grid.setAttribute('aria-busy', 'true');
    more.setAttribute('aria-disabled', 'true');
    status.textContent = '';

    try {
      const url = new URL(more.href);
      url.searchParams.set('section_id', collection.dataset.nativeCollection);
      const response = await fetch(url);
      if (!response.ok) throw new Error('Could not load the collection section');

      const document = new DOMParser().parseFromString(await response.text(), 'text/html');
      const nextCollection = document.querySelector('[data-native-collection]');
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
      status.textContent = status.dataset.error;
      more.removeEventListener('click', onClick);
    } finally {
      loading = false;
      grid.removeAttribute('aria-busy');
      if (more.hasAttribute('href')) more.removeAttribute('aria-disabled');
    }

    if (status.textContent === status.dataset.success && window.jQuery) {
      window.jQuery('body').trigger('refreshCurrency').trigger('listingpageajax');
      window.ttProductSmall?.();
      window.countDown?.(true);
      window.initImagesSize?.();
      window.lazyload?.();
      if (window.ttReinitflowProduct) setTimeout(window.ttReinitflowProduct, 3000);
    }
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
})();
