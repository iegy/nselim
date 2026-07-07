// firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInAnonymously, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot, setDoc, getDoc, getDocs, writeBatch, query, orderBy } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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
const mediaDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'media', 'items');
const chatsCollectionRef = collection(db, 'artifacts', appId, 'public', 'data', 'chats');

window.productsList = [];
window.mediaItems = [];
window.websiteSettings = {
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

window.editingProductId = null;
let unsubscribeUserChat = null;
let adminChatUnsubscribe = null;
let selectedChatId = null;

function generateLocalId(prefix = 'id') {
    return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 8);
}

function extractYouTubeId(url) {
    if (!url) return null;
    if (/^[a-zA-Z0-9_-]{11}$/.test(url.trim())) return url.trim();
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
}

function getCurrentUserId() {
    const user = auth.currentUser;
    return user ? user.uid : null;
}

// ---- دوال الشات (زائر) ----
window.toggleChatWindow = function() {
    const win = document.getElementById('chat-window');
    if (win) win.classList.toggle('hidden');
    if (win && !win.classList.contains('hidden')) {
        loadChatMessages();
    }
};

window.submitVisitorInfo = async function() {
    const name = document.getElementById('chat-visitor-name').value.trim();
    const email = document.getElementById('chat-visitor-email').value.trim();
    const phone = document.getElementById('chat-visitor-phone').value.trim();
    if (!name || !email || !phone) {
        showToast('يرجى ملء جميع الحقول', 'warning');
        return;
    }
    const userId = getCurrentUserId();
    if (!userId) return;
    const chatRef = doc(chatsCollectionRef, userId);
    await setDoc(chatRef, { 
        userId, 
        visitorName: name, 
        visitorEmail: email, 
        visitorPhone: phone, 
        lastMessage: '', 
        timestamp: new Date(),
        unread: true
    }, { merge: true });
    document.getElementById('chat-info-form').classList.add('hidden');
    document.getElementById('chat-messages-area').classList.remove('hidden');
    loadChatMessages();
    showToast('تم تسجيل بياناتك، أهلاً بك', 'success');
};

window.loadChatMessages = async function() {
    const userId = getCurrentUserId();
    if (!userId) return;
    const chatRef = doc(chatsCollectionRef, userId);
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
    const chatRef = doc(chatsCollectionRef, userId);
    const messagesRef = collection(chatRef, 'messages');
    await addDoc(messagesRef, { text, sender: 'user', timestamp: new Date() });
    const chatSnap = await getDoc(chatRef);
    const data = chatSnap.data();
    await updateDoc(chatRef, { 
        lastMessage: text, 
        timestamp: new Date(), 
        unread: true,
        visitorName: data.visitorName || 'زائر'
    });
    input.value = '';
};

// ---- دوال الشات (مسؤول) ----
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
            div.onclick = () => openAdminChat(docSnap.id);
            listDiv.appendChild(div);
        });
    });
};

window.deleteChat = async function(chatId) {
    if (!auth.currentUser || auth.currentUser.isAnonymous) {
        showToast('يجب تسجيل الدخول كمسؤول', 'error');
        return;
    }
    showConfirmModal('حذف المحادثة', 'سيتم حذف جميع رسائل هذه المحادثة. هل أنت متأكد؟', async () => {
        const chatRef = doc(chatsCollectionRef, chatId);
        const messagesRef = collection(chatRef, 'messages');
        const snapshot = await getDocs(messagesRef);
        const batch = writeBatch(db);
        snapshot.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();
        await deleteDoc(chatRef);
        showToast('تم حذف المحادثة', 'success');
        loadAdminChatList();
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

// ---- دوال المنتجات والعروض والإدارة ----
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
    const previewImg = document.getElementById('image-preview');
    if (!auth.currentUser || auth.currentUser.isAnonymous) { showToast('يجب تسجيل الدخول.', 'error'); return; }
    if (!name || isNaN(priceAmount) || priceAmount <= 0) { showToast('يرجى ملء الحقول بشكل صحيح.', 'warning'); return; }
    let image = 'https://images.unsplash.com/photo-1542332213-9b5a5a3fda35?q=80&w=600&auto=format&fit=crop';
    if (previewImg && previewImg.src && previewImg.src.startsWith('data:image')) {
        showToast('تحذير: الصورة بتنسيق Base64 قد تسبب مشاكل في الحجم.', 'warning');
        image = previewImg.src;
    } else if (imageUrlInput) image = imageUrlInput;
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
    } catch (ex) { showToast('خطأ: ' + ex.message, 'error'); }
};

window.verifyAdminCloudAuth = async function() {
    const email = document.getElementById('admin-email').value.trim();
    const password = document.getElementById('admin-password').value.trim();
    if (!email || !password) { showToast('يرجى إدخال البريد وكلمة المرور.', 'warning'); return; }
    try { await signInWithEmailAndPassword(auth, email, password); closeAdminLoginModal(); showToast('تم الدخول بنجاح', 'success'); } catch (e) { showToast('فشل التحقق', 'error'); }
};

window.logoutAdminCloud = async function() {
    try { await signOut(auth); document.getElementById('admin-dashboard-section').classList.add('hidden'); showToast('تم تسجيل الخروج', 'info'); } catch (e) { showToast('فشل تسجيل الخروج', 'error'); }
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

window.filterCatalog = function(tag) {
    document.querySelectorAll('.product-card-item').forEach(c => {
        c.style.display = (tag === 'all' || c.getAttribute('data-tag') === tag) ? 'flex' : 'none';
    });
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('bg-primary-500', 'text-white'));
    document.getElementById(`filter-btn-${tag}`)?.classList.add('bg-primary-500', 'text-white');
    if (tag === 'all') document.getElementById('filter-btn-all').classList.add('bg-primary-500', 'text-white');
};

window.addMediaItem = function() {
    const type = document.getElementById('media-type').value;
    const title = document.getElementById('media-title').value.trim();
    const urlInput = document.getElementById('media-url').value.trim();
    const previewImg = document.getElementById('media-preview');
    if (!title) return showToast('يرجى كتابة عنوان', 'warning');
    let url = '';
    if (type === 'image') {
        if (previewImg && previewImg.src && previewImg.src.startsWith('data:image')) url = previewImg.src;
        else if (urlInput) url = urlInput;
        else return showToast('يرجى رفع صورة أو إدخال رابط', 'warning');
    } else {
        if (!urlInput) return showToast('يرجى إدخال معرف الفيديو أو رابط يوتيوب', 'warning');
        const videoId = extractYouTubeId(urlInput);
        if (!videoId) return showToast('رابط يوتيوب غير صالح', 'warning');
        url = videoId;
    }
    window.mediaItems.push({ id: Date.now().toString(), type, title, url });
    if (window.renderUI) window.renderUI();
    document.getElementById('media-title').value = ''; document.getElementById('media-url').value = ''; document.getElementById('media-file-input').value = '';
    if (previewImg) previewImg.src = '';
    document.getElementById('media-preview-container')?.classList.add('hidden');
    showToast('تمت الإضافة محلياً', 'info');
};

window.deleteMediaItem = function(index) { window.mediaItems.splice(index, 1); if (window.renderUI) window.renderUI(); };

window.saveMediaToCloud = async function() {
    if (!auth.currentUser || auth.currentUser.isAnonymous) return showToast('يجب تسجيل الدخول', 'error');
    await setDoc(mediaDocRef, { items: window.mediaItems });
    showToast('تم حفظ الوسائط', 'success');
};

window.compressMediaImage = function(event) {
    const file = event.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d'), max_w = 800, scale = max_w / img.width;
            canvas.width = max_w; canvas.height = img.height * scale;
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            const base64 = canvas.toDataURL('image/jpeg', 0.7);
            const previewImg = document.getElementById('media-preview');
            const previewContainer = document.getElementById('media-preview-container');
            if (previewImg) { previewImg.src = base64; previewContainer?.classList.remove('hidden'); }
            showToast('تم تجهيز الصورة. ملاحظة: Base64 قد يكون كبير الحجم.', 'info');
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
};

window.handleMediaTypeChange = function() {
    const type = document.getElementById('media-type').value;
    const urlContainer = document.getElementById('media-url-container');
    const fileContainer = document.getElementById('media-file-container');
    if (type === 'image') { urlContainer.classList.remove('md:col-span-2'); fileContainer.classList.remove('hidden'); }
    else { urlContainer.classList.add('md:col-span-2'); fileContainer.classList.add('hidden'); }
};

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

window.exportBackup = async function() {
    const productsSnap = await getDocs(productsCollectionRef);
    const products = []; productsSnap.forEach(d => products.push({ id: d.id, ...d.data() }));
    const settingsSnap = await getDoc(settingsDocRef);
    const settings = settingsSnap.exists() ? settingsSnap.data() : {};
    const mediaSnap = await getDoc(mediaDocRef);
    const media = mediaSnap.exists() ? mediaSnap.data().items : [];
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
                if (backup.media) await setDoc(mediaDocRef, { items: backup.media });
                showToast('تمت الاستعادة! سيتم تحديث الصفحة.', 'success');
                setTimeout(() => location.reload(), 1500);
            });
        } catch (e) { showToast('ملف غير صالح: ' + e.message, 'error'); }
    };
    reader.readAsText(file);
};

window.switchAdminTab = function(tab) {
    ['products', 'offers', 'media', 'settings', 'channels', 'chat', 'backup'].forEach(t => {
        const el = document.getElementById(`admin-tab-${t}`); if (el) el.classList.add('hidden');
        const btn = document.getElementById(`tab-btn-${t}`);
        if (btn) btn.className = 'px-4 py-2 text-xs font-bold rounded-lg bg-stone-100 text-stone-600 dark:bg-dark-800 dark:text-stone-400 hover:bg-stone-200 transition-all';
    });
    const targetEl = document.getElementById(`admin-tab-${tab}`); if (targetEl) targetEl.classList.remove('hidden');
    const activeBtn = document.getElementById(`tab-btn-${tab}`);
    if (activeBtn) activeBtn.className = 'px-4 py-2 text-xs font-black rounded-lg bg-primary-500 text-white shadow-md transition-all';
    if (tab === 'chat') {
        loadAdminChatList();
    }
};

// ---- دوال عرض القوائم والجداول (render functions) ----
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
    window.mediaItems.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'flex justify-between items-center bg-white dark:bg-dark-900 p-2 rounded-lg border border-stone-200 dark:border-stone-800 text-xs';
        div.innerHTML = `<span>${item.title} (${item.type === 'image' ? 'صورة' : 'فيديو'})</span><button onclick="deleteMediaItem(${index})" class="text-red-500 hover:text-red-700"><i class="fa-solid fa-trash"></i></button>`;
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

function renderUI() {
    const productsGrid = document.getElementById('products-grid');
    const offersGrid = document.getElementById('offers-grid');
    const adminTableBody = document.getElementById('admin-products-table-body');
    const contactChannelsDiv = document.getElementById('dyn-contact-channels');
    const socialLinksDiv = document.getElementById('dyn-social-links');
    const footerSocialDiv = document.getElementById('footer-social-links');
    const aboutEl = document.getElementById('dyn-about-text');
    const mapEl = document.getElementById('dyn-map-iframe');
    const galleryGrid = document.getElementById('gallery-grid');

    if (aboutEl) aboutEl.textContent = window.websiteSettings.aboutText || '';
    if (mapEl && window.websiteSettings.mapUrl) mapEl.src = window.websiteSettings.mapUrl;
    window._websiteSettings = window.websiteSettings;

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
                a.href = actionHref;
                a.target = actionTarget;
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
    if (adminTableBody) adminTableBody.innerHTML = '';

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
        allBtn.onclick = () => filterCatalog('all');
        filterContainer.appendChild(allBtn);
        tags.forEach(t => {
            const btn = document.createElement('button');
            btn.id = `filter-btn-${t}`;
            btn.className = 'filter-btn px-6 py-2 rounded-xl bg-white dark:bg-dark-900 text-stone-500 dark:text-stone-400 border border-stone-200 dark:border-stone-800 font-bold text-xs whitespace-nowrap shadow-sm hover:border-primary-500';
            btn.textContent = t;
            btn.onclick = () => filterCatalog(t);
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

        if (adminTableBody) {
            const row = document.createElement('tr');
            row.className = "border-b border-stone-200 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-stone-900/20";
            row.innerHTML = `<td class="p-3 font-bold">${product.name}</td><td class="p-3">${priceDisplay}</td><td class="p-3">${product.tag || 'عام'}</td><td class="p-3"><button onclick="toggleCloudOfferStatus('${product.id}')" class="px-2 py-1 rounded text-[10px] font-black ${isOffer ? 'bg-red-50 text-red-500' : 'bg-stone-100 text-stone-400'}">${isOffer ? 'نشط' : 'عادي'}</button></td><td class="p-3 text-center"><button onclick="editProduct('${product.id}')" class="w-7 h-7 rounded-lg bg-blue-500/10 hover:bg-blue-500 text-blue-500 hover:text-white"><i class="fa-solid fa-pen text-xs"></i></button> <button onclick="deleteCloudProduct('${product.id}')" class="w-7 h-7 rounded-lg bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white"><i class="fa-solid fa-trash-can text-xs"></i></button></td>`;
            adminTableBody.appendChild(row);
        }
    });

    if (galleryGrid) {
        galleryGrid.innerHTML = '';
        window.mediaItems.forEach(item => {
            const card = document.createElement('div');
            card.className = 'bg-white dark:bg-dark-900 rounded-2xl overflow-hidden border border-stone-200 dark:border-stone-800 shadow-sm hover-lift';
            if (item.type === 'image') {
                card.innerHTML = `<img src="${item.url}" alt="${item.title}" class="w-full h-64 object-cover cursor-zoom-in" loading="lazy" onclick="openImageViewer('${item.url}')" /><div class="p-3 text-xs font-bold">${item.title}</div>`;
            } else if (item.type === 'video') {
                const videoId = extractYouTubeId(item.url);
                const embedUrl = videoId ? `https://www.youtube.com/embed/${videoId}` : item.url;
                card.innerHTML = `<div class="video-container"><iframe src="${embedUrl}" frameborder="0" allowfullscreen loading="lazy"></iframe></div><div class="p-3 text-xs font-bold">${item.title}</div>`;
            }
            galleryGrid.appendChild(card);
        });
    }

    renderAdminChannelsList();
    renderAdminSocialLinksList();
    renderAdminMediaList();
    renderAdminOffersTable();
}

window.renderUI = renderUI;

window.openImageViewer = function(src) {
    const modal = document.getElementById('image-viewer-modal');
    const img = document.getElementById('image-viewer-img');
    if (modal && img && src) {
        img.src = src;
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }
};
window.closeImageViewer = function() {
    const modal = document.getElementById('image-viewer-modal');
    if (modal) {
        modal.classList.add('hidden');
        document.body.style.overflow = '';
    }
};
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closeImageViewer();
});

// ---- مراقبة المصادقة والبيانات ----
let unsubscribeProducts = null;
let unsubscribeSettings = null;
let unsubscribeMedia = null;

onAuthStateChanged(auth, async (user) => {
    if (user && !user.isAnonymous) {
        document.getElementById('admin-dashboard-section').classList.remove('hidden');
        if (!unsubscribeProducts) {
            unsubscribeProducts = onSnapshot(productsCollectionRef, (snap) => {
                window.productsList = [];
                snap.forEach(d => window.productsList.push({ id: d.id, ...d.data() }));
                renderUI();
            }, (error) => {
                console.error("خطأ في تحميل المنتجات:", error);
                showToast("فشل تحميل المنتجات", "error");
            });
        }
        if (!unsubscribeSettings) {
            unsubscribeSettings = onSnapshot(settingsDocRef, (snap) => {
                if (snap.exists()) window.websiteSettings = { ...window.websiteSettings, ...snap.data() };
                window._websiteSettings = window.websiteSettings;
                renderUI();
            }, (error) => console.error("خطأ في الإعدادات:", error));
        }
        if (!unsubscribeMedia) {
            unsubscribeMedia = onSnapshot(mediaDocRef, (snap) => {
                window.mediaItems = snap.exists() ? snap.data().items || [] : [];
                renderUI();
            }, (error) => console.error("خطأ في الوسائط:", error));
        }
    } else {
        document.getElementById('admin-dashboard-section').classList.add('hidden');
        if (unsubscribeProducts) { unsubscribeProducts(); unsubscribeProducts = null; }
        if (unsubscribeSettings) { unsubscribeSettings(); unsubscribeSettings = null; }
        if (unsubscribeMedia) { unsubscribeMedia(); unsubscribeMedia = null; }

        try {
            const [prodSnap, settingsSnap, mediaSnap] = await Promise.all([
                getDocs(productsCollectionRef),
                getDoc(settingsDocRef),
                getDoc(mediaDocRef)
            ]);
            window.productsList = [];
            prodSnap.forEach(d => window.productsList.push({ id: d.id, ...d.data() }));
            if (settingsSnap.exists()) window.websiteSettings = { ...window.websiteSettings, ...settingsSnap.data() };
            window.mediaItems = mediaSnap.exists() ? mediaSnap.data().items || [] : [];
            renderUI();
        } catch (e) {
            console.error("خطأ في تحميل البيانات للزائر:", e);
            showToast("تعذر تحميل بعض البيانات", "warning");
        }

        if (!user) {
            try { await signInAnonymously(auth); } catch (e) { console.error(e); }
        }
    }
});
