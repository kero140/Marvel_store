import { cloudinary } from "./config.js";

export function cloudinaryUrl(url, width = 800) {
  if (!url || !url.includes("res.cloudinary.com")) return url || "";

  const safeWidth = Math.max(120, Math.round(width));

  // لو الرابط فيه transformations بالفعل، لا نكررها
  if (url.includes("/upload/f_auto")) {
    return url;
  }

  return url.replace(
    "/upload/",
    `/upload/f_auto,q_auto,w_${safeWidth},c_limit/`
  );
}

export function srcset(url) {
  if (!url || !url.includes("res.cloudinary.com")) return "";

  return [320, 480, 640, 800, 1080]
    .map(width => `${cloudinaryUrl(url, width)} ${width}w`)
    .join(", ");
}

function validateImage(file) {
  if (!file) {
    throw new Error("لم يتم اختيار صورة.");
  }

  if (!file.type || !file.type.startsWith("image/")) {
    throw new Error("الملف الذي اخترته ليس صورة.");
  }

  if (file.size > 15 * 1024 * 1024) {
    throw new Error("حجم الصورة أكبر من 15MB.");
  }
}

async function readCloudinaryResponse(response) {
  const text = await response.text();

  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!response.ok) {
    const message =
      data?.error?.message ||
      data?.message ||
      text ||
      `Cloudinary HTTP ${response.status}`;

    throw new Error(`Cloudinary: ${message}`);
  }

  if (!data?.secure_url) {
    throw new Error("Cloudinary لم يُرجع رابط الصورة.");
  }

  return data;
}

export async function uploadImage(file, onProgress) {
  validateImage(file);

  if (!cloudinary?.cloudName) {
    throw new Error("Cloudinary Cloud Name غير موجود في config.js.");
  }

  if (!cloudinary?.uploadPreset) {
    throw new Error("Cloudinary Upload Preset غير موجود في config.js.");
  }

  const endpoint =
    `https://api.cloudinary.com/v1_1/` +
    `${cloudinary.cloudName}/image/upload`;

  const form = new FormData();

  form.append("file", file);
  form.append("upload_preset", cloudinary.uploadPreset);
  form.append("folder", "marvel-store/products");

  onProgress?.(5);

  let response;

  try {
    response = await fetch(endpoint, {
      method: "POST",
      body: form
    });
  } catch (error) {
    console.error("Cloudinary network error:", error);

    throw new Error(
      "تعذر الاتصال بـ Cloudinary. تأكدي من الإنترنت وحاولي مرة أخرى."
    );
  }

  onProgress?.(90);

  const data = await readCloudinaryResponse(response);

  onProgress?.(100);

  return {
    url: data.secure_url,
    publicId: data.public_id || "",
    width: Number(data.width || 0),
    height: Number(data.height || 0),
    format: data.format || "",
    bytes: Number(data.bytes || file.size)
  };
}
