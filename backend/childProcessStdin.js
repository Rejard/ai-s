function writeToChildStdin(proc, payload) {
  return new Promise((resolve) => {
    if (!proc || !proc.stdin || typeof proc.stdin.write !== 'function') {
      resolve({ ok: false, error: new Error('child stdin is not writable') });
      return;
    }

    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    proc.stdin.once('error', (error) => {
      finish({ ok: false, error });
    });

    try {
      proc.stdin.write(payload, (error) => {
        if (error) {
          finish({ ok: false, error });
          return;
        }
        try {
          proc.stdin.end();
        } catch (_) {}
        finish({ ok: true });
      });
    } catch (error) {
      finish({ ok: false, error });
    }
  });
}

module.exports = {
  writeToChildStdin,
};
