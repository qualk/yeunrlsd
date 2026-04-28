/**
 * Media helper utilities
 * Centralizes logic for setting image elements from original paths or cached blob URLs.
 */

/**
 * Preload and set an <img> element from a source path (original URL). Prefers cached blob URL via window.db.getFileUrl if available.
 * Stores the original requested path in `el.dataset.src` to avoid re-requesting the same resource.
 * Returns a Promise that resolves when the element has been set (or rejected on error).
 */
async function setImageFromPath(el, path) {
  if (!el || !path) return

  try {
    // If already set to this original path or a set is pending, nothing to do
    if (el.dataset && (el.dataset.src === path || el.dataset.srcPending === path)) {
      if (window.DEBUG_MEDIA) console.debug("media: load pending or already set, skipping", path)
      return
    }
    // mark as pending to avoid duplicate concurrent requests
    el.dataset.srcPending = path

    // Determine URL to use (cached blob URL or original)
    let url = path
    if (window.db?.getFileUrl) {
      try {
        url = await window.db.getFileUrl(path)
      } catch (e) {
        console.warn("media.setImageFromPath: getFileUrl failed, falling back to original", e)
        url = path
      }
    }

    // Preload via a temporary Image so we only switch once loaded and avoid aborted requests
    await new Promise((resolve, reject) => {
      const tmp = new Image()
      tmp.onload = () => resolve()
      tmp.onerror = () => reject(new Error("failed to load"))
      tmp.src = url
    })

    // Now set the element src and remember the original path
    el.src = url
    el.dataset.src = path
    delete el.dataset.srcPending
  } catch (e) {
    console.warn("media.setImageFromPath: failed to set image", e)
    // Fallback to placeholder if available
    try {
      el.src = "https://cdn.jsdelivr.net/gh/qualk/yeunrlsd@main/public/icons/placeholder.avif"
      delete el.dataset.srcPending
      el.dataset.src = ""
    } catch (_e) {}
  }
}

window.media = {
  setImageFromPath,
}
