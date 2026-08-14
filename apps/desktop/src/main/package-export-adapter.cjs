class PackageExportAdapter {
  #provider = null;

  register(provider) {
    if (!provider || typeof provider.exportMailPackage !== 'function') {
      throw new TypeError('A package provider must expose exportMailPackage.');
    }
    this.#provider = provider;
  }

  get status() {
    return this.#provider
      ? { available: true, message: 'The CRA mail-in package generator is ready.' }
      : {
          available: false,
          message: 'The CRA mail-in package generator is not connected yet. No file was created.',
        };
  }

  async exportReviewedPackage(request) {
    if (!request.review || !Object.values(request.review).every(Boolean)) {
      return {
        ok: false,
        code: 'MANUAL_REVIEW_REQUIRED',
        message: 'Review every form, calculation, attachment, mailing address, and signature field first.',
      };
    }
    if (!this.#provider) return { ok: false, code: 'EXPORT_UNAVAILABLE', ...this.status };
    return this.#provider.exportMailPackage(request);
  }
}

module.exports = { PackageExportAdapter };
