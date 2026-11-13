// products.js — إدارة المنتجات داخل لوحة التحكم
(function () {
  // لا قائمة افتراضية: قاعدة البيانات (Firestore) هي المصدر الوحيد.
  // قائمة افتراضية قديمة كانت تُكتب عند فراغ القاعدة فتمحو منتجات المتجر.
  const defaultProducts = [];

  let productsCache = [];
  let editingProductIndex = null;

  function $(id) { return document.getElementById(id); }

  function getProducts() {
    return productsCache.length ? productsCache : (JSON.parse(localStorage.getItem('allProducts')) || []);
  }

  // ── Cloudinary: رفع الصورة وإرجاع رابط https (لا base64 في قاعدة البيانات) ──
  function cloudinaryCfg() {
    const env = window.__FIREBASE_CONFIG__ || {};
    return { cloud: env.cloudName || '', preset: env.uploadPreset || '' };
  }

  function uploadToCloudinary(file, onProgress) {
    const cfg = cloudinaryCfg();
    if (!cfg.cloud || !cfg.preset) {
      return Promise.reject(new Error('إعدادات Cloudinary مفقودة (CLOUDINARY_CLOUD_NAME/UPLOAD_PRESET).'));
    }
    return new Promise(function (resolve, reject) {
      const form = new FormData();
      form.append('file', file);
      form.append('upload_preset', cfg.preset);
      const xhr = new XMLHttpRequest();
      xhr.open('POST', 'https://api.cloudinary.com/v1_1/' + cfg.cloud + '/image/upload');
      xhr.upload.onprogress = function (e) {
        if (onProgress && e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = function () {
        let res = {};
        try { res = JSON.parse(xhr.responseText); } catch (e) {}
        if (xhr.status >= 200 && xhr.status < 300 && res.secure_url) resolve(res.secure_url);
        else reject(new Error((res.error && res.error.message) || ('فشل رفع الصورة (' + xhr.status + ')')));
      };
      xhr.onerror = function () { reject(new Error('تعذّر الاتصال بـ Cloudinary')); };
      xhr.send(form);
    });
  }

  async function persistProducts(products) {
    productsCache = products;
    if (typeof window.storeSaveProducts === 'function') {
      const ok = await window.storeSaveProducts(products);
      if (!ok) {
        try { localStorage.setItem('allProducts', JSON.stringify(products)); } catch (e) {}
        return false;
      }
      return true;
    }
    try { localStorage.setItem('allProducts', JSON.stringify(products)); } catch (e) { return false; }
    return true;
  }

  function showSuccess(msg) {
    const el = $('pform-success');
    el.textContent = '✓ ' + msg;
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 3000);
  }

  function showError(msg) {
    const el = $('pform-error');
    el.textContent = '✗ ' + msg;
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 3000);
  }

  function resetForm() {
    $('product-form').reset();
    $('product-image-preview').classList.add('hidden');
    $('pform-title').textContent = 'إضافة منتج جديد';
    $('product-submit').textContent = 'حفظ المنتج';
    $('product-submit').classList.remove('bg-amber-600', 'hover:bg-amber-700');
    $('product-submit').classList.add('bg-emerald-600', 'hover:bg-emerald-700');
    $('product-cancel').classList.add('hidden');
    editingProductIndex = null;
  }

  function displayProducts() {
    const products = getProducts();
    const grid = $('products-grid');
    $('product-count').textContent = products.length;

    if (products.length === 0) {
      grid.innerHTML = '<tr><td colspan="5" class="text-center py-10 text-slate-500">لا توجد منتجات</td></tr>';
      return;
    }

    grid.innerHTML = products.map((product, index) => `
      <tr class="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
        <td class="px-4 py-3">
          <div class="w-12 h-12 bg-slate-800 rounded-lg overflow-hidden flex-shrink-0">
            <img src="${product.img}" alt="${product.name}" class="w-full h-full object-cover">
          </div>
        </td>
        <td class="px-4 py-3">
          <span class="font-bold text-white text-sm">${product.name}</span>
        </td>
        <td class="px-4 py-3">
          <span class="text-slate-400 text-sm line-clamp-1">${product.desc}</span>
        </td>
        <td class="px-4 py-3">
          <span class="font-extrabold text-emerald-400 text-sm whitespace-nowrap">${product.price} د.ك</span>
        </td>
        <td class="px-4 py-3">
          <div class="flex items-center gap-2 justify-center">
            <button class="px-2 py-1.5 rounded-md text-xs font-bold bg-slate-700/70 text-slate-200 border border-slate-600 hover:bg-slate-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed" onclick="window.adminProducts.move(${index}, -1)" ${index === 0 ? 'disabled' : ''} title="تحريك للأعلى">↑</button>
            <button class="px-2 py-1.5 rounded-md text-xs font-bold bg-slate-700/70 text-slate-200 border border-slate-600 hover:bg-slate-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed" onclick="window.adminProducts.move(${index}, 1)" ${index === products.length - 1 ? 'disabled' : ''} title="تحريك للأسفل">↓</button>
            <button class="px-3 py-1.5 rounded-md text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600 hover:text-white transition-colors" onclick="window.adminProducts.edit(${index})">✏️ تعديل</button>
            <button class="px-3 py-1.5 rounded-md text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-600 hover:text-white transition-colors" onclick="window.adminProducts.remove(${index})">🗑️ حذف</button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  function editProduct(index) {
    const products = getProducts();
    const product = products[index];
    editingProductIndex = index;
    $('product-name').value = product.name;
    $('product-desc').value = product.desc;
    $('product-price').value = product.price;
    $('product-preview-img').src = product.img;
    $('product-image-preview').classList.remove('hidden');
    $('pform-title').textContent = 'تعديل المنتج';
    $('product-submit').textContent = 'تحديث المنتج';
    $('product-submit').classList.remove('bg-emerald-600', 'hover:bg-emerald-700');
    $('product-submit').classList.add('bg-amber-600', 'hover:bg-amber-700');
    $('product-cancel').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function deleteProduct(index) {
    const products = getProducts();
    const product = products[index];
    if (confirm(`هل تريد حذف "${product.name}"؟`)) {
      products.splice(index, 1);
      persistProducts(products);
      showSuccess('تم حذف المنتج بنجاح');
      displayProducts();
    }
  }

  async function moveProduct(index, direction) {
    const products = getProducts();
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= products.length) return;
    [products[index], products[targetIndex]] = [products[targetIndex], products[index]];
    await persistProducts(products);
    displayProducts();
    showSuccess('تم حفظ ترتيب المنتجات');
  }

  function saveProduct(event) {
    event.preventDefault();
    const name = $('product-name').value.trim();
    const desc = $('product-desc').value.trim();
    const price = parseFloat($('product-price').value).toFixed(3);
    const fileInput = $('product-image');
    const submitBtn = $('product-submit');

    if (!name || !desc || !price) { showError('يرجى ملء جميع الحقول'); return; }

    // تعديل بدون صورة جديدة — نحتفظ بالصورة القديمة (رابط Cloudinary)
    if (!fileInput.files[0]) {
      if (editingProductIndex === null) { showError('يرجى إضافة صورة للمنتج'); return; }
      const products = getProducts();
      const newProduct = { name, desc, price, img: products[editingProductIndex].img };
      if (products[editingProductIndex]._id) newProduct._id = products[editingProductIndex]._id;
      products[editingProductIndex] = newProduct;
      persistProducts(products);
      showSuccess('تم تحديث المنتج بنجاح');
      resetForm();
      displayProducts();
      return;
    }

    const file = fileInput.files[0];
    const originalLabel = submitBtn.textContent;
    submitBtn.disabled = true;
    uploadToCloudinary(file, function (pct) {
      submitBtn.textContent = 'جارٍ رفع الصورة… ' + pct + '%';
    }).then(function (url) {
      const newProduct = { name, desc, price, img: url };
      const products = getProducts();
      let verb;
      if (editingProductIndex !== null) {
        if (products[editingProductIndex]._id) newProduct._id = products[editingProductIndex]._id;
        products[editingProductIndex] = newProduct;
        verb = 'تم تحديث المنتج بنجاح';
      } else {
        products.unshift(newProduct);
        verb = 'تم إضافة المنتج بنجاح';
      }
      return persistProducts(products).then(function (ok) {
        if (!ok) {
          showError('فشل حفظ المنتج في قاعدة البيانات — لم يُحفظ التغيير.');
          return;
        }
        showSuccess(verb);
        resetForm();
        displayProducts();
      });
    }).catch(function (err) {
      showError(err.message || 'فشل رفع الصورة');
    }).then(function () {
      submitBtn.disabled = false;
      submitBtn.textContent = originalLabel;
    });
  }

  // ── التهيئة ──────────────────────────────────────────────
  function init() {
    // معاينة الصورة
    $('product-image').addEventListener('change', function (e) {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = function (ev) {
          $('product-preview-img').src = ev.target.result;
          $('product-image-preview').classList.remove('hidden');
        };
        reader.readAsDataURL(file);
      }
    });

    $('product-form').addEventListener('submit', saveProduct);
    $('product-cancel').addEventListener('click', resetForm);

    // تحميل المنتجات من Firestore (المصدر الوحيد) — بلا قائمة افتراضية
    (async function () {
      if (typeof window.storeGetProducts === 'function') {
        productsCache = await window.storeGetProducts();
      } else {
        productsCache = JSON.parse(localStorage.getItem('allProducts')) || [];
      }
      if (!Array.isArray(productsCache)) productsCache = [];
      displayProducts();
      if (typeof window.storeWatchProducts === 'function') {
        window.storeWatchProducts(function (items) {
          productsCache = items;
          if ($('products-view') && !$('products-view').classList.contains('hidden')) {
            displayProducts();
          } else {
            displayProducts();
          }
        });
      }
    })();
  }

  // واجهة عامة لأزرار التعديل/الحذف
  window.adminProducts = { edit: editProduct, remove: deleteProduct, move: moveProduct };

  // التهيئة عند جاهزية DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
