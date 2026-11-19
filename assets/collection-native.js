(() => {
  const collection = document.querySelector('[data-native-collection]');
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
