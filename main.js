// main.js
const translations = {
    ar: {
        'top_working_hours': 'جميع أيام الاسبوع', 'top_export': 'تصدير لجميع الموانئ', 'header_tagline': 'فحم طبيعي فاخر',
        'nav_home': 'الرئيسية', 'nav_about': 'من نحن', 'nav_features': 'المواصفات', 'nav_products': 'المنتجات',
        'nav_offers': '🔥 العروض الخاصة', 'nav_gallery': 'المعرض', 'nav_contact': 'اتصل بنا',
        'hero_badge': 'للتوريد المحلي الفاخر والتصدير لجميع الموانئ العالمية', 'hero_title_main': 'سليم للفحم النباتي الطبيعي',
        'hero_subtitle': 'إنتاج وتجهيز فحم الفواكه النقي وفحم الموالح والجزورين بأحدث الأساليب الصديقة للبيئة، لتقديم منتج تجاري ممتاز يطابق المواصفات العالمية.',
        'hero_btn1': 'استعراض منتجاتنا', 'hero_btn2': 'طلب عرض تسعير وعينات', 'stat_exp': 'سنة خبرة', 'stat_countries': 'خبرة طويلة لكل ما يخص الاخشاب',
        'stat_natural': 'فحم نقي طبيعي', 'stat_burn': 'مدة احتراق', 'about_badge': 'ريادتنا في السوق', 'about_title': 'شركة سليم للفحم النباتي والتبادل التجاري',
        'about_feature1': 'أدخنة أو روائح كيميائية', 'about_feature2': 'متوسط ساعات احتراق', 'feat1_title': 'طبيعي 100%', 'feat1_desc': 'منتج طبيعي نقي وخالٍ تماماً من المضافات الكيميائية أو الأخشاب الملوثة.',
        'feat2_title': 'جودة عالية', 'feat2_desc': 'نسبة كربون عالية ورماد ثلجي أبيض ناعم مع صلابة تمنع التكسر أثناء النقل.', 'feat3_title': 'تصدير عالمي',
        'feat3_desc': 'جاهزية تامة لشحن الحاويات بكافة وثائق الفحص والشهادات البيئية المعتمدة.', 'feat4_title': 'توريد موثوق',
        'feat4_desc': 'طاقة إنتاجية ضخمة تلبي طلبيات المصانع الكبرى والشركات طوال العام ودون انقطاع.', 'products_title': 'كتالوج منتجاتنا الفاخرة',
        'filter_all': 'كل الأصناف', 'offers_badge': 'خصومات استثنائية على الكميات الكبرى', 'offers_title': 'أحدث عروض التوريد الحالية',
        'gallery_title': 'معرض الصور والفيديوهات', 'contact_title': 'قنوات التعاقد الرسمي', 'contact_sub': 'يسعدنا استقبال استفساراتكم التجارية على مدار الساعة.',
        'social_title': 'منصاتنا الرقمية', 'form_title': 'تقديم طلب شحنة أو معاينة عينة', 'form_name': 'الاسم بالكامل / الشركة', 'form_phone': 'رقم الجوال مع رمز الدولة',
        'form_market': 'نوع السوق المستهدف', 'market_export': 'تصدير بحري دولي (حاويات)', 'market_local': 'تجارة وتوريد محلي (مصر)', 'form_msg': 'أصناف الفحم والكميات المطلوبة بالطن',
        'form_btn': 'تقديم طلب السعر', 'footer_desc': 'أعلى مستويات الجودة والالتزام الصارم.', 'footer_quick': 'روابط سريعة', 'footer_support': 'الدعم',
        'footer_follow': 'تابعنا', 'footer_rights': 'جميع الحقوق محفوظة'
    },
    en: {
        'top_working_hours': 'All Week Days', 'top_export': 'Export Ready Worldwide', 'header_tagline': 'Premium Natural Charcoal',
        'nav_home': 'Home', 'nav_about': 'About', 'nav_features': 'Features', 'nav_products': 'Products',
        'nav_offers': '🔥 Special Offers', 'nav_gallery': 'Gallery', 'nav_contact': 'Contact',
        'hero_badge': 'For premium local supply & export to all global ports', 'hero_title_main': 'Selim Natural Charcoal',
        'hero_subtitle': 'Producing and processing pure fruit charcoal, citrus, and roots with eco-friendly methods.',
        'hero_btn1': 'Browse Products', 'hero_btn2': 'Request Quote & Samples', 'stat_exp': 'Years Experience', 'stat_countries': 'Extensive Wood Expertise',
        'stat_natural': 'Pure Natural', 'stat_burn': 'Burn Time', 'about_badge': 'Market Leadership', 'about_title': 'Selim Charcoal & Trading Company',
        'about_feature1': 'Zero Smoke or Chemicals', 'about_feature2': 'Avg. Burn Hours', 'feat1_title': '100% Natural', 'feat1_desc': 'Pure natural product.',
        'feat2_title': 'High Quality', 'feat2_desc': 'High carbon content, snow-white fine ash.', 'feat3_title': 'Global Export',
        'feat3_desc': 'Fully ready for container shipping.', 'feat4_title': 'Reliable Supply', 'feat4_desc': 'Massive production capacity.',
        'products_title': 'Premium Products Catalog', 'filter_all': 'All Categories', 'offers_badge': 'Exceptional discounts',
        'offers_title': 'Latest Supply Offers', 'gallery_title': 'Photo & Video Gallery', 'contact_title': 'Official Contracting Channels',
        'contact_sub': 'We welcome your commercial inquiries 24/7.', 'social_title': 'Digital Platforms', 'form_title': 'Submit a Shipment Request',
        'form_name': 'Full Name / Company', 'form_phone': 'Mobile Number', 'form_market': 'Target Market', 'market_export': 'International Export',
        'market_local': 'Local Supply (Egypt)', 'form_msg': 'Charcoal types & quantities', 'form_btn': 'Submit Quote Request',
        'footer_desc': 'Highest quality standards.', 'footer_quick': 'Quick Links', 'footer_support': 'Support',
        'footer_follow': 'Follow Us', 'footer_rights': 'All Rights Reserved'
    }
};

let currentLang = localStorage.getItem('lang') || 'ar';
function toggleLanguage() {
    currentLang = (currentLang === 'ar') ? 'en' : 'ar';
    localStorage.setItem('lang', currentLang);
    applyTranslations(currentLang);
    document.documentElement.dir = (currentLang === 'ar') ? 'rtl' : 'ltr';
    document.documentElement.lang = currentLang;
    showToast(currentLang === 'ar' ? 'تم التبديل إلى العربية' : 'Switched to English', 'info');
}
function applyTranslations(lang) {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (translations[lang] && translations[lang][key]) {
            if (el.childNodes.length > 0 && el.childNodes[0].nodeType === Node.TEXT_NODE) {
                el.childNodes[0].textContent = translations[lang][key];
            } else {
                el.textContent = translations[lang][key];
            }
        }
    });
    const allFilterBtn = document.getElementById('filter-btn-all');
    if (allFilterBtn) allFilterBtn.textContent = translations[lang]?.['filter_all'] || 'كل الأصناف';
}

if (localStorage.getItem('theme') === 'dark') { document.documentElement.classList.add('dark'); document.getElementById('theme-icon').className = 'fa-solid fa-sun'; }
else { document.documentElement.classList.remove('dark'); document.getElementById('theme-icon').className = 'fa-solid fa-moon'; }

function toggleTheme() {
    const html = document.documentElement, icon = document.getElementById('theme-icon'), hero = document.getElementById('home');
    if (html.classList.contains('dark')) {
        html.classList.remove('dark'); icon.className = 'fa-solid fa-moon';
        if (hero) hero.style.backgroundImage = "linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.7)), url('https://i.ibb.co/1fhhF5yp/566485593-2232776207188920-2227545586989487454-n.jpg')";
        localStorage.setItem('theme', 'light');
    } else {
        html.classList.add('dark'); icon.className = 'fa-solid fa-sun';
        if (hero) hero.style.backgroundImage = "linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.85)), url('https://i.ibb.co/n88hybYG/image.jpg')";
        localStorage.setItem('theme', 'dark');
    }
    showToast('تم تغيير المظهر', 'info');
}

function openAdminLoginModal() { document.getElementById('login-modal').classList.remove('hidden'); }
function closeAdminLoginModal() { document.getElementById('login-modal').classList.add('hidden'); }

function compressAndEncodeImage(event) {
    const file = event.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d'), max_w = 480, scale = max_w / img.width;
            canvas.width = max_w; canvas.height = img.height * scale;
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            const base64 = canvas.toDataURL('image/jpeg', 0.65);
            document.getElementById('image-preview').src = base64;
            document.getElementById('image-preview-container').classList.remove('hidden');
            showToast('تم ضغط الصورة. يُفضل استخدام رابط خارجي لتجنب مشاكل الحجم.', 'info');
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function submitInquiryForm(e) {
    e.preventDefault();
    const n = document.getElementById('inq-name').value, p = document.getElementById('inq-phone').value, m = document.getElementById('inq-market').value, msg = document.getElementById('inq-msg').value;
    let num = '201024982550';
    if (window._websiteSettings && window._websiteSettings.channels) {
        const ph = window._websiteSettings.channels.find(c => c.type === 'phone' || c.action === 'tel');
        if (ph) num = ph.value.replace(/[^0-9]/g, '');
    }
    window.open(`https://wa.me/${num}?text=${encodeURIComponent(`مرحباً سليم للفحم:\nالاسم: ${n}\nالجوال: ${p}\nالسوق: ${m}\nالطلب: ${msg}`)}`, '_blank');
    showToast('تم توجيه الطلب إلى الواتساب!', 'success');
}

function showToast(text, type = 'info') {
    const container = document.getElementById('toast-container'); if (!container) return;
    const t = document.createElement('div');
    let bg = 'bg-stone-900 text-white', icon = 'fa-solid fa-circle-info';
    if (type === 'success') { bg = 'bg-emerald-600 text-white'; icon = 'fa-solid fa-circle-check'; }
    else if (type === 'error') { bg = 'bg-red-600 text-white'; icon = 'fa-solid fa-circle-xmark'; }
    else if (type === 'warning') { bg = 'bg-amber-500 text-black'; icon = 'fa-solid fa-triangle-exclamation'; }
    t.className = `${bg} p-4 rounded-2xl flex items-center gap-3 shadow-xl transform translate-y-2 opacity-0 transition-all duration-300 border border-white/10 text-xs font-bold`;
    t.innerHTML = `<i class="${icon} text-base shrink-0"></i> <span>${text}</span>`;
    container.appendChild(t);
    setTimeout(() => t.classList.remove('translate-y-2', 'opacity-0'), 10);
    setTimeout(() => { t.classList.add('translate-y-2', 'opacity-0'); setTimeout(() => t.remove(), 300); }, 4000);
}

let confirmActionCallback = null;
function showConfirmModal(title, message, onConfirm) {
    document.getElementById('confirm-title').innerText = title;
    document.getElementById('confirm-message').innerText = message;
    document.getElementById('confirm-modal').classList.remove('hidden');
    confirmActionCallback = onConfirm;
}
document.getElementById('confirm-cancel-btn').addEventListener('click', () => { document.getElementById('confirm-modal').classList.add('hidden'); confirmActionCallback = null; });
document.getElementById('confirm-ok-btn').addEventListener('click', () => { document.getElementById('confirm-modal').classList.add('hidden'); if (confirmActionCallback) { confirmActionCallback(); confirmActionCallback = null; } });

function navigateTo(section) {
    if (section === 'gallery') {
        document.getElementById('main-content').style.display = 'none';
        document.getElementById('gallery-page').style.display = 'block';
    } else {
        document.getElementById('main-content').style.display = 'block';
        document.getElementById('gallery-page').style.display = 'none';
        const target = document.getElementById(section);
        if (target) target.scrollIntoView({ behavior: 'smooth' });
    }
}
document.addEventListener('click', function(e) {
    const link = e.target.closest('[data-section]');
    if (link) {
        e.preventDefault();
        navigateTo(link.getAttribute('data-section'));
    }
});

function toggleMobileMenu() {
    const menu = document.getElementById('mobile-menu');
    const icon = document.getElementById('mobile-menu-icon');
    if (menu.classList.contains('hidden')) {
        menu.classList.remove('hidden');
        icon.classList.remove('fa-bars');
        icon.classList.add('fa-xmark');
    } else {
        menu.classList.add('hidden');
        icon.classList.remove('fa-xmark');
        icon.classList.add('fa-bars');
    }
}
function closeMobileMenu() {
    const menu = document.getElementById('mobile-menu');
    const icon = document.getElementById('mobile-menu-icon');
    if (menu && !menu.classList.contains('hidden')) {
        menu.classList.add('hidden');
        icon.classList.remove('fa-xmark');
        icon.classList.add('fa-bars');
    }
}
document.addEventListener('click', function(e) {
    const menu = document.getElementById('mobile-menu');
    const btn = document.getElementById('mobile-menu-btn');
    if (menu && !menu.classList.contains('hidden') && !menu.contains(e.target) && e.target !== btn && !btn.contains(e.target)) {
        closeMobileMenu();
    }
});

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('current-year').textContent = new Date().getFullYear();
    applyTranslations(currentLang);
    document.documentElement.dir = (currentLang === 'ar') ? 'rtl' : 'ltr';
    document.documentElement.lang = currentLang;
    document.getElementById('main-content').style.display = 'block';
    document.getElementById('gallery-page').style.display = 'none';
});

window.toggleLanguage = toggleLanguage;
window.toggleTheme = toggleTheme;
window.openAdminLoginModal = openAdminLoginModal;
window.closeAdminLoginModal = closeAdminLoginModal;
window.compressAndEncodeImage = compressAndEncodeImage;
window.submitInquiryForm = submitInquiryForm;
window.showToast = showToast;
window.showConfirmModal = showConfirmModal;
window.toggleMobileMenu = toggleMobileMenu;
window.closeMobileMenu = closeMobileMenu;