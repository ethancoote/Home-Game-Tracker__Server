import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import sharp from 'sharp';

export const r2 = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
    }
});

export async function uploadImage(r2, file, key) {
    try {
        const compressedFile = await sharp(file.buffer)
            .resize(256, 256, { fit: 'inside' })
            .webp({ quality: 80 })
            .toBuffer();

        await r2.send(
            new PutObjectCommand({
                Bucket: process.env.R2_BUCKET_NAME,
                Key: key,
                Body: compressedFile,
                ContentType: file.mimetype
            })
        );
        return 1;
    } catch (err) {
        console.error(`updateImage failed upload to R2 - ${err}`);
        return null;
    }
}