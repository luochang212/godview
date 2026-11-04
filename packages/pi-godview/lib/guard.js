/**
 * Pi tool-call guard.
 *
 * Pi's tool_call event runs before write/edit changes the file. It can return
 * { block: true, reason } to stop the call. Auto claims are created here, the
 * same way the DSH adapter guards its write/edit tools.
 */

// Write/edit targets arrive under several argument spellings across tool
// variants (path, file_path, paths[0]) — the same rule the DSH adapter
// follows. Reading only one spelling would let another silently bypass the
// lease check.
function writeTarget(input) {
  if (!input || typeof input !== 'object') return undefined;
  // Native Pi executes path even when an extra alias is present.
  if (typeof input.path === 'string') return input.path;
  if (typeof input.file_path === 'string') return input.file_path;
  if (Array.isArray(input.paths) && typeof input.paths[0] === 'string') return input.paths[0];
  return undefined;
}

export function installGuard(pi, getBoard) {
  pi.on('tool_call', async (event) => {
    if (!event || (event.toolName !== 'write' && event.toolName !== 'edit')) return undefined;
    const raw = writeTarget(event.input);
    if (typeof raw !== 'string' || raw.length === 0) return undefined;
    const board = getBoard();
    if (!board || !board.started) return undefined;
    const denial = board.checkWrite(raw, event.toolName);
    if (denial) return { block: true, reason: denial };
    return undefined;
  });
}
