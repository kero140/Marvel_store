import { db, firebaseAPI as F } from "./firebase.js";
import { STORE_DEFAULTS } from "./config.js";
const { ref, get, set, update, push, remove } = F;

const DEFAULT_CATEGORIES = {
  all:{name:"كل المنتجات",slug:"all",order:0,active:true},
  dresses:{name:"فساتين",slug:"dresses",order:1,active:true},
  tops:{name:"تيشيرتات وبلوزات",slug:"tops",order:2,active:true},
  pants:{name:"بناطيل",slug:"pants",order:3,active:true},
  sets:{name:"أطقم",slug:"sets",order:4,active:true},
  bags:{name:"شنط",slug:"bags",order:5,active:true},
  shoes:{name:"جزم",slug:"shoes",order:6,active:true},
  accessories:{name:"إكسسوارات",slug:"accessories",order:7,active:true},
  beauty:{name:"Beauty",slug:"beauty",order:8,active:true},
  sale:{name:"العروض",slug:"sale",order:9,active:true},
  new:{name:"وصل حديثًا",slug:"new",order:10,active:true}
};
const cache = {
  products: {},
  categories: {},
  settings: {...STORE_DEFAULTS},
  shipping: {default:0},
  orders: {},
  remoteCategories: false
};

export async function loadStore(includeOrders=false) {
  const paths=["products","categories","settings","shipping"];
  if(includeOrders) paths.push("orders");
  const snaps=await Promise.all(paths.map(p=>get(ref(db,p))));
  const data={};
  paths.forEach((p,i)=>data[p]=snaps[i].exists()?snaps[i].val():{});
  cache.products=data.products||{};
  cache.remoteCategories=!!(data.categories && Object.keys(data.categories).length);
  cache.categories=data.categories && Object.keys(data.categories).length ? data.categories : DEFAULT_CATEGORIES;
  cache.settings={...STORE_DEFAULTS,...(data.settings||{})};
  cache.shipping=data.shipping||{default:0};
  if(includeOrders) cache.orders=data.orders||{};
  return cache;
}

export async function seedDefaults(){
  const defaults={
    categories:DEFAULT_CATEGORIES,
    settings:STORE_DEFAULTS,
    shipping:{default:0,notes:"يتم الاتفاق على الشحن عبر WhatsApp"}
  };
  if(!cache.remoteCategories){
    await set(ref(db,"categories"),defaults.categories);
    await set(ref(db,"settings"),defaults.settings);
    await set(ref(db,"shipping"),defaults.shipping);
  }
  await loadStore(true);
}
export const store = cache;

export async function saveProduct(id, product) {
  const target = id ? ref(db,`products/${id}`) : push(ref(db,"products"));
  await set(target,{...product,updatedAt:Date.now(),createdAt:product.createdAt||Date.now()});
  return target.key;
}
export async function deleteProduct(id){ await remove(ref(db,`products/${id}`)); }
export async function saveCategory(id, category) {
  const target = id ? ref(db,`categories/${id}`) : push(ref(db,"categories"));
  await set(target,{...category,updatedAt:Date.now()});
  return target.key;
}
export async function deleteCategory(id){ await remove(ref(db,`categories/${id}`)); }
export async function saveSettings(settings){ await update(ref(db,"settings"),settings); }
export async function saveShipping(shipping){ await set(ref(db,"shipping"),shipping); }
export async function saveOrder(order){
  const target = push(ref(db,"orders"));
  await set(target,{...order,id:target.key,createdAt:Date.now(),status:"new"});
  return target.key;
}
export async function updateOrder(id, patch){ await update(ref(db,`orders/${id}`),patch); }
export async function deleteOrder(id){ await remove(ref(db,`orders/${id}`)); }
