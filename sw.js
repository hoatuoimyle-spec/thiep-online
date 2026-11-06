/* Service worker — Thiệp Nhà Lệ
 * Nhiệm vụ: giúp trang config.html cài được như một app trên điện thoại
 * (icon màn hình chính, mở dựng "standalone", vào nhanh hơn nhờ cache file tĩnh).
 *
 * An toàn theo thiết kế:
 * - CHỈ cache file tĩnh cùng thư mục (html, css trong html, mp3, ảnh, icon…).
 * - KHÔNG BAO GIỜ chạm vào dữ liệu thiệp: API Google Sheets/Apps Script là
 *   cross-origin → fetch handler bỏ qua, luôn gọi mạng trực tiếp → khách luôn
 *   thấy nội dung thiệp mới nhất.
 * - Chỉ được đăng ký từ config.html (trang của chủ thiệp), người nhận thiệp
 *   không bao giờ nhận service worker này.
 */
const VER = 'thiepnhale-v5';   // đổi version khi update file → máy chủ nhà tự tải lại bản mới
const CORE = ['./', './index.html', './config.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(VER)
            .then(c => Promise.allSettled(CORE.map(u => c.add(u))))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys()
            .then(ks => Promise.all(ks.filter(k => k !== VER).map(k => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', e => {
    const req = e.request;
    if (req.method !== 'GET') return;
    const url = new URL(req.url);
    if (url.origin !== location.origin) return;      // API Google, fonts CDN… → mạng trực tiếp

    // Mở trang (navigate): ưu tiên bản mới nhất trên mạng, mất mạng mới dùng cache
    if (req.mode === 'navigate') {
        e.respondWith(
            fetch(req)
                .then(res => {
                    const cp = res.clone();
                    caches.open(VER).then(c => c.put(req, cp));
                    return res;
                })
                .catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
        );
        return;
    }

    // File tĩnh (ảnh, nhạc trong assets…): cache-first, tải mới nền nếu chưa có
    e.respondWith(
        caches.match(req).then(r => r || fetch(req).then(res => {
            if (res && res.ok && res.type === 'basic') {
                const cp = res.clone();
                caches.open(VER).then(c => c.put(req, cp));
            }
            return res;
        }))
    );
});
