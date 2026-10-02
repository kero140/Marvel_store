import { auth, db, firebaseAPI as F } from "./firebase.js";
import { STORE_DEFAULTS } from "./config.js";
import { loadStore, store, saveOrder } from "./store.js";
import { cloudinaryUrl, srcset } from "./images.js";
import { $, $$, escapeHTML, money, toast, debounce } from "./utils.js";

const state = { cart: loadLocal("marvel_cart",[]), wishlist: loadLocal("marvel_wishlist",[]), user:null, admin:false, ready:false, search:"" };
const view = $("#view");

function loadLocal(k,f){try{return JSON.parse(localStorage.getItem(k)) ?? f}catch{return f}}
function persist(){localStorage.setItem("marvel_cart",JSON.stringify(state.cart));localStorage.setItem("marvel_wishlist",JSON.stringify(state.wishlist));updateCounts();}
function updateCounts(){
  $("#cart-count").textContent=state.cart.reduce((a,x)=>a+x.qty,0);
  $("#wish-count").textContent=state.wishlist.length;
}
function activeCategories(){return Object.entries(store.categories||{}).filter(([,c])=>c?.active!==false && c?.slug!=="all").sort((a,b)=>(a[1].order||0)-(b[1].order||0));}
function products(){return Object.entries(store.products||{}).map(([id,p])=>({id,...p})).filter(p=>p.active!==false);}
function categoryProducts(slug){
  let list=products();
  if(slug==="new") return list.filter(p=>p.isNew).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
  if(slug==="sale") return list.filter(p=>Number(p.salePrice||0)>0 || Number(p.compareAt||0)>Number(p.price||0));
  if(slug!=="all") list=list.filter(p=>p.categoryId===slug || p.category===slug);
  return list;
}
function productCard(p){
  const img=cloudinaryUrl(p.images?.[0]?.url || p.image || "",640);
  const wished=state.wishlist.includes(p.id);
  const final=Number(p.salePrice||p.price||0), old=Number(p.compareAt||0);
  return `<article class="product-card">
    <a href="#product/${encodeURIComponent(p.id)}" class="product-image-wrap">
      ${img?`<img loading="lazy" decoding="async" src="${img}" srcset="${srcset(p.images?.[0]?.url||p.image||"")}" sizes="(max-width:640px) 50vw, (max-width:1000px) 25vw, 220px" alt="${escapeHTML(p.name)}">`:`<div class="image-placeholder"><span>MARVEL</span></div>`}
      ${p.badge?`<span class="product-badge">${escapeHTML(p.badge)}</span>`:""}
      ${old>final?`<span class="sale-badge">-${Math.round((1-final/old)*100)}%</span>`:""}
    </a>
    <button class="heart-btn ${wished?"active":""}" data-wish="${p.id}" aria-label="المفضلة">${wished?"♥":"♡"}</button>
    <div class="product-info">
      <a href="#product/${encodeURIComponent(p.id)}"><h3>${escapeHTML(p.name||"منتج")}</h3></a>
      <div class="price-row"><strong>${money(final)}</strong>${old>final?`<del>${money(old)}</del>`:""}</div>
      <button class="quick-add" data-add="${p.id}">أضيفي للسلة</button>
    </div>
  </article>`;
}
function renderHome(){
  const cats=activeCategories();
  const list=products();
  const newList=list.filter(p=>p.isNew).slice(0,8);
  const featured=(newList.length?newList:list).slice(0,8);
  view.innerHTML=`<section class="hero">
    <div class="hero-copy"><span class="eyebrow">MARVEL STORE</span><h1>أسلوبكِ<br><em>يبدأ من هنا.</em></h1><p>${escapeHTML(store.settings.tagline||STORE_DEFAULTS.tagline)}</p><a class="primary-btn" href="#category/all">اكتشفي المجموعة</a></div>
    <div class="hero-art"><div class="orb orb-a"></div><div class="orb orb-b"></div><div class="hero-letter">M</div></div>
  </section>
  <section class="section"><div class="section-head"><div><span class="eyebrow">DISCOVER</span><h2>تسوّقي حسب الفئة</h2></div><a href="#category/all">عرض الكل</a></div>
    <div class="category-strip">${cats.map(([id,c])=>`<a href="#category/${encodeURIComponent(c.slug||id)}" class="category-chip"><span>${escapeHTML(c.name)}</span><i>↗</i></a>`).join("")}</div>
  </section>
  <section class="section section-tint"><div class="section-head"><div><span class="eyebrow">NEW IN</span><h2>وصل حديثًا</h2></div><a href="#category/new">عرض الكل</a></div>
    <div class="product-grid">${(newList.length?newList:featured).map(productCard).join("")}</div>
  </section>
  <section class="editorial"><div><span class="eyebrow">THE MARVEL EDIT</span><h2>تفاصيل صغيرة.<br>فرق كبير.</h2><p>اختيارات عصرية مصممة لتدخل عالمكِ بسهولة.</p><a class="text-btn" href="#category/all">استكشفي المجموعة ←</a></div><div class="editorial-card"><span>NEW</span><b>YOUR<br>STYLE</b></div></section>
  <section class="section"><div class="section-head"><div><span class="eyebrow">TRENDING</span><h2>مختارات Marvel</h2></div></div><div class="product-grid">${featured.map(productCard).join("")}</div></section>
  <section class="community"><div><span class="eyebrow">MARVEL COMMUNITY</span><h2>كوني جزءًا من عالمنا.</h2><p>تابعي الجديد والعروض والتحديثات من خلال مجتمع Marvel Store.</p><a class="secondary-btn" href="${escapeHTML(store.settings.facebookGroup||STORE_DEFAULTS.facebookGroup)}" target="_blank" rel="noopener">انضمي للمجموعة</a></section>`;
}
function renderCategory(slug){
  const cat=activeCategories().find(([,c])=>(c.slug||"")===slug);
  const title=slug==="all"?"كل المنتجات":slug==="new"?"وصل حديثًا":slug==="sale"?"العروض":cat?.[1]?.name||"المنتجات";
  const list=categoryProducts(slug);
  view.innerHTML=`<section class="page-head"><span class="eyebrow">MARVEL STORE</span><h1>${escapeHTML(title)}</h1><p>${list.length} منتج</p></section>
  <section class="listing"><div class="filterbar"><button class="filter-toggle">☷ التصنيفات</button><span>${list.length} نتيجة</span></div><div class="product-grid">${list.length?list.map(productCard).join(""):`<div class="empty-state"><b>لسه بنجهز المجموعة ✨</b><p>مفيش منتجات في القسم ده حاليًا.</p></div>`}</div></section>`;
}
function renderProduct(id){
  const p=store.products?.[id];
  if(!p){view.innerHTML=`<section class="empty-page"><h1>المنتج غير موجود</h1><a class="primary-btn" href="#home">العودة للمتجر</a></section>`;return;}
  const imgs=(p.images||[]).map(x=>x.url).filter(Boolean); if(!imgs.length&&p.image)imgs.push(p.image);
  const final=Number(p.salePrice||p.price||0), old=Number(p.compareAt||0);
  view.innerHTML=`<section class="product-detail">
    <div class="gallery"><div class="thumbs">${imgs.map((u,i)=>`<button class="thumb ${i===0?"active":""}" data-main-image="${escapeHTML(u)}"><img loading="lazy" src="${cloudinaryUrl(u,180)}" alt=""></button>`).join("")}</div><div class="main-photo"><img id="main-product-image" src="${cloudinaryUrl(imgs[0]||"",1000)}" alt="${escapeHTML(p.name)}"></div></div>
    <div class="detail-info"><span class="eyebrow">${escapeHTML(p.badge||"MARVEL EDIT")}</span><h1>${escapeHTML(p.name)}</h1><div class="detail-price"><strong>${money(final)}</strong>${old>final?`<del>${money(old)}</del>`:""}</div>
      <p class="detail-desc">${escapeHTML(p.description||"اختيار أنيق من Marvel Store.")}</p>
      ${p.colors?`<div class="option"><b>اللون</b><div class="option-pills">${String(p.colors).split(",").map(x=>`<button class="pill">${escapeHTML(x.trim())}</button>`).join("")}</div></div>`:""}
      ${p.sizes?`<div class="option"><b>المقاس</b><div class="option-pills">${String(p.sizes).split(",").map(x=>`<button class="pill">${escapeHTML(x.trim())}</button>`).join("")}</div></div>`:""}
      <div class="qty"><button data-qty="-1">−</button><span id="product-qty">1</span><button data-qty="1">+</button></div>
      <button class="primary-btn full" data-detail-add="${id}">أضيفي للسلة</button>
      <a class="whatsapp-detail" href="${productWhatsApp(p)}" target="_blank" rel="noopener">اطلبي عبر WhatsApp مباشرة</a>
    </div></section>`;
}
function productWhatsApp(p){
  const phone=store.settings.whatsapp||STORE_DEFAULTS.whatsapp;
  const text=`مرحبًا MARVEL STORE 👋\nأريد الاستفسار/الطلب:\nالمنتج: ${p.name}\nالسعر: ${money(Number(p.salePrice||p.price||0))}\nرابط المنتج: ${location.href.split("#")[0]}#product/${encodeURIComponent(p.id||"")}\nصورة المنتج: ${p.images?.[0]?.url||p.image||""}`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}
function renderCart(){
  const items=state.cart.map(x=>({ ...x, product:store.products?.[x.id]})).filter(x=>x.product);
  const total=items.reduce((s,x)=>s+(Number(x.product.salePrice||x.product.price||0)*x.qty),0);
  view.innerHTML=`<section class="page-head"><span class="eyebrow">YOUR BAG</span><h1>سلتكِ</h1><p>${items.reduce((a,x)=>a+x.qty,0)} قطعة</p></section>
  <section class="cart-layout"><div class="cart-items">${items.length?items.map(x=>`<article class="cart-item"><img src="${cloudinaryUrl(x.product.images?.[0]?.url||x.product.image||"",260)}" alt=""><div><a href="#product/${x.id}"><h3>${escapeHTML(x.product.name)}</h3></a><strong>${money(Number(x.product.salePrice||x.product.price||0))}</strong><div class="mini-qty"><button data-cart-minus="${x.id}">−</button><span>${x.qty}</span><button data-cart-plus="${x.id}">+</button><button class="remove-link" data-cart-remove="${x.id}">حذف</button></div></div></article>`).join(""):`<div class="empty-state"><b>السلة فاضية 🤍</b><p>ابدئي باختيار القطع التي تعجبكِ.</p><a class="primary-btn" href="#category/all">ابدئي التسوق</a></div>`}</div>
  ${items.length?`<aside class="summary"><h2>ملخص الطلب</h2><div><span>المنتجات</span><b>${money(total)}</b></div><div><span>الشحن</span><b>يُحدد لاحقًا</b></div><hr><div class="total"><span>الإجمالي</span><b>${money(total)}</b></div><a class="primary-btn full" href="#checkout">متابعة الطلب</a></aside>`:""}</section>`;
}
function renderCheckout(){
  const items=state.cart.map(x=>({...x,product:store.products?.[x.id]})).filter(x=>x.product);
  const total=items.reduce((s,x)=>s+Number(x.product.salePrice||x.product.price||0)*x.qty,0);
  if(!items.length){location.hash="#cart";return;}
  view.innerHTML=`<section class="page-head"><span class="eyebrow">CHECKOUT</span><h1>تأكيد الطلب</h1><p>هنرسل تفاصيل طلبكِ إلى WhatsApp.</p></section>
  <section class="checkout-layout"><form id="checkout-form" class="checkout-form"><label>الاسم الكامل<input required name="name" autocomplete="name" placeholder="اكتبي اسمك"></label><label>رقم الهاتف<input required name="phone" inputmode="tel" autocomplete="tel" placeholder="01xxxxxxxxx"></label><label>المحافظة<input required name="governorate" placeholder="مثال: المنيا"></label><label>العنوان<textarea required name="address" rows="3" placeholder="العنوان بالتفصيل"></textarea></label><label>ملاحظات<textarea name="notes" rows="3" placeholder="أي ملاحظات إضافية (اختياري)"></textarea></label><button class="primary-btn full" type="submit">إرسال الطلب عبر WhatsApp</button></form>
  <aside class="summary"><h2>طلبكِ</h2>${items.map(x=>`<div class="summary-item"><span>${escapeHTML(x.product.name)} × ${x.qty}</span><b>${money(Number(x.product.salePrice||x.product.price||0)*x.qty)}</b></div>`).join("")}<hr><div class="total"><span>الإجمالي</span><b>${money(total)}</b></div></aside></section>`;
}
function renderWishlist(){
  const list=state.wishlist.map(id=>store.products?.[id]&&{id,...store.products[id]}).filter(Boolean);
  view.innerHTML=`<section class="page-head"><span class="eyebrow">SAVED</span><h1>المفضلة</h1><p>${list.length} منتج</p></section><section class="listing"><div class="product-grid">${list.length?list.map(productCard).join(""):`<div class="empty-state"><b>مفيش منتجات محفوظة 🤍</b><p>اضغطي على ♡ بجانب أي منتج لإضافته هنا.</p></div>`}</div></section>`;
}
function addCart(id,qty=1){const item=state.cart.find(x=>x.id===id);if(item)item.qty+=qty;else state.cart.push({id,qty});persist();toast("اتضاف للسلة 🤍");}
function toggleWish(id){const i=state.wishlist.indexOf(id);if(i>=0)state.wishlist.splice(i,1);else state.wishlist.push(id);persist();renderRoute();}

async function handleCheckout(e){
  e.preventDefault();
  const form=new FormData(e.currentTarget);
  const items=state.cart.map(x=>({...x,product:store.products?.[x.id]})).filter(x=>x.product);
  const total=items.reduce((s,x)=>s+Number(x.product.salePrice||x.product.price||0)*x.qty,0);
  const order={customer:{name:form.get("name"),phone:form.get("phone"),governorate:form.get("governorate"),address:form.get("address"),notes:form.get("notes")||""},items:items.map(x=>({productId:x.id,name:x.product.name,qty:x.qty,price:Number(x.product.salePrice||x.product.price||0),image:x.product.images?.[0]?.url||x.product.image||""})),total};
  try{
    const id=await saveOrder(order);
    const lines=items.map((x,i)=>`${i+1}. ${x.product.name} × ${x.qty} — ${money(Number(x.product.salePrice||x.product.price||0)*x.qty)}\nصورة: ${x.product.images?.[0]?.url||x.product.image||""}`).join("\n");
    const text=`🛍️ MARVEL STORE — طلب جديد\n\n👤 الاسم: ${order.customer.name}\n📱 الهاتف: ${order.customer.phone}\n📍 المحافظة: ${order.customer.governorate}\n🏠 العنوان: ${order.customer.address}\n\n📦 المنتجات:\n${lines}\n\n💰 الإجمالي: ${money(total)}\n🆔 رقم الطلب: ${id}${order.customer.notes?`\n📝 ملاحظات: ${order.customer.notes}`:""}`;
    state.cart=[];persist();
    window.open(`https://wa.me/${store.settings.whatsapp||STORE_DEFAULTS.whatsapp}?text=${encodeURIComponent(text)}`,"_blank","noopener");
    view.innerHTML=`<section class="success-page"><div class="success-icon">✓</div><span class="eyebrow">ORDER RECEIVED</span><h1>طلبكِ اتجه للواتساب 🤍</h1><p>رقم الطلب: <b>${escapeHTML(id)}</b></p><a class="primary-btn" href="#home">العودة للمتجر</a></section>`;
  }catch(err){toast(err.message||"حدث خطأ أثناء إرسال الطلب","error");}
}

function renderRoute(){
  const raw=location.hash.replace(/^#/,"")||"home"; const [route,param]=raw.split("/");
  if(route==="admin"){renderAdminGate();return;}
  if(route==="home")renderHome();
  else if(route==="category")renderCategory(decodeURIComponent(param||"all"));
  else if(route==="product")renderProduct(decodeURIComponent(param||""));
  else if(route==="cart")renderCart();
  else if(route==="checkout")renderCheckout();
  else if(route==="wishlist")renderWishlist();
  else if(route==="search"){renderSearch(param?decodeURIComponent(param):"");}
  else renderHome();
  window.scrollTo({top:0,behavior:"instant"});
}
function renderSearch(q){
  const term=(q||"").trim().toLowerCase();
  const list=products().filter(p=>`${p.name} ${p.description||""} ${p.category||""}`.toLowerCase().includes(term));
  view.innerHTML=`<section class="page-head"><span class="eyebrow">SEARCH</span><h1>نتائج البحث</h1><p>${list.length} نتيجة لـ "${escapeHTML(q||"")}"</p></section><section class="listing"><div class="product-grid">${list.map(productCard).join("")||`<div class="empty-state"><b>ملقيناش حاجة بنفس الاسم.</b><p>جربي كلمة مختلفة.</p></div>`}</div></section>`;
}
function renderAdminGate(){view.innerHTML=`<section id="admin-root"></section>`;import("./admin.js").then(m=>m.mountAdmin({state,renderRoute}));}

$("#year").textContent=new Date().getFullYear();
$("#search-btn").addEventListener("click",()=>$("#search-drawer").classList.remove("hidden"));
$("#search-drawer").addEventListener("click",e=>{if(e.target.matches("[data-close-search]")||e.target===e.currentTarget)e.currentTarget.classList.add("hidden")});
$("#search-input").addEventListener("input",debounce(e=>{$("#search-results").innerHTML=products().filter(p=>p.name?.toLowerCase().includes(e.target.value.toLowerCase())).slice(0,8).map(p=>`<a class="search-result" href="#product/${p.id}"><img src="${cloudinaryUrl(p.images?.[0]?.url||p.image||"",100)}"><span>${escapeHTML(p.name)}</span></a>`).join("")},150));
$("#mobile-menu-btn").addEventListener("click",()=>$("#main-nav").classList.toggle("open"));
document.addEventListener("click",e=>{
  const a=e.target.closest("[data-add]"); if(a){e.preventDefault();addCart(a.dataset.add);return;}
  const w=e.target.closest("[data-wish]"); if(w){e.preventDefault();toggleWish(w.dataset.wish);return;}
  const cp=e.target.closest("[data-cart-plus]"); if(cp){const x=state.cart.find(x=>x.id===cp.dataset.cartPlus);if(x)x.qty++;persist();renderCart();return;}
  const cm=e.target.closest("[data-cart-minus]"); if(cm){const x=state.cart.find(x=>x.id===cm.dataset.cartMinus);if(x)x.qty--;state.cart=state.cart.filter(x=>x.qty>0);persist();renderCart();return;}
  const cr=e.target.closest("[data-cart-remove]"); if(cr){state.cart=state.cart.filter(x=>x.id!==cr.dataset.cartRemove);persist();renderCart();return;}
  const main=e.target.closest("[data-main-image]");if(main){$("#main-product-image").src=cloudinaryUrl(main.dataset.mainImage,1000);$$(".thumb").forEach(x=>x.classList.remove("active"));main.classList.add("active");}
  const da=e.target.closest("[data-detail-add]");if(da){const q=Number($("#product-qty").textContent)||1;addCart(da.dataset.detailAdd,q);}
  const q=e.target.closest("[data-qty]");if(q){const el=$("#product-qty");el.textContent=Math.max(1,(Number(el.textContent)||1)+Number(q.dataset.qty));}
});
document.addEventListener("submit",e=>{if(e.target.id==="checkout-form")handleCheckout(e)});
window.addEventListener("hashchange",renderRoute);
window.addEventListener("load",async()=>{
  try{
    await loadStore(false);
    const wa=store.settings.whatsapp||STORE_DEFAULTS.whatsapp;
    $("#floating-whatsapp").href=`https://wa.me/${wa}`;
    $("#footer-whatsapp").href=`https://wa.me/${wa}`;
    renderRoute();
    updateCounts();
    $("#app-loader").classList.add("done");
    setTimeout(()=>$("#app-loader").remove(),500);
  }catch(err){
    $("#app-loader").innerHTML=`<div class="error-loader"><b>تعذر تحميل المتجر</b><p>${escapeHTML(err.message||"تحقق من اتصال الإنترنت وإعدادات Firebase.")}</p></div>`;
  }
});
F.onAuthStateChanged(auth,async user=>{state.user=user;state.admin=false;if(user){try{const snap=await F.get(F.ref(db,`admins/${user.uid}`));state.admin=snap.exists()&&snap.val()===true;}catch{}}});
