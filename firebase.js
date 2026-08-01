// firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInAnonymously, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot, setDoc, getDoc, getDocs, writeBatch, query, orderBy, limit, startAfter, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyANq5RBZtNOTKM_gJXG9fx20wB3qMPtu78",
    authDomain: "selim-charcoal-web.firebaseapp.com",
    projectId: "selim-charcoal-web",
    storageBucket: "selim-charcoal-web.firebasestorage.app",
    messagingSenderId: "275740911120",
    appId: "1:275740911120:web:eb5ecfcf7273cac8d28c95",
    measurementId: "G-6BXP9EWH5D"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'selim-exports-app';

const productsCollectionRef = collection(db, 'artifacts', appId, 'public', 'data', 'products');
const settingsDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'globalConfig');
const mediaItemsCollectionRef = collection(db, 'artifacts', appId, 'public', 'data', 'mediaItems');
const legacyMediaDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'media', 'items');
const chatsCollectionRef = collection(db, 'artifacts', appId, 'public', 'data', 'chats');

const GALLERY_PAGE_SIZE = 12;
const ADMIN_MEDIA_LIMIT = 300;
let galleryLastVisibleDoc = null;
let galleryHasMore = true;
let galleryIsLoading = false;

window.productsList = [];
window.mediaItems = [];
window.currentGalleryTab = 'image'; // تبويب المعرض الحالي الافتراضي: الصور
window.websiteSettings = {
    mapUrl: "https://www.google.com/maps/embed?pb=!1m18...",
    aboutText: "تعتبر شركة سليم للفحم النباتي واحدة من المؤسسات الوطنية الرائدة في إنتاج وتجهيز وتصدير أجود أنواع الفحم النباتي الطبيعي.",
    channels: [],
    socialLinks: []
};

window.editingProductId = null;
let unsubscribeUserChat = null;
let adminChatUnsubscribe = null;
let selectedChatId = null;

function generateLocalId(prefix = 'id') { return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 8); }
function extractYouTubeId(url) {
    if (!url) return null;
    url = url.trim();
    if (/^[a-zA-Z0-9_-]{11}$/.test(url)) return url;
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|shorts\/|.*[?&]v=))([\w-]{11})/i);
    return match ? match[1] : null;
}
function getCurrentUserId() { const user = auth.currentUser; return user ? user.uid : null; }

// ---- دوال الشات ----
window.toggleChatWindow = function() {
    const win = document.getElementById('chat-window');
    if (win) win.classList.toggle('hidden');
    if (win && !win.classList.contains('hidden')) { loadChatMessages(); }
};
window.submitVisitorInfo = async function() {
    const name = document.getElementById('chat-visitor-name').value.trim();
    const email = document.getElementById('chat-visitor-email').value.trim();
    const phone = document.getElementById('chat-visitor-phone').value.trim();
    if (!name || !email || !phone) return showToast('يرجى ملء جميع الحقول', 'warning');
    const userId = getCurrentUserId(); if (!userId) return;
    await setDoc(doc(chatsCollectionRef, userId), { userId, visitorName: name, visitorEmail: email, visitorPhone: phone, lastMessage: '', timestamp: new Date(), unread: true }, { merge: true });
    document.getElementById('chat-info-form').classList.add('hidden');
    document.getElementById('chat-messages-area').classList.remove('hidden');
    loadChatMessages(); showToast('تم تسجيل بياناتك، أهلاً بك', 'success');
};
window.loadChatMessages = async function() {
    const userId = getCurrentUserId(); if (!userId) return;
    const chatRef = doc(chatsCollectionRef, userId);
    const chatSnap = await getDoc(chatRef);
    if (chatSnap.exists() && chatSnap.data().visitorName) {
        document.getElementById('chat-info-form')?.classList.add('hidden');
        document.getElementById('chat-messages-area')?.classList.remove('hidden');
    } else {
        document.getElementById('chat-info-form')?.classList.remove('hidden');
        document.getElementById('chat-messages-area')?.classList.add('hidden');
        return;
    }
    if (unsubscribeUserChat) unsubscribeUserChat();
    unsubscribeUserChat = onSnapshot(query(collection(chatRef, 'messages'), orderBy('timestamp', 'asc')), (snapshot) => {
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
    });
};
window.sendChatMessage = async function() {
    const input = document.getElementById('chat-input'), text = input.value.trim(); if (!text) return;
    const userId = getCurrentUserId(); if (!userId) return;
    const chatRef = doc(chatsCollectionRef, userId);
    await addDoc(collection(chatRef, 'messages'), { text, sender: 'user', timestamp: new Date() });
    const chatSnap = await getDoc(chatRef);
    await updateDoc(chatRef, { lastMessage: text, timestamp: new Date(), unread: true, visitorName: chatSnap.data().visitorName || 'زائر' });
    input.value = '';
};

// ---- دوال الشات للإدارة ----
window.loadAdminChatList = function() {
    const listDiv = document.getElementById('admin-chat-list'); if (!listDiv) return;
    onSnapshot(query(chatsCollectionRef, orderBy('timestamp', 'desc')), (snapshot) => {
        listDiv.innerHTML = '';
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const div = document.createElement('div');
            div.className = `p-2 rounded-lg cursor-pointer hover:bg-stone-100 dark:hover:bg-stone-800 text-xs ${selectedChatId === docSnap.id ? 'bg-primary-100 dark:bg-primary-900' : ''}`;
            div.innerHTML = `<div class="flex justify-between items-start"><span class="font-bold">${data.visitorName || 'زائر'}</span><button onclick="event.stopPropagation(); deleteChat('${docSnap.id}')" class="text-red-500 hover:text-red-700 text-[10px]"><i class="fa-solid fa-trash-can"></i></button></div><div class="text-[9px] text-stone-400">${data.visitorEmail || ''} | ${data.visitorPhone || ''}</div><span class="text-stone-400 text-[10px]">${data.lastMessage || ''}</span>`;
            div.onclick = () => openAdminChat(docSnap.id);
            listDiv.appendChild(div);
        });
    });
};
window.deleteChat = async function(chatId) {
    if (!auth.currentUser || auth.currentUser.isAnonymous) return showToast('يجب تسجيل الدخول كمسؤول', 'error');
    showConfirmModal('حذف المحادثة', 'سيتم حذف المحادثة. هل أنت متأكد؟', async () => {
        const chatRef = doc(chatsCollectionRef, chatId);
        const snapshot = await getDocs(collection(chatRef, 'messages'));
        const batch = writeBatch(db);
        snapshot.forEach(d => batch.delete(d.ref));
        await batch.commit(); await deleteDoc(chatRef);
        showToast('تم الحذف', 'success'); loadAdminChatList();
        if (selectedChatId === chatId) { selectedChatId = null; document.getElementById('admin-chat-header').innerText = 'اختر محادثة'; document.getElementById('admin-chat-messages').innerHTML = ''; if (adminChatUnsubscribe) adminChatUnsubscribe(); }
    });
};
window.openAdminChat = async function(chatId) {
    selectedChatId = chatId;
    const chatSnap = await getDoc(doc(chatsCollectionRef, chatId));
    document.getElementById('admin-chat-header').innerText = `محادثة مع ${chatSnap.exists() ? chatSnap.data().visitorName || chatId : chatId}`;
    const messagesDiv = document.getElementById('admin-chat-messages'); messagesDiv.innerHTML = '';
    if (adminChatUnsubscribe) adminChatUnsubscribe();
    adminChatUnsubscribe = onSnapshot(query(collection(doc(chatsCollectionRef, chatId), 'messages'), orderBy('timestamp', 'asc')), (snapshot) => {
        messagesDiv.innerHTML = '';
        snapshot.forEach(docSnap => {
            const msg = docSnap.data(), div = document.createElement('div');
            div.className = `flex ${msg.sender === 'admin' ? 'justify-end' : 'justify-start'}`;
            div.innerHTML = `<div class="max-w-[80%] px-3 py-1.5 rounded-2xl text-xs ${msg.sender === 'admin' ? 'bg-primary-500 text-white' : 'bg-stone-200 dark:bg-stone-700 text-stone-800 dark:text-stone-200'}">${msg.text}</div>`;
            messagesDiv.appendChild(div);
        });
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    });
    updateDoc(doc(chatsCollectionRef, chatId), { unread: false });
};
window.sendAdminReply = async function() {
    if (!selectedChatId) return;
    const input = document.getElementById('admin-chat-input'), text = input.value.trim(); if (!text) return;
    const chatRef = doc(chatsCollectionRef, selectedChatId);
    await addDoc(collection(chatRef, 'messages'), { text, sender: 'admin', timestamp: new Date() });
    await updateDoc(chatRef, { lastMessage: text, timestamp: new Date() }); input.value = '';
};

// ---- دوال المنتجات والعروض ----
window.toggleOfferDetails = function() {
    const checked = document.getElementById('prod-is-offer').checked;
    document.getElementById('offer-details').classList.toggle('hidden', !checked);
};
window.editProduct = function(id) {
    const product = window.productsList.find(p => p.id === id); if (!product) return;
    window.editingProductId = id;
    document.getElementById('prod-name').value = product.name || '';
    document.getElementById('prod-tag').value = product.tag || '';
    document.getElementById('prod-price-amount').value = product.priceAmount || '';
    document.getElementById('prod-currency').value = product.currency || '$';
    document.getElementById('prod-unit').value = product.unit || '';
    document.getElementById('prod-show-price').value = product.showPrice === true || product.showPrice === 'true' ? 'true' : 'false';
    document.getElementById('prod-image-url').value = product.image || '';
    document.getElementById('prod-desc').value = product.desc || '';
    document.getElementById('prod-is-offer').checked = product.isOffer === true || product.isOffer === 'true';
    document.getElementById('prod-discount').value = product.offerDiscount || '';
    document.getElementById('prod-offer-end').value = product.offerEndDate || '';
    document.getElementById('prod-offer-desc').value = product.offerDesc || '';
    document.getElementById('offer-details').classList.toggle('hidden', !(product.isOffer === true || product.isOffer === 'true'));
    const previewImg = document.getElementById('image-preview');
    if (product.image && previewImg) { previewImg.src = product.image; document.getElementById('image-preview-container').classList.remove('hidden'); }
    document.getElementById('admin-save-product-btn').textContent = 'تحديث المنتج';
    window.scrollTo({ top: document.getElementById('admin-tab-products').offsetTop - 100, behavior: 'smooth' });
    showToast('جاري تعديل المنتج', 'info');
};
window.saveProductToCloud = async function() {
    const name = document.getElementById('prod-name').value.trim();
    const priceAmount = parseFloat(document.getElementById('prod-price-amount').value);
    if (!auth.currentUser || auth.currentUser.isAnonymous) return showToast('يجب تسجيل الدخول.', 'error');
    if (!name || isNaN(priceAmount) || priceAmount <= 0) return showToast('يرجى ملء الحقول بشكل صحيح.', 'warning');
    const productData = {
        name, tag: document.getElementById('prod-tag').value.trim() || 'عام', priceAmount,
        currency: document.getElementById('prod-currency').value || '$', unit: document.getElementById('prod-unit').value.trim() || '',
        showPrice: document.getElementById('prod-show-price').value === 'true', image: document.getElementById('prod-image-url').value.trim() || 'https://images.unsplash.com/photo-1542332213-9b5a5a3fda35?q=80&w=600',
        desc: document.getElementById('prod-desc').value.trim() || 'فحم نباتي طبيعي فاخر.', isOffer: document.getElementById('prod-is-offer').checked,
        offerDiscount: document.getElementById('prod-discount').value.trim(), offerEndDate: document.getElementById('prod-offer-end').value, offerDesc: document.getElementById('prod-offer-desc').value.trim()
    };
    try {
        if (window.editingProductId) { await updateDoc(doc(productsCollectionRef, window.editingProductId), productData); window.editingProductId = null; document.getElementById('admin-save-product-btn').textContent = 'نشر وحفظ في السحاب'; showToast('تم التحديث ✅', 'success'); }
        else { await addDoc(productsCollectionRef, productData); showToast('تم النشر 🚀', 'success'); }
        ['prod-name','prod-tag','prod-price-amount','prod-unit','prod-image-url','prod-desc','prod-discount','prod-offer-end','prod-offer-desc'].forEach(id => document.getElementById(id).value = '');
        document.getElementById('prod-is-offer').checked = false; document.getElementById('offer-details').classList.add('hidden'); document.getElementById('image-preview-container').classList.add('hidden'); document.getElementById('prod-image-file').value = '';
    } catch (ex) { showToast('خطأ: ' + ex.message, 'error'); }
};
window.deleteCloudProduct = function(id) {
    if (!auth.currentUser || auth.currentUser.isAnonymous) return;
    showConfirmModal('حذف المنتج', 'هل أنت متأكد؟', async () => { await deleteDoc(doc(productsCollectionRef, id)); showToast('تم الحذف', 'success'); });
};
window.toggleCloudOfferStatus = async function(id) {
    const prod = window.productsList.find(p => p.id === id); if (!prod) return;
    await updateDoc(doc(productsCollectionRef, id), { isOffer: !(prod.isOffer === true || prod.isOffer === 'true') });
};
window.filterCatalog = function(tag) {
    document.querySelectorAll('.product-card-item').forEach(c => c.style.display = (tag === 'all' || c.getAttribute('data-tag') === tag) ? 'flex' : 'none');
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('bg-primary-500', 'text-white'));
    document.getElementById(`filter-btn-${tag}`)?.classList.add('bg-primary-500', 'text-white');
    if (tag === 'all') document.getElementById('filter-btn-all').classList.add('bg-primary-500', 'text-white');
};

// ---- دوال مودال تفاصيل المنتج ----
window.openProductModal = function(id) {
    const product = window.productsList.find(p => p.id === id);
    if (!product) return;
    
    document.getElementById('modal-product-img').src = product.image;
    document.getElementById('modal-product-name').textContent = product.name;
    document.getElementById('modal-product-tag').textContent = product.tag || 'عام';
    document.getElementById('modal-product-desc').textContent = product.desc || 'لا يوجد وصف متاح.';
    
    const isShowPrice = product.showPrice === true || product.showPrice === 'true';
    let priceDisplay = product.priceAmount && product.currency ? `${product.priceAmount} ${product.currency}${product.unit || ''}` : 'تواصل معنا';
    document.getElementById('modal-product-price').innerHTML = isShowPrice ? priceDisplay : `<span class="text-emerald-600 text-sm"><i class="fa-brands fa-whatsapp ml-1"></i> تواصل لطلب عرض السعر</span>`;
    
    let num = '201024982550';
    if (window._websiteSettings && window._websiteSettings.channels) {
        const ph = window._websiteSettings.channels.find(c => c.type === 'phone' || c.action === 'tel');
        if (ph) num = ph.value.replace(/[^0-9]/g, '');
    }
    document.getElementById('modal-product-whatsapp').href = `https://wa.me/${num}?text=استفسار عن صنف: ${encodeURIComponent(product.name)}`;
    
    const modal = document.getElementById('product-modal');
    if (modal) { modal.classList.remove('hidden'); document.body.style.overflow = 'hidden'; }
};

window.closeProductModal = function() {
    const modal = document.getElementById('product-modal');
    if (modal) { modal.classList.add('hidden'); document.body.style.overflow = ''; }
};

// ---- دوال المعرض والـ API ----
window.addMediaItem = async function() {
    if (!auth.currentUser || auth.currentUser.isAnonymous) return showToast('يجب تسجيل الدخول كمسؤول', 'error');
    const type = document.getElementById('media-type').value, title = document.getElementById('media-title').value.trim();
    let url = document.getElementById('media-url').value.trim();
    if (!title) return showToast('يرجى كتابة عنوان', 'warning');
    if (type !== 'image') {
        if (!url) return showToast('يرجى إدخال الرابط', 'warning');
        const videoId = extractYouTubeId(url); if (!videoId) return showToast('رابط يوتيوب غير صالح', 'warning');
        url = videoId;
    } else if (!url) return showToast('يرجى إدخال الرابط أو رفع الصورة', 'warning');
    const addBtn = document.getElementById('media-add-btn'); if (addBtn) { addBtn.disabled = true; addBtn.classList.add('opacity-60'); }
    try {
        await addDoc(mediaItemsCollectionRef, { type, title, url, createdAt: serverTimestamp() });
        showToast('تمت الإضافة للمعرض ✅', 'success');
        document.getElementById('media-title').value = ''; document.getElementById('media-url').value = ''; document.getElementById('media-file-input').value = '';
        if (document.getElementById('media-preview')) document.getElementById('media-preview').src = '';
        document.getElementById('media-preview-container')?.classList.add('hidden');
        loadAdminMediaList();
    } catch (ex) { showToast('خطأ أثناء الإضافة: ' + ex.message, 'error'); }
    finally { if (addBtn) { addBtn.disabled = false; addBtn.classList.remove('opacity-60'); } }
};
window.deleteMediaItem = function(id) {
    if (!auth.currentUser || auth.currentUser.isAnonymous) return showToast('يجب تسجيل الدخول كمسؤول', 'error');
    showConfirmModal('حذف الوسائط', 'هل أنت متأكد؟', async () => { await deleteDoc(doc(mediaItemsCollectionRef, id)); showToast('تم الحذف', 'success'); loadAdminMediaList(); });
};
window.handleMediaTypeChange = function() {
    const type = document.getElementById('media-type').value, urlC = document.getElementById('media-url-container'), fileC = document.getElementById('media-file-container');
    if (type === 'image') { urlC.classList.remove('md:col-span-2'); fileC.classList.remove('hidden'); }
    else { urlC.classList.add('md:col-span-2'); fileC.classList.add('hidden'); }
};

window.switchGalleryTab = function(tab) {
    window.currentGalleryTab = tab;
    const imgBtn = document.getElementById('tab-img-btn');
    const vidBtn = document.getElementById('tab-vid-btn');
    if (imgBtn && vidBtn) {
        if (tab === 'image') {
            imgBtn.className = "px-8 py-2.5 rounded-xl bg-primary-500 text-white font-bold text-sm shadow-md transition-all";
            vidBtn.className = "px-8 py-2.5 rounded-xl bg-white dark:bg-dark-900 text-stone-600 dark:text-stone-300 border border-stone-200 dark:border-stone-800 font-bold text-sm shadow-sm transition-all hover:border-primary-500";
        } else {
            vidBtn.className = "px-8 py-2.5 rounded-xl bg-primary-500 text-white font-bold text-sm shadow-md transition-all";
            imgBtn.className = "px-8 py-2.5 rounded-xl bg-white dark:bg-dark-900 text-stone-600 dark:text-stone-300 border border-stone-200 dark:border-stone-800 font-bold text-sm shadow-sm transition-all hover:border-primary-500";
        }
    }
    renderUI();
};

window.loadGalleryPage = async function(reset = true) {
    if (galleryIsLoading) return; galleryIsLoading = true;
    try {
        if (reset) { galleryLastVisibleDoc = null; galleryHasMore = true; window.mediaItems = []; }
        let q = query(mediaItemsCollectionRef, orderBy('createdAt', 'desc'), limit(GALLERY_PAGE_SIZE));
        if (galleryLastVisibleDoc) q = query(mediaItemsCollectionRef, orderBy('createdAt', 'desc'), startAfter(galleryLastVisibleDoc), limit(GALLERY_PAGE_SIZE));
        const snap = await getDocs(q);
        const newItems = []; snap.forEach(d => newItems.push({ id: d.id, ...d.data() }));
        window.mediaItems = reset ? newItems : [...window.mediaItems, ...newItems];
        galleryLastVisibleDoc = snap.docs.length ? snap.docs[snap.docs.length - 1] : galleryLastVisibleDoc;
        galleryHasMore = snap.docs.length === GALLERY_PAGE_SIZE;
        renderUI();
    } catch (ex) { console.error(ex); } finally { galleryIsLoading = false; }
};
window.loadMoreGalleryItems = function() { loadGalleryPage(false); };
function renderGalleryLoadMoreButton() {
    const wrap = document.getElementById('gallery-load-more-wrap'); if (!wrap) return; wrap.innerHTML = '';
    if (galleryHasMore && window.mediaItems.length) {
        const btn = document.createElement('button');
        btn.className = 'btn-outline-primary px-8 py-2.5 rounded-xl font-bold text-xs mx-auto block';
        btn.textContent = galleryIsLoading ? 'جاري التحميل...' : 'عرض المزيد';
        btn.onclick = () => window.loadMoreGalleryItems();
        wrap.appendChild(btn);
    }
}
function loadAdminMediaList() {
    const q = query(mediaItemsCollectionRef, orderBy('createdAt', 'desc'), limit(ADMIN_MEDIA_LIMIT));
    onSnapshot(q, (snap) => { window.mediaItems = []; snap.forEach(d => window.mediaItems.push({ id: d.id, ...d.data() })); galleryHasMore = false; renderUI(); });
}

// ---- إعدادات ونسخ احتياطي ----
window.verifyAdminCloudAuth = async function() {
    const email = document.getElementById('admin-email').value.trim(), password = document.getElementById('admin-password').value.trim();
    if (!email || !password) return showToast('يرجى الإدخال.', 'warning');
    try { await signInWithEmailAndPassword(auth, email, password); showToast('تم الدخول', 'success'); } catch (e) { showToast('فشل التحقق', 'error'); }
};
window.logoutAdminCloud = async function() { try { await signOut(auth); showToast('تم الخروج', 'info'); } catch (e) { showToast('فشل', 'error'); } };
window.addNewChannel = function() { window.websiteSettings.channels.push({ id: generateLocalId('ch'), type: 'phone', icon: 'fa-solid fa-phone', label: 'قناة جديدة', value: '+20', action: 'tel', color: 'primary' }); renderAdminChannelsList(); };
window.deleteChannel = function(id) { window.websiteSettings.channels = window.websiteSettings.channels.filter(c => c.id !== id); renderAdminChannelsList(); };
window.addNewSocialLink = function() { window.websiteSettings.socialLinks.push({ id: generateLocalId('sl'), icon: 'fa-brands fa-instagram', url: 'https://', color: 'primary', platform: 'منصة' }); renderAdminSocialLinksList(); };
window.deleteSocialLink = function(id) { window.websiteSettings.socialLinks = window.websiteSettings.socialLinks.filter(s => s.id !== id); renderAdminSocialLinksList(); };
window.saveChannelsAndSocialToCloud = async function() { await setDoc(settingsDocRef, { channels: window.websiteSettings.channels, socialLinks: window.websiteSettings.socialLinks }, { merge: true }); showToast('تم الحفظ', 'success'); };
window.saveWebsiteSettingsToCloud = async function() { await setDoc(settingsDocRef, { mapUrl: document.getElementById('setting-map-url').value.trim(), aboutText: document.getElementById('setting-about').value.trim() }, { merge: true }); showToast('تم الحفظ', 'success'); };
window.exportBackup = async function() {
    const productsSnap = await getDocs(productsCollectionRef); const products = []; productsSnap.forEach(d => products.push({ id: d.id, ...d.data() }));
    const settingsSnap = await getDoc(settingsDocRef); const settings = settingsSnap.exists() ? settingsSnap.data() : {};
    const mediaSnap = await getDocs(mediaItemsCollectionRef); const media = []; mediaSnap.forEach(d => media.push({ id: d.id, ...d.data() }));
    const blob = new Blob([JSON.stringify({ products, settings, media, exportDate: new Date().toISOString() }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = `selim-backup-${new Date().toISOString().slice(0,10)}.json`; a.click(); URL.revokeObjectURL(url); showToast('تم التصدير', 'success');
};
window.importBackup = function(event) {
    const file = event.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const backup = JSON.parse(e.target.result);
            if (!backup.products || !backup.settings) throw new Error('ملف غير صالح');
            showConfirmModal('استعادة', 'سيتم استبدال البيانات. متأكد؟', async () => {
                const existing = await getDocs(productsCollectionRef); await Promise.all(existing.docs.map(d => deleteDoc(d.ref)));
                await Promise.all(backup.products.map(p => { const { id, ...data } = p; return addDoc(productsCollectionRef, data); }));
                await setDoc(settingsDocRef, backup.settings);
                if (backup.media && backup.media.length) {
                    const existingMedia = await getDocs(mediaItemsCollectionRef); await Promise.all(existingMedia.docs.map(d => deleteDoc(d.ref)));
                    await Promise.all(backup.media.map((m) => { const { id, ...data } = m; if (!data.createdAt) data.createdAt = serverTimestamp(); return addDoc(mediaItemsCollectionRef, data); }));
                }
                showToast('تم! سيتم تحديث الصفحة.', 'success'); setTimeout(() => location.reload(), 1500);
            });
        } catch (e) { showToast('خطأ: ' + e.message, 'error'); }
    }; reader.readAsText(file);
};
window.switchAdminTab = function(tab) {
    ['products', 'offers', 'media', 'settings', 'channels', 'chat', 'backup'].forEach(t => {
        document.getElementById(`admin-tab-${t}`)?.classList.add('hidden');
        if(document.getElementById(`tab-btn-${t}`)) document.getElementById(`tab-btn-${t}`).className = 'px-4 py-2 text-xs font-bold rounded-lg bg-stone-100 text-stone-600 dark:bg-dark-800 dark:text-stone-400 transition-all';
    });
    document.getElementById(`admin-tab-${tab}`)?.classList.remove('hidden');
    if(document.getElementById(`tab-btn-${tab}`)) document.getElementById(`tab-btn-${tab}`).className = 'px-4 py-2 text-xs font-black rounded-lg bg-primary-500 text-white shadow-md transition-all';
    if (tab === 'chat') loadAdminChatList();
};

function renderAdminChannelsList() {
    const c = document.getElementById('admin-channels-list'); if (!c) return; c.innerHTML = '';
    (window.websiteSettings.channels || []).forEach(ch => {
        const d = document.createElement('div');
        d.className = 'flex flex-wrap items-center gap-2 bg-white dark:bg-dark-900 p-3 rounded-xl border border-stone-200 dark:border-stone-800';
        d.innerHTML = `<i class="${ch.icon} text-lg text-${ch.color}-500 w-8 text-center"></i>
        <input type="text" value="${ch.label}" data-ch-id="${ch.id}" data-field="label" class="flex-1 min-w-[120px] bg-stone-50 dark:bg-dark-800 border border-stone-200 rounded-lg px-2 py-1.5 text-xs channel-input" />
        <input type="text" value="${ch.value}" data-ch-id="${ch.id}" data-field="value" class="flex-1 min-w-[120px] bg-stone-50 dark:bg-dark-800 border border-stone-200 rounded-lg px-2 py-1.5 text-xs channel-input text-left font-mono" />
        <select data-ch-id="${ch.id}" data-field="action" class="bg-stone-50 dark:bg-dark-800 border border-stone-200 rounded-lg px-2 py-1.5 text-xs channel-input"><option value="tel" ${ch.action==='tel'?'selected':''}>هاتف</option><option value="mailto" ${ch.action==='mailto'?'selected':''}>بريد</option><option value="whatsapp" ${ch.action==='whatsapp'?'selected':''}>واتساب</option><option value="text" ${ch.action==='text'?'selected':''}>نص</option></select>
        <button onclick="deleteChannel('${ch.id}')" class="w-7 h-7 rounded-lg bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white flex items-center justify-center shrink-0"><i class="fa-solid fa-xmark text-xs"></i></button>`;
        c.appendChild(d);
    });
    c.querySelectorAll('.channel-input').forEach(inp => inp.addEventListener('change', function() { const idx = (window.websiteSettings.channels || []).findIndex(c => c.id === this.dataset.chId); if (idx >= 0) window.websiteSettings.channels[idx][this.dataset.field] = this.value; }));
}
function renderAdminSocialLinksList() {
    const c = document.getElementById('admin-social-links-list'); if (!c) return; c.innerHTML = '';
    (window.websiteSettings.socialLinks || []).forEach(sl => {
        const d = document.createElement('div');
        d.className = 'flex flex-wrap items-center gap-2 bg-white dark:bg-dark-900 p-3 rounded-xl border border-stone-200 dark:border-stone-800';
        d.innerHTML = `<i class="${sl.icon} text-lg text-${sl.color}-500 w-8 text-center"></i>
        <input type="text" value="${sl.platform || ''}" data-sl-id="${sl.id}" data-field="platform" class="flex-1 min-w-[100px] bg-stone-50 dark:bg-dark-800 border border-stone-200 rounded-lg px-2 py-1.5 text-xs social-input" />
        <input type="text" value="${sl.url}" data-sl-id="${sl.id}" data-field="url" class="flex-1 min-w-[150px] bg-stone-50 dark:bg-dark-800 border border-stone-200 rounded-lg px-2 py-1.5 text-xs social-input text-left font-mono" />
        <button onclick="deleteSocialLink('${sl.id}')" class="w-7 h-7 rounded-lg bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white flex items-center justify-center shrink-0"><i class="fa-solid fa-xmark text-xs"></i></button>`;
        c.appendChild(d);
    });
    c.querySelectorAll('.social-input').forEach(inp => inp.addEventListener('change', function() { const idx = (window.websiteSettings.socialLinks || []).findIndex(s => s.id === this.dataset.slId); if (idx >= 0) window.websiteSettings.socialLinks[idx][this.dataset.field] = this.value; }));
}
function renderAdminMediaList() {
    const list = document.getElementById('admin-media-list'); if (!list) return; list.innerHTML = '';
    if (!window.mediaItems.length) { list.innerHTML = '<p class="text-[11px] text-stone-400 text-center py-2">لا توجد عناصر.</p>'; return; }
    window.mediaItems.forEach(item => {
        const div = document.createElement('div'); div.className = 'flex justify-between items-center bg-white dark:bg-dark-900 p-2 rounded-lg border border-stone-200 text-xs';
        div.innerHTML = `<span>${item.title} (${item.type === 'image' ? 'صورة' : (item.type === 'shorts' ? 'شورتس' : 'فيديو')})</span><button onclick="deleteMediaItem('${item.id}')" class="text-red-500 hover:text-red-700"><i class="fa-solid fa-trash"></i></button>`;
        list.appendChild(div);
    });
}
function renderAdminOffersTable() {
    const tbody = document.getElementById('admin-offers-table-body'); if (!tbody) return; tbody.innerHTML = '';
    window.productsList.filter(p => p.isOffer === true || p.isOffer === 'true').forEach(product => {
        const tr = document.createElement('tr'); tr.className = "border-b border-stone-200 dark:border-stone-800";
        tr.innerHTML = `<td class="p-3 font-bold">${product.name}</td><td class="p-3">${product.priceAmount || ''} ${product.currency || ''}</td><td class="p-3">${product.offerDiscount || '-'}%</td><td class="p-3">${product.offerEndDate || 'غير محدد'}</td><td class="p-3"><span class="px-2 py-1 rounded text-[10px] font-black ${new Date(product.offerEndDate) < new Date() && product.offerEndDate ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}">${product.offerEndDate && new Date(product.offerEndDate) < new Date() ? 'منتهي' : 'ساري'}</span></td><td class="p-3 text-center"><button onclick="editProduct('${product.id}')" class="w-7 h-7 rounded-lg bg-blue-500/10 hover:bg-blue-500 text-blue-500 hover:text-white"><i class="fa-solid fa-pen text-xs"></i></button></td>`;
        tbody.appendChild(tr);
    });
}

function renderUI() {
    if (document.getElementById('dyn-about-text')) document.getElementById('dyn-about-text').textContent = window.websiteSettings.aboutText || '';
    if (document.getElementById('dyn-map-iframe') && window.websiteSettings.mapUrl) document.getElementById('dyn-map-iframe').src = window.websiteSettings.mapUrl;
    window._websiteSettings = window.websiteSettings;

    const contactDiv = document.getElementById('dyn-contact-channels');
    if (contactDiv) {
        contactDiv.innerHTML = '';
        (window.websiteSettings.channels || []).forEach(ch => {
            let actionHref = '#'; if (ch.action === 'tel') actionHref = 'tel:' + ch.value.replace(/\s+/g, ''); else if (ch.action === 'mailto') actionHref = 'mailto:' + ch.value;
            const div = document.createElement('div'); div.className = 'flex items-center gap-3 channel-card';
            div.innerHTML = `<div class="w-10 h-10 rounded-xl bg-stone-100 dark:bg-stone-800 flex items-center justify-center text-xl text-stone-600 dark:text-stone-300"><i class="${ch.icon}"></i></div><div><span class="block text-[10px] text-stone-400 font-bold">${ch.label}</span>${ch.action === 'text' ? `<span class="text-xs font-bold text-stone-700 dark:text-stone-300">${ch.value}</span>` : `<a href="${actionHref}" class="hover:text-primary-500 text-sm font-extrabold text-stone-900 dark:text-white">${ch.value}</a>`}</div>`;
            contactDiv.appendChild(div);
        });
    }

    const renderSocial = (c) => { if (!c) return; c.innerHTML = ''; (window.websiteSettings.socialLinks || []).forEach(sl => { const a = document.createElement('a'); a.href = sl.url || '#'; a.target = '_blank'; a.className = `w-9 h-9 rounded-xl bg-stone-100 dark:bg-dark-800 text-stone-700 dark:text-stone-300 flex items-center justify-center hover:bg-primary-500 hover:text-white transition-all text-sm`; a.title = sl.platform || ''; a.innerHTML = `<i class="${sl.icon}"></i>`; c.appendChild(a); }); };
    renderSocial(document.getElementById('dyn-social-links')); renderSocial(document.getElementById('footer-social-links'));

    const productsGrid = document.getElementById('products-grid'), offersGrid = document.getElementById('offers-grid'), adminTableBody = document.getElementById('admin-products-table-body');
    if (productsGrid) productsGrid.innerHTML = ''; if (offersGrid) offersGrid.innerHTML = ''; if (adminTableBody) adminTableBody.innerHTML = '';
    const phoneChannel = (window.websiteSettings.channels || []).find(c => c.type === 'phone' || c.action === 'tel');
    const whatsappNumber = phoneChannel ? phoneChannel.value.replace(/[^0-9]/g, '') : '201015651543';

    const filterContainer = document.getElementById('filter-container');
    if (filterContainer) {
        const tags = new Set(); window.productsList.forEach(p => { if (p.tag) tags.add(p.tag); }); filterContainer.innerHTML = '';
        const allBtn = document.createElement('button'); allBtn.id = 'filter-btn-all'; allBtn.className = 'filter-btn px-6 py-2 rounded-xl bg-primary-500 text-white font-extrabold text-xs whitespace-nowrap shadow-md'; allBtn.textContent = 'كل الأصناف'; allBtn.onclick = () => filterCatalog('all'); filterContainer.appendChild(allBtn);
        tags.forEach(t => { const btn = document.createElement('button'); btn.id = `filter-btn-${t}`; btn.className = 'filter-btn px-6 py-2 rounded-xl bg-white dark:bg-dark-900 text-stone-500 border border-stone-200 font-bold text-xs whitespace-nowrap shadow-sm hover:border-primary-500'; btn.textContent = t; btn.onclick = () => filterCatalog(t); filterContainer.appendChild(btn); });
    }

    window.productsList.forEach(product => {
        const isShowPrice = product.showPrice === true || product.showPrice === 'true', isOffer = product.isOffer === true || product.isOffer === 'true';
        let priceDisplay = product.priceAmount && product.currency ? `${product.priceAmount} ${product.currency}${product.unit || ''}` : 'تواصل معنا';
        const priceHTML = isShowPrice ? `<p class="text-md font-bold text-primary-500 font-sans">${priceDisplay}</p>` : `<p class="text-[11px] font-bold text-emerald-600"><i class="fa-brands fa-whatsapp ml-1"></i> تواصل لطلب عرض السعر</p>`;

        if (productsGrid) {
            const card = document.createElement('div'); card.className = "bg-white dark:bg-dark-900 rounded-2xl overflow-hidden border border-stone-200 shadow-sm hover-lift product-card-item"; card.setAttribute('data-tag', product.tag || 'غير مصنف');
            card.innerHTML = `<div><div class="h-44 bg-stone-100 dark:bg-dark-950 relative bg-cover bg-center cursor-pointer group" style="background-image: url('${product.image}')" onclick="openProductModal('${product.id}')"><div class="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center"><i class="fa-solid fa-expand text-white text-3xl opacity-0 group-hover:opacity-100 transition-all scale-50 group-hover:scale-100"></i></div><span class="absolute top-3 right-3 text-[10px] font-bold px-2.5 py-1 rounded-md text-white bg-stone-600 z-10">${product.tag || 'عام'}</span>${isOffer ? '<span class="absolute top-3 left-3 text-[9px] font-bold px-2 py-0.5 rounded-md bg-red-500 text-white animate-pulse z-10">عرض خاص</span>' : ''}</div><div class="p-5 space-y-1.5 cursor-pointer" onclick="openProductModal('${product.id}')"><h3 class="text-base font-black text-stone-900 dark:text-white hover:text-primary-500 transition-colors">${product.name}</h3><p class="text-stone-500 dark:text-stone-400 text-xs line-clamp-3">${product.desc || ''}</p></div></div><div class="p-5 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between gap-2">${priceHTML}<a href="https://wa.me/${whatsappNumber}?text=استفسار عن صنف: ${encodeURIComponent(product.name)}" target="_blank" class="px-3.5 py-2 rounded-xl bg-stone-100 dark:bg-dark-800 text-stone-800 dark:text-stone-200 hover:bg-primary-500 hover:text-white transition-all text-xs font-bold shadow-sm">طلب تسعيرة</a></div>`;
            productsGrid.appendChild(card);
        }
        if (isOffer && offersGrid) {
            const offerCard = document.createElement('div'); offerCard.className = "bg-white dark:bg-dark-800 border border-primary-500/10 rounded-2xl p-4 flex flex-col sm:flex-row gap-4 items-center shadow-sm hover-lift";
            offerCard.innerHTML = `<img src="${product.image}" class="w-20 h-20 rounded-xl object-cover"><div class="space-y-1 text-center sm:text-right flex-1"><h3 class="text-sm font-bold dark:text-white">${product.name} <span class="bg-red-50 text-red-500 text-[9px] font-bold px-1.5 py-0.5 rounded">${product.offerDiscount ? 'خصم ' + product.offerDiscount + '%' : 'خصم تعاقدي'}</span></h3><div class="pt-1.5 flex items-center justify-between text-xs">${isShowPrice ? `<span class="font-bold text-red-500">${priceDisplay}</span>` : '<span class="text-stone-400">سعر مخفض</span>'}<a href="https://wa.me/${whatsappNumber}?text=طلب خصم: ${encodeURIComponent(product.name)}" target="_blank" class="font-bold text-primary-500 hover:underline">استفد من العرض</a></div></div>`;
            offersGrid.appendChild(offerCard);
        }
        if (adminTableBody) {
            const row = document.createElement('tr'); row.className = "border-b border-stone-200 dark:border-stone-800 hover:bg-stone-50";
            row.innerHTML = `<td class="p-3 font-bold">${product.name}</td><td class="p-3">${priceDisplay}</td><td class="p-3">${product.tag || 'عام'}</td><td class="p-3"><button onclick="toggleCloudOfferStatus('${product.id}')" class="px-2 py-1 rounded text-[10px] font-black ${isOffer ? 'bg-red-50 text-red-500' : 'bg-stone-100 text-stone-400'}">${isOffer ? 'نشط' : 'عادي'}</button></td><td class="p-3 text-center"><button onclick="editProduct('${product.id}')" class="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-500 mx-1"><i class="fa-solid fa-pen"></i></button><button onclick="deleteCloudProduct('${product.id}')" class="w-7 h-7 rounded-lg bg-red-500/10 text-red-500"><i class="fa-solid fa-trash-can"></i></button></td>`;
            adminTableBody.appendChild(row);
        }
    });

    const galleryGrid = document.getElementById('gallery-grid');
    if (galleryGrid) {
        galleryGrid.innerHTML = '';
        
        const filteredMedia = window.mediaItems.filter(item => {
            if (window.currentGalleryTab === 'image') return item.type === 'image';
            if (window.currentGalleryTab === 'video') return item.type === 'video' || item.type === 'shorts';
            return true;
        });

        if (filteredMedia.length === 0) {
            galleryGrid.innerHTML = `<div class="col-span-full text-center py-12 text-stone-400 text-xs font-bold">لا توجد عناصر مضافة في هذا القسم حالياً.</div>`;
        }

        filteredMedia.forEach(item => {
            const card = document.createElement('div');
            card.className = 'bg-white dark:bg-dark-900 rounded-2xl overflow-hidden border border-stone-200 dark:border-stone-800 shadow-sm hover-lift gallery-card';
            if (item.type === 'image') {
                card.innerHTML = `<img src="${item.url}" alt="${item.title}" class="w-full h-64 object-cover cursor-zoom-in opacity-0 transition-opacity duration-500" loading="lazy" decoding="async" onload="this.classList.remove('opacity-0')" onclick="openImageViewer('${item.id}')" /><div class="p-3 text-xs font-bold">${item.title}</div>`;
            } else {
                const videoId = extractYouTubeId(item.url) || item.url;
                const embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`;
                const thumbUrl = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
                const containerClass = item.type === 'shorts' ? 'shorts-container' : 'video-container';
                card.innerHTML = `<div class="${containerClass} gallery-video-facade cursor-pointer group" style="background-image:url('${thumbUrl}')" onclick="playGalleryVideo(this, '${embedUrl}')"><div class="absolute inset-0 bg-black/30 group-hover:bg-black/40 transition-all flex items-center justify-center"><div class="w-14 h-14 rounded-full bg-primary-500/90 text-white flex items-center justify-center text-xl shadow-lg group-hover:scale-110"><i class="fa-solid fa-play ml-1"></i></div></div></div><div class="p-3 text-xs font-bold">${item.title}</div>`;
            }
            galleryGrid.appendChild(card);
        });
    }
    renderGalleryLoadMoreButton();
    renderAdminChannelsList(); renderAdminSocialLinksList(); renderAdminMediaList(); renderAdminOffersTable();
}
window.renderUI = renderUI;

let currentImageIndex = 0;
let imageGalleryItems = [];

window.openImageViewer = function(id) {
    imageGalleryItems = window.mediaItems.filter(m => m.type === 'image');
    currentImageIndex = imageGalleryItems.findIndex(m => m.id === id);
    if (currentImageIndex === -1) currentImageIndex = 0;
    
    updateImageViewer();
    
    const modal = document.getElementById('image-viewer-modal');
    if (modal) { modal.classList.remove('hidden'); document.body.style.overflow = 'hidden'; }
};
window.updateImageViewer = function() {
    if (imageGalleryItems.length === 0) return;
    const img = document.getElementById('image-viewer-img');
    if (img) img.src = imageGalleryItems[currentImageIndex].url;
};
window.nextImage = function(e) {
    if (e) e.stopPropagation();
    if (imageGalleryItems.length === 0) return;
    currentImageIndex = (currentImageIndex + 1) % imageGalleryItems.length;
    updateImageViewer();
};
window.prevImage = function(e) {
    if (e) e.stopPropagation();
    if (imageGalleryItems.length === 0) return;
    currentImageIndex = (currentImageIndex - 1 + imageGalleryItems.length) % imageGalleryItems.length;
    updateImageViewer();
};

window.playGalleryVideo = function(containerEl, embedUrl) { if (!containerEl || containerEl.dataset.loaded) return; containerEl.dataset.loaded = '1'; containerEl.style.backgroundImage = ''; containerEl.innerHTML = `<iframe src="${embedUrl}" frameborder="0" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen loading="lazy"></iframe>`; };
window.closeImageViewer = function() { const modal = document.getElementById('image-viewer-modal'); if (modal) { modal.classList.add('hidden'); document.body.style.overflow = ''; } };

document.addEventListener('keydown', function(e) { 
    if (e.key === 'Escape') {
        if (typeof closeImageViewer === 'function') closeImageViewer(); 
        if (typeof closeProductModal === 'function') closeProductModal();
    }
    if (e.key === 'ArrowLeft') nextImage(); 
    if (e.key === 'ArrowRight') prevImage(); 
});

let unsubscribeProducts = null;
let unsubscribeSettings = null;
let adminMediaLoaded = false;

onAuthStateChanged(auth, async (user) => {
    const adminSec = document.getElementById('admin-dashboard-section');
    const loginModal = document.getElementById('login-modal');
    
    if (user && !user.isAnonymous) {
        if (adminSec) adminSec.classList.remove('hidden');
        if (loginModal) loginModal.classList.add('hidden');
        
        if (!unsubscribeProducts) unsubscribeProducts = onSnapshot(productsCollectionRef, (snap) => { window.productsList = []; snap.forEach(d => window.productsList.push({ id: d.id, ...d.data() })); renderUI(); });
        if (!unsubscribeSettings) unsubscribeSettings = onSnapshot(settingsDocRef, (snap) => { if (snap.exists()) window.websiteSettings = { ...window.websiteSettings, ...snap.data() }; renderUI(); });
        if (!adminMediaLoaded) { adminMediaLoaded = true; loadAdminMediaList(); }
    } else {
        if (adminSec) adminSec.classList.add('hidden');
        if (loginModal) loginModal.classList.remove('hidden');
        
        if (unsubscribeProducts) { unsubscribeProducts(); unsubscribeProducts = null; }
        if (unsubscribeSettings) { unsubscribeSettings(); unsubscribeSettings = null; }
        adminMediaLoaded = false;

        try {
            const [prodSnap, settingsSnap] = await Promise.all([getDocs(productsCollectionRef), getDoc(settingsDocRef)]);
            window.productsList = []; prodSnap.forEach(d => window.productsList.push({ id: d.id, ...d.data() }));
            if (settingsSnap.exists()) window.websiteSettings = { ...window.websiteSettings, ...settingsSnap.data() };
            if (document.getElementById('gallery-page')) await window.loadGalleryPage(true);
            else renderUI(); 
        } catch (e) { showToast("تعذر تحميل بعض البيانات", "warning"); }

        if (!user) { try { await signInAnonymously(auth); } catch (e) { console.error(e); } }
    }
});
