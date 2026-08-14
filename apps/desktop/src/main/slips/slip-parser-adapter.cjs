class SlipParserAdapter {
  #parser = null;

  register(parser) {
    if (!parser || typeof parser.parse !== 'function') {
      throw new TypeError('A slip parser must expose an asynchronous parse method.');
    }
    this.#parser = parser;
  }

  get status() {
    return this.#parser
      ? { available: true, message: 'The slip parser is ready.' }
      : {
          available: false,
          message: 'The slip parser is not connected yet. You can continue by entering each value manually.',
        };
  }

  async parse(request) {
    if (!this.#parser) {
      return { ok: false, code: 'PARSER_UNAVAILABLE', ...this.status };
    }
    const result = await this.#parser.parse({
      fileName: String(request.fileName || ''),
      mediaType: String(request.mediaType || 'application/octet-stream'),
      bytes: Buffer.from(request.bytes || []),
    });
    return {
      ok: true,
      correctionsRequired: true,
      values: Array.isArray(result.values) ? result.values : [],
      warnings: Array.isArray(result.warnings) ? result.warnings : [],
    };
  }
}

module.exports = { SlipParserAdapter };
