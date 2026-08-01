// admin-firebase.js (يُحمَّل في admin.html فقط - لوحة التحكم)
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, collection, addDoc, updateDoc, deleteDoc, onSnapshot, setDoc, getDoc, getDocs, writeBatch, query, orderBy, limit, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { auth, db, appId, productsCollectionRef, settingsDocRef, mediaItemsCollectionRef, legacyMediaDocRef, chatsCollectionRef, ADMIN_MEDIA_LIMIT, generateLocalId, extractYouTubeId, DEFAULT_WEBSITE_SETTINGS } from "./firebase-shared.js";

// مفتاح ImgBB لرفع الصور مباشرة من لوحة التحكم بدل الدخول يدوياً على ibb.co ولصق الرابط.
// ملاحظة أمان: المفتاح ده بيظهر في كود الصفحة (Page Source) لأي حد يفتحها، زي أي مفتاح
// عميل (Client API key) بيشتغل بنفس الطريقة دي. أسوأ استخدام ممكن لو حد شافه هو رفع صور
// لحسابك على ibb.co (بياخد من مساحتك)، مش الوصول لحسابك أو بياناتك. لو حبيت تخفيه تماماً
// مستقبلاً، الحل الصح هو تمريره عبر سيرفر بسيط بدل استخدامه من المتصفح مباشرة.
const IMGBB_API_KEY = 'd80d659a19722f4c36d39fe6228c9d31';

window.productsList = [];
window.mediaItems = [];
window.websiteSettings = { ...DEFAULT_WEBSITE_SETTINGS };
window.editingProductId = null;

let unsubscribeProducts = null;
let unsubscribeSettings = null;
let unsubscribeAdminMedia = null;
let adminChatUnsubscribe = null;
let selectedChatId = null;
let adminMediaLoaded = false;

// ---- تسجيل الدخول / الخروج ----
window.verifyAdminCloudAuth = async function() {
    const email = document.getElementById('admin-email').value.trim();
    const password = document.getElementById('admin-password').value.trim();
    if (!email || !password) { showToast('يرجى إدخال البريد وكلمة المرور.', 'warning'); return; }
    try {
        await signInWithEmailAndPassword(auth, email, password);
        showToast('تم الدخول بنجاح', 'success');
    } catch (e) {
        showToast('فشل التحقق: تأكد من البريد وكلمة المرور', 'error');
    }
};

window.logoutAdminCloud = async function() {
    try { await signOut(auth); showToast('تم تسجيل الخروج', 'info'); } catch (e) { showToast('فشل تسجيل الخروج', 'error'); }
};

// ---- رفع الصور مباشرة على ibb.co (بدل الدخول يدوياً على الموقع ولصق الرابط) ----
function resizeImageToBlob(file, maxWidth = 1280, quality = 0.75) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const scale = Math.min(1, maxWidth / img.width);
                const canvas = document.createElement('canvas');
                canvas.width = Math.round(img.width * scale);
                canvas.height = Math.round(img.height * scale);
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('فشل تجهيز الصورة')), 'image/jpeg', quality);
            };
            img.onerror = () => reject(new Error('ملف صورة غير صالح'));
            img.src = e.target.result;
        };
        reader.onerror = () => reject(new Error('تعذرت قراءة الملف'));
        reader.readAsDataURL(file);
    });
}

async function uploadImageToImgBB(file) {
    const blob = await resizeImageToBlob(file);
    const formData = new FormData();
    formData.append('image', blob, (file.name || 'upload').replace(/\.[^.]+$/, '') + '.jpg');
    const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: 'POST', body: formData });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json || !json.success) throw new Error((json && json.error && json.error.message) || 'فشل رفع الصورة إلى ibb.co');
    return json.data.url || json.data.display_url;
}

async function handleImageUploadInput(event, { urlInputId, previewImgId, previewContainerId, statusId }) {
    const file = event.target.files[0]; if (!file) return;
    const urlInput = document.getElementById(urlInputId);
    const previewImg = document.getElementById(previewImgId);
    const previewContainer = document.getElementById(previewContainerId);
    const statusEl = statusId ? document.getElementById(statusId) : null;
    if (statusEl) { statusEl.textContent = 'جاري رفع الصورة على ibb.co...'; statusEl.className = 'text-[10px] text-stone-400 mt-1'; }
    try {
        const url = await uploadImageToImgBB(file);
        if (urlInput) urlInput.value = url;
        if (previewImg) { previewImg.src = url; previewContainer?.classList.remove('hidden'); }
        if (statusEl) { statusEl.textContent = 'تم الرفع بنجاح ✅'; statusEl.className = 'text-[10px] text-emerald-600 mt-1'; }
        showToast('تم رفع الصورة إلى ibb.co', 'success');
    } catch (ex) {
        if (statusEl) { statusEl.textContent = 'فشل الرفع: ' + ex.message; statusEl.className = 'text-[10px] text-red-500 mt-1'; }
        showToast('فشل رفع الصورة: ' + ex.message, 'error');
    }
}

window.handleProductImageFile = function(event) {
    handleImageUploadInput(event, { urlInputId: 'prod-image-url', previewImgId: 'image-preview', previewContainerId: 'image-preview-container', statusId: 'prod-image-upload-status' });
};
window.handleGalleryImageFile = function(event) {
    handleImageUploadInput(event, { urlInputId: 'media-url', previewImgId: 'media-preview', previewContainerId: 'media-preview-container', statusId: 'media-image-upload-status' });
};

// ---- المنتجات ----
window.toggleOfferDetails = function() {
    const checked = document.getElementById('prod-is-offer').checked;
    document.getElementById('offer-details').classList.toggle('hidden', !checked);
};

window.editProduct = function(id) {
    const product = window.productsList.find(p => p.id === id);
    if (!product) return;
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
    const previewContainer = document.getElementById('image-preview-container');
    if (product.image && previewImg) { previewImg.src = product.image; previewContainer.classList.remove('hidden'); }
    else { previewContainer.classList.add('hidden'); }
    document.getElementById('admin-save-product-btn').textContent = 'تحديث المنتج';
    window.scrollTo({ top: document.getElementById('admin-tab-products').offsetTop - 100, behavior: 'smooth' });
    showToast('جاري تعديل المنتج: ' + product.name, 'info');
};

window.saveProductToCloud = async function() {
    const name = document.getElementById('prod-name').value.trim();
    const tag = document.getElementById('prod-tag').value.trim() || 'عام';
    const priceAmount = parseFloat(document.getElementById('prod-price-amount').value);
    const currency = document.getElementById('prod-currency').value || '$';
    const unit = document.getElementById('prod-unit').value.trim() || '';
    const showPrice = document.getElementById('prod-show-price').value === 'true';
    const imageUrlInput = document.getElementById('prod-image-url').value.trim();
    const desc = document.getElementById('prod-desc').value.trim() || 'فحم نباتي طبيعي فاخر.';
    const isOffer = document.getElementById('prod-is-offer').checked;
    const offerDiscount = document.getElementById('prod-discount').value.trim();
    const offerEndDate = document.getElementById('prod-offer-end').value;
    const offerDesc = document.getElementById('prod-offer-desc').value.trim();
    if (!auth.currentUser || auth.currentUser.isAnonymous) { showToast('يجب تسجيل الدخول.', 'error'); return; }
    if (!name || isNaN(priceAmount) || priceAmount <= 0) { showToast('يرجى ملء الحقول بشكل صحيح.', 'warning'); return; }
    const image = imageUrlInput || 'https://images.unsplash.com/photo-1542332213-9b5a5a3fda35?q=80&w=600&auto=format&fit=crop';
    const productData = { name, tag, priceAmount, currency, unit, showPrice, image, desc, isOffer, offerDiscount, offerEndDate, offerDesc };
    try {
        if (window.editingProductId) {
            await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'products', window.editingProductId), productData);
            window.editingProductId = null;
            document.getElementById('admin-save-product-btn').textContent = 'نشر وحفظ في السحاب';
            showToast('تم تحديث المنتج ✅', 'success');
        } else {
            await addDoc(productsCollectionRef, productData);
            showToast('تم نشر المنتج 🚀', 'success');
        }
        ['prod-name','prod-tag','prod-price-amount','prod-unit','prod-image-url','prod-desc','prod-discount','prod-offer-end','prod-offer-desc'].forEach(id => document.getElementById(id).value = '');
        document.getElementById('prod-is-offer').checked = false;
        document.getElementById('offer-details').classList.add('hidden');
        document.getElementById('image-preview-container').classList.add('hidden');
        document.getElementById('prod-image-file').value = '';
        const statusEl = document.getElementById('prod-image-upload-status'); if (statusEl) statusEl.textContent = '';
    } catch (ex) { showToast('خطأ: ' + ex.message, 'error'); }
};

window.deleteCloudProduct = function(id) {
    if (!auth.currentUser || auth.currentUser.isAnonymous) return;
    showConfirmModal('حذف المنتج', 'هل أنت متأكد؟', async () => { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'products', id)); showToast('تم الحذف', 'success'); });
};

window.toggleCloudOfferStatus = async function(id) {
    const prod = window.productsList.find(p => p.id === id);
    if (!prod) return;
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'products', id), { isOffer: !(prod.isOffer === true || prod.isOffer === 'true') });
};

// ---- المعرض: كل عنصر مستند مستقل، يتحفظ فوراً عند الإضافة ----
window.addMediaItem = async function() {
    if (!auth.currentUser || auth.currentUser.isAnonymous) return showToast('يجب تسجيل الدخول كمسؤول', 'error');
    const type = document.getElementById('media-type').value;
    const title = document.getElementById('media-title').value.trim();
    const urlInput = document.getElementById('media-url').value.trim();
    if (!title) return showToast('يرجى كتابة عنوان', 'warning');
    let url = '';
    if (type === 'image') {
        if (!urlInput) return showToast('يرجى رفع صورة أو إدخال رابط', 'warning');
        url = urlInput;
    } else {
        if (!urlInput) return showToast('يرجى إدخال معرف الفيديو أو رابط يوتيوب', 'warning');
        const videoId = extractYouTubeId(urlInput);
        if (!videoId) return showToast('رابط يوتيوب غير صالح', 'warning');
        url = videoId;
    }
    const addBtn = document.getElementById('media-add-btn');
    if (addBtn) { addBtn.disabled = true; addBtn.classList.add('opacity-60'); }
    try {
        await addDoc(mediaItemsCollectionRef, { type, title, url, createdAt: serverTimestamp() });
        showToast('تمت الإضافة للمعرض ✅', 'success');
        document.getElementById('media-title').value = ''; document.getElementById('media-url').value = ''; document.getElementById('media-file-input').value = '';
        const previewImg = document.getElementById('media-preview');
        if (previewImg) previewImg.src = '';
        document.getElementById('media-preview-container')?.classList.add('hidden');
        const statusEl = document.getElementById('media-image-upload-status'); if (statusEl) statusEl.textContent = '';
    } catch (ex) {
        showToast('خطأ أثناء الإضافة: ' + ex.message, 'error');
    } finally {
        if (addBtn) { addBtn.disabled = false; addBtn.classList.remove('opacity-60'); }
    }
};

window.deleteMediaItem = function(id) {
    if (!auth.currentUser || auth.currentUser.isAnonymous) return showToast('يجب تسجيل الدخول كمسؤول', 'error');
    showConfirmModal('حذف الوسائط', 'هل أنت متأكد من حذف هذا العنصر من المعرض؟', async () => {
        try {
            await deleteDoc(doc(mediaItemsCollectionRef, id));
            showToast('تم الحذف', 'success');
        } catch (ex) {
            showToast('خطأ أثناء الحذف: ' + ex.message, 'error');
        }
    });
};

window.handleMediaTypeChange = function() {
    const type = document.getElementById('media-type').value;
    const urlContainer = document.getElementById('media-url-container');
    const fileContainer = document.getElementById('media-file-container');
    if (type === 'image') { urlContainer.classList.remove('md:col-span-2'); fileContainer.classList.remove('hidden'); }
    else { urlContainer.classList.add('md:col-span-2'); fileContainer.classList.add('hidden'); }
};

function loadAdminMediaList() {
    if (unsubscribeAdminMedia) unsubscribeAdminMedia();
    const q = query(mediaItemsCollectionRef, orderBy('createdAt', 'desc'), limit(ADMIN_MEDIA_LIMIT));
    unsubscribeAdminMedia = onSnapshot(q, (snap) => {
        window.mediaItems = [];
        snap.forEach(d => window.mediaItems.push({ id: d.id, ...d.data() }));
        renderAdminMediaList();
    }, (error) => console.error('خطأ في تحميل عناصر المعرض:', error));
}

// ترحيل تلقائي لمرة واحدة من البنية القديمة (مستند واحد يحتوي مصفوفة) إلى مستندات مستقلة
async function migrateLegacyGalleryIfNeeded() {
    try {
        const settingsSnap = await getDoc(settingsDocRef);
        if (settingsSnap.exists() && settingsSnap.data().galleryMigrated) return;
        const legacySnap = await getDoc(legacyMediaDocRef);
        if (!legacySnap.exists() || !Array.isArray(legacySnap.data().items) || !legacySnap.data().items.length) {
            await setDoc(settingsDocRef, { galleryMigrated: true }, { merge: true });
            return;
        }
        const existing = await getDocs(query(mediaItemsCollectionRef, limit(1)));
        if (existing.empty) {
            const items = legacySnap.data().items;
            for (let i = 0; i < items.length; i++) {
                const { id, ...data } = items[i];
                await addDoc(mediaItemsCollectionRef, { ...data, createdAt: serverTimestamp() });
            }
            showToast(`تم ترحيل ${items.length} عنصر من المعرض القديم تلقائياً`, 'info');
        }
        await setDoc(settingsDocRef, { galleryMigrated: true }, { merge: true });
    } catch (ex) {
        console.error('خطأ في ترحيل المعرض القديم:', ex);
    }
}

// ---- القنوات والمنصات الاجتماعية ----
window.addNewChannel = function() { window.websiteSettings.channels.push({ id: generateLocalId('ch'), type: 'phone', icon: 'fa-solid fa-phone', label: 'قناة جديدة', value: '+20', action: 'tel', color: 'primary' }); renderAdminChannelsList(); };
window.deleteChannel = function(id) { window.websiteSettings.channels = window.websiteSettings.channels.filter(c => c.id !== id); renderAdminChannelsList(); };
window.addNewSocialLink = function() { window.websiteSettings.socialLinks.push({ id: generateLocalId('sl'), icon: 'fa-brands fa-instagram', url: 'https://', color: 'primary', platform: 'منصة جديدة' }); renderAdminSocialLinksList(); };
window.deleteSocialLink = function(id) { window.websiteSettings.socialLinks = window.websiteSettings.socialLinks.filter(s => s.id !== id); renderAdminSocialLinksList(); };
window.saveChannelsAndSocialToCloud = async function() {
    await setDoc(settingsDocRef, { channels: window.websiteSettings.channels, socialLinks: window.websiteSettings.socialLinks }, { merge: true });
    showToast('تم الحفظ', 'success');
};
window.saveWebsiteSettingsToCloud = async function() {
    const mapUrl = document.getElementById('setting-map-url').value.trim();
    const aboutText = document.getElementById('setting-about').value.trim();
    await setDoc(settingsDocRef, { mapUrl, aboutText }, { merge: true });
    showToast('تم الحفظ', 'success');
};

// ---- النسخ الاحتياطي ----
window.exportBackup = async function() {
    const productsSnap = await getDocs(productsCollectionRef);
    const products = []; productsSnap.forEach(d => products.push({ id: d.id, ...d.data() }));
    const settingsSnap = await getDoc(settingsDocRef);
    const settings = settingsSnap.exists() ? settingsSnap.data() : {};
    const mediaSnap = await getDocs(mediaItemsCollectionRef);
    const media = []; mediaSnap.forEach(d => media.push({ id: d.id, ...d.data() }));
    const backup = { products, settings, media, exportDate: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `selim-backup-${new Date().toISOString().slice(0,10)}.json`; a.click();
    URL.revokeObjectURL(url);
    showToast('تم التصدير', 'success');
};

window.importBackup = function(event) {
    const file = event.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const backup = JSON.parse(e.target.result);
            if (!backup.products || !backup.settings) throw new Error('ملف غير صالح');
            showConfirmModal('استعادة النسخة الاحتياطية', 'سيتم استبدال جميع البيانات. هل أنت متأكد؟', async () => {
                const existing = await getDocs(productsCollectionRef);
                await Promise.all(existing.docs.map(d => deleteDoc(d.ref)));
                await Promise.all(backup.products.map(p => { const { id, ...data } = p; return addDoc(productsCollectionRef, data); }));
                await setDoc(settingsDocRef, backup.settings);
                if (backup.media && backup.media.length) {
                    const existingMedia = await getDocs(mediaItemsCollectionRef);
                    await Promise.all(existingMedia.docs.map(d => deleteDoc(d.ref)));
                    await Promise.all(backup.media.map((m) => {
                        const { id, ...data } = m;
                        if (!data.createdAt) data.createdAt = serverTimestamp();
                        return addDoc(mediaItemsCollectionRef, data);
                    }));
                }
                showToast('تمت الاستعادة! سيتم تحديث الصفحة.', 'success');
                setTimeout(() => location.reload(), 1500);
            });
        } catch (e) { showToast('ملف غير صالح: ' + e.message, 'error'); }
    };
    reader.readAsText(file);
};

// ---- الشات (مسؤول) ----
window.loadAdminChatList = function() {
    const listDiv = document.getElementById('admin-chat-list');
    if (!listDiv) return;
    const q = query(chatsCollectionRef, orderBy('timestamp', 'desc'));
    onSnapshot(q, (snapshot) => {
        listDiv.innerHTML = '';
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const div = document.createElement('div');
            div.className = `p-2 rounded-lg cursor-pointer hover:bg-stone-100 dark:hover:bg-stone-800 text-xs ${selectedChatId === docSnap.id ? 'bg-primary-100 dark:bg-primary-900' : ''}`;
            div.innerHTML = `
                <div class="flex justify-between items-start">
                    <span class="font-bold">${data.visitorName || 'زائر'}</span>
                    <button onclick="event.stopPropagation(); deleteChat('${docSnap.id}')" class="text-red-500 hover:text-red-700 text-[10px]"><i class="fa-solid fa-trash-can"></i></button>
                </div>
                <div class="text-[9px] text-stone-400">${data.visitorEmail || ''} | ${data.visitorPhone || ''}</div>
                <span class="text-stone-400 text-[10px]">${data.lastMessage || ''}</span>
            `;
            div.onclick = () => window.openAdminChat(docSnap.id);
            listDiv.appendChild(div);
        });
    });
};

window.deleteChat = async function(chatId) {
    if (!auth.currentUser || auth.currentUser.isAnonymous) { showToast('يجب تسجيل الدخول كمسؤول', 'error'); return; }
    showConfirmModal('حذف المحادثة', 'سيتم حذف جميع رسائل هذه المحادثة. هل أنت متأكد؟', async () => {
        const chatRef = doc(chatsCollectionRef, chatId);
        const messagesRef = collection(chatRef, 'messages');
        const snapshot = await getDocs(messagesRef);
        const batch = writeBatch(db);
        snapshot.forEach(d => batch.delete(d.ref));
        await batch.commit();
        await deleteDoc(chatRef);
        showToast('تم حذف المحادثة', 'success');
        window.loadAdminChatList();
        if (selectedChatId === chatId) {
            selectedChatId = null;
            document.getElementById('admin-chat-header').innerText = 'اختر محادثة';
            document.getElementById('admin-chat-messages').innerHTML = '';
            if (adminChatUnsubscribe) adminChatUnsubscribe();
        }
    });
};

window.openAdminChat = async function(chatId) {
    selectedChatId = chatId;
    const chatSnap = await getDoc(doc(chatsCollectionRef, chatId));
    const data = chatSnap.exists() ? chatSnap.data() : {};
    document.getElementById('admin-chat-header').innerText = `محادثة مع ${data.visitorName || chatId}`;
    const messagesDiv = document.getElementById('admin-chat-messages');
    messagesDiv.innerHTML = '';
    if (adminChatUnsubscribe) adminChatUnsubscribe();
    const messagesRef = collection(doc(chatsCollectionRef, chatId), 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'asc'));
    adminChatUnsubscribe = onSnapshot(q, (snapshot) => {
        messagesDiv.innerHTML = '';
        snapshot.forEach(docSnap => {
            const msg = docSnap.data();
            const div = document.createElement('div');
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
    const input = document.getElementById('admin-chat-input');
    const text = input.value.trim();
    if (!text) return;
    const chatRef = doc(chatsCollectionRef, selectedChatId);
    const messagesRef = collection(chatRef, 'messages');
    await addDoc(messagesRef, { text, sender: 'admin', timestamp: new Date() });
    await updateDoc(chatRef, { lastMessage: text, timestamp: new Date() });
    input.value = '';
};

// ---- دوال العرض (Render) الخاصة بلوحة التحكم ----
function renderAdminChannelsList() {
    const c = document.getElementById('admin-channels-list'); if (!c) return;
    c.innerHTML = '';
    (window.websiteSettings.channels || []).forEach(ch => {
        const d = document.createElement('div');
        d.className = 'flex flex-wrap items-center gap-2 bg-white dark:bg-dark-900 p-3 rounded-xl border border-stone-200 dark:border-stone-800';
        d.innerHTML = `<i class="${ch.icon} text-lg text-${ch.color}-500 w-8 text-center"></i>
        <input type="text" value="${ch.label}" data-ch-id="${ch.id}" data-field="label" class="flex-1 min-w-[120px] bg-stone-50 dark:bg-dark-800 border border-stone-200 dark:border-stone-700 rounded-lg px-2 py-1.5 text-xs channel-input" />
        <input type="text" value="${ch.value}" data-ch-id="${ch.id}" data-field="value" class="flex-1 min-w-[120px] bg-stone-50 dark:bg-dark-800 border border-stone-200 dark:border-stone-700 rounded-lg px-2 py-1.5 text-xs channel-input text-left font-mono" />
        <select data-ch-id="${ch.id}" data-field="action" class="bg-stone-50 dark:bg-dark-800 border border-stone-200 dark:border-stone-700 rounded-lg px-2 py-1.5 text-xs channel-input">
            <option value="tel" ${ch.action==='tel'?'selected':''}>هاتف</option>
            <option value="mailto" ${ch.action==='mailto'?'selected':''}>بريد</option>
            <option value="whatsapp" ${ch.action==='whatsapp'?'selected':''}>واتساب</option>
            <option value="text" ${ch.action==='text'?'selected':''}>نص</option>
        </select>
        <input type="text" value="${ch.icon}" data-ch-id="${ch.id}" data-field="icon" class="w-28 bg-stone-50 dark:bg-dark-800 border border-stone-200 dark:border-stone-700 rounded-lg px-2 py-1.5 text-xs channel-input text-left font-mono" />
        <select data-ch-id="${ch.id}" data-field="color" class="bg-stone-50 dark:bg-dark-800 border border-stone-200 dark:border-stone-700 rounded-lg px-2 py-1.5 text-xs channel-input">
            <option value="primary" ${ch.color==='primary'?'selected':''}>برتقالي</option>
            <option value="gold" ${ch.color==='gold'?'selected':''}>ذهبي</option>
            <option value="stone" ${ch.color==='stone'?'selected':''}>رمادي</option>
            <option value="red" ${ch.color==='red'?'selected':''}>أحمر</option>
            <option value="green" ${ch.color==='green'?'selected':''}>أخضر</option>
            <option value="blue" ${ch.color==='blue'?'selected':''}>أزرق</option>
            <option value="purple" ${ch.color==='purple'?'selected':''}>بنفسجي</option>
        </select>
        <button onclick="deleteChannel('${ch.id}')" class="w-7 h-7 rounded-lg bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white flex items-center justify-center shrink-0"><i class="fa-solid fa-xmark text-xs"></i></button>`;
        c.appendChild(d);
    });
    c.querySelectorAll('.channel-input').forEach(inp => {
        inp.addEventListener('change', function() {
            const id = this.dataset.chId, f = this.dataset.field;
            const idx = (window.websiteSettings.channels || []).findIndex(c => c.id === id);
            if (idx >= 0) window.websiteSettings.channels[idx][f] = this.value;
        });
    });
}

function renderAdminSocialLinksList() {
    const c = document.getElementById('admin-social-links-list'); if (!c) return;
    c.innerHTML = '';
    (window.websiteSettings.socialLinks || []).forEach(sl => {
        const d = document.createElement('div');
        d.className = 'flex flex-wrap items-center gap-2 bg-white dark:bg-dark-900 p-3 rounded-xl border border-stone-200 dark:border-stone-800';
        d.innerHTML = `<i class="${sl.icon} text-lg text-${sl.color}-500 w-8 text-center"></i>
        <input type="text" value="${sl.platform || ''}" data-sl-id="${sl.id}" data-field="platform" class="flex-1 min-w-[100px] bg-stone-50 dark:bg-dark-800 border border-stone-200 dark:border-stone-700 rounded-lg px-2 py-1.5 text-xs social-input" />
        <input type="text" value="${sl.url}" data-sl-id="${sl.id}" data-field="url" class="flex-1 min-w-[150px] bg-stone-50 dark:bg-dark-800 border border-stone-200 dark:border-stone-700 rounded-lg px-2 py-1.5 text-xs social-input text-left font-mono" />
        <input type="text" value="${sl.icon}" data-sl-id="${sl.id}" data-field="icon" class="w-28 bg-stone-50 dark:bg-dark-800 border border-stone-200 dark:border-stone-700 rounded-lg px-2 py-1.5 text-xs social-input text-left font-mono" />
        <select data-sl-id="${sl.id}" data-field="color" class="bg-stone-50 dark:bg-dark-800 border border-stone-200 dark:border-stone-700 rounded-lg px-2 py-1.5 text-xs social-input">
            <option value="primary" ${sl.color==='primary'?'selected':''}>برتقالي</option>
            <option value="blue" ${sl.color==='blue'?'selected':''}>أزرق</option>
            <option value="red" ${sl.color==='red'?'selected':''}>أحمر</option>
            <option value="green" ${sl.color==='green'?'selected':''}>أخضر</option>
            <option value="purple" ${sl.color==='purple'?'selected':''}>بنفسجي</option>
            <option value="stone" ${sl.color==='stone'?'selected':''}>رمادي</option>
            <option value="gold" ${sl.color==='gold'?'selected':''}>ذهبي</option>
        </select>
        <button onclick="deleteSocialLink('${sl.id}')" class="w-7 h-7 rounded-lg bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white flex items-center justify-center shrink-0"><i class="fa-solid fa-xmark text-xs"></i></button>`;
        c.appendChild(d);
    });
    c.querySelectorAll('.social-input').forEach(inp => {
        inp.addEventListener('change', function() {
            const id = this.dataset.slId, f = this.dataset.field;
            const idx = (window.websiteSettings.socialLinks || []).findIndex(s => s.id === id);
            if (idx >= 0) window.websiteSettings.socialLinks[idx][f] = this.value;
        });
    });
}

function renderAdminMediaList() {
    const list = document.getElementById('admin-media-list'); if (!list) return;
    list.innerHTML = '';
    if (!window.mediaItems.length) {
        list.innerHTML = '<p class="text-[11px] text-stone-400 text-center py-2">لا توجد عناصر في المعرض بعد.</p>';
        return;
    }
    window.mediaItems.forEach(item => {
        const div = document.createElement('div');
        div.className = 'flex justify-between items-center bg-white dark:bg-dark-900 p-2 rounded-lg border border-stone-200 dark:border-stone-800 text-xs';
        div.innerHTML = `<span>${item.title} (${item.type === 'image' ? 'صورة' : (item.type === 'shorts' ? 'شورتس' : 'فيديو')})</span><button onclick="deleteMediaItem('${item.id}')" class="text-red-500 hover:text-red-700"><i class="fa-solid fa-trash"></i></button>`;
        list.appendChild(div);
    });
}

function renderAdminOffersTable() {
    const tbody = document.getElementById('admin-offers-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    const offerProducts = window.productsList.filter(p => p.isOffer === true || p.isOffer === 'true');
    offerProducts.forEach(product => {
        const tr = document.createElement('tr');
        tr.className = "border-b border-stone-200 dark:border-stone-800";
        tr.innerHTML = `
            <td class="p-3 font-bold">${product.name}</td>
            <td class="p-3">${product.priceAmount || ''} ${product.currency || ''}</td>
            <td class="p-3">${product.offerDiscount || '-'}%</td>
            <td class="p-3">${product.offerEndDate || 'غير محدد'}</td>
            <td class="p-3"><span class="px-2 py-1 rounded text-[10px] font-black ${new Date(product.offerEndDate) < new Date() && product.offerEndDate ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}">${product.offerEndDate && new Date(product.offerEndDate) < new Date() ? 'منتهي' : 'ساري'}</span></td>
            <td class="p-3 text-center">
                <button onclick="editProduct('${product.id}')" class="w-7 h-7 rounded-lg bg-blue-500/10 hover:bg-blue-500 text-blue-500 hover:text-white"><i class="fa-solid fa-pen text-xs"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function renderAdminProductsTable() {
    const tbody = document.getElementById('admin-products-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    const phoneChannel = (window.websiteSettings.channels || []).find(c => c.type === 'phone' || c.action === 'tel');
    window.productsList.forEach(product => {
        const isOffer = product.isOffer === true || product.isOffer === 'true';
        const priceDisplay = product.priceAmount && product.currency ? `${product.priceAmount} ${product.currency}${product.unit || ''}` : (product.price || 'تواصل معنا');
        const row = document.createElement('tr');
        row.className = "border-b border-stone-200 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-stone-900/20";
        row.innerHTML = `<td class="p-3 font-bold">${product.name}</td><td class="p-3">${priceDisplay}</td><td class="p-3">${product.tag || 'عام'}</td><td class="p-3"><button onclick="toggleCloudOfferStatus('${product.id}')" class="px-2 py-1 rounded text-[10px] font-black ${isOffer ? 'bg-red-50 text-red-500' : 'bg-stone-100 text-stone-400'}">${isOffer ? 'نشط' : 'عادي'}</button></td><td class="p-3 text-center"><button onclick="editProduct('${product.id}')" class="w-7 h-7 rounded-lg bg-blue-500/10 hover:bg-blue-500 text-blue-500 hover:text-white"><i class="fa-solid fa-pen text-xs"></i></button> <button onclick="deleteCloudProduct('${product.id}')" class="w-7 h-7 rounded-lg bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white"><i class="fa-solid fa-trash-can text-xs"></i></button></td>`;
        tbody.appendChild(row);
    });
}

function fillSettingsFormIfEmpty() {
    const mapInput = document.getElementById('setting-map-url');
    const aboutInput = document.getElementById('setting-about');
    if (mapInput && !mapInput.value) mapInput.value = window.websiteSettings.mapUrl || '';
    if (aboutInput && !aboutInput.value) aboutInput.value = window.websiteSettings.aboutText || '';
}

function renderAdminAll() {
    renderAdminProductsTable();
    renderAdminOffersTable();
    renderAdminChannelsList();
    renderAdminSocialLinksList();
    renderAdminMediaList();
    fillSettingsFormIfEmpty();
}
window.renderUI = renderAdminAll; // اسم قديم متاح للتوافق

function subscribeAdminData() {
    if (!unsubscribeProducts) {
        unsubscribeProducts = onSnapshot(productsCollectionRef, (snap) => {
            window.productsList = [];
            snap.forEach(d => window.productsList.push({ id: d.id, ...d.data() }));
            renderAdminAll();
        }, (error) => { console.error("خطأ في تحميل المنتجات:", error); showToast("فشل تحميل المنتجات", "error"); });
    }
    if (!unsubscribeSettings) {
        unsubscribeSettings = onSnapshot(settingsDocRef, (snap) => {
            if (snap.exists()) window.websiteSettings = { ...window.websiteSettings, ...snap.data() };
            renderAdminAll();
        }, (error) => console.error("خطأ في الإعدادات:", error));
    }
    if (!adminMediaLoaded) {
        adminMediaLoaded = true;
        migrateLegacyGalleryIfNeeded().then(loadAdminMediaList);
    }
}

function unsubscribeAdminData() {
    if (unsubscribeProducts) { unsubscribeProducts(); unsubscribeProducts = null; }
    if (unsubscribeSettings) { unsubscribeSettings(); unsubscribeSettings = null; }
    if (unsubscribeAdminMedia) { unsubscribeAdminMedia(); unsubscribeAdminMedia = null; }
    adminMediaLoaded = false;
}

// ---- مراقبة حالة الدخول: تسجيل دخول أو عرض شاشة الدخول ----
onAuthStateChanged(auth, (user) => {
    const loginView = document.getElementById('admin-login-view');
    const dashboard = document.getElementById('admin-dashboard-section');
    if (user && !user.isAnonymous) {
        loginView?.classList.add('hidden');
        dashboard?.classList.remove('hidden');
        subscribeAdminData();
    } else {
        dashboard?.classList.add('hidden');
        loginView?.classList.remove('hidden');
        unsubscribeAdminData();
    }
});
