import { auth, db, firebaseAPI as F } from "./firebase.js";
import { STORE_DEFAULTS } from "./config.js";
import {
  store,
  saveProduct,
  deleteProduct,
  saveCategory,
  deleteCategory,
  saveSettings,
  saveShipping,
  updateOrder,
  deleteOrder
} from "./store.js";
import { uploadImage, cloudinaryUrl } from "./images.js";
import { $, $$, escapeHTML, money, toast, slugify } from "./utils.js";

const {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  ref,
  get
} = F;

let unmounted = false;

export function mountAdmin({ state, renderRoute }) {
  const root = $("#admin-root");

  const draw = () => {
    if (!unmounted) {
      render(root, state, renderRoute);
    }
  };

  const unsub = onAuthStateChanged(auth, async user => {
    state.user = user;
    state.admin = false;

    if (user) {
      try {
        const snap = await get(ref(db, `admins/${user.uid}`));
        state.admin = snap.exists() && snap.val() === true;
      } catch (e) {
        console.error("Admin permission check error:", e);
        toast("تعذر التحقق من صلاحيات الحساب.", "error");
      }
    }

    if (state.admin) {
      try {
        await (await import("./store.js")).loadStore(true);
      } catch (e) {
        console.error("Admin store loading error:", e);
        toast("تعذر تحميل بيانات لوحة التحكم.", "error");
      }
    }

    draw();
  });

  draw();

  window.addEventListener(
    "beforeunload",
    () => {
      unmounted = true;
      unsub?.();
    },
    { once: true }
  );
}

function render(root, state, renderRoute) {
  if (!state.user) {
    return (root.innerHTML = loginHTML());
  }

  if (!state.admin) {
    return (root.innerHTML = deniedHTML());
  }

  root.innerHTML = dashboardHTML();
  bindDashboard(root, state, renderRoute);
}

function loginHTML() {
  return `
    <section class="admin-login">
      <div class="admin-login-card">
        <div class="admin-logo">M</div>
        <span class="eyebrow">PRIVATE AREA</span>
        <h1>MARVEL ADMIN</h1>
        <p>لوحة التحكم الخاصة بالمتجر</p>

        <form id="admin-login-form">
          <label>
            البريد الإلكتروني
            <input
              required
              type="email"
              name="email"
              autocomplete="username"
              placeholder="أدخلي البريد الإلكتروني"
            >
          </label>

          <label>
            كلمة المرور
            <input
              required
              type="password"
              name="password"
              autocomplete="current-password"
              placeholder="أدخلي كلمة المرور"
            >
          </label>

          <button class="primary-btn full">
            تسجيل الدخول
          </button>

          <button
            type="button"
            class="text-btn"
            id="forgot-admin"
          >
            نسيتِ كلمة المرور؟
          </button>
        </form>

        <a href="#home" class="back-store">
          ← العودة للمتجر
        </a>
      </div>
    </section>
  `;
}

function deniedHTML() {
  return `
    <section class="admin-login">
      <div class="admin-login-card">
        <div class="admin-logo">!</div>
        <h1>غير مصرح</h1>
        <p>هذا الحساب ليس لديه صلاحية إدارة Marvel Store.</p>

        <button class="primary-btn full" id="admin-logout">
          تسجيل الخروج
        </button>
      </div>
    </section>
  `;
}

function dashboardHTML() {
  return `
    <section class="admin-shell">

      <aside class="admin-sidebar">

        <div class="admin-brand">
          <b>M</b>
          <span>
            MARVEL<br>
            <small>ADMIN</small>
          </span>
        </div>

        <nav>
          <button data-tab="overview" class="active">
            ⌂ نظرة عامة
          </button>

          <button data-tab="products">
            ▦ المنتجات
          </button>

          <button data-tab="categories">
            ◫ التصنيفات
          </button>

          <button data-tab="orders">
            ▣ الطلبات
          </button>

          <button data-tab="store">
            ✦ المتجر
          </button>

          <button data-tab="shipping">
            ⌁ الشحن
          </button>
        </nav>

        <button id="admin-logout" class="logout-btn">
          ↪ تسجيل الخروج
        </button>

      </aside>

      <div class="admin-content">

        <div class="admin-mobilebar">
          <a href="#home">MARVEL STORE</a>
          <button id="admin-menu">☰</button>
        </div>

        <div id="admin-panel"></div>

      </div>

    </section>
  `;
}

function bindDashboard(root, state, renderRoute) {
  const panel = $("#admin-panel", root);
  const tabs = $$(".admin-sidebar [data-tab]", root);

  function show(tab) {
    tabs.forEach(button => {
      button.classList.toggle(
        "active",
        button.dataset.tab === tab
      );
    });

    const handlers = {
      overview,
      products: productsTab,
      categories: categoriesTab,
      orders: ordersTab,
      store: storeTab,
      shipping: shippingTab
    };

    handlers[tab]?.(panel);
  }

  tabs.forEach(button => {
    button.addEventListener("click", () => {
      show(button.dataset.tab);
    });
  });

  $("#admin-logout", root).addEventListener(
    "click",
    async () => {
      await signOut(auth);
      location.hash = "#home";
    }
  );

  $("#admin-menu", root)?.addEventListener(
    "click",
    () => {
      $(".admin-sidebar", root).classList.toggle("show");
    }
  );

  show("overview");
}

function overview(p) {
  const ps = Object.values(store.products || {});
  const cs = Object.values(store.categories || {});
  const os = Object.values(store.orders || {});

  p.innerHTML = `
    <div class="admin-head">
      <div>
        <span class="eyebrow">CONTROL CENTER</span>
        <h1>مرحبًا بكِ في Marvel Store</h1>
        <p>كل ما تحتاجينه لإدارة المتجر من مكان واحد.</p>
      </div>

      <a class="secondary-btn" href="#home">
        فتح المتجر ↗
      </a>
    </div>

    <div class="stat-grid">
      <div>
        <span>المنتجات</span>
        <b>${ps.length}</b>
      </div>

      <div>
        <span>التصنيفات</span>
        <b>${cs.filter(x => x.active !== false).length}</b>
      </div>

      <div>
        <span>الطلبات</span>
        <b>${os.length}</b>
      </div>

      <div>
        <span>طلبات جديدة</span>
        <b>${os.filter(x => x.status === "new").length}</b>
      </div>
    </div>

    <div class="admin-card">

      <div class="card-head">
        <h2>آخر الطلبات</h2>
        <button class="text-btn" data-admin-tab="orders">
          عرض الكل
        </button>
      </div>

      ${
        Object.entries(store.orders || {})
          .sort(
            (a, b) =>
              (b[1].createdAt || 0) -
              (a[1].createdAt || 0)
          )
          .slice(0, 5)
          .map(([id, o]) => orderRow(id, o, true))
          .join("") ||
        emptyAdmin("لسه مفيش طلبات.")
      }

    </div>

    ${
      !store.remoteCategories
        ? `
          <div class="admin-card setup-card">
            <h2>الإعداد الأولي</h2>
            <p>
              قاعدة البيانات محتاجة التصنيفات والإعدادات الأساسية مرة واحدة.
            </p>
            <button class="primary-btn" id="seed-store">
              تهيئة Marvel Store
            </button>
          </div>
        `
        : ""
    }
  `;

  p.querySelector("[data-admin-tab]")?.addEventListener(
    "click",
    () => ordersTab(p)
  );

  p.querySelector("#seed-store")?.addEventListener(
    "click",
    async () => {
      const { seedDefaults } = await import("./store.js");

      await seedDefaults();

      toast("تم تجهيز أساس المتجر ✓");

      overview(p);
    }
  );
}

function productsTab(p) {
  const list = Object.entries(store.products || {});

  p.innerHTML = `
    <div class="admin-head">
      <div>
        <span class="eyebrow">CATALOG</span>
        <h1>المنتجات</h1>
        <p>${list.length} منتج</p>
      </div>

      <button class="primary-btn" id="new-product">
        + إضافة منتج
      </button>
    </div>

    <div class="admin-toolbar">
      <input
        id="product-search"
        placeholder="ابحثي باسم المنتج..."
      >

      <select id="product-filter">
        <option value="">كل المنتجات</option>
        <option value="active">متاحة</option>
        <option value="hidden">مخفية</option>
      </select>
    </div>

    <div
      id="products-table"
      class="admin-products-table"
    >
      ${
        list.map(([id, product]) =>
          productRow(id, product)
        ).join("") ||
        emptyAdmin("لا توجد منتجات بعد.")
      }
    </div>
  `;

  $("#new-product").onclick = () => productForm(p);

  const filter = () => {
    const q = $("#product-search")
      .value
      .toLowerCase()
      .trim();

    const f = $("#product-filter").value;

    const filtered = list.filter(
      ([id, x]) =>
        (!q ||
          x.name
            ?.toLowerCase()
            .includes(q)) &&
        (!f ||
          (f === "active"
            ? x.active !== false
            : x.active === false))
    );

    $("#products-table").innerHTML =
      filtered.map(([id, x]) =>
        productRow(id, x)
      ).join("") ||
      emptyAdmin("لا توجد نتائج.");

    bindProductActions(p);
  };

  $("#product-search").oninput = filter;
  $("#product-filter").onchange = filter;

  bindProductActions(p);
}

function productRow(id, x) {
  return `
    <div class="admin-product-row">

      <img
        src="${cloudinaryUrl(
          x.images?.[0]?.url ||
          x.image ||
          "",
          160
        )}"
        alt=""
      >

      <div>
        <b>
          ${escapeHTML(x.name || "بدون اسم")}
        </b>

        <small>
          ${money(
            Number(
              x.salePrice ||
              x.price ||
              0
            )
          )}
          ·
          ${x.active === false ? "مخفي" : "متاح"}
        </small>
      </div>

      <div class="row-actions">

        <button data-edit-product="${id}">
          تعديل
        </button>

        <button data-toggle-product="${id}">
          ${x.active === false ? "إظهار" : "إخفاء"}
        </button>

        <button
          class="danger"
          data-delete-product="${id}"
        >
          حذف
        </button>

      </div>

    </div>
  `;
}

function bindProductActions(p) {
  $$("[data-edit-product]", p).forEach(button => {
    button.onclick = () => {
      productForm(
        p,
        button.dataset.editProduct
      );
    };
  });

  $$("[data-toggle-product]", p).forEach(button => {
    button.onclick = async () => {
      const id = button.dataset.toggleProduct;

      await saveProduct(id, {
        ...store.products[id],
        active:
          store.products[id].active === false
      });

      await refreshStore();

      productsTab(p);
    };
  });

  $$("[data-delete-product]", p).forEach(button => {
    button.onclick = async () => {
      if (!confirm("حذف المنتج نهائيًا؟")) return;

      await deleteProduct(
        button.dataset.deleteProduct
      );

      await refreshStore();

      productsTab(p);
    };
  });
}


/* =========================================================
   PRODUCT FORM
   ========================================================= */

function productForm(p, id = null) {
  const x = id
    ? store.products[id]
    : {
        active: true,
        images: [],
        sizes: "",
        colors: ""
      };

  /*
   * مهم:
   * نعمل نسخة مستقلة من الصور.
   * لن نعيد رسم النموذج بعد رفع الصورة.
   */
  const images = [...(x.images || [])];

  p.innerHTML = `
    <div class="admin-head">

      <div>
        <span class="eyebrow">
          PRODUCT EDITOR
        </span>

        <h1>
          ${id ? "تعديل المنتج" : "إضافة منتج"}
        </h1>
      </div>

      <button
        class="secondary-btn"
        id="back-products"
        type="button"
      >
        ← رجوع
      </button>

    </div>

    <form
      id="product-form"
      class="admin-form"
    >

      <div class="form-grid">

        <label>
          اسم المنتج
          <input
            required
            name="name"
            value="${escapeHTML(x.name || "")}"
          >
        </label>

        <label>
          التصنيف

          <select
            required
            name="categoryId"
          >
            ${
              Object.entries(store.categories || {})
                .filter(([, c]) => c.slug !== "all")
                .map(
                  ([cid, c]) => `
                    <option
                      value="${cid}"
                      ${
                        x.categoryId === cid
                          ? "selected"
                          : ""
                      }
                    >
                      ${escapeHTML(c.name)}
                    </option>
                  `
                )
                .join("")
            }
          </select>
        </label>

        <label>
          السعر

          <input
            required
            type="number"
            min="0"
            step="1"
            name="price"
            value="${x.price ?? ""}"
          >
        </label>

        <label>
          السعر قبل الخصم

          <input
            type="number"
            min="0"
            step="1"
            name="compareAt"
            value="${x.compareAt ?? ""}"
          >
        </label>

        <label>
          المقاسات

          <input
            name="sizes"
            value="${escapeHTML(x.sizes || "")}"
            placeholder="S, M, L, XL"
          >
        </label>

        <label>
          الألوان

          <input
            name="colors"
            value="${escapeHTML(x.colors || "")}"
            placeholder="أسود, وردي"
          >
        </label>

        <label>
          Badge

          <input
            name="badge"
            value="${escapeHTML(x.badge || "")}"
            placeholder="NEW / TRENDING"
          >
        </label>

        <label>
          SKU

          <input
            name="sku"
            value="${escapeHTML(x.sku || "")}"
          >
        </label>

      </div>

      <label>
        الوصف

        <textarea
          name="description"
          rows="5"
        >${escapeHTML(x.description || "")}</textarea>
      </label>

      <div class="checks">

        <label>
          <input
            type="checkbox"
            name="active"
            ${x.active !== false ? "checked" : ""}
          >
          ظاهر في المتجر
        </label>

        <label>
          <input
            type="checkbox"
            name="isNew"
            ${x.isNew ? "checked" : ""}
          >
          وصل حديثًا
        </label>

        <label>
          <input
            type="checkbox"
            name="featured"
            ${x.featured ? "checked" : ""}
          >
          مميز
        </label>

      </div>

      <div class="upload-zone">

        <div class="card-head">
          <h2>صور المنتج</h2>

          <small>
            الصور سيتم رفعها إلى Cloudinary وتحسينها تلقائيًا عند العرض.
          </small>
        </div>

        <input
          id="product-images"
          type="file"
          accept="image/*"
          multiple
        >

        <div id="upload-progress"></div>

        <div
          id="image-preview"
          class="image-preview"
        ></div>

      </div>

      <button
        class="primary-btn full"
        type="submit"
      >
        حفظ المنتج
      </button>

    </form>
  `;

  const form = $("#product-form", p);
  const preview = $("#image-preview", p);
  const progress = $("#upload-progress", p);
  const fileInput = $("#product-images", p);

  $("#back-products").onclick = () => {
    productsTab(p);
  };


  /*
   * رسم الصور الحالية/المرفوعة
   */
  function renderImagePreview() {
    preview.innerHTML = "";

    images.forEach((image, index) => {
      const item = document.createElement("div");

      const img = document.createElement("img");

      img.src = cloudinaryUrl(
        image.url || "",
        220
      );

      img.alt = "صورة المنتج";

      const removeButton =
        document.createElement("button");

      removeButton.type = "button";
      removeButton.dataset.removeImage = String(index);
      removeButton.textContent = "×";

      removeButton.addEventListener(
        "click",
        () => {
          images.splice(index, 1);

          renderImagePreview();

          progress.textContent =
            "تم حذف الصورة ✓";
        }
      );

      item.appendChild(img);
      item.appendChild(removeButton);

      preview.appendChild(item);
    });
  }


  /*
   * عرض الصور الموجودة عند فتح تعديل منتج
   */
  renderImagePreview();


  /*
   * رفع الصور
   *
   * أهم تعديل:
   * لا نستدعي productForm() بعد الرفع.
   *
   * لأن استدعاء productForm() كان يعيد إنشاء
   * النموذج بالكامل ويمسح البيانات التي كتبها المستخدم.
   */
  fileInput.onchange = async event => {
    const files = [...(event.target.files || [])];

    if (!files.length) return;

    fileInput.disabled = true;

    let uploadedCount = 0;

    try {
      for (const file of files) {
        try {
          progress.textContent =
            `جاري رفع الصورة... 0%`;

          const info = await uploadImage(
            file,
            percent => {
              progress.textContent =
                `جاري رفع الصورة... ${percent}%`;
            }
          );

          /*
           * إضافة الصورة إلى المصفوفة
           */
          images.push(info);

          /*
           * تحديث المعاينة فقط
           * بدون إعادة بناء النموذج.
           */
          renderImagePreview();

          uploadedCount++;

          progress.textContent =
            `تم رفع الصورة ✓ (${uploadedCount}/${files.length})`;

        } catch (error) {
          console.error(
            "Product image upload error:",
            error
          );

          toast(
            error?.message ||
              "فشل رفع الصورة.",
            "error"
          );

          progress.textContent =
            "تعذر رفع إحدى الصور.";
        }
      }

      if (uploadedCount > 0) {
        progress.textContent =
          `تم رفع ${uploadedCount} صورة ✓`;
      }

    } finally {
      fileInput.disabled = false;

      /*
       * يسمح باختيار نفس الصورة مرة أخرى
       * إذا أراد المستخدم ذلك.
       */
      fileInput.value = "";
    }
  };


  /*
   * حفظ المنتج
   */
  form.onsubmit = async event => {
    event.preventDefault();

    const submitButton =
      form.querySelector(
        'button[type="submit"]'
      );

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent =
        "جاري حفظ المنتج...";
    }

    try {
      const f = new FormData(form);

      const product = {
        name:
          String(
            f.get("name") || ""
          ).trim(),

        categoryId:
          String(
            f.get("categoryId") || ""
          ),

        price:
          Number(
            f.get("price") || 0
          ),

        compareAt:
          Number(
            f.get("compareAt") || 0
          ),

        sizes:
          String(
            f.get("sizes") || ""
          ),

        colors:
          String(
            f.get("colors") || ""
          ),

        badge:
          String(
            f.get("badge") || ""
          ),

        sku:
          String(
            f.get("sku") || ""
          ),

        description:
          String(
            f.get("description") || ""
          ),

        active:
          f.get("active") === "on",

        isNew:
          f.get("isNew") === "on",

        featured:
          f.get("featured") === "on",

        /*
         * الصور التي تم رفعها بالفعل
         */
        images: [...images]
      };

      if (!product.name) {
        throw new Error(
          "اكتبي اسم المنتج."
        );
      }

      if (!product.categoryId) {
        throw new Error(
          "اختاري تصنيف المنتج."
        );
      }

      if (!Number.isFinite(product.price)) {
        throw new Error(
          "السعر غير صحيح."
        );
      }

      await saveProduct(
        id,
        product
      );

      await refreshStore();

      toast(
        "تم حفظ المنتج ✓"
      );

      productsTab(p);

    } catch (error) {
      console.error(
        "Save product error:",
        error
      );

      toast(
        error?.message ||
          "تعذر حفظ المنتج.",
        "error"
      );

      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent =
          "حفظ المنتج";
      }
    }
  };
}


/* =========================================================
   CATEGORIES
   ========================================================= */

function categoriesTab(p) {
  const list = Object.entries(
    store.categories || {}
  ).sort(
    (a, b) =>
      (a[1].order || 0) -
      (b[1].order || 0)
  );

  p.innerHTML = `
    <div class="admin-head">

      <div>
        <span class="eyebrow">
          COLLECTIONS
        </span>

        <h1>التصنيفات</h1>
      </div>

      <button
        class="primary-btn"
        id="new-cat"
      >
        + تصنيف جديد
      </button>

    </div>

    <div class="admin-list">

      ${
        list
          .map(
            ([id, c]) => `
              <div class="admin-list-row">

                <div>
                  <b>
                    ${escapeHTML(c.name)}
                  </b>

                  <small>
                    ${
                      c.active === false
                        ? "مخفي"
                        : "ظاهر"
                    }
                    · ترتيب ${c.order || 0}
                  </small>
                </div>

                <div class="row-actions">

                  <button
                    data-edit-cat="${id}"
                  >
                    تعديل
                  </button>

                  <button
                    data-toggle-cat="${id}"
                  >
                    ${
                      c.active === false
                        ? "إظهار"
                        : "إخفاء"
                    }
                  </button>

                  ${
                    ![
                      "all",
                      "new",
                      "sale"
                    ].includes(c.slug)
                      ? `
                        <button
                          class="danger"
                          data-delete-cat="${id}"
                        >
                          حذف
                        </button>
                      `
                      : ""
                  }

                </div>

              </div>
            `
          )
          .join("")
      }

    </div>
  `;

  $("#new-cat").onclick = () =>
    categoryForm(p);

  $$("[data-edit-cat]", p).forEach(
    button => {
      button.onclick = () =>
        categoryForm(
          p,
          button.dataset.editCat
        );
    }
  );

  $$("[data-toggle-cat]", p).forEach(
    button => {
      button.onclick = async () => {
        const id =
          button.dataset.toggleCat;

        await saveCategory(id, {
          ...store.categories[id],
          active:
            store.categories[id]
              .active === false
        });

        await refreshStore();

        categoriesTab(p);
      };
    }
  );

  $$("[data-delete-cat]", p).forEach(
    button => {
      button.onclick = async () => {
        if (!confirm("حذف التصنيف؟")) return;

        await deleteCategory(
          button.dataset.deleteCat
        );

        await refreshStore();

        categoriesTab(p);
      };
    }
  );
}

function categoryForm(p, id = null) {
  const x = id
    ? store.categories[id]
    : {};

  p.innerHTML = `
    <div class="admin-head">

      <div>
        <span class="eyebrow">
          CATEGORY EDITOR
        </span>

        <h1>
          ${
            id
              ? "تعديل التصنيف"
              : "تصنيف جديد"
          }
        </h1>
      </div>

      <button
        class="secondary-btn"
        id="back-cat"
        type="button"
      >
        ← رجوع
      </button>

    </div>

    <form
      id="cat-form"
      class="admin-form narrow"
    >

      <label>
        اسم التصنيف

        <input
          required
          name="name"
          value="${escapeHTML(x.name || "")}"
        >
      </label>

      <label>
        Slug

        <input
          name="slug"
          value="${escapeHTML(x.slug || "")}"
          placeholder="مثال: dresses"
        >
      </label>

      <label>
        الترتيب

        <input
          type="number"
          name="order"
          value="${x.order ?? 99}"
        >
      </label>

      <label>
        <input
          type="checkbox"
          name="active"
          ${x.active !== false ? "checked" : ""}
        >
        ظاهر
      </label>

      <button class="primary-btn full">
        حفظ التصنيف
      </button>

    </form>
  `;

  $("#back-cat").onclick = () =>
    categoriesTab(p);

  $("#cat-form").onsubmit = async e => {
    e.preventDefault();

    const f =
      new FormData(e.currentTarget);

    await saveCategory(id, {
      name:
        String(
          f.get("name") || ""
        ).trim(),

      slug:
        slugify(
          f.get("slug") ||
          f.get("name")
        ),

      order:
        Number(
          f.get("order") || 99
        ),

      active:
        f.get("active") === "on"
    });

    await refreshStore();

    toast(
      "تم حفظ التصنيف ✓"
    );

    categoriesTab(p);
  };
}


/* =========================================================
   ORDERS
   ========================================================= */

function ordersTab(p) {
  const list = Object.entries(
    store.orders || {}
  ).sort(
    (a, b) =>
      (b[1].createdAt || 0) -
      (a[1].createdAt || 0)
  );

  p.innerHTML = `
    <div class="admin-head">

      <div>
        <span class="eyebrow">
          SALES
        </span>

        <h1>الطلبات</h1>

        <p>
          ${list.length} طلب
        </p>
      </div>

    </div>

    <div class="orders-list">
      ${
        list
          .map(([id, o]) =>
            orderRow(
              id,
              o,
              false
            )
          )
          .join("") ||
        emptyAdmin(
          "لا توجد طلبات بعد."
        )
      }
    </div>
  `;

  $$("[data-status]", p).forEach(
    select => {
      select.onchange = async () => {
        await updateOrder(
          select.dataset.status,
          {
            status: select.value
          }
        );

        await refreshStore();

        ordersTab(p);
      };
    }
  );

  $$("[data-delete-order]", p).forEach(
    button => {
      button.onclick = async () => {
        if (!confirm("حذف الطلب؟")) return;

        await deleteOrder(
          button.dataset.deleteOrder
        );

        await refreshStore();

        ordersTab(p);
      };
    }
  );
}

function orderRow(id, o, compact) {
  const c = o.customer || {};
  const items = o.items || [];

  return `
    <article
      class="order-row ${
        compact ? "compact" : ""
      }"
    >

      <div class="order-main">

        <b>
          ${escapeHTML(
            c.name || "بدون اسم"
          )}
        </b>

        <span>
          ${escapeHTML(
            c.phone || ""
          )}
          ·
          ${new Date(
            o.createdAt ||
              Date.now()
          ).toLocaleString("ar-EG")}
        </span>

        ${
          compact
            ? ""
            : `
              <small>
                ${escapeHTML(
                  c.governorate || ""
                )}
                —
                ${escapeHTML(
                  c.address || ""
                )}
              </small>
            `
        }

      </div>

      <div class="order-items">
        ${items
          .map(
            x =>
              `${escapeHTML(
                x.name
              )} ×${x.qty}`
          )
          .join("، ")}
      </div>

      <b>
        ${money(o.total || 0)}
      </b>

      <select data-status="${id}">
        ${[
          "new",
          "confirmed",
          "preparing",
          "shipped",
          "completed",
          "cancelled"
        ]
          .map(
            s => `
              <option
                value="${s}"
                ${
                  o.status === s
                    ? "selected"
                    : ""
                }
              >
                ${statusName(s)}
              </option>
            `
          )
          .join("")}
      </select>

      ${
        compact
          ? ""
          : `
            <button
              class="danger"
              data-delete-order="${id}"
            >
              حذف
            </button>
          `
      }

    </article>
  `;
}

function statusName(s) {
  return (
    {
      new: "جديد",
      confirmed: "مؤكد",
      preparing: "قيد التجهيز",
      shipped: "تم الشحن",
      completed: "مكتمل",
      cancelled: "ملغي"
    }[s] || s
  );
}


/* =========================================================
   STORE SETTINGS
   ========================================================= */

function storeTab(p) {
  const s =
    store.settings || {};

  p.innerHTML = `
    <div class="admin-head">

      <div>
        <span class="eyebrow">
          BRAND CONTROL
        </span>

        <h1>
          إعدادات المتجر
        </h1>
      </div>

    </div>

    <form
      id="store-form"
      class="admin-form"
    >

      <label>
        اسم المتجر

        <input
          name="name"
          value="${escapeHTML(
            s.name ||
              "MARVEL STORE"
          )}"
        >
      </label>

      <label>
        الشعار النصي

        <input
          name="tagline"
          value="${escapeHTML(
            s.tagline || ""
          )}"
        >
      </label>

      <label>
        رسالة الإعلان

        <input
          name="announcement"
          value="${escapeHTML(
            s.announcement || ""
          )}"
        >
      </label>

      <label>
        WhatsApp

        <input
          name="whatsapp"
          inputmode="tel"
          value="${escapeHTML(
            s.whatsapp ||
              "201286560161"
          )}"
        >
      </label>

      <label>
        رابط Facebook Group

        <input
          name="facebookGroup"
          type="url"
          value="${escapeHTML(
            s.facebookGroup || ""
          )}"
        >
      </label>

      <button class="primary-btn">
        حفظ الإعدادات
      </button>

    </form>
  `;

  $("#store-form").onsubmit =
    async e => {
      e.preventDefault();

      const f =
        new FormData(
          e.currentTarget
        );

      await saveSettings(
        Object.fromEntries(
          f.entries()
        )
      );

      await refreshStore();

      toast(
        "تم حفظ إعدادات المتجر ✓"
      );
    };
}


/* =========================================================
   SHIPPING
   ========================================================= */

function shippingTab(p) {
  const s =
    store.shipping || {
      default: 0
    };

  p.innerHTML = `
    <div class="admin-head">

      <div>
        <span class="eyebrow">
          DELIVERY
        </span>

        <h1>الشحن</h1>

        <p>
          يمكن تعديل سياسة الشحن من هنا.
        </p>
      </div>

    </div>

    <form
      id="shipping-form"
      class="admin-form narrow"
    >

      <label>
        سعر الشحن الافتراضي

        <input
          type="number"
          min="0"
          name="default"
          value="${Number(
            s.default || 0
          )}"
        >
      </label>

      <label>
        ملاحظات

        <textarea
          name="notes"
          rows="4"
        >${escapeHTML(
          s.notes || ""
        )}</textarea>
      </label>

      <button class="primary-btn">
        حفظ الشحن
      </button>

    </form>
  `;

  $("#shipping-form").onsubmit =
    async e => {
      e.preventDefault();

      const f =
        new FormData(
          e.currentTarget
        );

      await saveShipping({
        default:
          Number(
            f.get("default") || 0
          ),

        notes:
          f.get("notes") || ""
      });

      await refreshStore();

      toast(
        "تم حفظ الشحن ✓"
      );
    };
}


/* =========================================================
   HELPERS
   ========================================================= */

function emptyAdmin(text) {
  return `
    <div class="empty-state admin-empty">
      <b>${text}</b>
    </div>
  `;
}

async function refreshStore() {
  const { loadStore } =
    await import("./store.js");

  await loadStore(true);
}


/* =========================================================
   LOGIN
   ========================================================= */

document.addEventListener(
  "submit",
  async e => {
    if (
      e.target.id !==
      "admin-login-form"
    ) {
      return;
    }

    e.preventDefault();

    const f =
      new FormData(e.target);

    try {
      await signInWithEmailAndPassword(
        auth,
        String(
          f.get("email")
        ).trim(),
        String(
          f.get("password")
        )
      );

      toast(
        "تم تسجيل الدخول ✓"
      );

    } catch (err) {
      console.error(
        "Admin login error:",
        err
      );

      toast(
        "بيانات الدخول غير صحيحة أو لم يتم تفعيل Email/Password.",
        "error"
      );
    }
  }
);


/* =========================================================
   PASSWORD RESET / LOGOUT
   ========================================================= */

document.addEventListener(
  "click",
  async e => {

    if (
      e.target.id ===
      "forgot-admin"
    ) {
      const email = prompt(
        "اكتبي بريد حساب الأدمن لإرسال رابط إعادة التعيين:"
      );

      if (!email) return;

      try {
        await sendPasswordResetEmail(
          auth,
          email.trim()
        );

        toast(
          "تم إرسال رابط إعادة التعيين إذا كان الحساب موجودًا."
        );

      } catch (error) {
        console.error(
          "Password reset error:",
          error
        );

        toast(
          "تعذر إرسال الرابط.",
          "error"
        );
      }
    }

    if (
      e.target.id ===
      "admin-logout"
    ) {
      await signOut(auth);
      location.hash = "#home";
    }
  }
);
