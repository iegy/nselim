// firebase-shared.js
// إعدادات وموارد Firebase المشتركة بين الموقع العام (index.html) ولوحة التحكم (admin.html).
// كل صفحة بتحمّل ملف JS خاص بيها بس (أخف وأسرع)، والاتنين بياخدوا نفس الإعدادات من هنا.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, doc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyANq5RBZtNOTKM_gJXG9fx20wB3qMPtu78",
    authDomain: "selim-charcoal-web.firebaseapp.com",
    projectId: "selim-charcoal-web",
    storageBucket: "selim-charcoal-web.firebasestorage.app",
    messagingSenderId: "275740911120",
    appId: "1:275740911120:web:eb5ecfcf7273cac8d28c95",
    measurementId: "G-6BXP9EWH5D"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const appId = 'selim-exports-app';

export const productsCollectionRef = collection(db, 'artifacts', appId, 'public', 'data', 'products');
export const settingsDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'globalConfig');
// المعرض: كل صورة/فيديو مستند مستقل بدل مصفوفة واحدة ضخمة (راجع README لتفاصيل السبب).
export const mediaItemsCollectionRef = collection(db, 'artifacts', appId, 'public', 'data', 'mediaItems');
export const legacyMediaDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'media', 'items'); // البنية القديمة (للترحيل فقط)
export const chatsCollectionRef = collection(db, 'artifacts', appId, 'public', 'data', 'chats');

export const GALLERY_PAGE_SIZE = 12;
export const ADMIN_MEDIA_LIMIT = 300;

export function generateLocalId(prefix = 'id') {
    return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 8);
}

export function extractYouTubeId(url) {
    if (!url) return null;
    url = url.trim();
    // لو تم إدخال الـ ID مباشرة (مكون من 11 حرف أو رقم)
    if (/^[a-zA-Z0-9_-]{11}$/.test(url)) return url;
    // استخراج الـ ID من أي رابط يوتيوب (عادي أو شورتس) وتجاهل أي زيادات في الرابط
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|shorts\/|.*[?&]v=))([\w-]{11})/i);
    return match ? match[1] : null;
}

export const DEFAULT_WEBSITE_SETTINGS = {
    mapUrl: "https://www.google.com/maps/embed?pb=!1m18...",
    aboutText: "تعتبر شركة سليم للفحم النباتي (Selim Exports) واحدة من المؤسسات الوطنية الرائدة في إنتاج وتجهيز وتصدير أجود أنواع الفحم النباتي الطبيعي.",
    channels: [
        { id: 'ch1', type: 'phone', icon: 'fa-solid fa-phone', label: 'المبيعات المحلية', value: '+201015651543', action: 'tel', color: 'primary' },
        { id: 'ch2', type: 'phone', icon: 'fa-solid fa-plane-departure', label: 'التصدير الدولي', value: '+201022223333', action: 'tel', color: 'primary' },
        { id: 'ch3', type: 'email', icon: 'fa-solid fa-envelope', label: 'البريد الإلكتروني', value: 'info@selimexports.com', action: 'mailto', color: 'gold' },
        { id: 'ch4', type: 'address', icon: 'fa-solid fa-location-dot', label: 'العنوان', value: 'الإسكندرية / رشيد، مصر', action: 'text', color: 'stone' }
    ],
    socialLinks: [
        { id: 's1', icon: 'fa-brands fa-facebook-f', url: 'https://facebook.com', color: 'primary', platform: 'فيسبوك' },
        { id: 's2', icon: 'fa-brands fa-linkedin-in', url: 'https://linkedin.com', color: 'primary', platform: 'لينكد إن' },
        { id: 's3', icon: 'fa-brands fa-youtube', url: 'https://youtube.com', color: 'red', platform: 'يوتيوب' }
    ]
};
