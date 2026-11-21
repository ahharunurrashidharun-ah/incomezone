export async function compressImage(
  file: File, 
  maxDimension = 600, 
  quality = 0.55,
  targetSizeKB = 25
): Promise<File> {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/')) {
      return resolve(file); // Return original if not an image
    }

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = async () => {
      let { width, height } = img;
      
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(objectUrl);
        return resolve(file);
      }

      ctx.drawImage(img, 0, 0, width, height);
      
      let currentQuality = quality;
      let blob: Blob | null = null;

      // Iteratively adjust quality/dimensions to achieve ~20KB target size
      for (let attempt = 0; attempt < 5; attempt++) {
        blob = await new Promise<Blob | null>((res) => {
          canvas.toBlob(res, 'image/jpeg', currentQuality);
        });

        if (!blob || (blob.size / 1024) <= targetSizeKB || currentQuality <= 0.2) {
          break;
        }
        currentQuality -= 0.12;
      }

      URL.revokeObjectURL(objectUrl);

      if (blob) {
        // Keep original file name but change extension to .jpg
        const newName = file.name.replace(/\.[^/.]+$/, "") + ".jpg";
        const compressedFile = new File([blob], newName, {
          type: 'image/jpeg',
          lastModified: Date.now()
        });
        resolve(compressedFile);
      } else {
        resolve(file);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file);
    };

    img.src = objectUrl;
  });
}

export function fileToBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
}
