// firebase-public.js (يُحمَّل في index.html فقط - الموقع العام)
import { signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, collection, addDoc, updateDoc, setDoc, getDoc, getDocs, onSnapshot, query, orderBy, limit, startAfter } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { auth, productsCollectionRef, settingsDocRef, mediaItemsCollectionRef, chatsCollectionRef, GALLERY_PAGE_SIZE, extractYouTubeId, DEFAULT_WEBSITE_SETTINGS } from "./firebase-shared.js";

window.productsList = [];
window.mediaItems = [];
window.websiteSettings = { ...DEFAULT_WEBSITE_SETTINGS };

let galleryLastVisibleDoc = null;
let galleryHasMore = true;
let galleryIsLoading = false;
let currentGalleryFilter = 'all';
let unsubscribeUserChat = null;

function getCurrentUserId() {
    const user = auth.currentUser;
    return user ? user.uid : null;
}
function chatDocById(id) { return doc(chatsCollectionRef, id); }

// ---- دوال الشات (زائر) ----
window.toggleChatWindow = function() {
    const win = document.getElementById('chat-window');
    if (win) win.classList.toggle('hidden');
    if (win && !win.classList.contains('hidden')) window.loadChatMessages();
};

window.submitVisitorInfo = async function() {
    const name = document.getElementById('chat-visitor-name').value.trim();
    const email = document.getElementById('chat-visitor-email').value.trim();
    const phone = document.getElementById('chat-visitor-phone').value.trim();
    if (!name || !email || !phone) { showToast('يرجى ملء جميع الحقول', 'warning'); return; }
    const userId = getCurrentUserId();
    if (!userId) return;
    const chatRef = chatDocById(userId);
    await setDoc(chatRef, { userId, visitorName: name, visitorEmail: email, visitorPhone: phone, lastMessage: '', timestamp: new Date(), unread: true }, { merge: true });
    document.getElementById('chat-info-form').classList.add('hidden');
    document.getElementById('chat-messages-area').classList.remove('hidden');
    window.loadChatMessages();
    showToast('تم تسجيل بياناتك، أهلاً بك', 'success');
};

window.loadChatMessages = async function() {
    const userId = getCurrentUserId();
    if (!userId) return;
    const chatRef = chatDocById(userId);
    const chatSnap = await getDoc(chatRef);
    if (chatSnap.exists() && chatSnap.data().visitorName) {
        document.getElementById('chat-info-form').classList.add('hidden');
        document.getElementById('chat-messages-area').classList.remove('hidden');
    } else {
        document.getElementById('chat-info-form').classList.remove('hidden');
        document.getElementById('chat-messages-area').classList.add('hidden');
        return;
    }
    if (unsubscribeUserChat) unsubscribeUserChat();
    const messagesRef = collection(chatRef, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'asc'));
    unsubscribeUserChat = onSnapshot(q, (snapshot) => {
        const messagesDiv = document.getElementById('chat-messages');
        if (!messagesDiv) return;
        messagesDiv.innerHTML = '';
        snapshot.forEach(docSnap => {
            const msg = docSnap.data();
            const div = document.createElement('div');
            div.className = `flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`;
            div.innerHTML = `<div class="max-w-[80%] px-3 py-1.5 rounded-2xl text-xs ${msg.sender === 'user' ? 'bg-primary-500 text-white' : 'bg-stone-200 dark:bg-stone-700 text-stone-800 dark:text-stone-200'}">${msg.text}</div>`;
            messagesDiv.appendChild(div);
        });
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }, (error) => console.error("خطأ في تحميل رسائل الشات:", error));
};

window.sendChatMessage = async function() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text) return;
    const userId = getCurrentUserId();
    if (!userId) return;
    const chatRef = chatDocById(userId);
    const messagesRef = collection(chatRef, 'messages');
    await addDoc(messagesRef, { text, sender: 'user', timestamp: new Date() });
    const chatSnap = await getDoc(chatRef);
    const data = chatSnap.data();
    await updateDoc(chatRef, { lastMessage: text, timestamp: new Date(), unread: true, visitorName: data.visitorName || 'زائر' });
    input.value = '';
};

// ---- فلتر المنتجات ----
window.filterCatalog = function(tag) {
    document.querySelectorAll('.product-card-item').forEach(c => {
        c.style.display = (tag === 'all' || c.getAttribute('data-tag') === tag) ? 'flex' : 'none';
    });
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('bg-primary-500', 'text-white'));
    document.getElementById(`filter-btn-${tag}`)?.classList.add('bg-primary-500', 'text-white');
    if (tag === 'all') document.getElementById('filter-btn-all').classList.add('bg-primary-500', 'text-white');
};

// ---- فلتر المعرض (الكل / صور / فيديوهات) ----
window.filterGallery = function(type) {
    currentGalleryFilter = type;
    document.querySelectorAll('.gallery-card').forEach(c => {
        c.style.display = (type === 'all' || c.getAttribute('data-media-type') === type) ? '' : 'none';
    });
    document.querySelectorAll('.gallery-filter-btn').forEach(b => b.classList.remove('bg-primary-500', 'text-white'));
    document.getElementById(`gallery-filter-${type}`)?.classList.add('bg-primary-500', 'text-white');
};

// ---- تحميل المعرض على دفعات (Pagination) ----
// كل صفحة معرض بتجيب 12 عنصر بس بدل تحميل كل الصور والفيديوهات دفعة واحدة، وده اللي
// بيحافظ على سرعة الموقع وعلى قراءات قاعدة البيانات مهما كبر المعرض.
window.loadGalleryPage = async function(reset = true) {
    if (galleryIsLoading) return;
    galleryIsLoading = true;
    try {
        if (reset) { galleryLastVisibleDoc = null; galleryHasMore = true; window.mediaItems = []; }
        let q = query(mediaItemsCollectionRef, orderBy('createdAt', 'desc'), limit(GALLERY_PAGE_SIZE));
        if (galleryLastVisibleDoc) q = query(mediaItemsCollectionRef, orderBy('createdAt', 'desc'), startAfter(galleryLastVisibleDoc), limit(GALLERY_PAGE_SIZE));
        const snap = await getDocs(q);
        const newItems = [];
        snap.forEach(d => newItems.push({ id: d.id, ...d.data() }));
        window.mediaItems = reset ? newItems : [...window.mediaItems, ...newItems];
        galleryLastVisibleDoc = snap.docs.length ? snap.docs[snap.docs.length - 1] : galleryLastVisibleDoc;
        galleryHasMore = snap.docs.length === GALLERY_PAGE_SIZE;
        renderGallery();
    } catch (ex) {
        console.error('خطأ في تحميل المعرض:', ex);
    } finally {
        galleryIsLoading = false;
    }
};
window.loadMoreGalleryItems = function() { window.loadGalleryPage(false); };

function renderGalleryLoadMoreButton() {
    const wrap = document.getElementById('gallery-load-more-wrap');
    if (!wrap) return;
    wrap.innerHTML = '';
    if (galleryHasMore && window.mediaItems.length) {
        const btn = document.createElement('button');
        btn.className = 'btn-outline-primary px-8 py-2.5 rounded-xl font-bold text-xs mx-auto block';
        btn.textContent = galleryIsLoading ? 'جاري التحميل...' : 'عرض المزيد';
        btn.onclick = () => window.loadMoreGalleryItems();
        wrap.appendChild(btn);
    }
}

window.playGalleryVideo = function(containerEl, embedUrl) {
    if (!containerEl || containerEl.dataset.loaded) return;
    containerEl.dataset.loaded = '1';
    containerEl.style.backgroundImage = '';
    containerEl.innerHTML = `<iframe src="${embedUrl}" frameborder="0" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen loading="lazy"></iframe>`;
};

// ---- مودال عرض الصورة + التنقل بالسهمين ----
let viewerImageUrls = [];
let viewerIndex = -1;

function refreshViewerImageList() {
    viewerImageUrls = window.mediaItems.filter(i => i.type === 'image').map(i => i.url);
}

function showViewerAtIndex(idx) {
    if (!viewerImageUrls.length) return;
    viewerIndex = ((idx % viewerImageUrls.length) + viewerImageUrls.length) % viewerImageUrls.length;
    const img = document.getElementById('image-viewer-img');
    if (img) img.src = viewerImageUrls[viewerIndex];
    const counter = document.getElementById('image-viewer-counter');
    if (counter) counter.textContent = `${viewerIndex + 1} / ${viewerImageUrls.length}`;
    const navWrap = document.getElementById('image-viewer-nav');
    if (navWrap) navWrap.style.display = viewerImageUrls.length > 1 ? 'flex' : 'none';
}

window.openImageViewer = function(src) {
    const modal = document.getElementById('image-viewer-modal');
    if (!modal || !src) return;
    refreshViewerImageList();
    const idx = viewerImageUrls.indexOf(src);
    showViewerAtIndex(idx >= 0 ? idx : 0);
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
};
window.closeImageViewer = function() {
    const modal = document.getElementById('image-viewer-modal');
    if (modal) { modal.classList.add('hidden'); document.body.style.overflow = ''; }
};
window.viewerNext = function() { showViewerAtIndex(viewerIndex + 1); };
window.viewerPrev = function() { showViewerAtIndex(viewerIndex - 1); };
document.addEventListener('keydown', function(e) {
    const modal = document.getElementById('image-viewer-modal');
    if (!modal || modal.classList.contains('hidden')) return;
    if (e.key === 'Escape') window.closeImageViewer();
    else if (e.key === 'ArrowLeft') window.viewerNext();
    else if (e.key === 'ArrowRight') window.viewerPrev();
});

// ---- رسم المعرض ----
function renderGallery() {
    const galleryGrid = document.getElementById('gallery-grid');
    if (!galleryGrid) return;
    galleryGrid.innerHTML = '';
    window.mediaItems.forEach(item => {
        const card = document.createElement('div');
        const mediaType = item.type === 'image' ? 'image' : 'video';
        card.className = 'bg-white dark:bg-dark-900 rounded-2xl overflow-hidden border border-stone-200 dark:border-stone-800 shadow-sm hover-lift gallery-card';
        card.setAttribute('data-media-type', mediaType);
        if (currentGalleryFilter !== 'all' && mediaType !== currentGalleryFilter) card.style.display = 'none';
        if (item.type === 'image') {
            card.innerHTML = `<img src="${item.url}" alt="${item.title}" class="w-full h-64 object-cover cursor-zoom-in opacity-0 transition-opacity duration-500" loading="lazy" decoding="async" onload="this.classList.remove('opacity-0')" onclick="openImageViewer('${item.url}')" /><div class="p-3 text-xs font-bold">${item.title}</div>`;
        } else if (item.type === 'video' || item.type === 'shorts') {
            const videoId = extractYouTubeId(item.url);
            const embedUrl = videoId ? `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0` : item.url;
            const thumbUrl = videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : '';
            const containerClass = item.type === 'shorts' ? 'shorts-container' : 'video-container';
            card.innerHTML = `<div class="${containerClass} gallery-video-facade cursor-pointer group" style="background-image:url('${thumbUrl}')" onclick="playGalleryVideo(this, '${embedUrl}')">
                <div class="absolute inset-0 bg-black/30 group-hover:bg-black/40 transition-all flex items-center justify-center">
                    <div class="w-14 h-14 rounded-full bg-primary-500/90 text-white flex items-center justify-center text-xl shadow-lg group-hover:scale-110 transition-all"><i class="fa-solid fa-play ml-1"></i></div>
                </div>
            </div><div class="p-3 text-xs font-bold">${item.title}</div>`;
        }
        galleryGrid.appendChild(card);
    });
    renderGalleryLoadMoreButton();
}

// ---- رسم واجهة الموقع العام (منتجات/عروض/تواصل) ----
function renderPublicUI() {
    const productsGrid = document.getElementById('products-grid');
    const offersGrid = document.getElementById('offers-grid');
    const contactChannelsDiv = document.getElementById('dyn-contact-channels');
    const socialLinksDiv = document.getElementById('dyn-social-links');
    const footerSocialDiv = document.getElementById('footer-social-links');
    const aboutEl = document.getElementById('dyn-about-text');
    const mapEl = document.getElementById('dyn-map-iframe');

    if (aboutEl) aboutEl.textContent = window.websiteSettings.aboutText || '';
    if (mapEl && window.websiteSettings.mapUrl) mapEl.src = window.websiteSettings.mapUrl;

    if (contactChannelsDiv) {
        contactChannelsDiv.innerHTML = '';
        (window.websiteSettings.channels || []).forEach(ch => {
            const colorMap = { primary: 'bg-primary-500/10 text-primary-600 dark:text-primary-400', gold: 'bg-gold-500/10 text-gold-600 dark:text-gold-500', stone: 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300' };
            const iconColorClass = colorMap[ch.color] || colorMap['stone'];
            let actionHref = '#', actionTarget = '';
            if (ch.action === 'tel') actionHref = 'tel:' + ch.value.replace(/\s+/g, '');
            else if (ch.action === 'mailto') actionHref = 'mailto:' + ch.value;
            else if (ch.action === 'whatsapp') { actionHref = 'https://wa.me/' + ch.value.replace(/[^0-9]/g, ''); actionTarget = '_blank'; }
            const div = document.createElement('div');
            div.className = 'flex items-center gap-3 channel-card';
            const iconDiv = document.createElement('div');
            iconDiv.className = `w-10 h-10 rounded-xl ${iconColorClass.split(' ')[0]} flex items-center justify-center text-xl ${iconColorClass.split(' ').slice(1).join(' ')}`;
            iconDiv.innerHTML = `<i class="${ch.icon}"></i>`;
            div.appendChild(iconDiv);
            const textDiv = document.createElement('div');
            const labelSpan = document.createElement('span');
            labelSpan.className = 'block text-[10px] text-stone-400 font-bold';
            labelSpan.textContent = ch.label;
            textDiv.appendChild(labelSpan);
            if (ch.action === 'text') {
                const valSpan = document.createElement('span');
                valSpan.className = 'text-xs font-bold text-stone-700 dark:text-stone-300';
                valSpan.textContent = ch.value;
                textDiv.appendChild(valSpan);
            } else {
                const a = document.createElement('a');
                a.href = actionHref; a.target = actionTarget;
                a.className = 'hover:text-primary-500 text-sm font-extrabold text-stone-900 dark:text-white';
                a.textContent = ch.value;
                textDiv.appendChild(a);
            }
            div.appendChild(textDiv);
            contactChannelsDiv.appendChild(div);
        });
    }

    const renderSocial = (container) => {
        if (!container) return;
        container.innerHTML = '';
        (window.websiteSettings.socialLinks || []).forEach(sl => {
            const hoverMap = { primary: 'hover:bg-primary-500', red: 'hover:bg-red-600', green: 'hover:bg-green-600', purple: 'hover:bg-purple-600', stone: 'hover:bg-stone-600', blue: 'hover:bg-blue-600', gold: 'hover:bg-gold-500' };
            const a = document.createElement('a');
            a.href = sl.url || '#'; a.target = '_blank';
            a.className = `w-9 h-9 rounded-xl bg-stone-100 dark:bg-dark-800 text-stone-700 dark:text-stone-300 flex items-center justify-center ${hoverMap[sl.color] || 'hover:bg-primary-500'} hover:text-white transition-all text-sm`;
            a.title = sl.platform || '';
            a.innerHTML = `<i class="${sl.icon}"></i>`;
            container.appendChild(a);
        });
    };
    renderSocial(socialLinksDiv);
    renderSocial(footerSocialDiv);

    if (productsGrid) productsGrid.innerHTML = '';
    if (offersGrid) offersGrid.innerHTML = '';

    const phoneChannel = (window.websiteSettings.channels || []).find(c => c.type === 'phone' || c.action === 'tel');
    const whatsappNumber = phoneChannel ? phoneChannel.value.replace(/[^0-9]/g, '') : '201015651543';

    const filterContainer = document.getElementById('filter-container');
    if (filterContainer) {
        const tags = new Set();
        window.productsList.forEach(p => { if (p.tag) tags.add(p.tag); });
        filterContainer.innerHTML = '';
        const allBtn = document.createElement('button');
        allBtn.id = 'filter-btn-all';
        allBtn.className = 'filter-btn px-6 py-2 rounded-xl bg-primary-500 text-white dark:bg-gold-500 dark:text-black font-extrabold text-xs whitespace-nowrap shadow-md';
        allBtn.textContent = 'كل الأصناف';
        allBtn.onclick = () => window.filterCatalog('all');
        filterContainer.appendChild(allBtn);
        tags.forEach(t => {
            const btn = document.createElement('button');
            btn.id = `filter-btn-${t}`;
            btn.className = 'filter-btn px-6 py-2 rounded-xl bg-white dark:bg-dark-900 text-stone-500 dark:text-stone-400 border border-stone-200 dark:border-stone-800 font-bold text-xs whitespace-nowrap shadow-sm hover:border-primary-500';
            btn.textContent = t;
            btn.onclick = () => window.filterCatalog(t);
            filterContainer.appendChild(btn);
        });
    }

    window.productsList.forEach(product => {
        const isShowPrice = product.showPrice === true || product.showPrice === 'true';
        const isOffer = product.isOffer === true || product.isOffer === 'true';
        let priceDisplay = product.priceAmount && product.currency ? `${product.priceAmount} ${product.currency}${product.unit || ''}` : (product.price || 'تواصل معنا');
        const priceHTML = isShowPrice ? `<p class="text-md font-bold text-primary-500 font-sans">${priceDisplay}</p>` : `<p class="text-[11px] font-bold text-emerald-600"><i class="fa-brands fa-whatsapp ml-1"></i> تواصل لطلب عرض السعر</p>`;

        if (productsGrid) {
            const card = document.createElement('div');
            card.className = "bg-white dark:bg-dark-900 rounded-2xl overflow-hidden border border-stone-200 dark:border-stone-900 shadow-sm hover:border-primary-500/40 transition-all flex flex-col justify-between product-card-item hover-lift";
            card.setAttribute('data-tag', product.tag || 'غير مصنف');
            card.innerHTML = `<div><div class="h-44 bg-stone-100 dark:bg-stone-800 relative bg-cover bg-center" style="background-image: url('${product.image || 'https://images.unsplash.com/photo-1542332213-9b5a5a3fda35?q=80&w=600&auto=format&fit=crop'}')"><span class="absolute top-3 right-3 text-[10px] font-bold px-2.5 py-1 rounded-md text-white ${product.tag === 'تصدير' ? 'bg-primary-500' : 'bg-stone-600'}">${product.tag || 'عام'}</span>${isOffer ? '<span class="absolute top-3 left-3 text-[9px] font-bold px-2 py-0.5 rounded-md bg-red-500 text-white animate-pulse">عرض خاص</span>' : ''}</div><div class="p-5 space-y-1.5"><h3 class="text-base font-black text-dark-950 dark:text-white">${product.name}</h3><p class="text-stone-500 dark:text-stone-400 text-xs leading-relaxed line-clamp-3">${product.desc || ''}</p></div></div><div class="p-5 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between gap-2">${priceHTML}<a href="https://wa.me/${whatsappNumber}?text=استفسار عن صنف: ${encodeURIComponent(product.name)}" target="_blank" class="px-3 py-1.5 rounded-lg bg-stone-100 dark:bg-dark-800 hover:bg-primary-500 hover:text-white dark:text-stone-300 transition-all text-xs font-bold">طلب تسعيرة</a></div>`;
            productsGrid.appendChild(card);
        }

        if (isOffer && offersGrid) {
            const offerCard = document.createElement('div');
            offerCard.className = "bg-white dark:bg-dark-800 border border-primary-500/10 rounded-2xl p-4 flex flex-col sm:flex-row gap-4 items-center shadow-sm hover-lift";
            offerCard.innerHTML = `<img src="${product.image || 'https://images.unsplash.com/photo-1542332213-9b5a5a3fda35?q=80&w=600&auto=format&fit=crop'}" class="w-20 h-20 rounded-xl object-cover" alt=""><div class="space-y-1 text-center sm:text-right flex-1"><h3 class="text-sm font-bold text-dark-950 dark:text-white">${product.name} <span class="bg-red-50 dark:bg-red-950/40 text-red-500 text-[9px] font-bold px-1.5 py-0.5 rounded">${product.offerDiscount ? '🔥 خصم ' + product.offerDiscount + '%' : 'خصم تعاقدي'}</span></h3><p class="text-stone-500 dark:text-stone-400 text-[11px]">${product.desc || ''}</p><div class="pt-1.5 flex items-center justify-between text-xs">${isShowPrice ? `<span class="font-bold text-red-500">${priceDisplay}</span>` : '<span class="text-stone-400">سعر مخفض للكميات الكبرى</span>'}<a href="https://wa.me/${whatsappNumber}?text=طلب خصم: ${encodeURIComponent(product.name)}" target="_blank" class="font-bold text-primary-500 hover:underline">الاستفادة من العرض</a></div></div>`;
            offersGrid.appendChild(offerCard);
        }
    });

    renderGallery();
}
window.renderUI = renderPublicUI; // اسم قديم متاح للتوافق

// ---- مراقبة المصادقة وتحميل بيانات الموقع العام ----
// الصفحة دي (index.html) للزوار بس؛ الدخول والتعديل بقى من صفحة admin.html المنفصلة.
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        try { await signInAnonymously(auth); } catch (e) { console.error(e); }
        return;
    }
    try {
        const [prodSnap, settingsSnap] = await Promise.all([getDocs(productsCollectionRef), getDoc(settingsDocRef)]);
        window.productsList = [];
        prodSnap.forEach(d => window.productsList.push({ id: d.id, ...d.data() }));
        if (settingsSnap.exists()) window.websiteSettings = { ...window.websiteSettings, ...settingsSnap.data() };
        renderPublicUI();
        await window.loadGalleryPage(true);
    } catch (e) {
        console.error("خطأ في تحميل بيانات الموقع:", e);
        showToast("تعذر تحميل بعض البيانات", "warning");
    }
});
