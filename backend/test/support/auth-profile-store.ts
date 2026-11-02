import { randomUUID } from 'node:crypto';

/** Transactional test double: commits only successful callbacks, serializes writes.
 * Production SQL/row locks still require an integration database check at deployment. */
export function authProfileStore() {
  let state: Record<string, any[]> = {
    user: [],
    student: [],
    faculty: [],
    adminProfile: [],
    authSession: [],
    passwordReset: [],
    authThrottle: [],
    profileChangeRequest: [],
    notifications: [],
  };
  let tail = Promise.resolve();
  let failNotifications = false;
  const hydrate = (table: string, row: any, s: typeof state): any => {
    if (!row) return null;
    const result = structuredClone(row);
    if (table === 'user')
      for (const key of ['student', 'faculty', 'adminProfile'])
        result[key] = structuredClone(
          s[key].find((p) => p.userId === row.id) || null,
        );
    if (
      ['authSession', 'passwordReset', 'profileChangeRequest'].includes(table)
    )
      result.user = hydrate(
        'user',
        s.user.find((u) => u.id === row.userId),
        s,
      );
    if (table === 'profileChangeRequest')
      result.reviewer = s.user.find((u) => u.id === row.reviewerId)
        ? {
            id: row.reviewerId,
            email: s.user.find((u) => u.id === row.reviewerId).email,
          }
        : null;
    return result;
  };
  const match = (row: any, where: any): boolean => {
    if (!where) return true;
    if (!row) return false;
    return Object.entries(where).every(([key, v]: [string, any]) => {
      if (key === 'OR') return v.some((c: any) => match(row, c));
      if (key === 'AND') return v.every((c: any) => match(row, c));
      const actual = row[key] ?? null;
      if (v instanceof Date) return +new Date(actual) === +v;
      if (v !== null && typeof v === 'object') {
        if ('not' in v) return actual !== v.not;
        if ('in' in v) return v.in.includes(actual);
        if ('gt' in v) return actual > v.gt;
        if ('lt' in v) return actual < v.lt;
        return match(actual, v);
      }
      return actual === v;
    });
  };
  const client = (get: () => typeof state): any => {
    const db: any = { $queryRaw: jest.fn(async () => [{ id: 'locked' }]) };
    for (const table of Object.keys(state)) {
      const rows = () => get()[table];
      const find = (where: any) =>
        rows().find((r) => match(hydrate(table, r, get()), where));
      const output = (row: any, select?: any) => {
        const data = hydrate(table, row, get());
        if (!data) return null;
        return select
          ? Object.fromEntries(
              Object.keys(select)
                .filter((k) => select[k])
                .map((k) => [k, data[k]]),
            )
          : data;
      };
      const update = (row: any, data: any) => {
        if (
          table === 'user' &&
          [
            'password',
            'email',
            'roleId',
            'isActive',
            'mustChangePassword',
          ].some((k) => k in data && data[k] !== row[k])
        )
          row.authVersion = (row.authVersion || 0) + 1;
        for (const [key, value] of Object.entries(data))
          if (value !== undefined)
            row[key] =
              value && typeof value === 'object' && 'increment' in value
                ? (row[key] || 0) + (value as any).increment
                : structuredClone(value);
      };
      db[table] = {
        findUnique: jest.fn(async ({ where, select }: any) =>
          output(find(where), select),
        ),
        findFirst: jest.fn(async ({ where }: any) => output(find(where))),
        findMany: jest.fn(async ({ where, select, take = 100 }: any = {}) =>
          rows()
            .filter((r) => match(hydrate(table, r, get()), where))
            .slice(0, take)
            .map((r) => output(r, select)),
        ),
        create: jest.fn(async ({ data }: any) => {
          if (table === 'notifications' && failNotifications)
            throw new Error('Notification write failed');
          const row = {
            id: randomUUID(),
            createdAt: new Date(),
            revokedAt: null,
            usedAt: null,
            status: 'PENDING',
            reason: null,
            reviewedAt: null,
            photoKey: null,
            attempts: 1,
            ...structuredClone(data),
          };
          // PostgreSQL JSONB does not preserve key insertion order.
          if (table === 'profileChangeRequest')
            row.previous = Object.fromEntries(
              Object.entries(row.previous).sort(([a], [b]) =>
                a.localeCompare(b),
              ),
            );
          rows().push(row);
          return output(row);
        }),
        update: jest.fn(async ({ where, data }: any) => {
          const row = find(where);
          if (!row) throw new Error('Missing record');
          update(row, data);
          return output(row);
        }),
        updateMany: jest.fn(async ({ where, data }: any) => {
          const found = rows().filter((r) =>
            match(hydrate(table, r, get()), where),
          );
          found.forEach((r) => update(r, data));
          return { count: found.length };
        }),
        delete: jest.fn(async ({ where }: any) => {
          const row = find(where);
          get()[table] = rows().filter((r) => r !== row);
          return output(row);
        }),
        deleteMany: jest.fn(async ({ where }: any) => {
          const found = rows().filter((r) =>
            match(hydrate(table, r, get()), where),
          );
          get()[table] = rows().filter((r) => !found.includes(r));
          return { count: found.length };
        }),
        upsert: jest.fn(async ({ where, create, update: data }: any) => {
          let row = find(where);
          if (!row) {
            row = { attempts: 1, ...create };
            rows().push(row);
          } else update(row, data);
          return output(row);
        }),
      };
    }
    return db;
  };
  const db = client(() => state);
  db.$transaction = jest.fn(async (callback: any) => {
    const previous = tail;
    let release!: () => void;
    tail = new Promise<void>((r) => (release = r));
    await previous;
    const draft = structuredClone(state);
    try {
      const result = await callback(client(() => draft));
      state = draft;
      return result;
    } finally {
      release();
    }
  });
  return {
    db,
    get state() {
      return state;
    },
    setState: (s: typeof state) => {
      state = s;
    },
    failNotifications: (value: boolean) => {
      failNotifications = value;
    },
  };
}
