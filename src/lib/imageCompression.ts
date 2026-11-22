export async function compressImage(
  file: File, 
  maxDimension = 600, 
  quality = 0.55,
  targetSizeKB = 25
): Promise<File> {
  return new Promise((resolve) => {
    const fileType = (file.type || '').toLowerCase();
    const isLikelyImage =
      fileType.startsWith('image/') ||
      !fileType ||
      fileType === 'application/octet-stream' ||
      /\.(jpe?g|png|webp|gif|bmp|avif|heic|heif)$/i.test(file.name || '');

    if (!isLikelyImage) {
      return resolve(file); // Return original if definitely not an image
    }

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = async () => {
      try {
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
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(objectUrl);
          return resolve(file);
        }

        let blob: Blob | null = null;
        let currentWidth = Math.max(120, width);
        let currentHeight = Math.max(120, height);

        // Up to 3 dimension passes x 5 quality steps to guarantee compact payload
        for (let dimPass = 0; dimPass < 3; dimPass++) {
          canvas.width = currentWidth;
          canvas.height = currentHeight;
          ctx.clearRect(0, 0, currentWidth, currentHeight);
          ctx.drawImage(img, 0, 0, currentWidth, currentHeight);

          let currentQuality = quality;
          for (let attempt = 0; attempt < 5; attempt++) {
            blob = await new Promise<Blob | null>((res) => {
              canvas.toBlob(res, 'image/jpeg', currentQuality);
            });

            if (!blob || (blob.size / 1024) <= targetSizeKB || currentQuality <= 0.22) {
              break;
            }
            currentQuality -= 0.12;
          }

          if (!blob || (blob.size / 1024) <= Math.max(targetSizeKB * 1.5, 45)) {
            break;
          }

          currentWidth = Math.max(160, Math.round(currentWidth * 0.72));
          currentHeight = Math.max(160, Math.round(currentHeight * 0.72));
        }

        URL.revokeObjectURL(objectUrl);

        if (blob) {
          const baseName = (file.name || 'proof').replace(/\.[^/.]+$/, '');
          const compressedFile = new File([blob], `${baseName}.jpg`, {
            type: 'image/jpeg',
            lastModified: Date.now()
          });
          resolve(compressedFile);
        } else {
          resolve(file);
        }
      } catch {
        URL.revokeObjectURL(objectUrl);
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
