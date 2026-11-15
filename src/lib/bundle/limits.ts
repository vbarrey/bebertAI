// A .bebert bundle sent for import: up to 10 GB (Caddy lets it through, docker/Caddyfile). Its vectors hardly
// compress, its texts do: decompressed, it may weigh up to 3 times more. One entry per original file, plus 5.
export const MAX_BUNDLE_SIZE = 10 * 1000 ** 3;
export const MAX_BUNDLE_UNPACKED_SIZE = 3 * MAX_BUNDLE_SIZE;
export const MAX_BUNDLE_ENTRIES = 500_000;
