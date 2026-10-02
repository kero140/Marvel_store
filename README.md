# MARVEL STORE

Static, mobile-first fashion storefront for GitHub Pages.

## Stack
- Vanilla HTML/CSS/JavaScript
- Firebase Authentication + Realtime Database
- Cloudinary unsigned image upload
- GitHub Pages compatible
- No build step required

## Project configuration
Edit `assets/js/config.js` only if Firebase/Cloudinary values change.

## Important
- Never put Firebase Admin SDK credentials, service-account JSON, API secrets, or passwords in this repository.
- Firebase Web API configuration is intended for client apps; database security is enforced by Realtime Database Rules.
- Cloudinary upload preset is unsigned. Restrict its allowed formats/folder/settings in Cloudinary.

## Deployment
Upload the repository contents to the `main` branch, then enable GitHub Pages from Settings > Pages > Deploy from branch > main / root.

## Admin
The admin route is intentionally not linked from the public storefront. Open `#admin` manually and authenticate with the Firebase Authentication account. The email/password fields are never prefilled.

## Image performance
Images are resized/compressed in the browser to WebP when supported before upload, then delivered through Cloudinary with `f_auto,q_auto` and responsive widths.

## WhatsApp image behavior
The free `wa.me` link can prefill text and image/product URLs, but it cannot silently attach local image files as WhatsApp media. This version therefore sends the product image URL inside the order message. Actual automatic media attachments would require a WhatsApp API/backend workflow and are intentionally not added to keep the project client-only and zero-cost.
