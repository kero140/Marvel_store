import { cloudinary } from "./config.js";

export function cloudinaryUrl(url, width = 800) {
  if (!url || !url.includes("res.cloudinary.com")) return url || "";
  return url.replace("/upload/", `/upload/f_auto,q_auto,w_${Math.max(120, Math.round(width))},c_limit/`);
}

export function srcset(url) {
  if (!url || !url.includes("res.cloudinary.com")) return "";
  return [320,480,640,800,1080].map(w => `${cloudinaryUrl(url,w)} ${w}w`).join(", ");
}

async function fileToWebP(file, maxSide = 1800, quality = 0.82) {
  if (!file.type.startsWith("image/")) throw new Error("الملف ليس صورة.");
  let bitmap;
  if (window.createImageBitmap) {
    bitmap = await createImageBitmap(file);
  } else {
    bitmap = await new Promise((resolve,reject)=>{
      const img=new Image();
      img.onload=()=>resolve(img);
      img.onerror=reject;
      img.src=URL.createObjectURL(file);
    });
  }
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext("2d", { alpha: false });
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();
  const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/webp", quality));
  if (blob) return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".webp", { type: "image/webp" });
  const fallback = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", .84));
  if (!fallback) throw new Error("تعذر تجهيز الصورة.");
  return new File([fallback], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
}

export async function uploadImage(file, onProgress) {
  if (file.size > 12 * 1024 * 1024) throw new Error("الصورة أكبر من 12MB.");
  const optimized = await fileToWebP(file);
  const form = new FormData();
  form.append("file", optimized);
  form.append("upload_preset", cloudinary.uploadPreset);
  form.append("folder", "marvel-store/products");
  onProgress?.(10);
  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudinary.cloudName}/image/upload`, {
    method: "POST",
    body: form
  });
  onProgress?.(90);
  const data = await response.json();
  if (!response.ok || !data.secure_url) throw new Error(data.error?.message || "فشل رفع الصورة.");
  onProgress?.(100);
  return {
    url: data.secure_url,
    publicId: data.public_id || "",
    width: data.width || 0,
    height: data.height || 0,
    format: data.format || "webp",
    bytes: data.bytes || optimized.size
  };
}
