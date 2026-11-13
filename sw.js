/* Service worker — Thiệp Nhà Lệ (v4)
 * Mục đích: cài config.html như app trên điện thoại + mở nhanh nhờ cache file tĩnh.
 *
 * An toàn theo thiết kế:
 * - Chỉ cache file tĩnh CÙNG NGUỒN. API Apps Script là cross-origin → luôn gọi mạng trực tiếp,
 *   nên dữ liệu thiệp luôn mới nhất (kể cả ?act=open, ?id=…).
 * - Chỉ được đăng ký từ config.html (máy của chủ nhà); người nhận thiệp không nhận SW này.
 *
 * Khác bản cũ:
 * - Không cache trang theo từng ?id=… (trước đây mỗi thiệp xem thử = 1 mục cache, phình dần).
 * - Bỏ qua mọi request Range / audio / video: Safari (iOS) không phát được media nếu SW trả
 *   về file đầy đủ cho request Range; và file mp3 nặng không nên nằm trong cache app.
 * - Ảnh: stale-while-revalidate → thay ảnh trùng tên trong images/ sẽ tự cập nhật ở lần mở sau
 *   (bản cũ cache-first nên ảnh cũ nằm lì tới khi đổi VER).
 */
const VER = 'thiepnhale-v6.8';   // đổi số này mỗi lần cập nhật file → máy chủ nhà tự tải lại
const CORE = ['./', './index.html', './config.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];
const MEDIA = /\.(mp3|m4a|aac|ogg|oga|wav|flac|opus|mp4|webm|mov|m4v|ogv)$/i;
const IMG = /\.(jpe?g|png|webp|gif|avif|svg|ico)$/i;

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
    if (url.origin !== location.origin) return;                 // API Google, fonts CDN… → mạng trực tiếp
    if (req.headers.has('range') || MEDIA.test(url.pathname) || req.destination === 'audio' || req.destination === 'video') return;   // media → để trình duyệt tự xử lý

    // Mở trang: mạng trước, mất mạng mới dùng cache. Chỉ lưu trang "gốc" (không kèm ?id=…)
    if (req.mode === 'navigate') {
        e.respondWith(
            fetch(req)
                .then(res => {
                    if (res.ok && !url.search) { const cp = res.clone(); caches.open(VER).then(c => c.put(req, cp)).catch(() => {}); }
                    return res;
                })
                .catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('./config.html')))
        );
        return;
    }

    // Ảnh / file tĩnh khác: dùng bản cache ngay, đồng thời tải bản mới ở nền
    e.respondWith(
        caches.match(req).then(hit => {
            const net = fetch(req).then(res => {
                if (res && res.status === 200 && res.type === 'basic' && (IMG.test(url.pathname) || /\.(css|js|json|webmanifest)$/i.test(url.pathname))) {
                    const cp = res.clone(); caches.open(VER).then(c => c.put(req, cp)).catch(() => {});
                }
                return res;
            }).catch(() => hit);
            return hit || net;
        })
    );
});
