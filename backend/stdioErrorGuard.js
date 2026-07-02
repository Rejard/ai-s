function attachStdioErrorGuard(streams = [process.stdout, process.stderr], onUnexpectedError = null) {
  for (const stream of streams) {
    if (!stream || typeof stream.on !== 'function') continue;
    stream.on('error', (error) => {
      if (error && (error.code === 'EOF' || error.code === 'EPIPE')) {
        return;
      }
      if (typeof onUnexpectedError === 'function') {
        onUnexpectedError(error);
      }
    });
  }
}

module.exports = {
  attachStdioErrorGuard,
};
