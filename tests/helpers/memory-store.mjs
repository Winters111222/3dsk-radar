export function memoryStore() {
  const data = new Map();
  return {
    data,
    async setJSON(key, value) { data.set(key, structuredClone(value)); },
    async get(key) { return data.has(key) ? structuredClone(data.get(key)) : null; },
    async list({ prefix } = {}) {
      return {
        blobs:[...data.keys()].filter((key) => !prefix || key.startsWith(prefix)).map((key) => ({ key, etag:"memory" })),
        directories:[]
      };
    }
  };
}
