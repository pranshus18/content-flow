# Logo Setup Instructions

## 📍 **Where to Place Your Logo**

Place your logo file in this directory:
```
public/logo.png
```

## 📝 **Steps to Add Your Logo**

1. **Get your logo file** (the "tatva:Ops" logo image)
2. **Rename it to `logo.png`** (or keep original name and update code)
3. **Place it in the `public/` folder** of this project
4. **That's it!** The logo will automatically be used for all videos

## ✅ **Supported Formats**

- **PNG** (recommended - supports transparency) → `public/logo.png`
- **JPG/JPEG** → `public/logo.jpg`
- **SVG** → `public/logo.svg`

## 🎯 **Logo Specifications**

- **Recommended size**: 200x200px to 500x500px
- **Aspect ratio**: Square (1:1) works best
- **Background**: Transparent PNG is best for watermarks
- **File size**: Under 1MB

## 🔄 **After Adding Logo**

1. The logo will be automatically detected
2. No code changes needed
3. Logo will appear on all uploaded videos automatically
4. Restart dev server if running: `npm run dev`

## 📍 **Current Logo Path**

The code looks for: `/logo.png` (which maps to `public/logo.png`)

If your logo has a different name, update the path in `src/utils/videoProcess.ts`:
```typescript
const localLogoPath = '/logo.png'; // Change to your logo filename
```
