// Local-only layout fixtures. No .env, database, mail, storage, or production API.
import { fileURLToPath } from 'node:url';
import { notice, listing, report, poll, note, overview, reportDetail } from './layout-fixtures.mjs';
import { interactionResponse, resetInteractions } from './interaction-fixtures.mjs';
process.env.VITE_API_URL = '/api/v1';
process.env.VITE_AUTH_API_URL = '/api/v1';
const { createServer } = await import('vite');
const roles = new Set(['STUDENT', 'FACULTY', 'HOD', 'COORDINATOR', 'ADMIN', 'SUPER_ADMIN']);
let role = 'ADMIN';
const department = { id: 'demo-dept', code: 'CSE', shortName: 'CSE', name: 'Computer Science and Engineering', isActive: true };
const user = () => ({ id: 'layout-demo', email: 'layout.preview@bit.ac.in', role: { code: role, name: role }, mustChangePassword: false, adminProfile: { name: 'Layout Preview', department }, facultyProfile: { id: 'demo-faculty', department } });
const page = { items: [], total: 0, page: 1, limit: 12, totalPages: 1, criticalAlerts: [], pagination: { page: 1, totalPages: 1, totalItems: 0 } };
const server = await createServer({
  root: fileURLToPath(new URL('..', import.meta.url)),
  envDir: false,
  server: { host: '127.0.0.1', port: 5187, strictPort: true },
  plugins: [{ name: 'local-layout-fixtures', configureServer(vite) {
    vite.middlewares.use(async (req, res, next) => {
      const url = new URL(req.url, 'http://127.0.0.1:5187');
      if (url.pathname === '/__components') {
        res.setHeader('Content-Type', 'text/html');
        res.end(await vite.transformIndexHtml('/__components', '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/scripts/mobile-component-gallery.tsx"></script></body></html>'));
        return;
      }
      if (url.pathname === '/__fixture') {
        resetInteractions(url.searchParams.get('failNext') || '');
        role = roles.has(url.searchParams.get('role')) ? url.searchParams.get('role') : 'ADMIN';
        const destination = url.searchParams.get('page') || '/hub';
        res.setHeader('Content-Type', 'text/html');
        res.end(`<script>localStorage.setItem('inca_user',${JSON.stringify(JSON.stringify(user()))});localStorage.setItem('inca_token','local-layout-fixture');location.replace(${JSON.stringify(destination.startsWith('/') && !destination.startsWith('//') ? destination : '/hub')});</script>`);
        return;
      }
      if (!url.pathname.startsWith('/api/')) return next();
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'no-store');
      const send = value => res.end(JSON.stringify(value));
      const path = url.pathname.replace('/api/v1', '');
      if (path === '/auth/me') return send({ success: true, data: { ...user(), role } });
      if (path === '/auth/refresh') { res.statusCode = 401; return send({ message: 'Local fixture: signed out' }); }
      if (await interactionResponse(req, res, path, send, role)) return;
      // Mutations deliberately never leave localhost or change stored data.
      if (req.method !== 'GET' && req.method !== 'HEAD') return send({ success: true, data: [] });
      if (path === '/profile') return send({ id: 'layout-demo', email: user().email, role, roleName: role, values: { firstName: 'Aarav', lastName: 'Sharma', phone: '+91 98765 43210', address: 'Campus residence, Computer Science department' }, revision: 'layout-revision', editableFields: ['firstName', 'lastName', 'phone', 'address'], department, academic: { program: 'B.Tech Computer Science and Engineering', semester: '6' }, joinedAt: '2026-01-01T00:00:00Z' });
      if (path.startsWith('/profile/') || path === '/auth/sessions') return send([]);
      if (path === '/notices/academic-scopes' || path === '/polls/academic-scopes') return send({ departments: [department], programs: [], semesters: [], academicSessions: [], batches: [], sections: [] });
      if (path.endsWith('/analytics') && path.startsWith('/notices/')) return send({ noticeId: notice.id, title: notice.title, status: 'PUBLISHED', priority: 'HIGH', publishAt: notice.publishAt, totalIntendedRecipients: 120, readCount: 80, unreadCount: 40, readPercentage: 66.7, acknowledgementCount: 60, acknowledgementPercentage: 50, recentReaders: [] });
      if (path === '/notices/demo-notice') return send(notice);
      if (path.startsWith('/notices')) return send({ ...page, items: [notice], total: 1 });
      if (path === '/notes/faculty/context') return send({ subjects: [], programs: [] });
      if (path === '/notes/student/context') return send(null);
      if (path.startsWith('/notes/') && (path.includes('quiz') || path.includes('history') || path.includes('conversations'))) return send([]);
      if (path.startsWith('/notes')) return send({ ...page, items: [note] });
      if (path === '/marketplace/transactions/my-deals') return send({ purchases: [], sales: [] });
      if (path.includes('unread')) return send({ unreadCount: 0 });
      if (path === '/marketplace/listings') return send({ ...page, items: [listing], total: 1 });
      if (path === '/marketplace/listings/demo-listing') return send(listing);
      if (path === '/marketplace/conversations/demo-conversation') return send({ id: 'demo-conversation', listing, buyerId: 'layout-demo', sellerId: listing.sellerId, seller: listing.seller, messages: [] });
      if (path === '/lost-found/reports') return send({ ...page, items: [report], total: 1 });
      if (path === '/polls') return send({ ...page, items: [poll], total: 1 });
      if (path.includes('/voters')) return send({ pollId: poll.id, question: poll.question, totalVoters: 0, voters: [] });
      if (path.startsWith('/marketplace') || path.startsWith('/lost-found') || path.startsWith('/polls')) return send([]);
      if (path === '/reports/filter-options') return send({ success: true, data: { departments: [department], students: [], faculty: [], subjects: [], sections: [] } });
      if (path.startsWith('/reports/analytics')) return send({ success: true, data: overview });
      if (/^\/reports\/(student|subject|section|faculty)\//.test(path)) return send({ success: true, data: reportDetail });
      if (path === '/academic/departments') return send({ success: true, data: [department] });
      return send({ success: true, data: [] });
    });
  } }],
});
await server.listen();
console.log('Local layout preview: http://127.0.0.1:5187/__fixture?role=ADMIN&page=/hub');
const close = async () => { await server.close(); process.exit(0); };
process.on('SIGINT', close);
process.on('SIGTERM', close);
