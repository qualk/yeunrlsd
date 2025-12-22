/**
 * Standard Modal Management
 */

const Modal = {
  /**
   * Open a modal by ID
   * @param {string} modalId
   */
  open(modalId) {
    const modal = document.getElementById(modalId)
    if (!modal) return

    modal.classList.add("active")
    document.body.classList.add("modal-open")

    // Focus the first button or the close button
    const closeBtn = modal.querySelector(".modal-close-btn")
    if (closeBtn) closeBtn.focus()
  },

  /**
   * Close a modal by ID
   * @param {string} modalId
   */
  close(modalId) {
    const modal = document.getElementById(modalId)
    if (!modal) return

    modal.classList.remove("active")

    // Only remove modal-open if no other modals are active
    const activeModals = document.querySelectorAll(".modal-overlay.active")
    if (activeModals.length === 0) {
      document.body.classList.remove("modal-open")
    }
  },

  /**
   * Initialize modal listeners
   */
  init() {
    // Close on overlay click
    document.querySelectorAll(".modal-overlay").forEach((overlay) => {
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) {
          // If the modal is forced (data-force="true"), do not allow overlay click to close it
          if (overlay.dataset && overlay.dataset.force === "true") return
          this.close(overlay.id)
        }
      })
    })

    // Close on Escape key
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        const activeModal = document.querySelector(".modal-overlay.active")
        if (activeModal) {
          // Respect forced modals which should not close via Escape
          if (activeModal.dataset && activeModal.dataset.force === "true") return
          this.close(activeModal.id)
        }
      }
    })

    // Close buttons
    document.querySelectorAll(".modal-close-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const modal = btn.closest(".modal-overlay")
        if (modal) this.close(modal.id)
      })
    })
  },
}

// Export to window
window.Modal = Modal
document.addEventListener("DOMContentLoaded", () => Modal.init())
